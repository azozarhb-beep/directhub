-- Trust Score & Manual Review Queue Migration
-- Adds trust_level to OCR and IBAN verifications, creates manual_review_queue table

-- ─── Add trust_level to ocr_license_verifications ────────────────────────────
ALTER TABLE public.ocr_license_verifications
  ADD COLUMN IF NOT EXISTS trust_level TEXT DEFAULT 'unknown'
    CHECK (trust_level IN ('high', 'medium', 'low', 'unknown')),
  ADD COLUMN IF NOT EXISTS review_reason TEXT;

-- ─── Add trust_level to iban_verifications ───────────────────────────────────
ALTER TABLE public.iban_verifications
  ADD COLUMN IF NOT EXISTS trust_level TEXT DEFAULT 'unknown'
    CHECK (trust_level IN ('high', 'medium', 'low', 'unknown')),
  ADD COLUMN IF NOT EXISTS review_reason TEXT;

-- ─── Manual Review Queue ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.manual_review_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type TEXT NOT NULL CHECK (source_type IN ('ocr_verification', 'iban_verification')),
  source_id UUID NOT NULL,
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  company_name TEXT,
  trust_score INTEGER NOT NULL DEFAULT 0,
  trust_level TEXT NOT NULL DEFAULT 'medium' CHECK (trust_level IN ('high', 'medium', 'low')),
  review_reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_note TEXT,
  admin_id UUID REFERENCES public.user_profiles(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_manual_review_queue_status ON public.manual_review_queue(status);
CREATE INDEX IF NOT EXISTS idx_manual_review_queue_source ON public.manual_review_queue(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_manual_review_queue_user ON public.manual_review_queue(user_id);

-- Enable RLS
ALTER TABLE public.manual_review_queue ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'manual_review_queue' AND policyname = 'admins_full_access_manual_review'
  ) THEN
    CREATE POLICY admins_full_access_manual_review ON public.manual_review_queue
      FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.user_profiles
          WHERE id = auth.uid() AND role = 'admin'
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.user_profiles
          WHERE id = auth.uid() AND role = 'admin'
        )
      );
  END IF;
END $$;

-- Enable realtime for manual_review_queue
ALTER PUBLICATION supabase_realtime ADD TABLE public.manual_review_queue;
