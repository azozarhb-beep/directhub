-- Fix: "column manufacturer_products.currency does not exist"
-- Additive only: no columns/tables are dropped.
ALTER TABLE public.manufacturer_products
  ADD COLUMN IF NOT EXISTS currency text DEFAULT 'YER';

NOTIFY pgrst, 'reload schema';
