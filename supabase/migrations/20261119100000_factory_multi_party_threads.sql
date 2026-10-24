-- ─────────────────────────────────────────────────────────────────────────────
-- Factory multi-party messaging threads
--  • admin     : Platform Administration (continuous direct support)
--  • agent     : Assigned account agent (auto-linked after payment confirmation)
--  • logistics : Freight coordinator / customs broker (temporary, per Shipment ID)
-- Platform admins keep read + manage visibility over every thread.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. TABLES
CREATE TABLE IF NOT EXISTS public.factory_threads (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_id       UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  thread_kind      TEXT NOT NULL DEFAULT 'admin',
  counterpart_id   UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  counterpart_name TEXT,
  shipment_ref     TEXT,
  port_of_loading  TEXT,
  container_details TEXT,
  order_ref        TEXT,
  status           TEXT NOT NULL DEFAULT 'active',
  closed_at        TIMESTAMPTZ,
  closed_reason    TEXT,
  last_message     TEXT,
  last_message_at  TIMESTAMPTZ DEFAULT now(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT factory_threads_kind_check CHECK (thread_kind IN ('admin', 'agent', 'logistics')),
  CONSTRAINT factory_threads_status_check CHECK (status IN ('active', 'closed'))
);

CREATE TABLE IF NOT EXISTS public.factory_thread_messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id        UUID NOT NULL REFERENCES public.factory_threads(id) ON DELETE CASCADE,
  sender_id        UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  sender_role      TEXT NOT NULL DEFAULT 'factory',
  message          TEXT NOT NULL DEFAULT '',
  attachment_url   TEXT,
  attachment_name  TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT factory_thread_messages_role_check CHECK (sender_role IN ('factory', 'admin', 'agent', 'logistics', 'system'))
);

-- 2. INDEXES
CREATE INDEX IF NOT EXISTS idx_factory_threads_factory ON public.factory_threads(factory_id);
CREATE INDEX IF NOT EXISTS idx_factory_threads_counterpart ON public.factory_threads(counterpart_id);
CREATE INDEX IF NOT EXISTS idx_factory_threads_kind ON public.factory_threads(thread_kind);
CREATE INDEX IF NOT EXISTS idx_factory_thread_msgs_thread ON public.factory_thread_messages(thread_id, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS uq_factory_threads_admin
  ON public.factory_threads(factory_id) WHERE thread_kind = 'admin';
CREATE UNIQUE INDEX IF NOT EXISTS uq_factory_threads_agent
  ON public.factory_threads(factory_id) WHERE thread_kind = 'agent';
CREATE UNIQUE INDEX IF NOT EXISTS uq_factory_threads_logistics_shipment
  ON public.factory_threads(factory_id, shipment_ref) WHERE thread_kind = 'logistics' AND shipment_ref IS NOT NULL;

-- 3. FUNCTIONS (before policies)
CREATE OR REPLACE FUNCTION public.factory_threads_is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid() AND up.role::TEXT = 'admin'
  )
$func$;

