-- Migration: broadcast_logs and executive_alerts tables
-- Timestamp: 20261003161459

-- ── broadcast_logs table (Fix 3) ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.broadcast_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT,
  target_roles TEXT[] DEFAULT ARRAY[]::TEXT[],
  sent_count INTEGER DEFAULT 0,
  channel TEXT DEFAULT 'in_app',
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_broadcast_logs_created_at ON public.broadcast_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_broadcast_logs_created_by ON public.broadcast_logs(created_by);

ALTER TABLE public.broadcast_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_manage_broadcast_logs" ON public.broadcast_logs;
CREATE POLICY "admins_manage_broadcast_logs"
ON public.broadcast_logs
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid() AND up.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid() AND up.role = 'admin'
  )
);

-- ── executive_alerts table (Fix 5) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.executive_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_key TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  severity TEXT DEFAULT 'info',
  is_acknowledged BOOLEAN DEFAULT FALSE,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_executive_alerts_alert_key ON public.executive_alerts(alert_key);
CREATE INDEX IF NOT EXISTS idx_executive_alerts_severity ON public.executive_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_executive_alerts_is_acknowledged ON public.executive_alerts(is_acknowledged);
CREATE INDEX IF NOT EXISTS idx_executive_alerts_generated_at ON public.executive_alerts(generated_at DESC);

ALTER TABLE public.executive_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_manage_executive_alerts" ON public.executive_alerts;
CREATE POLICY "admins_manage_executive_alerts"
ON public.executive_alerts
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid() AND up.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid() AND up.role = 'admin'
  )
);
