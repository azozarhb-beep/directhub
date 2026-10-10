-- Migration: Manual Admin Payout Approval System
-- Timestamp: 20260815142128
-- Removes automatic fund release. Buyer confirmation triggers admin notification.
-- Admin must manually approve payout via "صرف المستحقات" button.

-- ============================================================
-- 1. ADD NEW ESCROW STATUS: pending_admin_payout
-- ============================================================
-- Drop and recreate the check constraint to include the new status
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_escrow_status_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_escrow_status_check CHECK (
    escrow_status IN (
      'pending_payment',
      'pending_verification',
      'funds_secured',
      'shipped',
      'pending_otp_confirmation',
      'pending_admin_payout',
      'funds_released'
    )
  );

-- ============================================================
-- 2. ADD TRANSACTION LOG COLUMNS TO ORDERS
-- ============================================================
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS buyer_confirmed_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS admin_payout_reviewed_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS admin_payout_approved_by UUID DEFAULT NULL REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payout_note TEXT DEFAULT NULL;

-- ============================================================
-- 3. ADMIN PAYOUT APPROVALS TABLE (full audit log)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.admin_payout_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  admin_user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('approved', 'held', 'reviewed')),
  note TEXT DEFAULT NULL,
  buyer_confirmed_at TIMESTAMPTZ DEFAULT NULL,
  admin_reviewed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  payout_released_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_payout_approvals_order_id ON public.admin_payout_approvals(order_id);
CREATE INDEX IF NOT EXISTS idx_admin_payout_approvals_admin_user_id ON public.admin_payout_approvals(admin_user_id);

-- ============================================================
-- 4. RLS FOR ADMIN PAYOUT APPROVALS
-- ============================================================
ALTER TABLE public.admin_payout_approvals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_manage_payout_approvals" ON public.admin_payout_approvals;
CREATE POLICY "admin_manage_payout_approvals"
ON public.admin_payout_approvals
FOR ALL
TO authenticated
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

-- ============================================================
-- 5. MIGRATE EXISTING pending_otp_confirmation ORDERS
--    that have delivery_otp_verified_at set but funds not released
--    → move them to pending_admin_payout so admin can action them
-- ============================================================
UPDATE public.orders
SET
  escrow_status = 'pending_admin_payout',
  buyer_confirmed_at = delivery_otp_verified_at
WHERE
  escrow_status = 'funds_secured'
  AND delivery_otp_verified_at IS NOT NULL
  AND funds_released_at IS NULL;
