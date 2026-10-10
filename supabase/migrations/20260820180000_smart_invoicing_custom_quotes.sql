-- Migration: Smart Orders & Invoicing System — Custom Quotes & Negotiation History
-- Timestamp: 20260820180000

-- ============================================================
-- 1. CUSTOM QUOTES TABLE
-- Stores factory-sent custom quotes during negotiation
-- ============================================================
CREATE TABLE IF NOT EXISTS public.custom_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.chat_conversations(id) ON DELETE SET NULL,
  factory_user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  buyer_user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,

  -- Quote details
  quoted_price NUMERIC(14,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  quantity INTEGER NOT NULL,
  delivery_days INTEGER NOT NULL,
  payment_terms TEXT,
  notes TEXT,

  -- Status lifecycle
  status TEXT DEFAULT 'pending' CHECK (
    status IN ('pending', 'accepted', 'rejected', 'expired', 'superseded')
  ),

  -- Acceptance tracking
  accepted_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,

  -- Invoice linkage
  invoice_id UUID REFERENCES public.order_invoices(id) ON DELETE SET NULL,
  invoice_auto_generated BOOLEAN DEFAULT false,

  -- Hard deadline (set when buyer accepts)
  hard_deadline DATE,
  hard_deadline_set_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_custom_quotes_order_id ON public.custom_quotes(order_id);
CREATE INDEX IF NOT EXISTS idx_custom_quotes_conversation_id ON public.custom_quotes(conversation_id);
CREATE INDEX IF NOT EXISTS idx_custom_quotes_factory_user_id ON public.custom_quotes(factory_user_id);
CREATE INDEX IF NOT EXISTS idx_custom_quotes_buyer_user_id ON public.custom_quotes(buyer_user_id);
CREATE INDEX IF NOT EXISTS idx_custom_quotes_status ON public.custom_quotes(status);

-- ============================================================
-- 2. ORDER NEGOTIATION HISTORY TABLE
-- Immutable audit log of all negotiation events
-- ============================================================
CREATE TABLE IF NOT EXISTS public.order_negotiation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.chat_conversations(id) ON DELETE SET NULL,
  quote_id UUID REFERENCES public.custom_quotes(id) ON DELETE SET NULL,

  -- Who did what
  actor_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  actor_role TEXT NOT NULL CHECK (actor_role IN ('factory', 'buyer', 'admin', 'system')),

  -- Event type
  event_type TEXT NOT NULL CHECK (
    event_type IN (
      'quote_sent',
      'quote_accepted',
      'quote_rejected',
      'invoice_generated',
      'invoice_updated',
      'deadline_set',
      'price_changed',
      'quantity_changed',
      'delivery_changed',
      'note_added'
    )
  ),

  -- Snapshot of values at time of event
  price_before NUMERIC(14,2),
  price_after NUMERIC(14,2),
  quantity_before INTEGER,
  quantity_after INTEGER,
  delivery_days_before INTEGER,
  delivery_days_after INTEGER,
  currency TEXT DEFAULT 'USD',

  -- Human-readable summary
  summary TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_negotiation_history_order_id ON public.order_negotiation_history(order_id);
CREATE INDEX IF NOT EXISTS idx_negotiation_history_conversation_id ON public.order_negotiation_history(conversation_id);
CREATE INDEX IF NOT EXISTS idx_negotiation_history_actor_id ON public.order_negotiation_history(actor_id);

-- ============================================================
-- 3. ADD COLUMNS TO ORDERS TABLE
-- ============================================================
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS factory_tax_ref TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS accepted_quote_id UUID DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS negotiated_price NUMERIC(14,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS negotiated_quantity INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS negotiated_delivery_days INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS hard_deadline DATE DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS hard_deadline_set_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deadline_alert_sent BOOLEAN DEFAULT false;

-- ============================================================
-- 4. ENABLE RLS
-- ============================================================
ALTER TABLE public.custom_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_negotiation_history ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 5. RLS POLICIES — CUSTOM QUOTES
-- ============================================================
DROP POLICY IF EXISTS "factory_manage_own_quotes" ON public.custom_quotes;
CREATE POLICY "factory_manage_own_quotes"
ON public.custom_quotes
FOR ALL
TO authenticated
USING (factory_user_id = auth.uid())
WITH CHECK (factory_user_id = auth.uid());

DROP POLICY IF EXISTS "buyer_view_own_quotes" ON public.custom_quotes;
CREATE POLICY "buyer_view_own_quotes"
ON public.custom_quotes
FOR SELECT
TO authenticated
USING (buyer_user_id = auth.uid());

DROP POLICY IF EXISTS "buyer_update_quote_acceptance" ON public.custom_quotes;
CREATE POLICY "buyer_update_quote_acceptance"
ON public.custom_quotes
FOR UPDATE
TO authenticated
USING (buyer_user_id = auth.uid())
WITH CHECK (buyer_user_id = auth.uid());

DROP POLICY IF EXISTS "admin_manage_all_quotes" ON public.custom_quotes;
CREATE POLICY "admin_manage_all_quotes"
ON public.custom_quotes
FOR ALL
TO authenticated
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

-- ============================================================
-- 6. RLS POLICIES — NEGOTIATION HISTORY
-- ============================================================
DROP POLICY IF EXISTS "parties_view_own_negotiation_history" ON public.order_negotiation_history;
CREATE POLICY "parties_view_own_negotiation_history"
ON public.order_negotiation_history
FOR SELECT
TO authenticated
USING (
  actor_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_id AND o.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.custom_quotes cq
    WHERE cq.id = quote_id AND cq.factory_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "system_insert_negotiation_history" ON public.order_negotiation_history;
CREATE POLICY "system_insert_negotiation_history"
ON public.order_negotiation_history
FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "admin_manage_negotiation_history" ON public.order_negotiation_history;
CREATE POLICY "admin_manage_negotiation_history"
ON public.order_negotiation_history
FOR ALL
TO authenticated
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());
