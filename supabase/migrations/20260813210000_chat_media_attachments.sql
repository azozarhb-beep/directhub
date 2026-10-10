-- Migration: Add chat media attachments support + chat-media storage bucket
-- Timestamp: 20260813210000

-- Add attachment columns to chat_messages table
ALTER TABLE public.chat_messages
ADD COLUMN IF NOT EXISTS attachment_url TEXT,
ADD COLUMN IF NOT EXISTS attachment_type TEXT,
ADD COLUMN IF NOT EXISTS attachment_name TEXT;

-- Create index for attachment queries
CREATE INDEX IF NOT EXISTS idx_chat_messages_attachment ON public.chat_messages(attachment_url) WHERE attachment_url IS NOT NULL;

-- Create chat-media storage bucket (idempotent via INSERT ON CONFLICT)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-media',
  'chat-media',
  true,
  26214400,  -- 25MB
  ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'video/mp4', 'video/quicktime', 'video/webm',
    'application/pdf'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for chat-media bucket
DROP POLICY IF EXISTS "chat_media_upload_authenticated" ON storage.objects;
CREATE POLICY "chat_media_upload_authenticated"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'chat-media');

DROP POLICY IF EXISTS "chat_media_read_public" ON storage.objects;
CREATE POLICY "chat_media_read_public"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'chat-media');

DROP POLICY IF EXISTS "chat_media_delete_own" ON storage.objects;
CREATE POLICY "chat_media_delete_own"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'chat-media' AND auth.uid()::text = (storage.foldername(name))[1]);
