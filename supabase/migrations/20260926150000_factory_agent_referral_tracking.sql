-- Migration: Add referred_by_agent_id to factory_registrations for referral tracking
-- Timestamp: 20260926150000

-- Add referred_by_agent_id column to factory_registrations if it doesn't exist
ALTER TABLE public.factory_registrations
ADD COLUMN IF NOT EXISTS referred_by_agent_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add index for fast lookup of factories by referring agent
CREATE INDEX IF NOT EXISTS idx_factory_registrations_referred_by_agent_id
ON public.factory_registrations(referred_by_agent_id);

-- Ensure approval_type column exists (added by previous migration, but safe to re-add)
ALTER TABLE public.factory_registrations
ADD COLUMN IF NOT EXISTS approval_type TEXT DEFAULT NULL;

ALTER TABLE public.factory_registrations
ADD COLUMN IF NOT EXISTS fast_track_approved_at TIMESTAMPTZ DEFAULT NULL;
