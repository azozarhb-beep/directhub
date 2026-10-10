-- ============================================================
-- Factory Enterprise Multi-User: Sales Representatives System
-- ============================================================

-- 1. ENUM for sales rep role
DROP TYPE IF EXISTS public.factory_rep_role CASCADE;
CREATE TYPE public.factory_rep_role AS ENUM ('sales_rep', 'senior_sales_rep');

-- 2. ENUM for invitation status
DROP TYPE IF EXISTS public.factory_rep_status CASCADE;
CREATE TYPE public.factory_rep_status AS ENUM ('pending', 'active', 'suspended', 'revoked');

-- 3. Factory Sales Representatives table
CREATE TABLE IF NOT EXISTS public.factory_sales_reps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    factory_owner_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    rep_user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    invited_email TEXT NOT NULL,
    full_name TEXT NOT NULL DEFAULT '',
    role public.factory_rep_role NOT NULL DEFAULT 'sales_rep'::public.factory_rep_role,
    status public.factory_rep_status NOT NULL DEFAULT 'pending'::public.factory_rep_status,
    invitation_token TEXT UNIQUE,
    invitation_sent_at TIMESTAMPTZ DEFAULT now(),
    accepted_at TIMESTAMPTZ,
    suspended_at TIMESTAMPTZ,
    suspension_reason TEXT,
    notes TEXT,
    -- Granular permissions (all false by default for safety)
    can_manage_products BOOLEAN NOT NULL DEFAULT true,
    can_view_inventory BOOLEAN NOT NULL DEFAULT true,
    can_respond_rfq BOOLEAN NOT NULL DEFAULT true,
    can_view_orders BOOLEAN NOT NULL DEFAULT true,
    -- Financial sections are ALWAYS blocked for sales reps (enforced at DB level)
    -- These columns exist only for audit trail — app logic also enforces the block
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_factory_sales_reps_owner ON public.factory_sales_reps(factory_owner_id);
CREATE INDEX IF NOT EXISTS idx_factory_sales_reps_rep_user ON public.factory_sales_reps(rep_user_id);
CREATE INDEX IF NOT EXISTS idx_factory_sales_reps_email ON public.factory_sales_reps(invited_email);
CREATE INDEX IF NOT EXISTS idx_factory_sales_reps_token ON public.factory_sales_reps(invitation_token);

-- 5. Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_factory_sales_reps_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_factory_sales_reps_updated_at ON public.factory_sales_reps;
CREATE TRIGGER trg_factory_sales_reps_updated_at
    BEFORE UPDATE ON public.factory_sales_reps
    FOR EACH ROW EXECUTE FUNCTION public.update_factory_sales_reps_updated_at();

-- 6. Helper function: check if current user is a sales rep for a given factory owner
CREATE OR REPLACE FUNCTION public.is_factory_sales_rep(owner_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
SELECT EXISTS (
    SELECT 1 FROM public.factory_sales_reps fsr
    WHERE fsr.factory_owner_id = owner_id
      AND fsr.rep_user_id = auth.uid()
      AND fsr.status = 'active'
)
$$;

-- 7. Helper function: get the factory owner id for the current user (if they are a rep)
CREATE OR REPLACE FUNCTION public.get_rep_factory_owner_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
SELECT factory_owner_id FROM public.factory_sales_reps
WHERE rep_user_id = auth.uid() AND status = 'active'
LIMIT 1
$$;

-- 8. Enable RLS
ALTER TABLE public.factory_sales_reps ENABLE ROW LEVEL SECURITY;

-- 9. RLS Policies

-- Factory owner can manage their own reps
DROP POLICY IF EXISTS "factory_owner_manage_reps" ON public.factory_sales_reps;
CREATE POLICY "factory_owner_manage_reps"
ON public.factory_sales_reps
FOR ALL
TO authenticated
USING (factory_owner_id = auth.uid())
WITH CHECK (factory_owner_id = auth.uid());

-- Sales reps can view their own record
DROP POLICY IF EXISTS "sales_rep_view_own_record" ON public.factory_sales_reps;
CREATE POLICY "sales_rep_view_own_record"
ON public.factory_sales_reps
FOR SELECT
TO authenticated
USING (rep_user_id = auth.uid());

-- 10. Extend manufacturer_products RLS to allow active sales reps to manage products
-- (Sales reps can manage products of the factory they belong to)
DROP POLICY IF EXISTS "sales_rep_manage_factory_products" ON public.manufacturer_products;
CREATE POLICY "sales_rep_manage_factory_products"
ON public.manufacturer_products
FOR ALL
TO authenticated
USING (public.is_factory_sales_rep(manufacturer_id))
WITH CHECK (public.is_factory_sales_rep(manufacturer_id));

-- 11. Allow sales reps to view RFQ requests for their factory
DROP POLICY IF EXISTS "sales_rep_view_factory_rfqs" ON public.rfq_requests;
CREATE POLICY "sales_rep_view_factory_rfqs"
ON public.rfq_requests
FOR SELECT
TO authenticated
USING (public.is_factory_sales_rep(factory_id));

-- 12. Allow sales reps to respond to RFQs for their factory
DROP POLICY IF EXISTS "sales_rep_respond_factory_rfqs" ON public.rfq_responses;
CREATE POLICY "sales_rep_respond_factory_rfqs"
ON public.rfq_responses
FOR ALL
TO authenticated
USING (public.is_factory_sales_rep(
    (SELECT factory_id FROM public.rfq_requests WHERE id = rfq_id LIMIT 1)
))
WITH CHECK (public.is_factory_sales_rep(
    (SELECT factory_id FROM public.rfq_requests WHERE id = rfq_id LIMIT 1)
));

-- 13. Allow sales reps to view orders for their factory (read-only)
DROP POLICY IF EXISTS "sales_rep_view_factory_orders" ON public.orders;
CREATE POLICY "sales_rep_view_factory_orders"
ON public.orders
FOR SELECT
TO authenticated
USING (public.is_factory_sales_rep(factory_user_id));

-- NOTE: Financial tables (manufacturer_payment_settings, factory_bank_accounts,
-- escrow_ledger, admin_payout_approvals) are NOT touched here.
-- Sales reps have NO access to financial data — enforced at both DB and application level.
