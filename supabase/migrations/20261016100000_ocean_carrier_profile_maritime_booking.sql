-- ============================================================
-- Migration: International Ocean Carrier Profile + Maritime Booking
-- 1. Extends logistics_partners with ocean carrier identity,
--    capabilities, equipment, ports/trade lanes and commercial terms
-- 2. Multi-currency bidding (USD, EUR, CNY, SAR, AED, YER)
-- 3. Maritime booking columns on logistics_shipments and orders
-- 4. MBL / Delivery Order document types + escrow release trigger
-- ============================================================

-- 1. logistics_partners: ocean carrier profile columns
ALTER TABLE public.logistics_partners
  ADD COLUMN IF NOT EXISTS legal_company_name TEXT,
  ADD COLUMN IF NOT EXISTS country_code TEXT,
  ADD COLUMN IF NOT EXISTS imo_company_number TEXT,
  ADD COLUMN IF NOT EXISTS scac_code TEXT,
  ADD COLUMN IF NOT EXISTS carrier_type TEXT,
  ADD COLUMN IF NOT EXISTS cargo_capabilities TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS container_equipment TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS calling_ports JSONB NOT NULL DEFAULT '[]'::JSONB,
  ADD COLUMN IF NOT EXISTS trade_lanes JSONB NOT NULL DEFAULT '[]'::JSONB,
  ADD COLUMN IF NOT EXISTS rate_structure TEXT,
  ADD COLUMN IF NOT EXISTS thc_surcharge NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS bunker_surcharge NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS other_surcharges NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS accepted_currencies TEXT[] NOT NULL DEFAULT ARRAY['USD']::TEXT[];

ALTER TABLE public.logistics_partners
  DROP CONSTRAINT IF EXISTS logistics_partners_carrier_type_check;
ALTER TABLE public.logistics_partners
  ADD CONSTRAINT logistics_partners_carrier_type_check
  CHECK (
    carrier_type IS NULL OR carrier_type IN (
      'shipping_line_vessel_operator',
      'freight_forwarder_nvocc',
      'charterer_breakbulk_carrier'
    )
  );

ALTER TABLE public.logistics_partners
  DROP CONSTRAINT IF EXISTS logistics_partners_rate_structure_check;
ALTER TABLE public.logistics_partners
  ADD CONSTRAINT logistics_partners_rate_structure_check
  CHECK (rate_structure IS NULL OR rate_structure IN ('all_in', 'base_ocean_freight'));

ALTER TABLE public.logistics_partners
  DROP CONSTRAINT IF EXISTS logistics_partners_imo_company_number_check;
ALTER TABLE public.logistics_partners
  ADD CONSTRAINT logistics_partners_imo_company_number_check
  CHECK (imo_company_number IS NULL OR imo_company_number ~ '^[0-9]{7}$');

ALTER TABLE public.logistics_partners
  DROP CONSTRAINT IF EXISTS logistics_partners_scac_code_check;
ALTER TABLE public.logistics_partners
  ADD CONSTRAINT logistics_partners_scac_code_check
  CHECK (scac_code IS NULL OR scac_code ~ '^[A-Z]{2,4}$');

ALTER TABLE public.logistics_partners
  DROP CONSTRAINT IF EXISTS logistics_partners_country_code_check;
ALTER TABLE public.logistics_partners
  ADD CONSTRAINT logistics_partners_country_code_check
  CHECK (country_code IS NULL OR country_code ~ '^[A-Z]{2}$');

CREATE INDEX IF NOT EXISTS idx_logistics_partners_carrier_type
  ON public.logistics_partners (carrier_type)
  WHERE carrier_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_logistics_partners_scac_code
  ON public.logistics_partners (scac_code)
  WHERE scac_code IS NOT NULL;

-- 2. Multi-currency bidding
ALTER TABLE public.logistics_bids
  DROP CONSTRAINT IF EXISTS logistics_bids_currency_check;
ALTER TABLE public.logistics_bids
  ADD CONSTRAINT logistics_bids_currency_check
  CHECK (currency IN ('USD', 'EUR', 'CNY', 'SAR', 'AED', 'YER'));

ALTER TABLE public.logistics_bids
  ADD COLUMN IF NOT EXISTS rate_structure TEXT,
  ADD COLUMN IF NOT EXISTS thc_amount NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS bunker_amount NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS other_surcharge_amount NUMERIC(14, 2);

