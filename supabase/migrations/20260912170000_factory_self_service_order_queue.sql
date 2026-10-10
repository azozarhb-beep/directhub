-- Migration: Factory Self-Service Order Queue
-- Timestamp: 20260912170000
-- Allows factories to self-manage order status (accept, process, update)
-- without requiring admin intervention for every order.

-- ============================================================
-- 1. ENSURE factory_user_id INDEX EXISTS (idempotent)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_orders_factory_user_id_queue
  ON public.orders(factory_user_id)
  WHERE factory_user_id IS NOT NULL;

-- ============================================================
-- 2. RLS: Factory can update status on their assigned orders
--    (self-service lifecycle: accept → processing → shipped)
-- ============================================================
DROP POLICY IF EXISTS "factory_self_service_status_update" ON public.orders;
CREATE POLICY "factory_self_service_status_update"
ON public.orders
FOR UPDATE
TO authenticated
USING (factory_user_id = auth.uid())
WITH CHECK (factory_user_id = auth.uid());

-- ============================================================
-- 3. RLS: Factory can insert status history for their orders
-- ============================================================
DROP POLICY IF EXISTS "factory_insert_order_status_history" ON public.order_status_history;
CREATE POLICY "factory_insert_order_status_history"
ON public.order_status_history
FOR INSERT
TO authenticated
WITH CHECK (
  order_id IN (
    SELECT id FROM public.orders WHERE factory_user_id = auth.uid()
  )
);

-- ============================================================
-- 4. RLS: Factory can read status history for their orders
-- ============================================================
DROP POLICY IF EXISTS "factory_read_order_status_history" ON public.order_status_history;
CREATE POLICY "factory_read_order_status_history"
ON public.order_status_history
FOR SELECT
TO authenticated
USING (
  order_id IN (
    SELECT id FROM public.orders WHERE factory_user_id = auth.uid()
  )
);

-- ============================================================
-- 5. Add factory_accepted_at and factory_notes columns
--    for self-service workflow tracking
-- ============================================================
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS factory_accepted_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS factory_notes TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS factory_status TEXT DEFAULT 'pending_acceptance';

CREATE INDEX IF NOT EXISTS idx_orders_factory_status
  ON public.orders(factory_status)
  WHERE factory_user_id IS NOT NULL;
