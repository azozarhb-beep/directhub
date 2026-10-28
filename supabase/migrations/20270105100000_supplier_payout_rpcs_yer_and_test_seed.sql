-- ============================================================
-- Local supplier payouts (YER only)
--  1) Link supplier.ye@direct-hub.net to supplier_supply_profile
--  2) Atomic RPCs: supplier_available_balance_yer, request_supplier_payout,
--     process_supplier_payout (strictly YER)
--  3) Admin read/update visibility on supplier_payout_requests
--  4) Seed a released YER escrow order for supplier.ye@direct-hub.net
-- Does NOT create any auth user. Idempotent.
-- ============================================================

-- 0) Status + currency constraints on payout requests
ALTER TABLE public.supplier_payout_requests
  DROP CONSTRAINT IF EXISTS supplier_payout_requests_status_check;
ALTER TABLE public.supplier_payout_requests
  ADD CONSTRAINT supplier_payout_requests_status_check
  CHECK (status IN ('pending_review', 'completed', 'rejected', 'cancelled'));

ALTER TABLE public.supplier_payout_requests
  DROP CONSTRAINT IF EXISTS supplier_payout_requests_currency_yer_check;
ALTER TABLE public.supplier_payout_requests
  ADD CONSTRAINT supplier_payout_requests_currency_yer_check
  CHECK (currency = 'YER');

ALTER TABLE public.supplier_payout_requests
  ADD COLUMN IF NOT EXISTS processed_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_supplier_payout_requests_reference
  ON public.supplier_payout_requests (reference)
  WHERE reference <> '';

-- 1) Functions (before policies)

-- Withdrawable YER balance:
--   released orders (net payout) - completed payouts - pending payouts
CREATE OR REPLACE FUNCTION public.supplier_available_balance_yer(p_supplier_id UUID)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
  SELECT COALESCE((
    SELECT SUM(CASE WHEN COALESCE(o.net_factory_payout, 0) > 0
                    THEN o.net_factory_payout ELSE COALESCE(o.total, 0) END)
    FROM public.orders o
    WHERE o.factory_user_id = p_supplier_id
      AND o.escrow_status = 'funds_released'
      AND UPPER(COALESCE(o.currency, 'YER')) = 'YER'
  ), 0) - COALESCE((
    SELECT SUM(pr.amount)
    FROM public.supplier_payout_requests pr
    WHERE pr.supplier_id = p_supplier_id
      AND pr.currency = 'YER'
      AND pr.status IN ('pending_review', 'completed')
  ), 0);
$func$;

-- Supplier submits a withdrawal request (balance validated server-side, serialised per supplier)
CREATE OR REPLACE FUNCTION public.request_supplier_payout(
  p_amount          NUMERIC,
  p_bank_account_id UUID DEFAULT NULL,
  p_currency        TEXT DEFAULT 'YER'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_uid       UUID := auth.uid();
  v_available NUMERIC;
  v_id        UUID;
  v_ref       TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF UPPER(COALESCE(p_currency, 'YER')) <> 'YER' THEN
    RAISE EXCEPTION 'Local supplier payouts are YER only';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = v_uid) THEN
    RAISE EXCEPTION 'Supplier profile not found';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Invalid amount';
  END IF;

  IF p_bank_account_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.factory_bank_accounts fba
    WHERE fba.id = p_bank_account_id AND fba.manufacturer_id = v_uid
  ) THEN
    RAISE EXCEPTION 'Bank account does not belong to this supplier';
  END IF;

  -- Serialise concurrent requests for the same supplier
  PERFORM pg_advisory_xact_lock(hashtextextended('supplier_payout:' || v_uid::text, 0));

  v_available := public.supplier_available_balance_yer(v_uid);
  IF p_amount > v_available THEN
    RAISE EXCEPTION 'Amount exceeds available balance (%)', v_available;
  END IF;

  v_ref := 'WD-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

  INSERT INTO public.supplier_payout_requests (
    supplier_id, amount, currency, bank_account_id, reference, status
  ) VALUES (
    v_uid, ROUND(p_amount, 2), 'YER', p_bank_account_id, v_ref, 'pending_review'
  )
  RETURNING id INTO v_id;

  -- Best-effort notification to admins
  BEGIN
    INSERT INTO public.notifications (user_id, title, message, type)
    SELECT up.id,
           'طلب سحب أرباح مورد جديد',
           'طلب سحب بقيمة ' || ROUND(p_amount, 2)::text || ' YER (' || v_ref || ')',
           'system'
    FROM public.user_profiles up
    WHERE up.role::text = 'admin';
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN v_id;
END;
$func$;

