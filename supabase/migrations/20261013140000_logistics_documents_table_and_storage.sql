-- ============================================================
-- Migration: Logistics Documents Table + Storage Bucket
-- Table: logistics_documents
-- Storage: logistics-documents
-- ============================================================

-- 1. CORE TABLE: logistics_documents
CREATE TABLE IF NOT EXISTS public.logistics_documents (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id       UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  shipment_id      UUID REFERENCES public.logistics_shipments(id) ON DELETE SET NULL,
  document_type    TEXT NOT NULL CHECK (document_type IN (
                     'bill_of_lading',
                     'commercial_invoice',
                     'packing_list',
                     'certificate_of_origin',
                     'customs_declaration',
                     'inspection_cert'
                   )),
  file_name        TEXT NOT NULL,
  file_url         TEXT NOT NULL,
  file_size        BIGINT NOT NULL DEFAULT 0,
  tracking_number  TEXT,
  status           TEXT NOT NULL DEFAULT 'pending_review'
                     CHECK (status IN ('pending_review', 'approved', 'rejected')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. INDEXES
CREATE INDEX IF NOT EXISTS idx_logistics_documents_partner_id
  ON public.logistics_documents (partner_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_logistics_documents_shipment_id
  ON public.logistics_documents (shipment_id);

CREATE INDEX IF NOT EXISTS idx_logistics_documents_status
  ON public.logistics_documents (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_logistics_documents_type
  ON public.logistics_documents (document_type, created_at DESC);

-- 3. ENABLE RLS
ALTER TABLE public.logistics_documents ENABLE ROW LEVEL SECURITY;

-- 4. RLS POLICIES

-- Partners: manage their own documents
DROP POLICY IF EXISTS "partners_manage_own_logistics_documents" ON public.logistics_documents;
CREATE POLICY "partners_manage_own_logistics_documents"
  ON public.logistics_documents
  FOR ALL
  TO authenticated
  USING (partner_id = auth.uid())
  WITH CHECK (partner_id = auth.uid());

-- Admins: full access to review and update status
DROP POLICY IF EXISTS "admin_full_access_logistics_documents" ON public.logistics_documents;
CREATE POLICY "admin_full_access_logistics_documents"
  ON public.logistics_documents
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

-- 5. STORAGE BUCKET: logistics-documents
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

-- 6. STORAGE RLS POLICIES

-- Partners: upload to their own folder
DROP POLICY IF EXISTS "partners_upload_logistics_documents" ON storage.objects;
CREATE POLICY "partners_upload_logistics_documents"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'logistics-documents'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

-- Partners: read their own documents
DROP POLICY IF EXISTS "partners_read_own_logistics_documents" ON storage.objects;
CREATE POLICY "partners_read_own_logistics_documents"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'logistics-documents'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

-- Partners: delete their own documents
DROP POLICY IF EXISTS "partners_delete_own_logistics_documents" ON storage.objects;
CREATE POLICY "partners_delete_own_logistics_documents"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'logistics-documents'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

-- Admins: full access to all logistics documents in storage
DROP POLICY IF EXISTS "admin_full_access_logistics_documents_storage" ON storage.objects;
CREATE POLICY "admin_full_access_logistics_documents_storage"
  ON storage.objects
  FOR ALL
  TO authenticated
  USING (
    bucket_id = 'logistics-documents'
    AND EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  )
  WITH CHECK (
    bucket_id = 'logistics-documents'
    AND EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  );
