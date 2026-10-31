-- ============================================================
-- Driver portal: assignment creation RPC (admin / owning logistics partner)
-- Copies ONLY logistics values; never exposes order prices to drivers.
-- ============================================================

CREATE OR REPLACE FUNCTION public.assign_driver_to_order(
  p_order_id UUID,
  p_driver_user_id UUID,
  p_gross_weight_kg NUMERIC,
  p_volume_cbm NUMERIC,
  p_pallet_count INTEGER,
  p_pickup_address TEXT,
  p_pickup_lat DOUBLE PRECISION,
  p_pickup_lng DOUBLE PRECISION,
  p_delivery_address TEXT,
  p_consignee_name TEXT DEFAULT NULL,
  p_cargo_description TEXT DEFAULT NULL,
  p_freight_payout_usd NUMERIC DEFAULT 0,
  p_pickup_radius_m INTEGER DEFAULT 300
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_order RECORD;
  v_partner UUID;
  v_is_owner BOOLEAN := false;
  v_id UUID;
BEGIN
  SELECT o.id, o.order_number, o.logistics_partner_id INTO v_order
  FROM public.orders o WHERE o.id = p_order_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'message', 'الطلب غير موجود.');
  END IF;

  v_partner := v_order.logistics_partner_id;

  IF v_partner IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.logistics_partners lp
      WHERE lp.id = v_partner AND lp.user_id = auth.uid()
    ) INTO v_is_owner;
  END IF;

  IF NOT (public.is_admin_driver_portal() OR v_is_owner) THEN
    RETURN jsonb_build_object('ok', false, 'message', 'غير مصرح لك بإسناد سائق لهذا الطلب.');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = p_driver_user_id) THEN
    RETURN jsonb_build_object('ok', false, 'message', 'حساب السائق غير موجود.');
  END IF;

  INSERT INTO public.driver_assignments (
    order_id, driver_user_id, logistics_partner_id, order_ref, stage,
    gross_weight_kg, volume_cbm, pallet_count, cargo_description,
    pickup_address, pickup_lat, pickup_lng, pickup_radius_m,
    delivery_address, consignee_name, freight_payout_usd
  )
  VALUES (
    p_order_id, p_driver_user_id, v_partner, v_order.order_number, 'ready_for_pickup',
    p_gross_weight_kg, p_volume_cbm, p_pallet_count, p_cargo_description,
    p_pickup_address, p_pickup_lat, p_pickup_lng, COALESCE(p_pickup_radius_m, 300),
    p_delivery_address, p_consignee_name, COALESCE(p_freight_payout_usd, 0)
  )
  ON CONFLICT (order_id, driver_user_id) DO UPDATE SET
    gross_weight_kg = EXCLUDED.gross_weight_kg,
    volume_cbm = EXCLUDED.volume_cbm,
    pallet_count = EXCLUDED.pallet_count,
    cargo_description = EXCLUDED.cargo_description,
    pickup_address = EXCLUDED.pickup_address,
    pickup_lat = EXCLUDED.pickup_lat,
    pickup_lng = EXCLUDED.pickup_lng,
    pickup_radius_m = EXCLUDED.pickup_radius_m,
    delivery_address = EXCLUDED.delivery_address,
    consignee_name = EXCLUDED.consignee_name,
    freight_payout_usd = EXCLUDED.freight_payout_usd
  RETURNING id INTO v_id;

  UPDATE public.orders SET status = 'ready_for_pickup'::public.order_status, updated_at = now()
  WHERE id = p_order_id AND status::TEXT IN ('pending', 'processing', 'assigned');

  RETURN jsonb_build_object('ok', true, 'assignment_id', v_id, 'message', 'تم إسناد السائق للطلب.');
END;
$func$;

GRANT EXECUTE ON FUNCTION public.assign_driver_to_order(
  UUID, UUID, NUMERIC, NUMERIC, INTEGER, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT, TEXT, NUMERIC, INTEGER
) TO authenticated;

NOTIFY pgrst, 'reload schema';
