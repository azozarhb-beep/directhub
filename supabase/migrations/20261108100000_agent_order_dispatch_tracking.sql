-- Agent order & product dispatch tracking.
-- 1) Lets field agents READ orders that belong to factories attributed to them
--    (referral signups or field registrations).
-- 2) Lets field agents LOG a quality check on those orders and mark them ready to ship
--    through a SECURITY DEFINER function (agents never get direct UPDATE on orders).

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS agent_inspection_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS agent_inspection_confirmed_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS agent_inspection_notes TEXT;

CREATE OR REPLACE FUNCTION public.agent_manages_order(p_order_id UUID, p_agent_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
SELECT EXISTS (
  SELECT 1
  FROM public.orders o
  WHERE o.id = p_order_id
    AND (
      -- Factory that signed up via the agent's referral link
      EXISTS (
        SELECT 1 FROM public.factory_registrations fr
        WHERE fr.user_id = o.factory_user_id
          AND fr.referred_by_agent_id = p_agent_id
      )
      -- Order containing a product the agent uploaded for a field-registered factory
      OR EXISTS (
        SELECT 1
        FROM jsonb_array_elements(
          CASE WHEN jsonb_typeof(o.items) = 'array' THEN o.items ELSE '[]'::jsonb END
        ) AS it
        JOIN public.agent_products ap
          ON ap.id::text = COALESCE(it->>'product_id', it->>'productId', it->>'agent_product_id')
        WHERE ap.agent_id = p_agent_id
      )
    )
);
$func$;

DROP POLICY IF EXISTS "agents_read_attributed_factory_orders" ON public.orders;
CREATE POLICY "agents_read_attributed_factory_orders"
ON public.orders
FOR SELECT
TO authenticated
USING (public.agent_manages_order(orders.id, auth.uid()));

CREATE OR REPLACE FUNCTION public.agent_confirm_order_inspection(p_order_id UUID, p_notes TEXT DEFAULT NULL)
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
  SET agent_inspection_confirmed_at = CURRENT_TIMESTAMP,
      agent_inspection_confirmed_by = auth.uid(),
      agent_inspection_notes = NULLIF(TRIM(COALESCE(p_notes, '')), ''),
      ready_for_inspection_at = COALESCE(ready_for_inspection_at, CURRENT_TIMESTAMP),
      updated_at = CURRENT_TIMESTAMP
  WHERE id = p_order_id;

  RETURN TRUE;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.agent_manages_order(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.agent_confirm_order_inspection(UUID, TEXT) TO authenticated;
