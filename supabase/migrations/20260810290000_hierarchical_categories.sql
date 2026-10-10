-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Hierarchical Category System + Category-Specific Verification
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Product Categories (deep hierarchy, unlimited depth via parent_id)
CREATE TABLE IF NOT EXISTS public.product_categories (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text NOT NULL UNIQUE,
  name_en       text NOT NULL,
  name_ar       text NOT NULL,
  description_en text,
  description_ar text,
  parent_id     uuid REFERENCES public.product_categories(id) ON DELETE SET NULL,
  depth         integer NOT NULL DEFAULT 0,
  path          text NOT NULL DEFAULT '',          -- e.g. "electronics/consumer/smartphones"
  icon          text,
  image_url     text,
  sort_order    integer NOT NULL DEFAULT 0,
  is_active     boolean NOT NULL DEFAULT true,
  product_count integer NOT NULL DEFAULT 0,
  supplier_count integer NOT NULL DEFAULT 0,
  -- AI assistant config per category
  ai_spec_fields  jsonb DEFAULT '[]'::jsonb,       -- fields AI should ask about
  ai_system_hint  text,                            -- category-specific AI guidance
  -- Verification workflow config
  verification_fields jsonb DEFAULT '[]'::jsonb,   -- required docs for this category
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Indexes for fast hierarchical queries
CREATE INDEX IF NOT EXISTS idx_product_categories_parent ON public.product_categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_product_categories_path   ON public.product_categories USING gin(to_tsvector('simple', path));
CREATE INDEX IF NOT EXISTS idx_product_categories_slug   ON public.product_categories(slug);
CREATE INDEX IF NOT EXISTS idx_product_categories_depth  ON public.product_categories(depth);
CREATE INDEX IF NOT EXISTS idx_product_categories_active ON public.product_categories(is_active) WHERE is_active = true;

-- Full-text search index on category names
CREATE INDEX IF NOT EXISTS idx_product_categories_fts ON public.product_categories
  USING gin(to_tsvector('english', coalesce(name_en,'') || ' ' || coalesce(description_en,'')));

-- 2. Add category_id FK to manufacturer_products (safe alter)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='manufacturer_products' AND column_name='category_id'
  ) THEN
    ALTER TABLE public.manufacturer_products
      ADD COLUMN category_id uuid REFERENCES public.product_categories(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Full-text search vector on products
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='manufacturer_products' AND column_name='search_vector'
  ) THEN
    ALTER TABLE public.manufacturer_products ADD COLUMN search_vector tsvector;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_manufacturer_products_search ON public.manufacturer_products USING gin(search_vector);
CREATE INDEX IF NOT EXISTS idx_manufacturer_products_category_id ON public.manufacturer_products(category_id);

-- Trigger to keep search_vector updated
CREATE OR REPLACE FUNCTION public.update_product_search_vector()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.description, '')), 'B') ||
    setweight(to_tsvector('simple',  coalesce(NEW.category, '')), 'C') ||
    setweight(to_tsvector('simple',  coalesce(NEW.origin_country, '')), 'D');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_product_search_vector ON public.manufacturer_products;
CREATE TRIGGER trg_product_search_vector
  BEFORE INSERT OR UPDATE ON public.manufacturer_products
  FOR EACH ROW EXECUTE FUNCTION public.update_product_search_vector();

-- 3. Seed top-level categories with AI spec fields
INSERT INTO public.product_categories
  (slug, name_en, name_ar, depth, path, sort_order, ai_spec_fields, ai_system_hint, verification_fields)
