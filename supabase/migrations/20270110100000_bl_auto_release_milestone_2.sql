-- Automate Milestone 2 (40%) escrow release when a verified Bill of Lading is uploaded.
-- Signals: orders.bl_document_url / bl_verified_at, logistics_documents (bill_of_lading),
-- and storage.objects uploads in the logistics-documents bucket whose path references an order.
-- Flow: signal -> queue row -> auto-release (system actor) once Tranche 1 is released and B/L is verified.

-- 1. Queue table -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bl_release_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'orders',
  proof_ref TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  release_id UUID REFERENCES public.escrow_milestone_releases(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMPTZ
);

ALTER TABLE public.bl_release_queue
  DROP CONSTRAINT IF EXISTS bl_release_queue_status_check;
ALTER TABLE public.bl_release_queue
  ADD CONSTRAINT bl_release_queue_status_check CHECK (status IN ('queued', 'released', 'failed', 'skipped'));

-- Only one open queue entry per order
CREATE UNIQUE INDEX IF NOT EXISTS uq_bl_release_queue_open_order
  ON public.bl_release_queue(order_id) WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS idx_bl_release_queue_status
  ON public.bl_release_queue(status, created_at DESC);

-- 2. Functions (before policies) ---------------------------------------------

-- Releases Tranche 2 (40%) without a human actor. Idempotent; safe to call repeatedly.
CREATE OR REPLACE FUNCTION public.auto_release_milestone_2(p_order_id UUID, p_proof_ref TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_order RECORD;
  v_gross NUMERIC(14,2);
  v_fee NUMERIC(14,2);
  v_agent_share NUMERIC(14,2);
  v_net NUMERIC(14,2);
  v_agent UUID;
  v_release_id UUID;
  v_proof TEXT;
BEGIN
  SELECT o.id, o.order_number, o.total, COALESCE(o.currency, 'USD') AS currency,
         COALESCE(o.platform_commission, 0) AS platform_commission,
         o.escrow_status, o.bill_of_lading_url, o.bl_document_url, o.bl_verified_at
    INTO v_order
  FROM public.orders o
  WHERE o.id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('released', false, 'reason', 'order_not_found');
  END IF;

  IF COALESCE(v_order.escrow_status, '') NOT IN ('funds_secured', 'shipped', 'pending_otp_confirmation', 'pending_admin_payout') THEN
    RETURN jsonb_build_object('released', false, 'reason', 'escrow_not_funded');
  END IF;

  IF EXISTS (SELECT 1 FROM public.escrow_milestone_releases r WHERE r.order_id = p_order_id AND r.stage = 2) THEN
    RETURN jsonb_build_object('released', false, 'reason', 'already_released');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.escrow_milestone_releases r WHERE r.order_id = p_order_id AND r.stage = 1) THEN
    RETURN jsonb_build_object('released', false, 'reason', 'tranche_1_pending');
  END IF;

  IF v_order.bl_verified_at IS NULL THEN
    RETURN jsonb_build_object('released', false, 'reason', 'bl_not_verified');
  END IF;

  v_proof := COALESCE(NULLIF(trim(COALESCE(p_proof_ref, '')), ''), v_order.bl_document_url, v_order.bill_of_lading_url, 'BL@' || p_order_id::TEXT);

  v_gross := ROUND(COALESCE(v_order.total, 0) * 40 / 100.0, 2);
  v_fee := ROUND(v_order.platform_commission * 40 / 100.0, 2);
  v_agent_share := ROUND(v_fee * 0.20, 2);
  v_net := v_gross - v_fee;

  SELECT a.agent_id INTO v_agent FROM public.resolve_order_agent(p_order_id) a LIMIT 1;
  IF v_agent IS NULL THEN
    v_agent_share := 0;
  END IF;

  INSERT INTO public.escrow_milestone_releases (
    order_id, stage, percentage, amount, currency, note, released_by, released_at,
    status, proof_ref, proof_type, platform_fee, agent_share, net_to_supplier,
    agent_id, released_by_email, released_by_role
  ) VALUES (
    p_order_id, 2, 40, v_gross, v_order.currency,
    'Tranche 2 (40%) auto-released on verified Bill of Lading',
    NULL, CURRENT_TIMESTAMP,
    'RELEASED', v_proof, 'bill_of_lading', v_fee, v_agent_share, v_net,
    v_agent, 'system@direct-hub.net', 'system'
  )
  ON CONFLICT (order_id, stage) DO NOTHING
  RETURNING id INTO v_release_id;

  IF v_release_id IS NULL THEN
    RETURN jsonb_build_object('released', false, 'reason', 'already_released');
  END IF;

  IF v_agent IS NOT NULL AND v_agent_share > 0 THEN
    UPDATE public.user_profiles
       SET commission_wallet_balance = COALESCE(commission_wallet_balance, 0) + v_agent_share
     WHERE id = v_agent;

    INSERT INTO public.agent_wallet_transactions (agent_id, order_id, release_id, tx_type, amount, currency, note, created_by)
    VALUES (v_agent, p_order_id, v_release_id, 'milestone_commission', v_agent_share, v_order.currency,
            'Agent 20% share of platform fee - tranche 2 (auto B/L release)', NULL);
  END IF;

  INSERT INTO public.order_status_history (order_id, status, note)
  VALUES (p_order_id, 'processing',
          'Tranche 2 (40%) auto-released to factory escrow balance - net ' || v_net || ' ' || v_order.currency
          || ' | proof=' || v_proof);

  RETURN jsonb_build_object(
    'released', true,
    'release_id', v_release_id,
    'stage', 2,
    'gross', v_gross,
    'platform_fee', v_fee,
    'agent_share', v_agent_share,
    'net_to_supplier', v_net,
    'proof_ref', v_proof
  );
