-- Allow any authenticated user (e.g. logistics partner) to resolve the primary admin id
-- without needing SELECT access on other users' user_profiles rows.
CREATE OR REPLACE FUNCTION public.get_primary_admin_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT up.id
  FROM public.user_profiles up
  WHERE up.role = 'admin'
  ORDER BY up.created_at ASC NULLS LAST
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_primary_admin_id() TO authenticated;
