-- ─── Partner Shipping Rates ────────────────────────────────────────────────────
-- Allows logistics partners to define their own custom rates per shipment type.
-- The shipping calculator reads from this table when a partner is logged in.

CREATE TABLE IF NOT EXISTS public.partner_shipping_rates (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id                UUID NOT NULL REFERENCES public.logistics_partners(id) ON DELETE CASCADE,

  -- ── Local Land (Yemen) ──────────────────────────────────────────────────────
  land_light_rate_per_kg    NUMERIC(10,4) DEFAULT 0.15,   -- < 100 kg
  land_medium_rate_per_kg   NUMERIC(10,4) DEFAULT 0.08,   -- 100 – 1000 kg
  land_heavy_rate_per_ton   NUMERIC(10,4) DEFAULT 35.00,  -- > 1000 kg (per ton)
  land_max_cap_per_trip     NUMERIC(10,2) DEFAULT 350.00, -- max charge per truck trip

  -- ── International Sea Freight ────────────────────────────────────────────────
  sea_base_docs_fee         NUMERIC(10,2) DEFAULT 300.00, -- documentation + base
  sea_min_bl_charge         NUMERIC(10,2) DEFAULT 500.00, -- minimum B/L charge
  sea_rate_per_cbm_ton      NUMERIC(10,2) DEFAULT 150.00, -- per CBM or per ton ($120–$180)

  -- ── International Air Freight ────────────────────────────────────────────────
  air_rate_per_kg           NUMERIC(10,4) DEFAULT 6.50,   -- per kg (min $6.50)
  air_handling_fee          NUMERIC(10,2) DEFAULT 80.00,  -- airport handling
  air_min_charge            NUMERIC(10,2) DEFAULT 150.00, -- minimum air shipment

  -- ── International Land Freight ───────────────────────────────────────────────
  intl_land_rate_per_km     NUMERIC(10,4) DEFAULT 0.004,
  intl_land_rate_per_kg     NUMERIC(10,4) DEFAULT 0.12,
  intl_land_base_charge     NUMERIC(10,2) DEFAULT 60.00,
  intl_land_fuel_pct        NUMERIC(5,4)  DEFAULT 0.15,

  -- ── Metadata ─────────────────────────────────────────────────────────────────
  notes                     TEXT,
  updated_at                TIMESTAMPTZ DEFAULT NOW(),
  created_at                TIMESTAMPTZ DEFAULT NOW()
);

-- Unique: one rate card per partner
CREATE UNIQUE INDEX IF NOT EXISTS idx_partner_shipping_rates_partner
  ON public.partner_shipping_rates (partner_id);

CREATE INDEX IF NOT EXISTS idx_partner_shipping_rates_partner_id
  ON public.partner_shipping_rates (partner_id);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.partner_shipping_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "partner_manage_own_rates" ON public.partner_shipping_rates;
CREATE POLICY "partner_manage_own_rates"
  ON public.partner_shipping_rates
  FOR ALL
  TO authenticated
  USING (
    partner_id IN (
      SELECT id FROM public.logistics_partners WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    partner_id IN (
      SELECT id FROM public.logistics_partners WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "admin_manage_all_rates" ON public.partner_shipping_rates;
CREATE POLICY "admin_manage_all_rates"
  ON public.partner_shipping_rates
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

-- ── Updated-at trigger ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_partner_shipping_rates_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_partner_shipping_rates_updated_at ON public.partner_shipping_rates;
CREATE TRIGGER trg_partner_shipping_rates_updated_at
  BEFORE UPDATE ON public.partner_shipping_rates
  FOR EACH ROW EXECUTE FUNCTION public.set_partner_shipping_rates_updated_at();
