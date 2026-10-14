-- ============================================================
-- Migration: Port Free-Time & Demurrage/Detention Tracker
-- Extends logistics_shipments with container / port / free-time fields
-- ============================================================

ALTER TABLE public.logistics_shipments
  ADD COLUMN IF NOT EXISTS container_number TEXT,
  ADD COLUMN IF NOT EXISTS container_type TEXT,
  ADD COLUMN IF NOT EXISTS shipping_line TEXT,
  ADD COLUMN IF NOT EXISTS port_country TEXT,
  ADD COLUMN IF NOT EXISTS port_name TEXT,
  ADD COLUMN IF NOT EXISTS port_role TEXT,
  ADD COLUMN IF NOT EXISTS discharge_date DATE,
  ADD COLUMN IF NOT EXISTS free_days_limit INTEGER,
  ADD COLUMN IF NOT EXISTS daily_demurrage_rate NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS demurrage_currency TEXT DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS free_time_alert_sent_at TIMESTAMPTZ;

DO $$
BEGIN
  -- Normalise legacy container_type values (from the load board migration)
  -- so they do not conflict with the container_type constraint.
  UPDATE public.logistics_shipments
  SET container_type = CASE
    WHEN lower(replace(trim(container_type), ' ', '_')) IN ('20ft','20','20_ft','20ft_dry','20gp') THEN '20ft'
    WHEN lower(replace(trim(container_type), ' ', '_')) IN ('40ft','40','40_ft','40ft_dry','40gp') THEN '40ft'
    WHEN lower(replace(trim(container_type), ' ', '_')) IN ('40ft_hc','40hc','40hq','40_hc','40_hq') THEN '40ft_hc'
    WHEN lower(replace(trim(container_type), ' ', '_')) IN ('reefer') THEN 'reefer'
    WHEN lower(replace(trim(container_type), ' ', '_')) IN ('open_top') THEN 'open_top'
    WHEN lower(replace(trim(container_type), ' ', '_')) IN ('tank') THEN 'tank'
    WHEN lower(replace(trim(container_type), ' ', '_')) IN ('flatbed','dry_box','drybox') THEN lower(replace(trim(container_type), ' ', '_'))
    ELSE container_type
  END
  WHERE container_type IS NOT NULL;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'logistics_shipments_container_type_check') THEN
    ALTER TABLE public.logistics_shipments DROP CONSTRAINT logistics_shipments_container_type_check;
  END IF;

  -- NOT VALID: enforced for new/updated rows, existing legacy rows never block the migration.
  ALTER TABLE public.logistics_shipments
    ADD CONSTRAINT logistics_shipments_container_type_check
    CHECK (container_type IS NULL OR container_type IN (
      '20ft','40ft','40ft_hc','reefer','open_top','tank','flatbed','dry_box'
    )) NOT VALID;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'logistics_shipments_port_role_check') THEN
    ALTER TABLE public.logistics_shipments
      ADD CONSTRAINT logistics_shipments_port_role_check
      CHECK (port_role IS NULL OR port_role IN ('origin','transshipment','destination'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'logistics_shipments_demurrage_currency_check') THEN
    ALTER TABLE public.logistics_shipments
      ADD CONSTRAINT logistics_shipments_demurrage_currency_check
      CHECK (demurrage_currency IS NULL OR demurrage_currency IN ('USD','YER','SAR','EGP'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'logistics_shipments_free_days_check') THEN
    ALTER TABLE public.logistics_shipments
      ADD CONSTRAINT logistics_shipments_free_days_check
      CHECK (free_days_limit IS NULL OR free_days_limit >= 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_logistics_shipments_discharge_date
  ON public.logistics_shipments (discharge_date)
  WHERE discharge_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_logistics_shipments_container_number
  ON public.logistics_shipments (container_number);
