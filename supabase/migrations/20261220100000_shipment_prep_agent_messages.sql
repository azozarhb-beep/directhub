-- Direct operational thread between logistics and the Order Prep & Fulfillment Agent, per shipment.
-- Separate from admin support (admin_conversations) and dispatch rooms.

CREATE TABLE IF NOT EXISTS public.shipment_prep_agent_messages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id   UUID NOT NULL REFERENCES public.logistics_shipments(id) ON DELETE CASCADE,
  sender_id     UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  sender_side   TEXT NOT NULL DEFAULT 'logistics',
  message_text  TEXT,
  quick_action  TEXT,
  attachments   JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shipment_prep_agent_messages_shipment
  ON public.shipment_prep_agent_messages (shipment_id, created_at);

CREATE OR REPLACE FUNCTION public.can_access_shipment_prep_thread(p_shipment_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
  SELECT EXISTS (
    SELECT 1
    FROM public.logistics_shipments s
    LEFT JOIN public.logistics_partners lp ON lp.id = s.logistics_partner_id
    WHERE s.id = p_shipment_id
      AND (
        lp.user_id = auth.uid()
        OR s.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.user_profiles up
          WHERE up.id = auth.uid() AND up.role::text = 'admin'
        )
      )
  );
$func$;

ALTER TABLE public.shipment_prep_agent_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prep_thread_select" ON public.shipment_prep_agent_messages;
CREATE POLICY "prep_thread_select"
ON public.shipment_prep_agent_messages
FOR SELECT
TO authenticated
USING (public.can_access_shipment_prep_thread(shipment_id));

DROP POLICY IF EXISTS "prep_thread_insert" ON public.shipment_prep_agent_messages;
CREATE POLICY "prep_thread_insert"
ON public.shipment_prep_agent_messages
FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND public.can_access_shipment_prep_thread(shipment_id)
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.shipment_prep_agent_messages;
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END IF;
END $$;
