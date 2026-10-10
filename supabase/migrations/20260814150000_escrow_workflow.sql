-- Migration: Escrow Order Workflow
-- Timestamp: 20260814150000
-- Adds escrow status tracking, delivery OTP (email-based), and factory order visibility

-- ============================================================
-- 1. ADD ESCROW STATUS COLUMNS TO ORDERS TABLE
-- ============================================================
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS escrow_status TEXT DEFAULT 'pending_payment' CHECK (
  escrow_status IN (
    'pending_payment',
    'pending_verification',
    'funds_secured',
    'shipped',
    'pending_otp_confirmation',
    'funds_released'
  )
),
ADD COLUMN IF NOT EXISTS factory_user_id UUID DEFAULT NULL REFERENCES public.user_profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS factory_notified_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS otp_sent_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS otp_email TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS admin_release_note TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS funds_released_by UUID DEFAULT NULL;

-- ============================================================
-- 2. INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_orders_escrow_status ON public.orders(escrow_status);
CREATE INDEX IF NOT EXISTS idx_orders_factory_user_id ON public.orders(factory_user_id);

-- ============================================================
-- 3. DELIVERY OTP TABLE (for escrow confirmation)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.delivery_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  otp_code TEXT NOT NULL,
  is_used BOOLEAN DEFAULT false,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_delivery_otps_order_id ON public.delivery_otps(order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_otps_user_id ON public.delivery_otps(user_id);

-- ============================================================
-- 4. ENABLE RLS
-- ============================================================
ALTER TABLE public.delivery_otps ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 5. RLS POLICIES FOR DELIVERY OTPS
-- ============================================================
DROP POLICY IF EXISTS "users_manage_own_delivery_otps" ON public.delivery_otps;
CREATE POLICY "users_manage_own_delivery_otps"
ON public.delivery_otps
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "admin_manage_delivery_otps" ON public.delivery_otps;
CREATE POLICY "admin_manage_delivery_otps"
ON public.delivery_otps
FOR ALL
TO authenticated
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

-- ============================================================
-- 6. FACTORY CAN VIEW ORDERS ASSIGNED TO THEM
-- ============================================================
DROP POLICY IF EXISTS "factory_view_assigned_orders" ON public.orders;
CREATE POLICY "factory_view_assigned_orders"
ON public.orders
FOR SELECT
TO authenticated
USING (factory_user_id = auth.uid());

-- ============================================================
-- 7. FACTORY CAN UPDATE SHIPPING STATUS ON ASSIGNED ORDERS
-- ============================================================
DROP POLICY IF EXISTS "factory_update_assigned_orders" ON public.orders;
CREATE POLICY "factory_update_assigned_orders"
ON public.orders
FOR UPDATE
TO authenticated
USING (factory_user_id = auth.uid())
WITH CHECK (factory_user_id = auth.uid());

-- ============================================================
-- 8. FACTORY CAN VIEW ORDER STATUS HISTORY FOR ASSIGNED ORDERS
-- ============================================================
DROP POLICY IF EXISTS "factory_view_assigned_order_history" ON public.order_status_history;
CREATE POLICY "factory_view_assigned_order_history"
ON public.order_status_history
FOR SELECT
TO authenticated
USING (
  order_id IN (
    SELECT id FROM public.orders WHERE factory_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "factory_insert_assigned_order_history" ON public.order_status_history;
CREATE POLICY "factory_insert_assigned_order_history"
ON public.order_status_history
FOR INSERT
TO authenticated
WITH CHECK (
  order_id IN (
    SELECT id FROM public.orders WHERE factory_user_id = auth.uid()
  )
);

-- ============================================================
-- 9. UPDATE EXISTING ORDERS TO HAVE ESCROW STATUS
-- ============================================================
UPDATE public.orders
SET escrow_status = CASE
  WHEN status = 'delivered' AND delivery_otp_verified_at IS NOT NULL THEN 'funds_released'
  WHEN status = 'shipped' THEN 'shipped'
  WHEN payment_verified = true THEN 'funds_secured'
  WHEN receipt_url IS NOT NULL THEN 'pending_verification'
  ELSE 'pending_payment'
END
WHERE escrow_status IS NULL OR escrow_status = 'pending_payment';