-- Admin approves (completed) or rejects a payout request
CREATE OR REPLACE FUNCTION public.process_supplier_payout(
  p_request_id UUID,
  p_decision   TEXT,
  p_note       TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_req    public.supplier_payout_requests%ROWTYPE;
  v_status TEXT;
BEGIN
  IF NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'Admin only' USING ERRCODE = '42501';
  END IF;

  IF p_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid decision';
  END IF;

  SELECT * INTO v_req
  FROM public.supplier_payout_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payout request not found';
  END IF;

  IF v_req.status <> 'pending_review' THEN
    RAISE EXCEPTION 'Request already processed';
  END IF;

  IF v_req.currency <> 'YER' THEN
    RAISE EXCEPTION 'Only YER payouts can be processed';
  END IF;

  IF p_decision = 'rejected' AND COALESCE(NULLIF(trim(p_note), ''), '') = '' THEN
    RAISE EXCEPTION 'A rejection reason is required';
  END IF;

  IF p_decision = 'approved' THEN
    -- Pending amount of this very request is part of the reserved total, so the
    -- released total must still cover (completed + this request).
    IF (
      SELECT COALESCE(SUM(CASE WHEN COALESCE(o.net_factory_payout, 0) > 0
                               THEN o.net_factory_payout ELSE COALESCE(o.total, 0) END), 0)
      FROM public.orders o
      WHERE o.factory_user_id = v_req.supplier_id
        AND o.escrow_status = 'funds_released'
        AND UPPER(COALESCE(o.currency, 'YER')) = 'YER'
    ) < (
      SELECT COALESCE(SUM(pr.amount), 0)
      FROM public.supplier_payout_requests pr
      WHERE pr.supplier_id = v_req.supplier_id
        AND pr.currency = 'YER'
        AND (pr.status = 'completed' OR pr.id = v_req.id)
    ) THEN
      RAISE EXCEPTION 'Insufficient released balance for this payout';
    END IF;
    v_status := 'completed';
  ELSE
    v_status := 'rejected';
  END IF;

  UPDATE public.supplier_payout_requests
  SET status = v_status,
      admin_note = NULLIF(trim(COALESCE(p_note, '')), ''),
      processed_by = auth.uid(),
      processed_at = now()
  WHERE id = v_req.id;

  -- Best-effort supplier notification
  BEGIN
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (
      v_req.supplier_id,
      CASE WHEN v_status = 'completed' THEN 'تمت الموافقة على طلب السحب' ELSE 'تم رفض طلب السحب' END,
      CASE WHEN v_status = 'completed'
           THEN 'تمت الموافقة على سحب ' || v_req.amount::text || ' YER (' || v_req.reference || ')'
           ELSE 'تم رفض طلب سحب ' || v_req.amount::text || ' YER' || COALESCE(' - ' || p_note, '') END,
      'system'
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN v_status;
END;
$func$;

REVOKE ALL ON FUNCTION public.supplier_available_balance_yer(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.request_supplier_payout(NUMERIC, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.process_supplier_payout(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.supplier_available_balance_yer(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_supplier_payout(NUMERIC, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_supplier_payout(UUID, TEXT, TEXT) TO authenticated;

-- 2) RLS: direct client INSERT is replaced by the RPC; admins can read all requests
DROP POLICY IF EXISTS "supplier_insert_own_payout_requests" ON public.supplier_payout_requests;

DROP POLICY IF EXISTS "admin_select_all_supplier_payout_requests" ON public.supplier_payout_requests;
CREATE POLICY "admin_select_all_supplier_payout_requests"
ON public.supplier_payout_requests
FOR SELECT
TO authenticated
USING (public.is_admin_user());

-- 3) Link supplier.ye@direct-hub.net to supplier_supply_profile (no user creation)
DO $seed$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT au.id INTO v_user_id
  FROM auth.users au
  WHERE lower(au.email) = 'supplier.ye@direct-hub.net'
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'Skipped: auth user supplier.ye@direct-hub.net not found';
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = v_user_id) THEN
    RAISE NOTICE 'Skipped: no user_profiles row for supplier.ye@direct-hub.net';
    RETURN;
  END IF;

  INSERT INTO public.supplier_supply_profile (
    supplier_id, monthly_supply_capacity, capacity_unit, available_supply_volume,
    warehouse_name, warehouse_city, notes
  ) VALUES (
    v_user_id, 500, 'carton', 500,
    'مستودع المورد المحلي', 'صنعاء', 'E2E test supplier profile'
  )
  ON CONFLICT (supplier_id) DO NOTHING;

  RAISE NOTICE 'supplier_supply_profile linked for supplier.ye (%)', v_user_id;
END $seed$;

-- 4) Seed a released YER escrow order for supplier.ye@direct-hub.net
DO $seed$
DECLARE
  v_supplier_id UUID;
  v_buyer_id    UUID;
  v_balance     NUMERIC;
BEGIN
  SELECT au.id INTO v_supplier_id
  FROM auth.users au
  WHERE lower(au.email) = 'supplier.ye@direct-hub.net'
  LIMIT 1;

  IF v_supplier_id IS NULL THEN
    RAISE NOTICE 'Seed skipped: auth user supplier.ye@direct-hub.net not found';
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.factory_user_id = v_supplier_id AND o.order_number = 'E2E-SUP-YE-SEED-001'
  ) THEN
    RAISE NOTICE 'Seed already present for supplier.ye - skipped';
    RETURN;
  END IF;

  SELECT up.id INTO v_buyer_id
  FROM public.user_profiles up
  WHERE up.id <> v_supplier_id AND up.role::text <> 'admin'
  ORDER BY up.created_at
  LIMIT 1;

  IF v_buyer_id IS NULL THEN
    SELECT up.id INTO v_buyer_id FROM public.user_profiles up WHERE up.id <> v_supplier_id LIMIT 1;
  END IF;

  IF v_buyer_id IS NULL THEN
    RAISE NOTICE 'Seed skipped: no buyer profile available';
    RETURN;
  END IF;

  INSERT INTO public.orders (
    user_id, order_number, items, shipping_address, subtotal, total, currency,
    factory_user_id, escrow_status, net_factory_payout, platform_fee, funds_released_at
  ) VALUES (
    v_buyer_id, 'E2E-SUP-YE-SEED-001', '[]'::jsonb, '{}'::jsonb,
    500000, 500000, 'YER',
    v_supplier_id, 'funds_released', 475000, 25000, now() - interval '1 day'
  );

  v_balance := public.supplier_available_balance_yer(v_supplier_id);
  RAISE NOTICE 'Seed OK for supplier.ye: available YER balance = %', v_balance;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Seed failed: %', SQLERRM;
END $seed$;

NOTIFY pgrst, 'reload schema';
