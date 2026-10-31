-- Hierarchical territory (country > city > district) for field agents.
-- Geometry (center + radius) is stored per agent, so the existing validate_agent_geofence gate enforces it.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS territory_district TEXT;

DROP FUNCTION IF EXISTS public.admin_set_agent_territory(UUID, TEXT, TEXT, UUID, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, JSONB);

CREATE OR REPLACE FUNCTION public.admin_set_agent_territory(
  p_agent_id UUID,
  p_country TEXT,
  p_city TEXT,
  p_zone_id UUID DEFAULT NULL,
  p_center_lat DOUBLE PRECISION DEFAULT NULL,
  p_center_lng DOUBLE PRECISION DEFAULT NULL,
  p_radius_km DOUBLE PRECISION DEFAULT NULL,
  p_polygon JSONB DEFAULT NULL,
  p_district TEXT DEFAULT NULL
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
      territory_district = NULLIF(p_district, ''),
      territory_zone_id = p_zone_id,
      territory_center_lat = p_center_lat,
      territory_center_lng = p_center_lng,
      territory_radius_km = p_radius_km,
      territory_polygon = p_polygon
  WHERE id = p_agent_id;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.admin_set_agent_territory(UUID, TEXT, TEXT, UUID, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, JSONB, TEXT) TO authenticated;

-- Agent reads own assigned territory (for dashboard header)
CREATE OR REPLACE FUNCTION public.get_my_territory()
RETURNS TABLE (territory_country TEXT, territory_city TEXT, territory_district TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
  SELECT up.territory_country, up.territory_city, up.territory_district
  FROM public.user_profiles up
  WHERE up.id = auth.uid()
$func$;

GRANT EXECUTE ON FUNCTION public.get_my_territory() TO authenticated;

-- Admin: list agent territories for the management table
CREATE OR REPLACE FUNCTION public.admin_list_agent_territories()
RETURNS TABLE (
  agent_id UUID,
  territory_country TEXT,
  territory_city TEXT,
  territory_district TEXT,
  territory_center_lat DOUBLE PRECISION,
  territory_center_lng DOUBLE PRECISION,
  territory_radius_km DOUBLE PRECISION
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  IF NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
  SELECT up.id, up.territory_country, up.territory_city, up.territory_district,
         up.territory_center_lat, up.territory_center_lng, up.territory_radius_km
  FROM public.user_profiles up
  WHERE up.role::TEXT = 'field_agent';
END;
$func$;

GRANT EXECUTE ON FUNCTION public.admin_list_agent_territories() TO authenticated;
