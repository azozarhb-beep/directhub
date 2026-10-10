-- Migration: DirectHub Auth, Orders, and OTP
-- Timestamp: 20260810160843

-- ============================================================
-- 1. TYPES
-- ============================================================
DROP TYPE IF EXISTS public.user_role CASCADE;
CREATE TYPE public.user_role AS ENUM ('buyer', 'manufacturer');

DROP TYPE IF EXISTS public.order_status CASCADE;
CREATE TYPE public.order_status AS ENUM ('pending', 'processing', 'shipped', 'delivered', 'cancelled');

-- ============================================================
-- 2. CORE TABLES
-- ============================================================

-- User profiles (linked to auth.users)
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL DEFAULT '',
    company_name TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    country TEXT DEFAULT '',
    role public.user_role DEFAULT 'buyer'::public.user_role,
    avatar_url TEXT DEFAULT '',
    is_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Orders table
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    order_number TEXT NOT NULL UNIQUE,
    status public.order_status DEFAULT 'pending'::public.order_status,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    shipping_address JSONB NOT NULL DEFAULT '{}'::jsonb,
    payment_method TEXT DEFAULT 'bank_transfer',
    subtotal DECIMAL(12,2) DEFAULT 0,
    shipping_cost DECIMAL(12,2) DEFAULT 0,
    total DECIMAL(12,2) DEFAULT 0,
    notes TEXT DEFAULT '',
    confirmed_at TIMESTAMPTZ,
    shipped_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Order status history for tracking
CREATE TABLE IF NOT EXISTS public.order_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    status public.order_status NOT NULL,
    note TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- OTP codes for checkout confirmation
CREATE TABLE IF NOT EXISTS public.checkout_otps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    otp_code TEXT NOT NULL,
    order_data JSONB DEFAULT '{}'::jsonb,
    is_used BOOLEAN DEFAULT false,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 3. INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON public.orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_order_status_history_order_id ON public.order_status_history(order_id);
CREATE INDEX IF NOT EXISTS idx_checkout_otps_user_id ON public.checkout_otps(user_id);
CREATE INDEX IF NOT EXISTS idx_checkout_otps_email ON public.checkout_otps(email);

-- ============================================================
-- 4. FUNCTIONS
-- ============================================================

