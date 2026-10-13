-- Migration: Add payout method types to logistics partners
-- Timestamp: 20261013200000

-- ─── 1. Add new columns to factory_bank_accounts (for manufacturers) ─────────

ALTER TABLE public.factory_bank_accounts
  ADD COLUMN IF NOT EXISTS payout_type TEXT DEFAULT 'bank_account',
  ADD COLUMN IF NOT EXISTS card_number_masked TEXT,
  ADD COLUMN IF NOT EXISTS card_holder_name TEXT,
  ADD COLUMN IF NOT EXISTS card_expiry TEXT,
  ADD COLUMN IF NOT EXISTS card_issuing_bank TEXT,
  ADD COLUMN IF NOT EXISTS wallet_provider TEXT,
  ADD COLUMN IF NOT EXISTS wallet_phone TEXT,
  ADD COLUMN IF NOT EXISTS wallet_owner_name TEXT,
  ADD COLUMN IF NOT EXISTS remittance_network TEXT,
  ADD COLUMN IF NOT EXISTS remittance_recipient_name TEXT,
  ADD COLUMN IF NOT EXISTS remittance_phone TEXT,
  ADD COLUMN IF NOT EXISTS remittance_city TEXT;

-- ─── 2. Create logistics_payout_methods table for logistics partners ──────────

CREATE TABLE IF NOT EXISTS public.logistics_payout_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES public.logistics_partners(id) ON DELETE CASCADE,
  payout_type TEXT NOT NULL DEFAULT 'bank_account',

  -- Bank Account fields
  bank_name TEXT,
  account_number TEXT,
  iban TEXT,
  beneficiary_name TEXT,

  -- Card fields
  card_number_masked TEXT,
  card_holder_name TEXT,
  card_expiry TEXT,
  card_issuing_bank TEXT,

  -- E-Wallet fields
  wallet_provider TEXT,
  wallet_phone TEXT,
  wallet_owner_name TEXT,

  -- Cash Remittance fields
  remittance_network TEXT,
  remittance_recipient_name TEXT,
  remittance_phone TEXT,
  remittance_city TEXT,

  is_primary BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'pending_review',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 3. Index ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_logistics_payout_methods_partner_id
  ON public.logistics_payout_methods(partner_id);

-- ─── 4. Enable RLS ────────────────────────────────────────────────────────────

ALTER TABLE public.logistics_payout_methods ENABLE ROW LEVEL SECURITY;

-- ─── 5. RLS Policies ─────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "logistics_partners_manage_own_payout_methods" ON public.logistics_payout_methods;
CREATE POLICY "logistics_partners_manage_own_payout_methods"
ON public.logistics_payout_methods
FOR ALL
TO authenticated
USING (
  partner_id IN (
    SELECT id FROM public.logistics_partners WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  partner_id IN (
    SELECT id FROM public.logistics_partners WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "admin_manage_all_logistics_payout_methods" ON public.logistics_payout_methods;
CREATE POLICY "admin_manage_all_logistics_payout_methods"
ON public.logistics_payout_methods
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);
