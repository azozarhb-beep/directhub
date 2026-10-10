-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Product Approval Toggle + Supplier Registration Source Tracking
-- Timestamp: 20260910140000
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add registration_source column to user_profiles (idempotent)
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS registration_source TEXT DEFAULT 'direct'
    CHECK (registration_source IN ('direct', 'field_representative', 'amal_assistant'));

-- 2. Seed the require_product_approval setting into platform_settings
--    The platform_settings table already exists (verified via list_tables).
--    We use INSERT ... ON CONFLICT DO NOTHING so this is fully idempotent.
INSERT INTO public.platform_settings (setting_key, setting_value, updated_at)
VALUES ('require_product_approval', 'false', NOW())
ON CONFLICT (setting_key) DO NOTHING;

-- 3. Index for fast lookup of registration_source
CREATE INDEX IF NOT EXISTS idx_user_profiles_registration_source
  ON public.user_profiles (registration_source);
