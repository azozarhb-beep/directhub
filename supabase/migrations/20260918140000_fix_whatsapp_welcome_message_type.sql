-- Migration: Fix queue_whatsapp_welcome() missing message_type
-- Timestamp: 20260918140000
--
-- Error 23502: null value in column "message_type" of relation "whatsapp_alert_log"
-- Root cause: trg_whatsapp_welcome inserts without message_type (NOT NULL).
-- That blocked ANY update of user_profiles.role_selected = true (including admin grant).

CREATE OR REPLACE FUNCTION public.queue_whatsapp_welcome()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  -- Only fire when role_selected transitions from false/null → true
  IF (NEW.role_selected = TRUE AND (OLD.role_selected IS DISTINCT FROM TRUE)) THEN
    -- Only queue if not already queued for this user
    IF NOT EXISTS (
      SELECT 1 FROM public.whatsapp_alert_log
      WHERE user_id = NEW.id AND alert_type = 'welcome'
    ) THEN
      INSERT INTO public.whatsapp_alert_log (
        alert_type,
        user_id,
        phone,
        message_type,
        full_name,
        role,
        status,
        created_at
      ) VALUES (
        'welcome',
        NEW.id,
        COALESCE(NULLIF(NEW.phone, ''), 'unknown'),
        'welcome',
        COALESCE(NULLIF(NEW.full_name, ''), NULLIF(NEW.company_name, ''), 'User'),
        COALESCE(NEW.role::TEXT, 'buyer'),
        'pending',
        NOW()
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$func$;
