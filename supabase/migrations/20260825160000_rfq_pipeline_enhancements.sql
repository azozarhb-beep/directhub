-- Migration: RFQ Distribution Pipeline Enhancements
-- Timestamp: 20260825160000

-- ============================================================
-- 1. ADD MISSING COLUMNS TO rfq_requests
-- ============================================================

ALTER TABLE public.rfq_requests
  ADD COLUMN IF NOT EXISTS specifications TEXT DEFAULT '';

ALTER TABLE public.rfq_requests
  ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT true;

-- ============================================================
-- 2. ADD INDEXES FOR PIPELINE QUERIES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_rfq_requests_status ON public.rfq_requests(status);
CREATE INDEX IF NOT EXISTS idx_rfq_requests_buyer_id ON public.rfq_requests(buyer_id);
CREATE INDEX IF NOT EXISTS idx_rfq_requests_is_published ON public.rfq_requests(is_published);
CREATE INDEX IF NOT EXISTS idx_rfq_requests_created_at ON public.rfq_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rfq_responses_rfq_id_created ON public.rfq_responses(rfq_id, created_at DESC);

-- ============================================================
-- 3. ENSURE RLS IS ENABLED
-- ============================================================

ALTER TABLE public.rfq_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rfq_responses ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 4. RLS POLICIES FOR rfq_requests
-- ============================================================

-- Buyers can manage their own RFQs
DROP POLICY IF EXISTS "buyers_manage_own_rfq_requests" ON public.rfq_requests;
CREATE POLICY "buyers_manage_own_rfq_requests"
ON public.rfq_requests
FOR ALL
TO authenticated
USING (buyer_id = auth.uid())
WITH CHECK (buyer_id = auth.uid());

-- Manufacturers/suppliers can view published RFQs
DROP POLICY IF EXISTS "manufacturers_view_published_rfqs" ON public.rfq_requests;
CREATE POLICY "manufacturers_view_published_rfqs"
ON public.rfq_requests
FOR SELECT
TO authenticated
USING (is_published = true);

-- ============================================================
-- 5. RLS POLICIES FOR rfq_responses
-- ============================================================

-- Manufacturers manage their own responses
DROP POLICY IF EXISTS "manufacturers_manage_own_rfq_responses" ON public.rfq_responses;
CREATE POLICY "manufacturers_manage_own_rfq_responses"
ON public.rfq_responses
FOR ALL
TO authenticated
USING (manufacturer_id = auth.uid())
WITH CHECK (manufacturer_id = auth.uid());

-- Buyers can view responses to their RFQs
DROP POLICY IF EXISTS "buyers_view_rfq_responses" ON public.rfq_responses;
CREATE POLICY "buyers_view_rfq_responses"
ON public.rfq_responses
FOR SELECT
TO authenticated
USING (
  rfq_id IN (
    SELECT id FROM public.rfq_requests WHERE buyer_id = auth.uid()
  )
);

-- ============================================================
-- 6. ENABLE REALTIME ON RFQ TABLES
-- ============================================================

DO $$
BEGIN
  -- Enable realtime for rfq_requests
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND schemaname = 'public'
    AND tablename = 'rfq_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.rfq_requests;
  END IF;

  -- Enable realtime for rfq_responses
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND schemaname = 'public'
    AND tablename = 'rfq_responses'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.rfq_responses;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Realtime publication update skipped: %', SQLERRM;
END $$;

-- ============================================================
-- 7. FUNCTION: notify on new RFQ (insert notification for admin)
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify_admin_on_rfq()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  admin_id UUID;
BEGIN
  -- Find admin user
  SELECT id INTO admin_id
  FROM public.user_profiles
  WHERE role = 'admin'
  LIMIT 1;

  IF admin_id IS NOT NULL THEN
    INSERT INTO public.notifications (
      user_id, type, title, body, link, metadata
    ) VALUES (
      admin_id,
      'rfq_submitted',
      'طلب عرض سعر جديد',
      'تم تقديم طلب عرض سعر جديد: ' || COALESCE(NEW.product_name, 'منتج غير محدد'),
      '/admin/control-room',
      jsonb_build_object(
        'rfq_id', NEW.id,
        'product_name', NEW.product_name,
        'quantity', NEW.quantity,
        'buyer_id', NEW.buyer_id
      )
    );
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Admin notification failed: %', SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_rfq_submitted_notify_admin ON public.rfq_requests;
CREATE TRIGGER on_rfq_submitted_notify_admin
  AFTER INSERT ON public.rfq_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_on_rfq();

-- ============================================================
-- 8. FUNCTION: notify buyer when response received
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify_buyer_on_rfq_response()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_buyer_id UUID;
  v_product_name TEXT;
BEGIN
  SELECT buyer_id, product_name
  INTO v_buyer_id, v_product_name
  FROM public.rfq_requests
  WHERE id = NEW.rfq_id
  LIMIT 1;

  IF v_buyer_id IS NOT NULL THEN
    INSERT INTO public.notifications (
      user_id, type, title, body, link, metadata
    ) VALUES (
      v_buyer_id,
      'rfq_responded',
      'عرض سعر جديد على طلبك',
      'تلقيت عرض سعر جديداً على طلبك: ' || COALESCE(v_product_name, 'منتج'),
      '/rfq-board',
      jsonb_build_object(
        'rfq_id', NEW.rfq_id,
        'response_id', NEW.id,
        'unit_price', NEW.unit_price,
        'currency', NEW.currency
      )
    );

    -- Update rfq status to responded
    UPDATE public.rfq_requests
    SET status = 'responded', updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.rfq_id AND status = 'pending';
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Buyer notification failed: %', SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_rfq_response_notify_buyer ON public.rfq_responses;
CREATE TRIGGER on_rfq_response_notify_buyer
  AFTER INSERT ON public.rfq_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_buyer_on_rfq_response();
