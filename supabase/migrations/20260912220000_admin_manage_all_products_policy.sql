-- Migration: Add admin_manage_all_products RLS policy on manufacturer_products
-- Grants authenticated admin users full access to all rows via public.is_admin_user()

DROP POLICY IF EXISTS "admin_manage_all_products" ON public.manufacturer_products;
CREATE POLICY "admin_manage_all_products"
  ON public.manufacturer_products
  FOR ALL
  TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());
