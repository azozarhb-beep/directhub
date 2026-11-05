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

const STEP_CONFIG: { key: Step; labelEn: string; labelAr: string; icon: string }[] = [
  { key: 'shipping', labelEn: 'Shipping', labelAr: 'بيانات الشحن', icon: 'TruckIcon' },
  { key: 'payment', labelEn: 'Payment', labelAr: 'طريقة الدفع', icon: 'BuildingLibraryIcon' },
  { key: 'review', labelEn: 'Review', labelAr: 'مراجعة الطلب', icon: 'ClipboardDocumentListIcon' },
  { key: 'otp', labelEn: 'Verify', labelAr: 'التحقق والأمان', icon: 'ShieldCheckIcon' },
];

// ── Policy Modal (Refund → Buyer Protection → Work Mechanism) ─────────────────
type PolicyStep = 1 | 2 | 3;

const CheckoutPolicyModal: React.FC<{ onClose: () => void; initialStep?: PolicyStep }> = ({ onClose, initialStep = 1 }) => {
  const { t, dir } = useLanguage();
  const P = t.checkout.policies;
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
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60">
      <div className="bg-card text-foreground rounded-2xl shadow-2xl w-full sm:max-w-2xl flex flex-col border border-border" style={{ maxHeight: 'calc(100vh - 5rem)' }} dir={dir} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-center gap-2 pt-3 pb-1 shrink-0">
          {([1, 2, 3] as PolicyStep[]).map((s) => (
            <div key={s} className={`h-1.5 rounded-full transition-all duration-300 ${s === step ? 'w-8 bg-primary' : s < step ? 'w-4 bg-muted-foreground' : 'w-4 bg-muted'}`} />
          ))}
        </div>
        <div className={`flex items-center justify-between px-6 py-4 bg-gradient-to-r ${stepColors[step]} text-white shrink-0 rounded-t-xl`}>
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
        <div className="overflow-y-auto flex-1 px-6 py-5 text-sm leading-relaxed" style={{ paddingBottom: '1.5rem' }}>
          {step === 1 && <CheckoutRefundPolicyContent />}
          {step === 2 && <CheckoutBuyerProtectionContent />}
          {step === 3 && <CheckoutWorkMechanismContent />}
        </div>
        <div className="px-6 py-4 border-t border-border bg-muted/30 shrink-0 flex items-center justify-between rounded-b-2xl">
          <span className="text-xs text-muted-foreground">{P.stepOf.replace('{step}', String(step))}</span>
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
    { title: P.fullRefundTitle, icon: 'CheckCircleIcon', color: 'text-green-600', bg: 'bg-green-500/10 border-green-500/20', items: P.fullRefundItems },
    { title: P.partialRefundTitle, icon: 'AdjustmentsHorizontalIcon', color: 'text-blue-600', bg: 'bg-blue-500/10 border-blue-500/20', items: P.partialRefundItems },
    { title: P.noRefundTitle, icon: 'XCircleIcon', color: 'text-red-600', bg: 'bg-red-500/10 border-red-500/20', items: P.noRefundItems },
    { title: P.refundProcessTitle, icon: 'ClipboardDocumentCheckIcon', color: 'text-purple-600', bg: 'bg-purple-500/10 border-purple-500/20', items: P.refundProcessItems },
  ];
  return (
    <div className="space-y-5">
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
        <p className="text-amber-700 dark:text-amber-400 font-semibold text-sm">{P.refundIntro}</p>
      </div>
      {sections.map((section, i) => (
        <div key={i}>
          <div className="flex items-center gap-2 mb-3">
            <Icon name={section.icon as any} size={18} className={section.color} />
            <h4 className="font-bold text-foreground">{section.title}</h4>
          </div>
          <div className={`rounded-xl border p-4 space-y-2 ${section.bg}`}>
            {section.items.map((item, j) => (
              <div key={j} className="flex gap-2">
                <span className="text-muted-foreground shrink-0 mt-0.5">•</span>
                <p className="text-muted-foreground text-xs leading-relaxed">{item}</p>
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
          <h3 className="font-bold text-foreground text-base">{P.buyerProtectionTitle} <span className="text-muted-foreground font-normal text-sm">(Buyer Protection Policy)</span></h3>
        </div>
        <div className="space-y-3 ps-2">
          {P.buyerStages.map((item, i) => (
            <div key={i} className="flex gap-3 bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
              <Icon name={buyerIcons[i] as any} size={18} className={`${buyerColors[i]} shrink-0 mt-0.5`} />
              <div>
                <p className="font-semibold text-foreground mb-0.5">{item.title}</p>
                <p className="text-muted-foreground text-xs leading-relaxed">{item.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-dashed border-border" />
      <div>
        <div className="flex items-center gap-2 mb-4">
          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-green-600 text-white text-xs font-bold shrink-0">{P.second}</span>
          <h3 className="font-bold text-foreground text-base">{P.factoryProtectionTitle} <span className="text-muted-foreground font-normal text-sm">(Factory Protection Policy)</span></h3>
        </div>
        <div className="space-y-3 ps-2">
          {P.factoryStages.map((item, i) => (
            <div key={i} className="flex gap-3 bg-green-500/10 border border-green-500/20 rounded-xl p-3">
              <Icon name={factoryIcons[i] as any} size={18} className={`${factoryColors[i]} shrink-0 mt-0.5`} />
              <div>
                <p className="font-semibold text-foreground mb-0.5">{item.title}</p>
                <p className="text-muted-foreground text-xs leading-relaxed">{item.body}</p>
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
  const partyBgs = ['bg-blue-500/10 border-blue-500/20', 'bg-green-500/10 border-green-500/20', 'bg-indigo-500/10 border-indigo-500/20'];
  const dealIcons = ['ChatBubbleLeftRightIcon', 'LockClosedIcon', 'QrCodeIcon', 'TruckIcon', 'KeyIcon'];
  const dealColors = ['text-blue-500', 'text-green-500', 'text-purple-500', 'text-amber-500', 'text-teal-500'];
  return (
    <div className="space-y-5">
      <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4">
        <h3 className="font-bold text-indigo-700 dark:text-indigo-400 text-sm mb-1">{P.transparencyTitle}</h3>
        <p className="text-indigo-600 dark:text-indigo-300 text-xs leading-relaxed">{P.transparencyIntro}</p>
      </div>
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="flex items-center justify-center w-7 h-7 rounded-full bg-indigo-600 text-white text-xs font-bold shrink-0">1</span>
          <h4 className="font-bold text-foreground">{P.triplePartiesTitle}</h4>
        </div>
        <div className="space-y-2 ps-2">
          {P.tripleParties.map((item, i) => (
            <div key={i} className={`flex gap-3 rounded-xl border p-3 ${partyBgs[i]}`}>
              <Icon name={partyIcons[i] as any} size={18} className={`${partyColors[i]} shrink-0 mt-0.5`} />
              <div>
                <p className="font-semibold text-foreground text-xs mb-0.5">{item.title}</p>
                <p className="text-muted-foreground text-xs leading-relaxed">{item.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="flex items-center justify-center w-7 h-7 rounded-full bg-indigo-600 text-white text-xs font-bold shrink-0">2</span>
          <h4 className="font-bold text-foreground">{P.dealCycleTitle}</h4>
        </div>
        <div className="space-y-2 ps-2">
          {P.dealSteps.map((item, i) => (
            <div key={i} className="flex gap-3 bg-muted/40 border border-border rounded-xl p-3">
              <div className="flex flex-col items-center gap-1 shrink-0">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-500/10 text-indigo-600 text-[10px] font-bold">{i + 1}</span>
                <Icon name={dealIcons[i] as any} size={14} className={dealColors[i]} />
              </div>
              <div>
                <p className="font-semibold text-foreground text-xs mb-0.5">{item.title}</p>
                <p className="text-muted-foreground text-xs leading-relaxed">{item.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

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

function getPartnerCategoryGroup(p: LogisticsPartnerSuggestion): string {
  if (p.partner_category_group) return p.partner_category_group;
  if (p.partner_type === 'international_shipping_office' || p.partner_type === 'freight_forwarder') return 'international';
  if (p.partner_type === 'local_shipping_distribution' || p.partner_type === 'logistics_company' || p.partner_type === 'shipping_office') return 'local';
  if (p.partner_type === 'customs_broker') return 'customs';
  return 'other';
}

type LogisticsSelectionTab = 'international' | 'local' | 'customs';
type ShippingMode = 'full_service' | 'split_service' | 'factory_delivery' | 'self_arranged';

const LogisticsSuggestionsModal: React.FC<{
  buyerCountry: string;
  shippingMode: ShippingMode;
  onClose: () => void;
}> = ({ buyerCountry, shippingMode, onClose }) => {
  const { t, dir } = useLanguage();
  const C = t.checkout;
  const G = t.checkout.logistics;

  const { user } = useAuth();
  const supabase = createClient();

  const [allPartners, setAllPartners] = useState<LogisticsPartnerSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<LogisticsSelectionTab>('international');

  const [selectedInternational, setSelectedInternational] = useState<LogisticsPartnerSuggestion | null>(null);
  const [selectedLocal, setSelectedLocal] = useState<LogisticsPartnerSuggestion | null>(null);
  const [selectedCustoms, setSelectedCustoms] = useState<LogisticsPartnerSuggestion | null>(null);

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
      desc: shippingMode === 'full_service' ? G.intlDescSplit.replace('{port}', buyerCountry || G.arrival) : G.intlDescFull,
    },
    {
      key: 'local',
      label: G.localDistribution,
      icon: 'TruckIcon',
      color: 'text-emerald-600',
      partners: localPartners,
      selected: selectedLocal,
      setSelected: setSelectedLocal,
      desc: shippingMode === 'full_service' ? G.localDescSplit.replace('{country}', buyerCountry || G.yourCountry) : G.localDescFull.replace('{country}', buyerCountry || G.yourCountry),
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
        <div className="bg-card text-foreground rounded-2xl shadow-2xl w-full max-w-md border border-border" onClick={e => e.stopPropagation()} dir={dir}>
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
                <p className="font-bold text-foreground">{G.messageSent}</p>
                <p className="text-sm text-muted-foreground mt-1">{G.partnerWillContact}</p>
                <button onClick={() => { setContactPartner(null); setSent(false); setMessage(''); }} className="mt-4 px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors">
                  {G.return}
                </button>
              </div>
            ) : (
              <>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-2 block">{G.yourMessage}</label>
                  <textarea
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    placeholder={G.messagePlaceholder.replace('{country}', buyerCountry || '')}
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-blue-400 resize-none"
                  />
                </div>
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input type="checkbox" checked={shippingAgreed} onChange={e => setShippingAgreed(e.target.checked)} className="mt-0.5 w-4 h-4 rounded accent-amber-600" />
                    <span className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
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
      <div className="bg-card text-foreground rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col border border-border" onClick={e => e.stopPropagation()} dir={dir}>
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

        <div className={`px-5 py-2 shrink-0 flex items-center gap-2 text-xs font-semibold ${
          shippingMode === 'full_service' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-b border-blue-500/20' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-b border-amber-500/20'
        }`}>
          <Icon name={shippingMode === 'full_service' ? 'HomeModernIcon' : 'PuzzlePieceIcon'} size={13} />
          {shippingMode === 'full_service' ? G.showsFull : G.showsSplit}
        </div>

        {totalSelected > 0 && (
          <div className="px-5 py-3 bg-muted/30 border-b border-border shrink-0">
            <p className="text-[10px] font-bold text-primary mb-2">{G.selectedPartners}</p>
            <div className="flex flex-wrap gap-2">
              {selectedInternational && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-500/15 text-blue-700 dark:text-blue-400 rounded-lg text-xs">
                  <Icon name="GlobeAltIcon" size={11} />
                  <span className="font-semibold">{selectedInternational.company_name}</span>
                  <button onClick={() => setSelectedInternational(null)} className="hover:text-red-600">
                    <Icon name="XMarkIcon" size={11} />
                  </button>
                </div>
              )}
              {selectedLocal && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 rounded-lg text-xs">
                  <Icon name="TruckIcon" size={11} />
                  <span className="font-semibold">{selectedLocal.company_name}</span>
                  <button onClick={() => setSelectedLocal(null)} className="hover:text-red-600">
                    <Icon name="XMarkIcon" size={11} />
                  </button>
                </div>
              )}
              {selectedCustoms && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-violet-500/15 text-violet-700 dark:text-violet-400 rounded-lg text-xs">
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

        <div className="flex border-b border-border shrink-0">
          {tabConfig.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-3 text-xs font-semibold transition-colors relative ${
                activeTab === tab.key ? `${tab.color} border-b-2 border-current` : 'text-muted-foreground hover:text-foreground'
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
          <p className="text-[11px] text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">{currentTab.desc}</p>

          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Icon name="ArrowPathIcon" size={28} className="animate-spin text-blue-500" />
            </div>
          ) : currentTab.partners.length === 0 ? (
            <div className="text-center py-8">
              <Icon name="TruckIcon" size={36} className="text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">{G.noPartners}</p>
              <Link href="/logistics" className="mt-3 inline-flex items-center gap-1.5 text-xs text-primary hover:underline">
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
                    isSelected ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/40'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      activeTab === 'international' ? 'bg-blue-500/10' : activeTab === 'local' ? 'bg-emerald-500/10' : 'bg-violet-500/10'
                    }`}>
                      <Icon name={activeTab === 'international' ? 'GlobeAltIcon' : activeTab === 'local' ? 'TruckIcon' : 'DocumentCheckIcon'} size={16} className={currentTab.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground text-sm truncate">{p.company_name}</p>
                      <p className="text-[10px] text-muted-foreground">{(C.partnerTypes as any)[p.partner_type] || p.partner_type} — {p.city}, {p.country}</p>
                      {p.operating_hub && <p className="text-[10px] text-primary">{G.operatingFrom.replace('{hub}', p.operating_hub)}</p>}
                      {p.local_coverage_country && <p className="text-[10px] text-emerald-600 dark:text-emerald-400">{G.covers.replace('{country}', p.local_coverage_country)}</p>}
                      {p.specialized_role && shippingMode === 'split_service' && (
                        <p className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                          {G.role.replace('{role}', (C.specializedRoles as any)[p.specialized_role] || p.specialized_role)}
                        </p>
                      )}
                      {p.base_rate_usd && <p className="text-[10px] text-muted-foreground font-medium">{G.fromRatePlain.replace('{rate}', String(p.base_rate_usd))} {p.rate_description || 'USD'}</p>}
                    </div>
                    <div className="flex flex-col gap-1.5 shrink-0">
                      <button
                        onClick={() => currentTab.setSelected(isSelected ? null : p)}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-colors ${
                          isSelected ? 'bg-blue-600 text-white' : 'bg-muted text-foreground hover:bg-primary/20'
                        }`}
                      >
                        {isSelected ? G.selected : G.select}
                      </button>
                      <button
                        onClick={() => setContactPartner(p)}
                        className="px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-muted/50 text-muted-foreground hover:bg-muted transition-colors border border-border"
                      >
                        {G.contact}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}

          <div className="pt-2 border-t border-border">
            <Link href="/logistics" className="flex items-center justify-center gap-2 text-xs text-primary hover:underline">
              <Icon name="GlobeAltIcon" size={13} />
              {G.browseFullMarket}
            </Link>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-border bg-muted/20 rounded-b-2xl shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground">
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
  const [agreedDeliveryDays, setAgreedDeliveryDays] = useState<number | ''>('');

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

  const isInternationalOrder = shipping.country && shipping.country !== 'Saudi Arabia' && shipping.country !== 'Yemen' && shipping.country !== '';
  const allDeliveryIncluded = cartItems.length > 0 && cartItems.every((i) => i.shippingTerms === 'DELIVERY_INCLUDED');
  const shippingCost = allDeliveryIncluded ? 0 : 150;

  const displayItems: CartItem[] = cartItems.map((i) => ({
    id: i.productId,
    name: i.name,
    image: i.image,
    alt: i.alt,
    price: i.price,
    currency: i.currency || '$',
    quantity: i.quantity,
    supplier: i.supplier
  }));

  const displaySubtotal = subtotal;
  const displayTotal = displaySubtotal + shippingCost;

  // ── الدالة الذكية لتوحيد تنسيق العملة مع العملة الفعلية للسلة ───────────────
  const activeCurrency = cartItems[0]?.currency || '$';
  const formatCurrency = (val: number) => {
    if (activeCurrency === '$' || activeCurrency === 'USD') {
      return `$${val.toLocaleString()}`;
    }
    return `${val.toLocaleString()} ${activeCurrency}`;
  };

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
            total: displayTotal
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
          wire_transfer_verified: wireOcrVerified,
          wire_transfer_ocr_result: wireOcrResult || null,
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

      if (isCashUpfrontEscrow) {
        await supabase.from('cfo_approval_log').insert({
          order_id: order.id,
          action: 'submitted',
          note: `طلب دفع نقدي كامل — ${formatCurrency(displayTotal)} — بانتظار موافقة المدير المالي`,
          amount_usd: displayTotal,
        });
      }

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

  if (!authLoading && cartItems.length === 0 && step === 'shipping') {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="max-w-2xl mx-auto px-4 py-20 text-center">
          <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-5">
            <Icon name="ShoppingCartIcon" size={36} className="text-muted-foreground" />
          </div>
          <h1 className="text-xl font-bold text-foreground mb-2">
            {language === 'ar' ? 'سلة التسوق فارغة' : 'Your cart is empty'}
          </h1>
          <p className="text-muted-foreground mb-6 text-sm">
            {language === 'ar' ? 'أضف منتجات إلى سلتك قبل المتابعة لإتمام الطلب.' : 'Add items to your cart before proceeding to checkout.'}
          </p>
          <Link href="/" className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-xl text-sm">
            <Icon name="ArrowLeftIcon" size={16} />
            {language === 'ar' ? 'تصفح المنتجات' : 'Browse Products'}
          </Link>
        </main>
        <BottomNav />
      </div>
    );
  }

  const stepKeys = STEP_CONFIG.map((s) => s.key);
  const currentStepIndex = stepKeys.indexOf(step);

  return (
    <div className="min-h-screen bg-background" dir={dir}>
      <Header />
      <main className="max-w-5xl mx-auto px-4 md:px-6 py-6 mobile-safe-bottom md:pb-10">
        {/* شريط العنوان العلوي */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/cart" className="text-muted-foreground hover:text-foreground transition-colors">
            <Icon name="ArrowRightIcon" size={20} className={isRTL ? '' : 'rotate-180'} />
          </Link>
          <h1 className="text-xl font-bold text-foreground">
            {language === 'ar' ? 'إتمام الطلب' : 'Checkout'}
          </h1>
          <span className="ms-auto inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-semibold">
            <Icon name="LockClosedIcon" size={12} />
            {language === 'ar' ? 'دفع محمي بالضمان المشروط' : 'Escrow Protected'}
          </span>
        </div>

        {/* شريط خطوات التقدم */}
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
                    <span className="text-xs font-medium hidden sm:block">
                      {language === 'ar' ? s.labelAr : s.labelEn}
                    </span>
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
          {/* المحتوى الرئيسي */}
          <div className="lg:col-span-2">

            {/* ── خطوة الشحن ── */}
            {step === 'shipping' && (
              <div className="bg-card rounded-2xl border border-border p-6">
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

                  <div className="border-t border-border pt-4">
                    <SellerFulfillmentSelector
                      value={sellerFulfillment}
                      onChange={setSellerFulfillment}
                    />
                  </div>

                  {sellerFulfillment.fulfillmentType === 'seller_fulfilled' && !sellerFulfillment.incotermType && (
                    <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                      <Icon name="ExclamationTriangleIcon" size={14} className="shrink-0" />
                      يرجى تحديد شرط التسليم (Incoterm) للمتابعة
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={sellerFulfillment.fulfillmentType === 'seller_fulfilled' && !sellerFulfillment.incotermType}
                    className="w-full h-11 bg-primary text-primary-foreground font-semibold rounded-lg text-sm transition-opacity active:opacity-80 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {C.continueToPayment} <Icon name="ArrowRightIcon" size={16} className={isRTL ? 'rotate-180' : ''} />
                  </button>
                </form>
              </div>
            )}

            {/* ── خطوة الدفع (تم إزالة التكرار) ── */}
            {step === 'payment' && (
              <div className="space-y-4">
                <div className="bg-card rounded-2xl border border-border p-6">
                  {/* صندوق شرح الضمان المالي */}
                  <div className="mb-5 flex items-start gap-3 p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
                    <div className="w-9 h-9 rounded-xl bg-indigo-500/20 flex items-center justify-center shrink-0">
                      <Icon name="LockClosedIcon" size={18} className="text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-indigo-900 dark:text-indigo-300">{C.escrowTitle}</p>
                      <p className="text-xs text-indigo-700 dark:text-indigo-400 leading-relaxed mt-0.5">
                        {C.escrowPaymentBody}
                      </p>
                    </div>
                  </div>

                  {/* بوابات الدفع (تتضمن عنوانها الخاص لمنع التكرار) */}
                  <PaymentGatewaySelector
                    value={paymentGateway}
                    onChange={setPaymentGateway}
                  />

                  {/* ملاحظات الطلب */}
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

                  {/* مدة التسليم المتفق عليها */}
                  <div className="mb-5">
                    <label className="block text-xs font-medium text-foreground mb-1.5">
                      {C.agreedDeliveryDays}
                      <span className="ms-1 text-muted-foreground font-normal">{C.asAgreedWithSupplier}</span>
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
                          {C.deliveryDateLabel.replace('{date}', new Date(Date.now() + Number(agreedDeliveryDays) * 24 * 60 * 60 * 1000).toLocaleDateString(language === 'ar' ? 'ar' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' }))}
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1.5">
                      {C.deliveryDateInvoiceNote}
                    </p>
                  </div>

                  {/* خيار الدفع النقدي الكامل عبر الضمان */}
                  <div className="mb-5">
                    <button
                      type="button"
                      onClick={() => setIsCashUpfrontEscrow(!isCashUpfrontEscrow)}
                      className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-start cursor-pointer ${
                        isCashUpfrontEscrow ? 'border-emerald-500 bg-emerald-500/10' : 'border-border bg-background hover:border-emerald-400/50'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isCashUpfrontEscrow ? 'bg-emerald-500/20' : 'bg-muted'}`}>
                        <Icon name="BanknotesIcon" size={20} className={isCashUpfrontEscrow ? 'text-emerald-600' : 'text-muted-foreground'} />
                      </div>
                      <div className="flex-1 text-start">
                        <p className={`text-sm font-bold ${isCashUpfrontEscrow ? 'text-emerald-700 dark:text-emerald-300' : 'text-foreground'}`}>
                          {language === 'ar' ? '💰 دفع نقدي كامل مسبق عبر الضمان' : '💰 Full Upfront Cash via Escrow'}
                        </p>
                        <p className={`text-xs mt-0.5 ${isCashUpfrontEscrow ? 'text-emerald-600/90 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                          {language === 'ar' ? 'تجميد المبلغ الكامل في حساب الضمان — يتطلب موافقة المدير المالي وتحقق SWIFT' : 'Freeze full amount in escrow — requires CFO approval & SWIFT verification'}
                        </p>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${isCashUpfrontEscrow ? 'border-emerald-500 bg-emerald-500' : 'border-muted-foreground/40'}`}>
                        {isCashUpfrontEscrow && <Icon name="CheckIcon" size={11} className="text-white" />}
                      </div>
                    </button>

                    {isCashUpfrontEscrow && (
                      <div className="mt-3 space-y-3">
                        <div className="flex items-start gap-2.5 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                          <Icon name="ClockIcon" size={16} className="text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs font-bold text-amber-800 dark:text-amber-300">
                              {language === 'ar' ? 'يتطلب موافقة المدير المالي (CFO Approval)' : 'Requires CFO Approval'}
                            </p>
                            <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                              {language === 'ar' ? 'سيتم إرسال طلبك إلى الإدارة المالية للمراجعة والاعتماد قبل تجميد المبلغ في الضمان.' : 'Your order will be sent to the CFO for review and approval before funds are frozen in escrow.'}
                            </p>
                          </div>
                        </div>
                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
                          <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300 mb-2">
                            {language === 'ar' ? 'ملخص الدفع النقدي الكامل' : 'Cash Upfront Summary'}
                          </p>
                          <div className="space-y-1.5">
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">{language === 'ar' ? 'إجمالي الطلب' : 'Order Total'}</span>
                              <span className="font-bold">{formatCurrency(displayTotal)}</span>
                            </div>
                            <div className="flex justify-between text-xs border-t border-emerald-500/20 pt-1.5">
                              <span className="font-bold text-emerald-700 dark:text-emerald-300">{language === 'ar' ? 'المبلغ المجمّد في الضمان' : 'Amount Frozen in Escrow'}</span>
                              <span className="font-bold text-emerald-700 dark:text-emerald-300 text-sm">{formatCurrency(displayTotal)}</span>
                            </div>
                          </div>
                        </div>
                        {paymentGateway.gateway === 'international_swift' && (
                          <>
                            <WireTransferOCRVerifier
                              onVerified={(result) => {
                                setWireOcrVerified(true);
                                setWireOcrResult(result);
                              }}
                            />
                            {wireOcrVerified && (
                              <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/20 border border-emerald-500/40 rounded-lg">
                                <Icon name="CheckBadgeIcon" size={16} className="text-emerald-600" />
                                <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                                  {language === 'ar' ? 'تم التحقق من إيصال التحويل البنكي ✓' : 'Wire transfer receipt verified ✓'}
                                </p>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {error && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-600 rounded-lg px-4 py-3 text-sm mb-4 flex items-center gap-2">
                      <Icon name="ExclamationCircleIcon" size={16} />
                      {error}
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button onClick={() => setStep('shipping')} className="flex-1 h-11 border border-border text-foreground font-semibold rounded-lg text-sm transition-colors hover:bg-muted flex items-center justify-center gap-2">
                      <Icon name="ArrowRightIcon" size={16} className={isRTL ? '' : 'rotate-180'} /> {C.back}
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

            {/* ── خطوة مراجعة الطلب المعربة ── */}
            {step === 'review' && (
              <div className="space-y-4">
                <div className="bg-card rounded-2xl border border-border p-6">
                  <h2 className="text-base font-bold text-foreground mb-1 flex items-center gap-2">
                    <Icon name="ClipboardDocumentListIcon" size={18} className="text-primary" />
                    {language === 'ar' ? 'مراجعة وتأكيد الطلب' : 'Review Your Order'}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {language === 'ar' ? 'يرجى مراجعة كافة التفاصيل التعاقدية وعناوين الشحن بدقة قبل الإرسال.' : 'Please review all details carefully before placing your order.'}
                  </p>
                </div>

                {/* أصناف السلة */}
                <div className="bg-card rounded-2xl border border-border p-6">
                  <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                    <Icon name="ShoppingCartIcon" size={15} className="text-primary" />
                    {language === 'ar' ? 'المنتجات المطلوبة' : 'Cart Summary'}
                    <span className="ms-auto text-xs text-muted-foreground font-normal">
                      {displayItems.length} {language === 'ar' ? 'أصناف' : 'items'}
                    </span>
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
                            <span className="text-xs text-muted-foreground">{language === 'ar' ? 'الكمية:' : 'Qty:'} <span className="font-semibold text-foreground">{item.quantity}</span></span>
                            <span className="text-xs text-muted-foreground">{language === 'ar' ? 'سعر الوحدة:' : 'Unit:'} <span className="font-semibold text-foreground">{formatCurrency(item.price)}</span></span>
                          </div>
                        </div>
                        <div className="text-end shrink-0">
                          <p className="text-sm font-bold text-foreground">{formatCurrency(item.price * item.quantity)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* عنوان الشحن */}
                <div className="bg-card rounded-2xl border border-border p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                      <Icon name="MapPinIcon" size={15} className="text-primary" />
                      {language === 'ar' ? 'عنوان التسليم والشحن' : 'Shipping Address'}
                    </h3>
                    <button
                      onClick={() => setStep('shipping')}
                      className="text-xs text-primary font-medium hover:underline flex items-center gap-1">
                      <Icon name="PencilSquareIcon" size={13} />
                      {language === 'ar' ? 'تعديل' : 'Edit'}
                    </button>
                  </div>
                  <div className="bg-muted/40 rounded-xl p-4 space-y-1.5 text-start">
                    <p className="text-sm font-semibold text-foreground">{shipping.fullName}</p>
                    {shipping.company && <p className="text-xs text-muted-foreground">{shipping.company}</p>}
                    <p className="text-xs text-muted-foreground">{shipping.address}</p>
                    <p className="text-xs text-muted-foreground">{shipping.city}{shipping.postalCode ? `, ${shipping.postalCode}` : ''}</p>
                    <p className="text-xs text-muted-foreground">{shipping.country}</p>
                    <p className="text-xs text-muted-foreground">{shipping.phone}</p>
                  </div>
                </div>

                {/* تفاصيل السداد والملاحظات */}
                <div className="bg-card rounded-2xl border border-border p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                      <Icon name="BuildingLibraryIcon" size={15} className="text-primary" />
                      {language === 'ar' ? 'بيانات الدفع والتعاقد' : 'Payment & Order Details'}
                    </h3>
                    <button
                      onClick={() => setStep('payment')}
                      className="text-xs text-primary font-medium hover:underline flex items-center gap-1">
                      <Icon name="PencilSquareIcon" size={13} />
                      {language === 'ar' ? 'تعديل' : 'Edit'}
                    </button>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{language === 'ar' ? 'طريقة الدفع' : 'Payment Method'}</span>
                      <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Icon name="BuildingLibraryIcon" size={13} className="text-primary" />
                        {paymentGateway.gateway === 'local_wallet' ? C.gatewayLocalWallet :
                         paymentGateway.gateway === 'local_bank_transfer' ? C.gatewayLocalBank :
                         paymentGateway.gateway === 'international_swift' ? 'SWIFT / IBAN' : C.gatewayBankTransfer}
                      </span>
                    </div>
                    {paymentGateway.gateway === 'local_wallet' && paymentGateway.localWallet.walletProvider && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">{C.walletLabel}</span>
                        <span className="text-xs font-semibold text-foreground capitalize">{paymentGateway.localWallet.walletProvider}</span>
                      </div>
                    )}
                    {agreedDeliveryDays !== '' && Number(agreedDeliveryDays) > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">{C.deliveryDateReview}</span>
                        <span className="text-xs font-semibold text-foreground">
                          {C.daysDash.replace('{days}', String(Number(agreedDeliveryDays))).replace('{date}', new Date(Date.now() + Number(agreedDeliveryDays) * 24 * 60 * 60 * 1000).toLocaleDateString(language === 'ar' ? 'ar' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' }))}
                        </span>
                      </div>
                    )}
                    {notes && (
                      <div className="pt-2 border-t border-border">
                        <p className="text-xs text-muted-foreground mb-1">{language === 'ar' ? 'ملاحظات إضافية' : 'Order Notes'}</p>
                        <p className="text-xs text-foreground bg-muted/40 rounded-lg px-3 py-2">{notes}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* إجمالي الحساب الموحد */}
                <div className="bg-card rounded-2xl border border-border p-6">
                  <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                    <Icon name="ReceiptRefundIcon" size={15} className="text-primary" />
                    {language === 'ar' ? 'إجمالي الحساب' : 'Order Total'}
                  </h3>
                  <div className="space-y-2.5">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{language === 'ar' ? 'المجموع الفرعي' : 'Subtotal'}</span>
                      <span className="font-medium text-foreground">{formatCurrency(displaySubtotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{language === 'ar' ? 'الشحن التقديري' : 'Shipping'}</span>
                      <span className="font-medium text-foreground">{formatCurrency(shippingCost)}</span>
                    </div>
                    <div className="flex justify-between text-base font-bold border-t border-border pt-3 mt-1">
                      <span className="text-foreground">{language === 'ar' ? 'الإجمالي المستحق' : 'Total Due'}</span>
                      <span className="text-primary text-lg">{formatCurrency(displayTotal)}</span>
                    </div>
                  </div>
                </div>

                {/* الضمان المالي المشروط */}
                <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-5">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-indigo-500/20 flex items-center justify-center shrink-0">
                      <Icon name="LockClosedIcon" size={18} className="text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-indigo-900 dark:text-indigo-300 mb-1">{C.escrowProtectedTitle}</p>
                      <p className="text-xs text-indigo-700 dark:text-indigo-400 leading-relaxed">
                        {C.escrowReviewBody}
                      </p>
                    </div>
                  </div>
                </div>

                {/* خيارات الشحن */}
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-500/20 flex items-center justify-center shrink-0">
                      <Icon name="TruckIcon" size={18} className="text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-blue-900 dark:text-blue-300">{C.shippingOptions}</p>
                      <p className="text-xs text-blue-700 dark:text-blue-400">{C.chooseShippingMethod}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setShippingMode('full_service')}
                      className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 text-center transition-all ${
                        shippingMode === 'full_service' ? 'border-blue-500 bg-blue-500/20 text-blue-800 dark:text-blue-300' : 'border-border bg-card text-blue-600 hover:border-blue-400'
                      }`}
                    >
                      <Icon name="HomeModernIcon" size={18} className={shippingMode === 'full_service' ? 'text-blue-700 dark:text-blue-300' : 'text-blue-400'} />
                      <span className="text-[11px] font-bold leading-tight">{C.modeFullShort}</span>
                      <span className="text-[9px] text-muted-foreground leading-tight">{C.modeFullSub}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShippingMode('split_service')}
                      className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 text-center transition-all ${
                        shippingMode === 'split_service' ? 'border-amber-500 bg-amber-500/20 text-amber-800 dark:text-amber-300' : 'border-border bg-card text-amber-600 hover:border-amber-400'
                      }`}
                    >
                      <Icon name="PuzzlePieceIcon" size={18} className={shippingMode === 'split_service' ? 'text-amber-700 dark:text-amber-300' : 'text-amber-400'} />
                      <span className="text-[11px] font-bold leading-tight">{C.modeSplitShort}</span>
                      <span className="text-[9px] text-muted-foreground leading-tight">{C.modeSplitSub}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShippingMode('factory_delivery')}
                      className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 text-center transition-all ${
                        shippingMode === 'factory_delivery' ? 'border-green-500 bg-green-500/20 text-green-800 dark:text-green-300' : 'border-border bg-card text-green-600 hover:border-green-400'
                      }`}
                    >
                      <Icon name="BuildingOffice2Icon" size={18} className={shippingMode === 'factory_delivery' ? 'text-green-700 dark:text-green-300' : 'text-green-400'} />
                      <span className="text-[11px] font-bold leading-tight">{C.modeFactoryShort}</span>
                      <span className="text-[9px] text-muted-foreground leading-tight">{C.modeFactorySub}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShippingMode('self_arranged')}
                      className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 text-center transition-all ${
                        shippingMode === 'self_arranged' ? 'border-purple-500 bg-purple-500/20 text-purple-800 dark:text-purple-300' : 'border-border bg-card text-purple-600 hover:border-purple-400'
                      }`}
                    >
                      <Icon name="UserIcon" size={18} className={shippingMode === 'self_arranged' ? 'text-purple-700 dark:text-purple-300' : 'text-purple-400'} />
                      <span className="text-[11px] font-bold leading-tight">{C.modeSelfShort}</span>
                      <span className="text-[9px] text-muted-foreground leading-tight">{C.modeSelfSub}</span>
                    </button>
                  </div>

                  {(shippingMode === 'full_service' || shippingMode === 'split_service') && (
                    <button
                      onClick={() => setShowLogisticsSuggestions(true)}
                      className="w-full px-3 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <Icon name="MagnifyingGlassIcon" size={13} />
                      {C.showMatchingPartners}
                    </button>
                  )}

                  {isInternationalOrder && (
                    <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-3 flex items-start gap-2">
                      <Icon name="DocumentCheckIcon" size={16} className="text-violet-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-semibold text-violet-800 dark:text-violet-300">{C.customsTitle}</p>
                        <p className="text-[10px] text-violet-600 dark:text-violet-400 leading-relaxed">{C.customsIntlNote}</p>
                      </div>
                    </div>
                  )}

                  {shippingMode === 'factory_delivery' && (
                    <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 flex items-start gap-2">
                      <Icon name="CheckCircleIcon" size={16} className="text-green-600 shrink-0 mt-0.5" />
                      <p className="text-xs text-green-700 dark:text-green-400">{C.factoryDeliveryNote}</p>
                    </div>
                  )}

                  {shippingMode === 'self_arranged' && (
                    <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-3 flex items-start gap-2">
                      <Icon name="CheckCircleIcon" size={16} className="text-purple-600 shrink-0 mt-0.5" />
                      <p className="text-xs text-purple-700 dark:text-purple-400">{C.selfArrangedNote}</p>
                    </div>
                  )}
                </div>

                {/* الموافقة على السياسات */}
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={agreedToPolicies}
                      onChange={(e) => setAgreedToPolicies(e.target.checked)}
                      className="mt-1 w-5 h-5 rounded border-amber-400 text-amber-600 focus:ring-amber-500 shrink-0 cursor-pointer"
                    />
                    <span className="text-sm text-foreground leading-relaxed">
                      {C.agreePrefix}{' '}
                      <button
                        type="button"
                        onClick={() => { setPolicyModalStep(2); setPolicyModalOpen(true); }}
                        className="text-green-600 dark:text-green-400 font-semibold underline underline-offset-2 hover:opacity-80 transition-opacity"
                      >
                        {C.buyerFactoryLink}
                      </button>
                      {C.commaSep}
                      <button
                        type="button"
                        onClick={() => { setPolicyModalStep(1); setPolicyModalOpen(true); }}
                        className="text-amber-600 dark:text-amber-400 font-semibold underline underline-offset-2 hover:opacity-80 transition-opacity"
                      >
                        {C.refundPolicyLink}
                      </button>
                      {C.commaAnd}
                      <button
                        type="button"
                        onClick={() => { setPolicyModalStep(3); setPolicyModalOpen(true); }}
                        className="text-indigo-600 dark:text-indigo-400 font-semibold underline underline-offset-2 hover:opacity-80 transition-opacity"
                      >
                        {C.tripleSystemLink}
                      </button>
                      {C.agreeSuffix}
                    </span>
                  </label>
                  {!agreedToPolicies && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-1.5 pe-8">
                      <Icon name="ExclamationTriangleIcon" size={13} className="shrink-0" />
                      {C.mustAgreePolicies}
                    </p>
                  )}
                </div>

                {otpError && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-600 rounded-lg px-4 py-3 text-sm flex items-center gap-2">
                    <Icon name="ExclamationCircleIcon" size={16} />
                    {otpError}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep('payment')}
                    className="flex-1 h-12 border border-border text-foreground font-semibold rounded-xl text-sm transition-colors hover:bg-muted flex items-center justify-center gap-2">
                    <Icon name="ArrowRightIcon" size={16} className={isRTL ? '' : 'rotate-180'} /> {C.back}
                  </button>
                  <button
                    onClick={handleSendOtp}
                    disabled={loading || !agreedToPolicies}
                    className="flex-[2] h-12 bg-primary text-primary-foreground font-bold rounded-xl text-sm disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-opacity active:opacity-80 shadow-md shadow-primary/20">
                    {loading ? (
                      <><Icon name="ArrowPathIcon" size={16} className="animate-spin" /> {C.sending}</>
                    ) : (
                      <><Icon name="LockClosedIcon" size={16} /> {G.completeOrder} — {formatCurrency(displayTotal)}</>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* ── خطوة التحقق (OTP) المعربة ── */}
            {step === 'otp' && (
              <div className="bg-card rounded-2xl border border-border p-6 text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Icon name="EnvelopeIcon" size={28} className="text-primary" />
                </div>
                <h2 className="text-lg font-bold text-foreground mb-2">
                  {language === 'ar' ? 'التحقق وتأكيد الطلب' : 'Verify Your Order'}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {language === 'ar' ? 'تم إرسال رمز أمان مكوّن من 6 أرقام إلى بريدك الإلكتروني:' : 'A 6-digit verification code has been sent to:'}<br />
                  <span className="font-semibold text-foreground">{user?.email}</span>
                </p>

                {otpError && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-600 rounded-lg px-4 py-3 text-sm my-4 flex items-center justify-center gap-2">
                    <Icon name="ExclamationCircleIcon" size={16} />
                    {otpError}
                  </div>
                )}

                <form onSubmit={handleVerifyOtp} className="space-y-4 mt-6">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2 text-center">
                      {language === 'ar' ? 'أدخل رمز التحقق (OTP)' : 'Enter 6-digit OTP Code'}
                    </label>
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
                      <><Icon name="ArrowPathIcon" size={16} className="animate-spin" /> {language === 'ar' ? 'جاري التأكيد والتوثيق...' : 'Confirming...'}</>
                    ) : (
                      <><Icon name="CheckCircleIcon" size={16} /> {language === 'ar' ? 'تأكيد وإتمام الطلب النهائي' : 'Confirm Order'}</>
                    )}
                  </button>
                </form>

                <div className="text-center mt-4">
                  <p className="text-xs text-muted-foreground mb-2">
                    {language === 'ar' ? 'لم تستلم الرمز بعد؟' : 'Did not receive the code?'}
                  </p>
                  <button
                    onClick={handleSendOtp}
                    disabled={resendCooldown > 0 || loading}
                    className="text-sm font-semibold text-primary disabled:text-muted-foreground disabled:cursor-not-allowed">
                    {resendCooldown > 0
                      ? (language === 'ar' ? `إعادة الإرسال بعد ${resendCooldown} ثانية` : `Resend in ${resendCooldown}s`)
                      : (language === 'ar' ? 'إعادة إرسال الرمز' : 'Resend OTP')}
                  </button>
                </div>

                <button onClick={() => setStep('review')} className="w-full mt-3 text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1">
                  <Icon name="ArrowRightIcon" size={14} className={isRTL ? '' : 'rotate-180'} />
                  {language === 'ar' ? 'العودة لمراجعة الطلب' : 'Back to Review'}
                </button>
              </div>
            )}

            {/* ── خطوة التأكيد النهائي ── */}
            {step === 'confirmed' && (
              <div className="bg-card rounded-2xl border border-border p-8 text-center">
                <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-5">
                  <Icon name="CheckCircleIcon" size={40} className="text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-2">{C.orderSubmitted}</h2>
                <p className="text-muted-foreground mb-4">{C.orderSubmittedBody}</p>
                <div className="bg-muted/50 rounded-xl p-4 mb-5 inline-block">
                  <p className="text-xs text-muted-foreground mb-1">{language === 'ar' ? 'رقم الطلب' : 'Order Number'}</p>
                  <p className="text-xl font-bold text-primary font-mono">{confirmedOrderNumber}</p>
                </div>

                <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4 mb-5 text-start flex items-start gap-3">
                  <Icon name="LockClosedIcon" size={18} className="text-indigo-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-indigo-900 dark:text-indigo-300">{C.fundsInEscrowTitle}</p>
                    <p className="text-xs text-indigo-700 dark:text-indigo-400 mt-0.5 leading-relaxed">
                      {C.fundsInEscrowBody}
                    </p>
                  </div>
                </div>

                <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 mb-5 text-start flex items-start gap-3">
                  <Icon name="BellAlertIcon" size={18} className="text-green-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-green-800 dark:text-green-300">{C.factoryNotifiedTitle}</p>
                    <p className="text-xs text-green-700 dark:text-green-400 mt-0.5">
                      {C.factoryNotifiedBody}
                    </p>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground mb-6">
                  {language === 'ar' ? 'تم إرسال بريد التأكيد ونسخة العقد إلى:' : 'A confirmation email has been sent to:'} <strong>{user?.email}</strong>
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Link href="/orders" className="px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-lg text-sm flex items-center justify-center gap-2">
                    <Icon name="TruckIcon" size={16} />
                    {language === 'ar' ? 'متابعة الطلب' : 'Track Order'}
                  </Link>
                  <Link href="/" className="px-6 py-3 border border-border text-foreground font-semibold rounded-lg text-sm flex items-center justify-center gap-2 hover:bg-muted transition-colors">
                    {language === 'ar' ? 'متابعة التسوق' : 'Continue Shopping'}
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* الشريط الجانبي لملخص الطلب */}
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
                        <div className="flex-1 min-w-0 text-start">
                          <p className="text-xs font-medium text-foreground truncate">{item.name}</p>
                          <p className="text-xs text-muted-foreground">{C.qtyLabel.replace('{qty}', String(item.quantity))}</p>
                          <p className="text-xs font-semibold text-foreground">{formatCurrency(item.price * item.quantity)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="border-t border-border pt-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{C.subtotal}</span>
                    <span className="font-medium text-foreground">{formatCurrency(displaySubtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{C.shippingLabel}</span>
                    <span className="font-medium text-foreground">{formatCurrency(shippingCost)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold border-t border-border pt-2">
                    <span className="text-foreground">{C.total}</span>
                    <span className="text-primary">{formatCurrency(displayTotal)}</span>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
                  <Icon name="LockClosedIcon" size={14} className="text-indigo-500 shrink-0" />
                  {C.escrowProtectedSidebar}
                </div>

                {/* بطاقة الضمان المالي المشروط المعربة */}
                <div className="mt-3 rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 p-4 text-start">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 rounded-full bg-emerald-600 flex items-center justify-center shrink-0">
                      <Icon name="ShieldCheckIcon" size={14} className="text-white" />
                    </div>
                    <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                      {language === 'ar' ? 'نظام الضمان المالي مفعّل' : 'Escrow Protection Active'}
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400 leading-relaxed mb-3">
                    {language === 'ar'
                      ? 'أموالك محتجزة بأمان في حساب الضمان المشروط، ولا تُحوّل للمصنع إلا بعد تأكيد استلام الشحنة وفحصها.'
                      : 'Your payment is held securely in escrow and only released to the supplier after you confirm delivery and satisfaction.'}
                  </p>
                  <div className="space-y-1.5">
                    {[
                      { icon: 'BanknotesIcon', text: language === 'ar' ? 'الأموال محتجزة حتى تأكيد الاستلام' : 'Funds held until delivery confirmed' },
                      { icon: 'ArrowPathIcon', text: language === 'ar' ? 'استرداد كامل في حال عدم تنفيذ الطلب' : 'Full refund if order not fulfilled' },
                      { icon: 'DocumentCheckIcon', text: language === 'ar' ? 'ضمان التحكيم وحل النزاعات' : 'Dispute resolution guaranteed' },
                    ].map((item) => (
                      <div key={item.text} className="flex items-center gap-2">
                        <Icon name={item.icon as 'BanknotesIcon'} size={12} className="text-emerald-600 shrink-0" />
                        <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium">{item.text}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-emerald-500/20 flex items-center justify-between">
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold uppercase tracking-wide">DirectHub Escrow™</span>
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                        {language === 'ar' ? 'محمي بالكامل' : 'Protected'}
                      </span>
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
