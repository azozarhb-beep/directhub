-- Supplier products: gallery, wholesale tiers, packaging, variants, inventory thresholds, delivery terms

ALTER TABLE public.supplier_products
  ADD COLUMN IF NOT EXISTS gallery_urls TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS price_tiers JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS units_per_pack INTEGER,
  ADD COLUMN IF NOT EXISTS gross_weight_kg NUMERIC(12,3),
  ADD COLUMN IF NOT EXISTS dimensions TEXT,
  ADD COLUMN IF NOT EXISTS variants JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS low_stock_threshold INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shelf_location TEXT,
  ADD COLUMN IF NOT EXISTS delivery_terms TEXT NOT NULL DEFAULT 'exw_warehouse';

ALTER TABLE public.supplier_products
  DROP CONSTRAINT IF EXISTS supplier_products_delivery_terms_check;
ALTER TABLE public.supplier_products
  ADD CONSTRAINT supplier_products_delivery_terms_check
  CHECK (delivery_terms IN ('exw_warehouse', 'buyer_ships', 'delivery_included'));

CREATE INDEX IF NOT EXISTS idx_supplier_products_sku ON public.supplier_products(sku);
