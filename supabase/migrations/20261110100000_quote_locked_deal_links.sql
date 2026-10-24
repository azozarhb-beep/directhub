-- Migration: B2B Locked Deal Links & Quote-to-Escrow pipeline
-- Timestamp: 20261110100000

-- ============================================================
-- 1. custom_quotes: deal-link columns
-- ============================================================
ALTER TABLE public.custom_quotes
  ADD COLUMN IF NOT EXISTS public_token TEXT,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  ADD COLUMN IF NOT EXISTS checkout_order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_mode TEXT DEFAULT 'escrow',
  ADD COLUMN IF NOT EXISTS product_title TEXT;

-- Standalone deal links can be created before the buyer is known;
-- the buyer is bound when they open the link and start checkout.
ALTER TABLE public.custom_quotes
  ALTER COLUMN buyer_user_id DROP NOT NULL;

-- ============================================================
-- 2. Token generation function + trigger
-- ============================================================
CREATE OR REPLACE FUNCTION public.generate_quote_public_token()
RETURNS TEXT
LANGUAGE sql
VOLATILE
AS $$
  SELECT replace(gen_random_uuid()::text, '-', '') || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)
$$;

CREATE OR REPLACE FUNCTION public.trg_custom_quotes_set_public_token()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.public_token IS NULL OR NEW.public_token = '' THEN
    NEW.public_token := public.generate_quote_public_token();
  END IF;
  IF NEW.expires_at IS NULL THEN
    NEW.expires_at := NOW() + INTERVAL '7 days';
  END IF;
  IF NEW.payment_mode IS NULL THEN
    NEW.payment_mode := 'escrow';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_custom_quotes_set_public_token ON public.custom_quotes;
CREATE TRIGGER trg_custom_quotes_set_public_token
BEFORE INSERT ON public.custom_quotes
FOR EACH ROW
EXECUTE FUNCTION public.trg_custom_quotes_set_public_token();

-- Backfill tokens for existing quotes
UPDATE public.custom_quotes
SET public_token = public.generate_quote_public_token()
WHERE public_token IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_custom_quotes_public_token
  ON public.custom_quotes(public_token);
CREATE INDEX IF NOT EXISTS idx_custom_quotes_checkout_order_id
  ON public.custom_quotes(checkout_order_id);
CREATE INDEX IF NOT EXISTS idx_custom_quotes_expires_at
  ON public.custom_quotes(expires_at);

-- ============================================================
-- 3. Public read-only deal summary (token-gated, no commission data)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_deal_by_token(p_token TEXT)
RETURNS TABLE (
  id UUID,
  public_token TEXT,
  status TEXT,
  quoted_price NUMERIC,
  currency TEXT,
  quantity INTEGER,
  delivery_days INTEGER,
  payment_terms TEXT,
  notes TEXT,
  shipping_type TEXT,
  incoterm TEXT,
  port_of_loading TEXT,
  product_title TEXT,
  expires_at TIMESTAMPTZ,
  is_expired BOOLEAN,
  checkout_order_id UUID,
  payment_mode TEXT,
  buyer_user_id UUID,
  factory_user_id UUID,
  factory_name TEXT,
  factory_verified BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    q.id,
    q.public_token,
    q.status::TEXT,
    q.quoted_price,
    q.currency::TEXT,
    q.quantity,
    q.delivery_days,
    q.payment_terms::TEXT,
    q.notes::TEXT,
    q.shipping_type::TEXT,
    q.incoterm::TEXT,
    q.port_of_loading::TEXT,
    q.product_title::TEXT,
    q.expires_at,
    (q.expires_at IS NOT NULL AND q.expires_at < NOW()) AS is_expired,
    q.checkout_order_id,
    q.payment_mode::TEXT,
    q.buyer_user_id,
    q.factory_user_id,
    COALESCE(NULLIF(up.company_name, ''), NULLIF(up.full_name, ''), 'DirectHub Factory')::TEXT AS factory_name,
    (COALESCE(up.is_verified, false)) AS factory_verified
  FROM public.custom_quotes q
  LEFT JOIN public.user_profiles up ON up.id = q.factory_user_id
  WHERE q.public_token = p_token
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_deal_by_token(TEXT) TO anon, authenticated;

-- ============================================================
-- 4. payment_receipts storage bucket
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'payment_receipts',
  'payment_receipts',
  true,
  10485760,
  ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/gif','image/heic','image/heif','application/pdf']
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "payment_receipts_public_read" ON storage.objects;
CREATE POLICY "payment_receipts_public_read"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'payment_receipts');

DROP POLICY IF EXISTS "payment_receipts_auth_insert" ON storage.objects;
CREATE POLICY "payment_receipts_auth_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'payment_receipts');

DROP POLICY IF EXISTS "payment_receipts_auth_update" ON storage.objects;
CREATE POLICY "payment_receipts_auth_update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'payment_receipts' AND owner = auth.uid())
WITH CHECK (bucket_id = 'payment_receipts' AND owner = auth.uid());
