-- Migration: Add user notification preferences to user_profiles
-- User-controlled toggles: new inquiries, order updates, weekly digest, promotions
-- Critical financial/operational notifications (payments, escrow, delivery) are ALWAYS active
-- and are NOT stored here (they are system-level and cannot be disabled)

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS notif_new_inquiries   BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_order_updates   BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_weekly_digest   BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_promotions      BOOLEAN NOT NULL DEFAULT false;
