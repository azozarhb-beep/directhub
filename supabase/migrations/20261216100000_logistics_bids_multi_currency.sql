-- Widen allowed bid currencies on the freight load board
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'logistics_bids'
  ) THEN
    ALTER TABLE public.logistics_bids DROP CONSTRAINT IF EXISTS logistics_bids_currency_check;
    ALTER TABLE public.logistics_bids
      ADD CONSTRAINT logistics_bids_currency_check
      CHECK (currency IN ('USD', 'SAR', 'YER', 'CNY', 'EUR', 'AED'));
  END IF;
END $$;
