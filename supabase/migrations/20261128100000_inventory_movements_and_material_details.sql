-- Inventory movements audit log + supplier/batch/COA details for raw materials

ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS supplier_name TEXT;
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS batch_number TEXT;
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS coa_url TEXT;
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS coa_name TEXT;

CREATE TABLE IF NOT EXISTS public.inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  manufacturer_id UUID NOT NULL,
  movement_type TEXT NOT NULL,
  quantity NUMERIC(14, 3) NOT NULL,
  balance_after NUMERIC(14, 3),
  reference TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_item_id ON public.inventory_movements(item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_manufacturer_id ON public.inventory_movements(manufacturer_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_created_at ON public.inventory_movements(created_at DESC);

ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inventory_movements_select_own_or_admin" ON public.inventory_movements;
CREATE POLICY "inventory_movements_select_own_or_admin"
  ON public.inventory_movements
  FOR SELECT
  TO authenticated
  USING (manufacturer_id = auth.uid() OR public.is_admin_user());

DROP POLICY IF EXISTS "inventory_movements_insert_own" ON public.inventory_movements;
CREATE POLICY "inventory_movements_insert_own"
  ON public.inventory_movements
  FOR INSERT
  TO authenticated
  WITH CHECK (manufacturer_id = auth.uid());

DROP POLICY IF EXISTS "inventory_movements_delete_own" ON public.inventory_movements;
CREATE POLICY "inventory_movements_delete_own"
  ON public.inventory_movements
  FOR DELETE
  TO authenticated
  USING (manufacturer_id = auth.uid() OR public.is_admin_user());
