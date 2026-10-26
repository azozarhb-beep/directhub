-- Global Industrial Zones & Territory Engine (Super Admin)
-- Hierarchy: Country -> State/Governorate -> Industrial Cluster -> Coordinates/Polygon
-- Builds on public.zones (country_code, province_city, zone_name, center_lat/lng, radius_km, polygon)

-- ============================================================
-- 1. Zones: hierarchy + geometry metadata
-- ============================================================
ALTER TABLE public.zones
  ADD COLUMN IF NOT EXISTS country_name TEXT,
  ADD COLUMN IF NOT EXISTS state_name TEXT,
  ADD COLUMN IF NOT EXISTS geometry_type TEXT,
  ADD COLUMN IF NOT EXISTS center_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS center_lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS radius_km DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS polygon JSONB;

DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'zones_geometry_type_check'
  ) THEN
    ALTER TABLE public.zones
      ADD CONSTRAINT zones_geometry_type_check
      CHECK (geometry_type IS NULL OR geometry_type IN ('radius', 'polygon'));
  END IF;
END
$do$;

-- The previous unique index allowed only 2-letter codes in the UI; keep it but make state searchable
CREATE INDEX IF NOT EXISTS idx_zones_state ON public.zones (lower(state_name));

-- ============================================================
-- 2. Zone <-> Agent binding (many agents per cluster)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.zone_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id UUID NOT NULL REFERENCES public.zones(zone_id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (zone_id, agent_id)
);

CREATE INDEX IF NOT EXISTS idx_zone_agents_zone ON public.zone_agents (zone_id);
CREATE INDEX IF NOT EXISTS idx_zone_agents_agent ON public.zone_agents (agent_id);

ALTER TABLE public.zone_agents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "zone_agents_admin_all" ON public.zone_agents;
CREATE POLICY "zone_agents_admin_all"
ON public.zone_agents
FOR ALL
TO authenticated
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS "zone_agents_agent_read_own" ON public.zone_agents;
CREATE POLICY "zone_agents_agent_read_own"
ON public.zone_agents
FOR SELECT
TO authenticated
USING (agent_id = auth.uid());

-- ============================================================
-- 3. Geometry helper: is point inside a zone?  NULL => geometry not configured
-- ============================================================
CREATE OR REPLACE FUNCTION public.zone_contains_point(p_zone_id UUID, p_lat DOUBLE PRECISION, p_lng DOUBLE PRECISION)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  z RECORD;
  v_res BOOLEAN;
BEGIN
  SELECT zn.polygon, zn.center_lat, zn.center_lng, zn.radius_km, zn.is_active
  INTO z
  FROM public.zones zn WHERE zn.zone_id = p_zone_id;
  IF NOT FOUND OR z.is_active IS NOT TRUE THEN RETURN NULL; END IF;

  IF z.polygon IS NOT NULL THEN
    v_res := public.point_in_polygon(p_lat, p_lng, z.polygon);
    IF v_res IS NOT NULL THEN RETURN v_res; END IF;
  END IF;

  IF z.center_lat IS NOT NULL AND z.center_lng IS NOT NULL AND z.radius_km IS NOT NULL THEN
    RETURN public.geo_distance_km(z.center_lat, z.center_lng, p_lat, p_lng) <= z.radius_km;
  END IF;

  RETURN NULL;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.zone_contains_point(UUID, DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated;

-- ============================================================
-- 4. Agent territory check: legacy per-agent geometry OR any bound cluster
--    TRUE = inside, FALSE = outside, NULL = nothing configured (caller allows)
-- ============================================================
CREATE OR REPLACE FUNCTION public.agent_point_in_territory(p_agent_id UUID, p_lat DOUBLE PRECISION, p_lng DOUBLE PRECISION)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v RECORD;
  z RECORD;
  v_poly JSONB;
  v_clat DOUBLE PRECISION;
  v_clng DOUBLE PRECISION;
  v_rad DOUBLE PRECISION;
  v_res BOOLEAN;
  v_configured BOOLEAN := false;
BEGIN
  -- A) Cluster bindings (zone_agents): inside ANY bound cluster => allowed
  FOR z IN
    SELECT za.zone_id FROM public.zone_agents za WHERE za.agent_id = p_agent_id
  LOOP
    v_res := public.zone_contains_point(z.zone_id, p_lat, p_lng);
    IF v_res IS NOT NULL THEN
      v_configured := true;
      IF v_res THEN RETURN true; END IF;
    END IF;
  END LOOP;

  -- B) Legacy per-agent territory (profile geometry or single territory_zone_id)
  SELECT up.territory_zone_id, up.territory_center_lat, up.territory_center_lng,
         up.territory_radius_km, up.territory_polygon
  INTO v
  FROM public.user_profiles up WHERE up.id = p_agent_id;

  IF FOUND THEN
    v_poly := v.territory_polygon;
    v_clat := v.territory_center_lat;
    v_clng := v.territory_center_lng;
    v_rad := v.territory_radius_km;

    IF v_poly IS NULL AND (v_clat IS NULL OR v_clng IS NULL OR v_rad IS NULL) AND v.territory_zone_id IS NOT NULL THEN
      SELECT zn.polygon, zn.center_lat, zn.center_lng, zn.radius_km INTO z
      FROM public.zones zn WHERE zn.zone_id = v.territory_zone_id;
      IF FOUND THEN
        v_poly := z.polygon; v_clat := z.center_lat; v_clng := z.center_lng; v_rad := z.radius_km;
      END IF;
    END IF;

    IF v_poly IS NOT NULL THEN
      v_res := public.point_in_polygon(p_lat, p_lng, v_poly);
      IF v_res IS NOT NULL THEN
        v_configured := true;
        IF v_res THEN RETURN true; END IF;
      END IF;
    END IF;

    IF v_clat IS NOT NULL AND v_clng IS NOT NULL AND v_rad IS NOT NULL THEN
      v_configured := true;
      IF public.geo_distance_km(v_clat, v_clng, p_lat, p_lng) <= v_rad THEN
        RETURN true;
      END IF;
    END IF;
  END IF;

  IF v_configured THEN RETURN false; END IF;
  RETURN NULL;
