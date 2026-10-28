-- Decouple the field agent from the public seller identity.
-- A product published by an agent must always resolve its public seller to the
-- registered factory (agent_factory_registrations) - never to the agent profile.

-- 1. Product -> registered factory link (works even when the factory has no user account)
ALTER TABLE public.manufacturer_products
  ADD COLUMN IF NOT EXISTS registered_factory_id uuid
  REFERENCES public.agent_factory_registrations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_manufacturer_products_registered_factory_id
  ON public.manufacturer_products(registered_factory_id)
  WHERE registered_factory_id IS NOT NULL;

-- 2. Country normaliser: free-text / Arabic names -> ISO code (default YE for this market)
CREATE OR REPLACE FUNCTION public.normalize_country_code(p_country text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $func$
  SELECT CASE
    WHEN p_country IS NULL OR btrim(p_country) = '' THEN 'YE'
    WHEN upper(btrim(p_country)) ~ '^[A-Z]{2}$' THEN upper(btrim(p_country))
    WHEN lower(btrim(p_country)) IN ('yemen', 'اليمن', 'يمن') THEN 'YE'
    WHEN lower(btrim(p_country)) IN ('saudi arabia', 'السعودية', 'المملكة العربية السعودية') THEN 'SA'
    WHEN lower(btrim(p_country)) IN ('china', 'الصين') THEN 'CN'
    WHEN lower(btrim(p_country)) IN ('turkey', 'تركيا') THEN 'TR'
    WHEN lower(btrim(p_country)) IN ('india', 'الهند') THEN 'IN'
    WHEN lower(btrim(p_country)) IN ('egypt', 'مصر') THEN 'EG'
    WHEN lower(btrim(p_country)) IN ('united arab emirates', 'uae', 'الإمارات', 'الامارات') THEN 'AE'
    WHEN lower(btrim(p_country)) IN ('oman', 'عمان') THEN 'OM'
    ELSE upper(left(btrim(p_country), 2))
  END;
$func$;

-- 3. Safe public factory profile (no agent data ever returned)
CREATE OR REPLACE FUNCTION public.get_public_factory_profile(p_ref uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_afr  jsonb;
  v_fr   jsonb;
  v_up   jsonb;
  v_uid  uuid;
  v_reg  uuid;
BEGIN
  -- p_ref may be agent_factory_registrations.id or a factory user id
  SELECT to_jsonb(a) INTO v_afr
  FROM public.agent_factory_registrations a
  WHERE a.id = p_ref OR a.factory_user_id = p_ref
  ORDER BY (a.id = p_ref) DESC
  LIMIT 1;

  IF v_afr IS NOT NULL THEN
    v_reg := (v_afr ->> 'id')::uuid;
    v_uid := NULLIF(v_afr ->> 'factory_user_id', '')::uuid;
  ELSE
    v_uid := p_ref;
  END IF;

  IF v_uid IS NOT NULL THEN
    SELECT to_jsonb(f) INTO v_fr FROM public.factory_registrations f WHERE f.user_id = v_uid LIMIT 1;
    SELECT to_jsonb(u) INTO v_up FROM public.user_profiles u WHERE u.id = v_uid LIMIT 1;
  END IF;

  IF v_afr IS NULL AND v_fr IS NULL AND v_up IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'factory_id', COALESCE(v_reg, v_uid),
    'user_id', v_uid,
    'company_name', COALESCE(
      NULLIF(v_afr ->> 'company_name', ''),
      NULLIF(v_fr ->> 'company_name', ''),
      NULLIF(v_up ->> 'company_name', '')
    ),
    'city', COALESCE(NULLIF(v_afr ->> 'city', ''), NULLIF(v_up ->> 'city', ''), ''),
    'country_code', public.normalize_country_code(
      COALESCE(NULLIF(v_afr ->> 'country', ''), NULLIF(v_up ->> 'country', ''))
    ),
    'factory_type', COALESCE(v_afr ->> 'factory_type', v_fr ->> 'factory_type'),
    'industry', COALESCE(NULLIF(v_afr ->> 'industry', ''), NULLIF(v_fr ->> 'main_products', '')),
    'annual_capacity', COALESCE(NULLIF(v_afr ->> 'annual_capacity', ''), NULLIF(v_fr ->> 'annual_capacity', '')),
    'established_year', NULLIF(v_fr ->> 'established_year', ''),
    'registration_status', COALESCE(v_afr ->> 'registration_status', v_fr ->> 'registration_status'),
    'commercial_register_number', COALESCE(
      NULLIF(v_afr ->> 'commercial_register_number', ''),
      NULLIF(v_fr ->> 'commercial_register_number', '')
    ),
    'commercial_register_verified', (
      COALESCE(NULLIF(v_afr ->> 'commercial_register_number', ''), NULLIF(v_fr ->> 'commercial_register_number', '')) IS NOT NULL
      AND COALESCE(v_afr ->> 'registration_status', v_fr ->> 'registration_status') IN ('approved', 'verified', 'active')
    ),
    'trust_percentage', COALESCE(NULLIF(v_fr ->> 'trust_percentage', '')::numeric, 0)
  );
END;
$func$;

GRANT EXECUTE ON FUNCTION public.get_public_factory_profile(uuid) TO anon, authenticated;

-- 4. Public catalog of a registered factory (active products only)
CREATE OR REPLACE FUNCTION public.get_public_factory_catalog(p_ref uuid)
RETURNS TABLE (
  id uuid, name text, name_ar text, category text, unit text, unit_price numeric,
  minimum_order_qty numeric, inventory_status text, origin_country text, image_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
  SELECT mp.id, mp.name, mp.name_ar, mp.category::text, mp.unit, mp.unit_price,
         mp.minimum_order_qty, mp.inventory_status::text, mp.origin_country, mp.image_url
  FROM public.manufacturer_products mp
  WHERE mp.is_active = true
    AND (
      mp.registered_factory_id = p_ref
      OR mp.registered_factory_id IN (SELECT a.id FROM public.agent_factory_registrations a WHERE a.factory_user_id = p_ref)
      OR mp.manufacturer_id = p_ref
    )
  ORDER BY mp.created_at DESC
  LIMIT 60;
$func$;

GRANT EXECUTE ON FUNCTION public.get_public_factory_catalog(uuid) TO anon, authenticated;

-- 5. publish_agent_product: bind the registered factory, never expose the agent as seller
CREATE OR REPLACE FUNCTION public.publish_agent_product(p_product_id uuid, p_initial_stock numeric DEFAULT 100)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_ap          public.agent_products%ROWTYPE;
  v_auto_launch text;
  v_require     text;
  v_publish     boolean;
  v_stock       numeric;
  v_cat         text;
  v_cat_enum    public.product_category;
  v_img         text;
  v_mp_id       uuid;
  v_factory_uid uuid;
  v_agent_name  text;
  v_owner       uuid;
  v_pending     boolean;
  v_country     text;
BEGIN
  SELECT * INTO v_ap FROM public.agent_products WHERE id = p_product_id LIMIT 1;
  IF v_ap.id IS NULL THEN
    RETURN jsonb_build_object('published', false, 'reason', 'not_found');
  END IF;

  IF v_ap.agent_id IS DISTINCT FROM auth.uid() AND NOT public.is_admin_user() THEN
    RETURN jsonb_build_object('published', false, 'reason', 'forbidden');
  END IF;

  v_factory_uid := public.resolve_factory_user_for_agent_product(v_ap.factory_id, v_ap.agent_id);
  v_pending := v_factory_uid IS NOT NULL;
  v_owner := COALESCE(v_factory_uid, v_ap.agent_id);

  SELECT public.normalize_country_code(country) INTO v_country
  FROM public.agent_factory_registrations WHERE id = v_ap.factory_id LIMIT 1;
  v_country := COALESCE(v_country, 'YE');

  SELECT COALESCE(NULLIF(full_name, ''), email) INTO v_agent_name
  FROM public.user_profiles WHERE id = v_ap.agent_id LIMIT 1;

  SELECT setting_value INTO v_auto_launch FROM public.platform_settings WHERE setting_key = 'initial_auto_launch_batch' LIMIT 1;
  SELECT setting_value INTO v_require FROM public.platform_settings WHERE setting_key = 'require_product_approval' LIMIT 1;

  IF COALESCE(v_auto_launch, 'true') <> 'false' THEN
    v_publish := true;
  ELSE
    v_publish := COALESCE(v_require, 'false') <> 'true';
  END IF;

  IF NOT v_publish AND NOT v_pending THEN
    UPDATE public.agent_products SET is_active = false, is_published = false WHERE id = v_ap.id;
    RETURN jsonb_build_object('published', false, 'reason', 'approval_required');
  END IF;

  v_stock := GREATEST(COALESCE(NULLIF(v_ap.stock_quantity, 0), p_initial_stock, 100), 1);

  UPDATE public.agent_products
    SET is_active = NOT v_pending,
        is_published = NOT v_pending,
        published_at = CASE WHEN v_pending THEN NULL ELSE now() END,
        stock_quantity = v_stock,
        attributed_agent_id = COALESCE(attributed_agent_id, v_ap.agent_id)
    WHERE id = v_ap.id;

  v_cat := lower(COALESCE(v_ap.category, ''));
  v_cat_enum := CASE
    WHEN v_cat ~ '(تغليف|packag)' THEN 'packaging'
    WHEN v_cat ~ '(بلاستيك|plastic)' THEN 'plastics'
    WHEN v_cat ~ '(منظف|كيم|chemical|clean)' THEN 'chemicals'
    WHEN v_cat ~ '(نسيج|قماش|textile)' THEN 'textiles'
    WHEN v_cat ~ '(معدن|حديد|metal|steel)' THEN 'metals'
    WHEN v_cat ~ '(الكترون|إلكترون|electr)' THEN 'electronics'
    WHEN v_cat ~ '(غذ|food)' THEN 'food_ingredients'
    WHEN v_cat ~ '(آل|الات|معدات|machin)' THEN 'machinery_parts'
    WHEN v_cat ~ '(خام|raw)' THEN 'raw_materials'
    ELSE 'other'
  END::public.product_category;

  v_img := NULL;
  IF v_ap.images IS NOT NULL THEN
    v_img := NULLIF(to_jsonb(v_ap.images) ->> 0, '');
  END IF;

  SELECT id INTO v_mp_id FROM public.manufacturer_products WHERE agent_product_id = v_ap.id LIMIT 1;

  IF v_mp_id IS NULL THEN
    INSERT INTO public.manufacturer_products (
      manufacturer_id, registered_factory_id, attributed_agent_id, agent_product_id,
      name, name_ar, description, description_ar,
      category, unit, unit_price, minimum_order_qty, stock_quantity, inventory_status,
      origin_country, images, image_url, is_active, is_published, sku,
      created_by_role, created_by_id, created_by_name, approval_status
    ) VALUES (
      v_owner, v_ap.factory_id, v_ap.agent_id, v_ap.id,
      COALESCE(NULLIF(v_ap.name_en, ''), v_ap.name_ar, 'Product'),
      COALESCE(v_ap.name_ar, ''),
      COALESCE(v_ap.description_en, ''),
      COALESCE(v_ap.description_ar, ''),
      v_cat_enum, COALESCE(v_ap.unit, 'piece'),
      COALESCE(NULLIF(v_ap.wholesale_price, 0), v_ap.price, 0),
      GREATEST(COALESCE(v_ap.moq, 1), 1), v_stock, 'in_stock'::public.inventory_status,
      v_country, COALESCE(to_jsonb(v_ap.images), '[]'::jsonb), v_img, NOT v_pending, NOT v_pending,
      upper(left(replace(v_ap.id::text, '-', ''), 8)),
      'agent', v_ap.agent_id, v_agent_name,
      CASE WHEN v_pending THEN 'pending_factory_approval' ELSE 'approved' END
    )
    RETURNING id INTO v_mp_id;
  ELSE
    UPDATE public.manufacturer_products
      SET is_active = NOT v_pending, is_published = NOT v_pending, stock_quantity = v_stock,
          inventory_status = 'in_stock'::public.inventory_status,
          registered_factory_id = COALESCE(registered_factory_id, v_ap.factory_id),
          attributed_agent_id = COALESCE(attributed_agent_id, v_ap.agent_id),
          approval_status = CASE WHEN v_pending THEN 'pending_factory_approval' ELSE 'approved' END
      WHERE id = v_mp_id AND approval_status IS DISTINCT FROM 'approved';
  END IF;

  RETURN jsonb_build_object(
    'published', NOT v_pending,
    'pending_factory_approval', v_pending,
    'manufacturer_product_id', v_mp_id,
    'stock', v_stock
  );
END;
$func$;

GRANT EXECUTE ON FUNCTION public.publish_agent_product(uuid, numeric) TO authenticated;

-- 6. Backfill: relink every existing agent-published product to its registered factory,
--    and when the factory has a user account, move ownership off the agent profile.
UPDATE public.manufacturer_products mp
SET registered_factory_id = ap.factory_id
FROM public.agent_products ap
WHERE mp.agent_product_id = ap.id
  AND mp.registered_factory_id IS NULL;

UPDATE public.manufacturer_products mp
SET manufacturer_id = afr.factory_user_id
FROM public.agent_factory_registrations afr
WHERE mp.registered_factory_id = afr.id
  AND afr.factory_user_id IS NOT NULL
  AND mp.manufacturer_id IS DISTINCT FROM afr.factory_user_id;

-- Fix the hard-coded 'SA' origin on agent-published products to the factory's real country code
UPDATE public.manufacturer_products mp
SET origin_country = public.normalize_country_code(afr.country)
FROM public.agent_factory_registrations afr
WHERE mp.registered_factory_id = afr.id
  AND mp.agent_product_id IS NOT NULL
  AND mp.origin_country = 'SA'
  AND public.normalize_country_code(afr.country) <> 'SA';

NOTIFY pgrst, 'reload schema';
