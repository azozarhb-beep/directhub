-- Factory Trust Score & Percentage-Based Verification System
-- Adds trust_percentage and verified_tier to factory_registrations
-- Adds trust_percentage to ocr_license_verifications

-- ─── Add trust_percentage to factory_registrations ───────────────────────────
ALTER TABLE public.factory_registrations
  ADD COLUMN IF NOT EXISTS trust_percentage INTEGER DEFAULT 0
    CHECK (trust_percentage >= 0 AND trust_percentage <= 100),
  ADD COLUMN IF NOT EXISTS verified_tier TEXT DEFAULT 'unverified'
    CHECK (verified_tier IN ('unverified', 'partial', 'verified')),
  ADD COLUMN IF NOT EXISTS trust_score_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS missing_documents JSONB DEFAULT '[]'::jsonb;

-- ─── Add trust_percentage to ocr_license_verifications ───────────────────────
ALTER TABLE public.ocr_license_verifications
  ADD COLUMN IF NOT EXISTS trust_percentage INTEGER DEFAULT 0
    CHECK (trust_percentage >= 0 AND trust_percentage <= 100);

-- ─── Index for fast trust tier lookups ───────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_factory_reg_trust_percentage
  ON public.factory_registrations(trust_percentage);

CREATE INDEX IF NOT EXISTS idx_factory_reg_verified_tier
  ON public.factory_registrations(verified_tier);

-- ─── Function: Calculate factory trust percentage ─────────────────────────────
-- Documents that contribute to trust score:
--   1. trade_license_url       → 34% (Commercial Register / Trade License)
--   2. manufacturing_license_url → 33% (Industrial / Manufacturing License)
--   3. tax_id (non-empty)      → 33% (Tax ID)
-- Total = 100% when all three are present and approved

CREATE OR REPLACE FUNCTION public.calculate_factory_trust_percentage(factory_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_reg RECORD;
  v_score INTEGER := 0;
  v_trade_approved BOOLEAN := false;
  v_mfg_approved BOOLEAN := false;
  v_tax_present BOOLEAN := false;
BEGIN
  -- Fetch factory registration
  SELECT * INTO v_reg
  FROM public.factory_registrations
  WHERE user_id = factory_user_id
  LIMIT 1;

  IF v_reg IS NULL THEN
    RETURN 0;
  END IF;

  -- Check trade license: must have URL AND be approved (kyc_status = 'approved' OR registration_status = 'approved')
  IF v_reg.trade_license_url IS NOT NULL AND v_reg.trade_license_url != '' THEN
    -- Check if any OCR verification for this factory is approved for trade_license
    SELECT EXISTS (
      SELECT 1 FROM public.ocr_license_verifications
      WHERE factory_registration_id = v_reg.id
        AND document_type IN ('trade_license', 'cr_document')
        AND status = 'approved'
    ) INTO v_trade_approved;

    -- If no OCR record but factory is approved overall, count it
    IF NOT v_trade_approved AND (v_reg.kyc_status::TEXT = 'approved' OR v_reg.registration_status = 'approved' OR v_reg.is_approved = true) THEN
      v_trade_approved := true;
    END IF;
  END IF;

  -- Check manufacturing license
  IF v_reg.manufacturing_license_url IS NOT NULL AND v_reg.manufacturing_license_url != '' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.ocr_license_verifications
      WHERE factory_registration_id = v_reg.id
        AND document_type IN ('manufacturing_license', 'other')
        AND status = 'approved'
    ) INTO v_mfg_approved;

    IF NOT v_mfg_approved AND (v_reg.kyc_status::TEXT = 'approved' OR v_reg.registration_status = 'approved' OR v_reg.is_approved = true) THEN
      v_mfg_approved := true;
    END IF;
  END IF;

  -- Check tax ID: just needs to be present (non-empty string)
  IF v_reg.tax_id IS NOT NULL AND v_reg.tax_id != '' THEN
    v_tax_present := true;
  END IF;

  -- Calculate score
  IF v_trade_approved THEN v_score := v_score + 34; END IF;
  IF v_mfg_approved THEN v_score := v_score + 33; END IF;
  IF v_tax_present THEN v_score := v_score + 33; END IF;

  -- Cap at 100
  IF v_score > 100 THEN v_score := 100; END IF;

  RETURN v_score;
