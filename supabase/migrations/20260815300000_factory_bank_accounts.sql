-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: factory_bank_accounts
-- Multi-Bank Account Management for Factories with Admin Approval Workflow
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. ENUM: account type classification
DROP TYPE IF EXISTS public.bank_account_type CASCADE;
CREATE TYPE public.bank_account_type AS ENUM (
  'local_collection',
  'international_supply',
  'local_general',
  'international_general'
);

-- 2. ENUM: approval status
DROP TYPE IF EXISTS public.bank_account_status CASCADE;
CREATE TYPE public.bank_account_status AS ENUM (
  'pending_review',
  'approved',
  'rejected'
);

-- 3. TABLE: factory_bank_accounts
CREATE TABLE IF NOT EXISTS public.factory_bank_accounts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manufacturer_id     UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  account_holder_name TEXT NOT NULL,
  bank_name           TEXT NOT NULL,
  account_number      TEXT NOT NULL,
  iban                TEXT,
  swift_bic           TEXT,
  currency            TEXT NOT NULL DEFAULT 'SAR',
  account_type        public.bank_account_type NOT NULL DEFAULT 'local_collection',
  account_type_label  TEXT,
  status              public.bank_account_status NOT NULL DEFAULT 'pending_review',
  admin_note          TEXT,
  reviewed_by         UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  reviewed_at         TIMESTAMPTZ,
  is_primary          BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. INDEXES
CREATE INDEX IF NOT EXISTS idx_factory_bank_accounts_manufacturer_id
  ON public.factory_bank_accounts(manufacturer_id);

CREATE INDEX IF NOT EXISTS idx_factory_bank_accounts_status
  ON public.factory_bank_accounts(status);

-- 5. FUNCTION: auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_factory_bank_accounts_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 6. FUNCTION: check admin role (safe — does NOT query user_profiles to avoid recursion)
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
  );
$$;

-- 7. FUNCTION: check if user is manufacturer owner of account
CREATE OR REPLACE FUNCTION public.is_bank_account_owner(account_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.factory_bank_accounts fba
    WHERE fba.id = account_id
      AND fba.manufacturer_id = auth.uid()
  );
$$;

-- 8. ENABLE RLS
ALTER TABLE public.factory_bank_accounts ENABLE ROW LEVEL SECURITY;

-- 9. RLS POLICIES

-- Manufacturers can view their own accounts
DROP POLICY IF EXISTS "manufacturers_view_own_bank_accounts" ON public.factory_bank_accounts;
CREATE POLICY "manufacturers_view_own_bank_accounts"
  ON public.factory_bank_accounts
  FOR SELECT
  TO authenticated
  USING (manufacturer_id = auth.uid() OR public.is_admin_user());

-- Manufacturers can insert their own accounts
DROP POLICY IF EXISTS "manufacturers_insert_own_bank_accounts" ON public.factory_bank_accounts;
CREATE POLICY "manufacturers_insert_own_bank_accounts"
  ON public.factory_bank_accounts
  FOR INSERT
  TO authenticated
  WITH CHECK (manufacturer_id = auth.uid());

-- Manufacturers can update their own PENDING accounts only (not approved/rejected)
DROP POLICY IF EXISTS "manufacturers_update_pending_bank_accounts" ON public.factory_bank_accounts;
CREATE POLICY "manufacturers_update_pending_bank_accounts"
  ON public.factory_bank_accounts
  FOR UPDATE
  TO authenticated
  USING (
    (manufacturer_id = auth.uid() AND status = 'pending_review')
    OR public.is_admin_user()
  )
  WITH CHECK (
    (manufacturer_id = auth.uid() AND status = 'pending_review')
    OR public.is_admin_user()
  );

-- Manufacturers can delete their own PENDING accounts
DROP POLICY IF EXISTS "manufacturers_delete_pending_bank_accounts" ON public.factory_bank_accounts;
CREATE POLICY "manufacturers_delete_pending_bank_accounts"
  ON public.factory_bank_accounts
  FOR DELETE
  TO authenticated
  USING (
    (manufacturer_id = auth.uid() AND status = 'pending_review')
    OR public.is_admin_user()
  );

-- 10. TRIGGER: updated_at
DROP TRIGGER IF EXISTS trg_factory_bank_accounts_updated_at ON public.factory_bank_accounts;
CREATE TRIGGER trg_factory_bank_accounts_updated_at
  BEFORE UPDATE ON public.factory_bank_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_factory_bank_accounts_updated_at();

-- 11. Add selected_bank_account_id column to admin_payout_approvals if not exists
ALTER TABLE public.admin_payout_approvals
  ADD COLUMN IF NOT EXISTS selected_bank_account_id UUID REFERENCES public.factory_bank_accounts(id) ON DELETE SET NULL;
