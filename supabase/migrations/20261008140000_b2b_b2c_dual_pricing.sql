-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: B2B / B2C Dual Pricing Support
-- Adds columns to manufacturer_products to support:
--   • B2C retail pricing (single-unit / consumer)
--   • B2B wholesale tiered pricing (volume-based with MOQ)
--   • listing_mode to control which modes are active
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add listing_mode column (b2b_only | b2c_only | hybrid)
--    Already exists as "order_model" — we keep that and add listing_mode as alias
ALTER TABLE public.manufacturer_products
  ADD COLUMN IF NOT EXISTS listing_mode TEXT DEFAULT 'hybrid'
    CHECK (listing_mode = ANY (ARRAY['b2b_only'::text, 'b2c_only'::text, 'hybrid'::text]));

-- 2. B2C retail price (single-unit price for individual buyers)
--    b2c_price already exists — no-op, just ensure it's there
ALTER TABLE public.manufacturer_products
  ADD COLUMN IF NOT EXISTS b2c_price NUMERIC DEFAULT NULL;

-- 3. B2C minimum order quantity (for retail buyers, typically 1)
ALTER TABLE public.manufacturer_products
  ADD COLUMN IF NOT EXISTS b2c_moq INTEGER DEFAULT 1;

-- 4. B2B wholesale tiered pricing (JSONB array of volume tiers)
--    Format: [{"min_qty": 10, "max_qty": 50, "price": 4.50, "unit": "kg"}, ...]
ALTER TABLE public.manufacturer_products
  ADD COLUMN IF NOT EXISTS b2b_tiered_pricing JSONB DEFAULT '[]'::jsonb;

-- 5. B2B minimum order quantity (already exists as b2b_min_quantity — ensure present)
ALTER TABLE public.manufacturer_products
  ADD COLUMN IF NOT EXISTS b2b_min_quantity INTEGER DEFAULT 10;

-- 6. tiered_pricing column (general tiered pricing, already used by the form)
ALTER TABLE public.manufacturer_products
  ADD COLUMN IF NOT EXISTS tiered_pricing JSONB DEFAULT '[]'::jsonb;

-- 7. promo_price and original_price (already used by form — ensure present)
ALTER TABLE public.manufacturer_products
  ADD COLUMN IF NOT EXISTS promo_price NUMERIC DEFAULT NULL;

ALTER TABLE public.manufacturer_products
  ADD COLUMN IF NOT EXISTS original_price NUMERIC DEFAULT NULL;

-- 8. oem_available (already used by form — ensure present)
ALTER TABLE public.manufacturer_products
  ADD COLUMN IF NOT EXISTS oem_available BOOLEAN DEFAULT false;

-- 9. video_url (already used by form — ensure present)
ALTER TABLE public.manufacturer_products
  ADD COLUMN IF NOT EXISTS video_url TEXT DEFAULT NULL;

-- 10. payout_account_ref (already used by form — ensure present)
ALTER TABLE public.manufacturer_products
  ADD COLUMN IF NOT EXISTS payout_account_ref TEXT DEFAULT NULL;

-- 11. Index for listing_mode queries
CREATE INDEX IF NOT EXISTS idx_manufacturer_products_listing_mode
  ON public.manufacturer_products (listing_mode);

-- 12. Index for b2b_tiered_pricing (GIN for JSONB queries)
CREATE INDEX IF NOT EXISTS idx_manufacturer_products_b2b_tiered_pricing
  ON public.manufacturer_products USING GIN (b2b_tiered_pricing);
