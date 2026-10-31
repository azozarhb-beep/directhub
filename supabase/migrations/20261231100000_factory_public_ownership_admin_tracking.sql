-- Factory public ownership + backend agent attribution + admin-only lifecycle tracking.
-- "facility_id" == the factory's user_profiles.id (manufacturer_products.manufacturer_id / orders.factory_user_id).

-- 1. Product columns
ALTER TABLE public.manufacturer_products
  ADD COLUMN IF NOT EXISTS facility_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS attributed_agent_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL;

UPDATE public.manufacturer_products
SET facility_id = manufacturer_id
WHERE facility_id IS NULL;

UPDATE public.manufacturer_products mp
SET attributed_agent_id = ap.agent_id
FROM public.agent_products ap
WHERE mp.agent_product_id = ap.id
  AND mp.attributed_agent_id IS NULL;

UPDATE public.manufacturer_products
SET attributed_agent_id = created_by_id
WHERE attributed_agent_id IS NULL
  AND created_by_role = 'agent'
  AND created_by_id IS NOT NULL
  AND created_by_id IS DISTINCT FROM manufacturer_id;

CREATE INDEX IF NOT EXISTS idx_manufacturer_products_facility_id
  ON public.manufacturer_products(facility_id);
CREATE INDEX IF NOT EXISTS idx_manufacturer_products_attributed_agent
  ON public.manufacturer_products(attributed_agent_id)
  WHERE attributed_agent_id IS NOT NULL;

-- 2. Agent products: attribution mirror
ALTER TABLE public.agent_products
  ADD COLUMN IF NOT EXISTS attributed_agent_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL;

UPDATE public.agent_products
SET attributed_agent_id = agent_id
WHERE attributed_agent_id IS NULL;

-- 3. Trigger: always bind facility and stamp attributed agent on manufacturer_products
CREATE OR REPLACE FUNCTION public.set_manufacturer_product_attribution()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_agent uuid;
BEGIN
  IF NEW.facility_id IS NULL THEN
    NEW.facility_id := NEW.manufacturer_id;
  END IF;

  IF NEW.attributed_agent_id IS NULL THEN
    IF NEW.agent_product_id IS NOT NULL THEN
      SELECT ap.agent_id INTO v_agent FROM public.agent_products ap WHERE ap.id = NEW.agent_product_id LIMIT 1;
      NEW.attributed_agent_id := v_agent;
    ELSIF NEW.created_by_role = 'agent' AND NEW.created_by_id IS DISTINCT FROM NEW.manufacturer_id THEN
      NEW.attributed_agent_id := NEW.created_by_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trg_set_manufacturer_product_attribution ON public.manufacturer_products;
CREATE TRIGGER trg_set_manufacturer_product_attribution
  BEFORE INSERT ON public.manufacturer_products
  FOR EACH ROW EXECUTE FUNCTION public.set_manufacturer_product_attribution();

-- Agent products: stamp attributed_agent_id = auth.uid() (falls back to agent_id)
CREATE OR REPLACE FUNCTION public.set_agent_product_attribution()
RETURNS trigger
LANGUAGE plpgsql
AS $func$
BEGIN
  IF NEW.attributed_agent_id IS NULL THEN
    NEW.attributed_agent_id := COALESCE(auth.uid(), NEW.agent_id);
  END IF;
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trg_set_agent_product_attribution ON public.agent_products;
CREATE TRIGGER trg_set_agent_product_attribution
  BEFORE INSERT ON public.agent_products
  FOR EACH ROW EXECUTE FUNCTION public.set_agent_product_attribution();

-- 4. Order columns
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS fulfilled_by_facility_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_inspector_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL;

UPDATE public.orders
SET fulfilled_by_facility_id = factory_user_id
WHERE fulfilled_by_facility_id IS NULL AND factory_user_id IS NOT NULL;

UPDATE public.orders o
SET assigned_inspector_id = t.assigned_agent_id
FROM (
  SELECT DISTINCT ON (order_id) order_id, assigned_agent_id
  FROM public.field_inspection_tasks
  WHERE order_id IS NOT NULL AND assigned_agent_id IS NOT NULL
  ORDER BY order_id, created_at DESC
) t
WHERE o.id = t.order_id AND o.assigned_inspector_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_orders_fulfilled_by_facility
  ON public.orders(fulfilled_by_facility_id) WHERE fulfilled_by_facility_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_assigned_inspector
  ON public.orders(assigned_inspector_id) WHERE assigned_inspector_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_order_fulfilled_by_facility()
