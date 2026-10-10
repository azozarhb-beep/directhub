-- Migration: Escrow Release Code Workflow
-- Timestamp: 20260820160000
-- Adds: ready_for_inspection status, release_code column, readiness notification tracking

-- ============================================================
-- 1. ADD NEW COLUMNS TO ORDERS TABLE
-- ============================================================
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS release_code TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS release_code_generated_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS release_code_used_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ready_for_inspection_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS buyer_inspection_notified_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS escrow_released_by_code_at TIMESTAMPTZ DEFAULT NULL;

-- ============================================================
-- 2. BACKFILL release_code FOR EXISTING ORDERS THAT HAVE funds_secured
--    (generate a 6-digit code for any order that already has funds_secured
--     but no release_code yet, so the workflow can proceed)
-- ============================================================
DO $$
BEGIN
  UPDATE public.orders
  SET
    release_code = LPAD(FLOOR(RANDOM() * 900000 + 100000)::TEXT, 6, '0'),
    release_code_generated_at = CURRENT_TIMESTAMP
  WHERE
    release_code IS NULL
    AND escrow_status IN ('funds_secured', 'shipped', 'pending_otp_confirmation', 'pending_admin_payout');
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Backfill release_code skipped: %', SQLERRM;
END $$;

-- ============================================================
-- 3. FUNCTION: generate_order_release_code
--    Called when payment is verified and funds are secured.
--    Generates a unique 6-digit release code for the order.
-- ============================================================
CREATE OR REPLACE FUNCTION public.generate_order_release_code(p_order_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_code TEXT;
  v_exists BOOLEAN;
BEGIN
  -- Generate a unique 6-digit code
  LOOP
    v_code := LPAD(FLOOR(RANDOM() * 900000 + 100000)::TEXT, 6, '0');
    SELECT EXISTS(
      SELECT 1 FROM public.orders
      WHERE release_code = v_code
        AND escrow_status NOT IN ('funds_released', 'refund_processed', 'cancelled')
    ) INTO v_exists;
    EXIT WHEN NOT v_exists;
  END LOOP;

  -- Store the code on the order
  UPDATE public.orders
  SET
    release_code = v_code,
    release_code_generated_at = CURRENT_TIMESTAMP
  WHERE id = p_order_id AND release_code IS NULL;

  RETURN v_code;
END;
$$;

-- ============================================================
-- 4. INDEX for fast release_code lookups
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_orders_release_code ON public.orders(release_code)
  WHERE release_code IS NOT NULL;
