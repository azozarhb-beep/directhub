-- Insert the 10 missing master categories into product_categories
-- These slugs were in MASTER_SLUGS but not inserted by the original taxonomy migration

DO $$
BEGIN

  -- Food & Agriculture
  INSERT INTO public.product_categories (
    id, slug, name_en, name_ar, description_en,
    parent_id, depth, path, icon, image_url,
    sort_order, product_count, supplier_count, is_active
  ) VALUES (
    gen_random_uuid(),
    'food-agriculture',
    'Food & Agriculture',
    'الغذاء والزراعة',
    'Food products, agricultural commodities, grains, spices and processed foods',
    NULL, 0, 'food-agriculture', 'ShoppingBagIcon',
    'https://images.unsplash.com/photo-1542838132-92c53300491e?w=800',
    11, 0, 0, true
  ) ON CONFLICT (slug) DO UPDATE SET
    name_en = EXCLUDED.name_en,
    name_ar = EXCLUDED.name_ar,
    description_en = EXCLUDED.description_en,
    icon = EXCLUDED.icon,
    image_url = EXCLUDED.image_url,
    sort_order = EXCLUDED.sort_order,
    is_active = true;

  -- Textiles & Apparel
  INSERT INTO public.product_categories (
    id, slug, name_en, name_ar, description_en,
    parent_id, depth, path, icon, image_url,
    sort_order, product_count, supplier_count, is_active
  ) VALUES (
    gen_random_uuid(),
    'textiles-apparel',
    'Textiles & Apparel',
    'المنسوجات والملابس',
    'Fabrics, garments, yarn, woven and knitted textiles for B2B sourcing',
    NULL, 0, 'textiles-apparel', 'SwatchIcon',
    'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=800',
    12, 0, 0, true
  ) ON CONFLICT (slug) DO UPDATE SET
    name_en = EXCLUDED.name_en,
    name_ar = EXCLUDED.name_ar,
    description_en = EXCLUDED.description_en,
    icon = EXCLUDED.icon,
    image_url = EXCLUDED.image_url,
    sort_order = EXCLUDED.sort_order,
    is_active = true;

  -- Industrial Machinery & Equipment
  INSERT INTO public.product_categories (
    id, slug, name_en, name_ar, description_en,
    parent_id, depth, path, icon, image_url,
    sort_order, product_count, supplier_count, is_active
  ) VALUES (
    gen_random_uuid(),
    'industrial-machinery',
    'Industrial Machinery & Equipment',
    'الآلات والمعدات الصناعية',
    'Manufacturing machines, CNC equipment, industrial tools and heavy machinery',
    NULL, 0, 'industrial-machinery', 'WrenchScrewdriverIcon',
    'https://images.unsplash.com/photo-1565043589221-1a6fd9ae45c7?w=800',
    13, 0, 0, true
  ) ON CONFLICT (slug) DO UPDATE SET
    name_en = EXCLUDED.name_en,
    name_ar = EXCLUDED.name_ar,
    description_en = EXCLUDED.description_en,
    icon = EXCLUDED.icon,
    image_url = EXCLUDED.image_url,
    sort_order = EXCLUDED.sort_order,
    is_active = true;

  -- Metals, Steel & Mining
  INSERT INTO public.product_categories (
    id, slug, name_en, name_ar, description_en,
    parent_id, depth, path, icon, image_url,
    sort_order, product_count, supplier_count, is_active
  ) VALUES (
    gen_random_uuid(),
    'metals-steel',
    'Metals, Steel & Mining',
    'المعادن والصلب والتعدين',
    'Steel bars, aluminum sheets, copper wire, iron ore and metal alloys',
    NULL, 0, 'metals-steel', 'CubeIcon',
    'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=800',
    14, 0, 0, true
  ) ON CONFLICT (slug) DO UPDATE SET
    name_en = EXCLUDED.name_en,
    name_ar = EXCLUDED.name_ar,
    description_en = EXCLUDED.description_en,
    icon = EXCLUDED.icon,
    image_url = EXCLUDED.image_url,
    sort_order = EXCLUDED.sort_order,
    is_active = true;

  -- Packaging & Printing
  INSERT INTO public.product_categories (
    id, slug, name_en, name_ar, description_en,
    parent_id, depth, path, icon, image_url,
    sort_order, product_count, supplier_count, is_active
  ) VALUES (
    gen_random_uuid(),
    'packaging-printing',
    'Packaging & Printing',
    'التغليف والطباعة',
    'Cartons, labels, flexible packaging, printing materials and industrial wrapping',
    NULL, 0, 'packaging-printing', 'ArchiveBoxIcon',
    'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=800',
    15, 0, 0, true
  ) ON CONFLICT (slug) DO UPDATE SET
    name_en = EXCLUDED.name_en,
    name_ar = EXCLUDED.name_ar,
    description_en = EXCLUDED.description_en,
    icon = EXCLUDED.icon,
    image_url = EXCLUDED.image_url,
    sort_order = EXCLUDED.sort_order,
    is_active = true;

  -- Energy & Power
  INSERT INTO public.product_categories (
    id, slug, name_en, name_ar, description_en,
    parent_id, depth, path, icon, image_url,
    sort_order, product_count, supplier_count, is_active
  ) VALUES (
    gen_random_uuid(),
    'energy-power',
    'Energy & Power',
    'الطاقة والكهرباء',
    'Solar panels, generators, transformers, cables and electrical equipment',
    NULL, 0, 'energy-power', 'BoltIcon',
    'https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?w=800',
    16, 0, 0, true
  ) ON CONFLICT (slug) DO UPDATE SET
    name_en = EXCLUDED.name_en,
    name_ar = EXCLUDED.name_ar,
    description_en = EXCLUDED.description_en,
    icon = EXCLUDED.icon,
    image_url = EXCLUDED.image_url,
    sort_order = EXCLUDED.sort_order,
    is_active = true;

  -- Plastics & Rubber
  INSERT INTO public.product_categories (
    id, slug, name_en, name_ar, description_en,
    parent_id, depth, path, icon, image_url,
    sort_order, product_count, supplier_count, is_active
  ) VALUES (
    gen_random_uuid(),
    'plastics-rubber',
    'Plastics & Rubber',
    'البلاستيك والمطاط',
    'Plastic granules, rubber sheets, PVC pipes, silicone and polymer products',
    NULL, 0, 'plastics-rubber', 'BeakerIcon',
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800',
    17, 0, 0, true
  ) ON CONFLICT (slug) DO UPDATE SET
    name_en = EXCLUDED.name_en,
    name_ar = EXCLUDED.name_ar,
    description_en = EXCLUDED.description_en,
    icon = EXCLUDED.icon,
    image_url = EXCLUDED.image_url,
    sort_order = EXCLUDED.sort_order,
    is_active = true;

  -- Cleaning & Hygiene Products
  INSERT INTO public.product_categories (
    id, slug, name_en, name_ar, description_en,
    parent_id, depth, path, icon, image_url,
    sort_order, product_count, supplier_count, is_active
  ) VALUES (
    gen_random_uuid(),
    'cleaning-hygiene',
    'Cleaning & Hygiene Products',
    'منتجات التنظيف والنظافة',
    'Detergents, disinfectants, cleaning equipment and industrial hygiene supplies',
    NULL, 0, 'cleaning-hygiene', 'SparklesIcon',
    'https://images.unsplash.com/photo-1563453392212-326f5e854473?w=800',
    18, 0, 0, true
  ) ON CONFLICT (slug) DO UPDATE SET
    name_en = EXCLUDED.name_en,
    name_ar = EXCLUDED.name_ar,
    description_en = EXCLUDED.description_en,
    icon = EXCLUDED.icon,
    image_url = EXCLUDED.image_url,
    sort_order = EXCLUDED.sort_order,
    is_active = true;

  -- Furniture & Interior Design
  INSERT INTO public.product_categories (
    id, slug, name_en, name_ar, description_en,
    parent_id, depth, path, icon, image_url,
    sort_order, product_count, supplier_count, is_active
  ) VALUES (
    gen_random_uuid(),
    'furniture-interiors',
    'Furniture & Interior Design',
    'الأثاث والتصميم الداخلي',
    'Office furniture, home furnishings, interior decor and modular systems',
    NULL, 0, 'furniture-interiors', 'HomeIcon',
    'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800',
    19, 0, 0, true
  ) ON CONFLICT (slug) DO UPDATE SET
    name_en = EXCLUDED.name_en,
    name_ar = EXCLUDED.name_ar,
    description_en = EXCLUDED.description_en,
    icon = EXCLUDED.icon,
    image_url = EXCLUDED.image_url,
    sort_order = EXCLUDED.sort_order,
    is_active = true;

  -- Agriculture & Farming Equipment
  INSERT INTO public.product_categories (
    id, slug, name_en, name_ar, description_en,
    parent_id, depth, path, icon, image_url,
    sort_order, product_count, supplier_count, is_active
  ) VALUES (
    gen_random_uuid(),
    'agriculture-farming',
    'Agriculture & Farming Equipment',
    'الزراعة ومعدات المزارع',
    'Tractors, irrigation systems, seeds, fertilizers and farming tools',
    NULL, 0, 'agriculture-farming', 'GlobeAltIcon',
    'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?w=800',
    20, 0, 0, true
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
    RAISE NOTICE 'Missing 10 master categories upsert error: %', SQLERRM;
END $$;
