-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Agent Messaging, Document Uploads & Info Exchange
-- Timestamp: 20260905150000
-- Description: Adds agent ↔ factory/supplier direct messaging with strict
--              scoping, document/product/image uploads, and two-way info exchange
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. TABLES ────────────────────────────────────────────────────────────────

-- Agent ↔ Factory/Supplier Conversations (scoped: agent sees only their own)
CREATE TABLE IF NOT EXISTS public.agent_conversations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id          UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  factory_reg_id    UUID NOT NULL REFERENCES public.agent_factory_registrations(id) ON DELETE CASCADE,
  factory_name      TEXT NOT NULL DEFAULT '',
  factory_type      TEXT NOT NULL DEFAULT 'local_factory',
  last_message      TEXT DEFAULT '',
  last_message_at   TIMESTAMPTZ DEFAULT now(),
  unread_by_agent   INTEGER DEFAULT 0,
  is_active         BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

-- Messages within agent conversations
CREATE TABLE IF NOT EXISTS public.agent_messages (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id   UUID NOT NULL REFERENCES public.agent_conversations(id) ON DELETE CASCADE,
  agent_id          UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  sender_role       TEXT NOT NULL DEFAULT 'agent' CHECK (sender_role IN ('agent', 'factory', 'system')),
  message           TEXT NOT NULL DEFAULT '',
  msg_type          TEXT NOT NULL DEFAULT 'text' CHECK (msg_type IN ('text', 'note', 'requirement', 'update', 'file', 'image', 'document')),
  attachment_url    TEXT DEFAULT '',
  attachment_name   TEXT DEFAULT '',
  attachment_type   TEXT DEFAULT '',
  is_read           BOOLEAN DEFAULT false,
  created_at        TIMESTAMPTZ DEFAULT now()
);

-- Document & file uploads for agent-registered factories/suppliers
CREATE TABLE IF NOT EXISTS public.agent_factory_documents (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id          UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  factory_reg_id    UUID NOT NULL REFERENCES public.agent_factory_registrations(id) ON DELETE CASCADE,
  doc_type          TEXT NOT NULL DEFAULT 'document'
                      CHECK (doc_type IN ('license', 'registration', 'product_catalog', 'image', 'certificate', 'other')),
  file_url          TEXT NOT NULL DEFAULT '',
  file_name         TEXT NOT NULL DEFAULT '',
  file_size         INTEGER DEFAULT 0,
  mime_type         TEXT DEFAULT '',
  description       TEXT DEFAULT '',
  uploaded_by       UUID REFERENCES public.user_profiles(id),
  created_at        TIMESTAMPTZ DEFAULT now()
);

