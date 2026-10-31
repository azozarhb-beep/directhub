-- ============================================================
-- TASK 39: Sales Rep auto-linking trigger + escrow/settlement masking for sub-accounts
-- ============================================================

-- 0. Prerequisites (idempotent) - ensure columns/helpers used below exist
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS factory_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL;

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS phone TEXT;

CREATE INDEX IF NOT EXISTS idx_user_profiles_factory_id ON public.user_profiles(factory_id);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS factory_user_id UUID;

CREATE OR REPLACE FUNCTION public.get_agent_factory_owner_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
  SELECT factory_id FROM public.user_profiles
  WHERE id = auth.uid()
    AND role = 'manufacturer_agent'
    AND is_active = true
  LIMIT 1;
$func$;

-- 1. Phone normalizer (digits only, strip 00 / 967 / leading 0 -> 9 digit Yemeni local number)
CREATE OR REPLACE FUNCTION public.normalize_sales_rep_phone(raw TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $func$
DECLARE
  d TEXT;
BEGIN
  IF raw IS NULL THEN
    RETURN NULL;
  END IF;
  d := regexp_replace(raw, '[^0-9]', '', 'g');
  IF d = '' THEN
    RETURN NULL;
  END IF;
  IF d LIKE '00967%' THEN
    d := substr(d, 6);
  ELSIF d LIKE '967%' AND length(d) >= 12 THEN
    d := substr(d, 4);
  END IF;
  IF d LIKE '0%' THEN
    d := substr(d, 2);
  END IF;
  RETURN d;
END;
$func$;

-- 2. Auto-link function: runs when a profile is created (or its phone/email changes)
CREATE OR REPLACE FUNCTION public.link_pending_sales_rep_on_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_rep RECORD;
  v_phone TEXT;
  v_email TEXT;
BEGIN
  v_phone := public.normalize_sales_rep_phone(NEW.phone);
  v_email := lower(coalesce(NEW.email, ''));

  IF v_phone IS NULL AND v_email = '' THEN
    RETURN NEW;
  END IF;

  -- Never re-link factory owners / admins / users already tied to a factory
  IF NEW.factory_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT r.id, r.factory_owner_id
    INTO v_rep
    FROM public.factory_sales_reps r
   WHERE r.status = 'pending'
     AND r.rep_user_id IS NULL
     AND r.factory_owner_id <> NEW.id
     AND (
       (v_email <> '' AND lower(r.invited_email) = v_email)
       OR (
         v_phone IS NOT NULL
         AND (
           lower(r.invited_email) = v_phone || '@' || 'phone.directhub.local'
           OR lower(r.invited_email) = '967' || v_phone || '@' || 'phone.directhub.local'
           OR public.normalize_sales_rep_phone(split_part(r.invited_email, '@', 1)) = v_phone
           OR public.normalize_sales_rep_phone(substring(coalesce(r.notes, '') FROM '\+?[0-9]{9,15}')) = v_phone
         )
       )
     )
   ORDER BY r.created_at ASC
   LIMIT 1;

  IF v_rep.id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.factory_sales_reps
     SET rep_user_id = NEW.id,
         status = 'active',
         accepted_at = now()
   WHERE id = v_rep.id;

  UPDATE public.user_profiles
     SET role = 'manufacturer_agent',
         factory_id = v_rep.factory_owner_id,
         is_active = true
   WHERE id = NEW.id;

  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trg_link_pending_sales_rep_insert ON public.user_profiles;
CREATE TRIGGER trg_link_pending_sales_rep_insert
AFTER INSERT ON public.user_profiles
FOR EACH ROW
EXECUTE FUNCTION public.link_pending_sales_rep_on_signup();

-- The WHEN clause is dropped; the function itself exits early when factory_id is already set.
DROP TRIGGER IF EXISTS trg_link_pending_sales_rep_update ON public.user_profiles;
CREATE TRIGGER trg_link_pending_sales_rep_update
AFTER UPDATE OF phone, email ON public.user_profiles
FOR EACH ROW
EXECUTE FUNCTION public.link_pending_sales_rep_on_signup();

-- 3. Strip escrow/settlement amounts for sub-account agents.
--    Agents lose direct row access to public.orders and read a masked copy via RPC.
DROP POLICY IF EXISTS "manufacturer_agent_view_factory_orders" ON public.orders;

CREATE OR REPLACE FUNCTION public.get_agent_factory_orders()
RETURNS SETOF JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
  SELECT (
    to_jsonb(o)
      - 'escrow_status' - 'escrow_amount' - 'escrow_fee' - 'platform_commission'
      - 'platform_fee' - 'commission_rate_label' - 'payout_note'
      - 'admin_payout_reviewed_at' - 'admin_payout_approved_by'
      - 'milestone_1_paid' - 'milestone_2_paid' - 'milestone_3_paid'
      - 'payment_method' - 'subtotal' - 'total'
  )
  FROM public.orders o
  WHERE o.factory_user_id = public.get_agent_factory_owner_id()
  ORDER BY o.created_at DESC;
$func$;

REVOKE ALL ON FUNCTION public.get_agent_factory_orders() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_agent_factory_orders() TO authenticated;
