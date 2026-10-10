-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Staged Approval System
-- Adds initial_auto_launch_batch and require_supplier_approval settings
-- Uses the existing key-value platform_settings pattern
-- ─────────────────────────────────────────────────────────────────────────────

-- Insert default platform settings for staged approval (idempotent)
INSERT INTO public.platform_settings (setting_key, setting_value, description)
VALUES
  ('initial_auto_launch_batch', 'true',  'When true, new products and suppliers are auto-approved during platform launch. When false, all submissions go to the Approval Queue as Pending.'),
  ('require_supplier_approval', 'false', 'When true and initial_auto_launch_batch is false, new supplier registrations require explicit Admin approval before activation.')
ON CONFLICT (setting_key) DO NOTHING;
