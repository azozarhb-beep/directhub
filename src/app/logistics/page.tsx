'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import Icon from '@/components/ui/AppIcon';
import { useLanguage } from '@/contexts/LanguageContext';

interface LogisticsPartner {
  id: string;
  company_name: string;
  partner_type: string;
  partner_category_group: string | null;
  country: string;
  city: string;
  address: string;
  operating_hub: string | null;
  local_coverage_country: string | null;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  origin_countries: string[];
  destination_countries: string[];
  covered_ports: string[];
  operational_ports: string[];
  services_offered: string[];
  incoterms_supported: string[];
  base_rate_usd: number | null;
  rate_description: string | null;
  status: string;
  created_at: string;
}

// ── 3 Main Category Groups ────────────────────────────────────────────────────
const CATEGORY_GROUPS = [
  { key: 'all', labelKey: 'allPartners' as const, icon: 'Squares2X2Icon', color: 'text-gray-600', activeBg: 'bg-gray-800 text-white' },
  { key: 'international', labelKey: 'intlShipping' as const, descKey: 'intlShippingDesc' as const, icon: 'GlobeAltIcon', color: 'text-blue-600', activeBg: 'bg-blue-600 text-white' },
  { key: 'local', labelKey: 'localDist' as const, descKey: 'localDistDesc' as const, icon: 'TruckIcon', color: 'text-emerald-600', activeBg: 'bg-emerald-600 text-white' },
  { key: 'customs', labelKey: 'customs' as const, descKey: 'customsDesc' as const, icon: 'DocumentCheckIcon', color: 'text-violet-600', activeBg: 'bg-violet-600 text-white' },
];

const PARTNER_TYPE_KEYS: Record<string, string> = {
  international_shipping_office: 'typeIntlOffice',
  local_shipping_distribution: 'typeLocalDist',
  customs_broker: 'typeCustomsBroker',
  freight_forwarder: 'typeFreightForwarder',
  logistics_company: 'typeLogisticsCompany',
  shipping_office: 'typeShippingOffice',
  sourcing_agent: 'typeSourcingAgent',
};

const PARTNER_TYPE_ICONS: Record<string, string> = {
  international_shipping_office: 'GlobeAltIcon',
  local_shipping_distribution: 'TruckIcon',
  customs_broker: 'DocumentCheckIcon',
  freight_forwarder: 'GlobeAltIcon',
  logistics_company: 'BuildingOffice2Icon',
  shipping_office: 'TruckIcon',
  sourcing_agent: 'MagnifyingGlassIcon',
};

const PARTNER_TYPE_COLORS: Record<string, string> = {
  international_shipping_office: 'text-blue-600',
  local_shipping_distribution: 'text-emerald-600',
  customs_broker: 'text-violet-600',
  freight_forwarder: 'text-blue-500',
  logistics_company: 'text-gray-600',
  shipping_office: 'text-gray-600',
  sourcing_agent: 'text-amber-600',
};

const PARTNER_TYPE_LABELS: Record<string, string> = {
  international_shipping_office: 'International Shipping Office',
  local_shipping_distribution: 'Local Shipping & Distribution',
  customs_broker: 'Customs Broker',
  freight_forwarder: 'Freight Forwarder',
  logistics_company: 'Logistics Company',
  shipping_office: 'Shipping Office',
  sourcing_agent: 'Sourcing Agent',
};

const PARTNER_BG_COLORS: Record<string, string> = {
  international_shipping_office: 'bg-blue-100',
  local_shipping_distribution: 'bg-emerald-100',
  customs_broker: 'bg-violet-100',
  freight_forwarder: 'bg-blue-100',
  logistics_company: 'bg-gray-100',
  shipping_office: 'bg-gray-100',
  sourcing_agent: 'bg-amber-100',
};

function getCategoryGroup(partner: LogisticsPartner): string {
  if (partner.partner_category_group) return partner.partner_category_group;
  if (partner.partner_type === 'international_shipping_office' || partner.partner_type === 'freight_forwarder') return 'international';
  if (partner.partner_type === 'local_shipping_distribution' || partner.partner_type === 'logistics_company' || partner.partner_type === 'shipping_office') return 'local';
  if (partner.partner_type === 'customs_broker') return 'customs';
  return 'other';
}

// ── HS Code duty rates (simplified common rates for Yemen) ────────────────────
const HS_DUTY_RATES: { code: string; desc: string; rate: number }[] = [
  { code: '8471', desc: 'Computers & Laptops', rate: 5 },
  { code: '8517', desc: 'Mobile Phones & Telecom', rate: 5 },
  { code: '8703', desc: 'Passenger Vehicles', rate: 25 },
  { code: '8704', desc: 'Commercial Trucks', rate: 15 },
  { code: '6109', desc: 'T-shirts & Knit Apparel', rate: 30 },
  { code: '6204', desc: 'Women\'s Suits & Dresses', rate: 30 },
  { code: '0901', desc: 'Coffee', rate: 10 },
  { code: '1701', desc: 'Sugar', rate: 15 },
  { code: '1001', desc: 'Wheat', rate: 5 },
  { code: '2710', desc: 'Petroleum Oils', rate: 0 },
  { code: '3004', desc: 'Medicaments / Pharmaceuticals', rate: 0 },
  { code: '8544', desc: 'Insulated Wire & Cable', rate: 10 },
  { code: '7308', desc: 'Steel Structures', rate: 10 },
  { code: '3901', desc: 'Polymers / Plastics', rate: 10 },
  { code: '9403', desc: 'Furniture', rate: 25 },
  { code: '8418', desc: 'Refrigerators & Freezers', rate: 15 },
  { code: '8516', desc: 'Electric Water Heaters', rate: 15 },
  { code: '2523', desc: 'Portland Cement', rate: 10 },
  { code: '7210', desc: 'Flat-Rolled Steel Products', rate: 10 },
  { code: '8481', desc: 'Taps, Cocks & Valves', rate: 10 },
];

