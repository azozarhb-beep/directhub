-- ============================================================
-- Room 2 (local supplier) readiness: gaps 1-7
--  1) supplier_products locked to origin_type='local' + currency='YER'
--  2) factory_bank_accounts: YER only
--  3) "Ready for dispatch" handshake -> logistics_shipments (open for bids)
--  4) Confirm supplier.ye@direct-hub.net has commercial_supplier role
-- Idempotent. Requires 20270105100000 (supplier_available_balance_yer).
-- ============================================================

-- 1) supplier_products: origin_type + strict YER
ALTER TABLE public.supplier_products
  ADD COLUMN IF NOT EXISTS origin_type public.origin_type NOT NULL DEFAULT 'local'::public.origin_type;

UPDATE public.supplier_products
SET origin_type = 'local'::public.origin_type
WHERE origin_type IS DISTINCT FROM 'local'::public.origin_type;

UPDATE public.supplier_products
SET currency = 'YER'
WHERE currency IS DISTINCT FROM 'YER';

ALTER TABLE public.supplier_products
  DROP CONSTRAINT IF EXISTS supplier_products_origin_local_check;
ALTER TABLE public.supplier_products
  ADD CONSTRAINT supplier_products_origin_local_check
  CHECK (origin_type = 'local'::public.origin_type);

ALTER TABLE public.supplier_products
  DROP CONSTRAINT IF EXISTS supplier_products_currency_yer_check;
ALTER TABLE public.supplier_products
  ADD CONSTRAINT supplier_products_currency_yer_check
  CHECK (currency = 'YER');

ALTER TABLE public.supplier_products
  ALTER COLUMN currency SET DEFAULT 'YER';

COMMENT ON COLUMN public.supplier_products.origin_type IS
  'Local suppliers only: always local (priced in YER).';

-- 2) factory_bank_accounts: YER only
UPDATE public.factory_bank_accounts
SET currency = 'YER'
WHERE currency IS DISTINCT FROM 'YER';

ALTER TABLE public.factory_bank_accounts
  ALTER COLUMN currency SET DEFAULT 'YER';

ALTER TABLE public.factory_bank_accounts
  DROP CONSTRAINT IF EXISTS factory_bank_accounts_currency_yer_check;
ALTER TABLE public.factory_bank_accounts
  ADD CONSTRAINT factory_bank_accounts_currency_yer_check
  CHECK (currency = 'YER');

-- request_supplier_payout must also reject non-YER accounts (defence in depth)
CREATE OR REPLACE FUNCTION public.request_supplier_payout(
  p_amount          NUMERIC,
  p_bank_account_id UUID DEFAULT NULL,
  p_currency        TEXT DEFAULT 'YER'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_uid       UUID := auth.uid();
  v_available NUMERIC;
  v_id        UUID;
  v_ref       TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF UPPER(COALESCE(p_currency, 'YER')) <> 'YER' THEN
    RAISE EXCEPTION 'Local supplier payouts are YER only';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = v_uid) THEN
    RAISE EXCEPTION 'Supplier profile not found';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Invalid amount';
  END IF;

  IF p_bank_account_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.factory_bank_accounts fba
    WHERE fba.id = p_bank_account_id
      AND fba.manufacturer_id = v_uid
      AND UPPER(COALESCE(fba.currency, 'YER')) = 'YER'
  ) THEN
    RAISE EXCEPTION 'Bank account must belong to this supplier and be in YER';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('supplier_payout:' || v_uid::text, 0));

  v_available := public.supplier_available_balance_yer(v_uid);
  IF p_amount > v_available THEN
    RAISE EXCEPTION 'Amount exceeds available balance (%)', v_available;
  END IF;

  v_ref := 'WD-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

  INSERT INTO public.supplier_payout_requests (
    supplier_id, amount, currency, bank_account_id, reference, status
  ) VALUES (
    v_uid, ROUND(p_amount, 2), 'YER', p_bank_account_id, v_ref, 'pending_review'
  )
  RETURNING id INTO v_id;

  BEGIN
    INSERT INTO public.notifications (user_id, title, message, type)
    SELECT up.id,
           'طلب سحب أرباح مورد جديد',
           'طلب سحب بقيمة ' || ROUND(p_amount, 2)::text || ' YER (' || v_ref || ')',
           'system'
    FROM public.user_profiles up
    WHERE up.role::text = 'admin';
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN v_id;
END;
$func$;

REVOKE ALL ON FUNCTION public.request_supplier_payout(NUMERIC, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_supplier_payout(NUMERIC, UUID, TEXT) TO authenticated;

-- 3) Logistics handshake: 'pending_pickup' status value
ALTER TYPE public.shipment_status_enum ADD VALUE IF NOT EXISTS 'pending_pickup';