VALUES
  ('electronics', 'Electronics & Technology', 'إلكترونيات وتقنية', 0, 'electronics', 1,
   '[{"key":"voltage","label":"Voltage (V)","type":"text","required":true},{"key":"wattage","label":"Wattage (W)","type":"text","required":true},{"key":"certifications","label":"Certifications (CE, FCC, RoHS)","type":"text"},{"key":"operating_temp","label":"Operating Temperature Range","type":"text"},{"key":"warranty","label":"Warranty Period","type":"text","required":true}]',
   'You are an expert electronics product specialist. Ask about voltage, wattage, certifications (CE/FCC/RoHS), operating temperature, and warranty. Emphasize safety standards.',
   '[{"key":"ce_certificate","label":"CE Certificate","required":true},{"key":"fcc_certificate","label":"FCC Certificate"},{"key":"rohs_compliance","label":"RoHS Compliance Doc","required":true}]'),

  ('machinery', 'Industrial Machinery', 'الآلات الصناعية', 0, 'machinery', 2,
   '[{"key":"power_output","label":"Power Output (kW/HP)","type":"text","required":true},{"key":"dimensions","label":"Machine Dimensions (L×W×H)","type":"text","required":true},{"key":"weight","label":"Machine Weight (kg)","type":"text"},{"key":"production_capacity","label":"Production Capacity/Hour","type":"text","required":true},{"key":"voltage_phase","label":"Voltage & Phase","type":"text","required":true},{"key":"warranty","label":"Warranty & After-Sales","type":"text"}]',
   'You are an industrial machinery expert. Focus on power output, production capacity, dimensions, voltage requirements, and after-sales support. Ask about installation requirements.',
   '[{"key":"iso_certificate","label":"ISO 9001 Certificate","required":true},{"key":"ce_marking","label":"CE Marking"},{"key":"factory_audit","label":"Factory Audit Report"}]'),

  ('textiles', 'Textiles & Apparel', 'نسيج وملابس', 0, 'textiles', 3,
   '[{"key":"fabric_composition","label":"Fabric Composition (e.g. 100% Cotton)","type":"text","required":true},{"key":"gsm","label":"GSM (grams per square meter)","type":"number","required":true},{"key":"width","label":"Fabric Width (cm)","type":"number"},{"key":"color_fastness","label":"Color Fastness Grade","type":"text"},{"key":"weave_type","label":"Weave/Knit Type","type":"text"},{"key":"certifications","label":"Certifications (OEKO-TEX, GOTS)","type":"text"}]',
   'You are a textiles and apparel specialist. Always ask about fabric composition percentage, GSM weight, width, color fastness, and relevant certifications like OEKO-TEX or GOTS.',
   '[{"key":"oeko_tex","label":"OEKO-TEX Certificate"},{"key":"gots_certificate","label":"GOTS Certificate"},{"key":"lab_test_report","label":"Lab Test Report","required":true}]'),

  ('building', 'Building Materials', 'مواد البناء', 0, 'building', 4,
   '[{"key":"grade_standard","label":"Grade/Standard (e.g. ASTM, BS)","type":"text","required":true},{"key":"compressive_strength","label":"Compressive Strength (MPa)","type":"text"},{"key":"dimensions","label":"Dimensions/Size","type":"text","required":true},{"key":"fire_rating","label":"Fire Rating","type":"text"},{"key":"load_capacity","label":"Load Capacity","type":"text"}]',
   'You are a building materials expert. Ask about grade standards (ASTM/BS/EN), compressive strength, dimensions, fire rating, and load capacity. Emphasize compliance with local building codes.',
   '[{"key":"conformity_certificate","label":"Certificate of Conformity","required":true},{"key":"test_report","label":"Material Test Report","required":true}]'),

  ('food', 'Food & Agriculture', 'غذاء وزراعة', 0, 'food', 5,
   '[{"key":"shelf_life","label":"Shelf Life","type":"text","required":true},{"key":"storage_conditions","label":"Storage Conditions","type":"text","required":true},{"key":"certifications","label":"Certifications (Halal, Organic, ISO 22000)","type":"text","required":true},{"key":"packaging_type","label":"Packaging Type & Size","type":"text"},{"key":"origin","label":"Country/Region of Origin","type":"text","required":true},{"key":"moisture_content","label":"Moisture Content %","type":"number"}]',
   'You are a food & agriculture product specialist. Always ask about shelf life, storage conditions, Halal/Organic certifications, packaging, and country of origin. Food safety is paramount.',
   '[{"key":"halal_certificate","label":"Halal Certificate"},{"key":"organic_certificate","label":"Organic Certificate"},{"key":"iso22000","label":"ISO 22000 / HACCP","required":true},{"key":"health_certificate","label":"Health Certificate","required":true}]'),

  ('chemicals', 'Chemicals & Plastics', 'كيماويات وبلاستيك', 0, 'chemicals', 6,
   '[{"key":"cas_number","label":"CAS Number","type":"text","required":true},{"key":"purity","label":"Purity %","type":"number","required":true},{"key":"flash_point","label":"Flash Point (°C)","type":"text"},{"key":"hazard_class","label":"Hazard Classification (GHS)","type":"text","required":true},{"key":"packaging","label":"Packaging (drums/IBC/bags)","type":"text"},{"key":"shelf_life","label":"Shelf Life","type":"text"}]',
   'You are a chemicals and plastics specialist. Always ask for CAS number, purity percentage, GHS hazard classification, flash point, and SDS availability. Safety data is mandatory.',
   '[{"key":"sds","label":"Safety Data Sheet (SDS)","required":true},{"key":"reach_compliance","label":"REACH Compliance"},{"key":"ghs_label","label":"GHS Label Sample","required":true}]'),

  ('auto', 'Auto Parts & Accessories', 'قطع السيارات', 0, 'auto', 7,
   '[{"key":"oem_number","label":"OEM Part Number","type":"text","required":true},{"key":"compatibility","label":"Vehicle Compatibility (Make/Model/Year)","type":"text","required":true},{"key":"material","label":"Material","type":"text"},{"key":"warranty","label":"Warranty","type":"text","required":true},{"key":"certifications","label":"Certifications (IATF, ISO/TS)","type":"text"}]',
   'You are an automotive parts specialist. Always ask for OEM part number, vehicle compatibility details, material specification, warranty terms, and IATF/ISO certifications.',
   '[{"key":"iatf_certificate","label":"IATF 16949 Certificate"},{"key":"iso_ts","label":"ISO/TS Certificate"},{"key":"test_report","label":"Product Test Report","required":true}]'),

  ('packaging', 'Packaging Solutions', 'حلول التعبئة', 0, 'packaging', 8,
   '[{"key":"material","label":"Material (cardboard/plastic/glass)","type":"text","required":true},{"key":"dimensions","label":"Dimensions (L×W×H mm)","type":"text","required":true},{"key":"load_capacity","label":"Load/Weight Capacity","type":"text"},{"key":"print_options","label":"Printing Options","type":"text"},{"key":"food_grade","label":"Food Grade Compliant?","type":"select","options":["Yes","No"],"required":true}]',
   'You are a packaging solutions expert. Ask about material type, dimensions, load capacity, printing options, and food-grade compliance. Sustainability certifications are increasingly important.',
   '[{"key":"food_grade_cert","label":"Food Grade Certificate"},{"key":"fsc_certificate","label":"FSC Certificate (for paper/cardboard)"}]'),

  ('energy', 'Energy & Power', 'طاقة وكهرباء', 0, 'energy', 9,
   '[{"key":"power_output","label":"Power Output (W/kW)","type":"text","required":true},{"key":"efficiency","label":"Efficiency %","type":"number","required":true},{"key":"voltage","label":"Voltage (V)","type":"text","required":true},{"key":"certifications","label":"Certifications (IEC, UL, TÜV)","type":"text","required":true},{"key":"warranty","label":"Warranty (years)","type":"number"},{"key":"dimensions","label":"Dimensions & Weight","type":"text"}]',
   'You are an energy and power systems expert. Focus on power output, efficiency rating, voltage specifications, IEC/UL/TÜV certifications, and warranty period. Grid compatibility is critical.',
   '[{"key":"iec_certificate","label":"IEC Certificate","required":true},{"key":"ul_certificate","label":"UL Certificate"},{"key":"tuv_certificate","label":"TÜV Certificate"}]'),

  ('medical', 'Medical & Healthcare', 'طبي وصحة', 0, 'medical', 10,
   '[{"key":"device_class","label":"Device Classification (Class I/II/III)","type":"select","options":["Class I","Class II","Class III"],"required":true},{"key":"sterility","label":"Sterility (Sterile/Non-sterile)","type":"select","options":["Sterile","Non-sterile"],"required":true},{"key":"shelf_life","label":"Shelf Life","type":"text","required":true},{"key":"regulatory_approval","label":"Regulatory Approval (FDA/CE/ISO 13485)","type":"text","required":true},{"key":"material","label":"Material & Biocompatibility","type":"text"}]',
   'You are a medical device and healthcare product specialist. Device classification, sterility, regulatory approvals (FDA/CE/ISO 13485), and biocompatibility are mandatory. Never skip regulatory fields.',
   '[{"key":"fda_510k","label":"FDA 510(k) / Registration"},{"key":"ce_mdd","label":"CE Medical Device Certificate","required":true},{"key":"iso13485","label":"ISO 13485 Certificate","required":true},{"key":"biocompatibility","label":"Biocompatibility Test Report"}]'),

  ('furniture', 'Furniture & Interiors', 'أثاث وديكور', 0, 'furniture', 11,
   '[{"key":"material","label":"Primary Material","type":"text","required":true},{"key":"dimensions","label":"Dimensions (L×W×H cm)","type":"text","required":true},{"key":"weight_capacity","label":"Weight Capacity (kg)","type":"number"},{"key":"finish","label":"Surface Finish/Color Options","type":"text"},{"key":"assembly","label":"Assembly Required?","type":"select","options":["Yes","No"]},{"key":"certifications","label":"Certifications (CARB, FSC)","type":"text"}]',
   'You are a furniture and interiors specialist. Ask about primary material, dimensions, weight capacity, finish options, assembly requirements, and CARB/FSC certifications for wood products.',
   '[{"key":"carb_certificate","label":"CARB Certificate (for wood)"},{"key":"fsc_certificate","label":"FSC Certificate"},{"key":"test_report","label":"Structural Test Report"}]'),

  ('raw_materials', 'Raw Materials', 'مواد خام', 0, 'raw_materials', 12,
   '[{"key":"grade","label":"Grade/Quality Standard","type":"text","required":true},{"key":"purity","label":"Purity/Composition %","type":"text","required":true},{"key":"form","label":"Form (powder/granules/liquid/solid)","type":"select","options":["Powder","Granules","Liquid","Solid","Other"],"required":true},{"key":"moisture","label":"Moisture Content %","type":"number"},{"key":"packaging","label":"Packaging (bags/drums/bulk)","type":"text"},{"key":"origin","label":"Country of Origin","type":"text","required":true}]',
   'You are a raw materials procurement specialist. Always ask about grade/quality standard, purity percentage, physical form, moisture content, packaging options, and country of origin.',
   '[{"key":"coa","label":"Certificate of Analysis (CoA)","required":true},{"key":"msds","label":"MSDS / SDS Sheet"},{"key":"origin_certificate","label":"Certificate of Origin","required":true}]')

