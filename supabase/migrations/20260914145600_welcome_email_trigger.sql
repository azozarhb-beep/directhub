-- ============================================================
-- Welcome Email Trigger
-- Fires the send-email edge function via pg_net whenever a
-- new user is inserted into auth.users.
-- ============================================================

-- Enable pg_net extension (pre-installed in Supabase, safe to call)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ============================================================
-- Function: send_welcome_email_on_signup
-- Called by trigger after INSERT on auth.users
-- Uses pg_net to POST to the send-email edge function
-- ============================================================
CREATE OR REPLACE FUNCTION public.send_welcome_email_on_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  supabase_url TEXT;
  service_role_key TEXT;
  user_email TEXT;
  user_full_name TEXT;
  payload JSONB;
BEGIN
  -- Only send if the user has an email (skip phone-only signups)
  IF NEW.email IS NULL OR NEW.email = '' THEN
    RETURN NEW;
  END IF;

  user_email := NEW.email;
  user_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );

  -- Read project URL and service role key from Supabase vault / app.settings
  -- These are set automatically in Supabase managed environments
  supabase_url := current_setting('app.settings.supabase_url', true);
  service_role_key := current_setting('app.settings.service_role_key', true);

  -- If settings are not available, fall back to a no-op (email will be sent via frontend)
  IF supabase_url IS NULL OR supabase_url = '' THEN
    RETURN NEW;
  END IF;

  payload := jsonb_build_object(
    'type', 'welcome',
    'to', user_email,
    'data', jsonb_build_object(
      'full_name', user_full_name,
      'dashboard_url', 'https://direct-hub.net/my-account'
    )
  );

  -- Fire-and-forget HTTP POST to the send-email edge function
  PERFORM extensions.http_post(
    url := supabase_url || '/functions/v1/send-email',
    body := payload::TEXT,
    content_type := 'application/json',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || service_role_key,
      'Content-Type', 'application/json'
    )
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Never block user creation if email fails
    RAISE WARNING 'Welcome email trigger failed for %: %', NEW.email, SQLERRM;
    RETURN NEW;
END;
$$;

-- ============================================================
-- Trigger: on_auth_user_welcome_email
-- Fires AFTER the existing on_auth_user_created trigger so
-- user_profiles is already created when this runs.
-- ============================================================
DROP TRIGGER IF EXISTS on_auth_user_welcome_email ON auth.users;
CREATE TRIGGER on_auth_user_welcome_email
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.send_welcome_email_on_signup();
