-- Migration: Dispute Handler System — Integrated with Escrow Workflow
-- Timestamp: 20260815200000

-- ============================================================
-- 1. UPDATE ESCROW STATUS CONSTRAINT — add 'escrow_frozen'
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
      'refund_processed',
      'funds_released'
    )
  );

-- ============================================================
-- 2. ADD DISPUTE COLUMNS TO ORDERS (enhanced)
-- ============================================================
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS dispute_opened_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS dispute_resolved_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS dispute_resolved_by UUID DEFAULT NULL REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS dispute_resolution TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS escrow_frozen_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS refund_processed_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS refund_processed_by UUID DEFAULT NULL REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS admin_release_note TEXT DEFAULT NULL;

-- ============================================================
-- 3. DISPUTES TABLE — full audit log per dispute
-- ============================================================
CREATE TABLE IF NOT EXISTS public.order_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (reason IN ('late_delivery', 'product_mismatch')),
  description TEXT DEFAULT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'under_review', 'resolved_refund', 'resolved_no_refund', 'closed')),
  escrow_frozen BOOLEAN NOT NULL DEFAULT TRUE,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMPTZ DEFAULT NULL,
  resolved_by UUID DEFAULT NULL REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  resolution_note TEXT DEFAULT NULL,
  refund_amount DECIMAL(12,2) DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_order_disputes_order_id ON public.order_disputes(order_id);
CREATE INDEX IF NOT EXISTS idx_order_disputes_buyer_id ON public.order_disputes(buyer_id);
CREATE INDEX IF NOT EXISTS idx_order_disputes_status ON public.order_disputes(status) WHERE status = 'open';

-- ============================================================
-- 4. RLS FOR ORDER DISPUTES
-- ============================================================
ALTER TABLE public.order_disputes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "buyers_view_own_disputes" ON public.order_disputes;
CREATE POLICY "buyers_view_own_disputes"
ON public.order_disputes FOR SELECT TO authenticated
USING (buyer_id = auth.uid() OR public.is_admin_user());

DROP POLICY IF EXISTS "buyers_open_disputes" ON public.order_disputes;
CREATE POLICY "buyers_open_disputes"
ON public.order_disputes FOR INSERT TO authenticated
WITH CHECK (buyer_id = auth.uid());

DROP POLICY IF EXISTS "admin_manage_disputes" ON public.order_disputes;
CREATE POLICY "admin_manage_disputes"
ON public.order_disputes FOR UPDATE TO authenticated
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

-- ============================================================
-- 5. INDEXES FOR DISPUTE QUERIES ON ORDERS
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_orders_dispute_status_v2 ON public.orders(dispute_status) WHERE dispute_status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_escrow_frozen ON public.orders(escrow_status) WHERE escrow_status = 'escrow_frozen';
