-- ─── Visitor Traffic Analytics ───────────────────────────────────────────────
-- Tracks daily page views and unique visitors (including anonymous users)

CREATE TABLE IF NOT EXISTS public.page_views (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id    text NOT NULL,                -- anonymous session fingerprint
  user_id       uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  page_path     text NOT NULL DEFAULT '/',
  referrer      text,
  user_agent    text,
  country       text,
  viewed_at     timestamptz NOT NULL DEFAULT now()
);

-- Index for fast daily aggregation queries
CREATE INDEX IF NOT EXISTS idx_page_views_viewed_at ON public.page_views (viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_page_views_session   ON public.page_views (session_id);
CREATE INDEX IF NOT EXISTS idx_page_views_user_id   ON public.page_views (user_id);

-- RLS: only admins can read; anyone (including anon) can insert
ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'page_views' AND policyname = 'admin_read_page_views'
  ) THEN
    CREATE POLICY admin_read_page_views ON public.page_views
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.user_profiles
          WHERE id = auth.uid() AND role = 'admin'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'page_views' AND policyname = 'anyone_insert_page_views'
  ) THEN
    CREATE POLICY anyone_insert_page_views ON public.page_views
      FOR INSERT
      WITH CHECK (true);
  END IF;
END $$;
