'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { sendOtpEmail, sendOrderConfirmationEmail } from '@/lib/email';
import { sendDualNotification } from '@/lib/notificationService';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import Icon from '@/components/ui/AppIcon';
import AppImage from '@/components/ui/AppImage';
import { useCart } from '@/contexts/CartContext';
import PaymentGatewaySelector, { PaymentGatewayState } from './components/PaymentGatewaySelector';
import SellerFulfillmentSelector, { SellerFulfillmentState, FulfillmentType, IncotermType } from './components/SellerFulfillmentSelector';
import { signRequest } from '@/lib/securitySigner';

import { useLanguage } from '@/contexts/LanguageContext';

interface CartItem {
  id: string;
  name: string;
  image: string;
  alt: string;
  price: number;
  currency: string;
  quantity: number;
  supplier: string;
}

type Step = 'shipping' | 'payment' | 'review' | 'otp' | 'confirmed';

// ── Commission Engine ──────────────────────────────────────────────────────────
type OrderCategory = 'large_deal' | 'retail' | 'wholesale' | 'bulk_wholesale';

interface CommissionResult {
  amount: number;
  rateLabel: string;
  description: string;
}

function calculateCommission(category: OrderCategory, orderTotal: number, containerCount: number): CommissionResult {
  switch (category) {
    case 'large_deal':
      return {
        amount: 150 * containerCount,
        rateLabel: `$150 × ${containerCount} containers`,
        description: 'Fixed fee per container ($100–$200 range, avg $150)'
      };
    case 'retail':
      return {
        amount: orderTotal * 0.035,
        rateLabel: '3.5% of order total',
        description: 'Retail / B2C order commission'
      };
    case 'wholesale':
      return {
        amount: orderTotal * 0.025,
        rateLabel: '2.5% of order total',
        description: 'Wholesale / B2B order commission'
      };
    case 'bulk_wholesale':
      return {
        amount: orderTotal * 0.015,
        rateLabel: '1.5% of order total',
        description: 'Bulk wholesale commission'
      };
    default:
      return { amount: 0, rateLabel: '—', description: '' };
  }
}

const ORDER_CATEGORY_OPTIONS: {value: OrderCategory;label: string;sublabel: string;icon: string;}[] = [
{ value: 'retail', labelKey: 'retail', subKey: 'retailSub', icon: 'ShoppingBagIcon' },
{ value: 'wholesale', labelKey: 'wholesale', subKey: 'wholesaleSub', icon: 'BuildingStorefrontIcon' },
{ value: 'bulk_wholesale', labelKey: 'bulkWholesale', subKey: 'bulkWholesaleSub', icon: 'CubeIcon' },
{ value: 'large_deal', labelKey: 'largeDeal', subKey: 'largeDealSub', icon: 'TruckIcon' }];

// ─────────────────────────────────────────────────────────────────────────────

// ── Wire Transfer OCR Verification Component ─────────────────────────────────
interface WireOCRResult {
  amount: number | null;
  currency: string | null;
  sender_name: string | null;
  bank_name: string | null;
  swift_code: string | null;
  reference_number: string | null;
  transfer_date: string | null;
  confidence: number;
  is_authentic: boolean;
  notes: string;
}

