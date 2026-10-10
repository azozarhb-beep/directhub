-- Migration: Bilingual Product Fields (i18n support)
-- Timestamp: 20260810250000
-- Adds Arabic language fields to manufacturer_products table
-- Also removes any product limit constraints to allow unlimited listings

-- ============================================================
-- 1. ADD BILINGUAL COLUMNS TO manufacturer_products
-- ============================================================

ALTER TABLE public.manufacturer_products
  ADD COLUMN IF NOT EXISTS name_ar TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS description_ar TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS specifications_en JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS specifications_ar JSONB DEFAULT '{}'::jsonb;

-- ============================================================
-- 2. RENAME existing specifications to specifications_en (copy data)
-- ============================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'manufacturer_products'
      AND column_name = 'specifications'
  ) THEN
    UPDATE public.manufacturer_products
    SET specifications_en = specifications
    WHERE specifications IS NOT NULL AND specifications != '{}'::jsonb;
  END IF;
END $$;

-- ============================================================
-- 3. ADD INDEX FOR BILINGUAL SEARCH
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_manufacturer_products_name_ar
  ON public.manufacturer_products USING gin(to_tsvector('arabic', COALESCE(name_ar, '')));

CREATE INDEX IF NOT EXISTS idx_manufacturer_products_name_en
  ON public.manufacturer_products USING gin(to_tsvector('english', COALESCE(name, '')));

-- ============================================================
-- 4. ENSURE NO PRODUCT LIMIT POLICY EXISTS
-- (RLS already allows unlimited products per manufacturer)
-- Confirm the existing policies are correct
-- ============================================================

-- Re-affirm the unlimited insert policy for manufacturers
DROP POLICY IF EXISTS "manufacturers_manage_own_products" ON public.manufacturer_products;
CREATE POLICY "manufacturers_manage_own_products"
ON public.manufacturer_products
FOR ALL
TO authenticated
USING (manufacturer_id = auth.uid())
WITH CHECK (manufacturer_id = auth.uid());

-- Public can view active products (no limit)
DROP POLICY IF EXISTS "public_view_active_products" ON public.manufacturer_products;
CREATE POLICY "public_view_active_products"
ON public.manufacturer_products
FOR SELECT
TO public
USING (is_active = true);
