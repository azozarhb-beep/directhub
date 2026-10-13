-- ─────────────────────────────────────────────────────────────────────────────
-- Order Operations & Dispatch Chat System
-- Tables: order_dispatch_rooms, dispatch_chat_messages
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. ENUM TYPES
DROP TYPE IF EXISTS public.dispatch_room_status CASCADE;
CREATE TYPE public.dispatch_room_status AS ENUM ('active', 'closed');

DROP TYPE IF EXISTS public.dispatch_sender_role CASCADE;
CREATE TYPE public.dispatch_sender_role AS ENUM ('factory', 'agent', 'logistics');

-- 2. TABLES

CREATE TABLE IF NOT EXISTS public.order_dispatch_rooms (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  factory_id   UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  agent_id     UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  logistics_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  status       public.dispatch_room_status NOT NULL DEFAULT 'active',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at    TIMESTAMPTZ,
  closed_reason TEXT
);

CREATE TABLE IF NOT EXISTS public.dispatch_chat_messages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id      UUID NOT NULL REFERENCES public.order_dispatch_rooms(id) ON DELETE CASCADE,
  sender_id    UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  sender_role  public.dispatch_sender_role NOT NULL,
  message_text TEXT,
  attachments  JSONB DEFAULT '[]'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. INDEXES
CREATE INDEX IF NOT EXISTS idx_dispatch_rooms_order_id   ON public.order_dispatch_rooms(order_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_rooms_status     ON public.order_dispatch_rooms(status);
CREATE INDEX IF NOT EXISTS idx_dispatch_rooms_factory    ON public.order_dispatch_rooms(factory_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_rooms_agent      ON public.order_dispatch_rooms(agent_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_rooms_logistics  ON public.order_dispatch_rooms(logistics_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_msgs_room_id     ON public.dispatch_chat_messages(room_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_msgs_sender      ON public.dispatch_chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_msgs_created     ON public.dispatch_chat_messages(created_at);

-- 4. HELPER FUNCTIONS (before RLS policies)

CREATE OR REPLACE FUNCTION public.is_dispatch_room_participant(room_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.order_dispatch_rooms r
    WHERE r.id = room_uuid
      AND (r.factory_id = auth.uid() OR r.agent_id = auth.uid() OR r.logistics_id = auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid() AND up.role = 'admin'
  );
$$;

-- 5. ENABLE RLS
ALTER TABLE public.order_dispatch_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatch_chat_messages ENABLE ROW LEVEL SECURITY;

-- 6. RLS POLICIES — order_dispatch_rooms

DROP POLICY IF EXISTS "dispatch_rooms_participants_select" ON public.order_dispatch_rooms;
CREATE POLICY "dispatch_rooms_participants_select"
ON public.order_dispatch_rooms
FOR SELECT
TO authenticated
USING (
  factory_id = auth.uid()
  OR agent_id = auth.uid()
  OR logistics_id = auth.uid()
  OR public.is_admin_user()
);

DROP POLICY IF EXISTS "dispatch_rooms_admin_insert" ON public.order_dispatch_rooms;
CREATE POLICY "dispatch_rooms_admin_insert"
ON public.order_dispatch_rooms
FOR INSERT
TO authenticated
WITH CHECK (
  factory_id = auth.uid() OR public.is_admin_user()
);

DROP POLICY IF EXISTS "dispatch_rooms_admin_update" ON public.order_dispatch_rooms;
CREATE POLICY "dispatch_rooms_admin_update"
ON public.order_dispatch_rooms
FOR UPDATE
TO authenticated
USING (
  factory_id = auth.uid()
  OR agent_id = auth.uid()
  OR logistics_id = auth.uid()
  OR public.is_admin_user()
)
WITH CHECK (
  factory_id = auth.uid()
  OR agent_id = auth.uid()
  OR logistics_id = auth.uid()
  OR public.is_admin_user()
);

-- 6b. RLS POLICIES — dispatch_chat_messages

DROP POLICY IF EXISTS "dispatch_msgs_participants_select" ON public.dispatch_chat_messages;
CREATE POLICY "dispatch_msgs_participants_select"
ON public.dispatch_chat_messages
FOR SELECT
TO authenticated
USING (
  public.is_dispatch_room_participant(room_id)
  OR public.is_admin_user()
);

DROP POLICY IF EXISTS "dispatch_msgs_participants_insert" ON public.dispatch_chat_messages;
CREATE POLICY "dispatch_msgs_participants_insert"
ON public.dispatch_chat_messages
FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND public.is_dispatch_room_participant(room_id)
);

-- 7. REALTIME — enable publication for both tables
DO $$
BEGIN
  -- order_dispatch_rooms
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'order_dispatch_rooms'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.order_dispatch_rooms;
  END IF;

  -- dispatch_chat_messages
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'dispatch_chat_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.dispatch_chat_messages;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Realtime publication update skipped: %', SQLERRM;
END $$;
