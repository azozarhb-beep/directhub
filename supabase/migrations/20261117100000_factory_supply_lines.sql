-- ============================================================
-- Migration: factory_supply_lines (Supply Chain Hub)
-- Raw materials + suppliers saved permanently per factory.
-- manufacturer_id = auth.uid() of the owning factory account.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.factory_supply_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manufacturer_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  material_key TEXT,
  material_name TEXT NOT NULL,
  supplier_name TEXT,
  supplier_country_code TEXT,
  supplier_country_name TEXT,
  contracted_quantity NUMERIC(14, 2),
  quantity_unit TEXT NOT NULL DEFAULT 'ton',
  port_of_loading TEXT,
  lead_time_days INTEGER NOT NULL DEFAULT 30,
  reliability_score INTEGER NOT NULL DEFAULT 80,
  last_shipment DATE,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT factory_supply_lines_status_chk CHECK (status IN ('active', 'delayed', 'disrupted')),
  CONSTRAINT factory_supply_lines_reliability_chk CHECK (reliability_score BETWEEN 0 AND 100),
  CONSTRAINT factory_supply_lines_lead_time_chk CHECK (lead_time_days >= 0)
);

CREATE INDEX IF NOT EXISTS idx_factory_supply_lines_manufacturer
  ON public.factory_supply_lines(manufacturer_id);
CREATE INDEX IF NOT EXISTS idx_factory_supply_lines_status
  ON public.factory_supply_lines(status);

ALTER TABLE public.factory_supply_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "factory_supply_lines_owner_all" ON public.factory_supply_lines;
CREATE POLICY "factory_supply_lines_owner_all"
  ON public.factory_supply_lines
  FOR ALL
  TO authenticated
  USING (manufacturer_id = auth.uid())
  WITH CHECK (manufacturer_id = auth.uid());

GRANT SELECT ON public.factory_supply_lines TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.factory_supply_lines TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.factory_supply_lines TO service_role;
