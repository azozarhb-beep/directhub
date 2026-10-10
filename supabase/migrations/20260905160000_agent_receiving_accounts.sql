-- ─── Agent Receiving & Collection Accounts ───────────────────────────────────
-- Stores bank accounts, mobile wallets, and collection transfer details
-- linked to each factory/supplier registered by an agent.

-- 1. Create table
CREATE TABLE IF NOT EXISTS public.agent_receiving_accounts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id          UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  factory_id        UUID NOT NULL REFERENCES public.agent_factory_registrations(id) ON DELETE CASCADE,

  -- Account type: bank_account | mobile_wallet | collection_transfer
  account_type      TEXT NOT NULL DEFAULT 'bank_account',

  -- Common fields
  account_label     TEXT NOT NULL,           -- e.g. "الحساب الرئيسي", "محفظة كريمي"
  account_holder    TEXT NOT NULL,           -- Name of account holder
  currency          TEXT NOT NULL DEFAULT 'YER',

  -- Bank account fields
  bank_name         TEXT,
  bank_branch       TEXT,
  account_number    TEXT,
  iban              TEXT,
  swift_code        TEXT,

  -- Mobile wallet fields (e.g. Kuraimi Bank, SabaFon, MTN)
  wallet_provider   TEXT,                   -- e.g. "بنك كريمي", "سبأفون", "MTN"
  wallet_phone      TEXT,

  -- Collection transfer fields
  transfer_details  TEXT,

  -- Notes
  notes             TEXT,

  -- Status
  is_primary        BOOLEAN NOT NULL DEFAULT false,
  is_active         BOOLEAN NOT NULL DEFAULT true,

  created_at        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_agent_receiving_accounts_agent_id
  ON public.agent_receiving_accounts(agent_id);

CREATE INDEX IF NOT EXISTS idx_agent_receiving_accounts_factory_id
  ON public.agent_receiving_accounts(factory_id);

-- 3. Enable RLS
ALTER TABLE public.agent_receiving_accounts ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
DROP POLICY IF EXISTS "agents_manage_own_receiving_accounts" ON public.agent_receiving_accounts;
CREATE POLICY "agents_manage_own_receiving_accounts"
  ON public.agent_receiving_accounts
  FOR ALL
  TO authenticated
  USING (agent_id = auth.uid())
  WITH CHECK (agent_id = auth.uid());

-- 5. Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_agent_receiving_accounts_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_agent_receiving_accounts_updated_at ON public.agent_receiving_accounts;
CREATE TRIGGER trg_agent_receiving_accounts_updated_at
  BEFORE UPDATE ON public.agent_receiving_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_agent_receiving_accounts_updated_at();
