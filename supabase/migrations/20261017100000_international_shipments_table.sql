-- ============================================================
-- Migration: international_shipments
-- Dedicated table for manually-entered international shipments
-- (FCL / LCL / Air) with container, port and free-time fields.
-- Idempotent: creates the table if missing and adds any missing
-- columns if a table with this name already exists.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.international_shipments (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_number      TEXT NOT NULL,
  bl_number            TEXT,
  transport_type       TEXT DEFAULT 'FCL',
  origin_port          TEXT,
  destination_port     TEXT,
  carrier              TEXT,
  etd                  DATE,
  eta                  DATE,
  container_number     TEXT,
  container_type       TEXT,
  shipping_line        TEXT,
  port_country         TEXT,
  port_name            TEXT,
  port_role            TEXT,
  vessel_arrival_date  DATE,
  free_time_days       INTEGER DEFAULT 14,
  daily_demurrage_fee  NUMERIC DEFAULT 0,
  currency             TEXT DEFAULT 'USD',
  notes                TEXT,
  status               TEXT DEFAULT 'In Transit',
  created_at           TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- Ensure an existing table matches the required shape
ALTER TABLE public.international_shipments
  ADD COLUMN IF NOT EXISTS tracking_number     TEXT,
  ADD COLUMN IF NOT EXISTS bl_number           TEXT,
  ADD COLUMN IF NOT EXISTS transport_type      TEXT DEFAULT 'FCL',
  ADD COLUMN IF NOT EXISTS origin_port         TEXT,
  ADD COLUMN IF NOT EXISTS destination_port    TEXT,
  ADD COLUMN IF NOT EXISTS carrier             TEXT,
  ADD COLUMN IF NOT EXISTS etd                 DATE,
  ADD COLUMN IF NOT EXISTS eta                 DATE,
  ADD COLUMN IF NOT EXISTS container_number    TEXT,
  ADD COLUMN IF NOT EXISTS container_type     TEXT,
  ADD COLUMN IF NOT EXISTS shipping_line       TEXT,
  ADD COLUMN IF NOT EXISTS port_country        TEXT,
  ADD COLUMN IF NOT EXISTS port_name           TEXT,
  ADD COLUMN IF NOT EXISTS port_role           TEXT,
  ADD COLUMN IF NOT EXISTS vessel_arrival_date DATE,
  ADD COLUMN IF NOT EXISTS free_time_days      INTEGER DEFAULT 14,
  ADD COLUMN IF NOT EXISTS daily_demurrage_fee NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS currency            TEXT DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS notes               TEXT,
  ADD COLUMN IF NOT EXISTS status              TEXT DEFAULT 'In Transit',
  ADD COLUMN IF NOT EXISTS created_at          TIMESTAMPTZ DEFAULT timezone('utc'::text, now());

-- Ownership column (used by RLS; filled from the signed-in user by default)
ALTER TABLE public.international_shipments
  ADD COLUMN IF NOT EXISTS created_by UUID DEFAULT auth.uid();

CREATE INDEX IF NOT EXISTS idx_international_shipments_created_by
  ON public.international_shipments (created_by, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_international_shipments_tracking_number
  ON public.international_shipments (tracking_number);

CREATE INDEX IF NOT EXISTS idx_international_shipments_bl_number
  ON public.international_shipments (bl_number);

CREATE INDEX IF NOT EXISTS idx_international_shipments_container_number
  ON public.international_shipments (container_number);

-- Helper function (before policies). Admin check without touching the protected table.
CREATE OR REPLACE FUNCTION public.intl_shipments_is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid() AND up.role = 'admin'
  )
$func$;

ALTER TABLE public.international_shipments ENABLE ROW LEVEL SECURITY;

-- Authenticated users: SELECT own (or admin sees all)
DROP POLICY IF EXISTS "intl_shipments_select_own" ON public.international_shipments;
CREATE POLICY "intl_shipments_select_own"
  ON public.international_shipments
  FOR SELECT
  TO authenticated
  USING (created_by = auth.uid() OR public.intl_shipments_is_admin());

-- Authenticated users: INSERT rows owned by themselves
DROP POLICY IF EXISTS "intl_shipments_insert_own" ON public.international_shipments;
CREATE POLICY "intl_shipments_insert_own"
  ON public.international_shipments
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid() OR public.intl_shipments_is_admin());

-- Authenticated users: UPDATE own (or admin)
DROP POLICY IF EXISTS "intl_shipments_update_own" ON public.international_shipments;
CREATE POLICY "intl_shipments_update_own"
  ON public.international_shipments
  FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid() OR public.intl_shipments_is_admin())
  WITH CHECK (created_by = auth.uid() OR public.intl_shipments_is_admin());

-- Service role: explicit full access (service_role bypasses RLS, policy kept for clarity)
DROP POLICY IF EXISTS "intl_shipments_service_role_all" ON public.international_shipments;
CREATE POLICY "intl_shipments_service_role_all"
  ON public.international_shipments
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE ON public.international_shipments TO authenticated;
GRANT ALL ON public.international_shipments TO service_role;
