-- Migration: Add dashboard_path to user_profiles and backfill sandbox accounts
-- Timestamp: 20261003202305

ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS dashboard_path TEXT;

-- Backfill sandbox accounts using the exact emails from SANDBOX_ACCOUNTS
UPDATE public.user_profiles SET dashboard_path = '/buyer-dashboard'                    WHERE email = 'sandbox.buyer@directhub.net';
UPDATE public.user_profiles SET dashboard_path = '/supplier/local-dashboard'           WHERE email = 'sandbox.supplier@directhub.net';
UPDATE public.user_profiles SET dashboard_path = '/manufacturer/dashboard'             WHERE email = 'sandbox.factory@directhub.net';
UPDATE public.user_profiles SET dashboard_path = '/manufacturer/international-dashboard' WHERE email = 'sandbox.intlfactory@directhub.net';
UPDATE public.user_profiles SET dashboard_path = '/agent/dashboard'                    WHERE email = 'sandbox.agent@directhub.net';
UPDATE public.user_profiles SET dashboard_path = '/logistics/dashboard'                WHERE email = 'sandbox.logistics@directhub.net';
UPDATE public.user_profiles SET dashboard_path = '/logistics/dashboard'                WHERE email = 'sandbox.logisticsoffice@directhub.net';
UPDATE public.user_profiles SET dashboard_path = '/supplier/dashboard'                 WHERE email = 'sandbox.commercialsupplier@directhub.net';
