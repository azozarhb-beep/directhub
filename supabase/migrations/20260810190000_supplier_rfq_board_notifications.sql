-- Migration: Supplier Directory, RFQ Board, and Notification Center
-- Timestamp: 20260810190000

-- ============================================================
-- 1. TYPES
-- ============================================================
DROP TYPE IF EXISTS public.notification_type CASCADE;
CREATE TYPE public.notification_type AS ENUM (
  'rfq_submitted', 'rfq_responded', 'rfq_accepted', 'rfq_rejected',
  'new_message', 'order_update', 'system'
);

DROP TYPE IF EXISTS public.supplier_tier CASCADE;
CREATE TYPE public.supplier_tier AS ENUM ('standard', 'verified', 'premium');

-- ============================================================
-- 2. TABLES
-- ============================================================

-- Supplier profiles: extended info for manufacturer users
CREATE TABLE IF NOT EXISTS public.supplier_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    company_name TEXT NOT NULL DEFAULT '',
    description TEXT DEFAULT '',
    country TEXT DEFAULT '',
    city TEXT DEFAULT '',
    established_year INTEGER,
    employee_count TEXT DEFAULT '',
    annual_revenue TEXT DEFAULT '',
    main_categories TEXT[] DEFAULT ARRAY[]::TEXT[],
    certifications TEXT[] DEFAULT ARRAY[]::TEXT[],
    logo_url TEXT DEFAULT '',
    cover_url TEXT DEFAULT '',
    website TEXT DEFAULT '',
    tier public.supplier_tier DEFAULT 'standard'::public.supplier_tier,
    is_verified BOOLEAN DEFAULT false,
    response_rate INTEGER DEFAULT 0,
    avg_response_time TEXT DEFAULT '24h',
    total_rfqs_received INTEGER DEFAULT 0,
    rating DECIMAL(3,2) DEFAULT 0,
    review_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

-- RFQ board responses: manufacturers respond to RFQ requests
CREATE TABLE IF NOT EXISTS public.rfq_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rfq_id UUID NOT NULL REFERENCES public.rfq_requests(id) ON DELETE CASCADE,
    manufacturer_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    unit_price DECIMAL(12,2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    min_order_qty INTEGER DEFAULT 1,
    lead_time_days INTEGER DEFAULT 14,
    validity_days INTEGER DEFAULT 30,
    payment_terms TEXT DEFAULT 'T/T',
    incoterms TEXT DEFAULT 'FOB',
    notes TEXT DEFAULT '',
    sample_available BOOLEAN DEFAULT false,
    sample_price DECIMAL(12,2),
    attachments JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    type public.notification_type NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    link TEXT DEFAULT '',
    is_read BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 3. INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_supplier_profiles_user_id ON public.supplier_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_supplier_profiles_country ON public.supplier_profiles(country);
CREATE INDEX IF NOT EXISTS idx_supplier_profiles_tier ON public.supplier_profiles(tier);
CREATE INDEX IF NOT EXISTS idx_supplier_profiles_is_active ON public.supplier_profiles(is_active);
CREATE INDEX IF NOT EXISTS idx_rfq_responses_rfq_id ON public.rfq_responses(rfq_id);
CREATE INDEX IF NOT EXISTS idx_rfq_responses_manufacturer_id ON public.rfq_responses(manufacturer_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at);

-- ============================================================
-- 4. FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_supplier_profiles_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_rfq_response()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_buyer_id UUID;
    v_product_name TEXT;
BEGIN
    SELECT buyer_id, product_name INTO v_buyer_id, v_product_name
    FROM public.rfq_requests
    WHERE id = NEW.rfq_id
    LIMIT 1;

    IF v_buyer_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, type, title, body, link, metadata)
        VALUES (
            v_buyer_id,
            'rfq_responded'::public.notification_type,
            'New Quote Received',
            'A manufacturer has responded to your RFQ for ' || COALESCE(v_product_name, 'your product'),
            '/rfq/' || NEW.rfq_id::TEXT,
            jsonb_build_object('rfq_id', NEW.rfq_id, 'response_id', NEW.id)
        );
    END IF;
    RETURN NEW;
END;
$$;

-- ============================================================
-- 5. ENABLE RLS
-- ============================================================
ALTER TABLE public.supplier_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rfq_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 6. RLS POLICIES
-- ============================================================

-- supplier_profiles: public read, manufacturers manage own
DROP POLICY IF EXISTS "public_read_supplier_profiles" ON public.supplier_profiles;
CREATE POLICY "public_read_supplier_profiles"
ON public.supplier_profiles
FOR SELECT
TO public
USING (is_active = true);

DROP POLICY IF EXISTS "manufacturers_manage_own_supplier_profile" ON public.supplier_profiles;
CREATE POLICY "manufacturers_manage_own_supplier_profile"
ON public.supplier_profiles
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- rfq_responses: buyers see responses to their RFQs, manufacturers manage their own
DROP POLICY IF EXISTS "buyers_view_rfq_responses" ON public.rfq_responses;
CREATE POLICY "buyers_view_rfq_responses"
ON public.rfq_responses
FOR SELECT
TO authenticated
USING (
    rfq_id IN (
        SELECT id FROM public.rfq_requests WHERE buyer_id = auth.uid()
    )
    OR manufacturer_id = auth.uid()
);

