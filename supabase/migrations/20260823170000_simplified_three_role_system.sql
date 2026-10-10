-- Migration: Simplified 3-Role Account System
-- Timestamp: 20260823170000
-- Roles: buyer (default), factory (Industrial ERP), local_supplier (Supplier Dashboard)
-- No international suppliers — local entities only

-- ============================================================
-- 1. ADD account_type COLUMN TO user_profiles
--    Values: 'buyer' | 'factory' | 'local_supplier'
--    This is separate from the existing 'role' column (buyer/manufacturer/admin)
-- ============================================================

ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS account_type TEXT DEFAULT 'buyer'
CHECK (account_type IN ('buyer', 'factory', 'local_supplier'));

-- ============================================================
-- 2. ADD upgrade_request TABLE
--    Tracks upgrade requests from buyer → factory or local_supplier
-- ============================================================

CREATE TABLE IF NOT EXISTS public.account_upgrade_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    requested_type TEXT NOT NULL CHECK (requested_type IN ('factory', 'local_supplier')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    company_name TEXT NOT NULL DEFAULT '',
    commercial_registration TEXT DEFAULT '',
    vat_number TEXT DEFAULT '',
    city TEXT DEFAULT '',
    country TEXT DEFAULT 'Saudi Arabia',
    contact_phone TEXT DEFAULT '',
    industry_sector TEXT DEFAULT '',
    documents_submitted BOOLEAN DEFAULT false,
    admin_notes TEXT DEFAULT '',
    submitted_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMPTZ,
    reviewed_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 3. ADD seller_badge COLUMN TO manufacturer_products
--    Shows badge on product page: 'certified_factory' | 'local_supplier'
-- ============================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'manufacturer_products'
    ) THEN
        ALTER TABLE public.manufacturer_products
        ADD COLUMN IF NOT EXISTS seller_badge TEXT DEFAULT NULL
        CHECK (seller_badge IN ('certified_factory', 'local_supplier'));
    END IF;
END;
$$;

-- ============================================================
-- 4. UPDATE seller_category IN factory_registrations
--    Remove 'international_factory' — only local_factory and local_supplier
-- ============================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'factory_registrations'
          AND column_name = 'seller_category'
    ) THEN
        -- Migrate any international_factory to local_factory
        UPDATE public.factory_registrations
        SET seller_category = 'local_factory'
        WHERE seller_category = 'international_factory';
    END IF;
END;
$$;

-- ============================================================
-- 5. INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_user_profiles_account_type
    ON public.user_profiles (account_type);

CREATE INDEX IF NOT EXISTS idx_account_upgrade_requests_user_id
    ON public.account_upgrade_requests (user_id);

CREATE INDEX IF NOT EXISTS idx_account_upgrade_requests_status
    ON public.account_upgrade_requests (status);

-- ============================================================
-- 6. ENABLE RLS
-- ============================================================

ALTER TABLE public.account_upgrade_requests ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 7. RLS POLICIES
-- ============================================================

DROP POLICY IF EXISTS "users_manage_own_upgrade_requests" ON public.account_upgrade_requests;
CREATE POLICY "users_manage_own_upgrade_requests"
ON public.account_upgrade_requests
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Admin can view all upgrade requests
DROP POLICY IF EXISTS "admin_view_all_upgrade_requests" ON public.account_upgrade_requests;
CREATE POLICY "admin_view_all_upgrade_requests"
ON public.account_upgrade_requests
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = auth.uid() AND up.role = 'admin'
    )
);

-- ============================================================
-- 8. TRIGGER: update updated_at
-- ============================================================

DROP TRIGGER IF EXISTS update_account_upgrade_requests_updated_at ON public.account_upgrade_requests;
CREATE TRIGGER update_account_upgrade_requests_updated_at
    BEFORE UPDATE ON public.account_upgrade_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- 9. BACKFILL account_type FROM existing role/factory_registrations
-- ============================================================

DO $$
BEGIN
    -- Set account_type = 'factory' for users who have approved factory registrations
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'factory_registrations'
    ) THEN
        UPDATE public.user_profiles up
        SET account_type = 'factory'
        WHERE up.role = 'manufacturer'
          AND EXISTS (
              SELECT 1 FROM public.factory_registrations fr
              WHERE fr.user_id = up.id
                AND fr.seller_category IN ('local_factory', 'international_factory')
                AND fr.is_approved = true
          );

        UPDATE public.user_profiles up
        SET account_type = 'local_supplier'
        WHERE up.role = 'manufacturer'
          AND EXISTS (
              SELECT 1 FROM public.factory_registrations fr
              WHERE fr.user_id = up.id
                AND fr.seller_category = 'local_supplier'
                AND fr.is_approved = true
          );
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Backfill skipped: %', SQLERRM;
END;
$$;
