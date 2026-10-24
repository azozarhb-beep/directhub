-- Global Field Rep Territory Engine + Universal Duplicate Prevention
-- rep_id == factory_registrations.referred_by_agent_id (see 20261203100000_field_rep_assignment.sql)

-- ============================================================
-- 1. Normalization helpers
-- ============================================================
CREATE OR REPLACE FUNCTION public.normalize_phone_digits(p_value TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $func$
  SELECT NULLIF(regexp_replace(COALESCE(p_value, ''), '[^0-9]', '', 'g'), '')
$func$;

CREATE OR REPLACE FUNCTION public.normalize_commercial_register(p_value TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $func$
  SELECT NULLIF(upper(regexp_replace(COALESCE(p_value, ''), '[^0-9A-Za-z]', '', 'g')), '')
$func$;

-- ============================================================
-- 2. Zones table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.zones (
  zone_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code TEXT NOT NULL,
  province_city TEXT NOT NULL,
  zone_name TEXT NOT NULL,
  assigned_rep_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_zones_unique_location
ON public.zones (upper(country_code), lower(province_city), lower(zone_name));
CREATE INDEX IF NOT EXISTS idx_zones_country ON public.zones (upper(country_code));
CREATE INDEX IF NOT EXISTS idx_zones_assigned_rep ON public.zones (assigned_rep_id);

-- ============================================================
-- 3. New columns on factory_registrations
-- ============================================================
ALTER TABLE public.factory_registrations
  ADD COLUMN IF NOT EXISTS zone_id UUID REFERENCES public.zones(zone_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assignment_status TEXT NOT NULL DEFAULT 'pending_assignment',
  ADD COLUMN IF NOT EXISTS commercial_register_norm TEXT,
  ADD COLUMN IF NOT EXISTS phone_norm TEXT,
  ADD COLUMN IF NOT EXISTS rep_link_requested_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_factory_regs_zone ON public.factory_registrations (zone_id);
CREATE INDEX IF NOT EXISTS idx_factory_regs_assignment_status ON public.factory_registrations (assignment_status);

-- Trigger keeps normalized values + assignment_status in sync
CREATE OR REPLACE FUNCTION public.factory_regs_sync_territory_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $func$
BEGIN
  NEW.commercial_register_norm := public.normalize_commercial_register(NEW.commercial_registration_number);
  NEW.phone_norm := public.normalize_phone_digits(NEW.contact_phone);
  IF NEW.referred_by_agent_id IS NOT NULL THEN
    NEW.assignment_status := 'assigned';
  ELSE
    NEW.assignment_status := 'pending_assignment';
  END IF;
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trg_factory_regs_sync_territory ON public.factory_registrations;
CREATE TRIGGER trg_factory_regs_sync_territory
BEFORE INSERT OR UPDATE ON public.factory_registrations
FOR EACH ROW EXECUTE FUNCTION public.factory_regs_sync_territory_fields();

-- Backfill, then clear the normalized value on later duplicates so the unique index can be created
UPDATE public.factory_registrations
SET commercial_register_norm = public.normalize_commercial_register(commercial_registration_number),
    phone_norm = public.normalize_phone_digits(contact_phone),
    assignment_status = CASE WHEN referred_by_agent_id IS NOT NULL THEN 'assigned' ELSE 'pending_assignment' END;

UPDATE public.factory_registrations fr
SET commercial_register_norm = NULL
WHERE fr.commercial_register_norm IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.factory_registrations o
    WHERE o.commercial_register_norm = fr.commercial_register_norm
      AND (o.created_at, o.id) < (fr.created_at, fr.id)
  );

UPDATE public.factory_registrations fr
SET phone_norm = NULL
WHERE fr.phone_norm IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.factory_registrations o
    WHERE o.phone_norm = fr.phone_norm
      AND (o.created_at, o.id) < (fr.created_at, fr.id)
  );

CREATE UNIQUE INDEX IF NOT EXISTS uq_factory_regs_commercial_register
ON public.factory_registrations (commercial_register_norm)
WHERE commercial_register_norm IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_factory_regs_phone
ON public.factory_registrations (phone_norm)
WHERE phone_norm IS NOT NULL;

-- ============================================================
-- 4. Duplicate pre-validation (callable before insert)
-- Returns one row: status = 'ok' | 'assigned' | 'unassigned'
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_registration_duplicate(
  p_commercial_register TEXT,
  p_phone TEXT
)
RETURNS TABLE (
  status TEXT,
  matched_field TEXT,
  registration_id UUID,
  company_name TEXT,
  rep_id UUID,
  rep_name TEXT,
  is_own BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_cr TEXT := public.normalize_commercial_register(p_commercial_register);
  v_ph TEXT := public.normalize_phone_digits(p_phone);
  v_reg RECORD;
  v_field TEXT;
  v_rep_name TEXT;
BEGIN
  v_reg := NULL;

  IF v_cr IS NOT NULL THEN
    SELECT fr.id, fr.company_name, fr.referred_by_agent_id, fr.user_id
    INTO v_reg
    FROM public.factory_registrations fr
    WHERE fr.commercial_register_norm = v_cr
    ORDER BY fr.created_at
    LIMIT 1;
    IF FOUND THEN v_field := 'commercial_register'; END IF;
  END IF;

  IF v_field IS NULL AND v_ph IS NOT NULL THEN
    SELECT fr.id, fr.company_name, fr.referred_by_agent_id, fr.user_id
    INTO v_reg
    FROM public.factory_registrations fr
    WHERE fr.phone_norm = v_ph
    ORDER BY fr.created_at
    LIMIT 1;
    IF FOUND THEN v_field := 'phone_number'; END IF;
  END IF;

  IF v_field IS NULL THEN
    RETURN QUERY SELECT 'ok'::TEXT, NULL::TEXT, NULL::UUID, NULL::TEXT, NULL::UUID, NULL::TEXT, false;
    RETURN;
  END IF;

  IF v_reg.referred_by_agent_id IS NOT NULL THEN
    SELECT COALESCE(NULLIF(up.full_name, ''), up.email, '')
    INTO v_rep_name
    FROM public.user_profiles up
    WHERE up.id = v_reg.referred_by_agent_id
    LIMIT 1;

    RETURN QUERY SELECT 'assigned'::TEXT, v_field, v_reg.id, v_reg.company_name,
      v_reg.referred_by_agent_id, COALESCE(v_rep_name, ''), (v_reg.user_id = auth.uid());
  ELSE
    RETURN QUERY SELECT 'unassigned'::TEXT, v_field, v_reg.id, v_reg.company_name,
      NULL::UUID, NULL::TEXT, (v_reg.user_id = auth.uid());
  END IF;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.check_registration_duplicate(TEXT, TEXT) TO authenticated;

-- ============================================================
-- 5. Zone listing for onboarding (no rep details exposed)
-- ============================================================
CREATE OR REPLACE FUNCTION public.list_active_zones(p_country_code TEXT DEFAULT NULL)
RETURNS TABLE (
  zone_id UUID,
  country_code TEXT,
  province_city TEXT,
  zone_name TEXT,
  has_rep BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
  SELECT z.zone_id, z.country_code, z.province_city, z.zone_name,
         (z.assigned_rep_id IS NOT NULL) AS has_rep
  FROM public.zones z
  WHERE z.is_active = true
    AND (p_country_code IS NULL OR upper(z.country_code) = upper(p_country_code))
  ORDER BY z.country_code, z.province_city, z.zone_name
$func$;

GRANT EXECUTE ON FUNCTION public.list_active_zones(TEXT) TO anon, authenticated;

-- ============================================================
-- 6. Admin notification helper (notifies every admin)
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_admins_unassigned(p_registration_id UUID, p_company TEXT, p_detail TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, link, metadata)
  SELECT up.id,
         'system',
         'حساب بانتظار التعيين',
         COALESCE(NULLIF(p_company, ''), 'مورد جديد') || ' - ' || COALESCE(p_detail, 'لا يوجد مشرف ميداني نشط للمربع المحدد'),
         '/admin/territories',
         jsonb_build_object('registration_id', p_registration_id, 'kind', 'unassigned_territory')
  FROM public.user_profiles up
  WHERE up.role::TEXT = 'admin';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'notify_admins_unassigned skipped: %', SQLERRM;
END;
$func$;

-- ============================================================
-- 7. Seller: bind own registration to a zone (auto-routing)
-- ============================================================
CREATE OR REPLACE FUNCTION public.bind_registration_to_zone(p_zone_id UUID)
RETURNS TABLE (
  registration_id UUID,
  assignment_status TEXT,
  rep_id UUID,
  rep_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_reg_id UUID;
  v_company TEXT;
  v_existing UUID;
  v_rep UUID;
  v_rep_code TEXT;
  v_rep_name TEXT;
  v_zone RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT z.zone_id, z.zone_name, z.province_city, z.country_code, z.assigned_rep_id
  INTO v_zone
  FROM public.zones z
  WHERE z.zone_id = p_zone_id AND z.is_active = true
  LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'zone_not_found';
  END IF;

  SELECT fr.id, fr.company_name, fr.referred_by_agent_id
  INTO v_reg_id, v_company, v_existing
  FROM public.factory_registrations fr
  WHERE fr.user_id = auth.uid()
  ORDER BY fr.created_at DESC
  LIMIT 1;
  IF v_reg_id IS NULL THEN
    RAISE EXCEPTION 'registration_not_found';
  END IF;

  -- Active rep on this zone?
  v_rep := NULL;
  IF v_zone.assigned_rep_id IS NOT NULL THEN
    SELECT up.id, up.referral_code, COALESCE(NULLIF(up.full_name, ''), up.email, '')
    INTO v_rep, v_rep_code, v_rep_name
    FROM public.user_profiles up
    WHERE up.id = v_zone.assigned_rep_id
      AND up.role::TEXT = 'field_agent'
      AND COALESCE(up.is_active, true) = true
    LIMIT 1;
  END IF;

  -- Never override an existing rep binding
  IF v_existing IS NOT NULL THEN
    UPDATE public.factory_registrations SET zone_id = p_zone_id WHERE id = v_reg_id;
    SELECT COALESCE(NULLIF(up.full_name, ''), up.email, '') INTO v_rep_name
    FROM public.user_profiles up WHERE up.id = v_existing LIMIT 1;
    RETURN QUERY SELECT v_reg_id, 'assigned'::TEXT, v_existing, v_rep_name;
    RETURN;
  END IF;

  IF v_rep IS NOT NULL THEN
    UPDATE public.factory_registrations
    SET zone_id = p_zone_id,
        referred_by_agent_id = v_rep,
        referred_by_agent_code = UPPER(v_rep_code)
    WHERE id = v_reg_id;

    INSERT INTO public.agent_referrals (agent_id, facility_id, referral_code, status)
    VALUES (v_rep, v_reg_id, UPPER(v_rep_code), 'pending')
    ON CONFLICT (facility_id) DO UPDATE
    SET agent_id = EXCLUDED.agent_id, referral_code = EXCLUDED.referral_code;

    RETURN QUERY SELECT v_reg_id, 'assigned'::TEXT, v_rep, v_rep_name;
  ELSE
    UPDATE public.factory_registrations SET zone_id = p_zone_id WHERE id = v_reg_id;
    PERFORM public.notify_admins_unassigned(
      v_reg_id, v_company,
      'المربع: ' || v_zone.zone_name || ' (' || v_zone.province_city || ' - ' || v_zone.country_code || ')'
    );
    RETURN QUERY SELECT v_reg_id, 'pending_assignment'::TEXT, NULL::UUID, NULL::TEXT;
  END IF;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.bind_registration_to_zone(UUID) TO authenticated;

-- ============================================================
-- 8. Seller: request rep linking for an existing unassigned registration
-- ============================================================
CREATE OR REPLACE FUNCTION public.request_rep_supervision(p_registration_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_company TEXT;
  v_rep UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT fr.company_name, fr.referred_by_agent_id
  INTO v_company, v_rep
  FROM public.factory_registrations fr
  WHERE fr.id = p_registration_id
  LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'registration_not_found';
  END IF;
  IF v_rep IS NOT NULL THEN
    RAISE EXCEPTION 'already_assigned';
  END IF;

  UPDATE public.factory_registrations
  SET rep_link_requested_at = CURRENT_TIMESTAMP
  WHERE id = p_registration_id;

  PERFORM public.notify_admins_unassigned(
    p_registration_id, v_company, 'طلب ربط وإشراف ميداني من مسجل جديد'
  );
  RETURN true;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.request_rep_supervision(UUID) TO authenticated;

-- ============================================================
-- 9. Admin RPCs
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_list_zones(p_country_code TEXT DEFAULT NULL)
RETURNS TABLE (
  zone_id UUID,
  country_code TEXT,
  province_city TEXT,
  zone_name TEXT,
  assigned_rep_id UUID,
  rep_name TEXT,
  is_active BOOLEAN,
  factory_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
  SELECT z.zone_id, z.country_code, z.province_city, z.zone_name, z.assigned_rep_id,
         COALESCE(NULLIF(up.full_name, ''), up.email, '') AS rep_name,
         z.is_active,
         (SELECT COUNT(*) FROM public.factory_registrations fr WHERE fr.zone_id = z.zone_id) AS factory_count
  FROM public.zones z
  LEFT JOIN public.user_profiles up ON up.id = z.assigned_rep_id
  WHERE public.is_admin_user()
    AND (p_country_code IS NULL OR upper(z.country_code) = upper(p_country_code))
  ORDER BY z.country_code, z.province_city, z.zone_name
$func$;

GRANT EXECUTE ON FUNCTION public.admin_list_zones(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_upsert_zone(
  p_zone_id UUID,
  p_country_code TEXT,
  p_province_city TEXT,
  p_zone_name TEXT,
  p_is_active BOOLEAN DEFAULT true
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_id UUID;
BEGIN
  IF NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  IF COALESCE(TRIM(p_country_code), '') = '' OR COALESCE(TRIM(p_province_city), '') = ''
     OR COALESCE(TRIM(p_zone_name), '') = '' THEN
    RAISE EXCEPTION 'invalid_zone';
  END IF;

  IF p_zone_id IS NULL THEN
    INSERT INTO public.zones (country_code, province_city, zone_name, is_active)
    VALUES (upper(TRIM(p_country_code)), TRIM(p_province_city), TRIM(p_zone_name), COALESCE(p_is_active, true))
    RETURNING zone_id INTO v_id;
  ELSE
    UPDATE public.zones
    SET country_code = upper(TRIM(p_country_code)),
        province_city = TRIM(p_province_city),
        zone_name = TRIM(p_zone_name),
        is_active = COALESCE(p_is_active, true),
        updated_at = CURRENT_TIMESTAMP
    WHERE zone_id = p_zone_id
    RETURNING zone_id INTO v_id;
  END IF;
  RETURN v_id;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.admin_upsert_zone(UUID, TEXT, TEXT, TEXT, BOOLEAN) TO authenticated;

-- Assign a rep to a zone. p_reassign_factories = true moves every factory in the zone to the new rep.
CREATE OR REPLACE FUNCTION public.admin_assign_zone_rep(
  p_zone_id UUID,
  p_rep_id UUID,
  p_reassign_factories BOOLEAN DEFAULT false
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_code TEXT;
  v_count INTEGER := 0;
  v_reg RECORD;
BEGIN
  IF NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF p_rep_id IS NOT NULL THEN
    SELECT referral_code INTO v_code
    FROM public.user_profiles
    WHERE id = p_rep_id AND role::TEXT = 'field_agent'
    LIMIT 1;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'agent_not_found';
    END IF;
  END IF;

  UPDATE public.zones
  SET assigned_rep_id = p_rep_id, updated_at = CURRENT_TIMESTAMP
  WHERE zone_id = p_zone_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'zone_not_found';
  END IF;

  IF p_rep_id IS NOT NULL THEN
    FOR v_reg IN
      SELECT fr.id
      FROM public.factory_registrations fr
      WHERE fr.zone_id = p_zone_id
        AND (p_reassign_factories OR fr.referred_by_agent_id IS NULL)
    LOOP
      UPDATE public.factory_registrations
      SET referred_by_agent_id = p_rep_id,
          referred_by_agent_code = UPPER(v_code)
      WHERE id = v_reg.id;

      INSERT INTO public.agent_referrals (agent_id, facility_id, referral_code, status)
      VALUES (p_rep_id, v_reg.id, UPPER(v_code), 'pending')
      ON CONFLICT (facility_id) DO UPDATE
      SET agent_id = EXCLUDED.agent_id, referral_code = EXCLUDED.referral_code;

      v_count := v_count + 1;
    END LOOP;
  END IF;

  RETURN v_count;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.admin_assign_zone_rep(UUID, UUID, BOOLEAN) TO authenticated;

-- Admin: list registrations for the territory hub (unassigned + assigned)
CREATE OR REPLACE FUNCTION public.admin_list_territory_factories(
  p_country_code TEXT DEFAULT NULL,
  p_only_unassigned BOOLEAN DEFAULT false
)
RETURNS TABLE (
  registration_id UUID,
  user_id UUID,
  company_name TEXT,
  country TEXT,
  city TEXT,
  contact_phone TEXT,
  zone_id UUID,
  zone_name TEXT,
  country_code TEXT,
  rep_id UUID,
  rep_name TEXT,
  assignment_status TEXT,
  link_requested BOOLEAN,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
  SELECT fr.id, fr.user_id, fr.company_name, fr.country, fr.city, fr.contact_phone,
         fr.zone_id, z.zone_name, z.country_code,
         fr.referred_by_agent_id,
         COALESCE(NULLIF(up.full_name, ''), up.email, '') AS rep_name,
         fr.assignment_status,
         (fr.rep_link_requested_at IS NOT NULL) AS link_requested,
         fr.created_at
  FROM public.factory_registrations fr
  LEFT JOIN public.zones z ON z.zone_id = fr.zone_id
  LEFT JOIN public.user_profiles up ON up.id = fr.referred_by_agent_id
  WHERE public.is_admin_user()
    AND (p_country_code IS NULL OR upper(COALESCE(z.country_code, '')) = upper(p_country_code))
    AND (NOT p_only_unassigned OR fr.referred_by_agent_id IS NULL)
  ORDER BY (fr.referred_by_agent_id IS NULL) DESC, fr.created_at DESC
$func$;

GRANT EXECUTE ON FUNCTION public.admin_list_territory_factories(TEXT, BOOLEAN) TO authenticated;

-- ============================================================
-- 10. RLS on zones
-- ============================================================
ALTER TABLE public.zones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_manage_zones" ON public.zones;
CREATE POLICY "admin_manage_zones"
ON public.zones
FOR ALL
TO authenticated
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

-- ============================================================
-- 11. Realtime for zones (admin hub live updates)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'zones'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.zones;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Realtime publication check skipped: %', SQLERRM;
END $$;

-- ============================================================
-- 12. Seed starter zones (idempotent)
-- ============================================================
INSERT INTO public.zones (country_code, province_city, zone_name) VALUES
  ('YE', 'صنعاء', 'ذهبان وبني الحارث'),
  ('YE', 'صنعاء', 'منطقة الحصبة الصناعية'),
  ('YE', 'عدن', 'المنطقة الصناعية - المنصورة'),
  ('YE', 'الحديدة', 'المنطقة الصناعية بالحديدة'),
  ('CN', 'Guangdong', 'Foshan Industrial Park'),
  ('CN', 'Zhejiang', 'Yiwu Trade Zone'),
  ('TR', 'Istanbul', 'İkitelli OSB')
ON CONFLICT DO NOTHING;
