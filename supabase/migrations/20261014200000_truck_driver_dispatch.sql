-- ============================================================
-- Migration: Truck & Driver Dispatch for Logistics Partners
-- Adds statuses used by the dispatch workflow and stores driver /
-- truck details directly on public.orders so that the factory
-- tracking screen and Admin dashboard see them in real time.
-- ============================================================

-- 1. Extend order_status enum with the statuses used by the logistics dashboard
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'assigned';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'ready_for_pickup';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'in_transit';

-- 2. Dispatch columns on orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS driver_name TEXT,
  ADD COLUMN IF NOT EXISTS driver_phone TEXT,
  ADD COLUMN IF NOT EXISTS truck_plate TEXT,
  ADD COLUMN IF NOT EXISTS truck_type TEXT,
  ADD COLUMN IF NOT EXISTS dispatched_at TIMESTAMPTZ;

-- 3. Index for dispatched shipments lookups
CREATE INDEX IF NOT EXISTS idx_orders_dispatched_at
  ON public.orders (dispatched_at DESC)
  WHERE dispatched_at IS NOT NULL;
