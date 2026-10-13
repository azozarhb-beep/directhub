-- ─────────────────────────────────────────────────────────────────────────────
-- Fix Logistics Partner Admin Messaging
-- 1. Enable Realtime on admin_conversations and admin_messages
-- 2. Ensure logistics_partners user_id is properly indexed for joins
-- 3. Fix RLS to allow logistics partners to create admin_conversations
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Enable Realtime publication for admin messaging tables
DO $$
BEGIN
  -- Add admin_conversations to realtime if not already there
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND schemaname = 'public'
    AND tablename = 'admin_conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_conversations;
  END IF;

  -- Add admin_messages to realtime if not already there
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND schemaname = 'public'
    AND tablename = 'admin_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_messages;
  END IF;
END $$;

-- 2. Ensure index on logistics_partners.user_id for fast joins
CREATE INDEX IF NOT EXISTS idx_logistics_partners_user_id_lookup
  ON public.logistics_partners(user_id)
  WHERE user_id IS NOT NULL;

-- 3. Fix RLS on admin_conversations to allow logistics partners to INSERT
--    (they need to create a conversation when contacting admin for the first time)
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

-- 4. Fix RLS on admin_messages to allow logistics partners to INSERT messages
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

-- 5. Ensure the trigger for updating last_message is active
DROP TRIGGER IF EXISTS on_admin_message_insert ON public.admin_messages;
CREATE TRIGGER on_admin_message_insert
AFTER INSERT ON public.admin_messages
FOR EACH ROW
EXECUTE FUNCTION public.update_admin_conv_last_message();

-- 6. Add participant_category column to admin_conversations if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'admin_conversations'
    AND column_name = 'participant_category'
  ) THEN
    ALTER TABLE public.admin_conversations ADD COLUMN participant_category TEXT;
  END IF;
END $$;
