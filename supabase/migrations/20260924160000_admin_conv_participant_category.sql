-- ─────────────────────────────────────────────────────────────────────────────
-- Add participant_category to admin_conversations
-- Allows distinguishing international_factory vs local_factory vs local_supplier
-- within the same participant_role = 'manufacturer' or 'supplier'
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.admin_conversations
ADD COLUMN IF NOT EXISTS participant_category TEXT;

-- Index for fast filtering by category
CREATE INDEX IF NOT EXISTS idx_admin_convs_participant_category
ON public.admin_conversations(participant_category);

-- Backfill existing manufacturer conversations using factory_registrations seller_category
UPDATE public.admin_conversations ac
SET participant_category = fr.seller_category
FROM public.factory_registrations fr
WHERE ac.participant_id = fr.user_id
  AND ac.participant_role = 'manufacturer'
  AND ac.participant_category IS NULL
  AND fr.seller_category IS NOT NULL;