-- Auto-create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.user_profiles (id, email, full_name, company_name, phone, country, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'company_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'phone', ''),
        COALESCE(NEW.raw_user_meta_data->>'country', ''),
        COALESCE(NEW.raw_user_meta_data->>'role', 'buyer')::public.user_role
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

-- Generate unique order number
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    new_number TEXT;
    counter INT := 0;
BEGIN
    LOOP
        new_number := 'DH-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 9000 + 1000)::TEXT, 4, '0');
        EXIT WHEN NOT EXISTS (SELECT 1 FROM public.orders WHERE order_number = new_number);
        counter := counter + 1;
        IF counter > 100 THEN
            new_number := 'DH-' || EXTRACT(EPOCH FROM NOW())::BIGINT::TEXT;
            EXIT;
        END IF;
    END LOOP;
    RETURN new_number;
END;
$$;

-- ============================================================
-- 5. ENABLE RLS
-- ============================================================
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkout_otps ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 6. RLS POLICIES
-- ============================================================

-- user_profiles: users manage their own profile
DROP POLICY IF EXISTS "users_manage_own_user_profiles" ON public.user_profiles;
CREATE POLICY "users_manage_own_user_profiles"
ON public.user_profiles
FOR ALL
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- orders: users manage their own orders
DROP POLICY IF EXISTS "users_manage_own_orders" ON public.orders;
CREATE POLICY "users_manage_own_orders"
ON public.orders
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- order_status_history: users view their own order history
DROP POLICY IF EXISTS "users_view_own_order_history" ON public.order_status_history;
CREATE POLICY "users_view_own_order_history"
ON public.order_status_history
FOR SELECT
TO authenticated
USING (
    order_id IN (
        SELECT id FROM public.orders WHERE user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "users_insert_own_order_history" ON public.order_status_history;
CREATE POLICY "users_insert_own_order_history"
ON public.order_status_history
FOR INSERT
TO authenticated
WITH CHECK (
    order_id IN (
        SELECT id FROM public.orders WHERE user_id = auth.uid()
    )
);

-- checkout_otps: users manage their own OTPs
DROP POLICY IF EXISTS "users_manage_own_checkout_otps" ON public.checkout_otps;
CREATE POLICY "users_manage_own_checkout_otps"
ON public.checkout_otps
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- ============================================================
-- 7. TRIGGERS
-- ============================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_orders_updated_at ON public.orders;
CREATE TRIGGER update_orders_updated_at
    BEFORE UPDATE ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- 8. MOCK DATA
-- ============================================================
DO $$
DECLARE
    buyer_uuid UUID := gen_random_uuid();
    manufacturer_uuid UUID := gen_random_uuid();
    order1_uuid UUID := gen_random_uuid();
    order2_uuid UUID := gen_random_uuid();
BEGIN
    -- Create demo buyer
    INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
        created_at, updated_at, raw_user_meta_data, raw_app_meta_data,
        is_sso_user, is_anonymous, confirmation_token, confirmation_sent_at,
        recovery_token, recovery_sent_at, email_change_token_new, email_change,
        email_change_sent_at, email_change_token_current, email_change_confirm_status,
        reauthentication_token, reauthentication_sent_at, phone, phone_change,
        phone_change_token, phone_change_sent_at
    ) VALUES
        (buyer_uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
         'buyer@directhub.com', crypt('demo1234', gen_salt('bf', 10)), now(), now(), now(),
         jsonb_build_object('full_name', 'Ahmed Al-Rashid', 'company_name', 'Al-Rashid Trading Co.', 'phone', '+966501234567', 'country', 'Saudi Arabia', 'role', 'buyer'),
         jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
         false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),
        (manufacturer_uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
         'manufacturer@directhub.com', crypt('demo1234', gen_salt('bf', 10)), now(), now(), now(),
         jsonb_build_object('full_name', 'Li Wei', 'company_name', 'Zhongshan Heavy Equipment Co.', 'phone', '+8613812345678', 'country', 'China', 'role', 'manufacturer'),
         jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
         false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null)
    ON CONFLICT (id) DO NOTHING;

    -- Create demo orders for buyer
    INSERT INTO public.orders (id, user_id, order_number, status, items, shipping_address, payment_method, subtotal, shipping_cost, total, notes)
    VALUES
        (order1_uuid, buyer_uuid, 'DH-20260810-1001', 'processing'::public.order_status,
         jsonb_build_array(
             jsonb_build_object('id', 'p1', 'name', 'Industrial Hydraulic Pump', 'quantity', 10, 'price', 285, 'supplier', 'Zhongshan Heavy Equipment Co.')
         ),
         jsonb_build_object('fullName', 'Ahmed Al-Rashid', 'company', 'Al-Rashid Trading Co.', 'address', 'King Fahd Road, Riyadh', 'city', 'Riyadh', 'country', 'Saudi Arabia', 'postalCode', '11564'),
         'bank_transfer', 2850.00, 150.00, 3000.00, 'Please ensure industrial grade packaging'),
        (order2_uuid, buyer_uuid, 'DH-20260810-1002', 'shipped'::public.order_status,
         jsonb_build_array(
             jsonb_build_object('id', 'p4', 'name', 'Portland Cement 50kg Bag', 'quantity', 200, 'price', 8.5, 'supplier', 'Gulf Cement Industries')
         ),
         jsonb_build_object('fullName', 'Ahmed Al-Rashid', 'company', 'Al-Rashid Trading Co.', 'address', 'King Fahd Road, Riyadh', 'city', 'Riyadh', 'country', 'Saudi Arabia', 'postalCode', '11564'),
         'letter_of_credit', 1700.00, 200.00, 1900.00, '')
    ON CONFLICT (id) DO NOTHING;

    -- Create order status history
    INSERT INTO public.order_status_history (order_id, status, note)
    VALUES
        (order1_uuid, 'pending'::public.order_status, 'Order placed successfully'),
        (order1_uuid, 'processing'::public.order_status, 'Payment confirmed, preparing shipment'),
        (order2_uuid, 'pending'::public.order_status, 'Order placed successfully'),
        (order2_uuid, 'processing'::public.order_status, 'Payment confirmed'),
        (order2_uuid, 'shipped'::public.order_status, 'Shipment dispatched via DHL Express, tracking: DHL123456789')
    ON CONFLICT (id) DO NOTHING;

EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Mock data insertion failed: %', SQLERRM;
END $$;
