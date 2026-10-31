-- Supplier payout (withdrawal) requests for the /supplier Finance & Profits module

CREATE TABLE IF NOT EXISTS public.supplier_payout_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'YER',
  bank_account_id UUID REFERENCES public.factory_bank_accounts(id) ON DELETE SET NULL,
  reference TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending_review',
  admin_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_supplier_payout_requests_supplier_id
  ON public.supplier_payout_requests(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_payout_requests_status
  ON public.supplier_payout_requests(status);

ALTER TABLE public.supplier_payout_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "supplier_select_own_payout_requests" ON public.supplier_payout_requests;
CREATE POLICY "supplier_select_own_payout_requests"
ON public.supplier_payout_requests
FOR SELECT
TO authenticated
USING (supplier_id = auth.uid());

DROP POLICY IF EXISTS "supplier_insert_own_payout_requests" ON public.supplier_payout_requests;
CREATE POLICY "supplier_insert_own_payout_requests"
ON public.supplier_payout_requests
FOR INSERT
TO authenticated
WITH CHECK (supplier_id = auth.uid() AND status = 'pending_review');
