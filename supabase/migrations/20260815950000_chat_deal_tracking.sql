-- Migration: Add deal tracking fields to chat_conversations
-- Timestamp: 20260815950000

-- Add deal_status and deal_value columns to chat_conversations if they don't exist
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

-- Add msg_type column to chat_messages for proposal tracking
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

-- Index for deal_status lookups
CREATE INDEX IF NOT EXISTS idx_chat_conversations_deal_status
  ON public.chat_conversations(deal_status);

-- Index for msg_type lookups
CREATE INDEX IF NOT EXISTS idx_chat_messages_msg_type
  ON public.chat_messages(msg_type);
