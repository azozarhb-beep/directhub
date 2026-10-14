-- ============================================================
-- Migration: Logistics customs documents + dispute evidence now reuse the
-- working chat upload flow (public `chat-media` bucket).
-- Ensures: storage_path column, table RLS for insert/select/update/delete,
-- chat-media MIME allowlist covers images + PDF, delete policy for
-- "<prefix>/<uid>/<file>" layout.
-- ============================================================

-- 1. Column used by delete operations
ALTER TABLE public.logistics_documents
  ADD COLUMN IF NOT EXISTS storage_path TEXT;

-- 2. Helper (idempotent re-create; same definition as earlier migration)
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

-- 3. logistics_documents RLS (authenticated partner insert/select/update/delete)
ALTER TABLE public.logistics_documents ENABLE ROW LEVEL SECURITY;

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

DROP POLICY IF EXISTS "authenticated_update_logistics_documents" ON public.logistics_documents;
CREATE POLICY "authenticated_update_logistics_documents"
  ON public.logistics_documents
  FOR UPDATE
  TO authenticated
  USING (public.is_own_logistics_identity(partner_id))
  WITH CHECK (public.is_own_logistics_identity(partner_id));

DROP POLICY IF EXISTS "authenticated_delete_logistics_documents" ON public.logistics_documents;
CREATE POLICY "authenticated_delete_logistics_documents"
  ON public.logistics_documents
  FOR DELETE
  TO authenticated
  USING (public.is_own_logistics_identity(partner_id));

-- 4. chat-media bucket: ensure images (incl. HEIC) + PDF accepted
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'application/pdf'
]
WHERE id = 'chat-media';

-- 5. chat-media upload/read policies (idempotent)
DROP POLICY IF EXISTS "chat_media_upload_authenticated" ON storage.objects;
CREATE POLICY "chat_media_upload_authenticated"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'chat-media');

DROP POLICY IF EXISTS "chat_media_read_public" ON storage.objects;
CREATE POLICY "chat_media_read_public"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'chat-media');

-- 6. Allow owners to delete their own files regardless of prefix depth
DROP POLICY IF EXISTS "chat_media_delete_own" ON storage.objects;
CREATE POLICY "chat_media_delete_own"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'chat-media'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR auth.uid()::text = (storage.foldername(name))[2]
      OR auth.uid()::text = (storage.foldername(name))[3]
    )
  );
