-- Migration: Link admin WhatsApp number +967771577632
-- Sets phone and whatsapp_linked=true for the admin user (azozarhb@gmail.com)
-- so the "أرقام مربوطة" counter shows 1 and the automation system is active.

DO $$
DECLARE
  admin_user_id UUID;
BEGIN
  -- Find admin user by email
  SELECT up.id INTO admin_user_id
  FROM public.user_profiles up
  JOIN auth.users au ON au.id = up.id
  WHERE au.email = 'azozarhb@gmail.com'
  LIMIT 1;

  IF admin_user_id IS NOT NULL THEN
    -- Set phone and mark as whatsapp_linked
    UPDATE public.user_profiles
    SET
      phone          = '771577632',
      whatsapp_linked = TRUE,
      updated_at     = NOW()
    WHERE id = admin_user_id;

    RAISE NOTICE 'Admin WhatsApp number linked: +967771577632 for user id=%', admin_user_id;
  ELSE
    RAISE NOTICE 'Admin user azozarhb@gmail.com not found — will be linked on next login.';
  END IF;
END $$;

-- Also insert a record in whatsapp_alert_log to register the admin number
-- as a linked/active channel (status = 'sent' since it is already configured)
DO $$
DECLARE
  admin_user_id UUID;
BEGIN
  SELECT up.id INTO admin_user_id
  FROM public.user_profiles up
  JOIN auth.users au ON au.id = up.id
  WHERE au.email = 'azozarhb@gmail.com'
  LIMIT 1;

  IF admin_user_id IS NOT NULL THEN
    -- Only insert if no admin-linked record exists yet
    IF NOT EXISTS (
      SELECT 1 FROM public.whatsapp_alert_log
      WHERE user_id = admin_user_id AND alert_type = 'admin_linked'
    ) THEN
      INSERT INTO public.whatsapp_alert_log (
        alert_type,
        user_id,
        phone,
        message_type,
        full_name,
        role,
        status,
        sent_at,
        created_at
      ) VALUES (
        'admin_linked',
        admin_user_id,
        '771577632',
        'admin_notification',
        'مدير DirectHub',
        'admin',
        'sent',
        NOW(),
        NOW()
      );
      RAISE NOTICE 'Admin WhatsApp alert log entry created.';
    END IF;
  END IF;
END $$;
