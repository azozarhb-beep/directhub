-- ============================================================
-- Migration: Logistics Proof of Delivery (POD) + wallet credit
-- ============================================================

-- 1. Allow POD document type in logistics_documents
ALTER TABLE public.logistics_documents
  DROP CONSTRAINT IF EXISTS logistics_documents_document_type_check;

ALTER TABLE public.logistics_documents
  ADD CONSTRAINT logistics_documents_document_type_check CHECK (
    document_type IN (
      'bill_of_lading',
      'commercial_invoice',
      'packing_list',
      'certificate_of_origin',
      'customs_declaration',
      'inspection_cert',
      'proof_of_delivery'
    )
  );

-- 2. Platform wallet balance for logistics partners
ALTER TABLE public.logistics_partners
  ADD COLUMN IF NOT EXISTS wallet_balance_usd NUMERIC(14, 2) NOT NULL DEFAULT 0;

-- 3. POD fields on shipments
ALTER TABLE public.logistics_shipments
  ADD COLUMN IF NOT EXISTS pod_document_url TEXT,
  ADD COLUMN IF NOT EXISTS pod_verified_at TIMESTAMPTZ;

NOTIFY pgrst, 'reload schema';
