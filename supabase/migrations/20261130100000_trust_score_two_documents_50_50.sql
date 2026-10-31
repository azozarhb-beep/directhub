-- Trust score: two core legal documents only (50% + 50%).
-- Tax ID (tax_id) remains an informational profile field and no longer affects the score.

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
BEGIN
  SELECT * INTO v_reg
  FROM public.factory_registrations
  WHERE user_id = factory_user_id
  LIMIT 1;

  IF v_reg IS NULL THEN
    RETURN 0;
  END IF;

  IF v_reg.trade_license_url IS NOT NULL AND v_reg.trade_license_url != '' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.ocr_license_verifications
      WHERE factory_registration_id = v_reg.id
        AND document_type IN ('trade_license', 'cr_document')
        AND status = 'approved'
    ) INTO v_trade_approved;

    IF NOT v_trade_approved AND (v_reg.kyc_status::TEXT = 'approved' OR v_reg.registration_status = 'approved' OR v_reg.is_approved = true) THEN
      v_trade_approved := true;
    END IF;
  END IF;

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

  IF v_trade_approved THEN v_score := v_score + 50; END IF;
  IF v_mfg_approved THEN v_score := v_score + 50; END IF;

  IF v_score > 100 THEN v_score := 100; END IF;

  RETURN v_score;
END;
$func$;

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

  IF v_percentage = 100 THEN
    v_tier := 'verified';
  ELSIF v_percentage > 0 THEN
    v_tier := 'partial';
  ELSE
    v_tier := 'unverified';
  END IF;

  SELECT * INTO v_reg FROM public.factory_registrations WHERE user_id = factory_user_id LIMIT 1;
  IF v_reg IS NOT NULL THEN
    IF v_reg.trade_license_url IS NULL OR v_reg.trade_license_url = '' THEN
      v_missing := v_missing || '["trade_license"]'::jsonb;
    END IF;
    IF v_reg.manufacturing_license_url IS NULL OR v_reg.manufacturing_license_url = '' THEN
      v_missing := v_missing || '["manufacturing_license"]'::jsonb;
    END IF;
  END IF;

  UPDATE public.factory_registrations
  SET
    trust_percentage = v_percentage,
    verified_tier = v_tier,
    trust_score_updated_at = NOW(),
    missing_documents = v_missing
  WHERE user_id = factory_user_id;
END;
$func$;

-- Recalculate existing factories with the new 50/50 weighting
DO $recalc$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT user_id FROM public.factory_registrations WHERE user_id IS NOT NULL LOOP
    PERFORM public.update_factory_trust_score(r.user_id);
  END LOOP;
END;
$recalc$;
