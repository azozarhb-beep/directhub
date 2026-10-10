-- Migration: Replace Incoterms with simplified shipping type options
-- Timestamp: 20260820200000

-- Add shipping_type to custom_quotes (door_to_door | port_warehouse)
ALTER TABLE public.custom_quotes
  ADD COLUMN IF NOT EXISTS shipping_type TEXT DEFAULT NULL
    CHECK (shipping_type IN ('door_to_door', 'port_warehouse') OR shipping_type IS NULL);

-- Add factory_tax_ref (optional factory tax reference number)
ALTER TABLE public.custom_quotes
  ADD COLUMN IF NOT EXISTS factory_tax_ref TEXT DEFAULT NULL;

-- Add shipping_type to order_invoices for binding invoice line item
ALTER TABLE public.order_invoices
  ADD COLUMN IF NOT EXISTS shipping_type TEXT DEFAULT NULL
    CHECK (shipping_type IN ('door_to_door', 'port_warehouse') OR shipping_type IS NULL);

-- Ensure factory_tax_ref exists on order_invoices as well
ALTER TABLE public.order_invoices
  ADD COLUMN IF NOT EXISTS factory_tax_ref TEXT DEFAULT NULL;
