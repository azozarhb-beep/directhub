'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import { SUPPLIER_UNIT_OPTIONS } from './supplierUnits';

interface SupplierDealLinksProps {
  userId: string;
  prefill?: {
    product_title?: string;
    quoted_price?: string;
    currency?: string;
    unit?: string;
  };
}

interface QuoteRow {
  id: string;
  product_title: string | null;
  quoted_price: number;
  currency: string;
  quantity: number;
  delivery_days: number;
  status: string;
  created_at: string;
  expires_at: string | null;
  public_token: string | null;
  notes: string | null;
  shipping_type: string | null;
}

type DeliveryMode = 'warehouse_pickup' | 'carrier_office' | 'door_delivery';

interface FormState {
  product_title: string;
  quoted_price: string;
  currency: string;
  quantity: string;
  unit: string;
  delivery_days: string;
  delivery_mode: DeliveryMode;
  payment_terms: string;
  notes: string;
  expires_in_days: string;
}

const INITIAL: FormState = {
  product_title: '',
  quoted_price: '',
  currency: 'YER',
  quantity: '',
  unit: 'carton',
  delivery_days: '',
  delivery_mode: 'warehouse_pickup',
  payment_terms: '',
  notes: '',
  expires_in_days: '7',
};

const DELIVERY_OPTIONS: Array<{ value: DeliveryMode; label: string; apiType: 'port_warehouse' | 'door_to_door' }> = [
  { value: 'warehouse_pickup', label: 'استلام من المستودع (تحميل العميل)', apiType: 'port_warehouse' },
  { value: 'carrier_office', label: 'شحن عبر مكاتب النقل (أجور الشحن على المشتري عند الاستلام)', apiType: 'port_warehouse' },
  { value: 'door_delivery', label: 'توصيل لباب العميل (شامل تكلفة التوصيل)', apiType: 'door_to_door' },
];

const MODE_TAG_PREFIX = '[شروط التسليم: ';
const UNIT_TAG_PREFIX = '[الوحدة: ';

const CARD = 'bg-slate-900 border border-slate-800 rounded-2xl';
const INPUT =
  'w-full h-11 px-3 rounded-xl border border-slate-700 bg-slate-950 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500';

const STATUS_CLS = {
  active: 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40',
  awaiting: 'bg-amber-500/15 text-amber-300 border border-amber-500/40',
  paid: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40',
  expired: 'bg-slate-700 text-slate-300 border border-slate-600',
} as const;

function extractTag(text: string | null | undefined, prefix: string): string {
  if (!text) return '';
  const start = text.indexOf(prefix);
  if (start < 0) return '';
  const end = text.indexOf(']', start);
  if (end < 0) return '';
  return text.slice(start + prefix.length, end).trim();
}

function resolveStatus(q: QuoteRow): { label: string; cls: string } {
  const expiredByDate = q.expires_at ? new Date(q.expires_at).getTime() < Date.now() : false;
  if (q.status === 'accepted') return { label: 'مدفوع بالضمان', cls: STATUS_CLS.paid };
  if (q.status === 'expired' || q.status === 'rejected' || q.status === 'superseded') {
    return { label: 'منتهي', cls: STATUS_CLS.expired };
  }
  if (q.status === 'pending' && expiredByDate) return { label: 'منتهي', cls: STATUS_CLS.expired };
  if (q.status === 'awaiting_payment' || q.status === 'payment_pending') {
    return { label: 'بانتظار الدفع', cls: STATUS_CLS.awaiting };
  }
  return { label: 'نشط', cls: STATUS_CLS.active };
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(n);
}

