'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { signRequest } from '@/lib/securitySigner';
import PaymentGatewaySelector, { PaymentGatewayState } from '@/app/checkout/components/PaymentGatewaySelector';

export interface DealSummary {
  id: string;
  publicToken: string;
  status: string;
  unitPrice: number;
  currency: string;
  quantity: number;
  deliveryDays: number;
  paymentTerms: string | null;
  notes: string | null;
  shippingType: string | null;
  incoterm: string | null;
  portOfLoading: string | null;
  productTitle: string | null;
  expiresAt: string | null;
  isExpired: boolean;
  checkoutOrderId: string | null;
  buyerUserId: string | null;
  factoryUserId: string;
  factoryName: string;
  factoryVerified: boolean;
}

interface WireOCRResult {
  amount: number | null;
  currency: string | null;
  sender_name: string | null;
  bank_name: string | null;
  swift_code: string | null;
  reference_number: string | null;
  confidence: number;
  is_authentic: boolean;
  notes: string;
}

const EMPTY_GATEWAY: PaymentGatewayState = {
  gateway: null,
  localWallet: { walletProvider: '', posNumber: '', senderName: '', senderPhone: '', transferRef: '', receiptFile: null },
  localBank: { bankName: '', senderAccountName: '', senderAccountNumber: '', transferRef: '', receiptFile: null },
  intlCard: { cardholderName: '', cardNumber: '', expiry: '', cvv: '' },
  intlSwift: { senderBankName: '', senderIban: '', swiftRef: '', receiptFile: null },
};

function fmt(n: number): string {
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function ReadOnlyRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 border-b border-border last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold text-foreground text-end">{value}</span>
    </div>
  );
}

