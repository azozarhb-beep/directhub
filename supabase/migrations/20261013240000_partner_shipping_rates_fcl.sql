-- ─── Partner Shipping Rates — FCL Columns ────────────────────────────────────
-- Adds FCL (Full Container Load) rate columns to partner_shipping_rates.
-- Partners can customize container rates per shipping lane.

ALTER TABLE public.partner_shipping_rates
  ADD COLUMN IF NOT EXISTS sea_fcl_20ft_rate  NUMERIC(10,2) DEFAULT 1200.00, -- 20ft Standard Container
  ADD COLUMN IF NOT EXISTS sea_fcl_40ft_rate  NUMERIC(10,2) DEFAULT 1800.00, -- 40ft Standard Container
  ADD COLUMN IF NOT EXISTS sea_fcl_40hq_rate  NUMERIC(10,2) DEFAULT 2000.00, -- 40ft High Cube (40HQ)
  ADD COLUMN IF NOT EXISTS sea_fcl_docs_fee   NUMERIC(10,2) DEFAULT 250.00;  -- FCL Documentation / B/L Fee

COMMENT ON COLUMN public.partner_shipping_rates.sea_fcl_20ft_rate IS '20ft Standard Container rate per container (up to 26 tons / 33 CBM)';
COMMENT ON COLUMN public.partner_shipping_rates.sea_fcl_40ft_rate IS '40ft Standard Container rate per container (up to 28 tons / 67 CBM)';
COMMENT ON COLUMN public.partner_shipping_rates.sea_fcl_40hq_rate IS '40ft High Cube (40HQ) rate per container — most popular for factories (76 CBM)';
COMMENT ON COLUMN public.partner_shipping_rates.sea_fcl_docs_fee  IS 'FCL documentation and B/L issuance fee (fixed per shipment)';
