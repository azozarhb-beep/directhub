-- Supplier: monthly supply capacity + distribution channels & supply chains

CREATE TABLE IF NOT EXISTS public.supplier_supply_profile (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id              UUID        NOT NULL UNIQUE REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  monthly_supply_capacity  NUMERIC(14,2) NOT NULL DEFAULT 0,
  capacity_unit            TEXT        NOT NULL DEFAULT 'carton',
  available_supply_volume  NUMERIC(14,2) NOT NULL DEFAULT 0,
  warehouse_name           TEXT,
  warehouse_city           TEXT,
  notes                    TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.supplier_supply_profile
  DROP CONSTRAINT IF EXISTS supplier_supply_profile_unit_check;
ALTER TABLE public.supplier_supply_profile
  ADD CONSTRAINT supplier_supply_profile_unit_check
  CHECK (capacity_unit IN ('carton', 'bale', 'bundle', 'dozen', 'bag', 'roll', 'piece', 'kg', 'ton'));

CREATE TABLE IF NOT EXISTS public.supplier_distribution_channels (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id      UUID        NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  channel_name     TEXT        NOT NULL,
  channel_type     TEXT        NOT NULL DEFAULT 'wholesale',
  coverage_area    TEXT,
  monthly_volume   NUMERIC(14,2) NOT NULL DEFAULT 0,
  volume_unit      TEXT        NOT NULL DEFAULT 'carton',
  lead_time_days   INTEGER     NOT NULL DEFAULT 3,
  status           TEXT        NOT NULL DEFAULT 'active',
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.supplier_distribution_channels
  DROP CONSTRAINT IF EXISTS supplier_distribution_channels_type_check;
ALTER TABLE public.supplier_distribution_channels
  ADD CONSTRAINT supplier_distribution_channels_type_check
  CHECK (channel_type IN ('wholesale', 'retail', 'distributor', 'import', 'online'));

ALTER TABLE public.supplier_distribution_channels
  DROP CONSTRAINT IF EXISTS supplier_distribution_channels_status_check;
ALTER TABLE public.supplier_distribution_channels
  ADD CONSTRAINT supplier_distribution_channels_status_check
  CHECK (status IN ('active', 'paused', 'archived'));

CREATE INDEX IF NOT EXISTS idx_supplier_distribution_channels_supplier_id
  ON public.supplier_distribution_channels(supplier_id);

ALTER TABLE public.supplier_supply_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_distribution_channels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "suppliers_manage_own_supply_profile" ON public.supplier_supply_profile;
CREATE POLICY "suppliers_manage_own_supply_profile"
ON public.supplier_supply_profile
  FOR ALL
  TO authenticated
  USING (supplier_id = auth.uid())
  WITH CHECK (supplier_id = auth.uid());

DROP POLICY IF EXISTS "admins_view_all_supply_profiles" ON public.supplier_supply_profile;
CREATE POLICY "admins_view_all_supply_profiles"
ON public.supplier_supply_profile
  FOR SELECT
  TO authenticated
  USING (public.is_admin_user());

DROP POLICY IF EXISTS "suppliers_manage_own_distribution_channels" ON public.supplier_distribution_channels;
CREATE POLICY "suppliers_manage_own_distribution_channels"
ON public.supplier_distribution_channels
  FOR ALL
  TO authenticated
  USING (supplier_id = auth.uid())
  WITH CHECK (supplier_id = auth.uid());

DROP POLICY IF EXISTS "admins_view_all_distribution_channels" ON public.supplier_distribution_channels;
CREATE POLICY "admins_view_all_distribution_channels"
ON public.supplier_distribution_channels
  FOR SELECT
  TO authenticated
  USING (public.is_admin_user());

DROP TRIGGER IF EXISTS trg_supplier_supply_profile_updated_at ON public.supplier_supply_profile;
CREATE TRIGGER trg_supplier_supply_profile_updated_at
BEFORE UPDATE ON public.supplier_supply_profile
  FOR EACH ROW
  EXECUTE FUNCTION public.set_supplier_tables_updated_at();

DROP TRIGGER IF EXISTS trg_supplier_distribution_channels_updated_at ON public.supplier_distribution_channels;
CREATE TRIGGER trg_supplier_distribution_channels_updated_at
BEFORE UPDATE ON public.supplier_distribution_channels
  FOR EACH ROW
  EXECUTE FUNCTION public.set_supplier_tables_updated_at();
