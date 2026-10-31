-- ============================================================
-- Driver & Fleet Logistics Portal (/driver/*)
-- Data isolation: drivers only read logistics metrics through
-- SECURITY DEFINER RPCs. They never touch orders prices/margins.
-- ============================================================

-- 1. TABLES -------------------------------------------------

CREATE TABLE IF NOT EXISTS public.driver_assignments (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id                 UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  driver_user_id           UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  logistics_partner_id     UUID REFERENCES public.logistics_partners(id) ON DELETE SET NULL,
  order_ref                TEXT,
  stage                    TEXT NOT NULL DEFAULT 'ready_for_pickup'
                             CHECK (stage IN ('ready_for_pickup', 'in_transit', 'delivered', 'cancelled')),
  -- Logistics metrics only (no prices / margins)
  gross_weight_kg          NUMERIC(12, 3),
  volume_cbm               NUMERIC(10, 3),
  pallet_count             INTEGER,
  cargo_description        TEXT,
  -- Addresses & pickup coordinates
  pickup_address           TEXT,
  pickup_lat               DOUBLE PRECISION,
  pickup_lng               DOUBLE PRECISION,
  pickup_radius_m          INTEGER NOT NULL DEFAULT 300,
  delivery_address         TEXT,
  consignee_name           TEXT,
  -- Pickup verification
  pallets_verified         BOOLEAN NOT NULL DEFAULT false,
  cbm_verified             BOOLEAN NOT NULL DEFAULT false,
  truck_bed_photo_url      TEXT,
  seal_photo_url           TEXT,
  seal_number              TEXT,
  dispatcher_signature_url TEXT,
  dispatcher_name          TEXT,
  loaded_at                TIMESTAMPTZ,
  loading_lat              DOUBLE PRECISION,
  loading_lng              DOUBLE PRECISION,
  -- Transit
  transit_started_at       TIMESTAMPTZ,
  last_lat                 DOUBLE PRECISION,
  last_lng                 DOUBLE PRECISION,
  last_ping_at             TIMESTAMPTZ,
  -- Proof of delivery
  bol_photo_url            TEXT,
  consignee_signature_url  TEXT,
  consignee_signer_name    TEXT,
  delivered_at             TIMESTAMPTZ,
  -- Freight payout (driver wallet)
  freight_payout_usd       NUMERIC(12, 2) NOT NULL DEFAULT 0,
  payout_released_at       TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (order_id, driver_user_id)
);

CREATE TABLE IF NOT EXISTS public.driver_wallets (
  driver_user_id  UUID PRIMARY KEY REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  balance_usd     NUMERIC(14, 2) NOT NULL DEFAULT 0,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.driver_wallet_transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_user_id  UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  assignment_id   UUID REFERENCES public.driver_assignments(id) ON DELETE SET NULL,
  amount_usd      NUMERIC(14, 2) NOT NULL,
  kind            TEXT NOT NULL DEFAULT 'freight_payout',
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.driver_gps_pings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id   UUID NOT NULL REFERENCES public.driver_assignments(id) ON DELETE CASCADE,
  driver_user_id  UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  lat             DOUBLE PRECISION NOT NULL,
  lng             DOUBLE PRECISION NOT NULL,
  accuracy_m      DOUBLE PRECISION,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. INDEXES ------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_driver_assignments_driver ON public.driver_assignments (driver_user_id, stage);
CREATE INDEX IF NOT EXISTS idx_driver_assignments_order ON public.driver_assignments (order_id);
CREATE INDEX IF NOT EXISTS idx_driver_wallet_tx_driver ON public.driver_wallet_transactions (driver_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_driver_gps_pings_assignment ON public.driver_gps_pings (assignment_id, created_at DESC);

-- 3. STORAGE BUCKET (private proofs) ------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'driver-proofs',
  'driver-proofs',
  false,
  15728640,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO NOTHING;

-- 4. FUNCTIONS (before policies) ----------------------------

CREATE OR REPLACE FUNCTION public.set_driver_assignments_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $func$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$func$;

CREATE OR REPLACE FUNCTION public.is_admin_driver_portal()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid() AND up.role::TEXT = 'admin'
  );
$func$;

-- Mask a phone number: keep only the last 2 digits
CREATE OR REPLACE FUNCTION public.mask_phone_driver(p_phone TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $func$
  SELECT CASE
    WHEN p_phone IS NULL OR length(regexp_replace(p_phone, '[^0-9]', '', 'g')) < 4 THEN '•••• ••••'
    ELSE '•••• ••' || right(regexp_replace(p_phone, '[^0-9]', '', 'g'), 2)
  END;
$func$;

-- List the calling driver's assignments (logistics columns ONLY, no prices)
CREATE OR REPLACE FUNCTION public.driver_list_assignments()
RETURNS TABLE (
  id UUID,
  order_id UUID,
  order_ref TEXT,
  stage TEXT,
  gross_weight_kg NUMERIC,
  volume_cbm NUMERIC,
  pallet_count INTEGER,
  pickup_address TEXT,
  delivery_address TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
  SELECT a.id, a.order_id, a.order_ref, a.stage, a.gross_weight_kg, a.volume_cbm,
         a.pallet_count, a.pickup_address, a.delivery_address, a.created_at
  FROM public.driver_assignments a
  WHERE a.driver_user_id = auth.uid()
  ORDER BY a.created_at DESC;
$func$;

-- Get a single assignment (logistics only) keyed by order id
CREATE OR REPLACE FUNCTION public.driver_get_assignment(p_order_id UUID)
RETURNS TABLE (
  id UUID,
  order_id UUID,
  order_ref TEXT,
  stage TEXT,
  gross_weight_kg NUMERIC,
  volume_cbm NUMERIC,
  pallet_count INTEGER,
  cargo_description TEXT,
  pickup_address TEXT,
  pickup_lat DOUBLE PRECISION,
  pickup_lng DOUBLE PRECISION,
  pickup_radius_m INTEGER,
  delivery_address TEXT,
  consignee_name TEXT,
  pallets_verified BOOLEAN,
  cbm_verified BOOLEAN,
  truck_bed_photo_url TEXT,
  seal_photo_url TEXT,
  seal_number TEXT,
  dispatcher_signature_url TEXT,
  dispatcher_name TEXT,
  loaded_at TIMESTAMPTZ,
  transit_started_at TIMESTAMPTZ,
  last_lat DOUBLE PRECISION,
  last_lng DOUBLE PRECISION,
  last_ping_at TIMESTAMPTZ,
  bol_photo_url TEXT,
  consignee_signature_url TEXT,
  delivered_at TIMESTAMPTZ,
  freight_payout_usd NUMERIC,
  payout_released_at TIMESTAMPTZ,
  factory_phone_masked TEXT,
  buyer_phone_masked TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
  SELECT a.id, a.order_id, a.order_ref, a.stage, a.gross_weight_kg, a.volume_cbm,
         a.pallet_count, a.cargo_description, a.pickup_address, a.pickup_lat, a.pickup_lng,
         a.pickup_radius_m, a.delivery_address, a.consignee_name, a.pallets_verified,
         a.cbm_verified, a.truck_bed_photo_url, a.seal_photo_url, a.seal_number,
         a.dispatcher_signature_url, a.dispatcher_name, a.loaded_at, a.transit_started_at,
         a.last_lat, a.last_lng, a.last_ping_at, a.bol_photo_url, a.consignee_signature_url,
         a.delivered_at, a.freight_payout_usd, a.payout_released_at,
         public.mask_phone_driver(fu.phone) AS factory_phone_masked,
         public.mask_phone_driver(bu.phone) AS buyer_phone_masked
  FROM public.driver_assignments a
  JOIN public.orders o ON o.id = a.order_id
  LEFT JOIN public.user_profiles fu ON fu.id = o.factory_user_id
  LEFT JOIN public.user_profiles bu ON bu.id = o.user_id
  WHERE a.order_id = p_order_id AND a.driver_user_id = auth.uid()
  LIMIT 1;
$func$;

-- Confirm loading: server-side GPS match against factory pickup coordinates
CREATE OR REPLACE FUNCTION public.driver_confirm_loading(
  p_order_id UUID,
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_truck_bed_photo_url TEXT,
  p_seal_photo_url TEXT,
  p_seal_number TEXT,
  p_signature_url TEXT,
  p_dispatcher_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_a public.driver_assignments%ROWTYPE;
  v_dist_m DOUBLE PRECISION;
BEGIN
  SELECT * INTO v_a FROM public.driver_assignments
  WHERE order_id = p_order_id AND driver_user_id = auth.uid() LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'NOT_FOUND', 'message', 'المهمة غير موجودة.');
  END IF;
  IF v_a.stage <> 'ready_for_pickup' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_STAGE', 'message', 'تم تأكيد التحميل مسبقاً.');
  END IF;
  IF NOT (v_a.pallets_verified AND v_a.cbm_verified) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'CHECKLIST', 'message', 'أكمل قائمة التحقق من الباليتات والحجم أولاً.');
  END IF;
  IF COALESCE(p_truck_bed_photo_url, '') = '' OR COALESCE(p_seal_photo_url, '') = '' OR COALESCE(trim(p_seal_number), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'MISSING_PHOTOS', 'message', 'صورة صندوق الشاحنة المحمّل وصورة رقم ختم الحاوية إلزاميتان.');
  END IF;
  IF COALESCE(p_signature_url, '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'MISSING_SIGNATURE', 'message', 'توقيع مسؤول الإرسال بالمصنع إلزامي.');
  END IF;

  -- GPS match against factory pickup coordinates (anti-bypass)
  IF v_a.pickup_lat IS NOT NULL AND v_a.pickup_lng IS NOT NULL THEN
    IF p_lat IS NULL OR p_lng IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'code', 'GPS_REQUIRED', 'message', 'يرجى تفعيل GPS لتأكيد التحميل.');
    END IF;
    v_dist_m := public.geo_distance_km(p_lat, p_lng, v_a.pickup_lat, v_a.pickup_lng) * 1000.0;
    IF v_dist_m > v_a.pickup_radius_m THEN
      RETURN jsonb_build_object(
        'ok', false, 'code', 'GPS_MISMATCH',
        'message', 'موقعك الحالي لا يطابق موقع تحميل المصنع. اقترب من المصنع لتأكيد التحميل.',
        'distance_m', round(v_dist_m)
      );
    END IF;
  END IF;

  UPDATE public.driver_assignments SET
    truck_bed_photo_url = p_truck_bed_photo_url,
    seal_photo_url = p_seal_photo_url,
    seal_number = trim(p_seal_number),
    dispatcher_signature_url = p_signature_url,
    dispatcher_name = NULLIF(trim(COALESCE(p_dispatcher_name, '')), ''),
    loaded_at = now(),
    loading_lat = p_lat,
    loading_lng = p_lng
  WHERE id = v_a.id;

  RETURN jsonb_build_object('ok', true, 'message', 'تم تأكيد التحميل بنجاح.');
END;
$func$;

-- Start transit
CREATE OR REPLACE FUNCTION public.driver_start_transit(
  p_order_id UUID,
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_a public.driver_assignments%ROWTYPE;
BEGIN
  SELECT * INTO v_a FROM public.driver_assignments
  WHERE order_id = p_order_id AND driver_user_id = auth.uid() LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'message', 'المهمة غير موجودة.');
  END IF;
  IF v_a.loaded_at IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'يجب تأكيد التحميل قبل بدء النقل.');
  END IF;
  IF v_a.stage <> 'ready_for_pickup' THEN
    RETURN jsonb_build_object('ok', false, 'message', 'الشحنة ليست في مرحلة الاستعداد للانطلاق.');
  END IF;

  UPDATE public.driver_assignments SET
    stage = 'in_transit',
    transit_started_at = now(),
    last_lat = p_lat,
    last_lng = p_lng,
    last_ping_at = now()
  WHERE id = v_a.id;

  UPDATE public.orders SET status = 'in_transit'::public.order_status, updated_at = now()
  WHERE id = v_a.order_id;

  INSERT INTO public.order_status_history (order_id, status, note)
  VALUES (v_a.order_id, 'in_transit'::public.order_status, '🚀 انطلقت الشحنة - بدأ السائق النقل.');

  IF p_lat IS NOT NULL AND p_lng IS NOT NULL THEN
    INSERT INTO public.driver_gps_pings (assignment_id, driver_user_id, lat, lng)
    VALUES (v_a.id, auth.uid(), p_lat, p_lng);
  END IF;

  RETURN jsonb_build_object('ok', true, 'message', 'بدأت رحلة النقل.');
END;
$func$;

-- Log a live GPS ping while in transit
CREATE OR REPLACE FUNCTION public.driver_log_position(
  p_order_id UUID,
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_accuracy DOUBLE PRECISION DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_a public.driver_assignments%ROWTYPE;
BEGIN
  SELECT * INTO v_a FROM public.driver_assignments
  WHERE order_id = p_order_id AND driver_user_id = auth.uid() AND stage = 'in_transit' LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false);
  END IF;

  UPDATE public.driver_assignments SET last_lat = p_lat, last_lng = p_lng, last_ping_at = now()
  WHERE id = v_a.id;

  INSERT INTO public.driver_gps_pings (assignment_id, driver_user_id, lat, lng, accuracy_m)
  VALUES (v_a.id, auth.uid(), p_lat, p_lng, p_accuracy);

  RETURN jsonb_build_object('ok', true);
END;
$func$;

-- Checklist toggles (pallet count + CBM verification)
CREATE OR REPLACE FUNCTION public.driver_set_checklist(
  p_order_id UUID,
  p_pallets_verified BOOLEAN,
  p_cbm_verified BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  UPDATE public.driver_assignments SET
    pallets_verified = COALESCE(p_pallets_verified, false),
    cbm_verified = COALESCE(p_cbm_verified, false)
  WHERE order_id = p_order_id AND driver_user_id = auth.uid() AND stage = 'ready_for_pickup';
  RETURN jsonb_build_object('ok', FOUND);
END;
$func$;

-- Complete delivery: POD + consignee signature -> escrow freight payout to driver wallet
CREATE OR REPLACE FUNCTION public.driver_complete_delivery(
  p_order_id UUID,
  p_bol_photo_url TEXT,
  p_signature_url TEXT,
  p_signer_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_a public.driver_assignments%ROWTYPE;
  v_payout NUMERIC(12, 2);
  v_escrow NUMERIC(12, 2);
BEGIN
  SELECT * INTO v_a FROM public.driver_assignments
  WHERE order_id = p_order_id AND driver_user_id = auth.uid() LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'message', 'المهمة غير موجودة.');
  END IF;
  IF v_a.stage <> 'in_transit' THEN
    RETURN jsonb_build_object('ok', false, 'message', 'يمكن تأكيد التسليم فقط للشحنات قيد النقل.');
  END IF;
  IF COALESCE(p_bol_photo_url, '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'message', 'صورة بوليصة الشحن / CMR المختومة إلزامية.');
  END IF;
  IF COALESCE(p_signature_url, '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'message', 'توقيع المستلم / وكيل الميناء إلزامي.');
  END IF;

  -- Escrow freight held for this order's logistics partner
  SELECT COALESCE(SUM(ep.amount), 0) INTO v_escrow
  FROM public.logistics_escrow_payments ep
  WHERE ep.order_id = v_a.order_id
    AND ep.payment_status::TEXT = 'held_in_escrow'
    AND (v_a.logistics_partner_id IS NULL OR ep.partner_id = v_a.logistics_partner_id);

  v_payout := CASE WHEN COALESCE(v_a.freight_payout_usd, 0) > 0 THEN v_a.freight_payout_usd ELSE v_escrow END;

  UPDATE public.driver_assignments SET
    stage = 'delivered',
    bol_photo_url = p_bol_photo_url,
    consignee_signature_url = p_signature_url,
    consignee_signer_name = NULLIF(trim(COALESCE(p_signer_name, '')), ''),
    delivered_at = now(),
    freight_payout_usd = v_payout,
    payout_released_at = now()
  WHERE id = v_a.id;

  UPDATE public.logistics_escrow_payments SET
    payment_status = 'released'::public.logistics_payment_status,
    released_at = now(),
    release_condition = 'تم التسليم وتأكيد سند الشحن المختوم (POD) وتوقيع المستلم عبر بوابة السائق'
  WHERE order_id = v_a.order_id
    AND payment_status::TEXT = 'held_in_escrow'
    AND (v_a.logistics_partner_id IS NULL OR partner_id = v_a.logistics_partner_id);

  UPDATE public.orders SET
    status = 'delivered'::public.order_status,
    delivered_at = now(),
    shipping_fees_released = true,
    shipping_fees_released_at = now(),
    updated_at = now()
  WHERE id = v_a.order_id;

  INSERT INTO public.order_status_history (order_id, status, note)
  VALUES (v_a.order_id, 'delivered'::public.order_status, '✅ تم التسليم وتوقيع المستلم وسند الشحن المختوم عبر بوابة السائق.');

  IF v_payout > 0 THEN
    INSERT INTO public.driver_wallets (driver_user_id, balance_usd)
    VALUES (auth.uid(), v_payout)
    ON CONFLICT (driver_user_id)
    DO UPDATE SET balance_usd = public.driver_wallets.balance_usd + EXCLUDED.balance_usd, updated_at = now();

    INSERT INTO public.driver_wallet_transactions (driver_user_id, assignment_id, amount_usd, kind, note)
    VALUES (auth.uid(), v_a.id, v_payout, 'freight_payout', 'تحرير أجرة الشحن من الضمان بعد التسليم');
  END IF;

  RETURN jsonb_build_object('ok', true, 'payout_usd', v_payout, 'message', 'تم التسليم وتحرير أجرة الشحن إلى محفظتك.');
END;
$func$;

-- Driver wallet summary
CREATE OR REPLACE FUNCTION public.driver_wallet_balance()
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
  SELECT COALESCE((SELECT balance_usd FROM public.driver_wallets WHERE driver_user_id = auth.uid()), 0);
$func$;

-- 5. RLS ----------------------------------------------------

ALTER TABLE public.driver_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_gps_pings ENABLE ROW LEVEL SECURITY;

-- Drivers never read the base table directly (RPC only). Admin manages everything.
DROP POLICY IF EXISTS "admin_all_driver_assignments" ON public.driver_assignments;
CREATE POLICY "admin_all_driver_assignments" ON public.driver_assignments
  FOR ALL TO authenticated
  USING (public.is_admin_driver_portal())
  WITH CHECK (public.is_admin_driver_portal());

DROP POLICY IF EXISTS "admin_all_driver_wallets" ON public.driver_wallets;
CREATE POLICY "admin_all_driver_wallets" ON public.driver_wallets
  FOR ALL TO authenticated
  USING (public.is_admin_driver_portal())
  WITH CHECK (public.is_admin_driver_portal());

DROP POLICY IF EXISTS "driver_read_own_wallet" ON public.driver_wallets;
CREATE POLICY "driver_read_own_wallet" ON public.driver_wallets
  FOR SELECT TO authenticated
  USING (driver_user_id = auth.uid());

DROP POLICY IF EXISTS "admin_all_driver_wallet_tx" ON public.driver_wallet_transactions;
CREATE POLICY "admin_all_driver_wallet_tx" ON public.driver_wallet_transactions
  FOR ALL TO authenticated
  USING (public.is_admin_driver_portal())
  WITH CHECK (public.is_admin_driver_portal());

DROP POLICY IF EXISTS "driver_read_own_wallet_tx" ON public.driver_wallet_transactions;
CREATE POLICY "driver_read_own_wallet_tx" ON public.driver_wallet_transactions
  FOR SELECT TO authenticated
  USING (driver_user_id = auth.uid());

DROP POLICY IF EXISTS "admin_all_driver_gps_pings" ON public.driver_gps_pings;
CREATE POLICY "admin_all_driver_gps_pings" ON public.driver_gps_pings
  FOR ALL TO authenticated
  USING (public.is_admin_driver_portal())
  WITH CHECK (public.is_admin_driver_portal());

-- Storage: drivers upload/read inside their own folder of driver-proofs
DROP POLICY IF EXISTS "driver_upload_own_proofs" ON storage.objects;
CREATE POLICY "driver_upload_own_proofs" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'driver-proofs' AND (storage.foldername(name))[1] = auth.uid()::TEXT);

DROP POLICY IF EXISTS "driver_read_own_proofs" ON storage.objects;
CREATE POLICY "driver_read_own_proofs" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'driver-proofs' AND (storage.foldername(name))[1] = auth.uid()::TEXT);

DROP POLICY IF EXISTS "admin_all_driver_proofs" ON storage.objects;
CREATE POLICY "admin_all_driver_proofs" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'driver-proofs' AND public.is_admin_driver_portal())
  WITH CHECK (bucket_id = 'driver-proofs' AND public.is_admin_driver_portal());

-- 6. TRIGGERS -----------------------------------------------

DROP TRIGGER IF EXISTS trg_driver_assignments_updated_at ON public.driver_assignments;
CREATE TRIGGER trg_driver_assignments_updated_at
  BEFORE UPDATE ON public.driver_assignments
  FOR EACH ROW EXECUTE FUNCTION public.set_driver_assignments_updated_at();

-- 7. GRANTS -------------------------------------------------

GRANT EXECUTE ON FUNCTION public.driver_list_assignments() TO authenticated;
GRANT EXECUTE ON FUNCTION public.driver_get_assignment(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.driver_confirm_loading(UUID, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.driver_start_transit(UUID, DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated;
GRANT EXECUTE ON FUNCTION public.driver_log_position(UUID, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated;
GRANT EXECUTE ON FUNCTION public.driver_set_checklist(UUID, BOOLEAN, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.driver_complete_delivery(UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.driver_wallet_balance() TO authenticated;

NOTIFY pgrst, 'reload schema';
