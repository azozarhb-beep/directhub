'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import Icon from '@/components/ui/AppIcon';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';

interface ProductInfo {
  id: string;
  name: string;
  nameAr: string;
  supplier: string;
  supplierCountry: string;
  countryFlag: string;
  moq: string;
  priceRange: string;
  category: string;
}

const productMap: Record<string, ProductInfo> = {
  p1: { id: 'p1', name: 'Industrial Hydraulic Pump', nameAr: 'مضخة هيدروليكية صناعية', supplier: 'Zhongshan Heavy Equipment Co.', supplierCountry: 'China', countryFlag: '🇨🇳', moq: '5 units', priceRange: '$285 – $420', category: 'Machinery' },
  p2: { id: 'p2', name: 'Premium Cotton Fabric Roll', nameAr: 'قماش قطني ممتاز', supplier: 'Antalya Textile Mills', supplierCountry: 'Turkey', countryFlag: '🇹🇷', moq: '500 meters', priceRange: '$3.20 – $5.80', category: 'Textiles' },
  p3: { id: 'p3', name: 'Monocrystalline Solar Panel 400W', nameAr: 'لوح طاقة شمسية 400 واط', supplier: 'Shenzhen Solar Tech Ltd.', supplierCountry: 'China', countryFlag: '🇨🇳', moq: '20 pcs', priceRange: '$95 – $130', category: 'Electronics' },
  p4: { id: 'p4', name: 'Portland Cement 50kg Bag', nameAr: 'إسمنت بورتلاند 50 كيلو', supplier: 'Arabian Cement Industries', supplierCountry: 'Saudi Arabia', countryFlag: '🇸🇦', moq: '100 bags', priceRange: '$8.50 – $11.00', category: 'Building Materials' },
  p5: { id: 'p5', name: 'Automatic Packaging Machine', nameAr: 'ماكينة تعبئة أوتوماتيكية', supplier: 'Jinan Packing Solutions', supplierCountry: 'China', countryFlag: '🇨🇳', moq: '1 unit', priceRange: '$4,200 – $6,800', category: 'Machinery' },
  p6: { id: 'p6', name: 'Stainless Steel Pipe (304 Grade)', nameAr: 'أنبوب ستانلس ستيل درجة 304', supplier: 'Mumbai Steel Exports Pvt.', supplierCountry: 'India', countryFlag: '🇮🇳', moq: '50 meters', priceRange: '$45 – $72', category: 'Building Materials' },
};

const INCOTERMS = ['FOB', 'CIF', 'EXW', 'DDP', 'CFR', 'DAP', 'FCA'];
const PAYMENT_TERMS = ['T/T (Wire Transfer)', 'Western Union', 'PayPal', 'Cash'];
const CURRENCIES = ['USD', 'SAR', 'AED', 'EUR', 'GBP', 'CNY', 'TRY', 'INR', 'YER'];
const URGENCY_OPTIONS = [
  { value: 'standard' as const, color: 'text-muted-foreground', bg: 'bg-muted/40' },
  { value: 'urgent' as const, color: 'text-yellow-600', bg: 'bg-yellow-50' },
  { value: 'critical' as const, color: 'text-red-600', bg: 'bg-red-50' },
];

interface FormData {
  // Step 1 — Order Details
  quantity: string;
  unit: string;
  targetPrice: string;
  currency: string;
  urgency: string;
  requestSample: boolean;
  sampleQuantity: string;
  // Step 2 — Material Specifications
  requiredCertifications: string;
  customizationNotes: string;
  materialGrade: string;
  colorFinish: string;
  packagingRequirements: string;
  technicalDrawing: string;
  // Step 3 — Delivery & Logistics
  destinationCountry: string;
  destinationPort: string;
  destinationCity: string;
  incoterms: string;
  paymentTerms: string;
  requiredDeliveryDate: string;
  additionalNotes: string;
  // Step 4 — Contact Info
  companyName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  businessType: string;
}

const STEPS = [
  { num: 1, labelKey: 'orderDetails' as const, icon: 'CubeIcon' },
  { num: 2, labelKey: 'specifications' as const, icon: 'ClipboardDocumentListIcon' },
  { num: 3, labelKey: 'logistics' as const, icon: 'TruckIcon' },
  { num: 4, labelKey: 'contact' as const, icon: 'UserIcon' },
];

