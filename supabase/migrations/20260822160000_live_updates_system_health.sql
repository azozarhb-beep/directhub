-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION: Live Updates & System Infrastructure Module
-- Timestamp: 20260822160000
-- Tables: platform_live_updates, system_error_logs, subscription_plans
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. ENUMS ─────────────────────────────────────────────────────────────────

DROP TYPE IF EXISTS public.live_update_type CASCADE;
CREATE TYPE public.live_update_type AS ENUM (
  'new_factory',
  'new_rfq',
  'new_product',
  'new_user',
  'platform_news',
  'promotion',
  'system_notice'
);

DROP TYPE IF EXISTS public.live_update_status CASCADE;
CREATE TYPE public.live_update_status AS ENUM (
  'active',
  'inactive',
  'scheduled'
);

DROP TYPE IF EXISTS public.error_severity CASCADE;
CREATE TYPE public.error_severity AS ENUM (
  'critical',
  'warning',
  'info'
);

DROP TYPE IF EXISTS public.error_status CASCADE;
CREATE TYPE public.error_status AS ENUM (
  'open',
  'resolved',
  'ignored'
);

DROP TYPE IF EXISTS public.subscription_tier CASCADE;
CREATE TYPE public.subscription_tier AS ENUM (
  'starter',
  'growth',
  'enterprise',
  'custom'
);

-- ── 2. TABLES ─────────────────────────────────────────────────────────────────

-- Live updates feed (storefront ticker/feed)
CREATE TABLE IF NOT EXISTS public.platform_live_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  update_type public.live_update_type NOT NULL DEFAULT 'platform_news',
  title TEXT NOT NULL,
  title_ar TEXT,
  body TEXT,
  body_ar TEXT,
  icon TEXT DEFAULT 'BoltIcon',
  color TEXT DEFAULT 'blue',
  link_url TEXT,
  link_label TEXT,
  is_auto BOOLEAN DEFAULT false,
  status public.live_update_status NOT NULL DEFAULT 'active',
  display_order INTEGER DEFAULT 0,
  scheduled_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- System error / broken link log
CREATE TABLE IF NOT EXISTS public.system_error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  severity public.error_severity NOT NULL DEFAULT 'warning',
  error_code TEXT,
  title TEXT NOT NULL,
  description TEXT,
  affected_url TEXT,
  affected_component TEXT,
  resolution_action TEXT,
  status public.error_status NOT NULL DEFAULT 'open',
  resolved_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Subscription / hosting plan management
CREATE TABLE IF NOT EXISTS public.platform_subscription (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier public.subscription_tier NOT NULL DEFAULT 'growth',
  plan_name TEXT NOT NULL,
  monthly_cost DECIMAL(10,2) DEFAULT 0,
  storage_limit_gb INTEGER DEFAULT 10,
  storage_used_gb DECIMAL(10,2) DEFAULT 0,
  bandwidth_limit_gb INTEGER DEFAULT 100,
  bandwidth_used_gb DECIMAL(10,2) DEFAULT 0,
  max_users INTEGER DEFAULT 1000,
  max_products INTEGER DEFAULT 5000,
  renewal_date DATE,
  billing_cycle TEXT DEFAULT 'monthly',
  provider TEXT DEFAULT 'Supabase',
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── 3. INDEXES ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_live_updates_status ON public.platform_live_updates(status);
CREATE INDEX IF NOT EXISTS idx_live_updates_type ON public.platform_live_updates(update_type);
CREATE INDEX IF NOT EXISTS idx_live_updates_created ON public.platform_live_updates(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_status ON public.system_error_logs(status);
CREATE INDEX IF NOT EXISTS idx_error_logs_severity ON public.system_error_logs(severity);

-- ── 4. FUNCTIONS ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.update_live_updates_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_error_logs_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ── 5. ENABLE RLS ─────────────────────────────────────────────────────────────

ALTER TABLE public.platform_live_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_error_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_subscription ENABLE ROW LEVEL SECURITY;

-- ── 6. RLS POLICIES ───────────────────────────────────────────────────────────

-- Live updates: public can read active ones, admin manages all
DROP POLICY IF EXISTS "public_read_active_live_updates" ON public.platform_live_updates;
CREATE POLICY "public_read_active_live_updates"
ON public.platform_live_updates FOR SELECT TO public
USING (status = 'active');

DROP POLICY IF EXISTS "admin_manage_live_updates" ON public.platform_live_updates;
CREATE POLICY "admin_manage_live_updates"
ON public.platform_live_updates FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid() AND up.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid() AND up.role = 'admin'
  )
);

