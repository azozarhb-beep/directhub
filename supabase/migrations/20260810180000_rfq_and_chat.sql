-- Migration: RFQ (Request for Quotation) and Real-time Chat
-- Timestamp: 20260810180000

-- ============================================================
-- 1. TYPES
-- ============================================================
DROP TYPE IF EXISTS public.rfq_status CASCADE;
CREATE TYPE public.rfq_status AS ENUM ('pending', 'responded', 'accepted', 'rejected', 'expired');

-- ============================================================
-- 2. TABLES
-- ============================================================

-- RFQ table: buyers submit quote requests linked to products/suppliers
CREATE TABLE IF NOT EXISTS public.rfq_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL,
    product_name TEXT NOT NULL DEFAULT '',
    supplier_name TEXT NOT NULL DEFAULT '',
    supplier_country TEXT NOT NULL DEFAULT '',
    quantity INTEGER NOT NULL DEFAULT 1,
    unit TEXT NOT NULL DEFAULT 'units',
    target_price DECIMAL(12,2),
    currency TEXT NOT NULL DEFAULT 'USD',
    destination_country TEXT NOT NULL DEFAULT '',
    destination_port TEXT DEFAULT '',
    incoterms TEXT DEFAULT 'FOB',
    payment_terms TEXT DEFAULT 'T/T',
    required_certifications TEXT DEFAULT '',
    customization_notes TEXT DEFAULT '',
    additional_notes TEXT DEFAULT '',
    status public.rfq_status DEFAULT 'pending'::public.rfq_status,
    supplier_response TEXT DEFAULT '',
    responded_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 days'),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Chat conversations: one per buyer-supplier-product combination
CREATE TABLE IF NOT EXISTS public.chat_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    manufacturer_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    product_id TEXT NOT NULL,
    product_name TEXT NOT NULL DEFAULT '',
    supplier_name TEXT NOT NULL DEFAULT '',
    supplier_country TEXT NOT NULL DEFAULT '',
    supplier_flag TEXT NOT NULL DEFAULT '',
    supplier_avatar TEXT DEFAULT '',
    last_message TEXT DEFAULT '',
    last_message_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Chat messages: real-time messages within a conversation
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    sender_role TEXT NOT NULL DEFAULT 'buyer',
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 3. INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_rfq_requests_buyer_id ON public.rfq_requests(buyer_id);
CREATE INDEX IF NOT EXISTS idx_rfq_requests_product_id ON public.rfq_requests(product_id);
CREATE INDEX IF NOT EXISTS idx_rfq_requests_status ON public.rfq_requests(status);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_buyer_id ON public.chat_conversations(buyer_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_manufacturer_id ON public.chat_conversations(manufacturer_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_product_id ON public.chat_conversations(product_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_id ON public.chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_id ON public.chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON public.chat_messages(created_at);

-- ============================================================
-- 4. FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_rfq_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_conversation_last_message()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE public.chat_conversations
    SET last_message = NEW.message,
        last_message_at = NEW.created_at,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$;

-- ============================================================
-- 5. ENABLE RLS
-- ============================================================
ALTER TABLE public.rfq_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 6. RLS POLICIES
-- ============================================================

-- rfq_requests: buyers manage their own RFQs
DROP POLICY IF EXISTS "buyers_manage_own_rfq_requests" ON public.rfq_requests;
CREATE POLICY "buyers_manage_own_rfq_requests"
ON public.rfq_requests
FOR ALL
TO authenticated
USING (buyer_id = auth.uid())
WITH CHECK (buyer_id = auth.uid());

-- chat_conversations: participants can view their conversations
DROP POLICY IF EXISTS "participants_view_own_conversations" ON public.chat_conversations;
CREATE POLICY "participants_view_own_conversations"
ON public.chat_conversations
FOR SELECT
TO authenticated
USING (buyer_id = auth.uid() OR manufacturer_id = auth.uid());

DROP POLICY IF EXISTS "buyers_create_conversations" ON public.chat_conversations;
CREATE POLICY "buyers_create_conversations"
ON public.chat_conversations
FOR INSERT
TO authenticated
WITH CHECK (buyer_id = auth.uid());

DROP POLICY IF EXISTS "participants_update_conversations" ON public.chat_conversations;
CREATE POLICY "participants_update_conversations"
ON public.chat_conversations
FOR UPDATE
TO authenticated
USING (buyer_id = auth.uid() OR manufacturer_id = auth.uid())
WITH CHECK (buyer_id = auth.uid() OR manufacturer_id = auth.uid());

-- chat_messages: participants can read/write messages in their conversations
DROP POLICY IF EXISTS "participants_view_messages" ON public.chat_messages;
CREATE POLICY "participants_view_messages"
ON public.chat_messages
FOR SELECT
TO authenticated
USING (
    conversation_id IN (
        SELECT id FROM public.chat_conversations
        WHERE buyer_id = auth.uid() OR manufacturer_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "participants_send_messages" ON public.chat_messages;
CREATE POLICY "participants_send_messages"
ON public.chat_messages
FOR INSERT
TO authenticated
WITH CHECK (
    sender_id = auth.uid()
    AND conversation_id IN (
        SELECT id FROM public.chat_conversations
        WHERE buyer_id = auth.uid() OR manufacturer_id = auth.uid()
    )
);

-- ============================================================
-- 7. TRIGGERS
-- ============================================================
DROP TRIGGER IF EXISTS update_rfq_requests_updated_at ON public.rfq_requests;
CREATE TRIGGER update_rfq_requests_updated_at
    BEFORE UPDATE ON public.rfq_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.update_rfq_updated_at();

DROP TRIGGER IF EXISTS update_conversation_on_new_message ON public.chat_messages;
CREATE TRIGGER update_conversation_on_new_message
    AFTER INSERT ON public.chat_messages
    FOR EACH ROW
    EXECUTE FUNCTION public.update_conversation_last_message();
