-- ============================================================
-- DirectHub: Social Auth Role Selection, Phased Escrow,
--            IBAN Verification, AI/OCR Modules
-- Timestamp: 20260822200000
-- ============================================================

-- ─── 1. Role Selection After Social Login ────────────────────────────────────
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS role_selected BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS auth_provider TEXT DEFAULT 'email',
  ADD COLUMN IF NOT EXISTS logistics_partner_id UUID REFERENCES public.logistics_partners(id) ON DELETE SET NULL;

-- ─── 2. Phased Escrow Engine ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.escrow_phases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  phase_name TEXT NOT NULL,
  phase_type TEXT NOT NULL CHECK (phase_type IN ('deposit','advance_factory','shipping','customs','local_delivery','final_release')),
  percentage NUMERIC(5,2) NOT NULL DEFAULT 0,
  amount_usd NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','released','held','cancelled')),
  recipient_type TEXT CHECK (recipient_type IN ('factory','logistics_partner','platform','buyer')),
  recipient_id UUID,
  release_condition TEXT,
  released_at TIMESTAMPTZ,
  released_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  admin_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_escrow_phases_order_id ON public.escrow_phases(order_id);
CREATE INDEX IF NOT EXISTS idx_escrow_phases_status ON public.escrow_phases(status);

ALTER TABLE public.escrow_phases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_manage_escrow_phases" ON public.escrow_phases;
CREATE POLICY "admin_manage_escrow_phases" ON public.escrow_phases
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM auth.users au WHERE au.id = auth.uid() AND (au.raw_user_meta_data->>'role' = 'admin' OR au.raw_app_meta_data->>'role' = 'admin'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM auth.users au WHERE au.id = auth.uid() AND (au.raw_user_meta_data->>'role' = 'admin' OR au.raw_app_meta_data->>'role' = 'admin'))
  );

DROP POLICY IF EXISTS "users_view_own_escrow_phases" ON public.escrow_phases;
CREATE POLICY "users_view_own_escrow_phases" ON public.escrow_phases
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id AND (o.user_id = auth.uid() OR o.factory_user_id = auth.uid())
    )
  );

-- ─── 3. IBAN Verification Module ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.iban_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_account_id UUID REFERENCES public.factory_bank_accounts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  iban TEXT NOT NULL,
  iban_country TEXT,
  iban_bank_code TEXT,
  iban_check_digits TEXT,
  math_validation_passed BOOLEAN DEFAULT FALSE,
  format_validation_passed BOOLEAN DEFAULT FALSE,
  ai_name_match_score NUMERIC(5,2),
  ai_name_match_passed BOOLEAN DEFAULT FALSE,
  ai_name_match_details TEXT,
  bank_cert_url TEXT,
  bank_cert_filename TEXT,
  bank_cert_uploaded_at TIMESTAMPTZ,
  bank_cert_ai_verified BOOLEAN DEFAULT FALSE,
  bank_cert_ai_notes TEXT,
  overall_status TEXT NOT NULL DEFAULT 'pending' CHECK (overall_status IN ('pending','math_failed','name_mismatch','cert_required','cert_pending_review','verified','rejected')),
  admin_reviewed_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  admin_reviewed_at TIMESTAMPTZ,
  admin_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_iban_verifications_user_id ON public.iban_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_iban_verifications_status ON public.iban_verifications(overall_status);

ALTER TABLE public.iban_verifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_manage_own_iban_verifications" ON public.iban_verifications;
CREATE POLICY "users_manage_own_iban_verifications" ON public.iban_verifications
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "admin_manage_iban_verifications" ON public.iban_verifications;
CREATE POLICY "admin_manage_iban_verifications" ON public.iban_verifications
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM auth.users au WHERE au.id = auth.uid() AND (au.raw_user_meta_data->>'role' = 'admin' OR au.raw_app_meta_data->>'role' = 'admin'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM auth.users au WHERE au.id = auth.uid() AND (au.raw_user_meta_data->>'role' = 'admin' OR au.raw_app_meta_data->>'role' = 'admin'))
  );

