-- ============================================================
-- Sales Rep RBAC repair: backfill links for already-registered invitees
-- and make owner resolution work off factory_sales_reps as well.
-- ============================================================

-- 1. Owner resolution: profile link first, then an active factory_sales_reps row.
CREATE OR REPLACE FUNCTION public.get_agent_factory_owner_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
  SELECT COALESCE(
    (
      SELECT up.factory_id
        FROM public.user_profiles up
       WHERE up.id = auth.uid()
         AND up.role = 'manufacturer_agent'
         AND COALESCE(up.is_active, true) = true
       LIMIT 1
    ),
    (
      SELECT r.factory_owner_id
        FROM public.factory_sales_reps r
       WHERE r.rep_user_id = auth.uid()
         AND r.status = 'active'
       LIMIT 1
    )
  );
$func$;

-- 2. Backfill: link pending invitations to users who registered BEFORE the trigger existed.
DO $backfill$
DECLARE
  v_row RECORD;
  v_user UUID;
BEGIN
  FOR v_row IN
    SELECT r.id, r.factory_owner_id, r.invited_email
      FROM public.factory_sales_reps r
     WHERE r.rep_user_id IS NULL
       AND r.status IN ('pending', 'active')
  LOOP
    v_user := NULL;

    -- Match on profile email
    SELECT up.id INTO v_user
      FROM public.user_profiles up
     WHERE lower(up.email) = lower(v_row.invited_email)
       AND up.id <> v_row.factory_owner_id
     LIMIT 1;

    -- Match on auth.users email (covers NNN@phone.directhub.local accounts)
    IF v_user IS NULL THEN
      SELECT u.id INTO v_user
        FROM auth.users u
       WHERE lower(u.email) = lower(v_row.invited_email)
         AND u.id <> v_row.factory_owner_id
       LIMIT 1;
    END IF;

    -- Match on phone digits inside the invited address
    IF v_user IS NULL THEN
      SELECT up.id INTO v_user
        FROM public.user_profiles up
       WHERE up.phone IS NOT NULL
         AND public.normalize_sales_rep_phone(up.phone)
             = public.normalize_sales_rep_phone(split_part(v_row.invited_email, '@', 1))
         AND up.id <> v_row.factory_owner_id
       LIMIT 1;
    END IF;

    IF v_user IS NOT NULL THEN
      UPDATE public.factory_sales_reps
         SET rep_user_id = v_user,
             status = 'active',
             accepted_at = COALESCE(accepted_at, now())
       WHERE id = v_row.id;

      UPDATE public.user_profiles
         SET role = 'manufacturer_agent',
             factory_id = v_row.factory_owner_id,
             is_active = true
       WHERE id = v_user
         AND role NOT IN ('admin');
    END IF;
  END LOOP;
END;
$backfill$;

-- 3. Repair already-linked reps whose profile was never updated.
UPDATE public.user_profiles up
   SET role = 'manufacturer_agent',
       factory_id = r.factory_owner_id,
       is_active = true
  FROM public.factory_sales_reps r
 WHERE r.rep_user_id = up.id
   AND r.status = 'active'
   AND up.role NOT IN ('admin')
   AND (up.role IS DISTINCT FROM 'manufacturer_agent' OR up.factory_id IS DISTINCT FROM r.factory_owner_id);
