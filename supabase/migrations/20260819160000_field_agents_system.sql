-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Field Agents System
-- Timestamp: 20260819160000
-- Description: Adds field agent role, agent-registered factories, products,
--              and license upload/approval workflow
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. ENUMS ─────────────────────────────────────────────────────────────────

DROP TYPE IF EXISTS public.factory_contact_status CASCADE;
CREATE TYPE public.factory_contact_status AS ENUM (
  'contacting',
  'awaiting_license_approval',
  'documents_submitted',
  'approved',
  'rejected'
);

-- ── 2. TABLES ────────────────────────────────────────────────────────────────

-- Agent-registered factories (separate from self-registered factories)
CREATE TABLE IF NOT EXISTS public.agent_factory_registrations (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id                  UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  company_name              TEXT NOT NULL DEFAULT '',
  factory_type              TEXT NOT NULL DEFAULT 'local_factory'
                              CHECK (factory_type IN ('local_factory', 'international_factory', 'local_supplier')),
  country                   TEXT NOT NULL DEFAULT 'Saudi Arabia',
  city                      TEXT NOT NULL DEFAULT '',
  region                    TEXT NOT NULL DEFAULT '',
  address                   TEXT NOT NULL DEFAULT '',
  contact_person            TEXT NOT NULL DEFAULT '',
  contact_phone             TEXT NOT NULL DEFAULT '',
  contact_email             TEXT NOT NULL DEFAULT '',
  website                   TEXT DEFAULT '',
  industry                  TEXT NOT NULL DEFAULT '',
  employee_count            TEXT DEFAULT '',
  annual_capacity           TEXT DEFAULT '',
  main_products             JSONB DEFAULT '[]'::jsonb,
  certifications            JSONB DEFAULT '[]'::jsonb,
  -- License / documents
  trade_license_url         TEXT DEFAULT '',
  trade_license_filename    TEXT DEFAULT '',
  cr_document_url           TEXT DEFAULT '',
  factory_license_url       TEXT DEFAULT '',
  tax_id                    TEXT DEFAULT '',
  additional_docs           JSONB DEFAULT '[]'::jsonb,
  -- Status tracking
  contact_status            public.factory_contact_status DEFAULT 'contacting'::public.factory_contact_status,
  registration_status       TEXT NOT NULL DEFAULT 'pending'
                              CHECK (registration_status IN ('pending', 'under_review', 'approved', 'rejected')),
  agent_notes               TEXT DEFAULT '',
  admin_note                TEXT DEFAULT '',
  -- License approval
  license_submitted_at      TIMESTAMPTZ,
  license_reviewed_at       TIMESTAMPTZ,
  license_reviewed_by       UUID REFERENCES public.user_profiles(id),
  license_rejection_reason  TEXT DEFAULT '',
  -- Timestamps
  created_at                TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at                TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Products uploaded by agents on behalf of factories
CREATE TABLE IF NOT EXISTS public.agent_products (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id          UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  factory_id        UUID NOT NULL REFERENCES public.agent_factory_registrations(id) ON DELETE CASCADE,
  name_ar           TEXT NOT NULL DEFAULT '',
  name_en           TEXT DEFAULT '',
  description_ar    TEXT DEFAULT '',
  description_en    TEXT DEFAULT '',
  category          TEXT DEFAULT '',
  price             NUMERIC(12, 2) DEFAULT 0,
  currency          TEXT DEFAULT 'SAR',
  moq               INTEGER DEFAULT 1,
  unit              TEXT DEFAULT 'piece',
  specifications    JSONB DEFAULT '{}'::jsonb,
  images            JSONB DEFAULT '[]'::jsonb,
  is_active         BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ── 3. INDEXES ───────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_agent_factory_regs_agent_id
  ON public.agent_factory_registrations(agent_id);

CREATE INDEX IF NOT EXISTS idx_agent_factory_regs_status
  ON public.agent_factory_registrations(registration_status);

CREATE INDEX IF NOT EXISTS idx_agent_factory_regs_license_submitted
  ON public.agent_factory_registrations(license_submitted_at)
  WHERE license_submitted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_agent_products_agent_id
  ON public.agent_products(agent_id);

CREATE INDEX IF NOT EXISTS idx_agent_products_factory_id
  ON public.agent_products(factory_id);

-- ── 4. FUNCTIONS ─────────────────────────────────────────────────────────────

-- Helper: check if current user is admin (reads from auth metadata, no recursion)
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
      AND (
        raw_user_meta_data->>'role' = 'admin'
        OR raw_app_meta_data->>'role' = 'admin'
      )
  )
$$;

-- Helper: check if current user is a field agent
CREATE OR REPLACE FUNCTION public.is_field_agent()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
      AND raw_user_meta_data->>'role' = 'field_agent'
  )
