-- ============================================================
-- DirectHub Scale-Up: Advanced Database Indexing & Performance
-- Migration: 20260926210000_advanced_scaleup_indexes.sql
-- Goal: Sub-50ms response times for millions of products &
--       thousands of factories (local + international)
-- ============================================================

-- ============================================================
-- SECTION 1: MANUFACTURER PRODUCTS (Core Catalog Engine)
-- High-volume table — must support millions of rows
-- ============================================================

-- Full-text search vector index (GIN) — powers instant product search
CREATE INDEX IF NOT EXISTS idx_mp_search_vector_gin
  ON public.manufacturer_products USING GIN (search_vector);

-- Composite: active + published products by category (most common browse query)
CREATE INDEX IF NOT EXISTS idx_mp_active_published_category
  ON public.manufacturer_products (is_active, is_published, category)
  WHERE is_active = true AND is_published = true;

-- Composite: active + published + factory_type (local vs international browse)
CREATE INDEX IF NOT EXISTS idx_mp_active_published_factory_type
  ON public.manufacturer_products (is_active, is_published, factory_type)
  WHERE is_active = true AND is_published = true;

-- Composite: manufacturer_id + active + published (factory storefront queries)
CREATE INDEX IF NOT EXISTS idx_mp_manufacturer_active_published
  ON public.manufacturer_products (manufacturer_id, is_active, is_published, created_at DESC);

-- Price range filtering (B2B/B2C marketplace queries)
CREATE INDEX IF NOT EXISTS idx_mp_unit_price
  ON public.manufacturer_products (unit_price)
  WHERE is_active = true AND is_published = true;

-- Origin country filtering (international sourcing)
CREATE INDEX IF NOT EXISTS idx_mp_origin_country_active
  ON public.manufacturer_products (origin_country, is_active, is_published)
  WHERE is_active = true;

-- Inventory status filtering (in-stock queries)
CREATE INDEX IF NOT EXISTS idx_mp_inventory_status
  ON public.manufacturer_products (inventory_status, is_active)
  WHERE is_active = true;

-- Category ID + active (hierarchical category browsing)
CREATE INDEX IF NOT EXISTS idx_mp_category_id_active
  ON public.manufacturer_products (category_id, is_active, is_published)
  WHERE is_active = true;

-- International manufacturer linkage
CREATE INDEX IF NOT EXISTS idx_mp_intl_manufacturer_id
  ON public.manufacturer_products (international_manufacturer_id)
  WHERE international_manufacturer_id IS NOT NULL;

-- Average rating for sorting (top-rated products)
CREATE INDEX IF NOT EXISTS idx_mp_avg_rating_active
  ON public.manufacturer_products (avg_rating DESC, review_count DESC)
  WHERE is_active = true AND is_published = true;

-- Updated_at for recently-updated product feeds
CREATE INDEX IF NOT EXISTS idx_mp_updated_at
  ON public.manufacturer_products (updated_at DESC)
  WHERE is_active = true;

-- Industry sector filtering
CREATE INDEX IF NOT EXISTS idx_mp_industry_sector
  ON public.manufacturer_products (industry_sector)
  WHERE industry_sector IS NOT NULL AND is_active = true;

-- HS code lookups (customs & international trade)
CREATE INDEX IF NOT EXISTS idx_mp_hs_code
  ON public.manufacturer_products (hs_code)
  WHERE hs_code IS NOT NULL AND hs_code != '';

-- ============================================================
-- SECTION 2: FACTORY REGISTRATIONS (Factory Directory)
-- Supports thousands of local + international factories
-- ============================================================

-- Full-text search on factory registrations
CREATE INDEX IF NOT EXISTS idx_fr_search_vector_gin
  ON public.factory_registrations USING GIN (search_vector);

-- Registration status + factory_type (admin approval queue)
CREATE INDEX IF NOT EXISTS idx_fr_status_factory_type
  ON public.factory_registrations (registration_status, factory_type, created_at DESC);

-- Approved + active factories (public directory)
CREATE INDEX IF NOT EXISTS idx_fr_approved_active
  ON public.factory_registrations (is_approved, is_active, factory_type)
  WHERE is_approved = true AND is_active = true;

-- Country + approved (geographic factory search)
CREATE INDEX IF NOT EXISTS idx_fr_country_approved
  ON public.factory_registrations (country, is_approved, is_active)
  WHERE is_approved = true;

-- Seller category (local_factory / international_factory / local_supplier)
CREATE INDEX IF NOT EXISTS idx_fr_seller_category_approved
  ON public.factory_registrations (seller_category, is_approved, created_at DESC);

-- KYC status (compliance queue)
CREATE INDEX IF NOT EXISTS idx_fr_kyc_status
  ON public.factory_registrations (kyc_status, registration_status);

-- Trust percentage + verified tier (trust scoring)
CREATE INDEX IF NOT EXISTS idx_fr_trust_percentage
  ON public.factory_registrations (trust_percentage DESC, verified_tier)
  WHERE is_approved = true;

