-- ─────────────────────────────────────────────────────────────────────────────
-- Supplier Alert Engine — Smart Product Error Detection & Escalation System
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. ENUM: alert status lifecycle
DROP TYPE IF EXISTS public.supplier_alert_status CASCADE;
CREATE TYPE public.supplier_alert_status AS ENUM (
  'open',        -- just detected, awaiting supplier fix
  'notified',    -- WhatsApp/dashboard notification sent to supplier
  'resolved',    -- supplier fixed the issue within deadline
  'escalated',   -- deadline passed, escalated to admin control-room
  'dismissed'    -- admin dismissed without action
);

-- 2. ENUM: missing field type
DROP TYPE IF EXISTS public.supplier_alert_field CASCADE;
CREATE TYPE public.supplier_alert_field AS ENUM (
  'price',
  'image',
  'quantity',
  'name',
  'description',
  'category',
  'sku',
  'origin_country'
);

-- 3. Core table
CREATE TABLE IF NOT EXISTS public.supplier_alerts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id        UUID NOT NULL REFERENCES public.manufacturer_products(id) ON DELETE CASCADE,
  manufacturer_id   UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  missing_fields    TEXT[] NOT NULL DEFAULT '{}',
  status            public.supplier_alert_status NOT NULL DEFAULT 'open',
  notified_at       TIMESTAMPTZ,
  deadline_at       TIMESTAMPTZ,           -- supplier must fix before this
  resolved_at       TIMESTAMPTZ,
  escalated_at      TIMESTAMPTZ,
  dismissed_at      TIMESTAMPTZ,
  admin_note        TEXT,
  whatsapp_sent     BOOLEAN NOT NULL DEFAULT false,
  whatsapp_message_id TEXT,
  product_name      TEXT,                  -- snapshot at alert creation
  manufacturer_name TEXT,                  -- snapshot
  manufacturer_phone TEXT,                 -- snapshot for WhatsApp
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_supplier_alerts_manufacturer ON public.supplier_alerts(manufacturer_id);
CREATE INDEX IF NOT EXISTS idx_supplier_alerts_product ON public.supplier_alerts(product_id);
CREATE INDEX IF NOT EXISTS idx_supplier_alerts_status ON public.supplier_alerts(status);
CREATE INDEX IF NOT EXISTS idx_supplier_alerts_deadline ON public.supplier_alerts(deadline_at) WHERE status = 'notified';

-- 5. updated_at trigger
CREATE OR REPLACE FUNCTION public.supplier_alerts_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS supplier_alerts_updated_at ON public.supplier_alerts;
CREATE TRIGGER supplier_alerts_updated_at
  BEFORE UPDATE ON public.supplier_alerts
  FOR EACH ROW EXECUTE FUNCTION public.supplier_alerts_set_updated_at();

-- 6. RLS
ALTER TABLE public.supplier_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_full_access_supplier_alerts" ON public.supplier_alerts;
CREATE POLICY "admin_full_access_supplier_alerts"
  ON public.supplier_alerts FOR ALL TO authenticated
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

DROP POLICY IF EXISTS "manufacturer_view_own_supplier_alerts" ON public.supplier_alerts;
CREATE POLICY "manufacturer_view_own_supplier_alerts"
  ON public.supplier_alerts FOR SELECT TO authenticated
  USING (manufacturer_id = auth.uid());

DROP POLICY IF EXISTS "service_insert_supplier_alerts" ON public.supplier_alerts;
CREATE POLICY "service_insert_supplier_alerts"
  ON public.supplier_alerts FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "service_update_supplier_alerts" ON public.supplier_alerts;
CREATE POLICY "service_update_supplier_alerts"
  ON public.supplier_alerts FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);
