-- ============================================================
-- Field Agent production hardening
-- 1) factory-documents -> private bucket (signed URLs only)
-- 2) Masked field-agent RPCs (assigned_agent_id = auth.uid())
-- 3) save_inspection_results RPC for the live PSI flow
-- 4) Referral link is permanent once bound
-- ============================================================

-- 1) PRIVATE BUCKET ------------------------------------------------------
UPDATE storage.buckets
SET public = false
WHERE id = 'factory-documents';

-- Remove every public-read policy on the bucket
DROP POLICY IF EXISTS "factory_docs_read" ON storage.objects;
DROP POLICY IF EXISTS "factory_docs_public_read" ON storage.objects;
DROP POLICY IF EXISTS "factory_docs_read_authorized" ON storage.objects;

-- Authorized read: object owner, admins, field-ops staff, finance staff
CREATE POLICY "factory_docs_read_authorized"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'factory-documents'
  AND (
    owner = auth.uid()
    OR (storage.foldername(name))[2] = auth.uid()::text
    OR (storage.foldername(name))[1] = auth.uid()::text
    OR public.is_admin_user()
    OR public.is_field_ops_staff()
  )
);

-- 2) MASKED FIELD-AGENT RPC ---------------------------------------------
-- Returns only: order number, item lines, pallet quantities, PSI checkpoints
-- for tasks assigned to the calling agent. No buyer contact, no escrow/financial data.
CREATE OR REPLACE FUNCTION public.get_agent_assigned_inspection_view()
RETURNS TABLE (
  task_id UUID,
  order_id UUID,
  order_number TEXT,
  factory_name TEXT,
  status TEXT,
  items JSONB,
  pallet_quantity NUMERIC,
  psi_checkpoints JSONB,
  photo_urls TEXT[],
  report_notes TEXT,
  result TEXT,
  signed_off_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
  SELECT
    t.id,
    t.order_id,
    COALESCE(o.order_number, '')::TEXT,
    t.factory_name,
    t.status,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'name', COALESCE(it->>'name_ar', it->>'name_en', it->>'product_name', it->>'name', ''),
            'quantity', COALESCE(it->>'quantity', it->>'qty', '0'),
            'unit', COALESCE(it->>'unit', '')
          )
        )
        FROM jsonb_array_elements(
          CASE WHEN jsonb_typeof(to_jsonb(o.items)) = 'array' THEN to_jsonb(o.items) ELSE '[]'::jsonb END
        ) it
      ),
      '[]'::jsonb
    ),
    COALESCE(
      (
        SELECT SUM(
          CASE WHEN COALESCE(it->>'quantity', it->>'qty', '') ~ '^[0-9]+(\.[0-9]+)?$'
               THEN COALESCE(it->>'quantity', it->>'qty')::NUMERIC ELSE 0 END
        )
        FROM jsonb_array_elements(
          CASE WHEN jsonb_typeof(to_jsonb(o.items)) = 'array' THEN to_jsonb(o.items) ELSE '[]'::jsonb END
        ) it
      ),
      0
    ),
    jsonb_build_object(
      'quantity_match', t.check_quantity_match,
      'packaging_ok', t.check_packaging_ok,
      'dates_ok', t.check_dates_ok
    ),
    t.photo_urls,
    t.report_notes,
    t.result,
    t.signed_off_at,
    t.created_at
  FROM public.field_inspection_tasks t
  LEFT JOIN public.orders o ON o.id = t.order_id
  WHERE t.assigned_agent_id = auth.uid()
  ORDER BY t.created_at DESC;
$func$;

REVOKE ALL ON FUNCTION public.get_agent_assigned_inspection_view() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_agent_assigned_inspection_view() TO authenticated;

-- 3) SAVE INSPECTION RESULTS RPC ----------------------------------------
ALTER TABLE public.field_inspection_tasks
  ADD COLUMN IF NOT EXISTS check_quantity_match BOOLEAN,
  ADD COLUMN IF NOT EXISTS check_packaging_ok BOOLEAN,
  ADD COLUMN IF NOT EXISTS check_dates_ok BOOLEAN;

