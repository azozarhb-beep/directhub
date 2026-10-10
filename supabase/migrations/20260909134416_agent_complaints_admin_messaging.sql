-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Agent Complaints & Admin Messaging
-- Timestamp: 20260909134416
-- Description: Adds agent_complaints table for complaint management and
--              agent_admin_messages table for agent-to-admin direct messaging
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. ENUMS ─────────────────────────────────────────────────────────────────

DROP TYPE IF EXISTS public.agent_complaint_status CASCADE;
CREATE TYPE public.agent_complaint_status AS ENUM (
  'open',
  'in_progress',
  'resolved',
  'closed'
);

DROP TYPE IF EXISTS public.agent_complaint_priority CASCADE;
CREATE TYPE public.agent_complaint_priority AS ENUM (
  'low',
  'medium',
  'high',
  'urgent'
);

-- ── 2. TABLES ────────────────────────────────────────────────────────────────

-- Agent complaints: complaints received/managed by field agents
CREATE TABLE IF NOT EXISTS public.agent_complaints (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id          UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  factory_reg_id    UUID REFERENCES public.agent_factory_registrations(id) ON DELETE SET NULL,
  factory_name      TEXT NOT NULL DEFAULT '',
  complainant_name  TEXT NOT NULL DEFAULT '',
  complainant_phone TEXT NOT NULL DEFAULT '',
  subject           TEXT NOT NULL DEFAULT '',
  description       TEXT NOT NULL DEFAULT '',
  complaint_type    TEXT NOT NULL DEFAULT 'general'
                      CHECK (complaint_type IN ('product_quality', 'delivery', 'payment', 'service', 'general', 'other')),
  priority          public.agent_complaint_priority DEFAULT 'medium'::public.agent_complaint_priority,
  status            public.agent_complaint_status DEFAULT 'open'::public.agent_complaint_status,
  agent_notes       TEXT DEFAULT '',
  resolution        TEXT DEFAULT '',
  resolved_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Agent-to-admin direct messaging
CREATE TABLE IF NOT EXISTS public.agent_admin_messages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id      UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  sender_role   TEXT NOT NULL DEFAULT 'agent'
                  CHECK (sender_role IN ('agent', 'admin', 'system')),
  message       TEXT NOT NULL DEFAULT '',
  msg_type      TEXT NOT NULL DEFAULT 'text'
                  CHECK (msg_type IN ('text', 'note', 'update', 'alert', 'document')),
  attachment_url  TEXT DEFAULT '',
  attachment_name TEXT DEFAULT '',
  is_read_by_agent BOOLEAN DEFAULT false,
  is_read_by_admin BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ── 3. INDEXES ───────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_agent_complaints_agent_id
  ON public.agent_complaints(agent_id);

CREATE INDEX IF NOT EXISTS idx_agent_complaints_status
  ON public.agent_complaints(status);

CREATE INDEX IF NOT EXISTS idx_agent_complaints_factory_reg_id
  ON public.agent_complaints(factory_reg_id)
  WHERE factory_reg_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_agent_admin_messages_agent_id
  ON public.agent_admin_messages(agent_id);

CREATE INDEX IF NOT EXISTS idx_agent_admin_messages_created_at
  ON public.agent_admin_messages(created_at DESC);

-- ── 4. FUNCTIONS ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.update_agent_complaint_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

-- ── 5. ENABLE RLS ────────────────────────────────────────────────────────────

ALTER TABLE public.agent_complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_admin_messages ENABLE ROW LEVEL SECURITY;

-- ── 6. RLS POLICIES ──────────────────────────────────────────────────────────

-- agent_complaints: agent sees only their own; admin sees all
DROP POLICY IF EXISTS "agent_complaints_select" ON public.agent_complaints;
CREATE POLICY "agent_complaints_select"
  ON public.agent_complaints
  FOR SELECT
  TO authenticated
  USING (agent_id = auth.uid() OR public.is_admin_user());

DROP POLICY IF EXISTS "agent_complaints_insert" ON public.agent_complaints;
CREATE POLICY "agent_complaints_insert"
  ON public.agent_complaints
  FOR INSERT
  TO authenticated
  WITH CHECK (agent_id = auth.uid() OR public.is_admin_user());

DROP POLICY IF EXISTS "agent_complaints_update" ON public.agent_complaints;
CREATE POLICY "agent_complaints_update"
  ON public.agent_complaints
  FOR UPDATE
  TO authenticated
  USING (agent_id = auth.uid() OR public.is_admin_user())
  WITH CHECK (agent_id = auth.uid() OR public.is_admin_user());

DROP POLICY IF EXISTS "agent_complaints_delete" ON public.agent_complaints;
CREATE POLICY "agent_complaints_delete"
  ON public.agent_complaints
  FOR DELETE
  TO authenticated
  USING (public.is_admin_user());

-- agent_admin_messages: agent sees only their own thread; admin sees all
DROP POLICY IF EXISTS "agent_admin_messages_select" ON public.agent_admin_messages;
CREATE POLICY "agent_admin_messages_select"
  ON public.agent_admin_messages
  FOR SELECT
  TO authenticated
  USING (agent_id = auth.uid() OR public.is_admin_user());

DROP POLICY IF EXISTS "agent_admin_messages_insert" ON public.agent_admin_messages;
CREATE POLICY "agent_admin_messages_insert"
  ON public.agent_admin_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (agent_id = auth.uid() OR public.is_admin_user());

DROP POLICY IF EXISTS "agent_admin_messages_update" ON public.agent_admin_messages;
CREATE POLICY "agent_admin_messages_update"
  ON public.agent_admin_messages
  FOR UPDATE
  TO authenticated
  USING (agent_id = auth.uid() OR public.is_admin_user())
  WITH CHECK (agent_id = auth.uid() OR public.is_admin_user());

-- ── 7. TRIGGERS ──────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_agent_complaint_updated_at ON public.agent_complaints;
CREATE TRIGGER trg_agent_complaint_updated_at
  BEFORE UPDATE ON public.agent_complaints
  FOR EACH ROW
  EXECUTE FUNCTION public.update_agent_complaint_updated_at();
