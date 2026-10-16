-- B2B milestone escrow (30/40/30): tranche audit columns, agent commission wallet, atomic release RPC.

-- 1. Widen tranche table (existing CHECK only allowed 30/40)
ALTER TABLE public.escrow_milestone_releases
  DROP CONSTRAINT IF EXISTS escrow_milestone_releases_percentage_check;

ALTER TABLE public.escrow_milestone_releases
  ADD CONSTRAINT escrow_milestone_releases_percentage_check CHECK (percentage IN (30, 40));

ALTER TABLE public.escrow_milestone_releases
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'RELEASED',
  ADD COLUMN IF NOT EXISTS proof_ref TEXT,
  ADD COLUMN IF NOT EXISTS proof_type TEXT,
  ADD COLUMN IF NOT EXISTS platform_fee NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS agent_share NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_to_supplier NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS released_by_email TEXT,
  ADD COLUMN IF NOT EXISTS released_by_role TEXT;

CREATE INDEX IF NOT EXISTS idx_escrow_milestone_releases_released_at
  ON public.escrow_milestone_releases(released_at DESC);

-- 2. Bill of Lading signal on orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS bill_of_lading_url TEXT;

-- 3. Agent commission wallet
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS commission_wallet_balance NUMERIC(14,2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.agent_wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  release_id UUID REFERENCES public.escrow_milestone_releases(id) ON DELETE SET NULL,
  tx_type TEXT NOT NULL DEFAULT 'milestone_commission',
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  note TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_agent_wallet_transactions_agent_id
  ON public.agent_wallet_transactions(agent_id, created_at DESC);

-- 4. Helper functions (before policies)
CREATE OR REPLACE FUNCTION public.is_finance_staff()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $func$
SELECT public.is_master_admin() OR public.is_escrow_officer()
$func$;

-- 5. RLS
ALTER TABLE public.agent_wallet_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "finance_read_agent_wallet_tx" ON public.agent_wallet_transactions;
CREATE POLICY "finance_read_agent_wallet_tx"
  ON public.agent_wallet_transactions FOR SELECT TO authenticated
  USING (public.is_finance_staff());

DROP POLICY IF EXISTS "agent_read_own_wallet_tx" ON public.agent_wallet_transactions;
CREATE POLICY "agent_read_own_wallet_tx"
  ON public.agent_wallet_transactions FOR SELECT TO authenticated
  USING (agent_id = auth.uid());

-- Finance staff may read the signals used to compute tranche eligibility.
DROP POLICY IF EXISTS "finance_read_logistics_documents" ON public.logistics_documents;
CREATE POLICY "finance_read_logistics_documents"
  ON public.logistics_documents FOR SELECT TO authenticated
  USING (public.is_finance_staff());

DROP POLICY IF EXISTS "finance_read_logistics_shipments" ON public.logistics_shipments;
CREATE POLICY "finance_read_logistics_shipments"
  ON public.logistics_shipments FOR SELECT TO authenticated
  USING (public.is_finance_staff());

DROP POLICY IF EXISTS "finance_read_field_inspection_tasks" ON public.field_inspection_tasks;
CREATE POLICY "finance_read_field_inspection_tasks"
  ON public.field_inspection_tasks FOR SELECT TO authenticated
  USING (public.is_finance_staff());

-- Allow ESCROW_OFFICER to read tranche history (insert happens only through the RPC below).
DROP POLICY IF EXISTS "finance_read_milestone_releases" ON public.escrow_milestone_releases;
CREATE POLICY "finance_read_milestone_releases"
  ON public.escrow_milestone_releases FOR SELECT TO authenticated
  USING (public.is_finance_staff());

-- 6. Atomic tranche release: eligibility re-check, ledger entry, tranche row, agent wallet credit, audit trail
CREATE OR REPLACE FUNCTION public.release_escrow_milestone(
  p_order_id UUID,
  p_stage SMALLINT,
  p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_uid UUID := auth.uid();
  v_order RECORD;
  v_pct SMALLINT;
  v_gross NUMERIC(14,2);
  v_fee_total NUMERIC(14,2);
  v_fee NUMERIC(14,2);
  v_agent_share NUMERIC(14,2);
  v_net NUMERIC(14,2);
  v_agent UUID;
  v_proof_ref TEXT;
  v_proof_type TEXT;
  v_email TEXT;
  v_role TEXT;
  v_release_id UUID;
  v_has_bol BOOLEAN := FALSE;
  v_dispatched BOOLEAN := FALSE;
  v_inspection_id UUID;
  v_otp BOOLEAN := FALSE;
BEGIN
  IF v_uid IS NULL OR NOT public.is_finance_staff() THEN
    RAISE EXCEPTION 'release_escrow_milestone requires admin or ESCROW_OFFICER' USING ERRCODE = '42501';
  END IF;

  IF p_stage NOT IN (1, 2, 3) THEN
    RAISE EXCEPTION 'Invalid tranche stage %', p_stage USING ERRCODE = '22023';
  END IF;

  SELECT o.id, o.order_number, o.total, COALESCE(o.currency, 'USD') AS currency,
         COALESCE(o.platform_commission, 0) AS platform_commission,
         o.escrow_status, o.dispatched_at, o.bill_of_lading_url, o.tracking_code,
         o.delivery_otp_verified_at, o.delivery_pin_verified_at
    INTO v_order
  FROM public.orders o
  WHERE o.id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found' USING ERRCODE = 'P0002';
  END IF;

  IF COALESCE(v_order.escrow_status, '') NOT IN ('funds_secured', 'shipped', 'pending_otp_confirmation', 'pending_admin_payout') THEN
    RAISE EXCEPTION 'Order escrow is not funded (status: %)', COALESCE(v_order.escrow_status, 'none') USING ERRCODE = '22023';
  END IF;

  IF EXISTS (SELECT 1 FROM public.escrow_milestone_releases r WHERE r.order_id = p_order_id AND r.stage = p_stage) THEN
    RAISE EXCEPTION 'Tranche % already released', p_stage USING ERRCODE = '23505';
  END IF;

  IF p_stage > 1 AND NOT EXISTS (
    SELECT 1 FROM public.escrow_milestone_releases r WHERE r.order_id = p_order_id AND r.stage = p_stage - 1
  ) THEN
    RAISE EXCEPTION 'Previous tranche must be released first' USING ERRCODE = '22023';
  END IF;

  -- Eligibility + proof reference
  IF p_stage = 1 THEN
    v_pct := 30;
    v_proof_type := 'escrow_funded';
    v_proof_ref := COALESCE(v_order.order_number, p_order_id::TEXT);
  ELSIF p_stage = 2 THEN
    v_pct := 40;
    SELECT ld.id::TEXT INTO v_proof_ref
    FROM public.logistics_documents ld
    JOIN public.logistics_shipments ls ON ls.id = ld.shipment_id
    WHERE ls.order_id = p_order_id
      AND ld.document_type = 'bill_of_lading'
      AND ld.status <> 'rejected'
    ORDER BY ld.created_at DESC
    LIMIT 1;
    IF v_proof_ref IS NOT NULL THEN
      v_has_bol := TRUE;
      v_proof_type := 'bill_of_lading';
    ELSIF v_order.bill_of_lading_url IS NOT NULL AND length(trim(v_order.bill_of_lading_url)) > 0 THEN
      v_has_bol := TRUE;
      v_proof_type := 'bill_of_lading';
      v_proof_ref := v_order.bill_of_lading_url;
    ELSIF v_order.dispatched_at IS NOT NULL THEN
      v_dispatched := TRUE;
      v_proof_type := 'dispatched';
      v_proof_ref := 'DISPATCHED@' || to_char(v_order.dispatched_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
    END IF;
    IF NOT (v_has_bol OR v_dispatched) THEN
      RAISE EXCEPTION 'Tranche 2 locked: Bill of Lading or DISPATCHED status required' USING ERRCODE = '22023';
    END IF;
  ELSE
    v_pct := 30;
    SELECT t.id INTO v_inspection_id
    FROM public.field_inspection_tasks t
    WHERE t.order_id = p_order_id AND lower(COALESCE(t.status, '')) = 'passed'
    ORDER BY t.signed_off_at DESC NULLS LAST
    LIMIT 1;
    v_otp := (v_order.delivery_otp_verified_at IS NOT NULL OR v_order.delivery_pin_verified_at IS NOT NULL);
    IF v_inspection_id IS NOT NULL THEN
      v_proof_type := 'inspection_passed';
      v_proof_ref := v_inspection_id::TEXT;
    ELSIF v_otp THEN
      v_proof_type := 'delivery_otp';
      v_proof_ref := 'OTP@' || to_char(COALESCE(v_order.delivery_otp_verified_at, v_order.delivery_pin_verified_at) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
    ELSE
      RAISE EXCEPTION 'Tranche 3 locked: passed field inspection or verified delivery OTP required' USING ERRCODE = '22023';
    END IF;
  END IF;

  -- Amounts: tranche share of total; platform fee pro-rated; agent gets 20 percent of the platform fee
  v_gross := ROUND(COALESCE(v_order.total, 0) * v_pct / 100.0, 2);
  v_fee_total := COALESCE(v_order.platform_commission, 0);
  v_fee := ROUND(v_fee_total * v_pct / 100.0, 2);
  v_agent_share := ROUND(v_fee * 0.20, 2);
  v_net := v_gross - v_fee;

  SELECT a.agent_id INTO v_agent FROM public.resolve_order_agent(p_order_id) a LIMIT 1;
  IF v_agent IS NULL THEN
    v_agent_share := 0;
  END IF;

  SELECT au.email, COALESCE(au.raw_user_meta_data->>'staff_role', au.raw_app_meta_data->>'staff_role', au.raw_user_meta_data->>'role', au.raw_app_meta_data->>'role')
    INTO v_email, v_role
  FROM auth.users au WHERE au.id = v_uid;

  INSERT INTO public.escrow_milestone_releases (
    order_id, stage, percentage, amount, currency, note, released_by, released_at,
    status, proof_ref, proof_type, platform_fee, agent_share, net_to_supplier,
    agent_id, released_by_email, released_by_role
  ) VALUES (
    p_order_id, p_stage, v_pct, v_gross, v_order.currency,
    COALESCE(NULLIF(trim(COALESCE(p_note, '')), ''), 'Tranche ' || p_stage || ' release (' || v_pct || '%)'),
    v_uid, CURRENT_TIMESTAMP,
    'RELEASED', v_proof_ref, v_proof_type, v_fee, v_agent_share, v_net,
    v_agent, v_email, v_role
  )
  RETURNING id INTO v_release_id;

  INSERT INTO public.escrow_ledger (order_id, user_id, event_type, amount, currency, note, performed_by)
  SELECT p_order_id, v_uid, 'funds_released', v_net, v_order.currency,
         'Milestone ' || p_stage || ' (' || v_pct || '%) net to supplier | proof=' || COALESCE(v_proof_ref, '-'),
         v_uid
  WHERE EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = v_uid);

  IF v_agent IS NOT NULL AND v_agent_share > 0 THEN
    UPDATE public.user_profiles
       SET commission_wallet_balance = COALESCE(commission_wallet_balance, 0) + v_agent_share
     WHERE id = v_agent;

    INSERT INTO public.agent_wallet_transactions (agent_id, order_id, release_id, tx_type, amount, currency, note, created_by)
    VALUES (v_agent, p_order_id, v_release_id, 'milestone_commission', v_agent_share, v_order.currency,
            'Agent 20% share of platform fee - tranche ' || p_stage, v_uid);
  END IF;

  INSERT INTO public.order_status_history (order_id, status, note)
  VALUES (p_order_id, 'processing',
          'Tranche ' || p_stage || ' (' || v_pct || '%) released to supplier - net ' || v_net || ' ' || v_order.currency
          || ' | proof=' || COALESCE(v_proof_ref, '-'));

  RETURN jsonb_build_object(
    'release_id', v_release_id,
    'stage', p_stage,
    'gross', v_gross,
    'platform_fee', v_fee,
    'agent_share', v_agent_share,
    'net_to_supplier', v_net,
    'agent_id', v_agent,
    'proof_ref', v_proof_ref,
    'proof_type', v_proof_type
  );
END;
$func$;

REVOKE ALL ON FUNCTION public.release_escrow_milestone(UUID, SMALLINT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.release_escrow_milestone(UUID, SMALLINT, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
