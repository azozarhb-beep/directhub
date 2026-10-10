-- Add international e-wallet fields to manufacturer_payment_settings
ALTER TABLE public.manufacturer_payment_settings
  ADD COLUMN IF NOT EXISTS payoneer_email TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS payoneer_account_id TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS payoneer_account_name TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS wise_email TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS wise_account_id TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS wise_account_name TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS wise_currency TEXT DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS usdt_wallet_address TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS usdt_network TEXT DEFAULT 'TRC20',
  ADD COLUMN IF NOT EXISTS usdt_account_name TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS paypal_email TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS paypal_account_name TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS international_wallet_type TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS international_wallet_verified BOOLEAN DEFAULT FALSE;
