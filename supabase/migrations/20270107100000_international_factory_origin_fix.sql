-- Agent-registered international (Chinese) factories must be classified as international:
-- origin_type, country (CN), Chinese shipping port, USD pricing. Agent identity is never the seller.

-- 1. Origin + port columns on agent-registered facilities
ALTER TABLE public.agent_factory_registrations
  ADD COLUMN IF NOT EXISTS origin_type text,
  ADD COLUMN IF NOT EXISTS shipping_port text;

UPDATE public.agent_factory_registrations
SET origin_type = CASE
  WHEN factory_type::text = 'international_factory' OR factory_type::text = 'international' THEN 'international'
  WHEN public.normalize_country_code(country) NOT IN ('YE') AND coalesce(btrim(country), '') <> '' THEN 'international'
  ELSE 'local'
END
WHERE origin_type IS NULL OR origin_type NOT IN ('local', 'international');

-- International facilities with a missing / local country default to China
UPDATE public.agent_factory_registrations
SET country = 'الصين'
WHERE origin_type = 'international'
  AND (coalesce(btrim(country), '') = '' OR public.normalize_country_code(country) IN ('YE', 'SA'));

-- Default Chinese shipping port by city (Ningbo fallback)
UPDATE public.agent_factory_registrations
SET shipping_port = CASE
  WHEN lower(coalesce(city, '')) ~ '(shenzhen|شنتشن|guangzhou|غوانغتشو|dongguan|foshan|zhongshan|huizhou)' THEN 'Shenzhen'
  WHEN lower(coalesce(city, '')) ~ '(shanghai|شنغهاي|suzhou|wuxi|nanjing|changzhou)' THEN 'Shanghai'
  WHEN lower(coalesce(city, '')) ~ '(tianjin|تيانجين|qingdao|dalian|beijing|jinan)' THEN 'Tianjin'
  ELSE 'Ningbo'
END
WHERE origin_type = 'international'
  AND coalesce(btrim(shipping_port), '') = '';

ALTER TABLE public.agent_factory_registrations
  ALTER COLUMN origin_type SET DEFAULT 'local';

CREATE OR REPLACE FUNCTION public.sync_agent_factory_origin()
RETURNS trigger
LANGUAGE plpgsql
AS $func$
BEGIN
  IF NEW.factory_type::text IN ('international_factory', 'international') THEN
    NEW.origin_type := 'international';
  ELSIF NEW.origin_type IS NULL OR NEW.origin_type NOT IN ('local', 'international') THEN
    NEW.origin_type := 'local';
  END IF;

  IF NEW.origin_type = 'international' THEN
    IF coalesce(btrim(NEW.country), '') = '' OR public.normalize_country_code(NEW.country) IN ('YE', 'SA') THEN
      NEW.country := 'الصين';
    END IF;
    IF coalesce(btrim(NEW.shipping_port), '') = '' THEN
      NEW.shipping_port := CASE
        WHEN lower(coalesce(NEW.city, '')) ~ '(shenzhen|شنتشن|guangzhou|غوانغتشو|dongguan|foshan|zhongshan|huizhou)' THEN 'Shenzhen'
        WHEN lower(coalesce(NEW.city, '')) ~ '(shanghai|شنغهاي|suzhou|wuxi|nanjing|changzhou)' THEN 'Shanghai'
        WHEN lower(coalesce(NEW.city, '')) ~ '(tianjin|تيانجين|qingdao|dalian|beijing|jinan)' THEN 'Tianjin'
        ELSE 'Ningbo'
      END;
    END IF;
  END IF;
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trg_sync_agent_factory_origin ON public.agent_factory_registrations;
CREATE TRIGGER trg_sync_agent_factory_origin
  BEFORE INSERT OR UPDATE ON public.agent_factory_registrations
  FOR EACH ROW EXECUTE FUNCTION public.sync_agent_factory_origin();

-- 2. Mirror origin to the factory's own registration (when it has a user account)
UPDATE public.factory_registrations fr
SET origin_type = 'international'::public.origin_type
FROM public.agent_factory_registrations afr
WHERE afr.factory_user_id = fr.user_id
  AND afr.origin_type = 'international'
  AND fr.origin_type IS DISTINCT FROM 'international'::public.origin_type;

-- 3. Products of international agent-registered factories: origin, country, port, USD
UPDATE public.manufacturer_products mp
SET origin_type = 'international'::public.origin_type,
    currency = 'USD',
    origin_country = public.normalize_country_code(afr.country),
    port_of_loading = COALESCE(NULLIF(btrim(mp.port_of_loading), ''), afr.shipping_port),
    shipping_port = COALESCE(NULLIF(btrim(mp.shipping_port), ''), afr.shipping_port)
FROM public.agent_factory_registrations afr
WHERE mp.registered_factory_id = afr.id
  AND afr.origin_type = 'international';

