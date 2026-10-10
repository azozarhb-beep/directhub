-- Migration: Cash Upfront Escrow & CFO Approval System
-- Timestamp: 20260925200000
-- Adds cash_upfront_escrow and pending_cfo_approval statuses to escrow_transactions
-- Adds CFO approval fields to orders and escrow_transactions
-- Adds wire_transfer_receipts table for SWIFT/OCR verification

-- ============================================================
-- 1. EXTEND ESCROW STATUS IN ORDERS TABLE
-- ============================================================
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS escrow_payment_type TEXT DEFAULT 'standard' CHECK (
    escrow_payment_type IN ('standard', 'cash_upfront_escrow')
  ),
  ADD COLUMN IF NOT EXISTS cfo_approval_status TEXT DEFAULT NULL CHECK (
    cfo_approval_status IN ('pending_cfo_approval', 'cfo_approved', 'cfo_rejected', NULL)
  ),
  ADD COLUMN IF NOT EXISTS cfo_approved_by UUID DEFAULT NULL REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cfo_approved_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cfo_rejection_reason TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS platform_commission_amount NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS platform_commission_rate_label TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS wire_transfer_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS wire_transfer_verified_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS wire_transfer_ocr_result JSONB DEFAULT NULL;

-- ============================================================
-- 2. EXTEND ESCROW_TRANSACTIONS TABLE (if exists)
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'escrow_transactions') THEN
    ALTER TABLE public.escrow_transactions
      ADD COLUMN IF NOT EXISTS payment_type TEXT DEFAULT 'standard' CHECK (
        payment_type IN ('standard', 'cash_upfront_escrow')
      ),
      ADD COLUMN IF NOT EXISTS cfo_approval_status TEXT DEFAULT NULL CHECK (
        cfo_approval_status IN ('pending_cfo_approval', 'cfo_approved', 'cfo_rejected', NULL)
      ),
      ADD COLUMN IF NOT EXISTS cfo_approved_by UUID DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS cfo_approved_at TIMESTAMPTZ DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS cfo_rejection_reason TEXT DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS wire_transfer_verified BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS wire_transfer_receipt_url TEXT DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS wire_transfer_ocr_result JSONB DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS wire_transfer_verified_at TIMESTAMPTZ DEFAULT NULL;
  END IF;
END $$;

-- ============================================================
-- 3. WIRE TRANSFER RECEIPTS TABLE (SWIFT / Bank Wire OCR)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.wire_transfer_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  receipt_url TEXT NOT NULL,
  receipt_base64 TEXT,
  amount_detected NUMERIC(14,2) DEFAULT NULL,
  currency_detected TEXT DEFAULT NULL,
  sender_name_detected TEXT DEFAULT NULL,
  swift_code_detected TEXT DEFAULT NULL,
  reference_detected TEXT DEFAULT NULL,
  bank_name_detected TEXT DEFAULT NULL,
  ocr_raw_result JSONB DEFAULT NULL,
  ocr_confidence NUMERIC(5,2) DEFAULT NULL,
  verification_status TEXT DEFAULT 'pending' CHECK (
    verification_status IN ('pending', 'ocr_processing', 'verified', 'rejected', 'manual_review')
  ),
  admin_verified_by UUID DEFAULT NULL REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  admin_verified_at TIMESTAMPTZ DEFAULT NULL,
  admin_note TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_wire_receipts_order_id ON public.wire_transfer_receipts(order_id);
CREATE INDEX IF NOT EXISTS idx_wire_receipts_uploaded_by ON public.wire_transfer_receipts(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_wire_receipts_status ON public.wire_transfer_receipts(verification_status);

-- ============================================================
-- 4. CFO APPROVAL LOG TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.cfo_approval_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('submitted', 'approved', 'rejected', 'escalated')),
  performed_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  note TEXT DEFAULT NULL,
  amount_usd NUMERIC(14,2) DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cfo_log_order_id ON public.cfo_approval_log(order_id);

-- ============================================================
-- 5. ENABLE RLS
-- ============================================================
ALTER TABLE public.wire_transfer_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cfo_approval_log ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 6. RLS POLICIES — wire_transfer_receipts
-- ============================================================
DROP POLICY IF EXISTS "buyers_manage_own_wire_receipts" ON public.wire_transfer_receipts;
CREATE POLICY "buyers_manage_own_wire_receipts"
ON public.wire_transfer_receipts
FOR ALL
TO authenticated
USING (uploaded_by = auth.uid())
WITH CHECK (uploaded_by = auth.uid());

DROP POLICY IF EXISTS "admin_manage_wire_receipts" ON public.wire_transfer_receipts;
CREATE POLICY "admin_manage_wire_receipts"
ON public.wire_transfer_receipts
FOR ALL
TO authenticated
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

-- ============================================================
-- 7. RLS POLICIES — cfo_approval_log
-- ============================================================
DROP POLICY IF EXISTS "buyers_view_own_cfo_log" ON public.cfo_approval_log;
CREATE POLICY "buyers_view_own_cfo_log"
ON public.cfo_approval_log
FOR SELECT
TO authenticated
USING (
  order_id IN (SELECT id FROM public.orders WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "admin_manage_cfo_log" ON public.cfo_approval_log;
CREATE POLICY "admin_manage_cfo_log"
ON public.cfo_approval_log
FOR ALL
TO authenticated
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

-- ============================================================
-- 8. INDEXES FOR PERFORMANCE
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_orders_escrow_payment_type ON public.orders(escrow_payment_type);
CREATE INDEX IF NOT EXISTS idx_orders_cfo_approval_status ON public.orders(cfo_approval_status);
CREATE INDEX IF NOT EXISTS idx_orders_wire_transfer_verified ON public.orders(wire_transfer_verified);
