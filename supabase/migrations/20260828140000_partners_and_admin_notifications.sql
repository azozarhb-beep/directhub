-- ============================================================
-- Migration: Partners & Admin Notifications for Amal Partner System
-- Timestamp: 20260828140000
-- ============================================================

-- 1. ENUM Types
DROP TYPE IF EXISTS public.partner_type_enum CASCADE;
CREATE TYPE public.partner_type_enum AS ENUM (
  'local_factory',
  'local_supplier',
  'international_factory',
  'logistics_partner'
);

DROP TYPE IF EXISTS public.document_status_enum CASCADE;
CREATE TYPE public.document_status_enum AS ENUM (
  'pending',
  'verified',
  'rejected',
  'pending_manual_review'
);

-- 2. Partners Table
CREATE TABLE IF NOT EXISTS public.partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  company_name TEXT NOT NULL,
  partner_type public.partner_type_enum NOT NULL DEFAULT 'local_factory',
  commercial_registry TEXT,
  tax_number TEXT,
  document_status public.document_status_enum NOT NULL DEFAULT 'pending',
  extracted_document_data JSONB,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. Admin Notifications Table
CREATE TABLE IF NOT EXISTS public.admin_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID REFERENCES public.partners(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  document_type TEXT,
  confidence NUMERIC(4,3),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_partners_user_id ON public.partners(user_id);
CREATE INDEX IF NOT EXISTS idx_partners_document_status ON public.partners(document_status);
CREATE INDEX IF NOT EXISTS idx_partners_partner_type ON public.partners(partner_type);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_partner_id ON public.admin_notifications(partner_id);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_created_at ON public.admin_notifications(created_at DESC);

-- 5. Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_partners_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

-- 6. Enable RLS
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies — partners
DROP POLICY IF EXISTS "partners_insert_own" ON public.partners;
CREATE POLICY "partners_insert_own"
ON public.partners
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "partners_select_own" ON public.partners;
CREATE POLICY "partners_select_own"
ON public.partners
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "partners_update_own" ON public.partners;
CREATE POLICY "partners_update_own"
ON public.partners
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "partners_admin_all" ON public.partners;
CREATE POLICY "partners_admin_all"
ON public.partners
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users au
    WHERE au.id = auth.uid()
    AND (
      au.raw_user_meta_data->>'role' = 'admin'
      OR au.raw_app_meta_data->>'role' = 'admin'
    )
  )
);

-- 8. RLS Policies — admin_notifications (admin only)
DROP POLICY IF EXISTS "admin_notifications_admin_all" ON public.admin_notifications;
CREATE POLICY "admin_notifications_admin_all"
ON public.admin_notifications
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users au
    WHERE au.id = auth.uid()
    AND (
      au.raw_user_meta_data->>'role' = 'admin'
      OR au.raw_app_meta_data->>'role' = 'admin'
    )
  )
);

-- Allow service role to insert notifications (used by API routes)
DROP POLICY IF EXISTS "admin_notifications_service_insert" ON public.admin_notifications;
CREATE POLICY "admin_notifications_service_insert"
ON public.admin_notifications
FOR INSERT
TO authenticated
WITH CHECK (true);

-- 9. Trigger for updated_at
DROP TRIGGER IF EXISTS partners_updated_at_trigger ON public.partners;
CREATE TRIGGER partners_updated_at_trigger
BEFORE UPDATE ON public.partners
FOR EACH ROW
EXECUTE FUNCTION public.update_partners_updated_at();
