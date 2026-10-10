CREATE TABLE IF NOT EXISTS product_warranties (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES manufacturer_products(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  warranty_period_months INTEGER NOT NULL DEFAULT 12,
  terms TEXT,
  starts_at TIMESTAMPTZ,
  expires_at TIMESTAMP GENERATED ALWAYS AS ((starts_at AT TIME ZONE 'UTC') + make_interval(months => warranty_period_months)) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE product_warranties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Manufacturers can manage their product warranties"
  ON product_warranties FOR ALL
  USING (
    product_id IN (
      SELECT id FROM manufacturer_products WHERE manufacturer_id = auth.uid()
    )
  );

CREATE POLICY "Buyers can view warranties for their orders"
  ON product_warranties FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders o WHERE o.id = product_warranties.order_id AND o.user_id = auth.uid()
    )
  );
