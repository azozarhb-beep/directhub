-- ============================================================
-- Migration: Seller-Fulfilled Logistics Workflow
-- Adds fulfillment_type, incoterm_type, seller shipping fields,
-- local_clearance_required, and seller_shipping_documents table
-- ============================================================

-- 1. ADD SELLER-FULFILLED COLUMNS TO ORDERS TABLE
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS fulfillment_type TEXT DEFAULT 'directhub_logistics'
    CHECK (fulfillment_type IN ('directhub_logistics', 'seller_fulfilled')),
  ADD COLUMN IF NOT EXISTS incoterm_type TEXT
    CHECK (incoterm_type IN ('EXW', 'FOB', 'CIF', 'DDP', 'DAP')),
  ADD COLUMN IF NOT EXISTS seller_carrier_name TEXT,
  ADD COLUMN IF NOT EXISTS seller_tracking_number TEXT,
  ADD COLUMN IF NOT EXISTS seller_container_number TEXT,
  ADD COLUMN IF NOT EXISTS seller_sailing_date DATE,
  ADD COLUMN IF NOT EXISTS estimated_delivery_date DATE,
  ADD COLUMN IF NOT EXISTS local_clearance_required BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS seller_shipping_submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS seller_shipping_submitted_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL;

-- 2. SELLER SHIPPING DOCUMENTS TABLE
CREATE TABLE IF NOT EXISTS public.seller_shipping_documents (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  factory_user_id   UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  document_type     TEXT NOT NULL CHECK (document_type IN (
                      'bill_of_lading',
                      'certificate_of_origin',
                      'commercial_invoice',
                      'packing_list',
                      'other'
                    )),
  file_name         TEXT NOT NULL,
  file_url          TEXT NOT NULL,
  file_size         BIGINT NOT NULL DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'pending_review'
                      CHECK (status IN ('pending_review', 'approved', 'rejected')),
  admin_note        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. INDEXES
CREATE INDEX IF NOT EXISTS idx_orders_fulfillment_type
  ON public.orders (fulfillment_type);

CREATE INDEX IF NOT EXISTS idx_orders_incoterm_type
  ON public.orders (incoterm_type);

CREATE INDEX IF NOT EXISTS idx_seller_shipping_docs_order_id
  ON public.seller_shipping_documents (order_id);

CREATE INDEX IF NOT EXISTS idx_seller_shipping_docs_factory
  ON public.seller_shipping_documents (factory_user_id, created_at DESC);

-- 4. ENABLE RLS
ALTER TABLE public.seller_shipping_documents ENABLE ROW LEVEL SECURITY;

-- 5. RLS POLICIES FOR SELLER SHIPPING DOCUMENTS

-- Factory: manage their own documents
DROP POLICY IF EXISTS "factory_manage_own_seller_shipping_docs" ON public.seller_shipping_documents;
CREATE POLICY "factory_manage_own_seller_shipping_docs"
  ON public.seller_shipping_documents
  FOR ALL
  TO authenticated
  USING (factory_user_id = auth.uid())
  WITH CHECK (factory_user_id = auth.uid());

-- Buyer: view documents for their orders
DROP POLICY IF EXISTS "buyer_view_seller_shipping_docs" ON public.seller_shipping_documents;
CREATE POLICY "buyer_view_seller_shipping_docs"
  ON public.seller_shipping_documents
  FOR SELECT
  TO authenticated
  USING (
    order_id IN (
      SELECT id FROM public.orders WHERE user_id = auth.uid()
    )
  );

-- Admin: full access
DROP POLICY IF EXISTS "admin_full_seller_shipping_docs" ON public.seller_shipping_documents;
CREATE POLICY "admin_full_seller_shipping_docs"
  ON public.seller_shipping_documents
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  );

-- 6. STORAGE BUCKET: seller-shipping-docs
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'seller-shipping-docs',
  'seller-shipping-docs',
  false,
  26214400,
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- 7. STORAGE RLS POLICIES

DROP POLICY IF EXISTS "factory_upload_seller_shipping_docs" ON storage.objects;
CREATE POLICY "factory_upload_seller_shipping_docs"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'seller-shipping-docs'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

DROP POLICY IF EXISTS "factory_read_own_seller_shipping_docs" ON storage.objects;
CREATE POLICY "factory_read_own_seller_shipping_docs"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'seller-shipping-docs'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

DROP POLICY IF EXISTS "factory_delete_own_seller_shipping_docs" ON storage.objects;
CREATE POLICY "factory_delete_own_seller_shipping_docs"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'seller-shipping-docs'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

DROP POLICY IF EXISTS "admin_full_seller_shipping_docs_storage" ON storage.objects;
CREATE POLICY "admin_full_seller_shipping_docs_storage"
  ON storage.objects
  FOR ALL
  TO authenticated
  USING (
    bucket_id = 'seller-shipping-docs'
    AND EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  )
  WITH CHECK (
    bucket_id = 'seller-shipping-docs'
    AND EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  );

-- Buyer: read documents for their orders via storage
DROP POLICY IF EXISTS "buyer_read_seller_shipping_docs_storage" ON storage.objects;
CREATE POLICY "buyer_read_seller_shipping_docs_storage"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'seller-shipping-docs'
    AND EXISTS (
      SELECT 1 FROM public.seller_shipping_documents ssd
      JOIN public.orders o ON ssd.order_id = o.id
      WHERE o.user_id = auth.uid()
        AND ssd.file_url LIKE '%' || name || '%'
    )
  );
