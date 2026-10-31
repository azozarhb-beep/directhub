-- 3-stage milestone escrow (30 / 40 / 30) tracking columns.
-- NOTE: there is no standalone escrow_orders table; escrow orders are rows in public.orders
-- (queried by the manufacturer "طلبات الضمان" tab), so the milestone columns live there.

-- 1. Milestone columns
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS milestone_1_paid BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS milestone_2_paid BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS milestone_3_paid BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS qc_report_url TEXT,
  ADD COLUMN IF NOT EXISTS bl_document_url TEXT,
  ADD COLUMN IF NOT EXISTS bl_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS qc_approved_at TIMESTAMPTZ;

-- 2. Backfill from already-recorded tranche releases
UPDATE public.orders o
   SET milestone_1_paid = TRUE
 WHERE EXISTS (SELECT 1 FROM public.escrow_milestone_releases r WHERE r.order_id = o.id AND r.stage = 1)
   AND o.milestone_1_paid = FALSE;

UPDATE public.orders o
   SET milestone_2_paid = TRUE
 WHERE EXISTS (SELECT 1 FROM public.escrow_milestone_releases r WHERE r.order_id = o.id AND r.stage = 2)
   AND o.milestone_2_paid = FALSE;

UPDATE public.orders o
   SET milestone_3_paid = TRUE
 WHERE EXISTS (SELECT 1 FROM public.escrow_milestone_releases r WHERE r.order_id = o.id AND r.stage = 3)
   AND o.milestone_3_paid = FALSE;

-- 3. Keep the paid flags in sync whenever a tranche is released
CREATE OR REPLACE FUNCTION public.sync_order_milestone_flags()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  IF NEW.stage = 1 THEN
    UPDATE public.orders SET milestone_1_paid = TRUE WHERE id = NEW.order_id;
  ELSIF NEW.stage = 2 THEN
    UPDATE public.orders SET milestone_2_paid = TRUE WHERE id = NEW.order_id;
  ELSIF NEW.stage = 3 THEN
    UPDATE public.orders SET milestone_3_paid = TRUE WHERE id = NEW.order_id;
  END IF;
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trg_sync_order_milestone_flags ON public.escrow_milestone_releases;
CREATE TRIGGER trg_sync_order_milestone_flags
  AFTER INSERT ON public.escrow_milestone_releases
  FOR EACH ROW EXECUTE FUNCTION public.sync_order_milestone_flags();

-- 4. When the assigned agent passes a physical inspection with photos, expose the report on the order
CREATE OR REPLACE FUNCTION public.sync_order_qc_from_inspection()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  IF NEW.order_id IS NOT NULL
     AND lower(COALESCE(NEW.status, '')) = 'passed'
     AND COALESCE(array_length(NEW.photo_urls, 1), 0) > 0 THEN
    UPDATE public.orders
       SET qc_report_url = COALESCE(NEW.photo_urls[1], qc_report_url),
           qc_approved_at = COALESCE(NEW.signed_off_at, CURRENT_TIMESTAMP)
     WHERE id = NEW.order_id;
  END IF;
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trg_sync_order_qc_from_inspection ON public.field_inspection_tasks;
CREATE TRIGGER trg_sync_order_qc_from_inspection
  AFTER INSERT OR UPDATE ON public.field_inspection_tasks
  FOR EACH ROW EXECUTE FUNCTION public.sync_order_qc_from_inspection();

-- 5. Factory may attach its Bill of Lading / container handover receipt to its own orders.
-- (Existing policy "factory_update_assigned_orders" already allows UPDATE on assigned orders.)
-- Verification (bl_verified_at) and payouts are performed by finance staff via release_escrow_milestone.

CREATE INDEX IF NOT EXISTS idx_orders_milestone_flags
  ON public.orders(factory_user_id, milestone_1_paid, milestone_2_paid, milestone_3_paid);

NOTIFY pgrst, 'reload schema';
