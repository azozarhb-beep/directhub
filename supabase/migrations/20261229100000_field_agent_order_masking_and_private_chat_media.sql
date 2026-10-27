-- ============================================================
-- Field Agent final GO blockers
-- 1) DROP raw orders SELECT policy for agents (agents_read_attributed_factory_orders)
-- 2) Masked RPCs for tracking / sales / earnings (no shipping or billing address,
--    no buyer identity, no full order value in the tracking view)
-- 3) chat-media and chat-attachments become PRIVATE; reads need a signed URL
-- ============================================================

-- 1) REMOVE RAW ORDER ACCESS ----------------------------------------------
DROP POLICY IF EXISTS "agents_read_attributed_factory_orders" ON public.orders;
DROP POLICY IF EXISTS "agents_read_assigned_task_orders" ON public.orders;

-- 2a) TRACKING VIEW --------------------------------------------------------
-- Exposes production / inspection / dispatch state only.
-- Destination is reduced to city + country. No street, no phone, no buyer id, no totals.
DROP FUNCTION IF EXISTS public.get_agent_order_tracking_view();

CREATE OR REPLACE FUNCTION public.get_agent_order_tracking_view()
RETURNS TABLE (
  order_id UUID,
  order_number TEXT,
  status TEXT,
  escrow_status TEXT,
  factory_user_id UUID,
  items JSONB,
  destination_city TEXT,
  destination_country TEXT,
  carrier_name TEXT,
  driver_name TEXT,
  driver_phone TEXT,
  agent_inspection_confirmed_at TIMESTAMPTZ,
  agent_inspection_notes TEXT,
  agent_production_photos JSONB,
  agent_delay_flagged_at TIMESTAMPTZ,
  agent_delay_reason TEXT,
  agent_delay_days INTEGER,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
  SELECT
    o.id,
    COALESCE(o.order_number, '')::TEXT,
    COALESCE(o.status::TEXT, ''),
    COALESCE(o.escrow_status::TEXT, ''),
    o.factory_user_id,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'product_id', COALESCE(it->>'product_id', it->>'productId', it->>'agent_product_id', ''),
            'name', COALESCE(it->>'name_ar', it->>'name_en', it->>'product_name', it->>'name', ''),
            'quantity', COALESCE(it->>'quantity', it->>'qty', '0'),
            'unit', COALESCE(it->>'unit', ''),
            'specifications', COALESCE(it->'specifications', it->'specs', 'null'::jsonb)
          )
        )
        FROM jsonb_array_elements(
          CASE WHEN jsonb_typeof(to_jsonb(o.items)) = 'array' THEN to_jsonb(o.items) ELSE '[]'::jsonb END
        ) it
      ),
      '[]'::jsonb
    ),
    COALESCE(to_jsonb(o.shipping_address)->>'city', '')::TEXT,
    COALESCE(to_jsonb(o.shipping_address)->>'country', '')::TEXT,
    COALESCE(to_jsonb(o)->>'carrier_name', to_jsonb(o)->>'seller_carrier_name', '')::TEXT,
    COALESCE(to_jsonb(o)->>'driver_name', '')::TEXT,
    COALESCE(to_jsonb(o)->>'driver_phone', '')::TEXT,
    o.agent_inspection_confirmed_at,
    COALESCE(o.agent_inspection_notes, '')::TEXT,
    COALESCE(o.agent_production_photos, '[]'::jsonb),
    o.agent_delay_flagged_at,
    COALESCE(o.agent_delay_reason, '')::TEXT,
    o.agent_delay_days,
    o.created_at
  FROM public.orders o
  WHERE public.agent_manages_order(o.id, auth.uid())
    AND o.status::TEXT IN ('processing','assigned','ready_for_pickup','in_transit','shipped','delivered')
  ORDER BY o.created_at DESC
  LIMIT 200;
$func$;

REVOKE ALL ON FUNCTION public.get_agent_order_tracking_view() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_agent_order_tracking_view() TO authenticated;

