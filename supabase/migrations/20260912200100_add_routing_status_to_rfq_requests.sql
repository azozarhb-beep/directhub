-- Migration: Add routing_status column to rfq_requests
-- Adds a TEXT column with default 'pending' to track global RFQ routing state

ALTER TABLE public.rfq_requests
ADD COLUMN IF NOT EXISTS routing_status TEXT DEFAULT 'pending';
