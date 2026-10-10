-- Migration: Add logistics_partner_id to orders table
-- and trigger to auto-populate it from logistics_escrow_payments on insert

-- Step 1: Add logistics_partner_id column to orders (UUID, nullable, FK to logistics_partners.id)
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS logistics_partner_id UUID
  REFERENCES public.logistics_partners(id) ON DELETE SET NULL;

-- Step 2: Index for performance
CREATE INDEX IF NOT EXISTS idx_orders_logistics_partner_id
  ON public.orders(logistics_partner_id);

-- Step 3: Trigger function — when a logistics_escrow_payments row is inserted
-- with a non-null order_id, update the corresponding orders row with the partner_id
CREATE OR REPLACE FUNCTION public.sync_order_logistics_partner_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only act when order_id is provided on the new payment record
  IF NEW.order_id IS NOT NULL AND NEW.partner_id IS NOT NULL THEN
    UPDATE public.orders
    SET logistics_partner_id = NEW.partner_id
    WHERE id = NEW.order_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Step 4: Attach trigger to logistics_escrow_payments (AFTER INSERT)
DROP TRIGGER IF EXISTS trg_sync_order_logistics_partner_id ON public.logistics_escrow_payments;
CREATE TRIGGER trg_sync_order_logistics_partner_id
  AFTER INSERT ON public.logistics_escrow_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_order_logistics_partner_id();
