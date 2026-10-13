-- Add storage_path column to logistics_documents for delete operations
ALTER TABLE public.logistics_documents
  ADD COLUMN IF NOT EXISTS storage_path TEXT;
