-- Migration: Fix broadcast center RLS so admins can send notifications to all users
-- Also fix is_admin_user() to check user_profiles.role as fallback (in case auth metadata is missing)

-- ============================================================
-- 1. Fix is_admin_user() to also check user_profiles.role
--    (auth metadata may not be set for older admin accounts)
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
    AND up.role = 'admin'::public.user_role
)
$$;

-- ============================================================
-- 2. Allow admins to INSERT notifications for any user
--    (existing policy only allows user_id = auth.uid())
-- ============================================================
DROP POLICY IF EXISTS "admin_broadcast_notifications" ON public.notifications;
CREATE POLICY "admin_broadcast_notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin_user());

-- ============================================================
-- 3. Allow admins to SELECT all notifications (for history)
-- ============================================================
DROP POLICY IF EXISTS "admin_read_all_notifications" ON public.notifications;
CREATE POLICY "admin_read_all_notifications"
ON public.notifications
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.is_admin_user());

-- ============================================================
-- 4. Ensure admin can read all user_profiles by role
--    (re-apply the policy to make sure it uses the updated function)
-- ============================================================
DROP POLICY IF EXISTS "admin_full_access_user_profiles" ON public.user_profiles;
CREATE POLICY "admin_full_access_user_profiles"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (id = auth.uid() OR public.is_admin_user());
