-- ============================================================
-- Local Factory Room: strict server-side isolation + atomic order numbers
--   1. Atomic order number generator (sequence based, no collisions)
--   2. orders: factory_user_id may only be set to the caller (or a
--      server-trusted path) on INSERT; ownership cannot be re-pointed on UPDATE
--   3. order_status_history: factory writes only for its own orders,
--      history rows are append-only (no UPDATE / DELETE for non-admins)
--   4. notifications: factory-owned RPC for dispatch notifications, so the
--      browser no longer inserts rows for other users
--   5. factory_sales_reps: owner_id pinned to auth.uid(), reps cannot
--      self-promote or reassign themselves to another factory
-- ============================================================

-- ------------------------------------------------------------
-- 1. ATOMIC ORDER NUMBER GENERATOR
-- ------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.order_number_seq START WITH 100000 INCREMENT BY 1;

CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
    RETURN 'DH-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(nextval('public.order_number_seq')::TEXT, 6, '0');
END;
$func$;

GRANT EXECUTE ON FUNCTION public.generate_order_number() TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_order_number() TO service_role;

-- Safety net: any order inserted without an order_number (or with a blank one)
-- receives an atomic sequential number from the database.
CREATE OR REPLACE FUNCTION public.orders_assign_order_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
    IF NEW.order_number IS NULL OR btrim(NEW.order_number) = '' THEN
        NEW.order_number := public.generate_order_number();
    END IF;
    RETURN NEW;
END;
$func$;

-- order_number is NOT NULL in the table; give it a DB-side default so clients can omit it
ALTER TABLE public.orders
    ALTER COLUMN order_number SET DEFAULT public.generate_order_number();

DROP TRIGGER IF EXISTS trg_orders_assign_order_number ON public.orders;
CREATE TRIGGER trg_orders_assign_order_number
    BEFORE INSERT ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.orders_assign_order_number();

-- ------------------------------------------------------------
-- 2. ORDERS: ownership guard (server-side, cannot be bypassed from the browser)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.orders_enforce_factory_ownership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
    caller UUID := auth.uid();
    is_privileged BOOLEAN := false;
BEGIN
    -- Service role / SQL editor / internal jobs have no JWT subject: allow.
    IF caller IS NULL THEN
        RETURN NEW;
    END IF;

    BEGIN
        is_privileged := COALESCE(public.is_admin_user(), false);
    EXCEPTION WHEN OTHERS THEN
        is_privileged := false;
    END;

    IF is_privileged THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'INSERT' THEN
        -- A non-admin caller may only create an order for themselves as buyer,
        -- and may only attach a factory_user_id equal to their own id.
        IF NEW.user_id IS DISTINCT FROM caller THEN
            RAISE EXCEPTION 'orders.user_id must equal the authenticated user'
                USING ERRCODE = '42501';
        END IF;
        IF NEW.factory_user_id IS NOT NULL AND NEW.factory_user_id IS DISTINCT FROM caller THEN
            -- Buyers may target a factory at checkout; only allow when that
            -- factory exists as a real user profile (prevents free-text spoofing).
            IF NOT EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = NEW.factory_user_id) THEN
                RAISE EXCEPTION 'orders.factory_user_id does not reference a valid factory'
                    USING ERRCODE = '42501';
            END IF;
        END IF;
        RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        -- Ownership columns are immutable for non-admin callers.
        IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
            RAISE EXCEPTION 'orders.user_id is immutable' USING ERRCODE = '42501';
        END IF;
        IF NEW.factory_user_id IS DISTINCT FROM OLD.factory_user_id
           AND OLD.factory_user_id IS NOT NULL THEN
            RAISE EXCEPTION 'orders.factory_user_id is immutable' USING ERRCODE = '42501';
        END IF;
        IF NEW.order_number IS DISTINCT FROM OLD.order_number THEN
            RAISE EXCEPTION 'orders.order_number is immutable' USING ERRCODE = '42501';
        END IF;
        RETURN NEW;
    END IF;

    RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trg_orders_enforce_factory_ownership ON public.orders;
CREATE TRIGGER trg_orders_enforce_factory_ownership
    BEFORE INSERT OR UPDATE ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.orders_enforce_factory_ownership();

-- Factory owner policies: strict factory_user_id = auth.uid() for read / update
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "factory_owner_select_orders" ON public.orders;
CREATE POLICY "factory_owner_select_orders"
ON public.orders
FOR SELECT
TO authenticated
USING (factory_user_id = auth.uid());

DROP POLICY IF EXISTS "factory_owner_update_orders" ON public.orders;
CREATE POLICY "factory_owner_update_orders"
ON public.orders
FOR UPDATE
TO authenticated
USING (factory_user_id = auth.uid())
WITH CHECK (factory_user_id = auth.uid());

-- Factory owner may register a manual order for their own factory only
DROP POLICY IF EXISTS "factory_owner_insert_orders" ON public.orders;
CREATE POLICY "factory_owner_insert_orders"
ON public.orders
FOR INSERT
TO authenticated
WITH CHECK (factory_user_id = auth.uid() AND user_id = auth.uid());