export default function SupplierDealLinks({ userId, prefill }: SupplierDealLinksProps) {
  const supabase = useMemo(() => createClient(), []);
  const [form, setForm] = useState<FormState>(() => ({ ...INITIAL, ...(prefill ?? {}) }));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [link, setLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [quotesLoading, setQuotesLoading] = useState(true);
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const loadQuotes = useCallback(async () => {
    const { data } = await supabase
      .from('custom_quotes')
      .select('id, product_title, quoted_price, currency, quantity, delivery_days, status, created_at, expires_at, public_token, notes, shipping_type')
      .eq('factory_user_id', userId)
      .is('conversation_id', null)
      .order('created_at', { ascending: false })
      .limit(30);
    setQuotes(((data as QuoteRow[]) ?? []).filter(Boolean));
    setQuotesLoading(false);
  }, [supabase, userId]);

  useEffect(() => {
    loadQuotes();
  }, [loadQuotes]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const liveTotal = useMemo(() => {
    const p = Number(form.quoted_price);
    const q = Number(form.quantity);
    if (!(p > 0) || !(q > 0)) return null;
    return p * q;
  }, [form.quoted_price, form.quantity]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setCopied(false);
    const price = Number(form.quoted_price);
    const qty = Number(form.quantity);
    const days = Number(form.delivery_days);
    if (!(price > 0) || !(qty > 0) || !(days > 0)) {
      setError('يرجى إدخال سعر وكمية ومدة تسليم صحيحة');
      return;
    }
    const unitLabel = SUPPLIER_UNIT_OPTIONS.find((u) => u.value === form.unit)?.label ?? form.unit;
    const deliveryOpt = DELIVERY_OPTIONS.find((d) => d.value === form.delivery_mode) ?? DELIVERY_OPTIONS[0];
    const tags = `${UNIT_TAG_PREFIX}${unitLabel}] ${MODE_TAG_PREFIX}${deliveryOpt.label}]`;
    const userNotes = form.notes.trim();
    setLoading(true);
    try {
      const res = await fetch('/api/quotes/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoted_price: price,
          currency: form.currency,
          quantity: Math.floor(qty),
          delivery_days: Math.floor(days),
          shipping_type: deliveryOpt.apiType,
          payment_terms: form.payment_terms.trim() || null,
          notes: userNotes ? `${tags}\n${userNotes}` : tags,
          product_title: form.product_title.trim() || null,
          expires_in_days: Number(form.expires_in_days) || 7,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.deal_path) throw new Error(data.error || 'تعذر إنشاء رابط الصفقة');
      setLink(`${window.location.origin}${data.deal_path}`);
      setForm(INITIAL);
      toast.success('تم إنشاء رابط الصفقة');
      await loadQuotes();
    } catch (err: any) {
      setError(err?.message || 'حدث خطأ غير متوقع');
    } finally {
      setLoading(false);
    }
  };

  const copyText = async (text: string, fromForm = false) => {
    try {
      await navigator.clipboard.writeText(text);
      if (fromForm) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
      toast.success('تم نسخ الرابط');
    } catch {
      toast.error('تعذر النسخ تلقائياً، انسخ الرابط يدوياً');
    }
  };

  const buildWhatsappHref = (url: string, title?: string | null, total?: string) => {
    const parts = [
      'رابط الصفقة المؤمّنة عبر DirectHub',
      title ? `الصفقة: ${title}` : '',
      total ? `إجمالي القيمة: ${total}` : '',
      `للدفع الآمن عبر الضمان المالي اضغط هنا: ${url}`,
    ].filter(Boolean);
    return `https://wa.me/?text=${encodeURIComponent(parts.join(' - '))}`;
  };

  const whatsappHref = buildWhatsappHref(link);
  const mailHref = `mailto:?subject=${encodeURIComponent('رابط صفقة مؤمّنة - DirectHub')}&body=${encodeURIComponent(link)}`;

  return (
    <div className="space-y-5" dir="rtl">
      <div className={`${CARD} p-5`}>
        <p className="text-xs text-slate-400 mb-4">أنشئ رابطاً بشروط مقفلة (السعر، الكمية، التسليم) وأرسله للعميل ليدفع عبر الضمان المالي.</p>

        {link ? (
          <div className="space-y-3">
            <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-xl px-3 py-2.5 text-sm font-semibold">
              تم إنشاء رابط الصفقة. الشروط مقفلة للعميل.
            </div>
            <div className="flex items-center gap-2">
              <input readOnly value={link} dir="ltr" className={`${INPUT} font-mono text-xs`} onFocus={(e) => e.currentTarget.select()} />
              <button type="button" onClick={() => copyText(link, true)} className="h-11 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-bold shrink-0">
                {copied ? 'تم النسخ' : 'نسخ'}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="h-10 rounded-xl bg-green-600 hover:bg-green-500 text-white text-sm font-bold flex items-center justify-center">
                واتساب
              </a>
              <a href={mailHref} className="h-10 rounded-xl border border-slate-700 text-slate-200 text-sm font-bold flex items-center justify-center hover:bg-slate-800">
                البريد
              </a>
            </div>
            <button type="button" onClick={() => { setLink(''); setError(''); }} className="w-full h-10 rounded-xl text-sm font-bold text-cyan-300 hover:bg-cyan-500/10">
              إنشاء رابط آخر
            </button>
          </div>
        ) : (
          <form onSubmit={handleGenerate} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">اسم البضاعة / وصف الصفقة</label>
              <input className={INPUT} value={form.product_title} onChange={(e) => set('product_title', e.target.value)} placeholder="مثال: أرز بسمتي كرتون 10 كجم" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-bold text-slate-300 mb-1.5">سعر الوحدة *</label>
                <input type="number" min="0" step="0.01" className={INPUT} value={form.quoted_price} onChange={(e) => set('quoted_price', e.target.value)} required />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">العملة</label>
                <select className={INPUT} value={form.currency} onChange={(e) => set('currency', e.target.value)}>
                  <option value="YER">YER</option>
                  <option value="SAR">SAR</option>
                  <option value="USD">USD</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-bold text-slate-300 mb-1.5">الكمية *</label>
                <input type="number" min="1" step="1" className={INPUT} value={form.quantity} onChange={(e) => set('quantity', e.target.value)} required />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">وحدة البيع</label>
                <select className={INPUT} value={form.unit} onChange={(e) => set('unit', e.target.value)}>
                  {SUPPLIER_UNIT_OPTIONS.map((u) => (
                    <option key={u.value} value={u.value}>{u.label}</option>
                  ))}
                </select>
              </div>
            </div>
            {liveTotal !== null && (
              <div className="flex">
                <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-sm font-black">
                  إجمالي قيمة الصفقة: {formatNumber(liveTotal)} {form.currency}
                </span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">مدة التسليم (أيام) *</label>
                <input type="number" min="1" step="1" className={INPUT} value={form.delivery_days} onChange={(e) => set('delivery_days', e.target.value)} required />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">صلاحية الرابط (أيام)</label>
                <input type="number" min="1" max="90" className={INPUT} value={form.expires_in_days} onChange={(e) => set('expires_in_days', e.target.value)} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">شروط التسليم *</label>
              <select className={INPUT} value={form.delivery_mode} onChange={(e) => set('delivery_mode', e.target.value as DeliveryMode)}>
                {DELIVERY_OPTIONS.map((d) => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">شروط الدفع</label>
              <input className={INPUT} value={form.payment_terms} onChange={(e) => set('payment_terms', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">ملاحظات</label>
              <textarea rows={2} className="w-full px-3 py-2 rounded-xl border border-slate-700 bg-slate-950 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none" value={form.notes} onChange={(e) => set('notes', e.target.value)} />
            </div>
            {error && <div className="bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl px-3 py-2 text-sm">{error}</div>}
            <button type="submit" disabled={loading} className="w-full h-11 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold text-sm">
              {loading ? 'جاري الإنشاء...' : 'إنشاء رابط الصفقة'}
            </button>
          </form>
        )}
      </div>

      <div className={`${CARD} p-5`}>
        <h3 className="text-sm font-black text-white mb-3">روابط الصفقات السابقة</h3>
        {quotesLoading ? (
          <div className="flex justify-center py-6">
            <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : quotes.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">لا توجد روابط صفقات بعد</p>
        ) : (
          <ul className="divide-y divide-slate-800">
            {quotes.map((q) => {
              const status = resolveStatus(q);
              const unitLabel = extractTag(q.notes, UNIT_TAG_PREFIX) || 'وحدة';
              const total = `${formatNumber(Number(q.quoted_price) * Number(q.quantity))} ${q.currency}`;
              const dealUrl = q.public_token && origin ? `${origin}/pay/deal/${q.public_token}` : '';
              const canShare = !!dealUrl && status.label !== 'منتهي';
              return (
                <li key={q.id} className="py-3 flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white truncate">{q.product_title || 'صفقة بدون عنوان'}</p>
                    <p className="text-xs text-slate-400">
                      {q.quantity} {unitLabel} × {q.quoted_price} {q.currency} · تسليم {q.delivery_days} يوم
                    </p>
                    <p className="text-xs text-emerald-300 font-bold mt-0.5">إجمالي قيمة الصفقة: {total}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[11px] px-2 py-1 rounded-full ${status.cls}`}>{status.label}</span>
                    {canShare && (
                      <>
                        <button
                          type="button"
                          onClick={() => copyText(dealUrl)}
                          className="text-[11px] px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold"
                        >
                          نسخ الرابط
                        </button>
                        <a
                          href={buildWhatsappHref(dealUrl, q.product_title, total)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] px-2.5 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 text-white font-bold"
                        >
                          مشاركة واتساب 📲
                        </a>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
