-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Logistics Disputes & Delay Management
-- Timestamp: 20261013260000
-- Tables: logistics_operational_delays, logistics_dispute_tickets
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. ENUM TYPES ─────────────────────────────────────────────────────────────

DROP TYPE IF EXISTS public.delay_reason_type CASCADE;
CREATE TYPE public.delay_reason_type AS ENUM (
  'customs',
  'checkpoint',
  'mechanical',
  'road_conditions',
  'weather',
  'port_congestion',
  'other'
);

DROP TYPE IF EXISTS public.dispute_reason_type CASCADE;
CREATE TYPE public.dispute_reason_type AS ENUM (
  'cargo_damage',
  'weight_shortage',
  'pricing_dispute',
  'unjustified_delay',
  'missing_items',
  'other'
);

DROP TYPE IF EXISTS public.dispute_status_type CASCADE;
CREATE TYPE public.dispute_status_type AS ENUM (
  'open',
  'under_review',
  'resolved_full_release',
  'resolved_partial_deduction',
  'resolved_full_refund',
  'closed'
);

DROP TYPE IF EXISTS public.dispute_opened_by_type CASCADE;
CREATE TYPE public.dispute_opened_by_type AS ENUM (
  'logistics_partner',
  'buyer',
  'admin'
);

-- ── 2. TABLES ─────────────────────────────────────────────────────────────────

-- Operational Delay Reports
CREATE TABLE IF NOT EXISTS public.logistics_operational_delays (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id           UUID REFERENCES public.logistics_shipments(id) ON DELETE CASCADE,
  order_id              UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  partner_id            UUID REFERENCES public.logistics_partners(id) ON DELETE CASCADE,
  reported_by           UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  delay_reason          public.delay_reason_type NOT NULL,
  delay_reason_other    TEXT,
  description           TEXT,
  proof_url             TEXT,
  proof_filename        TEXT,
  original_eta          TIMESTAMPTZ,
  updated_eta           TIMESTAMPTZ,
  customer_notified     BOOLEAN DEFAULT FALSE,
  customer_notified_at  TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- Dispute Tickets
CREATE TABLE IF NOT EXISTS public.logistics_dispute_tickets (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id             UUID REFERENCES public.logistics_shipments(id) ON DELETE SET NULL,
  order_id                UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  partner_id              UUID REFERENCES public.logistics_partners(id) ON DELETE CASCADE,
  buyer_id                UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  opened_by               public.dispute_opened_by_type NOT NULL,
  opened_by_user_id       UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  dispute_reason          public.dispute_reason_type NOT NULL,
  dispute_reason_other    TEXT,
  description             TEXT NOT NULL,
  evidence_url            TEXT,
  evidence_filename       TEXT,
  disputed_amount         NUMERIC(12, 2),
  currency                TEXT DEFAULT 'USD',
  escrow_frozen           BOOLEAN DEFAULT TRUE,
  escrow_frozen_at        TIMESTAMPTZ DEFAULT NOW(),
  status                  public.dispute_status_type DEFAULT 'open',
  admin_resolution_note   TEXT,
  resolved_by             UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  resolved_at             TIMESTAMPTZ,
  release_amount          NUMERIC(12, 2),
  refund_amount           NUMERIC(12, 2),
  deduction_amount        NUMERIC(12, 2),
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- ── 3. INDEXES ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_logistics_delays_partner_id
  ON public.logistics_operational_delays(partner_id);

CREATE INDEX IF NOT EXISTS idx_logistics_delays_shipment_id
  ON public.logistics_operational_delays(shipment_id);

CREATE INDEX IF NOT EXISTS idx_logistics_delays_order_id
  ON public.logistics_operational_delays(order_id);

CREATE INDEX IF NOT EXISTS idx_logistics_disputes_partner_id
  ON public.logistics_dispute_tickets(partner_id);

CREATE INDEX IF NOT EXISTS idx_logistics_disputes_order_id
  ON public.logistics_dispute_tickets(order_id);

CREATE INDEX IF NOT EXISTS idx_logistics_disputes_status
  ON public.logistics_dispute_tickets(status);

CREATE INDEX IF NOT EXISTS idx_logistics_disputes_opened_by_user
  ON public.logistics_dispute_tickets(opened_by_user_id);

-- ── 4. ENABLE RLS ─────────────────────────────────────────────────────────────

ALTER TABLE public.logistics_operational_delays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logistics_dispute_tickets ENABLE ROW LEVEL SECURITY;

-- ── 5. RLS POLICIES — logistics_operational_delays ────────────────────────────

DROP POLICY IF EXISTS "logistics_delays_partner_manage" ON public.logistics_operational_delays;
CREATE POLICY "logistics_delays_partner_manage"
ON public.logistics_operational_delays
FOR ALL
TO authenticated
USING (partner_id IN (
  SELECT id FROM public.logistics_partners WHERE user_id = auth.uid()
))
WITH CHECK (partner_id IN (
  SELECT id FROM public.logistics_partners WHERE user_id = auth.uid()
));

DROP POLICY IF EXISTS "logistics_delays_admin_all" ON public.logistics_operational_delays;
CREATE POLICY "logistics_delays_admin_all"
ON public.logistics_operational_delays
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

DROP POLICY IF EXISTS "logistics_delays_buyer_read" ON public.logistics_operational_delays;
CREATE POLICY "logistics_delays_buyer_read"
ON public.logistics_operational_delays
FOR SELECT
TO authenticated
USING (
  order_id IN (
    SELECT id FROM public.orders WHERE user_id = auth.uid()
  )
);

-- ── 6. RLS POLICIES — logistics_dispute_tickets ───────────────────────────────

DROP POLICY IF EXISTS "logistics_disputes_partner_manage" ON public.logistics_dispute_tickets;
CREATE POLICY "logistics_disputes_partner_manage"
ON public.logistics_dispute_tickets
FOR ALL
TO authenticated
USING (partner_id IN (
  SELECT id FROM public.logistics_partners WHERE user_id = auth.uid()
))
WITH CHECK (partner_id IN (
  SELECT id FROM public.logistics_partners WHERE user_id = auth.uid()
));

DROP POLICY IF EXISTS "logistics_disputes_buyer_manage" ON public.logistics_dispute_tickets;
CREATE POLICY "logistics_disputes_buyer_manage"
ON public.logistics_dispute_tickets
FOR ALL
TO authenticated
USING (buyer_id = auth.uid())
WITH CHECK (buyer_id = auth.uid());

DROP POLICY IF EXISTS "logistics_disputes_admin_all" ON public.logistics_dispute_tickets;
CREATE POLICY "logistics_disputes_admin_all"
ON public.logistics_dispute_tickets
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- ── 7. REALTIME ───────────────────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE public.logistics_operational_delays;
ALTER PUBLICATION supabase_realtime ADD TABLE public.logistics_dispute_tickets;
