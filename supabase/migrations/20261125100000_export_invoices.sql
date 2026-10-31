-- export_invoices: Proforma / Commercial export invoices created by manufacturers

CREATE TABLE IF NOT EXISTS public.export_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manufacturer_id UUID NOT NULL,
  invoice_type TEXT NOT NULL DEFAULT 'PI',
  invoice_number TEXT NOT NULL,
  invoice_date DATE,
  consignee_name TEXT,
  consignee_address TEXT,
  consignee_country TEXT,
  incoterm TEXT NOT NULL DEFAULT 'FOB',
  port_of_loading TEXT,
  port_of_discharge TEXT,
  payment_terms TEXT,
  currency TEXT NOT NULL DEFAULT 'USD',
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  freight NUMERIC(14,2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
  total NUMERIC(14,2) NOT NULL DEFAULT 0,
  bank_name TEXT,
  beneficiary TEXT,
  iban TEXT,
  swift_bic TEXT,
  notes TEXT,
  source_thread_id UUID,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT export_invoices_type_check CHECK (invoice_type IN ('PI', 'CI')),
  CONSTRAINT export_invoices_incoterm_check CHECK (incoterm IN ('FOB', 'CIF'))
);

CREATE INDEX IF NOT EXISTS idx_export_invoices_manufacturer_id ON public.export_invoices(manufacturer_id);
CREATE INDEX IF NOT EXISTS idx_export_invoices_created_at ON public.export_invoices(created_at DESC);

CREATE OR REPLACE FUNCTION public.touch_export_invoices_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $fn$
BEGIN
  NEW.updated_at := CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$fn$;

ALTER TABLE public.export_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "export_invoices_select_own_or_admin" ON public.export_invoices;
CREATE POLICY "export_invoices_select_own_or_admin"
  ON public.export_invoices
  FOR SELECT
  TO authenticated
  USING (manufacturer_id = auth.uid() OR public.is_admin_user());

DROP POLICY IF EXISTS "export_invoices_insert_own" ON public.export_invoices;
CREATE POLICY "export_invoices_insert_own"
  ON public.export_invoices
  FOR INSERT
  TO authenticated
  WITH CHECK (manufacturer_id = auth.uid());

DROP POLICY IF EXISTS "export_invoices_update_own" ON public.export_invoices;
CREATE POLICY "export_invoices_update_own"
  ON public.export_invoices
  FOR UPDATE
  TO authenticated
  USING (manufacturer_id = auth.uid())
  WITH CHECK (manufacturer_id = auth.uid());

DROP POLICY IF EXISTS "export_invoices_delete_own" ON public.export_invoices;
CREATE POLICY "export_invoices_delete_own"
  ON public.export_invoices
  FOR DELETE
  TO authenticated
  USING (manufacturer_id = auth.uid());

DROP TRIGGER IF EXISTS trg_touch_export_invoices_updated_at ON public.export_invoices;
CREATE TRIGGER trg_touch_export_invoices_updated_at
  BEFORE UPDATE ON public.export_invoices
  FOR EACH ROW EXECUTE FUNCTION public.touch_export_invoices_updated_at();
