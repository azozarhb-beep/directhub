-- ============================================================
-- Add manufacturer_agent value to user_role enum.
-- Must be committed in its own transaction BEFORE any
-- migration that references this enum value in SQL expressions.
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'manufacturer_agent'
          AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')
    ) THEN
        ALTER TYPE public.user_role ADD VALUE 'manufacturer_agent';
    END IF;
END $$;
