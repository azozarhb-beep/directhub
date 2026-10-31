-- Supplier product performance: view counter + atomic increment function

ALTER TABLE public.supplier_products
  ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_supplier_products_view_count
  ON public.supplier_products(supplier_id, view_count DESC);

CREATE OR REPLACE FUNCTION public.increment_supplier_product_view(p_product_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.supplier_products
  SET view_count = view_count + 1
  WHERE id = p_product_id
    AND status = 'active';
$$;

GRANT EXECUTE ON FUNCTION public.increment_supplier_product_view(UUID) TO anon, authenticated;
