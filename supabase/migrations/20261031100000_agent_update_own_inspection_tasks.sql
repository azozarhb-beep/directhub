-- Allow field agents to start and sign off their own assigned inspection tasks.
-- Agents can only update rows assigned to them and cannot reassign the task.

DROP POLICY IF EXISTS "agents_update_assigned_inspection_tasks" ON public.field_inspection_tasks;
CREATE POLICY "agents_update_assigned_inspection_tasks"
ON public.field_inspection_tasks
FOR UPDATE
TO authenticated
USING (assigned_agent_id = auth.uid())
WITH CHECK (assigned_agent_id = auth.uid());

-- Agents need to read order basics + factory info for assigned tasks.
DROP POLICY IF EXISTS "agents_read_assigned_task_orders" ON public.orders;
CREATE POLICY "agents_read_assigned_task_orders"
ON public.orders
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.field_inspection_tasks t
        WHERE t.order_id = orders.id
        AND t.assigned_agent_id = auth.uid()
    )
);
