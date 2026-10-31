'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { sendDualNotification } from '@/lib/notificationService';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import Icon from '@/components/ui/AppIcon';
import { useLanguage } from '@/contexts/LanguageContext';

// ── Types ─────────────────────────────────────────────────────────────────────
type CheckoutStep = 'addresses' | 'payment' | 'review' | 'confirmed';

interface AddressForm {
  fullName: string;
  company: string;
  address: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  phone: string;
  email: string;
}

interface PaymentMethod {
  id: string;
  labelKey: 'tt' | 'lc' | 'escrow' | 'installment';
  descKey: 'ttDesc' | 'lcDesc' | 'escrowDesc' | 'installmentDesc';
  badgeKey?: 'ttBadge' | 'escrowBadge';
  icon: string;
}

const PAYMENT_METHODS: PaymentMethod[] = [
  { id: 'bank_transfer', labelKey: 'tt', descKey: 'ttDesc', badgeKey: 'ttBadge', icon: 'BuildingLibraryIcon' },
  { id: 'letter_of_credit', labelKey: 'lc', descKey: 'lcDesc', icon: 'DocumentTextIcon' },
  { id: 'escrow', labelKey: 'escrow', descKey: 'escrowDesc', badgeKey: 'escrowBadge', icon: 'ShieldCheckIcon' },
  { id: 'installments', labelKey: 'installment', descKey: 'installmentDesc', icon: 'CalendarDaysIcon' },
];

const BANK_DETAILS = {
  bankName: 'Al Rajhi Bank',
  accountName: 'DirectHub Platform Co.',
  accountNumber: '1234567890123456',
  iban: 'SA0380000000608010167519',
  swift: 'RJHISARI',
  currency: 'SAR / USD',
};

const COUNTRIES = [
  'Saudi Arabia', 'UAE', 'Kuwait', 'Qatar', 'Bahrain', 'Oman', 'Egypt', 'Jordan',
  'Iraq', 'Yemen', 'Syria', 'Lebanon', 'Libya', 'Tunisia', 'Algeria', 'Morocco',
  'Sudan', 'Turkey', 'China', 'India', 'Pakistan', 'Bangladesh', 'Indonesia',
  'Malaysia', 'Singapore', 'South Korea', 'Japan', 'Germany', 'France',
  'United Kingdom', 'USA', 'Canada', 'Australia', 'Brazil', 'South Africa',
];

const emptyAddress = (): AddressForm => ({
  fullName: '',
  company: '',
  address: '',
  city: '',
  state: '',
  country: 'Saudi Arabia',
  postalCode: '',
  phone: '',
  email: '',
});

// ── Step indicator ─────────────────────────────────────────────────────────────
const STEPS: { key: CheckoutStep; labelKey: 'addresses' | 'payment' | 'review'; icon: string }[] = [
  { key: 'addresses', labelKey: 'addresses', icon: 'MapPinIcon' },
  { key: 'payment', labelKey: 'payment', icon: 'CreditCardIcon' },
  { key: 'review', labelKey: 'review', icon: 'ClipboardDocumentCheckIcon' },
];

