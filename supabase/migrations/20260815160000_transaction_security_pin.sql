-- ============================================================
-- Transaction Security PIN System — DirectHub
-- 9-digit PIN for all financial operations + brute-force protection
-- ============================================================

-- 1. Add transaction_security_pin to user_profiles
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS transaction_pin_hash TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS transaction_pin_set_at TIMESTAMPTZ DEFAULT NULL;

-- 2. PIN attempt tracking table
CREATE TABLE IF NOT EXISTS public.pin_attempt_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  attempt_type TEXT NOT NULL DEFAULT 'escrow_release',
  is_success BOOLEAN NOT NULL DEFAULT false,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. PIN lockout table
CREATE TABLE IF NOT EXISTS public.pin_lockouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  locked_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  unlock_at TIMESTAMPTZ NOT NULL,
  failed_attempts INTEGER NOT NULL DEFAULT 3,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notified_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_pin_attempt_logs_user_id ON public.pin_attempt_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_pin_attempt_logs_created_at ON public.pin_attempt_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_pin_lockouts_user_id ON public.pin_lockouts(user_id);
CREATE INDEX IF NOT EXISTS idx_pin_lockouts_is_active ON public.pin_lockouts(is_active);
CREATE INDEX IF NOT EXISTS idx_pin_lockouts_unlock_at ON public.pin_lockouts(unlock_at);

-- 5. Enable RLS
ALTER TABLE public.pin_attempt_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pin_lockouts ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies — pin_attempt_logs
DROP POLICY IF EXISTS "users_view_own_pin_attempts" ON public.pin_attempt_logs;
CREATE POLICY "users_view_own_pin_attempts"
  ON public.pin_attempt_logs FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "users_insert_own_pin_attempts" ON public.pin_attempt_logs;
CREATE POLICY "users_insert_own_pin_attempts"
  ON public.pin_attempt_logs FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 7. RLS Policies — pin_lockouts
DROP POLICY IF EXISTS "users_view_own_pin_lockouts" ON public.pin_lockouts;
CREATE POLICY "users_view_own_pin_lockouts"
  ON public.pin_lockouts FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "users_insert_own_pin_lockouts" ON public.pin_lockouts;
CREATE POLICY "users_insert_own_pin_lockouts"
  ON public.pin_lockouts FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "users_update_own_pin_lockouts" ON public.pin_lockouts;
CREATE POLICY "users_update_own_pin_lockouts"
  ON public.pin_lockouts FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
