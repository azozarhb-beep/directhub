-- Master Industrial Taxonomy & Categories Grid
-- Inserts/updates the 10 major industrial sectors into product_categories

-- 1. Add industry_sector column to manufacturer_products for smart routing
ALTER TABLE public.manufacturer_products
ADD COLUMN IF NOT EXISTS industry_sector TEXT DEFAULT NULL;

-- 2. Add index on industry_sector for fast filtering
CREATE INDEX IF NOT EXISTS idx_manufacturer_products_industry_sector
  ON public.manufacturer_products(industry_sector);

CREATE INDEX IF NOT EXISTS idx_manufacturer_products_origin_sector
  ON public.manufacturer_products(origin_country, industry_sector);

-- 3. Upsert the 10 master taxonomy categories (idempotent via ON CONFLICT slug)
DO $$
BEGIN
  -- Pharmaceuticals & Raw Drug Materials
  INSERT INTO public.product_categories (
    id, slug, name_en, name_ar, description_en,
    parent_id, depth, path, icon, image_url,
    sort_order, product_count, supplier_count, is_active
  ) VALUES (
    gen_random_uuid(),
    'pharmaceuticals-raw-materials',
    'Pharmaceuticals & Raw Drug Materials',
    'الأدوية والمواد الخام الدوائية',
    'Finished pharmaceuticals, API raw materials, medical consumables and packaging',
    NULL, 0, 'pharmaceuticals-raw-materials', 'BeakerIcon',
    'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=800',
    1, 0, 0, true
  ) ON CONFLICT (slug) DO UPDATE SET
    name_en = EXCLUDED.name_en,
    name_ar = EXCLUDED.name_ar,
    description_en = EXCLUDED.description_en,
    icon = EXCLUDED.icon,
    image_url = EXCLUDED.image_url,
    sort_order = EXCLUDED.sort_order,
    is_active = true;

  -- Raw Materials & Chemicals
  INSERT INTO public.product_categories (
    id, slug, name_en, name_ar, description_en,
    parent_id, depth, path, icon, image_url,
    sort_order, product_count, supplier_count, is_active
  ) VALUES (
    gen_random_uuid(),
    'raw-materials-chemicals',
    'Raw Materials & Chemicals',
    'المواد الخام والمواد الكيميائية',
    'Polymers, plastics, packaging rolls, industrial and petrochemical materials',
    NULL, 0, 'raw-materials-chemicals', 'CubeTransparentIcon',
    'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?w=800',
    2, 0, 0, true
  ) ON CONFLICT (slug) DO UPDATE SET
    name_en = EXCLUDED.name_en,
    name_ar = EXCLUDED.name_ar,
    description_en = EXCLUDED.description_en,
    icon = EXCLUDED.icon,
    image_url = EXCLUDED.image_url,
    sort_order = EXCLUDED.sort_order,
    is_active = true;

  -- Electronics & Mobile Phones
  INSERT INTO public.product_categories (
    id, slug, name_en, name_ar, description_en,
    parent_id, depth, path, icon, image_url,
    sort_order, product_count, supplier_count, is_active
  ) VALUES (
    gen_random_uuid(),
    'electronics-mobile-phones',
    'Electronics & Mobile Phones',
    'الإلكترونيات والهواتف',
    'Smart devices, accessories, PCBs, telecom equipment and components',
    NULL, 0, 'electronics-mobile-phones', 'DevicePhoneMobileIcon',
    'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800',
    3, 0, 0, true
  ) ON CONFLICT (slug) DO UPDATE SET
    name_en = EXCLUDED.name_en,
    name_ar = EXCLUDED.name_ar,
    description_en = EXCLUDED.description_en,
    icon = EXCLUDED.icon,
    image_url = EXCLUDED.image_url,
    sort_order = EXCLUDED.sort_order,
    is_active = true;

  -- Automotive & Vehicles
  INSERT INTO public.product_categories (
    id, slug, name_en, name_ar, description_en,
    parent_id, depth, path, icon, image_url,
    sort_order, product_count, supplier_count, is_active
  ) VALUES (
    gen_random_uuid(),
    'automotive-vehicles',
    'Automotive & Vehicles',
    'السيارات والمركبات',
    'Auto spare parts, trucks, vehicles, tires and lubricants',
    NULL, 0, 'automotive-vehicles', 'TruckIcon',
    'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=800',
    4, 0, 0, true
  ) ON CONFLICT (slug) DO UPDATE SET
    name_en = EXCLUDED.name_en,
    name_ar = EXCLUDED.name_ar,
    description_en = EXCLUDED.description_en,
    icon = EXCLUDED.icon,
    image_url = EXCLUDED.image_url,
    sort_order = EXCLUDED.sort_order,
    is_active = true;

  -- Beauty & Personal Care
  INSERT INTO public.product_categories (
    id, slug, name_en, name_ar, description_en,
    parent_id, depth, path, icon, image_url,
    sort_order, product_count, supplier_count, is_active
  ) VALUES (
    gen_random_uuid(),
    'beauty-personal-care',
    'Beauty & Personal Care',
    'أدوات التجميل والعناية',
    'Cosmetics, personal care products, perfumes and beauty packaging',
    NULL, 0, 'beauty-personal-care', 'SparklesIcon',
    'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=800',
    5, 0, 0, true
  ) ON CONFLICT (slug) DO UPDATE SET
    name_en = EXCLUDED.name_en,
    name_ar = EXCLUDED.name_ar,
    description_en = EXCLUDED.description_en,
    icon = EXCLUDED.icon,
    image_url = EXCLUDED.image_url,
    sort_order = EXCLUDED.sort_order,
    is_active = true;

  -- Health & Medical Equipment
  INSERT INTO public.product_categories (
    id, slug, name_en, name_ar, description_en,
    parent_id, depth, path, icon, image_url,
    sort_order, product_count, supplier_count, is_active
  ) VALUES (
    gen_random_uuid(),
    'health-medical-equipment',
    'Health & Medical Equipment',
    'الصحة والمعدات الطبية',
    'Laboratory devices, hospital furniture, medical protective equipment',
    NULL, 0, 'health-medical-equipment', 'HeartIcon',
    'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=800',
    6, 0, 0, true
  ) ON CONFLICT (slug) DO UPDATE SET
    name_en = EXCLUDED.name_en,
    name_ar = EXCLUDED.name_ar,
    description_en = EXCLUDED.description_en,
    icon = EXCLUDED.icon,
    image_url = EXCLUDED.image_url,
    sort_order = EXCLUDED.sort_order,
    is_active = true;

  -- Home Appliances & Furniture
  INSERT INTO public.product_categories (
    id, slug, name_en, name_ar, description_en,
    parent_id, depth, path, icon, image_url,
    sort_order, product_count, supplier_count, is_active
  ) VALUES (
    gen_random_uuid(),
    'home-appliances-furniture',
    'Home Appliances & Furniture',
    'الأدوات المنزلية',
    'Cookware, home furniture, electrical appliances and furnishings',
    NULL, 0, 'home-appliances-furniture', 'HomeIcon',
    'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800',
    7, 0, 0, true
  ) ON CONFLICT (slug) DO UPDATE SET
    name_en = EXCLUDED.name_en,
    name_ar = EXCLUDED.name_ar,
    description_en = EXCLUDED.description_en,
    icon = EXCLUDED.icon,
    image_url = EXCLUDED.image_url,
    sort_order = EXCLUDED.sort_order,
    is_active = true;

  -- Construction & Building Materials
  INSERT INTO public.product_categories (
    id, slug, name_en, name_ar, description_en,
    parent_id, depth, path, icon, image_url,
    sort_order, product_count, supplier_count, is_active
  ) VALUES (
    gen_random_uuid(),
    'construction-building-materials',
    'Construction & Building Materials',
    'مواد البناء والإنشاءات',
    'Construction equipment, steel, finishing materials, sanitary tools',
    NULL, 0, 'construction-building-materials', 'BuildingOffice2Icon',
    'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800',
    8, 0, 0, true
  ) ON CONFLICT (slug) DO UPDATE SET
    name_en = EXCLUDED.name_en,
    name_ar = EXCLUDED.name_ar,
    description_en = EXCLUDED.description_en,
    icon = EXCLUDED.icon,
    image_url = EXCLUDED.image_url,
    sort_order = EXCLUDED.sort_order,
    is_active = true;

  -- Office & School Supplies
  INSERT INTO public.product_categories (
    id, slug, name_en, name_ar, description_en,
    parent_id, depth, path, icon, image_url,
    sort_order, product_count, supplier_count, is_active
  ) VALUES (
    gen_random_uuid(),
    'office-school-supplies',
    'Office & School Supplies',
    'اللوازم المكتبية والمدرسية',
    'Paper, writing tools, office and corporate supplies',
    NULL, 0, 'office-school-supplies', 'DocumentTextIcon',
    'https://images.unsplash.com/photo-1497032628192-86f99bcd76bc?w=800',
    9, 0, 0, true
  ) ON CONFLICT (slug) DO UPDATE SET
    name_en = EXCLUDED.name_en,
    name_ar = EXCLUDED.name_ar,
    description_en = EXCLUDED.description_en,
    icon = EXCLUDED.icon,
    image_url = EXCLUDED.image_url,
    sort_order = EXCLUDED.sort_order,
    is_active = true;

  -- Toys, Sports & Entertainment
  INSERT INTO public.product_categories (
    id, slug, name_en, name_ar, description_en,
    parent_id, depth, path, icon, image_url,
    sort_order, product_count, supplier_count, is_active
  ) VALUES (
    gen_random_uuid(),
    'toys-sports-entertainment',
    'Toys, Sports & Entertainment',
    'الألعاب والترفيه',
    'Children toys, entertainment equipment, sports and recreational goods',
    NULL, 0, 'toys-sports-entertainment', 'PuzzlePieceIcon',
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800',
    10, 0, 0, true
  ) ON CONFLICT (slug) DO UPDATE SET
    name_en = EXCLUDED.name_en,
    name_ar = EXCLUDED.name_ar,
    description_en = EXCLUDED.description_en,
    icon = EXCLUDED.icon,
    image_url = EXCLUDED.image_url,
    sort_order = EXCLUDED.sort_order,
    is_active = true;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Master taxonomy upsert error: %', SQLERRM;
END $$;
