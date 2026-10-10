'use client';

import React from 'react';

interface InvoiceItem {
  description: string;
  hs_code?: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total: number;
  country_of_origin?: string;
  net_weight_kg?: number;
  gross_weight_kg?: number;
}

interface InvoiceTemplateProps {
  invoice: {
    invoice_number: string;
    invoice_type?: 'standard' | 'commercial_enterprise_cash';
    issue_date: string;
    due_date?: string;
    status?: string;
    // Seller
    seller_name: string;
    seller_address?: string;
    seller_vat?: string;
    seller_cr?: string;
    seller_bank_name?: string;
    seller_bank_iban?: string;
    seller_bank_swift?: string;
    seller_export_license?: string;
    seller_customs_code?: string;
    // Buyer
    buyer_name: string;
    buyer_company?: string;
    buyer_address?: string;
    buyer_country?: string;
    buyer_vat?: string;
    buyer_import_license?: string;
    buyer_customs_code?: string;
    // Items & financials
    items: InvoiceItem[];
    currency: string;
    subtotal: number;
    discount_amount?: number;
    tax_rate?: number;
    tax_amount?: number;
    shipping_cost?: number;
    total: number;
    // Trade / Incoterms
    payment_terms?: string;
    shipping_type?: 'door_to_door' | 'port_warehouse';
    factory_tax_ref?: string;
    incoterms?: string;
    incoterms_code?: string;
    port_of_loading?: string;
    port_of_discharge?: string;
    country_of_origin?: string;
    // Shipping details
    bl_number?: string;
    vessel_name?: string;
    container_number?: string;
    gross_weight_kg?: number;
    net_weight_kg?: number;
    total_packages?: number;
    package_type?: string;
    commercial_invoice_ref?: string;
    packing_list_ref?: string;
    // Insurance
    insurance_company?: string;
    insurance_policy_number?: string;
    insurance_amount?: number;
    // L/C
    lc_number?: string;
    lc_issuing_bank?: string;
    lc_expiry_date?: string;
    lc_amount?: number;
    lc_currency?: string;
    // Escrow
    escrow_confirmed?: boolean;
    escrow_confirmed_at?: string;
    escrow_green_light_issued?: boolean;
    escrow_green_light_at?: string;
    // Notes
    notes?: string;
    customs_declaration?: string;
    // Customs adjustment
    customs_adjustment_note?: string;
    customs_adjustment_amount?: number;
    customs_adjustment_type?: 'surcharge' | 'refund' | null;
    customs_is_binding?: boolean;
  };
  /** Optional order number to display alongside invoice number */
  orderNumber?: string;
}

const PAYMENT_TERMS_LABELS: Record<string, string> = {
  lc_at_sight: 'L/C at Sight',
  lc_usance_30: 'L/C Usance 30 Days',
  lc_usance_60: 'L/C Usance 60 Days',
  lc_usance_90: 'L/C Usance 90 Days',
  lc_usance_120: 'L/C Usance 120 Days',
  tt_advance: 'T/T Advance (100% Upfront)',
  tt_30_days: 'T/T 30 Days After BL',
  tt_60_days: 'T/T 60 Days After BL',
  tt_90_days: 'T/T 90 Days After BL',
  dp_documents_against_payment: 'D/P – Documents Against Payment',
  da_documents_against_acceptance: 'D/A – Documents Against Acceptance',
  open_account: 'Open Account',
  cash_on_delivery: 'Cash on Delivery',
  cash_upfront_escrow: 'Cash Upfront — Escrow Protected',
};

