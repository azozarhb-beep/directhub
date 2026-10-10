-- Migration: Admin Control Room - Factory Registrations, KYC, Analytics
-- Timestamp: 20260810260000

-- ============================================================
-- 1. TYPES
-- ============================================================
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'kyc_status') THEN
        CREATE TYPE public.kyc_status AS ENUM ('pending', 'under_review', 'approved', 'rejected');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'registration_status') THEN
        CREATE TYPE public.registration_status AS ENUM ('pending', 'under_review', 'approved', 'rejected');
    END IF;
END $$;

-- ============================================================
-- 2. ADD MISSING COLUMNS TO EXISTING factory_registrations TABLE
-- ============================================================

-- Add registration_status column if it doesn't exist
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'factory_registrations'
          AND column_name = 'registration_status'
    ) THEN
        ALTER TABLE public.factory_registrations
            ADD COLUMN registration_status public.registration_status DEFAULT 'pending'::public.registration_status;
    END IF;
END $$;

-- Add kyc_status column if it doesn't exist
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'factory_registrations'
          AND column_name = 'kyc_status'
    ) THEN
        ALTER TABLE public.factory_registrations
            ADD COLUMN kyc_status public.kyc_status DEFAULT 'pending'::public.kyc_status;
    END IF;
END $$;

-- Add admin_note column if it doesn't exist
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'factory_registrations'
          AND column_name = 'admin_note'
    ) THEN
        ALTER TABLE public.factory_registrations
            ADD COLUMN admin_note TEXT DEFAULT '';
    END IF;
END $$;

-- Add reviewed_by column if it doesn't exist
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'factory_registrations'
          AND column_name = 'reviewed_by'
    ) THEN
        ALTER TABLE public.factory_registrations
            ADD COLUMN reviewed_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Add reviewed_at column if it doesn't exist
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'factory_registrations'
          AND column_name = 'reviewed_at'
    ) THEN
        ALTER TABLE public.factory_registrations
            ADD COLUMN reviewed_at TIMESTAMPTZ;
    END IF;
END $$;

-- Add submitted_at column if it doesn't exist
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'factory_registrations'
          AND column_name = 'submitted_at'
    ) THEN
        ALTER TABLE public.factory_registrations
            ADD COLUMN submitted_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;

-- Add industry column if it doesn't exist
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'factory_registrations'
          AND column_name = 'industry'
    ) THEN
        ALTER TABLE public.factory_registrations
            ADD COLUMN industry TEXT DEFAULT '';
    END IF;
END $$;

-- Add annual_revenue column if it doesn't exist
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'factory_registrations'
          AND column_name = 'annual_revenue'
    ) THEN
        ALTER TABLE public.factory_registrations
            ADD COLUMN annual_revenue TEXT DEFAULT '';
    END IF;
END $$;

-- Add contact_name column if it doesn't exist
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'factory_registrations'
          AND column_name = 'contact_name'
    ) THEN
        ALTER TABLE public.factory_registrations
            ADD COLUMN contact_name TEXT DEFAULT '';
    END IF;
END $$;

-- Add trade_license_url column if it doesn't exist
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'factory_registrations'
          AND column_name = 'trade_license_url'
    ) THEN
        ALTER TABLE public.factory_registrations
            ADD COLUMN trade_license_url TEXT DEFAULT '';
    END IF;
END $$;

-- Add trade_license_filename column if it doesn't exist
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'factory_registrations'
          AND column_name = 'trade_license_filename'
    ) THEN
        ALTER TABLE public.factory_registrations
            ADD COLUMN trade_license_filename TEXT DEFAULT '';
    END IF;
END $$;

-- Add tax_certificate_url column if it doesn't exist
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'factory_registrations'
          AND column_name = 'tax_certificate_url'
    ) THEN
        ALTER TABLE public.factory_registrations
            ADD COLUMN tax_certificate_url TEXT DEFAULT '';
    END IF;
END $$;

-- Add tax_certificate_filename column if it doesn't exist
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'factory_registrations'
          AND column_name = 'tax_certificate_filename'
    ) THEN
        ALTER TABLE public.factory_registrations
            ADD COLUMN tax_certificate_filename TEXT DEFAULT '';
    END IF;
END $$;

-- Add company_profile_url column if it doesn't exist
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'factory_registrations'
          AND column_name = 'company_profile_url'
    ) THEN
        ALTER TABLE public.factory_registrations
            ADD COLUMN company_profile_url TEXT DEFAULT '';
    END IF;
