-- Field Rep assignment for direct-signup factories.
-- "rep_id" == factory_registrations.referred_by_agent_id (already read by
-- get_factory_supervisor_card). Adds admin assign + factory self-link RPCs
-- and realtime on factory_registrations so /manufacturer/messages updates instantly.

-- 1. Admin: assign (or clear) a field rep for a manufacturer user
CREATE OR REPLACE FUNCTION public.admin_assign_field_rep(p_factory_user_id UUID, p_agent_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $func$
DECLARE
  v_reg_id UUID;
  v_code TEXT;
  v_name TEXT;
BEGIN
  IF NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF p_agent_id IS NOT NULL THEN
    SELECT referral_code INTO v_code
    FROM public.user_profiles
    WHERE id = p_agent_id AND role::TEXT = 'field_agent'
    LIMIT 1;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'agent_not_found';
    END IF;
  END IF;

  SELECT id INTO v_reg_id
  FROM public.factory_registrations
  WHERE user_id = p_factory_user_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_reg_id IS NULL THEN
    SELECT COALESCE(NULLIF(company_name, ''), NULLIF(full_name, ''), '')
    INTO v_name
    FROM public.user_profiles
    WHERE id = p_factory_user_id;

    INSERT INTO public.factory_registrations (user_id, company_name)
    VALUES (p_factory_user_id, COALESCE(v_name, ''))
    RETURNING id INTO v_reg_id;
  END IF;

  UPDATE public.factory_registrations
  SET referred_by_agent_id = p_agent_id,
      referred_by_agent_code = CASE WHEN p_agent_id IS NULL THEN NULL ELSE v_code END
  WHERE id = v_reg_id;

  IF p_agent_id IS NULL THEN
    DELETE FROM public.agent_referrals WHERE facility_id = v_reg_id;
  ELSE
    INSERT INTO public.agent_referrals (agent_id, facility_id, referral_code, status)
    VALUES (p_agent_id, v_reg_id, v_code, 'pending')
    ON CONFLICT (facility_id) DO UPDATE
    SET agent_id = EXCLUDED.agent_id,
        referral_code = EXCLUDED.referral_code;
  END IF;

  RETURN v_reg_id;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.admin_assign_field_rep(UUID, UUID) TO authenticated;

-- 2. Factory: link itself to a rep using the rep's code (only when unassigned)
CREATE OR REPLACE FUNCTION public.link_factory_to_rep_code(p_code TEXT)
RETURNS TABLE (agent_id UUID, full_name TEXT, referral_code TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $func$
DECLARE
  v_code TEXT := UPPER(TRIM(COALESCE(p_code, '')));
  v_agent UUID;
  v_agent_code TEXT;
  v_agent_name TEXT;
  v_reg_id UUID;
  v_existing UUID;
  v_name TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF v_code = '' THEN
    RAISE EXCEPTION 'invalid_code';
  END IF;

  SELECT up.id, up.referral_code, COALESCE(NULLIF(up.full_name, ''), up.email, '')
  INTO v_agent, v_agent_code, v_agent_name
  FROM public.user_profiles up
  WHERE UPPER(up.referral_code) = v_code
    AND up.role::TEXT = 'field_agent'
  LIMIT 1;

  IF v_agent IS NULL OR v_agent = auth.uid() THEN
    RAISE EXCEPTION 'invalid_code';
  END IF;

  SELECT id, referred_by_agent_id INTO v_reg_id, v_existing
  FROM public.factory_registrations
  WHERE user_id = auth.uid()
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RAISE EXCEPTION 'already_assigned';
  END IF;

  IF v_reg_id IS NULL THEN
    SELECT COALESCE(NULLIF(company_name, ''), NULLIF(full_name, ''), '')
    INTO v_name
    FROM public.user_profiles
    WHERE id = auth.uid();

    INSERT INTO public.factory_registrations (user_id, company_name)
    VALUES (auth.uid(), COALESCE(v_name, ''))
    RETURNING id INTO v_reg_id;
  END IF;

  UPDATE public.factory_registrations
  SET referred_by_agent_id = v_agent,
      referred_by_agent_code = UPPER(v_agent_code)
  WHERE id = v_reg_id;

  INSERT INTO public.agent_referrals (agent_id, facility_id, referral_code, status)
  VALUES (v_agent, v_reg_id, UPPER(v_agent_code), 'pending')
  ON CONFLICT (facility_id) DO UPDATE
  SET agent_id = EXCLUDED.agent_id,
      referral_code = EXCLUDED.referral_code;

  RETURN QUERY SELECT v_agent, v_agent_name, v_agent_code;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.link_factory_to_rep_code(TEXT) TO authenticated;

-- 3. Factory: read whether it currently has a rep assigned
CREATE OR REPLACE FUNCTION public.get_factory_rep_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
  SELECT fr.referred_by_agent_id
  FROM public.factory_registrations fr
  WHERE fr.user_id = auth.uid()
  ORDER BY (fr.referred_by_agent_id IS NOT NULL) DESC, fr.created_at DESC
  LIMIT 1
$func$;

GRANT EXECUTE ON FUNCTION public.get_factory_rep_id() TO authenticated;

-- 4. Admin: list active registered field reps for the dropdown
CREATE OR REPLACE FUNCTION public.admin_list_active_field_reps()
RETURNS TABLE (id UUID, full_name TEXT, referral_code TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
  SELECT up.id, COALESCE(NULLIF(up.full_name, ''), up.email, '') AS full_name, up.referral_code
  FROM public.user_profiles up
  WHERE public.is_admin_user()
    AND up.role::TEXT = 'field_agent'
    AND COALESCE(up.is_active, true) = true
  ORDER BY up.full_name NULLS LAST
$func$;

GRANT EXECUTE ON FUNCTION public.admin_list_active_field_reps() TO authenticated;

-- 5. Admin: map of factory user -> assigned rep (for the management list)
CREATE OR REPLACE FUNCTION public.admin_factory_rep_map()
RETURNS TABLE (user_id UUID, agent_id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
  SELECT DISTINCT ON (fr.user_id) fr.user_id, fr.referred_by_agent_id
  FROM public.factory_registrations fr
  WHERE public.is_admin_user()
  ORDER BY fr.user_id, (fr.referred_by_agent_id IS NOT NULL) DESC, fr.created_at DESC
$func$;

GRANT EXECUTE ON FUNCTION public.admin_factory_rep_map() TO authenticated;

-- 6. Realtime on factory_registrations so the factory UI updates when admin assigns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'factory_registrations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.factory_registrations;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Realtime publication check skipped: %', SQLERRM;
END $$;
