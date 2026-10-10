-- ============================================================
-- Migration: Marketplace Growth Features
-- Timestamp: 20260815700000
-- Features: Product Reviews, Seller Analytics, Seller Profiles
-- ============================================================

-- ============================================================
-- 1. PRODUCT REVIEWS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.product_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id TEXT NOT NULL,
  reviewer_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  factory_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  quality_rating INTEGER CHECK (quality_rating >= 1 AND quality_rating <= 5),
  delivery_rating INTEGER CHECK (delivery_rating >= 1 AND delivery_rating <= 5),
  communication_rating INTEGER CHECK (communication_rating >= 1 AND communication_rating <= 5),
  order_type TEXT NOT NULL DEFAULT '',
  is_verified_purchase BOOLEAN NOT NULL DEFAULT false,
  helpful_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_reviews_unique
  ON public.product_reviews (product_id, reviewer_id);

CREATE INDEX IF NOT EXISTS idx_product_reviews_product_id
  ON public.product_reviews (product_id);

CREATE INDEX IF NOT EXISTS idx_product_reviews_factory_id
  ON public.product_reviews (factory_id);

-- ============================================================
-- 2. SELLER ANALYTICS TABLE (product views tracking)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.product_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id TEXT NOT NULL,
  factory_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  viewer_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  viewed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  source TEXT DEFAULT 'direct'
);

CREATE INDEX IF NOT EXISTS idx_product_views_product_id
  ON public.product_views (product_id);

CREATE INDEX IF NOT EXISTS idx_product_views_factory_id
  ON public.product_views (factory_id);

CREATE INDEX IF NOT EXISTS idx_product_views_viewed_at
  ON public.product_views (viewed_at);

-- ============================================================
-- 3. SELLER ANALYTICS SUMMARY TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.seller_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  period_date DATE NOT NULL,
  total_views INTEGER NOT NULL DEFAULT 0,
  unique_visitors INTEGER NOT NULL DEFAULT 0,
  total_orders INTEGER NOT NULL DEFAULT 0,
  total_revenue NUMERIC NOT NULL DEFAULT 0,
  total_rfqs INTEGER NOT NULL DEFAULT 0,
  avg_rating NUMERIC NOT NULL DEFAULT 0,
  review_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_seller_analytics_factory_date
  ON public.seller_analytics (factory_id, period_date);

CREATE INDEX IF NOT EXISTS idx_seller_analytics_factory_id
  ON public.seller_analytics (factory_id);

-- ============================================================
-- 4. UPDATED_AT TRIGGER (reuse or create)
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_product_reviews_updated_at ON public.product_reviews;
CREATE TRIGGER set_product_reviews_updated_at
  BEFORE UPDATE ON public.product_reviews
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_seller_analytics_updated_at ON public.seller_analytics;
CREATE TRIGGER set_seller_analytics_updated_at
  BEFORE UPDATE ON public.seller_analytics
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 5. FUNCTION: update product avg rating on manufacturer_products
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_product_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_product_id TEXT;
  v_avg_rating NUMERIC;
  v_review_count INTEGER;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_product_id := OLD.product_id;
  ELSE
    v_product_id := NEW.product_id;
  END IF;

  SELECT
    COALESCE(AVG(rating), 0),
    COUNT(*)
  INTO v_avg_rating, v_review_count
  FROM public.product_reviews
  WHERE product_id = v_product_id;

  -- Update manufacturer_products if table exists and has rating columns
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'manufacturer_products'
      AND column_name = 'avg_rating'
  ) THEN
    UPDATE public.manufacturer_products
    SET
      avg_rating = ROUND(v_avg_rating, 1),
      review_count = v_review_count,
      updated_at = CURRENT_TIMESTAMP
    WHERE id::TEXT = v_product_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_update_product_rating ON public.product_reviews;
CREATE TRIGGER trg_update_product_rating
  AFTER INSERT OR UPDATE OR DELETE ON public.product_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_product_rating();

-- ============================================================
-- 6. ADD RATING COLUMNS TO MANUFACTURER_PRODUCTS (if not exist)
-- ============================================================
ALTER TABLE public.manufacturer_products
  ADD COLUMN IF NOT EXISTS avg_rating NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0;

-- ============================================================
-- 7. ENABLE RLS
-- ============================================================
ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_analytics ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 8. RLS POLICIES — PRODUCT REVIEWS
-- ============================================================
DROP POLICY IF EXISTS "public_read_product_reviews" ON public.product_reviews;
CREATE POLICY "public_read_product_reviews"
  ON public.product_reviews
  FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "users_manage_own_product_reviews" ON public.product_reviews;
CREATE POLICY "users_manage_own_product_reviews"
  ON public.product_reviews
  FOR ALL
  TO authenticated
  USING (reviewer_id = auth.uid())
  WITH CHECK (reviewer_id = auth.uid());

-- ============================================================
-- 9. RLS POLICIES — PRODUCT VIEWS
-- ============================================================
DROP POLICY IF EXISTS "public_insert_product_views" ON public.product_views;
CREATE POLICY "public_insert_product_views"
  ON public.product_views
  FOR INSERT
  TO public
  WITH CHECK (true);

DROP POLICY IF EXISTS "factory_read_own_product_views" ON public.product_views;
CREATE POLICY "factory_read_own_product_views"
  ON public.product_views
  FOR SELECT
  TO authenticated
  USING (factory_id = auth.uid());

-- ============================================================
-- 10. RLS POLICIES — SELLER ANALYTICS
-- ============================================================
DROP POLICY IF EXISTS "factory_manage_own_analytics" ON public.seller_analytics;
CREATE POLICY "factory_manage_own_analytics"
  ON public.seller_analytics
  FOR ALL
  TO authenticated
  USING (factory_id = auth.uid())
  WITH CHECK (factory_id = auth.uid());