-- 4) Atomic "ready for dispatch" RPC (SECURITY DEFINER, ownership validated)
CREATE OR REPLACE FUNCTION public.supplier_mark_order_ready_for_dispatch(p_order_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_uid      UUID := auth.uid();
  v_order    public.orders%ROWTYPE;
  v_ship_id  UUID;
  v_dest     TEXT;
  v_origin   TEXT;
  v_track    TEXT;
  v_total    NUMERIC;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id AND factory_user_id = v_uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found for this supplier';
  END IF;

  IF v_order.status::text NOT IN ('processing', 'confirmed') THEN
    RAISE EXCEPTION 'Order must be in processing state before it is ready for dispatch';
  END IF;

  -- Idempotent: reuse an existing open shipment for this order
  SELECT s.id INTO v_ship_id
  FROM public.logistics_shipments s
  WHERE s.order_id = p_order_id
    AND s.created_by = v_uid
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF v_ship_id IS NOT NULL THEN
    RETURN v_ship_id;
  END IF;

  v_dest := COALESCE(
    NULLIF(trim(COALESCE(v_order.shipping_address ->> 'address', '')), ''),
    NULLIF(trim(concat_ws(', ',
      v_order.shipping_address ->> 'city',
      v_order.shipping_address ->> 'governorate',
      v_order.shipping_address ->> 'street')), ''),
    'غير محدد'
  );

  SELECT COALESCE(NULLIF(trim(concat_ws(', ', ssp.warehouse_name, ssp.warehouse_city)), ''), 'مستودع المورد')
  INTO v_origin
  FROM public.supplier_supply_profile ssp
  WHERE ssp.supplier_id = v_uid;

  v_origin := COALESCE(v_origin, 'مستودع المورد');
  v_track := 'SUP-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
  v_total := COALESCE(v_order.total, 0);

  INSERT INTO public.logistics_shipments (
    order_id, created_by, tracking_number,
    origin_address, destination_address,
    shipment_status, shipping_type, is_open_for_bids,
    target_budget, budget_currency, notes
  ) VALUES (
    p_order_id, v_uid, v_track,
    v_origin, v_dest,
    'pending_pickup'::public.shipment_status_enum, 'local_land', true,
    NULL, 'YER', 'جاهز للشحن - طلب ' || COALESCE(v_order.order_number, p_order_id::text)
  )
  RETURNING id INTO v_ship_id;

  RETURN v_ship_id;
END;
$func$;

REVOKE ALL ON FUNCTION public.supplier_mark_order_ready_for_dispatch(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.supplier_mark_order_ready_for_dispatch(UUID) TO authenticated;

-- 5) Verified badge helper: true only when admin approved supplier_documents
CREATE OR REPLACE FUNCTION public.supplier_is_verified(p_supplier_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
  SELECT EXISTS (
    SELECT 1 FROM public.supplier_documents d
    WHERE d.supplier_id = p_supplier_id
      AND d.verification_status = 'approved'
  );
$func$;

REVOKE ALL ON FUNCTION public.supplier_is_verified(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.supplier_is_verified(UUID) TO authenticated;

-- 6) Server-side role check used by the /supplier layout (reads DB, not cookies)
CREATE OR REPLACE FUNCTION public.current_user_is_commercial_supplier()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND (
        lower(COALESCE(up.seller_category, '')) IN ('commercial_supplier', 'local_supplier')
        OR lower(COALESCE(up.account_type, '')) IN ('commercial_supplier', 'local_supplier')
      )
  );
$func$;

REVOKE ALL ON FUNCTION public.current_user_is_commercial_supplier() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_is_commercial_supplier() TO authenticated;

-- 6b) Only admins may set verification_status (suppliers cannot self-approve)
CREATE OR REPLACE FUNCTION public.guard_supplier_documents_verification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT public.is_admin_user() THEN
      NEW.verification_status := 'pending';
      NEW.reject_reason := NULL;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NOT public.is_admin_user() THEN
      NEW.verification_status := OLD.verification_status;
      NEW.reject_reason := OLD.reject_reason;
      -- Replacing a legal document sends the record back to admin review
      IF (NEW.commercial_register_url IS DISTINCT FROM OLD.commercial_register_url
          OR NEW.agency_authorization_url IS DISTINCT FROM OLD.agency_authorization_url)
         AND OLD.verification_status = 'approved' THEN
        NEW.verification_status := 'pending';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trg_guard_supplier_documents_verification ON public.supplier_documents;
CREATE TRIGGER trg_guard_supplier_documents_verification
  BEFORE INSERT OR UPDATE ON public.supplier_documents
  FOR EACH ROW EXECUTE FUNCTION public.guard_supplier_documents_verification();

-- 7) Confirm supplier.ye@direct-hub.net holds the commercial_supplier role (no user creation)
DO $role$
DECLARE
  v_uid UUID;
BEGIN
  SELECT au.id INTO v_uid
  FROM auth.users au
  WHERE lower(au.email) = 'supplier.ye@direct-hub.net'
  LIMIT 1;

  IF v_uid IS NULL THEN
    RAISE NOTICE 'supplier.ye@direct-hub.net not found in auth.users - role not changed';
    RETURN;
  END IF;

  UPDATE public.user_profiles
  SET seller_category = 'commercial_supplier',
      account_type    = 'local_supplier',
      dashboard_path  = '/supplier',
      role_selected   = true,
      updated_at      = now()
  WHERE id = v_uid;

  RAISE NOTICE 'supplier.ye@direct-hub.net confirmed as commercial_supplier (%)', v_uid;
END $role$;

NOTIFY pgrst, 'reload schema';