-- ─── 4. OCR License Verification ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ocr_license_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_registration_id UUID REFERENCES public.factory_registrations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  document_url TEXT NOT NULL,
  document_type TEXT NOT NULL CHECK (document_type IN ('trade_license','tax_certificate','manufacturing_license','cr_document','other')),
  ocr_raw_text TEXT,
  ocr_extracted_data JSONB,
  ai_summary TEXT,
  ai_confidence_score NUMERIC(5,2),
  ai_flags JSONB,
  pre_approved_card JSONB,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','pre_approved','approved','rejected','needs_review')),
  admin_approved_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  admin_approved_at TIMESTAMPTZ,
  admin_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ocr_license_user_id ON public.ocr_license_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_ocr_license_status ON public.ocr_license_verifications(status);

ALTER TABLE public.ocr_license_verifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_manage_own_ocr_license" ON public.ocr_license_verifications;
CREATE POLICY "users_manage_own_ocr_license" ON public.ocr_license_verifications
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "admin_manage_ocr_license" ON public.ocr_license_verifications;
CREATE POLICY "admin_manage_ocr_license" ON public.ocr_license_verifications
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM auth.users au WHERE au.id = auth.uid() AND (au.raw_user_meta_data->>'role' = 'admin' OR au.raw_app_meta_data->>'role' = 'admin'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM auth.users au WHERE au.id = auth.uid() AND (au.raw_user_meta_data->>'role' = 'admin' OR au.raw_app_meta_data->>'role' = 'admin'))
  );

-- ─── 5. RFQ Copilot Sessions ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rfq_copilot_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  rfq_id UUID REFERENCES public.rfq_requests(id) ON DELETE SET NULL,
  messages JSONB NOT NULL DEFAULT '[]',
  draft_rfq JSONB,
  matched_suppliers JSONB,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','abandoned')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rfq_copilot_user_id ON public.rfq_copilot_sessions(user_id);

ALTER TABLE public.rfq_copilot_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_manage_own_rfq_copilot" ON public.rfq_copilot_sessions;
CREATE POLICY "users_manage_own_rfq_copilot" ON public.rfq_copilot_sessions
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ─── 6. Customs Document Validator ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.customs_validations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('customs_declaration','bill_of_lading','commercial_invoice','packing_list','certificate_of_origin','other')),
  document_url TEXT NOT NULL,
  document_filename TEXT,
  qr_code_detected BOOLEAN DEFAULT FALSE,
  qr_code_data TEXT,
  format_check_passed BOOLEAN DEFAULT FALSE,
  order_match_passed BOOLEAN DEFAULT FALSE,
  ai_validation_notes TEXT,
  ai_confidence_score NUMERIC(5,2),
  discrepancies JSONB,
  overall_status TEXT NOT NULL DEFAULT 'pending' CHECK (overall_status IN ('pending','processing','passed','failed','needs_review')),
  funds_release_blocked BOOLEAN DEFAULT TRUE,
  admin_override_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  admin_override_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customs_validations_order_id ON public.customs_validations(order_id);
CREATE INDEX IF NOT EXISTS idx_customs_validations_status ON public.customs_validations(overall_status);

ALTER TABLE public.customs_validations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_manage_own_customs_validations" ON public.customs_validations;
CREATE POLICY "users_manage_own_customs_validations" ON public.customs_validations
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "admin_manage_customs_validations" ON public.customs_validations;
CREATE POLICY "admin_manage_customs_validations" ON public.customs_validations
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM auth.users au WHERE au.id = auth.uid() AND (au.raw_user_meta_data->>'role' = 'admin' OR au.raw_app_meta_data->>'role' = 'admin'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM auth.users au WHERE au.id = auth.uid() AND (au.raw_user_meta_data->>'role' = 'admin' OR au.raw_app_meta_data->>'role' = 'admin'))
  );

-- ─── 7. Update factory_bank_accounts with IBAN verified flag ─────────────────
ALTER TABLE public.factory_bank_accounts
  ADD COLUMN IF NOT EXISTS iban_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS iban_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_blocked BOOLEAN DEFAULT TRUE;
