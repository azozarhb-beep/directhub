-- ============================================================
-- Migration: Open Freight Load Board & Quotation Bidding
-- Adds: load-board columns on logistics_shipments, logistics_bids,
--       RLS policies, accept_logistics_bid RPC (escrow lock)
-- ============================================================

-- 1. Enum: add 'assigned' shipment status
ALTER TYPE public.shipment_status_enum ADD VALUE IF NOT EXISTS 'assigned' AFTER 'pending';

-- 2. Load board columns on logistics_shipments
ALTER TABLE public.logistics_shipments
  ADD COLUMN IF NOT EXISTS cargo_type TEXT,
  ADD COLUMN IF NOT EXISTS container_type TEXT,
  ADD COLUMN IF NOT EXISTS volume_cbm NUMERIC(10, 3),
  ADD COLUMN IF NOT EXISTS pickup_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivery_deadline TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS target_budget NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS budget_currency TEXT DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS is_open_for_bids BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS accepted_bid_id UUID;

CREATE INDEX IF NOT EXISTS idx_logistics_shipments_open_bids
  ON public.logistics_shipments (is_open_for_bids, created_at DESC);

-- 3. Bids table
CREATE TABLE IF NOT EXISTS public.logistics_bids (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id       UUID NOT NULL REFERENCES public.logistics_shipments(id) ON DELETE CASCADE,
  partner_id        UUID NOT NULL REFERENCES public.logistics_partners(id) ON DELETE CASCADE,
  bid_amount        NUMERIC(14, 2) NOT NULL CHECK (bid_amount > 0),
  currency          TEXT NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD', 'YER')),
  transit_days      NUMERIC(6, 1) NOT NULL CHECK (transit_days > 0),
  transit_unit      TEXT NOT NULL DEFAULT 'days' CHECK (transit_unit IN ('days', 'hours')),
  validity_hours    INTEGER NOT NULL DEFAULT 48 CHECK (validity_hours > 0),
  expires_at        TIMESTAMPTZ,
  service_notes     TEXT,
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'withdrawn')),
  decided_at        TIMESTAMPTZ,
  decided_by        UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_logistics_bids_active_per_partner
  ON public.logistics_bids (shipment_id, partner_id)
  WHERE status IN ('pending', 'accepted');

CREATE INDEX IF NOT EXISTS idx_logistics_bids_shipment ON public.logistics_bids (shipment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logistics_bids_partner ON public.logistics_bids (partner_id, created_at DESC);

-- 4. Helper functions (before RLS policies)
CREATE OR REPLACE FUNCTION public.lb_is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid() AND up.role = 'admin'
  )
$$;

CREATE OR REPLACE FUNCTION public.lb_my_partner_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.logistics_partners WHERE user_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.lb_is_shipment_shipper(p_shipment_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.logistics_shipments s
    LEFT JOIN public.orders o ON o.id = s.order_id
    WHERE s.id = p_shipment_id
      AND (
        s.created_by = auth.uid()
        OR o.user_id = auth.uid()
        OR o.factory_user_id = auth.uid()
      )
  )
$$;

-- 5. Updated-at trigger
CREATE OR REPLACE FUNCTION public.set_logistics_bids_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_logistics_bids_updated_at ON public.logistics_bids;
CREATE TRIGGER trg_logistics_bids_updated_at
  BEFORE UPDATE ON public.logistics_bids
  FOR EACH ROW
  EXECUTE FUNCTION public.set_logistics_bids_updated_at();

-- 6. RLS — logistics_bids
ALTER TABLE public.logistics_bids ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_full_access_logistics_bids" ON public.logistics_bids;
CREATE POLICY "admin_full_access_logistics_bids"
  ON public.logistics_bids
  FOR ALL
  TO authenticated
  USING (public.lb_is_admin())
  WITH CHECK (public.lb_is_admin());

DROP POLICY IF EXISTS "partner_view_own_logistics_bids" ON public.logistics_bids;
CREATE POLICY "partner_view_own_logistics_bids"
  ON public.logistics_bids
  FOR SELECT
  TO authenticated
  USING (partner_id IN (SELECT public.lb_my_partner_ids()));

DROP POLICY IF EXISTS "partner_insert_own_logistics_bids" ON public.logistics_bids;
CREATE POLICY "partner_insert_own_logistics_bids"
  ON public.logistics_bids
  FOR INSERT
  TO authenticated
  WITH CHECK (partner_id IN (SELECT public.lb_my_partner_ids()) AND status = 'pending');

