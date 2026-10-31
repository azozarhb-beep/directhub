-- origin_type (local | international) on facilities (factory_registrations) and products (manufacturer_products)
-- Strict two-currency rule: local => YER only, international => USD only. No other currencies.

-- 1. Enum type (idempotent, no CASCADE so nothing is dropped)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'origin_type'
  ) THEN
    CREATE TYPE public.origin_type AS ENUM ('local', 'international');
  END IF;
END $$;

-- 2. Columns
ALTER TABLE public.factory_registrations
  ADD COLUMN IF NOT EXISTS origin_type public.origin_type NOT NULL DEFAULT 'local'::public.origin_type;

ALTER TABLE public.manufacturer_products
  ADD COLUMN IF NOT EXISTS origin_type public.origin_type NOT NULL DEFAULT 'local'::public.origin_type;

-- 3. Backfill facilities from existing factory_type / seller_category
UPDATE public.factory_registrations
SET origin_type = CASE
  WHEN factory_type::TEXT = 'international' OR seller_category::TEXT = 'international_factory'
    THEN 'international'::public.origin_type
  ELSE 'local'::public.origin_type
END;

-- 4. Backfill products: inherit from owning facility, else from currency / international link / origin country
UPDATE public.manufacturer_products p
SET origin_type = CASE
  WHEN EXISTS (
    SELECT 1 FROM public.factory_registrations f
    WHERE f.user_id = p.manufacturer_id AND f.origin_type = 'international'::public.origin_type
  ) THEN 'international'::public.origin_type
  WHEN p.international_manufacturer_id IS NOT NULL THEN 'international'::public.origin_type
  WHEN upper(coalesce(p.currency, 'YER')) = 'USD' THEN 'international'::public.origin_type
  WHEN coalesce(btrim(p.origin_country), '') <> ''
    AND lower(btrim(p.origin_country)) NOT IN (
      'yemen', 'ye', 'yem', 'اليمن', 'يمني', 'local', 'محلي'
    ) THEN 'international'::public.origin_type
  ELSE 'local'::public.origin_type
END;

-- 5. Normalize currency on products to the strict pair
UPDATE public.manufacturer_products
SET currency = CASE WHEN origin_type = 'international'::public.origin_type THEN 'USD' ELSE 'YER' END
WHERE currency IS DISTINCT FROM CASE WHEN origin_type = 'international'::public.origin_type THEN 'USD' ELSE 'YER' END;

-- 6. Indexes
CREATE INDEX IF NOT EXISTS idx_factory_registrations_origin_type ON public.factory_registrations (origin_type);
CREATE INDEX IF NOT EXISTS idx_manufacturer_products_origin_type ON public.manufacturer_products (origin_type);

-- 7. Functions
-- Facilities: keep origin_type and legacy factory_type in sync
CREATE OR REPLACE FUNCTION public.sync_factory_origin_type()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $func$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.factory_type::TEXT = 'international' OR NEW.seller_category::TEXT = 'international_factory' THEN
      NEW.origin_type := 'international'::public.origin_type;
    END IF;
  ELSIF NEW.factory_type IS DISTINCT FROM OLD.factory_type THEN
    NEW.origin_type := NEW.factory_type::TEXT::public.origin_type;
  END IF;
  NEW.factory_type := NEW.origin_type::TEXT::public.factory_type;
  RETURN NEW;
END;
$func$;

-- Products: inherit origin from the owning facility when it is international, then force the currency
CREATE OR REPLACE FUNCTION public.enforce_product_origin_currency()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $func$
BEGIN
  IF NEW.origin_type = 'local'::public.origin_type AND (
    NEW.international_manufacturer_id IS NOT NULL
    OR EXISTS (
      SELECT 1 FROM public.factory_registrations f
      WHERE f.user_id = NEW.manufacturer_id AND f.origin_type = 'international'::public.origin_type
    )
  ) THEN
    NEW.origin_type := 'international'::public.origin_type;
  END IF;

  IF NEW.origin_type = 'international'::public.origin_type THEN
    NEW.currency := 'USD';
  ELSE
    NEW.currency := 'YER';
  END IF;
  RETURN NEW;
END;
$func$;

-- 8. Triggers
DROP TRIGGER IF EXISTS trg_sync_factory_origin_type ON public.factory_registrations;
CREATE TRIGGER trg_sync_factory_origin_type
  BEFORE INSERT OR UPDATE ON public.factory_registrations
  FOR EACH ROW EXECUTE FUNCTION public.sync_factory_origin_type();

DROP TRIGGER IF EXISTS trg_enforce_product_origin_currency ON public.manufacturer_products;
CREATE TRIGGER trg_enforce_product_origin_currency
  BEFORE INSERT OR UPDATE ON public.manufacturer_products
  FOR EACH ROW EXECUTE FUNCTION public.enforce_product_origin_currency();

-- 9. Column default for currency stays YER; documented strict rule
COMMENT ON COLUMN public.manufacturer_products.origin_type IS
  'local => priced in YER only; international => priced in USD only.';
COMMENT ON COLUMN public.manufacturer_products.currency IS
  'Strictly derived from origin_type: YER (local) or USD (international).';

NOTIFY pgrst, 'reload schema';
