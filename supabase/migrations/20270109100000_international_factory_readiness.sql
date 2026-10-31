-- ============================================================
-- International Factory Readiness
--  1. Incoterms aligned to EXW / FOB / CIF on custom_quotes + export_invoices
--  2. CBM + container capacity (20ft / 40ft HQ) on export_invoices,
--     custom_quotes and international_shipments
--  3. Packing list documents (PDF / Excel) for shipments
--  4. Realtime publication for rfq_requests, custom_quotes, international_shipments
-- ============================================================

-- 1. Incoterms alignment -------------------------------------------------
ALTER TABLE public.custom_quotes
  DROP CONSTRAINT IF EXISTS custom_quotes_incoterm_check;
ALTER TABLE public.custom_quotes
  ADD CONSTRAINT custom_quotes_incoterm_check
  CHECK (incoterm IS NULL OR incoterm IN ('EXW', 'FOB', 'CIF'));

ALTER TABLE public.export_invoices
  DROP CONSTRAINT IF EXISTS export_invoices_incoterm_check;
ALTER TABLE public.export_invoices
  ADD CONSTRAINT export_invoices_incoterm_check
  CHECK (incoterm IS NULL OR incoterm IN ('EXW', 'FOB', 'CIF'));

-- 2. CBM + container capacity -------------------------------------------
ALTER TABLE public.export_invoices
  ADD COLUMN IF NOT EXISTS cbm NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS container_capacity TEXT;

ALTER TABLE public.export_invoices
  DROP CONSTRAINT IF EXISTS export_invoices_container_capacity_check;
ALTER TABLE public.export_invoices
  ADD CONSTRAINT export_invoices_container_capacity_check
  CHECK (container_capacity IS NULL OR container_capacity IN ('20ft', '40ft_hq'));

ALTER TABLE public.custom_quotes
  ADD COLUMN IF NOT EXISTS cbm NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS container_capacity TEXT;

ALTER TABLE public.custom_quotes
  DROP CONSTRAINT IF EXISTS custom_quotes_container_capacity_check;
ALTER TABLE public.custom_quotes
  ADD CONSTRAINT custom_quotes_container_capacity_check
  CHECK (container_capacity IS NULL OR container_capacity IN ('20ft', '40ft_hq'));

ALTER TABLE public.international_shipments
  ADD COLUMN IF NOT EXISTS cbm NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS container_capacity TEXT,
  ADD COLUMN IF NOT EXISTS packing_list_url TEXT,
  ADD COLUMN IF NOT EXISTS packing_list_name TEXT;

ALTER TABLE public.international_shipments
  DROP CONSTRAINT IF EXISTS international_shipments_container_capacity_check;
ALTER TABLE public.international_shipments
  ADD CONSTRAINT international_shipments_container_capacity_check
  CHECK (container_capacity IS NULL OR container_capacity IN ('20ft', '40ft_hq'));

-- 3. Packing list storage bucket (private; path = {uid}/{shipment_id}/...)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'packing_lists',
  'packing_lists',
  false,
  26214400,
  ARRAY[
    'application/pdf',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv'
  ]
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "packing_lists_owner_insert" ON storage.objects;
CREATE POLICY "packing_lists_owner_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'packing_lists'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

DROP POLICY IF EXISTS "packing_lists_owner_select" ON storage.objects;
CREATE POLICY "packing_lists_owner_select"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'packing_lists'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

DROP POLICY IF EXISTS "packing_lists_owner_update" ON storage.objects;
CREATE POLICY "packing_lists_owner_update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'packing_lists'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  )
  WITH CHECK (
    bucket_id = 'packing_lists'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

DROP POLICY IF EXISTS "packing_lists_owner_delete" ON storage.objects;
CREATE POLICY "packing_lists_owner_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'packing_lists'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

-- 4. Realtime publication ------------------------------------------------
DO $rt$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'custom_quotes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.custom_quotes;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'international_shipments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.international_shipments;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'rfq_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.rfq_requests;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Realtime publication update skipped: %', SQLERRM;
END $rt$;

NOTIFY pgrst, 'reload schema';
