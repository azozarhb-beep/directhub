-- ============================================================
-- Migration: Company licensing & KYC document types for logistics partners
-- Separates company credentials from shipment customs documents
-- ============================================================

ALTER TABLE public.logistics_documents
  DROP CONSTRAINT IF EXISTS logistics_documents_document_type_check;

ALTER TABLE public.logistics_documents
  ADD CONSTRAINT logistics_documents_document_type_check
  CHECK (document_type IN (
    'bill_of_lading',
    'commercial_invoice',
    'packing_list',
    'certificate_of_origin',
    'customs_declaration',
    'inspection_cert',
    'master_bill_of_lading',
    'delivery_order',
    'proof_of_delivery',
    'company_commercial_registration',
    'company_transport_license',
    'company_insurance_policy',
    'company_tax_certificate',
    'company_chamber_certificate',
    'company_authorized_signatory_id'
  ));

ALTER TABLE public.logistics_documents
  DROP CONSTRAINT IF EXISTS logistics_documents_status_check;

ALTER TABLE public.logistics_documents
  ADD CONSTRAINT logistics_documents_status_check
  CHECK (status IN ('pending_review', 'approved', 'rejected', 'expired'));

ALTER TABLE public.logistics_documents
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
