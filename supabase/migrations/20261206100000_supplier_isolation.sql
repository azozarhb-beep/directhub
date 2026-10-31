-- Supplier isolation: dedicated tables for /supplier.
-- Does NOT alter or drop manufacturer_products, inventory_items or factory_documents.

-- ─── 1. local_inventory: commercial unit + product name (supplier-only table) ──
ALTER TABLE public.local_inventory
  ADD COLUMN IF NOT EXISTS item_name TEXT,
  ADD COLUMN IF NOT EXISTS unit TEXT NOT NULL DEFAULT 'piece',
  ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE public.local_inventory
  DROP CONSTRAINT IF EXISTS local_inventory_unit_check;
ALTER TABLE public.local_inventory
  ADD CONSTRAINT local_inventory_unit_check
  CHECK (unit IN ('carton', 'bale', 'bundle', 'dozen', 'bag', 'roll', 'piece', 'kg', 'ton'));

-- ─── 2. supplier_products ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.supplier_products (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id    UUID        NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  name           TEXT        NOT NULL,
  name_ar        TEXT,
  sku            TEXT,
  category       TEXT,
  description    TEXT,
  unit           TEXT        NOT NULL DEFAULT 'piece',
  wholesale_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  retail_price   NUMERIC(14,2),
  currency       TEXT        NOT NULL DEFAULT 'YER',
  min_order_qty  INTEGER     NOT NULL DEFAULT 1,
  stock_quantity INTEGER     NOT NULL DEFAULT 0,
  image_url      TEXT,
  status         TEXT        NOT NULL DEFAULT 'active',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.supplier_products
  DROP CONSTRAINT IF EXISTS supplier_products_unit_check;
ALTER TABLE public.supplier_products
  ADD CONSTRAINT supplier_products_unit_check
  CHECK (unit IN ('carton', 'bale', 'bundle', 'dozen', 'bag', 'roll', 'piece', 'kg', 'ton'));

ALTER TABLE public.supplier_products
  DROP CONSTRAINT IF EXISTS supplier_products_status_check;
ALTER TABLE public.supplier_products
  ADD CONSTRAINT supplier_products_status_check
  CHECK (status IN ('active', 'draft', 'archived'));

CREATE INDEX IF NOT EXISTS idx_supplier_products_supplier_id ON public.supplier_products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_products_status ON public.supplier_products(status);

-- ─── 3. supplier_documents (one row per supplier) ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.supplier_documents (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id              UUID        NOT NULL UNIQUE REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  commercial_register_number TEXT,
  commercial_register_url  TEXT,
  agency_authorization_url TEXT,
  agency_authorization_note TEXT,
  trade_name               TEXT,
  tax_id                   TEXT,
  field_agent_code         TEXT,
  verification_status      TEXT        NOT NULL DEFAULT 'pending',
  reject_reason            TEXT,
  verified_at              TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.supplier_documents
  DROP CONSTRAINT IF EXISTS supplier_documents_status_check;
ALTER TABLE public.supplier_documents
  ADD CONSTRAINT supplier_documents_status_check
  CHECK (verification_status IN ('pending', 'approved', 'rejected'));

CREATE INDEX IF NOT EXISTS idx_supplier_documents_supplier_id ON public.supplier_documents(supplier_id);

-- ─── 4. updated_at triggers ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_supplier_tables_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ─── 5. RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE public.supplier_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "suppliers_manage_own_supplier_products" ON public.supplier_products;
CREATE POLICY "suppliers_manage_own_supplier_products"
  ON public.supplier_products
  FOR ALL
  TO authenticated
  USING (supplier_id = auth.uid())
  WITH CHECK (supplier_id = auth.uid());

DROP POLICY IF EXISTS "admins_view_all_supplier_products" ON public.supplier_products;
CREATE POLICY "admins_view_all_supplier_products"
  ON public.supplier_products
  FOR SELECT
  TO authenticated
  USING (public.is_admin_user());

DROP POLICY IF EXISTS "public_read_active_supplier_products" ON public.supplier_products;
CREATE POLICY "public_read_active_supplier_products"
  ON public.supplier_products
  FOR SELECT
  TO anon
  USING (status = 'active');

DROP POLICY IF EXISTS "suppliers_manage_own_supplier_documents" ON public.supplier_documents;
CREATE POLICY "suppliers_manage_own_supplier_documents"
  ON public.supplier_documents
  FOR ALL
  TO authenticated
  USING (supplier_id = auth.uid())
  WITH CHECK (supplier_id = auth.uid());

DROP POLICY IF EXISTS "admins_manage_all_supplier_documents" ON public.supplier_documents;
CREATE POLICY "admins_manage_all_supplier_documents"
  ON public.supplier_documents
  FOR ALL
  TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- ─── 6. Triggers ──────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_supplier_products_updated_at ON public.supplier_products;
CREATE TRIGGER trg_supplier_products_updated_at
  BEFORE UPDATE ON public.supplier_products
  FOR EACH ROW
  EXECUTE FUNCTION public.set_supplier_tables_updated_at();

DROP TRIGGER IF EXISTS trg_supplier_documents_updated_at ON public.supplier_documents;
CREATE TRIGGER trg_supplier_documents_updated_at
  BEFORE UPDATE ON public.supplier_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.set_supplier_tables_updated_at();

NOTIFY pgrst, 'reload schema';
