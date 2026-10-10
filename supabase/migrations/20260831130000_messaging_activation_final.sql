-- ============================================================
-- Messaging Page Final Activation
-- Migration: 20260831130000_messaging_activation_final.sql
-- Ensures chat_conversations & chat_messages are fully live
-- ============================================================

-- 1. Ensure realtime is enabled on chat_messages (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'chat_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
  END IF;
END $$;

-- 2. Ensure realtime is enabled on chat_conversations (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'chat_conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_conversations;
  END IF;
END $$;

-- 3. Create chat_rooms as a view alias for chat_conversations (for compatibility)
CREATE OR REPLACE VIEW public.chat_rooms AS
  SELECT * FROM public.chat_conversations;

-- 4. Ensure deal_status column exists on chat_conversations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'chat_conversations'
      AND column_name = 'deal_status'
  ) THEN
    ALTER TABLE public.chat_conversations
      ADD COLUMN deal_status TEXT DEFAULT 'open'
      CHECK (deal_status IN ('open', 'in_progress', 'agreed', 'closed'));
  END IF;
END $$;

-- 5. Ensure deal_value column exists on chat_conversations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'chat_conversations'
      AND column_name = 'deal_value'
  ) THEN
    ALTER TABLE public.chat_conversations
      ADD COLUMN deal_value NUMERIC(15, 2) DEFAULT 0;
  END IF;
END $$;

-- 6. Ensure msg_type column exists on chat_messages
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'chat_messages'
      AND column_name = 'msg_type'
  ) THEN
    ALTER TABLE public.chat_messages
      ADD COLUMN msg_type TEXT DEFAULT 'text'
      CHECK (msg_type IN ('text', 'proposal', 'counter', 'system'));
  END IF;
END $$;

-- 7. Ensure attachment columns exist on chat_messages
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'chat_messages'
      AND column_name = 'attachment_url'
  ) THEN
    ALTER TABLE public.chat_messages
      ADD COLUMN attachment_url TEXT,
      ADD COLUMN attachment_type TEXT,
      ADD COLUMN attachment_name TEXT;
  END IF;
END $$;

-- 8. Ensure admin can read all conversations (for monitoring tab)
DROP POLICY IF EXISTS "admin_view_all_conversations" ON public.chat_conversations;
CREATE POLICY "admin_view_all_conversations"
ON public.chat_conversations
FOR SELECT
TO authenticated
USING (
  buyer_id = auth.uid()
  OR manufacturer_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- 9. Ensure admin can read all messages (for monitoring tab)
DROP POLICY IF EXISTS "admin_view_all_messages" ON public.chat_messages;
CREATE POLICY "admin_view_all_messages"
ON public.chat_messages
FOR SELECT
TO authenticated
USING (
  conversation_id IN (
    SELECT id FROM public.chat_conversations
    WHERE buyer_id = auth.uid()
       OR manufacturer_id = auth.uid()
       OR EXISTS (
         SELECT 1 FROM public.user_profiles
         WHERE id = auth.uid() AND role = 'admin'
       )
  )
);

-- 10. Performance indexes (idempotent)
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_created
  ON public.chat_messages (conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_messages_unread
  ON public.chat_messages (conversation_id, is_read, sender_id);

CREATE INDEX IF NOT EXISTS idx_chat_conversations_deal_status
  ON public.chat_conversations (deal_status);

CREATE INDEX IF NOT EXISTS idx_chat_conversations_last_message
  ON public.chat_conversations (last_message_at DESC);
