-- Migration: Factory Products Upload System + Order Invoices
-- Timestamp: 20260810220000

-- ============================================================
-- 1. FACTORY TYPE ENUM (for local/international distinction)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'factory_type' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.factory_type AS ENUM ('local', 'international');
  END IF;
END $$;

-- ============================================================
-- 2. PAYMENT TERMS ENUM (for documentary credit / trade finance)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoice_payment_terms' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.invoice_payment_terms AS ENUM (
      'lc_at_sight',
      'lc_usance_30',
      'lc_usance_60',
      'lc_usance_90',
      'lc_usance_120',
      'tt_advance',
      'tt_30_days',
      'tt_60_days',
      'tt_90_days',
      'dp_documents_against_payment',
      'da_documents_against_acceptance',
      'open_account',
      'cash_on_delivery'
    );
  END IF;
END $$;

-- ============================================================
-- 3. INVOICE STATUS ENUM
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoice_status' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.invoice_status AS ENUM (
      'draft',
      'issued',
      'sent',
      'paid',
      'overdue',
      'cancelled'
    );
  END IF;
END $$;

-- ============================================================
-- 4. ENHANCE manufacturer_products: add factory_type + image columns
-- ============================================================
ALTER TABLE public.manufacturer_products
  ADD COLUMN IF NOT EXISTS factory_type public.factory_type DEFAULT 'local',
  ADD COLUMN IF NOT EXISTS product_images jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS certifications jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS hs_code text DEFAULT '',
  ADD COLUMN IF NOT EXISTS lead_time_days integer DEFAULT 14,
  ADD COLUMN IF NOT EXISTS sample_available boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS sample_price numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tags jsonb DEFAULT '[]'::jsonb;

-- ============================================================
-- 5. FACTORY REGISTRATIONS TABLE (local factories get priority)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.factory_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  company_name text NOT NULL DEFAULT '',
  factory_type public.factory_type NOT NULL DEFAULT 'local',
  -- Local factory fields
  commercial_registration_number text DEFAULT '',
  vat_number text DEFAULT '',
  city text DEFAULT '',
  region text DEFAULT '',
  country text NOT NULL DEFAULT 'Saudi Arabia',
  address text DEFAULT '',
  -- Contact
  contact_person text DEFAULT '',
  contact_phone text DEFAULT '',
  contact_email text DEFAULT '',
  website text DEFAULT '',
  -- Factory details
  established_year integer,
  employee_count text DEFAULT '',
  annual_capacity text DEFAULT '',
  main_products jsonb DEFAULT '[]'::jsonb,
  certifications jsonb DEFAULT '[]'::jsonb,
  -- Documents
  cr_document_url text DEFAULT '',
  factory_license_url text DEFAULT '',
  iso_certificate_url text DEFAULT '',
  -- Status
  is_approved boolean DEFAULT false,
  is_active boolean DEFAULT true,
  approval_note text DEFAULT '',
  approved_at timestamptz,
  -- Priority score: local factories get higher priority
  priority_score integer DEFAULT 0,
  created_at timestamptz DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 6. ORDER INVOICES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.order_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL UNIQUE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  -- Parties
  seller_name text NOT NULL DEFAULT '',
  seller_address text DEFAULT '',
  seller_vat text DEFAULT '',
  seller_cr text DEFAULT '',
  seller_bank_name text DEFAULT '',
  seller_bank_iban text DEFAULT '',
  seller_bank_swift text DEFAULT '',
  buyer_name text NOT NULL DEFAULT '',
  buyer_address text DEFAULT '',
  buyer_vat text DEFAULT '',
  buyer_company text DEFAULT '',
  buyer_country text DEFAULT '',
  -- Trade details
  payment_terms public.invoice_payment_terms DEFAULT 'tt_advance',
  incoterms text DEFAULT 'FOB',
  port_of_loading text DEFAULT '',
  port_of_discharge text DEFAULT '',
  country_of_origin text DEFAULT '',
  -- Documentary credit (L/C) fields
  lc_number text DEFAULT '',
  lc_issuing_bank text DEFAULT '',
  lc_expiry_date date,
  lc_amount numeric DEFAULT 0,
  lc_currency text DEFAULT 'USD',
  -- Invoice items (JSONB array)
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Financials
  currency text DEFAULT 'USD',
  subtotal numeric DEFAULT 0,
  discount_amount numeric DEFAULT 0,
  tax_rate numeric DEFAULT 15,
  tax_amount numeric DEFAULT 0,
  shipping_cost numeric DEFAULT 0,
  total numeric DEFAULT 0,
  -- Compliance
  hs_codes jsonb DEFAULT '[]'::jsonb,
  country_of_origin_declaration text DEFAULT '',
  customs_declaration text DEFAULT '',
  -- Dates
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  -- Status
  status public.invoice_status DEFAULT 'draft',
  notes text DEFAULT '',
  -- Ownership
  created_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 7. INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_factory_registrations_user_id ON public.factory_registrations(user_id);
