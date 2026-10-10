-- ─── Admin ↔ Factory Direct Messaging System ─────────────────────────────────
-- Allows admin/manager to send direct orders, instructions, and files to factories

-- 1. Message type enum
DROP TYPE IF EXISTS public.admin_msg_type CASCADE;
CREATE TYPE public.admin_msg_type AS ENUM ('text', 'order', 'instruction', 'file', 'system');

-- 2. Priority enum
DROP TYPE IF EXISTS public.admin_msg_priority CASCADE;
CREATE TYPE public.admin_msg_priority AS ENUM ('normal', 'high', 'urgent');

-- 3. Admin-Factory Direct Conversations table
CREATE TABLE IF NOT EXISTS public.admin_factory_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  factory_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  factory_name TEXT,
  last_message TEXT,
  last_message_at TIMESTAMPTZ DEFAULT now(),
  unread_by_factory INTEGER DEFAULT 0,
  unread_by_admin INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Admin-Factory Direct Messages table
CREATE TABLE IF NOT EXISTS public.admin_factory_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.admin_factory_conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL DEFAULT 'admin',
  message TEXT NOT NULL,
  msg_type public.admin_msg_type DEFAULT 'text',
  priority public.admin_msg_priority DEFAULT 'normal',
  attachment_url TEXT,
  attachment_type TEXT,
  attachment_name TEXT,
  is_read_by_factory BOOLEAN DEFAULT false,
  is_read_by_admin BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_admin_factory_convs_admin_id ON public.admin_factory_conversations(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_factory_convs_factory_id ON public.admin_factory_conversations(factory_id);
CREATE INDEX IF NOT EXISTS idx_admin_factory_msgs_conv_id ON public.admin_factory_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_admin_factory_msgs_created_at ON public.admin_factory_messages(created_at);

-- 6. Functions (before RLS policies)
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
SELECT EXISTS (
  SELECT 1 FROM auth.users au
  WHERE au.id = auth.uid()
  AND (
    au.raw_user_meta_data->>'role' = 'admin'
    OR au.raw_app_meta_data->>'role' = 'admin'
  )
)
$$;

-- 7. Enable RLS
ALTER TABLE public.admin_factory_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_factory_messages ENABLE ROW LEVEL SECURITY;

-- 8. RLS Policies for conversations
DROP POLICY IF EXISTS "admin_full_access_admin_factory_conversations" ON public.admin_factory_conversations;
CREATE POLICY "admin_full_access_admin_factory_conversations"
ON public.admin_factory_conversations
FOR ALL
TO authenticated
USING (
  public.is_admin_user()
  OR factory_id = auth.uid()
  OR admin_id = auth.uid()
)
WITH CHECK (
  public.is_admin_user()
  OR factory_id = auth.uid()
  OR admin_id = auth.uid()
);

-- 9. RLS Policies for messages
DROP POLICY IF EXISTS "admin_full_access_admin_factory_messages" ON public.admin_factory_messages;
CREATE POLICY "admin_full_access_admin_factory_messages"
ON public.admin_factory_messages
FOR ALL
TO authenticated
USING (
  public.is_admin_user()
  OR sender_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.admin_factory_conversations c
    WHERE c.id = conversation_id
    AND (c.factory_id = auth.uid() OR c.admin_id = auth.uid())
  )
)
WITH CHECK (
  public.is_admin_user()
  OR sender_id = auth.uid()
);

-- 10. Trigger to update conversation last_message on new message
CREATE OR REPLACE FUNCTION public.update_admin_factory_conv_last_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.admin_factory_conversations
  SET
    last_message = NEW.message,
    last_message_at = NEW.created_at,
    unread_by_factory = CASE
      WHEN NEW.sender_role = 'admin' THEN unread_by_factory + 1
      ELSE unread_by_factory
    END,
    unread_by_admin = CASE
      WHEN NEW.sender_role != 'admin' THEN unread_by_admin + 1
      ELSE unread_by_admin
    END
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_admin_factory_message_insert ON public.admin_factory_messages;
CREATE TRIGGER on_admin_factory_message_insert
AFTER INSERT ON public.admin_factory_messages
FOR EACH ROW
EXECUTE FUNCTION public.update_admin_factory_conv_last_message();