-- Two-way info exchange entries (notes, requirements, updates)
CREATE TABLE IF NOT EXISTS public.agent_info_exchange (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id          UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  factory_reg_id    UUID NOT NULL REFERENCES public.agent_factory_registrations(id) ON DELETE CASCADE,
  direction         TEXT NOT NULL DEFAULT 'agent_to_factory'
                      CHECK (direction IN ('agent_to_factory', 'factory_to_agent')),
  entry_type        TEXT NOT NULL DEFAULT 'note'
                      CHECK (entry_type IN ('note', 'requirement', 'update', 'document_request', 'status_change', 'general')),
  title             TEXT NOT NULL DEFAULT '',
  content           TEXT NOT NULL DEFAULT '',
  is_resolved       BOOLEAN DEFAULT false,
  resolved_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

-- ── 2. INDEXES ───────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_agent_conversations_agent_id
  ON public.agent_conversations(agent_id);

CREATE INDEX IF NOT EXISTS idx_agent_conversations_factory_reg_id
  ON public.agent_conversations(factory_reg_id);

CREATE INDEX IF NOT EXISTS idx_agent_conversations_last_msg_at
  ON public.agent_conversations(last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_messages_conv_id
  ON public.agent_messages(conversation_id);

CREATE INDEX IF NOT EXISTS idx_agent_messages_created_at
  ON public.agent_messages(created_at);

CREATE INDEX IF NOT EXISTS idx_agent_factory_docs_agent_id
  ON public.agent_factory_documents(agent_id);

CREATE INDEX IF NOT EXISTS idx_agent_factory_docs_factory_reg_id
  ON public.agent_factory_documents(factory_reg_id);

CREATE INDEX IF NOT EXISTS idx_agent_info_exchange_agent_id
  ON public.agent_info_exchange(agent_id);

CREATE INDEX IF NOT EXISTS idx_agent_info_exchange_factory_reg_id
  ON public.agent_info_exchange(factory_reg_id);

-- ── 3. FUNCTIONS ─────────────────────────────────────────────────────────────

-- Update conversation last_message on new message insert
CREATE OR REPLACE FUNCTION public.update_agent_conversation_last_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.agent_conversations
  SET
    last_message = NEW.message,
    last_message_at = NEW.created_at,
    unread_by_agent = CASE
      WHEN NEW.sender_role != 'agent' THEN unread_by_agent + 1
      ELSE unread_by_agent
    END,
    updated_at = now()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

-- Auto-update updated_at for agent_conversations
CREATE OR REPLACE FUNCTION public.update_agent_conversation_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Auto-update updated_at for agent_info_exchange
CREATE OR REPLACE FUNCTION public.update_agent_info_exchange_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ── 4. ENABLE RLS ────────────────────────────────────────────────────────────

ALTER TABLE public.agent_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_factory_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_info_exchange ENABLE ROW LEVEL SECURITY;

-- ── 5. RLS POLICIES ──────────────────────────────────────────────────────────

-- agent_conversations: strict scoping — agent sees ONLY their own conversations
DROP POLICY IF EXISTS "agent_conversations_scoped_access" ON public.agent_conversations;
CREATE POLICY "agent_conversations_scoped_access"
  ON public.agent_conversations
  FOR ALL
  TO authenticated
  USING (agent_id = auth.uid() OR public.is_admin_user())
  WITH CHECK (agent_id = auth.uid() OR public.is_admin_user());

-- agent_messages: agent sees only messages in their own conversations
DROP POLICY IF EXISTS "agent_messages_scoped_access" ON public.agent_messages;
CREATE POLICY "agent_messages_scoped_access"
  ON public.agent_messages
  FOR ALL
  TO authenticated
  USING (
    agent_id = auth.uid()
    OR public.is_admin_user()
    OR EXISTS (
      SELECT 1 FROM public.agent_conversations c
      WHERE c.id = conversation_id
        AND c.agent_id = auth.uid()
    )
  )
  WITH CHECK (
    agent_id = auth.uid()
    OR public.is_admin_user()
  );

-- agent_factory_documents: agent sees only their own factory documents
DROP POLICY IF EXISTS "agent_factory_docs_scoped_access" ON public.agent_factory_documents;
CREATE POLICY "agent_factory_docs_scoped_access"
  ON public.agent_factory_documents
  FOR ALL
  TO authenticated
  USING (agent_id = auth.uid() OR public.is_admin_user())
  WITH CHECK (agent_id = auth.uid() OR public.is_admin_user());

-- agent_info_exchange: agent sees only their own exchange entries
DROP POLICY IF EXISTS "agent_info_exchange_scoped_access" ON public.agent_info_exchange;
CREATE POLICY "agent_info_exchange_scoped_access"
  ON public.agent_info_exchange
  FOR ALL
  TO authenticated
  USING (agent_id = auth.uid() OR public.is_admin_user())
  WITH CHECK (agent_id = auth.uid() OR public.is_admin_user());

-- ── 6. TRIGGERS ──────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_agent_message_update_conv ON public.agent_messages;
CREATE TRIGGER trg_agent_message_update_conv
  AFTER INSERT ON public.agent_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_agent_conversation_last_message();

DROP TRIGGER IF EXISTS trg_agent_conversation_updated_at ON public.agent_conversations;
CREATE TRIGGER trg_agent_conversation_updated_at
  BEFORE UPDATE ON public.agent_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_agent_conversation_updated_at();

DROP TRIGGER IF EXISTS trg_agent_info_exchange_updated_at ON public.agent_info_exchange;
CREATE TRIGGER trg_agent_info_exchange_updated_at
  BEFORE UPDATE ON public.agent_info_exchange
  FOR EACH ROW EXECUTE FUNCTION public.update_agent_info_exchange_updated_at();
