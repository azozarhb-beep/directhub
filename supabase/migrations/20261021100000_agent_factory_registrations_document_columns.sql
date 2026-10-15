-- ============================================================
-- Fix: "Could not find the 'factory_license_filename' column of
-- 'agent_factory_registrations' in the schema cache"
-- ============================================================
-- The agent license upload page writes `${docType}_url` and
-- `${docType}_filename` for: trade_license, cr_document, factory_license.
-- Only trade_license_url / trade_license_filename / cr_document_url /
-- factory_license_url existed. This migration adds every missing
-- document URL + filename column, then reloads the PostgREST cache.
-- ============================================================

-- 1) Missing document columns
ALTER TABLE public.agent_factory_registrations
  ADD COLUMN IF NOT EXISTS trade_license_url text DEFAULT '',
  ADD COLUMN IF NOT EXISTS trade_license_filename text DEFAULT '',
  ADD COLUMN IF NOT EXISTS cr_document_url text DEFAULT '',
  ADD COLUMN IF NOT EXISTS cr_document_filename text DEFAULT '',
  ADD COLUMN IF NOT EXISTS factory_license_url text DEFAULT '',
  ADD COLUMN IF NOT EXISTS factory_license_filename text DEFAULT '',
  ADD COLUMN IF NOT EXISTS commercial_registry_url text DEFAULT '',
  ADD COLUMN IF NOT EXISTS commercial_registry_filename text DEFAULT '',
  ADD COLUMN IF NOT EXISTS industrial_license_url text DEFAULT '',
  ADD COLUMN IF NOT EXISTS industrial_license_filename text DEFAULT '';

-- 2) Storage bucket for agent-uploaded factory documents (idempotent)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'factory-documents',
  'factory-documents',
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
    'image/heif'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- 3) Storage RLS: authenticated agents can upload / update under
--    factory-docs/ (used by the license upload page) and agent-docs/{uid}/;
--    everyone with the link can read (bucket is public).
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
  )
);

DROP POLICY IF EXISTS "factory_docs_read" ON storage.objects;
CREATE POLICY "factory_docs_read"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'factory-documents');

-- 4) Reload PostgREST schema cache so the new columns are visible immediately
NOTIFY pgrst, 'reload schema';
