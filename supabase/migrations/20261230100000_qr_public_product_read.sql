-- Guarantee public (unauthenticated) read access to active products so QR-code
-- scans on mobile open the product page without logging in.
-- Idempotent and additive.

ALTER TABLE public.manufacturer_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view active products" ON public.manufacturer_products;
CREATE POLICY "Public can view active products"
ON public.manufacturer_products
FOR SELECT
TO anon
USING (is_active = true);

DROP POLICY IF EXISTS "public_view_active_products" ON public.manufacturer_products;
CREATE POLICY "public_view_active_products"
ON public.manufacturer_products
FOR SELECT
TO public
USING (is_active = true);

DROP POLICY IF EXISTS "public_read_supplier_profiles" ON public.supplier_profiles;
CREATE POLICY "public_read_supplier_profiles"
ON public.supplier_profiles
FOR SELECT
TO public
USING (is_active = true);

GRANT SELECT ON public.manufacturer_products TO anon;
GRANT SELECT ON public.supplier_profiles TO anon;

-- Index to make the agent_product_id lookup (QR poster ids) fast.
CREATE INDEX IF NOT EXISTS idx_manufacturer_products_agent_product_id
ON public.manufacturer_products (agent_product_id)
WHERE agent_product_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';
