-- ============================================================
-- RLS Policy Audit & Fixes
-- Timestamp: 20261007143500
-- Purpose: Ensure all tables have complete, correct RLS policies
-- ============================================================

-- ============================================================
-- 0. Ensure product_warranties table exists (idempotent)
--    Guards against the case where 20261004000002 hasn't run
-- ============================================================

CREATE TABLE IF NOT EXISTS public.product_warranties (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES public.manufacturer_products(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  warranty_period_months INTEGER NOT NULL DEFAULT 12,
  terms TEXT,
  starts_at TIMESTAMPTZ,
  expires_at TIMESTAMP GENERATED ALWAYS AS ((starts_at AT TIME ZONE 'UTC') + make_interval(months => warranty_period_months)) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 1. archive_records — Add missing UPDATE and DELETE policies
--    (table only had SELECT + INSERT; owners need full CRUD)
-- ============================================================

DROP POLICY IF EXISTS "Owners can update archive records" ON public.archive_records;
CREATE POLICY "Owners can update archive records"
  ON public.archive_records
  FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Owners can delete archive records" ON public.archive_records;
CREATE POLICY "Owners can delete archive records"
  ON public.archive_records
  FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

-- Admins can manage all archive records
DROP POLICY IF EXISTS "Admins can manage all archive records" ON public.archive_records;
CREATE POLICY "Admins can manage all archive records"
  ON public.archive_records
  FOR ALL
  TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- ============================================================
-- 2. product_warranties — Fix ALL policy to include WITH CHECK
--    and add explicit INSERT policy for manufacturers
-- ============================================================

DROP POLICY IF EXISTS "Manufacturers can manage their product warranties" ON public.product_warranties;
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

DROP POLICY IF EXISTS "Buyers can view warranties for their orders" ON public.product_warranties;
CREATE POLICY "Buyers can view warranties for their orders"
  ON public.product_warranties
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o WHERE o.id = product_warranties.order_id AND o.user_id = auth.uid()
    )
  );

-- Admins can manage all warranties
DROP POLICY IF EXISTS "Admins can manage all product warranties" ON public.product_warranties;
CREATE POLICY "Admins can manage all product warranties"
  ON public.product_warranties
  FOR ALL
  TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- ============================================================
-- 3. push_subscriptions — Clean up duplicate/conflicting policies
--    The original "Admins can read all push subscriptions" was
--    replaced by "Admins can select all push subscriptions" in
--    migration 20261002180000. Remove the stale original.
-- ============================================================

-- Remove the original admin SELECT policy (replaced by newer one)
DROP POLICY IF EXISTS "Admins can read all push subscriptions" ON public.push_subscriptions;

-- Remove duplicate admin DELETE policy (users already have DELETE via their own policy)
DROP POLICY IF EXISTS "Admins can delete push subscriptions" ON public.push_subscriptions;

-- Re-add clean admin DELETE policy using is_admin_user() for consistency
DROP POLICY IF EXISTS "Admins can delete any push subscription" ON public.push_subscriptions;
CREATE POLICY "Admins can delete any push subscription"
  ON public.push_subscriptions
  FOR DELETE
  TO authenticated
  USING (public.is_admin_user() OR user_id = auth.uid() OR user_id IS NULL);

-- ============================================================
-- 4. Ensure RLS is enabled on all tables (idempotent re-apply)
--    All 100 tables already have rls_enabled=true, this is a
--    safety net to guarantee the setting persists.
-- ============================================================

ALTER TABLE public.archive_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_warranties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_scheduler_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_scheduler_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.abandoned_cart_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcast_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.executive_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_health_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.local_inventory ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 5. Grant EXECUTE on is_admin_user() to authenticated role
--    (ensures all new policies that call this function work)
-- ============================================================
GRANT EXECUTE ON FUNCTION public.is_admin_user() TO authenticated;