CREATE OR REPLACE FUNCTION public.is_factory_thread_participant(p_thread_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
  SELECT EXISTS (
    SELECT 1 FROM public.factory_threads t
    WHERE t.id = p_thread_id
      AND (t.factory_id = auth.uid() OR t.counterpart_id = auth.uid())
  )
$func$;

CREATE OR REPLACE FUNCTION public.factory_thread_touch_last_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  UPDATE public.factory_threads
  SET last_message = LEFT(COALESCE(NULLIF(NEW.message, ''), NEW.attachment_name, ''), 200),
      last_message_at = NEW.created_at
  WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$func$;

-- Auto-link the account agent once payment is confirmed (escrow funds secured).
CREATE OR REPLACE FUNCTION public.factory_link_agent_on_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_factory UUID;
  v_agent UUID;
  v_agent_name TEXT;
BEGIN
  BEGIN
    IF NEW.escrow_status IS DISTINCT FROM 'funds_secured' THEN
      RETURN NEW;
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.escrow_status IS NOT DISTINCT FROM NEW.escrow_status THEN
      RETURN NEW;
    END IF;

    v_factory := NULLIF(to_jsonb(NEW)->>'factory_user_id', '')::UUID;
    IF v_factory IS NULL THEN
      v_factory := NULLIF(to_jsonb(NEW)->>'manufacturer_id', '')::UUID;
    END IF;
    IF v_factory IS NULL THEN
      RETURN NEW;
    END IF;

    SELECT fr.referred_by_agent_id INTO v_agent
    FROM public.factory_registrations fr
    WHERE fr.user_id = v_factory AND fr.referred_by_agent_id IS NOT NULL
    ORDER BY fr.created_at DESC
    LIMIT 1;

    IF v_agent IS NULL THEN
      RETURN NEW;
    END IF;

    SELECT COALESCE(up.full_name, up.email, '') INTO v_agent_name
    FROM public.user_profiles up WHERE up.id = v_agent LIMIT 1;

    INSERT INTO public.factory_threads (factory_id, thread_kind, counterpart_id, counterpart_name, order_ref)
    VALUES (v_factory, 'agent', v_agent, v_agent_name, to_jsonb(NEW)->>'order_number')
    ON CONFLICT (factory_id) WHERE thread_kind = 'agent' DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'factory_link_agent_on_payment skipped: %', SQLERRM;
  END;
  RETURN NEW;
END;
$func$;

-- 4. RLS
ALTER TABLE public.factory_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.factory_thread_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "factory_threads_select" ON public.factory_threads;
CREATE POLICY "factory_threads_select"
ON public.factory_threads
FOR SELECT
TO authenticated
USING (factory_id = auth.uid() OR counterpart_id = auth.uid() OR public.factory_threads_is_admin());

DROP POLICY IF EXISTS "factory_threads_insert" ON public.factory_threads;
CREATE POLICY "factory_threads_insert"
ON public.factory_threads
FOR INSERT
TO authenticated
WITH CHECK (factory_id = auth.uid() OR public.factory_threads_is_admin());

DROP POLICY IF EXISTS "factory_threads_update" ON public.factory_threads;
CREATE POLICY "factory_threads_update"
ON public.factory_threads
FOR UPDATE
TO authenticated
USING (factory_id = auth.uid() OR counterpart_id = auth.uid() OR public.factory_threads_is_admin())
WITH CHECK (factory_id = auth.uid() OR counterpart_id = auth.uid() OR public.factory_threads_is_admin());

DROP POLICY IF EXISTS "factory_threads_admin_delete" ON public.factory_threads;
CREATE POLICY "factory_threads_admin_delete"
ON public.factory_threads
FOR DELETE
TO authenticated
USING (public.factory_threads_is_admin());

DROP POLICY IF EXISTS "factory_thread_msgs_select" ON public.factory_thread_messages;
CREATE POLICY "factory_thread_msgs_select"
ON public.factory_thread_messages
FOR SELECT
TO authenticated
USING (public.is_factory_thread_participant(thread_id) OR public.factory_threads_is_admin());

DROP POLICY IF EXISTS "factory_thread_msgs_insert" ON public.factory_thread_messages;
CREATE POLICY "factory_thread_msgs_insert"
ON public.factory_thread_messages
FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND (public.is_factory_thread_participant(thread_id) OR public.factory_threads_is_admin())
);

DROP POLICY IF EXISTS "factory_thread_msgs_admin_manage" ON public.factory_thread_messages;
CREATE POLICY "factory_thread_msgs_admin_manage"
ON public.factory_thread_messages
FOR DELETE
TO authenticated
USING (public.factory_threads_is_admin());

GRANT SELECT, INSERT, UPDATE ON public.factory_threads TO authenticated;
GRANT SELECT, INSERT ON public.factory_thread_messages TO authenticated;
GRANT DELETE ON public.factory_threads TO authenticated;
GRANT DELETE ON public.factory_thread_messages TO authenticated;
GRANT ALL ON public.factory_threads TO service_role;
GRANT ALL ON public.factory_thread_messages TO service_role;

-- 5. TRIGGERS
DROP TRIGGER IF EXISTS trg_factory_thread_touch ON public.factory_thread_messages;
CREATE TRIGGER trg_factory_thread_touch
AFTER INSERT ON public.factory_thread_messages
FOR EACH ROW
EXECUTE FUNCTION public.factory_thread_touch_last_message();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'escrow_status'
  ) THEN
    DROP TRIGGER IF EXISTS trg_factory_link_agent_on_payment ON public.orders;
    CREATE TRIGGER trg_factory_link_agent_on_payment
    AFTER INSERT OR UPDATE OF escrow_status ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.factory_link_agent_on_payment();
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Agent-link trigger skipped: %', SQLERRM;
END $$;

-- 6. REALTIME
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'factory_thread_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.factory_thread_messages;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'factory_threads'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.factory_threads;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Realtime publication update skipped: %', SQLERRM;
END $$;
