-- Short public IDs for product share links (never wrap in WhatsApp) + active-by-default guarantee.
-- Additive and idempotent.

ALTER TABLE public.manufacturer_products
ADD COLUMN IF NOT EXISTS short_id text;

CREATE OR REPLACE FUNCTION public.generate_product_short_id()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  alphabet constant text := 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate text;
  i integer;
BEGIN
  LOOP
    candidate := '';
    FOR i IN 1..8 LOOP
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.manufacturer_products WHERE short_id = candidate
    );
  END LOOP;
  RETURN candidate;
END;
$$;

CREATE OR REPLACE FUNCTION public.manufacturer_products_assign_short_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.short_id IS NULL OR btrim(NEW.short_id) = '' THEN
    NEW.short_id := public.generate_product_short_id();
  END IF;
  IF NEW.is_active IS NULL THEN
    NEW.is_active := true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_manufacturer_products_assign_short_id ON public.manufacturer_products;
CREATE TRIGGER trg_manufacturer_products_assign_short_id
BEFORE INSERT ON public.manufacturer_products
FOR EACH ROW
EXECUTE FUNCTION public.manufacturer_products_assign_short_id();

-- Backfill existing rows one by one so values stay unique.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT id FROM public.manufacturer_products
    WHERE short_id IS NULL OR btrim(short_id) = ''
  LOOP
    UPDATE public.manufacturer_products
    SET short_id = public.generate_product_short_id()
    WHERE id = r.id;
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_manufacturer_products_short_id
ON public.manufacturer_products (short_id)
WHERE short_id IS NOT NULL AND short_id <> '';

-- Persistence guarantee: new products default to active.
ALTER TABLE public.manufacturer_products
ALTER COLUMN is_active SET DEFAULT true;

UPDATE public.manufacturer_products
SET is_active = true
WHERE is_active IS NULL;

NOTIFY pgrst, 'reload schema';