ON CONFLICT (slug) DO UPDATE SET
  ai_spec_fields     = EXCLUDED.ai_spec_fields,
  ai_system_hint     = EXCLUDED.ai_system_hint,
  verification_fields = EXCLUDED.verification_fields,
  updated_at         = now();

-- 4. Seed sub-categories for Electronics
INSERT INTO public.product_categories (slug, name_en, name_ar, depth, path, sort_order, parent_id)
SELECT
  sub.slug, sub.name_en, sub.name_ar, 1, 'electronics/' || sub.slug, sub.sort_order, p.id
FROM (VALUES
  ('consumer-electronics', 'Consumer Electronics', 'إلكترونيات استهلاكية', 1),
  ('industrial-electronics', 'Industrial Electronics', 'إلكترونيات صناعية', 2),
  ('led-lighting', 'LED Lighting', 'إضاءة LED', 3),
  ('pcb-components', 'PCBs & Components', 'لوحات دوائر وقطع', 4),
  ('batteries-power', 'Batteries & Power', 'بطاريات وطاقة', 5),
  ('cables-wires', 'Cables & Wires', 'كابلات وأسلاك', 6),
  ('semiconductors', 'Semiconductors', 'أشباه الموصلات', 7),
  ('sensors-iot', 'Sensors & IoT', 'حساسات وإنترنت الأشياء', 8)
) AS sub(slug, name_en, name_ar, sort_order)
JOIN public.product_categories p ON p.slug = 'electronics'
ON CONFLICT (slug) DO NOTHING;

