-- Amal AI Conversational Onboarding & Cataloging — RLS Policies
-- Allows the Amal assistant to insert factory registrations and products
-- via the service role / anon key (fast-track onboarding flow)

-- ── 1. Allow anon/service to insert into factory_registrations for Amal onboarding ──
-- The amal-onboarding API route uses the anon key with service-level access
-- We add a policy that allows insert when approval_type = 'fast_track_initial'

DROP POLICY IF EXISTS "amal_fast_track_factory_insert" ON public.factory_registrations;
CREATE POLICY "amal_fast_track_factory_insert"
ON public.factory_registrations
FOR INSERT
TO anon, authenticated
WITH CHECK (approval_type = 'fast_track_initial');

-- ── 2. Allow anon/service to insert products for Amal cataloging ──
DROP POLICY IF EXISTS "amal_product_catalog_insert" ON public.manufacturer_products;
CREATE POLICY "amal_product_catalog_insert"
ON public.manufacturer_products
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- ── 3. Add amal_session_id column to factory_registrations for tracking ──
-- This allows us to link a chat session to a factory registration
ALTER TABLE public.factory_registrations
  ADD COLUMN IF NOT EXISTS amal_session_id TEXT DEFAULT NULL;

COMMENT ON COLUMN public.factory_registrations.amal_session_id IS
  'Chat session ID from Amal AI assistant that created this registration';

-- ── 4. Index for amal session lookups ──
CREATE INDEX IF NOT EXISTS idx_factory_registrations_amal_session
  ON public.factory_registrations (amal_session_id)
  WHERE amal_session_id IS NOT NULL;
