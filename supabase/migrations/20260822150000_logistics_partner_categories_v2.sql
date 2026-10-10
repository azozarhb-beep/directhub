-- ═══════════════════════════════════════════════════════════════════════════
-- LOGISTICS PARTNER CATEGORIES V2 — Explicit 3-Category System
-- Migration: 20260822150000_logistics_partner_categories_v2.sql
-- Adds: international_shipping_office, local_shipping_distribution
-- Adds: operating_hub field, local_coverage_country field
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. EXTEND ENUM WITH NEW EXPLICIT CATEGORIES ───────────────────────────────
-- Add new values to existing enum (safe, non-destructive)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'international_shipping_office'
    AND enumtypid = 'public.logistics_partner_type'::regtype
  ) THEN
    ALTER TYPE public.logistics_partner_type ADD VALUE 'international_shipping_office';
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'local_shipping_distribution'
    AND enumtypid = 'public.logistics_partner_type'::regtype
  ) THEN
    ALTER TYPE public.logistics_partner_type ADD VALUE 'local_shipping_distribution';
  END IF;
END$$;

-- ── 2. ADD NEW FIELDS TO logistics_partners ───────────────────────────────────
-- operating_hub: for international offices — the industrial hub/city they operate from (e.g. Guangzhou, Yiwu)
ALTER TABLE public.logistics_partners
  ADD COLUMN IF NOT EXISTS operating_hub TEXT;

-- local_coverage_country: for local distribution companies — the single country they serve
ALTER TABLE public.logistics_partners
  ADD COLUMN IF NOT EXISTS local_coverage_country TEXT;

-- operational_ports: specific ports/airports this partner handles
ALTER TABLE public.logistics_partners
  ADD COLUMN IF NOT EXISTS operational_ports TEXT[] DEFAULT ARRAY[]::TEXT[];

-- partner_category_group: quick grouping field ('international' | 'local' | 'customs')
ALTER TABLE public.logistics_partners
  ADD COLUMN IF NOT EXISTS partner_category_group TEXT;

-- ── 3. BACKFILL category_group FOR EXISTING RECORDS ──────────────────────────
-- NOTE: Cast partner_type to TEXT to safely compare against new enum values
-- that may not yet be committed in the current session.
UPDATE public.logistics_partners
SET partner_category_group = CASE
  WHEN partner_type::TEXT IN ('international_shipping_office', 'freight_forwarder') THEN 'international'
  WHEN partner_type::TEXT IN ('local_shipping_distribution', 'logistics_company', 'shipping_office') THEN 'local'
  WHEN partner_type::TEXT = 'customs_broker' THEN 'customs'
  ELSE 'other'
END
WHERE partner_category_group IS NULL;

-- ── 4. INDEX FOR NEW FIELDS ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_logistics_partners_category_group
  ON public.logistics_partners(partner_category_group);

CREATE INDEX IF NOT EXISTS idx_logistics_partners_local_country
  ON public.logistics_partners(local_coverage_country);

CREATE INDEX IF NOT EXISTS idx_logistics_partners_type
  ON public.logistics_partners(partner_type);

-- ── 5. CHECKOUT LOGISTICS SELECTIONS TABLE ────────────────────────────────────
-- Stores buyer's dual-partner selection (international + local) during checkout
CREATE TABLE IF NOT EXISTS public.order_logistics_selections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  -- International shipping partner (origin → destination port)
  international_partner_id UUID REFERENCES public.logistics_partners(id) ON DELETE SET NULL,
  international_partner_agreed BOOLEAN NOT NULL DEFAULT false,
  international_fee_usd NUMERIC(10,2),
  -- Local distribution partner (port → buyer warehouse/door)
  local_partner_id UUID REFERENCES public.logistics_partners(id) ON DELETE SET NULL,
  local_partner_agreed BOOLEAN NOT NULL DEFAULT false,
  local_fee_usd NUMERIC(10,2),
  -- Customs broker (optional)
  customs_broker_id UUID REFERENCES public.logistics_partners(id) ON DELETE SET NULL,
  customs_fee_usd NUMERIC(10,2),
  -- Buyer's shipping info
  origin_country TEXT,
  destination_country TEXT,
  destination_port TEXT,
  -- Escrow integration
  total_logistics_fee_usd NUMERIC(10,2),
  escrow_status TEXT NOT NULL DEFAULT 'pending',
  -- Buyer protection
  shipping_terms_agreed BOOLEAN NOT NULL DEFAULT false,
  shipping_terms_agreed_at TIMESTAMPTZ,
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS for order_logistics_selections
ALTER TABLE public.order_logistics_selections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "buyer_manage_own_logistics_selection" ON public.order_logistics_selections;
CREATE POLICY "buyer_manage_own_logistics_selection"
ON public.order_logistics_selections FOR ALL
TO authenticated
USING (buyer_id = auth.uid())
WITH CHECK (buyer_id = auth.uid());

DROP POLICY IF EXISTS "admin_full_access_logistics_selections" ON public.order_logistics_selections;
CREATE POLICY "admin_full_access_logistics_selections"
ON public.order_logistics_selections FOR ALL
TO authenticated
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

-- Index
CREATE INDEX IF NOT EXISTS idx_order_logistics_selections_order
  ON public.order_logistics_selections(order_id);
CREATE INDEX IF NOT EXISTS idx_order_logistics_selections_buyer
  ON public.order_logistics_selections(buyer_id);
