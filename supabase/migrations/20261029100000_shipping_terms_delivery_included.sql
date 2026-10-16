-- Shipping terms (DELIVERY_INCLUDED / EX_FACTORY / CALCULATED_SHIPPING) for products

ALTER TABLE public.agent_products
  ADD COLUMN IF NOT EXISTS shipping_terms text NOT NULL DEFAULT 'CALCULATED_SHIPPING',
  ADD COLUMN IF NOT EXISTS shipping_port text DEFAULT NULL;

ALTER TABLE public.manufacturer_products
  ADD COLUMN IF NOT EXISTS shipping_terms text NOT NULL DEFAULT 'CALCULATED_SHIPPING',
  ADD COLUMN IF NOT EXISTS shipping_port text DEFAULT NULL;

ALTER TABLE public.cart_items
  ADD COLUMN IF NOT EXISTS shipping_terms text NOT NULL DEFAULT 'CALCULATED_SHIPPING';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'agent_products_shipping_terms_check'
  ) THEN
    ALTER TABLE public.agent_products
      ADD CONSTRAINT agent_products_shipping_terms_check
      CHECK (shipping_terms IN ('DELIVERY_INCLUDED', 'EX_FACTORY', 'CALCULATED_SHIPPING'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'manufacturer_products_shipping_terms_check'
  ) THEN
    ALTER TABLE public.manufacturer_products
      ADD CONSTRAINT manufacturer_products_shipping_terms_check
      CHECK (shipping_terms IN ('DELIVERY_INCLUDED', 'EX_FACTORY', 'CALCULATED_SHIPPING'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cart_items_shipping_terms_check'
  ) THEN
    ALTER TABLE public.cart_items
      ADD CONSTRAINT cart_items_shipping_terms_check
      CHECK (shipping_terms IN ('DELIVERY_INCLUDED', 'EX_FACTORY', 'CALCULATED_SHIPPING'));
  END IF;
END $$;

-- Publish function: propagate shipping terms / port to manufacturer_products
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
  v_factory     text;
  v_mp_id       uuid;
BEGIN
  SELECT * INTO v_ap FROM public.agent_products WHERE id = p_product_id LIMIT 1;
  IF v_ap.id IS NULL THEN
    RETURN jsonb_build_object('published', false, 'reason', 'not_found');
  END IF;

  IF v_ap.agent_id IS DISTINCT FROM auth.uid() AND NOT public.is_admin_user() THEN
    RETURN jsonb_build_object('published', false, 'reason', 'forbidden');
  END IF;

  SELECT setting_value INTO v_auto_launch FROM public.platform_settings WHERE setting_key = 'initial_auto_launch_batch' LIMIT 1;
  SELECT setting_value INTO v_require FROM public.platform_settings WHERE setting_key = 'require_product_approval' LIMIT 1;

  IF COALESCE(v_auto_launch, 'true') <> 'false' THEN
    v_publish := true;
  ELSE
    v_publish := COALESCE(v_require, 'false') <> 'true';
  END IF;

  IF NOT v_publish THEN
    UPDATE public.agent_products
      SET is_active = false, is_published = false
      WHERE id = v_ap.id;
    RETURN jsonb_build_object('published', false, 'reason', 'approval_required');
  END IF;

  v_stock := GREATEST(COALESCE(NULLIF(v_ap.stock_quantity, 0), p_initial_stock, 100), 1);

  UPDATE public.agent_products
    SET is_active = true,
        is_published = true,
        published_at = now(),
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

  SELECT company_name INTO v_factory FROM public.agent_factory_registrations WHERE id = v_ap.factory_id LIMIT 1;

  SELECT id INTO v_mp_id FROM public.manufacturer_products WHERE agent_product_id = v_ap.id LIMIT 1;

  IF v_mp_id IS NULL THEN
    INSERT INTO public.manufacturer_products (
      manufacturer_id, agent_product_id, name, name_ar, description, description_ar,
      category, unit, unit_price, minimum_order_qty, stock_quantity, inventory_status,
      origin_country, images, image_url, is_active, is_published, sku,
      shipping_terms, shipping_port
    ) VALUES (
      v_ap.agent_id, v_ap.id,
      COALESCE(NULLIF(v_ap.name_en, ''), v_ap.name_ar, 'Product'),
      COALESCE(v_ap.name_ar, ''),
      COALESCE(v_ap.description_en, ''),
      COALESCE(v_ap.description_ar, ''),
      v_cat_enum, COALESCE(v_ap.unit, 'piece'),
      COALESCE(NULLIF(v_ap.wholesale_price, 0), v_ap.price, 0),
      GREATEST(COALESCE(v_ap.moq, 1), 1), v_stock, 'in_stock'::public.inventory_status,
      'SA', COALESCE(to_jsonb(v_ap.images), '[]'::jsonb), v_img, true, true,
      upper(left(replace(v_ap.id::text, '-', ''), 8)),
      COALESCE(v_ap.shipping_terms, 'CALCULATED_SHIPPING'), v_ap.shipping_port
    )
    RETURNING id INTO v_mp_id;
  ELSE
    UPDATE public.manufacturer_products
      SET is_active = true, is_published = true, stock_quantity = v_stock,
          inventory_status = 'in_stock'::public.inventory_status,
          shipping_terms = COALESCE(v_ap.shipping_terms, 'CALCULATED_SHIPPING'),
          shipping_port = v_ap.shipping_port
      WHERE id = v_mp_id;
  END IF;

  RETURN jsonb_build_object('published', true, 'manufacturer_product_id', v_mp_id, 'stock', v_stock);
END;
$func$;

GRANT EXECUTE ON FUNCTION public.publish_agent_product(uuid, numeric) TO authenticated;
