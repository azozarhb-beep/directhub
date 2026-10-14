-- ============================================================
-- Migration: dispute_attachments
-- Evidence files (damage photos, inspection documents) attached
-- to a logistics dispute ticket. Files live in the
-- chat-attachments storage bucket.
-- ============================================================

-- 1. TABLE
CREATE TABLE IF NOT EXISTS public.dispute_attachments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id    UUID NOT NULL REFERENCES public.logistics_dispute_tickets(id) ON DELETE CASCADE,
  partner_id    UUID REFERENCES public.logistics_partners(id) ON DELETE CASCADE,
  uploaded_by   UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  file_name     TEXT NOT NULL,
  file_url      TEXT NOT NULL,
  storage_path  TEXT,
  file_type     TEXT,
  file_size     BIGINT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. INDEXES
CREATE INDEX IF NOT EXISTS idx_dispute_attachments_dispute_id
  ON public.dispute_attachments(dispute_id);

CREATE INDEX IF NOT EXISTS idx_dispute_attachments_partner_id
  ON public.dispute_attachments(partner_id);

-- 3. RLS
ALTER TABLE public.dispute_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dispute_attachments_partner_insert" ON public.dispute_attachments;
CREATE POLICY "dispute_attachments_partner_insert"
  ON public.dispute_attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_own_logistics_identity(partner_id));

DROP POLICY IF EXISTS "dispute_attachments_partner_select" ON public.dispute_attachments;
CREATE POLICY "dispute_attachments_partner_select"
  ON public.dispute_attachments
  FOR SELECT
  TO authenticated
  USING (public.is_own_logistics_identity(partner_id));

DROP POLICY IF EXISTS "dispute_attachments_partner_delete" ON public.dispute_attachments;
CREATE POLICY "dispute_attachments_partner_delete"
  ON public.dispute_attachments
  FOR DELETE
  TO authenticated
  USING (public.is_own_logistics_identity(partner_id));

DROP POLICY IF EXISTS "dispute_attachments_admin_all" ON public.dispute_attachments;
CREATE POLICY "dispute_attachments_admin_all"
  ON public.dispute_attachments
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  );
