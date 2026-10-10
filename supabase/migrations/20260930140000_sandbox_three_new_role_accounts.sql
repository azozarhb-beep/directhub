-- ============================================================
-- Seed the 3 sandbox roles that were added to the control-room
-- Test Accounts card without matching auth.users rows.
--
--   sandbox.intlfactory@directhub.net          / SandboxIntlFactory2026!
--   sandbox.logisticsoffice@directhub.net      / SandboxLogisticsOffice2026!
--   sandbox.commercialsupplier@directhub.net   / SandboxCommercialSupplier2026!
--
-- Must stay in sync with /api/sandbox-login.
-- ============================================================

DO $$
DECLARE
  rec RECORD;
  uid UUID;
BEGIN
  FOR rec IN
    SELECT * FROM (VALUES
      (
        'sandbox.intlfactory@directhub.net',
        'SandboxIntlFactory2026!',
        'Wei Chen — Sandbox International Factory',
        'manufacturer',
        'Guangzhou Pacific Manufacturing Co.',
        '+8613800000006',
        'China',
        'factory',
        'international_factory'
      ),
      (
        'sandbox.logisticsoffice@directhub.net',
        'SandboxLogisticsOffice2026!',
        'Fahad Al-Nuaimi — Sandbox Logistics Office',
        'logistics_partner',
        'Gulf Gate Logistics Office',
        '+971500000007',
        'UAE',
        'buyer',
        NULL
      ),
      (
        'sandbox.commercialsupplier@directhub.net',
        'SandboxCommercialSupplier2026!',
        'Layla Al-Harbi — Sandbox Commercial Supplier',
        'manufacturer',
        'Al-Harbi Commercial Supply',
        '+967771100008',
        'Yemen',
        'local_supplier',
        'local_supplier'
      )
    ) AS t(email, password, full_name, role, company_name, phone, country, account_type, seller_category)
  LOOP
    SELECT id INTO uid FROM auth.users WHERE email = rec.email LIMIT 1;
    IF uid IS NULL THEN uid := gen_random_uuid(); END IF;

    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_user_meta_data, raw_app_meta_data,
      is_sso_user, is_anonymous,
      confirmation_token, confirmation_sent_at,
      recovery_token, recovery_sent_at,
      email_change_token_new, email_change, email_change_sent_at,
      email_change_token_current, email_change_confirm_status,
      reauthentication_token, reauthentication_sent_at,
      phone, phone_change, phone_change_token, phone_change_sent_at
    ) VALUES (
      uid,
      '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      rec.email,
      crypt(rec.password, gen_salt('bf', 10)),
      now(), now(), now(),
      jsonb_strip_nulls(jsonb_build_object(
        'full_name', rec.full_name,
        'role', rec.role,
        'company_name', rec.company_name,
        'phone', rec.phone,
        'country', rec.country,
        'account_type', rec.account_type,
        'seller_category', rec.seller_category
      )),
      jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
      false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null
    )
    ON CONFLICT (id) DO UPDATE SET
      encrypted_password = crypt(rec.password, gen_salt('bf', 10)),
      email_confirmed_at = COALESCE(auth.users.email_confirmed_at, now()),
      raw_user_meta_data = jsonb_strip_nulls(jsonb_build_object(
        'full_name', rec.full_name,
        'role', rec.role,
        'company_name', rec.company_name,
        'phone', rec.phone,
        'country', rec.country,
        'account_type', rec.account_type,
        'seller_category', rec.seller_category
      )),
      updated_at = now();

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'auth' AND table_name = 'identities' AND column_name = 'provider_id'
    ) THEN
      INSERT INTO auth.identities (
        id, user_id, identity_data, provider, provider_id,
        last_sign_in_at, created_at, updated_at
      )
      SELECT
        gen_random_uuid(), uid,
        jsonb_build_object('sub', uid::text, 'email', rec.email),
        'email', uid::text,
        now(), now(), now()
      WHERE NOT EXISTS (
        SELECT 1 FROM auth.identities i
        WHERE i.user_id = uid AND i.provider = 'email'
      );
    END IF;

    INSERT INTO public.user_profiles (
      id, email, full_name, company_name, phone, country,
      role, is_verified, is_active, account_type, role_selected, seller_category
    ) VALUES (
      uid, rec.email, rec.full_name, rec.company_name, rec.phone, rec.country,
      rec.role::public.user_role, true, true, rec.account_type, true, rec.seller_category
    )
    ON CONFLICT (id) DO UPDATE SET
      email          = EXCLUDED.email,
      full_name      = EXCLUDED.full_name,
      company_name   = EXCLUDED.company_name,
      phone          = EXCLUDED.phone,
      country        = EXCLUDED.country,
      role           = EXCLUDED.role,
      is_verified    = true,
      is_active      = true,
      account_type   = EXCLUDED.account_type,
      role_selected  = true,
      seller_category = EXCLUDED.seller_category,
      updated_at     = now();
  END LOOP;

  RAISE NOTICE 'Seeded international_factory, logistics_office, commercial_supplier sandbox accounts.';
END $$;
