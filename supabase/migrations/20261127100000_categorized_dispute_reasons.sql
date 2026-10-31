-- Categorized dispute reasons: extend order_disputes.reason to accept the 5 structured categories
-- while keeping the two legacy values valid for existing rows.
ALTER TABLE public.order_disputes
DROP CONSTRAINT IF EXISTS order_disputes_reason_check;

ALTER TABLE public.order_disputes
ADD CONSTRAINT order_disputes_reason_check CHECK (
    reason IN (
      'late_delivery',
      'product_mismatch',
      'quality_defect',
      'delivery_delay',
      'quantity_shortage',
      'transit_damage',
      'payment_dispute'
    )
  );
