-- ============================================================
-- Field Agent live-pilot blockers
-- 1) Masked inspection view exposes everything the PSI panel needs
-- 2) Agents lose raw SELECT access to orders via inspection tasks
-- 3) Inspection photos live in the private factory-documents bucket
-- 4) Seed one live test inspection task for the current field agent
-- ============================================================

-- 1) MASKED VIEW (extended) ---------------------------------------------
-- Return type changes, so the function must be dropped first.
DROP FUNCTION IF EXISTS public.get_agent_assigned_inspection_view();

CREATE OR REPLACE FUNCTION public.get_agent_assigned_inspection_view()
RETURNS TABLE (
  task_id UUID,
  order_id UUID,
  order_number TEXT,
  factory_name TEXT,
  city TEXT,
  po_number TEXT,
  title TEXT,
  instructions TEXT,
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
    COALESCE(t.city, '')::TEXT,
    COALESCE(t.po_number, '')::TEXT,
    COALESCE(t.title, '')::TEXT,
    COALESCE(t.notes, '')::TEXT,
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
      'quantity_match', COALESCE(t.check_quantity_match, false),
      'packaging_ok', COALESCE(t.check_packaging_ok, false),
      'dates_ok', COALESCE(t.check_dates_ok, false)
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

-- 2) REMOVE RAW ORDER READ FOR INSPECTION AGENTS -------------------------
-- Field agents must read order data only through the masked RPC above.
DROP POLICY IF EXISTS "agents_read_assigned_task_orders" ON public.orders;

-- 3) PRIVATE STORAGE PATH FOR INSPECTION PHOTOS --------------------------
-- Path: factory-docs/inspections/<agent uid>/<task id>/<file>
-- Insert policy already allows the factory-docs/ prefix; the read policy
-- allows foldername[2] = auth.uid() (here: "inspections" is [2]), so add an
-- explicit owner-scoped read for the inspection folder.
DROP POLICY IF EXISTS "factory_docs_read_inspection_photos" ON storage.objects;
CREATE POLICY "factory_docs_read_inspection_photos"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'factory-documents'
  AND (storage.foldername(name))[1] = 'factory-docs'
  AND (storage.foldername(name))[2] = 'inspections'
  AND (storage.foldername(name))[3] = auth.uid()::text
);

-- 4) SEED ONE LIVE TEST INSPECTION TASK ----------------------------------
DO $$
DECLARE
  v_agent_id UUID;
  v_order_id UUID;
BEGIN
  SELECT id INTO v_agent_id
  FROM public.user_profiles
  WHERE role::text IN ('field_agent', 'agent', 'field-agent')
  ORDER BY (email = 'sandbox.agent@directhub.net') DESC, is_verified DESC NULLS LAST, created_at ASC NULLS LAST
  LIMIT 1;

  IF v_agent_id IS NULL THEN
    RAISE NOTICE 'No field agent found; skipping inspection task seed.';
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.field_inspection_tasks
    WHERE assigned_agent_id = v_agent_id AND po_number = 'PSI-TEST-0001'
  ) THEN
    RAISE NOTICE 'Test inspection task already seeded.';
    RETURN;
  END IF;

  SELECT id INTO v_order_id FROM public.orders ORDER BY created_at DESC LIMIT 1;

  INSERT INTO public.field_inspection_tasks (
    factory_name, order_id, assigned_agent_id, created_by,
    title, notes, status, city, po_number
  ) VALUES (
    'مصنع الاختبار التجريبي - Test Factory',
    v_order_id,
    v_agent_id,
    NULL,
    'تفتيش ميداني تجريبي - Live PSI Test',
    'مهمة اختبار حية للتحقق من حفظ نتائج الفحص (PSI) من المتصفح',
    'assigned',
    'Sana''a',
    'PSI-TEST-0001'
  );

  INSERT INTO public.notifications (user_id, type, title, body, link, is_read, metadata)
  VALUES (
    v_agent_id,
    'system',
    'مهمة تفتيش ميداني جديدة',
    'تم إسناد مهمة تفتيش تجريبية PSI-TEST-0001',
    '/agent/dashboard',
    FALSE,
    jsonb_build_object('kind', 'field_inspection_assigned', 'seeded', TRUE)
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Inspection task seed skipped: %', SQLERRM;
END $$;

NOTIFY pgrst, 'reload schema';
