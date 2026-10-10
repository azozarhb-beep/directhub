-- Create product-images storage bucket with public access
-- File size limit: 10 MB (10485760 bytes)
-- Allowed types: image/jpeg, image/jpg, image/png, image/webp, image/gif

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

-- RLS policies for product-images bucket

-- Allow public read access to all product images
DROP POLICY IF EXISTS "Public can read product images" ON storage.objects;
CREATE POLICY "Public can read product images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'product-images');

-- Allow authenticated manufacturers to upload product images
DROP POLICY IF EXISTS "Manufacturers can upload product images" ON storage.objects;
CREATE POLICY "Manufacturers can upload product images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'product-images');

-- Allow authenticated manufacturers to update their product images
DROP POLICY IF EXISTS "Manufacturers can update product images" ON storage.objects;
CREATE POLICY "Manufacturers can update product images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'product-images')
WITH CHECK (bucket_id = 'product-images');

-- Allow authenticated manufacturers to delete their product images
DROP POLICY IF EXISTS "Manufacturers can delete product images" ON storage.objects;
CREATE POLICY "Manufacturers can delete product images"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'product-images');
