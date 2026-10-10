-- ============================================================
-- Fix: chat_conversations INSERT RLS policy
-- Migration: 20260915195000_fix_chat_conversations_insert_rls.sql
-- Error: "new row violates row-level security policy for table chat_conversations"
-- Root cause: INSERT policy may be missing or too restrictive.
-- Fix: Drop and recreate all chat_conversations RLS policies to ensure
--      any authenticated user can create a conversation where they are
--      the buyer, and participants + admins can view/update.
-- ============================================================

-- 1. Ensure RLS is enabled (idempotent)
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;

-- 2. Drop all existing policies on chat_conversations (clean slate)
DROP POLICY IF EXISTS "buyers_create_conversations" ON public.chat_conversations;
DROP POLICY IF EXISTS "participants_view_own_conversations" ON public.chat_conversations;
DROP POLICY IF EXISTS "participants_update_conversations" ON public.chat_conversations;
DROP POLICY IF EXISTS "admin_view_all_conversations" ON public.chat_conversations;

-- 3. SELECT: participants (buyer or manufacturer) and admins can view
DROP POLICY IF EXISTS "chat_conversations_select" ON public.chat_conversations;
CREATE POLICY "chat_conversations_select"
ON public.chat_conversations
FOR SELECT
TO authenticated
USING (
  buyer_id = auth.uid()
  OR manufacturer_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM auth.users au
    WHERE au.id = auth.uid()
    AND (
      au.raw_user_meta_data->>'role' = 'admin'
      OR au.raw_app_meta_data->>'role' = 'admin'
    )
  )
);

-- 4. INSERT: any authenticated user can create a conversation where they are the buyer
DROP POLICY IF EXISTS "chat_conversations_insert" ON public.chat_conversations;
CREATE POLICY "chat_conversations_insert"
ON public.chat_conversations
FOR INSERT
TO authenticated
WITH CHECK (buyer_id = auth.uid());

-- 5. UPDATE: participants (buyer or manufacturer) and admins can update
DROP POLICY IF EXISTS "chat_conversations_update" ON public.chat_conversations;
CREATE POLICY "chat_conversations_update"
ON public.chat_conversations
FOR UPDATE
TO authenticated
USING (
  buyer_id = auth.uid()
  OR manufacturer_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM auth.users au
    WHERE au.id = auth.uid()
    AND (
      au.raw_user_meta_data->>'role' = 'admin'
      OR au.raw_app_meta_data->>'role' = 'admin'
    )
  )
)
WITH CHECK (
  buyer_id = auth.uid()
  OR manufacturer_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM auth.users au
    WHERE au.id = auth.uid()
    AND (
      au.raw_user_meta_data->>'role' = 'admin'
      OR au.raw_app_meta_data->>'role' = 'admin'
    )
  )
);

-- 6. DELETE: only admins can delete conversations
DROP POLICY IF EXISTS "chat_conversations_delete" ON public.chat_conversations;
CREATE POLICY "chat_conversations_delete"
ON public.chat_conversations
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users au
    WHERE au.id = auth.uid()
    AND (
      au.raw_user_meta_data->>'role' = 'admin'
      OR au.raw_app_meta_data->>'role' = 'admin'
    )
  )
);
