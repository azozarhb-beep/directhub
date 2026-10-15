-- Adds B2B / B2C dual pricing columns.
-- NOTE: public.products does not exist in this project; agent-uploaded products
-- live in public.agent_products, so the columns are added there. If a
-- public.products table exists in another environment it is updated too.

ALTER TABLE public.agent_products
  ADD COLUMN IF NOT EXISTS is_b2b_only boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS retail_price numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS wholesale_price numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_tiers jsonb DEFAULT '[]'::jsonb;

-- Backfill wholesale_price from the legacy single price column
UPDATE public.agent_products
SET wholesale_price = COALESCE(price, 0)
WHERE wholesale_price = 0 AND COALESCE(price, 0) > 0;

DO $$
BEGIN
  IF to_regclass('public.products') IS NOT NULL THEN
    ALTER TABLE public.products
      ADD COLUMN IF NOT EXISTS is_b2b_only boolean DEFAULT true,
      ADD COLUMN IF NOT EXISTS retail_price numeric DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS wholesale_price numeric NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS price_tiers jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;
