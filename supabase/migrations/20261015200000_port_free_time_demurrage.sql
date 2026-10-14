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
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'logistics_shipments_container_type_check') THEN
    ALTER TABLE public.logistics_shipments
      ADD CONSTRAINT logistics_shipments_container_type_check
      CHECK (container_type IS NULL OR container_type IN ('20ft','40ft','40ft_hc','reefer','open_top','tank'));
  END IF;

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
