-- ============================================================
-- Migration: Cart Items + Supplier Reviews
-- Timestamp: 20260810200000
-- ============================================================

-- ============================================================
-- 1. CART ITEMS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL DEFAULT '',
  product_name_ar TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  image_alt TEXT NOT NULL DEFAULT '',
  unit_price NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  moq TEXT NOT NULL DEFAULT '',
  quantity INTEGER NOT NULL DEFAULT 1,
  supplier_name TEXT NOT NULL DEFAULT '',
  supplier_country_flag TEXT NOT NULL DEFAULT '',
  is_verified BOOLEAN NOT NULL DEFAULT false,
  category TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cart_items_user_product
  ON public.cart_items (user_id, product_id);

CREATE INDEX IF NOT EXISTS idx_cart_items_user_id
  ON public.cart_items (user_id);

-- ============================================================
-- 2. SUPPLIER REVIEWS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.supplier_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES public.supplier_profiles(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  order_type TEXT NOT NULL DEFAULT '',
  is_verified_purchase BOOLEAN NOT NULL DEFAULT false,
  helpful_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_supplier_reviews_unique
  ON public.supplier_reviews (supplier_id, reviewer_id);

CREATE INDEX IF NOT EXISTS idx_supplier_reviews_supplier_id
  ON public.supplier_reviews (supplier_id);

CREATE INDEX IF NOT EXISTS idx_supplier_reviews_reviewer_id
  ON public.supplier_reviews (reviewer_id);

-- ============================================================
-- 3. UPDATED_AT TRIGGER FUNCTION (reuse if exists)
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

DROP TRIGGER IF EXISTS set_cart_items_updated_at ON public.cart_items;
CREATE TRIGGER set_cart_items_updated_at
  BEFORE UPDATE ON public.cart_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_supplier_reviews_updated_at ON public.supplier_reviews;
CREATE TRIGGER set_supplier_reviews_updated_at
  BEFORE UPDATE ON public.supplier_reviews
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 4. FUNCTION: recalculate supplier rating after review change
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_supplier_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_supplier_id UUID;
  v_avg_rating NUMERIC;
  v_review_count INTEGER;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_supplier_id := OLD.supplier_id;
  ELSE
    v_supplier_id := NEW.supplier_id;
  END IF;

  SELECT
    COALESCE(AVG(rating), 0),
    COUNT(*)
  INTO v_avg_rating, v_review_count
  FROM public.supplier_reviews
  WHERE supplier_id = v_supplier_id;

  UPDATE public.supplier_profiles
  SET
    rating = ROUND(v_avg_rating, 1),
    review_count = v_review_count,
    updated_at = CURRENT_TIMESTAMP
  WHERE id = v_supplier_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_update_supplier_rating ON public.supplier_reviews;
CREATE TRIGGER trg_update_supplier_rating
  AFTER INSERT OR UPDATE OR DELETE ON public.supplier_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_supplier_rating();

-- ============================================================
-- 5. ENABLE RLS
-- ============================================================
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_reviews ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 6. RLS POLICIES — CART ITEMS
-- ============================================================
DROP POLICY IF EXISTS "users_manage_own_cart_items" ON public.cart_items;
CREATE POLICY "users_manage_own_cart_items"
  ON public.cart_items
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- 7. RLS POLICIES — SUPPLIER REVIEWS
-- ============================================================
DROP POLICY IF EXISTS "public_read_supplier_reviews" ON public.supplier_reviews;
CREATE POLICY "public_read_supplier_reviews"
  ON public.supplier_reviews
  FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "users_manage_own_supplier_reviews" ON public.supplier_reviews;
CREATE POLICY "users_manage_own_supplier_reviews"
  ON public.supplier_reviews
  FOR ALL
  TO authenticated
  USING (reviewer_id = auth.uid())
  WITH CHECK (reviewer_id = auth.uid());

-- ============================================================
-- 8. SAMPLE REVIEWS (mock data)
-- ============================================================
DO $$
DECLARE
  v_supplier_id UUID;
  v_reviewer_id UUID;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'supplier_profiles'
  ) THEN
    SELECT id INTO v_supplier_id FROM public.supplier_profiles LIMIT 1;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_profiles'
  ) THEN
    SELECT id INTO v_reviewer_id FROM public.user_profiles LIMIT 1;
  END IF;

  IF v_supplier_id IS NOT NULL AND v_reviewer_id IS NOT NULL THEN
    INSERT INTO public.supplier_reviews
      (id, supplier_id, reviewer_id, rating, title, body, order_type, is_verified_purchase)
    VALUES
      (gen_random_uuid(), v_supplier_id, v_reviewer_id, 5,
       'Excellent quality and fast shipping',
       'We ordered a large batch and the quality exceeded our expectations. Communication was smooth throughout the process.',
       'Bulk Order', true)
    ON CONFLICT (supplier_id, reviewer_id) DO NOTHING;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Mock data insertion skipped: %', SQLERRM;
END $$;