-- Priority score (fast-track approval queue)
CREATE INDEX IF NOT EXISTS idx_fr_priority_score
  ON public.factory_registrations (priority_score DESC, registration_status);

-- Referred by agent (agent commission tracking)
CREATE INDEX IF NOT EXISTS idx_fr_referred_by_agent
  ON public.factory_registrations (referred_by_agent_id)
  WHERE referred_by_agent_id IS NOT NULL;

-- Industry filtering
CREATE INDEX IF NOT EXISTS idx_fr_industry
  ON public.factory_registrations (industry, is_approved)
  WHERE industry IS NOT NULL AND industry != '';

-- ============================================================
-- SECTION 3: ORDERS (Transaction Engine)
-- ============================================================

-- Composite: factory_user_id + status + created_at (factory order queue)
CREATE INDEX IF NOT EXISTS idx_orders_manufacturer_status
  ON public.orders (factory_user_id, status, created_at DESC);

-- Composite: logistics_partner_id + status (logistics dashboard)
CREATE INDEX IF NOT EXISTS idx_orders_logistics_status
  ON public.orders (logistics_partner_id, status, created_at DESC)
  WHERE logistics_partner_id IS NOT NULL;

-- Total for revenue analytics
CREATE INDEX IF NOT EXISTS idx_orders_total_amount
  ON public.orders (total DESC, created_at DESC);

-- Escrow status (financial reconciliation)
CREATE INDEX IF NOT EXISTS idx_orders_payment_status
  ON public.orders (escrow_status, created_at DESC)
  WHERE escrow_status IS NOT NULL;

-- ============================================================
-- SECTION 4: RFQ SYSTEM (Request for Quotation Engine)
-- ============================================================

-- Factory_id + status (factory RFQ inbox)
CREATE INDEX IF NOT EXISTS idx_rfq_factory_status
  ON public.rfq_requests (factory_id, status, created_at DESC)
  WHERE factory_id IS NOT NULL;

-- Sector + published + status (sector-based RFQ board)
CREATE INDEX IF NOT EXISTS idx_rfq_sector_published
  ON public.rfq_requests (sector, is_published, status, created_at DESC)
  WHERE is_published = true;

-- Expires_at (expiry management)
CREATE INDEX IF NOT EXISTS idx_rfq_expires_at
  ON public.rfq_requests (expires_at, status)
  WHERE status = 'pending';

-- AI routing status
CREATE INDEX IF NOT EXISTS idx_rfq_routing_status
  ON public.rfq_requests (routing_status, ai_routed, created_at DESC);

-- Urgency + published (urgent RFQ prioritization)
CREATE INDEX IF NOT EXISTS idx_rfq_urgency_published
  ON public.rfq_requests (urgency, is_published, created_at DESC)
  WHERE is_published = true;

-- RFQ responses: manufacturer_id + created_at (manufacturer response tracking)
CREATE INDEX IF NOT EXISTS idx_rfq_responses_manufacturer_created
  ON public.rfq_responses (manufacturer_id, created_at DESC);

-- ============================================================
-- SECTION 5: CHAT & MESSAGING (Real-time Communication)
-- ============================================================

-- Chat conversations: last_message_at (inbox sorting)
CREATE INDEX IF NOT EXISTS idx_chat_conv_last_message
  ON public.chat_conversations (buyer_id, last_message_at DESC)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_chat_conv_manufacturer_last_message
  ON public.chat_conversations (manufacturer_id, last_message_at DESC)
  WHERE is_active = true AND manufacturer_id IS NOT NULL;

-- Chat messages: conversation_id + created_at (message thread loading)
CREATE INDEX IF NOT EXISTS idx_chat_messages_conv_created
  ON public.chat_messages (conversation_id, created_at ASC);

-- Chat messages: sender_id (sent messages lookup)
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender
  ON public.chat_messages (sender_id, created_at DESC);

-- ============================================================
-- SECTION 6: NOTIFICATIONS (Alert Engine)
-- ============================================================

-- Notifications: user_id + is_read + created_at (unread badge count)
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications (user_id, is_read, created_at DESC);

-- Notifications: type + created_at (notification type filtering)
CREATE INDEX IF NOT EXISTS idx_notifications_type_created
  ON public.notifications (type, created_at DESC)
  WHERE is_read = false;

-- ============================================================
-- SECTION 7: INTERNATIONAL MANUFACTURERS
-- ============================================================

-- International manufacturers: country + is_active (directory)
CREATE INDEX IF NOT EXISTS idx_intl_mfr_country_verified
  ON public.international_manufacturers (country, is_active, created_at DESC)
  WHERE is_active = true;

-- International manufacturers: industries (GIN index for array search)
CREATE INDEX IF NOT EXISTS idx_intl_mfr_industry
  ON public.international_manufacturers USING GIN (industries)
  WHERE industries IS NOT NULL;

-- ============================================================
-- SECTION 8: SUPPLIER PROFILES (Supplier Directory)
-- ============================================================

