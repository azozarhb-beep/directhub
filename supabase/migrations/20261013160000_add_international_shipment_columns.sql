-- ============================================================
-- Migration: Add international shipment columns
-- Adds transport_type, etd, bl_number, route_origin_port,
-- route_destination_port, and document_url to logistics_shipments
-- ============================================================

ALTER TABLE public.logistics_shipments
  ADD COLUMN IF NOT EXISTS transport_type TEXT DEFAULT 'sea_fcl',
  ADD COLUMN IF NOT EXISTS bl_number TEXT,
  ADD COLUMN IF NOT EXISTS route_origin_port TEXT,
  ADD COLUMN IF NOT EXISTS route_destination_port TEXT,
  ADD COLUMN IF NOT EXISTS etd TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS document_url TEXT;

-- Index on bl_number for fast lookup
CREATE INDEX IF NOT EXISTS idx_logistics_shipments_bl_number
  ON public.logistics_shipments (bl_number);
