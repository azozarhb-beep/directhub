-- Factory messaging hub: let a factory read its assigned field supervisor card
-- (name, code, status) without opening user_profiles RLS to other users.

CREATE OR REPLACE FUNCTION public.get_factory_supervisor_card()
RETURNS TABLE (
  agent_id UUID,
  full_name TEXT,
  referral_code TEXT,
  is_active BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
  SELECT
    up.id AS agent_id,
    COALESCE(NULLIF(up.full_name, ''), up.email, '') AS full_name,
    up.referral_code AS referral_code,
    true AS is_active
  FROM public.factory_registrations fr
  JOIN public.user_profiles up ON up.id = fr.referred_by_agent_id
  WHERE fr.user_id = auth.uid()
    AND fr.referred_by_agent_id IS NOT NULL
  ORDER BY fr.created_at DESC
  LIMIT 1
$func$;

GRANT EXECUTE ON FUNCTION public.get_factory_supervisor_card() TO authenticated;

-- Make sure the permanent factory threads stay realtime-enabled
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'factory_thread_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.factory_thread_messages;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Realtime publication check skipped: %', SQLERRM;
END $$;
