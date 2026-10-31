-- Add 'commercial_register' document type while keeping legacy 'trade_license' rows valid
ALTER TABLE public.factory_documents
  DROP CONSTRAINT IF EXISTS factory_documents_doc_type_check;
ALTER TABLE public.factory_documents
  ADD CONSTRAINT factory_documents_doc_type_check
  CHECK (doc_type IN (
    'commercial_register', 'trade_license', 'manufacturing_license', 'product_catalog',
    'company_profile', 'certificate', 'price_sheet', 'other'
  ));

NOTIFY pgrst, 'reload schema';
