-- Migration: Payment Approval Workflow
-- Adds order-receipts storage bucket and payment_reference column to orders

-- Add payment_reference column to orders table (for RFQ checkout)
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS payment_reference TEXT DEFAULT NULL;

-- Add payment_proof_url column to orders table (for RFQ checkout proof upload)
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS payment_proof_url TEXT DEFAULT NULL;

-- Create order-receipts storage bucket via insert into storage.buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'order-receipts',
  'order-receipts',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for order-receipts bucket
DROP POLICY IF EXISTS "order_receipts_upload" ON storage.objects;
CREATE POLICY "order_receipts_upload"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'order-receipts');

DROP POLICY IF EXISTS "order_receipts_read" ON storage.objects;
CREATE POLICY "order_receipts_read"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'order-receipts');

DROP POLICY IF EXISTS "order_receipts_public_read" ON storage.objects;
CREATE POLICY "order_receipts_public_read"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'order-receipts');