// ── Customs Duty Calculator ───────────────────────────────────────────────────
function CustomsDutyCalculator() {
  const { user } = useAuth();
  const supabase = createClient();

  const [goodsValue, setGoodsValue] = useState('');
  const [freightCost, setFreightCost] = useState('');
  const [insurance, setInsurance] = useState('');
  const [originCountry, setOriginCountry] = useState('CN');
  const [hsCode, setHsCode] = useState('');
  const [customDutyRate, setCustomDutyRate] = useState('');
  const [vatRate, setVatRate] = useState('5');
  const [otherFees, setOtherFees] = useState('0');
  const [productDesc, setProductDesc] = useState('');
  const [result, setResult] = useState<null | {
    cifValue: number;
    dutyRate: number;
    dutyAmount: number;
    vatAmount: number;
    otherFees: number;
    totalLanded: number;
    safetyBuffer: number;
    isBinding: boolean;
  }>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const selectedHS = HS_DUTY_RATES.find(h => h.code === hsCode);

  const effectiveDutyRate = customDutyRate !== ''
    ? parseFloat(customDutyRate)
    : (selectedHS?.rate ?? 0);

  const calculate = () => {
    const gv = parseFloat(goodsValue) || 0;
    const fc = parseFloat(freightCost) || 0;
    const ins = parseFloat(insurance) || 0;
    const cif = gv + fc + ins;
    const dr = effectiveDutyRate;
    const duty = (cif * dr) / 100;
    const vr = parseFloat(vatRate) || 5;
    const vat = ((cif + duty) * vr) / 100;
    const of = parseFloat(otherFees) || 0;
    const rawTotal = cif + duty + vat + of;
    // 5% safety buffer — non-binding estimate
    const safetyBuffer = rawTotal * 0.05;
    const total = rawTotal + safetyBuffer;
    setResult({ cifValue: cif, dutyRate: dr, dutyAmount: duty, vatAmount: vat, otherFees: of, totalLanded: total, safetyBuffer, isBinding: false });
  };

  const saveCalculation = async () => {
    if (!user || !result) return;
    setSaving(true);
    await supabase.from('customs_duty_calculations').insert({
      user_id: user.id,
      hs_code: hsCode || null,
      product_description: productDesc || selectedHS?.desc || null,
      origin_country: originCountry,
      destination_country: 'YE',
      goods_value_usd: parseFloat(goodsValue) || 0,
      freight_cost_usd: parseFloat(freightCost) || 0,
      insurance_usd: parseFloat(insurance) || 0,
      customs_duty_rate: result.dutyRate,
      customs_duty_usd: result.dutyAmount,
      vat_rate: parseFloat(vatRate) || 5,
      vat_usd: result.vatAmount,
      other_fees_usd: result.otherFees,
      total_landed_cost: result.totalLanded,
      is_binding: false,
      safety_buffer_pct: 5,
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-5" dir="rtl">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-violet-600 to-indigo-600 rounded-2xl p-5 text-white">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
            <Icon name="CalculatorIcon" size={22} className="text-white" />
          </div>
          <div>
            <h2 className="font-bold text-lg">حاسبة الرسوم الجمركية والضرائب</h2>
            <p className="text-white/80 text-xs">احسب التكلفة الإجمالية للاستيراد إلى اليمن</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Input Panel */}
        <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
          <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
            <Icon name="PencilSquareIcon" size={15} className="text-violet-600" />
            بيانات الشحنة
          </h3>

          {/* HS Code Selector */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">كود HS (اختياري)</label>
            <select
              value={hsCode}
              onChange={e => {
                setHsCode(e.target.value);
                setCustomDutyRate('');
                const found = HS_DUTY_RATES.find(h => h.code === e.target.value);
                if (found) setProductDesc(found.desc);
              }}
              className="w-full h-10 px-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary"
            >
              <option value="">-- اختر كود HS --</option>
              {HS_DUTY_RATES.map(h => (
                <option key={h.code} value={h.code}>{h.code} — {h.desc} ({h.rate}%)</option>
              ))}
            </select>
          </div>

          {/* Product Description */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">وصف البضاعة</label>
            <input
              value={productDesc}
              onChange={e => setProductDesc(e.target.value)}
              placeholder="مثال: أجهزة إلكترونية، ملابس، مواد بناء..."
              className="w-full h-10 px-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary"
            />
          </div>

          {/* Origin Country */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">بلد المنشأ</label>
            <select
              value={originCountry}
              onChange={e => setOriginCountry(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary"
            >
              {['CN', 'TR', 'AE', 'SA', 'IN', 'DE', 'US', 'JP', 'KR', 'IT', 'EG', 'JO', 'PK', 'BD'].map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Values */}
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">قيمة البضاعة (USD)</label>
              <input
                type="number"
                min="0"
                value={goodsValue}
                onChange={e => setGoodsValue(e.target.value)}
                placeholder="0.00"
                className="w-full h-10 px-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">تكلفة الشحن (USD)</label>
                <input
                  type="number"
                  min="0"
                  value={freightCost}
                  onChange={e => setFreightCost(e.target.value)}
                  placeholder="0.00"
                  className="w-full h-10 px-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">التأمين (USD)</label>
                <input
                  type="number"
                  min="0"
                  value={insurance}
                  onChange={e => setInsurance(e.target.value)}
                  placeholder="0.00"
                  className="w-full h-10 px-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary"
                />
              </div>
            </div>
          </div>

          {/* Rates */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                نسبة الجمارك %
                {selectedHS && !customDutyRate && (
                  <span className="text-violet-600 mr-1">(تلقائي: {selectedHS.rate}%)</span>
                )}
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={customDutyRate}
                onChange={e => setCustomDutyRate(e.target.value)}
                placeholder={String(selectedHS?.rate ?? 0)}
                className="w-full h-10 px-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">ضريبة القيمة %</label>
              <input
                type="number"
                min="0"
                max="100"
                value={vatRate}
                onChange={e => setVatRate(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">رسوم أخرى (USD)</label>
              <input
                type="number"
                min="0"
                value={otherFees}
                onChange={e => setOtherFees(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          <button
            onClick={calculate}
            disabled={!goodsValue}
            className="w-full h-11 bg-violet-600 text-white rounded-xl text-sm font-bold hover:bg-violet-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            <Icon name="CalculatorIcon" size={16} />
            احسب الرسوم الجمركية
          </button>
        </div>

        {/* Result Panel */}
        <div className="space-y-4">
          {result ? (
            <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
              <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
                <Icon name="DocumentTextIcon" size={15} className="text-emerald-600" />
                نتيجة الحساب
              </h3>

              <div className="space-y-2.5">
                {[
                  { label: 'قيمة CIF (البضاعة + شحن + تأمين)', value: result.cifValue, color: 'text-foreground' },
                  { label: `رسوم جمركية (${result.dutyRate}%)`, value: result.dutyAmount, color: 'text-violet-600' },
                  { label: `ضريبة القيمة المضافة (${vatRate}%)`, value: result.vatAmount, color: 'text-blue-600' },
                  { label: 'رسوم أخرى', value: result.otherFees, color: 'text-amber-600' },
                ].map((row, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <span className="text-xs text-muted-foreground">{row.label}</span>
                    <span className={`text-sm font-bold ${row.color}`}>${row.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                ))}
              </div>

              {/* Total */}
              <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-emerald-800">إجمالي التكلفة الكاملة</span>
                  <span className="text-xl font-bold text-emerald-700">
                    ${result.totalLanded.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <p className="text-[11px] text-emerald-600 mt-1">
                  نسبة الرسوم والضرائب: {result.cifValue > 0 ? (((result.totalLanded - result.cifValue) / result.cifValue) * 100).toFixed(1) : 0}% من قيمة CIF
                </p>
                {/* Safety buffer line */}
                <div className="mt-2 flex items-center justify-between border-t border-emerald-200 pt-2">
                  <span className="text-[11px] text-amber-700 font-semibold">هامش الأمان الطارئ (5%)</span>
                  <span className="text-[11px] font-bold text-amber-700">
                    +${result.safetyBuffer.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                {/* Non-binding badge */}
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 border border-amber-300 text-[10px] font-bold text-amber-800">
                    ⚠ تقدير غير ملزم — Non-Binding Estimate
                  </span>
                </div>
              </div>

              {/* Breakdown Bar */}
              {result.totalLanded > 0 && (
                <div>
                  <p className="text-[11px] font-semibold text-muted-foreground mb-2">توزيع التكلفة</p>
                  <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
                    <div className="bg-blue-400 transition-all" style={{ width: `${(result.cifValue / result.totalLanded) * 100}%` }} title="CIF" />
                    <div className="bg-violet-500 transition-all" style={{ width: `${(result.dutyAmount / result.totalLanded) * 100}%` }} title="Duty" />
                    <div className="bg-amber-400 transition-all" style={{ width: `${(result.vatAmount / result.totalLanded) * 100}%` }} title="VAT" />
                    {result.otherFees > 0 && <div className="bg-red-400 transition-all" style={{ width: `${(result.otherFees / result.totalLanded) * 100}%` }} title="Other" />}
                  </div>
                  <div className="flex gap-3 mt-1.5 flex-wrap">
                    {[
                      { label: 'CIF', color: 'bg-blue-400' },
                      { label: 'جمارك', color: 'bg-violet-500' },
                      { label: 'ضريبة', color: 'bg-amber-400' },
                      { label: 'أخرى', color: 'bg-red-400' },
                    ].map(l => (
                      <div key={l.label} className="flex items-center gap-1">
                        <div className={`w-2 h-2 rounded-full ${l.color}`} />
                        <span className="text-[10px] text-muted-foreground">{l.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {user && (
                <button
                  onClick={saveCalculation}
                  disabled={saving || saved}
                  className="w-full h-9 border border-violet-200 text-violet-700 bg-violet-50 rounded-xl text-xs font-bold hover:bg-violet-100 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
                >
                  {saved ? (
                    <><Icon name="CheckCircleIcon" size={14} className="text-emerald-600" /> تم الحفظ</>
                  ) : saving ? (
                    <><Icon name="ArrowPathIcon" size={14} className="animate-spin" /> جاري الحفظ...</>
                  ) : (
                    <><Icon name="BookmarkIcon" size={14} /> حفظ الحساب</>
                  )}
                </button>
              )}
            </div>
          ) : (
            <div className="bg-card border border-dashed border-border rounded-2xl p-8 flex flex-col items-center justify-center gap-3 text-center">
              <div className="w-14 h-14 rounded-2xl bg-violet-50 flex items-center justify-center">
                <Icon name="CalculatorIcon" size={28} className="text-violet-400" />
              </div>
              <p className="text-sm font-semibold text-foreground">أدخل بيانات الشحنة</p>
              <p className="text-xs text-muted-foreground">سيظهر هنا تفصيل كامل للرسوم الجمركية والضرائب وإجمالي التكلفة</p>
            </div>
          )}

          {/* Info Card */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-start gap-2">
              <Icon name="InformationCircleIcon" size={15} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-amber-800 mb-1">ملاحظة</p>
                <p className="text-[11px] text-amber-700">
                  هذه الحاسبة للأغراض التقديرية فقط. الأرقام الفعلية قد تختلف بناءً على قرارات الجمارك اليمنية والاتفاقيات التجارية المعمول بها.
                </p>
              </div>
            </div>
          </div>

          {/* Legal Disclaimer */}
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="flex items-start gap-2">
              <Icon name="ExclamationTriangleIcon" size={15} className="text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-red-800 mb-1">إخلاء المسؤولية القانونية — Legal Disclaimer</p>
                <p className="text-[11px] text-red-700 leading-relaxed">
                  جميع الأرقام الواردة في هذه الحاسبة هي <strong>تقديرات غير ملزمة (isBinding: false)</strong> وتشمل هامش أمان طارئ بنسبة 5%. الأرقام الفعلية للرسوم الجمركية تخضع لاعتماد المخلص الجمركي المعتمد والسلطات الجمركية المختصة. لا تُعدّ هذه الأرقام التزاماً قانونياً أو مالياً من قِبَل منصة DirectHub.
                </p>
                <p className="text-[10px] text-red-600 mt-1.5 font-medium">
                  All figures are non-binding estimates subject to licensed customs broker approval. Actual duties may vary at port.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Shipping Documents Generator ──────────────────────────────────────────────
interface ShippingDocForm {
  document_type: 'certificate_of_origin' | 'bill_of_lading';
  exporter_name: string;
  exporter_address: string;
  exporter_country: string;
  consignee_name: string;
  consignee_address: string;
  consignee_country: string;
  goods_description: string;
  hs_code: string;
  quantity: string;
  gross_weight_kg: string;
  net_weight_kg: string;
  // COO specific
  origin_country: string;
  origin_criterion: string;
  certifying_authority: string;
  // BOL specific
  vessel_name: string;
  voyage_number: string;
  port_of_loading: string;
  port_of_discharge: string;
  bl_number: string;
  container_number: string;
  seal_number: string;
  freight_terms: string;
  incoterms: string;
  notify_party: string;
}

const EMPTY_FORM: ShippingDocForm = {
  document_type: 'certificate_of_origin',
  exporter_name: '', exporter_address: '', exporter_country: 'CN',
  consignee_name: '', consignee_address: '', consignee_country: 'YE',
  goods_description: '', hs_code: '', quantity: '',
  gross_weight_kg: '', net_weight_kg: '',
  origin_country: 'CN', origin_criterion: 'WO',
  certifying_authority: 'Chamber of Commerce',
  vessel_name: '', voyage_number: '', port_of_loading: '',
  port_of_discharge: 'Aden Port', bl_number: '',
  container_number: '', seal_number: '',
  freight_terms: 'prepaid', incoterms: 'FOB',
  notify_party: '',
};

function generateDocNumber(type: string): string {
  const prefix = type === 'certificate_of_origin' ? 'COO' : 'BL';
  const ts = Date.now().toString(36).toUpperCase();
  return `${prefix}-${ts}`;
}

function ShippingDocumentGenerator() {
  const { user } = useAuth();
  const supabase = createClient();
  const printRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState<ShippingDocForm>(EMPTY_FORM);
  const [step, setStep] = useState<'form' | 'preview'>('form');
  const [saving, setSaving] = useState(false);
  const [savedDoc, setSavedDoc] = useState<{ id: string; document_number: string } | null>(null);
  const [docNumber] = useState(() => generateDocNumber(form.document_type));

  const update = (field: keyof ShippingDocForm, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const docNum = savedDoc?.document_number || docNumber;
    const payload = {
      user_id: user.id,
      document_type: form.document_type,
      document_number: docNum,
      exporter_name: form.exporter_name,
      exporter_address: form.exporter_address,
      exporter_country: form.exporter_country,
      consignee_name: form.consignee_name,
      consignee_address: form.consignee_address,
      consignee_country: form.consignee_country,
      goods_description: form.goods_description,
      hs_code: form.hs_code || null,
      quantity: form.quantity,
      gross_weight_kg: parseFloat(form.gross_weight_kg) || null,
      net_weight_kg: parseFloat(form.net_weight_kg) || null,
      origin_country: form.origin_country || null,
      origin_criterion: form.origin_criterion || null,
      certifying_authority: form.certifying_authority || null,
      vessel_name: form.vessel_name || null,
      voyage_number: form.voyage_number || null,
      port_of_loading: form.port_of_loading || null,
      port_of_discharge: form.port_of_discharge || null,
      bl_number: form.bl_number || null,
      container_number: form.container_number || null,
      seal_number: form.seal_number || null,
      freight_terms: form.freight_terms || null,
      incoterms: form.incoterms || null,
      notify_party: form.notify_party || null,
      status: 'issued',
      issued_at: new Date().toISOString(),
    };
    const { data } = await supabase.from('shipping_documents').insert(payload).select('id, document_number').single();
    if (data) setSavedDoc(data);
    setSaving(false);
  };

  const handlePrint = () => {
    if (!printRef.current) return;
    const content = printRef.current.innerHTML;
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) return;
    win.document.write(`
      <html><head><title>${form.document_type === 'certificate_of_origin' ? 'Certificate of Origin' : 'Bill of Lading'}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; color: #111; }
        table { width: 100%; border-collapse: collapse; }
        td, th { border: 1px solid #333; padding: 6px 10px; font-size: 12px; }
        th { background: #f0f0f0; font-weight: bold; }
        .header { text-align: center; margin-bottom: 20px; }
        .header h1 { font-size: 20px; text-transform: uppercase; letter-spacing: 2px; }
        .section-title { background: #1a1a2e; color: white; padding: 6px 10px; font-size: 12px; font-weight: bold; margin-top: 12px; }
        .footer { margin-top: 30px; display: flex; justify-content: space-between; }
        .sig-box { border-top: 2px solid #333; width: 200px; padding-top: 8px; font-size: 11px; text-align: center; }
      </style></head><body>${content}</body></html>
    `);
    win.document.close();
    win.print();
  };

  const isCOO = form.document_type === 'certificate_of_origin';

  return (
    <div className="space-y-5" dir="rtl">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-cyan-600 rounded-2xl p-5 text-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
            <Icon name="DocumentDuplicateIcon" size={22} className="text-white" />
          </div>
          <div>
            <h2 className="font-bold text-lg">مولّد مستندات الشحن الرسمية</h2>
            <p className="text-white/80 text-xs">شهادة المنشأ • بوليصة الشحن</p>
          </div>
        </div>
      </div>

      {/* Doc Type Toggle */}
      <div className="flex gap-2 bg-muted/50 rounded-xl p-1 border border-border">
        {[
          { key: 'certificate_of_origin', label: 'شهادة المنشأ', icon: 'DocumentCheckIcon' },
          { key: 'bill_of_lading', label: 'بوليصة الشحن', icon: 'TruckIcon' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => { update('document_type', t.key as any); setStep('form'); setSavedDoc(null); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              form.document_type === t.key
                ? 'bg-card text-foreground shadow-sm border border-border'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon name={t.icon as any} size={15} />
            {t.label}
          </button>
        ))}
      </div>

      {step === 'form' ? (
        <div className="space-y-4">
          {/* Exporter / Consignee */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
              <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Icon name="BuildingOfficeIcon" size={13} className="text-blue-600" />
                بيانات المُصدِّر / المصنع
              </h4>
              {[
                { field: 'exporter_name', label: 'اسم الشركة / المصنع', placeholder: 'اسم المصنع المُصدِّر' },
                { field: 'exporter_address', label: 'العنوان', placeholder: 'عنوان المصنع' },
                { field: 'exporter_country', label: 'الدولة', placeholder: 'CN' },
              ].map(f => (
                <div key={f.field}>
                  <label className="text-[11px] font-semibold text-muted-foreground mb-1 block">{f.label}</label>
                  <input
                    value={form[f.field as keyof ShippingDocForm]}
                    onChange={e => update(f.field as keyof ShippingDocForm, e.target.value)}
                    placeholder={f.placeholder}
                    className="w-full h-9 px-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary"
                  />
                </div>
              ))}
            </div>
            <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
              <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Icon name="UserIcon" size={13} className="text-emerald-600" />
                بيانات المُستلِم / المستورد
              </h4>
              {[
                { field: 'consignee_name', label: 'اسم المستورد', placeholder: 'اسم الشركة المستوردة' },
                { field: 'consignee_address', label: 'العنوان', placeholder: 'عنوان المستورد' },
                { field: 'consignee_country', label: 'الدولة', placeholder: 'YE' },
              ].map(f => (
                <div key={f.field}>
                  <label className="text-[11px] font-semibold text-muted-foreground mb-1 block">{f.label}</label>
                  <input
                    value={form[f.field as keyof ShippingDocForm]}
                    onChange={e => update(f.field as keyof ShippingDocForm, e.target.value)}
                    placeholder={f.placeholder}
                    className="w-full h-9 px-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Goods Info */}
          <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
            <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Icon name="ArchiveBoxIcon" size={13} className="text-amber-600" />
              بيانات البضاعة
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground mb-1 block">وصف البضاعة</label>
                <input
                  value={form.goods_description}
                  onChange={e => update('goods_description', e.target.value)}
                  placeholder="وصف تفصيلي للبضاعة"
                  className="w-full h-9 px-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground mb-1 block">كود HS</label>
                <input
                  value={form.hs_code}
                  onChange={e => update('hs_code', e.target.value)}
                  placeholder="مثال: 8471.30"
                  className="w-full h-9 px-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground mb-1 block">الكمية</label>
                <input
                  value={form.quantity}
                  onChange={e => update('quantity', e.target.value)}
                  placeholder="مثال: 500 قطعة"
                  className="w-full h-9 px-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground mb-1 block">الوزن الإجمالي (كغ)</label>
                  <input
                    type="number"
                    value={form.gross_weight_kg}
                    onChange={e => update('gross_weight_kg', e.target.value)}
                    placeholder="0"
                    className="w-full h-9 px-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground mb-1 block">الوزن الصافي (كغ)</label>
                  <input
                    type="number"
                    value={form.net_weight_kg}
                    onChange={e => update('net_weight_kg', e.target.value)}
                    placeholder="0"
                    className="w-full h-9 px-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* COO Specific */}
          {isCOO && (
            <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
              <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Icon name="FlagIcon" size={13} className="text-violet-600" />
                بيانات شهادة المنشأ
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground mb-1 block">بلد المنشأ</label>
                  <input value={form.origin_country} onChange={e => update('origin_country', e.target.value)} placeholder="CN" className="w-full h-9 px-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground mb-1 block">معيار المنشأ</label>
                  <select value={form.origin_criterion} onChange={e => update('origin_criterion', e.target.value)} className="w-full h-9 px-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary">
                    <option value="WO">WO — كلياً من المنشأ</option>
                    <option value="PE">PE — إنتاج كامل</option>
                    <option value="PSR">PSR — قاعدة خاصة بالمنتج</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground mb-1 block">جهة الإصدار</label>
                  <input value={form.certifying_authority} onChange={e => update('certifying_authority', e.target.value)} placeholder="غرفة التجارة" className="w-full h-9 px-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary" />
                </div>
              </div>
            </div>
          )}

          {/* BOL Specific */}
          {!isCOO && (
            <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
              <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Icon name="TruckIcon" size={13} className="text-cyan-600" />
                بيانات بوليصة الشحن
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { field: 'vessel_name', label: 'اسم السفينة', placeholder: 'MSC DIANA' },
                  { field: 'voyage_number', label: 'رقم الرحلة', placeholder: 'V.001E' },
                  { field: 'port_of_loading', label: 'ميناء الشحن', placeholder: 'Shanghai Port' },
                  { field: 'port_of_discharge', label: 'ميناء التفريغ', placeholder: 'Aden Port' },
                  { field: 'bl_number', label: 'رقم B/L', placeholder: 'MSCUBL123456' },
                  { field: 'container_number', label: 'رقم الحاوية', placeholder: 'MSCU1234567' },
                  { field: 'seal_number', label: 'رقم الختم', placeholder: 'SL-001' },
                  { field: 'notify_party', label: 'جهة الإشعار', placeholder: 'اسم الشركة' },
                ].map(f => (
                  <div key={f.field}>
                    <label className="text-[11px] font-semibold text-muted-foreground mb-1 block">{f.label}</label>
                    <input
                      value={form[f.field as keyof ShippingDocForm]}
                      onChange={e => update(f.field as keyof ShippingDocForm, e.target.value)}
                      placeholder={f.placeholder}
                      className="w-full h-9 px-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary"
                    />
                  </div>
                ))}
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground mb-1 block">شروط الشحن</label>
                  <select value={form.freight_terms} onChange={e => update('freight_terms', e.target.value)} className="w-full h-9 px-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary">
                    <option value="prepaid">Prepaid — مدفوع مسبقاً</option>
                    <option value="collect">Collect — يُحصَّل عند الوصول</option>
                    <option value="as_arranged">As Arranged — حسب الاتفاق</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground mb-1 block">Incoterms</label>
                  <select value={form.incoterms} onChange={e => update('incoterms', e.target.value)} className="w-full h-9 px-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary">
                    {['EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP'].map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={() => setStep('preview')}
            disabled={!form.exporter_name || !form.consignee_name || !form.goods_description}
            className="w-full h-11 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            <Icon name="EyeIcon" size={16} />
            معاينة المستند
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Preview */}
          <div ref={printRef} className="bg-white border-2 border-gray-300 rounded-2xl p-6 text-gray-900 font-sans">
            {/* Document Header */}
            <div className="text-center border-b-2 border-gray-800 pb-4 mb-4">
              <div className="flex items-center justify-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">
                  <span className="text-white font-bold text-sm">DH</span>
                </div>
                <div>
                  <p className="text-xs text-gray-500">DirectHub B2B Platform</p>
                  <p className="text-[10px] text-gray-400">direct-hub.net</p>
                </div>
              </div>
              <h1 className="text-xl font-bold uppercase tracking-widest text-gray-900">
                {isCOO ? 'CERTIFICATE OF ORIGIN' : 'BILL OF LADING'}
              </h1>
              <p className="text-sm text-gray-600 mt-0.5">
                {isCOO ? 'شهادة المنشأ' : 'بوليصة الشحن'}
              </p>
              <div className="mt-2 flex items-center justify-center gap-4 text-xs text-gray-500">
                <span>No: <strong className="text-gray-800">{savedDoc?.document_number || docNumber}</strong></span>
                <span>Date: <strong className="text-gray-800">{new Date().toLocaleDateString('en-GB')}</strong></span>
              </div>
            </div>

            {/* Exporter / Consignee */}
            <table className="w-full border-collapse mb-4 text-xs">
              <tbody>
                <tr>
                  <td className="border border-gray-300 p-3 w-1/2 align-top">
                    <p className="font-bold text-gray-700 mb-1 uppercase text-[10px]">Exporter / Shipper</p>
                    <p className="font-semibold">{form.exporter_name || '—'}</p>
                    <p className="text-gray-600">{form.exporter_address}</p>
                    <p className="text-gray-600">{form.exporter_country}</p>
                  </td>
                  <td className="border border-gray-300 p-3 w-1/2 align-top">
                    <p className="font-bold text-gray-700 mb-1 uppercase text-[10px]">Consignee</p>
                    <p className="font-semibold">{form.consignee_name || '—'}</p>
                    <p className="text-gray-600">{form.consignee_address}</p>
                    <p className="text-gray-600">{form.consignee_country}</p>
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Goods */}
            <table className="w-full border-collapse mb-4 text-xs">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 p-2 text-left">Description of Goods</th>
                  <th className="border border-gray-300 p-2 text-left">HS Code</th>
                  <th className="border border-gray-300 p-2 text-left">Quantity</th>
                  <th className="border border-gray-300 p-2 text-left">Gross Wt (kg)</th>
                  <th className="border border-gray-300 p-2 text-left">Net Wt (kg)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-gray-300 p-2">{form.goods_description || '—'}</td>
                  <td className="border border-gray-300 p-2">{form.hs_code || '—'}</td>
                  <td className="border border-gray-300 p-2">{form.quantity || '—'}</td>
                  <td className="border border-gray-300 p-2">{form.gross_weight_kg || '—'}</td>
                  <td className="border border-gray-300 p-2">{form.net_weight_kg || '—'}</td>
                </tr>
              </tbody>
            </table>

            {/* COO Specific Section */}
            {isCOO && (
              <table className="w-full border-collapse mb-4 text-xs">
                <tbody>
                  <tr>
                    <td className="border border-gray-300 p-3 w-1/3">
                      <p className="font-bold text-gray-700 uppercase text-[10px] mb-1">Country of Origin</p>
                      <p className="font-semibold">{form.origin_country}</p>
                    </td>
                    <td className="border border-gray-300 p-3 w-1/3">
                      <p className="font-bold text-gray-700 uppercase text-[10px] mb-1">Origin Criterion</p>
                      <p className="font-semibold">{form.origin_criterion}</p>
                    </td>
                    <td className="border border-gray-300 p-3 w-1/3">
                      <p className="font-bold text-gray-700 uppercase text-[10px] mb-1">Certifying Authority</p>
                      <p className="font-semibold">{form.certifying_authority}</p>
                    </td>
                  </tr>
                </tbody>
              </table>
            )}

            {/* BOL Specific Section */}
            {!isCOO && (
              <table className="w-full border-collapse mb-4 text-xs">
                <tbody>
                  <tr>
                    <td className="border border-gray-300 p-2">
                      <p className="font-bold text-[10px] text-gray-600 uppercase mb-0.5">Vessel / Voyage</p>
                      <p>{form.vessel_name} / {form.voyage_number}</p>
                    </td>
                    <td className="border border-gray-300 p-2">
                      <p className="font-bold text-[10px] text-gray-600 uppercase mb-0.5">Port of Loading</p>
                      <p>{form.port_of_loading || '—'}</p>
                    </td>
                    <td className="border border-gray-300 p-2">
                      <p className="font-bold text-[10px] text-gray-600 uppercase mb-0.5">Port of Discharge</p>
                      <p>{form.port_of_discharge || '—'}</p>
                    </td>
                    <td className="border border-gray-300 p-2">
                      <p className="font-bold text-[10px] text-gray-600 uppercase mb-0.5">Incoterms</p>
                      <p>{form.incoterms}</p>
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 p-2">
                      <p className="font-bold text-[10px] text-gray-600 uppercase mb-0.5">B/L Number</p>
                      <p>{form.bl_number || '—'}</p>
                    </td>
                    <td className="border border-gray-300 p-2">
                      <p className="font-bold text-[10px] text-gray-600 uppercase mb-0.5">Container No.</p>
                      <p>{form.container_number || '—'}</p>
                    </td>
                    <td className="border border-gray-300 p-2">
                      <p className="font-bold text-[10px] text-gray-600 uppercase mb-0.5">Seal No.</p>
                      <p>{form.seal_number || '—'}</p>
                    </td>
                    <td className="border border-gray-300 p-2">
                      <p className="font-bold text-[10px] text-gray-600 uppercase mb-0.5">Freight Terms</p>
                      <p className="capitalize">{form.freight_terms?.replace('_', ' ')}</p>
                    </td>
                  </tr>
                  {form.notify_party && (
                    <tr>
                      <td colSpan={4} className="border border-gray-300 p-2">
                        <p className="font-bold text-[10px] text-gray-600 uppercase mb-0.5">Notify Party</p>
                        <p>{form.notify_party}</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            {/* Signature */}
            <div className="flex justify-between items-end mt-6 pt-4 border-t border-gray-300">
              <div>
                <div className="w-40 border-t-2 border-gray-800 pt-2">
                  <p className="text-[10px] text-gray-600">Authorized Signature</p>
                  <p className="text-[10px] text-gray-500">{form.exporter_name}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-gray-500">Issued via DirectHub Platform</p>
                <p className="text-[10px] text-gray-400">direct-hub.net</p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={() => setStep('form')}
              className="flex items-center gap-2 px-4 py-2.5 border border-border rounded-xl text-sm font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
            >
              <Icon name="PencilSquareIcon" size={14} />
              تعديل
            </button>
            {user && (
              <button
                onClick={handleSave}
                disabled={saving || !!savedDoc}
                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 disabled:opacity-60 transition-colors"
              >
                {savedDoc ? (
                  <><Icon name="CheckCircleIcon" size={14} /> تم الحفظ</>
                ) : saving ? (
                  <><Icon name="ArrowPathIcon" size={14} className="animate-spin" /> جاري الحفظ...</>
                ) : (
                  <><Icon name="CloudArrowUpIcon" size={14} /> حفظ المستند</>
                )}
              </button>
            )}
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors"
            >
              <Icon name="PrinterIcon" size={14} />
              طباعة / PDF
            </button>
          </div>

          {savedDoc && (
            <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
              <Icon name="CheckCircleIcon" size={16} className="text-emerald-600 shrink-0" />
              <p className="text-xs text-emerald-800">
                تم حفظ المستند برقم: <strong>{savedDoc.document_number}</strong>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function LogisticsMarketplacePage() {
  const { t, dir } = useLanguage();
  const lp = t.logisticsPage;

  const { user } = useAuth();
  const supabase = createClient();

  const [partners, setPartners] = useState<LogisticsPartner[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategoryGroup, setActiveCategoryGroup] = useState('all');
  const [filterOrigin, setFilterOrigin] = useState('');
  const [filterDest, setFilterDest] = useState('');
  const [selectedPartner, setSelectedPartner] = useState<LogisticsPartner | null>(null);
  const [chatMessage, setChatMessage] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatSuccess, setChatSuccess] = useState(false);
  const [activeMainTab, setActiveMainTab] = useState<'partners' | 'calculator' | 'documents'>('partners');

  useEffect(() => {
    fetchPartners();
  }, []);

  const fetchPartners = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('logistics_partners')
      .select('*')
      .eq('status', 'approved')
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    setPartners(data || []);
    setLoading(false);
  };

  const filtered = partners.filter(p => {
    const q = searchQuery.toLowerCase();
    const matchSearch = !q || p.company_name.toLowerCase().includes(q) || p.country.toLowerCase().includes(q) || p.city.toLowerCase().includes(q);
    const matchGroup = activeCategoryGroup === 'all' || getCategoryGroup(p) === activeCategoryGroup;
    const matchOrigin = !filterOrigin || p.origin_countries?.includes(filterOrigin);
    const matchDest = !filterDest || p.destination_countries?.includes(filterDest) || p.local_coverage_country === filterDest;
    return matchSearch && matchGroup && matchOrigin && matchDest;
  });

  const startChat = async () => {
    if (!user || !selectedPartner || !chatMessage.trim()) return;
    setChatLoading(true);
    try {
      const { data: existingConv } = await supabase
        .from('logistics_conversations')
        .select('id')
        .eq('buyer_id', user.id)
        .eq('partner_id', selectedPartner.id)
        .single();

      let convId = existingConv?.id;
      if (!convId) {
        const { data: newConv } = await supabase
          .from('logistics_conversations')
          .insert({ buyer_id: user.id, partner_id: selectedPartner.id })
          .select('id')
          .single();
        convId = newConv?.id;
      }

      if (convId) {
        await supabase.from('logistics_messages').insert({
          conversation_id: convId,
          sender_id: user.id,
          sender_role: 'buyer',
          content: chatMessage.trim(),
        });
        await supabase.from('logistics_conversations').update({
          last_message: chatMessage.trim(),
          last_message_at: new Date().toISOString(),
          partner_unread: 1,
        }).eq('id', convId);
        setChatSuccess(true);
        setChatMessage('');
        setTimeout(() => { setChatSuccess(false); setSelectedPartner(null); }, 2500);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setChatLoading(false);
    }
  };

  const groupCounts = {
    all: partners.length,
    international: partners.filter(p => getCategoryGroup(p) === 'international').length,
    local: partners.filter(p => getCategoryGroup(p) === 'local').length,
    customs: partners.filter(p => getCategoryGroup(p) === 'customs').length,
  };

  const MAIN_TABS = [
    { key: 'partners', label: 'شركاء اللوجستيات', icon: 'BuildingOffice2Icon' },
    { key: 'calculator', label: 'حاسبة الجمارك', icon: 'CalculatorIcon' },
    { key: 'documents', label: 'مستندات الشحن', icon: 'DocumentDuplicateIcon' },
  ] as const;

  return (
    <div className="min-h-screen bg-background" dir={dir}>
      <Header />
      <div className="max-w-5xl mx-auto px-4 py-8 pb-24">
        {/* Header */}
        <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{lp.title}</h1>
            <p className="text-muted-foreground text-sm mt-1">{lp.subtitle}</p>
          </div>
          <Link
            href="/logistics/register"
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:opacity-90 transition-opacity"
          >
            <Icon name="UserPlusIcon" size={16} />
            {lp.registerCta}
          </Link>
        </div>

        {/* Main Tabs */}
        <div className="flex gap-1 bg-muted/50 rounded-xl p-1 border border-border mb-6">
          {MAIN_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveMainTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg text-xs font-semibold transition-all ${
                activeMainTab === tab.key
                  ? 'bg-card text-foreground shadow-sm border border-border'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon name={tab.icon as any} size={14} />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
            </button>
          ))}
        </div>

        {/* Partners Tab */}
        {activeMainTab === 'partners' && (
          <>
            {/* Category Group Tabs */}
            <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
              {CATEGORY_GROUPS.map(grp => (
                <button
                  key={grp.key}
                  onClick={() => setActiveCategoryGroup(grp.key)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all border ${
                    activeCategoryGroup === grp.key
                      ? `${grp.activeBg} border-transparent shadow-sm`
                      : 'bg-card border-border text-muted-foreground hover:border-primary/30'
                  }`}
                >
                  <Icon name={grp.icon as any} size={15} />
                  {grp.labelKey}
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                    activeCategoryGroup === grp.key ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground'
                  }`}>
                    {groupCounts[grp.key as keyof typeof groupCounts] ?? 0}
                  </span>
                </button>
              ))}
            </div>

            {/* Filters */}
            <div className="bg-card border border-border rounded-2xl p-4 mb-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="relative">
                  <Icon name="MagnifyingGlassIcon" size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder={lp.searchPlaceholder}
                    className="w-full h-10 pr-9 pl-4 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary"
                  />
                </div>
                <input
                  value={filterOrigin}
                  onChange={e => setFilterOrigin(e.target.value)}
                  placeholder={lp.originPlaceholder}
                  className="h-10 px-4 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary"
                />
                <input
                  value={filterDest}
                  onChange={e => setFilterDest(e.target.value)}
                  placeholder={lp.destPlaceholder}
                  className="h-10 px-4 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            {/* Results */}
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Icon name="ArrowPathIcon" size={32} className="animate-spin text-primary" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-20">
                <Icon name="TruckIcon" size={48} className="text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">{lp.emptyCategory}</p>
                <p className="text-sm text-muted-foreground mt-1">{lp.emptyHint}</p>
                <Link href="/logistics/register" className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:opacity-90 transition-opacity">
                  <Icon name="UserPlusIcon" size={15} />
                  {lp.registerCta}
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filtered.map(partner => {
                  const typeIcon = PARTNER_TYPE_ICONS[partner.partner_type] || 'TruckIcon';
                  const typeColor = PARTNER_TYPE_COLORS[partner.partner_type] || 'text-gray-600';
                  const typeBg = PARTNER_BG_COLORS[partner.partner_type] || 'bg-gray-100';
                  return (
                    <div key={partner.id} className="bg-card border border-border rounded-2xl p-5 hover:border-primary/40 transition-colors">
                      <div className="flex items-start gap-3 mb-4">
                        <div className={`w-11 h-11 rounded-xl ${typeBg} flex items-center justify-center shrink-0`}>
                          <Icon name={typeIcon as any} size={22} className={typeColor} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-foreground truncate">{partner.company_name}</h3>
                          <p className="text-xs text-muted-foreground">{PARTNER_TYPE_LABELS[partner.partner_type] || partner.partner_type}</p>
                        </div>
                        <span className="px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-[10px] font-bold shrink-0">{(t.logisticsPage?.verifiedBadge || "Verified")}</span>
                      </div>

                      <div className="space-y-1.5 mb-4">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Icon name="MapPinIcon" size={13} className="shrink-0" />
                          <span>{partner.city}, {partner.country}</span>
                        </div>
                        {partner.operating_hub && (
                          <div className="flex items-center gap-2 text-xs text-blue-600">
                            <Icon name="BuildingOfficeIcon" size={13} className="shrink-0" />
                            <span>{lp.worksFrom?.replace("{hub}", partner.operating_hub)}</span>
                          </div>
                        )}
                        {partner.base_rate_usd && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Icon name="CurrencyDollarIcon" size={13} className="shrink-0" />
                            <span>{lp.fromRate?.replace("{rate}", String(partner.base_rate_usd))} {partner.rate_description || 'USD'}</span>
                          </div>
                        )}
                      </div>

                      {(partner.origin_countries?.length > 0 || partner.destination_countries?.length > 0) && (
                        <div className="mb-4 p-3 bg-muted/30 rounded-xl">
                          <p className="text-[10px] font-bold text-muted-foreground mb-2">{lp.coveredRoutes}</p>
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="flex flex-wrap gap-1">
                              {partner.origin_countries?.slice(0, 3).map(c => (
                                <span key={c} className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px]">{c}</span>
                              ))}
                            </div>
                            {partner.origin_countries?.length > 0 && partner.destination_countries?.length > 0 && (
                              <Icon name="ArrowLeftIcon" size={12} className="text-muted-foreground shrink-0" />
                            )}
                            <div className="flex flex-wrap gap-1">
                              {partner.destination_countries?.slice(0, 3).map(c => (
                                <span key={c} className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[10px]">{c}</span>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {partner.services_offered?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-4">
                          {partner.services_offered.slice(0, 4).map(s => (
                            <span key={s} className="px-2 py-0.5 bg-muted text-muted-foreground rounded-lg text-[10px]">{s}</span>
                          ))}
                        </div>
                      )}

                      <button
                        onClick={() => setSelectedPartner(partner)}
                        className="w-full h-9 bg-primary/10 text-primary border border-primary/20 rounded-xl text-xs font-bold hover:bg-primary hover:text-primary-foreground transition-colors flex items-center justify-center gap-2"
                      >
                        <Icon name="ChatBubbleLeftRightIcon" size={14} />
                        {lp.contactPartner}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Calculator Tab */}
        {activeMainTab === 'calculator' && <CustomsDutyCalculator />}

        {/* Documents Tab */}
        {activeMainTab === 'documents' && <ShippingDocumentGenerator />}
      </div>

      {/* Chat Modal */}
      {selectedPartner && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background" dir={dir}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-card shrink-0">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl ${PARTNER_BG_COLORS[selectedPartner.partner_type] || 'bg-gray-100'} flex items-center justify-center`}>
                <Icon name={(PARTNER_TYPE_ICONS[selectedPartner.partner_type] || 'TruckIcon') as any} size={18} className={PARTNER_TYPE_COLORS[selectedPartner.partner_type] || 'text-gray-600'} />
              </div>
              <div>
                <p className="font-bold text-foreground text-sm">{selectedPartner.company_name}</p>
                <p className="text-[10px] text-muted-foreground">{PARTNER_TYPE_LABELS[selectedPartner.partner_type]}</p>
              </div>
            </div>
            <button onClick={() => { setSelectedPartner(null); setChatSuccess(false); setChatMessage(''); }} className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center">
              <Icon name="XMarkIcon" size={16} className="text-muted-foreground" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 pb-24 md:pb-6">
            {chatSuccess ? (
              <div className="text-center py-6">
                <Icon name="CheckCircleIcon" size={44} className="text-emerald-500 mx-auto mb-3" />
                <p className="font-bold text-foreground">{lp.messageSent}</p>
                <p className="text-sm text-muted-foreground mt-1">{lp.messageSentDesc}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {!user && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                    <p className="text-xs text-amber-800">{lp.mustLogin} <Link href="/login" className="font-bold underline">{lp.loginLink}</Link> {lp.toContact}</p>
                  </div>
                )}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">{lp.yourMessage}</label>
                  <textarea
                    value={chatMessage}
                    onChange={e => setChatMessage(e.target.value)}
                    placeholder={lp.messagePlaceholder}
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary resize-none"
                  />
                </div>
                <button
                  onClick={startChat}
                  disabled={chatLoading || !chatMessage.trim() || !user}
                  className="w-full h-11 bg-primary text-primary-foreground rounded-xl text-sm font-bold disabled:opacity-50 hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                >
                  {chatLoading ? <Icon name="ArrowPathIcon" size={14} className="animate-spin" /> : <Icon name="PaperAirplaneIcon" size={14} />}
                  {lp.sendMessage}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
