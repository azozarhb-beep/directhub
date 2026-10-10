-- ============================================================
-- Migration: Logistics Engine — Shipments & Tracking Logs
-- Tables: logistics_shipments, shipment_tracking_logs
-- ============================================================

-- 1. ENUM: Shipment status
DROP TYPE IF EXISTS public.shipment_status_enum CASCADE;
CREATE TYPE public.shipment_status_enum AS ENUM (
  'pending',
  'picked_up',
  'in_transit',
  'arrived_at_hub',
  'out_for_delivery',
  'delivered',
  'failed_delivery',
  'returned',
  'cancelled'
);

-- 2. CORE TABLE: logistics_shipments
CREATE TABLE IF NOT EXISTS public.logistics_shipments (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id             UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  logistics_partner_id UUID REFERENCES public.logistics_partners(id) ON DELETE SET NULL,
  created_by           UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  tracking_number      TEXT NOT NULL UNIQUE,
  carrier_name         TEXT,
  origin_address       TEXT,
  destination_address  TEXT,
  shipment_status      public.shipment_status_enum NOT NULL DEFAULT 'pending',
  estimated_delivery   TIMESTAMPTZ,
  actual_delivery      TIMESTAMPTZ,
  weight_kg            NUMERIC(10, 3),
  dimensions_cm        JSONB,
  notes                TEXT,
  metadata             JSONB,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. DEPENDENT TABLE: shipment_tracking_logs
CREATE TABLE IF NOT EXISTS public.shipment_tracking_logs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id         UUID NOT NULL REFERENCES public.logistics_shipments(id) ON DELETE CASCADE,
  event_type          TEXT NOT NULL,
  event_description   TEXT NOT NULL,
  location            TEXT,
  occurred_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by          UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  metadata            JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. INDEXES
-- logistics_shipments
CREATE INDEX IF NOT EXISTS idx_logistics_shipments_order_id
  ON public.logistics_shipments (order_id);

CREATE INDEX IF NOT EXISTS idx_logistics_shipments_tracking_number
  ON public.logistics_shipments (tracking_number);

CREATE INDEX IF NOT EXISTS idx_logistics_shipments_status_created
  ON public.logistics_shipments (shipment_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_logistics_shipments_partner_id
  ON public.logistics_shipments (logistics_partner_id);

CREATE INDEX IF NOT EXISTS idx_logistics_shipments_created_by
  ON public.logistics_shipments (created_by);

-- shipment_tracking_logs
CREATE INDEX IF NOT EXISTS idx_shipment_tracking_logs_shipment_id
  ON public.shipment_tracking_logs (shipment_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_shipment_tracking_logs_event_type
  ON public.shipment_tracking_logs (event_type, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_shipment_tracking_logs_occurred_at
  ON public.shipment_tracking_logs (occurred_at DESC);

-- 5. UPDATED_AT TRIGGER FUNCTION
CREATE OR REPLACE FUNCTION public.set_logistics_shipments_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_logistics_shipments_updated_at ON public.logistics_shipments;
CREATE TRIGGER trg_logistics_shipments_updated_at
  BEFORE UPDATE ON public.logistics_shipments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_logistics_shipments_updated_at();

-- 6. ENABLE RLS
ALTER TABLE public.logistics_shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipment_tracking_logs ENABLE ROW LEVEL SECURITY;

-- 7. RLS POLICIES — logistics_shipments

-- Admins: full access
DROP POLICY IF EXISTS "admin_full_access_logistics_shipments" ON public.logistics_shipments;
CREATE POLICY "admin_full_access_logistics_shipments"
  ON public.logistics_shipments
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  );

-- Logistics partners: manage their own shipments
DROP POLICY IF EXISTS "logistics_partner_manage_own_shipments" ON public.logistics_shipments;
CREATE POLICY "logistics_partner_manage_own_shipments"
  ON public.logistics_shipments
  FOR ALL
  TO authenticated
  USING (
    logistics_partner_id IN (
      SELECT id FROM public.logistics_partners WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    logistics_partner_id IN (
      SELECT id FROM public.logistics_partners WHERE user_id = auth.uid()
    )
  );

-- Buyers/Sellers: view shipments linked to their orders
DROP POLICY IF EXISTS "users_view_own_order_shipments" ON public.logistics_shipments;
CREATE POLICY "users_view_own_order_shipments"
  ON public.logistics_shipments
  FOR SELECT
  TO authenticated
  USING (
    order_id IN (
      SELECT id FROM public.orders WHERE user_id = auth.uid() OR factory_user_id = auth.uid()
    )
    OR created_by = auth.uid()
  );

-- 8. RLS POLICIES — shipment_tracking_logs

-- Admins: full access
DROP POLICY IF EXISTS "admin_full_access_shipment_tracking_logs" ON public.shipment_tracking_logs;
CREATE POLICY "admin_full_access_shipment_tracking_logs"
  ON public.shipment_tracking_logs
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  );

-- Logistics partners: manage logs for their shipments
DROP POLICY IF EXISTS "logistics_partner_manage_tracking_logs" ON public.shipment_tracking_logs;
CREATE POLICY "logistics_partner_manage_tracking_logs"
  ON public.shipment_tracking_logs
  FOR ALL
  TO authenticated
  USING (
    shipment_id IN (
      SELECT ls.id FROM public.logistics_shipments ls
      JOIN public.logistics_partners lp ON ls.logistics_partner_id = lp.id
      WHERE lp.user_id = auth.uid()
    )
  )
  WITH CHECK (
    shipment_id IN (
      SELECT ls.id FROM public.logistics_shipments ls
      JOIN public.logistics_partners lp ON ls.logistics_partner_id = lp.id
      WHERE lp.user_id = auth.uid()
    )
  );

-- Buyers/Sellers: view logs for their order shipments
DROP POLICY IF EXISTS "users_view_own_order_tracking_logs" ON public.shipment_tracking_logs;
CREATE POLICY "users_view_own_order_tracking_logs"
  ON public.shipment_tracking_logs
  FOR SELECT
  TO authenticated
  USING (
    shipment_id IN (
      SELECT ls.id FROM public.logistics_shipments ls
      WHERE ls.order_id IN (
        SELECT id FROM public.orders WHERE user_id = auth.uid() OR factory_user_id = auth.uid()
      )
      OR ls.created_by = auth.uid()
    )
  );
