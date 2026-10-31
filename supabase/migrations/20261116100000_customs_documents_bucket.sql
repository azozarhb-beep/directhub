-- ============================================================
-- Migration: customs_documents storage bucket (private)
-- Path convention: {auth.uid()}/{order_id}/{doc_type}-{timestamp}.{ext}
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'customs_documents',
  'customs_documents',
  false,
  26214400,
  ARRAY['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "customs_docs_owner_insert" ON storage.objects;
CREATE POLICY "customs_docs_owner_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'customs_documents'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

DROP POLICY IF EXISTS "customs_docs_owner_select" ON storage.objects;
CREATE POLICY "customs_docs_owner_select"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'customs_documents'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

DROP POLICY IF EXISTS "customs_docs_owner_update" ON storage.objects;
CREATE POLICY "customs_docs_owner_update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'customs_documents'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  )
  WITH CHECK (
    bucket_id = 'customs_documents'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

DROP POLICY IF EXISTS "customs_docs_owner_delete" ON storage.objects;
CREATE POLICY "customs_docs_owner_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'customs_documents'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

DROP POLICY IF EXISTS "customs_docs_admin_all" ON storage.objects;
CREATE POLICY "customs_docs_admin_all"
  ON storage.objects
  FOR ALL
  TO authenticated
  USING (
    bucket_id = 'customs_documents'
    AND EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  )
  WITH CHECK (
    bucket_id = 'customs_documents'
    AND EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  );