ALTER TABLE public.logistics_bids
  DROP CONSTRAINT IF EXISTS logistics_bids_rate_structure_check;
ALTER TABLE public.logistics_bids
  ADD CONSTRAINT logistics_bids_rate_structure_check
  CHECK (rate_structure IS NULL OR rate_structure IN ('all_in', 'base_ocean_freight'));

-- 3. Maritime booking details on shipments and orders
ALTER TABLE public.logistics_shipments
  ADD COLUMN IF NOT EXISTS vessel_name TEXT,
  ADD COLUMN IF NOT EXISTS vessel_imo_number TEXT,
  ADD COLUMN IF NOT EXISTS voyage_number TEXT,
  ADD COLUMN IF NOT EXISTS booking_reference TEXT,
  ADD COLUMN IF NOT EXISTS container_numbers TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS shipping_mode TEXT,
  ADD COLUMN IF NOT EXISTS vessel_name TEXT,
  ADD COLUMN IF NOT EXISTS vessel_imo_number TEXT,
  ADD COLUMN IF NOT EXISTS voyage_number TEXT,
  ADD COLUMN IF NOT EXISTS booking_reference TEXT,
  ADD COLUMN IF NOT EXISTS container_numbers TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS maritime_booked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS mbl_released_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_orders_booking_reference
  ON public.orders (booking_reference)
  WHERE booking_reference IS NOT NULL;

-- 4. Logistics documents: add MBL and Delivery Order types
ALTER TABLE public.logistics_documents
  DROP CONSTRAINT IF EXISTS logistics_documents_document_type_check;
ALTER TABLE public.logistics_documents
  ADD CONSTRAINT logistics_documents_document_type_check
  CHECK (document_type IN (
    'bill_of_lading',
    'commercial_invoice',
    'packing_list',
    'certificate_of_origin',
    'customs_declaration',
    'inspection_cert',
    'master_bill_of_lading',
    'delivery_order'
  ));

ALTER TABLE public.logistics_documents
  ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_logistics_documents_order_id
  ON public.logistics_documents (order_id)
  WHERE order_id IS NOT NULL;

-- 5. Escrow release when stamped MBL / D.O. is uploaded for an ocean order
CREATE OR REPLACE FUNCTION public.release_escrow_on_ocean_document()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF NEW.order_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.document_type NOT IN ('master_bill_of_lading', 'delivery_order') THEN
    RETURN NEW;
  END IF;

  SELECT id, order_number, escrow_status, total, user_id, factory_user_id, shipping_mode
    INTO v_order
    FROM public.orders
   WHERE id = NEW.order_id
   LIMIT 1;

  IF v_order.id IS NULL THEN
    RETURN NEW;
  END IF;

  IF COALESCE(v_order.shipping_mode, '') <> 'ocean' THEN
    RETURN NEW;
  END IF;

  IF COALESCE(v_order.escrow_status, '') NOT IN
     ('funds_secured', 'pending_admin_payout', 'shipped', 'ready_for_inspection') THEN
    RETURN NEW;
  END IF;

  UPDATE public.orders
     SET escrow_status = 'funds_released',
         status = 'delivered',
         funds_released_at = v_now,
         escrow_green_light_at = v_now,
         mbl_released_at = v_now,
         admin_release_note = 'Escrow released automatically: stamped Master Bill of Lading / Delivery Order uploaded.',
         payout_note = 'Escrow released automatically: stamped Master Bill of Lading / Delivery Order uploaded.',
         updated_at = v_now
   WHERE id = v_order.id;

  INSERT INTO public.escrow_ledger (order_id, user_id, event_type, amount, currency, note, performed_by)
  VALUES (
    v_order.id,
    v_order.user_id,
    'funds_released',
    COALESCE(v_order.total, 0),
    'USD',
    'Ocean freight: escrow released on stamped MBL / Delivery Order upload.',
    NEW.partner_id
  );

  INSERT INTO public.order_status_history (order_id, status, note)
  VALUES (
    v_order.id,
    'delivered',
    'Ocean freight: stamped MBL / Delivery Order uploaded at destination port. Escrow released.'
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'release_escrow_on_ocean_document failed: %', SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_release_escrow_on_ocean_document ON public.logistics_documents;
CREATE TRIGGER trg_release_escrow_on_ocean_document
  AFTER INSERT ON public.logistics_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.release_escrow_on_ocean_document();
