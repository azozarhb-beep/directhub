-- ─────────────────────────────────────────────────────────────────────────────
-- Smart RFQ Routing & Supplier Matching System
-- Stores AI-generated routing decisions, supplier match scores, and routing logs
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. RFQ routing results table
CREATE TABLE IF NOT EXISTS public.rfq_routing_results (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id              UUID REFERENCES public.rfq_requests(id) ON DELETE CASCADE,
  ai_classification   TEXT,                        -- AI-detected product category/sector
  ai_sector           TEXT,                        -- Broad sector (e.g. "textiles", "metals")
  ai_keywords         TEXT[],                      -- Extracted keywords from RFQ
  ai_language         TEXT DEFAULT 'ar',           -- Detected language of RFQ
  ai_translated_text  TEXT,                        -- English translation of RFQ (if non-English)
  routing_status      TEXT DEFAULT 'pending'       -- pending | routed | failed
    CHECK (routing_status IN ('pending', 'routed', 'failed')),
  matched_supplier_ids UUID[],                     -- Array of matched supplier/factory IDs
  match_scores        JSONB DEFAULT '[]'::JSONB,   -- [{supplier_id, score, reason}]
  total_matched       INTEGER DEFAULT 0,
  routed_at           TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Supplier specialization profiles (enriches factory_registrations with AI-matched sectors)
CREATE TABLE IF NOT EXISTS public.supplier_specializations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id     UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  sectors         TEXT[],                          -- e.g. ['textiles', 'apparel', 'uniforms']
  keywords        TEXT[],                          -- product keywords they handle
  product_lines   TEXT[],                          -- specific product lines
  certifications  TEXT[],                          -- ISO, CE, Halal, etc.
  countries       TEXT[],                          -- countries they supply to
  min_order_value NUMERIC DEFAULT 0,
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 3. RFQ routing notifications (tracks which suppliers were notified)
CREATE TABLE IF NOT EXISTS public.rfq_routing_notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id          UUID REFERENCES public.rfq_requests(id) ON DELETE CASCADE,
  routing_id      UUID REFERENCES public.rfq_routing_results(id) ON DELETE CASCADE,
  supplier_id     UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  match_score     NUMERIC DEFAULT 0,
  match_reason    TEXT,
  notified_at     TIMESTAMPTZ DEFAULT NOW(),
  is_read         BOOLEAN DEFAULT FALSE,
  read_at         TIMESTAMPTZ
);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_rfq_routing_results_rfq_id
  ON public.rfq_routing_results(rfq_id);

CREATE INDEX IF NOT EXISTS idx_rfq_routing_results_status
  ON public.rfq_routing_results(routing_status);

CREATE INDEX IF NOT EXISTS idx_supplier_specializations_supplier_id
  ON public.supplier_specializations(supplier_id);

CREATE INDEX IF NOT EXISTS idx_rfq_routing_notifications_rfq_id
  ON public.rfq_routing_notifications(rfq_id);

CREATE INDEX IF NOT EXISTS idx_rfq_routing_notifications_supplier_id
  ON public.rfq_routing_notifications(supplier_id);

-- 5. Add routing columns to rfq_requests if not present
ALTER TABLE public.rfq_requests
  ADD COLUMN IF NOT EXISTS ai_routed        BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS ai_sector        TEXT,
  ADD COLUMN IF NOT EXISTS ai_classification TEXT,
  ADD COLUMN IF NOT EXISTS routing_id       UUID;

-- 6. Enable RLS
ALTER TABLE public.rfq_routing_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_specializations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rfq_routing_notifications ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies

-- rfq_routing_results: admin full access, buyers can see their own RFQ routing
DROP POLICY IF EXISTS "admin_full_rfq_routing_results" ON public.rfq_routing_results;
CREATE POLICY "admin_full_rfq_routing_results"
  ON public.rfq_routing_results FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users au
      WHERE au.id = auth.uid()
        AND (au.raw_user_meta_data->>'role' = 'admin'
          OR au.raw_app_meta_data->>'role' = 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users au
      WHERE au.id = auth.uid()
        AND (au.raw_user_meta_data->>'role' = 'admin'
          OR au.raw_app_meta_data->>'role' = 'admin')
    )
  );

DROP POLICY IF EXISTS "buyers_view_own_rfq_routing" ON public.rfq_routing_results;
CREATE POLICY "buyers_view_own_rfq_routing"
  ON public.rfq_routing_results FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.rfq_requests r
      WHERE r.id = rfq_id AND r.buyer_id = auth.uid()
    )
  );

-- supplier_specializations: suppliers manage own, admin full access
DROP POLICY IF EXISTS "suppliers_manage_own_specializations" ON public.supplier_specializations;
CREATE POLICY "suppliers_manage_own_specializations"
  ON public.supplier_specializations FOR ALL TO authenticated
  USING (supplier_id = auth.uid())
  WITH CHECK (supplier_id = auth.uid());

DROP POLICY IF EXISTS "admin_full_supplier_specializations" ON public.supplier_specializations;
CREATE POLICY "admin_full_supplier_specializations"
  ON public.supplier_specializations FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users au
      WHERE au.id = auth.uid()
        AND (au.raw_user_meta_data->>'role' = 'admin'
          OR au.raw_app_meta_data->>'role' = 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users au
      WHERE au.id = auth.uid()
        AND (au.raw_user_meta_data->>'role' = 'admin'
          OR au.raw_app_meta_data->>'role' = 'admin')
    )
  );

-- rfq_routing_notifications: suppliers see their own, admin sees all
DROP POLICY IF EXISTS "suppliers_view_own_routing_notifications" ON public.rfq_routing_notifications;
CREATE POLICY "suppliers_view_own_routing_notifications"
  ON public.rfq_routing_notifications FOR SELECT TO authenticated
  USING (supplier_id = auth.uid());

DROP POLICY IF EXISTS "admin_full_routing_notifications" ON public.rfq_routing_notifications;
CREATE POLICY "admin_full_routing_notifications"
  ON public.rfq_routing_notifications FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users au
      WHERE au.id = auth.uid()
        AND (au.raw_user_meta_data->>'role' = 'admin'
          OR au.raw_app_meta_data->>'role' = 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users au
      WHERE au.id = auth.uid()
        AND (au.raw_user_meta_data->>'role' = 'admin'
          OR au.raw_app_meta_data->>'role' = 'admin')
    )
  );

DROP POLICY IF EXISTS "system_insert_routing_notifications" ON public.rfq_routing_notifications;
CREATE POLICY "system_insert_routing_notifications"
  ON public.rfq_routing_notifications FOR INSERT TO authenticated
  WITH CHECK (is_admin_user());
