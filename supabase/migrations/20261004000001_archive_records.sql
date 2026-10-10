CREATE TABLE IF NOT EXISTS archive_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('invoice', 'bill', 'certificate', 'shipping_doc', 'customs_doc', 'other')),
  file_url TEXT,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  shared_with_roles TEXT[] DEFAULT '{}',
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE archive_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view records shared with their role or owned by them"
  ON archive_records FOR SELECT
  USING (
    owner_id = auth.uid()
    OR auth.uid() IN (
      SELECT id FROM user_profiles
      WHERE role::text = ANY(archive_records.shared_with_roles)
    )
  );

CREATE POLICY "Owners can insert archive records"
  ON archive_records FOR INSERT
  WITH CHECK (owner_id = auth.uid());
