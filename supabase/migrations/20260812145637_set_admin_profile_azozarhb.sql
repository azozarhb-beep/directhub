-- Migration: Set user_profiles.role = 'admin' for azozarhb@gmail.com
-- Timestamp: 20260812145637
--
-- This migration runs AFTER 20260812145636 which added the 'admin'
-- enum value. Because it runs in a separate transaction, the new
-- enum value is now committed and safe to use in DML.

DO $$
DECLARE
    target_user_id UUID;
BEGIN
    SELECT up.id INTO target_user_id
    FROM public.user_profiles up
    JOIN auth.users au ON au.id = up.id
    WHERE au.email = 'azozarhb@gmail.com'
    LIMIT 1;

    IF target_user_id IS NOT NULL THEN
        UPDATE public.user_profiles
        SET role = 'admin'::public.user_role,
            updated_at = now()
        WHERE id = target_user_id;

        RAISE NOTICE 'user_profiles.role set to admin for azozarhb@gmail.com (id: %)', target_user_id;
    ELSE
        RAISE NOTICE 'No user_profiles row found for azozarhb@gmail.com — will be set on next login.';
    END IF;
END $$;
