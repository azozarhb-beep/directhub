-- Migration: Smart Commission Engine
-- Timestamp: 20260810270000

-- ============================================================
-- 1. ADD ORDER CATEGORY & COMMISSION COLUMNS TO ORDERS
-- ============================================================

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'order_category'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN order_category TEXT DEFAULT 'retail';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'container_count'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN container_count INTEGER DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'platform_commission'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN platform_commission DECIMAL(12,2) DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'commission_rate_label'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN commission_rate_label TEXT DEFAULT '';
  END IF;
END $$;

-- ============================================================
-- 2. PLATFORM COMMISSIONS TRACKING TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.platform_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  order_number TEXT NOT NULL,
  order_category TEXT NOT NULL,
  order_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  container_count INTEGER DEFAULT 0,
  commission_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  commission_rate_label TEXT NOT NULL DEFAULT '',
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_platform_commissions_order_id ON public.platform_commissions(order_id);
CREATE INDEX IF NOT EXISTS idx_platform_commissions_order_category ON public.platform_commissions(order_category);
CREATE INDEX IF NOT EXISTS idx_platform_commissions_created_at ON public.platform_commissions(created_at);

-- ============================================================
-- 3. RLS POLICIES
-- ============================================================

ALTER TABLE public.platform_commissions ENABLE ROW LEVEL SECURITY;

-- Admin can read all commissions
DROP POLICY IF EXISTS "admin_read_commissions" ON public.platform_commissions;
CREATE POLICY "admin_read_commissions"
  ON public.platform_commissions FOR SELECT
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- Service role can insert (from checkout flow)
DROP POLICY IF EXISTS "service_insert_commissions" ON public.platform_commissions;
CREATE POLICY "service_insert_commissions"
  ON public.platform_commissions FOR INSERT
  WITH CHECK (true);

-- Service role can update
DROP POLICY IF EXISTS "service_update_commissions" ON public.platform_commissions;
CREATE POLICY "service_update_commissions"
  ON public.platform_commissions FOR UPDATE
  USING (true);
