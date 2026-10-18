-- Migration: Backend-only Commission Engine
-- Timestamp: 20261109100000
-- Rules (computed on order creation, never trusted from the client):
--   Container / bulk (large_deal)  -> fixed $150 per container (min 1 container)
--   Subtotal >= 2000               -> 2.5% (wholesale)
--   Subtotal <  2000               -> 3.5% (retail)
-- Stores platform_fee and net_factory_payout silently on the orders record.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS order_category TEXT DEFAULT 'retail',
  ADD COLUMN IF NOT EXISTS container_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS platform_commission DECIMAL(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_rate_label TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS platform_commission_amount DECIMAL(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS platform_commission_rate_label TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS platform_fee DECIMAL(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_factory_payout DECIMAL(12,2) DEFAULT 0;

-- Pure calculation helper
CREATE OR REPLACE FUNCTION public.compute_order_commission(
  p_subtotal NUMERIC,
  p_container_count INTEGER,
  p_is_bulk BOOLEAN
)
RETURNS TABLE (category TEXT, fee NUMERIC, rate_label TEXT)
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_sub NUMERIC := COALESCE(p_subtotal, 0);
  v_cnt INTEGER := GREATEST(COALESCE(p_container_count, 0), 0);
BEGIN
  IF p_is_bulk OR v_cnt > 0 THEN
    category := 'large_deal';
    fee := ROUND(150 * GREATEST(v_cnt, 1), 2);
    rate_label := '$150 x ' || GREATEST(v_cnt, 1) || ' container(s)';
  ELSIF v_sub >= 2000 THEN
    category := 'wholesale';
    fee := ROUND(v_sub * 0.025, 2);
    rate_label := '2.5% of order subtotal';
  ELSE
    category := 'retail';
    fee := ROUND(v_sub * 0.035, 2);
    rate_label := '3.5% of order subtotal';
  END IF;
  RETURN NEXT;
END;
$$;

-- BEFORE INSERT trigger: overrides any client-supplied commission values
CREATE OR REPLACE FUNCTION public.trg_orders_set_commission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub NUMERIC;
  v_calc RECORD;
  v_bulk BOOLEAN;
BEGIN
  v_sub := COALESCE(NEW.subtotal, COALESCE(NEW.total, 0) - COALESCE(NEW.shipping_cost, 0), 0);
  v_bulk := COALESCE(NEW.order_category, '') IN ('large_deal', 'container', 'bulk')
            OR COALESCE(NEW.container_count, 0) > 0;

  SELECT * INTO v_calc
  FROM public.compute_order_commission(v_sub, COALESCE(NEW.container_count, 0), v_bulk);

  NEW.order_category := v_calc.category;
  NEW.platform_commission := v_calc.fee;
  NEW.platform_commission_amount := v_calc.fee;
  NEW.commission_rate_label := v_calc.rate_label;
  NEW.platform_commission_rate_label := v_calc.rate_label;
  NEW.platform_fee := v_calc.fee;
  NEW.net_factory_payout := ROUND(v_sub - v_calc.fee, 2);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_set_commission ON public.orders;
CREATE TRIGGER trg_orders_set_commission
BEFORE INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.trg_orders_set_commission();

-- AFTER INSERT trigger: create the platform_commissions ledger row server-side
CREATE OR REPLACE FUNCTION public.trg_orders_log_platform_commission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.platform_commissions pc
    WHERE pc.order_id = NEW.id AND pc.agent_id IS NULL
  ) THEN
    INSERT INTO public.platform_commissions (
      order_id, order_number, order_category, order_total,
      container_count, commission_amount, commission_rate_label, status
    ) VALUES (
      NEW.id, COALESCE(NEW.order_number, ''), COALESCE(NEW.order_category, 'retail'),
      COALESCE(NEW.subtotal, 0), COALESCE(NEW.container_count, 0),
      COALESCE(NEW.platform_fee, 0), COALESCE(NEW.commission_rate_label, ''), 'pending'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_log_platform_commission ON public.orders;
CREATE TRIGGER trg_orders_log_platform_commission
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.trg_orders_log_platform_commission();

-- Backfill platform_fee / net_factory_payout for existing orders
UPDATE public.orders
SET platform_fee = COALESCE(platform_commission, 0),
    net_factory_payout = ROUND(COALESCE(subtotal, COALESCE(total, 0)) - COALESCE(platform_commission, 0), 2)
WHERE COALESCE(platform_fee, 0) = 0 AND COALESCE(platform_commission, 0) > 0;

-- Keep the agent-commission trigger in sync with the new fee column
DROP TRIGGER IF EXISTS trg_orders_agent_commission ON public.orders;
CREATE TRIGGER trg_orders_agent_commission
AFTER INSERT OR UPDATE OF status, escrow_status, platform_commission, platform_fee, factory_user_id, items
ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.trg_orders_agent_commission();