CREATE OR REPLACE FUNCTION public.save_inspection_results(
  p_task_id UUID,
  p_result TEXT,
  p_photo_urls TEXT[],
  p_report_notes TEXT,
  p_check_quantity BOOLEAN,
  p_check_packaging BOOLEAN,
  p_check_dates BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_updated INT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_result NOT IN ('passed', 'failed') THEN
    RAISE EXCEPTION 'invalid_result';
  END IF;

  IF COALESCE(array_length(p_photo_urls, 1), 0) < 2 THEN
    RAISE EXCEPTION 'min_photos_required';
  END IF;

  IF p_result = 'passed'
     AND NOT (COALESCE(p_check_quantity, false) AND COALESCE(p_check_packaging, false) AND COALESCE(p_check_dates, false)) THEN
    RAISE EXCEPTION 'checklist_incomplete';
  END IF;

  IF p_result = 'failed' AND COALESCE(TRIM(p_report_notes), '') = '' THEN
    RAISE EXCEPTION 'notes_required_for_failure';
  END IF;

  UPDATE public.field_inspection_tasks
  SET status = p_result,
      result = p_result,
      photo_urls = p_photo_urls,
      report_notes = NULLIF(TRIM(COALESCE(p_report_notes, '')), ''),
      check_quantity_match = COALESCE(p_check_quantity, false),
      check_packaging_ok = COALESCE(p_check_packaging, false),
      check_dates_ok = COALESCE(p_check_dates, false),
      signed_off_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = p_task_id
    AND assigned_agent_id = auth.uid()
    AND status IN ('dispatched', 'assigned', 'pending', 'in_progress', 'accepted');

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RAISE EXCEPTION 'task_not_found_or_not_assignee';
  END IF;

  RETURN TRUE;
END;
$func$;

REVOKE ALL ON FUNCTION public.save_inspection_results(UUID, TEXT, TEXT[], TEXT, BOOLEAN, BOOLEAN, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_inspection_results(UUID, TEXT, TEXT[], TEXT, BOOLEAN, BOOLEAN, BOOLEAN) TO authenticated;

-- 4) REFERRAL LINK IS PERMANENT -----------------------------------------
-- Once referred_by_agent_id is set it can only be changed by an admin.
CREATE OR REPLACE FUNCTION public.protect_factory_referral_binding()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  IF OLD.referred_by_agent_id IS NOT NULL
     AND (NEW.referred_by_agent_id IS DISTINCT FROM OLD.referred_by_agent_id
          OR NEW.referred_by_agent_code IS DISTINCT FROM OLD.referred_by_agent_code)
     AND NOT public.is_admin_user() THEN
    NEW.referred_by_agent_id := OLD.referred_by_agent_id;
    NEW.referred_by_agent_code := OLD.referred_by_agent_code;
  END IF;
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trg_protect_factory_referral_binding ON public.factory_registrations;
CREATE TRIGGER trg_protect_factory_referral_binding
BEFORE UPDATE ON public.factory_registrations
FOR EACH ROW EXECUTE FUNCTION public.protect_factory_referral_binding();

-- bind_facility_referral: never re-assign an already-bound facility
CREATE OR REPLACE FUNCTION public.bind_facility_referral(p_facility_id UUID, p_code TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $func$
DECLARE
  v_agent_id UUID;
  v_code TEXT := UPPER(TRIM(COALESCE(p_code, '')));
  v_status TEXT;
  v_owner UUID;
  v_created TIMESTAMPTZ;
  v_existing UUID;
BEGIN
  IF v_code = '' THEN
    RETURN NULL;
  END IF;

  SELECT user_id, registration_status::TEXT, COALESCE(submitted_at, created_at, CURRENT_TIMESTAMP), referred_by_agent_id
  INTO v_owner, v_status, v_created, v_existing
  FROM public.factory_registrations
  WHERE id = p_facility_id
  LIMIT 1;

  IF v_owner IS NULL OR v_owner <> auth.uid() THEN
    RETURN NULL;
  END IF;

  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  SELECT id INTO v_agent_id
  FROM public.user_profiles
  WHERE UPPER(referral_code) = v_code
  LIMIT 1;

  IF v_agent_id IS NULL OR v_agent_id = v_owner THEN
    RETURN NULL;
  END IF;

  UPDATE public.factory_registrations
  SET referred_by_agent_id = v_agent_id,
      referred_by_agent_code = v_code
  WHERE id = p_facility_id;

  INSERT INTO public.agent_referrals (agent_id, facility_id, referral_code, status, registration_date)
  VALUES (v_agent_id, p_facility_id, v_code, COALESCE(v_status, 'pending'), v_created)
  ON CONFLICT (facility_id) DO NOTHING;

  RETURN v_agent_id;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.bind_facility_referral(UUID, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
