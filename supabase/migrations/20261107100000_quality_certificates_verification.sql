-- Quality & Compliance certificates: sub-type, metadata and verification workflow
-- NOTE: the document table in this project is public.agent_factory_documents

ALTER TABLE public.agent_factory_documents
  ADD COLUMN IF NOT EXISTS cert_sub_type text,
  ADD COLUMN IF NOT EXISTS cert_number text,
  ADD COLUMN IF NOT EXISTS cert_expiry date,
  ADD COLUMN IF NOT EXISTS issuing_body text,
  ADD COLUMN IF NOT EXISTS verification_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS reject_reason text,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz;

-- Optional compatibility if a table named factory_documents exists in another environment
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'factory_documents'
  ) THEN
    ALTER TABLE public.factory_documents
      ADD COLUMN IF NOT EXISTS cert_sub_type text,
      ADD COLUMN IF NOT EXISTS cert_number text,
      ADD COLUMN IF NOT EXISTS cert_expiry date,
      ADD COLUMN IF NOT EXISTS verification_status text DEFAULT 'pending';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_agent_factory_docs_cert_status
  ON public.agent_factory_documents(factory_reg_id, verification_status)
  WHERE doc_type = 'certificate';

-- Public-safe lookup: does a factory (by registration id, owner user id, or company name)
-- have at least one approved quality certificate?
CREATE OR REPLACE FUNCTION public.factory_has_verified_certificate(p_factory_ref uuid, p_company_name text DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
  SELECT EXISTS (
    SELECT 1
    FROM public.agent_factory_documents d
    JOIN public.agent_factory_registrations r ON r.id = d.factory_reg_id
    WHERE d.doc_type = 'certificate'
      AND d.verification_status = 'approved'
      AND (
        r.id = p_factory_ref
        OR (p_company_name IS NOT NULL AND length(trim(p_company_name)) > 0
            AND lower(trim(r.company_name)) = lower(trim(p_company_name)))
      )
  );
$func$;

GRANT EXECUTE ON FUNCTION public.factory_has_verified_certificate(uuid, text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
