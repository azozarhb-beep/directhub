-- ============================================================
-- Logistics module finalization
--  1) logistics_payout_requests (real withdrawal flow)
--  2) Ledger debit markers on logistics_escrow_payments
--  3) request_logistics_payout / process_logistics_payout RPCs
--  4) Registration licence review columns on logistics_partners
-- ============================================================

-- 1) PAYOUT REQUESTS TABLE
CREATE TABLE IF NOT EXISTS public.logistics_payout_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id      UUID NOT NULL REFERENCES public.logistics_partners(id) ON DELETE CASCADE,
  amount          NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  currency        TEXT NOT NULL DEFAULT 'USD',
  payout_method   TEXT NOT NULL DEFAULT 'bank_account',
  payout_details  JSONB NOT NULL DEFAULT '{}'::jsonb,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_note      TEXT,
  processed_by    UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  processed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_logistics_payout_requests_partner
  ON public.logistics_payout_requests (partner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logistics_payout_requests_status
  ON public.logistics_payout_requests (status, created_at DESC);

-- 2) LEDGER DEBIT MARKERS
ALTER TABLE public.logistics_escrow_payments
  ADD COLUMN IF NOT EXISTS payout_request_id UUID REFERENCES public.logistics_payout_requests(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS withdrawn_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_logistics_escrow_payout_request
  ON public.logistics_escrow_payments (payout_request_id);

-- 3) REGISTRATION LICENCE REVIEW COLUMNS
ALTER TABLE public.logistics_partners
  ADD COLUMN IF NOT EXISTS trade_license_review_status TEXT NOT NULL DEFAULT 'pending_review',
  ADD COLUMN IF NOT EXISTS customs_license_review_status TEXT NOT NULL DEFAULT 'pending_review',
  ADD COLUMN IF NOT EXISTS insurance_review_status TEXT NOT NULL DEFAULT 'pending_review',
  ADD COLUMN IF NOT EXISTS license_review_note TEXT,
  ADD COLUMN IF NOT EXISTS license_reviewed_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS license_reviewed_at TIMESTAMPTZ;

-- 4) FUNCTIONS (before policies)

-- Available (withdrawable) balance for a partner in a currency:
-- released & not yet withdrawn, minus amount locked in pending requests.
CREATE OR REPLACE FUNCTION public.logistics_available_balance(p_partner_id UUID, p_currency TEXT)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT SUM(ep.amount)
    FROM public.logistics_escrow_payments ep
    WHERE ep.partner_id = p_partner_id
      AND ep.payment_status = 'released'::public.logistics_payment_status
      AND ep.withdrawn_at IS NULL
      AND UPPER(ep.currency) = UPPER(p_currency)
  ), 0) - COALESCE((
    SELECT SUM(pr.amount)
    FROM public.logistics_payout_requests pr
    WHERE pr.partner_id = p_partner_id
      AND pr.status = 'pending'
      AND UPPER(pr.currency) = UPPER(p_currency)
  ), 0);
$$;

