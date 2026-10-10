-- ============================================================
-- Migration: Logistics — Delivery PIN for Logistics Partners
--            + Shipping Fees Released flag on orders
-- ============================================================

-- 1. Add shipping_fees_released column to orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS shipping_fees_released BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS shipping_fees_released_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS logistics_delivery_pin TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS logistics_delivery_pin_verified_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Index for logistics delivery PIN lookup
CREATE INDEX IF NOT EXISTS idx_orders_logistics_delivery_pin
  ON public.orders (logistics_delivery_pin);

CREATE INDEX IF NOT EXISTS idx_orders_shipping_fees_released
  ON public.orders (shipping_fees_released);

-- 3. Add shipping_type and distance_km to logistics_shipments for calculator
ALTER TABLE public.logistics_shipments
  ADD COLUMN IF NOT EXISTS shipping_type TEXT DEFAULT 'local_land',
  ADD COLUMN IF NOT EXISTS distance_km NUMERIC(10, 2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS calculated_cost_usd NUMERIC(12, 2) DEFAULT NULL;

-- 4. Allow logistics partners to update shipping_fees_released on their orders
DROP POLICY IF EXISTS "logistics_partner_update_delivery_pin_orders" ON public.orders;
CREATE POLICY "logistics_partner_update_delivery_pin_orders"
  ON public.orders
  FOR UPDATE
  TO authenticated
  USING (
    logistics_partner_id IN (
      SELECT id FROM public.logistics_partners WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    logistics_partner_id IN (
      SELECT id FROM public.logistics_partners WHERE user_id = auth.uid()
    )
  );

-- 5. Allow logistics partners to read orders assigned to them
DROP POLICY IF EXISTS "logistics_partner_read_assigned_orders" ON public.orders;
CREATE POLICY "logistics_partner_read_assigned_orders"
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (
    logistics_partner_id IN (
      SELECT id FROM public.logistics_partners WHERE user_id = auth.uid()
    )
  );