const INCOTERMS_LABELS: Record<string, { en: string; ar: string }> = {
  EXW: { en: 'Ex Works', ar: 'تسليم من باب المصنع' },
  FCA: { en: 'Free Carrier', ar: 'تسليم للناقل' },
  CPT: { en: 'Carriage Paid To', ar: 'النقل مدفوع حتى' },
  CIP: { en: 'Carriage & Insurance Paid', ar: 'النقل والتأمين مدفوعان حتى' },
  DAP: { en: 'Delivered at Place', ar: 'تسليم في المكان المحدد' },
  DPU: { en: 'Delivered at Place Unloaded', ar: 'تسليم في المكان مفرغاً' },
  DDP: { en: 'Delivered Duty Paid', ar: 'تسليم مع دفع الرسوم الجمركية' },
  FAS: { en: 'Free Alongside Ship', ar: 'تسليم بجانب السفينة' },
  FOB: { en: 'Free On Board', ar: 'تسليم على ظهر السفينة' },
  CFR: { en: 'Cost & Freight', ar: 'التكلفة والشحن' },
  CIF: { en: 'Cost, Insurance & Freight', ar: 'التكلفة والتأمين والشحن' },
};

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-500 border-gray-200',
  issued: 'bg-blue-50 text-blue-700 border-blue-200',
  sent: 'bg-purple-50 text-purple-700 border-purple-200',
  paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  overdue: 'bg-red-50 text-red-700 border-red-200',
  cancelled: 'bg-gray-100 text-gray-400 border-gray-200',
};

