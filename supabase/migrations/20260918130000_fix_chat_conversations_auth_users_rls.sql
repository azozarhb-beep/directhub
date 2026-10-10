-- Migration: Fix chat_conversations RLS "permission denied for table users"
-- Timestamp: 20260918130000
--
-- Root cause: policies in 20260915195000 query auth.users directly.
-- The authenticated role cannot SELECT auth.users, so EVERY select on
-- chat_conversations fails with 42501 even for the conversation owner.
--
-- Fix: use public.is_admin_user() (SECURITY DEFINER) for admin checks.
-- Participant checks use auth.uid() only — no auth.users table access.

ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chat_conversations_select" ON public.chat_conversations;
DROP POLICY IF EXISTS "chat_conversations_insert" ON public.chat_conversations;
DROP POLICY IF EXISTS "chat_conversations_update" ON public.chat_conversations;
DROP POLICY IF EXISTS "chat_conversations_delete" ON public.chat_conversations;
DROP POLICY IF EXISTS "buyers_create_conversations" ON public.chat_conversations;
DROP POLICY IF EXISTS "participants_view_own_conversations" ON public.chat_conversations;
DROP POLICY IF EXISTS "participants_update_conversations" ON public.chat_conversations;
DROP POLICY IF EXISTS "admin_view_all_conversations" ON public.chat_conversations;

-- SELECT: participants + admins
CREATE POLICY "chat_conversations_select"
ON public.chat_conversations
FOR SELECT
TO authenticated
USING (
  buyer_id = auth.uid()
  OR manufacturer_id = auth.uid()
  OR public.is_admin_user()
);

-- INSERT: creator must be the buyer
CREATE POLICY "chat_conversations_insert"
ON public.chat_conversations
FOR INSERT
TO authenticated
WITH CHECK (buyer_id = auth.uid());

-- UPDATE: participants + admins
CREATE POLICY "chat_conversations_update"
ON public.chat_conversations
FOR UPDATE
TO authenticated
USING (
  buyer_id = auth.uid()
  OR manufacturer_id = auth.uid()
  OR public.is_admin_user()
)
WITH CHECK (
  buyer_id = auth.uid()
  OR manufacturer_id = auth.uid()
  OR public.is_admin_user()
);

-- DELETE: admins only
CREATE POLICY "chat_conversations_delete"
ON public.chat_conversations
FOR DELETE
TO authenticated
USING (public.is_admin_user());

-- Also fix chat_messages admin policies if they query auth.users inline
-- (recreate participant policies safely via conversation ownership only)
DROP POLICY IF EXISTS "admin_view_all_messages" ON public.chat_messages;
DROP POLICY IF EXISTS "participants_view_messages" ON public.chat_messages;
DROP POLICY IF EXISTS "participants_send_messages" ON public.chat_messages;

CREATE POLICY "participants_view_messages"
ON public.chat_messages
FOR SELECT
TO authenticated
USING (
  public.is_admin_user()
  OR conversation_id IN (
    SELECT id FROM public.chat_conversations
    WHERE buyer_id = auth.uid() OR manufacturer_id = auth.uid()
  )
);

CREATE POLICY "participants_send_messages"
ON public.chat_messages
FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND (
    public.is_admin_user()
    OR conversation_id IN (
      SELECT id FROM public.chat_conversations
      WHERE buyer_id = auth.uid() OR manufacturer_id = auth.uid()
    )
  )
);
