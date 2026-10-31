-- Local Factory Room: extend product_category enum to accept the 13 factory categories.
-- Existing enum values are preserved. inventory_items.category is plain TEXT (no change needed).

ALTER TYPE public.product_category ADD VALUE IF NOT EXISTS 'consumables';
ALTER TYPE public.product_category ADD VALUE IF NOT EXISTS 'furniture_furnishings';
ALTER TYPE public.product_category ADD VALUE IF NOT EXISTS 'household_products';
ALTER TYPE public.product_category ADD VALUE IF NOT EXISTS 'clothing_textiles';
ALTER TYPE public.product_category ADD VALUE IF NOT EXISTS 'food_beverages';
ALTER TYPE public.product_category ADD VALUE IF NOT EXISTS 'cosmetics_personal_care';
ALTER TYPE public.product_category ADD VALUE IF NOT EXISTS 'construction_materials';
ALTER TYPE public.product_category ADD VALUE IF NOT EXISTS 'heavy_equipment';
ALTER TYPE public.product_category ADD VALUE IF NOT EXISTS 'spare_parts';
ALTER TYPE public.product_category ADD VALUE IF NOT EXISTS 'pharma_medical';
ALTER TYPE public.product_category ADD VALUE IF NOT EXISTS 'plastics_industries';
