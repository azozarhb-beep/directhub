-- Auto-assign field inspection tasks when an order reaches 'funds_secured' (الأموال محجوزة).
-- 1) Facility's linked agent (resolve_order_agent / facility.agent_id)
-- 2) Fallback: an active, verified field agent in the same city/governorate (least open tasks)
-- Task is created with status 'assigned' and the agent receives an in-app notification.
-- Manual dispatch from /admin/field-ops and the control-room panel remains available as an override.

CREATE OR REPLACE FUNCTION public.auto_assign_field_inspection_task()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agent_id UUID;
  v_agent_factory_id UUID;
  v_factory_name TEXT := '';
  v_city TEXT := '';
  v_region TEXT := '';
  v_resolved RECORD;
  v_fr RECORD;
  v_afr RECORD;
  v_task_id UUID;
  v_order_label TEXT;
BEGIN
  IF COALESCE(NEW.escrow_status, '') <> 'funds_secured' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND COALESCE(OLD.escrow_status, '') = 'funds_secured' THEN
    RETURN NEW;
  END IF;

  -- Never create a duplicate task for the same order
  IF EXISTS (SELECT 1 FROM public.field_inspection_tasks t WHERE t.order_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  BEGIN
    -- 1) Facility-linked agent
    SELECT * INTO v_resolved FROM public.resolve_order_agent(NEW.id) LIMIT 1;
    IF v_resolved.agent_id IS NOT NULL THEN
      v_agent_id := v_resolved.agent_id;
      v_agent_factory_id := v_resolved.agent_factory_id;
      v_factory_name := COALESCE(v_resolved.factory_name, '');
    END IF;

    -- Facility location (for display and fallback routing)
    IF v_agent_factory_id IS NOT NULL THEN
      SELECT afr.company_name, afr.city, afr.region INTO v_afr
      FROM public.agent_factory_registrations afr WHERE afr.id = v_agent_factory_id;
      IF FOUND THEN
        v_factory_name := COALESCE(NULLIF(v_afr.company_name, ''), v_factory_name);
        v_city := COALESCE(v_afr.city, '');
        v_region := COALESCE(v_afr.region, '');
      END IF;
    END IF;

    IF v_city = '' AND v_region = '' AND NEW.factory_user_id IS NOT NULL THEN
      SELECT fr.company_name, fr.city, fr.region INTO v_fr
      FROM public.factory_registrations fr WHERE fr.user_id = NEW.factory_user_id LIMIT 1;
      IF FOUND THEN
        v_factory_name := COALESCE(NULLIF(v_factory_name, ''), COALESCE(v_fr.company_name, ''));
        v_city := COALESCE(v_fr.city, '');
        v_region := COALESCE(v_fr.region, '');
      END IF;
    END IF;

    -- 2) Fallback: active verified field agent in same city/governorate (least open tasks first)
    IF v_agent_id IS NULL AND (v_city <> '' OR v_region <> '') THEN
      SELECT up.id INTO v_agent_id
      FROM public.user_profiles up
      WHERE up.role::TEXT = 'field_agent'
        AND up.is_active IS NOT FALSE
        AND up.is_verified = TRUE
        AND COALESCE(up.city, '') <> ''
        AND (
          (v_city <> '' AND (lower(up.city) = lower(v_city) OR lower(up.city) LIKE '%' || lower(v_city) || '%' OR lower(v_city) LIKE '%' || lower(up.city) || '%'))
          OR
          (v_region <> '' AND (lower(up.city) = lower(v_region) OR lower(up.city) LIKE '%' || lower(v_region) || '%' OR lower(v_region) LIKE '%' || lower(up.city) || '%'))
        )
      ORDER BY (
        SELECT COUNT(*) FROM public.field_inspection_tasks t
        WHERE t.assigned_agent_id = up.id AND t.status IN ('assigned', 'dispatched', 'in_progress')
      ) ASC, up.created_at ASC
      LIMIT 1;
    END IF;

    -- Make sure the linked agent is still active; otherwise leave for manual admin dispatch
    IF v_agent_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.user_profiles up WHERE up.id = v_agent_id AND up.is_active IS NOT FALSE
    ) THEN
      v_agent_id := NULL;
    END IF;

    IF v_agent_id IS NULL THEN
      RETURN NEW;
    END IF;

    v_order_label := COALESCE(NULLIF(NEW.order_number, ''), LEFT(NEW.id::TEXT, 8));

    INSERT INTO public.field_inspection_tasks (
      factory_id, factory_name, order_id, assigned_agent_id, created_by, title, notes, status
    ) VALUES (
      v_agent_factory_id,
      COALESCE(v_factory_name, ''),
      NEW.id,
      v_agent_id,
      NULL,
      'تفتيش ميداني - طلب ' || v_order_label,
      'تم الإسناد تلقائياً عند حجز أموال الطلب' ||
        CASE WHEN v_city <> '' THEN ' — ' || v_city ELSE '' END,
      'assigned'
    )
    RETURNING id INTO v_task_id;

    INSERT INTO public.notifications (user_id, type, title, body, link, is_read, metadata)
    VALUES (
      v_agent_id,
      'system',
      'مهمة تفتيش ميداني جديدة',
      'تم إسناد مهمة تفتيش للطلب ' || v_order_label ||
        CASE WHEN COALESCE(v_factory_name, '') <> '' THEN ' — ' || v_factory_name ELSE '' END ||
        CASE WHEN v_city <> '' THEN ' (' || v_city || ')' ELSE '' END,
      '/agent/dashboard',
      FALSE,
      jsonb_build_object(
        'kind', 'field_inspection_assigned',
        'task_id', v_task_id,
        'order_id', NEW.id,
        'order_number', NEW.order_number,
        'auto_assigned', TRUE,
        'channels', jsonb_build_array('in_app', 'whatsapp')
      )
    );
  EXCEPTION WHEN OTHERS THEN
    -- Never block the payment/escrow transition because of auto-assignment issues
    RAISE WARNING 'auto_assign_field_inspection_task failed for order %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_assign_field_inspection_task ON public.orders;
CREATE TRIGGER trg_auto_assign_field_inspection_task
AFTER INSERT OR UPDATE OF escrow_status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.auto_assign_field_inspection_task();
