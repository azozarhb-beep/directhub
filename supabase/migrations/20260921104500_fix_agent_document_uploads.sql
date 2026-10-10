-- ============================================================
-- Fix: Field Representative (agent) document & media uploads
-- ============================================================
-- Root cause: factory-documents INSERT policy only allowed paths
-- under "factory-docs/...", but agent UI uploads under "agent-docs/...".
-- That produced: "new row violates row-level security policy".
--
-- Also expands allowed MIME types and ensures UPDATE works for
-- upsert:true on license uploads.
-- ============================================================

-- 1) Allow common document / image MIME types agents actually send
UPDATE storage.buckets
SET
  allowed_mime_types = ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/heic',
    'image/heif'
  ],
  file_size_limit = 26214400  -- 25MB (matches agent chat UI limit)
WHERE id = 'factory-documents';

-- 2) INSERT: factory-docs (existing) OR agent-docs/{auth.uid}/...
DROP POLICY IF EXISTS "factory_docs_upload" ON storage.objects;
CREATE POLICY "factory_docs_upload"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'factory-documents'
  AND (
    (storage.foldername(name))[1] = 'factory-docs'
    OR (
      (storage.foldername(name))[1] = 'agent-docs'
      AND (storage.foldername(name))[2] = auth.uid()::text
    )
  )
);

-- 3) UPDATE: same path rules (required for upsert:true on license upload)
DROP POLICY IF EXISTS "factory_docs_update" ON storage.objects;
CREATE POLICY "factory_docs_update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'factory-documents'
  AND (
    (storage.foldername(name))[1] = 'factory-docs'
    OR (
      (storage.foldername(name))[1] = 'agent-docs'
      AND (storage.foldername(name))[2] = auth.uid()::text
    )
    OR public.is_admin_user()
  )
)
WITH CHECK (
  bucket_id = 'factory-documents'
  AND (
    (storage.foldername(name))[1] = 'factory-docs'
    OR (
      (storage.foldername(name))[1] = 'agent-docs'
      AND (storage.foldername(name))[2] = auth.uid()::text
    )
    OR public.is_admin_user()
  )
);

-- 4) chat-media: ensure agent chat prefixes can UPDATE/DELETE own files
--    Paths: agent-chat/{uid}/..., agent-admin-chat/{uid}/...
DROP POLICY IF EXISTS "chat_media_update_own" ON storage.objects;
CREATE POLICY "chat_media_update_own"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'chat-media'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR (
      (storage.foldername(name))[1] = 'profiles'
      AND auth.uid()::text = (storage.foldername(name))[2]
    )
    OR (
      (storage.foldername(name))[1] IN ('agent-chat', 'agent-admin-chat')
      AND auth.uid()::text = (storage.foldername(name))[2]
    )
  )
)
WITH CHECK (
  bucket_id = 'chat-media'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR (
      (storage.foldername(name))[1] = 'profiles'
      AND auth.uid()::text = (storage.foldername(name))[2]
    )
    OR (
      (storage.foldername(name))[1] IN ('agent-chat', 'agent-admin-chat')
      AND auth.uid()::text = (storage.foldername(name))[2]
    )
  )
);

DROP POLICY IF EXISTS "chat_media_delete_own" ON storage.objects;
CREATE POLICY "chat_media_delete_own"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'chat-media'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR (
      (storage.foldername(name))[1] = 'profiles'
      AND auth.uid()::text = (storage.foldername(name))[2]
    )
    OR (
      (storage.foldername(name))[1] IN ('agent-chat', 'agent-admin-chat')
      AND auth.uid()::text = (storage.foldername(name))[2]
    )
  )
);

-- Keep INSERT open to authenticated (already working for agent chat)
DROP POLICY IF EXISTS "chat_media_upload_authenticated" ON storage.objects;
CREATE POLICY "chat_media_upload_authenticated"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'chat-media');
