-- ─────────────────────────────────────────────────────────────────────────────
-- Delivery PIN / Secret Delivery Code System
-- Adds delivery_pin column to orders (separate from OTP) and RLS policies
-- for factory to verify PIN and release escrow funds.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add delivery_pin column to orders (if not exists)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_pin TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS delivery_pin_generated_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS delivery_pin_verified_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS delivery_pin_verified_by UUID DEFAULT NULL;

-- 2. Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_orders_delivery_pin ON public.orders(delivery_pin);
CREATE INDEX IF NOT EXISTS idx_orders_factory_user_id ON public.orders(factory_user_id);

-- 3. Function: factory can read their own orders (needed for PIN verification)
CREATE OR REPLACE FUNCTION public.is_factory_order_owner(order_factory_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT order_factory_user_id = auth.uid();
$$;

-- 4. RLS: allow factory to update delivery_pin_verified_at on their orders
-- (existing RLS policies on orders already handle buyer/admin access)
-- We add a policy for factory to update their own orders
DROP POLICY IF EXISTS "factory_update_own_orders" ON public.orders;
CREATE POLICY "factory_update_own_orders"
ON public.orders
FOR UPDATE
TO authenticated
USING (factory_user_id = auth.uid())
WITH CHECK (factory_user_id = auth.uid());

-- 5. Allow factory to read their own orders
DROP POLICY IF EXISTS "factory_read_own_orders" ON public.orders;
CREATE POLICY "factory_read_own_orders"
ON public.orders
FOR SELECT
TO authenticated
USING (factory_user_id = auth.uid());
