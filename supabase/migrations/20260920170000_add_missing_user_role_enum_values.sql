-- ============================================================
-- Fix: Add missing user_role enum values
-- Adds 'field_agent' and 'logistics_partner' to the user_role enum
-- which were missing, causing the handle_new_user trigger to fail
-- when inserting sandbox agent/logistics accounts.
-- Also patches handle_new_user to safely handle unknown role values.
-- ============================================================

-- Step 1: Add missing enum values (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'field_agent'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')
  ) THEN
    ALTER TYPE public.user_role ADD VALUE 'field_agent';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'logistics_partner'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')
  ) THEN
    ALTER TYPE public.user_role ADD VALUE 'logistics_partner';
  END IF;
END $$;

-- Step 2: Patch handle_new_user to safely cast role with fallback
-- Uses a CASE expression to map known roles and default unknown ones to 'buyer'
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role TEXT;
  v_safe_role public.user_role;
BEGIN
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'buyer');

  -- Map to a valid enum value; default to 'buyer' for any unknown value
  v_safe_role := CASE v_role
    WHEN 'buyer'             THEN 'buyer'::public.user_role
    WHEN 'manufacturer'      THEN 'manufacturer'::public.user_role
    WHEN 'admin'             THEN 'admin'::public.user_role
    WHEN 'field_agent'       THEN 'field_agent'::public.user_role
    WHEN 'logistics_partner' THEN 'logistics_partner'::public.user_role
    ELSE                          'buyer'::public.user_role
  END;

  INSERT INTO public.user_profiles (id, email, full_name, company_name, phone, country, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'company_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    COALESCE(NEW.raw_user_meta_data->>'country', ''),
    v_safe_role
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;