END;
$func$;

-- Queues an order for Tranche 2 and attempts immediate release.
CREATE OR REPLACE FUNCTION public.queue_bl_milestone_release(p_order_id UUID, p_source TEXT, p_proof_ref TEXT DEFAULT NULL)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_queue_id UUID;
  v_result JSONB;
BEGIN
  IF p_order_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM public.escrow_milestone_releases r WHERE r.order_id = p_order_id AND r.stage = 2) THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.bl_release_queue (order_id, source, proof_ref, status)
  VALUES (p_order_id, COALESCE(p_source, 'orders'), p_proof_ref, 'queued')
  ON CONFLICT (order_id) WHERE status = 'queued' DO UPDATE
    SET proof_ref = COALESCE(EXCLUDED.proof_ref, public.bl_release_queue.proof_ref)
  RETURNING id INTO v_queue_id;

  BEGIN
    v_result := public.auto_release_milestone_2(p_order_id, p_proof_ref);
    IF COALESCE((v_result->>'released')::BOOLEAN, FALSE) THEN
      UPDATE public.bl_release_queue
         SET status = 'released',
             processed_at = CURRENT_TIMESTAMP,
             attempts = attempts + 1,
             release_id = NULLIF(v_result->>'release_id', '')::UUID,
             last_error = NULL
       WHERE id = v_queue_id;
    ELSE
      UPDATE public.bl_release_queue
         SET attempts = attempts + 1,
             last_error = v_result->>'reason'
       WHERE id = v_queue_id;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    UPDATE public.bl_release_queue
       SET attempts = attempts + 1,
           last_error = SQLERRM
     WHERE id = v_queue_id;
  END;

  RETURN v_queue_id;
END;
$func$;

-- Re-processes every queued order (call after Tranche 1 release or B/L verification).
CREATE OR REPLACE FUNCTION public.process_bl_release_queue()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  q RECORD;
  v_result JSONB;
  v_count INTEGER := 0;