CREATE INDEX IF NOT EXISTS idx_factory_registrations_factory_type ON public.factory_registrations(factory_type);
CREATE INDEX IF NOT EXISTS idx_factory_registrations_priority ON public.factory_registrations(priority_score DESC);
CREATE INDEX IF NOT EXISTS idx_factory_registrations_country ON public.factory_registrations(country);
CREATE INDEX IF NOT EXISTS idx_order_invoices_order_id ON public.order_invoices(order_id);
CREATE INDEX IF NOT EXISTS idx_order_invoices_created_by ON public.order_invoices(created_by);
CREATE INDEX IF NOT EXISTS idx_order_invoices_status ON public.order_invoices(status);
CREATE INDEX IF NOT EXISTS idx_manufacturer_products_factory_type ON public.manufacturer_products(factory_type);

-- ============================================================
-- 8. FUNCTION: Auto-set priority score for local factories
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_factory_priority()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.factory_type = 'local' THEN
    NEW.priority_score := 100;
  ELSE
    NEW.priority_score := 50;
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================
-- 9. FUNCTION: Generate invoice number
-- ============================================================
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  seq_num integer;
  inv_number text;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM 'INV-(\d+)') AS integer)), 0) + 1
  INTO seq_num
  FROM public.order_invoices;
  inv_number := 'INV-' || LPAD(seq_num::text, 6, '0');
  RETURN inv_number;
END;
$$;

-- ============================================================
-- 10. FUNCTION: Update updated_at timestamp
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_factory_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

-- ============================================================
-- 11. ENABLE RLS
-- ============================================================
ALTER TABLE public.factory_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_invoices ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 12. RLS POLICIES - factory_registrations
-- ============================================================
DROP POLICY IF EXISTS "users_manage_own_factory_registrations" ON public.factory_registrations;
CREATE POLICY "users_manage_own_factory_registrations"
ON public.factory_registrations
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "public_read_approved_factories" ON public.factory_registrations;
CREATE POLICY "public_read_approved_factories"
ON public.factory_registrations
FOR SELECT
TO public
USING (is_approved = true AND is_active = true);

-- Admin full access
DROP POLICY IF EXISTS "admin_manage_factory_registrations" ON public.factory_registrations;
CREATE POLICY "admin_manage_factory_registrations"
ON public.factory_registrations
FOR ALL
TO authenticated
USING (
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
)
WITH CHECK (
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);

-- ============================================================
-- 13. RLS POLICIES - order_invoices
-- ============================================================
DROP POLICY IF EXISTS "users_manage_own_invoices" ON public.order_invoices;
CREATE POLICY "users_manage_own_invoices"
ON public.order_invoices
FOR ALL
TO authenticated
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "admin_manage_all_invoices" ON public.order_invoices;
CREATE POLICY "admin_manage_all_invoices"
ON public.order_invoices
FOR ALL
TO authenticated
USING (
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
)
WITH CHECK (
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);

-- ============================================================
-- 14. TRIGGERS
-- ============================================================
DROP TRIGGER IF EXISTS set_factory_priority_trigger ON public.factory_registrations;
CREATE TRIGGER set_factory_priority_trigger
BEFORE INSERT OR UPDATE ON public.factory_registrations
FOR EACH ROW EXECUTE FUNCTION public.set_factory_priority();

DROP TRIGGER IF EXISTS update_factory_registrations_updated_at ON public.factory_registrations;
CREATE TRIGGER update_factory_registrations_updated_at
BEFORE UPDATE ON public.factory_registrations
FOR EACH ROW EXECUTE FUNCTION public.update_factory_updated_at();

DROP TRIGGER IF EXISTS update_order_invoices_updated_at ON public.order_invoices;
CREATE TRIGGER update_order_invoices_updated_at
BEFORE UPDATE ON public.order_invoices
FOR EACH ROW EXECUTE FUNCTION public.update_factory_updated_at();
