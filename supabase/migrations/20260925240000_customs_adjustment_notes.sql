-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Customs Adjustment Notes & Non-Binding Customs Disclaimer Fields
-- Adds customs_adjustment_notes table and extends order_invoices with
-- adjustment note fields and is_binding flag.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add customs adjustment columns to order_invoices (if not already present)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'order_invoices'
      AND column_name = 'customs_adjustment_note'
  ) THEN
    ALTER TABLE public.order_invoices
      ADD COLUMN customs_adjustment_note TEXT,
      ADD COLUMN customs_adjustment_amount NUMERIC(14,2),
      ADD COLUMN customs_adjustment_type TEXT CHECK (customs_adjustment_type IN ('surcharge', 'refund')),
      ADD COLUMN customs_is_binding BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;
END $$;

-- 2. Add is_binding and safety_buffer_pct to customs_duty_calculations (if not present)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'customs_duty_calculations'
      AND column_name = 'is_binding'
  ) THEN
    ALTER TABLE public.customs_duty_calculations
      ADD COLUMN is_binding BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN safety_buffer_pct NUMERIC(5,2) NOT NULL DEFAULT 5.00;
  END IF;
END $$;

-- 3. Create customs_adjustment_notes table
CREATE TABLE IF NOT EXISTS public.customs_adjustment_notes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id        UUID REFERENCES public.order_invoices(id) ON DELETE CASCADE,
  invoice_number    TEXT NOT NULL,
  adjustment_type   TEXT NOT NULL CHECK (adjustment_type IN ('surcharge', 'refund')),
  adjustment_amount NUMERIC(14,2) NOT NULL CHECK (adjustment_amount > 0),
  currency          TEXT NOT NULL DEFAULT 'USD',
  note              TEXT NOT NULL,
  is_binding        BOOLEAN NOT NULL DEFAULT FALSE,
  approved_by       UUID REFERENCES auth.users(id),
  approved_at       TIMESTAMPTZ,
  created_by        UUID REFERENCES auth.users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. RLS for customs_adjustment_notes
ALTER TABLE public.customs_adjustment_notes ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
DROP POLICY IF EXISTS "admins_all_customs_adj" ON public.customs_adjustment_notes;
CREATE POLICY "admins_all_customs_adj"
  ON public.customs_adjustment_notes
  FOR ALL
  TO authenticated
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

-- Invoice owner can insert and read their own adjustment notes
DROP POLICY IF EXISTS "invoice_owner_customs_adj_insert" ON public.customs_adjustment_notes;
CREATE POLICY "invoice_owner_customs_adj_insert"
  ON public.customs_adjustment_notes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.order_invoices oi
      WHERE oi.id = invoice_id
        AND oi.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "invoice_owner_customs_adj_select" ON public.customs_adjustment_notes;
CREATE POLICY "invoice_owner_customs_adj_select"
  ON public.customs_adjustment_notes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.order_invoices oi
      WHERE oi.id = invoice_id
        AND (
          oi.created_by = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.orders o
            WHERE o.id = oi.order_id AND o.user_id = auth.uid()
          )
        )
    )
  );

-- 5. Enable realtime for customs_adjustment_notes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND tablename = 'customs_adjustment_notes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.customs_adjustment_notes;
  END IF;
END $$;
