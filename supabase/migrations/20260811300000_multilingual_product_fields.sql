-- Migration: Add multilingual columns to manufacturer_products
-- Adds Chinese (zh) and Turkish (tr) name/description fields for dynamic localization

ALTER TABLE public.manufacturer_products
  ADD COLUMN IF NOT EXISTS name_zh TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS name_tr TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS description_zh TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS description_tr TEXT DEFAULT '';

-- Add comment for documentation
COMMENT ON COLUMN public.manufacturer_products.name_zh IS 'Product name in Chinese (Simplified)';
COMMENT ON COLUMN public.manufacturer_products.name_tr IS 'Product name in Turkish';
COMMENT ON COLUMN public.manufacturer_products.description_zh IS 'Product description in Chinese (Simplified)';
COMMENT ON COLUMN public.manufacturer_products.description_tr IS 'Product description in Turkish';
