-- Migration: Commercial Enterprise Cash Invoices & Incoterms Engine
-- Timestamp: 20260925220000
-- Adds commercial_enterprise_cash invoice type, full Incoterms support,
-- HS codes per line item, and escrow green-light linkage to order_invoices

-- ============================================================
-- 1. EXTEND order_invoices TABLE
-- ============================================================

-- Invoice type: standard | commercial_enterprise_cash
ALTER TABLE public.order_invoices
  ADD COLUMN IF NOT EXISTS invoice_type TEXT DEFAULT 'standard' CHECK (
    invoice_type IN ('standard', 'commercial_enterprise_cash')
  ),

  -- Incoterms (full set)
  ADD COLUMN IF NOT EXISTS incoterms_code TEXT DEFAULT NULL CHECK (
    incoterms_code IN ('EXW', 'FCA', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP', 'FAS', 'FOB', 'CFR', 'CIF') OR incoterms_code IS NULL
  ),
  ADD COLUMN IF NOT EXISTS port_of_loading TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS port_of_discharge TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS country_of_origin TEXT DEFAULT NULL,

  -- Escrow linkage
  ADD COLUMN IF NOT EXISTS escrow_order_id UUID DEFAULT NULL REFERENCES public.orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS escrow_confirmed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS escrow_confirmed_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS escrow_green_light_issued BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS escrow_green_light_at TIMESTAMPTZ DEFAULT NULL,

  -- Commercial invoice fields
  ADD COLUMN IF NOT EXISTS commercial_invoice_ref TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS packing_list_ref TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS bl_number TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS vessel_name TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS container_number TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS gross_weight_kg NUMERIC(12,3) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS net_weight_kg NUMERIC(12,3) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS total_packages INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS package_type TEXT DEFAULT NULL,

  -- Seller customs / export details
  ADD COLUMN IF NOT EXISTS seller_export_license TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS seller_customs_code TEXT DEFAULT NULL,

  -- Buyer import details
  ADD COLUMN IF NOT EXISTS buyer_import_license TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS buyer_customs_code TEXT DEFAULT NULL,

  -- Insurance
  ADD COLUMN IF NOT EXISTS insurance_company TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS insurance_policy_number TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS insurance_amount NUMERIC(14,2) DEFAULT NULL;

-- ============================================================
-- 2. ADD HS CODE & ORIGIN FIELDS TO INVOICE ITEMS (JSONB)
-- The items column is already JSONB; this migration documents
-- the expected shape. No schema change needed for JSONB columns.
-- We add a helper comment for clarity.
-- ============================================================
-- Expected item shape in order_invoices.items JSONB array:
-- {
--   "description": "...",
--   "hs_code": "8471.30",          -- Harmonized System code
--   "quantity": 100,
--   "unit": "PCS",
--   "unit_price": 25.00,
--   "total": 2500.00,
--   "country_of_origin": "CN",     -- ISO 2-letter country code
--   "net_weight_kg": 0.5,
--   "gross_weight_kg": 0.6
-- }

-- ============================================================
-- 3. INDEXES FOR PERFORMANCE
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_order_invoices_invoice_type
  ON public.order_invoices(invoice_type);

CREATE INDEX IF NOT EXISTS idx_order_invoices_escrow_order_id
  ON public.order_invoices(escrow_order_id);

CREATE INDEX IF NOT EXISTS idx_order_invoices_escrow_confirmed
  ON public.order_invoices(escrow_confirmed);

CREATE INDEX IF NOT EXISTS idx_order_invoices_incoterms_code
  ON public.order_invoices(incoterms_code);

-- ============================================================
-- 4. FUNCTION: issue_commercial_invoice_green_light
-- Called when escrow deposit is confirmed — marks the invoice
-- as green-lit so the factory can begin packing/shipping.
-- ============================================================
CREATE OR REPLACE FUNCTION public.issue_commercial_invoice_green_light(
  p_invoice_id UUID,
  p_order_id   UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.order_invoices
  SET
    escrow_confirmed          = true,
    escrow_confirmed_at       = NOW(),
    escrow_green_light_issued = true,
    escrow_green_light_at     = NOW(),
    escrow_order_id           = p_order_id,
    status                    = 'issued'
  WHERE id = p_invoice_id;
END;
$$;

-- ============================================================
-- 5. RLS — ensure existing policies cover new columns
-- (order_invoices already has RLS; no new tables added)
-- ============================================================
