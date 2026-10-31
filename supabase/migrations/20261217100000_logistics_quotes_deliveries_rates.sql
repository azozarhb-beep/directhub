-- ============================================================
-- Migration: Logistics - freight_quotes, shipment_deliveries, logistics_rates
-- Scope: /logistics modules only
-- ============================================================

-- 1. freight_quotes: load board bids (quoted price, currency, transit days, scope)
CREATE TABLE IF NOT EXISTS public.freight_quotes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id       UUID NOT NULL REFERENCES public.logistics_shipments(id) ON DELETE CASCADE,
  partner_id        UUID NOT NULL REFERENCES public.logistics_partners(id) ON DELETE CASCADE,
  quoted_price      NUMERIC(14, 2) NOT NULL CHECK (quoted_price > 0),
  currency          TEXT NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD', 'SAR', 'YER', 'CNY', 'EUR')),
  transit_days      NUMERIC(6, 1) NOT NULL CHECK (transit_days > 0),
  transit_unit      TEXT NOT NULL DEFAULT 'days' CHECK (transit_unit IN ('days', 'hours')),
  scope             TEXT NOT NULL DEFAULT 'freight_only' CHECK (scope IN ('freight_only', 'handling_included', 'clearance_haulage')),
  vehicle_type      TEXT,
  validity_hours    INTEGER NOT NULL DEFAULT 48 CHECK (validity_hours > 0),
  expires_at        TIMESTAMPTZ,
  notes             TEXT,
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'withdrawn', 'expired')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_freight_quotes_active_per_partner
  ON public.freight_quotes (shipment_id, partner_id)
  WHERE status IN ('pending', 'accepted');
CREATE INDEX IF NOT EXISTS idx_freight_quotes_shipment ON public.freight_quotes (shipment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_freight_quotes_partner ON public.freight_quotes (partner_id, created_at DESC);

-- 2. shipment_deliveries: proof of delivery
CREATE TABLE IF NOT EXISTS public.shipment_deliveries (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id          UUID REFERENCES public.logistics_shipments(id) ON DELETE CASCADE,
  partner_id           UUID REFERENCES public.logistics_partners(id) ON DELETE SET NULL,
  tracking_id          TEXT NOT NULL,
  pin_code             TEXT,
  pod_image_url        TEXT,
  delivery_status      TEXT NOT NULL DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'in_transit', 'delivered', 'failed', 'returned')),
  recipient_name       TEXT,
  recipient_signature  TEXT,
  delivered_at         TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_shipment_deliveries_tracking ON public.shipment_deliveries (tracking_id);
CREATE INDEX IF NOT EXISTS idx_shipment_deliveries_shipment ON public.shipment_deliveries (shipment_id);
CREATE INDEX IF NOT EXISTS idx_shipment_deliveries_partner ON public.shipment_deliveries (partner_id, created_at DESC);

-- 3. logistics_rates: custom partner rates per service type
CREATE TABLE IF NOT EXISTS public.logistics_rates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id      UUID NOT NULL REFERENCES public.logistics_partners(id) ON DELETE CASCADE,
  service_type    TEXT NOT NULL CHECK (service_type IN ('domestic_land', 'cross_border', 'air', 'ocean')),
  rate_unit       TEXT NOT NULL DEFAULT 'per_kg' CHECK (rate_unit IN ('per_kg', 'per_ton', 'per_cbm', 'per_km', 'per_container', 'flat')),
  base_rate       NUMERIC(14, 4) NOT NULL DEFAULT 0 CHECK (base_rate >= 0),
  min_charge      NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (min_charge >= 0),
  handling_fee    NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (handling_fee >= 0),
  currency        TEXT NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD', 'SAR', 'YER', 'CNY', 'EUR')),
  is_active       BOOLEAN NOT NULL DEFAULT true,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_logistics_rates_partner_service
  ON public.logistics_rates (partner_id, service_type);
CREATE INDEX IF NOT EXISTS idx_logistics_rates_partner ON public.logistics_rates (partner_id);

-- 4. Helper functions (before RLS policies)
CREATE OR REPLACE FUNCTION public.lg_is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid() AND up.role = 'admin'
  )
$$;

