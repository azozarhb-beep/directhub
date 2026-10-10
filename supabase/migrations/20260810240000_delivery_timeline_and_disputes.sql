-- Migration: Dynamic Delivery Timeline & Order Dispute/Refund System
-- Timestamp: 20260810240000

-- ============================================================
-- 1. ADD DELIVERY TIMELINE COLUMNS TO ORDERS TABLE
-- ============================================================
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS agreed_delivery_days INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS expected_delivery_date TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS delivery_otp_code TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS delivery_otp_generated_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS delivery_otp_verified_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS funds_released_at TIMESTAMPTZ DEFAULT NULL;

-- ============================================================
-- 2. ADD DISPUTE / REFUND COLUMNS TO ORDERS TABLE
-- ============================================================
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS dispute_status TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS dispute_reported_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS dispute_reason TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS refund_status TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS refund_approved_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS refund_approved_by UUID DEFAULT NULL,
ADD COLUMN IF NOT EXISTS refund_rejected_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS refund_rejected_by UUID DEFAULT NULL,
ADD COLUMN IF NOT EXISTS refund_admin_note TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS refund_amount DECIMAL(12,2) DEFAULT NULL;

-- ============================================================
-- 3. INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_orders_expected_delivery ON public.orders(expected_delivery_date) WHERE expected_delivery_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_dispute_status ON public.orders(dispute_status) WHERE dispute_status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_refund_status ON public.orders(refund_status) WHERE refund_status IS NOT NULL;

-- ============================================================
-- 4. FUNCTION: Set expected delivery date when agreed_delivery_days is set
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_expected_delivery_date()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.agreed_delivery_days IS NOT NULL AND NEW.agreed_delivery_days > 0 THEN
        IF (OLD IS NULL) OR (OLD.agreed_delivery_days IS DISTINCT FROM NEW.agreed_delivery_days) THEN
            NEW.expected_delivery_date := COALESCE(NEW.confirmed_at, CURRENT_TIMESTAMP) + (NEW.agreed_delivery_days || ' days')::INTERVAL;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_expected_delivery_date ON public.orders;
CREATE TRIGGER trg_set_expected_delivery_date
BEFORE INSERT OR UPDATE OF agreed_delivery_days ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.set_expected_delivery_date();
