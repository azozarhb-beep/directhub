-- Migration: Manufacturer Bank Account & Payment Settings
-- Timestamp: 20260810230000

-- ============================================================
-- 1. MANUFACTURER PAYMENT SETTINGS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.manufacturer_payment_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manufacturer_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,

  -- Bank Account Details
  bank_name text DEFAULT '',
  bank_account_holder text DEFAULT '',
  iban text DEFAULT '',
  swift_code text DEFAULT '',
  account_number text DEFAULT '',
  bank_country text DEFAULT '',
  bank_city text DEFAULT '',
  bank_branch text DEFAULT '',
  bank_currency text DEFAULT 'SAR',

  -- Digital Wallet Addresses
  usdt_trc20_address text DEFAULT '',
  usdt_erc20_address text DEFAULT '',
  bitcoin_address text DEFAULT '',
  ethereum_address text DEFAULT '',
  other_wallet_label text DEFAULT '',
  other_wallet_address text DEFAULT '',

  -- Status & Verification
  is_verified boolean DEFAULT false,
  verified_at timestamptz,
  verified_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  admin_note text DEFAULT '',

  -- Timestamps
  created_at timestamptz DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 2. UNIQUE CONSTRAINT: one record per manufacturer
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'manufacturer_payment_settings_manufacturer_id_key'
  ) THEN
    ALTER TABLE public.manufacturer_payment_settings
      ADD CONSTRAINT manufacturer_payment_settings_manufacturer_id_key
      UNIQUE (manufacturer_id);
  END IF;
END $$;

-- ============================================================
-- 3. INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_manufacturer_payment_settings_manufacturer_id
  ON public.manufacturer_payment_settings(manufacturer_id);

CREATE INDEX IF NOT EXISTS idx_manufacturer_payment_settings_verified
  ON public.manufacturer_payment_settings(is_verified);

-- ============================================================
-- 4. UPDATED_AT TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_payment_settings_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_payment_settings_updated_at ON public.manufacturer_payment_settings;
CREATE TRIGGER trg_payment_settings_updated_at
  BEFORE UPDATE ON public.manufacturer_payment_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_payment_settings_updated_at();

-- ============================================================
-- 5. ENABLE RLS
-- ============================================================
ALTER TABLE public.manufacturer_payment_settings ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 6. RLS POLICIES
-- ============================================================

-- Manufacturers can read and write their own payment settings
DROP POLICY IF EXISTS "manufacturers_manage_own_payment_settings" ON public.manufacturer_payment_settings;
CREATE POLICY "manufacturers_manage_own_payment_settings"
ON public.manufacturer_payment_settings
FOR ALL
TO authenticated
USING (manufacturer_id = auth.uid())
WITH CHECK (manufacturer_id = auth.uid());

-- Admins can read all payment settings (for processing settlements)
DROP POLICY IF EXISTS "admins_read_all_payment_settings" ON public.manufacturer_payment_settings;
CREATE POLICY "admins_read_all_payment_settings"
ON public.manufacturer_payment_settings
FOR SELECT
TO authenticated
USING (
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);

-- Admins can update payment settings (for verification)
DROP POLICY IF EXISTS "admins_update_payment_settings" ON public.manufacturer_payment_settings;
CREATE POLICY "admins_update_payment_settings"
ON public.manufacturer_payment_settings
FOR UPDATE
TO authenticated
USING (
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
)
WITH CHECK (
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);
