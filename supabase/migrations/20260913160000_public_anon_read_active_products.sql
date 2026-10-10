-- ============================================================
-- RLS Policy: Allow anonymous (guest) users to read active products
-- Adds explicit anon role policy for manufacturer_products
-- ============================================================

-- Drop if exists to ensure idempotency
DROP POLICY IF EXISTS "Public can view active products" ON public.manufacturer_products;

-- Allow anon (unauthenticated/guest) users to SELECT active products
CREATE POLICY "Public can view active products"
ON public.manufacturer_products
FOR SELECT
TO anon
USING (is_active = true);
