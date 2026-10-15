-- Field Ops: physical inspection missions dispatched to field agents.
-- No escrow / vault / payout data lives here.

CREATE TABLE IF NOT EXISTS public.field_inspection_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    factory_id UUID REFERENCES public.agent_factory_registrations(id) ON DELETE SET NULL,
    factory_name TEXT NOT NULL DEFAULT '',
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    assigned_agent_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    title TEXT NOT NULL DEFAULT '',
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'dispatched',
    batch_quality TEXT,
    production_date DATE,
    photo_urls TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    report_notes TEXT,
    result TEXT,
    signed_off_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_field_inspection_tasks_status ON public.field_inspection_tasks(status);
CREATE INDEX IF NOT EXISTS idx_field_inspection_tasks_agent ON public.field_inspection_tasks(assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_field_inspection_tasks_factory ON public.field_inspection_tasks(factory_id);

CREATE OR REPLACE FUNCTION public.is_field_ops_staff()
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
        OR au.raw_user_meta_data->>'staff_role' = 'FIELD_OPS_MANAGER'
        OR au.raw_app_meta_data->>'staff_role' = 'FIELD_OPS_MANAGER'
    )
)
$func$;

ALTER TABLE public.field_inspection_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "field_ops_staff_manage_inspection_tasks" ON public.field_inspection_tasks;
CREATE POLICY "field_ops_staff_manage_inspection_tasks"
ON public.field_inspection_tasks
FOR ALL
TO authenticated
USING (public.is_field_ops_staff())
WITH CHECK (public.is_field_ops_staff());

DROP POLICY IF EXISTS "agents_view_assigned_inspection_tasks" ON public.field_inspection_tasks;
CREATE POLICY "agents_view_assigned_inspection_tasks"
ON public.field_inspection_tasks
FOR SELECT
TO authenticated
USING (assigned_agent_id = auth.uid());

-- Allow FIELD_OPS_MANAGER staff to read/moderate the catalog & factory tables used by the portal.
DROP POLICY IF EXISTS "field_ops_staff_read_agent_factories" ON public.agent_factory_registrations;
CREATE POLICY "field_ops_staff_read_agent_factories"
ON public.agent_factory_registrations
FOR SELECT
TO authenticated
USING (public.is_field_ops_staff());

DROP POLICY IF EXISTS "field_ops_staff_update_agent_factories" ON public.agent_factory_registrations;
CREATE POLICY "field_ops_staff_update_agent_factories"
ON public.agent_factory_registrations
FOR UPDATE
TO authenticated
USING (public.is_field_ops_staff())
WITH CHECK (public.is_field_ops_staff());

DROP POLICY IF EXISTS "field_ops_staff_manage_agent_products" ON public.agent_products;
CREATE POLICY "field_ops_staff_manage_agent_products"
ON public.agent_products
FOR ALL
TO authenticated
USING (public.is_field_ops_staff())
WITH CHECK (public.is_field_ops_staff());

DROP POLICY IF EXISTS "field_ops_staff_manage_manufacturer_products" ON public.manufacturer_products;
CREATE POLICY "field_ops_staff_manage_manufacturer_products"
ON public.manufacturer_products
FOR ALL
TO authenticated
USING (public.is_field_ops_staff())
WITH CHECK (public.is_field_ops_staff());
