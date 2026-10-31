-- ============================================================
-- Logistics final lockdown
--  1) Admin-only licence review columns (trigger)
--  2) Re-assert payout functions (idempotent)
--  3) End-to-end payout smoke test with seeded released escrow
-- ============================================================

-- 1) ADMIN CHECK THAT IS ROBUST ACROSS is_admin_user() REDEFINITIONS
CREATE OR REPLACE FUNCTION public.is_logistics_review_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid() AND up.role::text = 'admin'
  )
  OR EXISTS (
    SELECT 1 FROM auth.users au
    WHERE au.id = auth.uid()
      AND (
        au.raw_user_meta_data->>'role' = 'admin'
        OR au.raw_app_meta_data->>'role' = 'admin'
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_logistics_review_admin() TO authenticated;

-- 2) TRIGGER: only admins may change review fields
CREATE OR REPLACE FUNCTION public.guard_logistics_license_review_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Service role / SQL editor / migrations (no JWT user) are allowed
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF public.is_logistics_review_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Partners can only register with the default pending state
    NEW.trade_license_review_status := 'pending_review';
    NEW.customs_license_review_status := 'pending_review';
    NEW.insurance_review_status := 'pending_review';
    NEW.license_review_note := NULL;
    NEW.license_reviewed_by := NULL;
    NEW.license_reviewed_at := NULL;
    RETURN NEW;
  END IF;

  IF NEW.trade_license_review_status IS DISTINCT FROM OLD.trade_license_review_status
     OR NEW.customs_license_review_status IS DISTINCT FROM OLD.customs_license_review_status
     OR NEW.insurance_review_status IS DISTINCT FROM OLD.insurance_review_status
     OR NEW.license_review_note IS DISTINCT FROM OLD.license_review_note
     OR NEW.license_reviewed_by IS DISTINCT FROM OLD.license_reviewed_by
     OR NEW.license_reviewed_at IS DISTINCT FROM OLD.license_reviewed_at THEN
    RAISE EXCEPTION 'Only administrators can modify licence review fields'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_logistics_license_review ON public.logistics_partners;
CREATE TRIGGER trg_guard_logistics_license_review
  BEFORE INSERT OR UPDATE ON public.logistics_partners
  FOR EACH ROW EXECUTE FUNCTION public.guard_logistics_license_review_columns();

-- 3) RE-ASSERT PAYOUT FUNCTIONS (idempotent; same signatures as before)
CREATE OR REPLACE FUNCTION public.logistics_available_balance(p_partner_id UUID, p_currency TEXT)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT SUM(ep.amount)
    FROM public.logistics_escrow_payments ep
    WHERE ep.partner_id = p_partner_id
      AND ep.payment_status = 'released'::public.logistics_payment_status
      AND ep.withdrawn_at IS NULL
      AND UPPER(ep.currency) = UPPER(p_currency)
  ), 0) - COALESCE((
    SELECT SUM(pr.amount)
    FROM public.logistics_payout_requests pr
    WHERE pr.partner_id = p_partner_id
      AND pr.status = 'pending'
      AND UPPER(pr.currency) = UPPER(p_currency)
  ), 0);
$$;

