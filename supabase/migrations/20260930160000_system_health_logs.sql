-- ============================================================
-- system_health_logs — PlatformSentinel self-healing layer
-- ============================================================

-- 1. Create table
CREATE TABLE IF NOT EXISTS public.system_health_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category    TEXT NOT NULL DEFAULT 'system',
  severity    TEXT NOT NULL DEFAULT 'info',
  source      TEXT NOT NULL,
  message     TEXT NOT NULL,
  details     JSONB,
  resolved    BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_system_health_logs_created_at
  ON public.system_health_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_system_health_logs_severity
  ON public.system_health_logs (severity);

CREATE INDEX IF NOT EXISTS idx_system_health_logs_resolved
  ON public.system_health_logs (resolved);

CREATE INDEX IF NOT EXISTS idx_system_health_logs_category
  ON public.system_health_logs (category);

-- 3. Enable RLS
ALTER TABLE public.system_health_logs ENABLE ROW LEVEL SECURITY;

-- 4. Helper function — check admin role (safe: queries auth.users metadata, not user_profiles)
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  )
$$;

-- 5. RLS Policies

-- Admins can read all logs
DROP POLICY IF EXISTS "admin_read_system_health_logs" ON public.system_health_logs;
CREATE POLICY "admin_read_system_health_logs"
  ON public.system_health_logs
  FOR SELECT
  TO authenticated
  USING (public.is_admin_user());

-- Authenticated users (and service role) can insert logs (sentinel writes from client)
DROP POLICY IF EXISTS "authenticated_insert_system_health_logs" ON public.system_health_logs;
CREATE POLICY "authenticated_insert_system_health_logs"
  ON public.system_health_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Admins can update (mark resolved)
DROP POLICY IF EXISTS "admin_update_system_health_logs" ON public.system_health_logs;
CREATE POLICY "admin_update_system_health_logs"
  ON public.system_health_logs
  FOR UPDATE
  TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- Admins can delete old logs
DROP POLICY IF EXISTS "admin_delete_system_health_logs" ON public.system_health_logs;
CREATE POLICY "admin_delete_system_health_logs"
  ON public.system_health_logs
  FOR DELETE
  TO authenticated
  USING (public.is_admin_user());

-- 6. Enable Realtime for live updates in SystemHealthPanel
ALTER PUBLICATION supabase_realtime ADD TABLE public.system_health_logs;
