-- Allow marketing/operational document types in the agent Documents uploader
DO $$
DECLARE
  con_name text;
BEGIN
  FOR con_name IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'agent_factory_documents'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%doc_type%'
  LOOP
    EXECUTE format('ALTER TABLE public.agent_factory_documents DROP CONSTRAINT %I', con_name);
  END LOOP;
END $$;

ALTER TABLE public.agent_factory_documents
  ADD CONSTRAINT agent_factory_documents_doc_type_check
  CHECK (doc_type IN (
    'license', 'registration', 'product_catalog', 'image', 'certificate', 'other',
    'company_profile', 'price_sheet'
  ));

NOTIFY pgrst, 'reload schema';
