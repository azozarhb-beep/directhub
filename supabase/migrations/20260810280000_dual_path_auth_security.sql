-- ============================================================
-- Dual-Path Auth & Security Migration
-- Adds: OTP verification, legal documents, session tracking,
--       factory email autofill, product listing gate
-- ============================================================

-- 1. Add OTP & document columns to factory_registrations
ALTER TABLE public.factory_registrations
  ADD COLUMN IF NOT EXISTS otp_code TEXT,
  ADD COLUMN IF NOT EXISTS otp_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS otp_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_activated BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS trade_license_url TEXT,
  ADD COLUMN IF NOT EXISTS manufacturing_license_url TEXT,
  ADD COLUMN IF NOT EXISTS documents_submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS product_listing_unlocked BOOLEAN DEFAULT FALSE;

-- 2. Add profile/cover photo columns to user_profiles
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS cover_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 3. Create factory_saved_emails table for autofill feature
CREATE TABLE IF NOT EXISTS public.factory_saved_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_fingerprint TEXT NOT NULL,
  email TEXT NOT NULL,
  company_name TEXT,
  last_login_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_factory_saved_emails_device_email
  ON public.factory_saved_emails (device_fingerprint, email);

CREATE INDEX IF NOT EXISTS idx_factory_saved_emails_device
  ON public.factory_saved_emails (device_fingerprint);

-- 4. Enable RLS on factory_saved_emails
ALTER TABLE public.factory_saved_emails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_saved_emails" ON public.factory_saved_emails;
CREATE POLICY "public_read_saved_emails"
  ON public.factory_saved_emails FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "public_upsert_saved_emails" ON public.factory_saved_emails;
CREATE POLICY "public_upsert_saved_emails"
  ON public.factory_saved_emails FOR INSERT TO public WITH CHECK (true);

DROP POLICY IF EXISTS "public_update_saved_emails" ON public.factory_saved_emails;
CREATE POLICY "public_update_saved_emails"
  ON public.factory_saved_emails FOR UPDATE TO public USING (true) WITH CHECK (true);

-- 5. Function: check if factory can list products
CREATE OR REPLACE FUNCTION public.factory_can_list_products(factory_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (SELECT product_listing_unlocked
     FROM public.factory_registrations
     WHERE user_id = factory_user_id
     LIMIT 1),
    false
  );
$$;

-- 6. Function: check if factory has uploaded legal documents
CREATE OR REPLACE FUNCTION public.factory_has_documents(factory_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (SELECT (trade_license_url IS NOT NULL AND manufacturing_license_url IS NOT NULL)
     FROM public.factory_registrations
     WHERE user_id = factory_user_id
     LIMIT 1),
    false
  );
$$;

-- 7. Ensure manufacturer_products table has is_published column
ALTER TABLE public.manufacturer_products
  ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT FALSE;

-- 8. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_factory_reg_user_id
  ON public.factory_registrations (user_id);

CREATE INDEX IF NOT EXISTS idx_factory_reg_otp_verified
  ON public.factory_registrations (otp_verified);

CREATE INDEX IF NOT EXISTS idx_factory_reg_product_listing
  ON public.factory_registrations (product_listing_unlocked);
