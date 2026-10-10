-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Factory Onboarding Mode Setting
-- Adds the factory_onboarding_mode key to platform_settings.
-- Default: 'soft' (Soft Onboarding — frictionless, optional documents)
-- Can be switched to 'strict' (Strict Verification — mandatory trade license)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.platform_settings (setting_key, setting_value, updated_at)
VALUES ('factory_onboarding_mode', 'soft', NOW())
ON CONFLICT (setting_key) DO NOTHING;
