-- ============================================================
-- Sandbox Dummy Accounts — 5 Roles with Realistic Data
-- ============================================================
-- Role 1: Buyer
--   Email:    sandbox.buyer@directhub.net
--   Password: SandboxBuyer2026!
-- Role 2: Supplier
--   Email:    sandbox.supplier@directhub.net
--   Password: SandboxSupplier2026!
-- Role 3: Factory (Manufacturer)
--   Email:    sandbox.factory@directhub.net
--   Password: SandboxFactory2026!
-- Role 4: Representative (Field Agent)
--   Email:    sandbox.agent@directhub.net
--   Password: SandboxAgent2026!
-- Role 5: Logistics Office
--   Email:    sandbox.logistics@directhub.net
--   Password: SandboxLogistics2026!
-- ============================================================

DO $$
DECLARE
  -- Auth UUIDs
  sandbox_buyer_uid      UUID := gen_random_uuid();
  sandbox_supplier_uid   UUID := gen_random_uuid();
  sandbox_factory_uid    UUID := gen_random_uuid();
  sandbox_agent_uid      UUID := gen_random_uuid();
  sandbox_logistics_uid  UUID := gen_random_uuid();

  -- Product UUIDs for factory
  factory_prod1_id UUID := gen_random_uuid();
  factory_prod2_id UUID := gen_random_uuid();
  factory_prod3_id UUID := gen_random_uuid();
  factory_prod4_id UUID := gen_random_uuid();

  -- Supplier product UUIDs
  supplier_prod1_id UUID := gen_random_uuid();
  supplier_prod2_id UUID := gen_random_uuid();

  -- Order UUIDs for buyer
  buyer_order1_id UUID := gen_random_uuid();
  buyer_order2_id UUID := gen_random_uuid();

  -- Logistics partner UUID
  logistics_partner_id UUID := gen_random_uuid();

  -- Logistics route UUIDs
  logistics_route1_id UUID := gen_random_uuid();
  logistics_route2_id UUID := gen_random_uuid();

  -- Category id
  cat_id UUID;

  -- Supplier profile id
  supplier_profile_id UUID := gen_random_uuid();

  -- Factory registration id
  factory_reg_id UUID := gen_random_uuid();