DROP POLICY IF EXISTS "partner_update_own_pending_logistics_bids" ON public.logistics_bids;
CREATE POLICY "partner_update_own_pending_logistics_bids"
  ON public.logistics_bids
  FOR UPDATE
  TO authenticated
  USING (partner_id IN (SELECT public.lb_my_partner_ids()) AND status = 'pending')
  WITH CHECK (partner_id IN (SELECT public.lb_my_partner_ids()) AND status IN ('pending', 'withdrawn'));

DROP POLICY IF EXISTS "shipper_view_shipment_logistics_bids" ON public.logistics_bids;
CREATE POLICY "shipper_view_shipment_logistics_bids"
  ON public.logistics_bids
  FOR SELECT
  TO authenticated
  USING (public.lb_is_shipment_shipper(shipment_id));

-- 7. RLS — shipments: partners can see open loads; shippers can create/manage own
DROP POLICY IF EXISTS "partners_view_open_load_board" ON public.logistics_shipments;
CREATE POLICY "partners_view_open_load_board"
  ON public.logistics_shipments
  FOR SELECT
  TO authenticated
  USING (
    is_open_for_bids = true
    AND logistics_partner_id IS NULL
    AND EXISTS (SELECT 1 FROM public.lb_my_partner_ids())
  );

DROP POLICY IF EXISTS "shipper_insert_open_load" ON public.logistics_shipments;
CREATE POLICY "shipper_insert_open_load"
  ON public.logistics_shipments
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "shipper_update_own_open_load" ON public.logistics_shipments;
CREATE POLICY "shipper_update_own_open_load"
  ON public.logistics_shipments
  FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid() AND logistics_partner_id IS NULL)
  WITH CHECK (created_by = auth.uid());

