-- Factory self-release of Tranche 2 (40%) with automated eligibility checks.
-- Eligibility: caller owns the order, escrow funded, Tranche 1 released,
-- Bill of Lading uploaded AND verified. Delegates to auto_release_milestone_2 (idempotent).

CREATE OR REPLACE FUNCTION public.check_milestone_2_eligibility(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_uid UUID := auth.uid();
  v_order RECORD;
  v_owner BOOLEAN := FALSE;
  v_funded BOOLEAN := FALSE;
  v_t1 BOOLEAN := FALSE;
  v_bl_uploaded BOOLEAN := FALSE;
  v_bl_verified BOOLEAN := FALSE;
  v_already BOOLEAN := FALSE;
  v_reason TEXT := NULL;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'not_authenticated');
  END IF;

  SELECT o.id, o.factory_user_id, o.escrow_status, o.bl_document_url, o.bill_of_lading_url, o.bl_verified_at
    INTO v_order
  FROM public.orders o
  WHERE o.id = p_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'order_not_found');
  END IF;

  v_owner := (v_order.factory_user_id = v_uid) OR public.is_finance_staff();
  v_funded := COALESCE(v_order.escrow_status, '') IN ('funds_secured', 'shipped', 'pending_otp_confirmation', 'pending_admin_payout');
  v_t1 := EXISTS (SELECT 1 FROM public.escrow_milestone_releases r WHERE r.order_id = p_order_id AND r.stage = 1);
  v_already := EXISTS (SELECT 1 FROM public.escrow_milestone_releases r WHERE r.order_id = p_order_id AND r.stage = 2);
  v_bl_uploaded := COALESCE(NULLIF(trim(COALESCE(v_order.bl_document_url, '')), ''), NULLIF(trim(COALESCE(v_order.bill_of_lading_url, '')), '')) IS NOT NULL;
  v_bl_verified := v_order.bl_verified_at IS NOT NULL;

  IF NOT v_owner THEN
    v_reason := 'not_order_owner';
  ELSIF v_already THEN
    v_reason := 'already_released';
  ELSIF NOT v_funded THEN
    v_reason := 'escrow_not_funded';
  ELSIF NOT v_t1 THEN
    v_reason := 'tranche_1_pending';
  ELSIF NOT v_bl_uploaded THEN
    v_reason := 'bl_not_uploaded';
  ELSIF NOT v_bl_verified THEN
    v_reason := 'bl_not_verified';
  END IF;

  RETURN jsonb_build_object(
    'eligible', v_reason IS NULL,
    'reason', v_reason,
    'checks', jsonb_build_object(
      'escrow_funded', v_funded,
      'tranche_1_released', v_t1,
      'bl_uploaded', v_bl_uploaded,
      'bl_verified', v_bl_verified,
      'already_released', v_already
    )
  );
END;
$func$;

CREATE OR REPLACE FUNCTION public.factory_self_release_milestone_2(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_uid UUID := auth.uid();
  v_check JSONB;
  v_result JSONB;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  v_check := public.check_milestone_2_eligibility(p_order_id);
  IF NOT COALESCE((v_check->>'eligible')::BOOLEAN, FALSE) THEN
    RETURN jsonb_build_object('released', false, 'reason', v_check->>'reason', 'checks', v_check->'checks');
  END IF;

  v_result := public.auto_release_milestone_2(p_order_id, NULL);

  IF COALESCE((v_result->>'released')::BOOLEAN, FALSE) THEN
    UPDATE public.bl_release_queue
       SET status = 'released', processed_at = CURRENT_TIMESTAMP, attempts = attempts + 1,
           release_id = NULLIF(v_result->>'release_id', '')::UUID, last_error = NULL
     WHERE order_id = p_order_id AND status = 'queued';

    INSERT INTO public.order_status_history (order_id, status, note)
    VALUES (p_order_id, 'processing', 'Tranche 2 (40%) self-released by factory after verified Bill of Lading');
  END IF;

  RETURN v_result;
END;
$func$;

REVOKE ALL ON FUNCTION public.check_milestone_2_eligibility(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.factory_self_release_milestone_2(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_milestone_2_eligibility(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.factory_self_release_milestone_2(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
