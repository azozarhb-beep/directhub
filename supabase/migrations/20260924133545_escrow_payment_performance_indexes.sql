-- Performance indexes for escrow and payment queries
-- Migration: 20260924133545_escrow_payment_performance_indexes.sql

-- 1. Index to speed up escrow ledger queries by event type
CREATE INDEX IF NOT EXISTS idx_escrow_ledger_status 
ON public.escrow_ledger (event_type, created_at DESC);

-- 2. Index to link escrow ledger entries to order numbers and enable fast search
CREATE INDEX IF NOT EXISTS idx_escrow_ledger_order 
ON public.escrow_ledger (order_id, created_at DESC);

-- 3. Index to speed up filtering and tracking of payment submissions
CREATE INDEX IF NOT EXISTS idx_payment_submissions_status 
ON public.payment_submissions (verification_status, created_at DESC);