BEGIN
  FOR q IN
    SELECT id, order_id, proof_ref FROM public.bl_release_queue WHERE status = 'queued' ORDER BY created_at LIMIT 200
  LOOP
    BEGIN
      v_result := public.auto_release_milestone_2(q.order_id, q.proof_ref);
      IF COALESCE((v_result->>'released')::BOOLEAN, FALSE) THEN
        UPDATE public.bl_release_queue
           SET status = 'released', processed_at = CURRENT_TIMESTAMP, attempts = attempts + 1,
               release_id = NULLIF(v_result->>'release_id', '')::UUID, last_error = NULL
         WHERE id = q.id;
        v_count := v_count + 1;
      ELSIF v_result->>'reason' = 'already_released' THEN
        UPDATE public.bl_release_queue
           SET status = 'skipped', processed_at = CURRENT_TIMESTAMP, attempts = attempts + 1, last_error = 'already_released'
         WHERE id = q.id;
      ELSE
        UPDATE public.bl_release_queue
           SET attempts = attempts + 1, last_error = v_result->>'reason'
         WHERE id = q.id;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.bl_release_queue SET attempts = attempts + 1, last_error = SQLERRM WHERE id = q.id;
    END;
  END LOOP;
  RETURN v_count;
END;
$func$;

-- Trigger fn: orders B/L columns changed
CREATE OR REPLACE FUNCTION public.trg_orders_bl_queue_release()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_url TEXT;
BEGIN
  v_url := COALESCE(NULLIF(trim(COALESCE(NEW.bl_document_url, '')), ''), NULLIF(trim(COALESCE(NEW.bill_of_lading_url, '')), ''));
  IF v_url IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT'
     OR NEW.bl_document_url IS DISTINCT FROM OLD.bl_document_url
     OR NEW.bill_of_lading_url IS DISTINCT FROM OLD.bill_of_lading_url
     OR NEW.bl_verified_at IS DISTINCT FROM OLD.bl_verified_at THEN
    PERFORM public.queue_bl_milestone_release(NEW.id, 'orders', v_url);
  END IF;
  RETURN NEW;
END;
$func$;

-- Trigger fn: logistics document of type bill_of_lading uploaded / approved
CREATE OR REPLACE FUNCTION public.trg_logistics_docs_bl_queue_release()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_order_id UUID;
BEGIN
  IF NEW.document_type <> 'bill_of_lading' OR NEW.status = 'rejected' OR NEW.shipment_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT ls.order_id INTO v_order_id FROM public.logistics_shipments ls WHERE ls.id = NEW.shipment_id LIMIT 1;
  IF v_order_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- A B/L approved by staff counts as verified
  IF NEW.status = 'approved' THEN
    UPDATE public.orders
       SET bl_verified_at = COALESCE(bl_verified_at, CURRENT_TIMESTAMP),
           bl_document_url = COALESCE(NULLIF(bl_document_url, ''), NEW.file_url)
     WHERE id = v_order_id;
  ELSE
    UPDATE public.orders
       SET bl_document_url = COALESCE(NULLIF(bl_document_url, ''), NEW.file_url)
     WHERE id = v_order_id;
  END IF;

  PERFORM public.queue_bl_milestone_release(v_order_id, 'logistics_documents', COALESCE(NEW.storage_path, NEW.file_url));
  RETURN NEW;
END;
$func$;

-- Trigger fn: Supabase Storage upload. Path convention: <order_uuid>/bill_of_lading/<file>
-- or any path containing a UUID segment followed by a bill_of_lading / bl segment.
CREATE OR REPLACE FUNCTION public.trg_storage_bl_queue_release()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_name TEXT := lower(COALESCE(NEW.name, ''));
  v_match TEXT[];
  v_order_id UUID;
BEGIN
  IF NEW.bucket_id NOT IN ('logistics-documents', 'customs_documents', 'factory-documents') THEN
    RETURN NEW;
  END IF;

  IF v_name !~ '(bill_of_lading|bill-of-lading|(^|[/_-])bl([/_.-]|$))' THEN
    RETURN NEW;
  END IF;

  v_match := regexp_match(v_name, '([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})');
  IF v_match IS NULL THEN
    RETURN NEW;
  END IF;

  BEGIN
    v_order_id := v_match[1]::UUID;
  EXCEPTION WHEN OTHERS THEN
    RETURN NEW;
  END;

  IF NOT EXISTS (SELECT 1 FROM public.orders o WHERE o.id = v_order_id) THEN
    RETURN NEW;
  END IF;

  UPDATE public.orders
     SET bl_document_url = COALESCE(NULLIF(bl_document_url, ''), NEW.bucket_id || '/' || NEW.name)
   WHERE id = v_order_id;

  PERFORM public.queue_bl_milestone_release(v_order_id, 'storage', NEW.bucket_id || '/' || NEW.name);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block a storage upload because of escrow automation
  RETURN NEW;
