-- ============================================================
-- Migration: Fix document upload RLS errors
-- "new row violates row-level security policy"
-- Scope: logistics_documents table, logistics-documents bucket,
--        chat-attachments bucket (missing, referenced by code)
-- Root cause: app uploads with logistics_partners.id as the folder
--             and partner_id, but policies only accepted auth.uid().
-- Access: authenticated users only (no anonymous access)
-- ============================================================

-- 1. HELPER FUNCTIONS (before policies)

-- True when the given id is the caller's own auth uid OR the id of a
-- logistics_partners row owned by the caller.
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

-- Same check for the first folder segment of a storage object path (TEXT)
CREATE OR REPLACE FUNCTION public.is_own_storage_folder(folder_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
  SELECT folder_name IS NOT NULL AND (
    folder_name = auth.uid()::TEXT
    OR EXISTS (
      SELECT 1 FROM public.logistics_partners lp
      WHERE lp.id::TEXT = folder_name AND lp.user_id = auth.uid()
    )
  )
$func$;

-- 2. TABLE: logistics_documents (authenticated insert + select + update + delete)
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

-- 3. STORAGE BUCKETS (idempotent)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'logistics-documents',
  'logistics-documents',
  false,
  26214400,
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-attachments',
  'chat-attachments',
  true,
  26214400,
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/heic',
    'image/heif',
    'video/mp4',
    'video/quicktime',
    'video/webm'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- 4. STORAGE POLICIES: logistics-documents (authenticated only)
-- Replace folder-strict policies with ones accepting auth uid OR owned partner id
DROP POLICY IF EXISTS "partners_upload_logistics_documents" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_insert_logistics_documents_storage" ON storage.objects;
CREATE POLICY "authenticated_insert_logistics_documents_storage"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'logistics-documents'
    AND public.is_own_storage_folder((storage.foldername(name))[1])
  );

DROP POLICY IF EXISTS "partners_read_own_logistics_documents" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_select_logistics_documents_storage" ON storage.objects;
CREATE POLICY "authenticated_select_logistics_documents_storage"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'logistics-documents'
    AND public.is_own_storage_folder((storage.foldername(name))[1])
  );

DROP POLICY IF EXISTS "partners_delete_own_logistics_documents" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_delete_logistics_documents_storage" ON storage.objects;
CREATE POLICY "authenticated_delete_logistics_documents_storage"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'logistics-documents'
    AND public.is_own_storage_folder((storage.foldername(name))[1])
  );

DROP POLICY IF EXISTS "authenticated_update_logistics_documents_storage" ON storage.objects;
CREATE POLICY "authenticated_update_logistics_documents_storage"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'logistics-documents'
    AND public.is_own_storage_folder((storage.foldername(name))[1])
  )
  WITH CHECK (
    bucket_id = 'logistics-documents'
    AND public.is_own_storage_folder((storage.foldername(name))[1])
  );

-- 5. STORAGE POLICIES: chat-attachments (authenticated upload + read)
DROP POLICY IF EXISTS "authenticated_insert_chat_attachments" ON storage.objects;
CREATE POLICY "authenticated_insert_chat_attachments"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'chat-attachments');

DROP POLICY IF EXISTS "authenticated_select_chat_attachments" ON storage.objects;
CREATE POLICY "authenticated_select_chat_attachments"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'chat-attachments');

DROP POLICY IF EXISTS "authenticated_update_chat_attachments" ON storage.objects;
CREATE POLICY "authenticated_update_chat_attachments"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'chat-attachments' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'chat-attachments' AND owner = auth.uid());
