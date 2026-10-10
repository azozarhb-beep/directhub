-- Migration: Fix platform_settings RLS, recursive profile UPDATE policy,
--            missing profile columns, and chat-media storage upsert policies.
-- Timestamp: 20260918120000
--
-- Root causes addressed:
-- 1. platform_settings: prior fix migration may not be applied; upsert INSERT
--    fails with "new row violates row-level security policy".
-- 2. is_admin_user() only checked auth metadata; many admins only have
--    user_profiles.role = 'admin'.
-- 3. users_update_own_profile WITH CHECK subquery on user_profiles causes
--    "infinite recursion detected in policy" — all profile saves fail.
-- 4. App writes cover_url / description on user_profiles, but schema only had
--    cover_photo_url (and description lived on supplier_profiles).
-- 5. chat-media bucket had INSERT/SELECT/DELETE but no UPDATE — upsert:true fails.

-- ============================================================
-- 1. is_admin_user() — auth metadata OR user_profiles.role
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
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
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_user() TO anon;

-- ============================================================
-- 2. Non-recursive helper for "current role" (used by UPDATE policy)
-- ============================================================
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::TEXT FROM public.user_profiles WHERE id = auth.uid() LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;

-- ============================================================
-- 3. platform_settings — explicit per-operation admin policies
-- ============================================================
DROP POLICY IF EXISTS "admin_manage_platform_settings" ON public.platform_settings;
DROP POLICY IF EXISTS "admin_select_platform_settings" ON public.platform_settings;
DROP POLICY IF EXISTS "admin_insert_platform_settings" ON public.platform_settings;
DROP POLICY IF EXISTS "admin_update_platform_settings" ON public.platform_settings;
DROP POLICY IF EXISTS "admin_delete_platform_settings" ON public.platform_settings;

CREATE POLICY "admin_select_platform_settings"
ON public.platform_settings
FOR SELECT
TO authenticated
USING (public.is_admin_user());

CREATE POLICY "admin_insert_platform_settings"
ON public.platform_settings
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin_user());

CREATE POLICY "admin_update_platform_settings"
ON public.platform_settings
FOR UPDATE
TO authenticated
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

CREATE POLICY "admin_delete_platform_settings"
ON public.platform_settings
FOR DELETE
TO authenticated
USING (public.is_admin_user());

-- Allow authenticated users to READ settings used by public flows
-- (product approval toggle, onboarding mode) without write access.
DROP POLICY IF EXISTS "authenticated_read_platform_settings" ON public.platform_settings;
CREATE POLICY "authenticated_read_platform_settings"
ON public.platform_settings
FOR SELECT
TO authenticated
USING (true);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 4. user_profiles — fix recursive UPDATE policy + missing columns
-- ============================================================
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS city TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS cover_url TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS cover_photo_url TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';

-- Keep cover_url and cover_photo_url in sync for legacy readers
UPDATE public.user_profiles
SET cover_url = cover_photo_url
WHERE (cover_url IS NULL OR cover_url = '')
  AND cover_photo_url IS NOT NULL
  AND cover_photo_url <> '';

UPDATE public.user_profiles
SET cover_photo_url = cover_url
WHERE (cover_photo_url IS NULL OR cover_photo_url = '')
  AND cover_url IS NOT NULL
  AND cover_url <> '';

DROP POLICY IF EXISTS "users_manage_own_user_profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "users_read_own_profile" ON public.user_profiles;
DROP POLICY IF EXISTS "users_update_own_profile" ON public.user_profiles;

CREATE POLICY "users_read_own_profile"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (id = auth.uid() OR public.is_admin_user());

-- Non-recursive: role lock uses SECURITY DEFINER helper, not a subquery on self
CREATE POLICY "users_update_own_profile"
ON public.user_profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid() OR public.is_admin_user())
WITH CHECK (
  (id = auth.uid() AND role::TEXT = public.current_user_role())
  OR public.is_admin_user()
);

-- ============================================================
-- 5. chat-media storage — allow UPDATE (required for upsert:true)
--    Paths used by the app: "{userId}/..." and "profiles/{userId}/..."
-- ============================================================
DROP POLICY IF EXISTS "chat_media_upload_authenticated" ON storage.objects;
CREATE POLICY "chat_media_upload_authenticated"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'chat-media');

DROP POLICY IF EXISTS "chat_media_update_own" ON storage.objects;
CREATE POLICY "chat_media_update_own"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'chat-media'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR (
      (storage.foldername(name))[1] = 'profiles'
      AND auth.uid()::text = (storage.foldername(name))[2]
    )
  )
)
WITH CHECK (
  bucket_id = 'chat-media'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR (
      (storage.foldername(name))[1] = 'profiles'
      AND auth.uid()::text = (storage.foldername(name))[2]
    )
  )
);

DROP POLICY IF EXISTS "chat_media_delete_own" ON storage.objects;
CREATE POLICY "chat_media_delete_own"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'chat-media'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR (
      (storage.foldername(name))[1] = 'profiles'
      AND auth.uid()::text = (storage.foldername(name))[2]
    )
  )
);

DROP POLICY IF EXISTS "chat_media_read_public" ON storage.objects;
CREATE POLICY "chat_media_read_public"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'chat-media');
