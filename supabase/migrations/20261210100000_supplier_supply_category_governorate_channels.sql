-- Supplier supply capacity refinement: supply category, governorate, channel coverage & delivery time

ALTER TABLE public.supplier_supply_profile
  ADD COLUMN IF NOT EXISTS supply_category TEXT,
  ADD COLUMN IF NOT EXISTS warehouse_governorate TEXT;

ALTER TABLE public.supplier_distribution_channels
  ADD COLUMN IF NOT EXISTS coverage_governorates TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS delivery_time TEXT NOT NULL DEFAULT 'within_48h';

ALTER TABLE public.supplier_distribution_channels
  DROP CONSTRAINT IF EXISTS supplier_distribution_channels_type_check;
ALTER TABLE public.supplier_distribution_channels
  ADD CONSTRAINT supplier_distribution_channels_type_check
  CHECK (channel_type IN (
    'wholesale', 'retail', 'distributor', 'import', 'online',
    'direct_fleet', 'agents_network', 'shipping_offices', 'regional_warehouse'
  ));

ALTER TABLE public.supplier_distribution_channels
  DROP CONSTRAINT IF EXISTS supplier_distribution_channels_delivery_time_check;
ALTER TABLE public.supplier_distribution_channels
  ADD CONSTRAINT supplier_distribution_channels_delivery_time_check
  CHECK (delivery_time IN ('same_day', 'within_48h'));
