-- Migration: Add preferred_language column to user_profiles
-- Allows syncing the user's chosen UI language with their account

ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT 'en'
  CHECK (preferred_language = ANY (ARRAY['en'::text, 'ar'::text, 'zh'::text, 'tr'::text]));

CREATE INDEX IF NOT EXISTS idx_user_profiles_preferred_language
  ON public.user_profiles (preferred_language);
