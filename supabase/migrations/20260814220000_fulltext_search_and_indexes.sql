-- Full-text search indexes for products and factories
-- Enables instant search across millions of records

-- ── Products: Full-Text Search ──────────────────────────────────────────────

-- Add tsvector column for product search
ALTER TABLE manufacturer_products
  ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Drop old trigger and function before recreating to ensure clean replacement
-- Drop trigger first (depends on function), then function
DROP TRIGGER IF EXISTS trg_product_search_vector ON manufacturer_products;
DROP FUNCTION IF EXISTS update_product_search_vector() CASCADE;

-- Populate existing rows (cast category enum to text safely via NULLIF to avoid invalid input error)
UPDATE manufacturer_products
SET search_vector = to_tsvector('simple',
  coalesce(name, '') || ' ' ||
  coalesce(name_ar, '') || ' ' ||
  coalesce(name_zh, '') || ' ' ||
  coalesce(name_tr, '') || ' ' ||
  coalesce(description, '') || ' ' ||
  coalesce(nullif(category::text, ''), '') || ' ' ||
  coalesce(sku, '') || ' ' ||
  coalesce(origin_country, '')
);

-- GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS idx_manufacturer_products_search
  ON manufacturer_products USING GIN(search_vector);

-- Trigger to auto-update search_vector on insert/update
CREATE OR REPLACE FUNCTION update_product_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('simple',
    coalesce(NEW.name, '') || ' ' ||
    coalesce(NEW.name_ar, '') || ' ' ||
    coalesce(NEW.name_zh, '') || ' ' ||
    coalesce(NEW.name_tr, '') || ' ' ||
    coalesce(NEW.description, '') || ' ' ||
    coalesce(NEW.description_ar, '') || ' ' ||
    coalesce(nullif(NEW.category::text, ''), '') || ' ' ||
    coalesce(NEW.sku, '') || ' ' ||
    coalesce(NEW.origin_country, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_product_search_vector
  BEFORE INSERT OR UPDATE ON manufacturer_products
  FOR EACH ROW EXECUTE FUNCTION update_product_search_vector();

-- ── Factory Registrations: Full-Text Search ──────────────────────────────────

ALTER TABLE factory_registrations
  ADD COLUMN IF NOT EXISTS search_vector tsvector;

DROP TRIGGER IF EXISTS trg_factory_search_vector ON factory_registrations;
DROP FUNCTION IF EXISTS update_factory_search_vector() CASCADE;

UPDATE factory_registrations
SET search_vector = to_tsvector('simple',
  coalesce(company_name, '') || ' ' ||
  coalesce(contact_name, '') || ' ' ||
  coalesce(contact_email, '') || ' ' ||
  coalesce(industry, '') || ' ' ||
  coalesce(country, '') || ' ' ||
  coalesce(city, '') || ' ' ||
  coalesce(tax_id, '')
);

CREATE INDEX IF NOT EXISTS idx_factory_registrations_search
  ON factory_registrations USING GIN(search_vector);

CREATE OR REPLACE FUNCTION update_factory_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('simple',
    coalesce(NEW.company_name, '') || ' ' ||
    coalesce(NEW.contact_name, '') || ' ' ||
    coalesce(NEW.contact_email, '') || ' ' ||
    coalesce(NEW.industry, '') || ' ' ||
    coalesce(NEW.country, '') || ' ' ||
    coalesce(NEW.city, '') || ' ' ||
    coalesce(NEW.tax_id, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_factory_search_vector
  BEFORE INSERT OR UPDATE ON factory_registrations
  FOR EACH ROW EXECUTE FUNCTION update_factory_search_vector();

-- ── User Profiles: Full-Text Search ─────────────────────────────────────────

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS search_vector tsvector;

DROP TRIGGER IF EXISTS trg_user_search_vector ON user_profiles;
DROP FUNCTION IF EXISTS update_user_search_vector() CASCADE;

UPDATE user_profiles
SET search_vector = to_tsvector('simple',
  coalesce(full_name, '') || ' ' ||
  coalesce(email, '') || ' ' ||
  coalesce(company_name, '') || ' ' ||
  coalesce(country, '') || ' ' ||
  coalesce(phone, '')
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_search
  ON user_profiles USING GIN(search_vector);

CREATE OR REPLACE FUNCTION update_user_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('simple',
    coalesce(NEW.full_name, '') || ' ' ||
    coalesce(NEW.email, '') || ' ' ||
    coalesce(NEW.company_name, '') || ' ' ||
    coalesce(NEW.country, '') || ' ' ||
    coalesce(NEW.phone, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_user_search_vector
  BEFORE INSERT OR UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_user_search_vector();

-- ── Additional Performance Indexes ──────────────────────────────────────────

-- Orders: common query patterns
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_escrow_status ON orders(escrow_status) WHERE escrow_status IS NOT NULL;

-- Products: common filters
CREATE INDEX IF NOT EXISTS idx_products_category ON manufacturer_products(category);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON manufacturer_products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_inventory_status ON manufacturer_products(inventory_status);
CREATE INDEX IF NOT EXISTS idx_products_manufacturer_id ON manufacturer_products(manufacturer_id);

-- Factory registrations: status filter
CREATE INDEX IF NOT EXISTS idx_factory_reg_status ON factory_registrations(registration_status);
CREATE INDEX IF NOT EXISTS idx_factory_reg_submitted ON factory_registrations(submitted_at DESC);

-- User profiles: role filter
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_created ON user_profiles(created_at DESC);
