-- Escrow 30/40/30: unlock Tranche 2 (40%) when an international shipment carries a valid bl_number.
-- Link rule (strict, same-owner): shipment.tracking_number = orders.order_number OR orders.tracking_number
-- AND orders.factory_user_id = shipment.created_by. Funding + Tranche 1 gates are still enforced by
-- public.auto_release_milestone_2 via public.queue_bl_milestone_release.

-- 1. Functions (before triggers) ----------------------------------------------

CREATE OR REPLACE FUNCTION public.is_valid_bl_number(p_bl TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $func$
  SELECT p_bl IS NOT NULL
     AND length(trim(p_bl)) BETWEEN 6 AND 40
     AND trim(p_bl) ~ '^[A-Za-z0-9][A-Za-z0-9/_-]*[A-Za-z0-9]$'
$func$;

CREATE OR REPLACE FUNCTION public.trg_intl_shipment_bl_number_unlock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_bl TEXT;
  v_order RECORD;
BEGIN
  v_bl := trim(COALESCE(NEW.bl_number, ''));

  IF NOT public.is_valid_bl_number(v_bl) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.bl_number IS NOT DISTINCT FROM OLD.bl_number
     AND NEW.tracking_number IS NOT DISTINCT FROM OLD.tracking_number THEN
    RETURN NEW;
  END IF;

  IF NEW.created_by IS NULL OR NULLIF(trim(COALESCE(NEW.tracking_number, '')), '') IS NULL THEN
    RETURN NEW;
  END IF;

  FOR v_order IN
    SELECT o.id
      FROM public.orders o
     WHERE o.factory_user_id = NEW.created_by
       AND (o.order_number = trim(NEW.tracking_number) OR o.tracking_number = trim(NEW.tracking_number))
  LOOP
    UPDATE public.orders
       SET bl_document_url = COALESCE(NULLIF(bl_document_url, ''), 'bl_number:' || v_bl),
           bl_verified_at = COALESCE(bl_verified_at, CURRENT_TIMESTAMP)
     WHERE id = v_order.id;

    PERFORM public.queue_bl_milestone_release(v_order.id, 'international_shipments', 'bl_number:' || v_bl);
  END LOOP;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block a shipment write because of escrow automation
  RETURN NEW;
END;
$func$;

REVOKE ALL ON FUNCTION public.trg_intl_shipment_bl_number_unlock() FROM PUBLIC;

-- 2. Trigger ------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_intl_shipment_bl_number_unlock ON public.international_shipments;
CREATE TRIGGER trg_intl_shipment_bl_number_unlock
  AFTER INSERT OR UPDATE OF bl_number, tracking_number ON public.international_shipments
  FOR EACH ROW EXECUTE FUNCTION public.trg_intl_shipment_bl_number_unlock();

NOTIFY pgrst, 'reload schema';
