-- Additive only: international trade fields for manufacturer products.
ALTER TABLE public.manufacturer_products
ADD COLUMN IF NOT EXISTS hs_code text,
ADD COLUMN IF NOT EXISTS supported_incoterms text[] DEFAULT '{}'::text[],
ADD COLUMN IF NOT EXISTS port_of_loading text;

NOTIFY pgrst, 'reload schema';
