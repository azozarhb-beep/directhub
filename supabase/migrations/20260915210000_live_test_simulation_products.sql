-- ============================================================
-- Live Test Simulation Data — Three Vendor/Product Streams
-- Stream 1: Local Factory (المصنع المحلي) — B2B bulk + B2C retail
-- Stream 2: Local Supplier (المورد المحلي) — cart/checkout flow
-- Stream 3: International Factory (المصنع الدولي) — ready price checkout
-- ============================================================
-- Test Buyer Account:
--   Email:    testbuyer@directhub.net
--   Password: TestBuyer2026!
-- Local Factory Account:
--   Email:    localfactory@directhub.net
--   Password: LocalFactory2026!
-- Local Supplier Account:
--   Email:    localsupplier@directhub.net
--   Password: LocalSupplier2026!
-- International Factory Account:
--   Email:    intlfactory@directhub.net
--   Password: IntlFactory2026!
-- ============================================================

DO $$
DECLARE
  -- Auth UUIDs
  buyer_auth_uid        UUID := gen_random_uuid();
  local_factory_uid     UUID := gen_random_uuid();
  local_supplier_uid    UUID := gen_random_uuid();
  intl_factory_uid      UUID := gen_random_uuid();

  -- Product UUIDs
  local_factory_prod_id UUID := gen_random_uuid();
  local_supplier_prod_id UUID := gen_random_uuid();
  intl_factory_prod_id  UUID := gen_random_uuid();

  -- Supplier profile UUID
  local_supplier_profile_id UUID := gen_random_uuid();

  -- Category UUID (pick first available)
  cat_id UUID;

