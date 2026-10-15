-- Financial Escrow Portal: ESCROW_OFFICER access + hard MASTER_ADMIN gate on funds release.

CREATE OR REPLACE FUNCTION public.is_master_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $func$
SELECT EXISTS (
    SELECT 1 FROM auth.users au
    WHERE au.id = auth.uid()
    AND (
        au.raw_user_meta_data->>'role' = 'admin'
        OR au.raw_app_meta_data->>'role' = 'admin'
    )
)
$func$;

CREATE OR REPLACE FUNCTION public.is_escrow_officer()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $func$
SELECT EXISTS (
    SELECT 1 FROM auth.users au
    WHERE au.id = auth.uid()
    AND (
        au.raw_user_meta_data->>'staff_role' = 'ESCROW_OFFICER'
        OR au.raw_app_meta_data->>'staff_role' = 'ESCROW_OFFICER'
    )
)
$func$;

-- Officers may read orders, payment submissions, commissions and wire receipts.
DROP POLICY IF EXISTS "escrow_officer_read_orders" ON public.orders;
CREATE POLICY "escrow_officer_read_orders"
ON public.orders
FOR SELECT
TO authenticated
USING (public.is_escrow_officer());

DROP POLICY IF EXISTS "escrow_officer_update_orders" ON public.orders;
CREATE POLICY "escrow_officer_update_orders"
ON public.orders
FOR UPDATE
TO authenticated
USING (public.is_escrow_officer())
WITH CHECK (public.is_escrow_officer());

DROP POLICY IF EXISTS "escrow_officer_manage_payment_submissions" ON public.payment_submissions;
CREATE POLICY "escrow_officer_manage_payment_submissions"
ON public.payment_submissions
FOR ALL
TO authenticated
USING (public.is_escrow_officer())
WITH CHECK (public.is_escrow_officer());

DROP POLICY IF EXISTS "escrow_officer_read_platform_commissions" ON public.platform_commissions;
CREATE POLICY "escrow_officer_read_platform_commissions"
ON public.platform_commissions
FOR SELECT
TO authenticated
USING (public.is_escrow_officer());

DROP POLICY IF EXISTS "escrow_officer_read_user_profiles" ON public.user_profiles;
CREATE POLICY "escrow_officer_read_user_profiles"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (public.is_escrow_officer());

-- Hard gate: only a MASTER_ADMIN (role = admin) or the service role may move an order
-- into the funds_released state, regardless of how the UPDATE is issued.
CREATE OR REPLACE FUNCTION public.enforce_master_admin_funds_release()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
BEGIN
    IF NEW.escrow_status = 'funds_released'
       AND COALESCE(OLD.escrow_status, '') <> 'funds_released'
       AND auth.uid() IS NOT NULL
       AND NOT public.is_master_admin() THEN
        RAISE EXCEPTION 'execute_payout requires MASTER_ADMIN' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trg_enforce_master_admin_funds_release ON public.orders;
CREATE TRIGGER trg_enforce_master_admin_funds_release
BEFORE UPDATE OF escrow_status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.enforce_master_admin_funds_release();
