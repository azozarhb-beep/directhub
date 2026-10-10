-- Add factory_type column to factory_registrations
-- Values: 'local' (Saudi/local manufacturers) or 'international' (international suppliers)

DO $$
BEGIN
  -- If column already exists as an enum type, convert it to TEXT
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'factory_registrations'
      AND column_name = 'factory_type'
      AND data_type = 'USER-DEFINED'
  ) THEN
    ALTER TABLE public.factory_registrations
      ALTER COLUMN factory_type TYPE TEXT USING factory_type::TEXT;
  END IF;

  -- Add column if it does not exist at all
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'factory_registrations'
      AND column_name = 'factory_type'
  ) THEN
    ALTER TABLE public.factory_registrations
      ADD COLUMN factory_type TEXT DEFAULT 'local';
  END IF;
END $$;

-- Ensure CHECK constraint exists (idempotent via DO block)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.check_constraints cc
      ON tc.constraint_name = cc.constraint_name
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'factory_registrations'
      AND tc.constraint_type = 'CHECK'
      AND cc.check_clause LIKE '%factory_type%'
  ) THEN
    ALTER TABLE public.factory_registrations
      ADD CONSTRAINT factory_registrations_factory_type_check
      CHECK (factory_type IN ('local', 'international'));
  END IF;
END $$;

-- Set default value
ALTER TABLE public.factory_registrations
  ALTER COLUMN factory_type SET DEFAULT 'local';

-- Backfill based on existing seller_category
UPDATE public.factory_registrations
SET factory_type = CASE
  WHEN seller_category = 'international_factory' THEN 'international'
  ELSE 'local'
END
WHERE factory_type IS NULL OR factory_type NOT IN ('local', 'international');

-- Index for fast filtering
CREATE INDEX IF NOT EXISTS idx_factory_registrations_factory_type
  ON public.factory_registrations (factory_type);
