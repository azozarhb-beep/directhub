'use client';

import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';

interface DealLinkGeneratorModalProps {
  open: boolean;
  onClose: () => void;
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
  currency: 'USD',
  quantity: '',
  delivery_days: '',
  shipping_type: 'port_warehouse',
  payment_terms: '',
  notes: '',
  expires_in_days: '7',
};

const inputCls =
  'w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors';

export default function DealLinkGeneratorModal({ open, onClose }: DealLinkGeneratorModalProps) {
  const [form, setForm] = useState<FormState>(INITIAL);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [link, setLink] = useState('');
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const reset = () => {
    setForm(INITIAL);
    setLink('');
    setError('');
    setCopied(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
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
    } catch (err: any) {
      setError(err?.message || 'حدث خطأ غير متوقع');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('تعذر النسخ تلقائياً، انسخ الرابط يدوياً');
    }
  };

  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(`رابط الصفقة المؤمّنة عبر DirectHub:\n${link}`)}`;
  const mailHref = `mailto:?subject=${encodeURIComponent('رابط صفقة مؤمّنة - DirectHub')}&body=${encodeURIComponent(link)}`;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4" onClick={handleClose}>
      <div
        className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Icon name="LinkIcon" size={18} className="text-primary" />
            </div>
            <h2 className="text-base font-bold text-foreground">إنشاء رابط صفقة مخصصة</h2>
          </div>
          <button type="button" onClick={handleClose} className="p-1.5 rounded-lg hover:bg-muted" aria-label="إغلاق">
            <Icon name="XMarkIcon" size={18} />
          </button>
        </div>

        {link ? (
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5 text-sm font-semibold">
              <Icon name="CheckCircleIcon" size={18} />
              تم إنشاء رابط الصفقة. الشروط مقفلة للمشتري.
            </div>
            <div className="flex items-center gap-2">
              <input readOnly value={link} dir="ltr" className={`${inputCls} font-mono text-xs`} onFocus={(e) => e.currentTarget.select()} />
              <button
                type="button"
                onClick={handleCopy}
                className="h-10 px-4 bg-primary text-primary-foreground rounded-lg text-sm font-semibold shrink-0"
              >
                {copied ? 'تم النسخ' : 'نسخ'}
              </button>
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="grid grid-cols-2 gap-2">
              <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="h-10 rounded-lg bg-green-600 text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-green-700">
                <Icon name="ChatBubbleLeftRightIcon" size={16} />
                واتساب
              </a>
              <a href={mailHref} className="h-10 rounded-lg border border-border text-foreground text-sm font-semibold flex items-center justify-center gap-2 hover:bg-muted">
                <Icon name="EnvelopeIcon" size={16} />
                البريد
              </a>
            </div>
            <button type="button" onClick={reset} className="w-full h-10 rounded-lg text-sm font-semibold text-primary hover:bg-primary/5">
              إنشاء رابط آخر
            </button>
          </div>
        ) : (
          <form onSubmit={handleGenerate} className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">اسم المنتج / وصف الصفقة</label>
              <input className={inputCls} value={form.product_title} onChange={(e) => set('product_title', e.target.value)} placeholder="مثال: حديد تسليح 12 مم" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-foreground mb-1.5">سعر الوحدة *</label>
                <input type="number" min="0" step="0.01" className={inputCls} value={form.quoted_price} onChange={(e) => set('quoted_price', e.target.value)} required />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">العملة</label>
                <select className={inputCls} value={form.currency} onChange={(e) => set('currency', e.target.value)}>
                  <option value="USD">USD</option>
                  <option value="SAR">SAR</option>
                  <option value="YER">YER</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">الكمية *</label>
                <input type="number" min="1" step="1" className={inputCls} value={form.quantity} onChange={(e) => set('quantity', e.target.value)} required />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">مدة التسليم (أيام) *</label>
                <input type="number" min="1" step="1" className={inputCls} value={form.delivery_days} onChange={(e) => set('delivery_days', e.target.value)} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">شروط الشحن *</label>
                <select className={inputCls} value={form.shipping_type} onChange={(e) => set('shipping_type', e.target.value as FormState['shipping_type'])}>
                  <option value="port_warehouse">تسليم الميناء / المخزن</option>
                  <option value="door_to_door">باب المشتري (شامل الشحن)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">صلاحية الرابط (أيام)</label>
                <input type="number" min="1" max="90" className={inputCls} value={form.expires_in_days} onChange={(e) => set('expires_in_days', e.target.value)} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">شروط الدفع</label>
              <input className={inputCls} value={form.payment_terms} onChange={(e) => set('payment_terms', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">ملاحظات</label>
              <textarea rows={2} className={`${inputCls} h-auto py-2 resize-none`} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
            </div>

            {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">{error}</div>}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-primary text-primary-foreground rounded-xl font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> جاري الإنشاء...</>
              ) : (
                <><Icon name="LinkIcon" size={16} /> إنشاء الرابط</>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
