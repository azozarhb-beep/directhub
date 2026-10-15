-- Product media (up to 4 images + 1 video) for agent products

ALTER TABLE public.agent_products
  ADD COLUMN IF NOT EXISTS images text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS video_url text DEFAULT NULL;

-- Storage bucket (public read), 30 MB limit
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-media',
  'product-media',
  true,
  31457280,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'video/mp4', 'video/webm']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 31457280,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'video/mp4', 'video/webm'];

DROP POLICY IF EXISTS "Public can read product media" ON storage.objects;
CREATE POLICY "Public can read product media"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'product-media');

DROP POLICY IF EXISTS "Authenticated can upload product media" ON storage.objects;
CREATE POLICY "Authenticated can upload product media"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'product-media');

DROP POLICY IF EXISTS "Authenticated can update product media" ON storage.objects;
CREATE POLICY "Authenticated can update product media"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'product-media' AND owner = auth.uid())
WITH CHECK (bucket_id = 'product-media');

DROP POLICY IF EXISTS "Authenticated can delete own product media" ON storage.objects;
CREATE POLICY "Authenticated can delete own product media"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'product-media' AND owner = auth.uid());
