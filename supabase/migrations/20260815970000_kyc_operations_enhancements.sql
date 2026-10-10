-- Migration: KYC & Operations Enhancements
-- Timestamp: 20260815970000

-- ============================================================
-- 1. ENHANCE factory_registrations FOR KYC TRACKING
-- ============================================================
ALTER TABLE public.factory_registrations
  ADD COLUMN IF NOT EXISTS kyc_reviewed_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS kyc_reviewed_by UUID DEFAULT NULL REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS kyc_rejection_reason TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS kyc_verification_score INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cr_document_url TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS factory_license_url TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS commercial_registration_number TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS vat_number TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS region TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS address TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS contact_person TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS established_year INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS annual_capacity TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS main_products TEXT[] DEFAULT NULL;

-- ============================================================
-- 2. ADD KYC STATUS CHECK CONSTRAINT (if not exists)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'factory_registrations_kyc_status_check'
  ) THEN
    ALTER TABLE public.factory_registrations
      ADD CONSTRAINT factory_registrations_kyc_status_check
      CHECK (kyc_status IN ('pending', 'under_review', 'approved', 'rejected'));
  END IF;
END $$;

-- ============================================================
-- 3. ENHANCE order_disputes WITH ADDITIONAL TRACKING
-- ============================================================
ALTER TABLE public.order_disputes
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS resolution_note TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS admin_reviewed_by UUID DEFAULT NULL REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS admin_reviewed_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS evidence_urls TEXT[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'critical'));

-- ============================================================
-- 4. OPERATIONS METRICS VIEW
-- ============================================================
CREATE OR REPLACE VIEW public.ops_order_metrics AS
SELECT
  COUNT(*) AS total_orders,
  COUNT(*) FILTER (WHERE status = 'pending') AS pending_orders,
  COUNT(*) FILTER (WHERE status = 'processing') AS processing_orders,
  COUNT(*) FILTER (WHERE status = 'shipped') AS shipped_orders,
  COUNT(*) FILTER (WHERE status = 'delivered') AS delivered_orders,
  COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled_orders,
  COUNT(*) FILTER (WHERE dispute_status IS NOT NULL AND dispute_status != 'none') AS disputed_orders,
  COALESCE(SUM(total) FILTER (WHERE status = 'delivered'), 0) AS total_revenue,
  COALESCE(SUM(total) FILTER (WHERE status IN ('processing', 'shipped')), 0) AS pending_revenue,
  COALESCE(SUM(total) FILTER (WHERE status = 'delivered') * 0.03, 0) AS platform_commission
FROM public.orders;

-- ============================================================
-- 5. INDEXES FOR OPERATIONS DASHBOARD PERFORMANCE
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_orders_status_created
  ON public.orders(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_dispute_status
  ON public.orders(dispute_status)
  WHERE dispute_status IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_factory_registrations_kyc_status
  ON public.factory_registrations(kyc_status);

CREATE INDEX IF NOT EXISTS idx_order_disputes_status_tier
  ON public.order_disputes(status, tier);

CREATE INDEX IF NOT EXISTS idx_order_disputes_priority
  ON public.order_disputes(priority)
  WHERE priority IN ('high', 'critical');

-- ============================================================
-- 6. RLS POLICY FOR ops_order_metrics VIEW
-- ============================================================
ALTER VIEW public.ops_order_metrics OWNER TO postgres;

-- ============================================================
-- 7. GRANT SELECT ON VIEW TO AUTHENTICATED (admin checks in app layer)
-- ============================================================
GRANT SELECT ON public.ops_order_metrics TO authenticated;