-- 4. Public profile RPC: expose origin_type + shipping_port, resolve CN country
CREATE OR REPLACE FUNCTION public.get_public_factory_profile(p_ref uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_afr  jsonb;
  v_fr   jsonb;
  v_up   jsonb;
  v_uid  uuid;
  v_reg  uuid;
  v_est  integer;
BEGIN
  SELECT to_jsonb(a) INTO v_afr
  FROM public.agent_factory_registrations a
  WHERE a.id = p_ref OR a.factory_user_id = p_ref
  ORDER BY (a.id = p_ref) DESC
  LIMIT 1;

  IF v_afr IS NOT NULL THEN
    v_reg := (v_afr ->> 'id')::uuid;
    v_uid := NULLIF(v_afr ->> 'factory_user_id', '')::uuid;
  ELSE
    v_uid := p_ref;
  END IF;

  IF v_uid IS NOT NULL THEN
    SELECT to_jsonb(f) INTO v_fr FROM public.factory_registrations f WHERE f.user_id = v_uid LIMIT 1;
    SELECT to_jsonb(u) INTO v_up FROM public.user_profiles u WHERE u.id = v_uid LIMIT 1;
  END IF;

  IF v_afr IS NULL AND v_fr IS NULL AND v_up IS NULL THEN
    RETURN NULL;
  END IF;

  -- Only a plausible founding year is ever exposed
  v_est := CASE
    WHEN NULLIF(v_fr ->> 'established_year', '') ~ '^[0-9]{4}$'
      AND (v_fr ->> 'established_year')::int BETWEEN 1900 AND EXTRACT(YEAR FROM now())::int
    THEN (v_fr ->> 'established_year')::int
    ELSE NULL
  END;

  RETURN jsonb_build_object(
    'factory_id', COALESCE(v_reg, v_uid),
    'user_id', v_uid,
    'company_name', COALESCE(
      NULLIF(v_afr ->> 'company_name', ''),
      NULLIF(v_fr ->> 'company_name', ''),
      NULLIF(v_up ->> 'company_name', '')
    ),
    'city', COALESCE(NULLIF(v_afr ->> 'city', ''), NULLIF(v_up ->> 'city', ''), ''),
    'country_code', public.normalize_country_code(
      COALESCE(NULLIF(v_afr ->> 'country', ''), NULLIF(v_up ->> 'country', ''))
    ),
    'origin_type', COALESCE(
      NULLIF(v_afr ->> 'origin_type', ''),
      NULLIF(v_fr ->> 'origin_type', ''),
      'local'
    ),
    'shipping_port', NULLIF(v_afr ->> 'shipping_port', ''),
    'factory_type', COALESCE(v_afr ->> 'factory_type', v_fr ->> 'factory_type'),
    'industry', COALESCE(NULLIF(v_afr ->> 'industry', ''), NULLIF(v_fr ->> 'main_products', '')),
    'annual_capacity', COALESCE(NULLIF(v_afr ->> 'annual_capacity', ''), NULLIF(v_fr ->> 'annual_capacity', '')),
    'established_year', v_est::text,
    'registration_status', COALESCE(v_afr ->> 'registration_status', v_fr ->> 'registration_status'),
    'commercial_register_number', COALESCE(
      NULLIF(v_afr ->> 'commercial_register_number', ''),
      NULLIF(v_fr ->> 'commercial_register_number', '')
    ),
    'commercial_register_verified', (
      COALESCE(NULLIF(v_afr ->> 'commercial_register_number', ''), NULLIF(v_fr ->> 'commercial_register_number', '')) IS NOT NULL
      AND COALESCE(v_afr ->> 'registration_status', v_fr ->> 'registration_status') IN ('approved', 'verified', 'active')
    ),
    'trust_percentage', COALESCE(NULLIF(v_fr ->> 'trust_percentage', '')::numeric, 0)
  );
END;
$func$;

GRANT EXECUTE ON FUNCTION public.get_public_factory_profile(uuid) TO anon, authenticated;

-- 5. Catalog RPC: include currency so international catalogs render in USD
DROP FUNCTION IF EXISTS public.get_public_factory_catalog(uuid);
CREATE OR REPLACE FUNCTION public.get_public_factory_catalog(p_ref uuid)
RETURNS TABLE (
  id uuid, name text, name_ar text, category text, unit text, unit_price numeric,
  minimum_order_qty numeric, inventory_status text, origin_country text, image_url text,
  currency text, origin_type text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
  SELECT mp.id, mp.name, mp.name_ar, mp.category::text, mp.unit, mp.unit_price,
         mp.minimum_order_qty, mp.inventory_status::text, mp.origin_country, mp.image_url,
         mp.currency::text, mp.origin_type::text
  FROM public.manufacturer_products mp
  WHERE mp.is_active = true
    AND (
      mp.registered_factory_id = p_ref
      OR mp.registered_factory_id IN (SELECT a.id FROM public.agent_factory_registrations a WHERE a.factory_user_id = p_ref)
      OR mp.manufacturer_id = p_ref
    )
  ORDER BY mp.created_at DESC
  LIMIT 60;
$func$;

GRANT EXECUTE ON FUNCTION public.get_public_factory_catalog(uuid) TO anon, authenticated;

-- 6. Publishing: new agent products inherit origin / country / port / currency from the registered factory
CREATE OR REPLACE FUNCTION public.apply_agent_factory_origin_to_product()
RETURNS trigger
LANGUAGE plpgsql
AS $func$
DECLARE
  v_afr public.agent_factory_registrations%ROWTYPE;
BEGIN
  IF NEW.registered_factory_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT * INTO v_afr FROM public.agent_factory_registrations WHERE id = NEW.registered_factory_id LIMIT 1;
  IF v_afr.id IS NULL THEN
    RETURN NEW;
  END IF;
  IF v_afr.origin_type = 'international' THEN
    NEW.origin_type := 'international'::public.origin_type;
    NEW.currency := 'USD';
    NEW.origin_country := public.normalize_country_code(v_afr.country);
    IF coalesce(btrim(NEW.port_of_loading), '') = '' THEN
      NEW.port_of_loading := v_afr.shipping_port;
    END IF;
    IF coalesce(btrim(NEW.shipping_port), '') = '' THEN
      NEW.shipping_port := v_afr.shipping_port;
    END IF;
  END IF;
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trg_apply_agent_factory_origin ON public.manufacturer_products;
CREATE TRIGGER trg_apply_agent_factory_origin
  BEFORE INSERT OR UPDATE OF registered_factory_id ON public.manufacturer_products
  FOR EACH ROW EXECUTE FUNCTION public.apply_agent_factory_origin_to_product();

NOTIFY pgrst, 'reload schema';
