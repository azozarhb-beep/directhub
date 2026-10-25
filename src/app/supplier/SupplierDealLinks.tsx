'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface SupplierDealLinksProps {
  userId: string;
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
}

interface FormState {
  product_title: string;
  quoted_price: string;
  currency: string;
  quantity: string;
  delivery_days: string;
  shipping_type: 'door_to_door' | 'port_warehouse';
  payment_terms: string;
  notes: string;
  expires_in_days: string;
}

const INITIAL: FormState = {
  product_title: '',
  quoted_price: '',
  currency: 'YER',
  quantity: '',
  delivery_days: '',
  shipping_type: 'port_warehouse',
  payment_terms: '',
  notes: '',
  expires_in_days: '7',
};

const CARD = 'bg-slate-900 border border-slate-800 rounded-2xl';
const INPUT =
  'w-full h-11 px-3 rounded-xl border border-slate-700 bg-slate-950 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500';

const STATUS_LABEL: Record<string, string> = {
  pending: 'بانتظار العميل',
  accepted: 'مقبول',
  rejected: 'مرفوض',
  expired: 'منتهي',
  superseded: 'مستبدل',
};

const STATUS_CLS: Record<string, string> = {
  pending: 'bg-amber-500/15 text-amber-300 border border-amber-500/40',
  accepted: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40',
  rejected: 'bg-red-500/15 text-red-300 border border-red-500/40',
  expired: 'bg-slate-700 text-slate-300 border border-slate-600',
  superseded: 'bg-slate-700 text-slate-300 border border-slate-600',
};

export default function SupplierDealLinks({ userId }: SupplierDealLinksProps) {
  const supabase = useMemo(() => createClient(), []);
  const [form, setForm] = useState<FormState>(INITIAL);
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
      .select('id, product_title, quoted_price, currency, quantity, delivery_days, status, created_at, expires_at, public_token')
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
          shipping_type: form.shipping_type,
          payment_terms: form.payment_terms.trim() || null,
          notes: form.notes.trim() || null,
          product_title: form.product_title.trim() || null,
          expires_in_days: Number(form.expires_in_days) || 7,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.deal_path) throw new Error(data.error || 'تعذر إنشاء رابط الصفقة');
      setLink(`${window.location.origin}${data.deal_path}`);
      setForm(INITIAL);
      await loadQuotes();
    } catch (err: any) {
      setError(err?.message || 'حدث خطأ غير متوقع');
    } finally {
      setLoading(false);
    }
  };

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('تعذر النسخ تلقائياً، انسخ الرابط يدوياً');
    }
  };

  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(`رابط الصفقة المؤمّنة عبر DirectHub:\n${link}`)}`;
  const mailHref = `mailto:?subject=${encodeURIComponent('رابط صفقة مؤمّنة - DirectHub')}&body=${encodeURIComponent(link)}`;

  return (
    <div className="space-y-5" dir="rtl">
      <div className={`${CARD} p-5`}>
        <h2 className="text-base font-black text-white mb-1">رابط صفقة مخصص للعملاء</h2>
        <p className="text-xs text-slate-400 mb-4">أنشئ رابطاً بشروط مقفلة (السعر، الكمية، التسليم) وأرسله للعميل ليدفع عبر الضمان المالي.</p>

        {link ? (
          <div className="space-y-3">
            <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-xl px-3 py-2.5 text-sm font-semibold">
              تم إنشاء رابط الصفقة. الشروط مقفلة للعميل.
            </div>
            <div className="flex items-center gap-2">
              <input readOnly value={link} dir="ltr" className={`${INPUT} font-mono text-xs`} onFocus={(e) => e.currentTarget.select()} />
              <button type="button" onClick={() => copyText(link)} className="h-11 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-bold shrink-0">
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">الكمية *</label>
                <input type="number" min="1" step="1" className={INPUT} value={form.quantity} onChange={(e) => set('quantity', e.target.value)} required />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">مدة التسليم (أيام) *</label>
                <input type="number" min="1" step="1" className={INPUT} value={form.delivery_days} onChange={(e) => set('delivery_days', e.target.value)} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">شروط التسليم *</label>
                <select className={INPUT} value={form.shipping_type} onChange={(e) => set('shipping_type', e.target.value as FormState['shipping_type'])}>
                  <option value="port_warehouse">استلام من المستودع / الميناء</option>
                  <option value="door_to_door">توصيل لباب العميل (شامل الشحن)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">صلاحية الرابط (أيام)</label>
                <input type="number" min="1" max="90" className={INPUT} value={form.expires_in_days} onChange={(e) => set('expires_in_days', e.target.value)} />
              </div>
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
            {quotes.map((q) => (
              <li key={q.id} className="py-3 flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white truncate">{q.product_title || 'صفقة بدون عنوان'}</p>
                  <p className="text-xs text-slate-400">
                    {q.quantity} وحدة × {q.quoted_price} {q.currency} · تسليم {q.delivery_days} يوم
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[11px] px-2 py-1 rounded-full ${STATUS_CLS[q.status] || STATUS_CLS.pending}`}>
                    {STATUS_LABEL[q.status] || q.status}
                  </span>
                  {q.public_token && q.status === 'pending' && origin && (
                    <button
                      type="button"
                      onClick={() => copyText(`${origin}/pay/deal/${q.public_token}`)}
                      className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold"
                    >
                      نسخ الرابط
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