END;
$func$;

-- ─── Function: Update factory trust score ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_factory_trust_score(factory_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_percentage INTEGER;
  v_tier TEXT;
  v_reg RECORD;
  v_missing JSONB := '[]'::jsonb;
BEGIN
  v_percentage := public.calculate_factory_trust_percentage(factory_user_id);

  -- Determine tier
  IF v_percentage = 100 THEN
    v_tier := 'verified';
  ELSIF v_percentage > 0 THEN
    v_tier := 'partial';
  ELSE
    v_tier := 'unverified';
  END IF;

  -- Build missing documents list
  SELECT * INTO v_reg FROM public.factory_registrations WHERE user_id = factory_user_id LIMIT 1;
  IF v_reg IS NOT NULL THEN
    IF v_reg.trade_license_url IS NULL OR v_reg.trade_license_url = '' THEN
      v_missing := v_missing || '["trade_license"]'::jsonb;
    END IF;
    IF v_reg.manufacturing_license_url IS NULL OR v_reg.manufacturing_license_url = '' THEN
      v_missing := v_missing || '["manufacturing_license"]'::jsonb;
    END IF;
    IF v_reg.tax_id IS NULL OR v_reg.tax_id = '' THEN
      v_missing := v_missing || '["tax_id"]'::jsonb;
    END IF;
  END IF;

  -- Update factory_registrations
  UPDATE public.factory_registrations
  SET
    trust_percentage = v_percentage,
    verified_tier = v_tier,
    trust_score_updated_at = NOW(),
    missing_documents = v_missing
  WHERE user_id = factory_user_id;
END;
$func$;

-- ─── Trigger: Auto-update trust score when factory_registrations changes ──────
CREATE OR REPLACE FUNCTION public.trigger_update_factory_trust_score()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
BEGIN
  PERFORM public.update_factory_trust_score(NEW.user_id);
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trg_factory_trust_score ON public.factory_registrations;
CREATE TRIGGER trg_factory_trust_score
  AFTER INSERT OR UPDATE OF trade_license_url, manufacturing_license_url, tax_id, kyc_status, registration_status, is_approved
  ON public.factory_registrations
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_update_factory_trust_score();

-- ─── Trigger: Auto-update trust score when OCR verification is approved ───────
CREATE OR REPLACE FUNCTION public.trigger_ocr_update_factory_trust_score()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_user_id UUID;
BEGIN
  -- Get user_id from factory_registrations via factory_registration_id
  IF NEW.factory_registration_id IS NOT NULL THEN
    SELECT user_id INTO v_user_id
    FROM public.factory_registrations
    WHERE id = NEW.factory_registration_id
    LIMIT 1;

    IF v_user_id IS NOT NULL THEN
      PERFORM public.update_factory_trust_score(v_user_id);
    END IF;
  ELSIF NEW.user_id IS NOT NULL THEN
    PERFORM public.update_factory_trust_score(NEW.user_id);
  END IF;
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trg_ocr_factory_trust_score ON public.ocr_license_verifications;
CREATE TRIGGER trg_ocr_factory_trust_score
  AFTER INSERT OR UPDATE OF status
  ON public.ocr_license_verifications
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_ocr_update_factory_trust_score();

-- ─── Backfill existing factory registrations ─────────────────────────────────
DO $$
DECLARE
  v_factory RECORD;
BEGIN
  FOR v_factory IN
    SELECT user_id FROM public.factory_registrations
  LOOP
    BEGIN
      PERFORM public.update_factory_trust_score(v_factory.user_id);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Failed to update trust score for user %: %', v_factory.user_id, SQLERRM;
    END;
  END LOOP;
END $$;