-- 8. RPC: accept a bid atomically (shipper or admin)
CREATE OR REPLACE FUNCTION public.accept_logistics_bid(p_bid_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bid        public.logistics_bids%ROWTYPE;
  v_ship       public.logistics_shipments%ROWTYPE;
  v_order      public.orders%ROWTYPE;
  v_partner    public.logistics_partners%ROWTYPE;
  v_buyer_id   UUID;
  v_amount_usd NUMERIC(14, 2);
  v_is_admin   BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  SELECT * INTO v_bid FROM public.logistics_bids WHERE id = p_bid_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'BID_NOT_FOUND';
  END IF;

  SELECT * INTO v_ship FROM public.logistics_shipments WHERE id = v_bid.shipment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SHIPMENT_NOT_FOUND';
  END IF;

  v_is_admin := public.lb_is_admin();
  IF NOT v_is_admin AND NOT public.lb_is_shipment_shipper(v_ship.id) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  IF v_bid.status <> 'pending' THEN
    RAISE EXCEPTION 'BID_NOT_PENDING';
  END IF;
  IF v_ship.logistics_partner_id IS NOT NULL OR v_ship.accepted_bid_id IS NOT NULL THEN
    RAISE EXCEPTION 'SHIPMENT_ALREADY_ASSIGNED';
  END IF;
  IF v_bid.expires_at IS NOT NULL AND v_bid.expires_at < NOW() THEN
    RAISE EXCEPTION 'BID_EXPIRED';
  END IF;

  SELECT * INTO v_partner FROM public.logistics_partners WHERE id = v_bid.partner_id;

  -- Winner accepted, all others rejected
  UPDATE public.logistics_bids
     SET status = 'accepted', decided_at = NOW(), decided_by = auth.uid()
   WHERE id = v_bid.id;

  UPDATE public.logistics_bids
     SET status = 'rejected', decided_at = NOW(), decided_by = auth.uid()
   WHERE shipment_id = v_ship.id AND id <> v_bid.id AND status = 'pending';

  -- Assign shipment
  UPDATE public.logistics_shipments
     SET logistics_partner_id = v_bid.partner_id,
         carrier_name = COALESCE(v_partner.company_name, carrier_name),
         shipment_status = 'assigned',
         is_open_for_bids = false,
         accepted_bid_id = v_bid.id
   WHERE id = v_ship.id;

  -- Lock accepted amount into logistics escrow
  v_buyer_id := v_ship.created_by;
  IF v_ship.order_id IS NOT NULL THEN
    SELECT * INTO v_order FROM public.orders WHERE id = v_ship.order_id;
    IF FOUND THEN
      v_buyer_id := COALESCE(v_order.user_id, v_buyer_id);
    END IF;
  END IF;
  IF v_buyer_id IS NULL THEN
    v_buyer_id := auth.uid();
  END IF;

  v_amount_usd := v_bid.bid_amount;

  INSERT INTO public.logistics_escrow_payments (
    order_id, buyer_id, partner_id, amount, currency,
    payment_status, escrow_held_at, release_condition
  ) VALUES (
    v_ship.order_id, v_buyer_id, v_bid.partner_id, v_amount_usd, v_bid.currency,
    'held_in_escrow', NOW(),
    'يُحرّر عند تأكيد التسليم بكود الاستلام وسند الاستلام المختوم (POD)'
  );

  -- Notify winning partner and rejected partners
  INSERT INTO public.notifications (user_id, type, title, body, metadata, is_read)
  SELECT lp.user_id,
         CASE WHEN b.id = v_bid.id THEN 'logistics_bid_accepted' ELSE 'logistics_bid_rejected' END,
         CASE WHEN b.id = v_bid.id THEN '✅ تم قبول عرض السعر الخاص بك' ELSE 'ℹ️ تم اختيار عرض آخر للشحنة' END,
         CASE WHEN b.id = v_bid.id
              THEN 'تم قبول عرضك على الشحنة ' || v_ship.tracking_number || ' وحجز المبلغ في الضمان.'
              ELSE 'تم اختيار عرض آخر للشحنة ' || v_ship.tracking_number || '.' END,
         jsonb_build_object('shipment_id', v_ship.id, 'bid_id', b.id),
         false
    FROM public.logistics_bids b
    JOIN public.logistics_partners lp ON lp.id = b.partner_id
   WHERE b.shipment_id = v_ship.id
     AND lp.user_id IS NOT NULL
     AND (b.id = v_bid.id OR b.decided_by = auth.uid());

  RETURN jsonb_build_object(
    'success', true,
    'shipment_id', v_ship.id,
    'bid_id', v_bid.id,
    'partner_id', v_bid.partner_id,
    'escrow_amount', v_bid.bid_amount,
    'currency', v_bid.currency
  );
END;
$$;

REVOKE ALL ON FUNCTION public.accept_logistics_bid(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_logistics_bid(UUID) TO authenticated;

-- 9. Realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'logistics_bids'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.logistics_bids;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Realtime publication skipped: %', SQLERRM;
END $$;

-- 10. Demo open loads (only if a shipper user exists)
DO $$
DECLARE
  v_user UUID;
BEGIN
  SELECT id INTO v_user FROM public.user_profiles ORDER BY created_at LIMIT 1;
  IF v_user IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.logistics_shipments WHERE tracking_number LIKE 'LOAD-DEMO-%'
  ) THEN
    INSERT INTO public.logistics_shipments (
      tracking_number, created_by, origin_address, destination_address,
      cargo_type, container_type, weight_kg, volume_cbm,
      pickup_date, delivery_deadline, target_budget, budget_currency,
      is_open_for_bids, shipment_status, notes
    ) VALUES
      ('LOAD-DEMO-0001', v_user, 'ميناء الحديدة', 'صنعاء', 'packaging_rolls', '40ft', 18000, 55,
       NOW() + INTERVAL '2 days', NOW() + INTERVAL '6 days', 1800, 'USD', true, 'pending',
       'رولات تغليف صناعية - تحميل بالرافعة'),
      ('LOAD-DEMO-0002', v_user, 'ميناء عدن', 'تعز', 'industrial_raw', '20ft', 12000, 28,
       NOW() + INTERVAL '3 days', NOW() + INTERVAL '8 days', NULL, 'USD', true, 'pending',
       'مواد خام صناعية'),
      ('LOAD-DEMO-0003', v_user, 'صنعاء', 'إب', 'general', 'flatbed', 6000, 20,
       NOW() + INTERVAL '1 day', NOW() + INTERVAL '3 days', 450000, 'YER', true, 'pending',
       'بضائع عامة');
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Demo load insertion skipped: %', SQLERRM;
END $$;

NOTIFY pgrst, 'reload schema';
