-- Supplier direct / independent (offline B2B) shipments. Supplier-only table.

CREATE TABLE IF NOT EXISTS public.supplier_direct_shipments (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id        UUID        NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  recipient_name     TEXT        NOT NULL,
  recipient_phone    TEXT        NOT NULL,
  destination_province TEXT      NOT NULL,
  destination_city   TEXT,
  delivery_method    TEXT        NOT NULL DEFAULT 'carrier_office',
  carrier_name       TEXT,
  waybill_number     TEXT,
  freight_payment    TEXT,
  waybill_image_url  TEXT,
  handover_mode      TEXT        NOT NULL DEFAULT 'pin',
  delivery_pin       TEXT,
  units              INTEGER,
  unit_label         TEXT,
  estimated_delivery DATE,
  status             TEXT        NOT NULL DEFAULT 'shipped',
  notes              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.supplier_direct_shipments
  DROP CONSTRAINT IF EXISTS supplier_direct_shipments_method_check;
ALTER TABLE public.supplier_direct_shipments
  ADD CONSTRAINT supplier_direct_shipments_method_check
  CHECK (delivery_method IN ('carrier_office', 'supplier_fleet', 'warehouse_pickup'));

ALTER TABLE public.supplier_direct_shipments
  DROP CONSTRAINT IF EXISTS supplier_direct_shipments_freight_check;
ALTER TABLE public.supplier_direct_shipments
  ADD CONSTRAINT supplier_direct_shipments_freight_check
  CHECK (freight_payment IS NULL OR freight_payment IN ('freight_collect', 'prepaid_by_supplier'));

ALTER TABLE public.supplier_direct_shipments
  DROP CONSTRAINT IF EXISTS supplier_direct_shipments_handover_check;
ALTER TABLE public.supplier_direct_shipments
  ADD CONSTRAINT supplier_direct_shipments_handover_check
  CHECK (handover_mode IN ('pin', 'pod'));

CREATE INDEX IF NOT EXISTS idx_supplier_direct_shipments_supplier_id
  ON public.supplier_direct_shipments(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_direct_shipments_created_at
  ON public.supplier_direct_shipments(created_at DESC);

ALTER TABLE public.supplier_direct_shipments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "suppliers_manage_own_supplier_direct_shipments" ON public.supplier_direct_shipments;
CREATE POLICY "suppliers_manage_own_supplier_direct_shipments"
  ON public.supplier_direct_shipments
  FOR ALL
  TO authenticated
  USING (supplier_id = auth.uid())
  WITH CHECK (supplier_id = auth.uid());
