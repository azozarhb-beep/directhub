-- Agent territory geofencing + anti-duplicate factory onboarding + zone-exclusive coordination routing
-- Non-destructive: existing records are preserved; later duplicates only lose their normalized key.

-- ============================================================
-- 1. Anti-duplicate columns on agent_factory_registrations
-- ============================================================
ALTER TABLE public.agent_factory_registrations
  ADD COLUMN IF NOT EXISTS commercial_register_number TEXT,
  ADD COLUMN IF NOT EXISTS tax_identification_number TEXT,
  ADD COLUMN IF NOT EXISTS commercial_register_norm TEXT,
  ADD COLUMN IF NOT EXISTS tax_id_norm TEXT,
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

CREATE OR REPLACE FUNCTION public.normalize_tax_id(p_value TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $func$
  SELECT NULLIF(upper(regexp_replace(COALESCE(p_value, ''), '[^0-9A-Za-z]', '', 'g')), '')
$func$;

CREATE OR REPLACE FUNCTION public.agent_factory_regs_sync_norm()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $func$
BEGIN
  NEW.commercial_register_norm := public.normalize_commercial_register(NEW.commercial_register_number);
  NEW.tax_id_norm := public.normalize_tax_id(COALESCE(NULLIF(NEW.tax_identification_number, ''), NEW.tax_id));
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trg_agent_factory_regs_sync_norm ON public.agent_factory_registrations;
CREATE TRIGGER trg_agent_factory_regs_sync_norm
BEFORE INSERT OR UPDATE ON public.agent_factory_registrations
FOR EACH ROW EXECUTE FUNCTION public.agent_factory_regs_sync_norm();

-- Backfill normalized values from existing data (legacy tax_id feeds tax norm)
UPDATE public.agent_factory_registrations
SET commercial_register_norm = public.normalize_commercial_register(commercial_register_number),
    tax_id_norm = public.normalize_tax_id(COALESCE(NULLIF(tax_identification_number, ''), tax_id));

-- Keep the earliest record valid; clear the normalized key on later duplicates only
UPDATE public.agent_factory_registrations a
SET commercial_register_norm = NULL
WHERE a.commercial_register_norm IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.agent_factory_registrations o
    WHERE o.commercial_register_norm = a.commercial_register_norm
      AND (o.created_at, o.id) < (a.created_at, a.id)
  );

UPDATE public.agent_factory_registrations a
SET tax_id_norm = NULL
WHERE a.tax_id_norm IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.agent_factory_registrations o
    WHERE o.tax_id_norm = a.tax_id_norm
      AND (o.created_at, o.id) < (a.created_at, a.id)
  );

CREATE UNIQUE INDEX IF NOT EXISTS uq_agent_factory_regs_commercial_register
ON public.agent_factory_registrations (commercial_register_norm)
WHERE commercial_register_norm IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_agent_factory_regs_tax_id
ON public.agent_factory_registrations (tax_id_norm)
WHERE tax_id_norm IS NOT NULL;

-- Tax ID uniqueness on self-registered factories too (same non-destructive approach)
ALTER TABLE public.factory_registrations
  ADD COLUMN IF NOT EXISTS tax_id_norm TEXT;

CREATE OR REPLACE FUNCTION public.factory_regs_sync_tax_norm()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $func$
BEGIN
  NEW.tax_id_norm := public.normalize_tax_id(NEW.tax_id);
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trg_factory_regs_sync_tax_norm ON public.factory_registrations;
CREATE TRIGGER trg_factory_regs_sync_tax_norm
BEFORE INSERT OR UPDATE ON public.factory_registrations
FOR EACH ROW EXECUTE FUNCTION public.factory_regs_sync_tax_norm();

UPDATE public.factory_registrations
SET tax_id_norm = public.normalize_tax_id(tax_id);

UPDATE public.factory_registrations fr
SET tax_id_norm = NULL
WHERE fr.tax_id_norm IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.factory_registrations o
    WHERE o.tax_id_norm = fr.tax_id_norm
      AND (o.created_at, o.id) < (fr.created_at, fr.id)
  );

