-- ============================================================
-- DirectHub: 8 Strategic Pillars — Production Finalization
-- Migration: 20260831160000_eight_pillars_production_final.sql
-- ============================================================

-- ── PILLAR 1: Factory Management Enhancements ─────────────────────────────────

-- Add image compression tracking to factory products
ALTER TABLE manufacturer_products ADD COLUMN IF NOT EXISTS compressed_image_url TEXT;
ALTER TABLE manufacturer_products ADD COLUMN IF NOT EXISTS original_image_size_kb INTEGER;
ALTER TABLE manufacturer_products ADD COLUMN IF NOT EXISTS compressed_image_size_kb INTEGER;
ALTER TABLE manufacturer_products ADD COLUMN IF NOT EXISTS image_compression_ratio NUMERIC(5,2);

-- Add Mini-ERP fields to factory_registrations
ALTER TABLE factory_registrations ADD COLUMN IF NOT EXISTS erp_enabled BOOLEAN DEFAULT false;
ALTER TABLE factory_registrations ADD COLUMN IF NOT EXISTS onboarding_banner_dismissed BOOLEAN DEFAULT false;
ALTER TABLE factory_registrations ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;
ALTER TABLE factory_registrations ADD COLUMN IF NOT EXISTS onboarding_step INTEGER DEFAULT 0;

-- Raw materials inventory table (Mini-ERP)
CREATE TABLE IF NOT EXISTS raw_materials_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manufacturer_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_ar TEXT,
  supplier TEXT,
  quantity NUMERIC(12,3) NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'kg',
  unit_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_cost NUMERIC(14,2) GENERATED ALWAYS AS (quantity * unit_cost) STORED,
  import_date DATE,
  expiry_date DATE,
  status TEXT NOT NULL DEFAULT 'in_stock' CHECK (status IN ('in_stock', 'low_stock', 'out_of_stock', 'ordered')),
  reorder_level NUMERIC(12,3),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ERP operations archive
CREATE TABLE IF NOT EXISTS erp_operations_archive (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manufacturer_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  operation_type TEXT NOT NULL CHECK (operation_type IN ('sale', 'purchase', 'shipment', 'production', 'return', 'adjustment')),
  reference_number TEXT,
  description TEXT NOT NULL,
  amount NUMERIC(14,2),
  currency TEXT DEFAULT 'USD',
  related_order_id UUID,
  related_product_id UUID,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT DEFAULT 'completed',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for raw materials
ALTER TABLE raw_materials_inventory ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'raw_materials_inventory' AND policyname = 'manufacturer_own_materials') THEN
    CREATE POLICY manufacturer_own_materials ON raw_materials_inventory
      FOR ALL USING (manufacturer_id = auth.uid());
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'raw_materials_inventory' AND policyname = 'admin_all_materials') THEN
    CREATE POLICY admin_all_materials ON raw_materials_inventory
      FOR ALL USING (
        EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
      );
  END IF;
END $$;

-- RLS for ERP archive
ALTER TABLE erp_operations_archive ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'erp_operations_archive' AND policyname = 'manufacturer_own_archive') THEN
    CREATE POLICY manufacturer_own_archive ON erp_operations_archive
      FOR ALL USING (manufacturer_id = auth.uid());
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'erp_operations_archive' AND policyname = 'admin_all_archive') THEN
    CREATE POLICY admin_all_archive ON erp_operations_archive
      FOR ALL USING (
        EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
      );
  END IF;
END $$;

-- ── PILLAR 2: Hybrid B2B+B2C — Single-Unit Orders ────────────────────────────