BEGIN

  -- ============================================================
  -- STEP 1: Create auth.users for all 5 sandbox accounts
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
    -- Sandbox Buyer
    (sandbox_buyer_uid,
     '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'sandbox.buyer@directhub.net',
     crypt('SandboxBuyer2026!', gen_salt('bf', 10)),
     now(), now(), now(),
     jsonb_build_object('full_name', 'Ahmed Al-Rashidi — Sandbox Buyer', 'role', 'buyer', 'company_name', 'Al-Rashidi Trading Co.', 'phone', '+967771100001', 'country', 'Yemen'),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),

    -- Sandbox Supplier
    (sandbox_supplier_uid,
     '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'sandbox.supplier@directhub.net',
     crypt('SandboxSupplier2026!', gen_salt('bf', 10)),
     now(), now(), now(),
     jsonb_build_object('full_name', 'Khalid Al-Yamani — Sandbox Supplier', 'role', 'manufacturer', 'company_name', 'Al-Yamani General Trading', 'phone', '+967771100002', 'country', 'Yemen'),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),

    -- Sandbox Factory
    (sandbox_factory_uid,
     '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'sandbox.factory@directhub.net',
     crypt('SandboxFactory2026!', gen_salt('bf', 10)),
     now(), now(), now(),
     jsonb_build_object('full_name', 'Omar Al-Hadhrami — Sandbox Factory', 'role', 'manufacturer', 'company_name', 'Al-Hadhrami Packaging Industries', 'phone', '+967771100003', 'country', 'Yemen'),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),

    -- Sandbox Agent (Representative)
    (sandbox_agent_uid,
     '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'sandbox.agent@directhub.net',
     crypt('SandboxAgent2026!', gen_salt('bf', 10)),
     now(), now(), now(),
     jsonb_build_object('full_name', 'Nasser Al-Subaie — Sandbox Agent', 'role', 'field_agent', 'company_name', 'DirectHub Field Representative', 'phone', '+967771100004', 'country', 'Yemen'),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),

    -- Sandbox Logistics
    (sandbox_logistics_uid,
     '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'sandbox.logistics@directhub.net',
     crypt('SandboxLogistics2026!', gen_salt('bf', 10)),
     now(), now(), now(),
     jsonb_build_object('full_name', 'Saleh Al-Amri — Sandbox Logistics', 'role', 'logistics_partner', 'company_name', 'Al-Amri Express Logistics', 'phone', '+967771100005', 'country', 'Yemen'),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null)
  ON CONFLICT (id) DO NOTHING;

  -- ============================================================
  -- STEP 2: Upsert user_profiles
  -- ============================================================

  INSERT INTO public.user_profiles (
    id, email, full_name, company_name, phone, country,
    role, is_verified, is_active, account_type, role_selected
  ) VALUES
    (sandbox_buyer_uid,
     'sandbox.buyer@directhub.net', 'Ahmed Al-Rashidi — Sandbox Buyer',
     'Al-Rashidi Trading Co.', '+967771100001', 'Yemen',
     'buyer', true, true, 'buyer', true),

    (sandbox_supplier_uid,
     'sandbox.supplier@directhub.net', 'Khalid Al-Yamani — Sandbox Supplier',
     'Al-Yamani General Trading', '+967771100002', 'Yemen',
     'manufacturer', true, true, 'local_supplier', true),

    (sandbox_factory_uid,
     'sandbox.factory@directhub.net', 'Omar Al-Hadhrami — Sandbox Factory',
     'Al-Hadhrami Packaging Industries', '+967771100003', 'Yemen',
     'manufacturer', true, true, 'factory', true),

    (sandbox_agent_uid,
     'sandbox.agent@directhub.net', 'Nasser Al-Subaie — Sandbox Agent',
     'DirectHub Field Representative', '+967771100004', 'Yemen',
     'field_agent', true, true, 'field_agent', true),

    (sandbox_logistics_uid,
     'sandbox.logistics@directhub.net', 'Saleh Al-Amri — Sandbox Logistics',
     'Al-Amri Express Logistics', '+967771100005', 'Yemen',
     'logistics_partner', true, true, 'logistics_partner', true)
  ON CONFLICT (id) DO UPDATE SET
    full_name    = EXCLUDED.full_name,
    company_name = EXCLUDED.company_name,
    is_verified  = true,
    is_active    = true,
    account_type = EXCLUDED.account_type,
    role_selected = true;

  -- ============================================================
  -- STEP 3: Supplier profile for sandbox supplier
  -- ============================================================

  INSERT INTO public.supplier_profiles (
    id, user_id, company_name, description, country, city,
    established_year, employee_count, annual_revenue,
    main_categories, certifications, website,
    tier, is_verified, response_rate, avg_response_time,
    total_rfqs_received, rating, review_count, is_active
  ) VALUES (
    supplier_profile_id,
    sandbox_supplier_uid,
    'Al-Yamani General Trading',
    'مورد محلي معتمد متخصص في توريد المواد الغذائية والمستهلكات للشركات والمتاجر في اليمن. نوفر منتجات عالية الجودة بأسعار تنافسية مع خدمة توصيل سريعة.',
    'Yemen', 'Sanaa',
    2012, '10-49', '$1M-$5M USD',
    ARRAY['Food & Beverages', 'Consumer Goods', 'Household Products', 'Cleaning Supplies'],
    ARRAY['ISO 9001:2015', 'Yemen Trade License', 'Food Safety Certificate'],
    'alyamani-trading.directhub.net',
    'verified', true, 94, '2h',
    78, 4.8, 23, true
  ) ON CONFLICT (user_id) DO NOTHING;

  -- ============================================================
  -- STEP 4: Factory registration for sandbox factory
  -- ============================================================

  INSERT INTO public.factory_registrations (
    id, user_id, company_name, contact_email,
    otp_verified, is_activated, registration_status, kyc_status,
    submitted_at, trust_percentage, verified_tier,
    product_listing_unlocked
  ) VALUES (
    factory_reg_id,
    sandbox_factory_uid,
    'Al-Hadhrami Packaging Industries',
    'sandbox.factory@directhub.net',
    true, true, 'approved', 'approved',
    now() - interval '30 days',
    85, 'partial',
    true
  ) ON CONFLICT (user_id) DO UPDATE SET
    registration_status = 'approved',
    kyc_status = 'approved',
    trust_percentage = 85,
    verified_tier = 'partial',
    product_listing_unlocked = true;

  -- ============================================================
  -- STEP 5: Fetch a category id
  -- ============================================================

  SELECT id INTO cat_id FROM public.product_categories LIMIT 1;

  -- ============================================================
  -- STEP 6: Factory Products — Packaging Rolls (realistic B2B)
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
  ) VALUES
  -- Product 1: BOPP Packaging Roll
  (factory_prod1_id,
   sandbox_factory_uid,
   'BOPP Transparent Packaging Roll — 50cm x 500m',
   'رول تغليف BOPP شفاف — 50 سم × 500 متر',
   'High-clarity BOPP (Biaxially Oriented Polypropylene) transparent packaging roll. Ideal for food packaging, confectionery wrapping, and industrial sealing. Excellent moisture barrier, high tensile strength. Min order: 50 rolls.',
   'رول تغليف BOPP شفاف عالي الجودة مناسب لتغليف المواد الغذائية والحلويات والختم الصناعي. حاجز ممتاز للرطوبة وقوة شد عالية. الحد الأدنى للطلب: 50 رول.',
   'packaging', 'SB-BOPP-50X500', 'roll',
   12.50, 18.00,
   50, 50, 50,
   2000, 'in_stock', 'Yemen',
   jsonb_build_object(
     'width', '50 cm',
     'length', '500 m',
     'thickness', '20 micron',
     'material', 'BOPP',
     'transparency', 'Crystal clear',
     'core_diameter', '76 mm',
     'tensile_strength', '150 MPa',
     'moisture_barrier', 'Excellent'
   ),
   jsonb_build_object(
     'العرض', '50 سم',
     'الطول', '500 متر',
     'السماكة', '20 ميكرون',
     'المادة', 'BOPP',
     'الشفافية', 'شفاف كريستالي',
     'قطر الأسطوانة', '76 مم'
   ),
   '["ISO 9001:2015", "Food Grade Certified", "Yemen Quality Mark"]'::jsonb,
   '3920.20',
   7, true, 3.00,
   '["bopp", "packaging roll", "transparent", "food packaging", "industrial", "sandbox"]'::jsonb,
   true, true, 'local',
   8.5, '50 x 50 x 76 cm', 0, 'Packaging',
   'b2b', false, cat_id,
   'certified_factory'),

  -- Product 2: Stretch Film Roll
  (factory_prod2_id,
   sandbox_factory_uid,
   'Industrial Stretch Film Roll — 50cm x 300m (23 Micron)',
   'رول سترتش فيلم صناعي — 50 سم × 300 متر (23 ميكرون)',
   'Premium industrial stretch film for pallet wrapping, cargo securing, and warehouse storage. High cling, excellent load retention, puncture resistant. Available in clear and black. Min order: 100 rolls.',
   'سترتش فيلم صناعي فاخر لتغليف البالتات وتأمين البضائع والتخزين. التصاق عالٍ، احتفاظ ممتاز بالحمولة، مقاوم للثقب. متوفر بالشفاف والأسود. الحد الأدنى: 100 رول.',
   'packaging', 'SB-STRETCH-50X300', 'roll',
   8.75, 14.00,
   100, 100, 100,
   5000, 'in_stock', 'Yemen',
   jsonb_build_object(
     'width', '50 cm',
     'length', '300 m',
     'thickness', '23 micron',
     'material', 'LLDPE',
     'cling', 'One-sided',
     'colors', 'Clear / Black',
     'elongation', '250%',
     'application', 'Pallet wrapping, cargo securing'
   ),
   jsonb_build_object(
     'العرض', '50 سم',
     'الطول', '300 متر',
     'السماكة', '23 ميكرون',
     'المادة', 'LLDPE',
     'الألوان', 'شفاف / أسود',
     'الاستخدام', 'تغليف البالتات وتأمين البضائع'
   ),
   '["ISO 9001:2015", "Industrial Grade", "Yemen Quality Mark"]'::jsonb,
   '3920.10',
   5, true, 2.50,
   '["stretch film", "pallet wrap", "industrial", "packaging roll", "lldpe", "sandbox"]'::jsonb,
   true, true, 'local',
   4.2, '50 x 30 x 30 cm', 0, 'Packaging',
   'b2b', false, cat_id,
   'certified_factory'),

  -- Product 3: Kraft Paper Roll
  (factory_prod3_id,
   sandbox_factory_uid,
   'Brown Kraft Paper Roll — 70cm x 200m (80gsm)',
   'رول ورق كرافت بني — 70 سم × 200 متر (80 جرام)',
   'Eco-friendly brown kraft paper roll for wrapping, cushioning, and void fill. 80gsm weight, tear-resistant, recyclable. Suitable for e-commerce packaging, gift wrapping, and industrial use. Min order: 30 rolls.',
   'رول ورق كرافت بني صديق للبيئة للتغليف والحشو. وزن 80 جرام، مقاوم للتمزق، قابل لإعادة التدوير. مناسب لتغليف التجارة الإلكترونية والهدايا والاستخدام الصناعي. الحد الأدنى: 30 رول.',
   'packaging', 'SB-KRAFT-70X200', 'roll',
   9.20, 15.00,
   30, 30, 30,
   3000, 'in_stock', 'Yemen',
   jsonb_build_object(
     'width', '70 cm',
     'length', '200 m',
     'weight', '80 gsm',
     'material', 'Virgin Kraft',
     'color', 'Natural Brown',
     'recyclable', true,
     'burst_strength', '1.8 kgf/cm2'
   ),
   jsonb_build_object(
     'العرض', '70 سم',
     'الطول', '200 متر',
     'الوزن', '80 جرام/م2',
     'المادة', 'كرافت طبيعي',
     'اللون', 'بني طبيعي',
     'قابل للتدوير', 'نعم'
   ),
   '["FSC Certified", "Recyclable", "Eco-Friendly"]'::jsonb,
   '4804.11',
   5, true, 2.00,
   '["kraft paper", "brown paper roll", "eco packaging", "wrapping paper", "sandbox"]'::jsonb,
   true, true, 'local',
   6.0, '70 x 35 x 35 cm', 0, 'Packaging',
   'b2b', false, cat_id,
   'certified_factory'),

  -- Product 4: Bubble Wrap Roll
  (factory_prod4_id,
   sandbox_factory_uid,
   'Bubble Wrap Roll — 100cm x 100m (10mm Bubble)',
   'رول فقاعات هوائية — 100 سم × 100 متر (فقاعة 10 مم)',
   'Standard bubble wrap roll for fragile item protection, electronics packaging, and moving. 10mm bubble diameter, excellent cushioning, lightweight. Min order: 20 rolls.',
   'رول فقاعات هوائية قياسي لحماية المواد الهشة والإلكترونيات والنقل. قطر الفقاعة 10 مم، حشو ممتاز، خفيف الوزن. الحد الأدنى: 20 رول.',
   'packaging', 'SB-BUBBLE-100X100', 'roll',
   15.00, 22.00,
   20, 20, 20,
   1500, 'in_stock', 'Yemen',
   jsonb_build_object(
     'width', '100 cm',
     'length', '100 m',
     'bubble_diameter', '10 mm',
     'material', 'LDPE',
     'color', 'Clear',
     'application', 'Fragile item protection, electronics, moving'
   ),
   jsonb_build_object(
     'العرض', '100 سم',
     'الطول', '100 متر',
     'قطر الفقاعة', '10 مم',
     'المادة', 'LDPE',
     'اللون', 'شفاف',
     'الاستخدام', 'حماية المواد الهشة والإلكترونيات'
   ),
   '["ISO 9001:2015", "Food Grade Available"]'::jsonb,
   '3926.90',
   5, true, 4.00,
   '["bubble wrap", "protective packaging", "fragile", "electronics packaging", "sandbox"]'::jsonb,
   true, true, 'local',
   3.5, '100 x 30 x 30 cm', 0, 'Packaging',
   'b2b', false, cat_id,
   'certified_factory')
  ON CONFLICT (id) DO UPDATE SET
    is_published = true,
    is_active    = true,
    unit_price   = EXCLUDED.unit_price;

  -- ============================================================
  -- STEP 7: Supplier Products
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
  ) VALUES
  -- Supplier Product 1: Cooking Oil
  (supplier_prod1_id,
   sandbox_supplier_uid,
   'Premium Sunflower Cooking Oil — 5L Bottle',
   'زيت طعام عباد الشمس فاخر — زجاجة 5 لتر',
   'High-quality refined sunflower cooking oil, 5L bottle. Suitable for frying, baking, and salad dressings. No cholesterol, rich in Vitamin E. Available for retail and wholesale.',
   'زيت طعام عباد الشمس مكرر عالي الجودة، زجاجة 5 لتر. مناسب للقلي والخبز وصلصات السلطة. خالٍ من الكوليسترول، غني بفيتامين E.',
   'food_ingredients', 'SB-OIL-5L', 'bottle',
   6.50, 8.50,
   1, 1, 12,
   800, 'in_stock', 'Yemen',
   jsonb_build_object(
     'volume', '5 Liters',
     'type', 'Refined Sunflower Oil',
     'packaging', 'PET Bottle',
     'shelf_life', '18 months',
     'storage', 'Cool dry place'
   ),
   jsonb_build_object(
     'الحجم', '5 لتر',
     'النوع', 'زيت عباد الشمس المكرر',
     'التعبئة', 'زجاجة PET',
     'مدة الصلاحية', '18 شهراً'
   ),
   '["Food Safety Certified", "Yemen Standards Authority"]'::jsonb,
   '1512.19',
   2, false,
   '["cooking oil", "sunflower oil", "food", "wholesale", "sandbox"]'::jsonb,
   true, true, 'local',
   5.2, '20 x 12 x 28 cm', 0, 'Food & Agriculture',
   'hybrid', true, cat_id,
   'verified_supplier'),

  -- Supplier Product 2: Rice
  (supplier_prod2_id,
   sandbox_supplier_uid,
   'Basmati Rice — 25kg Sack (Premium Grade)',
   'أرز بسمتي — كيس 25 كجم (درجة ممتازة)',
   'Premium long-grain Basmati rice, 25kg sack. Aromatic, fluffy texture after cooking. Sourced from certified farms. Ideal for restaurants, hotels, and bulk buyers.',
   'أرز بسمتي طويل الحبة فاخر، كيس 25 كجم. عطري وهش بعد الطهي. من مزارع معتمدة. مثالي للمطاعم والفنادق والمشترين بالجملة.',
   'food_ingredients', 'SB-RICE-25KG', 'sack',
   22.00, 28.00,
   1, 1, 10,
   500, 'in_stock', 'Yemen',
   jsonb_build_object(
     'weight', '25 kg',
     'type', 'Long-grain Basmati',
     'origin', 'Pakistan',
     'packaging', 'Woven PP sack',
     'shelf_life', '24 months',
     'grade', 'Premium'
   ),
   jsonb_build_object(
     'الوزن', '25 كجم',
     'النوع', 'بسمتي طويل الحبة',
     'المنشأ', 'باكستان',
     'التعبئة', 'كيس PP منسوج',
     'مدة الصلاحية', '24 شهراً',
     'الدرجة', 'ممتازة'
   ),
   '["Food Safety Certified", "Halal Certified"]'::jsonb,
   '1006.30',
   3, false,
   '["rice", "basmati", "food", "wholesale", "bulk", "sandbox"]'::jsonb,
   true, true, 'local',
   25.0, '60 x 40 x 20 cm', 0, 'Food & Agriculture',
   'hybrid', true, cat_id,
   'verified_supplier')
  ON CONFLICT (id) DO UPDATE SET
    is_published = true,
    is_active    = true,
    unit_price   = EXCLUDED.unit_price;

  -- ============================================================
  -- STEP 8: Active Orders for Sandbox Buyer
  -- ============================================================

  INSERT INTO public.orders (
    id, user_id, order_number, status,
    total, payment_method, payment_verified,
    escrow_status, created_at, updated_at,
    shipping_address, billing_address
  ) VALUES
  (buyer_order1_id,
   sandbox_buyer_uid,
   'ORD-SB-2026-001',
   'processing',
   625.00, 'bank_transfer', true,
   'funded',
   now() - interval '3 days', now() - interval '1 day',
   jsonb_build_object('name', 'Ahmed Al-Rashidi', 'address', 'Al-Tahrir Street, Sanaa', 'city', 'Sanaa', 'country', 'Yemen', 'phone', '+967771100001'),
   jsonb_build_object('name', 'Ahmed Al-Rashidi', 'address', 'Al-Tahrir Street, Sanaa', 'city', 'Sanaa', 'country', 'Yemen', 'phone', '+967771100001')),

  (buyer_order2_id,
   sandbox_buyer_uid,
   'ORD-SB-2026-002',
   'shipped',
   1100.00, 'bank_transfer', true,
   'funded',
   now() - interval '7 days', now() - interval '2 days',
   jsonb_build_object('name', 'Ahmed Al-Rashidi', 'address', 'Al-Tahrir Street, Sanaa', 'city', 'Sanaa', 'country', 'Yemen', 'phone', '+967771100001'),
   jsonb_build_object('name', 'Ahmed Al-Rashidi', 'address', 'Al-Tahrir Street, Sanaa', 'city', 'Sanaa', 'country', 'Yemen', 'phone', '+967771100001'))
  ON CONFLICT (id) DO NOTHING;

  -- ============================================================
  -- STEP 9: Logistics Partner for Sandbox Logistics
  -- ============================================================

  INSERT INTO public.logistics_partners (
    id, user_id, company_name, contact_name, email, phone,
    country, city, service_types, coverage_areas,
    fleet_size, is_verified, is_active, rating, total_deliveries,
    description
  ) VALUES (
    logistics_partner_id,
    sandbox_logistics_uid,
    'Al-Amri Express Logistics',
    'Saleh Al-Amri',
    'sandbox.logistics@directhub.net',
    '+967771100005',
    'Yemen', 'Sanaa',
    ARRAY['road_freight', 'last_mile', 'express_delivery'],
    ARRAY['Sanaa', 'Aden', 'Taiz', 'Hodeidah', 'Mukalla'],
    15, true, true, 4.6, 342,
    'شركة لوجستيات متخصصة في الشحن البري والتوصيل السريع داخل اليمن. نوفر خدمات تتبع مباشر وتأمين على الشحنات مع ضمان التسليم في الوقت المحدد.'
  ) ON CONFLICT (user_id) DO NOTHING;

  -- ============================================================
  -- STEP 10: Logistics Routes for Sandbox Logistics
  -- ============================================================

  INSERT INTO public.logistics_routes (
    id, partner_id, origin_city, destination_city,
    origin_country, destination_country,
    transit_days, base_rate_usd, rate_per_kg_usd,
    is_active, service_type
  ) VALUES
  (logistics_route1_id,
   logistics_partner_id,
   'Sanaa', 'Aden',
   'Yemen', 'Yemen',
   1, 25.00, 0.50,
   true, 'road_freight'),

  (logistics_route2_id,
   logistics_partner_id,
   'Sanaa', 'Taiz',
   'Yemen', 'Yemen',
   1, 20.00, 0.45,
   true, 'road_freight')
  ON CONFLICT (id) DO NOTHING;

  -- ============================================================
  -- STEP 11: Order-Logistics assignment for delivery tasks
  -- ============================================================

  INSERT INTO public.order_logistics_selections (
    order_id, partner_id, selected_at, status
  ) VALUES
  (buyer_order2_id, logistics_partner_id, now() - interval '5 days', 'in_transit')
  ON CONFLICT (order_id) DO NOTHING;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Sandbox account seeding error: %', SQLERRM;
END $$;