export default function RFQPage() {
  const { t, dir, isRTL, language } = useLanguage();
  const L = t.rfq;

  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading, requireAuth } = useAuth();
  const productId = typeof params?.productId === 'string' ? params.productId : '';

  // Try hardcoded map first, then fetch from Supabase
  const [product, setProduct] = useState<ProductInfo>(
    productMap[productId] || {
      id: productId, name: 'Product', nameAr: '', supplier: 'Supplier', supplierCountry: 'Global',
      countryFlag: '🌍', moq: 'Contact supplier', priceRange: 'Contact for pricing', category: 'General',
    }
  );
  const [productLoading, setProductLoading] = useState(!productMap[productId]);
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [rfqRef, setRfqRef] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState<FormData>({
    quantity: '',
    unit: 'units',
    targetPrice: '',
    currency: 'USD',
    urgency: 'standard',
    requestSample: false,
    sampleQuantity: '1',
    requiredCertifications: '',
    customizationNotes: '',
    materialGrade: '',
    colorFinish: '',
    packagingRequirements: '',
    technicalDrawing: '',
    destinationCountry: '',
    destinationPort: '',
    destinationCity: '',
    incoterms: 'FOB',
    paymentTerms: 'T/T (Wire Transfer)',
    requiredDeliveryDate: '',
    additionalNotes: '',
    companyName: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    businessType: 'importer',
  });

  // Login-on-demand: show modal instead of redirecting
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      requireAuth(
        undefined,
        L.authHint
      );
    }
  }, [user, authLoading]);

  // Fetch product from Supabase if not in hardcoded map
  useEffect(() => {
    if (productMap[productId] || !productId) return;
    const fetchProduct = async () => {
      setProductLoading(true);
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from('products')
          .select('id, name, name_ar, price, min_order_quantity, category, factory_registrations(company_name, country)')
          .eq('id', productId)
          .single();
        if (data) {
          const factory = (data as any).factory_registrations;
          setProduct({
            id: data.id,
            name: data.name || 'Product',
            nameAr: (data as any).name_ar || '',
            supplier: factory?.company_name || 'Supplier',
            supplierCountry: factory?.country || 'Global',
            countryFlag: '🌍',
            moq: data.min_order_quantity ? `${data.min_order_quantity} units` : 'Contact supplier',
            priceRange: data.price ? `$${data.price}` : 'Contact for pricing',
            category: data.category || 'General',
          });
        }
      } catch {
        // Keep default product info
      } finally {
        setProductLoading(false);
      }
    };
    fetchProduct();
  }, [productId]);

  useEffect(() => {
    if (user) {
      setForm(prev => ({
        ...prev,
        companyName: user.user_metadata?.company_name || '',
        contactName: user.user_metadata?.full_name || '',
        contactEmail: user.email || '',
        contactPhone: user.user_metadata?.phone || '',
      }));
    }
  }, [user]);

  const update = (field: keyof FormData, value: string | boolean) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const validateStep = (s: number): string => {
    if (s === 1) {
      if (!form.quantity || parseInt(form.quantity) < 1) return L.errQuantity;
    }
    if (s === 3) {
      if (!form.destinationCountry.trim()) return L.errCountry;
    }
    if (s === 4) {
      if (!form.contactName.trim()) return L.errContactName;
      if (!form.contactEmail.trim()) return L.errEmail;
    }
    return '';
  };

  const handleNext = () => {
    const err = validateStep(step);
    if (err) { setError(err); return; }
    setError('');
    setStep(s => s + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBack = () => {
    setError('');
    setStep(s => s - 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateStep(4);
    if (err) { setError(err); return; }
    setError('');
    setSubmitting(true);

    try {
      const supabase = createClient();
      const ref = `RFQ-${Date.now().toString(36).toUpperCase()}`;
      const { data: insertedRfq, error: insertError } = await supabase.from('rfq_requests').insert({
        buyer_id: user!.id,
        product_id: product.id,
        product_name: product.name,
        supplier_name: product.supplier,
        supplier_country: product.supplierCountry,
        quantity: parseInt(form.quantity),
        unit: form.unit,
        target_price: form.targetPrice ? parseFloat(form.targetPrice) : null,
        currency: form.currency,
        urgency: form.urgency,
        destination_country: form.destinationCountry,
        destination_port: form.destinationPort,
        incoterms: form.incoterms,
        payment_terms: form.paymentTerms,
        required_certifications: form.requiredCertifications,
        customization_notes: [
          form.customizationNotes,
          form.materialGrade ? `Material Grade: ${form.materialGrade}` : '',
          form.colorFinish ? `Color/Finish: ${form.colorFinish}` : '',
          form.packagingRequirements ? `Packaging: ${form.packagingRequirements}` : '',
          form.requestSample ? `Sample Requested: ${form.sampleQuantity} units` : '',
        ].filter(Boolean).join('\n'),
        additional_notes: form.additionalNotes,
        status: 'pending',
      }).select('id').single();

      if (insertError) throw insertError;

      // Global RFQ Routing: if product origin is international (not Yemen), notify global sales team
      const LOCAL_COUNTRY_IDENTIFIERS = ['YE', 'Yemen', 'اليمن', 'yemen'];
      const isInternational = !LOCAL_COUNTRY_IDENTIFIERS.some(
        id => product.supplierCountry?.toLowerCase() === id.toLowerCase() || product.supplierCountry === id
      );

      if (isInternational && insertedRfq?.id) {
        try {
          await fetch('/api/rfq/global-route', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              rfq_id: insertedRfq.id,
              product_name: product.name,
              supplier_name: product.supplier,
              supplier_country: product.supplierCountry,
              buyer_name: form.contactName,
              buyer_email: form.contactEmail,
              quantity: form.quantity,
              unit: form.unit,
              notes: form.additionalNotes,
            }),
          });
        } catch {
          // Non-blocking: global routing failure should not prevent RFQ submission
        }
      }

      setRfqRef(ref);
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || 'Failed to submit RFQ. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || productLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-background" dir={dir}>
        <Header />
        <main className="max-w-lg mx-auto px-4 py-12 text-center">
          {/* Success icon */}
          <div className="relative w-24 h-24 mx-auto mb-6">
            <div className="w-24 h-24 bg-accent/15 rounded-full flex items-center justify-center">
              <Icon name="CheckCircleIcon" size={52} className="text-accent" variant="solid" />
            </div>
            <div className="absolute -top-1 -right-1 w-8 h-8 bg-primary rounded-full flex items-center justify-center">
              <Icon name="PaperAirplaneIcon" size={14} className="text-primary-foreground" variant="solid" />
            </div>
          </div>

          <h1 className="text-2xl font-extrabold text-foreground mb-1">RFQ Submitted!</h1>
          <p className="text-lg font-bold text-muted-foreground mb-4">{L.success}</p>

          {rfqRef && (
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-muted rounded-xl border border-border mb-6">
              <Icon name="HashtagIcon" size={14} className="text-muted-foreground" />
              <span className="text-sm font-bold text-foreground">{rfqRef}</span>
            </div>
          )}

          <div className="p-4 bg-card border border-border rounded-2xl mb-6 text-left space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-xl shrink-0">{product.countryFlag}</div>
              <div>
                <p className="text-sm font-bold text-foreground">{product.name}</p>
                <p className="text-xs text-muted-foreground">{product.supplier} · {product.supplierCountry}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
              <div>
                <p className="text-[11px] text-muted-foreground font-semibold">Quantity</p>
                <p className="text-sm font-bold text-foreground">{form.quantity} {form.unit}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground font-semibold">Target Price</p>
                <p className="text-sm font-bold text-foreground">{form.targetPrice ? `${form.targetPrice} ${form.currency}/unit` : 'Not specified'}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground font-semibold">Destination</p>
                <p className="text-sm font-bold text-foreground">{form.destinationCountry || '—'}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground font-semibold">Incoterms</p>
                <p className="text-sm font-bold text-foreground">{form.incoterms}</p>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 bg-primary/5 border border-primary/20 rounded-2xl mb-8 text-left">
            <Icon name="ClockIcon" size={18} className="text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-foreground">What happens next?</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                {product.supplier} will review your RFQ and respond within{' '}
                {form.urgency === 'critical' ? '12 hours' : form.urgency === 'urgent' ? '24 hours' : '1–3 business days'}.
                You'll receive a notification when they reply.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <Link
              href={`/checkout/rfq?rfq=${encodeURIComponent(rfqRef)}&product=${encodeURIComponent(product.name)}&supplier=${encodeURIComponent(product.supplier)}&qty=${encodeURIComponent(form.quantity)}&unit=${encodeURIComponent(form.unit)}&price=${encodeURIComponent(form.targetPrice)}&currency=${encodeURIComponent(form.currency)}&incoterms=${encodeURIComponent(form.incoterms)}&paymentTerms=${encodeURIComponent(form.paymentTerms)}`}
              className="flex items-center justify-center gap-2 w-full py-3.5 bg-primary text-primary-foreground font-bold rounded-2xl"
            >
              <Icon name="LockClosedIcon" size={16} />
              {L.proceedCheckout}
            </Link>
            <Link href={`/product/${productId}`} className="flex items-center justify-center gap-2 w-full py-3.5 bg-muted text-foreground font-bold rounded-2xl border border-border">
              <Icon name="ArrowLeftIcon" size={16} />
              Back to Product
            </Link>
            <Link href="/my-account" className="flex items-center justify-center gap-2 w-full py-3.5 bg-card text-muted-foreground font-semibold rounded-2xl border border-border text-sm">
              <Icon name="DocumentTextIcon" size={16} />
              {L.viewMyRfqs}
            </Link>
          </div>
        </main>
        <BottomNav />
      </div>
    );
  }

  const progressPct = ((step - 1) / (STEPS.length - 1)) * 100;

  return (
    <div className="min-h-screen bg-background" dir={dir}>
      <Header />

      {/* Breadcrumb */}
      <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-2 text-xs text-muted-foreground">
        <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
        <Icon name="ChevronRightIcon" size={12} />
        <Link href={`/product/${productId}`} className="hover:text-foreground transition-colors truncate max-w-[120px]">{product.name}</Link>
        <Icon name="ChevronRightIcon" size={12} />
        <span className="text-foreground font-medium">Request for Quotation</span>
      </div>

      <main className="max-w-2xl mx-auto px-4 pb-36 md:pb-20">

        {/* Page Header */}
        <div className="mb-5">
          <h1 className="text-xl font-extrabold text-foreground">Request for Quotation</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{L.subtitle}</p>
        </div>

        {/* B2B context banner */}
        <div className="mb-5 flex items-start gap-3 px-4 py-3.5 bg-amber-50 border border-amber-200 rounded-2xl">
          <svg className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-amber-800 mb-0.5">B2B Bulk Order Request</p>
            <p className="text-xs text-amber-700 leading-relaxed">
              Submit your requirements and the supplier will respond with a custom quotation within 24–48 hours. All quotes are escrow-protected.
            </p>
          </div>
          <Link href={`/product/${productId}`} className="shrink-0 text-[10px] font-bold px-2.5 py-1.5 bg-white border border-amber-300 text-amber-700 rounded-lg hover:bg-amber-50 transition-colors">
            Buy Now
          </Link>
        </div>

        {/* Product Card */}
        <div className="flex items-center gap-3 p-4 bg-card border border-border rounded-2xl mb-6">
          <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center text-2xl shrink-0">
            {product.countryFlag}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground truncate">{product.name}</p>
            <p className="text-xs text-muted-foreground" dir="rtl">{product.nameAr}</p>
            <p className="text-xs text-primary font-semibold mt-0.5">{product.priceRange} · MOQ: {product.moq}</p>
          </div>
          <div className="shrink-0 px-2.5 py-1 bg-primary/10 rounded-lg">
            <span className="text-xs font-bold text-primary">{product.category}</span>
          </div>
        </div>

        {/* Step Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            {STEPS.map((s, i) => (
              <React.Fragment key={s.num}>
                <div className="flex flex-col items-center gap-1">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                    s.num < step ? 'bg-accent text-accent-foreground' :
                    s.num === step ? 'bg-primary text-primary-foreground ring-4 ring-primary/20': 'bg-muted text-muted-foreground'
                  }`}>
                    {s.num < step
                      ? <Icon name="CheckIcon" size={16} />
                      : <Icon name={s.icon as 'CubeIcon'} size={15} />
                    }
                  </div>
                  <span className={`text-[10px] font-bold hidden sm:block ${s.num === step ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {L.steps[s.labelKey]}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className="flex-1 mx-1 h-1 rounded-full bg-border overflow-hidden">
                    <div
                      className="h-full bg-accent rounded-full transition-all duration-500"
                      style={{ width: s.num < step ? '100%' : '0%' }}
                    />
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
          <p className="text-xs text-muted-foreground text-center">
            {L.stepOf.replace('{step}', String(step)).replace('{total}', String(STEPS.length))} — {L.steps[STEPS[step - 1].labelKey]}
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl mb-5 text-sm text-red-700">
            <Icon name="ExclamationCircleIcon" size={16} className="shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>

          {/* ── STEP 1: Order Details ── */}
          {step === 1 && (
            <div className="space-y-5">
              <div className="p-4 bg-primary/5 border border-primary/15 rounded-2xl">
                <p className="text-xs font-bold text-primary mb-1">{L.step1}</p>
                <p className="text-xs text-muted-foreground">Specify the quantity and pricing targets for your bulk order.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1.5">
                    {L.quantity} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number" min="1"
                    value={form.quantity}
                    onChange={e => update('quantity', e.target.value)}
                    placeholder="e.g. 500"
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1.5">{L.unit}</label>
                  <input
                    type="text"
                    value={form.unit}
                    onChange={e => update('unit', e.target.value)}
                    placeholder="units, kg, meters, tons..."
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1.5">{L.targetPrice}</label>
                  <input
                    type="number" step="0.01" min="0"
                    value={form.targetPrice}
                    onChange={e => update('targetPrice', e.target.value)}
                    placeholder="Per unit (optional)"
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1.5">{L.currency}</label>
                  <select
                    value="USD"
                    onChange={() => update('currency', 'USD')}
                    disabled
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:border-primary transition-colors opacity-80 cursor-not-allowed"
                  >
                    <option value="USD">USD</option>
                  </select>
                </div>
              </div>

              {/* Urgency */}
              <div>
                <label className="block text-xs font-bold text-foreground mb-2">{L.responseUrgency}</label>
                <div className="grid grid-cols-3 gap-2">
                  {URGENCY_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => update('urgency', opt.value)}
                      className={`p-3 rounded-xl border-2 text-center transition-all ${
                        form.urgency === opt.value
                          ? 'border-primary bg-primary/5' :'border-border bg-background hover:border-muted-foreground/40'
                      }`}
                    >
                      <p className={`text-xs font-bold ${form.urgency === opt.value ? 'text-primary' : 'text-foreground'}`}>{(L.urgency as any)[opt.value]}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{(L.urgency as any)[opt.value]}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Sample Request */}
              <div className="p-4 bg-muted/30 rounded-2xl border border-border">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-bold text-foreground">Request Product Sample</p>
                    <p className="text-xs text-muted-foreground">{L.requestSample}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => update('requestSample', !form.requestSample)}
                    className={`relative w-12 h-6 rounded-full transition-colors ${form.requestSample ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                  >
                    <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.requestSample ? 'translate-x-6' : 'translate-x-0.5'}`} />
                  </button>
                </div>
                {form.requestSample && (
                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1.5">Sample Quantity</label>
                    <input
                      type="number" min="1"
                      value={form.sampleQuantity}
                      onChange={e => update('sampleQuantity', e.target.value)}
                      placeholder="e.g. 3"
                      className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── STEP 2: Material Specifications ── */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="p-4 bg-primary/5 border border-primary/15 rounded-2xl">
                <p className="text-xs font-bold text-primary mb-1">{L.step2}</p>
                <p className="text-xs text-muted-foreground">Describe your technical requirements, grades, and customization needs.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1.5">{L.materialGrade}</label>
                <input
                  type="text"
                  value={form.materialGrade}
                  onChange={e => update('materialGrade', e.target.value)}
                  placeholder="e.g. AISI 304, Grade A, Type I/II..."
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1.5">{L.certifications}</label>
                <input
                  type="text"
                  value={form.requiredCertifications}
                  onChange={e => update('requiredCertifications', e.target.value)}
                  placeholder="e.g. ISO 9001, CE, SASO, OEKO-TEX..."
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1.5">{L.colorFinish}</label>
                  <input
                    type="text"
                    value={form.colorFinish}
                    onChange={e => update('colorFinish', e.target.value)}
                    placeholder="e.g. White, Mirror, RAL 9010..."
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1.5">{L.packaging}</label>
                  <input
                    type="text"
                    value={form.packagingRequirements}
                    onChange={e => update('packagingRequirements', e.target.value)}
                    placeholder="e.g. Pallet, bulk bag..."
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1.5">{L.customization}</label>
                <textarea
                  value={form.customizationNotes}
                  onChange={e => update('customizationNotes', e.target.value)}
                  placeholder="Describe any custom specifications, dimensions, branding, labeling, or special requirements..."
                  rows={4}
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1.5">{L.techDrawing}</label>
                <input
                  type="text"
                  value={form.technicalDrawing}
                  onChange={e => update('technicalDrawing', e.target.value)}
                  placeholder="Link to drawing, DWG file, or reference number..."
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
                />
              </div>
            </div>
          )}

          {/* ── STEP 3: Delivery & Logistics ── */}
          {step === 3 && (
            <div className="space-y-5">
              <div className="p-4 bg-primary/5 border border-primary/15 rounded-2xl">
                <p className="text-xs font-bold text-primary mb-1">{L.step3}</p>
                <p className="text-xs text-muted-foreground">Specify your shipping destination, incoterms, and payment preferences.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1.5">
                    {L.destinationCountry} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.destinationCountry}
                    onChange={e => update('destinationCountry', e.target.value)}
                    placeholder="e.g. Saudi Arabia"
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1.5">{L.destinationCity}</label>
                  <input
                    type="text"
                    value={form.destinationCity}
                    onChange={e => update('destinationCity', e.target.value)}
                    placeholder="e.g. Riyadh"
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1.5">{L.destinationPort}</label>
                <input
                  type="text"
                  value={form.destinationPort}
                  onChange={e => update('destinationPort', e.target.value)}
                  placeholder="e.g. Jeddah Islamic Port"
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1.5">{L.incoterms}</label>
                  <select
                    value={form.incoterms}
                    onChange={e => update('incoterms', e.target.value)}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
                  >
                    {INCOTERMS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1.5">{L.paymentTerms} <span className="text-amber-600 text-[10px] font-normal">(Upfront Only)</span></label>
                  <select
                    value={form.paymentTerms}
                    onChange={e => update('paymentTerms', e.target.value)}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
                  >
                    {PAYMENT_TERMS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              {/* Cash-Only Policy Note */}
              <div className="flex items-start gap-2.5 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <Icon name="ShieldCheckIcon" size={15} className="text-amber-700 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 leading-relaxed">
                  <span className="font-bold">Payment Policy:</span> All transactions require immediate, full upfront payment. No credit, no deferred payments, no debt. No purchase without complete payment.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1.5">{L.deliveryDate}</label>
                <input
                  type="date"
                  value={form.requiredDeliveryDate}
                  onChange={e => update('requiredDeliveryDate', e.target.value)}
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1.5">{L.additionalNotes}</label>
                <textarea
                  value={form.additionalNotes}
                  onChange={e => update('additionalNotes', e.target.value)}
                  placeholder="Any other requirements, questions, or information for the supplier..."
                  rows={3}
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors resize-none"
                />
              </div>

              {/* Order Summary */}
              <div className="p-4 bg-muted/40 border border-border rounded-2xl space-y-2">
                <p className="text-xs font-bold text-foreground mb-3 flex items-center gap-2">
                  <Icon name="ClipboardDocumentListIcon" size={14} className="text-primary" />
                  {L.orderSummary}
                </p>
                {[
                  { label: 'Quantity', value: `${form.quantity || '—'} ${form.unit}` },
                  { label: 'Target Price', value: form.targetPrice ? `${form.targetPrice} ${form.currency}/unit` : 'Not specified' },
                  { label: L.responseUrgency, value: (L.urgency as any)[form.urgency] || '—' },
                  { label: 'Sample', value: form.requestSample ? `Yes — ${form.sampleQuantity} units` : 'No' },
                  { label: 'Certifications', value: form.requiredCertifications || 'None specified' },
                ].map(item => (
                  <div key={item.label} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="font-semibold text-foreground text-right max-w-[55%] truncate">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── STEP 4: Contact Info ── */}
          {step === 4 && (
            <div className="space-y-5">
              <div className="p-4 bg-primary/5 border border-primary/15 rounded-2xl">
                <p className="text-xs font-bold text-primary mb-1">{L.step4}</p>
                <p className="text-xs text-muted-foreground">The factory will use this information to send you the quotation.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1.5">
                    {L.contactName} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.contactName}
                    onChange={e => update('contactName', e.target.value)}
                    placeholder="Your full name"
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1.5">{L.companyName}</label>
                  <input
                    type="text"
                    value={form.companyName}
                    onChange={e => update('companyName', e.target.value)}
                    placeholder="Your company"
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1.5">
                  {L.email} <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={form.contactEmail}
                  onChange={e => update('contactEmail', e.target.value)}
                  placeholder="your@email.com"
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1.5">{L.phone}</label>
                <input
                  type="tel"
                  value={form.contactPhone}
                  onChange={e => update('contactPhone', e.target.value)}
                  placeholder="+966 5X XXX XXXX"
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-2">{L.businessType}</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'importer' },
                    { value: 'distributor' },
                    { value: 'manufacturer' },
                    { value: 'retailer' },
                    { value: 'contractor' },
                    { value: 'other' },
                  ].map(bt => (
                    <button
                      key={bt.value}
                      type="button"
                      onClick={() => update('businessType', bt.value)}
                      className={`p-2.5 rounded-xl border-2 text-center transition-all ${
                        form.businessType === bt.value
                          ? 'border-primary bg-primary/5' :'border-border bg-background hover:border-muted-foreground/40'
                      }`}
                    >
                      <p className={`text-xs font-bold ${form.businessType === bt.value ? 'text-primary' : 'text-foreground'}`}>{(L.businessTypes as any)[bt.value]}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Final Disclaimer */}
              <div className="flex items-start gap-3 p-4 bg-primary/5 border border-primary/20 rounded-2xl">
                <Icon name="InformationCircleIcon" size={18} className="text-primary shrink-0 mt-0.5" />
                <div className="text-xs text-muted-foreground leading-relaxed">
                  By submitting this RFQ, you agree to receive a quotation from{' '}
                  <span className="font-bold text-foreground">{product.supplier}</span>. Your contact details will only be shared with this supplier. All transactions remain within DirectHub's secure platform.
                </div>
              </div>
            </div>
          )}

          {/* ── Navigation Buttons ── */}
          <div className="fixed bottom-16 md:bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-md border-t border-border px-4 py-3 md:relative md:bg-transparent md:border-0 md:backdrop-blur-none md:px-0 md:py-0 md:mt-8">
            <div className="max-w-2xl mx-auto flex gap-3">
              {step > 1 && (
                <button
                  type="button"
                  onClick={handleBack}
                  className="flex items-center justify-center gap-2 px-6 py-3.5 bg-muted text-foreground font-bold rounded-2xl border border-border"
                >
                  <Icon name="ArrowLeftIcon" size={16} />
                  Back
                </button>
              )}
              {step < STEPS.length ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-primary text-primary-foreground font-bold rounded-2xl"
                >
                  {L.continue}
                  <Icon name="ArrowRightIcon" size={16} />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-primary text-primary-foreground font-bold rounded-2xl disabled:opacity-60"
                >
                  {submitting ? (
                    <><div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" /> Submitting...</>
                  ) : (
                    <><Icon name="PaperAirplaneIcon" size={16} /> {L.submit}</>
                  )}
                </button>
              )}
            </div>
          </div>
        </form>
      </main>

      <BottomNav />
    </div>
  );
}