CREATE UNIQUE INDEX IF NOT EXISTS uq_factory_regs_tax_id
ON public.factory_registrations (tax_id_norm)
WHERE tax_id_norm IS NOT NULL;

-- ============================================================
-- 2. 48-hour claim lock (onboarding draft hold)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.factory_claim_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  commercial_register_norm TEXT,
  tax_id_norm TEXT,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '48 hours'),
  released_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_claim_locks_cr ON public.factory_claim_locks (commercial_register_norm) WHERE released_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_claim_locks_tax ON public.factory_claim_locks (tax_id_norm) WHERE released_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_claim_locks_agent ON public.factory_claim_locks (agent_id);

ALTER TABLE public.factory_claim_locks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "claim_locks_owner_select" ON public.factory_claim_locks;
CREATE POLICY "claim_locks_owner_select"
ON public.factory_claim_locks
FOR SELECT
TO authenticated
USING (agent_id = auth.uid() OR public.is_admin_user());

-- ============================================================
-- 3. Duplicate check (registrations + active claim locks of other agents)
-- status: 'ok' | 'duplicate'
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_agent_factory_duplicate(
  p_commercial_register TEXT,
  p_tax_id TEXT
)
RETURNS TABLE (status TEXT, matched_field TEXT, is_own BOOLEAN)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_cr TEXT := public.normalize_commercial_register(p_commercial_register);
  v_tax TEXT := public.normalize_tax_id(p_tax_id);
  v_own BOOLEAN;
BEGIN
  IF v_cr IS NOT NULL THEN
    SELECT (a.agent_id = auth.uid()) INTO v_own
    FROM public.agent_factory_registrations a
    WHERE a.commercial_register_norm = v_cr
    ORDER BY a.created_at LIMIT 1;
    IF FOUND THEN
      RETURN QUERY SELECT 'duplicate'::TEXT, 'commercial_register_number'::TEXT, COALESCE(v_own, false);
      RETURN;
    END IF;

    IF EXISTS (SELECT 1 FROM public.factory_registrations f WHERE f.commercial_register_norm = v_cr) THEN
      RETURN QUERY SELECT 'duplicate'::TEXT, 'commercial_register_number'::TEXT, false;
      RETURN;
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.factory_claim_locks l
      WHERE l.commercial_register_norm = v_cr
        AND l.released_at IS NULL AND l.expires_at > now() AND l.agent_id <> auth.uid()
    ) THEN
      RETURN QUERY SELECT 'duplicate'::TEXT, 'commercial_register_number'::TEXT, false;
      RETURN;
    END IF;
  END IF;

  IF v_tax IS NOT NULL THEN
    SELECT (a.agent_id = auth.uid()) INTO v_own
    FROM public.agent_factory_registrations a
    WHERE a.tax_id_norm = v_tax
    ORDER BY a.created_at LIMIT 1;
    IF FOUND THEN
      RETURN QUERY SELECT 'duplicate'::TEXT, 'tax_identification_number'::TEXT, COALESCE(v_own, false);
      RETURN;
    END IF;

    IF EXISTS (SELECT 1 FROM public.factory_registrations f WHERE f.tax_id_norm = v_tax) THEN
      RETURN QUERY SELECT 'duplicate'::TEXT, 'tax_identification_number'::TEXT, false;
      RETURN;
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.factory_claim_locks l
      WHERE l.tax_id_norm = v_tax
        AND l.released_at IS NULL AND l.expires_at > now() AND l.agent_id <> auth.uid()
    ) THEN
      RETURN QUERY SELECT 'duplicate'::TEXT, 'tax_identification_number'::TEXT, false;
      RETURN;
    END IF;
  END IF;

  RETURN QUERY SELECT 'ok'::TEXT, NULL::TEXT, false;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.check_agent_factory_duplicate(TEXT, TEXT) TO authenticated;

