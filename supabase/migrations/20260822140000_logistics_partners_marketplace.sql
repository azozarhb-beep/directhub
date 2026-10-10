-- ═══════════════════════════════════════════════════════════════════════════
-- LOGISTICS & CUSTOMS CLEARANCE MARKETPLACE
-- Migration: 20260822140000_logistics_partners_marketplace.sql
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. ENUM TYPES ────────────────────────────────────────────────────────────
DROP TYPE IF EXISTS public.logistics_partner_type CASCADE;
CREATE TYPE public.logistics_partner_type AS ENUM (
  'shipping_office',
  'customs_broker',
  'sourcing_agent',
  'freight_forwarder',
  'logistics_company'
);

DROP TYPE IF EXISTS public.logistics_partner_status CASCADE;
CREATE TYPE public.logistics_partner_status AS ENUM (
  'pending',
  'under_review',
  'approved',
  'rejected',
  'suspended'
);

DROP TYPE IF EXISTS public.logistics_payment_status CASCADE;
CREATE TYPE public.logistics_payment_status AS ENUM (
  'pending',
  'held_in_escrow',
  'released',
  'refunded',
  'disputed'
);

-- ── 2. LOGISTICS PARTNERS TABLE ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.logistics_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  partner_type public.logistics_partner_type NOT NULL DEFAULT 'shipping_office',
  company_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  country TEXT NOT NULL,
  city TEXT NOT NULL,
  address TEXT NOT NULL,
  postal_code TEXT,
  website TEXT,
  -- Routes & Ports Coverage
  origin_countries TEXT[] DEFAULT ARRAY[]::TEXT[],
  destination_countries TEXT[] DEFAULT ARRAY[]::TEXT[],
  covered_ports TEXT[] DEFAULT ARRAY[]::TEXT[],
  covered_routes JSONB DEFAULT '[]'::jsonb,
  -- Services
  services_offered TEXT[] DEFAULT ARRAY[]::TEXT[],
  incoterms_supported TEXT[] DEFAULT ARRAY[]::TEXT[],
  -- Documents
  trade_license_url TEXT,
  trade_license_filename TEXT,
  customs_license_url TEXT,
  customs_license_filename TEXT,
  insurance_certificate_url TEXT,
  insurance_certificate_filename TEXT,
  -- SLA Agreement
  sla_agreed BOOLEAN NOT NULL DEFAULT false,
  sla_agreed_at TIMESTAMPTZ,
  sla_ip_address TEXT,
  -- Status & Admin
  status public.logistics_partner_status NOT NULL DEFAULT 'pending',
  admin_note TEXT,
  verified_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  -- Pricing
  base_rate_usd NUMERIC(10,2),
  rate_description TEXT,
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 3. LOGISTICS PARTNER ROUTES TABLE ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.logistics_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES public.logistics_partners(id) ON DELETE CASCADE,
  origin_country TEXT NOT NULL,
  origin_port TEXT,
  destination_country TEXT NOT NULL,
  destination_port TEXT,
  transit_days_min INTEGER,
  transit_days_max INTEGER,
  rate_per_cbm NUMERIC(10,2),
  rate_per_kg NUMERIC(10,2),
  rate_per_container_20ft NUMERIC(10,2),
  rate_per_container_40ft NUMERIC(10,2),
  currency TEXT NOT NULL DEFAULT 'USD',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 4. LOGISTICS ESCROW PAYMENTS TABLE ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.logistics_escrow_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  buyer_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES public.logistics_partners(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  payment_status public.logistics_payment_status NOT NULL DEFAULT 'pending',
  escrow_held_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  release_condition TEXT,
  admin_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 5. LOGISTICS CHAT CONVERSATIONS TABLE ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.logistics_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES public.logistics_partners(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  last_message TEXT,
  last_message_at TIMESTAMPTZ,
  buyer_unread INTEGER NOT NULL DEFAULT 0,
  partner_unread INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 6. LOGISTICS CHAT MESSAGES TABLE ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.logistics_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.logistics_conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL DEFAULT 'buyer',
  content TEXT NOT NULL,
  attachment_url TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 7. INDEXES ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_logistics_partners_status ON public.logistics_partners(status);
CREATE INDEX IF NOT EXISTS idx_logistics_partners_user_id ON public.logistics_partners(user_id);
CREATE INDEX IF NOT EXISTS idx_logistics_partners_country ON public.logistics_partners(country);
CREATE INDEX IF NOT EXISTS idx_logistics_routes_partner_id ON public.logistics_routes(partner_id);
CREATE INDEX IF NOT EXISTS idx_logistics_routes_origin ON public.logistics_routes(origin_country);
CREATE INDEX IF NOT EXISTS idx_logistics_routes_destination ON public.logistics_routes(destination_country);
CREATE INDEX IF NOT EXISTS idx_logistics_escrow_order_id ON public.logistics_escrow_payments(order_id);
CREATE INDEX IF NOT EXISTS idx_logistics_escrow_buyer_id ON public.logistics_escrow_payments(buyer_id);
CREATE INDEX IF NOT EXISTS idx_logistics_conversations_buyer ON public.logistics_conversations(buyer_id);
CREATE INDEX IF NOT EXISTS idx_logistics_conversations_partner ON public.logistics_conversations(partner_id);
CREATE INDEX IF NOT EXISTS idx_logistics_messages_conv ON public.logistics_messages(conversation_id);

-- ── 8. UPDATED_AT TRIGGER FUNCTION ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_logistics_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_logistics_partners_updated_at ON public.logistics_partners;
CREATE TRIGGER trg_logistics_partners_updated_at
  BEFORE UPDATE ON public.logistics_partners
  FOR EACH ROW EXECUTE FUNCTION public.update_logistics_updated_at();

DROP TRIGGER IF EXISTS trg_logistics_escrow_updated_at ON public.logistics_escrow_payments;
CREATE TRIGGER trg_logistics_escrow_updated_at
  BEFORE UPDATE ON public.logistics_escrow_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_logistics_updated_at();

-- ── 9. ADMIN CHECK FUNCTION ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
SELECT EXISTS (
  SELECT 1 FROM auth.users au
  WHERE au.id = auth.uid()
  AND (
    au.raw_user_meta_data->>'role' = 'admin'
    OR au.raw_app_meta_data->>'role' = 'admin'
  )
)
$$;

-- ── 10. ENABLE RLS ────────────────────────────────────────────────────────────
ALTER TABLE public.logistics_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logistics_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logistics_escrow_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logistics_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logistics_messages ENABLE ROW LEVEL SECURITY;

-- ── 11. RLS POLICIES ─────────────────────────────────────────────────────────

-- logistics_partners: public can view approved, owner can manage own, admin full access
DROP POLICY IF EXISTS "public_view_approved_logistics" ON public.logistics_partners;
CREATE POLICY "public_view_approved_logistics"
ON public.logistics_partners FOR SELECT
TO public
USING (status = 'approved' AND is_active = true);

DROP POLICY IF EXISTS "owner_manage_own_logistics_partner" ON public.logistics_partners;
CREATE POLICY "owner_manage_own_logistics_partner"
ON public.logistics_partners FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "admin_full_access_logistics_partners" ON public.logistics_partners;
CREATE POLICY "admin_full_access_logistics_partners"
ON public.logistics_partners FOR ALL
TO authenticated
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

-- logistics_routes: public view active, owner manage own, admin full
DROP POLICY IF EXISTS "public_view_logistics_routes" ON public.logistics_routes;
CREATE POLICY "public_view_logistics_routes"
ON public.logistics_routes FOR SELECT
TO public
USING (is_active = true);

DROP POLICY IF EXISTS "partner_manage_own_routes" ON public.logistics_routes;
CREATE POLICY "partner_manage_own_routes"
ON public.logistics_routes FOR ALL
TO authenticated
USING (partner_id IN (SELECT id FROM public.logistics_partners WHERE user_id = auth.uid()))
WITH CHECK (partner_id IN (SELECT id FROM public.logistics_partners WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "admin_full_access_logistics_routes" ON public.logistics_routes;
CREATE POLICY "admin_full_access_logistics_routes"
ON public.logistics_routes FOR ALL
TO authenticated
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

-- logistics_escrow_payments
DROP POLICY IF EXISTS "buyer_view_own_logistics_escrow" ON public.logistics_escrow_payments;
CREATE POLICY "buyer_view_own_logistics_escrow"
ON public.logistics_escrow_payments FOR SELECT
TO authenticated
USING (buyer_id = auth.uid());

DROP POLICY IF EXISTS "buyer_create_logistics_escrow" ON public.logistics_escrow_payments;
CREATE POLICY "buyer_create_logistics_escrow"
ON public.logistics_escrow_payments FOR INSERT
TO authenticated
WITH CHECK (buyer_id = auth.uid());

DROP POLICY IF EXISTS "admin_full_access_logistics_escrow" ON public.logistics_escrow_payments;
CREATE POLICY "admin_full_access_logistics_escrow"
ON public.logistics_escrow_payments FOR ALL
TO authenticated
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

-- logistics_conversations
DROP POLICY IF EXISTS "participants_view_logistics_conv" ON public.logistics_conversations;
CREATE POLICY "participants_view_logistics_conv"
ON public.logistics_conversations FOR SELECT
TO authenticated
USING (
  buyer_id = auth.uid()
  OR partner_id IN (SELECT id FROM public.logistics_partners WHERE user_id = auth.uid())
  OR public.is_admin_user()
);

DROP POLICY IF EXISTS "buyer_create_logistics_conv" ON public.logistics_conversations;
CREATE POLICY "buyer_create_logistics_conv"
ON public.logistics_conversations FOR INSERT
TO authenticated
WITH CHECK (buyer_id = auth.uid());

DROP POLICY IF EXISTS "participants_update_logistics_conv" ON public.logistics_conversations;
CREATE POLICY "participants_update_logistics_conv"
ON public.logistics_conversations FOR UPDATE
TO authenticated
USING (
  buyer_id = auth.uid()
  OR partner_id IN (SELECT id FROM public.logistics_partners WHERE user_id = auth.uid())
  OR public.is_admin_user()
)
WITH CHECK (
  buyer_id = auth.uid()
  OR partner_id IN (SELECT id FROM public.logistics_partners WHERE user_id = auth.uid())
  OR public.is_admin_user()
);

-- logistics_messages
DROP POLICY IF EXISTS "participants_view_logistics_messages" ON public.logistics_messages;
CREATE POLICY "participants_view_logistics_messages"
ON public.logistics_messages FOR SELECT
TO authenticated
USING (
  conversation_id IN (
    SELECT id FROM public.logistics_conversations
    WHERE buyer_id = auth.uid()
    OR partner_id IN (SELECT id FROM public.logistics_partners WHERE user_id = auth.uid())
  )
  OR public.is_admin_user()
);

DROP POLICY IF EXISTS "participants_send_logistics_messages" ON public.logistics_messages;
CREATE POLICY "participants_send_logistics_messages"
ON public.logistics_messages FOR INSERT
TO authenticated
WITH CHECK (sender_id = auth.uid());

DROP POLICY IF EXISTS "admin_full_access_logistics_messages" ON public.logistics_messages;
CREATE POLICY "admin_full_access_logistics_messages"
ON public.logistics_messages FOR ALL
TO authenticated
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());
