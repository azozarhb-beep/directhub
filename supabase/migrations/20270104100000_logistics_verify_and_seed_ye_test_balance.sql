-- ============================================================
-- Logistics go-live verification + test balance seed
--  1) Assert payout functions exist and are executable by authenticated
--  2) Assert licence review trigger exists/enabled and raises 42501 for non-admins
--  3) Seed a small released escrow for logistics.ye@direct-hub.net
-- Idempotent: safe to run multiple times.
-- ============================================================

-- 1) FUNCTION / GRANT ASSERTIONS
DO $$
DECLARE
  v_sig TEXT;
  v_sigs TEXT[] := ARRAY[
    'public.request_logistics_payout(uuid,numeric,text,text,jsonb)',
    'public.process_logistics_payout(uuid,text,text)',
    'public.logistics_available_balance(uuid,text)'
  ];
BEGIN
  FOREACH v_sig IN ARRAY v_sigs LOOP
    IF to_regprocedure(v_sig) IS NULL THEN
      RAISE EXCEPTION 'VERIFY FAILED: function % is missing', v_sig;
    END IF;
    IF NOT has_function_privilege('authenticated', to_regprocedure(v_sig), 'EXECUTE') THEN
      RAISE EXCEPTION 'VERIFY FAILED: authenticated cannot EXECUTE %', v_sig;
    END IF;
  END LOOP;
  RAISE NOTICE 'VERIFY OK: payout functions exist and are executable by authenticated';
END $$;

-- 2) TRIGGER ASSERTION
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    WHERE t.tgrelid = 'public.logistics_partners'::regclass
      AND t.tgname = 'trg_guard_logistics_license_review'
      AND t.tgenabled <> 'D'
      AND NOT t.tgisinternal
  ) THEN
    RAISE EXCEPTION 'VERIFY FAILED: trg_guard_logistics_license_review is missing or disabled';
  END IF;
  RAISE NOTICE 'VERIFY OK: trg_guard_logistics_license_review is active';
END $$;

-- 3) TRIGGER BEHAVIOUR: non-admin mutation must raise 42501
DO $$
DECLARE
  v_partner_id UUID;
  v_user_id    UUID;
  v_raised     BOOLEAN := FALSE;
BEGIN
  SELECT lp.id, lp.user_id INTO v_partner_id, v_user_id
  FROM public.logistics_partners lp
  JOIN public.user_profiles up ON up.id = lp.user_id
  WHERE up.role::text <> 'admin'
    AND NOT EXISTS (
      SELECT 1 FROM auth.users au
      WHERE au.id = lp.user_id
        AND (au.raw_user_meta_data->>'role' = 'admin' OR au.raw_app_meta_data->>'role' = 'admin')
    )
  ORDER BY lp.created_at
  LIMIT 1;

  IF v_partner_id IS NULL THEN
    RAISE NOTICE 'Trigger behaviour test skipped: no non-admin logistics partner found';
    RETURN;
  END IF;

  -- Impersonate the partner's own JWT subject
  PERFORM set_config('request.jwt.claim.sub', v_user_id::text, true);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_user_id::text, 'role', 'authenticated')::text, true);

  BEGIN
    UPDATE public.logistics_partners
    SET trade_license_review_status = 'approved'
    WHERE id = v_partner_id
      AND trade_license_review_status IS DISTINCT FROM 'approved';

    -- If the row was already 'approved' nothing changes; force a distinct change
    IF NOT FOUND THEN
      UPDATE public.logistics_partners
      SET license_review_note = COALESCE(license_review_note, '') || ' tamper-test'
      WHERE id = v_partner_id;
    END IF;
  EXCEPTION WHEN SQLSTATE '42501' THEN
    v_raised := TRUE;
  END;

  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '', true);

  IF NOT v_raised THEN
    RAISE EXCEPTION 'VERIFY FAILED: non-admin licence review update did NOT raise 42501';
  END IF;

  RAISE NOTICE 'VERIFY OK: non-admin licence review update raised 42501';
END $$;

-- 4) SEED RELEASED ESCROW FOR logistics.ye@direct-hub.net
DO $$
DECLARE
  v_user_id    UUID;
  v_partner_id UUID;
  v_buyer_id   UUID;
  v_balance    NUMERIC;
BEGIN
  SELECT au.id INTO v_user_id
  FROM auth.users au
  WHERE lower(au.email) = 'logistics.ye@direct-hub.net'
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'Seed skipped: auth user logistics.ye@direct-hub.net not found';
    RETURN;
  END IF;

  SELECT lp.id INTO v_partner_id
  FROM public.logistics_partners lp
  WHERE lp.user_id = v_user_id
  LIMIT 1;

  IF v_partner_id IS NULL THEN
    RAISE NOTICE 'Seed skipped: no logistics_partners row linked to logistics.ye@direct-hub.net';
    RETURN;
  END IF;

  -- Idempotency
  IF EXISTS (
    SELECT 1 FROM public.logistics_escrow_payments
    WHERE partner_id = v_partner_id AND admin_note = 'E2E_TEST_BALANCE_SEED_YE'
  ) THEN
    RAISE NOTICE 'Seed already present for logistics.ye - skipped';
    RETURN;
  END IF;

  SELECT up.id INTO v_buyer_id
  FROM public.user_profiles up
  WHERE up.id <> v_user_id AND up.role::text <> 'admin'
  ORDER BY up.created_at
  LIMIT 1;

  IF v_buyer_id IS NULL THEN
    SELECT up.id INTO v_buyer_id FROM public.user_profiles up WHERE up.id <> v_user_id LIMIT 1;
  END IF;

  IF v_buyer_id IS NULL THEN
    RAISE NOTICE 'Seed skipped: no buyer profile available';
    RETURN;
  END IF;

  INSERT INTO public.logistics_escrow_payments (
    buyer_id, partner_id, amount, currency, payment_status,
    escrow_held_at, released_at, release_condition, admin_note
  ) VALUES (
    v_buyer_id, v_partner_id, 50.00, 'USD',
    'released'::public.logistics_payment_status,
    now() - interval '2 days', now() - interval '1 day',
    'E2E test: delivery confirmed', 'E2E_TEST_BALANCE_SEED_YE'
  );

  v_balance := public.logistics_available_balance(v_partner_id, 'USD');
  RAISE NOTICE 'Seed OK for logistics.ye (partner %): available USD balance = %', v_partner_id, v_balance;
END $$;

NOTIFY pgrst, 'reload schema';
