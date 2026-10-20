-- manufacturer_bank_accounts: bank accounts submitted by manufacturers (international room)

CREATE TABLE IF NOT EXISTS public.manufacturer_bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  manufacturer_id UUID,
  account_category TEXT,
  account_type TEXT,
  custom_label TEXT,
  account_type_label TEXT,
  account_holder_name TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  iban TEXT,
  swift_bic TEXT,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'pending_review',
  admin_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Keep owner/category/label columns in sync (app writes manufacturer_id/account_type/account_type_label)
CREATE OR REPLACE FUNCTION public.sync_manufacturer_bank_account_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $fn$
BEGIN
  NEW.user_id := COALESCE(NEW.user_id, NEW.manufacturer_id);
  NEW.manufacturer_id := COALESCE(NEW.manufacturer_id, NEW.user_id);
  NEW.account_category := COALESCE(NEW.account_category, NEW.account_type);
  NEW.account_type := COALESCE(NEW.account_type, NEW.account_category);
  NEW.custom_label := COALESCE(NULLIF(NEW.custom_label, ''), NEW.account_type_label);
  NEW.account_type_label := COALESCE(NULLIF(NEW.account_type_label, ''), NEW.custom_label);
  NEW.updated_at := CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$fn$;

CREATE INDEX IF NOT EXISTS idx_manufacturer_bank_accounts_user_id ON public.manufacturer_bank_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_manufacturer_bank_accounts_manufacturer_id ON public.manufacturer_bank_accounts(manufacturer_id);
CREATE INDEX IF NOT EXISTS idx_manufacturer_bank_accounts_status ON public.manufacturer_bank_accounts(status);

ALTER TABLE public.manufacturer_bank_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mba_select_own_or_admin" ON public.manufacturer_bank_accounts;
CREATE POLICY "mba_select_own_or_admin"
  ON public.manufacturer_bank_accounts
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR manufacturer_id = auth.uid() OR public.is_admin_user());

DROP POLICY IF EXISTS "mba_insert_own" ON public.manufacturer_bank_accounts;
CREATE POLICY "mba_insert_own"
  ON public.manufacturer_bank_accounts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (COALESCE(user_id, manufacturer_id) = auth.uid() AND status = 'pending_review')
    OR public.is_admin_user()
  );

DROP POLICY IF EXISTS "mba_update_admin_or_own_pending" ON public.manufacturer_bank_accounts;
CREATE POLICY "mba_update_admin_or_own_pending"
  ON public.manufacturer_bank_accounts
  FOR UPDATE
  TO authenticated
  USING (
    ((user_id = auth.uid() OR manufacturer_id = auth.uid()) AND status = 'pending_review')
    OR public.is_admin_user()
  )
  WITH CHECK (
    ((user_id = auth.uid() OR manufacturer_id = auth.uid()) AND status = 'pending_review')
    OR public.is_admin_user()
  );

DROP POLICY IF EXISTS "mba_delete_own_pending" ON public.manufacturer_bank_accounts;
CREATE POLICY "mba_delete_own_pending"
  ON public.manufacturer_bank_accounts
  FOR DELETE
  TO authenticated
  USING (
    ((user_id = auth.uid() OR manufacturer_id = auth.uid()) AND status = 'pending_review')
    OR public.is_admin_user()
  );

DROP TRIGGER IF EXISTS trg_sync_manufacturer_bank_account_columns ON public.manufacturer_bank_accounts;
CREATE TRIGGER trg_sync_manufacturer_bank_account_columns
  BEFORE INSERT OR UPDATE ON public.manufacturer_bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.sync_manufacturer_bank_account_columns();
