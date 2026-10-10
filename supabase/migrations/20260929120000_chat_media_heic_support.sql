-- ============================================================
-- Fix: chat image uploads rejected with HTTP 415 for iPhone photos
-- ============================================================

-- 1) Widen chat-media to match what clients actually send
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'image/jpeg',
  'image/jpg',     -- non-canonical spelling sent by some browsers
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',    -- iOS default photo format
  'image/heif',
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'application/pdf'
]
WHERE id = 'chat-media';

-- 2) Fix own-file DELETE: app paths are "<prefix>/<uid>/<file>", so
--    foldername[1] is the prefix ("unified-chat", "chat-attachments", …)
--    and never the user id. The old policy therefore never matched and
--    users could not delete their own chat attachments.
DROP POLICY IF EXISTS "chat_media_delete_own" ON storage.objects;
CREATE POLICY "chat_media_delete_own"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'chat-media'
  AND (
    -- legacy layout: "<uid>/<file>"
    auth.uid()::text = (storage.foldername(name))[1]
    -- current layout: "<prefix>/<uid>/<file>"
    OR auth.uid()::text = (storage.foldername(name))[2]
  )
);
