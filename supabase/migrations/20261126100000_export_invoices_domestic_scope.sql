-- export_invoices: domestic (local) scope support

ALTER TABLE public.export_invoices
  ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'export',
  ADD COLUMN IF NOT EXISTS document_kind TEXT,
  ADD COLUMN IF NOT EXISTS governorate TEXT,
  ADD COLUMN IF NOT EXISTS delivery_terms TEXT,
  ADD COLUMN IF NOT EXISTS local_payment_method TEXT,
  ADD COLUMN IF NOT EXISTS local_bank_details TEXT;

ALTER TABLE public.export_invoices DROP CONSTRAINT IF EXISTS export_invoices_incoterm_check;
ALTER TABLE public.export_invoices ALTER COLUMN incoterm DROP NOT NULL;
ALTER TABLE public.export_invoices
  ADD CONSTRAINT export_invoices_incoterm_check CHECK (incoterm IS NULL OR incoterm IN ('FOB', 'CIF'));

ALTER TABLE public.export_invoices DROP CONSTRAINT IF EXISTS export_invoices_scope_check;
ALTER TABLE public.export_invoices
  ADD CONSTRAINT export_invoices_scope_check CHECK (scope IN ('export', 'local'));

ALTER TABLE public.export_invoices DROP CONSTRAINT IF EXISTS export_invoices_currency_check;
ALTER TABLE public.export_invoices
  ADD CONSTRAINT export_invoices_currency_check CHECK (currency IN ('USD', 'YER', 'SAR'));

ALTER TABLE public.export_invoices DROP CONSTRAINT IF EXISTS export_invoices_type_check;
ALTER TABLE public.export_invoices
  ADD CONSTRAINT export_invoices_type_check CHECK (invoice_type IN ('PI', 'CI', 'DI', 'QT'));