CREATE OR REPLACE FUNCTION public.lg_my_partner_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.logistics_partners WHERE user_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.lg_is_shipment_owner(p_shipment_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.logistics_shipments s
    LEFT JOIN public.orders o ON o.id = s.order_id
    WHERE s.id = p_shipment_id
      AND (
        s.created_by = auth.uid()
        OR o.user_id = auth.uid()
        OR o.factory_user_id = auth.uid()
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.lg_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 5. Enable RLS
ALTER TABLE public.freight_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipment_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logistics_rates ENABLE ROW LEVEL SECURITY;

-- 6. RLS policies - freight_quotes
DROP POLICY IF EXISTS "admin_full_access_freight_quotes" ON public.freight_quotes;
CREATE POLICY "admin_full_access_freight_quotes"
  ON public.freight_quotes FOR ALL TO authenticated
  USING (public.lg_is_admin())
  WITH CHECK (public.lg_is_admin());

DROP POLICY IF EXISTS "partner_view_own_freight_quotes" ON public.freight_quotes;
CREATE POLICY "partner_view_own_freight_quotes"
  ON public.freight_quotes FOR SELECT TO authenticated
  USING (partner_id IN (SELECT public.lg_my_partner_ids()));

DROP POLICY IF EXISTS "partner_insert_own_freight_quotes" ON public.freight_quotes;
CREATE POLICY "partner_insert_own_freight_quotes"
  ON public.freight_quotes FOR INSERT TO authenticated
  WITH CHECK (partner_id IN (SELECT public.lg_my_partner_ids()) AND status = 'pending');

DROP POLICY IF EXISTS "partner_update_own_freight_quotes" ON public.freight_quotes;
CREATE POLICY "partner_update_own_freight_quotes"
  ON public.freight_quotes FOR UPDATE TO authenticated
  USING (partner_id IN (SELECT public.lg_my_partner_ids()) AND status = 'pending')
  WITH CHECK (partner_id IN (SELECT public.lg_my_partner_ids()) AND status IN ('pending', 'withdrawn'));

DROP POLICY IF EXISTS "shipper_view_freight_quotes" ON public.freight_quotes;
CREATE POLICY "shipper_view_freight_quotes"
  ON public.freight_quotes FOR SELECT TO authenticated
  USING (public.lg_is_shipment_owner(shipment_id));

-- 7. RLS policies - shipment_deliveries
DROP POLICY IF EXISTS "admin_full_access_shipment_deliveries" ON public.shipment_deliveries;
CREATE POLICY "admin_full_access_shipment_deliveries"
  ON public.shipment_deliveries FOR ALL TO authenticated
  USING (public.lg_is_admin())
  WITH CHECK (public.lg_is_admin());

DROP POLICY IF EXISTS "partner_manage_own_shipment_deliveries" ON public.shipment_deliveries;
CREATE POLICY "partner_manage_own_shipment_deliveries"
  ON public.shipment_deliveries FOR ALL TO authenticated
  USING (partner_id IN (SELECT public.lg_my_partner_ids()))
  WITH CHECK (partner_id IN (SELECT public.lg_my_partner_ids()));

DROP POLICY IF EXISTS "shipper_view_shipment_deliveries" ON public.shipment_deliveries;
CREATE POLICY "shipper_view_shipment_deliveries"
  ON public.shipment_deliveries FOR SELECT TO authenticated
  USING (shipment_id IS NOT NULL AND public.lg_is_shipment_owner(shipment_id));

-- 8. RLS policies - logistics_rates
DROP POLICY IF EXISTS "admin_full_access_logistics_rates" ON public.logistics_rates;
CREATE POLICY "admin_full_access_logistics_rates"
  ON public.logistics_rates FOR ALL TO authenticated
  USING (public.lg_is_admin())
  WITH CHECK (public.lg_is_admin());

DROP POLICY IF EXISTS "partner_manage_own_logistics_rates" ON public.logistics_rates;
CREATE POLICY "partner_manage_own_logistics_rates"
  ON public.logistics_rates FOR ALL TO authenticated
  USING (partner_id IN (SELECT public.lg_my_partner_ids()))
  WITH CHECK (partner_id IN (SELECT public.lg_my_partner_ids()));

-- 9. Updated-at triggers
DROP TRIGGER IF EXISTS trg_freight_quotes_updated_at ON public.freight_quotes;
CREATE TRIGGER trg_freight_quotes_updated_at
  BEFORE UPDATE ON public.freight_quotes
  FOR EACH ROW EXECUTE FUNCTION public.lg_set_updated_at();

DROP TRIGGER IF EXISTS trg_shipment_deliveries_updated_at ON public.shipment_deliveries;
CREATE TRIGGER trg_shipment_deliveries_updated_at
  BEFORE UPDATE ON public.shipment_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.lg_set_updated_at();

DROP TRIGGER IF EXISTS trg_logistics_rates_updated_at ON public.logistics_rates;
CREATE TRIGGER trg_logistics_rates_updated_at
  BEFORE UPDATE ON public.logistics_rates
  FOR EACH ROW EXECUTE FUNCTION public.lg_set_updated_at();

NOTIFY pgrst, 'reload schema';
