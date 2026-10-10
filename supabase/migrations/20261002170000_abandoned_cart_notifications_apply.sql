-- Abandoned Cart Notifications System (Apply Migration)
-- Creates the tracking table if it doesn't already exist.

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

-- Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_abandoned_cart_notifications_user_id
  ON public.abandoned_cart_notifications(user_id);

CREATE INDEX IF NOT EXISTS idx_abandoned_cart_notifications_notified_at
  ON public.abandoned_cart_notifications(notified_at DESC);

-- Enable RLS
ALTER TABLE public.abandoned_cart_notifications ENABLE ROW LEVEL SECURITY;

-- Admin full access policy
DROP POLICY IF EXISTS "admin_full_access_abandoned_cart_notifications" ON public.abandoned_cart_notifications;
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

-- Service role bypass for cron/API routes
DROP POLICY IF EXISTS "service_role_bypass_abandoned_cart" ON public.abandoned_cart_notifications;
CREATE POLICY service_role_bypass_abandoned_cart
  ON public.abandoned_cart_notifications
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
