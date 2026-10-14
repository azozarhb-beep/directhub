-- ============================================================
-- Migration: logistics_documents RLS final cleanup
-- Ensures the authenticated partner can SELECT + INSERT their own
-- documents. Removes the legacy FOR ALL policy (partner_id = auth.uid())
-- and re-asserts the identity-aware policies.
-- ============================================================

ALTER TABLE public.logistics_documents ENABLE ROW LEVEL SECURITY;

-- Legacy policy superseded by per-command policies
DROP POLICY IF EXISTS "partners_manage_own_logistics_documents" ON public.logistics_documents;

CREATE OR REPLACE FUNCTION public.is_own_logistics_identity(identity_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
  SELECT identity_id IS NOT NULL AND (
    identity_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.logistics_partners lp
      WHERE lp.id = identity_id AND lp.user_id = auth.uid()
    )
  )
$func$;

DROP POLICY IF EXISTS "authenticated_insert_logistics_documents" ON public.logistics_documents;
CREATE POLICY "authenticated_insert_logistics_documents"
  ON public.logistics_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_own_logistics_identity(partner_id));

DROP POLICY IF EXISTS "authenticated_select_logistics_documents" ON public.logistics_documents;
CREATE POLICY "authenticated_select_logistics_documents"
  ON public.logistics_documents
  FOR SELECT
  TO authenticated
  USING (public.is_own_logistics_identity(partner_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.logistics_documents TO authenticated;

NOTIFY pgrst, 'reload schema';
