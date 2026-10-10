-- ============================================================
-- Fix: Sandbox Auth Users — Upsert by Email
-- Ensures all 5 sandbox accounts exist in auth.users with
-- the correct bcrypt-hashed passwords so signInWithPassword works.
-- ============================================================
-- Credentials (unchanged — must match /api/sandbox-login route):
--   sandbox.buyer@directhub.net      / SandboxBuyer2026!
--   sandbox.supplier@directhub.net   / SandboxSupplier2026!
--   sandbox.factory@directhub.net    / SandboxFactory2026!
--   sandbox.agent@directhub.net      / SandboxAgent2026!
--   sandbox.logistics@directhub.net  / SandboxLogistics2026!
-- ============================================================

DO $$
DECLARE
  buyer_uid      UUID;
  supplier_uid   UUID;
  factory_uid    UUID;
  agent_uid      UUID;
  logistics_uid  UUID;
BEGIN

  -- ============================================================
  -- Resolve or create UUIDs for each sandbox account
  -- We use email as the stable key — if the user already exists
  -- we grab their id; otherwise we generate a new one.
  -- ============================================================

  SELECT id INTO buyer_uid FROM auth.users WHERE email = 'sandbox.buyer@directhub.net' LIMIT 1;
  IF buyer_uid IS NULL THEN buyer_uid := gen_random_uuid(); END IF;

  SELECT id INTO supplier_uid FROM auth.users WHERE email = 'sandbox.supplier@directhub.net' LIMIT 1;
  IF supplier_uid IS NULL THEN supplier_uid := gen_random_uuid(); END IF;

  SELECT id INTO factory_uid FROM auth.users WHERE email = 'sandbox.factory@directhub.net' LIMIT 1;
  IF factory_uid IS NULL THEN factory_uid := gen_random_uuid(); END IF;

  SELECT id INTO agent_uid FROM auth.users WHERE email = 'sandbox.agent@directhub.net' LIMIT 1;
  IF agent_uid IS NULL THEN agent_uid := gen_random_uuid(); END IF;

  SELECT id INTO logistics_uid FROM auth.users WHERE email = 'sandbox.logistics@directhub.net' LIMIT 1;
  IF logistics_uid IS NULL THEN logistics_uid := gen_random_uuid(); END IF;

  -- ============================================================
  -- Upsert auth.users — insert if missing, update password if exists
  -- ============================================================

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
  ) VALUES
    -- Sandbox Buyer
    (buyer_uid,
     '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'sandbox.buyer@directhub.net',
     crypt('SandboxBuyer2026!', gen_salt('bf', 10)),
     now(), now(), now(),
     jsonb_build_object('full_name', 'Ahmed Al-Rashidi — Sandbox Buyer', 'role', 'buyer', 'company_name', 'Al-Rashidi Trading Co.', 'phone', '+967771100001', 'country', 'Yemen'),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),

    -- Sandbox Supplier
    (supplier_uid,
     '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'sandbox.supplier@directhub.net',
     crypt('SandboxSupplier2026!', gen_salt('bf', 10)),
     now(), now(), now(),
     jsonb_build_object('full_name', 'Khalid Al-Yamani — Sandbox Supplier', 'role', 'manufacturer', 'company_name', 'Al-Yamani General Trading', 'phone', '+967771100002', 'country', 'Yemen'),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),

    -- Sandbox Factory
    (factory_uid,
     '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'sandbox.factory@directhub.net',
     crypt('SandboxFactory2026!', gen_salt('bf', 10)),
     now(), now(), now(),
     jsonb_build_object('full_name', 'Omar Al-Hadhrami — Sandbox Factory', 'role', 'manufacturer', 'company_name', 'Al-Hadhrami Packaging Industries', 'phone', '+967771100003', 'country', 'Yemen'),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),

    -- Sandbox Agent
    (agent_uid,
     '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'sandbox.agent@directhub.net',
     crypt('SandboxAgent2026!', gen_salt('bf', 10)),
     now(), now(), now(),
     jsonb_build_object('full_name', 'Nasser Al-Subaie — Sandbox Agent', 'role', 'field_agent', 'company_name', 'DirectHub Field Representative', 'phone', '+967771100004', 'country', 'Yemen'),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),

    -- Sandbox Logistics
    (logistics_uid,
     '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'sandbox.logistics@directhub.net',
     crypt('SandboxLogistics2026!', gen_salt('bf', 10)),
     now(), now(), now(),
     jsonb_build_object('full_name', 'Saleh Al-Amri — Sandbox Logistics', 'role', 'logistics_partner', 'company_name', 'Al-Amri Express Logistics', 'phone', '+967771100005', 'country', 'Yemen'),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null)

  ON CONFLICT (id) DO UPDATE SET
    encrypted_password  = crypt(
      CASE auth.users.email
        WHEN 'sandbox.buyer@directhub.net'     THEN 'SandboxBuyer2026!'
        WHEN 'sandbox.supplier@directhub.net'  THEN 'SandboxSupplier2026!'
        WHEN 'sandbox.factory@directhub.net'   THEN 'SandboxFactory2026!'
        WHEN 'sandbox.agent@directhub.net'     THEN 'SandboxAgent2026!'
        WHEN 'sandbox.logistics@directhub.net' THEN 'SandboxLogistics2026!'
        ELSE auth.users.encrypted_password
      END,
      gen_salt('bf', 10)
    ),
    email_confirmed_at  = COALESCE(auth.users.email_confirmed_at, now()),
    updated_at          = now();

  -- ============================================================
  -- Ensure user_profiles exist for all sandbox accounts
  -- ============================================================

  INSERT INTO public.user_profiles (
    id, email, full_name, company_name, phone, country,
    role, is_verified, is_active, account_type, role_selected
  ) VALUES
    (buyer_uid,
     'sandbox.buyer@directhub.net', 'Ahmed Al-Rashidi — Sandbox Buyer',
     'Al-Rashidi Trading Co.', '+967771100001', 'Yemen',
     'buyer', true, true, 'buyer', true),

    (supplier_uid,
     'sandbox.supplier@directhub.net', 'Khalid Al-Yamani — Sandbox Supplier',
     'Al-Yamani General Trading', '+967771100002', 'Yemen',
     'manufacturer', true, true, 'local_supplier', true),

    (factory_uid,
     'sandbox.factory@directhub.net', 'Omar Al-Hadhrami — Sandbox Factory',
     'Al-Hadhrami Packaging Industries', '+967771100003', 'Yemen',
     'manufacturer', true, true, 'factory', true),

    (agent_uid,
     'sandbox.agent@directhub.net', 'Nasser Al-Subaie — Sandbox Agent',
     'DirectHub Field Representative', '+967771100004', 'Yemen',
     'field_agent', true, true, 'field_agent', true),

    (logistics_uid,
     'sandbox.logistics@directhub.net', 'Saleh Al-Amri — Sandbox Logistics',
     'Al-Amri Express Logistics', '+967771100005', 'Yemen',
     'logistics_partner', true, true, 'logistics_partner', true)

  ON CONFLICT (id) DO UPDATE SET
    is_verified   = true,
    is_active     = true,
    role_selected = true;

  RAISE NOTICE 'Sandbox auth users upserted successfully.';
  RAISE NOTICE '  buyer_uid=%',     buyer_uid;
  RAISE NOTICE '  supplier_uid=%',  supplier_uid;
  RAISE NOTICE '  factory_uid=%',   factory_uid;
  RAISE NOTICE '  agent_uid=%',     agent_uid;
  RAISE NOTICE '  logistics_uid=%', logistics_uid;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Sandbox user upsert failed: %', SQLERRM;
END $$;
