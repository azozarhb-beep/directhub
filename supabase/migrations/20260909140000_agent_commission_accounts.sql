-- ─── Agent Commission Payout Accounts ───────────────────────────────────────
-- Representative-level financial accounts for receiving 20% commission in YER.
-- These are NOT factory-linked (unlike agent_receiving_accounts).
-- Each agent can register one or more personal payout accounts.

-- 1. Create table
CREATE TABLE IF NOT EXISTS public.agent_commission_accounts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id          UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,

  -- Account type: bank_account | mobile_wallet | collection_transfer
  account_type      TEXT NOT NULL DEFAULT 'bank_account',

  -- Common fields
  account_label     TEXT NOT NULL,           -- e.g. "الحساب الرئيسي", "محفظة كريمي"
  account_holder    TEXT NOT NULL,           -- Full name of account holder
  currency          TEXT NOT NULL DEFAULT 'YER',

  -- Bank account fields
  bank_name         TEXT,
  bank_branch       TEXT,
  account_number    TEXT,
  iban              TEXT,
  swift_code        TEXT,

  -- Mobile wallet fields (e.g. Kuraimi Bank, SabaFon, MTN)
  wallet_provider   TEXT,
  wallet_phone      TEXT,

  -- Collection transfer fields
  transfer_details  TEXT,

  -- Notes
  notes             TEXT,

  -- Status
  is_primary        BOOLEAN NOT NULL DEFAULT false,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  is_verified       BOOLEAN NOT NULL DEFAULT false,  -- Admin can mark as verified
  verified_at       TIMESTAMPTZ,
  verified_by       UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,

  created_at        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_agent_commission_accounts_agent_id
  ON public.agent_commission_accounts(agent_id);

CREATE INDEX IF NOT EXISTS idx_agent_commission_accounts_is_primary
  ON public.agent_commission_accounts(agent_id, is_primary);

-- 3. Enable RLS
ALTER TABLE public.agent_commission_accounts ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
DROP POLICY IF EXISTS "agents_manage_own_commission_accounts" ON public.agent_commission_accounts;
CREATE POLICY "agents_manage_own_commission_accounts"
  ON public.agent_commission_accounts
  FOR ALL
  TO authenticated
  USING (agent_id = auth.uid())
  WITH CHECK (agent_id = auth.uid());

DROP POLICY IF EXISTS "admin_view_all_commission_accounts" ON public.agent_commission_accounts;
CREATE POLICY "admin_view_all_commission_accounts"
  ON public.agent_commission_accounts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users au
      WHERE au.id = auth.uid()
      AND (au.raw_user_meta_data->>'role' = 'admin' OR au.raw_app_meta_data->>'role' = 'admin')
    )
  );

-- 5. Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_agent_commission_accounts_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_agent_commission_accounts_updated_at ON public.agent_commission_accounts;
CREATE TRIGGER trg_agent_commission_accounts_updated_at
  BEFORE UPDATE ON public.agent_commission_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_agent_commission_accounts_updated_at();
