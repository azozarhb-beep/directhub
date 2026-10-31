-- Field agent refinements:
-- 1) Extra document types for agent factory documents
-- 2) Inspection checklist columns + allow agents to open on-site inspections

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
    'company_profile', 'price_sheet',
    'commercial_license', 'tax_certificate', 'inspection_report'
  ));

ALTER TABLE public.agent_factory_documents
  ADD COLUMN IF NOT EXISTS cert_expiry date;

ALTER TABLE public.field_inspection_tasks
  ADD COLUMN IF NOT EXISTS po_number text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS check_quantity_match boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS check_packaging_ok boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS check_dates_ok boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_walk_in boolean NOT NULL DEFAULT false;

DROP POLICY IF EXISTS "agents_insert_walk_in_inspection_tasks" ON public.field_inspection_tasks;
CREATE POLICY "agents_insert_walk_in_inspection_tasks"
ON public.field_inspection_tasks
FOR INSERT
TO authenticated
WITH CHECK (assigned_agent_id = auth.uid() AND created_by = auth.uid());

NOTIFY pgrst, 'reload schema';
