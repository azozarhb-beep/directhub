'use client';

import React, { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import { supplierUnitLabel } from './supplierUnits';
import { DELIVERY_TERMS_OPTIONS, type DeliveryTerms, type ProductRow } from './supplierProductTypes';

const INPUT =
  'w-full h-11 px-3 rounded-xl border border-slate-700 bg-slate-950 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500';
const LABEL = 'block text-xs font-bold text-slate-300 mb-1.5';

function Backdrop({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      {children}
    </div>
  );
}

interface QuickEditProps {
  userId: string;
  product: ProductRow;
  onClose: () => void;
  onSaved: () => void;
}

export function QuickEditModal({ userId, product, onClose, onSaved }: QuickEditProps) {
  const supabase = useMemo(() => createClient(), []);
  const [stock, setStock] = useState(String(product.stock_quantity ?? 0));
  const [wholesale, setWholesale] = useState(String(product.wholesale_price ?? ''));
  const [retail, setRetail] = useState(product.retail_price == null ? '' : String(product.retail_price));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const s = parseInt(stock, 10);
    const w = parseFloat(wholesale);
    const r = retail.trim() === '' ? null : parseFloat(retail);
    if (Number.isNaN(s) || s < 0 || Number.isNaN(w) || w < 0 || (r !== null && (Number.isNaN(r) || r < 0))) {
      setError('تأكد من صحة المخزون والأسعار.');
      return;
    }
    setSaving(true);
    const { error: err } = await supabase
      .from('supplier_products')
      .update({ stock_quantity: s, wholesale_price: w, retail_price: r })
      .eq('id', product.id)
      .eq('supplier_id', userId);
    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    toast.success('تم تحديث المخزون والسعر');
    onSaved();
  };

  return (
    <Backdrop>
      <form onSubmit={save} noValidate className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-5 space-y-4">
        <div>
          <h3 className="text-base font-black text-white">تعديل سريع</h3>
          <p className="text-xs text-slate-400 mt-1">{product.name_ar || product.name}</p>
        </div>
        <div>
          <label htmlFor="qe-stock" className={LABEL}>رصيد المخزون ({supplierUnitLabel(product.unit)})</label>
          <input id="qe-stock" type="number" min={0} className={INPUT} value={stock} onChange={(e) => setStock(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="qe-w" className={LABEL}>سعر الجملة ({product.currency})</label>
            <input id="qe-w" type="number" min={0} step="0.01" className={INPUT} value={wholesale} onChange={(e) => setWholesale(e.target.value)} />
          </div>
          <div>
            <label htmlFor="qe-r" className={LABEL}>سعر التجزئة</label>
            <input id="qe-r" type="number" min={0} step="0.01" className={INPUT} value={retail} onChange={(e) => setRetail(e.target.value)} />
          </div>
        </div>
        {error && <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-semibold rounded-xl px-4 py-3">{error}</div>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-11 px-5 rounded-xl border border-slate-700 text-slate-300 text-sm font-semibold hover:bg-slate-800">إلغاء</button>
          <button type="submit" disabled={saving} className="h-11 px-6 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-bold disabled:opacity-60">
            {saving ? 'جارٍ الحفظ...' : 'حفظ'}
          </button>
        </div>
      </form>
    </Backdrop>
  );
}

interface DealLinkProps {
  product: ProductRow;
  onClose: () => void;
}

const DEAL_API_TYPE: Record<DeliveryTerms, 'port_warehouse' | 'door_to_door'> = {
  exw_warehouse: 'port_warehouse',
  buyer_ships: 'port_warehouse',
  delivery_included: 'door_to_door',
};

export function DealLinkModal({ product, onClose }: DealLinkProps) {
  const [price, setPrice] = useState(String(product.wholesale_price ?? ''));
  const [qty, setQty] = useState(String(product.min_order_qty ?? 1));
  const [days, setDays] = useState('3');
  const [terms, setTerms] = useState<DeliveryTerms>((product.delivery_terms as DeliveryTerms) || 'exw_warehouse');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [link, setLink] = useState('');

  const title = product.name_ar || product.name;

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const p = Number(price);
    const q = Number(qty);
    const d = Number(days);
    if (!(p > 0) || !(q > 0) || !(d > 0)) {
      setError('يرجى إدخال سعر وكمية ومدة تسليم صحيحة');
      return;
    }
    const termsLabel = DELIVERY_TERMS_OPTIONS.find((o) => o.value === terms)?.label ?? '';
    setLoading(true);
    try {
      const res = await fetch('/api/quotes/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoted_price: p,
          currency: product.currency,
          quantity: Math.floor(q),
          delivery_days: Math.floor(d),
          shipping_type: DEAL_API_TYPE[terms],
          payment_terms: null,
          notes: `[الوحدة: ${supplierUnitLabel(product.unit)}] [شروط التسليم: ${termsLabel}]`,
          product_title: title,
          expires_in_days: 7,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.deal_path) throw new Error(data.error || 'تعذر إنشاء رابط الصفقة');
      setLink(`${window.location.origin}${data.deal_path}`);
      toast.success('تم إنشاء رابط الصفقة');
    } catch (err: any) {
      setError(err?.message || 'حدث خطأ غير متوقع');
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success('تم نسخ الرابط');
    } catch {
      toast.error('تعذر النسخ تلقائياً');
    }
  };

  const wa = `https://wa.me/?text=${encodeURIComponent(`رابط الصفقة المؤمّنة عبر DirectHub - الصفقة: ${title} - للدفع الآمن عبر الضمان المالي اضغط هنا: ${link}`)}`;

  return (
    <Backdrop>
      <form onSubmit={create} noValidate className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-5 space-y-4">
        <div>
          <h3 className="text-base font-black text-white">إنشاء رابط صفقة مباشر</h3>
          <p className="text-xs text-slate-400 mt-1">{title}</p>
        </div>
        {link ? (
          <div className="space-y-3">
            <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-xl px-3 py-2.5 text-sm font-semibold">
              تم إنشاء الرابط. الشروط مقفلة للعميل.
            </div>
            <div className="flex items-center gap-2">
              <input readOnly value={link} dir="ltr" className={`${INPUT} font-mono text-xs`} onFocus={(e) => e.currentTarget.select()} />
              <button type="button" onClick={copy} className="h-11 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-bold shrink-0">نسخ</button>
            </div>
            <a href={wa} target="_blank" rel="noopener noreferrer" className="h-10 rounded-xl bg-green-600 hover:bg-green-500 text-white text-sm font-bold flex items-center justify-center">
              مشاركة عبر واتساب
            </a>
            <button type="button" onClick={onClose} className="w-full h-10 rounded-xl text-sm font-bold text-slate-300 hover:bg-slate-800">إغلاق</button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="dl-price" className={LABEL}>سعر الوحدة ({product.currency})</label>
                <input id="dl-price" type="number" min={0} step="0.01" className={INPUT} value={price} onChange={(e) => setPrice(e.target.value)} />
              </div>
              <div>
                <label htmlFor="dl-qty" className={LABEL}>الكمية ({supplierUnitLabel(product.unit)})</label>
                <input id="dl-qty" type="number" min={1} className={INPUT} value={qty} onChange={(e) => setQty(e.target.value)} />
              </div>
              <div>
                <label htmlFor="dl-days" className={LABEL}>مدة التسليم (أيام)</label>
                <input id="dl-days" type="number" min={1} className={INPUT} value={days} onChange={(e) => setDays(e.target.value)} />
              </div>
              <div>
                <label htmlFor="dl-terms" className={LABEL}>شروط التسليم</label>
                <select id="dl-terms" className={INPUT} value={terms} onChange={(e) => setTerms(e.target.value as DeliveryTerms)}>
                  {DELIVERY_TERMS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>
            {error && <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-semibold rounded-xl px-4 py-3">{error}</div>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} className="h-11 px-5 rounded-xl border border-slate-700 text-slate-300 text-sm font-semibold hover:bg-slate-800">إلغاء</button>
              <button type="submit" disabled={loading} className="h-11 px-6 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-bold disabled:opacity-60">
                {loading ? 'جاري الإنشاء...' : 'إنشاء الرابط'}
              </button>
            </div>
          </>
        )}
      </form>
    </Backdrop>
  );
}
