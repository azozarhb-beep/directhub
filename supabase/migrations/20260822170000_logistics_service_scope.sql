-- Migration: Add service_scope and specialized_role to logistics_partners
-- Supports Option A (full door-to-door) and Option B (specialized/split service)

DO $$
BEGIN
  -- Add service_scope column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'logistics_partners'
      AND column_name = 'service_scope'
  ) THEN
    ALTER TABLE public.logistics_partners
      ADD COLUMN service_scope TEXT DEFAULT 'full_service'
        CHECK (service_scope IN ('full_service', 'specialized'));
  END IF;

  -- Add specialized_role column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'logistics_partners'
      AND column_name = 'specialized_role'
  ) THEN
    ALTER TABLE public.logistics_partners
      ADD COLUMN specialized_role TEXT
        CHECK (specialized_role IN (
          'sourcing_pickup_china',
          'international_shipping',
          'customs_clearance',
          'local_delivery',
          NULL
        ));
  END IF;
END $$;

-- Backfill existing rows: customs_broker → specialized/customs_clearance
-- local_shipping_distribution → specialized/local_delivery
-- international_shipping_office → full_service by default (can be either)
UPDATE public.logistics_partners
SET
  service_scope = CASE
    WHEN partner_type::TEXT = 'customs_broker' THEN 'specialized'
    WHEN partner_type::TEXT = 'local_shipping_distribution' THEN 'specialized'
    ELSE 'full_service'
  END,
  specialized_role = CASE
    WHEN partner_type::TEXT = 'customs_broker' THEN 'customs_clearance'
    WHEN partner_type::TEXT = 'local_shipping_distribution' THEN 'local_delivery'
    ELSE NULL
  END
WHERE service_scope IS NULL OR service_scope = 'full_service';
