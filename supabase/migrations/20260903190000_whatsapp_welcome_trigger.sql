-- Migration: WhatsApp Welcome Event Trigger
-- Automatically queues a welcome WhatsApp message for every new user
-- who completes role selection (role_selected = true).
--
-- Flow:
--   1. User registers → selects role → user_profiles.role_selected set to TRUE
--   2. DB trigger fires → inserts row into whatsapp_alert_log (type = 'welcome')
--   3. Next.js API /api/whatsapp/process-queue reads pending rows and sends messages
--   4. Row marked as sent / failed

-- ── Ensure whatsapp_alert_log has the columns we need ────────────────────────
ALTER TABLE public.whatsapp_alert_log
  ADD COLUMN IF NOT EXISTS alert_type   TEXT         NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS user_id      UUID,
  ADD COLUMN IF NOT EXISTS phone        TEXT,
  ADD COLUMN IF NOT EXISTS full_name    TEXT,
  ADD COLUMN IF NOT EXISTS role         TEXT,
  ADD COLUMN IF NOT EXISTS status       TEXT         NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS sent_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS error_msg    TEXT,
  ADD COLUMN IF NOT EXISTS created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW();

-- Index for fast queue polling
CREATE INDEX IF NOT EXISTS idx_whatsapp_alert_log_status
  ON public.whatsapp_alert_log (status)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_whatsapp_alert_log_user_id
  ON public.whatsapp_alert_log (user_id);

-- ── Trigger function: fires when role_selected becomes TRUE ───────────────────
CREATE OR REPLACE FUNCTION public.queue_whatsapp_welcome()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
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
        full_name,
        role,
        status,
        created_at
      ) VALUES (
        'welcome',
        NEW.id,
        COALESCE(NEW.phone, ''),
        COALESCE(NEW.full_name, NEW.company_name, ''),
        COALESCE(NEW.role, 'buyer'),
        'pending',
        NOW()
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$func$;

-- ── Attach trigger to user_profiles ──────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_whatsapp_welcome ON public.user_profiles;
CREATE TRIGGER trg_whatsapp_welcome
  AFTER UPDATE OF role_selected ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.queue_whatsapp_welcome();

-- ── RLS: allow service role to read/update alert log ─────────────────────────
ALTER TABLE public.whatsapp_alert_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_manage_whatsapp_alert_log" ON public.whatsapp_alert_log;
CREATE POLICY "service_manage_whatsapp_alert_log"
  ON public.whatsapp_alert_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "admin_read_whatsapp_alert_log" ON public.whatsapp_alert_log;
CREATE POLICY "admin_read_whatsapp_alert_log"
  ON public.whatsapp_alert_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users au
      WHERE au.id = auth.uid()
        AND (au.raw_user_meta_data->>'role' = 'admin'
             OR au.raw_app_meta_data->>'role' = 'admin')
    )
  );
