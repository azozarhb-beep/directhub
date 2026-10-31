-- Supplier product inquiry: public product lookup + supplier notification RPCs (supplier scope only)

-- 1. Allow the product_inquiry notification type
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (
  type IN (
    'rfq_submitted', 'rfq_responded', 'rfq_accepted', 'rfq_rejected',
    'new_message', 'order_update', 'system',
    'payment_submitted', 'order_placed', 'order_confirmed', 'order_shipped', 'order_delivered', 'order_cancelled',
    'escrow_funded', 'escrow_green_light', 'escrow_mark_ready', 'escrow_release_code', 'escrow_released', 'escrow_dispute',
    'payment_confirmed', 'kyc_submitted', 'kyc_approved', 'kyc_rejected',
    'factory_registered', 'factory_approved', 'b2s_registered', 'b2s_approved', 'buyer_registered',
    'quote_sent', 'quote_accepted', 'invoice_generated',
    'dispute_opened', 'dispute_resolved',
    'whatsapp_sent', 'diagnostic_alert', 'simulation_complete', 'translation_ready',
    'product_inquiry'
  )
);

-- 2. Resolve a supplier product (by id or SKU) for the inquiry card / button label
CREATE OR REPLACE FUNCTION public.get_supplier_product_for_inquiry(p_ref TEXT)
RETURNS TABLE (
  id UUID,
  supplier_id UUID,
  name TEXT,
  name_ar TEXT,
  sku TEXT,
  unit TEXT,
  wholesale_price NUMERIC,
  currency TEXT,
  image_url TEXT,
  supplier_name TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    sp.id,
    sp.supplier_id,
    sp.name,
    sp.name_ar,
    sp.sku,
    sp.unit,
    sp.wholesale_price,
    sp.currency,
    sp.image_url,
    COALESCE(up.company_name, up.full_name, '')::TEXT AS supplier_name
  FROM public.supplier_products sp
  LEFT JOIN public.user_profiles up ON up.id = sp.supplier_id
  WHERE sp.status = 'active'
    AND (sp.id::TEXT = p_ref OR (sp.sku IS NOT NULL AND lower(sp.sku) = lower(p_ref)))
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_supplier_product_for_inquiry(TEXT) TO anon, authenticated;

-- 3. Notify the supplier about a new product inquiry (called by the buyer)
CREATE OR REPLACE FUNCTION public.notify_supplier_product_inquiry(p_conversation_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conv public.chat_conversations%ROWTYPE;
  v_buyer_name TEXT;
  v_product_name TEXT;
  v_is_supplier BOOLEAN;
BEGIN
  SELECT * INTO v_conv
  FROM public.chat_conversations
  WHERE id = p_conversation_id
  LIMIT 1;

  IF v_conv.id IS NULL OR v_conv.buyer_id IS DISTINCT FROM auth.uid() OR v_conv.manufacturer_id IS NULL THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.supplier_products sp
    WHERE sp.supplier_id = v_conv.manufacturer_id
      AND sp.id::TEXT = v_conv.product_id
  ) INTO v_is_supplier;

  IF NOT v_is_supplier THEN
    RETURN;
  END IF;

  -- One notification per conversation inquiry
  IF EXISTS (
    SELECT 1 FROM public.notifications n
    WHERE n.user_id = v_conv.manufacturer_id
      AND n.type = 'product_inquiry'
      AND n.metadata->>'conversation_id' = p_conversation_id::TEXT
  ) THEN
    RETURN;
  END IF;

  SELECT COALESCE(NULLIF(up.full_name, ''), NULLIF(up.company_name, ''), 'مشتري')
  INTO v_buyer_name
  FROM public.user_profiles up
  WHERE up.id = v_conv.buyer_id
  LIMIT 1;

  SELECT COALESCE(NULLIF(sp.name_ar, ''), sp.name)
  INTO v_product_name
  FROM public.supplier_products sp
  WHERE sp.id::TEXT = v_conv.product_id
  LIMIT 1;

  INSERT INTO public.notifications (user_id, type, title, body, link, is_read, metadata)
  VALUES (
    v_conv.manufacturer_id,
    'product_inquiry',
    'استفسار جديد',
    'استفسار جديد من ' || COALESCE(v_buyer_name, 'مشتري') || ' حول منتج ' || COALESCE(v_product_name, v_conv.product_name),
    '/supplier/messages',
    false,
    jsonb_build_object(
      'conversation_id', p_conversation_id,
      'product_id', v_conv.product_id,
      'buyer_id', v_conv.buyer_id
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.notify_supplier_product_inquiry(UUID) TO authenticated;
