-- ============================================================
-- Unlock product_listing for sandbox factory accounts
-- Fix Option 1: Immediate unlock via migration
-- ============================================================

UPDATE public.factory_registrations
SET product_listing_unlocked = true
WHERE user_id IN (
  SELECT id FROM auth.users WHERE email IN (
    'sandbox.factory@directhub.net',
    'sandbox.intlfactory@directhub.net'
  )
);