-- ============================================================
-- 4. Claim / release draft lock (48h)
-- Returns: 'claimed' | 'duplicate'
-- ============================================================
CREATE OR REPLACE FUNCTION public.claim_factory_draft(
  p_commercial_register TEXT,
  p_tax_id TEXT
)
RETURNS TABLE (status TEXT, lock_id UUID, expires_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_cr TEXT := public.normalize_commercial_register(p_commercial_register);
  v_tax TEXT := public.normalize_tax_id(p_tax_id);
  v_dup RECORD;
  v_lock_id UUID;
  v_exp TIMESTAMPTZ;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF v_cr IS NULL AND v_tax IS NULL THEN
    RETURN QUERY SELECT 'ok'::TEXT, NULL::UUID, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  SELECT * INTO v_dup FROM public.check_agent_factory_duplicate(p_commercial_register, p_tax_id) LIMIT 1;
  IF v_dup.status = 'duplicate' THEN
    RETURN QUERY SELECT 'duplicate'::TEXT, NULL::UUID, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  -- Refresh the caller's existing active lock for the same keys, otherwise create one
  SELECT l.id INTO v_lock_id
  FROM public.factory_claim_locks l
  WHERE l.agent_id = auth.uid()
    AND l.released_at IS NULL
    AND l.commercial_register_norm IS NOT DISTINCT FROM v_cr
    AND l.tax_id_norm IS NOT DISTINCT FROM v_tax
  LIMIT 1;

  IF v_lock_id IS NULL THEN
    INSERT INTO public.factory_claim_locks (agent_id, commercial_register_norm, tax_id_norm)
    VALUES (auth.uid(), v_cr, v_tax)
    RETURNING id, factory_claim_locks.expires_at INTO v_lock_id, v_exp;
  ELSE
    SELECT l.expires_at INTO v_exp FROM public.factory_claim_locks l WHERE l.id = v_lock_id;
  END IF;

  RETURN QUERY SELECT 'claimed'::TEXT, v_lock_id, v_exp;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.claim_factory_draft(TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.release_factory_draft(p_lock_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $func$
  UPDATE public.factory_claim_locks
  SET released_at = now()
  WHERE id = p_lock_id AND agent_id = auth.uid() AND released_at IS NULL;
$func$;

GRANT EXECUTE ON FUNCTION public.release_factory_draft(UUID) TO authenticated;

-- ============================================================
-- 5. Agent operational territory: [country, city, industrial zone polygon/radius]
-- ============================================================
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS territory_country TEXT,
  ADD COLUMN IF NOT EXISTS territory_city TEXT,
  ADD COLUMN IF NOT EXISTS territory_zone_id UUID REFERENCES public.zones(zone_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS territory_center_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS territory_center_lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS territory_radius_km DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS territory_polygon JSONB;

ALTER TABLE public.zones
  ADD COLUMN IF NOT EXISTS center_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS center_lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS radius_km DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS polygon JSONB;

CREATE INDEX IF NOT EXISTS idx_user_profiles_territory_zone ON public.user_profiles (territory_zone_id) WHERE territory_zone_id IS NOT NULL;

-- Haversine distance in km
CREATE OR REPLACE FUNCTION public.geo_distance_km(lat1 DOUBLE PRECISION, lng1 DOUBLE PRECISION, lat2 DOUBLE PRECISION, lng2 DOUBLE PRECISION)
RETURNS DOUBLE PRECISION
LANGUAGE sql
IMMUTABLE
AS $func$
  SELECT 6371.0 * 2 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  ))
$func$;

-- Ray-casting point-in-polygon. Polygon = JSON array of [lat, lng] pairs or {lat,lng} objects.
CREATE OR REPLACE FUNCTION public.point_in_polygon(p_lat DOUBLE PRECISION, p_lng DOUBLE PRECISION, p_polygon JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $func$
DECLARE
  n INT;
  i INT;
  j INT;
  xi DOUBLE PRECISION; yi DOUBLE PRECISION;
  xj DOUBLE PRECISION; yj DOUBLE PRECISION;
  inside BOOLEAN := false;
  pi_ JSONB; pj_ JSONB;
BEGIN
  IF p_polygon IS NULL OR jsonb_typeof(p_polygon) <> 'array' THEN RETURN NULL; END IF;
  n := jsonb_array_length(p_polygon);
  IF n < 3 THEN RETURN NULL; END IF;
  j := n - 1;
  FOR i IN 0 .. n - 1 LOOP
    pi_ := p_polygon -> i;
    pj_ := p_polygon -> j;
    IF jsonb_typeof(pi_) = 'array' THEN
      xi := (pi_ ->> 0)::DOUBLE PRECISION; yi := (pi_ ->> 1)::DOUBLE PRECISION;
      xj := (pj_ ->> 0)::DOUBLE PRECISION; yj := (pj_ ->> 1)::DOUBLE PRECISION;
    ELSE
      xi := (pi_ ->> 'lat')::DOUBLE PRECISION; yi := (pi_ ->> 'lng')::DOUBLE PRECISION;
      xj := (pj_ ->> 'lat')::DOUBLE PRECISION; yj := (pj_ ->> 'lng')::DOUBLE PRECISION;
    END IF;
    IF ((yi > p_lng) <> (yj > p_lng))
       AND (p_lat < (xj - xi) * (p_lng - yi) / NULLIF(yj - yi, 0) + xi) THEN
      inside := NOT inside;
    END IF;
    j := i;
  END LOOP;
  RETURN inside;
END;
$func$;

-- Returns TRUE when the point lies within the profile's territory.
-- NULL territory definition => treated as "not configured" by the caller (see validate_agent_geofence).
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
BEGIN
  SELECT up.territory_zone_id, up.territory_center_lat, up.territory_center_lng,
         up.territory_radius_km, up.territory_polygon
  INTO v
  FROM public.user_profiles up WHERE up.id = p_agent_id;

  IF NOT FOUND THEN RETURN NULL; END IF;

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
    IF v_res IS NOT NULL THEN RETURN v_res; END IF;
  END IF;

  IF v_clat IS NOT NULL AND v_clng IS NOT NULL AND v_rad IS NOT NULL THEN
    RETURN public.geo_distance_km(v_clat, v_clng, p_lat, p_lng) <= v_rad;
  END IF;

  RETURN NULL; -- territory geometry not configured
END;
$func$;

-- Client-facing geofence gate. Returns allowed=true when inside OR when no geometry is configured
-- (so existing agents are never blocked until an admin binds a territory).
CREATE OR REPLACE FUNCTION public.validate_agent_geofence(p_lat DOUBLE PRECISION, p_lng DOUBLE PRECISION)
RETURNS TABLE (allowed BOOLEAN, configured BOOLEAN)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_in BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF public.is_admin_user() THEN
    RETURN QUERY SELECT true, false;
    RETURN;
  END IF;
  v_in := public.agent_point_in_territory(auth.uid(), p_lat, p_lng);
  IF v_in IS NULL THEN
    RETURN QUERY SELECT true, false;
  ELSE
    RETURN QUERY SELECT v_in, true;
  END IF;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.validate_agent_geofence(DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated;

-- Admin: bind an agent to a territory
CREATE OR REPLACE FUNCTION public.admin_set_agent_territory(
  p_agent_id UUID,
  p_country TEXT,
  p_city TEXT,
  p_zone_id UUID DEFAULT NULL,
  p_center_lat DOUBLE PRECISION DEFAULT NULL,
  p_center_lng DOUBLE PRECISION DEFAULT NULL,
  p_radius_km DOUBLE PRECISION DEFAULT NULL,
  p_polygon JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  IF NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE public.user_profiles
  SET territory_country = NULLIF(p_country, ''),
      territory_city = NULLIF(p_city, ''),
      territory_zone_id = p_zone_id,
      territory_center_lat = p_center_lat,
      territory_center_lng = p_center_lng,
      territory_radius_km = p_radius_km,
      territory_polygon = p_polygon
  WHERE id = p_agent_id;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.admin_set_agent_territory(UUID, TEXT, TEXT, UUID, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, JSONB) TO authenticated;

-- ============================================================
-- 6. Auto-routing: coordination room assigned exclusively to the zone agent
-- Zone match priority: factory coordinates inside agent territory -> same territory zone
-- -> same territory city -> agent that registered the factory (legacy fallback).
-- ============================================================
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

  IF v_city = '' AND v_region = '' AND p_factory_user_id IS NOT NULL THEN
    SELECT fr.city, fr.region, fr.zone_id, fr.referred_by_agent_id INTO v_fr
    FROM public.factory_registrations fr WHERE fr.user_id = p_factory_user_id LIMIT 1;
    IF FOUND THEN
      v_city := COALESCE(v_fr.city, '');
      v_region := COALESCE(v_fr.region, '');
      IF v_fr.zone_id IS NOT NULL THEN
        SELECT up.id INTO v_agent
        FROM public.user_profiles up
        WHERE up.role::TEXT = 'field_agent' AND up.is_active IS NOT FALSE
          AND up.territory_zone_id = v_fr.zone_id
        ORDER BY up.created_at LIMIT 1;
        IF v_agent IS NOT NULL THEN RETURN v_agent; END IF;
      END IF;
    END IF;
  END IF;

  -- Geometry match
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

-- When an inspection task is created for an order, bind the order's coordination room to the task's agent.
CREATE OR REPLACE FUNCTION public.route_dispatch_room_to_inspection_agent()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_agent UUID;
  v_order RECORD;
BEGIN
  IF NEW.order_id IS NULL THEN
    RETURN NEW;
  END IF;

  BEGIN
    SELECT o.id, o.factory_user_id, o.user_id, o.logistics_partner_id INTO v_order
    FROM public.orders o WHERE o.id = NEW.order_id;

    v_agent := public.resolve_zone_agent_for_factory(NEW.factory_id, v_order.factory_user_id);
    IF v_agent IS NULL THEN
      v_agent := NEW.assigned_agent_id;
    END IF;
    IF v_agent IS NULL THEN
      RETURN NEW;
    END IF;

    -- Exclusive assignment: set/replace the agent on the existing room, or create it
    UPDATE public.order_dispatch_rooms r
    SET agent_id = v_agent
    WHERE r.order_id = NEW.order_id
      AND r.status = 'active'
      AND r.agent_id IS DISTINCT FROM v_agent;

    IF NOT EXISTS (SELECT 1 FROM public.order_dispatch_rooms r WHERE r.order_id = NEW.order_id) THEN
      INSERT INTO public.order_dispatch_rooms (order_id, factory_id, agent_id, buyer_id, status)
      VALUES (NEW.order_id, v_order.factory_user_id, v_agent, v_order.user_id, 'active');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'route_dispatch_room_to_inspection_agent failed for order %: %', NEW.order_id, SQLERRM;
  END;

  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trg_route_dispatch_room_to_agent ON public.field_inspection_tasks;
CREATE TRIGGER trg_route_dispatch_room_to_agent
AFTER INSERT ON public.field_inspection_tasks
FOR EACH ROW EXECUTE FUNCTION public.route_dispatch_room_to_inspection_agent();

-- Rooms created later (e.g. logistics sync) inherit the zone agent already assigned to the order's task
CREATE OR REPLACE FUNCTION public.dispatch_room_inherit_zone_agent()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_agent UUID;
BEGIN
  IF NEW.agent_id IS NULL AND NEW.order_id IS NOT NULL THEN
    SELECT t.assigned_agent_id INTO v_agent
    FROM public.field_inspection_tasks t
    WHERE t.order_id = NEW.order_id AND t.assigned_agent_id IS NOT NULL
    ORDER BY t.created_at DESC LIMIT 1;
    IF v_agent IS NOT NULL THEN
      NEW.agent_id := v_agent;
    END IF;
  END IF;
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trg_dispatch_room_inherit_zone_agent ON public.order_dispatch_rooms;
CREATE TRIGGER trg_dispatch_room_inherit_zone_agent
BEFORE INSERT ON public.order_dispatch_rooms
FOR EACH ROW EXECUTE FUNCTION public.dispatch_room_inherit_zone_agent();
