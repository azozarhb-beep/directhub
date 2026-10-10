-- Fast-Track Approval Type Migration
-- Adds approval_type field to factory_registrations and orders tables
-- to support the fast_track_initial approval mechanism

-- ── 1. Add approval_type to factory_registrations ─────────────────────────
ALTER TABLE public.factory_registrations
  ADD COLUMN IF NOT EXISTS approval_type TEXT DEFAULT NULL;

COMMENT ON COLUMN public.factory_registrations.approval_type IS
  'Approval mechanism used: NULL = standard, fast_track_initial = quick entry for catalog population (pending full review)';

-- ── 2. Add approval_type to orders ────────────────────────────────────────
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS approval_type TEXT DEFAULT NULL;

COMMENT ON COLUMN public.orders.approval_type IS
  'Approval mechanism used: NULL = standard, fast_track_initial = quick entry for catalog population (pending full review)';

-- ── 3. Add fast_track_approved_at timestamps ──────────────────────────────
ALTER TABLE public.factory_registrations
  ADD COLUMN IF NOT EXISTS fast_track_approved_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE public.factory_registrations
  ADD COLUMN IF NOT EXISTS fast_track_approved_by UUID DEFAULT NULL;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS fast_track_approved_at TIMESTAMPTZ DEFAULT NULL;

-- ── 4. Indexes for fast-track queries ─────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_factory_registrations_approval_type
  ON public.factory_registrations (approval_type)
  WHERE approval_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_approval_type
  ON public.orders (approval_type)
  WHERE approval_type IS NOT NULL;

-- ── 5. Platform setting for fast-track mode ───────────────────────────────
INSERT INTO public.platform_settings (setting_key, setting_value, updated_at)
VALUES ('fast_track_approval_enabled', 'true', NOW())
ON CONFLICT (setting_key) DO NOTHING;
