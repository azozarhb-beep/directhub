-- B2B Purchase Order lifecycle: draft -> submitted -> confirmed -> fulfillment
-- Linked to public.orders and public.international_shipments.

-- 1. Table -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number TEXT NOT NULL,
  buyer_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  factory_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  shipment_id UUID REFERENCES public.international_shipments(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  title TEXT,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  incoterm TEXT,
  notes TEXT,
  submitted_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  fulfillment_started_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.purchase_orders
  DROP CONSTRAINT IF EXISTS purchase_orders_status_check;
ALTER TABLE public.purchase_orders
  ADD CONSTRAINT purchase_orders_status_check CHECK (status IN ('draft', 'submitted', 'confirmed', 'fulfillment', 'cancelled'));

CREATE UNIQUE INDEX IF NOT EXISTS uq_purchase_orders_po_number ON public.purchase_orders(po_number);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_buyer ON public.purchase_orders(buyer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_factory ON public.purchase_orders(factory_id, status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_order ON public.purchase_orders(order_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_shipment ON public.purchase_orders(shipment_id);

CREATE TABLE IF NOT EXISTS public.purchase_order_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  actor_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_purchase_order_events_po ON public.purchase_order_events(purchase_order_id, created_at DESC);

-- 2. Functions (before policies) ---------------------------------------------

CREATE OR REPLACE FUNCTION public.generate_po_number()
RETURNS TEXT
LANGUAGE sql
VOLATILE
AS $func$
SELECT 'PO-' || to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::TEXT, '-', ''), 1, 6))
$func$;

CREATE OR REPLACE FUNCTION public.po_is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
SELECT EXISTS (
  SELECT 1 FROM public.user_profiles up WHERE up.id = auth.uid() AND up.role = 'admin'
)
$func$;

-- State machine guard: enforces allowed transitions and stamps lifecycle timestamps
CREATE OR REPLACE FUNCTION public.purchase_orders_state_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $func$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.po_number IS NULL OR length(trim(NEW.po_number)) = 0 THEN
      NEW.po_number := public.generate_po_number();
    END IF;
    NEW.status := 'draft';
    RETURN NEW;
  END IF;

  NEW.updated_at := CURRENT_TIMESTAMP;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT (
      (OLD.status = 'draft' AND NEW.status IN ('submitted', 'cancelled')) OR
      (OLD.status = 'submitted' AND NEW.status IN ('confirmed', 'cancelled')) OR
      (OLD.status = 'confirmed' AND NEW.status IN ('fulfillment', 'cancelled'))
    ) THEN
      RAISE EXCEPTION 'Invalid purchase order transition: % -> %', OLD.status, NEW.status USING ERRCODE = '22023';
    END IF;

    IF NEW.status = 'submitted' THEN
      IF NEW.factory_id IS NULL THEN
        RAISE EXCEPTION 'A factory must be selected before submitting a purchase order' USING ERRCODE = '22023';
      END IF;
      IF jsonb_typeof(NEW.items) <> 'array' OR jsonb_array_length(NEW.items) = 0 THEN
        RAISE EXCEPTION 'A purchase order needs at least one line item' USING ERRCODE = '22023';
      END IF;
      NEW.submitted_at := COALESCE(NEW.submitted_at, CURRENT_TIMESTAMP);
    ELSIF NEW.status = 'confirmed' THEN
      NEW.confirmed_at := COALESCE(NEW.confirmed_at, CURRENT_TIMESTAMP);
    ELSIF NEW.status = 'fulfillment' THEN
      NEW.fulfillment_started_at := COALESCE(NEW.fulfillment_started_at, CURRENT_TIMESTAMP);
    END IF;
  ELSE
    -- Frozen after submission: commercial terms are immutable once past draft
    IF OLD.status <> 'draft' AND (
      NEW.items IS DISTINCT FROM OLD.items OR
      NEW.total_amount IS DISTINCT FROM OLD.total_amount OR
      NEW.currency IS DISTINCT FROM OLD.currency OR
      NEW.factory_id IS DISTINCT FROM OLD.factory_id OR
      NEW.buyer_id IS DISTINCT FROM OLD.buyer_id
    ) THEN
      RAISE EXCEPTION 'Purchase order terms are locked after submission' USING ERRCODE = '22023';
    END IF;
  END IF;

  RETURN NEW;
END;
$func$;

-- Event log + order/shipment propagation
CREATE OR REPLACE FUNCTION public.purchase_orders_after_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.purchase_order_events (purchase_order_id, from_status, to_status, actor_id, note)
    VALUES (NEW.id, NULL, NEW.status, auth.uid(), 'Purchase order created');
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.purchase_order_events (purchase_order_id, from_status, to_status, actor_id, note)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid(), 'Status changed to ' || NEW.status);

    IF NEW.status = 'fulfillment' THEN
      IF NEW.order_id IS NOT NULL THEN
        INSERT INTO public.order_status_history (order_id, status, note)
        VALUES (NEW.order_id, 'processing', 'Purchase order ' || NEW.po_number || ' entered fulfillment');
      END IF;
      IF NEW.shipment_id IS NOT NULL THEN
        UPDATE public.international_shipments
           SET status = CASE WHEN status IS NULL OR status IN ('Draft', 'Pending') THEN 'In Transit' ELSE status END
         WHERE id = NEW.shipment_id;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$func$;

