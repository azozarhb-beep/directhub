-- ============================================================
-- Factory Team Management: manufacturer_agent role support
-- Adds factory_id linkage to user_profiles and RLS policies.
-- NOTE: manufacturer_agent enum value is added in the prior
-- migration 20260930140500_add_manufacturer_agent_enum.sql
-- ============================================================

-- 1. Add factory_id column to user_profiles (links agent to their factory owner)
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS factory_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_user_profiles_factory_id ON public.user_profiles(factory_id);

-- 2. manufacturer_agent enum value is added in migration 20260930140500
--    (must be a separate committed transaction before use in expressions)

-- 3. Helper function: check if current user is an active manufacturer_agent for a factory
CREATE OR REPLACE FUNCTION public.is_manufacturer_agent(owner_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
SELECT EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND up.factory_id = owner_id
      AND up.role = 'manufacturer_agent'
      AND up.is_active = true
)
$$;

-- 4. Helper function: get the factory owner id for the current manufacturer_agent
CREATE OR REPLACE FUNCTION public.get_agent_factory_owner_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
SELECT factory_id FROM public.user_profiles
WHERE id = auth.uid()
  AND role = 'manufacturer_agent'
  AND is_active = true
LIMIT 1
$$;

-- 5. RLS policies for manufacturer_agent access to manufacturer_products
DROP POLICY IF EXISTS "manufacturer_agent_manage_factory_products" ON public.manufacturer_products;
CREATE POLICY "manufacturer_agent_manage_factory_products"
ON public.manufacturer_products
FOR ALL
TO authenticated
USING (public.is_manufacturer_agent(manufacturer_id))
WITH CHECK (public.is_manufacturer_agent(manufacturer_id));

-- 6. RLS policies for manufacturer_agent access to rfq_requests (view only)
DROP POLICY IF EXISTS "manufacturer_agent_view_factory_rfqs" ON public.rfq_requests;
CREATE POLICY "manufacturer_agent_view_factory_rfqs"
ON public.rfq_requests
FOR SELECT
TO authenticated
USING (public.is_manufacturer_agent(factory_id));

-- 7. RLS policies for manufacturer_agent to respond to RFQs
DROP POLICY IF EXISTS "manufacturer_agent_respond_factory_rfqs" ON public.rfq_responses;
CREATE POLICY "manufacturer_agent_respond_factory_rfqs"
ON public.rfq_responses
FOR ALL
TO authenticated
USING (public.is_manufacturer_agent(
    (SELECT factory_id FROM public.rfq_requests WHERE id = rfq_id LIMIT 1)
))
WITH CHECK (public.is_manufacturer_agent(
    (SELECT factory_id FROM public.rfq_requests WHERE id = rfq_id LIMIT 1)
));

-- 8. RLS policies for manufacturer_agent to view orders (read-only)
DROP POLICY IF EXISTS "manufacturer_agent_view_factory_orders" ON public.orders;
CREATE POLICY "manufacturer_agent_view_factory_orders"
ON public.orders
FOR SELECT
TO authenticated
USING (public.is_manufacturer_agent(factory_user_id));

-- 9. Allow manufacturer_agent to view chat_conversations for their factory
DROP POLICY IF EXISTS "manufacturer_agent_view_factory_conversations" ON public.chat_conversations;
CREATE POLICY "manufacturer_agent_view_factory_conversations"
ON public.chat_conversations
FOR SELECT
TO authenticated
USING (
    seller_id = auth.uid()
    OR buyer_id = auth.uid()
    OR public.is_manufacturer_agent(seller_id)
);

-- 10. Allow manufacturer_agent to send/view messages in factory conversations
DROP POLICY IF EXISTS "manufacturer_agent_manage_factory_messages" ON public.chat_messages;
CREATE POLICY "manufacturer_agent_manage_factory_messages"
ON public.chat_messages
FOR ALL
TO authenticated
USING (
    sender_id = auth.uid()
    OR public.is_manufacturer_agent(
        (SELECT seller_id FROM public.chat_conversations WHERE id = conversation_id LIMIT 1)
    )
)
WITH CHECK (
    sender_id = auth.uid()
);