// OCR box — shown ONLY for the international SWIFT method
function SwiftOcrBox({ onVerified }: { onVerified: (r: WireOCRResult) => void }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [mime, setMime] = useState('image/jpeg');
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<WireOCRResult | null>(null);
  const [error, setError] = useState('');

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const f = e.target.files?.[0];
      if (!f) return;
      if (f.size > 10 * 1024 * 1024) { setError('الحد الأقصى لحجم الملف 10MB'); return; }
      if (!f.type.startsWith('image/')) { setError('يرجى رفع صورة للإيصال'); return; }
      setError('');
      setResult(null);
      setMime(f.type || 'image/jpeg');
      const reader = new FileReader();
      reader.onload = (ev) => setPreview((ev.target?.result as string) || null);
      reader.onerror = () => setError('تعذر قراءة الملف');
      reader.readAsDataURL(f);
    } catch {
      setError('تعذر قراءة الملف');
    }
  };

  const analyze = async () => {
    if (!preview) return;
    setAnalyzing(true);
    setError('');
    try {
      const res = await fetch('/api/escrow/wire-ocr-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: preview.split(',')[1], mimeType: mime }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل التحليل');
      setResult(data.ocrResult);
      if (data.verified) onVerified(data.ocrResult);
    } catch (err: any) {
      setError(err?.message || 'فشل التحليل');
    } finally {
      setAnalyzing(false);
    }
  };

  const ok = !!result && result.is_authentic && result.confidence >= 70;

  return (
    <div className="border border-blue-200 bg-blue-50/50 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
          <Icon name="DocumentMagnifyingGlassIcon" size={16} className="text-blue-700" />
        </div>
        <div>
          <p className="text-sm font-bold text-blue-900">تحقق OCR من إيصال SWIFT</p>
          <p className="text-xs text-blue-600">ارفع صورة الإيصال للتحقق التلقائي من بيانات IBAN والمبلغ</p>
        </div>
      </div>
      {!preview ? (
        <label className="flex items-center justify-center gap-2 h-10 border-2 border-dashed border-blue-300 rounded-xl text-xs font-semibold text-blue-700 hover:bg-blue-100 cursor-pointer transition-colors">
          <Icon name="PhotoIcon" size={15} />
          رفع صورة الإيصال
          <input type="file" accept="image/*" onChange={onFile} className="sr-only" />
        </label>
      ) : (
        <div className="space-y-3">
          <div className="relative">
            <img src={preview} alt="Wire transfer receipt" className="w-full max-h-40 object-contain rounded-lg border border-blue-200 bg-white" />
            <button
              type="button"
              onClick={() => { setPreview(null); setResult(null); }}
              className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
              aria-label="Remove"
            >
              <Icon name="XMarkIcon" size={12} />
            </button>
          </div>
          {!result && (
            <button
              type="button"
              onClick={analyze}
              disabled={analyzing}
              className="w-full h-10 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {analyzing ? 'جاري التحليل...' : 'تحليل الإيصال بالذكاء الاصطناعي'}
            </button>
          )}
        </div>
      )}
      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-xs">{error}</div>}
      {result && (
        <div className={`rounded-xl border p-3 text-xs font-bold ${ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
          {ok ? `✅ تم التحقق — ثقة ${result.confidence}%` : `⚠️ يتطلب مراجعة يدوية — ثقة ${result.confidence}%`}
        </div>
      )}
    </div>
  );
}

export default function DealCheckoutClient({ token, deal }: { token: string; deal: DealSummary | null }) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const supabase = React.useMemo(() => createClient(), []);

  const [gateway, setGateway] = useState<PaymentGatewayState>(EMPTY_GATEWAY);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [ocrVerified, setOcrVerified] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    setError('');
  }, [gateway.gateway]);

  if (!deal) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="max-w-xl mx-auto px-4 py-24 text-center" dir="rtl">
          <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
            <Icon name="LinkSlashIcon" size={30} className="text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-foreground mb-2">رابط الصفقة غير صالح</h1>
          <p className="text-sm text-muted-foreground mb-6">لم يتم العثور على هذه الصفقة. تأكد من الرابط أو تواصل مع المصنع.</p>
          <Link href="/" className="inline-flex px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold">الصفحة الرئيسية</Link>
        </div>
      </div>
    );
  }

  const total = Math.round(deal.unitPrice * deal.quantity * 100) / 100;
  const blockedStatus = ['rejected', 'superseded', 'expired'].includes(deal.status) || deal.isExpired;
  const paidAlready = !!deal.checkoutOrderId && done;
  const wrongBuyer = !!user && !!deal.buyerUserId && deal.buyerUserId !== user.id;
  const isIssuer = !!user && user.id === deal.factoryUserId;

  const shippingLabel = deal.shippingType
    ? deal.shippingType === 'door_to_door' ? 'تسليم باب المشتري (شامل الشحن)' : 'تسليم الميناء / المخزن'
    : deal.incoterm
      ? `${deal.incoterm}${deal.incoterm === 'FOB' && deal.portOfLoading ? ` — ${deal.portOfLoading}` : ''}`
      : '—';

  const activeFields = (() => {
    switch (gateway.gateway) {
      case 'local_wallet': {
        const w = gateway.localWallet;
        return !!w.walletProvider && !!w.senderPhone.trim() && !!w.transferRef.trim() && !!w.receiptFile;
      }
      case 'local_bank_transfer': {
        const b = gateway.localBank;
        return !!b.senderAccountName.trim() && !!b.transferRef.trim() && !!b.receiptFile;
      }
      case 'international_swift': {
        const s = gateway.intlSwift;
        return !!s.senderIban.trim() && !!s.swiftRef.trim() && (!!s.receiptFile || ocrVerified);
      }
      default:
        return false;
    }
  })();

  const handlePay = async () => {
    if (!user) {
      router.push(`/login?redirect=${encodeURIComponent(`/pay/deal/${token}`)}`);
      return;
    }
    if (!gateway.gateway || !activeFields) {
      setError('يرجى استكمال بيانات الدفع وإرفاق الإيصال');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      // 1) Server-side conversion: price/qty come from the quote, never the client
      const convRes = await fetch(`/api/quotes/${encodeURIComponent(deal.publicToken)}/checkout`, { method: 'POST' });
      const conv = await convRes.json();
      if (!convRes.ok || !conv.success) throw new Error(conv.error || 'تعذر إنشاء الطلب');

      // 2) Submit payment channel data + receipt (upload failures never crash the UI)
      const fd = new FormData();
      fd.append('order_id', conv.order_id);
      fd.append('payment_channel', gateway.gateway);
      let receipt: File | null = null;
      if (gateway.gateway === 'local_wallet') {
        const w = gateway.localWallet;
        fd.append('wallet_provider', w.walletProvider);
        fd.append('wallet_pos_number', w.posNumber);
        fd.append('wallet_sender_name', w.senderName);
        fd.append('wallet_sender_phone', w.senderPhone);
        fd.append('wallet_transfer_ref', w.transferRef);
        receipt = w.receiptFile;
      } else if (gateway.gateway === 'local_bank_transfer') {
        const b = gateway.localBank;
        fd.append('bank_sender_bank_name', b.bankName);
        fd.append('bank_sender_account_name', b.senderAccountName);
        fd.append('bank_sender_account_number', b.senderAccountNumber);
        fd.append('bank_transfer_ref', b.transferRef);
        receipt = b.receiptFile;
      } else if (gateway.gateway === 'international_swift') {
        const s = gateway.intlSwift;
        fd.append('swift_sender_bank_name', s.senderBankName);
        fd.append('swift_sender_iban', s.senderIban);
        fd.append('swift_ref', s.swiftRef);
        receipt = s.receiptFile;
      }
      if (receipt) fd.append('receipt_file', receipt);

      try {
        const res = await fetch('/api/payment/submit', {
          method: 'POST',
          headers: signRequest('POST', '/api/payment/submit', ''),
          body: fd,
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData?.error || 'تعذر حفظ بيانات الدفع');
        }
      } catch (payErr: any) {
        throw new Error(payErr?.message || 'تعذر إرسال إيصال الدفع، حاول مرة أخرى');
      }

      setDone(true);
      router.push(`/order-confirmation?order=${encodeURIComponent(conv.order_number || '')}`);
    } catch (err: any) {
      setError(err?.message || 'حدث خطأ غير متوقع');
    } finally {
      setSubmitting(false);
    }
  };

  const showGateway = !blockedStatus && !wrongBuyer && !isIssuer;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6" dir="rtl">
        {/* Title */}
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Icon name="ShieldCheckIcon" size={22} className="text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">صفقة مؤمّنة بنظام الضمان</h1>
            <p className="text-xs text-muted-foreground">الشروط التجارية مقفلة ولا يمكن تعديلها</p>
          </div>
        </div>

        {/* Locked Deal Summary */}
        <section className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-base font-bold text-foreground">{deal.factoryName}</p>
                {deal.factoryVerified && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                    <Icon name="CheckBadgeIcon" size={12} />
                    مصنع موثّق
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1">{deal.productTitle || 'صفقة مخصصة'}</p>
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-1 rounded-full">
              <Icon name="LockClosedIcon" size={12} />
              للقراءة فقط
            </span>
          </div>

          <div className="rounded-xl border border-border px-4">
            <ReadOnlyRow label="سعر الوحدة (مقفل)" value={`${deal.currency} ${fmt(deal.unitPrice)}`} />
            <ReadOnlyRow label="الكمية المتفق عليها" value={deal.quantity.toLocaleString('en-US')} />
            <ReadOnlyRow label="شروط الشحن" value={shippingLabel} />
            <ReadOnlyRow label="مدة التسليم" value={`${deal.deliveryDays} يوم`} />
            {deal.paymentTerms && <ReadOnlyRow label="شروط الدفع" value={deal.paymentTerms} />}
            {deal.notes && <ReadOnlyRow label="ملاحظات" value={deal.notes} />}
          </div>

          <div className="mt-4 flex items-center justify-between rounded-xl bg-primary/5 border border-primary/20 px-4 py-3">
            <span className="text-sm font-bold text-foreground">إجمالي المبلغ المستحق</span>
            <span className="text-xl font-extrabold text-primary">{deal.currency} {fmt(total)}</span>
          </div>
        </section>

        {/* Escrow info */}
        <div className="flex items-start gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
          <Icon name="ShieldCheckIcon" size={20} className="text-emerald-700 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-emerald-900">نظام الضمان المالي (Escrow)</p>
            <p className="text-xs text-emerald-800 leading-relaxed mt-0.5">
              يُحتجز المبلغ لدى المنصة ولا يُحوَّل للمصنع إلا بعد تأكيد استلامك للبضاعة.
            </p>
          </div>
        </div>

        {/* Blocked states */}
        {blockedStatus && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800">
            {deal.isExpired || deal.status === 'expired' ?'انتهت صلاحية رابط الصفقة. اطلب من المصنع إنشاء رابط جديد.' :'هذه الصفقة لم تعد متاحة للدفع.'}
          </div>
        )}
        {wrongBuyer && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
            هذا الرابط مخصص لمشترٍ آخر. سجّل الدخول بالحساب الصحيح.
          </div>
        )}
        {isIssuer && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
            أنت المصنع المُصدر لهذه الصفقة — شارك الرابط مع المشتري لإتمام الدفع.
          </div>
        )}

        {/* Payment */}
        {showGateway && (
          <section className="bg-card border border-border rounded-2xl p-5 space-y-5">
            <PaymentGatewaySelector value={gateway} onChange={setGateway} />

            {/* SWIFT OCR box ONLY for international wire */}
            {gateway.gateway === 'international_swift' && (
              <SwiftOcrBox onVerified={() => setOcrVerified(true)} />
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">{error}</div>
            )}

            {!authLoading && !user ? (
              <Link
                href={`/login?redirect=${encodeURIComponent(`/pay/deal/${token}`)}`}
                className="w-full h-12 bg-primary text-primary-foreground rounded-xl font-bold flex items-center justify-center gap-2"
              >
                <Icon name="ArrowRightOnRectangleIcon" size={18} />
                سجّل الدخول لإتمام الدفع
              </Link>
            ) : (
              <button
                type="button"
                onClick={handlePay}
                disabled={submitting || !activeFields || paidAlready}
                className="w-full h-12 bg-primary text-primary-foreground rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> جاري المعالجة...</>
                ) : (
                  <><Icon name="LockClosedIcon" size={18} /> تأكيد الدفع — {deal.currency} {fmt(total)}</>
                )}
              </button>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
