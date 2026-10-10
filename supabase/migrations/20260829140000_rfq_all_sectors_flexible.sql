-- Migration: RFQ All-Sector Support & Flexible Product Catalog
-- Timestamp: 20260829140000
-- Purpose: Remove product_id NOT NULL constraint to allow custom product names
--          across ALL commercial, industrial, and retail sectors without restrictions.

-- ============================================================
-- 1. MAKE product_id NULLABLE IN rfq_requests
-- ============================================================

-- Drop the NOT NULL constraint on product_id in rfq_requests
-- This allows buyers to submit RFQs with custom product names
-- without needing a linked product_id from the catalog.
ALTER TABLE public.rfq_requests
  ALTER COLUMN product_id DROP NOT NULL;

-- Set a default empty string for product_id to avoid issues with existing code
ALTER TABLE public.rfq_requests
  ALTER COLUMN product_id SET DEFAULT '';

-- ============================================================
-- 2. MAKE product_id NULLABLE IN chat_conversations
-- ============================================================

-- Drop the NOT NULL constraint on product_id in chat_conversations
-- This allows conversations to be started without a specific product link.
ALTER TABLE public.chat_conversations
  ALTER COLUMN product_id DROP NOT NULL;

ALTER TABLE public.chat_conversations
  ALTER COLUMN product_id SET DEFAULT '';

-- ============================================================
-- 3. ADD SECTOR/CATEGORY SUPPORT COLUMNS TO rfq_requests
-- ============================================================

-- Add sector column to support all commercial, industrial, and retail sectors
ALTER TABLE public.rfq_requests
  ADD COLUMN IF NOT EXISTS sector TEXT DEFAULT 'general';

-- Add category column for flexible categorization
ALTER TABLE public.rfq_requests
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT '';

-- Add custom_product_description for detailed free-text product descriptions
ALTER TABLE public.rfq_requests
  ADD COLUMN IF NOT EXISTS custom_product_description TEXT DEFAULT '';

-- ============================================================
-- 4. UPDATE RLS POLICIES TO SUPPORT ALL SECTORS
-- ============================================================

-- Ensure manufacturers can view ALL published RFQs regardless of sector
DROP POLICY IF EXISTS "manufacturers_view_published_rfqs" ON public.rfq_requests;
CREATE POLICY "manufacturers_view_published_rfqs"
ON public.rfq_requests
FOR SELECT
TO authenticated
USING (is_published = true);

-- Ensure buyers can manage their own RFQs
DROP POLICY IF EXISTS "buyers_manage_own_rfq_requests" ON public.rfq_requests;
CREATE POLICY "buyers_manage_own_rfq_requests"
ON public.rfq_requests
FOR ALL
TO authenticated
USING (buyer_id = auth.uid())
WITH CHECK (buyer_id = auth.uid());

-- Admin can view all RFQs
DROP POLICY IF EXISTS "admin_view_all_rfq_requests" ON public.rfq_requests;
CREATE POLICY "admin_view_all_rfq_requests"
ON public.rfq_requests
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- ============================================================
-- 5. ADD AMAL CONVERSATIONS TABLE FOR CUSTOMER SERVICE LOGS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.amal_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  user_name TEXT DEFAULT '',
  user_email TEXT DEFAULT '',
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  message_count INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  source_page TEXT DEFAULT '',
  language TEXT DEFAULT 'ar',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for amal_conversations
CREATE INDEX IF NOT EXISTS idx_amal_conversations_user_id ON public.amal_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_amal_conversations_session_id ON public.amal_conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_amal_conversations_last_message_at ON public.amal_conversations(last_message_at DESC);

-- Enable RLS
ALTER TABLE public.amal_conversations ENABLE ROW LEVEL SECURITY;

-- Admin can view all amal conversations
DROP POLICY IF EXISTS "admin_view_amal_conversations" ON public.amal_conversations;
CREATE POLICY "admin_view_amal_conversations"
ON public.amal_conversations
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- System can insert amal conversations (via service role)
DROP POLICY IF EXISTS "system_insert_amal_conversations" ON public.amal_conversations;
CREATE POLICY "system_insert_amal_conversations"
ON public.amal_conversations
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Users can view their own conversations
DROP POLICY IF EXISTS "users_view_own_amal_conversations" ON public.amal_conversations;
CREATE POLICY "users_view_own_amal_conversations"
ON public.amal_conversations
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- ============================================================
-- 6. ADD INDEXES FOR PERFORMANCE
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_rfq_requests_sector ON public.rfq_requests(sector);
CREATE INDEX IF NOT EXISTS idx_rfq_requests_product_name ON public.rfq_requests(product_name);
