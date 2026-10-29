-- Agent factory verification audit trail + directory verification sync + directory ranking indexes

-- 1. Audit columns on agent_factory_registrations
ALTER TABLE public.agent_factory_registrations
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS verified_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT false;

UPDATE public.agent_factory_registrations
SET created_by = agent_id
WHERE created_by IS NULL;

UPDATE public.agent_factory_registrations
SET is_verified = true,
    verified_at = COALESCE(verified_at, license_reviewed_at, updated_at, now()),
    verified_by = COALESCE(verified_by, license_reviewed_by)
WHERE registration_status = 'approved'
  AND is_verified = false;

-- 2. Verification flags on the directory tables
ALTER TABLE public.factory_registrations
  ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS verified_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS onboarded_by_agent_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL;

ALTER TABLE public.supplier_profiles
  ADD COLUMN IF NOT EXISTS origin_type text NOT NULL DEFAULT 'local',
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS verified_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS onboarded_by_agent_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL;

-- 3. Indexes for verified-first + local/international ranking
CREATE INDEX IF NOT EXISTS idx_supplier_profiles_rank
  ON public.supplier_profiles (is_verified DESC, origin_type, rating DESC);
CREATE INDEX IF NOT EXISTS idx_factory_registrations_verified_rank
  ON public.factory_registrations (is_verified DESC, origin_type, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_factory_regs_is_verified
  ON public.agent_factory_registrations (is_verified, registration_status);

-- 4. Stamp audit fields on agent_factory_registrations (BEFORE trigger)
CREATE OR REPLACE FUNCTION public.stamp_agent_factory_audit()
RETURNS trigger
LANGUAGE plpgsql
AS $func$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.created_by IS NULL THEN
      NEW.created_by := COALESCE(auth.uid(), NEW.agent_id);
    END IF;
  END IF;

  IF NEW.registration_status = 'approved'
     AND (TG_OP = 'INSERT' OR OLD.registration_status IS DISTINCT FROM 'approved') THEN
    NEW.is_verified := true;
    NEW.verified_at := COALESCE(NEW.verified_at, now());
    IF NEW.verified_by IS NULL THEN
      NEW.verified_by := auth.uid();
    END IF;
  ELSIF NEW.registration_status IN ('rejected', 'pending', 'under_review')
        AND TG_OP = 'UPDATE'
        AND OLD.registration_status = 'approved' THEN
    NEW.is_verified := false;
    NEW.verified_at := NULL;
    NEW.verified_by := NULL;
  END IF;

  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trg_stamp_agent_factory_audit ON public.agent_factory_registrations;
CREATE TRIGGER trg_stamp_agent_factory_audit
  BEFORE INSERT OR UPDATE ON public.agent_factory_registrations
  FOR EACH ROW EXECUTE FUNCTION public.stamp_agent_factory_audit();

-- 5. Propagate verification to supplier_profiles + factory_registrations (AFTER trigger)
CREATE OR REPLACE FUNCTION public.sync_agent_factory_verification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  IF NEW.factory_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.is_verified IS NOT DISTINCT FROM NEW.is_verified
     AND OLD.origin_type IS NOT DISTINCT FROM NEW.origin_type THEN
    RETURN NEW;
  END IF;

  UPDATE public.factory_registrations fr
  SET is_verified = NEW.is_verified,
      verified_at = NEW.verified_at,
      verified_by = NEW.verified_by,
      onboarded_by_agent_id = NEW.agent_id
  WHERE fr.user_id = NEW.factory_user_id;

  UPDATE public.supplier_profiles sp
  SET is_verified = NEW.is_verified,
      verified_at = NEW.verified_at,
      verified_by = NEW.verified_by,
      onboarded_by_agent_id = NEW.agent_id,
      origin_type = COALESCE(NULLIF(NEW.origin_type, ''), sp.origin_type),
      updated_at = now()
  WHERE sp.user_id = NEW.factory_user_id;

  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trg_sync_agent_factory_verification ON public.agent_factory_registrations;
CREATE TRIGGER trg_sync_agent_factory_verification
  AFTER INSERT OR UPDATE ON public.agent_factory_registrations
  FOR EACH ROW EXECUTE FUNCTION public.sync_agent_factory_verification();

-- 6. Backfill: already-approved agent factories that are linked to a factory account
UPDATE public.factory_registrations fr
SET is_verified = true,
    verified_at = COALESCE(fr.verified_at, afr.verified_at),
    verified_by = COALESCE(fr.verified_by, afr.verified_by),
    onboarded_by_agent_id = afr.agent_id
FROM public.agent_factory_registrations afr
WHERE afr.factory_user_id = fr.user_id
  AND afr.is_verified = true;

UPDATE public.supplier_profiles sp
SET is_verified = true,
    verified_at = COALESCE(sp.verified_at, afr.verified_at),
    verified_by = COALESCE(sp.verified_by, afr.verified_by),
    onboarded_by_agent_id = afr.agent_id,
    origin_type = COALESCE(NULLIF(afr.origin_type, ''), sp.origin_type)
FROM public.agent_factory_registrations afr
WHERE afr.factory_user_id = sp.user_id
  AND afr.is_verified = true;

-- 7. Backfill supplier_profiles.origin_type from factory_registrations
UPDATE public.supplier_profiles sp
SET origin_type = fr.origin_type::text
FROM public.factory_registrations fr
WHERE fr.user_id = sp.user_id
  AND fr.origin_type IS NOT NULL;

NOTIFY pgrst, 'reload schema';
