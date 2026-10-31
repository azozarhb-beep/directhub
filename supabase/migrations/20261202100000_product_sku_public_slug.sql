-- Universal Product Code (SKU) + public slug for manufacturer_products.
-- Additive only. Domestic (YER) => DH-YE-XXXX, International (USD / other) => DH-INT-XXXX.

CREATE SEQUENCE IF NOT EXISTS public.product_sku_domestic_seq START WITH 1000;
CREATE SEQUENCE IF NOT EXISTS public.product_sku_international_seq START WITH 1000;

ALTER TABLE public.manufacturer_products
ADD COLUMN IF NOT EXISTS slug text;

CREATE OR REPLACE FUNCTION public.generate_product_sku(p_currency text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  candidate text;
BEGIN
  LOOP
    IF upper(coalesce(p_currency, 'YER')) = 'YER' THEN
      candidate := 'DH-YE-' || lpad(nextval('public.product_sku_domestic_seq')::text, 4, '0');
    ELSE
      candidate := 'DH-INT-' || lpad(nextval('public.product_sku_international_seq')::text, 4, '0');
    END IF;
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.manufacturer_products WHERE sku = candidate
    );
  END LOOP;
  RETURN candidate;
END;
$$;

CREATE OR REPLACE FUNCTION public.manufacturer_products_assign_sku_slug()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.sku IS NULL OR btrim(NEW.sku) = '' THEN
    NEW.sku := public.generate_product_sku(NEW.currency);
  ELSE
    NEW.sku := btrim(NEW.sku);
  END IF;

  IF NEW.slug IS NULL OR btrim(NEW.slug) = '' THEN
    NEW.slug := lower(NEW.sku);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_manufacturer_products_assign_sku_slug ON public.manufacturer_products;
CREATE TRIGGER trg_manufacturer_products_assign_sku_slug
BEFORE INSERT OR UPDATE OF sku, slug, currency ON public.manufacturer_products
FOR EACH ROW
EXECUTE FUNCTION public.manufacturer_products_assign_sku_slug();

-- Backfill existing rows that have no SKU (one by one so sequences stay unique).
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT id, currency FROM public.manufacturer_products
    WHERE sku IS NULL OR btrim(sku) = ''
  LOOP
    UPDATE public.manufacturer_products
    SET sku = public.generate_product_sku(r.currency)
    WHERE id = r.id;
  END LOOP;
END $$;

UPDATE public.manufacturer_products
SET slug = lower(sku)
WHERE (slug IS NULL OR btrim(slug) = '') AND sku IS NOT NULL AND btrim(sku) <> '';

-- Resolve pre-existing duplicate SKUs before enforcing uniqueness.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT id, currency FROM (
      SELECT id, currency,
             row_number() OVER (PARTITION BY sku ORDER BY created_at, id) AS rn
      FROM public.manufacturer_products
      WHERE sku IS NOT NULL AND btrim(sku) <> ''
    ) d WHERE d.rn > 1
  LOOP
    UPDATE public.manufacturer_products
    SET sku = public.generate_product_sku(r.currency),
        slug = NULL
    WHERE id = r.id;
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_manufacturer_products_sku
ON public.manufacturer_products (sku)
WHERE sku <> '';

CREATE UNIQUE INDEX IF NOT EXISTS uq_manufacturer_products_slug
ON public.manufacturer_products (slug)
WHERE slug IS NOT NULL AND slug <> '';

NOTIFY pgrst, 'reload schema';
