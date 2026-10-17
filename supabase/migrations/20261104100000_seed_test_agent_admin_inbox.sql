-- Seed a verified test field agent (only if no agent exists) + welcome thread in agent_admin_messages.
-- Additive & idempotent: no schema or chat-log deletions.
DO $$
DECLARE
  existing_agent_id UUID;
  new_agent_id      UUID := gen_random_uuid();
BEGIN
  SELECT id INTO existing_agent_id
  FROM public.user_profiles
  WHERE role::text IN ('agent', 'field_agent', 'field-agent')
  ORDER BY created_at ASC NULLS LAST
  LIMIT 1;

  IF existing_agent_id IS NULL THEN
    -- Reuse sandbox agent auth user if it exists, else create one
    SELECT id INTO existing_agent_id FROM auth.users WHERE email = 'sandbox.agent@directhub.net' LIMIT 1;

    IF existing_agent_id IS NULL THEN
      INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password,
        email_confirmed_at, created_at, updated_at,
        raw_user_meta_data, raw_app_meta_data,
        is_sso_user, is_anonymous, confirmation_token, recovery_token,
        email_change_token_new, email_change, email_change_token_current,
        reauthentication_token, phone_change, phone_change_token
      ) VALUES (
        new_agent_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'sandbox.agent@directhub.net', crypt('SandboxAgent2026!', gen_salt('bf', 10)),
        now(), now(), now(),
        jsonb_build_object('full_name', 'مندوب تجريبي — Test Agent', 'role', 'field_agent', 'company_name', 'DirectHub Field Representative'),
        jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
        false, false, '', '', '', '', '', '', '', ''
      ) ON CONFLICT (id) DO NOTHING;
      existing_agent_id := new_agent_id;
    END IF;

    INSERT INTO public.user_profiles (
      id, email, full_name, company_name, phone, country,
      role, is_verified, is_active, account_type, role_selected
    ) VALUES (
      existing_agent_id, 'sandbox.agent@directhub.net', 'مندوب تجريبي — Test Agent',
      'DirectHub Field Representative', '+967771100004', 'Yemen',
      'field_agent', true, true, 'field_agent', true
    ) ON CONFLICT (id) DO UPDATE SET is_verified = true, is_active = true;
  END IF;

  -- Welcome thread so the admin inbox has an active, replyable agent conversation
  IF existing_agent_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.agent_admin_messages WHERE agent_id = existing_agent_id
  ) THEN
    INSERT INTO public.agent_admin_messages (agent_id, sender_role, message, msg_type, is_read_by_admin, is_read_by_agent)
    VALUES (existing_agent_id, 'agent', 'مرحباً، هذه محادثة تجريبية من المندوب الميداني.', 'text', false, true);
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Agent seed skipped: %', SQLERRM;
END $$;

-- Ensure admins can reply (insert/update) on agent_admin_messages
DROP POLICY IF EXISTS "agent_admin_messages_insert" ON public.agent_admin_messages;
CREATE POLICY "agent_admin_messages_insert"
ON public.agent_admin_messages
FOR INSERT
TO authenticated
WITH CHECK (agent_id = auth.uid() OR public.is_admin_user());

DROP POLICY IF EXISTS "agent_admin_messages_update" ON public.agent_admin_messages;
CREATE POLICY "agent_admin_messages_update"
ON public.agent_admin_messages
FOR UPDATE
TO authenticated
USING (agent_id = auth.uid() OR public.is_admin_user())
WITH CHECK (agent_id = auth.uid() OR public.is_admin_user());
