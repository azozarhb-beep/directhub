-- ============================================================
-- Fix product_warranties: create table + correct RLS policies
-- Timestamp: 20261007152500
-- Purpose: Create product_warranties table if missing, then apply
--          correct RLS policies using order_id join (not user_id).
-- ============================================================

-- Create the table if it does not already exist
CREATE TABLE IF NOT EXISTS public.product_warranties (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES public.manufacturer_products(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  warranty_period_months INTEGER NOT NULL DEFAULT 12,
  terms TEXT,
  starts_at TIMESTAMPTZ,
  expires_at TIMESTAMP GENERATED ALWAYS AS (
    (starts_at AT TIME ZONE 'UTC') + make_interval(months => warranty_period_months)
  ) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure RLS is enabled
ALTER TABLE public.product_warranties ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to start clean (safe even if they don't exist)
DROP POLICY IF EXISTS "Manufacturers can manage their product warranties" ON public.product_warranties;
DROP POLICY IF EXISTS "Buyers can view warranties for their orders" ON public.product_warranties;
DROP POLICY IF EXISTS "Admins can manage all product warranties" ON public.product_warranties;

-- Policy 1: Manufacturers can manage warranties for their own products
CREATE POLICY "Manufacturers can manage their product warranties"
  ON public.product_warranties
  FOR ALL
  TO authenticated
  USING (
    product_id IN (
      SELECT id FROM public.manufacturer_products WHERE manufacturer_id = auth.uid()
    )
  )
  WITH CHECK (
    product_id IN (
      SELECT id FROM public.manufacturer_products WHERE manufacturer_id = auth.uid()
    )
  );

-- Policy 2: Buyers can view warranties linked to their orders
--   product_warranties.order_id → orders.id → orders.user_id = auth.uid()
--   (product_warranties has no user_id column; access is via order_id FK)
CREATE POLICY "Buyers can view warranties for their orders"
  ON public.product_warranties
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.orders o
      WHERE o.id = product_warranties.order_id
        AND o.user_id = auth.uid()
    )
  );

-- Policy 3: Admins can manage all warranties
CREATE POLICY "Admins can manage all product warranties"
  ON public.product_warranties
  FOR ALL
  TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());
