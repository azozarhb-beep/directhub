-- Migration: Bank Transfer Receipts & Order Fulfillment
-- Timestamp: 20260810210000

-- ============================================================
-- 1. ADD RECEIPT COLUMNS TO ORDERS TABLE
-- ============================================================
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS receipt_url TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS receipt_filename TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS payment_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS payment_verified_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS payment_verified_by UUID DEFAULT NULL,
ADD COLUMN IF NOT EXISTS admin_note TEXT DEFAULT '';

-- ============================================================
-- 2. STORAGE BUCKET FOR RECEIPTS (via SQL policy setup)
-- ============================================================

-- ============================================================
-- 3. INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_orders_payment_verified ON public.orders(payment_verified);
CREATE INDEX IF NOT EXISTS idx_orders_receipt_url ON public.orders(receipt_url) WHERE receipt_url IS NOT NULL;

-- ============================================================
-- 4. FUNCTIONS
-- ============================================================

-- Function to check if user is admin (via auth metadata)
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
SELECT EXISTS (
    SELECT 1 FROM auth.users au
    WHERE au.id = auth.uid()
    AND (
        au.raw_user_meta_data->>'role' = 'admin'
        OR au.raw_app_meta_data->>'role' = 'admin'
    )
)
$$;

-- ============================================================
-- 5. RLS POLICIES — update orders to allow admin full access
-- ============================================================

-- Drop existing orders policy and recreate with admin support
DROP POLICY IF EXISTS "users_manage_own_orders" ON public.orders;

-- Buyers manage their own orders
CREATE POLICY "users_manage_own_orders"
ON public.orders
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Admins can view all orders
DROP POLICY IF EXISTS "admin_view_all_orders" ON public.orders;
CREATE POLICY "admin_view_all_orders"
ON public.orders
FOR SELECT
TO authenticated
USING (public.is_admin_user());

-- Admins can update orders (verify payment, approve)
DROP POLICY IF EXISTS "admin_update_orders" ON public.orders;
CREATE POLICY "admin_update_orders"
ON public.orders
FOR UPDATE
TO authenticated
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

-- Admins can insert order status history for any order
DROP POLICY IF EXISTS "admin_insert_order_history" ON public.order_status_history;
CREATE POLICY "admin_insert_order_history"
ON public.order_status_history
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin_user());

-- Admins can view all order status history
DROP POLICY IF EXISTS "admin_view_all_order_history" ON public.order_status_history;
CREATE POLICY "admin_view_all_order_history"
ON public.order_status_history
FOR SELECT
TO authenticated
USING (public.is_admin_user());
