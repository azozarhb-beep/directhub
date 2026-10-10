-- Migration: Add Incoterms fields to custom_quotes
-- Timestamp: 20260820190000

-- Add incoterm and port_of_loading to custom_quotes
ALTER TABLE public.custom_quotes
  ADD COLUMN IF NOT EXISTS incoterm TEXT DEFAULT NULL CHECK (incoterm IN ('EXW', 'FOB') OR incoterm IS NULL),
  ADD COLUMN IF NOT EXISTS port_of_loading TEXT DEFAULT NULL;

-- Add incoterm columns to order_invoices if not already present (for clarity)
ALTER TABLE public.order_invoices
  ADD COLUMN IF NOT EXISTS factory_tax_ref TEXT DEFAULT NULL;
