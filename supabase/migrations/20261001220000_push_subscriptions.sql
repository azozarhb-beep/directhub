-- Push subscriptions table for Web Push API
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT,
  auth TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast user-based lookups
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint ON public.push_subscriptions(endpoint);

-- Enable RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can manage their own subscriptions
CREATE POLICY "Users can insert own push subscriptions"
  ON public.push_subscriptions FOR INSERT
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Users can update own push subscriptions"
  ON public.push_subscriptions FOR UPDATE
  USING (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Users can delete own push subscriptions"
  ON public.push_subscriptions FOR DELETE
  USING (user_id = auth.uid() OR user_id IS NULL);

-- Admins can read all subscriptions (needed for broadcast)
CREATE POLICY "Admins can read all push subscriptions"
  ON public.push_subscriptions FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM public.user_profiles WHERE role = 'admin'
    )
    OR user_id = auth.uid()
  );

-- Admins can delete expired subscriptions
CREATE POLICY "Admins can delete push subscriptions"
  ON public.push_subscriptions FOR DELETE
  USING (
    auth.uid() IN (
      SELECT id FROM public.user_profiles WHERE role = 'admin'
    )
  );