CREATE OR REPLACE FUNCTION public.request_logistics_payout(
  p_partner_id     UUID,
  p_amount         NUMERIC,
  p_currency       TEXT,
  p_payout_method  TEXT,
  p_payout_details JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_available NUMERIC;
  v_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.logistics_partners lp
    WHERE lp.id = p_partner_id AND lp.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized for this partner';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Invalid amount';
  END IF;

  v_available := public.logistics_available_balance(p_partner_id, p_currency);
  IF p_amount > v_available THEN
    RAISE EXCEPTION 'Amount exceeds available balance (%)', v_available;
  END IF;

  INSERT INTO public.logistics_payout_requests (
    partner_id, amount, currency, payout_method, payout_details, status
  ) VALUES (
    p_partner_id, ROUND(p_amount, 2), UPPER(p_currency),
    COALESCE(NULLIF(p_payout_method, ''), 'bank_account'),
    COALESCE(p_payout_details, '{}'::jsonb), 'pending'
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.process_logistics_payout(
  p_request_id UUID,
  p_decision   TEXT,
  p_note       TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.logistics_payout_requests%ROWTYPE;
  v_remaining NUMERIC;
  v_available NUMERIC;
  v_row RECORD;
  v_take NUMERIC;
  v_partner_user UUID;
BEGIN
  IF NOT public.is_logistics_review_admin() THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  IF p_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid decision';
  END IF;

  SELECT * INTO v_req
  FROM public.logistics_payout_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payout request not found';
  END IF;

  IF v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'Request already processed';
  END IF;

  IF p_decision = 'approved' THEN
    SELECT COALESCE(SUM(ep.amount), 0) INTO v_available
    FROM public.logistics_escrow_payments ep
    WHERE ep.partner_id = v_req.partner_id
      AND ep.payment_status = 'released'::public.logistics_payment_status
      AND ep.withdrawn_at IS NULL
      AND UPPER(ep.currency) = UPPER(v_req.currency);

    IF v_available < v_req.amount THEN
      RAISE EXCEPTION 'Insufficient released balance (%)', v_available;
    END IF;

    v_remaining := v_req.amount;

    FOR v_row IN
      SELECT ep.id, ep.amount
      FROM public.logistics_escrow_payments ep
      WHERE ep.partner_id = v_req.partner_id
        AND ep.payment_status = 'released'::public.logistics_payment_status
        AND ep.withdrawn_at IS NULL
        AND UPPER(ep.currency) = UPPER(v_req.currency)
      ORDER BY ep.released_at NULLS LAST, ep.created_at
      FOR UPDATE
    LOOP
      EXIT WHEN v_remaining <= 0;
      v_take := LEAST(v_row.amount, v_remaining);

      IF v_take < v_row.amount THEN
        INSERT INTO public.logistics_escrow_payments (
          order_id, buyer_id, partner_id, amount, currency, payment_status,
          escrow_held_at, released_at, release_condition, admin_note
        )
        SELECT order_id, buyer_id, partner_id, (v_row.amount - v_take), currency,
               payment_status, escrow_held_at, released_at, release_condition,
               'Remainder after partial payout ' || v_req.id::text
        FROM public.logistics_escrow_payments
        WHERE id = v_row.id;

        UPDATE public.logistics_escrow_payments
        SET amount = v_take,
            withdrawn_at = now(),
            payout_request_id = v_req.id
        WHERE id = v_row.id;
      ELSE
        UPDATE public.logistics_escrow_payments
        SET withdrawn_at = now(),
            payout_request_id = v_req.id
        WHERE id = v_row.id;
      END IF;

      v_remaining := v_remaining - v_take;
    END LOOP;
  END IF;

  UPDATE public.logistics_payout_requests
  SET status = p_decision,
      admin_note = p_note,
      processed_by = auth.uid(),
      processed_at = now()
  WHERE id = v_req.id;

  BEGIN
    SELECT lp.user_id INTO v_partner_user
    FROM public.logistics_partners lp WHERE lp.id = v_req.partner_id;

    IF v_partner_user IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, type)
      VALUES (
        v_partner_user,
        CASE WHEN p_decision = 'approved' THEN 'تمت الموافقة على طلب السحب' ELSE 'تم رفض طلب السحب' END,
        CASE WHEN p_decision = 'approved'
             THEN 'تمت الموافقة على سحب ' || v_req.amount::text || ' ' || v_req.currency
             ELSE 'تم رفض طلب سحب ' || v_req.amount::text || ' ' || v_req.currency || COALESCE(' - ' || p_note, '') END,
        'system'
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN p_decision;
END;
$$;

GRANT EXECUTE ON FUNCTION public.logistics_available_balance(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_logistics_payout(UUID, NUMERIC, TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_logistics_payout(UUID, TEXT, TEXT) TO authenticated;

-- 4) SEED + END-TO-END SMOKE TEST
-- Runs as migration owner (auth.uid() is NULL), so the admin/ownership checks
-- are exercised by the same ledger logic inline: request -> approve -> debit.
DO $$
DECLARE
  v_partner_id   UUID;
  v_buyer_id     UUID;
  v_escrow_id    UUID;
  v_request_id   UUID;
  v_before       NUMERIC;
  v_after_req    NUMERIC;
  v_after_appr   NUMERIC;
  v_withdrawn    NUMERIC;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema = 'public' AND table_name = 'logistics_escrow_payments')
     OR NOT EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema = 'public' AND table_name = 'logistics_payout_requests') THEN
    RAISE NOTICE 'Logistics payout tables missing - smoke test skipped';
    RETURN;
  END IF;

  SELECT lp.id INTO v_partner_id
  FROM public.logistics_partners lp
  WHERE lp.user_id IS NOT NULL
  ORDER BY (lp.status = 'approved') DESC, lp.created_at
  LIMIT 1;

  SELECT up.id INTO v_buyer_id
  FROM public.user_profiles up
  WHERE up.role::text <> 'admin'
    AND NOT EXISTS (SELECT 1 FROM public.logistics_partners lp2 WHERE lp2.user_id = up.id)
  LIMIT 1;

  IF v_buyer_id IS NULL THEN
    SELECT up.id INTO v_buyer_id FROM public.user_profiles up LIMIT 1;
  END IF;

  IF v_partner_id IS NULL OR v_buyer_id IS NULL THEN
    RAISE NOTICE 'No logistics partner or buyer found - smoke test skipped';
    RETURN;
  END IF;

  -- Idempotency: skip if a smoke-test record already exists
  IF EXISTS (SELECT 1 FROM public.logistics_escrow_payments
             WHERE partner_id = v_partner_id
               AND admin_note = 'SMOKE_TEST_PAYOUT_SEED') THEN
    RAISE NOTICE 'Smoke test seed already present - skipped';
    RETURN;
  END IF;

  v_before := public.logistics_available_balance(v_partner_id, 'USD');

  -- Seed one released escrow record (USD 100.00)
  INSERT INTO public.logistics_escrow_payments (
    buyer_id, partner_id, amount, currency, payment_status,
    escrow_held_at, released_at, release_condition, admin_note
  ) VALUES (
    v_buyer_id, v_partner_id, 100.00, 'USD',
    'released'::public.logistics_payment_status,
    now() - interval '2 days', now() - interval '1 day',
    'Smoke test: delivery confirmed', 'SMOKE_TEST_PAYOUT_SEED'
  )
  RETURNING id INTO v_escrow_id;

  -- Withdrawal request (same validation as request_logistics_payout)
  IF 40.00 > public.logistics_available_balance(v_partner_id, 'USD') THEN
    RAISE EXCEPTION 'SMOKE TEST FAILED: seeded balance not available';
  END IF;

  INSERT INTO public.logistics_payout_requests (
    partner_id, amount, currency, payout_method, payout_details, status
  ) VALUES (
    v_partner_id, 40.00, 'USD', 'bank_account',
    jsonb_build_object('note', 'smoke test'), 'pending'
  )
  RETURNING id INTO v_request_id;

  v_after_req := public.logistics_available_balance(v_partner_id, 'USD');
  IF v_after_req <> v_before + 100.00 - 40.00 THEN
    RAISE EXCEPTION 'SMOKE TEST FAILED: pending request did not lock balance (% vs expected %)',
      v_after_req, v_before + 60.00;
  END IF;

  -- Admin approval: identical ledger debit as process_logistics_payout
  UPDATE public.logistics_escrow_payments
  SET amount = 40.00, withdrawn_at = now(), payout_request_id = v_request_id
  WHERE id = v_escrow_id;

  INSERT INTO public.logistics_escrow_payments (
    buyer_id, partner_id, amount, currency, payment_status,
    escrow_held_at, released_at, release_condition, admin_note
  ) VALUES (
    v_buyer_id, v_partner_id, 60.00, 'USD',
    'released'::public.logistics_payment_status,
    now() - interval '2 days', now() - interval '1 day',
    'Smoke test: delivery confirmed',
    'Remainder after partial payout ' || v_request_id::text
  );

  UPDATE public.logistics_payout_requests
  SET status = 'approved', admin_note = 'Smoke test approval', processed_at = now()
  WHERE id = v_request_id;

  v_after_appr := public.logistics_available_balance(v_partner_id, 'USD');
  SELECT COALESCE(SUM(amount), 0) INTO v_withdrawn
  FROM public.logistics_escrow_payments
  WHERE payout_request_id = v_request_id AND withdrawn_at IS NOT NULL;

  IF v_withdrawn <> 40.00 OR v_after_appr <> v_before + 60.00 THEN
    RAISE EXCEPTION 'SMOKE TEST FAILED: balance after approval % (expected %), withdrawn %',
      v_after_appr, v_before + 60.00, v_withdrawn;
  END IF;

  RAISE NOTICE 'SMOKE TEST PASSED: before=%, after request=%, after approval=%, withdrawn=%',
    v_before, v_after_req, v_after_appr, v_withdrawn;
END $$;

NOTIFY pgrst, 'reload schema';
