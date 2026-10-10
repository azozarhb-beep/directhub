-- Migration: Add image_url column to manufacturer_products and fix query compatibility
-- Timestamp: 20261007150000

-- Add image_url column if it doesn't exist
ALTER TABLE public.manufacturer_products
  ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT NULL;

-- Backfill image_url from compressed_image_url or first image in images JSONB array
UPDATE public.manufacturer_products
SET image_url = CASE
  WHEN compressed_image_url IS NOT NULL AND compressed_image_url != '' THEN compressed_image_url
  WHEN images IS NOT NULL AND jsonb_array_length(images) > 0 THEN
    CASE
      WHEN jsonb_typeof(images->0) = 'object' THEN (images->0->>'src')
      WHEN jsonb_typeof(images->0) = 'string' THEN (images->0)::text::text
      ELSE NULL
    END
  WHEN product_images IS NOT NULL AND jsonb_array_length(product_images) > 0 THEN
    CASE
      WHEN jsonb_typeof(product_images->0) = 'object' THEN (product_images->0->>'src')
      WHEN jsonb_typeof(product_images->0) = 'string' THEN (product_images->0)::text::text
      ELSE NULL
    END
  ELSE NULL
END
WHERE image_url IS NULL;

-- Create a trigger to keep image_url in sync when compressed_image_url or images changes
CREATE OR REPLACE FUNCTION public.sync_product_image_url()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.image_url IS NULL OR NEW.image_url = '' THEN
    IF NEW.compressed_image_url IS NOT NULL AND NEW.compressed_image_url != '' THEN
      NEW.image_url := NEW.compressed_image_url;
    ELSIF NEW.images IS NOT NULL AND jsonb_array_length(NEW.images) > 0 THEN
      IF jsonb_typeof(NEW.images->0) = 'object' THEN
        NEW.image_url := NEW.images->0->>'src';
      END IF;
    ELSIF NEW.product_images IS NOT NULL AND jsonb_array_length(NEW.product_images) > 0 THEN
      IF jsonb_typeof(NEW.product_images->0) = 'object' THEN
        NEW.image_url := NEW.product_images->0->>'src';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_product_image_url ON public.manufacturer_products;
CREATE TRIGGER trg_sync_product_image_url
  BEFORE INSERT OR UPDATE ON public.manufacturer_products
  FOR EACH ROW EXECUTE FUNCTION public.sync_product_image_url();

-- Ensure the public read policy for active products is in place
DROP POLICY IF EXISTS "public_view_active_products" ON public.manufacturer_products;
CREATE POLICY "public_view_active_products"
  ON public.manufacturer_products
  FOR SELECT
  TO public
  USING (is_active = true);

-- Ensure anon role can also read active products
DROP POLICY IF EXISTS "anon_view_active_products" ON public.manufacturer_products;
CREATE POLICY "anon_view_active_products"
  ON public.manufacturer_products
  FOR SELECT
  TO anon
  USING (is_active = true);
