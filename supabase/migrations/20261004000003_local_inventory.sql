-- Migration: local_inventory table for local supplier/factory operations
-- Timestamp: 20261004000003

-- ─── Create local_inventory table ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.local_inventory (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id        UUID        REFERENCES public.manufacturer_products(id) ON DELETE SET NULL,
  sku               TEXT        NOT NULL,
  warehouse_location TEXT,
  stock_quantity    INTEGER     NOT NULL DEFAULT 0,
  reorder_level     INTEGER     NOT NULL DEFAULT 0,
  batch_number      TEXT,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_local_inventory_supplier_id ON public.local_inventory(supplier_id);
CREATE INDEX IF NOT EXISTS idx_local_inventory_product_id  ON public.local_inventory(product_id);
CREATE INDEX IF NOT EXISTS idx_local_inventory_sku         ON public.local_inventory(sku);

-- ─── Auto-update updated_at ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_local_inventory_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_local_inventory_updated_at ON public.local_inventory;
CREATE TRIGGER trg_local_inventory_updated_at
  BEFORE UPDATE ON public.local_inventory
  FOR EACH ROW
  EXECUTE FUNCTION public.set_local_inventory_updated_at();

-- ─── Admin helper (queries auth.users metadata — no recursion risk) ────────────
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users au
    WHERE au.id = auth.uid()
      AND (
        au.raw_user_meta_data->>'role' = 'admin'
        OR au.raw_app_meta_data->>'role' = 'admin'
      )
  )
$$;

-- ─── Enable RLS ───────────────────────────────────────────────────────────────
ALTER TABLE public.local_inventory ENABLE ROW LEVEL SECURITY;

-- ─── Supplier: full CRUD on own records ───────────────────────────────────────
DROP POLICY IF EXISTS "suppliers_manage_own_local_inventory" ON public.local_inventory;
CREATE POLICY "suppliers_manage_own_local_inventory"
  ON public.local_inventory
  FOR ALL
  TO authenticated
  USING (supplier_id = auth.uid())
  WITH CHECK (supplier_id = auth.uid());

-- ─── Admin: read all records ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "admins_view_all_local_inventory" ON public.local_inventory;
CREATE POLICY "admins_view_all_local_inventory"
  ON public.local_inventory
  FOR SELECT
  TO authenticated
  USING (public.is_admin_user());
