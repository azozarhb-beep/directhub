-- Migration: Unified Field Agent commission = 20% of Direct Hub platform fee per completed order
-- Timestamp: 20261020100000
-- Rule: agent_commission = orders.platform_commission * 0.20  (NOT a % of order total / GMV)

-- 0. Ensure columns the commission function reads exist on orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS order_category TEXT DEFAULT 'retail',
  ADD COLUMN IF NOT EXISTS platform_commission DECIMAL(12,2) DEFAULT 0;

-- 1. Extend platform_commissions with agent attribution columns
ALTER TABLE public.platform_commissions
  ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS agent_factory_id UUID,
  ADD COLUMN IF NOT EXISTS factory_name TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS platform_fee DECIMAL(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS agent_commission_rate DECIMAL(5,4) DEFAULT 0.20,
  ADD COLUMN IF NOT EXISTS attribution_source TEXT DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_platform_commissions_agent_id
  ON public.platform_commissions(agent_id);

-- One agent commission row per order
CREATE UNIQUE INDEX IF NOT EXISTS uq_platform_commissions_agent_order
  ON public.platform_commissions(order_id)
  WHERE agent_id IS NOT NULL;

-- 2. Agents can read their own commission rows
DROP POLICY IF EXISTS "agent_read_own_commissions" ON public.platform_commissions;
CREATE POLICY "agent_read_own_commissions"
  ON public.platform_commissions FOR SELECT
  TO authenticated
  USING (agent_id = auth.uid());

-- 3. Resolve the agent (and source) for an order
--    a) Factory registered via the agent's referral link (factory_registrations.referred_by_agent_id)
--    b) Factory manually registered by the agent (agent_factory_registrations via agent_products in order items)
CREATE OR REPLACE FUNCTION public.resolve_order_agent(p_order_id UUID)
RETURNS TABLE (agent_id UUID, factory_name TEXT, agent_factory_id UUID, source TEXT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_factory_user_id UUID;
  v_items JSONB;
BEGIN
  SELECT o.factory_user_id, o.items
    INTO v_factory_user_id, v_items
  FROM public.orders o
  WHERE o.id = p_order_id;

  -- a) Referral link attribution
  IF v_factory_user_id IS NOT NULL THEN
    RETURN QUERY
      SELECT fr.referred_by_agent_id, fr.company_name::TEXT, NULL::UUID, 'referral'::TEXT
      FROM public.factory_registrations fr
      WHERE fr.user_id = v_factory_user_id
        AND fr.referred_by_agent_id IS NOT NULL
      LIMIT 1;
    IF FOUND THEN
      RETURN;
    END IF;
  END IF;

  -- b) Manual registration attribution (agent products referenced in order items)
  IF v_items IS NOT NULL AND jsonb_typeof(v_items) = 'array' THEN
    RETURN QUERY
      SELECT afr.agent_id, afr.company_name::TEXT, afr.id, 'manual'::TEXT
      FROM public.agent_products ap
      JOIN public.agent_factory_registrations afr ON afr.id = ap.factory_id
      WHERE ap.id::TEXT IN (
        SELECT elem ->> 'product_id' FROM jsonb_array_elements(v_items) AS elem
      )
      LIMIT 1;
  END IF;
END;
$$;

-- 4. Upsert the agent commission for an order: platform_fee * 0.20
CREATE OR REPLACE FUNCTION public.upsert_agent_commission_for_order(p_order_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_agent RECORD;
  v_fee DECIMAL(12,2);
BEGIN
  SELECT o.id, o.order_number, o.total, o.platform_commission,
         COALESCE(o.order_category, '') AS order_category,
         COALESCE(o.currency, 'USD') AS currency
    INTO v_order
  FROM public.orders o
  WHERE o.id = p_order_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_fee := COALESCE(v_order.platform_commission, 0);

  SELECT * INTO v_agent FROM public.resolve_order_agent(p_order_id) LIMIT 1;
  IF v_agent.agent_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.platform_commissions (
    order_id, order_number, order_category, order_total,
    commission_amount, commission_rate_label, status,
    agent_id, agent_factory_id, factory_name, currency,
    platform_fee, agent_commission_rate, attribution_source
  ) VALUES (
    v_order.id, COALESCE(v_order.order_number, ''), v_order.order_category, COALESCE(v_order.total, 0),
    ROUND(v_fee * 0.20, 2), '20% of platform fee', 'pending',
    v_agent.agent_id, v_agent.agent_factory_id, COALESCE(v_agent.factory_name, ''), v_order.currency,
    v_fee, 0.20, v_agent.source
  )
  ON CONFLICT (order_id) WHERE agent_id IS NOT NULL
  DO UPDATE SET
    commission_amount = ROUND(EXCLUDED.platform_fee * 0.20, 2),
    platform_fee = EXCLUDED.platform_fee,
    agent_commission_rate = 0.20,
    commission_rate_label = '20% of platform fee',
    order_total = EXCLUDED.order_total,
    factory_name = EXCLUDED.factory_name,
    attribution_source = EXCLUDED.attribution_source,
    updated_at = CURRENT_TIMESTAMP
  WHERE public.platform_commissions.status = 'pending';
END;
$$;

-- 5. Trigger: fire when an order is completed (delivered / funds released) or its platform fee changes
CREATE OR REPLACE FUNCTION public.trg_orders_agent_commission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (NEW.status::TEXT = 'delivered' OR COALESCE(NEW.escrow_status, '') = 'funds_released') THEN
    PERFORM public.upsert_agent_commission_for_order(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_agent_commission ON public.orders;
CREATE TRIGGER trg_orders_agent_commission
AFTER INSERT OR UPDATE OF status, escrow_status, platform_commission, factory_user_id, items
ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.trg_orders_agent_commission();

-- 6. Backfill: recompute for already completed orders
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT id FROM public.orders
    WHERE status::TEXT = 'delivered' OR COALESCE(escrow_status, '') = 'funds_released'
  LOOP
    PERFORM public.upsert_agent_commission_for_order(r.id);
  END LOOP;
END $$;
