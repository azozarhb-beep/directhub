-- Migration: Production Readiness Audit — Fill Missing Columns & Functions
-- Timestamp: 20260816131500
-- Purpose: Add all missing columns referenced by application code but not yet in schema

-- ============================================================
-- 1. FACTORY REGISTRATIONS — Add missing KYC & status columns
-- ============================================================

-- kyc_status column (referenced in KYC page and operations dashboard)
-- Note: kyc_status already exists as public.kyc_status ENUM from admin_control_room migration
-- This is a no-op if column already exists
ALTER TABLE public.factory_registrations
  ADD COLUMN IF NOT EXISTS kyc_status public.kyc_status DEFAULT 'pending'::public.kyc_status;

-- registration_status column (referenced in KYC page)
ALTER TABLE public.factory_registrations
  ADD COLUMN IF NOT EXISTS registration_status TEXT DEFAULT 'pending'
    CHECK (registration_status IN ('pending', 'under_review', 'approved', 'rejected'));

-- Document URL columns (referenced in KYC page)
ALTER TABLE public.factory_registrations
  ADD COLUMN IF NOT EXISTS trade_license_url TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS tax_certificate_url TEXT DEFAULT NULL;

-- Timestamp columns for KYC workflow
ALTER TABLE public.factory_registrations
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS documents_submitted_at TIMESTAMPTZ DEFAULT NULL;

-- contact_name alias (KYC page uses contact_name, factory register uses contact_person)
ALTER TABLE public.factory_registrations
  ADD COLUMN IF NOT EXISTS contact_name TEXT DEFAULT '';

-- industry column (referenced in KYC page)
ALTER TABLE public.factory_registrations
  ADD COLUMN IF NOT EXISTS industry TEXT DEFAULT '';

-- ============================================================
-- 2. BACKFILL: Sync contact_name from contact_person
-- ============================================================
UPDATE public.factory_registrations
SET contact_name = contact_person
WHERE contact_name = '' AND contact_person IS NOT NULL AND contact_person != '';

-- ============================================================
-- 3. BACKFILL: Sync kyc_status from is_approved / registration_status
-- ============================================================
UPDATE public.factory_registrations
SET kyc_status = CASE
  WHEN is_approved = true THEN 'approved'
  WHEN approval_note LIKE '%reject%' OR approval_note LIKE '%رفض%' THEN 'rejected'
  ELSE 'pending'
END::public.kyc_status
WHERE kyc_status = 'pending'::public.kyc_status;

-- ============================================================
-- 4. RFQ REQUESTS — Add buyer_id alias for compatibility
-- ============================================================
-- The rfq_requests table uses user_id but some pages reference buyer_id
ALTER TABLE public.rfq_requests
  ADD COLUMN IF NOT EXISTS buyer_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE;

-- buyer_id already exists as the primary column in rfq_requests (no backfill needed)

-- ============================================================
-- 5. USER PROFILES — Add missing columns referenced in app
-- ============================================================
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS seller_category TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- ============================================================
-- 6. ORDERS — Ensure all referenced columns exist
-- ============================================================
-- dispute_tier column (referenced in orders page)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS dispute_tier INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS dispute_factory_resolution TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS dispute_factory_resolved_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS dispute_escalated_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS dispute_buyer_response TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS escrow_frozen_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS dispute_resolution TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS dispute_opened_at TIMESTAMPTZ DEFAULT NULL;

-- ============================================================
-- 7. FUNCTION: is_admin_user() — used in RLS policies
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users au
    WHERE au.id = auth.uid()
    AND (
      (au.raw_user_meta_data->>'role') = 'admin'
      OR (au.raw_app_meta_data->>'role') = 'admin'
    )
  )
$$;

-- ============================================================
-- 8. FUNCTION: get_platform_stats() — for admin dashboards
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_platform_stats()
RETURNS TABLE(
  total_orders BIGINT,
  total_revenue NUMERIC,
  total_users BIGINT,
  total_factories BIGINT,
  pending_kyc BIGINT,
  open_disputes BIGINT,
  platform_commission NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM public.orders)::BIGINT AS total_orders,
    (SELECT COALESCE(SUM(total), 0) FROM public.orders WHERE status = 'delivered') AS total_revenue,
    (SELECT COUNT(*) FROM public.user_profiles)::BIGINT AS total_users,
    (SELECT COUNT(*) FROM public.factory_registrations WHERE is_active = true)::BIGINT AS total_factories,
    (SELECT COUNT(*) FROM public.factory_registrations WHERE kyc_status = 'pending'::public.kyc_status OR registration_status = 'pending')::BIGINT AS pending_kyc,
    (SELECT COUNT(*) FROM public.orders WHERE dispute_status IS NOT NULL AND dispute_status NOT IN ('none', 'resolved', 'closed'))::BIGINT AS open_disputes,
    (SELECT COALESCE(SUM(total) * 0.03, 0) FROM public.orders WHERE status = 'delivered') AS platform_commission;
END;
$$;

-- ============================================================
-- 9. INDEXES for new columns
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_factory_registrations_kyc_status_new
  ON public.factory_registrations(kyc_status);

CREATE INDEX IF NOT EXISTS idx_factory_registrations_registration_status
  ON public.factory_registrations(registration_status);

CREATE INDEX IF NOT EXISTS idx_rfq_requests_buyer_id
  ON public.rfq_requests(buyer_id);

CREATE INDEX IF NOT EXISTS idx_user_profiles_is_active
  ON public.user_profiles(is_active);

-- ============================================================
-- 10. TRIGGER: Auto-sync buyer_id on rfq_requests insert/update
-- ============================================================
CREATE OR REPLACE FUNCTION public.sync_rfq_buyer_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- buyer_id is the canonical column in rfq_requests; no user_id alias needed
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_rfq_buyer_id_trigger ON public.rfq_requests;
CREATE TRIGGER sync_rfq_buyer_id_trigger
BEFORE INSERT OR UPDATE ON public.rfq_requests
FOR EACH ROW EXECUTE FUNCTION public.sync_rfq_buyer_id();

-- ============================================================
-- 11. TRIGGER: Auto-sync contact_name on factory_registrations
-- ============================================================
CREATE OR REPLACE FUNCTION public.sync_factory_contact_name()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.contact_name = '' AND NEW.contact_person IS NOT NULL AND NEW.contact_person != '' THEN
    NEW.contact_name := NEW.contact_person;
  END IF;
  IF NEW.contact_person = '' AND NEW.contact_name IS NOT NULL AND NEW.contact_name != '' THEN
    NEW.contact_person := NEW.contact_name;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_factory_contact_name_trigger ON public.factory_registrations;
CREATE TRIGGER sync_factory_contact_name_trigger
BEFORE INSERT OR UPDATE ON public.factory_registrations
FOR EACH ROW EXECUTE FUNCTION public.sync_factory_contact_name();

-- ============================================================
-- 12. GRANT EXECUTE on new functions
-- ============================================================
GRANT EXECUTE ON FUNCTION public.is_admin_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_platform_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_rfq_buyer_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_factory_contact_name() TO authenticated;