-- 5. Seed sub-categories for Textiles
INSERT INTO public.product_categories (slug, name_en, name_ar, depth, path, sort_order, parent_id)
SELECT
  sub.slug, sub.name_en, sub.name_ar, 1, 'textiles/' || sub.slug, sub.sort_order, p.id
FROM (VALUES
  ('cotton-fabrics', 'Cotton Fabrics', 'أقمشة قطنية', 1),
  ('synthetic-fibers', 'Synthetic Fibers', 'ألياف صناعية', 2),
  ('workwear', 'Workwear & Uniforms', 'ملابس عمل وزي موحد', 3),
  ('sportswear', 'Sportswear', 'ملابس رياضية', 4),
  ('home-textiles', 'Home Textiles', 'مفروشات منزلية', 5),
  ('leather-goods', 'Leather Goods', 'منتجات جلدية', 6),
  ('technical-textiles', 'Technical Textiles', 'نسيج تقني', 7)
) AS sub(slug, name_en, name_ar, sort_order)
JOIN public.product_categories p ON p.slug = 'textiles'
ON CONFLICT (slug) DO NOTHING;

-- 6. Seed sub-categories for Machinery
INSERT INTO public.product_categories (slug, name_en, name_ar, depth, path, sort_order, parent_id)
SELECT
  sub.slug, sub.name_en, sub.name_ar, 1, 'machinery/' || sub.slug, sub.sort_order, p.id
FROM (VALUES
  ('cnc-machines', 'CNC Machines', 'ماكينات CNC', 1),
  ('hydraulic-equipment', 'Hydraulic Equipment', 'معدات هيدروليكية', 2),
  ('conveyor-systems', 'Conveyor Systems', 'أنظمة ناقلة', 3),
  ('pumps-valves', 'Pumps & Valves', 'مضخات وصمامات', 4),
  ('compressors', 'Compressors', 'ضواغط', 5),
  ('welding-equipment', 'Welding Equipment', 'معدات لحام', 6),
  ('packaging-machines', 'Packaging Machines', 'ماكينات تعبئة', 7),
  ('food-processing', 'Food Processing Machinery', 'ماكينات تصنيع غذائي', 8)
) AS sub(slug, name_en, name_ar, sort_order)
JOIN public.product_categories p ON p.slug = 'machinery'
ON CONFLICT (slug) DO NOTHING;

-- 7. RLS
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "categories_public_read" ON public.product_categories;
CREATE POLICY "categories_public_read" ON public.product_categories
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "categories_admin_write" ON public.product_categories;
CREATE POLICY "categories_admin_write" ON public.product_categories
  FOR ALL USING (
    auth.jwt() ->> 'role' = 'admin' OR
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' OR
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );
