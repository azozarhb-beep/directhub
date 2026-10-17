-- Raise factory-documents bucket max object size to 50MB
UPDATE storage.buckets
SET file_size_limit = 52428800
WHERE id = 'factory-documents';
