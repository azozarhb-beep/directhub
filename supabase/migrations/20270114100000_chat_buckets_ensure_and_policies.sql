-- Ensure chat storage buckets exist and are usable by every authenticated chat participant.
-- Buckets stay private (signed URLs are generated at render time via getChatMediaSignedUrl),
-- which avoids "Bucket not found" (NoSuchBucket) responses from the public object endpoint.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-media',
  'chat-media',
  false,
  26214400,
  ARRAY[
    'image/jpeg','image/jpg','image/png','image/webp','image/gif','image/heic','image/heif',
    'video/mp4','video/quicktime','video/webm','application/pdf'
  ]
)
ON CONFLICT (id) DO UPDATE
SET file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-attachments',
  'chat-attachments',
  false,
  26214400,
  ARRAY[
    'image/jpeg','image/jpg','image/png','image/webp','image/gif','image/heic','image/heif',
    'video/mp4','video/quicktime','video/webm','application/pdf'
  ]
)
ON CONFLICT (id) DO UPDATE
SET file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- chat-media policies
DROP POLICY IF EXISTS "chat_media_upload_authenticated" ON storage.objects;
CREATE POLICY "chat_media_upload_authenticated"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'chat-media');

DROP POLICY IF EXISTS "chat_media_read_authenticated" ON storage.objects;
CREATE POLICY "chat_media_read_authenticated"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'chat-media');

-- chat-attachments policies
DROP POLICY IF EXISTS "authenticated_insert_chat_attachments" ON storage.objects;
CREATE POLICY "authenticated_insert_chat_attachments"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'chat-attachments');

DROP POLICY IF EXISTS "chat_attachments_read_authenticated" ON storage.objects;
CREATE POLICY "chat_attachments_read_authenticated"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'chat-attachments');