function StepBar({ current }: { current: CheckoutStep }) {
  const { t, dir } = useLanguage();
  const L = t.checkoutRfq;
  const stepIndex = STEPS.findIndex((s) => s.key === current);
  return (
    <div className="flex items-center gap-0 mb-8" dir={dir}>
      {STEPS.map((s, i) => {
        const done = i < stepIndex;
        const active = s.key === current;
        return (
          <React.Fragment key={s.key}>
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all ${
                  done
                    ? 'border-green-500 bg-green-500 text-white'
                    : active
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card text-muted-foreground'
                }`}
              >
                {done ? (
                  <Icon name="CheckIcon" size={14} />
                ) : (
                  <Icon name={s.icon as any} size={14} />
                )}
              </div>
              <span
                className={`text-[11px] font-semibold hidden sm:block ${
                  active ? 'text-primary' : done ? 'text-green-600' : 'text-muted-foreground'
                }`}
              >
                {L.steps[s.labelKey]}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 mb-4 ${done ? 'bg-green-500' : 'bg-border'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ── Address Form Component ─────────────────────────────────────────────────────
function AddressSection({
  title,
  icon,
  form,
  onChange,
}: {
  title: string;
  icon: string;
  form: AddressForm;
  onChange: (field: keyof AddressForm, value: string) => void;
}) {
  const { t, dir } = useLanguage();
  const L = t.checkoutRfq;
  const field = (
    label: string,
    key: keyof AddressForm,
    type = 'text',
    required = true,
    placeholder = ''
  ) => (
    <div>
      <label className="block text-xs font-medium text-foreground mb-1.5" dir={dir}>
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        type={type}
        required={required}
        value={form[key]}
        onChange={(e) => onChange(key, e.target.value)}
        placeholder={placeholder}
        dir={dir}
        className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
      />
    </div>
  );

  return (
    <div className="bg-card rounded-2xl border border-border p-5">
      <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2" dir={dir}>
        <Icon name={icon as any} size={16} className="text-primary" />
        {title}
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {field(L.fullName, 'fullName')}
        {field(L.company, 'company')}
        {field(L.street, 'address')}
        <div>
          <label className="block text-xs font-medium text-foreground mb-1.5" dir={dir}>
            {L.countryRequired} <span className="text-red-500">*</span>
          </label>
          <select
            required
            value={form.country}
            onChange={(e) => onChange('country', e.target.value)}
            dir={dir}
            className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
          >
            {COUNTRIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        {field(L.city, 'city')}
        {field(L.state, 'state', 'text', false)}
        {field(L.postalCode, 'postalCode', 'text', false)}
        {field(L.phone, 'phone', 'tel')}
        {field(L.email, 'email', 'email')}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
function RFQCheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const supabase = createClient();
  const { t, dir, isRTL, language } = useLanguage();
  const L = t.checkoutRfq;

  // RFQ context from query params
  const rfqRef = searchParams.get('rfq') || '';
  const productName = searchParams.get('product') || L.defaultProduct;
  const supplierName = searchParams.get('supplier') || L.defaultSupplier;
  const quantity = searchParams.get('qty') || '—';
  const unit = searchParams.get('unit') || L.defaultUnit;
  const targetPrice = searchParams.get('price') || '';
  const currency = searchParams.get('currency') || 'USD';
  const incoterms = searchParams.get('incoterms') || 'FOB';
  const paymentTermsParam = searchParams.get('paymentTerms') || '';
  const rfqIdParam = searchParams.get('rfq_id') || '';
  const responseIdParam = searchParams.get('response_id') || '';

  const [step, setStep] = useState<CheckoutStep>('addresses');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmedRef, setConfirmedRef] = useState('');
  const [confirmedOrderId, setConfirmedOrderId] = useState('');

  // Billing address
  const [billing, setBilling] = useState<AddressForm>(emptyAddress());
  // Shipping address
  const [shipping, setShipping] = useState<AddressForm>(emptyAddress());
  const [sameAsBilling, setSameAsBilling] = useState(false);

  // Payment
  const [selectedPayment, setSelectedPayment] = useState<string>('bank_transfer');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [transactionRef, setTransactionRef] = useState('');

  // Terms
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // Pre-fill from user profile
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login?redirect=/checkout/rfq');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      const meta = user.user_metadata || {};
      const prefill: Partial<AddressForm> = {
        fullName: meta.full_name || '',
        company: meta.company_name || '',
        phone: meta.phone || '',
        country: meta.country || 'Saudi Arabia',
        email: user.email || '',
      };
      setBilling((prev) => ({ ...prev, ...prefill }));
      setShipping((prev) => ({ ...prev, ...prefill }));
    }
  }, [user]);

  // Sync shipping when sameAsBilling toggled
  useEffect(() => {
    if (sameAsBilling) setShipping({ ...billing });
  }, [sameAsBilling, billing]);

  const validateAddresses = () => {
    const required: (keyof AddressForm)[] = ['fullName', 'company', 'address', 'city', 'country', 'phone', 'email'];
    const fieldLabels: Record<string, string> = {
      fullName: L.fullName,
      company: L.company,
      address: L.street,
      city: L.city,
      country: L.countryRequired,
      phone: L.phone,
      email: L.email,
    };
    for (const k of required) {
      if (!billing[k]) return L.billingRequired.replace('{field}', fieldLabels[k] || k);
      if (!sameAsBilling && !shipping[k]) return L.shippingRequired.replace('{field}', fieldLabels[k] || k);
    }
    return null;
  };

  const handleAddressNext = (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateAddresses();
    if (err) { setError(err); return; }
    setError('');
    setStep('payment');
  };

  const handlePaymentNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPayment) { setError(L.selectPayment); return; }
    if (!transactionRef.trim()) { setError('رقم مرجع الحوالة / رقم العملية مطلوب'); return; }
    setError('');
    setStep('review');
  };

  const handleReceiptChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setError(L.fileTooLarge); return; }
    setReceiptFile(file);
    setError('');
    const reader = new FileReader();
    reader.onload = (ev) => setReceiptPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmitOrder = async () => {
    if (!agreedToTerms) { setError(L.agreeTerms); return; }
    if (!transactionRef.trim()) { setError('رقم مرجع الحوالة / رقم العملية مطلوب'); return; }
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const orderRef = rfqRef || `RFQ-${Date.now()}`;
      const finalShipping = sameAsBilling ? billing : shipping;

      // Resolve the accepted quote total so the escrow order never defaults to $0
      let orderTotal = 0;
      let orderCurrency = currency;
      let quoteFactoryId: string | null = null;
      try {
        let quoteRow: { total_price: number | null; unit_price: number | null; currency: string | null; rfq_id: string | null; manufacturer_id: string | null } | null = null;
        if (responseIdParam) {
          const { data } = await supabase
            .from('rfq_responses')
            .select('total_price, unit_price, currency, rfq_id, manufacturer_id')
            .eq('id', responseIdParam)
            .maybeSingle();
          quoteRow = data as any;
        } else if (rfqIdParam) {
          const { data } = await supabase
            .from('rfq_responses')
            .select('total_price, unit_price, currency, rfq_id, manufacturer_id')
            .eq('rfq_id', rfqIdParam)
            .eq('is_accepted', true)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          quoteRow = data as any;
        }
        if (quoteRow) {
          quoteFactoryId = quoteRow.manufacturer_id || null;
          if (quoteRow.currency) orderCurrency = quoteRow.currency;
          const qtyNum = parseFloat(quantity);
          if (quoteRow.total_price && Number(quoteRow.total_price) > 0) {
            orderTotal = Number(quoteRow.total_price);
          } else if (quoteRow.unit_price && !isNaN(qtyNum) && qtyNum > 0) {
            orderTotal = Number(quoteRow.unit_price) * qtyNum;
          } else if (quoteRow.unit_price && quoteRow.rfq_id) {
            const { data: rfqRow } = await supabase
              .from('rfq_requests')
              .select('quantity')
              .eq('id', quoteRow.rfq_id)
              .maybeSingle();
            const rfqQty = Number((rfqRow as any)?.quantity) || 0;
            orderTotal = Number(quoteRow.unit_price) * rfqQty;
          }
        }
      } catch {
        // fall through to param-based fallback below
      }
      if (!orderTotal) {
        const priceNum = parseFloat(targetPrice);
        const qtyNum = parseFloat(quantity);
        if (!isNaN(priceNum) && priceNum > 0) {
          orderTotal = !isNaN(qtyNum) && qtyNum > 0 ? priceNum * qtyNum : priceNum;
        }
      }
      orderTotal = Math.round(orderTotal * 100) / 100;

      // Insert RFQ checkout order with pending_verification escrow status
      const { data: order, error: orderErr } = await supabase
        .from('orders')
        .insert({
          user_id: user.id,
          order_number: orderRef,
          status: 'pending',
          escrow_status: 'pending_verification',
          items: [{ name: productName, supplier: supplierName, quantity, unit, targetPrice, currency: orderCurrency }],
          shipping_address: finalShipping,
          billing_address: billing,
          payment_method: selectedPayment,
          subtotal: orderTotal,
          shipping_cost: 0,
          total: orderTotal,
          notes: paymentNotes,
          order_category: 'wholesale',
          platform_commission: 0,
          commission_rate_label: 'TBD',
          payment_reference: transactionRef.trim(),
          ...(quoteFactoryId ? { factory_user_id: quoteFactoryId } : {}),
        })
        .select('id, order_number')
        .single();

      if (orderErr) throw orderErr;

      // Upload receipt/proof if provided
      if (receiptFile && order) {
        const ext = receiptFile.name.split('.').pop();
        const filePath = `receipts/${user.id}/${order.id}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from('order-receipts')
          .upload(filePath, receiptFile, { upsert: true });
        if (!uploadErr) {
          const { data: urlData } = supabase.storage.from('order-receipts').getPublicUrl(filePath);
          await supabase.from('orders').update({
            receipt_url: urlData?.publicUrl,
            payment_proof_url: urlData?.publicUrl,
          }).eq('id', order.id);
        }
      }

      // Status history
      await supabase.from('order_status_history').insert({
        order_id: order.id,
        status: 'pending',
        note: `طلب RFQ — وسيلة الدفع: ${selectedPayment} — رقم الحوالة: ${transactionRef} — بانتظار اعتماد الدفع`,
      });

      setConfirmedRef(order.order_number);
      setConfirmedOrderId(order.id);

      // ── Dual notification: in-app bell + email confirmation ──────────────
      sendDualNotification({
        userId: user.id,
        title: 'تم إرسال طلب عرض السعر (RFQ) ✅',
        message: `رقم الطلب: ${order.order_number} — وسيلة الدفع: ${selectedPayment} — بانتظار اعتماد الدفع من الفريق.`,
        type: 'rfq_submitted',
        link: '/my-account',
      }).catch(() => {});

      setStep('confirmed');
    } catch (err: any) {
      setError(err.message || L.submitFailed);
    } finally {
      setLoading(false);
    }
  };

  const selectedMethod = PAYMENT_METHODS.find((m) => m.id === selectedPayment);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Icon name="ArrowPathIcon" size={32} className="animate-spin text-primary" />
      </div>
    );
  }
  if (!user) return null;

  return (
    <div className="min-h-screen bg-background" dir={dir}>
      <Header />
      <main className="max-w-5xl mx-auto px-4 md:px-6 py-6 mobile-safe-bottom">
        {/* Back + Title */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.back()}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <Icon name="ArrowRightIcon" size={20} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-foreground">{L.pageTitle}</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {L.secureProcessing.replace('{name}', productName)}
            </p>
          </div>
          <div className="mr-auto flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200 rounded-full px-3 py-1.5">
            <Icon name="LockClosedIcon" size={12} />
            {L.secureCheckoutBadge}
          </div>
        </div>

        {/* Step Bar */}
        {step !== 'confirmed' && <StepBar current={step} />}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── Main Panel ── */}
          <div className="lg:col-span-2 space-y-4">

            {/* ── STEP: Addresses ── */}
            {step === 'addresses' && (
              <form onSubmit={handleAddressNext} className="space-y-4">
                <AddressSection
                  title={L.billingTitle}
                  icon="CreditCardIcon"
                  form={billing}
                  onChange={(k, v) => setBilling((prev) => ({ ...prev, [k]: v }))}
                />

                {/* Same as billing toggle */}
                <label className="flex items-center gap-3 cursor-pointer bg-card border border-border rounded-xl px-4 py-3 select-none">
                  <div
                    onClick={() => setSameAsBilling(!sameAsBilling)}
                    className={`w-10 h-6 rounded-full transition-colors flex items-center px-1 ${
                      sameAsBilling ? 'bg-primary' : 'bg-border'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${
                        sameAsBilling ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </div>
                  <span className="text-sm font-medium text-foreground">
                    {L.shippingSame}
                  </span>
                </label>

                {!sameAsBilling && (
                  <AddressSection
                    title={L.shippingTitle}
                    icon="TruckIcon"
                    form={shipping}
                    onChange={(k, v) => setShipping((prev) => ({ ...prev, [k]: v }))}
                  />
                )}

                {error && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
                    <Icon name="ExclamationCircleIcon" size={16} />
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full h-12 bg-primary text-primary-foreground font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition-opacity active:opacity-80"
                >
                  <Icon name="ArrowLeftIcon" size={16} /> {L.continueToPayment}
                </button>
              </form>
            )}

            {/* ── STEP: Payment ── */}
            {step === 'payment' && (
              <form onSubmit={handlePaymentNext} className="space-y-4">
                <div className="bg-card rounded-2xl border border-border p-5">
                  <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                    <Icon name="CreditCardIcon" size={16} className="text-primary" />
                    {L.choosePayment}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {PAYMENT_METHODS.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setSelectedPayment(m.id)}
                        className={`relative flex items-start gap-3 p-4 rounded-xl border-2 text-right transition-all ${
                          selectedPayment === m.id
                            ? 'border-primary bg-primary/5' : 'border-border bg-background hover:border-primary/40'
                        }`}
                      >
                        {(m.badgeKey ? L.payments[m.badgeKey] : '') && (
                          <span className="absolute top-2 left-2 text-[10px] font-bold bg-primary text-primary-foreground rounded-full px-2 py-0.5">
                            {(m.badgeKey ? L.payments[m.badgeKey] : '')}
                          </span>
                        )}
                        <div
                          className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                            selectedPayment === m.id ? 'bg-primary/10' : 'bg-muted'
                          }`}
                        >
                          <Icon
                            name={m.icon as any}
                            size={18}
                            className={selectedPayment === m.id ? 'text-primary' : 'text-muted-foreground'}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-bold leading-tight ${selectedPayment === m.id ? 'text-primary' : 'text-foreground'}`}>
                            {L.payments[m.labelKey]}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1 leading-snug">{L.payments[m.descKey]}</p>
                        </div>
                        <div
                          className={`w-4 h-4 rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center ${
                            selectedPayment === m.id ? 'border-primary bg-primary' : 'border-border'
                          }`}
                        >
                          {selectedPayment === m.id && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Bank details for bank transfer */}
                {selectedPayment === 'bank_transfer' && (
                  <div className="bg-card rounded-2xl border border-border p-5">
                    <h4 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                      <Icon name="BuildingLibraryIcon" size={15} className="text-primary" />
                      {L.bankTransferDetails}
                    </h4>
                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-2.5 mb-4">
                      {Object.entries({
                        [L.bankName]: BANK_DETAILS.bankName,
                        [L.accountName]: BANK_DETAILS.accountName,
                        [L.accountNumber]: BANK_DETAILS.accountNumber,
                        'IBAN': BANK_DETAILS.iban,
                        'SWIFT / BIC': BANK_DETAILS.swift,
                        [L.currency]: BANK_DETAILS.currency,
                      }).map(([label, value]) => (
                        <div key={label} className="flex items-center justify-between gap-4">
                          <span className="text-xs text-muted-foreground shrink-0">{label}</span>
                          <span className="text-sm font-semibold text-foreground font-mono text-left">{value}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 mb-4">
                      <Icon name="InformationCircleIcon" size={14} className="text-amber-600 shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-800">
                        {L.useRefAsDescription.replace('{ref}', rfqRef || 'RFQ-XXXXXX')}
                      </p>
                    </div>
                    {/* Receipt upload */}
                    <label className="block text-xs font-medium text-foreground mb-2">
                      {L.uploadReceipt} <span className="text-muted-foreground font-normal">{L.optional}</span>
                    </label>
                    {receiptPreview ? (
                      <div className="relative rounded-xl border-2 border-primary/30 overflow-hidden bg-muted/30">
                        {receiptFile?.type.startsWith('image/') ? (
                          <img src={receiptPreview} alt={L.receiptPreviewAlt} className="w-full max-h-40 object-contain" />
                        ) : (
                          <div className="flex items-center gap-3 p-4">
                            <Icon name="DocumentTextIcon" size={28} className="text-primary" />
                            <p className="text-sm font-medium text-foreground">{receiptFile?.name}</p>
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => { setReceiptFile(null); setReceiptPreview(null); }}
                          className="absolute top-2 left-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center"
                        >
                          <Icon name="XMarkIcon" size={13} />
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center gap-2 h-28 rounded-xl border-2 border-dashed border-border hover:border-primary/50 bg-muted/20 cursor-pointer transition-colors group">
                        <Icon name="ArrowUpTrayIcon" size={22} className="text-muted-foreground group-hover:text-primary transition-colors" />
                        <span className="text-sm text-muted-foreground">{L.clickUploadReceipt}</span>
                        <span className="text-xs text-muted-foreground">{L.maxFileSize}</span>
                        <input type="file" accept="image/*,.pdf" onChange={handleReceiptChange} className="sr-only" />
                      </label>
                    )}
                  </div>
                )}

                {/* L/C instructions */}
                {selectedPayment === 'letter_of_credit' && (
                  <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5">
                    <div className="flex items-start gap-3">
                      <Icon name="DocumentTextIcon" size={20} className="text-blue-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-bold text-blue-800 mb-1">{L.lcTitle}</p>
                        <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
{(L.lcSteps as string[]).map((step, i) => (
                            <li key={i}>{step}</li>
                          ))}
                        </ol>
                      </div>
                    </div>
                  </div>
                )}

                {/* Escrow info */}
                {selectedPayment === 'escrow' && (
                  <div className="bg-green-50 border border-green-200 rounded-2xl p-5">
                    <div className="flex items-start gap-3">
                      <Icon name="ShieldCheckIcon" size={20} className="text-green-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-bold text-green-800 mb-1">{L.escrowProtectTitle}</p>
                        <p className="text-xs text-green-700 leading-relaxed">
                          {L.escrowProtectBody}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Installments info */}
                {selectedPayment === 'installments' && (
                  <div className="bg-purple-50 border border-purple-200 rounded-2xl p-5">
                    <div className="flex items-start gap-3">
                      <Icon name="CalendarDaysIcon" size={20} className="text-purple-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-bold text-purple-800 mb-1">{L.installmentTitle}</p>
                        <div className="space-y-1.5 mt-2">
                          {[
                            { label: L.depositNow, pct: '30%', note: L.depositConfirms },
                            { label: L.beforeShipment, pct: '70%', note: L.releasedWhenReady },
                          ].map((row) => (
                            <div key={row.label} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-purple-100">
                              <div>
                                <p className="text-xs font-bold text-purple-800">{row.label}</p>
                                <p className="text-[10px] text-purple-600">{row.note}</p>
                              </div>
                              <span className="text-sm font-bold text-purple-700">{row.pct}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Transaction Reference (Mandatory) ── */}
                <div className="bg-card rounded-2xl border-2 border-indigo-300 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
                      <Icon name="LinkIcon" size={16} className="text-indigo-600" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-indigo-900">
                        رقم مرجع الحوالة / رقم العملية
                        <span className="mr-1 text-red-500">*</span>
                      </h4>
                      <p className="text-xs text-indigo-600">Transaction Reference / ID — إلزامي</p>
                    </div>
                    <span className="mr-auto text-[10px] font-bold text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full">إلزامي</span>
                  </div>
                  <input
                    type="text"
                    required
                    value={transactionRef}
                    onChange={(e) => setTransactionRef(e.target.value)}
                    placeholder="أدخل رقم مرجع التحويل أو رقم العملية..."
                    dir={dir}
                    className="w-full h-11 px-3 rounded-lg border-2 border-indigo-300 bg-white text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-300 transition-colors font-mono"
                  />
                  <div className="flex items-start gap-1.5 mt-2">
                    <Icon name="ShieldCheckIcon" size={12} className="text-indigo-500 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-indigo-700 leading-relaxed">
                      هذا الرقم يُستخدم للتحقق من صحة التحويل ومطابقته مع سجلات المنصة
                    </p>
                  </div>
                </div>

                {/* ── Proof of Payment Upload (Optional) ── */}
                <div className="bg-card rounded-2xl border border-border p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                      <Icon name="PhotoIcon" size={16} className="text-amber-600" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-foreground">
                        صورة سند التحويل
                        <span className="mr-1 text-xs text-muted-foreground font-normal">(اختياري)</span>
                      </h4>
                      <p className="text-xs text-muted-foreground">ارفع صورة إيصال التحويل لتسريع عملية التحقق</p>
                    </div>
                  </div>
                  {receiptPreview ? (
                    <div className="relative rounded-xl border-2 border-primary/30 overflow-hidden bg-muted/30">
                      {receiptFile?.type.startsWith('image/') ? (
                        <img src={receiptPreview} alt="صورة سند التحويل" className="w-full max-h-40 object-contain" />
                      ) : (
                        <div className="flex items-center gap-3 p-4">
                          <Icon name="DocumentTextIcon" size={28} className="text-primary" />
                          <p className="text-sm font-medium text-foreground">{receiptFile?.name}</p>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => { setReceiptFile(null); setReceiptPreview(null); }}
                        className="absolute top-2 left-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center"
                      >
                        <Icon name="XMarkIcon" size={13} />
                      </button>
                      <div className="px-4 pb-3 flex items-center gap-1.5">
                        <Icon name="CheckCircleIcon" size={13} className="text-green-600" />
                        <span className="text-xs text-green-700 font-medium">تم رفع الملف بنجاح</span>
                      </div>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center gap-2 h-28 rounded-xl border-2 border-dashed border-border hover:border-primary/50 bg-muted/20 cursor-pointer transition-colors group">
                      <Icon name="ArrowUpTrayIcon" size={22} className="text-muted-foreground group-hover:text-primary transition-colors" />
                      <span className="text-sm text-muted-foreground">{L.clickUploadReceipt}</span>
                      <span className="text-xs text-muted-foreground">{L.maxFileSize}</span>
                      <input type="file" accept="image/*,.pdf" onChange={handleReceiptChange} className="sr-only" />
                    </label>
                  )}
                </div>

                {/* Payment notes */}
                <div className="bg-card rounded-2xl border border-border p-5">
                  <label className="block text-xs font-medium text-foreground mb-2">
                    {L.paymentNotes} <span className="text-muted-foreground font-normal">{L.optional}</span>
                  </label>
                  <textarea
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    rows={3}
                    dir={dir}
                    placeholder={L.paymentNotesPlaceholder}
                    className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors resize-none"
                  />
                </div>

                {error && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
                    <Icon name="ExclamationCircleIcon" size={16} />
                    {error}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setStep('addresses')}
                    className="flex-1 h-12 border border-border text-foreground font-semibold rounded-xl text-sm flex items-center justify-center gap-2 hover:bg-muted transition-colors"
                  >
                    {L.back} <Icon name="ArrowRightIcon" size={16} />
                  </button>
                  <button
                    type="submit"
                    className="flex-1 h-12 bg-primary text-primary-foreground font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition-opacity active:opacity-80"
                  >
                    <Icon name="ArrowLeftIcon" size={16} /> {L.reviewOrder}
                  </button>
                </div>
              </form>
            )}

            {/* ── STEP: Review ── */}
            {step === 'review' && (
              <div className="space-y-4">
                {/* RFQ Order Details */}
                <div className="bg-card rounded-2xl border border-border p-5">
                  <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                    <Icon name="ClipboardDocumentListIcon" size={16} className="text-primary" />
                    {L.rfqDetails}
                  </h3>
                  <div className="space-y-2.5">
                    {[
                      { label: L.product, value: productName },
                      { label: L.defaultSupplier, value: supplierName },
                      { label: L.quantity, value: `${quantity} ${unit}` },
                      ...(targetPrice ? [{ label: L.targetPrice, value: `${targetPrice} ${currency}` }] : []),
                      { label: L.incoterms, value: incoterms },
                      ...(paymentTermsParam ? [{ label: L.paymentTerms, value: paymentTermsParam }] : []),
                      ...(rfqRef ? [{ label: L.orderRef, value: rfqRef }] : []),
                    ].map(({ label, value }) => (
                      <div key={label} className="flex items-center justify-between gap-4 py-1.5 border-b border-border/50 last:border-0">
                        <span className="text-xs text-muted-foreground">{label}</span>
                        <span className="text-sm font-semibold text-foreground text-left">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Addresses review */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { title: L.billingTitle, addr: billing, icon: 'CreditCardIcon' },
                    { title: L.shippingAddress, addr: sameAsBilling ? billing : shipping, icon: 'TruckIcon' },
                  ].map(({ title, addr, icon }) => (
                    <div key={title} className="bg-card rounded-2xl border border-border p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                          <Icon name={icon as any} size={13} className="text-primary" />
                          {title}
                        </h4>
                        <button
                          onClick={() => setStep('addresses')}
                          className="text-xs text-primary font-medium hover:underline"
                        >
                          {L.edit}
                        </button>
                      </div>
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        <p className="font-semibold text-foreground">{addr.fullName}</p>
                        <p>{addr.company}</p>
                        <p>{addr.address}</p>
                        <p>{addr.city}{addr.state ? `, ${addr.state}` : ''} {addr.postalCode}</p>
                        <p>{addr.country}</p>
                        <p>{addr.phone}</p>
                        <p>{addr.email}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Payment review */}
                <div className="bg-card rounded-2xl border border-border p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Icon name="CreditCardIcon" size={13} className="text-primary" />
                      {L.choosePayment}
                    </h4>
                    <button
                      onClick={() => setStep('payment')}
                      className="text-xs text-primary font-medium hover:underline"
                    >
                      {L.edit}
                    </button>
                  </div>
                  {selectedMethod && (
                    <div className="flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-xl px-4 py-3">
                      <Icon name={selectedMethod.icon as any} size={20} className="text-primary" />
                      <div>
                        <p className="text-sm font-bold text-foreground">{selectedMethod.labelAr}</p>
                        <p className="text-xs text-muted-foreground">{selectedMethod.descriptionAr}</p>
                      </div>
                    </div>
                  )}
                  {receiptFile && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                      <Icon name="PaperClipIcon" size={13} />
                      {L.attachedReceipt.replace('{name}', receiptFile.name)}
                    </div>
                  )}
                </div>

                {/* Security badges */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { icon: 'LockClosedIcon', label: L.secureEncrypted, color: 'text-green-600 bg-green-50 border-green-200' },
                    { icon: 'ShieldCheckIcon', label: L.buyerProtection, color: 'text-blue-600 bg-blue-50 border-blue-200' },
                    { icon: 'CheckBadgeIcon', label: L.verifiedSupplier, color: 'text-purple-600 bg-purple-50 border-purple-200' },
                  ].map((b) => (
                    <div key={b.label} className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 ${b.color}`}>
                      <Icon name={b.icon as any} size={18} />
                      <span className="text-[10px] font-semibold text-center leading-tight">{b.label}</span>
                    </div>
                  ))}
                </div>

                {/* Terms */}
                <label className="flex items-start gap-3 cursor-pointer bg-card border border-border rounded-xl px-4 py-3 select-none">
                  <input
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-border accent-primary"
                  />
                  <span className="text-xs text-muted-foreground leading-relaxed">
                    {L.agreeTo}{' '}<Link href="#" className="text-primary underline">{L.termsOfService}</Link> {L.and}{' '}<Link href="#" className="text-primary underline">{L.buyerProtectionPolicy}</Link> {L.agreeConfirm}
                  </span>
                </label>

                {error && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
                    <Icon name="ExclamationCircleIcon" size={16} />
                    {error}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setStep('payment')}
                    className="flex-1 h-12 border border-border text-foreground font-semibold rounded-xl text-sm flex items-center justify-center gap-2 hover:bg-muted transition-colors"
                  >
                    {L.back} <Icon name="ArrowRightIcon" size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmitOrder}
                    disabled={loading || !agreedToTerms}
                    className="flex-1 h-12 bg-primary text-primary-foreground font-bold rounded-xl text-sm disabled:opacity-60 flex items-center justify-center gap-2 transition-opacity active:opacity-80"
                  >
                    {loading ? (
                      <><Icon name="ArrowPathIcon" size={16} className="animate-spin" /> {L.processing}</>
                    ) : (
                      <><Icon name="LockClosedIcon" size={16} /> {L.submitOrder}</>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* ── STEP: Confirmed ── */}
            {step === 'confirmed' && (
              <div className="bg-card rounded-2xl border border-border p-8 text-center">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
                  <Icon name="CheckCircleIcon" size={40} className="text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-2">{L.orderSent}</h2>
                <p className="text-muted-foreground text-sm mb-5">
                  {L.orderSentBody}
                </p>
                <div className="bg-muted/50 rounded-xl p-4 mb-5 inline-block">
                  <p className="text-xs text-muted-foreground mb-1">{L.orderRef}</p>
                  <p className="text-xl font-bold text-primary font-mono">{confirmedRef}</p>
                </div>

                {/* What happens next */}
                <div className="bg-card border border-border rounded-2xl p-5 mb-6 text-right">
                  <h4 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                    <Icon name="ClockIcon" size={15} className="text-primary" />
                    {L.whatNext}
                  </h4>
                  <div className="space-y-3">
                    {[
                      { icon: 'EnvelopeIcon', title: L.confirmSent, desc: L.confirmSentDesc.replace('{email}', user?.email || ''), color: 'bg-blue-100 text-blue-600' },
                      { icon: 'BuildingOffice2Icon', title: L.supplierNotified, desc: L.supplierNotifiedDesc.replace('{name}', supplierName), color: 'bg-amber-100 text-amber-600' },
                      { icon: 'CreditCardIcon', title: L.paymentProcessing, desc: L.paymentProcessingDesc.replace('{method}', selectedMethod ? L.payments[selectedMethod.labelKey] : ''), color: 'bg-purple-100 text-purple-600' },
                      { icon: 'TruckIcon', title: L.arrangeShipping, desc: L.arrangeShippingDesc, color: 'bg-green-100 text-green-600' },
                    ].map((item) => (
                      <div key={item.title} className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${item.color}`}>
                          <Icon name={item.icon as any} size={15} />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-foreground">{item.title}</p>
                          <p className="text-xs text-muted-foreground">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <button
                    type="button"
                    onClick={() => router.push(confirmedOrderId ? `/orders/${confirmedOrderId}` : '/orders')}
                    className="px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-xl text-sm flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Icon name="TruckIcon" size={16} /> {L.trackOrder}
                  </button>
                  <Link
                    href="/"
                    className="px-6 py-3 border border-border text-foreground font-semibold rounded-xl text-sm flex items-center justify-center gap-2 hover:bg-muted transition-colors"
                  >
                    {L.backToMarketplace}
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* ── Order Summary Sidebar ── */}
          {step !== 'confirmed' && (
            <div className="lg:col-span-1">
              <div className="bg-card rounded-2xl border border-border p-5 sticky top-20">
                <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                  <Icon name="ClipboardDocumentCheckIcon" size={15} className="text-primary" />
                  {L.orderSummary}
                </h3>

                {/* Product card */}
                <div className="bg-muted/40 rounded-xl p-3 mb-4">
                  <p className="text-xs font-bold text-foreground leading-snug mb-1">{productName}</p>
                  <p className="text-xs text-muted-foreground">{supplierName}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="text-[10px] bg-primary/10 text-primary rounded-full px-2 py-0.5 font-medium">
                      {L.qtyLine.replace('{quantity}', quantity).replace('{unit}', unit)}
                    </span>
                    {targetPrice && (
                      <span className="text-[10px] bg-muted text-muted-foreground rounded-full px-2 py-0.5">
                        {L.targetLine.replace('{price}', targetPrice).replace('{currency}', currency)}
                      </span>
                    )}
                    <span className="text-[10px] bg-muted text-muted-foreground rounded-full px-2 py-0.5">
                      {incoterms}
                    </span>
                  </div>
                </div>

                {/* Price note */}
                <div className="border-t border-border pt-3 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{L.orderValue}</span>
                    <span className="font-semibold text-foreground">
                      {targetPrice ? `${targetPrice} ${currency}` : L.setBySupplier}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm mt-1.5">
                    <span className="text-muted-foreground">{L.shipping}</span>
                    <span className="font-semibold text-foreground">{L.perIncoterms.replace('{incoterms}', incoterms)}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed">
                    {L.finalPriceNote}
                  </p>
                </div>

                {/* Payment method badge */}
                {selectedPayment && (
                  <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-lg px-3 py-2 mb-3">
                    <Icon name={selectedMethod?.icon as any || 'CreditCardIcon'} size={14} className="text-primary shrink-0" />
                    <span className="text-xs font-medium text-foreground">{(selectedMethod ? L.payments[selectedMethod.labelKey] : undefined) || L.paymentSelected}</span>
                  </div>
                )}

                {/* Security note */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
                  <Icon name="LockClosedIcon" size={13} className="text-green-600 shrink-0" />
                  {L.allSecure}
                </div>

                {/* RFQ ref */}
                {rfqRef && (
                  <div className="mt-3 text-center">
                    <p className="text-[10px] text-muted-foreground">{L.orderRef}</p>
                    <p className="text-xs font-bold text-foreground font-mono">{rfqRef}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}

export default function RFQCheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <Icon name="ArrowPathIcon" size={32} className="animate-spin text-primary" />
        </div>
      }
    >
      <RFQCheckoutContent />
    </Suspense>
  );
}
