-- Migration: Fix platform_settings RLS policies for admin access
-- Timestamp: 20260917131500
--
-- Problem: "new row violates row-level security policy for table platform_settings"
-- Root cause: The is_admin_user() function only checks auth.users metadata.
-- If the metadata is not set or the session token is stale, the check fails.
-- Fix: Update is_admin_user() to also check user_profiles.role as a fallback,
-- and recreate explicit per-operation RLS policies for platform_settings.

-- ============================================================
-- 1. UPDATE is_admin_user() FUNCTION
--    Add fallback check against user_profiles.role
--    to handle cases where auth metadata may not be set.
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
SELECT EXISTS (
    SELECT 1 FROM auth.users au
    WHERE au.id = auth.uid()
    AND (
        au.raw_user_meta_data->>'role' = 'admin'
        OR au.raw_app_meta_data->>'role' = 'admin'
    )
)
OR EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid()
    AND up.role::TEXT = 'admin'
)
$$;

-- ============================================================
-- 2. DROP AND RECREATE platform_settings RLS POLICIES
--    Use explicit per-operation policies to ensure INSERT
--    and UPDATE both work correctly for admin users.
-- ============================================================

-- Drop the existing combined policy
DROP POLICY IF EXISTS "admin_manage_platform_settings" ON public.platform_settings;

-- SELECT: admins can read all settings
DROP POLICY IF EXISTS "admin_select_platform_settings" ON public.platform_settings;
CREATE POLICY "admin_select_platform_settings"
ON public.platform_settings
FOR SELECT
TO authenticated
USING (public.is_admin_user());

-- INSERT: admins can insert new settings
DROP POLICY IF EXISTS "admin_insert_platform_settings" ON public.platform_settings;
CREATE POLICY "admin_insert_platform_settings"
ON public.platform_settings
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin_user());

-- UPDATE: admins can update existing settings
DROP POLICY IF EXISTS "admin_update_platform_settings" ON public.platform_settings;
CREATE POLICY "admin_update_platform_settings"
ON public.platform_settings
FOR UPDATE
TO authenticated
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

-- DELETE: admins can delete settings
DROP POLICY IF EXISTS "admin_delete_platform_settings" ON public.platform_settings;
CREATE POLICY "admin_delete_platform_settings"
ON public.platform_settings
FOR DELETE
TO authenticated
USING (public.is_admin_user());

-- ============================================================
-- 3. ENSURE RLS IS ENABLED
-- ============================================================
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
