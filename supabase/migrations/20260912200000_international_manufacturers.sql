-- ============================================================
-- MIGRATION: international_manufacturers
-- Adds international_manufacturers table and links it to
-- manufacturer_products via a nullable FK column.
-- ============================================================

-- ============================================================
-- 1. INTERNATIONAL MANUFACTURERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.international_manufacturers (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                TEXT NOT NULL,
    country             TEXT NOT NULL,
    country_code        TEXT,
    factory_area        TEXT,
    production_capacity TEXT,
    employee_count      TEXT,
    established_year    INTEGER,
    certifications      TEXT[],
    industries          TEXT[],
    rfq_email           TEXT,
    whatsapp_contact    TEXT,
    website             TEXT,
    logo_url            TEXT,
    cover_image_url     TEXT,
    description         TEXT,
    is_active           BOOLEAN DEFAULT true,
    created_at          TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 2. ADD FK COLUMN TO MANUFACTURER_PRODUCTS
-- ============================================================
ALTER TABLE public.manufacturer_products
ADD COLUMN IF NOT EXISTS international_manufacturer_id UUID
    REFERENCES public.international_manufacturers(id) ON DELETE SET NULL;

-- ============================================================
-- 3. INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_international_manufacturers_is_active
    ON public.international_manufacturers(is_active);

CREATE INDEX IF NOT EXISTS idx_international_manufacturers_country_code
    ON public.international_manufacturers(country_code);

CREATE INDEX IF NOT EXISTS idx_manufacturer_products_intl_manufacturer_id
    ON public.manufacturer_products(international_manufacturer_id);

-- ============================================================
-- 4. ENABLE RLS
-- ============================================================
ALTER TABLE public.international_manufacturers ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 5. RLS POLICIES
-- ============================================================

-- Public read: anyone can view active manufacturers
DROP POLICY IF EXISTS "public_read_active_international_manufacturers" ON public.international_manufacturers;
CREATE POLICY "public_read_active_international_manufacturers"
ON public.international_manufacturers
FOR SELECT
TO public
USING (is_active = true);

-- Admin full access via existing is_admin_user() function
DROP POLICY IF EXISTS "admin_full_access_international_manufacturers" ON public.international_manufacturers;
CREATE POLICY "admin_full_access_international_manufacturers"
ON public.international_manufacturers
FOR ALL
TO authenticated
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());