-- Add B2C single-unit support to products
ALTER TABLE manufacturer_products ADD COLUMN IF NOT EXISTS allow_single_unit BOOLEAN DEFAULT true;
ALTER TABLE manufacturer_products ADD COLUMN IF NOT EXISTS min_order_quantity INTEGER DEFAULT 1;
ALTER TABLE manufacturer_products ADD COLUMN IF NOT EXISTS b2c_price NUMERIC(12,2);
ALTER TABLE manufacturer_products ADD COLUMN IF NOT EXISTS b2b_min_quantity INTEGER DEFAULT 10;
ALTER TABLE manufacturer_products ADD COLUMN IF NOT EXISTS order_model TEXT DEFAULT 'hybrid' CHECK (order_model IN ('b2b_only', 'b2c_only', 'hybrid'));

-- Add order category to orders table for commission tracking
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_category TEXT DEFAULT 'retail' CHECK (order_category IN ('retail', 'wholesale', 'bulk_wholesale', 'large_deal'));
ALTER TABLE orders ADD COLUMN IF NOT EXISTS container_count INTEGER DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5,4);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS commission_amount NUMERIC(12,2);

-- ── PILLAR 3: Amal Assistant — Registration Modes ────────────────────────────

-- Track Amal registration mode preference
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS amal_registration_mode TEXT CHECK (amal_registration_mode IN ('auto_assist', 'manual_guided', NULL));
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS amal_onboarding_completed BOOLEAN DEFAULT false;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS amal_commercial_tier TEXT DEFAULT 'retail' CHECK (amal_commercial_tier IN ('retail', 'wholesale', 'bulk_wholesale', 'enterprise'));

-- ── PILLAR 4: Tiered Commissions ─────────────────────────────────────────────

-- Commission configuration table (admin-managed)
CREATE TABLE IF NOT EXISTS commission_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier TEXT NOT NULL UNIQUE CHECK (tier IN ('retail', 'wholesale', 'bulk_wholesale', 'container_min', 'container_max')),
  rate NUMERIC(10,4) NOT NULL,
  description TEXT,
  description_ar TEXT,
  updated_by UUID REFERENCES user_profiles(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default commission rates (idempotent)
INSERT INTO commission_config (tier, rate, description, description_ar) VALUES
  ('retail',        0.0350, 'Retail / B2C commission (3.5%)',           'عمولة التجزئة / B2C (3.5%)'),
  ('wholesale',     0.0250, 'Wholesale / B2B commission (2.5%)',         'عمولة الجملة / B2B (2.5%)'),
  ('bulk_wholesale',0.0150, 'Bulk wholesale commission (1.5%)',          'عمولة جملة الجملة (1.5%)'),
  ('container_min', 100.00, 'Container deal minimum fee ($100)',         'رسوم الحاوية الدنيا ($100)'),
  ('container_max', 200.00, 'Container deal maximum fee ($200)',         'رسوم الحاوية القصوى ($200)')
ON CONFLICT (tier) DO UPDATE SET
  rate = EXCLUDED.rate,
  description = EXCLUDED.description,
  description_ar = EXCLUDED.description_ar,
  updated_at = NOW();

-- RLS for commission config
ALTER TABLE commission_config ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'commission_config' AND policyname = 'public_read_commission') THEN
    CREATE POLICY public_read_commission ON commission_config FOR SELECT USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'commission_config' AND policyname = 'admin_manage_commission') THEN
    CREATE POLICY admin_manage_commission ON commission_config FOR ALL USING (
      EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
    );
  END IF;
END $$;

-- ── PILLAR 5: Notifications — WhatsApp Instant Alerts ────────────────────────

-- Add WhatsApp alert preference to user profiles
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS whatsapp_alerts_enabled BOOLEAN DEFAULT true;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS whatsapp_phone TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{
  "order_updates": true,
  "escrow_events": true,
  "rfq_responses": true,
  "dispute_updates": true,
  "security_alerts": true,
  "promotions": false,
  "whatsapp_enabled": true,
  "in_app_enabled": true
}'::jsonb;

-- WhatsApp alert log
CREATE TABLE IF NOT EXISTS whatsapp_alert_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  phone TEXT NOT NULL,
  message_type TEXT NOT NULL,
  event_type TEXT,
  reference_number TEXT,
  message_id TEXT,
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'failed', 'pending')),
  error_message TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE whatsapp_alert_log ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'whatsapp_alert_log' AND policyname = 'admin_read_wa_log') THEN
    CREATE POLICY admin_read_wa_log ON whatsapp_alert_log FOR SELECT USING (
      EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
    );
  END IF;
