-- Hotfix: add missing user_profiles columns used by Edit Profile / Supplier Profile.
-- Safe to run anytime (IF NOT EXISTS). Also included in 20260918120000.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS city TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS cover_url TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS cover_photo_url TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