-- ------------------------------------------------------------
-- 3. ORDER_STATUS_HISTORY: append-only, scoped to the owning factory / buyer
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_order_status_history_order_created
    ON public.order_status_history(order_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.can_write_order_history(p_order_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
    SELECT EXISTS (
        SELECT 1 FROM public.orders o
        WHERE o.id = p_order_id
          AND (o.factory_user_id = auth.uid() OR o.user_id = auth.uid())
    )
$func$;

GRANT EXECUTE ON FUNCTION public.can_write_order_history(UUID) TO authenticated;

ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "factory_owner_select_order_history" ON public.order_status_history;
CREATE POLICY "factory_owner_select_order_history"
ON public.order_status_history
FOR SELECT
TO authenticated
USING (public.can_write_order_history(order_id));

DROP POLICY IF EXISTS "factory_owner_insert_order_history" ON public.order_status_history;
CREATE POLICY "factory_owner_insert_order_history"
ON public.order_status_history
FOR INSERT
TO authenticated
WITH CHECK (public.can_write_order_history(order_id));

-- History is an audit trail: block UPDATE / DELETE for non-admins
DROP POLICY IF EXISTS "admin_modify_order_history" ON public.order_status_history;
CREATE POLICY "admin_modify_order_history"
ON public.order_status_history
FOR UPDATE
TO authenticated
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS "admin_delete_order_history" ON public.order_status_history;
CREATE POLICY "admin_delete_order_history"
ON public.order_status_history
FOR DELETE
TO authenticated
USING (public.is_admin_user());

-- ------------------------------------------------------------
-- 4. NOTIFICATIONS: factory dispatch notifications via a guarded RPC
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_order_parties(
    p_order_id UUID,
    p_title TEXT,
    p_message TEXT,
    p_type TEXT DEFAULT 'order_update'
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
    v_order public.orders%ROWTYPE;
    v_count INTEGER := 0;
    v_recipient UUID;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_order FROM public.orders WHERE id = p_order_id LIMIT 1;
    IF v_order.id IS NULL THEN
        RAISE EXCEPTION 'Order not found' USING ERRCODE = 'P0002';
    END IF;

    -- Only the owning factory may notify the parties of its own orders.
    IF v_order.factory_user_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'Only the owning factory can notify order parties' USING ERRCODE = '42501';
    END IF;

    -- Recipients are resolved server-side from the order's dispatch room,
    -- never supplied by the browser.
    FOR v_recipient IN
        SELECT DISTINCT x.uid
        FROM public.order_dispatch_rooms r
        CROSS JOIN LATERAL (VALUES (r.agent_id), (r.logistics_id)) AS x(uid)
        WHERE r.order_id = p_order_id
          AND r.factory_id = auth.uid()
          AND x.uid IS NOT NULL
          AND x.uid <> auth.uid()
    LOOP
        INSERT INTO public.notifications (user_id, type, title, body, link, is_read, metadata)
        VALUES (
            v_recipient,
            COALESCE(NULLIF(p_type, ''), 'order_update'),
            p_title,
            p_message,
            '',
            false,
            jsonb_build_object('order_id', p_order_id, 'source', 'factory_room')
        );
        v_count := v_count + 1;
    END LOOP;

    RETURN v_count;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.notify_order_parties(UUID, TEXT, TEXT, TEXT) TO authenticated;

-- ------------------------------------------------------------
-- 5. FACTORY_SALES_REPS: owner pinned to auth.uid(), no self promotion
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.factory_sales_reps_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
    caller UUID := auth.uid();
    is_privileged BOOLEAN := false;
BEGIN
    IF caller IS NULL THEN
        RETURN NEW;
    END IF;

    BEGIN
        is_privileged := COALESCE(public.is_admin_user(), false);
    EXCEPTION WHEN OTHERS THEN
        is_privileged := false;
    END;

    IF is_privileged THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'INSERT' THEN
        IF NEW.factory_owner_id IS DISTINCT FROM caller THEN
            RAISE EXCEPTION 'factory_owner_id must equal the authenticated user' USING ERRCODE = '42501';
        END IF;
        RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF NEW.factory_owner_id IS DISTINCT FROM OLD.factory_owner_id THEN
            RAISE EXCEPTION 'factory_owner_id is immutable' USING ERRCODE = '42501';
        END IF;
        -- A rep (not the owner) can never alter their own role, status or permissions.
        IF OLD.factory_owner_id IS DISTINCT FROM caller THEN
            RAISE EXCEPTION 'Only the factory owner can modify sales rep records' USING ERRCODE = '42501';
        END IF;
        RETURN NEW;
    END IF;

    RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trg_factory_sales_reps_guard ON public.factory_sales_reps;
CREATE TRIGGER trg_factory_sales_reps_guard
    BEFORE INSERT OR UPDATE ON public.factory_sales_reps
    FOR EACH ROW EXECUTE FUNCTION public.factory_sales_reps_guard();

ALTER TABLE public.factory_sales_reps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "factory_owner_manage_reps" ON public.factory_sales_reps;
CREATE POLICY "factory_owner_manage_reps"
ON public.factory_sales_reps
FOR ALL
TO authenticated
USING (factory_owner_id = auth.uid())
WITH CHECK (factory_owner_id = auth.uid());

DROP POLICY IF EXISTS "sales_rep_view_own_record" ON public.factory_sales_reps;
CREATE POLICY "sales_rep_view_own_record"
ON public.factory_sales_reps
FOR SELECT
TO authenticated
USING (rep_user_id = auth.uid());
