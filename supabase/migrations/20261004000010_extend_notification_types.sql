-- Convert notification_type from a rigid enum to flexible TEXT to support all current and future notification types

ALTER TABLE public.notifications ALTER COLUMN type TYPE TEXT;

DROP TYPE IF EXISTS public.notification_type CASCADE;

-- Add a check constraint to keep valid values documented

ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (
  type IN (
    'rfq_submitted', 'rfq_responded', 'rfq_accepted', 'rfq_rejected',
    'new_message', 'order_update', 'system',
    'payment_submitted', 'order_placed', 'order_confirmed', 'order_shipped', 'order_delivered', 'order_cancelled',
    'escrow_funded', 'escrow_green_light', 'escrow_mark_ready', 'escrow_release_code', 'escrow_released', 'escrow_dispute',
    'payment_confirmed', 'kyc_submitted', 'kyc_approved', 'kyc_rejected',
    'factory_registered', 'factory_approved', 'b2s_registered', 'b2s_approved', 'buyer_registered',
    'quote_sent', 'quote_accepted', 'invoice_generated',
    'dispute_opened', 'dispute_resolved',
    'whatsapp_sent', 'diagnostic_alert', 'simulation_complete', 'translation_ready'
  )
);
