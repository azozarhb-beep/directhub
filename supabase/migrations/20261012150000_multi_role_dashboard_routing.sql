-- Migration: Save account_role and dashboard_path from user metadata to user_profiles on registration
-- Timestamp: 20261012150000

-- Add account_role column if not exists
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS account_role TEXT DEFAULT '';

-- Ensure dashboard_path column exists (may already exist from previous migration)
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS dashboard_path TEXT;

-- Create or replace function to sync user metadata into user_profiles on insert
CREATE OR REPLACE FUNCTION public.handle_new_user_role_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dashboard_path TEXT;
  v_account_role TEXT;
  v_role TEXT;
BEGIN
  -- Extract from user_metadata
  v_dashboard_path := NEW.raw_user_meta_data->>'dashboard_path';
  v_account_role   := NEW.raw_user_meta_data->>'account_role';
  v_role           := NEW.raw_user_meta_data->>'role';

  -- Only update if we have meaningful values
  IF v_dashboard_path IS NOT NULL AND v_dashboard_path <> '' THEN
    UPDATE public.user_profiles
    SET
      dashboard_path = v_dashboard_path,
      account_role   = COALESCE(v_account_role, account_role),
      updated_at     = NOW()
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

-- Drop existing trigger if present to avoid duplicates
DROP TRIGGER IF EXISTS on_auth_user_role_sync ON auth.users;

-- Create trigger that fires after a new auth user is inserted
CREATE TRIGGER on_auth_user_role_sync
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_role_sync();

-- Also create a trigger for UPDATE to handle email-confirmed users
CREATE OR REPLACE FUNCTION public.handle_user_metadata_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dashboard_path TEXT;
  v_account_role TEXT;
BEGIN
  v_dashboard_path := NEW.raw_user_meta_data->>'dashboard_path';
  v_account_role   := NEW.raw_user_meta_data->>'account_role';

  IF v_dashboard_path IS NOT NULL AND v_dashboard_path <> '' THEN
    UPDATE public.user_profiles
    SET
      dashboard_path = v_dashboard_path,
      account_role   = COALESCE(NULLIF(v_account_role, ''), account_role),
      updated_at     = NOW()
    WHERE id = NEW.id
      AND (dashboard_path IS NULL OR dashboard_path = '');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_metadata_update ON auth.users;

CREATE TRIGGER on_auth_user_metadata_update
  AFTER UPDATE OF raw_user_meta_data ON auth.users
  FOR EACH ROW
  WHEN (NEW.raw_user_meta_data IS DISTINCT FROM OLD.raw_user_meta_data)
  EXECUTE FUNCTION public.handle_user_metadata_update();