-- Partner submits a withdrawal request (validated server-side)
CREATE OR REPLACE FUNCTION public.request_logistics_payout(
  p_partner_id     UUID,
  p_amount         NUMERIC,
  p_currency       TEXT,
  p_payout_method  TEXT,
  p_payout_details JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_available NUMERIC;
  v_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.logistics_partners lp
    WHERE lp.id = p_partner_id AND lp.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized for this partner';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Invalid amount';
  END IF;

  v_available := public.logistics_available_balance(p_partner_id, p_currency);
  IF p_amount > v_available THEN
    RAISE EXCEPTION 'Amount exceeds available balance (%)', v_available;
  END IF;

  INSERT INTO public.logistics_payout_requests (
    partner_id, amount, currency, payout_method, payout_details, status
  ) VALUES (
    p_partner_id, ROUND(p_amount, 2), UPPER(p_currency),
    COALESCE(NULLIF(p_payout_method, ''), 'bank_account'),
    COALESCE(p_payout_details, '{}'::jsonb), 'pending'
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- Admin approves / rejects a payout request.
-- Approve: debits the held ledger by marking released rows as withdrawn
-- (oldest first, splitting the last row if the request is partial).
CREATE OR REPLACE FUNCTION public.process_logistics_payout(
  p_request_id UUID,
  p_decision   TEXT,
  p_note       TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.logistics_payout_requests%ROWTYPE;
  v_remaining NUMERIC;
  v_available NUMERIC;
  v_row RECORD;
  v_take NUMERIC;
  v_partner_user UUID;
BEGIN
  IF NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  IF p_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid decision';
  END IF;

  SELECT * INTO v_req
  FROM public.logistics_payout_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payout request not found';
  END IF;

  IF v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'Request already processed';
  END IF;

  IF p_decision = 'approved' THEN
    -- Released & unwithdrawn balance (pending requests are excluded from check
    -- except this one, which is the request being approved)
    SELECT COALESCE(SUM(ep.amount), 0) INTO v_available
    FROM public.logistics_escrow_payments ep
    WHERE ep.partner_id = v_req.partner_id
      AND ep.payment_status = 'released'::public.logistics_payment_status
      AND ep.withdrawn_at IS NULL
      AND UPPER(ep.currency) = UPPER(v_req.currency);

    IF v_available < v_req.amount THEN
      RAISE EXCEPTION 'Insufficient released balance (%)', v_available;
    END IF;

    v_remaining := v_req.amount;

    FOR v_row IN
      SELECT ep.id, ep.amount
      FROM public.logistics_escrow_payments ep
      WHERE ep.partner_id = v_req.partner_id
        AND ep.payment_status = 'released'::public.logistics_payment_status
        AND ep.withdrawn_at IS NULL
        AND UPPER(ep.currency) = UPPER(v_req.currency)
      ORDER BY ep.released_at NULLS LAST, ep.created_at
      FOR UPDATE
    LOOP
      EXIT WHEN v_remaining <= 0;
      v_take := LEAST(v_row.amount, v_remaining);

      IF v_take < v_row.amount THEN
        -- Split: keep remainder as an unwithdrawn released row
        INSERT INTO public.logistics_escrow_payments (
          order_id, buyer_id, partner_id, amount, currency, payment_status,
          escrow_held_at, released_at, release_condition, admin_note
        )
        SELECT order_id, buyer_id, partner_id, (v_row.amount - v_take), currency,
               payment_status, escrow_held_at, released_at, release_condition,
               'Remainder after partial payout ' || v_req.id::text
        FROM public.logistics_escrow_payments
        WHERE id = v_row.id;

        UPDATE public.logistics_escrow_payments
        SET amount = v_take,
            withdrawn_at = now(),
            payout_request_id = v_req.id
        WHERE id = v_row.id;
      ELSE
        UPDATE public.logistics_escrow_payments
        SET withdrawn_at = now(),
            payout_request_id = v_req.id
        WHERE id = v_row.id;
      END IF;

      v_remaining := v_remaining - v_take;
    END LOOP;
  END IF;

  UPDATE public.logistics_payout_requests
  SET status = p_decision,
      admin_note = p_note,
      processed_by = auth.uid(),
      processed_at = now()
  WHERE id = v_req.id;

  -- Notify the partner (best-effort; ignore if notification schema differs)
  BEGIN
    SELECT lp.user_id INTO v_partner_user
    FROM public.logistics_partners lp WHERE lp.id = v_req.partner_id;

    IF v_partner_user IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, type)
      VALUES (
        v_partner_user,
        CASE WHEN p_decision = 'approved' THEN 'تمت الموافقة على طلب السحب' ELSE 'تم رفض طلب السحب' END,
        CASE WHEN p_decision = 'approved'
             THEN 'تمت الموافقة على سحب ' || v_req.amount::text || ' ' || v_req.currency
             ELSE 'تم رفض طلب سحب ' || v_req.amount::text || ' ' || v_req.currency || COALESCE(' - ' || p_note, '') END,
        'system'
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN p_decision;
END;
$$;

GRANT EXECUTE ON FUNCTION public.logistics_available_balance(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_logistics_payout(UUID, NUMERIC, TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_logistics_payout(UUID, TEXT, TEXT) TO authenticated;

-- 5) RLS
ALTER TABLE public.logistics_payout_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "partners_view_own_logistics_payout_requests" ON public.logistics_payout_requests;
CREATE POLICY "partners_view_own_logistics_payout_requests"
ON public.logistics_payout_requests
FOR SELECT
TO authenticated
USING (
  partner_id IN (SELECT id FROM public.logistics_partners WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "admin_full_access_logistics_payout_requests" ON public.logistics_payout_requests;
CREATE POLICY "admin_full_access_logistics_payout_requests"
ON public.logistics_payout_requests
FOR ALL
TO authenticated
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

-- Partners may read their own escrow rows (needed for balance); keep existing policies.
DROP POLICY IF EXISTS "partners_view_own_logistics_escrow_rows" ON public.logistics_escrow_payments;
CREATE POLICY "partners_view_own_logistics_escrow_rows"
ON public.logistics_escrow_payments
FOR SELECT
TO authenticated
USING (
  partner_id IN (SELECT id FROM public.logistics_partners WHERE user_id = auth.uid())
);

-- 6) REALTIME
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'logistics_payout_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.logistics_payout_requests;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
