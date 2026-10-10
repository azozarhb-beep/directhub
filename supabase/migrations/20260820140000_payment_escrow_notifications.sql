-- Migration: Payment Channels, Escrow Enhancements & Factory Notifications
-- Timestamp: 20260820140000
-- Adds payment_submissions table, escrow columns, factory order notifications

-- ============================================================
-- 1. PAYMENT SUBMISSIONS TABLE
-- Stores full payment channel data for each order
-- ============================================================
CREATE TABLE IF NOT EXISTS public.payment_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,

  -- Which channel was used
  payment_channel TEXT NOT NULL CHECK (
    payment_channel IN (
      'local_wallet',
      'local_bank_transfer',
      'international_card',
      'international_swift'
    )
  ),

  -- Local Wallet fields
  wallet_provider TEXT,
  wallet_pos_number TEXT,
  wallet_sender_name TEXT,
  wallet_sender_phone TEXT,
  wallet_transfer_ref TEXT,
  wallet_receipt_url TEXT,
  wallet_receipt_filename TEXT,

  -- Local Bank Transfer fields
  bank_sender_bank_name TEXT,
  bank_sender_account_name TEXT,
  bank_sender_account_number TEXT,
  bank_transfer_ref TEXT,
  bank_receipt_url TEXT,
  bank_receipt_filename TEXT,

  -- International SWIFT fields
  swift_sender_bank_name TEXT,
  swift_sender_iban TEXT,
  swift_ref TEXT,
  swift_receipt_url TEXT,
  swift_receipt_filename TEXT,

  -- Status
  verification_status TEXT DEFAULT 'pending' CHECK (
    verification_status IN ('pending', 'verified', 'rejected')
  ),
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  rejection_reason TEXT,

  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payment_submissions_order_id ON public.payment_submissions(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_submissions_user_id ON public.payment_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_submissions_status ON public.payment_submissions(verification_status);

-- ============================================================
-- 2. ADD COLUMNS TO ORDERS TABLE
-- ============================================================
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_channel TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS payment_submission_id UUID DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS escrow_held_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS escrow_green_light_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS escrow_green_light_by UUID DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS factory_invoice_sent_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS buyer_escrow_notified_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS delivery_deadline TIMESTAMPTZ DEFAULT NULL;

-- ============================================================
-- 3. FACTORY ORDER NOTIFICATIONS TABLE
-- Stores official order invoices sent to factories
-- ============================================================
CREATE TABLE IF NOT EXISTS public.factory_order_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  factory_user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  factory_email TEXT,

  -- Order details snapshot
  order_number TEXT NOT NULL,
  order_items JSONB DEFAULT '[]'::jsonb,
  order_total NUMERIC(12,2) DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  delivery_deadline TIMESTAMPTZ,
  notes TEXT,

  -- Escrow confirmation
  escrow_confirmed BOOLEAN DEFAULT true,
  escrow_amount NUMERIC(12,2) DEFAULT 0,
  escrow_message TEXT,

  -- Notification status
  notification_type TEXT DEFAULT 'order_invoice' CHECK (
    notification_type IN ('order_invoice', 'escrow_release', 'order_update')
  ),
  sent_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  email_sent BOOLEAN DEFAULT false,
  whatsapp_sent BOOLEAN DEFAULT false,
  in_app_sent BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_factory_order_notifications_order_id ON public.factory_order_notifications(order_id);
CREATE INDEX IF NOT EXISTS idx_factory_order_notifications_factory ON public.factory_order_notifications(factory_user_id);

-- ============================================================
-- 4. ESCROW LEDGER TABLE
-- Tracks all escrow fund movements
-- ============================================================
CREATE TABLE IF NOT EXISTS public.escrow_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,

  event_type TEXT NOT NULL CHECK (
    event_type IN (
      'payment_received',
      'funds_held',
      'funds_released',
      'funds_refunded',
      'payment_verified'
    )
  ),
  amount NUMERIC(12,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  payment_channel TEXT,
  note TEXT,
  performed_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_escrow_ledger_order_id ON public.escrow_ledger(order_id);
CREATE INDEX IF NOT EXISTS idx_escrow_ledger_user_id ON public.escrow_ledger(user_id);

-- ============================================================
-- 5. ENABLE RLS
-- ============================================================
ALTER TABLE public.payment_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.factory_order_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escrow_ledger ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 6. RLS POLICIES — PAYMENT SUBMISSIONS
-- ============================================================
DROP POLICY IF EXISTS "users_manage_own_payment_submissions" ON public.payment_submissions;
CREATE POLICY "users_manage_own_payment_submissions"
ON public.payment_submissions
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "admin_manage_payment_submissions" ON public.payment_submissions;
CREATE POLICY "admin_manage_payment_submissions"
ON public.payment_submissions
FOR ALL
TO authenticated
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

-- ============================================================
-- 7. RLS POLICIES — FACTORY ORDER NOTIFICATIONS
-- ============================================================
DROP POLICY IF EXISTS "factory_view_own_notifications" ON public.factory_order_notifications;
CREATE POLICY "factory_view_own_notifications"
ON public.factory_order_notifications
FOR SELECT
TO authenticated
USING (factory_user_id = auth.uid());

DROP POLICY IF EXISTS "admin_manage_factory_notifications" ON public.factory_order_notifications;
CREATE POLICY "admin_manage_factory_notifications"
ON public.factory_order_notifications
FOR ALL
TO authenticated
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

-- Allow system inserts (service role)
DROP POLICY IF EXISTS "service_insert_factory_notifications" ON public.factory_order_notifications;
CREATE POLICY "service_insert_factory_notifications"
ON public.factory_order_notifications
FOR INSERT
TO authenticated
WITH CHECK (true);

-- ============================================================
-- 8. RLS POLICIES — ESCROW LEDGER
-- ============================================================
DROP POLICY IF EXISTS "users_view_own_escrow_ledger" ON public.escrow_ledger;
CREATE POLICY "users_view_own_escrow_ledger"
ON public.escrow_ledger
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "admin_manage_escrow_ledger" ON public.escrow_ledger;
CREATE POLICY "admin_manage_escrow_ledger"
ON public.escrow_ledger
FOR ALL
TO authenticated
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS "service_insert_escrow_ledger" ON public.escrow_ledger;
CREATE POLICY "service_insert_escrow_ledger"
ON public.escrow_ledger
FOR INSERT
TO authenticated
WITH CHECK (true);
