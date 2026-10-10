-- Migration: Grant admin role to azozarhb@gmail.com
-- Timestamp: 20260812145636
--
-- NOTE: This migration is split into two logical parts:
--   Part A (this file): Add 'admin' enum value + update auth.users metadata
--   Part B: Update user_profiles.role (runs after enum value is committed)
--
-- The "unsafe use of new enum value" error occurs because PostgreSQL
-- does not allow a newly added enum value to be used in DML within
-- the same transaction. The workaround is to NOT update user_profiles
-- here — the auth.users metadata update below is sufficient for the
-- middleware admin check (user_metadata.role / app_metadata.role).

-- ============================================================
-- 1. ADD 'admin' VALUE TO user_role ENUM (if not exists)
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'admin'
          AND enumtypid = (
              SELECT oid FROM pg_type WHERE typname = 'user_role'
          )
    ) THEN
        ALTER TYPE public.user_role ADD VALUE 'admin';
    END IF;
END $$;

-- ============================================================
-- 2. UPDATE auth.users METADATA FOR azozarhb@gmail.com
--    Uses plain JSONB — no enum cast — so it works in the
--    same transaction as the ALTER TYPE above.
--    The app middleware checks user_metadata.role and
--    app_metadata.role, so this grants full admin access.
-- ============================================================
DO $$
DECLARE
    target_user_id UUID;
BEGIN
    SELECT id INTO target_user_id
    FROM auth.users
    WHERE email = 'azozarhb@gmail.com'
    LIMIT 1;

    IF target_user_id IS NOT NULL THEN
        UPDATE auth.users
        SET
            raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb,
            raw_app_meta_data  = COALESCE(raw_app_meta_data,  '{}'::jsonb) || '{"role":"admin"}'::jsonb,
            updated_at = now()
        WHERE id = target_user_id;

        RAISE NOTICE 'Admin role granted in auth.users for azozarhb@gmail.com (id: %)', target_user_id;
    ELSE
        RAISE NOTICE 'User azozarhb@gmail.com not found in auth.users — must sign up first.';
    END IF;
END $$;