END;
$func$;

-- Trigger fn: when Tranche 1 is released, retry queued Tranche 2 releases
CREATE OR REPLACE FUNCTION public.trg_tranche1_retry_bl_queue()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  IF NEW.stage = 1 THEN
    PERFORM public.process_bl_release_queue();
  END IF;
  RETURN NEW;
END;
$func$;

-- Finance staff: mark B/L verified and release immediately
CREATE OR REPLACE FUNCTION public.verify_bill_of_lading(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_finance_staff() THEN
    RAISE EXCEPTION 'verify_bill_of_lading requires admin or ESCROW_OFFICER' USING ERRCODE = '42501';
  END IF;

  UPDATE public.orders
     SET bl_verified_at = COALESCE(bl_verified_at, CURRENT_TIMESTAMP)
   WHERE id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found' USING ERRCODE = 'P0002';
  END IF;

  PERFORM public.queue_bl_milestone_release(p_order_id, 'verify_rpc', NULL);

  RETURN COALESCE(
    (SELECT jsonb_build_object('queue_status', q.status, 'last_error', q.last_error, 'release_id', q.release_id)
       FROM public.bl_release_queue q WHERE q.order_id = p_order_id ORDER BY q.created_at DESC LIMIT 1),
    jsonb_build_object('queue_status', 'skipped')
  );
END;
$func$;

REVOKE ALL ON FUNCTION public.auto_release_milestone_2(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.queue_bl_milestone_release(UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.process_bl_release_queue() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.verify_bill_of_lading(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_bill_of_lading(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_bl_release_queue() TO service_role;

-- 3. RLS ---------------------------------------------------------------------
ALTER TABLE public.bl_release_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "finance_read_bl_release_queue" ON public.bl_release_queue;
CREATE POLICY "finance_read_bl_release_queue"
  ON public.bl_release_queue FOR SELECT TO authenticated
  USING (public.is_finance_staff());

DROP POLICY IF EXISTS "factory_read_own_bl_release_queue" ON public.bl_release_queue;
CREATE POLICY "factory_read_own_bl_release_queue"
  ON public.bl_release_queue FOR SELECT TO authenticated
  USING (order_id IN (SELECT o.id FROM public.orders o WHERE o.factory_user_id = auth.uid()));

-- 4. Triggers ----------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_orders_bl_queue_release ON public.orders;
CREATE TRIGGER trg_orders_bl_queue_release
  AFTER INSERT OR UPDATE OF bl_document_url, bill_of_lading_url, bl_verified_at ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.trg_orders_bl_queue_release();

DROP TRIGGER IF EXISTS trg_logistics_docs_bl_queue_release ON public.logistics_documents;
CREATE TRIGGER trg_logistics_docs_bl_queue_release
  AFTER INSERT OR UPDATE OF status ON public.logistics_documents
  FOR EACH ROW EXECUTE FUNCTION public.trg_logistics_docs_bl_queue_release();

DROP TRIGGER IF EXISTS trg_tranche1_retry_bl_queue ON public.escrow_milestone_releases;
CREATE TRIGGER trg_tranche1_retry_bl_queue
  AFTER INSERT ON public.escrow_milestone_releases
  FOR EACH ROW EXECUTE FUNCTION public.trg_tranche1_retry_bl_queue();

DO $storage$
BEGIN
  EXECUTE 'DROP TRIGGER IF EXISTS trg_storage_bl_queue_release ON storage.objects';
  EXECUTE 'CREATE TRIGGER trg_storage_bl_queue_release AFTER INSERT ON storage.objects FOR EACH ROW EXECUTE FUNCTION public.trg_storage_bl_queue_release()';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Storage trigger not installed: %', SQLERRM;
END
$storage$;

NOTIFY pgrst, 'reload schema';