END;
$func$;

-- ============================================================
-- 5. Zone-bound agent lookup for logistics/inspection dispatch
-- ============================================================
CREATE OR REPLACE FUNCTION public.resolve_cluster_agent_for_point(p_lat DOUBLE PRECISION, p_lng DOUBLE PRECISION)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_agent UUID;
BEGIN
  IF p_lat IS NULL OR p_lng IS NULL THEN RETURN NULL; END IF;
  SELECT za.agent_id INTO v_agent
  FROM public.zone_agents za
  JOIN public.user_profiles up ON up.id = za.agent_id
  WHERE up.role::TEXT = 'field_agent'
    AND up.is_active IS NOT FALSE
    AND public.zone_contains_point(za.zone_id, p_lat, p_lng) IS TRUE
  ORDER BY za.created_at
  LIMIT 1;
  RETURN v_agent;
END;
$func$;

-- Prefer agents bound to the cluster that contains the factory GPS point
CREATE OR REPLACE FUNCTION public.resolve_zone_agent_for_factory(p_agent_factory_id UUID, p_factory_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_afr RECORD;
  v_fr RECORD;
  v_city TEXT := '';
  v_region TEXT := '';
  v_lat DOUBLE PRECISION;
  v_lng DOUBLE PRECISION;
  v_agent UUID;
BEGIN
  IF p_agent_factory_id IS NOT NULL THEN
    SELECT afr.agent_id, afr.city, afr.region, afr.latitude, afr.longitude INTO v_afr
    FROM public.agent_factory_registrations afr WHERE afr.id = p_agent_factory_id;
    IF FOUND THEN
      v_city := COALESCE(v_afr.city, '');
      v_region := COALESCE(v_afr.region, '');
      v_lat := v_afr.latitude;
      v_lng := v_afr.longitude;
    END IF;
  END IF;

  -- Cluster-bound agents (zone_agents) via factory GPS
  IF v_lat IS NOT NULL AND v_lng IS NOT NULL THEN
    v_agent := public.resolve_cluster_agent_for_point(v_lat, v_lng);
    IF v_agent IS NOT NULL THEN RETURN v_agent; END IF;
  END IF;

  IF p_factory_user_id IS NOT NULL THEN
    SELECT fr.city, fr.region, fr.zone_id, fr.referred_by_agent_id INTO v_fr
    FROM public.factory_registrations fr WHERE fr.user_id = p_factory_user_id LIMIT 1;
    IF FOUND THEN
      IF v_city = '' AND v_region = '' THEN
        v_city := COALESCE(v_fr.city, '');
        v_region := COALESCE(v_fr.region, '');
      END IF;
      IF v_fr.zone_id IS NOT NULL THEN
        SELECT za.agent_id INTO v_agent
        FROM public.zone_agents za
        JOIN public.user_profiles up ON up.id = za.agent_id
        WHERE za.zone_id = v_fr.zone_id
          AND up.role::TEXT = 'field_agent' AND up.is_active IS NOT FALSE
        ORDER BY za.created_at LIMIT 1;
        IF v_agent IS NOT NULL THEN RETURN v_agent; END IF;

        SELECT up.id INTO v_agent
        FROM public.user_profiles up
        WHERE up.role::TEXT = 'field_agent' AND up.is_active IS NOT FALSE
          AND up.territory_zone_id = v_fr.zone_id
        ORDER BY up.created_at LIMIT 1;
        IF v_agent IS NOT NULL THEN RETURN v_agent; END IF;
      END IF;
    END IF;
  END IF;

  -- Geometry match against legacy per-agent territory
  IF v_lat IS NOT NULL AND v_lng IS NOT NULL THEN
    SELECT up.id INTO v_agent
    FROM public.user_profiles up
    WHERE up.role::TEXT = 'field_agent' AND up.is_active IS NOT FALSE
      AND public.agent_point_in_territory(up.id, v_lat, v_lng) IS TRUE
    ORDER BY up.created_at LIMIT 1;
    IF v_agent IS NOT NULL THEN RETURN v_agent; END IF;
  END IF;

  -- Territory city match
  IF v_city <> '' OR v_region <> '' THEN
    SELECT up.id INTO v_agent
    FROM public.user_profiles up
    WHERE up.role::TEXT = 'field_agent' AND up.is_active IS NOT FALSE
      AND COALESCE(up.territory_city, '') <> ''
      AND (
        (v_city <> '' AND lower(up.territory_city) IN (lower(v_city), lower(v_region)))
        OR (v_region <> '' AND lower(up.territory_city) = lower(v_region))
      )
    ORDER BY up.created_at LIMIT 1;
    IF v_agent IS NOT NULL THEN RETURN v_agent; END IF;
  END IF;

  RETURN NULL;
END;
$func$;

-- ============================================================
-- 6. Super Admin RPCs
-- ============================================================
DROP FUNCTION IF EXISTS public.admin_list_industrial_zones();
CREATE OR REPLACE FUNCTION public.admin_list_industrial_zones()
RETURNS TABLE (
  zone_id UUID,
  country_code TEXT,
  country_name TEXT,
  state_name TEXT,
  cluster_name TEXT,
  geometry_type TEXT,
  center_lat DOUBLE PRECISION,
  center_lng DOUBLE PRECISION,
  radius_km DOUBLE PRECISION,
  polygon JSONB,
  is_active BOOLEAN,
  agent_ids UUID[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
  SELECT z.zone_id, z.country_code, z.country_name,
         COALESCE(NULLIF(z.state_name, ''), z.province_city) AS state_name,
         z.zone_name AS cluster_name,
         z.geometry_type, z.center_lat, z.center_lng, z.radius_km, z.polygon, z.is_active,
         COALESCE((SELECT array_agg(za.agent_id) FROM public.zone_agents za WHERE za.zone_id = z.zone_id), ARRAY[]::UUID[]) AS agent_ids
  FROM public.zones z
  WHERE public.is_admin_user()
  ORDER BY z.country_code, COALESCE(NULLIF(z.state_name, ''), z.province_city), z.zone_name
$func$;

GRANT EXECUTE ON FUNCTION public.admin_list_industrial_zones() TO authenticated;

DROP FUNCTION IF EXISTS public.admin_upsert_industrial_zone(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, JSONB, BOOLEAN);
CREATE OR REPLACE FUNCTION public.admin_upsert_industrial_zone(
  p_zone_id UUID,
  p_country_code TEXT,
  p_country_name TEXT,
  p_state_name TEXT,
  p_cluster_name TEXT,
  p_geometry_type TEXT,
  p_center_lat DOUBLE PRECISION,
  p_center_lng DOUBLE PRECISION,
  p_radius_km DOUBLE PRECISION,
  p_polygon JSONB,
  p_is_active BOOLEAN DEFAULT true
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_id UUID;
  v_cc TEXT := upper(trim(COALESCE(p_country_code, '')));
BEGIN
  IF NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF v_cc = '' OR trim(COALESCE(p_state_name, '')) = '' OR trim(COALESCE(p_cluster_name, '')) = '' THEN
    RAISE EXCEPTION 'country_state_cluster_required';
  END IF;
  IF p_geometry_type = 'polygon' THEN
    IF p_polygon IS NULL OR jsonb_typeof(p_polygon) <> 'array' OR jsonb_array_length(p_polygon) < 3 THEN
      RAISE EXCEPTION 'polygon_needs_3_points';
    END IF;
  ELSIF p_geometry_type = 'radius' THEN
    IF p_center_lat IS NULL OR p_center_lng IS NULL OR p_radius_km IS NULL OR p_radius_km <= 0 THEN
      RAISE EXCEPTION 'radius_needs_center_and_km';
    END IF;
  ELSE
    RAISE EXCEPTION 'geometry_required';
  END IF;

  IF p_zone_id IS NULL THEN
    INSERT INTO public.zones (country_code, country_name, province_city, state_name, zone_name,
                              geometry_type, center_lat, center_lng, radius_km, polygon, is_active)
    VALUES (v_cc, NULLIF(trim(p_country_name), ''), trim(p_state_name), trim(p_state_name), trim(p_cluster_name),
            p_geometry_type, p_center_lat, p_center_lng,
            CASE WHEN p_geometry_type = 'radius' THEN p_radius_km END,
            CASE WHEN p_geometry_type = 'polygon' THEN p_polygon END,
            COALESCE(p_is_active, true))
    RETURNING zone_id INTO v_id;
  ELSE
    UPDATE public.zones
    SET country_code = v_cc,
        country_name = NULLIF(trim(p_country_name), ''),
        province_city = trim(p_state_name),
        state_name = trim(p_state_name),
        zone_name = trim(p_cluster_name),
        geometry_type = p_geometry_type,
        center_lat = p_center_lat,
        center_lng = p_center_lng,
        radius_km = CASE WHEN p_geometry_type = 'radius' THEN p_radius_km END,
        polygon = CASE WHEN p_geometry_type = 'polygon' THEN p_polygon END,
        is_active = COALESCE(p_is_active, true),
        updated_at = CURRENT_TIMESTAMP
    WHERE zone_id = p_zone_id
    RETURNING zone_id INTO v_id;
    IF v_id IS NULL THEN RAISE EXCEPTION 'zone_not_found'; END IF;
  END IF;
  RETURN v_id;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.admin_upsert_industrial_zone(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, JSONB, BOOLEAN) TO authenticated;

DROP FUNCTION IF EXISTS public.admin_delete_industrial_zone(UUID);
CREATE OR REPLACE FUNCTION public.admin_delete_industrial_zone(p_zone_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  IF NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  DELETE FROM public.zones WHERE zone_id = p_zone_id;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.admin_delete_industrial_zone(UUID) TO authenticated;

-- Replace the full agent set of a cluster
DROP FUNCTION IF EXISTS public.admin_set_zone_agents(UUID, UUID[]);
CREATE OR REPLACE FUNCTION public.admin_set_zone_agents(p_zone_id UUID, p_agent_ids UUID[])
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_count INTEGER := 0;
BEGIN
  IF NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.zones WHERE zone_id = p_zone_id) THEN
    RAISE EXCEPTION 'zone_not_found';
  END IF;

  DELETE FROM public.zone_agents
  WHERE zone_id = p_zone_id
    AND (p_agent_ids IS NULL OR NOT (agent_id = ANY(p_agent_ids)));

  IF p_agent_ids IS NOT NULL THEN
    INSERT INTO public.zone_agents (zone_id, agent_id, assigned_by)
    SELECT p_zone_id, up.id, auth.uid()
    FROM public.user_profiles up
    WHERE up.id = ANY(p_agent_ids)
      AND up.role::TEXT = 'field_agent'
    ON CONFLICT (zone_id, agent_id) DO NOTHING;
  END IF;

  SELECT COUNT(*) INTO v_count FROM public.zone_agents WHERE zone_id = p_zone_id;
  RETURN v_count;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.admin_set_zone_agents(UUID, UUID[]) TO authenticated;

-- Certified agents list (field agents)
DROP FUNCTION IF EXISTS public.admin_list_certified_agents();
CREATE OR REPLACE FUNCTION public.admin_list_certified_agents()
RETURNS TABLE (id UUID, full_name TEXT, email TEXT, referral_code TEXT, is_active BOOLEAN)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
  SELECT up.id, COALESCE(NULLIF(up.full_name, ''), up.email, '') AS full_name, up.email,
         up.referral_code, COALESCE(up.is_active, true) AS is_active
  FROM public.user_profiles up
  WHERE public.is_admin_user() AND up.role::TEXT = 'field_agent'
  ORDER BY full_name
$func$;

GRANT EXECUTE ON FUNCTION public.admin_list_certified_agents() TO authenticated;

-- Public-safe list of active clusters (for pickers) - no agent details
DROP FUNCTION IF EXISTS public.list_industrial_cluster_hierarchy();
CREATE OR REPLACE FUNCTION public.list_industrial_cluster_hierarchy()
RETURNS TABLE (zone_id UUID, country_code TEXT, country_name TEXT, state_name TEXT, cluster_name TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
  SELECT z.zone_id, z.country_code, z.country_name,
         COALESCE(NULLIF(z.state_name, ''), z.province_city), z.zone_name
  FROM public.zones z
  WHERE z.is_active = true
  ORDER BY z.country_code, 4, z.zone_name
$func$;

GRANT EXECUTE ON FUNCTION public.list_industrial_cluster_hierarchy() TO anon, authenticated;
