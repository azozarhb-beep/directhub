'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface SupplierRfqProps {
  userId: string;
}

interface RfqRow {
  id: string;
  product_name: string | null;
  custom_product_description: string | null;
  quantity: number | null;
  unit: string | null;
  specifications: string | null;
  target_price: number | null;
  currency: string | null;
  destination_country: string | null;
  urgency: string | null;
  created_at: string | null;
}

const CURRENCIES = ['YER', 'SAR', 'USD'];
const CARD = 'bg-slate-900 border border-slate-800 rounded-2xl';
const INPUT =
  'w-full h-11 px-3 rounded-xl border border-slate-700 bg-slate-950 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500';

export default function SupplierRfq({ userId }: SupplierRfqProps) {
  const supabase = useMemo(() => createClient(), []);
  const [rfqs, setRfqs] = useState<RfqRow[]>([]);
  const [responded, setResponded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<RfqRow | null>(null);
  const [form, setForm] = useState({ unit_price: '', currency: 'YER', lead_time_days: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: err } = await supabase
        .from('rfq_requests')
        .select('id, product_name, custom_product_description, quantity, unit, specifications, target_price, currency, destination_country, urgency, created_at')
        .eq('is_published', true)
        .in('status', ['pending', 'responded'])
        .order('created_at', { ascending: false })
        .limit(200);
      if (err) throw err;
      setRfqs((data as RfqRow[]) ?? []);
      const { data: mine } = await supabase.from('rfq_responses').select('rfq_id').eq('manufacturer_id', userId);
      setResponded(new Set((mine ?? []).map((r: { rfq_id: string }) => r.rfq_id)));
    } catch (e: any) {
      setError(e?.message || 'تعذر تحميل طلبات الأسعار');
    } finally {
      setLoading(false);
    }
  }, [supabase, userId]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rfqs;
    return rfqs.filter((r) =>
      [r.product_name, r.custom_product_description, r.specifications, r.destination_country]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [rfqs, search]);

  const openForm = (rfq: RfqRow) => {
    setSelected(rfq);
    setForm({ unit_price: '', currency: rfq.currency || 'YER', lead_time_days: '', notes: '' });
    setFormError('');
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    const price = parseFloat(form.unit_price);
    const lead = parseInt(form.lead_time_days, 10);
    if (!(price > 0)) return setFormError('أدخل سعر وحدة صحيح');
    if (!(lead > 0)) return setFormError('أدخل مدة التسليم بالأيام');
    setSubmitting(true);
    setFormError('');
    try {
      const qty = selected.quantity ?? 1;
      const { error: insErr } = await supabase.from('rfq_responses').insert({
        rfq_id: selected.id,
        manufacturer_id: userId,
        unit_price: price,
        currency: form.currency,
        lead_time_days: lead,
        notes: form.notes.trim(),
        total_price: price * qty,
      });
      if (insErr) throw insErr;
      setResponded((prev) => new Set(prev).add(selected.id));
      setSelected(null);
      setSuccess('تم إرسال عرض السعر بنجاح');
      setTimeout(() => setSuccess(''), 4000);
    } catch (err: any) {
      setFormError(err?.message || 'فشل إرسال عرض السعر');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-base font-black text-white">عروض الأسعار والتوريد</h2>
          <p className="text-xs text-slate-400">{filtered.length} طلب مفتوح</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث في الطلبات"
            className="h-10 px-3 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 w-44"
          />
          <button type="button" onClick={load} className="h-10 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm text-slate-200 border border-slate-700">
            تحديث
          </button>
        </div>
      </div>

      {success && <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm rounded-xl px-3 py-2">{success}</div>}
      {error && <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-sm rounded-xl px-3 py-2">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className={`${CARD} p-10 text-center text-sm text-slate-400`}>لا توجد طلبات أسعار مفتوحة حالياً</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((rfq) => {
            const title = rfq.product_name || rfq.custom_product_description || 'طلب بدون عنوان';
            const done = responded.has(rfq.id);
            return (
              <div key={rfq.id} className={`${CARD} p-4 flex flex-col gap-3`}>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-bold text-white leading-snug break-words">{title}</h3>
                  {rfq.urgency && rfq.urgency !== 'standard' && (
                    <span className="text-[10px] bg-red-500/20 text-red-300 border border-red-500/30 px-2 py-0.5 rounded-full whitespace-nowrap">عاجل</span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-950/70 rounded-lg px-2.5 py-2">
                    <p className="text-slate-500">الكمية</p>
                    <p className="text-slate-100 font-semibold">{rfq.quantity ?? '-'} {rfq.unit || ''}</p>
                  </div>
                  <div className="bg-slate-950/70 rounded-lg px-2.5 py-2">
                    <p className="text-slate-500">السعر المستهدف</p>
                    <p className="text-slate-100 font-semibold">{rfq.target_price ? `${rfq.target_price} ${rfq.currency || ''}` : 'غير محدد'}</p>
                  </div>
                </div>
                <p className="text-xs text-slate-300 line-clamp-3 whitespace-pre-line">{rfq.specifications || 'لا توجد مواصفات مضافة'}</p>
                <div className="text-[11px] text-slate-400 flex gap-3 flex-wrap">
                  {rfq.destination_country && <span>{rfq.destination_country}</span>}
                  {rfq.created_at && <span>{rfq.created_at.slice(0, 10)}</span>}
                </div>
                <button
                  type="button"
                  onClick={() => openForm(rfq)}
                  disabled={done}
                  className={`mt-auto h-10 rounded-xl text-sm font-bold transition-colors ${done ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-500 text-white'}`}
                >
                  {done ? 'تم تقديم العرض' : 'تقديم عرض سعر'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4" onClick={() => !submitting && setSelected(null)}>
          <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-5 space-y-4">
            <div>
              <h4 className="text-base font-bold text-white">تقديم عرض سعر</h4>
              <p className="text-xs text-slate-400 mt-0.5 break-words">
                {selected.product_name || selected.custom_product_description} · {selected.quantity ?? '-'} {selected.unit || ''}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-xs text-slate-400 mb-1">سعر الوحدة</label>
                <input type="number" min="0" step="0.01" value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: e.target.value })} className={INPUT} required />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">العملة</label>
                <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} className={INPUT}>
                  {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">مدة التسليم (بالأيام)</label>
              <input type="number" min="1" value={form.lead_time_days} onChange={(e) => setForm({ ...form, lead_time_days: e.target.value })} className={INPUT} required />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">ملاحظات</label>
              <textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-slate-700 bg-slate-950 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none" />
            </div>
            {form.unit_price && selected.quantity ? (
              <p className="text-xs text-slate-400">
                الإجمالي التقديري: <span className="text-white font-semibold">{(parseFloat(form.unit_price || '0') * selected.quantity).toLocaleString('en-US')} {form.currency}</span>
              </p>
            ) : null}
            {formError && <div className="text-red-300 text-xs bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{formError}</div>}
            <div className="flex gap-2">
              <button type="submit" disabled={submitting} className="flex-1 h-11 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-60 text-white text-sm font-bold">
                {submitting ? 'جاري الإرسال...' : 'إرسال العرض'}
              </button>
              <button type="button" onClick={() => setSelected(null)} disabled={submitting} className="px-4 h-11 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm border border-slate-700">
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
