-- Agent production tracking actions: progress photos, delay flag, mark ready for field inspection.
-- Agents never get direct UPDATE on orders; everything goes through SECURITY DEFINER functions.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS agent_production_photos JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS agent_delay_flagged_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS agent_delay_reason TEXT,
  ADD COLUMN IF NOT EXISTS agent_delay_days INTEGER;

-- 1) Append production line progress photos (array of public URLs)
CREATE OR REPLACE FUNCTION public.agent_add_production_photos(p_order_id UUID, p_urls TEXT[])
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF NOT public.agent_manages_order(p_order_id, auth.uid()) THEN
    RAISE EXCEPTION 'order is not managed by this agent';
  END IF;

  UPDATE public.orders
  SET agent_production_photos = COALESCE(agent_production_photos, '[]'::jsonb)
        || COALESCE(
             (SELECT jsonb_agg(jsonb_build_object('url', u, 'uploaded_at', CURRENT_TIMESTAMP))
              FROM unnest(COALESCE(p_urls, ARRAY[]::TEXT[])) AS u),
             '[]'::jsonb
           ),
      updated_at = CURRENT_TIMESTAMP
  WHERE id = p_order_id;

  RETURN TRUE;
END;
$func$;

-- 2) Flag a production delay
CREATE OR REPLACE FUNCTION public.agent_flag_production_delay(
  p_order_id UUID,
  p_reason TEXT,
  p_days INTEGER DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF NOT public.agent_manages_order(p_order_id, auth.uid()) THEN
    RAISE EXCEPTION 'order is not managed by this agent';
  END IF;

  UPDATE public.orders
  SET agent_delay_flagged_at = CURRENT_TIMESTAMP,
      agent_delay_reason = NULLIF(TRIM(COALESCE(p_reason, '')), ''),
      agent_delay_days = p_days,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = p_order_id;

  RETURN TRUE;
END;
$func$;

-- 3) Mark goods ready for field inspection and auto-open the coordination room
CREATE OR REPLACE FUNCTION public.agent_mark_ready_for_field_inspection(
  p_order_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_room_id UUID;
  v_factory UUID;
  v_buyer UUID;
  v_logistics UUID;
  v_order_no TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF NOT public.agent_manages_order(p_order_id, auth.uid()) THEN
    RAISE EXCEPTION 'order is not managed by this agent';
  END IF;

  SELECT o.factory_user_id, o.user_id, COALESCE(o.order_number, LEFT(o.id::text, 8))
    INTO v_factory, v_buyer, v_order_no
  FROM public.orders o
  WHERE o.id = p_order_id;

  UPDATE public.orders
  SET agent_inspection_confirmed_at = COALESCE(agent_inspection_confirmed_at, CURRENT_TIMESTAMP),
      agent_inspection_confirmed_by = auth.uid(),
      agent_inspection_notes = COALESCE(NULLIF(TRIM(COALESCE(p_notes, '')), ''), agent_inspection_notes),
      ready_for_inspection_at = COALESCE(ready_for_inspection_at, CURRENT_TIMESTAMP),
      updated_at = CURRENT_TIMESTAMP
  WHERE id = p_order_id;

  SELECT r.id INTO v_room_id
  FROM public.order_dispatch_rooms r
  WHERE r.order_id = p_order_id
  ORDER BY (r.status = 'active') DESC, r.created_at DESC
  LIMIT 1;

  IF v_room_id IS NULL THEN
    INSERT INTO public.order_dispatch_rooms (order_id, factory_id, agent_id, logistics_id, buyer_id, status)
    VALUES (p_order_id, v_factory, auth.uid(), NULL, v_buyer, 'active')
    RETURNING id INTO v_room_id;
  ELSE
    UPDATE public.order_dispatch_rooms
    SET agent_id = COALESCE(agent_id, auth.uid()),
        status = 'active',
        closed_at = NULL,
        closed_reason = NULL
    WHERE id = v_room_id;
  END IF;

  INSERT INTO public.dispatch_chat_messages (room_id, sender_id, sender_role, message_text)
  VALUES (
    v_room_id,
    auth.uid(),
    'agent',
    'البضاعة جاهزة للفحص الميداني — الطلب #' || v_order_no
  );

  RETURN v_room_id;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.agent_add_production_photos(UUID, TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.agent_flag_production_delay(UUID, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.agent_mark_ready_for_field_inspection(UUID, TEXT) TO authenticated;
