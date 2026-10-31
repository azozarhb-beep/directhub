-- Raw materials / production inventory for manufacturers (vendor = manufacturer_id)
CREATE TABLE IF NOT EXISTS public.inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manufacturer_id UUID NOT NULL,
  vendor_id UUID,
  material_name TEXT NOT NULL,
  material_name_ar TEXT,
  material_code TEXT,
  category TEXT NOT NULL DEFAULT 'raw_material',
  unit TEXT NOT NULL DEFAULT 'kg',
  quantity_available NUMERIC(14, 3) NOT NULL DEFAULT 0,
  reorder_level NUMERIC(14, 3),
  unit_cost NUMERIC(14, 2),
  currency TEXT NOT NULL DEFAULT 'USD',
  warehouse_location TEXT,
  supplier_name TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS vendor_id UUID;
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS material_code TEXT;
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS reorder_level NUMERIC(14, 3);
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS warehouse_location TEXT;
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'USD';

CREATE INDEX IF NOT EXISTS idx_inventory_items_manufacturer_id ON public.inventory_items(manufacturer_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_created_at ON public.inventory_items(created_at DESC);

CREATE OR REPLACE FUNCTION public.inventory_items_sync_vendor()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $fn$
BEGIN
  IF NEW.vendor_id IS NULL THEN
    NEW.vendor_id := NEW.manufacturer_id;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$fn$;

ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inventory_items_select_own_or_admin" ON public.inventory_items;
CREATE POLICY "inventory_items_select_own_or_admin"
  ON public.inventory_items
  FOR SELECT
  TO authenticated
  USING (manufacturer_id = auth.uid() OR public.is_admin_user());

DROP POLICY IF EXISTS "inventory_items_insert_own" ON public.inventory_items;
CREATE POLICY "inventory_items_insert_own"
  ON public.inventory_items
  FOR INSERT
  TO authenticated
  WITH CHECK (manufacturer_id = auth.uid());

DROP POLICY IF EXISTS "inventory_items_update_own" ON public.inventory_items;
CREATE POLICY "inventory_items_update_own"
  ON public.inventory_items
  FOR UPDATE
  TO authenticated
  USING (manufacturer_id = auth.uid() OR public.is_admin_user())
  WITH CHECK (manufacturer_id = auth.uid() OR public.is_admin_user());

DROP POLICY IF EXISTS "inventory_items_delete_own" ON public.inventory_items;
CREATE POLICY "inventory_items_delete_own"
  ON public.inventory_items
  FOR DELETE
  TO authenticated
  USING (manufacturer_id = auth.uid() OR public.is_admin_user());

DROP TRIGGER IF EXISTS trg_inventory_items_sync_vendor ON public.inventory_items;
CREATE TRIGGER trg_inventory_items_sync_vendor
  BEFORE INSERT OR UPDATE ON public.inventory_items
  FOR EACH ROW EXECUTE FUNCTION public.inventory_items_sync_vendor();
