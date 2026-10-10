-- ============================================================
-- Migration: Customs Duties Calculator + Shipping Documents
-- Tables: customs_duty_calculations, shipping_documents
-- ============================================================

-- 1. customs_duty_calculations
CREATE TABLE IF NOT EXISTS public.customs_duty_calculations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  order_id            UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  hs_code             TEXT,
  product_description TEXT,
  origin_country      TEXT NOT NULL,
  destination_country TEXT NOT NULL DEFAULT 'YE',
  goods_value_usd     NUMERIC(14, 2) NOT NULL DEFAULT 0,
  freight_cost_usd    NUMERIC(14, 2) NOT NULL DEFAULT 0,
  insurance_usd       NUMERIC(14, 2) NOT NULL DEFAULT 0,
  cif_value_usd       NUMERIC(14, 2) GENERATED ALWAYS AS (goods_value_usd + freight_cost_usd + insurance_usd) STORED,
  customs_duty_rate   NUMERIC(5, 2) NOT NULL DEFAULT 0,
  customs_duty_usd    NUMERIC(14, 2),
  vat_rate            NUMERIC(5, 2) NOT NULL DEFAULT 5,
  vat_usd             NUMERIC(14, 2),
  other_fees_usd      NUMERIC(14, 2) NOT NULL DEFAULT 0,
  total_landed_cost   NUMERIC(14, 2),
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. shipping_documents
CREATE TABLE IF NOT EXISTS public.shipping_documents (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  user_id             UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  document_type       TEXT NOT NULL CHECK (document_type IN ('certificate_of_origin', 'bill_of_lading', 'packing_list', 'commercial_invoice')),
  document_number     TEXT UNIQUE,
  -- Shared fields
  exporter_name       TEXT,
  exporter_address    TEXT,
  exporter_country    TEXT,
  consignee_name      TEXT,
  consignee_address   TEXT,
  consignee_country   TEXT,
  goods_description   TEXT,
  hs_code             TEXT,
  quantity            TEXT,
  gross_weight_kg     NUMERIC(10, 3),
  net_weight_kg       NUMERIC(10, 3),
  -- Certificate of Origin specific
  origin_country      TEXT,
  origin_criterion    TEXT,
  certifying_authority TEXT,
  -- Bill of Lading specific
  vessel_name         TEXT,
  voyage_number       TEXT,
  port_of_loading     TEXT,
  port_of_discharge   TEXT,
  bl_number           TEXT,
  container_number    TEXT,
  seal_number         TEXT,
  freight_terms       TEXT CHECK (freight_terms IN ('prepaid', 'collect', 'as_arranged')),
  incoterms           TEXT,
  notify_party        TEXT,
  -- Status
  status              TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'issued', 'cancelled')),
  issued_at           TIMESTAMPTZ,
  metadata            JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_customs_duty_user_id ON public.customs_duty_calculations (user_id);
CREATE INDEX IF NOT EXISTS idx_customs_duty_order_id ON public.customs_duty_calculations (order_id);
CREATE INDEX IF NOT EXISTS idx_shipping_docs_order_id ON public.shipping_documents (order_id);
CREATE INDEX IF NOT EXISTS idx_shipping_docs_type ON public.shipping_documents (document_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shipping_docs_user_id ON public.shipping_documents (user_id);

-- 4. Updated_at trigger
CREATE OR REPLACE FUNCTION public.set_shipping_docs_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_shipping_docs_updated_at ON public.shipping_documents;
CREATE TRIGGER trg_shipping_docs_updated_at
  BEFORE UPDATE ON public.shipping_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_shipping_docs_updated_at();

-- 5. RLS
ALTER TABLE public.customs_duty_calculations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipping_documents ENABLE ROW LEVEL SECURITY;

-- customs_duty_calculations policies
DROP POLICY IF EXISTS "admin_full_customs_duty" ON public.customs_duty_calculations;
CREATE POLICY "admin_full_customs_duty" ON public.customs_duty_calculations FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "users_own_customs_duty" ON public.customs_duty_calculations;
CREATE POLICY "users_own_customs_duty" ON public.customs_duty_calculations FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- shipping_documents policies
DROP POLICY IF EXISTS "admin_full_shipping_docs" ON public.shipping_documents;
CREATE POLICY "admin_full_shipping_docs" ON public.shipping_documents FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "users_own_shipping_docs" ON public.shipping_documents;
CREATE POLICY "users_own_shipping_docs" ON public.shipping_documents FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "factory_view_order_shipping_docs" ON public.shipping_documents;
CREATE POLICY "factory_view_order_shipping_docs" ON public.shipping_documents FOR SELECT TO authenticated
  USING (
    order_id IN (SELECT id FROM public.orders WHERE factory_user_id = auth.uid())
  );
