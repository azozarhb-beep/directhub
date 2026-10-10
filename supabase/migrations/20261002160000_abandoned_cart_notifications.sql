-- Abandoned Cart Notifications System
-- Tracks which users have been notified about their abandoned carts
-- to avoid sending duplicate notifications within the same 6-hour window.

CREATE TABLE IF NOT EXISTS public.abandoned_cart_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cart_item_count INT NOT NULL DEFAULT 0,
  product_names TEXT,
  sent_count INT NOT NULL DEFAULT 0,
  failed_count INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'no_subscription')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookup by user and time
CREATE INDEX IF NOT EXISTS idx_abandoned_cart_notifications_user_id
  ON public.abandoned_cart_notifications(user_id);

CREATE INDEX IF NOT EXISTS idx_abandoned_cart_notifications_notified_at
  ON public.abandoned_cart_notifications(notified_at DESC);

-- RLS
ALTER TABLE public.abandoned_cart_notifications ENABLE ROW LEVEL SECURITY;

-- Only admins can read/write
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'abandoned_cart_notifications'
      AND policyname = 'admin_full_access_abandoned_cart_notifications'
  ) THEN
    CREATE POLICY admin_full_access_abandoned_cart_notifications
      ON public.abandoned_cart_notifications
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.user_profiles
          WHERE id = auth.uid() AND role = 'admin'
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.user_profiles
          WHERE id = auth.uid() AND role = 'admin'
        )
      );
  END IF;
END $$;

-- Service role bypass (for cron/API routes)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'abandoned_cart_notifications'
      AND policyname = 'service_role_bypass_abandoned_cart'
  ) THEN
    CREATE POLICY service_role_bypass_abandoned_cart
      ON public.abandoned_cart_notifications
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
