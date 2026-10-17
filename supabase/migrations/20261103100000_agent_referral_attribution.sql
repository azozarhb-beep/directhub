-- Migration: Agent referral attribution (referral_code, referred_by_agent_code, agent_referrals)
-- Timestamp: 20261103100000

-- 1. Persistent referral code on user_profiles (agents)
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS referral_code TEXT;

UPDATE public.user_profiles
SET referral_code = 'AGT-' || UPPER(SUBSTRING(REPLACE(id::TEXT, '-', '') FROM 1 FOR 8))
WHERE referral_code IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_referral_code
ON public.user_profiles (UPPER(referral_code))
WHERE referral_code IS NOT NULL;

CREATE OR REPLACE FUNCTION public.set_user_profile_referral_code()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $func$
BEGIN
  IF NEW.referral_code IS NULL OR NEW.referral_code = '' THEN
    NEW.referral_code := 'AGT-' || UPPER(SUBSTRING(REPLACE(NEW.id::TEXT, '-', '') FROM 1 FOR 8));
  END IF;
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trg_set_user_profile_referral_code ON public.user_profiles;
CREATE TRIGGER trg_set_user_profile_referral_code
BEFORE INSERT ON public.user_profiles
FOR EACH ROW EXECUTE FUNCTION public.set_user_profile_referral_code();

-- 2. Referral code stored on the facility
ALTER TABLE public.factory_registrations
ADD COLUMN IF NOT EXISTS referred_by_agent_code TEXT;

CREATE INDEX IF NOT EXISTS idx_factory_registrations_referred_by_agent_code
ON public.factory_registrations (referred_by_agent_code)
WHERE referred_by_agent_code IS NOT NULL;

-- 3. agent_referrals table
CREATE TABLE IF NOT EXISTS public.agent_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  facility_id UUID NOT NULL REFERENCES public.factory_registrations(id) ON DELETE CASCADE,
  referral_code TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  registration_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_referrals_facility_unique
ON public.agent_referrals (facility_id);

CREATE INDEX IF NOT EXISTS idx_agent_referrals_agent_id
ON public.agent_referrals (agent_id);

-- 4. Helper functions (before policies)
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $func$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
      AND (
        raw_user_meta_data->>'role' = 'admin'
        OR raw_app_meta_data->>'role' = 'admin'
      )
  )
$func$;

-- Binds the signed-in user's facility to the agent that owns the referral code.
-- Sets agent_id, referred_by_agent_id, referred_by_agent_code and upserts agent_referrals.
CREATE OR REPLACE FUNCTION public.bind_facility_referral(p_facility_id UUID, p_code TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $func$
DECLARE
  v_agent_id UUID;
  v_code TEXT := UPPER(TRIM(COALESCE(p_code, '')));
  v_status TEXT;
  v_owner UUID;
  v_created TIMESTAMPTZ;
BEGIN
  IF v_code = '' THEN
    RETURN NULL;
  END IF;

  SELECT user_id, registration_status::TEXT, COALESCE(submitted_at, created_at, CURRENT_TIMESTAMP)
  INTO v_owner, v_status, v_created
  FROM public.factory_registrations
  WHERE id = p_facility_id
  LIMIT 1;

  IF v_owner IS NULL OR v_owner <> auth.uid() THEN
    RETURN NULL;
  END IF;

  SELECT id INTO v_agent_id
  FROM public.user_profiles
  WHERE UPPER(referral_code) = v_code
  LIMIT 1;

  IF v_agent_id IS NULL OR v_agent_id = v_owner THEN
    RETURN NULL;
  END IF;

  UPDATE public.factory_registrations
  SET referred_by_agent_id = v_agent_id,
      referred_by_agent_code = v_code
  WHERE id = p_facility_id;

  INSERT INTO public.agent_referrals (agent_id, facility_id, referral_code, status, registration_date)
  VALUES (v_agent_id, p_facility_id, v_code, COALESCE(v_status, 'pending'), v_created)
  ON CONFLICT (facility_id) DO UPDATE
  SET agent_id = EXCLUDED.agent_id,
      referral_code = EXCLUDED.referral_code,
      status = EXCLUDED.status;

  RETURN v_agent_id;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.bind_facility_referral(UUID, TEXT) TO authenticated;

-- Keep agent_referrals.status in sync with the facility status
CREATE OR REPLACE FUNCTION public.sync_agent_referral_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  UPDATE public.agent_referrals
  SET status = NEW.registration_status::TEXT
  WHERE facility_id = NEW.id;
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trg_sync_agent_referral_status ON public.factory_registrations;
CREATE TRIGGER trg_sync_agent_referral_status
AFTER UPDATE OF registration_status ON public.factory_registrations
FOR EACH ROW EXECUTE FUNCTION public.sync_agent_referral_status();

-- 5. Backfill existing referred facilities
UPDATE public.factory_registrations fr
SET referred_by_agent_code = up.referral_code
FROM public.user_profiles up
WHERE fr.referred_by_agent_id = up.id
  AND fr.referred_by_agent_code IS NULL;

INSERT INTO public.agent_referrals (agent_id, facility_id, referral_code, status, registration_date)
SELECT fr.referred_by_agent_id, fr.id, fr.referred_by_agent_code,
       COALESCE(fr.registration_status::TEXT, 'pending'),
       COALESCE(fr.submitted_at, fr.created_at, CURRENT_TIMESTAMP)
FROM public.factory_registrations fr
JOIN public.user_profiles up ON up.id = fr.referred_by_agent_id
WHERE fr.referred_by_agent_id IS NOT NULL
ON CONFLICT (facility_id) DO NOTHING;

-- 6. RLS
ALTER TABLE public.agent_referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agent_referrals_agent_select" ON public.agent_referrals;
CREATE POLICY "agent_referrals_agent_select"
ON public.agent_referrals
FOR SELECT
TO authenticated
USING (agent_id = auth.uid() OR public.is_admin_user());

DROP POLICY IF EXISTS "agent_referrals_admin_manage" ON public.agent_referrals;
CREATE POLICY "agent_referrals_admin_manage"
ON public.agent_referrals
FOR ALL
TO authenticated
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

-- Agents can read the facilities that were attributed to them
DROP POLICY IF EXISTS "agents_view_referred_factory_registrations" ON public.factory_registrations;
CREATE POLICY "agents_view_referred_factory_registrations"
ON public.factory_registrations
FOR SELECT
TO authenticated
USING (referred_by_agent_id = auth.uid());
