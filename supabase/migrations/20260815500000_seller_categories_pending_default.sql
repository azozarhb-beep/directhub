-- Migration: Enforce 3 Seller Categories & Pending-by-Default Registration
-- Timestamp: 20260815500000

-- ============================================================
-- 1. ADD seller_category COLUMN TO factory_registrations
--    Values: 'local_factory' | 'international_factory' | 'local_supplier'
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'factory_registrations'
          AND column_name = 'seller_category'
    ) THEN
        ALTER TABLE public.factory_registrations
            ADD COLUMN seller_category TEXT DEFAULT 'local_factory'
            CHECK (seller_category IN ('local_factory', 'international_factory', 'local_supplier'));
    END IF;
END;
$$;

-- ============================================================
-- 2. BACKFILL seller_category FROM existing factory_type
--    'local' → 'local_factory', 'international' → 'international_factory'
-- ============================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'factory_registrations'
          AND column_name = 'factory_type'
    ) THEN
        UPDATE public.factory_registrations
        SET seller_category = CASE
            WHEN factory_type = 'local' THEN 'local_factory'
            WHEN factory_type = 'international' THEN 'international_factory'
            ELSE 'local_factory'
        END
        WHERE seller_category IS NULL OR seller_category = 'local_factory';
    END IF;
END;
$$;

-- ============================================================
-- 3. ENSURE registration_status DEFAULTS TO 'pending'
--    (column already exists from earlier migration — just enforce default)
-- ============================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'factory_registrations'
          AND column_name = 'registration_status'
    ) THEN
        ALTER TABLE public.factory_registrations
            ALTER COLUMN registration_status SET DEFAULT 'pending';
    END IF;
END;
$$;

-- ============================================================
-- 4. ENSURE is_approved DEFAULTS TO false (no auto-activation)
-- ============================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'factory_registrations'
          AND column_name = 'is_approved'
    ) THEN
        ALTER TABLE public.factory_registrations
            ALTER COLUMN is_approved SET DEFAULT false;
    END IF;
END;
$$;

-- ============================================================
-- 5. ENSURE product_listing_unlocked DEFAULTS TO false
--    (products only visible after admin approval)
-- ============================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'factory_registrations'
          AND column_name = 'product_listing_unlocked'
    ) THEN
        ALTER TABLE public.factory_registrations
            ALTER COLUMN product_listing_unlocked SET DEFAULT false;
    END IF;
END;
$$;

-- ============================================================
-- 6. INDEX for fast pending lookups in admin dashboard
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_factory_reg_seller_category
    ON public.factory_registrations (seller_category);

CREATE INDEX IF NOT EXISTS idx_factory_reg_registration_status
    ON public.factory_registrations (registration_status);
