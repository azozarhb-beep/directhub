-- Factory self-service document uploads (auto-linked to the logged-in factory via factory_id = auth.uid())

CREATE TABLE IF NOT EXISTS public.factory_documents (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_id          UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  doc_type            TEXT NOT NULL DEFAULT 'other',
  file_url            TEXT NOT NULL DEFAULT '',
  file_name           TEXT NOT NULL DEFAULT '',
  file_size           BIGINT DEFAULT 0,
  mime_type           TEXT DEFAULT '',
  description         TEXT DEFAULT '',
  cert_sub_type       TEXT,
  cert_number         TEXT,
  cert_expiry         DATE,
  issuing_body        TEXT,
  verification_status TEXT DEFAULT 'pending',
  reject_reason       TEXT,
  verified_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.factory_documents
  DROP CONSTRAINT IF EXISTS factory_documents_doc_type_check;
ALTER TABLE public.factory_documents
  ADD CONSTRAINT factory_documents_doc_type_check
  CHECK (doc_type IN (
    'trade_license', 'manufacturing_license', 'product_catalog',
    'company_profile', 'certificate', 'price_sheet', 'other'
  ));

CREATE INDEX IF NOT EXISTS idx_factory_documents_factory_id
  ON public.factory_documents(factory_id);
CREATE INDEX IF NOT EXISTS idx_factory_documents_doc_type
  ON public.factory_documents(factory_id, doc_type);

ALTER TABLE public.factory_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "factory_documents_owner_all" ON public.factory_documents;
CREATE POLICY "factory_documents_owner_all"
  ON public.factory_documents
  FOR ALL
  TO authenticated
  USING (factory_id = auth.uid() OR public.is_admin_user())
  WITH CHECK (factory_id = auth.uid() OR public.is_admin_user());

NOTIFY pgrst, 'reload schema';
