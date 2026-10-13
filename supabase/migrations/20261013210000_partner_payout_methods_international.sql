-- Migration: Add international SWIFT wire transfer fields to logistics_payout_methods
-- Timestamp: 20261013210000

-- ─── 1. Add new columns to logistics_payout_methods ──────────────────────────

ALTER TABLE public.logistics_payout_methods
  ADD COLUMN IF NOT EXISTS payout_category TEXT DEFAULT 'local_bank',
  ADD COLUMN IF NOT EXISTS swift_code TEXT,
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS branch_city TEXT,
  ADD COLUMN IF NOT EXISTS wallet_phone TEXT,
  ADD COLUMN IF NOT EXISTS remittance_network TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT;

-- Note: beneficiary_name, bank_name, iban, wallet_provider already exist from previous migration

-- ─── 2. Add comment for documentation ────────────────────────────────────────

COMMENT ON COLUMN public.logistics_payout_methods.payout_category IS
  'Values: international_swift, local_bank, e_wallet, cash_remittance, card';

COMMENT ON COLUMN public.logistics_payout_methods.swift_code IS
  'SWIFT/BIC code for international wire transfers (8-11 chars)';

COMMENT ON COLUMN public.logistics_payout_methods.currency IS
  'Account currency: USD, EUR, etc.';

COMMENT ON COLUMN public.logistics_payout_methods.country IS
  'Partner headquarters country code or name';