END $$;

-- ── PILLAR 6: Chat — Multilingual Translation + Quote Cards ──────────────────

-- Add translation metadata to chat messages
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS original_language TEXT;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS translated_content JSONB DEFAULT '{}'::jsonb;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS is_quote_card BOOLEAN DEFAULT false;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS quote_card_data JSONB;

-- Quote card structure:
-- { product_name, quantity, unit_price, currency, validity_days, incoterms,
--   payment_terms, delivery_days, notes, status: 'pending'|'accepted'|'rejected' }

-- Add language preference to chat conversations
ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS buyer_language TEXT DEFAULT 'ar';
ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS manufacturer_language TEXT DEFAULT 'ar';
ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS auto_translate BOOLEAN DEFAULT true;

-- Quote card responses
CREATE TABLE IF NOT EXISTS quote_card_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  responder_id UUID NOT NULL REFERENCES user_profiles(id),
  response TEXT NOT NULL CHECK (response IN ('accepted', 'rejected', 'counter_offer')),
  counter_offer_data JSONB,
  notes TEXT,
  responded_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE quote_card_responses ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'quote_card_responses' AND policyname = 'participants_manage_quote_responses') THEN
    CREATE POLICY participants_manage_quote_responses ON quote_card_responses FOR ALL USING (
      responder_id = auth.uid() OR
      EXISTS (
        SELECT 1 FROM chat_conversations cc
        WHERE cc.id = conversation_id
        AND (cc.buyer_id = auth.uid() OR cc.manufacturer_id = auth.uid())
      )
    );
  END IF;
END $$;

-- ── PILLAR 7: Logistics — Heavy Industrial Shipping + Live Tracking ───────────

-- Add heavy industrial shipping fields to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_type TEXT DEFAULT 'standard' CHECK (shipping_type IN ('standard', 'express', 'sea_freight', 'air_freight', 'fcl_container', 'lcl_container', 'break_bulk', 'roro'));
ALTER TABLE orders ADD COLUMN IF NOT EXISTS incoterms TEXT CHECK (incoterms IN ('EXW', 'FCA', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP', 'FAS', 'FOB', 'CFR', 'CIF'));
ALTER TABLE orders ADD COLUMN IF NOT EXISTS port_of_loading TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS port_of_discharge TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS vessel_name TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS bill_of_lading TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customs_cleared_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customs_reference TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS live_tracking_url TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS logistics_partner_id UUID;

-- Live tracking events table
CREATE TABLE IF NOT EXISTS order_tracking_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'order_placed', 'payment_confirmed', 'production_started', 'production_completed',
    'quality_check_passed', 'quality_check_failed', 'packed', 'picked_up',
    'departed_origin', 'in_transit', 'arrived_port', 'customs_clearance',
    'customs_cleared', 'out_for_delivery', 'delivered', 'delivery_confirmed',
    'dispute_opened', 'dispute_resolved', 'returned'
  )),
  location TEXT,
  location_lat NUMERIC(10,7),
  location_lng NUMERIC(10,7),
  description TEXT NOT NULL,
  description_ar TEXT,
  carrier TEXT,
  tracking_number TEXT,
  estimated_arrival TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE order_tracking_events ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'order_tracking_events' AND policyname = 'order_participants_read_tracking') THEN
    CREATE POLICY order_participants_read_tracking ON order_tracking_events FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM orders o
        WHERE o.id = order_id
        AND o.user_id = auth.uid()
      ) OR
      EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
    );
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'order_tracking_events' AND policyname = 'manufacturer_admin_insert_tracking') THEN
    CREATE POLICY manufacturer_admin_insert_tracking ON order_tracking_events FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'manufacturer'))
    );
  END IF;
