-- Performance optimization: add indexes on most-queried columns
-- These indexes dramatically speed up the most common queries across the platform

-- Orders: most queried by user_id + status + created_at
CREATE INDEX IF NOT EXISTS idx_orders_user_id_created ON orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders(status, created_at DESC);

-- RFQ requests: queried by buyer_id, is_published, status
CREATE INDEX IF NOT EXISTS idx_rfq_requests_buyer_id ON rfq_requests(buyer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rfq_requests_published_status ON rfq_requests(is_published, status, created_at DESC);

-- RFQ responses: queried by rfq_id for count lookups
CREATE INDEX IF NOT EXISTS idx_rfq_responses_rfq_id ON rfq_responses(rfq_id);

-- Manufacturer products: queried by is_active + category + origin_country
CREATE INDEX IF NOT EXISTS idx_manufacturer_products_active_category ON manufacturer_products(is_active, category);
CREATE INDEX IF NOT EXISTS idx_manufacturer_products_manufacturer_id ON manufacturer_products(manufacturer_id, is_active);

-- Order invoices: queried by created_by and buyer lookup
CREATE INDEX IF NOT EXISTS idx_order_invoices_created_by ON order_invoices(created_by, created_at DESC);

-- User profiles: queried by role for supplier/manufacturer lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);

-- Supplier profiles: queried by is_active + sort columns
CREATE INDEX IF NOT EXISTS idx_supplier_profiles_active_rating ON supplier_profiles(is_active, rating DESC);
