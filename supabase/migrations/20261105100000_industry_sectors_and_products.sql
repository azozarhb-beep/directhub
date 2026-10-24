-- Industry sectors & sector products reference tables + registration bug fix
-- Additive only: no existing tables, columns, rows, or referral logic are touched.

-- 1. Registration bug fix: columns required by the registration form
ALTER TABLE public.factory_registrations ADD COLUMN IF NOT EXISTS industry_sector TEXT;
ALTER TABLE public.factory_registrations ADD COLUMN IF NOT EXISTS sector_id UUID;

-- 2. Reference tables
CREATE TABLE IF NOT EXISTS public.industry_sectors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name_ar TEXT NOT NULL,
    name_en TEXT,
    slug TEXT UNIQUE,
    icon TEXT,
    sort_order INTEGER,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sector_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sector_id UUID REFERENCES public.industry_sectors(id) ON DELETE CASCADE,
    name_ar TEXT NOT NULL,
    name_en TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Unique per sector so the seed is idempotent
CREATE UNIQUE INDEX IF NOT EXISTS idx_sector_products_sector_name
ON public.sector_products (sector_id, name_ar);

-- 3. Link registrations to sectors (added after the table exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fk_factory_registrations_sector_id'
    ) THEN
        ALTER TABLE public.factory_registrations
            ADD CONSTRAINT fk_factory_registrations_sector_id
            FOREIGN KEY (sector_id) REFERENCES public.industry_sectors(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_industry_sectors_sort_order ON public.industry_sectors (sort_order);
CREATE INDEX IF NOT EXISTS idx_sector_products_sector_id ON public.sector_products (sector_id);
CREATE INDEX IF NOT EXISTS idx_factory_registrations_sector_id ON public.factory_registrations (sector_id);

-- 5. RLS: public read (registration + search dropdowns), admin write
ALTER TABLE public.industry_sectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sector_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_industry_sectors" ON public.industry_sectors;
CREATE POLICY "public_read_industry_sectors"
ON public.industry_sectors
FOR SELECT
TO public
USING (true);

DROP POLICY IF EXISTS "public_read_sector_products" ON public.sector_products;
CREATE POLICY "public_read_sector_products"
ON public.sector_products
FOR SELECT
TO public
USING (true);

DROP POLICY IF EXISTS "admin_manage_industry_sectors" ON public.industry_sectors;
CREATE POLICY "admin_manage_industry_sectors"
ON public.industry_sectors
FOR ALL
TO authenticated
USING (
    EXISTS (SELECT 1 FROM auth.users au
            WHERE au.id = auth.uid()
              AND (au.raw_user_meta_data->>'role' = 'admin' OR au.raw_app_meta_data->>'role' = 'admin'))
)
WITH CHECK (
    EXISTS (SELECT 1 FROM auth.users au
            WHERE au.id = auth.uid()
              AND (au.raw_user_meta_data->>'role' = 'admin' OR au.raw_app_meta_data->>'role' = 'admin'))
);

DROP POLICY IF EXISTS "admin_manage_sector_products" ON public.sector_products;
CREATE POLICY "admin_manage_sector_products"
ON public.sector_products
FOR ALL
TO authenticated
USING (
    EXISTS (SELECT 1 FROM auth.users au
            WHERE au.id = auth.uid()
              AND (au.raw_user_meta_data->>'role' = 'admin' OR au.raw_app_meta_data->>'role' = 'admin'))
)
WITH CHECK (
    EXISTS (SELECT 1 FROM auth.users au
            WHERE au.id = auth.uid()
              AND (au.raw_user_meta_data->>'role' = 'admin' OR au.raw_app_meta_data->>'role' = 'admin'))
);

-- 6. Seed sectors
INSERT INTO public.industry_sectors (name_ar, name_en, slug, icon, sort_order) VALUES
    ('التعبئة والتغليف والطباعة', 'Packaging & Printing', 'packaging-printing', '📦', 1),
    ('المواد الكيميائية والخام', 'Chemicals & Raw Materials', 'chemicals-raw-materials', '🧪', 2),
    ('البلاستيك والمطاط', 'Plastics & Rubber', 'plastics-rubber', '♻️', 3),
    ('الآلات والمعدات وخطوط الإنتاج', 'Machinery & Production Lines', 'machinery-production-lines', '⚙️', 4),
    ('المعادن والصلب', 'Metals & Steel', 'metals-steel', '🔩', 5),
    ('مواد البناء والإنشاءات', 'Building & Construction', 'building-construction', '🏗️', 6),
    ('الصناعات الغذائية والمشروبات', 'Food & Beverage Raw Materials', 'food-beverage', '🌾', 7),
    ('الأدوية ومستحضرات الصيدلة', 'Pharmaceuticals & Medical', 'pharmaceuticals-medical', '💊', 8),
    ('الكهرباء والطاقة والإلكترونيات', 'Electronics & Energy', 'electronics-energy', '⚡', 9),
    ('السيارات والشاحنات والمركبات', 'Automotive & Logistics', 'automotive-logistics', '🚛', 10),
    ('الأقمشة والغزول والجلود', 'Textiles & Leather', 'textiles-leather', '🧵', 11),
    ('منتجات النظافة والعناية', 'Personal Care & Detergents', 'personal-care-detergents', '🧼', 12)
ON CONFLICT (slug) DO NOTHING;

-- 7. Seed sector products
DO $$
BEGIN
    INSERT INTO public.sector_products (sector_id, name_ar, name_en)
    SELECT s.id, p.name_ar, p.name_en
    FROM (VALUES
        ('packaging-printing', 'رولات تغليف', 'Packaging Rolls'),
        ('packaging-printing', 'كرتون مضلع', 'Corrugated Cartons'),
        ('packaging-printing', 'شرنك وفيلم تغليف', 'Shrink & Packaging Film'),
        ('packaging-printing', 'علب وقوارير', 'Boxes & Bottles'),
        ('packaging-printing', 'أحبار ومطابع صناعية', 'Industrial Inks & Printers'),

        ('chemicals-raw-materials', 'بوليمرات', 'Polymers'),
        ('chemicals-raw-materials', 'كيمياويات صناعية', 'Industrial Chemicals'),
        ('chemicals-raw-materials', 'LABSA', 'LABSA'),
        ('chemicals-raw-materials', 'SLES N70', 'SLES N70'),
        ('chemicals-raw-materials', 'خامات ومذيبات', 'Raw Materials & Solvents'),

        ('plastics-rubber', 'حبيبات بلاستيك', 'Plastic Granules'),
        ('plastics-rubber', 'قوالب حقن وسباكة', 'Injection & Casting Molds'),
        ('plastics-rubber', 'أنابيب وخراطيم', 'Pipes & Hoses'),
        ('plastics-rubber', 'إكسسوارات بلاستيكية صناعية', 'Industrial Plastic Accessories'),

        ('machinery-production-lines', 'خطوط تعبئة وتغليف', 'Filling & Packaging Lines'),
        ('machinery-production-lines', 'مكائن نفخ وحقن', 'Blow & Injection Machines'),
        ('machinery-production-lines', 'قوالب تصنيع', 'Manufacturing Molds'),
        ('machinery-production-lines', 'قطع غيار صناعية', 'Industrial Spare Parts'),

        ('metals-steel', 'لفائف حديد ومسطحات', 'Steel Coils & Flat Sheets'),
        ('metals-steel', 'قطاعات ألومنيوم', 'Aluminum Profiles'),
        ('metals-steel', 'خردة معادن', 'Scrap Metals'),
        ('metals-steel', 'أنابيب صلب وسلك لحام', 'Steel Pipes & Welding Wire'),

        ('building-construction', 'إسمنت', 'Cement'),
        ('building-construction', 'سيراميك', 'Ceramics'),
        ('building-construction', 'مواد عزل', 'Insulation Materials'),
        ('building-construction', 'زجاج صناعي', 'Industrial Glass'),
        ('building-construction', 'حديد تسليح', 'Reinforcement Steel'),

        ('food-beverage', 'حبوب وسكر', 'Grains & Sugar'),
        ('food-beverage', 'زيوت ودهون صناعية', 'Industrial Oils & Fats'),
        ('food-beverage', 'مركزات ونكهات', 'Concentrates & Flavors'),
        ('food-beverage', 'معلبات', 'Canned Goods'),

        ('pharmaceuticals-medical', 'مواد خام دوائية', 'Pharmaceutical Raw Materials'),
        ('pharmaceuticals-medical', 'مستلزمات ومعقمات', 'Supplies & Sterilizers'),
        ('pharmaceuticals-medical', 'معدات ومستهلكات طبية', 'Medical Equipment & Consumables'),

        ('electronics-energy', 'كابلات ومحولات', 'Cables & Transformers'),
        ('electronics-energy', 'بطاريات صناعية', 'Industrial Batteries'),
        ('electronics-energy', 'منظومات طاقة شمسية', 'Solar Energy Systems'),

        ('automotive-logistics', 'شاحنات ومعدات ثقيلة', 'Trucks & Heavy Equipment'),
        ('automotive-logistics', 'بطاريات وإطارات', 'Batteries & Tires'),
        ('automotive-logistics', 'فلاتر وقطع غيار', 'Filters & Spare Parts'),

        ('textiles-leather', 'خيوط صناعية', 'Industrial Threads'),
        ('textiles-leather', 'أقمشة وبطانات', 'Fabrics & Linings'),
        ('textiles-leather', 'جلود ومستلزمات خياطة', 'Leather & Sewing Supplies'),

        ('personal-care-detergents', 'مواد صابون', 'Soap Materials'),
        ('personal-care-detergents', 'كبريتات', 'Sulfates'),
        ('personal-care-detergents', 'عطور صناعية', 'Industrial Fragrances'),
        ('personal-care-detergents', 'معقمات', 'Sanitizers')
    ) AS p(slug, name_ar, name_en)
    JOIN public.industry_sectors s ON s.slug = p.slug
    ON CONFLICT (sector_id, name_ar) DO NOTHING;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Sector products seed failed: %', SQLERRM;
END $$;

-- 8. Backfill sector_id for registrations that already store a legacy slug (never overwrites)
DO $$
BEGIN
    UPDATE public.factory_registrations fr
    SET sector_id = s.id
    FROM public.industry_sectors s
    WHERE fr.sector_id IS NULL
      AND fr.industry_sector IS NOT NULL
      AND s.slug = CASE fr.industry_sector
            WHEN 'pharmaceuticals-raw-materials' THEN 'pharmaceuticals-medical'
            WHEN 'raw-materials-chemicals' THEN 'chemicals-raw-materials'
            WHEN 'electronics-mobile-phones' THEN 'electronics-energy'
            WHEN 'automotive-vehicles' THEN 'automotive-logistics'
            WHEN 'beauty-personal-care' THEN 'personal-care-detergents'
            WHEN 'health-medical-equipment' THEN 'pharmaceuticals-medical'
            WHEN 'construction-building-materials' THEN 'building-construction'
            ELSE fr.industry_sector
        END;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Sector backfill skipped: %', SQLERRM;
END $$;

-- 9. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