RETURNS trigger
LANGUAGE plpgsql
AS $func$
BEGIN
  IF NEW.fulfilled_by_facility_id IS NULL AND NEW.factory_user_id IS NOT NULL THEN
    NEW.fulfilled_by_facility_id := NEW.factory_user_id;
  END IF;
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trg_sync_order_fulfilled_by_facility ON public.orders;
CREATE TRIGGER trg_sync_order_fulfilled_by_facility
  BEFORE INSERT OR UPDATE OF factory_user_id ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.sync_order_fulfilled_by_facility();

-- Keep orders.assigned_inspector_id in sync with inspection task assignment
CREATE OR REPLACE FUNCTION public.sync_order_assigned_inspector()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  IF NEW.order_id IS NOT NULL AND NEW.assigned_agent_id IS NOT NULL THEN
    UPDATE public.orders
    SET assigned_inspector_id = NEW.assigned_agent_id
    WHERE id = NEW.order_id
      AND assigned_inspector_id IS DISTINCT FROM NEW.assigned_agent_id;
  END IF;
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trg_sync_order_assigned_inspector ON public.field_inspection_tasks;
CREATE TRIGGER trg_sync_order_assigned_inspector
  AFTER INSERT OR UPDATE OF assigned_agent_id, order_id ON public.field_inspection_tasks
  FOR EACH ROW EXECUTE FUNCTION public.sync_order_assigned_inspector();

-- 5. Admin-only tracking timeline: product
CREATE OR REPLACE FUNCTION public.admin_product_tracking(p_product_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_mp public.manufacturer_products%ROWTYPE;
  v_facility uuid;
  v_registered_by uuid;
  v_uploaded_by uuid;
  v_uploaded_role text;
  v_result jsonb;
BEGIN
  IF NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO v_mp FROM public.manufacturer_products WHERE id = p_product_id LIMIT 1;
  IF v_mp.id IS NULL THEN
    RETURN NULL;
  END IF;

  v_facility := COALESCE(v_mp.facility_id, v_mp.manufacturer_id);

  SELECT COALESCE(fr.referred_by_agent_id, ar.agent_id) INTO v_registered_by
  FROM (SELECT 1) x
  LEFT JOIN public.factory_registrations fr ON fr.user_id = v_facility
  LEFT JOIN public.agent_referrals ar ON ar.facility_id = fr.id
  LIMIT 1;

  IF v_registered_by IS NULL THEN
    SELECT afr.agent_id INTO v_registered_by
    FROM public.agent_factory_registrations afr
    WHERE afr.factory_user_id = v_facility
    ORDER BY afr.created_at ASC
    LIMIT 1;
  END IF;

  v_uploaded_by := COALESCE(v_mp.attributed_agent_id, v_mp.created_by_id, v_mp.manufacturer_id);
  v_uploaded_role := CASE
    WHEN v_mp.attributed_agent_id IS NOT NULL THEN 'agent'
    ELSE COALESCE(v_mp.created_by_role, 'manufacturer')
  END;

  SELECT jsonb_build_object(
    'product_id', v_mp.id,
    'created_at', v_mp.created_at,
    'facility', (SELECT jsonb_build_object('id', up.id, 'name', COALESCE(NULLIF(up.company_name, ''), up.full_name), 'email', up.email)
                 FROM public.user_profiles up WHERE up.id = v_facility),
    'registered_by', (SELECT jsonb_build_object('id', up.id, 'name', COALESCE(NULLIF(up.full_name, ''), up.email), 'referral_code', up.referral_code)
                      FROM public.user_profiles up WHERE up.id = v_registered_by),
    'uploaded_by', (SELECT jsonb_build_object('id', up.id, 'name', COALESCE(NULLIF(up.full_name, ''), up.email), 'role', v_uploaded_role)
                    FROM public.user_profiles up WHERE up.id = v_uploaded_by),
    'attributed_agent_id', v_mp.attributed_agent_id,
    'approval_status', v_mp.approval_status
  ) INTO v_result;

  RETURN v_result;
END;
$func$;

-- 6. Admin-only tracking timeline: order
CREATE OR REPLACE FUNCTION public.admin_order_tracking(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_o public.orders%ROWTYPE;
  v_facility uuid;
  v_registered_by uuid;
  v_uploaded_by uuid;
  v_uploaded_role text;
  v_product_id uuid;
  v_task public.field_inspection_tasks%ROWTYPE;
  v_inspector uuid;
  v_result jsonb;
BEGIN
  IF NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO v_o FROM public.orders WHERE id = p_order_id LIMIT 1;
  IF v_o.id IS NULL THEN
    RETURN NULL;
  END IF;

  v_facility := COALESCE(v_o.fulfilled_by_facility_id, v_o.factory_user_id);

  SELECT COALESCE(fr.referred_by_agent_id, ar.agent_id) INTO v_registered_by
  FROM (SELECT 1) x
  LEFT JOIN public.factory_registrations fr ON fr.user_id = v_facility
  LEFT JOIN public.agent_referrals ar ON ar.facility_id = fr.id
  LIMIT 1;

  IF v_registered_by IS NULL THEN
    SELECT afr.agent_id INTO v_registered_by
    FROM public.agent_factory_registrations afr
    WHERE afr.factory_user_id = v_facility
    ORDER BY afr.created_at ASC
    LIMIT 1;
  END IF;

  BEGIN
    SELECT NULLIF(COALESCE(it->>'productId', it->>'product_id', it->>'id'), '')::uuid INTO v_product_id
    FROM jsonb_array_elements(CASE WHEN jsonb_typeof(to_jsonb(v_o.items)) = 'array' THEN to_jsonb(v_o.items) ELSE '[]'::jsonb END) it
    LIMIT 1;
  EXCEPTION WHEN others THEN
    v_product_id := NULL;
  END;

  IF v_product_id IS NOT NULL THEN
    SELECT COALESCE(mp.attributed_agent_id, mp.created_by_id, mp.manufacturer_id),
           CASE WHEN mp.attributed_agent_id IS NOT NULL THEN 'agent' ELSE COALESCE(mp.created_by_role, 'manufacturer') END
    INTO v_uploaded_by, v_uploaded_role
    FROM public.manufacturer_products mp WHERE mp.id = v_product_id LIMIT 1;
  END IF;

  SELECT * INTO v_task
  FROM public.field_inspection_tasks
  WHERE order_id = v_o.id
  ORDER BY created_at DESC
  LIMIT 1;

  v_inspector := COALESCE(v_o.assigned_inspector_id, v_task.assigned_agent_id);

  SELECT jsonb_build_object(
    'order_id', v_o.id,
    'order_number', v_o.order_number,
    'created_at', v_o.created_at,
    'product_id', v_product_id,
    'registered_by', (SELECT jsonb_build_object('id', up.id, 'name', COALESCE(NULLIF(up.full_name, ''), up.email), 'referral_code', up.referral_code)
                      FROM public.user_profiles up WHERE up.id = v_registered_by),
    'uploaded_by', (SELECT jsonb_build_object('id', up.id, 'name', COALESCE(NULLIF(up.full_name, ''), up.email), 'role', v_uploaded_role)
                    FROM public.user_profiles up WHERE up.id = v_uploaded_by),
    'fulfilled_by', (SELECT jsonb_build_object('id', up.id, 'name', COALESCE(NULLIF(up.company_name, ''), up.full_name), 'email', up.email)
                     FROM public.user_profiles up WHERE up.id = v_facility),
    'inspector', (SELECT jsonb_build_object('id', up.id, 'name', COALESCE(NULLIF(up.full_name, ''), up.email))
                  FROM public.user_profiles up WHERE up.id = v_inspector),
    'inspection', CASE WHEN v_task.id IS NULL THEN NULL ELSE jsonb_build_object(
        'status', v_task.status,
        'result', v_task.result,
        'signed_off_at', v_task.signed_off_at,
        'created_at', v_task.created_at
    ) END
  ) INTO v_result;

  RETURN v_result;
END;
$func$;

REVOKE ALL ON FUNCTION public.admin_product_tracking(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_order_tracking(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_product_tracking(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_order_tracking(uuid) TO authenticated;

-- 7. Make publish_agent_product bind facility_id + attributed_agent_id explicitly
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
      manufacturer_id, facility_id, attributed_agent_id, agent_product_id, name, name_ar, description, description_ar,
      category, unit, unit_price, minimum_order_qty, stock_quantity, inventory_status,
      origin_country, images, image_url, is_active, is_published, sku,
      created_by_role, created_by_id, created_by_name, approval_status
    ) VALUES (
      v_owner, v_owner, v_ap.agent_id, v_ap.id,
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
          facility_id = COALESCE(facility_id, manufacturer_id),
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

NOTIFY pgrst, 'reload schema';
