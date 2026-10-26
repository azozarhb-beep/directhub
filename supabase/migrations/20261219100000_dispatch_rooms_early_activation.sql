-- Early activation of field coordination rooms on shipment assignment,
-- buyer view-only participation, and auto-archive on verified delivery.

ALTER TABLE public.order_dispatch_rooms
  ADD COLUMN IF NOT EXISTS buyer_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_dispatch_rooms_buyer ON public.order_dispatch_rooms(buyer_id);

-- Buyer can read rooms (view-only) alongside existing participants
DROP POLICY IF EXISTS "dispatch_rooms_participants_select" ON public.order_dispatch_rooms;
CREATE POLICY "dispatch_rooms_participants_select"
ON public.order_dispatch_rooms
FOR SELECT
TO authenticated
USING (
  factory_id = auth.uid()
  OR agent_id = auth.uid()
  OR logistics_id = auth.uid()
  OR buyer_id = auth.uid()
  OR public.is_admin_user()
);

-- Buyer can read chat messages but cannot post (insert policy unchanged)
CREATE OR REPLACE FUNCTION public.is_dispatch_room_viewer(room_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.order_dispatch_rooms r
    WHERE r.id = room_uuid
      AND (r.factory_id = auth.uid() OR r.agent_id = auth.uid()
           OR r.logistics_id = auth.uid() OR r.buyer_id = auth.uid())
  );
$$;

DROP POLICY IF EXISTS "dispatch_msgs_participants_select" ON public.dispatch_chat_messages;
CREATE POLICY "dispatch_msgs_participants_select"
ON public.dispatch_chat_messages
FOR SELECT
TO authenticated
USING (
  public.is_dispatch_room_viewer(room_id)
  OR public.is_admin_user()
);

-- Logistics partner: open coordination rooms for assigned orders and archive delivered ones
CREATE OR REPLACE FUNCTION public.sync_logistics_dispatch_rooms()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_partner_id UUID;
  v_count INTEGER := 0;
BEGIN
  SELECT lp.id INTO v_partner_id
  FROM public.logistics_partners lp
  WHERE lp.user_id = auth.uid()
  LIMIT 1;

  IF v_partner_id IS NULL THEN
    RETURN 0;
  END IF;

  -- Create rooms for assigned, non-terminal orders that have none yet
  INSERT INTO public.order_dispatch_rooms (order_id, factory_id, agent_id, logistics_id, buyer_id, status)
  SELECT o.id, o.factory_user_id, NULL, auth.uid(), o.user_id, 'active'
  FROM public.orders o
  WHERE o.logistics_partner_id = v_partner_id
    AND o.status NOT IN ('delivered', 'cancelled', 'refunded')
    AND NOT EXISTS (SELECT 1 FROM public.order_dispatch_rooms r WHERE r.order_id = o.id);

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Backfill buyer on existing rooms of this partner
  UPDATE public.order_dispatch_rooms r
  SET buyer_id = o.user_id
  FROM public.orders o
  WHERE r.order_id = o.id
    AND r.logistics_id = auth.uid()
    AND r.buyer_id IS NULL;

  -- Archive rooms whose order is delivered (PIN / POD verified)
  UPDATE public.order_dispatch_rooms r
  SET status = 'closed',
      closed_at = now(),
      closed_reason = 'تم التسليم والتحقق عبر POD / PIN'
  FROM public.orders o
  WHERE r.order_id = o.id
    AND r.logistics_id = auth.uid()
    AND r.status = 'active'
    AND o.status = 'delivered';

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_logistics_dispatch_rooms() TO authenticated;
