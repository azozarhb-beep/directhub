-- ─────────────────────────────────────────────────────────────────────────────
-- Admin Cross-Role Messaging System
-- Extends admin messaging to cover ALL platform roles:
--   suppliers/factories, logistics partners, agents/representatives, buyers
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Participant role enum
DROP TYPE IF EXISTS public.admin_conv_participant_role CASCADE;
CREATE TYPE public.admin_conv_participant_role AS ENUM (
  'manufacturer',
  'supplier',
  'logistics_partner',
  'agent',
  'buyer',
  'admin'
);

-- 2. Admin cross-role conversations table
CREATE TABLE IF NOT EXISTS public.admin_conversations (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id             UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  participant_id       UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  participant_role     public.admin_conv_participant_role NOT NULL DEFAULT 'buyer',
  participant_name     TEXT,
  participant_company  TEXT,
  subject              TEXT,
  last_message         TEXT,
  last_message_at      TIMESTAMPTZ,
  unread_by_admin      INT DEFAULT 0,
  unread_by_participant INT DEFAULT 0,
  is_active            BOOLEAN DEFAULT true,
  created_at           TIMESTAMPTZ DEFAULT now()
);

-- 3. Admin cross-role messages table
CREATE TABLE IF NOT EXISTS public.admin_messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  UUID NOT NULL REFERENCES public.admin_conversations(id) ON DELETE CASCADE,
  sender_id        UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  sender_role      TEXT NOT NULL DEFAULT 'admin',
  message          TEXT NOT NULL,
  msg_type         TEXT NOT NULL DEFAULT 'text',
  attachment_url   TEXT,
  attachment_name  TEXT,
  attachment_type  TEXT,
  is_read_by_admin BOOLEAN DEFAULT true,
  is_read_by_participant BOOLEAN DEFAULT false,
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_admin_convs_admin_id        ON public.admin_conversations(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_convs_participant_id  ON public.admin_conversations(participant_id);
CREATE INDEX IF NOT EXISTS idx_admin_convs_role            ON public.admin_conversations(participant_role);
CREATE INDEX IF NOT EXISTS idx_admin_convs_last_msg        ON public.admin_conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_msgs_conv_id          ON public.admin_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_admin_msgs_created_at       ON public.admin_messages(created_at);

-- 5. Function: update last_message on admin_conversations when a new message is inserted
CREATE OR REPLACE FUNCTION public.update_admin_conv_last_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.admin_conversations
  SET
    last_message     = NEW.message,
    last_message_at  = NEW.created_at,
    unread_by_admin  = CASE
      WHEN NEW.sender_role != 'admin' THEN unread_by_admin + 1
      ELSE unread_by_admin
    END,
    unread_by_participant = CASE
      WHEN NEW.sender_role = 'admin' THEN unread_by_participant + 1
      ELSE unread_by_participant
    END
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

-- 6. Enable RLS
ALTER TABLE public.admin_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_messages      ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies for admin_conversations
DROP POLICY IF EXISTS "admin_full_access_admin_conversations" ON public.admin_conversations;
CREATE POLICY "admin_full_access_admin_conversations"
ON public.admin_conversations
FOR ALL
TO authenticated
USING (
  public.is_admin_user()
  OR participant_id = auth.uid()
  OR admin_id = auth.uid()
)
WITH CHECK (
  public.is_admin_user()
  OR participant_id = auth.uid()
  OR admin_id = auth.uid()
);

-- 8. RLS Policies for admin_messages
DROP POLICY IF EXISTS "admin_full_access_admin_messages" ON public.admin_messages;
CREATE POLICY "admin_full_access_admin_messages"
ON public.admin_messages
FOR ALL
TO authenticated
USING (
  public.is_admin_user()
  OR sender_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.admin_conversations c
    WHERE c.id = conversation_id
    AND (c.participant_id = auth.uid() OR c.admin_id = auth.uid())
  )
)
WITH CHECK (
  public.is_admin_user()
  OR sender_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.admin_conversations c
    WHERE c.id = conversation_id
    AND (c.participant_id = auth.uid() OR c.admin_id = auth.uid())
  )
);

-- 9. Trigger: auto-update last_message on new message insert
DROP TRIGGER IF EXISTS on_admin_message_insert ON public.admin_messages;
CREATE TRIGGER on_admin_message_insert
AFTER INSERT ON public.admin_messages
FOR EACH ROW
EXECUTE FUNCTION public.update_admin_conv_last_message();
