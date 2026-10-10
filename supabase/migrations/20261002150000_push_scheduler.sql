-- Push Notification Scheduler
-- Stores the 3 daily scheduled push notification jobs and their auto-content config

CREATE TABLE IF NOT EXISTS public.push_scheduler_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL,
  scheduled_time TEXT NOT NULL, -- e.g. "09:00", "13:00", "18:00"
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_run_at TIMESTAMPTZ,
  last_run_status TEXT, -- 'success' | 'failed' | 'no_content' | 'no_subscribers'
  last_sent_count INTEGER DEFAULT 0,
  last_product_id TEXT,
  last_product_title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_scheduler_jobs_time ON public.push_scheduler_jobs(scheduled_time);
CREATE INDEX IF NOT EXISTS idx_push_scheduler_jobs_active ON public.push_scheduler_jobs(is_active);

-- Execution log for audit trail
CREATE TABLE IF NOT EXISTS public.push_scheduler_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES public.push_scheduler_jobs(id) ON DELETE CASCADE,
  scheduled_time TEXT NOT NULL,
  product_id TEXT,
  product_title TEXT,
  product_image TEXT,
  destination_url TEXT,
  sent_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending', -- 'success' | 'failed' | 'no_content' | 'no_subscribers'
  error_message TEXT,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_scheduler_log_job_id ON public.push_scheduler_log(job_id);
CREATE INDEX IF NOT EXISTS idx_push_scheduler_log_executed_at ON public.push_scheduler_log(executed_at DESC);

-- Enable RLS
ALTER TABLE public.push_scheduler_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_scheduler_log ENABLE ROW LEVEL SECURITY;

-- Only admins can manage scheduler jobs
DROP POLICY IF EXISTS "admins_manage_push_scheduler_jobs" ON public.push_scheduler_jobs;
CREATE POLICY "admins_manage_push_scheduler_jobs"
  ON public.push_scheduler_jobs FOR ALL
  TO authenticated
  USING (
    auth.uid() IN (SELECT id FROM public.user_profiles WHERE role = 'admin')
  )
  WITH CHECK (
    auth.uid() IN (SELECT id FROM public.user_profiles WHERE role = 'admin')
  );

-- Service role can read jobs (for cron execution)
DROP POLICY IF EXISTS "service_read_push_scheduler_jobs" ON public.push_scheduler_jobs;
CREATE POLICY "service_read_push_scheduler_jobs"
  ON public.push_scheduler_jobs FOR SELECT
  TO service_role
  USING (true);

DROP POLICY IF EXISTS "service_update_push_scheduler_jobs" ON public.push_scheduler_jobs;
CREATE POLICY "service_update_push_scheduler_jobs"
  ON public.push_scheduler_jobs FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Admins can read log
DROP POLICY IF EXISTS "admins_read_push_scheduler_log" ON public.push_scheduler_log;
CREATE POLICY "admins_read_push_scheduler_log"
  ON public.push_scheduler_log FOR SELECT
  TO authenticated
  USING (
    auth.uid() IN (SELECT id FROM public.user_profiles WHERE role = 'admin')
  );

-- Service role can insert log entries
DROP POLICY IF EXISTS "service_insert_push_scheduler_log" ON public.push_scheduler_log;
CREATE POLICY "service_insert_push_scheduler_log"
  ON public.push_scheduler_log FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Seed the 3 default daily jobs
INSERT INTO public.push_scheduler_jobs (job_name, scheduled_time, is_active)
VALUES
  ('الإشعار الصباحي', '09:00', true),
  ('إشعار الظهيرة', '13:00', true),
  ('الإشعار المسائي', '18:00', true)
ON CONFLICT DO NOTHING;
