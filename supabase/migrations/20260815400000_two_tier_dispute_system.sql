-- Migration: Two-Tier Dispute System
-- Timestamp: 20260815400000
-- Level 1: Factory Direct Resolution
-- Level 2: Admin Escalation (Master Control)

-- ============================================================
-- 1. ADD TWO-TIER COLUMNS TO order_disputes TABLE
-- ============================================================
ALTER TABLE public.order_disputes
  ADD COLUMN IF NOT EXISTS tier INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS factory_id UUID DEFAULT NULL REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS factory_resolution_type TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS factory_resolution_note TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS factory_resolved_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS buyer_response TEXT DEFAULT NULL CHECK (buyer_response IN ('accepted', 'rejected', NULL)),
  ADD COLUMN IF NOT EXISTS buyer_responded_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS escalated_by UUID DEFAULT NULL REFERENCES public.user_profiles(id) ON DELETE SET NULL;

-- ============================================================
-- 2. UPDATE STATUS CHECK CONSTRAINT on order_disputes
-- ============================================================
ALTER TABLE public.order_disputes
  DROP CONSTRAINT IF EXISTS order_disputes_status_check;

ALTER TABLE public.order_disputes
  ADD CONSTRAINT order_disputes_status_check CHECK (
    status IN (
      'open',
      'factory_reviewing',
      'factory_resolved',
      'buyer_accepted',
      'escalated',
      'under_review',
      'resolved_refund',
      'resolved_no_refund',
      'closed'
    )
  );

-- ============================================================
-- 3. ADD DISPUTE TIER COLUMNS TO ORDERS TABLE
-- ============================================================
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS dispute_tier INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS dispute_factory_resolution TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS dispute_factory_resolved_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS dispute_escalated_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS dispute_buyer_response TEXT DEFAULT NULL;

-- ============================================================
-- 4. UPDATE ESCROW STATUS CONSTRAINT — add tier-2 frozen state
-- ============================================================
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
      'escrow_frozen',
      'escrow_frozen_escalated',
      'refund_processed',
      'funds_released'
    )
  );

-- ============================================================
-- 5. RLS POLICY — allow factory to view/update their disputes
-- ============================================================
DROP POLICY IF EXISTS "factory_view_own_disputes" ON public.order_disputes;
CREATE POLICY "factory_view_own_disputes"
ON public.order_disputes FOR SELECT TO authenticated
USING (
  factory_id = auth.uid()
  OR buyer_id = auth.uid()
  OR public.is_admin_user()
);

DROP POLICY IF EXISTS "factory_update_own_disputes" ON public.order_disputes;
CREATE POLICY "factory_update_own_disputes"
ON public.order_disputes FOR UPDATE TO authenticated
USING (
  factory_id = auth.uid()
  OR buyer_id = auth.uid()
  OR public.is_admin_user()
)
WITH CHECK (
  factory_id = auth.uid()
  OR buyer_id = auth.uid()
  OR public.is_admin_user()
);

-- ============================================================
-- 6. INDEX FOR ESCALATED DISPUTES (admin fast lookup)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_order_disputes_escalated
  ON public.order_disputes(escalated_at)
  WHERE escalated_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_order_disputes_tier
  ON public.order_disputes(tier);

CREATE INDEX IF NOT EXISTS idx_orders_escrow_frozen_escalated
  ON public.orders(escrow_status)
  WHERE escrow_status = 'escrow_frozen_escalated';