-- Error logs: admin only
DROP POLICY IF EXISTS "admin_manage_error_logs" ON public.system_error_logs;
CREATE POLICY "admin_manage_error_logs"
ON public.system_error_logs FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid() AND up.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid() AND up.role = 'admin'
  )
);

-- Subscription: admin only
DROP POLICY IF EXISTS "admin_manage_subscription" ON public.platform_subscription;
CREATE POLICY "admin_manage_subscription"
ON public.platform_subscription FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid() AND up.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid() AND up.role = 'admin'
  )
);

-- ── 7. TRIGGERS ───────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_live_updates_updated_at ON public.platform_live_updates;
CREATE TRIGGER trg_live_updates_updated_at
  BEFORE UPDATE ON public.platform_live_updates
  FOR EACH ROW EXECUTE FUNCTION public.update_live_updates_timestamp();

DROP TRIGGER IF EXISTS trg_error_logs_updated_at ON public.system_error_logs;
CREATE TRIGGER trg_error_logs_updated_at
  BEFORE UPDATE ON public.system_error_logs
  FOR EACH ROW EXECUTE FUNCTION public.update_error_logs_timestamp();

-- ── 8. SEED DATA ──────────────────────────────────────────────────────────────

DO $$
DECLARE
  admin_id UUID;
BEGIN
  SELECT id INTO admin_id FROM public.user_profiles WHERE role = 'admin' LIMIT 1;

  -- Seed live updates
  INSERT INTO public.platform_live_updates (update_type, title, title_ar, body, body_ar, icon, color, status, is_auto, display_order)
  VALUES
    ('new_factory', 'New Verified Factory: Guangzhou Electronics Co.', 'مصنع موثق جديد: شركة غوانغتشو للإلكترونيات', 'A new electronics manufacturer has been verified and is now accepting orders.', 'تم التحقق من مصنع إلكترونيات جديد وهو يقبل الطلبات الآن.', 'BuildingOffice2Icon', 'emerald', 'active', true, 1),
    ('new_rfq', 'New RFQ: 5,000 Units Stainless Steel Containers', 'طلب عرض سعر جديد: 5000 وحدة حاويات فولاذية', 'A buyer from UAE is requesting quotes for bulk stainless steel containers.', 'مشتري من الإمارات يطلب عروض أسعار لحاويات فولاذية بالجملة.', 'DocumentTextIcon', 'blue', 'active', true, 2),
    ('platform_news', 'DirectHub Now Supports 15 New Product Categories', 'دايركت هب يدعم الآن 15 فئة منتجات جديدة', 'We have expanded our marketplace with 15 new industrial product categories.', 'وسّعنا سوقنا بـ 15 فئة منتجات صناعية جديدة.', 'SparklesIcon', 'violet', 'active', false, 3)
  ON CONFLICT (id) DO NOTHING;

  -- Seed subscription record
  INSERT INTO public.platform_subscription (tier, plan_name, monthly_cost, storage_limit_gb, storage_used_gb, bandwidth_limit_gb, bandwidth_used_gb, max_users, max_products, renewal_date, provider, is_active)
  VALUES ('growth', 'Supabase Pro + Vercel Pro', 75.00, 100, 12.4, 500, 87.3, 50000, 100000, (CURRENT_DATE + INTERVAL '30 days')::DATE, 'Supabase + Vercel', true)
  ON CONFLICT (id) DO NOTHING;

  -- Seed sample error logs
  INSERT INTO public.system_error_logs (severity, error_code, title, description, affected_url, affected_component, resolution_action, status)
  VALUES
    ('warning', 'IMG_404', 'Broken product image link', 'Product image URL returning 404 on product ID #3821', '/product/3821', 'ProductCard', 'Re-upload image or update URL', 'open'),
    ('info', 'PERF_SLOW', 'Slow query on RFQ board', 'RFQ board query taking >2s on large datasets', '/rfq-board', 'RFQBoard', 'Add index on rfq_requests.created_at', 'open')
  ON CONFLICT (id) DO NOTHING;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Seed data insertion failed: %', SQLERRM;
END $$;
