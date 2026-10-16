-- Finance portal: B2B milestone escrow releases (30/40/30) + auditable agent commission payouts.

CREATE TABLE IF NOT EXISTS public.escrow_milestone_releases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  stage SMALLINT NOT NULL CHECK (stage IN (1, 2, 3)),
  percentage SMALLINT NOT NULL CHECK (percentage IN (30, 40)),
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  note TEXT,
  released_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  released_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (order_id, stage)
);

CREATE INDEX IF NOT EXISTS idx_escrow_milestone_releases_order_id
  ON public.escrow_milestone_releases(order_id);

CREATE TABLE IF NOT EXISTS public.agent_commission_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  commission_ids UUID[] NOT NULL DEFAULT '{}',
  orders_count INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  paid_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_agent_commission_payouts_agent_id
  ON public.agent_commission_payouts(agent_id);

ALTER TABLE public.escrow_milestone_releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_commission_payouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "finance_read_milestone_releases" ON public.escrow_milestone_releases;
CREATE POLICY "finance_read_milestone_releases"
  ON public.escrow_milestone_releases FOR SELECT TO authenticated
  USING (public.is_master_admin() OR public.is_escrow_officer());

DROP POLICY IF EXISTS "master_admin_insert_milestone_releases" ON public.escrow_milestone_releases;
CREATE POLICY "master_admin_insert_milestone_releases"
  ON public.escrow_milestone_releases FOR INSERT TO authenticated
  WITH CHECK (public.is_master_admin());

DROP POLICY IF EXISTS "finance_read_agent_payouts" ON public.agent_commission_payouts;
CREATE POLICY "finance_read_agent_payouts"
  ON public.agent_commission_payouts FOR SELECT TO authenticated
  USING (public.is_master_admin() OR public.is_escrow_officer());

DROP POLICY IF EXISTS "agent_read_own_payouts" ON public.agent_commission_payouts;
CREATE POLICY "agent_read_own_payouts"
  ON public.agent_commission_payouts FOR SELECT TO authenticated
  USING (agent_id = auth.uid());

DROP POLICY IF EXISTS "finance_insert_agent_payouts" ON public.agent_commission_payouts;
CREATE POLICY "finance_insert_agent_payouts"
  ON public.agent_commission_payouts FOR INSERT TO authenticated
  WITH CHECK (public.is_master_admin() OR public.is_escrow_officer());

-- Allow finance staff to mark agent commission rows as paid.
DROP POLICY IF EXISTS "finance_update_platform_commissions" ON public.platform_commissions;
CREATE POLICY "finance_update_platform_commissions"
  ON public.platform_commissions FOR UPDATE TO authenticated
  USING (public.is_master_admin() OR public.is_escrow_officer())
  WITH CHECK (public.is_master_admin() OR public.is_escrow_officer());
