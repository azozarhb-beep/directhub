-- Fix: type "public.notification_type" does not exist when submitting an RFQ quote.
-- Root cause: notify_rfq_response() (trigger on rfq_responses) still casts to the
-- notification_type enum that was dropped when notifications.type became TEXT.
-- This migration (1) guarantees notifications.type is plain TEXT and
-- (2) rewrites the trigger functions so a notification failure never blocks the quote.

-- 1. Make sure notifications.type is TEXT (no-op if already TEXT)
DO $$
DECLARE
  v_data_type TEXT;
BEGIN
  SELECT c.data_type INTO v_data_type
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'notifications'
    AND c.column_name = 'type'
  LIMIT 1;

  IF v_data_type IS NOT NULL AND v_data_type <> 'text' THEN
    ALTER TABLE public.notifications ALTER COLUMN type TYPE TEXT USING type::TEXT;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'notifications.type conversion skipped: %', SQLERRM;
END $$;

-- 2. Drop any leftover strict CHECK so new notification types never fail
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

-- 3. Rewrite legacy trigger function: no enum cast, never blocks the quote insert
CREATE OR REPLACE FUNCTION public.notify_rfq_response()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_buyer_id UUID;
  v_product_name TEXT;
BEGIN
  BEGIN
    SELECT r.buyer_id, r.product_name INTO v_buyer_id, v_product_name
    FROM public.rfq_requests r
    WHERE r.id = NEW.rfq_id
    LIMIT 1;

    IF v_buyer_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, title, body, link, metadata)
      VALUES (
        v_buyer_id,
        'rfq_responded',
        'New Quote Received',
        'A manufacturer has responded to your RFQ for ' || COALESCE(v_product_name, 'your product'),
        '/rfq/' || NEW.rfq_id::TEXT,
        jsonb_build_object('rfq_id', NEW.rfq_id, 'response_id', NEW.id)
      );
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'RFQ response notification failed (quote still saved): %', SQLERRM;
  END;
  RETURN NEW;
END;
$func$;

-- 4. Re-assert the buyer notification trigger function with the same safety
CREATE OR REPLACE FUNCTION public.notify_buyer_on_rfq_response()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_buyer_id UUID;
  v_product_name TEXT;
BEGIN
  BEGIN
    SELECT r.buyer_id, r.product_name INTO v_buyer_id, v_product_name
    FROM public.rfq_requests r
    WHERE r.id = NEW.rfq_id
    LIMIT 1;

    IF v_buyer_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, title, body, link, metadata)
      VALUES (
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

      UPDATE public.rfq_requests
      SET status = 'responded', updated_at = CURRENT_TIMESTAMP
      WHERE id = NEW.rfq_id AND status = 'pending';
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Buyer notification failed (quote still saved): %', SQLERRM;
  END;
  RETURN NEW;
END;
$func$;

-- 5. Make sure both triggers are attached to the fixed functions
DROP TRIGGER IF EXISTS notify_on_rfq_response ON public.rfq_responses;
CREATE TRIGGER notify_on_rfq_response
  AFTER INSERT ON public.rfq_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_rfq_response();

DROP TRIGGER IF EXISTS on_rfq_response_notify_buyer ON public.rfq_responses;
CREATE TRIGGER on_rfq_response_notify_buyer
  AFTER INSERT ON public.rfq_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_buyer_on_rfq_response();
