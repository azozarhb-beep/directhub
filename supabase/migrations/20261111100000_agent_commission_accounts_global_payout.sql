-- Global payout support for field agent commission accounts
ALTER TABLE public.agent_commission_accounts
  ADD COLUMN IF NOT EXISTS country TEXT,
  ADD COLUMN IF NOT EXISTS recipient_name TEXT,
  ADD COLUMN IF NOT EXISTS recipient_city TEXT,
  ADD COLUMN IF NOT EXISTS recipient_phone TEXT,
  ADD COLUMN IF NOT EXISTS transfer_network TEXT;

ALTER TABLE public.agent_commission_accounts
  ALTER COLUMN currency SET DEFAULT 'USD';
