-- Migration: WhatsApp automation fields + order notification hooks
-- Adds whatsapp_linked flag to user_profiles for tracking phone-to-WhatsApp binding

-- Add whatsapp_linked column to user_profiles (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_profiles'
      AND column_name = 'whatsapp_linked'
  ) THEN
    ALTER TABLE public.user_profiles ADD COLUMN whatsapp_linked BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Index for fast lookup of unlinked users
CREATE INDEX IF NOT EXISTS idx_user_profiles_whatsapp_linked
  ON public.user_profiles (whatsapp_linked)
  WHERE whatsapp_linked = FALSE;

-- Mark existing users with phone numbers as potentially linkable
-- (they will be linked when they next interact or via bulk send)
UPDATE public.user_profiles
SET whatsapp_linked = FALSE
WHERE phone IS NOT NULL
  AND whatsapp_linked IS NULL;