function fmt(n: number, decimals = 2) {
  return n.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function fmtDate(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  if (!value && value !== 0) return null;
  return (
    <div>
      <p className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold">{label}</p>
      <p className="text-sm font-semibold text-gray-900 mt-0.5">{value}</p>
    </div>
  );
}

export default function InvoiceTemplate({ invoice, orderNumber }: InvoiceTemplateProps) {
  const {
    invoice_number, invoice_type = 'standard', issue_date, due_date, status,
    seller_name, seller_address, seller_vat, seller_cr,
    seller_bank_name, seller_bank_iban, seller_bank_swift,
    seller_export_license, seller_customs_code,
    buyer_name, buyer_company, buyer_address, buyer_country, buyer_vat,
    buyer_import_license, buyer_customs_code,
    items = [], currency,
    subtotal, discount_amount = 0, tax_rate = 0, tax_amount = 0,
    shipping_cost = 0, total,
    payment_terms, shipping_type, factory_tax_ref,
    incoterms, incoterms_code,
    port_of_loading, port_of_discharge, country_of_origin,
    bl_number, vessel_name, container_number,
    gross_weight_kg, net_weight_kg, total_packages, package_type,
    commercial_invoice_ref, packing_list_ref,
    insurance_company, insurance_policy_number, insurance_amount,
    lc_number, lc_issuing_bank, lc_expiry_date, lc_amount, lc_currency,
    escrow_confirmed, escrow_confirmed_at, escrow_green_light_issued, escrow_green_light_at,
    notes, customs_declaration,
  } = invoice;

  const isCommercial = invoice_type === 'commercial_enterprise_cash';
  const effectiveIncoterms = incoterms_code || incoterms;
  const isLC = payment_terms?.startsWith('lc_');
  const paymentLabel = payment_terms ? (PAYMENT_TERMS_LABELS[payment_terms] || payment_terms) : '—';
  const statusStyle = STATUS_STYLES[status || 'issued'] || STATUS_STYLES.issued;
  const incotermsInfo = effectiveIncoterms ? INCOTERMS_LABELS[effectiveIncoterms] : null;

  return (
    <div className="bg-white text-gray-900 font-sans" style={{ fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif" }}>

      {/* ── TOP HEADER BAR ─────────────────────────────────────── */}
      <div className={`px-8 py-6 flex items-center justify-between ${isCommercial ? 'bg-slate-900' : 'bg-gray-900'}`}>
        <div>
          <p className="text-white text-xs font-semibold tracking-widest uppercase opacity-60 mb-1">DirectHub</p>
          <h1 className="text-white text-2xl font-bold tracking-tight">
            {isCommercial ? 'COMMERCIAL INVOICE' : 'INVOICE'}
          </h1>
          {isCommercial && (
            <p className="text-slate-400 text-xs mt-1 tracking-wide">
              فاتورة تجارية رسمية — International Trade Document
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="text-white font-mono text-xl font-bold">{invoice_number}</p>
          {commercial_invoice_ref && (
            <p className="text-gray-400 text-xs mt-0.5 font-mono">Ref: {commercial_invoice_ref}</p>
          )}
          {orderNumber && (
            <p className="text-gray-400 text-xs mt-0.5">Order #{orderNumber}</p>
          )}
          {status && (
            <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-bold border ${statusStyle}`}>
              {status.toUpperCase()}
            </span>
          )}
        </div>
      </div>

      {/* ── ESCROW GREEN LIGHT BANNER ──────────────────────────── */}
      {isCommercial && escrow_green_light_issued && (
        <div className="bg-emerald-600 px-8 py-3 flex items-center gap-3">
          <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p className="text-white text-sm font-bold">
              🟢 الضوء الأخضر — Cash Escrow Confirmed · Factory Authorized to Pack &amp; Ship
            </p>
            {escrow_green_light_at && (
              <p className="text-emerald-100 text-xs mt-0.5">
                Authorized: {fmtDate(escrow_green_light_at)}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Escrow confirmed but green light not yet issued */}
      {isCommercial && escrow_confirmed && !escrow_green_light_issued && (
        <div className="bg-amber-500 px-8 py-3 flex items-center gap-3">
          <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-white text-sm font-bold">
            ⏳ Escrow Deposit Confirmed — Awaiting CFO / Admin Green Light
          </p>
        </div>
      )}

      {/* ── DATE & REFERENCE ROW ───────────────────────────────── */}
      <div className="border-b border-gray-200 px-8 py-4 flex flex-wrap gap-6 bg-gray-50">
        <InfoRow label="Issue Date" value={fmtDate(issue_date)} />
        {due_date && <InfoRow label="Due Date" value={fmtDate(due_date)} />}
        {payment_terms && <InfoRow label="Payment Terms" value={paymentLabel} />}
        {packing_list_ref && <InfoRow label="Packing List Ref" value={packing_list_ref} />}
        {bl_number && <InfoRow label="B/L Number" value={bl_number} />}
      </div>

      {/* ── INCOTERMS & SHIPPING DETAILS (Commercial) ─────────── */}
      {isCommercial && (effectiveIncoterms || port_of_loading || port_of_discharge || vessel_name) && (
        <div className="px-8 py-5 border-b border-gray-200 bg-blue-50">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 rounded-lg bg-blue-700 flex items-center justify-center shrink-0">
              <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </div>
            <p className="text-xs font-black text-blue-900 uppercase tracking-widest">
              Incoterms &amp; Shipping Details — شروط التجارة الدولية وتفاصيل الشحن
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            {effectiveIncoterms && (
              <div className="bg-white rounded-xl border-2 border-blue-300 p-3 col-span-1">
                <p className="text-[10px] text-blue-600 uppercase tracking-wide font-bold mb-1">Incoterms 2020</p>
                <p className="text-2xl font-black text-blue-900">{effectiveIncoterms}</p>
                {incotermsInfo && (
                  <>
                    <p className="text-[10px] text-blue-700 font-semibold mt-1">{incotermsInfo.en}</p>
                    <p className="text-[10px] text-blue-600 mt-0.5">{incotermsInfo.ar}</p>
                  </>
                )}
              </div>
            )}
            {port_of_loading && (
              <div className="bg-white rounded-xl border border-gray-200 p-3">
                <p className="text-[10px] text-gray-500 uppercase tracking-wide font-bold mb-1">Port of Loading</p>
                <p className="text-sm font-bold text-gray-900">{port_of_loading}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">ميناء التحميل</p>
              </div>
            )}
            {port_of_discharge && (
              <div className="bg-white rounded-xl border border-gray-200 p-3">
                <p className="text-[10px] text-gray-500 uppercase tracking-wide font-bold mb-1">Port of Discharge</p>
                <p className="text-sm font-bold text-gray-900">{port_of_discharge}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">ميناء التفريغ</p>
              </div>
            )}
            {country_of_origin && (
              <div className="bg-white rounded-xl border border-gray-200 p-3">
                <p className="text-[10px] text-gray-500 uppercase tracking-wide font-bold mb-1">Country of Origin</p>
                <p className="text-sm font-bold text-gray-900">{country_of_origin}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">بلد المنشأ</p>
              </div>
            )}
          </div>

          {/* Vessel / Container */}
          {(vessel_name || container_number || bl_number) && (
            <div className="grid grid-cols-3 gap-3 mb-3">
              {vessel_name && (
                <div className="bg-white rounded-lg border border-gray-200 px-3 py-2">
                  <p className="text-[10px] text-gray-500 font-bold uppercase">Vessel Name</p>
                  <p className="text-xs font-semibold text-gray-900 mt-0.5">{vessel_name}</p>
                </div>
              )}
              {container_number && (
                <div className="bg-white rounded-lg border border-gray-200 px-3 py-2">
                  <p className="text-[10px] text-gray-500 font-bold uppercase">Container No.</p>
                  <p className="text-xs font-mono font-semibold text-gray-900 mt-0.5">{container_number}</p>
                </div>
              )}
              {bl_number && (
                <div className="bg-white rounded-lg border border-gray-200 px-3 py-2">
                  <p className="text-[10px] text-gray-500 font-bold uppercase">B/L Number</p>
                  <p className="text-xs font-mono font-semibold text-gray-900 mt-0.5">{bl_number}</p>
                </div>
              )}
            </div>
          )}

          {/* Weight & Packages */}
          {(gross_weight_kg || net_weight_kg || total_packages) && (
            <div className="grid grid-cols-3 gap-3 mb-3">
              {gross_weight_kg && (
                <div className="bg-white rounded-lg border border-gray-200 px-3 py-2">
                  <p className="text-[10px] text-gray-500 font-bold uppercase">Gross Weight</p>
                  <p className="text-xs font-semibold text-gray-900 mt-0.5">{gross_weight_kg.toLocaleString()} kg</p>
                </div>
              )}
              {net_weight_kg && (
                <div className="bg-white rounded-lg border border-gray-200 px-3 py-2">
                  <p className="text-[10px] text-gray-500 font-bold uppercase">Net Weight</p>
                  <p className="text-xs font-semibold text-gray-900 mt-0.5">{net_weight_kg.toLocaleString()} kg</p>
                </div>
              )}
              {total_packages && (
                <div className="bg-white rounded-lg border border-gray-200 px-3 py-2">
                  <p className="text-[10px] text-gray-500 font-bold uppercase">Packages</p>
                  <p className="text-xs font-semibold text-gray-900 mt-0.5">{total_packages} {package_type || 'CTN'}</p>
                </div>
              )}
            </div>
          )}

          {/* Legal Incoterms note */}
          {effectiveIncoterms && (
            <div className="flex items-start gap-2 px-3 py-2 bg-blue-100 rounded-lg border border-blue-200">
              <svg className="w-3.5 h-3.5 text-blue-700 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-[10px] text-blue-800 leading-relaxed">
                <strong>Legal Note / ملاحظة قانونية:</strong> The Incoterms® rule <strong>{effectiveIncoterms}</strong>
                {incotermsInfo ? ` (${incotermsInfo.en} — ${incotermsInfo.ar})` : ''} governs the delivery obligations, risk transfer, and cost allocation between seller and buyer under ICC Incoterms® 2020.
                {port_of_loading ? ` Named place: ${port_of_loading}.` : ''}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── SHIPPING DETAILS (Standard / Legacy) ──────────────── */}
      {!isCommercial && (shipping_type || (effectiveIncoterms && !incoterms_code)) && (
        <div className="px-8 py-5 border-b border-gray-200 bg-blue-50">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
              <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </div>
            <p className="text-xs font-bold text-blue-900 uppercase tracking-widest">Shipping &amp; Logistics Details — تفاصيل الشحن واللوجستيات</p>
          </div>

          {shipping_type && (
            <div className={`rounded-xl border-2 p-4 mb-4 ${shipping_type === 'door_to_door' ? 'bg-emerald-50 border-emerald-300' : 'bg-blue-100 border-blue-300'}`}>
              <div className="flex items-center gap-3">
                <span className="text-2xl">{shipping_type === 'door_to_door' ? '🏠' : '🚢'}</span>
                <div>
                  <p className={`text-sm font-black ${shipping_type === 'door_to_door' ? 'text-emerald-900' : 'text-blue-900'}`}>
                    {shipping_type === 'door_to_door' ? 'تسليم باب المشتري — Door-to-Door' : 'تسليم الميناء / المخزن — Port / Warehouse'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {!shipping_type && effectiveIncoterms && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
              <div className="bg-white rounded-xl border-2 border-blue-200 p-3">
                <p className="text-[10px] text-blue-600 uppercase tracking-wide font-bold mb-1">Incoterms</p>
                <p className="text-lg font-black text-blue-900">{effectiveIncoterms}</p>
              </div>
              {port_of_loading && (
                <div className="bg-white rounded-xl border-2 border-emerald-200 p-3">
                  <p className="text-[10px] text-emerald-600 uppercase tracking-wide font-bold mb-1">Port of Loading</p>
                  <p className="text-sm font-bold text-emerald-900">{port_of_loading}</p>
                </div>
              )}
              {port_of_discharge && (
                <div className="bg-white rounded-xl border border-gray-200 p-3">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide font-bold mb-1">Port of Discharge</p>
                  <p className="text-sm font-bold text-gray-900">{port_of_discharge}</p>
                </div>
              )}
            </div>
          )}

          {factory_tax_ref && (
            <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-gray-200">
              <p className="text-[10px] text-gray-600">
                <span className="font-bold text-gray-700">الرقم المرجعي الضريبي للمصنع:</span>{' '}
                <span className="font-mono">{factory_tax_ref}</span>
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── BILL FROM / BILL TO ────────────────────────────────── */}
      <div className="px-8 py-6 grid grid-cols-2 gap-8 border-b border-gray-200">
        {/* Seller */}
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-3">
            {isCommercial ? 'Exporter / Seller — المُصدِّر / البائع' : 'Bill From'}
          </p>
          <p className="font-bold text-gray-900 text-base">{seller_name || 'DirectHub'}</p>
          {seller_address && (
            <p className="text-sm text-gray-600 mt-1 whitespace-pre-line leading-relaxed">{seller_address}</p>
          )}
          {seller_vat && <p className="text-xs text-gray-500 mt-2">VAT No: <span className="font-mono text-gray-700">{seller_vat}</span></p>}
          {seller_cr && <p className="text-xs text-gray-500">CR No: <span className="font-mono text-gray-700">{seller_cr}</span></p>}
          {isCommercial && seller_export_license && (
            <p className="text-xs text-gray-500 mt-1">Export License: <span className="font-mono text-gray-700">{seller_export_license}</span></p>
          )}
          {isCommercial && seller_customs_code && (
            <p className="text-xs text-gray-500">Customs Code: <span className="font-mono text-gray-700">{seller_customs_code}</span></p>
          )}
        </div>

        {/* Buyer */}
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-3">
            {isCommercial ? 'Importer / Buyer — المُستورِد / المشتري' : 'Bill To'}
          </p>
          <p className="font-bold text-gray-900 text-base">{buyer_name}</p>
          {buyer_company && <p className="text-sm text-gray-700 mt-0.5">{buyer_company}</p>}
          {buyer_address && (
            <p className="text-sm text-gray-600 mt-1 whitespace-pre-line leading-relaxed">{buyer_address}</p>
          )}
          {buyer_country && <p className="text-xs text-gray-500 mt-1">{buyer_country}</p>}
          {buyer_vat && <p className="text-xs text-gray-500 mt-1">VAT No: <span className="font-mono text-gray-700">{buyer_vat}</span></p>}
          {isCommercial && buyer_import_license && (
            <p className="text-xs text-gray-500 mt-1">Import License: <span className="font-mono text-gray-700">{buyer_import_license}</span></p>
          )}
          {isCommercial && buyer_customs_code && (
            <p className="text-xs text-gray-500">Customs Code: <span className="font-mono text-gray-700">{buyer_customs_code}</span></p>
          )}
        </div>
      </div>

      {/* ── INSURANCE (Commercial only) ────────────────────────── */}
      {isCommercial && insurance_company && (
        <div className="px-8 py-4 bg-indigo-50 border-b border-indigo-100">
          <p className="text-xs font-bold text-indigo-800 uppercase tracking-wide mb-2">Insurance Details — تفاصيل التأمين</p>
          <div className="flex flex-wrap gap-6">
            <InfoRow label="Insurance Company" value={insurance_company} />
            {insurance_policy_number && <InfoRow label="Policy Number" value={insurance_policy_number} />}
            {insurance_amount && insurance_amount > 0 && (
              <InfoRow label="Insured Amount" value={`${currency} ${fmt(insurance_amount)}`} />
            )}
          </div>
        </div>
      )}

      {/* ── L/C DETAILS (conditional) ──────────────────────────── */}
      {isLC && lc_number && (
        <div className="px-8 py-4 bg-amber-50 border-b border-amber-200">
          <p className="text-xs font-bold text-amber-800 uppercase tracking-wide mb-3">Letter of Credit Details</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-amber-600">L/C Number</p>
              <p className="text-sm font-semibold text-amber-900 font-mono">{lc_number}</p>
            </div>
            {lc_issuing_bank && (
              <div>
                <p className="text-xs text-amber-600">Issuing Bank</p>
                <p className="text-sm font-semibold text-amber-900">{lc_issuing_bank}</p>
              </div>
            )}
            {lc_expiry_date && (
              <div>
                <p className="text-xs text-amber-600">Expiry Date</p>
                <p className="text-sm font-semibold text-amber-900">{fmtDate(lc_expiry_date)}</p>
              </div>
            )}
            {lc_amount && lc_amount > 0 && (
              <div>
                <p className="text-xs text-amber-600">L/C Amount</p>
                <p className="text-sm font-semibold text-amber-900">{lc_currency} {fmt(lc_amount)}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ITEMS TABLE ────────────────────────────────────────── */}
      <div className="px-8 pt-6 pb-2 overflow-x-auto -mx-8 px-8 sm:mx-0 sm:px-8">
        <table className="w-full text-sm min-w-[500px]">
          <thead>
            <tr className="border-b-2 border-gray-900">
              <th className="text-left pb-3 text-xs font-bold text-gray-500 uppercase tracking-wide w-[35%]">Description</th>
              <th className="text-left pb-3 text-xs font-bold text-gray-500 uppercase tracking-wide">HS Code</th>
              {isCommercial && (
                <th className="text-left pb-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Origin</th>
              )}
              <th className="text-right pb-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Qty</th>
              <th className="text-left pb-3 text-xs font-bold text-gray-500 uppercase tracking-wide pl-2">Unit</th>
              <th className="text-right pb-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Unit Price</th>
              <th className="text-right pb-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="py-3 pr-4">
                  <p className="font-medium text-gray-900">{item.description}</p>
                  {item.country_of_origin && !isCommercial && (
                    <p className="text-xs text-gray-400 mt-0.5">Origin: {item.country_of_origin}</p>
                  )}
                  {isCommercial && item.net_weight_kg && (
                    <p className="text-xs text-gray-400 mt-0.5">Net Wt: {item.net_weight_kg} kg/unit</p>
                  )}
                </td>
                <td className="py-3 font-mono text-xs text-gray-600 font-semibold">{item.hs_code || '—'}</td>
                {isCommercial && (
                  <td className="py-3 text-xs text-gray-600">{item.country_of_origin || '—'}</td>
                )}
                <td className="py-3 text-right text-gray-700">{item.quantity}</td>
                <td className="py-3 text-gray-500 pl-2">{item.unit}</td>
                <td className="py-3 text-right text-gray-700">{currency} {fmt(Number(item.unit_price))}</td>
                <td className="py-3 text-right font-semibold text-gray-900">{currency} {fmt(Number(item.total))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── TOTALS ─────────────────────────────────────────────── */}
      <div className="px-8 pb-6 flex justify-end">
        <div className="w-72 mt-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Subtotal</span>
              <span className="text-gray-900 font-medium">{currency} {fmt(subtotal)}</span>
            </div>
            {discount_amount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Discount</span>
                <span className="text-red-600 font-medium">− {currency} {fmt(discount_amount)}</span>
              </div>
            )}
            {tax_rate > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">VAT ({tax_rate}%)</span>
                <span className="text-gray-900 font-medium">{currency} {fmt(tax_amount)}</span>
              </div>
            )}
            {shipping_cost > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Freight / Shipping</span>
                <span className="text-gray-900 font-medium">{currency} {fmt(shipping_cost)}</span>
              </div>
            )}
            {isCommercial && insurance_amount && insurance_amount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Insurance</span>
                <span className="text-gray-900 font-medium">{currency} {fmt(insurance_amount)}</span>
              </div>
            )}
          </div>
          <div className="mt-3 pt-3 border-t-2 border-gray-900 flex justify-between items-baseline">
            <span className="text-base font-bold text-gray-900 uppercase tracking-wide">
              {isCommercial ? 'Total Invoice Value' : 'Total Due'}
            </span>
            <span className="text-2xl font-bold text-gray-900">{currency} {fmt(total)}</span>
          </div>
          {isCommercial && (
            <p className="text-[10px] text-gray-500 mt-1 text-right">
              القيمة الإجمالية للفاتورة التجارية
            </p>
          )}
        </div>
      </div>

      {/* ── BANK DETAILS ───────────────────────────────────────── */}
      {seller_bank_name && (
        <div className="mx-8 mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
            {isCommercial ? 'Beneficiary Bank Details — بيانات البنك المستفيد' : 'Bank Details'}
          </p>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs text-gray-400">Bank</p>
              <p className="font-semibold text-gray-900">{seller_bank_name}</p>
            </div>
            {seller_bank_iban && (
              <div>
                <p className="text-xs text-gray-400">IBAN</p>
                <p className="font-mono text-gray-900 text-xs">{seller_bank_iban}</p>
              </div>
            )}
            {seller_bank_swift && (
              <div>
                <p className="text-xs text-gray-400">SWIFT / BIC</p>
                <p className="font-mono text-gray-900">{seller_bank_swift}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── CUSTOMS DECLARATION (Commercial) ──────────────────── */}
      {isCommercial && (
        <div className="mx-8 mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-xs font-bold text-yellow-800 uppercase tracking-widest mb-2">
            Customs Declaration — إقرار جمركي
          </p>
          <p className="text-xs text-yellow-900 leading-relaxed">
            {customs_declaration ||
              'The undersigned hereby declares that the information on this invoice is true and correct and that the contents of this shipment are as stated above. This commercial invoice is issued in accordance with international trade standards and Incoterms® 2020 rules.'}
          </p>
          <p className="text-[10px] text-yellow-700 mt-2 leading-relaxed">
            يُقرّ الموقّع أدناه بأن المعلومات الواردة في هذه الفاتورة صحيحة ودقيقة وأن محتويات هذه الشحنة كما هو مذكور أعلاه. تصدر هذه الفاتورة التجارية وفقاً لمعايير التجارة الدولية وقواعد Incoterms® 2020.
          </p>
        </div>
      )}

      {/* ── CUSTOMS ADJUSTMENT NOTE BANNER ────────────────────── */}
      {invoice.customs_adjustment_note && (
        <div className={`px-8 py-3 flex items-start gap-3 ${invoice.customs_adjustment_type === 'refund' ? 'bg-emerald-50 border-b border-emerald-200' : 'bg-amber-50 border-b border-amber-200'}`}>
          <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${invoice.customs_adjustment_type === 'refund' ? 'bg-emerald-100' : 'bg-amber-100'}`}>
            <svg className={`w-4 h-4 ${invoice.customs_adjustment_type === 'refund' ? 'text-emerald-600' : 'text-amber-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex-1">
            <p className={`text-sm font-bold ${invoice.customs_adjustment_type === 'refund' ? 'text-emerald-800' : 'text-amber-800'}`}>
              {invoice.customs_adjustment_type === 'refund' ? '↩ مذكرة استرداد جمركي — Customs Duty Refund Note' : '↑ مذكرة تسوية جمركية — Customs Duty Adjustment Note'}
            </p>
            <p className={`text-xs mt-0.5 ${invoice.customs_adjustment_type === 'refund' ? 'text-emerald-700' : 'text-amber-700'}`}>{invoice.customs_adjustment_note}</p>
            {invoice.customs_adjustment_amount != null && (
              <p className={`text-sm font-bold mt-1 ${invoice.customs_adjustment_type === 'refund' ? 'text-emerald-700' : 'text-amber-700'}`}>
                {invoice.customs_adjustment_type === 'refund' ? '−' : '+'} {fmt(invoice.customs_adjustment_amount)} {invoice.currency}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── NON-BINDING CUSTOMS DISCLAIMER ────────────────────── */}
      {(invoice.customs_is_binding === false || isCommercial) && (
        <div className="px-8 py-3 bg-red-50 border-b border-red-200 flex items-start gap-3">
          <svg className="w-4 h-4 text-red-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-[10px] text-red-700 leading-relaxed">
            <strong>إخلاء المسؤولية الجمركية:</strong> أي أرقام جمركية واردة في هذه الوثيقة هي <strong>تقديرات غير ملزمة</strong> وتخضع لاعتماد المخلص الجمركي المعتمد والسلطات الجمركية المختصة. قد تختلف الرسوم الفعلية عند الميناء. DirectHub غير مسؤولة عن أي فروقات في الرسوم الجمركية الفعلية. |&nbsp;
            <strong>Customs Disclaimer:</strong> Any customs figures herein are <strong>non-binding estimates (isBinding: false)</strong> subject to licensed customs broker approval. Actual duties may vary at port. DirectHub bears no liability for duty differences.
          </p>
        </div>
      )}

      {/* ── NOTES & CUSTOMS (Standard) ─────────────────────────── */}
      {(notes || (!isCommercial && customs_declaration)) && (
        <div className="mx-8 mb-6 space-y-3">
          {notes && (
            <div className="p-4 border border-gray-200 rounded-lg">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Notes</p>
              <p className="text-sm text-gray-600 leading-relaxed">{notes}</p>
            </div>
          )}
          {!isCommercial && customs_declaration && (
            <div className="p-4 border border-gray-200 rounded-lg">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Customs Declaration</p>
              <p className="text-sm text-gray-600 leading-relaxed">{customs_declaration}</p>
            </div>
          )}
        </div>
      )}

      {/* ── ESCROW STATUS FOOTER (Commercial) ─────────────────── */}
      {isCommercial && (escrow_confirmed || escrow_green_light_issued) && (
        <div className="mx-8 mb-6 p-4 rounded-xl border-2 border-emerald-200 bg-emerald-50">
          <p className="text-xs font-bold text-emerald-800 uppercase tracking-widest mb-3">
            🔒 Escrow &amp; Payment Status — حالة الضمان المالي
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${escrow_confirmed ? 'bg-emerald-500' : 'bg-gray-300'}`} />
              <div>
                <p className="text-xs font-semibold text-gray-800">Cash Escrow Deposit</p>
                <p className="text-[10px] text-gray-500">
                  {escrow_confirmed
                    ? `Confirmed ${escrow_confirmed_at ? '· ' + fmtDate(escrow_confirmed_at) : ''}`
                    : 'Pending'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${escrow_green_light_issued ? 'bg-emerald-500' : 'bg-amber-400'}`} />
              <div>
                <p className="text-xs font-semibold text-gray-800">Factory Green Light</p>
                <p className="text-[10px] text-gray-500">
                  {escrow_green_light_issued
                    ? `Issued ${escrow_green_light_at ? '· ' + fmtDate(escrow_green_light_at) : ''}`
                    : 'Awaiting Admin Approval'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── FOOTER ─────────────────────────────────────────────── */}
      <div className={`px-8 py-4 flex items-center justify-between ${isCommercial ? 'bg-slate-900' : 'bg-gray-900'}`}>
        <div>
          <p className="text-gray-400 text-xs">DirectHub Trading Platform · direct-hub.net</p>
          {isCommercial && (
            <p className="text-gray-500 text-[10px] mt-0.5">
              International Commercial Invoice · Incoterms® 2020 · ISO 9001 Compliant
            </p>
          )}
        </div>
        <p className="text-gray-500 text-xs font-mono">{invoice_number}</p>
      </div>
    </div>
  );
}
