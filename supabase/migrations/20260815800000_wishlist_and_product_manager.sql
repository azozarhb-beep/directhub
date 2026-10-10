-- Migration: Wishlist and Seller Product Manager enhancements
-- Timestamp: 20260815800000

-- ─── Wishlist Table ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.wishlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('product', 'seller')),
  product_id UUID REFERENCES public.manufacturer_products(id) ON DELETE CASCADE,
  seller_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wishlists_user_id ON public.wishlists(user_id);
CREATE INDEX IF NOT EXISTS idx_wishlists_product_id ON public.wishlists(product_id);
CREATE INDEX IF NOT EXISTS idx_wishlists_seller_id ON public.wishlists(seller_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_wishlists_user_product ON public.wishlists(user_id, product_id) WHERE product_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_wishlists_user_seller ON public.wishlists(user_id, seller_id) WHERE seller_id IS NOT NULL;

ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_manage_own_wishlists" ON public.wishlists;
CREATE POLICY "users_manage_own_wishlists"
ON public.wishlists FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "public_read_wishlists" ON public.wishlists;
CREATE POLICY "public_read_wishlists"
ON public.wishlists FOR SELECT TO public
USING (true);

-- ─── Product Images Table (for multi-image support in product manager) ────────
ALTER TABLE public.manufacturer_products
ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS certifications TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS delivery_time_days INTEGER,
ADD COLUMN IF NOT EXISTS weight_kg NUMERIC,
ADD COLUMN IF NOT EXISTS dimensions TEXT,
ADD COLUMN IF NOT EXISTS warranty_months INTEGER,
ADD COLUMN IF NOT EXISTS sample_available BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS sample_price NUMERIC;
