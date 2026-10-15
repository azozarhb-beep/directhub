-- System Engineering Portal: SYSTEM_ENGINEER access, security audit trail, maintenance settings.

CREATE OR REPLACE FUNCTION public.is_system_engineer()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $func$
SELECT EXISTS (
    SELECT 1 FROM auth.users au
    WHERE au.id = auth.uid()
    AND (
        au.raw_user_meta_data->>'staff_role' = 'SYSTEM_ENGINEER'
        OR au.raw_app_meta_data->>'staff_role' = 'SYSTEM_ENGINEER'
    )
)
$func$;

-- Immutable security audit trail (insert + read only, no update/delete policies).
CREATE TABLE IF NOT EXISTS public.security_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL DEFAULT 'info',
    actor_id UUID,
    actor_email TEXT,
    actor_role TEXT,
    description TEXT NOT NULL DEFAULT '',
    ip_address TEXT,
    geo_hint TEXT,
    user_agent TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_security_audit_logs_created_at
ON public.security_audit_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_security_audit_logs_event_type
ON public.security_audit_logs (event_type);

ALTER TABLE public.security_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_read_security_audit_logs" ON public.security_audit_logs;
CREATE POLICY "staff_read_security_audit_logs"
ON public.security_audit_logs
FOR SELECT
TO authenticated
USING (public.is_admin_user() OR public.is_system_engineer());

DROP POLICY IF EXISTS "staff_insert_security_audit_logs" ON public.security_audit_logs;
CREATE POLICY "staff_insert_security_audit_logs"
ON public.security_audit_logs
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin_user() OR public.is_system_engineer());

-- Engineers may read and resolve runtime incidents.
DROP POLICY IF EXISTS "system_engineer_read_system_health_logs" ON public.system_health_logs;
CREATE POLICY "system_engineer_read_system_health_logs"
ON public.system_health_logs
FOR SELECT
TO authenticated
USING (public.is_system_engineer());

DROP POLICY IF EXISTS "system_engineer_update_system_health_logs" ON public.system_health_logs;
CREATE POLICY "system_engineer_update_system_health_logs"
ON public.system_health_logs
FOR UPDATE
TO authenticated
USING (public.is_system_engineer())
WITH CHECK (public.is_system_engineer());

-- Engineers may read/write ONLY non-monetary platform settings (maintenance, version, cache).
DROP POLICY IF EXISTS "system_engineer_select_platform_settings" ON public.platform_settings;
CREATE POLICY "system_engineer_select_platform_settings"
ON public.platform_settings
FOR SELECT
TO authenticated
USING (public.is_system_engineer() AND setting_key LIKE 'system\_%' ESCAPE '\');

DROP POLICY IF EXISTS "system_engineer_insert_platform_settings" ON public.platform_settings;
CREATE POLICY "system_engineer_insert_platform_settings"
ON public.platform_settings
FOR INSERT
TO authenticated
WITH CHECK (public.is_system_engineer() AND setting_key LIKE 'system\_%' ESCAPE '\');

DROP POLICY IF EXISTS "system_engineer_update_platform_settings" ON public.platform_settings;
CREATE POLICY "system_engineer_update_platform_settings"
ON public.platform_settings
FOR UPDATE
TO authenticated
USING (public.is_system_engineer() AND setting_key LIKE 'system\_%' ESCAPE '\')
WITH CHECK (public.is_system_engineer() AND setting_key LIKE 'system\_%' ESCAPE '\');

-- Public (anon + authenticated) may read the maintenance banner settings only.
DROP POLICY IF EXISTS "public_read_system_maintenance_settings" ON public.platform_settings;
CREATE POLICY "public_read_system_maintenance_settings"
ON public.platform_settings
FOR SELECT
TO anon, authenticated
USING (setting_key IN ('system_maintenance_mode', 'system_maintenance_message', 'system_min_app_version'));
