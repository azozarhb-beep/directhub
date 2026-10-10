-- ============================================================
-- DirectHub: Checkout Security + Order Tracking Enhancement
-- Migration: 20260930200000_checkout_security_order_tracking.sql
-- ============================================================

-- ── 1. Order Tracking Events Table ──────────────────────────────────────────
-- Granular tracking events for real-time order status updates
CREATE TABLE IF NOT EXISTS public.order_tracking_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  event_type    TEXT NOT NULL,
  title         TEXT NOT NULL,
  description   TEXT,
  actor_role    TEXT DEFAULT 'system',
  actor_id      UUID REFERENCES auth.users(id),
  metadata      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast order lookups
CREATE INDEX IF NOT EXISTS idx_order_tracking_events_order_id
  ON public.order_tracking_events(order_id, created_at DESC);

-- ── 2. RLS Policies ─────────────────────────────────────────────────────────
ALTER TABLE public.order_tracking_events ENABLE ROW LEVEL SECURITY;

-- Buyers can read their own order tracking events
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'order_tracking_events'
      AND policyname = 'buyer_read_own_tracking_events'
  ) THEN
    CREATE POLICY buyer_read_own_tracking_events
      ON public.order_tracking_events
      FOR SELECT
      USING (
        order_id IN (
          SELECT id FROM public.orders WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Factory/admin can insert tracking events
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'order_tracking_events'
      AND policyname = 'authenticated_insert_tracking_events'
  ) THEN
    CREATE POLICY authenticated_insert_tracking_events
      ON public.order_tracking_events
      FOR INSERT
      WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- Admin can read all tracking events
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'order_tracking_events'
      AND policyname = 'admin_read_all_tracking_events'
  ) THEN
    CREATE POLICY admin_read_all_tracking_events
      ON public.order_tracking_events
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.user_profiles
          WHERE id = auth.uid() AND role = 'admin'
        )
      );
  END IF;
END $$;

-- ── 3. Enable Realtime on order_tracking_events ──────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND tablename = 'order_tracking_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.order_tracking_events;
  END IF;
END $$;

-- ── 4. Add security_signature_verified column to orders ─────────────────────
-- Tracks whether the checkout request was HMAC-signed
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders'
      AND column_name = 'security_signature_verified'
  ) THEN
    ALTER TABLE public.orders
      ADD COLUMN security_signature_verified BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- ── 5. Add YER currency support to order_invoices ───────────────────────────
-- Ensure currency column supports YER (Yemeni Rial) — no constraint needed,
-- it's already a TEXT column. Just add a comment for documentation.
COMMENT ON COLUMN public.order_invoices.currency IS
  'ISO 4217 currency code. Supported: YER (Yemeni Rial), USD, SAR, AED, EUR, GBP, CNY, TRY, OMR, KWD, QAR';