-- Transition RPC with role checks: buyer submits/cancels, factory confirms, buyer/factory/admin starts fulfillment
CREATE OR REPLACE FUNCTION public.transition_purchase_order(
  p_po_id UUID,
  p_to_status TEXT,
  p_note TEXT DEFAULT NULL,
  p_order_id UUID DEFAULT NULL,
  p_shipment_id UUID DEFAULT NULL
)
RETURNS public.purchase_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_uid UUID := auth.uid();
  v_po public.purchase_orders;
  v_admin BOOLEAN := public.po_is_admin();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_po FROM public.purchase_orders WHERE id = p_po_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Purchase order not found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT (v_admin OR v_po.buyer_id = v_uid OR v_po.factory_id = v_uid) THEN
    RAISE EXCEPTION 'Not a party to this purchase order' USING ERRCODE = '42501';
  END IF;

  IF p_to_status = 'submitted' AND NOT (v_admin OR v_po.buyer_id = v_uid) THEN
    RAISE EXCEPTION 'Only the buyer can submit a purchase order' USING ERRCODE = '42501';
  END IF;
  IF p_to_status = 'confirmed' AND NOT (v_admin OR v_po.factory_id = v_uid) THEN
    RAISE EXCEPTION 'Only the factory can confirm a purchase order' USING ERRCODE = '42501';
  END IF;

  IF p_order_id IS NOT NULL THEN
    UPDATE public.purchase_orders SET order_id = p_order_id WHERE id = p_po_id;
  END IF;
  IF p_shipment_id IS NOT NULL THEN
    UPDATE public.purchase_orders SET shipment_id = p_shipment_id WHERE id = p_po_id;
  END IF;

  UPDATE public.purchase_orders
     SET status = p_to_status,
         notes = COALESCE(NULLIF(trim(COALESCE(p_note, '')), ''), notes)
   WHERE id = p_po_id
   RETURNING * INTO v_po;

  RETURN v_po;
END;
$func$;

REVOKE ALL ON FUNCTION public.transition_purchase_order(UUID, TEXT, TEXT, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transition_purchase_order(UUID, TEXT, TEXT, UUID, UUID) TO authenticated;

-- 3. RLS ---------------------------------------------------------------------
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "po_select_parties" ON public.purchase_orders;
CREATE POLICY "po_select_parties"
  ON public.purchase_orders FOR SELECT TO authenticated
  USING (
    buyer_id = auth.uid()
    OR (factory_id = auth.uid() AND status <> 'draft')
    OR public.po_is_admin()
  );

DROP POLICY IF EXISTS "po_insert_buyer" ON public.purchase_orders;
CREATE POLICY "po_insert_buyer"
  ON public.purchase_orders FOR INSERT TO authenticated
  WITH CHECK (buyer_id = auth.uid());

DROP POLICY IF EXISTS "po_update_buyer_draft" ON public.purchase_orders;
CREATE POLICY "po_update_buyer_draft"
  ON public.purchase_orders FOR UPDATE TO authenticated
  USING (buyer_id = auth.uid() AND status = 'draft')
  WITH CHECK (buyer_id = auth.uid());

DROP POLICY IF EXISTS "po_delete_buyer_draft" ON public.purchase_orders;
CREATE POLICY "po_delete_buyer_draft"
  ON public.purchase_orders FOR DELETE TO authenticated
  USING (buyer_id = auth.uid() AND status = 'draft');

DROP POLICY IF EXISTS "po_events_select_parties" ON public.purchase_order_events;
CREATE POLICY "po_events_select_parties"
  ON public.purchase_order_events FOR SELECT TO authenticated
  USING (
    purchase_order_id IN (
      SELECT p.id FROM public.purchase_orders p
      WHERE p.buyer_id = auth.uid() OR (p.factory_id = auth.uid() AND p.status <> 'draft')
    )
    OR public.po_is_admin()
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_orders TO authenticated;
GRANT SELECT ON public.purchase_order_events TO authenticated;

-- 4. Triggers ----------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_purchase_orders_state_guard ON public.purchase_orders;
CREATE TRIGGER trg_purchase_orders_state_guard
  BEFORE INSERT OR UPDATE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.purchase_orders_state_guard();

DROP TRIGGER IF EXISTS trg_purchase_orders_after_change ON public.purchase_orders;
CREATE TRIGGER trg_purchase_orders_after_change
  AFTER INSERT OR UPDATE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.purchase_orders_after_change();

NOTIFY pgrst, 'reload schema';
