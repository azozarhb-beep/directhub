-- Migration: RFQ Management, Enhanced Order Tracking, Analytics Export
-- Timestamp: 20260815900000

-- ── 1. Add production tracking columns to orders ──────────────────────────────
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS production_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS production_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS quality_check_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS tracking_number TEXT,
  ADD COLUMN IF NOT EXISTS shipping_carrier TEXT,
  ADD COLUMN IF NOT EXISTS warranty_status TEXT DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS warranty_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS warranty_notes TEXT,
  ADD COLUMN IF NOT EXISTS production_notes TEXT;

-- ── 2. Add sample_available to rfq_responses if not exists ───────────────────
ALTER TABLE public.rfq_responses
  ADD COLUMN IF NOT EXISTS sample_available BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS warranty_months INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_terms TEXT,
  ADD COLUMN IF NOT EXISTS total_price NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS is_accepted BOOLEAN DEFAULT false;

-- ── 3. Add factory_id to rfq_requests for better filtering ───────────────────
ALTER TABLE public.rfq_requests
  ADD COLUMN IF NOT EXISTS factory_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS urgency TEXT DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS incoterms TEXT,
  ADD COLUMN IF NOT EXISTS payment_terms TEXT;

-- ── 4. Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_orders_production_started ON public.orders(production_started_at);
CREATE INDEX IF NOT EXISTS idx_orders_warranty_status ON public.orders(warranty_status);
CREATE INDEX IF NOT EXISTS idx_rfq_responses_rfq_id ON public.rfq_responses(rfq_id);
CREATE INDEX IF NOT EXISTS idx_rfq_responses_manufacturer ON public.rfq_responses(manufacturer_id);
CREATE INDEX IF NOT EXISTS idx_rfq_requests_factory_id ON public.rfq_requests(factory_id);

-- ── 5. RLS for new columns (tables already have RLS enabled) ─────────────────
-- No new tables, existing RLS policies cover the new columns
