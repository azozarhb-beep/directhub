-- Migration: Split users_manage_own_user_profiles into separate SELECT and UPDATE policies
-- This prevents users from changing their own role column while allowing other profile updates

-- Drop the existing combined policy
DROP POLICY IF EXISTS "users_manage_own_user_profiles" ON public.user_profiles;

-- Policy 1: Allow authenticated users to read their own profile
DROP POLICY IF EXISTS "users_read_own_profile" ON public.user_profiles;
CREATE POLICY "users_read_own_profile"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

-- Policy 2: Allow authenticated users to update their own profile, but NOT change their role
DROP POLICY IF EXISTS "users_update_own_profile" ON public.user_profiles;
CREATE POLICY "users_update_own_profile"
ON public.user_profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (
  id = auth.uid()
  AND role = (SELECT role FROM public.user_profiles WHERE id = auth.uid())
);
