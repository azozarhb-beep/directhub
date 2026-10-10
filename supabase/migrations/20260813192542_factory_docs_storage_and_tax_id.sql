-- Add tax_id column to factory_registrations
ALTER TABLE public.factory_registrations
ADD COLUMN IF NOT EXISTS tax_id TEXT DEFAULT '';

-- Create factory-documents storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'factory-documents',
  'factory-documents',
  true,
  15728640,
  ARRAY['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']
)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for factory-documents bucket
DROP POLICY IF EXISTS "factory_docs_upload" ON storage.objects;
CREATE POLICY "factory_docs_upload"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'factory-documents' AND (storage.foldername(name))[1] = 'factory-docs');

DROP POLICY IF EXISTS "factory_docs_read" ON storage.objects;
CREATE POLICY "factory_docs_read"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'factory-documents');

DROP POLICY IF EXISTS "factory_docs_update" ON storage.objects;
CREATE POLICY "factory_docs_update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'factory-documents')
WITH CHECK (bucket_id = 'factory-documents');
