-- Product origin attribution + factory approval for agent-listed products.

-- 1. Audit / approval columns on manufacturer_products
ALTER TABLE public.manufacturer_products
  ADD COLUMN IF NOT EXISTS created_by_role text DEFAULT 'manufacturer',
  ADD COLUMN IF NOT EXISTS created_by_id uuid DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS created_by_name text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS approval_status text DEFAULT 'approved';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'manufacturer_products_created_by_role_check'
  ) THEN
    ALTER TABLE public.manufacturer_products
      ADD CONSTRAINT manufacturer_products_created_by_role_check
      CHECK (created_by_role IN ('agent', 'manufacturer'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'manufacturer_products_approval_status_check'
  ) THEN
    ALTER TABLE public.manufacturer_products
      ADD CONSTRAINT manufacturer_products_approval_status_check
      CHECK (approval_status IN ('approved', 'pending_factory_approval'));
  END IF;
END $$;

-- Backfill: agent-originated rows vs. self-listed rows
UPDATE public.manufacturer_products
SET created_by_role = 'agent',
    created_by_id = manufacturer_id
WHERE agent_product_id IS NOT NULL AND created_by_id IS NULL;

UPDATE public.manufacturer_products
SET created_by_role = 'manufacturer',
    created_by_id = manufacturer_id
WHERE agent_product_id IS NULL AND created_by_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_manufacturer_products_approval_status
  ON public.manufacturer_products(approval_status);

-- 2. Self-listed rows: always stamp the creator on insert
CREATE OR REPLACE FUNCTION public.set_manufacturer_product_creator()
RETURNS trigger
LANGUAGE plpgsql
AS $func$
BEGIN
  IF NEW.created_by_id IS NULL THEN
    NEW.created_by_id := COALESCE(auth.uid(), NEW.manufacturer_id);
  END IF;
  IF NEW.created_by_role IS NULL THEN
    NEW.created_by_role := CASE WHEN NEW.agent_product_id IS NOT NULL THEN 'agent' ELSE 'manufacturer' END;
  END IF;
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trg_set_manufacturer_product_creator ON public.manufacturer_products;
CREATE TRIGGER trg_set_manufacturer_product_creator
  BEFORE INSERT ON public.manufacturer_products
  FOR EACH ROW EXECUTE FUNCTION public.set_manufacturer_product_creator();

-- 3. Link an agent-registered facility to the factory's user account
ALTER TABLE public.agent_factory_registrations
  ADD COLUMN IF NOT EXISTS factory_user_id uuid DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_agent_factory_regs_factory_user_id
  ON public.agent_factory_registrations(factory_user_id)
  WHERE factory_user_id IS NOT NULL;

-- 4. Resolve the factory user an agent is allowed to list for
CREATE OR REPLACE FUNCTION public.resolve_factory_user_for_agent_product(p_factory_id uuid, p_agent_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_user uuid;
BEGIN
  SELECT afr.factory_user_id INTO v_user
  FROM public.agent_factory_registrations afr
  WHERE afr.id = p_factory_id AND afr.agent_id = p_agent_id
  LIMIT 1;

  IF v_user IS NOT NULL THEN
    RETURN v_user;
  END IF;

  RETURN NULL;
END;
$func$;

-- 5. publish_agent_product: route to the factory when linked, awaiting approval
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
    UPDATE public.agent_products
      SET is_active = false, is_published = false
      WHERE id = v_ap.id;
    RETURN jsonb_build_object('published', false, 'reason', 'approval_required');
  END IF;

  v_stock := GREATEST(COALESCE(NULLIF(v_ap.stock_quantity, 0), p_initial_stock, 100), 1);

  UPDATE public.agent_products
    SET is_active = NOT v_pending,
        is_published = NOT v_pending,
        published_at = CASE WHEN v_pending THEN NULL ELSE now() END,
        stock_quantity = v_stock
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
      manufacturer_id, agent_product_id, name, name_ar, description, description_ar,
      category, unit, unit_price, minimum_order_qty, stock_quantity, inventory_status,
      origin_country, images, image_url, is_active, is_published, sku,
      created_by_role, created_by_id, created_by_name, approval_status
    ) VALUES (
      v_owner, v_ap.id,
      COALESCE(NULLIF(v_ap.name_en, ''), v_ap.name_ar, 'Product'),
      COALESCE(v_ap.name_ar, ''),
      COALESCE(v_ap.description_en, ''),
      COALESCE(v_ap.description_ar, ''),
      v_cat_enum, COALESCE(v_ap.unit, 'piece'),
      COALESCE(NULLIF(v_ap.wholesale_price, 0), v_ap.price, 0),
      GREATEST(COALESCE(v_ap.moq, 1), 1), v_stock, 'in_stock'::public.inventory_status,
      'SA', COALESCE(to_jsonb(v_ap.images), '[]'::jsonb), v_img, NOT v_pending, NOT v_pending,
      upper(left(replace(v_ap.id::text, '-', ''), 8)),
      'agent', v_ap.agent_id, v_agent_name,
      CASE WHEN v_pending THEN 'pending_factory_approval' ELSE 'approved' END
    )
    RETURNING id INTO v_mp_id;
  ELSE
    UPDATE public.manufacturer_products
      SET is_active = NOT v_pending, is_published = NOT v_pending, stock_quantity = v_stock,
          inventory_status = 'in_stock'::public.inventory_status,
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
GRANT EXECUTE ON FUNCTION public.resolve_factory_user_for_agent_product(uuid, uuid) TO authenticated;

-- 6. Agents can read the products they listed (to follow approval state)
DROP POLICY IF EXISTS "agents_view_products_they_created" ON public.manufacturer_products;
CREATE POLICY "agents_view_products_they_created"
ON public.manufacturer_products
FOR SELECT
TO authenticated
USING (created_by_role = 'agent' AND created_by_id = auth.uid());

NOTIFY pgrst, 'reload schema';