BEGIN

  -- ============================================================
  -- STEP 1: Create auth.users for all test accounts
  -- ============================================================

  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_user_meta_data, raw_app_meta_data,
    is_sso_user, is_anonymous,
    confirmation_token, confirmation_sent_at,
    recovery_token, recovery_sent_at,
    email_change_token_new, email_change, email_change_sent_at,
    email_change_token_current, email_change_confirm_status,
    reauthentication_token, reauthentication_sent_at,
    phone, phone_change, phone_change_token, phone_change_sent_at
  ) VALUES
    -- Test Buyer
    (buyer_auth_uid,
     '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'testbuyer@directhub.net',
     crypt('TestBuyer2026!', gen_salt('bf', 10)),
     now(), now(), now(),
     jsonb_build_object('full_name', 'Test Buyer — DirectHub', 'role', 'buyer'),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),

    -- Local Factory
    (local_factory_uid,
     '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'localfactory@directhub.net',
     crypt('LocalFactory2026!', gen_salt('bf', 10)),
     now(), now(), now(),
     jsonb_build_object('full_name', 'المصنع المحلي — اختبار', 'role', 'manufacturer'),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),

    -- Local Supplier
    (local_supplier_uid,
     '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'localsupplier@directhub.net',
     crypt('LocalSupplier2026!', gen_salt('bf', 10)),
     now(), now(), now(),
     jsonb_build_object('full_name', 'المورد المحلي — اختبار', 'role', 'manufacturer'),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),

    -- International Factory
    (intl_factory_uid,
     '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'intlfactory@directhub.net',
     crypt('IntlFactory2026!', gen_salt('bf', 10)),
     now(), now(), now(),
     jsonb_build_object('full_name', 'International Factory — Test', 'role', 'manufacturer'),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null)
  ON CONFLICT (id) DO NOTHING;

  -- ============================================================
  -- STEP 2: Upsert user_profiles (trigger may have already fired)
  -- ============================================================

  INSERT INTO public.user_profiles (
    id, email, full_name, company_name, phone, country,
    role, is_verified, is_active, account_type, role_selected
  ) VALUES
    (buyer_auth_uid,
     'testbuyer@directhub.net', 'Test Buyer — DirectHub',
     'DirectHub Test Account', '+967771000001', 'Yemen',
     'buyer', true, true, 'buyer', true),

    (local_factory_uid,
     'localfactory@directhub.net', 'المصنع المحلي — اختبار',
     'مصنع الاختبار المحلي', '+967771000002', 'Yemen',
     'manufacturer', true, true, 'factory', true),

    (local_supplier_uid,
     'localsupplier@directhub.net', 'المورد المحلي — اختبار',
     'شركة المورد المحلي للاختبار', '+967771000003', 'Yemen',
     'manufacturer', true, true, 'local_supplier', true),

    (intl_factory_uid,
     'intlfactory@directhub.net', 'International Factory — Test',
     'DirectHub International Test Factory', '+86-21-00000001', 'China',
     'manufacturer', true, true, 'factory', true)
  ON CONFLICT (id) DO UPDATE SET
    full_name    = EXCLUDED.full_name,
    company_name = EXCLUDED.company_name,
    is_verified  = true,
    is_active    = true,
    account_type = EXCLUDED.account_type,
    role_selected = true;

  -- ============================================================
  -- STEP 3: Supplier profile for local supplier
  -- ============================================================

  INSERT INTO public.supplier_profiles (
    id, user_id, company_name, description, country, city,
    established_year, employee_count, annual_revenue,
    main_categories, certifications, website,
    tier, is_verified, response_rate, avg_response_time,
    total_rfqs_received, rating, review_count, is_active
  ) VALUES (
    local_supplier_profile_id,
    local_supplier_uid,
    'شركة المورد المحلي للاختبار',
    'مورد محلي معتمد لاختبار منصة DirectHub — يوفر منتجات متنوعة للمتاجر والشركات الصغيرة والمتوسطة بأسعار تنافسية وتسليم سريع داخل اليمن.',
    'Yemen', 'Sanaa',
    2015, '10-49', '$500K-$1M USD',
    ARRAY['Consumer Goods', 'Food & Beverages', 'Household Products'],
    ARRAY['ISO 9001:2015', 'Local Trade License'],
    'localsupplier.directhub.net',
    'verified', true, 90, '4h',
    45, 4.7, 12, true
  ) ON CONFLICT (user_id) DO NOTHING;

  -- ============================================================
  -- STEP 4: Fetch a category id (fallback to NULL if none)
  -- ============================================================

  SELECT id INTO cat_id FROM public.product_categories LIMIT 1;

  -- ============================================================
  -- STEP 5: Stream 1 — Local Factory Product
  -- B2B bulk pricing + B2C retail, hybrid order model
  -- ============================================================

  INSERT INTO public.manufacturer_products (
    id, manufacturer_id, name, name_ar,
    description, description_ar,
    category, sku, unit, unit_price, b2c_price,
    minimum_order_qty, min_order_quantity, b2b_min_quantity,
    stock_quantity, inventory_status, origin_country,
    specifications, specifications_ar,
    certifications, hs_code,
    lead_time_days, sample_available, sample_price,
    tags, is_active, is_published, factory_type,
    weight_kg, dimensions, warranty_months, industry_sector,
    order_model, allow_single_unit, category_id,
    seller_badge
  ) VALUES (
    local_factory_prod_id,
    local_factory_uid,
    '[TEST] Local Factory — Yemeni Honey 500g Jar',
    '[اختبار] مصنع محلي — عسل يمني أصيل 500 جرام',
    'LIVE TEST PRODUCT — Stream 1 (Local Factory). Premium Yemeni Sidr honey, 500g glass jar, cold-extracted, no additives. B2B bulk: min 10 units at $18/unit. B2C retail: single unit at $25. Published directly from the local factory control panel.',
    'منتج اختبار حي — تيار 1 (المصنع المحلي). عسل سدر يمني فاخر، برطمان زجاجي 500 جرام، استخلاص بارد، بدون إضافات. B2B جملة: الحد الأدنى 10 وحدات بسعر 18 دولار/وحدة. B2C مفرد: وحدة واحدة بسعر 25 دولار. منشور مباشرة من لوحة تحكم المصنع المحلي.',
    'food_ingredients',
    'TEST-LF-HONEY-500G', 'jar',
    18.00,   -- B2B unit price
    25.00,   -- B2C retail price
    1, 1, 10,  -- MOQ=1 (B2C), B2B min=10
    500, 'in_stock', 'Yemen',
    jsonb_build_object(
      'weight', '500g',
      'type', 'Sidr Honey',
      'extraction', 'Cold-extracted',
      'packaging', 'Glass jar with tamper-evident seal',
      'shelf_life', '24 months',
      'b2b_price_per_unit', '$18 (min 10 units)',
      'b2c_price_per_unit', '$25 (single unit)',
      'test_stream', 'Stream 1 — Local Factory'
    ),
    jsonb_build_object(
      'الوزن', '500 جرام',
      'النوع', 'عسل سدر',
      'الاستخلاص', 'بارد',
      'التعبئة', 'برطمان زجاجي',
      'مدة الصلاحية', '24 شهراً',
      'سعر الجملة', '18 دولار (10 وحدات فأكثر)',
      'سعر المفرد', '25 دولار (وحدة واحدة)'
    ),
    '["Yemen Quality Mark", "Natural Honey Certification"]'::jsonb,
    '0409.00',
    3, true, 5.00,
    '["honey", "yemeni honey", "sidr", "test product", "local factory", "b2b", "b2c"]'::jsonb,
    true, true, 'local',
    0.6, '10 x 8 x 8 cm', 0, 'Food & Agriculture',
    'hybrid', true, cat_id,
    'certified_factory'
  ) ON CONFLICT (id) DO UPDATE SET
    is_published = true,
    is_active    = true,
    unit_price   = EXCLUDED.unit_price,
    b2c_price    = EXCLUDED.b2c_price;

  -- ============================================================
  -- STEP 6: Stream 2 — Local Supplier Product
  -- Standard retail, cart/checkout flow
  -- ============================================================

  INSERT INTO public.manufacturer_products (
    id, manufacturer_id, name, name_ar,
    description, description_ar,
    category, sku, unit, unit_price, b2c_price,
    minimum_order_qty, min_order_quantity, b2b_min_quantity,
    stock_quantity, inventory_status, origin_country,
    specifications, specifications_ar,
    certifications, hs_code,
    lead_time_days, sample_available,
    tags, is_active, is_published, factory_type,
    weight_kg, dimensions, warranty_months, industry_sector,
    order_model, allow_single_unit, category_id,
    seller_badge
  ) VALUES (
    local_supplier_prod_id,
    local_supplier_uid,
    '[TEST] Local Supplier — Cooking Oil 5L Bottle',
    '[اختبار] مورد محلي — زيت طعام 5 لتر',
    'LIVE TEST PRODUCT — Stream 2 (Local Supplier). Premium cooking oil, 5-liter bottle, suitable for frying and cooking. Listed from the local supplier dashboard. Add to cart and complete checkout to test the full B2C purchase flow.',
    'منتج اختبار حي — تيار 2 (المورد المحلي). زيت طعام فاخر، عبوة 5 لتر، مناسب للقلي والطهي. مدرج من لوحة تحكم المورد المحلي. أضف إلى السلة وأكمل الدفع لاختبار تدفق الشراء الكامل.',
    'food_ingredients',
    'TEST-LS-OIL-5L', 'bottle',
    8.50,   -- unit price
    8.50,   -- same for B2C
    1, 1, 6,
    200, 'in_stock', 'Yemen',
    jsonb_build_object(
      'volume', '5 liters',
      'type', 'Refined Cooking Oil',
      'packaging', 'PET bottle with handle',
      'shelf_life', '18 months',
      'test_stream', 'Stream 2 — Local Supplier'
    ),
    jsonb_build_object(
      'الحجم', '5 لتر',
      'النوع', 'زيت طعام مكرر',
      'التعبئة', 'زجاجة PET بمقبض',
      'مدة الصلاحية', '18 شهراً'
    ),
    '["Local Trade License", "Food Safety Certificate"]'::jsonb,
    '1512.19',
    1, false,
    '["cooking oil", "food", "test product", "local supplier", "cart test"]'::jsonb,
    true, true, 'local',
    5.2, '15 x 10 x 30 cm', 0, 'Food & Agriculture',
    'b2c_only', true, cat_id,
    'local_supplier'
  ) ON CONFLICT (id) DO UPDATE SET
    is_published = true,
    is_active    = true,
    unit_price   = EXCLUDED.unit_price;

  -- ============================================================
  -- STEP 7: Stream 3 — International Factory Product
  -- Pre-set ready price, full checkout & order placement
  -- ============================================================

  INSERT INTO public.manufacturer_products (
    id, manufacturer_id, name, name_ar,
    description, description_ar,
    category, sku, unit, unit_price, b2c_price,
    minimum_order_qty, min_order_quantity, b2b_min_quantity,
    stock_quantity, inventory_status, origin_country,
    specifications, specifications_ar,
    certifications, hs_code,
    lead_time_days, sample_available, sample_price,
    tags, is_active, is_published, factory_type,
    weight_kg, dimensions, warranty_months, industry_sector,
    order_model, allow_single_unit, category_id
  ) VALUES (
    intl_factory_prod_id,
    intl_factory_uid,
    '[TEST] International Factory — Industrial Water Pump 2HP',
    '[اختبار] مصنع دولي — مضخة مياه صناعية 2 حصان',
    'LIVE TEST PRODUCT — Stream 3 (International Factory). 2HP stainless-steel centrifugal water pump, pre-set ready price $320/unit. No RFQ required — direct checkout. Test the complete international order placement and escrow flow.',
    'منتج اختبار حي — تيار 3 (المصنع الدولي). مضخة مياه طاردة مركزية من الفولاذ المقاوم للصدأ 2 حصان، سعر جاهز محدد مسبقاً 320 دولار/وحدة. لا يلزم طلب عرض سعر — دفع مباشر. اختبر عملية تقديم الطلب الدولي الكاملة وتدفق الضمان المالي.',
    'machinery_parts',
    'TEST-IF-PUMP-2HP', 'unit',
    320.00,  -- pre-set ready price
    320.00,
    1, 1, 5,
    50, 'in_stock', 'China',
    jsonb_build_object(
      'power', '2HP / 1.5kW',
      'material', 'Stainless Steel 304',
      'max_flow', '60 m³/h',
      'max_head', '35 m',
      'voltage', '220V / 50Hz',
      'inlet_outlet', '2 inch',
      'price_type', 'Pre-set ready price — no RFQ needed',
      'test_stream', 'Stream 3 — International Factory'
    ),
    jsonb_build_object(
      'القدرة', '2 حصان / 1.5 كيلوواط',
      'المادة', 'فولاذ مقاوم للصدأ 304',
      'أقصى تدفق', '60 م³/ساعة',
      'أقصى ضغط', '35 متر',
      'الجهد', '220 فولت / 50 هرتز',
      'نوع السعر', 'سعر جاهز محدد مسبقاً — لا يلزم طلب عرض سعر'
    ),
    '["CE", "ISO 9001:2015", "RoHS"]'::jsonb,
    '8413.70',
    21, true, 50.00,
    '["water pump", "industrial", "test product", "international factory", "ready price", "checkout test"]'::jsonb,
    true, true, 'international',
    18.5, '35 x 25 x 30 cm', 12, 'Industrial Machinery',
    'hybrid', true, cat_id
  ) ON CONFLICT (id) DO UPDATE SET
    is_published = true,
    is_active    = true,
    unit_price   = EXCLUDED.unit_price,
    b2c_price    = EXCLUDED.b2c_price;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Live test simulation data insertion error: %', SQLERRM;
END $$;
