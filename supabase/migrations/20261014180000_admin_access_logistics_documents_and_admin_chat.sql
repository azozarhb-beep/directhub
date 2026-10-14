-- ============================================================
-- Migration: Admin live access to logistics_documents + admin support chat
-- Admin dashboard must be able to SELECT / UPDATE partner documents
-- (customs auditor) and read admin_messages attachments (chat monitor).
-- ============================================================

-- 1. Admin full access on logistics_documents (idempotent)
DROP POLICY IF EXISTS "admin_full_access_logistics_documents" ON public.logistics_documents;
CREATE POLICY "admin_full_access_logistics_documents"
  ON public.logistics_documents
  FOR ALL
  TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.logistics_documents TO authenticated;

-- 2. Realtime for logistics_documents (admin counters update live)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'logistics_documents'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.logistics_documents;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
