'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ClipboardList,
  Package,
  Send,
  X,
  RefreshCw,
  Search,
  MapPin,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Inbox,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import RFQDetailsDrawer from './RFQDetailsDrawer';

interface IncomingRFQ {
  id: string;
  product_name: string | null;
  custom_product_description: string | null;
  quantity: number | null;
  unit: string | null;
  specifications: string | null;
  customization_notes: string | null;
  additional_notes: string | null;
  target_price: number | null;
  currency: string | null;
  destination_country: string | null;
  destination_port: string | null;
  payment_terms: string | null;
  incoterms: string | null;
  urgency: string | null;
  sector: string | null;
  category: string | null;
  status: string | null;
  created_at: string | null;
}

interface IncomingRFQsPanelProps {
  userId: string;
}

const CURRENCIES = ['USD', 'YER'];

const URGENCY_LABELS: Record<string, string> = {
  urgent: 'عاجل',
  express: 'عاجل جداً',
  standard: 'عادي',
};

export default function IncomingRFQsPanel({ userId }: IncomingRFQsPanelProps) {
  const supabase = useMemo(() => createClient(), []);
  const [rfqs, setRfqs] = useState<IncomingRFQ[]>([]);
  const [respondedIds, setRespondedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<IncomingRFQ | null>(null);
  const [detailsRfq, setDetailsRfq] = useState<IncomingRFQ | null>(null);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [form, setForm] = useState({ unit_price: '', currency: 'USD', lead_time_days: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [factoryCurrency, setFactoryCurrency] = useState<'USD' | 'YER' | null>(null);
  const [liveFlash, setLiveFlash] = useState('');

  useEffect(() => {
    let cancelled = false;
    if (!userId) return;
    (async () => {
      const { data } = await supabase
        .from('factory_registrations')
        .select('origin_type')
        .eq('user_id', userId)
        .maybeSingle();
      if (cancelled) return;
      const origin = (data as { origin_type?: string } | null)?.origin_type;
      setFactoryCurrency(origin === 'international' ? 'USD' : 'YER');
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, userId]);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const { data, error: rfqErr } = await supabase
        .from('rfq_requests')
        .select(
          'id, product_name, custom_product_description, quantity, unit, specifications, customization_notes, additional_notes, target_price, currency, destination_country, destination_port, payment_terms, incoterms, urgency, sector, category, status, created_at'
        )
        .eq('is_published', true)
        .in('status', ['pending', 'responded'])
        .order('created_at', { ascending: false })
        .limit(200);
      if (rfqErr) throw rfqErr;
      setRfqs((data as IncomingRFQ[]) ?? []);

      if (userId) {
        const { data: mine } = await supabase
          .from('rfq_responses')
          .select('rfq_id')
          .eq('manufacturer_id', userId);
        setRespondedIds(new Set((mine ?? []).map((r: { rfq_id: string }) => r.rfq_id)));
      }
    } catch (e: any) {
      setError(e?.message || 'تعذر تحميل طلبات الأسعار');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [supabase, userId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!userId) return;
    const flash = (msg: string) => {
      setLiveFlash(msg);
      setTimeout(() => setLiveFlash(''), 4000);
    };
    const channel = supabase
      .channel(`factory-rfq-inbox-${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'rfq_requests' }, (payload) => {
        const row = payload.new as IncomingRFQ & { is_published?: boolean };
        if (row?.is_published === false) return;
        setRfqs((prev) => (prev.some((r) => r.id === row.id) ? prev : [row, ...prev]));
        flash('وصل طلب سعر جديد');
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rfq_requests' }, (payload) => {
        const row = payload.new as IncomingRFQ & { is_published?: boolean };
        setRfqs((prev) => {
          if (row?.is_published === false || !['pending', 'responded'].includes(String(row?.status))) {
            return prev.filter((r) => r.id !== row.id);
          }
          return prev.map((r) => (r.id === row.id ? { ...r, ...row } : r));
        });
      })
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'rfq_responses', filter: `manufacturer_id=eq.${userId}` },
        (payload) => {
          const rfqId = (payload.new as { rfq_id?: string })?.rfq_id;
          if (rfqId) setRespondedIds((prev) => new Set(prev).add(rfqId));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, userId]);

  const dismissKey = `dh_dismissed_rfqs_${userId || 'anon'}`;

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(dismissKey);
      const arr = raw ? (JSON.parse(raw) as string[]) : [];
      setDismissedIds(new Set(Array.isArray(arr) ? arr : []));
    } catch {
      setDismissedIds(new Set());
    }
  }, [dismissKey]);

  const dismissRfq = (rfq: IncomingRFQ) => {
    setDismissedIds((prev) => {
      const next = new Set(prev).add(rfq.id);
      try {
        window.localStorage.setItem(dismissKey, JSON.stringify(Array.from(next)));
      } catch {
        // storage unavailable; dismissal stays in memory for this session
      }
      return next;
    });
    setDetailsRfq(null);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const visible = rfqs.filter(
      (r) =>
        !dismissedIds.has(r.id) &&
        (!factoryCurrency || String(r.currency || 'USD').toUpperCase() === factoryCurrency)
    );
    if (!q) return visible;
    return visible.filter((r) =>
      [r.product_name, r.custom_product_description, r.specifications, r.category, r.sector, r.destination_country]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [rfqs, search, dismissedIds, factoryCurrency]);

  const openForm = (rfq: IncomingRFQ) => {
    setDetailsRfq(null);
    setSelected(rfq);
    setForm({
      unit_price: '',
      currency: factoryCurrency || (rfq.currency === 'YER' ? 'YER' : 'USD'),
      lead_time_days: '',
      notes: '',
    });
    setFormError('');
  };

  const submitQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    const price = parseFloat(form.unit_price);
    const lead = parseInt(form.lead_time_days, 10);
    if (!price || price <= 0) {
      setFormError('أدخل سعر وحدة صحيح');
      return;
    }
    if (!lead || lead <= 0) {
      setFormError('أدخل مدة التسليم بالأيام');
      return;
    }
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
      setRespondedIds((prev) => new Set(prev).add(selected.id));
      setSelected(null);
      setSuccessMsg('تم إرسال عرض السعر بنجاح');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setFormError(err?.message || 'فشل إرسال عرض السعر');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-purple-600/20 border border-purple-500/30 flex items-center justify-center">
            <ClipboardList size={18} className="text-purple-300" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">طلبات الأسعار الواردة</h3>
            <p className="text-xs text-slate-400">Incoming RFQs · {filtered.length} طلب مفتوح</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث (مثال: طيارات)"
              className="bg-slate-800 border border-slate-700 rounded-lg pr-9 pl-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500 w-48"
            />
          </div>
          <button
            onClick={() => load()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm text-slate-300 border border-slate-700"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">تحديث</span>
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="flex items-center gap-2 bg-emerald-900/30 border border-emerald-700/40 text-emerald-300 text-sm rounded-lg px-3 py-2">
          <CheckCircle2 size={16} /> {successMsg}
        </div>
      )}
      {liveFlash && (
        <div className="flex items-center gap-2 bg-cyan-900/30 border border-cyan-700/40 text-cyan-300 text-sm rounded-lg px-3 py-2">
          <Inbox size={16} /> {liveFlash}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 bg-red-900/30 border border-red-700/40 text-red-300 text-sm rounded-lg px-3 py-2">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 size={22} className="animate-spin ml-2" /> جاري التحميل...
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-500 border border-dashed border-slate-700 rounded-xl">
          <Inbox size={36} className="mb-2" />
          <p className="text-sm">لا توجد طلبات أسعار مفتوحة حالياً</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((rfq) => {
            const title = rfq.product_name || rfq.custom_product_description || 'طلب بدون عنوان';
            const specs = rfq.specifications || rfq.customization_notes || rfq.additional_notes || '';
            const responded = respondedIds.has(rfq.id);
            return (
              <div
                key={rfq.id}
                role="button"
                tabIndex={0}
                aria-label={`تفاصيل طلب المشتري: ${title}`}
                onClick={() => setDetailsRfq(rfq)}
                onKeyDown={(e) => {
                  if (e.target !== e.currentTarget) return;
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setDetailsRfq(rfq);
                  }
                }}
                className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 flex flex-col gap-3 hover:border-purple-500/50 hover:bg-slate-800 transition-colors cursor-pointer focus:outline-none focus-visible:border-purple-500"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-slate-900 flex items-center justify-center flex-shrink-0">
                      <Package size={16} className="text-cyan-400" />
                    </div>
                    <h4 className="text-sm font-bold text-white leading-snug break-words">{title}</h4>
                  </div>
                  {rfq.urgency && rfq.urgency !== 'standard' && (
                    <span className="text-[10px] bg-red-500/20 text-red-300 border border-red-500/30 px-2 py-0.5 rounded-full whitespace-nowrap">
                      {URGENCY_LABELS[rfq.urgency] || rfq.urgency}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-900/70 rounded-lg px-2.5 py-2">
                    <p className="text-slate-500">الكمية</p>
                    <p className="text-slate-100 font-semibold">
                      {rfq.quantity ?? '-'} {rfq.unit || ''}
                    </p>
                  </div>
                  <div className="bg-slate-900/70 rounded-lg px-2.5 py-2">
                    <p className="text-slate-500">السعر المستهدف</p>
                    <p className="text-slate-100 font-semibold">
                      {rfq.target_price ? `${rfq.target_price} ${rfq.currency || 'USD'}` : 'غير محدد'}
                    </p>
                  </div>
                </div>

                <div className="text-xs">
                  <p className="text-slate-500 mb-1">المواصفات</p>
                  <p className="text-slate-300 line-clamp-3 whitespace-pre-line">{specs || 'لا توجد مواصفات مضافة'}</p>
                </div>

                <div className="flex items-center gap-3 text-[11px] text-slate-400 flex-wrap">
                  {rfq.destination_country && (
                    <span className="flex items-center gap-1">
                      <MapPin size={12} /> {rfq.destination_country}
                    </span>
                  )}
                  {rfq.incoterms && <span>{rfq.incoterms}</span>}
                  {rfq.created_at && (
                    <span className="flex items-center gap-1">
                      <Clock size={12} /> {rfq.created_at.slice(0, 10)}
                    </span>
                  )}
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openForm(rfq);
                  }}
                  disabled={responded}
                  className={`mt-auto flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    responded
                      ? 'bg-emerald-900/30 text-emerald-300 border border-emerald-700/40 cursor-not-allowed' :'bg-purple-600 hover:bg-purple-500 text-white'
                  }`}
                >
                  {responded ? <CheckCircle2 size={15} /> : <Send size={15} />}
                  {responded ? 'تم تقديم العرض' : 'تقديم عرض سعر'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      <RFQDetailsDrawer
        rfq={detailsRfq}
        responded={detailsRfq ? respondedIds.has(detailsRfq.id) : false}
        onClose={() => setDetailsRfq(null)}
        onSubmitQuote={openForm}
        onDismiss={dismissRfq}
      />

      {selected && (
        <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4" onClick={() => !submitting && setSelected(null)}>
          <form
            onSubmit={submitQuote}
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-5 space-y-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-base font-bold text-white">تقديم عرض سعر</h4>
                <p className="text-xs text-slate-400 mt-0.5 break-words">
                  {selected.product_name || selected.custom_product_description} · {selected.quantity ?? '-'} {selected.unit || ''}
                </p>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-xs text-slate-400 mb-1">سعر الوحدة</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.unit_price}
                  onChange={(e) => setForm({ ...form, unit_price: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-purple-500"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">العملة</label>
                <select
                  value={form.currency}
                  onChange={(e) => setForm({ ...form, currency: e.target.value })}
                  disabled={!!factoryCurrency}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-2 text-sm text-slate-100 focus:outline-none focus:border-purple-500"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">مدة التسليم (بالأيام)</label>
              <input
                type="number"
                min="1"
                value={form.lead_time_days}
                onChange={(e) => setForm({ ...form, lead_time_days: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-purple-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">ملاحظات</label>
              <textarea
                rows={3}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-purple-500 resize-none"
              />
            </div>

            {form.unit_price && selected.quantity ? (
              <p className="text-xs text-slate-400">
                الإجمالي التقديري:{' '}
                <span className="text-white font-semibold">
                  {(parseFloat(form.unit_price || '0') * selected.quantity).toLocaleString('en-US')} {form.currency}
                </span>
              </p>
            ) : null}

            {formError && (
              <div className="flex items-center gap-2 text-red-300 text-xs bg-red-900/30 border border-red-700/40 rounded-lg px-3 py-2">
                <AlertCircle size={14} /> {formError}
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-60 text-white text-sm font-semibold py-2.5 rounded-lg"
              >
                {submitting ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                إرسال العرض
              </button>
              <button
                type="button"
                onClick={() => setSelected(null)}
                disabled={submitting}
                className="px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded-lg border border-slate-700"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