const WireTransferOCRVerifier: React.FC<{
  orderId?: string;
  onVerified: (result: WireOCRResult) => void;
}> = ({ orderId, onVerified }) => {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [ocrResult, setOcrResult] = useState<WireOCRResult | null>(null);
  const [error, setError] = useState('');
  const fileRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setError('الحد الأقصى لحجم الملف 10MB'); return; }
    setImageFile(file);
    setOcrResult(null);
    setError('');
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleAnalyze = async () => {
    if (!imageFile || !imagePreview) return;
    setAnalyzing(true);
    setError('');
    try {
      const base64 = imagePreview.split(',')[1];
      const mimeType = imageFile.type || 'image/jpeg';
      const res = await fetch('/api/escrow/wire-ocr-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType, orderId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل التحليل');
      setOcrResult(data.ocrResult);
      if (data.verified) onVerified(data.ocrResult);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="border border-blue-200 bg-blue-50/50 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
          <Icon name="DocumentMagnifyingGlassIcon" size={16} className="text-blue-700" />
        </div>
        <div>
          <p className="text-sm font-bold text-blue-900">تحقق OCR من إيصال SWIFT</p>
          <p className="text-xs text-blue-600">ارفع صورة إيصال التحويل البنكي للتحقق التلقائي بالذكاء الاصطناعي</p>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />

      {!imagePreview ? (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex-1 h-10 border-2 border-dashed border-blue-300 rounded-xl text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors flex items-center justify-center gap-2"
          >
            <Icon name="PhotoIcon" size={15} />
            رفع صورة الإيصال
          </button>
          <button
            type="button"
            onClick={() => { if (fileRef.current) { fileRef.current.setAttribute('capture', 'environment'); fileRef.current.click(); } }}
            className="h-10 px-4 border-2 border-dashed border-blue-300 rounded-xl text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors flex items-center justify-center gap-1.5"
          >
            <Icon name="CameraIcon" size={15} />
            كاميرا
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="relative">
            <img src={imagePreview} alt="Wire transfer receipt" className="w-full max-h-40 object-contain rounded-lg border border-blue-200 bg-white" />
            <button
              type="button"
              onClick={() => { setImageFile(null); setImagePreview(null); setOcrResult(null); }}
              className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
            >
              <Icon name="XMarkIcon" size={12} />
            </button>
          </div>
          {!ocrResult && (
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={analyzing}
              className="w-full h-10 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {analyzing ? (
                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> جاري التحليل بـ Gemini Vision...</>
              ) : (
                <><Icon name="SparklesIcon" size={15} /> تحليل الإيصال بالذكاء الاصطناعي</>
              )}
            </button>
          )}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-xs">{error}</div>
      )}

      {ocrResult && (
        <div className={`rounded-xl border p-3 space-y-2 ${ocrResult.is_authentic && ocrResult.confidence >= 70 ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
          <div className="flex items-center gap-2">
            <Icon
              name={ocrResult.is_authentic && ocrResult.confidence >= 70 ? 'CheckBadgeIcon' : 'ExclamationTriangleIcon'}
              size={16}
              className={ocrResult.is_authentic && ocrResult.confidence >= 70 ? 'text-emerald-600' : 'text-amber-600'}
            />
            <p className={`text-xs font-bold ${ocrResult.is_authentic && ocrResult.confidence >= 70 ? 'text-emerald-800' : 'text-amber-800'}`}>
              {ocrResult.is_authentic && ocrResult.confidence >= 70
                ? `✅ تم التحقق — ثقة ${ocrResult.confidence}%`
                : `⚠️ يتطلب مراجعة يدوية — ثقة ${ocrResult.confidence}%`}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-1.5 text-xs">
            {ocrResult.amount && <div className="bg-white/70 rounded-lg px-2 py-1.5"><span className="text-gray-500">المبلغ: </span><span className="font-bold">{ocrResult.amount} {ocrResult.currency}</span></div>}
            {ocrResult.sender_name && <div className="bg-white/70 rounded-lg px-2 py-1.5"><span className="text-gray-500">المُرسِل: </span><span className="font-bold">{ocrResult.sender_name}</span></div>}
            {ocrResult.bank_name && <div className="bg-white/70 rounded-lg px-2 py-1.5"><span className="text-gray-500">البنك: </span><span className="font-bold">{ocrResult.bank_name}</span></div>}
            {ocrResult.swift_code && <div className="bg-white/70 rounded-lg px-2 py-1.5"><span className="text-gray-500">SWIFT: </span><span className="font-bold">{ocrResult.swift_code}</span></div>}
            {ocrResult.reference_number && <div className="bg-white/70 rounded-lg px-2 py-1.5 col-span-2"><span className="text-gray-500">المرجع: </span><span className="font-bold">{ocrResult.reference_number}</span></div>}
          </div>
          {ocrResult.notes && <p className="text-xs text-gray-600 italic">{ocrResult.notes}</p>}
        </div>
      )}
    </div>
  );
};

const BANK_DETAILS = {
  bankName: 'Al Rajhi Bank',
  accountName: 'DirectHub Platform Co.',
  accountNumber: '1234567890123456',
  iban: 'SA0380000000608010167519',
  swift: 'RJHISARI',
  currency: 'SAR / USD'
};

const STEP_CONFIG: { key: Step; label: string; icon: string }[] = [
  { key: 'shipping', label: 'Shipping', icon: 'TruckIcon' },
  { key: 'payment', label: 'Payment', icon: 'BuildingLibraryIcon' },
  { key: 'review', label: 'Review', icon: 'ClipboardDocumentListIcon' },
  { key: 'otp', label: 'Verify', icon: 'ShieldCheckIcon' },
];

// ── Policy Modal (Refund → Buyer Protection → Work Mechanism) ─────────────────
type PolicyStep = 1 | 2 | 3;

const CheckoutPolicyModal: React.FC<{ onClose: () => void; initialStep?: PolicyStep }> = ({ onClose, initialStep = 1 }) => {
  const { t, dir, isRTL, language } = useLanguage();
  const C = t.checkout;
  const P = t.checkout.policies;
  const G = t.checkout.logistics;
  const [step, setStep] = React.useState<PolicyStep>(initialStep);

  const advance = () => {
    if (step === 1) setStep(2);
    else if (step === 2) setStep(3);
    else onClose();
  };

  const stepLabels: Record<PolicyStep, string> = {
    1: P.titleRefund,
    2: P.titleProtection,
    3: P.titleTriple,
  };
  const stepColors: Record<PolicyStep, string> = {
    1: 'from-amber-600 to-amber-500',
    2: 'from-green-600 to-green-500',
    3: 'from-indigo-700 to-indigo-500',
  };
  const btnColors: Record<PolicyStep, string> = {
    1: 'bg-amber-600 hover:bg-amber-700',
    2: 'bg-green-600 hover:bg-green-700',
    3: 'bg-indigo-600 hover:bg-indigo-700',
  };
  const stepIcons: Record<PolicyStep, string> = {
    1: 'ArrowUturnLeftIcon',
    2: 'ShieldCheckIcon',
    3: 'CogIcon',
  };
  const stepSubtitles: Record<PolicyStep, string> = {
    1: 'Refund Policy — Direct Hub',
    2: P.subtitleProtection,
    3: P.subtitleTriple,
  };
  const btnLabel = step < 3 ? P.btnNext : P.btnDone;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full sm:max-w-2xl flex flex-col" style={{ maxHeight: 'calc(100vh - 5rem)' }} dir={dir} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-center gap-2 pt-3 pb-1 shrink-0">
          {([1, 2, 3] as PolicyStep[]).map((s) => (
            <div key={s} className={`h-1.5 rounded-full transition-all duration-300 ${s === step ? 'w-8 bg-gray-700' : s < step ? 'w-4 bg-gray-400' : 'w-4 bg-gray-200'}`} />
          ))}
        </div>
        <div className={`flex items-center justify-between px-6 py-4 bg-gradient-to-r ${stepColors[step]} text-white shrink-0`}>
          <div className="flex items-center gap-3">
            <Icon name={stepIcons[step] as any} size={22} className="text-white" />
            <div>
              <h2 className="text-base font-bold leading-tight">{stepLabels[step]}</h2>
              <p className="text-xs text-white/80">{stepSubtitles[step]}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/20 transition-colors" aria-label="Close">
            <Icon name="XMarkIcon" size={20} className="text-white" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-5 text-sm text-gray-700 leading-relaxed" style={{ paddingBottom: '1.5rem' }}>
          {step === 1 && <CheckoutRefundPolicyContent />}
          {step === 2 && <CheckoutBuyerProtectionContent />}
          {step === 3 && <CheckoutWorkMechanismContent />}
        </div>
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 shrink-0 flex items-center justify-between rounded-b-2xl">
          <span className="text-xs text-gray-400">{P.stepOf.replace('{step}', String(step))}</span>
          <button onClick={advance} className={`px-6 py-2.5 ${btnColors[step]} text-white text-sm font-semibold rounded-lg transition-colors`}>{btnLabel}</button>
        </div>
      </div>
    </div>
  );
};

const CheckoutRefundPolicyContent: React.FC = () => {
  const { t } = useLanguage();
  const P = t.checkout.policies;
  const sections = [
    { title: P.fullRefundTitle, icon: 'CheckCircleIcon', color: 'text-green-600', bg: 'bg-green-50 border-green-100', items: P.fullRefundItems },
    { title: P.partialRefundTitle, icon: 'AdjustmentsHorizontalIcon', color: 'text-blue-600', bg: 'bg-blue-50 border-blue-100', items: P.partialRefundItems },
    { title: P.noRefundTitle, icon: 'XCircleIcon', color: 'text-red-600', bg: 'bg-red-50 border-red-100', items: P.noRefundItems },
    { title: P.refundProcessTitle, icon: 'ClipboardDocumentCheckIcon', color: 'text-purple-600', bg: 'bg-purple-50 border-purple-100', items: P.refundProcessItems },
  ];
  return (
  <div className="space-y-5">
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
      <p className="text-amber-800 font-semibold text-sm">{P.refundIntro}</p>
    </div>
    {sections.map((section, i) => (
      <div key={i}>
        <div className="flex items-center gap-2 mb-3">
          <Icon name={section.icon as any} size={18} className={section.color} />
          <h4 className="font-bold text-gray-800">{section.title}</h4>
        </div>
        <div className={`rounded-xl border p-4 space-y-2 ${section.bg}`}>
          {section.items.map((item, j) => (
            <div key={j} className="flex gap-2">
              <span className="text-gray-400 shrink-0 mt-0.5">•</span>
              <p className="text-gray-700 text-xs leading-relaxed">{item}</p>
            </div>
          ))}
        </div>
      </div>
    ))}
  </div>
  );
};

const CheckoutBuyerProtectionContent: React.FC = () => {
  const { t } = useLanguage();
  const P = t.checkout.policies;
  const buyerIcons = ['ClipboardDocumentListIcon', 'LockClosedIcon', 'TruckIcon', 'MagnifyingGlassIcon', 'ExclamationTriangleIcon'];
  const buyerColors = ['text-blue-500', 'text-green-500', 'text-amber-500', 'text-purple-500', 'text-red-500'];
  const factoryIcons = ['BanknotesIcon', 'ArrowPathIcon', 'ShieldExclamationIcon'];
  const factoryColors = ['text-green-600', 'text-teal-500', 'text-red-500'];
  return (
  <div className="space-y-6">
    <div>
      <div className="flex items-center gap-2 mb-4">
        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white text-xs font-bold shrink-0">{P.first}</span>
        <h3 className="font-bold text-gray-800 text-base">{P.buyerProtectionTitle} <span className="text-gray-500 font-normal text-sm">(Buyer Protection Policy)</span></h3>
      </div>
      <div className="space-y-3 ps-2">
        {P.buyerStages.map((item, i) => (
          <div key={i} className="flex gap-3 bg-blue-50/50 border border-blue-100 rounded-xl p-3">
            <Icon name={buyerIcons[i] as any} size={18} className={`${buyerColors[i]} shrink-0 mt-0.5`} />
            <div>
              <p className="font-semibold text-gray-800 mb-0.5">{item.title}</p>
              <p className="text-gray-600 text-xs leading-relaxed">{item.body}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
    <div className="border-t border-dashed border-gray-200" />
    <div>
      <div className="flex items-center gap-2 mb-4">
        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-green-600 text-white text-xs font-bold shrink-0">{P.second}</span>
        <h3 className="font-bold text-gray-800 text-base">{P.factoryProtectionTitle} <span className="text-gray-500 font-normal text-sm">(Factory Protection Policy)</span></h3>
      </div>
      <div className="space-y-3 ps-2">
        {P.factoryStages.map((item, i) => (
          <div key={i} className="flex gap-3 bg-green-50/50 border border-green-100 rounded-xl p-3">
            <Icon name={factoryIcons[i] as any} size={18} className={`${factoryColors[i]} shrink-0 mt-0.5`} />
            <div>
              <p className="font-semibold text-gray-800 mb-0.5">{item.title}</p>
              <p className="text-gray-600 text-xs leading-relaxed">{item.body}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
  );
};

const CheckoutWorkMechanismContent: React.FC = () => {
  const { t } = useLanguage();
  const P = t.checkout.policies;
  const partyIcons = ['UserIcon', 'BuildingOffice2Icon', 'GlobeAltIcon'];
  const partyColors = ['text-blue-600', 'text-green-600', 'text-indigo-600'];
  const partyBgs = ['bg-blue-50 border-blue-100', 'bg-green-50 border-green-100', 'bg-indigo-50 border-indigo-100'];
  const dealIcons = ['ChatBubbleLeftRightIcon', 'LockClosedIcon', 'QrCodeIcon', 'TruckIcon', 'KeyIcon'];
  const dealColors = ['text-blue-500', 'text-green-500', 'text-purple-500', 'text-amber-500', 'text-teal-500'];
  return (
  <div className="space-y-5">
    <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
      <h3 className="font-bold text-indigo-800 text-sm mb-1">{P.transparencyTitle}</h3>
      <p className="text-indigo-700 text-xs leading-relaxed">{P.transparencyIntro}</p>
    </div>
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="flex items-center justify-center w-7 h-7 rounded-full bg-indigo-600 text-white text-xs font-bold shrink-0">1</span>
        <h4 className="font-bold text-gray-800">{P.triplePartiesTitle}</h4>
      </div>
      <div className="space-y-2 ps-2">
        {P.tripleParties.map((item, i) => (
          <div key={i} className={`flex gap-3 rounded-xl border p-3 ${partyBgs[i]}`}>
            <Icon name={partyIcons[i] as any} size={18} className={`${partyColors[i]} shrink-0 mt-0.5`} />
            <div>
              <p className="font-semibold text-gray-800 text-xs mb-0.5">{item.title}</p>
              <p className="text-gray-600 text-xs leading-relaxed">{item.body}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="flex items-center justify-center w-7 h-7 rounded-full bg-indigo-600 text-white text-xs font-bold shrink-0">2</span>
        <h4 className="font-bold text-gray-800">{P.dealCycleTitle}</h4>
      </div>
      <div className="space-y-2 ps-2">
        {P.dealSteps.map((item, i) => (
          <div key={i} className="flex gap-3 bg-gray-50 border border-gray-100 rounded-xl p-3">
            <div className="flex flex-col items-center gap-1 shrink-0">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold">{i + 1}</span>
              <Icon name={dealIcons[i] as any} size={14} className={dealColors[i]} />
            </div>
            <div>
              <p className="font-semibold text-gray-800 text-xs mb-0.5">{item.title}</p>
              <p className="text-gray-600 text-xs leading-relaxed">{item.body}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
  );
};
// ─────────────────────────────────────────────────────────────────────────────

// ── Dual Logistics Selection Modal ───────────────────────────────────────────
interface LogisticsPartnerSuggestion {
  id: string;
  company_name: string;
  partner_type: string;
  partner_category_group: string | null;
  country: string;
  city: string;
  operating_hub: string | null;
  local_coverage_country: string | null;
  origin_countries: string[];
  destination_countries: string[];
  services_offered: string[];
  base_rate_usd: number | null;
  rate_description: string | null;
  service_scope: string | null;
  specialized_role: string | null;
}

const PARTNER_TYPE_LABELS_CHECKOUT: Record<string, string> = {
  international_shipping_office: 'international_shipping_office',
  local_shipping_distribution: 'local_shipping_distribution',
  customs_broker: 'customs_broker',
  freight_forwarder: 'freight_forwarder',
  logistics_company: 'logistics_company',
  shipping_office: 'shipping_office',
  sourcing_agent: 'sourcing_agent',
};

function getPartnerCategoryGroup(p: LogisticsPartnerSuggestion): string {
  if (p.partner_category_group) return p.partner_category_group;
  if (p.partner_type === 'international_shipping_office' || p.partner_type === 'freight_forwarder') return 'international';
  if (p.partner_type === 'local_shipping_distribution' || p.partner_type === 'logistics_company' || p.partner_type === 'shipping_office') return 'local';
  if (p.partner_type === 'customs_broker') return 'customs';
  return 'other';
}

type LogisticsSelectionTab = 'international' | 'local' | 'customs';

// ── Shipping Mode Selector ─────────────────────────────────────────────────────
type ShippingMode = 'full_service' | 'split_service' | 'factory_delivery' | 'self_arranged';

const LogisticsSuggestionsModal: React.FC<{
  buyerCountry: string;
  shippingMode: ShippingMode;
  onClose: () => void;
}> = ({ buyerCountry, shippingMode, onClose }) => {
  const { t, dir, isRTL, language } = useLanguage();
  const C = t.checkout;
  const P = t.checkout.policies;
  const G = t.checkout.logistics;

  const { user } = useAuth();
  const supabase = createClient();

  const [allPartners, setAllPartners] = useState<LogisticsPartnerSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<LogisticsSelectionTab>('international');

  // Dual selection state
  const [selectedInternational, setSelectedInternational] = useState<LogisticsPartnerSuggestion | null>(null);
  const [selectedLocal, setSelectedLocal] = useState<LogisticsPartnerSuggestion | null>(null);
  const [selectedCustoms, setSelectedCustoms] = useState<LogisticsPartnerSuggestion | null>(null);

  // Contact flow
  const [contactPartner, setContactPartner] = useState<LogisticsPartnerSuggestion | null>(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [shippingAgreed, setShippingAgreed] = useState(false);

  useEffect(() => {
    const fetchSuggestions = async () => {
      setLoading(true);
      let query = supabase
        .from('logistics_partners')
        .select('id, company_name, partner_type, partner_category_group, country, city, operating_hub, local_coverage_country, origin_countries, destination_countries, services_offered, base_rate_usd, rate_description, service_scope, specialized_role')
        .eq('status', 'approved')
        .eq('is_active', true)
        .limit(50);

      // Filter by shipping mode
      if (shippingMode === 'full_service') {
        query = query.eq('service_scope', 'full_service');
      } else {
        query = query.eq('service_scope', 'specialized');
      }

      const { data } = await query;
      setAllPartners(data || []);
      setLoading(false);
    };
    fetchSuggestions();
  }, [buyerCountry, shippingMode]);

  const internationalPartners = allPartners.filter(p => {
    if (shippingMode === 'full_service') return getPartnerCategoryGroup(p) === 'international';
    // split mode: show partners with specialized_role = international_shipping or sourcing_pickup_china
    return p.specialized_role === 'international_shipping' || p.specialized_role === 'sourcing_pickup_china';
  });

  const localPartners = allPartners.filter(p => {
    const isLocal = shippingMode === 'full_service'
      ? getPartnerCategoryGroup(p) === 'local'
      : p.specialized_role === 'local_delivery';
    if (!isLocal) return false;
    if (buyerCountry && p.local_coverage_country) return p.local_coverage_country === buyerCountry;
    if (buyerCountry && p.destination_countries?.length > 0) return p.destination_countries.includes(buyerCountry);
    return true;
  });

  const customsPartners = allPartners.filter(p => {
    if (shippingMode === 'full_service') return getPartnerCategoryGroup(p) === 'customs';
    return p.specialized_role === 'customs_clearance';
  });

  const handleContact = async () => {
    if (!user || !contactPartner || !message.trim()) return;
    setSending(true);
    try {
      const { data: existingConv } = await supabase
        .from('logistics_conversations')
        .select('id')
        .eq('buyer_id', user.id)
        .eq('partner_id', contactPartner.id)
        .single();

      let convId = existingConv?.id;
      if (!convId) {
        const { data: newConv } = await supabase
          .from('logistics_conversations')
          .insert({ buyer_id: user.id, partner_id: contactPartner.id })
          .select('id')
          .single();
        convId = newConv?.id;
      }

      if (convId) {
        await supabase.from('logistics_messages').insert({
          conversation_id: convId,
          sender_id: user.id,
          sender_role: 'buyer',
          content: message.trim(),
        });
        await supabase.from('logistics_conversations').update({
          last_message: message.trim(),
          last_message_at: new Date().toISOString(),
          partner_unread: 1,
        }).eq('id', convId);
        setSent(true);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  const tabConfig: { key: LogisticsSelectionTab; label: string; icon: string; color: string; partners: LogisticsPartnerSuggestion[]; selected: LogisticsPartnerSuggestion | null; setSelected: (p: LogisticsPartnerSuggestion | null) => void; desc: string }[] = [
    {
      key: 'international',
      label: shippingMode === 'split_service' ? G.intlSourcing : G.intlShipping,
      icon: 'GlobeAltIcon',
      color: 'text-blue-600',
      partners: internationalPartners,
      selected: selectedInternational,
      setSelected: setSelectedInternational,
      desc: shippingMode === 'full_service' ? G.intlDescSplit.replace('{port}', buyerCountry || G.arrival)
        : G.intlDescFull,
    },
    {
      key: 'local',
      label: G.localDistribution,
      icon: 'TruckIcon',
      color: 'text-emerald-600',
      partners: localPartners,
      selected: selectedLocal,
      setSelected: setSelectedLocal,
      desc: shippingMode === 'full_service' ? G.localDescSplit.replace('{country}', buyerCountry || G.yourCountry)
        : G.localDescFull.replace('{country}', buyerCountry || G.yourCountry),
    },
    {
      key: 'customs',
      label: G.customsClearance,
      icon: 'DocumentCheckIcon',
      color: 'text-violet-600',
      partners: customsPartners,
      selected: selectedCustoms,
      setSelected: setSelectedCustoms,
      desc: shippingMode === 'full_service' ? G.customsDescFull : G.customsDescSplit,
    },
  ];

  const currentTab = tabConfig.find(t => t.key === activeTab)!;
  const totalSelected = [selectedInternational, selectedLocal, selectedCustoms].filter(Boolean).length;

  if (contactPartner) {
    return (
      <div className="fixed inset-0 z-[9998] bg-black/60 flex items-end sm:items-center justify-center p-4" onClick={() => setContactPartner(null)}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()} dir={dir}>
          <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-blue-700 to-blue-500 text-white rounded-t-2xl">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                <Icon name="ChatBubbleLeftRightIcon" size={18} className="text-white" />
              </div>
              <div>
                <h3 className="font-bold text-sm">{contactPartner.company_name}</h3>
                <p className="text-blue-100 text-xs">{(C.partnerTypes as any)[contactPartner.partner_type] || contactPartner.partner_type}</p>
              </div>
            </div>
            <button onClick={() => setContactPartner(null)} className="w-8 h-8 rounded-lg hover:bg-white/20 flex items-center justify-center">
              <Icon name="XMarkIcon" size={16} className="text-white" />
            </button>
          </div>
          <div className="p-5 space-y-4">
            {sent ? (
              <div className="text-center py-6">
                <Icon name="CheckCircleIcon" size={44} className="text-emerald-500 mx-auto mb-3" />
                <p className="font-bold text-gray-800">{G.messageSent}</p>
                <p className="text-sm text-gray-500 mt-1">{G.partnerWillContact}</p>
                <button onClick={() => { setContactPartner(null); setSent(false); setMessage(''); }} className="mt-4 px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors">
                  {G.return}
                </button>
              </div>
            ) : (
              <>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-2 block">{G.yourMessage}</label>
                  <textarea
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    placeholder={G.messagePlaceholder.replace('{country}', buyerCountry || '')}
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-800 text-sm focus:outline-none focus:border-blue-400 resize-none"
                  />
                </div>
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input type="checkbox" checked={shippingAgreed} onChange={e => setShippingAgreed(e.target.checked)} className="mt-0.5 w-4 h-4 rounded accent-amber-600" />
                    <span className="text-xs text-amber-800 leading-relaxed">
                      {G.agreeShipping}{' '}
                      <Link href="/legal/shipping-terms" target="_blank" className="font-bold underline">{G.shippingTermsLink}</Link>
                      {' '}{G.acceptEscrowMerge} <span className="text-red-500">*</span>
                    </span>
                  </label>
                </div>
                <button
                  onClick={handleContact}
                  disabled={sending || !message.trim() || !shippingAgreed}
                  className="w-full h-11 bg-blue-600 text-white rounded-xl text-sm font-bold disabled:opacity-50 hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                >
                  {sending ? <Icon name="ArrowPathIcon" size={14} className="animate-spin" /> : <Icon name="PaperAirplaneIcon" size={14} />}
                  {G.sendToPartner}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[9998] bg-black/60 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
        dir={dir}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-blue-700 to-blue-500 text-white rounded-t-2xl shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
              <Icon name="TruckIcon" size={18} className="text-white" />
            </div>
            <div>
              <h3 className="font-bold text-sm">{G.choosePartners}</h3>
              <p className="text-blue-100 text-xs">
                {shippingMode === 'full_service' ? G.modeFullBadge : G.modeSplitBadge}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {totalSelected > 0 && (
              <span className="px-2 py-0.5 bg-white/20 rounded-full text-xs font-bold">{G.selectedShort.replace('{count}', String(totalSelected))}</span>
            )}
            <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-white/20 flex items-center justify-center">
              <Icon name="XMarkIcon" size={16} className="text-white" />
            </button>
          </div>
        </div>

        {/* Shipping Mode Badge */}
        <div className={`px-5 py-2 shrink-0 flex items-center gap-2 text-xs font-semibold ${
          shippingMode === 'full_service' ? 'bg-blue-50 text-blue-700 border-b border-blue-100' : 'bg-amber-50 text-amber-700 border-b border-amber-100'
        }`}>
          <Icon name={shippingMode === 'full_service' ? 'HomeModernIcon' : 'PuzzlePieceIcon'} size={13} />
          {shippingMode === 'full_service' ? G.showsFull : G.showsSplit}
        </div>

        {/* Selection Summary */}
        {totalSelected > 0 && (
          <div className="px-5 py-3 bg-blue-50 border-b border-blue-100 shrink-0">
            <p className="text-[10px] font-bold text-blue-700 mb-2">{G.selectedPartners}</p>
            <div className="flex flex-wrap gap-2">
              {selectedInternational && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-100 text-blue-800 rounded-lg text-xs">
                  <Icon name="GlobeAltIcon" size={11} />
                  <span className="font-semibold">{selectedInternational.company_name}</span>
                  <button onClick={() => setSelectedInternational(null)} className="hover:text-red-600">
                    <Icon name="XMarkIcon" size={11} />
                  </button>
                </div>
              )}
              {selectedLocal && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-xs">
                  <Icon name="TruckIcon" size={11} />
                  <span className="font-semibold">{selectedLocal.company_name}</span>
                  <button onClick={() => setSelectedLocal(null)} className="hover:text-red-600">
                    <Icon name="XMarkIcon" size={11} />
                  </button>
                </div>
              )}
              {selectedCustoms && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-violet-100 text-violet-800 rounded-lg text-xs">
                  <Icon name="DocumentCheckIcon" size={11} />
                  <span className="font-semibold">{selectedCustoms.company_name}</span>
                  <button onClick={() => setSelectedCustoms(null)} className="hover:text-red-600">
                    <Icon name="XMarkIcon" size={11} />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-gray-100 shrink-0">
          {tabConfig.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-3 text-xs font-semibold transition-colors relative ${
                activeTab === tab.key ? `${tab.color} border-b-2 border-current` : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <Icon name={tab.icon as any} size={15} />
              {tab.label}
              {tab.selected && (
                <span className="absolute top-1.5 left-1/2 translate-x-3 w-2 h-2 rounded-full bg-emerald-500" />
              )}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* Tab description */}
          <p className="text-[11px] text-gray-500 bg-gray-50 rounded-lg px-3 py-2">{currentTab.desc}</p>

          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Icon name="ArrowPathIcon" size={28} className="animate-spin text-blue-500" />
            </div>
          ) : currentTab.partners.length === 0 ? (
            <div className="text-center py-8">
              <Icon name="TruckIcon" size={36} className="text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">{G.noPartners}</p>
              <Link href="/logistics" className="mt-3 inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline">
                {G.browseLogistics}
                <Icon name="ArrowLeftIcon" size={12} />
              </Link>
            </div>
          ) : (
            currentTab.partners.map(p => {
              const isSelected = currentTab.selected?.id === p.id;
              return (
                <div
                  key={p.id}
                  className={`p-3 border-2 rounded-xl transition-all ${
                    isSelected ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-white hover:border-blue-200'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      activeTab === 'international' ? 'bg-blue-100' : activeTab === 'local' ? 'bg-emerald-100' : 'bg-violet-100'
                    }`}>
                      <Icon name={activeTab === 'international' ? 'GlobeAltIcon' : activeTab === 'local' ? 'TruckIcon' : 'DocumentCheckIcon'} size={16} className={currentTab.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 text-sm truncate">{p.company_name}</p>
                      <p className="text-[10px] text-gray-500">{(C.partnerTypes as any)[p.partner_type] || p.partner_type} — {p.city}, {p.country}</p>
                      {p.operating_hub && <p className="text-[10px] text-blue-600">{G.operatingFrom.replace('{hub}', p.operating_hub)}</p>}
                      {p.local_coverage_country && <p className="text-[10px] text-emerald-600">{G.covers.replace('{country}', p.local_coverage_country)}</p>}
                      {p.specialized_role && shippingMode === 'split_service' && (
                        <p className="text-[10px] text-amber-600 font-semibold">
                          {G.role.replace('{role}', (C.specializedRoles as any)[p.specialized_role] || p.specialized_role)}
                        </p>
                      )}
                      {p.base_rate_usd && <p className="text-[10px] text-gray-600 font-medium">{G.fromRatePlain.replace('{rate}', String(p.base_rate_usd))} {p.rate_description || 'USD'}</p>}
                    </div>
                    <div className="flex flex-col gap-1.5 shrink-0">
                      <button
                        onClick={() => currentTab.setSelected(isSelected ? null : p)}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-colors ${
                          isSelected
                            ? 'bg-blue-600 text-white' :'bg-gray-100 text-gray-700 hover:bg-blue-100 hover:text-blue-700'
                        }`}
                      >
                        {isSelected ? G.selected : G.select}
                      </button>
                      <button
                        onClick={() => setContactPartner(p)}
                        className="px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors border border-gray-200"
                      >
                        {G.contact}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}

          <div className="pt-2 border-t border-gray-100">
            <Link href="/logistics" className="flex items-center justify-center gap-2 text-xs text-blue-600 hover:underline">
              <Icon name="GlobeAltIcon" size={13} />
              {G.browseFullMarket}
            </Link>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-gray-500">
              {totalSelected === 0 ? G.selectAtLeastOne : G.partnersSelectedEscrow.replace('{count}', String(totalSelected))}
            </div>
            <button
              onClick={onClose}
              className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors"
            >
              {G.completeOrder}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function CheckoutPage() {
  const { t, dir, isRTL, language } = useLanguage();
  const C = t.checkout;
  const P = t.checkout.policies;
  const G = t.checkout.logistics;

  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const supabase = createClient();
  const { items: cartItems, subtotal, clearCart } = useCart();

  const [step, setStep] = useState<Step>('shipping');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Shipping form
  const [shipping, setShipping] = useState({
    fullName: '',
    company: '',
    address: '',
    city: '',
    country: 'Saudi Arabia',
    postalCode: '',
    phone: ''
  });

  // Payment
  const [notes, setNotes] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [agreedDeliveryDays, setAgreedDeliveryDays] = useState<number | ''>('');
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);

  // Payment Gateway State
  const [paymentGateway, setPaymentGateway] = useState<PaymentGatewayState>({
    gateway: null,
    localWallet: {
      walletProvider: '',
      posNumber: '',
      senderName: '',
      senderPhone: '',
      transferRef: '',
      receiptFile: null,
    },
    localBank: {
      bankName: '',
      senderAccountName: '',
      senderAccountNumber: '',
      transferRef: '',
      receiptFile: null,
    },
    intlCard: {
      cardholderName: '',
      cardNumber: '',
      expiry: '',
      cvv: '',
    },
    intlSwift: {
      senderBankName: '',
      senderIban: '',
      swiftRef: '',
      receiptFile: null,
    },
  });

  // Commission Engine
  const [orderCategory, setOrderCategory] = useState<OrderCategory>('retail');
  const [containerCount, setContainerCount] = useState<number>(1);

  // OTP
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpId, setOtpId] = useState('');
  const [otpError, setOtpError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  // Confirmed order
  const [confirmedOrderNumber, setConfirmedOrderNumber] = useState('');
  const [confirmedOrderId, setConfirmedOrderId] = useState('');

  // Agreement checkbox
  const [agreedToPolicies, setAgreedToPolicies] = useState(false);
  const [policyModalOpen, setPolicyModalOpen] = useState(false);
  const [policyModalStep, setPolicyModalStep] = useState<PolicyStep>(1);
  const [showLogisticsSuggestions, setShowLogisticsSuggestions] = useState(false);
  const [logisticsShown, setLogisticsShown] = useState(false);
  const [shippingMode, setShippingMode] = useState<ShippingMode>('full_service');

  // Cash Upfront Escrow state
  const [isCashUpfrontEscrow, setIsCashUpfrontEscrow] = useState(false);
  const [wireOcrVerified, setWireOcrVerified] = useState(false);
  const [wireOcrResult, setWireOcrResult] = useState<WireOCRResult | null>(null);

  // Seller Fulfillment state
  const [sellerFulfillment, setSellerFulfillment] = useState<SellerFulfillmentState>({
    fulfillmentType: 'directhub_logistics',
    incotermType: '',
    localClearanceRequired: false,
  });

  // Determine if order is international (not Saudi Arabia)
  const isInternationalOrder = shipping.country && shipping.country !== 'Saudi Arabia' && shipping.country !== 'Yemen' && shipping.country !== '';

  const shippingCost = 150;

  const displayItems: CartItem[] = cartItems.map((i) => ({
    id: i.productId,
    name: i.name,
    image: i.image,
    alt: i.alt,
    price: i.price,
    currency: i.currency,
    quantity: i.quantity,
    supplier: i.supplier
  }));

  const displaySubtotal = subtotal;
  const displayTotal = displaySubtotal + shippingCost;

  // Compute commission dynamically
  const commission = calculateCommission(orderCategory, displaySubtotal, containerCount);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      setShipping((prev) => ({
        ...prev,
        fullName: user.user_metadata?.full_name || '',
        company: user.user_metadata?.company_name || '',
        phone: user.user_metadata?.phone || '',
        country: user.user_metadata?.country || 'Saudi Arabia'
      }));
    }
  }, [user]);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleShippingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStep('payment');
  };

  const handleReceiptChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB.');
      return;
    }
    setReceiptFile(file);
    setError('');
    const reader = new FileReader();
    reader.onload = (ev) => setReceiptPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const uploadReceipt = async (orderId: string): Promise<string | null> => {
    if (!receiptFile || !user) return null;
    try {
      const ext = receiptFile.name.split('.').pop();
      const filePath = `receipts/${user.id}/${orderId}.${ext}`;
      setUploadProgress(30);
      const { error: uploadError } = await supabase.storage
        .from('order-receipts')
        .upload(filePath, receiptFile, { upsert: true });
      if (uploadError) throw uploadError;
      setUploadProgress(80);
      const { data: urlData } = supabase.storage
        .from('order-receipts')
        .getPublicUrl(filePath);
      setUploadProgress(100);
      return urlData?.publicUrl || null;
    } catch (err: any) {
      console.warn('[Receipt Upload]', err.message);
      return null;
    }
  };

  const handleSendOtp = async () => {
    if (!user) return;
    setLoading(true);
    setOtpError('');
    try {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      const { data, error: dbError } = await supabase
        .from('checkout_otps')
        .insert({
          user_id: user.id,
          email: user.email,
          otp_code: code,
          order_data: {
            shipping,
            paymentMethod: 'bank_transfer',
            notes,
            items: displayItems,
            subtotal: displaySubtotal,
            shippingCost,
            total: displayTotal,
            orderCategory,
            containerCount,
            platformCommission: commission.amount,
            commissionRateLabel: commission.rateLabel
          },
          expires_at: expiresAt
        })
        .select('id')
        .single();

      if (dbError) throw dbError;
      setOtpId(data.id);

      const emailResult = await sendOtpEmail(
        user.email!,
        code,
        user.user_metadata?.full_name || shipping.fullName
      );
      if (!emailResult.success) {
        console.warn('[OTP] Email send warning:', emailResult.error);
      }

      setOtpSent(true);
      setResendCooldown(60);
      setStep('otp');
    } catch (err: any) {
      setOtpError(err.message || 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !otpId) return;
    setLoading(true);
    setOtpError('');
    try {
      const { data: otpRecord, error: fetchError } = await supabase
        .from('checkout_otps')
        .select('*')
        .eq('id', otpId)
        .eq('user_id', user.id)
        .eq('is_used', false)
        .single();

      if (fetchError || !otpRecord) throw new Error('OTP not found or already used.');
      if (new Date(otpRecord.expires_at) < new Date()) throw new Error('OTP has expired. Please request a new one.');
      if (otpRecord.otp_code !== otpCode) throw new Error('Invalid OTP code. Please try again.');

      await supabase.from('checkout_otps').update({ is_used: true }).eq('id', otpId);

      const { data: orderNumData } = await supabase.rpc('generate_order_number');
      const orderNumber = orderNumData || `DH-${Date.now()}`;

      // Determine payment method label for order record
      const paymentMethodLabel = paymentGateway.gateway || 'bank_transfer';

      const deliveryDeadlineDate = agreedDeliveryDays !== '' && Number(agreedDeliveryDays) > 0
        ? new Date(Date.now() + Number(agreedDeliveryDays) * 24 * 60 * 60 * 1000).toISOString()
        : null;

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: user.id,
          order_number: orderNumber,
          status: 'pending',
          escrow_status: 'pending_verification',
          escrow_payment_type: isCashUpfrontEscrow ? 'cash_upfront_escrow' : 'standard',
          cfo_approval_status: isCashUpfrontEscrow ? 'pending_cfo_approval' : null,
          items: displayItems,
          shipping_address: shipping,
          payment_method: paymentMethodLabel,
          subtotal: displaySubtotal,
          shipping_cost: shippingCost,
          total: displayTotal,
          notes,
          confirmed_at: new Date().toISOString(),
          order_category: orderCategory,
          container_count: orderCategory === 'large_deal' ? containerCount : 0,
          platform_commission: commission.amount,
          commission_rate_label: commission.rateLabel,
          platform_commission_amount: commission.amount,
          platform_commission_rate_label: commission.rateLabel,
          wire_transfer_verified: wireOcrVerified,
          wire_transfer_ocr_result: wireOcrResult || null,
          // Seller Fulfillment fields
          fulfillment_type: sellerFulfillment.fulfillmentType,
          incoterm_type: sellerFulfillment.incotermType || null,
          local_clearance_required: sellerFulfillment.localClearanceRequired,
          ...(deliveryDeadlineDate ? {
            agreed_delivery_days: Number(agreedDeliveryDays),
            expected_delivery_date: deliveryDeadlineDate,
            delivery_deadline: deliveryDeadlineDate,
          } : {})
        })
        .select('id, order_number')
        .single();

      if (orderError) throw orderError;

      await supabase.from('platform_commissions').insert({
        order_id: order.id,
        order_number: order.order_number,
        order_category: orderCategory,
        order_total: displaySubtotal,
        container_count: orderCategory === 'large_deal' ? containerCount : 0,
        commission_amount: commission.amount,
        commission_rate_label: commission.rateLabel,
        status: 'pending'
      });

      // Log CFO approval request for cash upfront orders
      if (isCashUpfrontEscrow) {
        await supabase.from('cfo_approval_log').insert({
          order_id: order.id,
          action: 'submitted',
          note: `طلب دفع نقدي كامل — $${displayTotal.toLocaleString()} — بانتظار موافقة المدير المالي`,
          amount_usd: displayTotal,
        });
      }

      // ── Submit payment channel data ──────────────────────────────────────
      if (paymentGateway.gateway) {
        await submitPaymentChannelData(order.id, order.order_number, deliveryDeadlineDate);
      }

      await sendOrderConfirmationEmail(user.email!, {
        order_number: order.order_number,
        full_name: user.user_metadata?.full_name || shipping.fullName,
        items: displayItems,
        subtotal: displaySubtotal,
        shipping_cost: shippingCost,
        total: displayTotal,
        shipping_address: shipping,
        payment_method: paymentMethodLabel,
        escrow_pin: otpCode
      });

      // ── Dual notification: in-app bell + email confirmation ──────────────
      sendDualNotification({
        userId: user.id,
        title: 'تم تقديم طلبك بنجاح ✅',
        message: `رقم الطلب: ${order.order_number} — بانتظار اعتماد الدفع. يمكنك متابعة حالة طلبك من حسابك.`,
        type: 'order_placed',
        userEmail: user.email ?? undefined,
        link: '/my-account',
      }).catch(() => {});

      if (cartItems.length > 0) await clearCart();

      setConfirmedOrderNumber(order.order_number);
      setConfirmedOrderId(order.id);
      setStep('confirmed');
      router.push(`/order-confirmation?order=${encodeURIComponent(order.order_number)}`);
    } catch (err: any) {
      setOtpError(err.message || 'Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Submit payment channel data to API ──────────────────────────────────────
  const submitPaymentChannelData = async (orderId: string, orderNumber: string, deliveryDeadline: string | null) => {
    try {
      const formData = new FormData();
      formData.append('order_id', orderId);
      formData.append('payment_channel', paymentGateway.gateway!);
      if (deliveryDeadline) formData.append('delivery_deadline', deliveryDeadline);

      if (paymentGateway.gateway === 'local_wallet') {
        const w = paymentGateway.localWallet;
        formData.append('wallet_provider', w.walletProvider);
        formData.append('wallet_pos_number', w.posNumber);
        formData.append('wallet_sender_name', w.senderName);
        formData.append('wallet_sender_phone', w.senderPhone);
        formData.append('wallet_transfer_ref', w.transferRef);
        if (w.receiptFile) formData.append('receipt_file', w.receiptFile);
      } else if (paymentGateway.gateway === 'local_bank_transfer') {
        const b = paymentGateway.localBank;
        formData.append('bank_sender_bank_name', b.bankName);
        formData.append('bank_sender_account_name', b.senderAccountName);
        formData.append('bank_sender_account_number', b.senderAccountNumber);
        formData.append('bank_transfer_ref', b.transferRef);
        if (b.receiptFile) formData.append('receipt_file', b.receiptFile);
      } else if (paymentGateway.gateway === 'international_swift') {
        const s = paymentGateway.intlSwift;
        formData.append('swift_sender_bank_name', s.senderBankName);
        formData.append('swift_sender_iban', s.senderIban);
        formData.append('swift_ref', s.swiftRef);
        if (s.receiptFile) formData.append('receipt_file', s.receiptFile);
      }

      // ── HMAC-SHA256 Request Signing (securitySigner) ────────────────────
      const signingHeaders = signRequest('POST', '/api/payment/submit', '');
      const res = await fetch('/api/payment/submit', {
        method: 'POST',
        headers: signingHeaders,
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json();
        console.warn('[Payment Submit]', errData.error);
      }
    } catch (err: any) {
      console.warn('[Payment Submit]', err.message);
    }
  };

  // Show logistics suggestions when entering review step
  useEffect(() => {
    if (step === 'review' && !logisticsShown && shipping.country) {
      setShowLogisticsSuggestions(true);
      setLogisticsShown(true);
    }
  }, [step]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Icon name="ArrowPathIcon" size={32} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  // Empty cart guard
  if (!authLoading && cartItems.length === 0 && step === 'shipping') {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="max-w-2xl mx-auto px-4 py-20 text-center">
          <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-5">
            <Icon name="ShoppingCartIcon" size={36} className="text-muted-foreground" />
          </div>
          <h1 className="text-xl font-bold text-foreground mb-2">Your cart is empty</h1>
          <p className="text-muted-foreground mb-6 text-sm">Add items to your cart before proceeding to checkout.</p>
          <Link href="/" className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-xl text-sm">
            <Icon name="ArrowLeftIcon" size={16} />
            Browse Products
          </Link>
        </main>
        <BottomNav />
      </div>
    );
  }

  const stepKeys = STEP_CONFIG.map((s) => s.key);
  const currentStepIndex = stepKeys.indexOf(step);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-5xl mx-auto px-4 md:px-6 py-6 mobile-safe-bottom md:pb-10">
        {/* Page title */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/cart" className="text-muted-foreground hover:text-foreground transition-colors">
            <Icon name="ArrowLeftIcon" size={20} />
          </Link>
          <h1 className="text-xl font-bold text-foreground">Checkout</h1>
          {/* Escrow badge */}
          <span className="ml-auto inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-semibold">
            <Icon name="LockClosedIcon" size={12} />
            Escrow Protected
          </span>
        </div>

        {/* Progress Steps */}
        {step !== 'confirmed' && (
          <div className="flex items-center gap-1 mb-8">
            {STEP_CONFIG.map((s, i) => {
              const isDone = i < currentStepIndex;
              const isCurrent = s.key === step;
              return (
                <React.Fragment key={s.key}>
                  <div className={`flex items-center gap-1.5 ${isCurrent ? 'text-primary' : isDone ? 'text-green-600' : 'text-muted-foreground'}`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                      isCurrent ? 'border-primary bg-primary text-primary-foreground' :
                      isDone ? 'border-green-600 bg-green-600 text-white': 'border-border bg-card'
                    }`}>
                      {isDone ? <Icon name="CheckIcon" size={13} /> : i + 1}
                    </div>
                    <span className="text-xs font-medium hidden sm:block">{s.label}</span>
                  </div>
                  {i < STEP_CONFIG.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-1 transition-all ${isDone ? 'bg-green-600' : 'bg-border'}`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2">

            {/* ── SHIPPING STEP ── */}
            {step === 'shipping' && (
              <div className="bg-card rounded-2xl border border-border p-6" dir={dir}>
                <h2 className="text-base font-bold text-foreground mb-5 flex items-center gap-2">
                  <Icon name="TruckIcon" size={18} className="text-primary" />
                  {C.shippingAddress}
                </h2>
                <form onSubmit={handleShippingSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1.5">{C.fullName} *</label>
                      <input type="text" required value={shipping.fullName} onChange={(e) => setShipping({ ...shipping, fullName: e.target.value })} className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1.5">{C.companyName} *</label>
                      <input type="text" required value={shipping.company} onChange={(e) => setShipping({ ...shipping, company: e.target.value })} className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1.5">{C.streetAddress} *</label>
                    <input type="text" required value={shipping.address} onChange={(e) => setShipping({ ...shipping, address: e.target.value })} className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1.5">{C.city} *</label>
                      <input type="text" required value={shipping.city} onChange={(e) => setShipping({ ...shipping, city: e.target.value })} className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1.5">{C.postalCode}</label>
                      <input type="text" value={shipping.postalCode} onChange={(e) => setShipping({ ...shipping, postalCode: e.target.value })} className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1.5">{C.country} *</label>
                      <select required value={shipping.country} onChange={(e) => setShipping({ ...shipping, country: e.target.value })} className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors">
                        <option value="">{C.selectCountry}</option>
                        <optgroup label={C.regions.arab}>
                          <option>Yemen</option><option>Saudi Arabia</option><option>UAE</option><option>Kuwait</option><option>Qatar</option><option>Bahrain</option><option>Oman</option><option>Egypt</option><option>Jordan</option><option>Iraq</option><option>Syria</option><option>Lebanon</option><option>Palestine</option><option>Libya</option><option>Tunisia</option><option>Algeria</option><option>Morocco</option><option>Sudan</option><option>Somalia</option><option>Mauritania</option><option>Djibouti</option><option>Comoros</option>
                        </optgroup>
                        <optgroup label={C.regions.asia}>
                          <option>Afghanistan</option><option>Armenia</option><option>Azerbaijan</option><option>Bangladesh</option><option>Bhutan</option><option>Brunei</option><option>Cambodia</option><option>China</option><option>Cyprus</option><option>Georgia</option><option>India</option><option>Indonesia</option><option>Iran</option><option>Israel</option><option>Japan</option><option>Kazakhstan</option><option>Kyrgyzstan</option><option>Laos</option><option>Malaysia</option><option>Maldives</option><option>Mongolia</option><option>Myanmar</option><option>Nepal</option><option>North Korea</option><option>Pakistan</option><option>Philippines</option><option>Singapore</option><option>South Korea</option><option>Sri Lanka</option><option>Taiwan</option><option>Tajikistan</option><option>Thailand</option><option>Timor-Leste</option><option>Turkey</option><option>Turkmenistan</option><option>Uzbekistan</option><option>Vietnam</option>
                        </optgroup>
                        <optgroup label={C.regions.europe}>
                          <option>Albania</option><option>Andorra</option><option>Austria</option><option>Belarus</option><option>Belgium</option><option>Bosnia and Herzegovina</option><option>Bulgaria</option><option>Croatia</option><option>Czech Republic</option><option>Denmark</option><option>Estonia</option><option>Finland</option><option>France</option><option>Germany</option><option>Greece</option><option>Hungary</option><option>Iceland</option><option>Ireland</option><option>Italy</option><option>Kosovo</option><option>Latvia</option><option>Liechtenstein</option><option>Lithuania</option><option>Luxembourg</option><option>Malta</option><option>Moldova</option><option>Monaco</option><option>Montenegro</option><option>Netherlands</option><option>North Macedonia</option><option>Norway</option><option>Poland</option><option>Portugal</option><option>Romania</option><option>Russia</option><option>San Marino</option><option>Serbia</option><option>Slovakia</option><option>Slovenia</option><option>Spain</option><option>Sweden</option><option>Switzerland</option><option>Ukraine</option><option>United Kingdom</option><option>Vatican City</option>
                        </optgroup>
                        <optgroup label={C.regions.africa}>
                          <option>Angola</option><option>Benin</option><option>Botswana</option><option>Burkina Faso</option><option>Burundi</option><option>Cameroon</option><option>Cape Verde</option><option>Central African Republic</option><option>Chad</option><option>Congo</option><option>DR Congo</option><option>Equatorial Guinea</option><option>Eritrea</option><option>Eswatini</option><option>Ethiopia</option><option>Gabon</option><option>Gambia</option><option>Ghana</option><option>Guinea</option><option>Guinea-Bissau</option><option>Ivory Coast</option><option>Kenya</option><option>Lesotho</option><option>Liberia</option><option>Madagascar</option><option>Malawi</option><option>Mali</option><option>Mozambique</option><option>Namibia</option><option>Niger</option><option>Nigeria</option><option>Rwanda</option><option>São Tomé and Príncipe</option><option>Senegal</option><option>Seychelles</option><option>Sierra Leone</option><option>South Africa</option><option>South Sudan</option><option>Tanzania</option><option>Togo</option><option>Uganda</option><option>Zambia</option><option>Zimbabwe</option>
                        </optgroup>
                        <optgroup label={C.regions.americas}>
                          <option>Antigua and Barbuda</option><option>Argentina</option><option>Bahamas</option><option>Barbados</option><option>Belize</option><option>Bolivia</option><option>Brazil</option><option>Canada</option><option>Chile</option><option>Colombia</option><option>Costa Rica</option><option>Cuba</option><option>Dominica</option><option>Dominican Republic</option><option>Ecuador</option><option>El Salvador</option><option>Grenada</option><option>Guatemala</option><option>Guyana</option><option>Haiti</option><option>Honduras</option><option>Jamaica</option><option>Mexico</option><option>Nicaragua</option><option>Panama</option><option>Paraguay</option><option>Peru</option><option>Saint Kitts and Nevis</option><option>Saint Lucia</option><option>Saint Vincent and the Grenadines</option><option>Suriname</option><option>Trinidad and Tobago</option><option>USA</option><option>Uruguay</option><option>Venezuela</option>
                        </optgroup>
                        <optgroup label={C.regions.oceania}>
                          <option>Australia</option><option>Fiji</option><option>Kiribati</option><option>Marshall Islands</option><option>Micronesia</option><option>Nauru</option><option>New Zealand</option><option>Palau</option><option>Papua New Guinea</option><option>Samoa</option><option>Solomon Islands</option><option>Tonga</option><option>Tuvalu</option><option>Vanuatu</option>
                        </optgroup>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1.5">{C.mobileNumber} *</label>
                      <input type="tel" required value={shipping.phone} onChange={(e) => setShipping({ ...shipping, phone: e.target.value })} className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors" />
                    </div>
                  </div>

                  {/* ── Seller Fulfillment Selector ── */}
                  <div className="border-t border-border pt-4">
                    <SellerFulfillmentSelector
                      value={sellerFulfillment}
                      onChange={setSellerFulfillment}
                    />
                  </div>

                  {/* Validation: require incoterm if seller_fulfilled */}
                  {sellerFulfillment.fulfillmentType === 'seller_fulfilled' && !sellerFulfillment.incotermType && (
                    <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      <Icon name="ExclamationTriangleIcon" size={14} className="shrink-0" />
                      يرجى تحديد شرط التسليم (Incoterm) للمتابعة
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={sellerFulfillment.fulfillmentType === 'seller_fulfilled' && !sellerFulfillment.incotermType}
                    className="w-full h-11 bg-primary text-primary-foreground font-semibold rounded-lg text-sm transition-opacity active:opacity-80 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {C.continueToPayment} <Icon name="ArrowRightIcon" size={16} />
                  </button>
                </form>
              </div>
            )}

            {/* ── PAYMENT STEP — Multi-Gateway ── */}
            {step === 'payment' && (
              <div className="space-y-4">
                <div className="bg-card rounded-2xl border border-border p-6">
                  <h2 className="text-base font-bold text-foreground mb-1 flex items-center gap-2">
                    <Icon name="CreditCardIcon" size={18} className="text-primary" />
                    {C.paymentMethod}
                  </h2>
                  <p className="text-xs text-muted-foreground mb-5">{C.choosePaymentGateway}</p>

                  {/* ── Cash-Only Policy Banner ── */}
                  <div className="mb-4 flex items-start gap-3 p-4 bg-amber-50 border border-amber-300 rounded-xl">
                    <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                      <Icon name="ShieldCheckIcon" size={18} className="text-amber-700" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-amber-900">
                        {language === 'ar' ? 'دفع فوري — نقداً فقط' : 'Immediate Payment Required — Cash Only'}
                      </p>
                      <p className="text-xs text-amber-800 leading-relaxed mt-0.5">
                        {language === 'ar' ?'جميع المعاملات المحلية بالريال اليمني (YER). لا ائتمان، لا ديون، لا دفع مؤجل. لا شراء بدون دفع كامل ومسبق.' :'All local transactions are in Yemeni Rial (YER). No credit, no debt, no deferred payments. No purchase without full upfront payment.'}
                      </p>
                    </div>
                  </div>

                  {/* ── Escrow Info Banner ── */}
                  <div className="mb-5 flex items-start gap-3 p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
                    <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
                      <Icon name="LockClosedIcon" size={18} className="text-indigo-600" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-indigo-900">{C.escrowTitle}</p>
                      <p className="text-xs text-indigo-700 leading-relaxed mt-0.5">
                        {C.escrowPaymentBody}
                      </p>
                    </div>
                  </div>

                  {/* ── Payment Gateway Selector ── */}
                  <PaymentGatewaySelector
                    value={paymentGateway}
                    onChange={setPaymentGateway}
                  />

                  {/* Notes */}
                  <div className="mt-5 border-t border-border pt-5 mb-5">
                    <label className="block text-xs font-medium text-foreground mb-1.5">{C.orderNotes}</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                      placeholder={C.orderNotesPlaceholder}
                      className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors resize-none"
                    />
                  </div>

                  {/* Agreed Delivery Duration */}
                  <div className="mb-5">
                    <label className="block text-xs font-medium text-foreground mb-1.5">
                      {C.agreedDeliveryDays}
                      <span className="ml-1 text-muted-foreground font-normal">{C.asAgreedWithSupplier}</span>
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        min={1}
                        max={365}
                        value={agreedDeliveryDays}
                        onChange={(e) => setAgreedDeliveryDays(e.target.value === '' ? '' : Number(e.target.value))}
                        placeholder={C.exampleDays}
                        className="w-32 h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
                      />
                      {agreedDeliveryDays !== '' && Number(agreedDeliveryDays) > 0 && (
                        <div className="flex items-center gap-1.5 text-xs text-primary font-medium bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
                          <Icon name="CalendarDaysIcon" size={14} />
                          {C.deliveryDateLabel.replace('{date}', new Date(Date.now() + Number(agreedDeliveryDays) * 24 * 60 * 60 * 1000).toLocaleDateString(language === 'ar' ? 'ar' : language === 'zh' ? 'zh-CN' : language === 'tr' ? 'tr-TR' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' }))}
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1.5">
                      {C.deliveryDateInvoiceNote}
                    </p>
                  </div>

                  {/* ── Smart Commission Engine ── */}
                  <div className="mb-5">
                    <div className="flex items-center gap-2 mb-3">
                      <Icon name="CurrencyDollarIcon" size={16} className="text-primary" />
                      <label className="text-xs font-semibold text-foreground uppercase tracking-wide">{C.orderCategoryLabel}</label>
                      <span className="text-[10px] text-muted-foreground font-normal">{C.determinesCommission}</span>
                    </div>
                    {/* Smart auto-suggestion banner */}
                    {displaySubtotal > 0 && (
                      <div className="mb-3 flex items-center gap-2.5 px-3 py-2.5 bg-blue-50 border border-blue-200 rounded-xl">
                        <Icon name="LightBulbIcon" size={15} className="text-blue-600 shrink-0" />
                        <p className="text-xs text-blue-800 flex-1">
                          {displaySubtotal >= 10000
                            ? <><span className="font-bold">B2B suggestion:</span> Your order total (${displaySubtotal.toLocaleString()}) qualifies as a <span className="font-bold">Large Deal</span> — select it for the lowest commission rate.</>
                            : displaySubtotal >= 3000
                            ? <><span className="font-bold">B2B suggestion:</span> Your order total (${displaySubtotal.toLocaleString()}) qualifies as <span className="font-bold">Bulk Wholesale</span> — select it for a reduced 1.5% commission.</>
                            : displaySubtotal >= 500
                            ? <><span className="font-bold">B2B suggestion:</span> Your order total (${displaySubtotal.toLocaleString()}) qualifies as <span className="font-bold">Wholesale</span> — select it for a 2.5% commission rate.</>
                            : <><span className="font-bold">B2C:</span> Your order total (${displaySubtotal.toLocaleString()}) is a standard retail order — 3.5% commission applies.</>
                          }
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            if (displaySubtotal >= 10000) setOrderCategory('large_deal');
                            else if (displaySubtotal >= 3000) setOrderCategory('bulk_wholesale');
                            else if (displaySubtotal >= 500) setOrderCategory('wholesale');
                            else setOrderCategory('retail');
                          }}
                          className="shrink-0 text-[10px] font-bold px-2.5 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          Apply
                        </button>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      {ORDER_CATEGORY_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setOrderCategory(opt.value)}
                          className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border-2 text-left transition-all ${
                            orderCategory === opt.value
                              ? 'border-primary bg-primary/5 text-foreground'
                              : 'border-border bg-background text-muted-foreground hover:border-primary/40'
                          }`}>
                          <Icon name={opt.icon as any} size={16} className={orderCategory === opt.value ? 'text-primary' : 'text-muted-foreground'} />
                          <div>
                            <p className="text-xs font-semibold leading-tight">{(C.orderCategories as any)[opt.labelKey] || opt.labelKey}</p>
                            <p className={`text-[10px] ${orderCategory === opt.value ? 'text-primary' : 'text-muted-foreground'}`}>{(C.orderCategories as any)[opt.subKey] || opt.subKey}</p>
                          </div>
                        </button>
                      ))}
                    </div>

                    {orderCategory === 'large_deal' && (
                      <div className="flex items-center gap-3 mb-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                        <Icon name="CubeIcon" size={18} className="text-blue-600 shrink-0" />
                        <div className="flex-1">
                          <label className="text-xs font-semibold text-blue-800 block mb-1">{C.containerCount}</label>
                          <input
                            type="number"
                            min={1}
                            max={999}
                            value={containerCount}
                            onChange={(e) => setContainerCount(Math.max(1, Number(e.target.value)))}
                            className="w-24 h-9 px-3 rounded-lg border border-blue-300 bg-white text-foreground text-sm font-bold focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-300 transition-colors"
                          />
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-blue-600">$100 × {containerCount}</p>
                          <p className="text-sm font-bold text-blue-800">${(100 * containerCount).toLocaleString()}</p>
                        </div>
                      </div>
                    )}

                    <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Icon name="ReceiptPercentIcon" size={18} className="text-amber-600 shrink-0" />
                        <div>
                          <p className="text-xs font-semibold text-amber-800">{C.platformCommission}</p>
                          <p className="text-[10px] text-amber-600">{commission.rateLabel}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-amber-800">${commission.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        <p className="text-[10px] text-amber-600">{C.deductedFromSupplier}</p>
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1.5 flex items-center gap-1">
                      <Icon name="InformationCircleIcon" size={11} className="shrink-0 text-blue-400" />
                      {C.commissionNote}
                    </p>
                  </div>

                  {/* ── Cash Upfront Escrow Option ── */}
                  <div className="mb-5">
                    <button
                      type="button"
                      onClick={() => setIsCashUpfrontEscrow(!isCashUpfrontEscrow)}
                      className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left ${
                        isCashUpfrontEscrow
                          ? 'border-emerald-500 bg-emerald-50' :'border-border bg-background hover:border-emerald-300'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isCashUpfrontEscrow ? 'bg-emerald-100' : 'bg-muted'}`}>
                        <Icon name="BanknotesIcon" size={20} className={isCashUpfrontEscrow ? 'text-emerald-700' : 'text-muted-foreground'} />
                      </div>
                      <div className="flex-1 text-left">
                        <p className={`text-sm font-bold ${isCashUpfrontEscrow ? 'text-emerald-900' : 'text-foreground'}`}>
                          {language === 'ar' ? '💰 دفع نقدي كامل مسبق عبر الضمان' : '💰 Full Upfront Cash via Escrow'}
                        </p>
                        <p className={`text-xs mt-0.5 ${isCashUpfrontEscrow ? 'text-emerald-700' : 'text-muted-foreground'}`}>
                          {language === 'ar' ?'تجميد المبلغ الكامل في حساب الضمان — يتطلب موافقة المدير المالي وتحقق SWIFT' :'Freeze full amount in escrow — requires CFO approval & SWIFT verification'}
                        </p>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${isCashUpfrontEscrow ? 'border-emerald-500 bg-emerald-500' : 'border-gray-300'}`}>
                        {isCashUpfrontEscrow && <Icon name="CheckIcon" size={11} className="text-white" />}
                      </div>
                    </button>

                    {isCashUpfrontEscrow && (
                      <div className="mt-3 space-y-3">
                        <div className="flex items-start gap-2.5 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                          <Icon name="ClockIcon" size={16} className="text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs font-bold text-amber-800">
                              {language === 'ar' ? 'يتطلب موافقة المدير المالي (CFO Approval)' : 'Requires CFO Approval'}
                            </p>
                            <p className="text-xs text-amber-700 mt-0.5">
                              {language === 'ar' ?'سيتم إرسال طلبك إلى المدير المالي للمراجعة والموافقة قبل تجميد المبلغ في الضمان.' :'Your order will be sent to the CFO for review and approval before funds are frozen in escrow.'}
                            </p>
                          </div>
                        </div>
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                          <p className="text-xs font-bold text-emerald-800 mb-2">
                            {language === 'ar' ? 'ملخص الدفع النقدي الكامل' : 'Cash Upfront Summary'}
                          </p>
                          <div className="space-y-1.5">
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-600">{language === 'ar' ? 'إجمالي الطلب' : 'Order Total'}</span>
                              <span className="font-bold">${displayTotal.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-600">{language === 'ar' ? 'عمولة المنصة' : 'Platform Commission'}</span>
                              <span className="font-bold text-primary">${commission.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between text-xs border-t border-emerald-200 pt-1.5">
                              <span className="font-bold text-emerald-800">{language === 'ar' ? 'المبلغ المجمّد في الضمان' : 'Amount Frozen in Escrow'}</span>
                              <span className="font-bold text-emerald-800 text-sm">${displayTotal.toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                        <WireTransferOCRVerifier
                          onVerified={(result) => {
                            setWireOcrVerified(true);
                            setWireOcrResult(result);
                          }}
                        />
                        {wireOcrVerified && (
                          <div className="flex items-center gap-2 px-3 py-2 bg-emerald-100 border border-emerald-300 rounded-lg">
                            <Icon name="CheckBadgeIcon" size={16} className="text-emerald-700" />
                            <p className="text-xs font-bold text-emerald-800">
                              {language === 'ar' ? 'تم التحقق من إيصال التحويل البنكي ✓' : 'Wire transfer receipt verified ✓'}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm mb-4 flex items-center gap-2">
                      <Icon name="ExclamationCircleIcon" size={16} />
                      {error}
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button onClick={() => setStep('shipping')} className="flex-1 h-11 border border-border text-foreground font-semibold rounded-lg text-sm transition-colors hover:bg-muted flex items-center justify-center gap-2">
                      <Icon name="ArrowLeftIcon" size={16} /> {C.back}
                    </button>
                    <button
                      onClick={() => setStep('review')}
                      className="flex-1 h-11 bg-primary text-primary-foreground font-semibold rounded-lg text-sm flex items-center justify-center gap-2 transition-opacity active:opacity-80">
                      {C.continueToEscrow} <Icon name="LockClosedIcon" size={16} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── ORDER REVIEW STEP ── */}
            {step === 'review' && (
              <div className="space-y-4">
                {/* Header */}
                <div className="bg-card rounded-2xl border border-border p-6">
                  <h2 className="text-base font-bold text-foreground mb-1 flex items-center gap-2">
                    <Icon name="ClipboardDocumentListIcon" size={18} className="text-primary" />
                    Review Your Order
                  </h2>
                  <p className="text-xs text-muted-foreground">Please review all details carefully before placing your order.</p>
                </div>

                {/* Cart Items */}
                <div className="bg-card rounded-2xl border border-border p-6">
                  <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                    <Icon name="ShoppingCartIcon" size={15} className="text-primary" />
                    Cart Summary
                    <span className="ml-auto text-xs text-muted-foreground font-normal">{displayItems.length} item{displayItems.length !== 1 ? 's' : ''}</span>
                  </h3>
                  <div className="space-y-4">
                    {displayItems.map((item) => (
                      <div key={item.id} className="flex gap-4 pb-4 border-b border-border last:border-0 last:pb-0">
                        <div className="w-16 h-16 rounded-xl overflow-hidden border border-border shrink-0 bg-muted">
                          <AppImage src={item.image} alt={item.alt} width={64} height={64} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground leading-snug mb-0.5">{item.name}</p>
                          <p className="text-xs text-muted-foreground mb-1">{item.supplier}</p>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-muted-foreground">Qty: <span className="font-semibold text-foreground">{item.quantity}</span></span>
                            <span className="text-xs text-muted-foreground">Unit: <span className="font-semibold text-foreground">${item.price.toLocaleString()}</span></span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-foreground">${(item.price * item.quantity).toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">{item.currency}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Shipping Address Review */}
                <div className="bg-card rounded-2xl border border-border p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                      <Icon name="MapPinIcon" size={15} className="text-primary" />
                      Shipping Address
                    </h3>
                    <button
                      onClick={() => setStep('shipping')}
                      className="text-xs text-primary font-medium hover:underline flex items-center gap-1">
                      <Icon name="PencilSquareIcon" size={13} />
                      Edit
                    </button>
                  </div>
                  <div className="bg-muted/40 rounded-xl p-4 space-y-1.5">
                    <p className="text-sm font-semibold text-foreground">{shipping.fullName}</p>
                    {shipping.company && <p className="text-xs text-muted-foreground">{shipping.company}</p>}
                    <p className="text-xs text-muted-foreground">{shipping.address}</p>
                    <p className="text-xs text-muted-foreground">{shipping.city}{shipping.postalCode ? `, ${shipping.postalCode}` : ''}</p>
                    <p className="text-xs text-muted-foreground">{shipping.country}</p>
                    <p className="text-xs text-muted-foreground">{shipping.phone}</p>
                  </div>
                </div>

                {/* Payment & Order Details Review */}
                <div className="bg-card rounded-2xl border border-border p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                      <Icon name="BuildingLibraryIcon" size={15} className="text-primary" />
                      Payment & Order Details
                    </h3>
                    <button
                      onClick={() => setStep('payment')}
                      className="text-xs text-primary font-medium hover:underline flex items-center gap-1">
                      <Icon name="PencilSquareIcon" size={13} />
                      Edit
                    </button>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Payment Method</span>
                      <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Icon name="BuildingLibraryIcon" size={13} className="text-primary" />
                        {paymentGateway.gateway === 'local_wallet' ? C.gatewayLocalWallet :
                         paymentGateway.gateway === 'local_bank_transfer' ? C.gatewayLocalBank :
                         paymentGateway.gateway === 'international_swift' ? 'SWIFT / IBAN' :
                         paymentGateway.gateway === 'international_card'? C.gatewayIntlCard : C.gatewayBankTransfer}
                      </span>
                    </div>
                    {paymentGateway.gateway === 'local_wallet' && paymentGateway.localWallet.walletProvider && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">{C.walletLabel}</span>
                        <span className="text-xs font-semibold text-foreground capitalize">{paymentGateway.localWallet.walletProvider}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Order Category</span>
                      <span className="text-xs font-semibold text-foreground capitalize">
                        {ORDER_CATEGORY_OPTIONS.find(o => o.value === orderCategory)?.labelKey || orderCategory}
                      </span>
                    </div>
                    {agreedDeliveryDays !== '' && Number(agreedDeliveryDays) > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">{C.deliveryDateReview}</span>
                        <span className="text-xs font-semibold text-foreground">
                          {C.daysDash.replace('{days}', String(Number(agreedDeliveryDays))).replace('{date}', new Date(Date.now() + Number(agreedDeliveryDays) * 24 * 60 * 60 * 1000).toLocaleDateString(language === 'ar' ? 'ar' : language === 'zh' ? 'zh-CN' : language === 'tr' ? 'tr-TR' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' }))}
                        </span>
                      </div>
                    )}
                    {notes && (
                      <div className="pt-2 border-t border-border">
                        <p className="text-xs text-muted-foreground mb-1">Order Notes</p>
                        <p className="text-xs text-foreground bg-muted/40 rounded-lg px-3 py-2">{notes}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Order Total Breakdown */}
                <div className="bg-card rounded-2xl border border-border p-6">
                  <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                    <Icon name="ReceiptRefundIcon" size={15} className="text-primary" />
                    Order Total
                  </h3>
                  <div className="space-y-2.5">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal ({displayItems.length} items)</span>
                      <span className="font-medium text-foreground">${displaySubtotal.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Shipping</span>
                      <span className="font-medium text-foreground">${shippingCost}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Icon name="ReceiptPercentIcon" size={13} className="text-amber-500" />
                        Platform Commission
                      </span>
                      <span className="font-medium text-amber-700">${commission.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-base font-bold border-t border-border pt-3 mt-1">
                      <span className="text-foreground">Total Due</span>
                      <span className="text-primary text-lg">{displayTotal.toLocaleString()} YER</span>
                    </div>
                  </div>
                </div>

                {/* Escrow Explanation */}
                <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-5">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
                      <Icon name="LockClosedIcon" size={18} className="text-indigo-600" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-indigo-900 mb-1">{C.escrowProtectedTitle}</p>
                      <p className="text-xs text-indigo-700 leading-relaxed">
                        {C.escrowReviewBody}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Logistics Suggestions Banner */}
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                      <Icon name="TruckIcon" size={18} className="text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-blue-900">{C.shippingOptions}</p>
                      <p className="text-xs text-blue-700">{C.chooseShippingMethod}</p>
                    </div>
                  </div>

                  {/* Shipping Mode Selector */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setShippingMode('full_service')}
                      className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 text-center transition-all ${
                        shippingMode === 'full_service' ?'border-blue-500 bg-blue-100 text-blue-800' :'border-blue-200 bg-white text-blue-600 hover:border-blue-400'
                      }`}
                    >
                      <Icon name="HomeModernIcon" size={18} className={shippingMode === 'full_service' ? 'text-blue-700' : 'text-blue-400'} />
                      <span className="text-[11px] font-bold leading-tight">{C.modeFullShort}</span>
                      <span className="text-[9px] text-blue-500 leading-tight">{C.modeFullSub}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShippingMode('split_service')}
                      className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 text-center transition-all ${
                        shippingMode === 'split_service' ?'border-amber-500 bg-amber-100 text-amber-800' :'border-blue-200 bg-white text-amber-600 hover:border-amber-400'
                      }`}
                    >
                      <Icon name="PuzzlePieceIcon" size={18} className={shippingMode === 'split_service' ? 'text-amber-700' : 'text-amber-400'} />
                      <span className="text-[11px] font-bold leading-tight">{C.modeSplitShort}</span>
                      <span className="text-[9px] text-amber-500 leading-tight">{C.modeSplitSub}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShippingMode('factory_delivery')}
                      className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 text-center transition-all ${
                        shippingMode === 'factory_delivery' ?'border-green-500 bg-green-100 text-green-800' :'border-gray-200 bg-white text-green-600 hover:border-green-400'
                      }`}
                    >
                      <Icon name="BuildingOffice2Icon" size={18} className={shippingMode === 'factory_delivery' ? 'text-green-700' : 'text-green-400'} />
                      <span className="text-[11px] font-bold leading-tight">{C.modeFactoryShort}</span>
                      <span className="text-[9px] text-green-500 leading-tight">{C.modeFactorySub}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShippingMode('self_arranged')}
                      className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 text-center transition-all ${
                        shippingMode === 'self_arranged' ?'border-purple-500 bg-purple-100 text-purple-800' :'border-gray-200 bg-white text-purple-600 hover:border-purple-400'
                      }`}
                    >
                      <Icon name="UserIcon" size={18} className={shippingMode === 'self_arranged' ? 'text-purple-700' : 'text-purple-400'} />
                      <span className="text-[11px] font-bold leading-tight">{C.modeSelfShort}</span>
                      <span className="text-[9px] text-purple-500 leading-tight">{C.modeSelfSub}</span>
                    </button>
                  </div>

                  {/* Show logistics partners button only for full_service or split_service */}
                  {(shippingMode === 'full_service' || shippingMode === 'split_service') && (
                    <button
                      onClick={() => setShowLogisticsSuggestions(true)}
                      className="w-full px-3 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <Icon name="MagnifyingGlassIcon" size={13} />
                      {C.showMatchingPartners}
                    </button>
                  )}

                  {/* Customs clearance — only for international orders */}
                  {isInternationalOrder && (
                    <div className="bg-violet-50 border border-violet-200 rounded-xl p-3 flex items-start gap-2">
                      <Icon name="DocumentCheckIcon" size={16} className="text-violet-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-semibold text-violet-800">{C.customsTitle}</p>
                        <p className="text-[10px] text-violet-600 leading-relaxed">{C.customsIntlNote}</p>
                      </div>
                    </div>
                  )}

                  {(shippingMode === 'factory_delivery') && (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-start gap-2">
                      <Icon name="CheckCircleIcon" size={16} className="text-green-600 shrink-0 mt-0.5" />
                      <p className="text-xs text-green-700">{C.factoryDeliveryNote}</p>
                    </div>
                  )}

                  {(shippingMode === 'self_arranged') && (
                    <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 flex items-start gap-2">
                      <Icon name="CheckCircleIcon" size={16} className="text-purple-600 shrink-0 mt-0.5" />
                      <p className="text-xs text-purple-700">{C.selfArrangedNote}</p>
                    </div>
                  )}
                </div>

                {/* ── Mandatory Agreement Checkbox ── */}
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4" dir={dir}>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={agreedToPolicies}
                      onChange={(e) => setAgreedToPolicies(e.target.checked)}
                      className="mt-1 w-5 h-5 rounded border-amber-400 text-amber-600 focus:ring-amber-500 shrink-0 cursor-pointer"
                    />
                    <span className="text-sm text-gray-800 leading-relaxed">
                      {C.agreePrefix}{' '}
                      <button
                        type="button"
                        onClick={() => { setPolicyModalStep(2); setPolicyModalOpen(true); }}
                        className="text-green-700 font-semibold underline underline-offset-2 hover:text-green-800 transition-colors"
                      >
                        {C.buyerFactoryLink}
                      </button>
                      {C.commaSep}
                      <button
                        type="button"
                        onClick={() => { setPolicyModalStep(1); setPolicyModalOpen(true); }}
                        className="text-amber-700 font-semibold underline underline-offset-2 hover:text-amber-800 transition-colors"
                      >
                        {C.refundPolicyLink}
                      </button>
                      {C.commaAnd}
                      <button
                        type="button"
                        onClick={() => { setPolicyModalStep(3); setPolicyModalOpen(true); }}
                        className="text-indigo-700 font-semibold underline underline-offset-2 hover:text-indigo-800 transition-colors"
                      >
                        {C.tripleSystemLink}
                      </button>
                      {C.agreeSuffix}
                    </span>
                  </label>
                  {!agreedToPolicies && (
                    <p className="text-xs text-amber-700 mt-2 flex items-center gap-1.5 pe-8">
                      <Icon name="ExclamationTriangleIcon" size={13} className="shrink-0" />
                      {C.mustAgreePolicies}
                    </p>
                  )}
                </div>

                {otpError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm flex items-center gap-2">
                    <Icon name="ExclamationCircleIcon" size={16} />
                    {otpError}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={() => setStep('payment')}
                    className="flex-1 h-12 border border-border text-foreground font-semibold rounded-xl text-sm transition-colors hover:bg-muted flex items-center justify-center gap-2">
                    <Icon name="ArrowLeftIcon" size={16} /> {C.back}
                  </button>
                  <button
                    onClick={handleSendOtp}
                    disabled={loading || !agreedToPolicies}
                    className="flex-[2] h-12 bg-primary text-primary-foreground font-bold rounded-xl text-sm disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-opacity active:opacity-80 shadow-md shadow-primary/20">
                    {loading ? (
                      <><Icon name="ArrowPathIcon" size={16} className="animate-spin" /> {C.sending}</>
                    ) : (
                      <><Icon name="LockClosedIcon" size={16} /> {G.completeOrder} — {displayTotal.toLocaleString()} YER</>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* ── OTP STEP ── */}
            {step === 'otp' && (
              <div className="bg-card rounded-2xl border border-border p-6">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Icon name="EnvelopeIcon" size={28} className="text-primary" />
                  </div>
                  <h2 className="text-lg font-bold text-foreground mb-2">Verify Your Order</h2>
                  <p className="text-sm text-muted-foreground">
                    A 6-digit verification code has been sent to<br />
                    <span className="font-semibold text-foreground">{user?.email}</span>
                  </p>
                </div>

                {otpError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm mb-4 flex items-center gap-2">
                    <Icon name="ExclamationCircleIcon" size={16} />
                    {otpError}
                  </div>
                )}

                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2 text-center">Enter 6-digit OTP Code</label>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      className="w-full h-14 px-4 rounded-xl border-2 border-border bg-background text-foreground text-2xl font-bold tracking-[0.5em] text-center focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading || otpCode.length !== 6}
                    className="w-full h-11 bg-primary text-primary-foreground font-semibold rounded-lg text-sm disabled:opacity-60 flex items-center justify-center gap-2 transition-opacity active:opacity-80">
                    {loading ? (
                      <><Icon name="ArrowPathIcon" size={16} className="animate-spin" /> {uploadProgress > 0 ? `Uploading receipt... ${uploadProgress}%` : 'Confirming...'}</>
                    ) : (
                      <><Icon name="CheckCircleIcon" size={16} /> Confirm Order</>
                    )}
                  </button>
                </form>

                <div className="text-center mt-4">
                  <p className="text-xs text-muted-foreground mb-2">Did not receive the code?</p>
                  <button
                    onClick={handleSendOtp}
                    disabled={resendCooldown > 0 || loading}
                    className="text-sm font-semibold text-primary disabled:text-muted-foreground disabled:cursor-not-allowed">
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend OTP'}
                  </button>
                </div>

                <button onClick={() => setStep('review')} className="w-full mt-3 text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1">
                  <Icon name="ArrowLeftIcon" size={14} /> Back to Review
                </button>
              </div>
            )}

            {/* ── CONFIRMED STEP ── */}
            {step === 'confirmed' && (
              <div className="bg-card rounded-2xl border border-border p-8 text-center">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
                  <Icon name="CheckCircleIcon" size={40} className="text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-2">{C.orderSubmitted}</h2>
                <p className="text-muted-foreground mb-4">{C.orderSubmittedBody}</p>
                <div className="bg-muted/50 rounded-xl p-4 mb-5 inline-block">
                  <p className="text-xs text-muted-foreground mb-1">Order Number</p>
                  <p className="text-xl font-bold text-primary font-mono">{confirmedOrderNumber}</p>
                </div>

                {/* Escrow Status Banner */}
                <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-5 text-right flex items-start gap-3" dir={dir}>
                  <Icon name="LockClosedIcon" size={18} className="text-indigo-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-indigo-900">{C.fundsInEscrowTitle}</p>
                    <p className="text-xs text-indigo-700 mt-0.5 leading-relaxed">
                      {C.fundsInEscrowBody}
                    </p>
                  </div>
                </div>

                {/* Factory Notification Confirmation */}
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-5 text-right flex items-start gap-3" dir={dir}>
                  <Icon name="BellAlertIcon" size={18} className="text-green-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-green-800">{C.factoryNotifiedTitle}</p>
                    <p className="text-xs text-green-700 mt-0.5">
                      {C.factoryNotifiedBody}
                    </p>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground mb-6">
                  A confirmation email has been sent to <strong>{user?.email}</strong>.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Link href="/orders" className="px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-lg text-sm flex items-center justify-center gap-2">
                    <Icon name="TruckIcon" size={16} /> Track Order
                  </Link>
                  <Link href="/" className="px-6 py-3 border border-border text-foreground font-semibold rounded-lg text-sm flex items-center justify-center gap-2 hover:bg-muted transition-colors">
                    Continue Shopping
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Order Summary Sidebar */}
          {step !== 'confirmed' && (
            <div className="lg:col-span-1">
              <div className="bg-card rounded-2xl border border-border p-5 sticky top-20">
                <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                  <Icon name="ShoppingCartIcon" size={15} className="text-primary" />
                  {C.orderSummary}
                </h3>
                {displayItems.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">{C.emptyCart}</p>
                ) : (
                  <div className="space-y-3 mb-4">
                    {displayItems.map((item) => (
                      <div key={item.id} className="flex gap-3">
                        <div className="w-12 h-12 rounded-lg overflow-hidden border border-border shrink-0">
                          <AppImage src={item.image} alt={item.alt} width={48} height={48} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">{item.name}</p>
                          <p className="text-xs text-muted-foreground">{C.qtyLabel.replace('{qty}', String(item.quantity))}</p>
                          <p className="text-xs font-semibold text-foreground">{(item.price * item.quantity).toLocaleString()} YER</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="border-t border-border pt-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{C.subtotal}</span>
                    <span className="font-medium text-foreground">{displaySubtotal.toLocaleString()} YER</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{C.shippingLabel}</span>
                    <span className="font-medium text-foreground">{shippingCost} YER</span>
                  </div>
                  {step === 'review' && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{C.commissionOnSupplier}</span>
                      <span className="font-medium text-amber-700 text-xs line-through">{commission.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-bold border-t border-border pt-2">
                    <span className="text-foreground">{C.total}</span>
                    <span className="text-primary">{displayTotal.toLocaleString()} YER</span>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
                  <Icon name="LockClosedIcon" size={14} className="text-indigo-500 shrink-0" />
                  {C.escrowProtectedSidebar}
                </div>

                {/* Escrow Protection Trust Banner */}
                <div className="mt-3 rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 rounded-full bg-emerald-600 flex items-center justify-center shrink-0">
                      <Icon name="ShieldCheckIcon" size={14} className="text-white" />
                    </div>
                    <span className="text-xs font-bold text-emerald-800">Escrow Protection Active</span>
                  </div>
                  <p className="text-[11px] text-emerald-700 leading-relaxed mb-3">
                    Your payment is held securely in escrow and only released to the supplier after you confirm delivery and satisfaction.
                  </p>
                  <div className="space-y-1.5">
                    {[
                      { icon: 'BanknotesIcon', text: 'Funds held until delivery confirmed' },
                      { icon: 'ArrowPathIcon', text: 'Full refund if order not fulfilled' },
                      { icon: 'DocumentCheckIcon', text: 'Dispute resolution guaranteed' },
                    ].map((item) => (
                      <div key={item.text} className="flex items-center gap-2">
                        <Icon name={item.icon as 'BanknotesIcon'} size={12} className="text-emerald-600 shrink-0" />
                        <span className="text-[10px] text-emerald-700 font-medium">{item.text}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-emerald-200 flex items-center justify-between">
                    <span className="text-[10px] text-emerald-600 font-semibold uppercase tracking-wide">DirectHub Escrow™</span>
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[10px] text-emerald-600 font-medium">Protected</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
      <BottomNav />
      {policyModalOpen && (
        <CheckoutPolicyModal
          onClose={() => setPolicyModalOpen(false)}
          initialStep={policyModalStep}
        />
      )}
      {/* Logistics Suggestions Modal */}
      {showLogisticsSuggestions && (
        <LogisticsSuggestionsModal
          buyerCountry={shipping.country}
          shippingMode={shippingMode}
          onClose={() => setShowLogisticsSuggestions(false)}
        />
      )}
    </div>
  );
}
