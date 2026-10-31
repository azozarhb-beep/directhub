-- Media columns for manufacturer_products (cover photo, gallery, video) + video bucket

-- `images` already exists as JSONB (array of URL strings) and is read by the
-- product detail page + sync trigger, so it is intentionally NOT altered here.
ALTER TABLE public.manufacturer_products
  ADD COLUMN IF NOT EXISTS primary_image_url TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS video_url TEXT DEFAULT NULL;

-- Backfill primary_image_url from the legacy image_url column
UPDATE public.manufacturer_products
SET primary_image_url = image_url
WHERE primary_image_url IS NULL
  AND image_url IS NOT NULL
  AND image_url <> '';

-- Public bucket for short product demo videos (30 MB limit)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-videos',
  'product-videos',
  true,
  31457280,
  ARRAY['video/mp4']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 31457280,
  allowed_mime_types = ARRAY['video/mp4'];

DROP POLICY IF EXISTS "Public can read product videos" ON storage.objects;
CREATE POLICY "Public can read product videos"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'product-videos');

DROP POLICY IF EXISTS "Authenticated can upload product videos" ON storage.objects;
CREATE POLICY "Authenticated can upload product videos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'product-videos');

DROP POLICY IF EXISTS "Authenticated can update product videos" ON storage.objects;
CREATE POLICY "Authenticated can update product videos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'product-videos')
WITH CHECK (bucket_id = 'product-videos');

DROP POLICY IF EXISTS "Authenticated can delete product videos" ON storage.objects;
CREATE POLICY "Authenticated can delete product videos"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'product-videos');