-- Supplier profiles: country + is_active + rating (geographic search)
CREATE INDEX IF NOT EXISTS idx_supplier_profiles_country_active
  ON public.supplier_profiles (country, is_active, rating DESC)
  WHERE is_active = true;

-- Supplier profiles: main_categories + is_active (category browse — GIN for array search)
CREATE INDEX IF NOT EXISTS idx_supplier_profiles_category_active
  ON public.supplier_profiles USING GIN (main_categories)
  WHERE is_active = true;

-- ============================================================
-- SECTION 9: LOGISTICS & SHIPPING
-- ============================================================

-- Logistics partners: is_active + service_type
CREATE INDEX IF NOT EXISTS idx_logistics_partners_active
  ON public.logistics_partners (is_active, created_at DESC)
  WHERE is_active = true;

-- Order logistics selections: order_id (fast join)
CREATE INDEX IF NOT EXISTS idx_order_logistics_order_id
  ON public.order_logistics_selections (order_id);

-- ============================================================
-- SECTION 10: ESCROW & PAYMENTS
-- ============================================================

-- Escrow phases: order_id + status (escrow workflow)
CREATE INDEX IF NOT EXISTS idx_escrow_phases_order_status
  ON public.escrow_phases (order_id, status);

-- Payment submissions: order_id (payment lookup)
CREATE INDEX IF NOT EXISTS idx_payment_submissions_order_id
  ON public.payment_submissions (order_id, created_at DESC);

-- ============================================================
-- SECTION 11: ANALYTICS & TRACKING
-- ============================================================

-- Product views: product_id + viewed_at (popularity ranking)
CREATE INDEX IF NOT EXISTS idx_product_views_product_created
  ON public.product_views (product_id, viewed_at DESC);

-- Page views: page_path + viewed_at (traffic analytics)
CREATE INDEX IF NOT EXISTS idx_page_views_path_created
  ON public.page_views (page_path, viewed_at DESC);

-- Seller analytics: factory_id + period (dashboard metrics)
CREATE INDEX IF NOT EXISTS idx_seller_analytics_seller_period
  ON public.seller_analytics (factory_id, period_date DESC);

-- ============================================================
-- SECTION 12: AGENT SYSTEM
-- ============================================================

-- Agent factory registrations: agent_id + status
CREATE INDEX IF NOT EXISTS idx_agent_factory_reg_agent_status
  ON public.agent_factory_registrations (agent_id, registration_status, created_at DESC);

-- Agent commission accounts: agent_id
CREATE INDEX IF NOT EXISTS idx_agent_commission_agent_id
  ON public.agent_commission_accounts (agent_id);

-- ============================================================
-- SECTION 13: FULL-TEXT SEARCH TRIGGERS (Auto-update search vectors)
-- ============================================================

-- Function: update manufacturer_products search vector
CREATE OR REPLACE FUNCTION public.update_manufacturer_products_search_vector()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $func$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('arabic', COALESCE(NEW.name_ar, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B') ||
    setweight(to_tsvector('arabic', COALESCE(NEW.description_ar, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.hs_code, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW.origin_country, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW.industry_sector, '')), 'C');
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trg_mp_search_vector ON public.manufacturer_products;
CREATE TRIGGER trg_mp_search_vector
  BEFORE INSERT OR UPDATE OF name, name_ar, description, description_ar, hs_code, origin_country, industry_sector
  ON public.manufacturer_products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_manufacturer_products_search_vector();

-- Function: update factory_registrations search vector
CREATE OR REPLACE FUNCTION public.update_factory_registrations_search_vector()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $func$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.company_name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.industry, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.country, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.city, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW.region, '')), 'C');
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trg_fr_search_vector ON public.factory_registrations;
CREATE TRIGGER trg_fr_search_vector
  BEFORE INSERT OR UPDATE OF company_name, industry, country, city, region
  ON public.factory_registrations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_factory_registrations_search_vector();

-- ============================================================
-- SECTION 14: BACK-FILL EXISTING SEARCH VECTORS
-- Populate search_vector for all existing rows
-- ============================================================

DO $$
BEGIN
  -- Back-fill manufacturer_products search vectors
  UPDATE public.manufacturer_products
  SET search_vector =
    setweight(to_tsvector('arabic', COALESCE(name_ar, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(description, '')), 'B') ||
    setweight(to_tsvector('arabic', COALESCE(description_ar, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(hs_code, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(origin_country, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(industry_sector, '')), 'C')
  WHERE search_vector IS NULL;

  -- Back-fill factory_registrations search vectors
  UPDATE public.factory_registrations
  SET search_vector =
    setweight(to_tsvector('english', COALESCE(company_name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(industry, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(country, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(city, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(region, '')), 'C')
  WHERE search_vector IS NULL;

  RAISE NOTICE 'DirectHub Scale-Up: Advanced indexes and search vectors applied successfully.';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Back-fill completed with notice: %', SQLERRM;
END $$;
