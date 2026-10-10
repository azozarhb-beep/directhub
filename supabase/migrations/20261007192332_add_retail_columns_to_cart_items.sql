-- Migration: Add is_retail_available and retail_price columns to cart_items
-- These columns support retail pricing and availability tracking on cart items.

ALTER TABLE public.cart_items
  ADD COLUMN IF NOT EXISTS is_retail_available BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS retail_price NUMERIC NOT NULL DEFAULT 0;