DROP POLICY IF EXISTS "manufacturers_manage_own_rfq_responses" ON public.rfq_responses;
CREATE POLICY "manufacturers_manage_own_rfq_responses"
ON public.rfq_responses
FOR INSERT
TO authenticated
WITH CHECK (manufacturer_id = auth.uid());

DROP POLICY IF EXISTS "manufacturers_update_own_rfq_responses" ON public.rfq_responses;
CREATE POLICY "manufacturers_update_own_rfq_responses"
ON public.rfq_responses
FOR UPDATE
TO authenticated
USING (manufacturer_id = auth.uid())
WITH CHECK (manufacturer_id = auth.uid());

DROP POLICY IF EXISTS "manufacturers_delete_own_rfq_responses" ON public.rfq_responses;
CREATE POLICY "manufacturers_delete_own_rfq_responses"
ON public.rfq_responses
FOR DELETE
TO authenticated
USING (manufacturer_id = auth.uid());

-- Also allow manufacturers to see all RFQs (for the RFQ board)
DROP POLICY IF EXISTS "manufacturers_view_all_rfq_requests" ON public.rfq_requests;
CREATE POLICY "manufacturers_view_all_rfq_requests"
ON public.rfq_requests
FOR SELECT
TO authenticated
USING (
    buyer_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = auth.uid() AND role = 'manufacturer'
    )
);

-- notifications: users manage their own
DROP POLICY IF EXISTS "users_manage_own_notifications" ON public.notifications;
CREATE POLICY "users_manage_own_notifications"
ON public.notifications
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- ============================================================
-- 7. TRIGGERS
-- ============================================================
DROP TRIGGER IF EXISTS update_supplier_profiles_updated_at ON public.supplier_profiles;
CREATE TRIGGER update_supplier_profiles_updated_at
    BEFORE UPDATE ON public.supplier_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_supplier_profiles_updated_at();

DROP TRIGGER IF EXISTS notify_on_rfq_response ON public.rfq_responses;
CREATE TRIGGER notify_on_rfq_response
    AFTER INSERT ON public.rfq_responses
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_rfq_response();

-- ============================================================
-- 8. REALTIME
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- ============================================================
-- 9. MOCK DATA
-- ============================================================
DO $$
DECLARE
    v_manufacturer_id UUID;
    v_buyer_id UUID;
    v_rfq_id UUID;
BEGIN
    -- Get existing manufacturer user
    SELECT id INTO v_manufacturer_id
    FROM public.user_profiles
    WHERE role = 'manufacturer'
    LIMIT 1;

    -- Get existing buyer user
    SELECT id INTO v_buyer_id
    FROM public.user_profiles
    WHERE role = 'buyer'
    LIMIT 1;

    -- Create supplier profile for manufacturer
    IF v_manufacturer_id IS NOT NULL THEN
        INSERT INTO public.supplier_profiles (
            user_id, company_name, description, country, city,
            established_year, employee_count, annual_revenue,
            main_categories, certifications, tier, is_verified,
            response_rate, avg_response_time, total_rfqs_received, rating, review_count
        ) VALUES (
            v_manufacturer_id,
            'Al-Masri Industrial Co.',
            'Leading manufacturer of high-quality raw materials and industrial components with 20+ years of experience in the MENA region.',
            'Egypt',
            'Cairo',
            2003,
            '201-500',
            '$5M-$10M',
            ARRAY['raw_materials', 'metals', 'chemicals'],
            ARRAY['ISO 9001:2015', 'CE Mark', 'SGS Certified'],
            'verified'::public.supplier_tier,
            true,
            92,
            '12h',
            145,
            4.7,
            38
        ) ON CONFLICT (user_id) DO NOTHING;

        -- Create demo notifications for manufacturer
        INSERT INTO public.notifications (user_id, type, title, body, link, is_read)
        VALUES
            (v_manufacturer_id, 'rfq_submitted'::public.notification_type,
             'New RFQ Received', 'A buyer has submitted a new request for quotation for Steel Coils.',
             '/manufacturer/dashboard', false),
            (v_manufacturer_id, 'system'::public.notification_type,
             'Profile Verified', 'Your supplier profile has been verified. You now have a verified badge.',
             '/manufacturer/dashboard', true)
        ON CONFLICT (id) DO NOTHING;
    END IF;

    -- Create demo notifications for buyer
    IF v_buyer_id IS NOT NULL THEN
        -- Get an existing RFQ if any
        SELECT id INTO v_rfq_id FROM public.rfq_requests WHERE buyer_id = v_buyer_id LIMIT 1;

        INSERT INTO public.notifications (user_id, type, title, body, link, is_read)
        VALUES
            (v_buyer_id, 'rfq_responded'::public.notification_type,
             'Quote Received', 'Al-Masri Industrial Co. has responded to your RFQ.',
             COALESCE('/rfq/' || v_rfq_id::TEXT, '/my-account'), false),
            (v_buyer_id, 'system'::public.notification_type,
             'Welcome to DirectHub', 'Your account is ready. Start browsing suppliers and posting RFQs.',
             '/', true)
        ON CONFLICT (id) DO NOTHING;
    END IF;

EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Mock data insertion failed: %', SQLERRM;
END $$;