END $$;

-- Add company_profile_filename column if it doesn't exist
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'factory_registrations'
          AND column_name = 'company_profile_filename'
    ) THEN
        ALTER TABLE public.factory_registrations
            ADD COLUMN company_profile_filename TEXT DEFAULT '';
    END IF;
END $$;

-- Add additional_docs column if it doesn't exist
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'factory_registrations'
          AND column_name = 'additional_docs'
    ) THEN
        ALTER TABLE public.factory_registrations
            ADD COLUMN additional_docs JSONB DEFAULT '[]'::jsonb;
    END IF;
END $$;

-- ============================================================
-- 3. PLATFORM SETTINGS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.platform_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_key TEXT NOT NULL UNIQUE,
    setting_value TEXT NOT NULL DEFAULT '',
    description TEXT DEFAULT '',
    updated_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 4. INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_factory_registrations_user_id ON public.factory_registrations(user_id);
CREATE INDEX IF NOT EXISTS idx_factory_registrations_kyc ON public.factory_registrations(kyc_status);
CREATE INDEX IF NOT EXISTS idx_factory_registrations_submitted ON public.factory_registrations(submitted_at);
CREATE INDEX IF NOT EXISTS idx_platform_settings_key ON public.platform_settings(setting_key);

-- Index on registration_status (created after column is guaranteed to exist)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'factory_registrations'
          AND indexname = 'idx_factory_registrations_status'
    ) THEN
        CREATE INDEX idx_factory_registrations_status ON public.factory_registrations(registration_status);
    END IF;
END $$;

-- ============================================================
-- 5. FUNCTIONS
-- ============================================================

-- Admin check using auth metadata (safe - no recursion)
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
SELECT EXISTS (
    SELECT 1 FROM auth.users au
    WHERE au.id = auth.uid()
    AND (
        au.raw_user_meta_data->>'role' = 'admin'
        OR au.raw_app_meta_data->>'role' = 'admin'
    )
)
$$;

-- Update updated_at for factory_registrations
CREATE OR REPLACE FUNCTION public.update_factory_registrations_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

-- ============================================================
-- 6. ENABLE RLS
-- ============================================================
ALTER TABLE public.factory_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 7. RLS POLICIES
-- ============================================================

-- factory_registrations: users can view/manage their own; admins can manage all
DROP POLICY IF EXISTS "users_manage_own_factory_registrations" ON public.factory_registrations;
CREATE POLICY "users_manage_own_factory_registrations"
ON public.factory_registrations
FOR ALL
TO authenticated
USING (user_id = auth.uid() OR public.is_admin_user())
WITH CHECK (user_id = auth.uid() OR public.is_admin_user());

-- platform_settings: only admins
DROP POLICY IF EXISTS "admin_manage_platform_settings" ON public.platform_settings;
CREATE POLICY "admin_manage_platform_settings"
ON public.platform_settings
FOR ALL
TO authenticated
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

-- Add admin policies to existing tables for full access
DROP POLICY IF EXISTS "admin_full_access_orders" ON public.orders;
CREATE POLICY "admin_full_access_orders"
ON public.orders
FOR ALL
TO authenticated
USING (user_id = auth.uid() OR public.is_admin_user())
WITH CHECK (user_id = auth.uid() OR public.is_admin_user());

DROP POLICY IF EXISTS "admin_full_access_user_profiles" ON public.user_profiles;
CREATE POLICY "admin_full_access_user_profiles"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (id = auth.uid() OR public.is_admin_user());

-- ============================================================
-- 8. TRIGGERS
-- ============================================================
DROP TRIGGER IF EXISTS update_factory_registrations_updated_at ON public.factory_registrations;
CREATE TRIGGER update_factory_registrations_updated_at
    BEFORE UPDATE ON public.factory_registrations
    FOR EACH ROW
    EXECUTE FUNCTION public.update_factory_registrations_updated_at();

-- ============================================================
-- 9. DEFAULT PLATFORM SETTINGS
-- ============================================================
INSERT INTO public.platform_settings (setting_key, setting_value, description)
VALUES
    ('commission_rate', '3.5', 'Platform commission percentage on each order'),
    ('min_order_value', '500', 'Minimum order value in USD'),
    ('payment_hold_days', '7', 'Days to hold payment before releasing to supplier')
ON CONFLICT (setting_key) DO NOTHING;