$$;

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_agent_factory_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_agent_product_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

-- ── 5. ENABLE RLS ────────────────────────────────────────────────────────────

ALTER TABLE public.agent_factory_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_products ENABLE ROW LEVEL SECURITY;

-- ── 6. RLS POLICIES ──────────────────────────────────────────────────────────

-- agent_factory_registrations: agent sees only their own; admin sees all
DROP POLICY IF EXISTS "agent_factory_regs_agent_select" ON public.agent_factory_registrations;
CREATE POLICY "agent_factory_regs_agent_select"
  ON public.agent_factory_registrations
  FOR SELECT
  TO authenticated
  USING (agent_id = auth.uid() OR public.is_admin_user());

DROP POLICY IF EXISTS "agent_factory_regs_agent_insert" ON public.agent_factory_registrations;
CREATE POLICY "agent_factory_regs_agent_insert"
  ON public.agent_factory_registrations
  FOR INSERT
  TO authenticated
  WITH CHECK (agent_id = auth.uid() OR public.is_admin_user());

DROP POLICY IF EXISTS "agent_factory_regs_agent_update" ON public.agent_factory_registrations;
CREATE POLICY "agent_factory_regs_agent_update"
  ON public.agent_factory_registrations
  FOR UPDATE
  TO authenticated
  USING (agent_id = auth.uid() OR public.is_admin_user())
  WITH CHECK (agent_id = auth.uid() OR public.is_admin_user());

DROP POLICY IF EXISTS "agent_factory_regs_admin_delete" ON public.agent_factory_registrations;
CREATE POLICY "agent_factory_regs_admin_delete"
  ON public.agent_factory_registrations
  FOR DELETE
  TO authenticated
  USING (public.is_admin_user());

-- agent_products: agent sees only their own; admin sees all
DROP POLICY IF EXISTS "agent_products_agent_select" ON public.agent_products;
CREATE POLICY "agent_products_agent_select"
  ON public.agent_products
  FOR SELECT
  TO authenticated
  USING (agent_id = auth.uid() OR public.is_admin_user());

DROP POLICY IF EXISTS "agent_products_agent_insert" ON public.agent_products;
CREATE POLICY "agent_products_agent_insert"
  ON public.agent_products
  FOR INSERT
  TO authenticated
  WITH CHECK (agent_id = auth.uid() OR public.is_admin_user());

DROP POLICY IF EXISTS "agent_products_agent_update" ON public.agent_products;
CREATE POLICY "agent_products_agent_update"
  ON public.agent_products
  FOR UPDATE
  TO authenticated
  USING (agent_id = auth.uid() OR public.is_admin_user())
  WITH CHECK (agent_id = auth.uid() OR public.is_admin_user());

DROP POLICY IF EXISTS "agent_products_admin_delete" ON public.agent_products;
CREATE POLICY "agent_products_admin_delete"
  ON public.agent_products
  FOR DELETE
  TO authenticated
  USING (public.is_admin_user());

-- ── 7. TRIGGERS ──────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_agent_factory_updated_at ON public.agent_factory_registrations;
CREATE TRIGGER trg_agent_factory_updated_at
  BEFORE UPDATE ON public.agent_factory_registrations
  FOR EACH ROW EXECUTE FUNCTION public.update_agent_factory_updated_at();

DROP TRIGGER IF EXISTS trg_agent_product_updated_at ON public.agent_products;
CREATE TRIGGER trg_agent_product_updated_at
  BEFORE UPDATE ON public.agent_products
  FOR EACH ROW EXECUTE FUNCTION public.update_agent_product_updated_at();
