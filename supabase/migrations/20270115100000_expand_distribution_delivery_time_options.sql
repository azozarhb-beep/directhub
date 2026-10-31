ALTER TABLE public.supplier_distribution_channels
  DROP CONSTRAINT IF EXISTS supplier_distribution_channels_delivery_time_check;

ALTER TABLE public.supplier_distribution_channels
  ADD CONSTRAINT supplier_distribution_channels_delivery_time_check
  CHECK (delivery_time IN ('same_day', 'within_48h', 'days_3_5', 'days_5_7', 'custom_schedule'));
