-- Migration: Fix dashboard_path for commercial_supplier sandbox account
-- Timestamp: 20261004134107

UPDATE public.user_profiles
SET dashboard_path = '/supplier/local-dashboard'
WHERE email = 'sandbox.commercialsupplier@directhub.net';
