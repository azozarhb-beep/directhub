-- Migration: Standalone custom deal checkout RPC (works without service-role key)
-- Timestamp: 20261115100000

CREATE OR REPLACE FUNCTION public.checkout_deal_by_token(p_token TEXT)
RETURNS TABLE (
  order_id UUID,
  order_number TEXT,
  public_token TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  q public.custom_quotes%ROWTYPE;
  v_order_id UUID;
  v_order_number TEXT;
  v_total NUMERIC(14,2);
  v_deadline TIMESTAMPTZ;
  v_factory_name TEXT;
  v_title TEXT;
  v_buyer RECORD;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO q
  FROM public.custom_quotes cq
  WHERE cq.public_token = p_token
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quote not found';
  END IF;

  IF q.factory_user_id = v_uid THEN
    RAISE EXCEPTION 'The issuing factory cannot pay its own deal';
  END IF;

  IF q.buyer_user_id IS NOT NULL AND q.buyer_user_id <> v_uid THEN
    RAISE EXCEPTION 'This deal link belongs to another buyer';
  END IF;

  -- Idempotent: already converted
  IF q.checkout_order_id IS NOT NULL THEN
    SELECT o.order_number INTO v_order_number FROM public.orders o WHERE o.id = q.checkout_order_id LIMIT 1;
    RETURN QUERY SELECT q.checkout_order_id, v_order_number, q.public_token;
    RETURN;
  END IF;

  IF q.status::TEXT NOT IN ('accepted', 'pending') THEN
    RAISE EXCEPTION 'Quote is % and can no longer be paid', q.status;
  END IF;

  IF q.expires_at IS NOT NULL AND q.expires_at < NOW() THEN
    RAISE EXCEPTION 'This deal link has expired';
  END IF;

  IF NOT (q.quoted_price > 0) OR NOT (q.quantity > 0) THEN
    RAISE EXCEPTION 'Invalid quote pricing';
  END IF;

  v_total := ROUND(q.quoted_price * q.quantity, 2);
  v_deadline := NOW() + (COALESCE(q.delivery_days, 0) || ' days')::INTERVAL;

  SELECT COALESCE(NULLIF(up.company_name, ''), NULLIF(up.full_name, ''), 'Factory')
    INTO v_factory_name
  FROM public.user_profiles up WHERE up.id = q.factory_user_id LIMIT 1;
  v_factory_name := COALESCE(v_factory_name, 'Factory');
  v_title := COALESCE(NULLIF(q.product_title, ''), v_factory_name || ' - custom deal');

  SELECT up.full_name, up.email, up.phone INTO v_buyer
  FROM public.user_profiles up WHERE up.id = v_uid LIMIT 1;

  v_order_number := 'DH-' || to_char(NOW(), 'YYYYMMDD') || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
  BEGIN
    SELECT public.generate_order_number() INTO v_order_number;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  INSERT INTO public.orders (
    user_id, factory_user_id, order_number, status, escrow_status, escrow_payment_type,
    items, shipping_address, payment_method, subtotal, shipping_cost, total, notes,
    confirmed_at, accepted_quote_id, negotiated_price, negotiated_quantity,
    negotiated_delivery_days, agreed_delivery_days, delivery_deadline, expected_delivery_date
  ) VALUES (
    v_uid, q.factory_user_id, v_order_number, 'pending', 'pending_verification', 'standard',
    jsonb_build_array(jsonb_build_object(
      'id', q.id, 'name', v_title, 'product_name', v_title, 'price', q.quoted_price,
      'currency', COALESCE(q.currency, 'USD'), 'quantity', q.quantity,
      'supplier', v_factory_name, 'quote_id', q.id
    )),
    jsonb_build_object(
      'fullName', COALESCE(v_buyer.full_name, ''),
      'email', COALESCE(v_buyer.email, ''),
      'phone', COALESCE(v_buyer.phone, '')
    ),
    'bank_transfer', v_total, 0, v_total, COALESCE(q.notes, ''),
    NOW(), q.id, q.quoted_price, q.quantity,
    q.delivery_days, q.delivery_days, v_deadline, v_deadline
  )
  RETURNING id INTO v_order_id;

  UPDATE public.custom_quotes cq
  SET checkout_order_id = v_order_id,
      order_id = v_order_id,
      buyer_user_id = v_uid,
      status = 'accepted',
      accepted_at = COALESCE(cq.accepted_at, NOW()),
      accepted_by = COALESCE(cq.accepted_by, v_uid),
      updated_at = NOW()
  WHERE cq.id = q.id;

  BEGIN
    INSERT INTO public.order_status_history (order_id, status, note)
    VALUES (v_order_id, 'pending_verification', 'تم إنشاء الطلب من رابط صفقة مخصصة — بانتظار إيصال الدفع.');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN QUERY SELECT v_order_id, v_order_number, q.public_token;
END;
$$;

GRANT EXECUTE ON FUNCTION public.checkout_deal_by_token(TEXT) TO authenticated;