-- 2b) SALES VIEW -----------------------------------------------------------
-- Order reference + status + platform fee (basis of the 20% agent commission).
-- The buyer's full order value is NOT returned; only an item count and the platform fee.
DROP FUNCTION IF EXISTS public.get_agent_sales_orders_view();

CREATE OR REPLACE FUNCTION public.get_agent_sales_orders_view()
RETURNS TABLE (
  order_id UUID,
  order_number TEXT,
  status TEXT,
  escrow_status TEXT,
  currency TEXT,
  platform_fee NUMERIC,
  item_count INTEGER,
  factory_user_id UUID,
  product_ids TEXT[],
  created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
  SELECT
    o.id,
    COALESCE(o.order_number, '')::TEXT,
    COALESCE(o.status::TEXT, ''),
    COALESCE(o.escrow_status::TEXT, ''),
    COALESCE(to_jsonb(o)->>'currency', 'YER')::TEXT,
    COALESCE(o.platform_commission, 0)::NUMERIC,
    COALESCE(
      (
        SELECT COUNT(*)::INTEGER
        FROM jsonb_array_elements(
          CASE WHEN jsonb_typeof(to_jsonb(o.items)) = 'array' THEN to_jsonb(o.items) ELSE '[]'::jsonb END
        ) it
      ),
      0
    ),
    o.factory_user_id,
    COALESCE(
      (
        SELECT array_agg(COALESCE(it->>'product_id', it->>'productId', it->>'agent_product_id'))
        FROM jsonb_array_elements(
          CASE WHEN jsonb_typeof(to_jsonb(o.items)) = 'array' THEN to_jsonb(o.items) ELSE '[]'::jsonb END
        ) it
        WHERE COALESCE(it->>'product_id', it->>'productId', it->>'agent_product_id') IS NOT NULL
      ),
      ARRAY[]::TEXT[]
    ),
    o.created_at
  FROM public.orders o
  WHERE public.agent_manages_order(o.id, auth.uid())
  ORDER BY o.created_at DESC
  LIMIT 500;
$func$;

REVOKE ALL ON FUNCTION public.get_agent_sales_orders_view() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_agent_sales_orders_view() TO authenticated;

-- 2c) EARNINGS CLEARANCE VIEW ---------------------------------------------
-- Used for commission clearance: which of the agent's commission orders are settled.
DROP FUNCTION IF EXISTS public.get_agent_commission_order_status(UUID[]);

CREATE OR REPLACE FUNCTION public.get_agent_commission_order_status(p_order_ids UUID[])
RETURNS TABLE (
  order_id UUID,
  status TEXT,
  escrow_status TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
  SELECT
    o.id,
    COALESCE(o.status::TEXT, ''),
    COALESCE(o.escrow_status::TEXT, '')
  FROM public.orders o
  WHERE o.id = ANY(COALESCE(p_order_ids, ARRAY[]::UUID[]))
    AND (
      public.agent_manages_order(o.id, auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.platform_commissions pc
        WHERE pc.order_id = o.id AND pc.agent_id = auth.uid()
      )
    );
$func$;

REVOKE ALL ON FUNCTION public.get_agent_commission_order_status(UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_agent_commission_order_status(UUID[]) TO authenticated;

-- 3) PRIVATE CHAT / PRODUCTION PHOTO STORAGE -------------------------------
UPDATE storage.buckets SET public = false WHERE id IN ('chat-media', 'chat-attachments');

-- Replace the anonymous read policy with an authenticated-only one.
DROP POLICY IF EXISTS "chat_media_read_public" ON storage.objects;
DROP POLICY IF EXISTS "chat_media_read_authenticated" ON storage.objects;
CREATE POLICY "chat_media_read_authenticated"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'chat-media');

DROP POLICY IF EXISTS "authenticated_select_chat_attachments" ON storage.objects;
CREATE POLICY "authenticated_select_chat_attachments"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'chat-attachments');

NOTIFY pgrst, 'reload schema';
