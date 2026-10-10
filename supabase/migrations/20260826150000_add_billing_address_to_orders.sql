-- Migration: Add billing_address column to orders table
-- Timestamp: 20260826150000

-- Add billing_address column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'orders'
      AND column_name = 'billing_address'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN billing_address JSONB DEFAULT '{}'::jsonb;
  END IF;
END;
$$;

-- Also add other columns that may be missing from the RFQ checkout insert
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'orders'
      AND column_name = 'order_category'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN order_category TEXT DEFAULT 'standard';
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'orders'
      AND column_name = 'platform_commission'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN platform_commission DECIMAL(12,2) DEFAULT 0;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'orders'
      AND column_name = 'commission_rate_label'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN commission_rate_label TEXT DEFAULT '';
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'orders'
      AND column_name = 'receipt_url'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN receipt_url TEXT DEFAULT '';
  END IF;
END;
$$;