END $$;

-- Enable realtime for tracking events
ALTER PUBLICATION supabase_realtime ADD TABLE order_tracking_events;

-- ── PILLAR 8: Security Hardening ─────────────────────────────────────────────

-- Dual Escrow PIN: add secondary delivery confirmation PIN
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_pin_hash TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_pin_set_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_pin_verified_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS escrow_release_pin_hash TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS escrow_release_pin_set_at TIMESTAMPTZ;

-- Security audit log
CREATE TABLE IF NOT EXISTS security_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'pin_set', 'pin_verified', 'pin_failed', 'pin_lockout',
    'escrow_release_attempt', 'escrow_released', 'escrow_disputed',
    'ai_firewall_blocked', 'ai_injection_attempt',
    'rls_violation_attempt', 'suspicious_access',
    'admin_action', 'bulk_operation'
  )),
  severity TEXT DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  ip_address TEXT,
  user_agent TEXT,
  path TEXT,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE security_audit_log ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'security_audit_log' AND policyname = 'admin_read_security_log') THEN
    CREATE POLICY admin_read_security_log ON security_audit_log FOR SELECT USING (
      EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
    );
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'security_audit_log' AND policyname = 'system_insert_security_log') THEN
    CREATE POLICY system_insert_security_log ON security_audit_log FOR INSERT WITH CHECK (true);
  END IF;
END $$;

-- Strengthen RLS on pin_lockouts (ensure it exists)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pin_lockouts') THEN
    CREATE TABLE pin_lockouts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
      locked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      unlock_at TIMESTAMPTZ NOT NULL,
      failed_attempts INTEGER DEFAULT 0,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  END IF;
END $$;

ALTER TABLE pin_lockouts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pin_lockouts' AND policyname = 'user_own_lockouts') THEN
    CREATE POLICY user_own_lockouts ON pin_lockouts FOR SELECT USING (user_id = auth.uid());
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pin_lockouts' AND policyname = 'system_manage_lockouts') THEN
    CREATE POLICY system_manage_lockouts ON pin_lockouts FOR ALL USING (
      user_id = auth.uid() OR
      EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
    );
  END IF;
END $$;

-- Ensure pin_attempt_logs table exists with RLS
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pin_attempt_logs') THEN
    CREATE TABLE pin_attempt_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
      order_id UUID,
      attempt_type TEXT DEFAULT 'escrow_release',
      is_success BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  END IF;
END $$;

ALTER TABLE pin_attempt_logs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pin_attempt_logs' AND policyname = 'user_own_pin_logs') THEN
    CREATE POLICY user_own_pin_logs ON pin_attempt_logs FOR SELECT USING (user_id = auth.uid());
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pin_attempt_logs' AND policyname = 'system_insert_pin_logs') THEN
    CREATE POLICY system_insert_pin_logs ON pin_attempt_logs FOR INSERT WITH CHECK (true);
  END IF;
END $$;

-- ── Performance Indexes ───────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_raw_materials_manufacturer ON raw_materials_inventory(manufacturer_id);
CREATE INDEX IF NOT EXISTS idx_erp_archive_manufacturer ON erp_operations_archive(manufacturer_id);
CREATE INDEX IF NOT EXISTS idx_erp_archive_date ON erp_operations_archive(date DESC);
CREATE INDEX IF NOT EXISTS idx_order_tracking_order ON order_tracking_events(order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_log_user ON whatsapp_alert_log(user_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_log_user ON security_audit_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_log_event ON security_audit_log(event_type, severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quote_responses_message ON quote_card_responses(message_id);
CREATE INDEX IF NOT EXISTS idx_orders_category ON orders(order_category);
CREATE INDEX IF NOT EXISTS idx_orders_shipping_type ON orders(shipping_type);

-- ── Enable Realtime on Key Tables ─────────────────────────────────────────────

DO $$ BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE raw_materials_inventory;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE commission_config;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE whatsapp_alert_log;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE security_audit_log;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
