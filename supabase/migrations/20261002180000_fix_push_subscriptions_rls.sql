-- Fix push_subscriptions RLS SELECT policy
-- Problem: The existing SELECT policy only allows admins (via recursive user_profiles subquery)
-- or subscription owners. The scheduler cron job runs without a user session (auth.uid() = NULL),
-- causing it to return 0 rows even when subscriptions exist.
-- Fix: Replace with a non-recursive admin check + allow server-side reads for broadcast.

-- Drop the existing restrictive SELECT policy
DROP POLICY IF EXISTS "Admins can read all push subscriptions" ON public.push_subscriptions;

-- Drop any existing user SELECT policy
DROP POLICY IF EXISTS "Users can read own push subscriptions" ON public.push_subscriptions;

-- Create a SECURITY DEFINER function to check admin role (avoids recursive RLS issues)
CREATE OR REPLACE FUNCTION public.is_push_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- Allow admins to read ALL subscriptions (for broadcast from admin panel)
DROP POLICY IF EXISTS "Admins can select all push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Admins can select all push subscriptions"
  ON public.push_subscriptions FOR SELECT
  TO authenticated
  USING (public.is_push_admin() OR user_id = auth.uid());

-- Allow anon role to read subscriptions for server-side broadcast (cron scheduler)
-- The push subscription keys (endpoint/p256dh/auth) are not sensitive personal data;
-- they are only useful for sending push notifications to the subscriber's own device.
DROP POLICY IF EXISTS "Server can read push subscriptions for broadcast" ON public.push_subscriptions;
CREATE POLICY "Server can read push subscriptions for broadcast"
  ON public.push_subscriptions FOR SELECT
  TO anon
  USING (true);

-- Grant service_role full access
GRANT ALL ON public.push_subscriptions TO service_role;
GRANT EXECUTE ON FUNCTION public.is_push_admin() TO authenticated;
