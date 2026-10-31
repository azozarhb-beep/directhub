-- Supplier warehouse inventory: valuation, lifecycle/expiry, brand, and catalog sync (supplier-only table)

ALTER TABLE public.local_inventory
  ADD COLUMN IF NOT EXISTS unit_cost NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS cost_currency TEXT NOT NULL DEFAULT 'YER',
  ADD COLUMN IF NOT EXISTS inward_date DATE,
  ADD COLUMN IF NOT EXISTS expiry_date DATE,
  ADD COLUMN IF NOT EXISTS brand TEXT,
  ADD COLUMN IF NOT EXISTS sync_to_store BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS supplier_product_id UUID REFERENCES public.supplier_products(id) ON DELETE SET NULL;

ALTER TABLE public.local_inventory
  DROP CONSTRAINT IF EXISTS local_inventory_cost_currency_check;
ALTER TABLE public.local_inventory
  ADD CONSTRAINT local_inventory_cost_currency_check
  CHECK (cost_currency IN ('YER', 'SAR', 'USD'));

CREATE INDEX IF NOT EXISTS idx_local_inventory_expiry_date ON public.local_inventory(expiry_date);
CREATE INDEX IF NOT EXISTS idx_local_inventory_supplier_product_id ON public.local_inventory(supplier_product_id);
