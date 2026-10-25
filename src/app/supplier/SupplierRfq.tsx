'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface SupplierRfqProps {
  userId: string;
}

interface RfqRow {
  id: string;
  buyer_id: string | null;
  product_name: string | null;
  custom_product_description: string | null;
  quantity: number | null;
  unit: string | null;
  specifications: string | null;
  target_price: number | null;
  currency: string | null;
  destination_country: string | null;
  destination_port: string | null;
  category: string | null;
  status: string | null;
  expires_at: string | null;
  urgency: string | null;
  created_at: string | null;
}

interface MyResponse {
  id: string;
  rfq_id: string;
  unit_price: number;
  currency: string;
  total_price: number | null;
  lead_time_days: number | null;
  delivery_terms: string | null;
  is_accepted: boolean | null;
  created_at: string | null;
  rfq: RfqRow | null;
}

interface ChatMsg {
  id: string;
  sender_id: string;
  message: string;
  created_at: string;
}

type TabKey = 'open' | 'submitted' | 'accepted' | 'archived';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'open', label: 'طلبات مفتوحة' },
  { key: 'submitted', label: 'عروضي المقدمة' },
  { key: 'accepted', label: 'عروض مقبولة' },
  { key: 'archived', label: 'الأرشيف والمنتهية' },
];

const CURRENCIES = ['YER', 'SAR', 'USD'];
const CURRENCY_LABEL: Record<string, string> = { YER: 'ريال يمني', SAR: 'ريال سعودي', USD: 'دولار أمريكي' };

const PROVINCES = [
  'صنعاء', 'عدن', 'تعز', 'حضرموت', 'مأرب', 'الحديدة', 'إب', 'ذمار', 'لحج', 'أبين',
  'شبوة', 'المهرة', 'سقطرى', 'عمران', 'حجة', 'صعدة', 'البيضاء', 'الجوف', 'ريمة', 'المحويت', 'الضالع',
];

const CATEGORY_OPTIONS = [
  'تغليف وبلاستيك', 'مواد غذائية', 'قطع غيار', 'مواد بناء', 'منسوجات وملابس',
  'أجهزة كهربائية', 'مواد تنظيف', 'أدوية ومستلزمات طبية', 'مواد خام', 'أخرى',
];

const SHIPPING_OPTIONS = ['تسليم باب المستودع', 'شحن على المشتري', 'توصيل شامل'];
const TIMELINE_OPTIONS = [
  { value: 'instant', label: 'تسليم فوري من المستودع' },
  { value: 'days', label: 'تجهيز خلال X أيام' },
];

const UNIT_AR: Record<string, string> = {
  carton: 'كرتون', cartons: 'كرتون', ctn: 'كرتون', box: 'كرتون', boxes: 'كرتون',
  piece: 'قطعة / حبة', pieces: 'قطعة / حبة', pcs: 'قطعة / حبة', pc: 'قطعة / حبة', unit: 'قطعة / حبة', units: 'قطعة / حبة', item: 'قطعة / حبة', items: 'قطعة / حبة',
  kg: 'كجم', kgs: 'كجم', kilogram: 'كجم', kilograms: 'كجم',
  ton: 'طن', tons: 'طن', tonne: 'طن', tonnes: 'طن', mt: 'طن',
  bale: 'بالة', bales: 'بالة',
  dozen: 'درزن', dozens: 'درزن', dz: 'درزن',
};

function unitAr(unit: string | null | undefined): string {
  if (!unit) return '';
  const key = unit.trim().toLowerCase();
  return UNIT_AR[key] ?? unit;
}

function fmtMoney(amount: number | null | undefined, currency: string | null | undefined): string {
  if (amount === null || amount === undefined) return 'غير محدد';
  const cur = currency || 'USD';
  return `${Number(amount).toLocaleString('en-US')} ${cur}`;
}

function isExpired(r: RfqRow | null): boolean {
  if (!r) return false;
  if (r.status === 'expired' || r.status === 'rejected') return true;
  if (r.expires_at && new Date(r.expires_at).getTime() < Date.now()) return true;
  return false;
}

function matchesProvince(r: RfqRow, province: string): boolean {
  if (!province) return true;
  return [r.destination_country, r.destination_port].filter(Boolean).some((v) => String(v).includes(province));
}

const CARD = 'bg-slate-900 border border-slate-800 rounded-2xl';
const INPUT =
  'w-full h-11 px-3 rounded-xl border border-slate-700 bg-slate-950 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500';
const SELECT_SM =
  'h-10 px-3 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500';

export default function SupplierRfq({ userId }: SupplierRfqProps) {
  const supabase = useMemo(() => createClient(), []);
  const [rfqs, setRfqs] = useState<RfqRow[]>([]);
  const [mine, setMine] = useState<MyResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<TabKey>('open');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [provinceFilter, setProvinceFilter] = useState('');
  const [selected, setSelected] = useState<RfqRow | null>(null);
  const [form, setForm] = useState({
    unit_price: '',
    currency: 'YER',
    timeline: 'instant',
    days: '',
    shipping: SHIPPING_OPTIONS[0],
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState('');

  const [chatOpen, setChatOpen] = useState(false);
  const [chatConvId, setChatConvId] = useState<string | null>(null);
  const [chatMsgs, setChatMsgs] = useState<ChatMsg[]>([]);
  const [chatText, setChatText] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const [chatError, setChatError] = useState('');

  const RFQ_COLS =
    'id, buyer_id, product_name, custom_product_description, quantity, unit, specifications, target_price, currency, destination_country, destination_port, category, status, expires_at, urgency, created_at';

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: err } = await supabase
        .from('rfq_requests')
        .select(RFQ_COLS)
        .eq('is_published', true)
        .order('created_at', { ascending: false })
        .limit(300);
      if (err) throw err;
      setRfqs((data as RfqRow[]) ?? []);

      const { data: resp, error: respErr } = await supabase
        .from('rfq_responses')
        .select('id, rfq_id, unit_price, currency, total_price, lead_time_days, delivery_terms, is_accepted, created_at')
        .eq('manufacturer_id', userId)
        .order('created_at', { ascending: false });
      if (respErr) throw respErr;
      const rfqMap = new Map(((data as RfqRow[]) ?? []).map((r) => [r.id, r]));
      const missingIds = (resp ?? []).map((r: any) => r.rfq_id).filter((id: string) => !rfqMap.has(id));
      if (missingIds.length > 0) {
        const { data: extra } = await supabase.from('rfq_requests').select(RFQ_COLS).in('id', missingIds);
        (extra as RfqRow[] | null)?.forEach((r) => rfqMap.set(r.id, r));
      }
      setMine(
        (resp ?? []).map((r: any) => ({
          ...r,
          rfq: rfqMap.get(r.rfq_id) ?? null,
        })) as MyResponse[],
      );
    } catch (e: any) {
      setError(e?.message || 'تعذر تحميل طلبات الأسعار');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, userId]);

  useEffect(() => {
    load();
  }, [load]);

  const respondedIds = useMemo(() => new Set(mine.map((m) => m.rfq_id)), [mine]);

  const categories = useMemo(() => {
    const set = new Set<string>(CATEGORY_OPTIONS);
    rfqs.forEach((r) => r.category && set.add(r.category));
    return Array.from(set);
  }, [rfqs]);

  const baseMatch = useCallback(
    (r: RfqRow | null): boolean => {
      if (!r) return false;
      if (categoryFilter && (r.category || '') !== categoryFilter) return false;
      if (!matchesProvince(r, provinceFilter)) return false;
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return [r.product_name, r.custom_product_description, r.specifications, r.destination_country, r.category]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    },
    [categoryFilter, provinceFilter, search],
  );

  const openList = useMemo(
    () => rfqs.filter((r) => !respondedIds.has(r.id) && !isExpired(r) && r.status !== 'accepted' && baseMatch(r)),
    [rfqs, respondedIds, baseMatch],
  );
  const submittedList = useMemo(
    () => mine.filter((m) => !m.is_accepted && m.rfq?.status !== 'accepted' && !isExpired(m.rfq) && baseMatch(m.rfq)),
    [mine, baseMatch],
  );
  const acceptedList = useMemo(
    () => mine.filter((m) => (m.is_accepted || m.rfq?.status === 'accepted') && baseMatch(m.rfq)),
    [mine, baseMatch],
  );
  const archivedList = useMemo(
    () => mine.filter((m) => !m.is_accepted && m.rfq?.status !== 'accepted' && isExpired(m.rfq) && baseMatch(m.rfq)),
    [mine, baseMatch],
  );
  const archivedOpen = useMemo(
    () => rfqs.filter((r) => !respondedIds.has(r.id) && isExpired(r) && baseMatch(r)),
    [rfqs, respondedIds, baseMatch],
  );

  const counts: Record<TabKey, number> = {
    open: openList.length,
    submitted: submittedList.length,
    accepted: acceptedList.length,
    archived: archivedList.length + archivedOpen.length,
  };

  const openForm = (rfq: RfqRow) => {
    setSelected(rfq);
    setForm({
      unit_price: '',
      currency: rfq.currency && CURRENCIES.includes(rfq.currency) ? rfq.currency : 'YER',
      timeline: 'instant',
      days: '',
      shipping: SHIPPING_OPTIONS[0],
      notes: '',
    });
    setFormError('');
    setChatOpen(false);
    setChatConvId(null);
    setChatMsgs([]);
    setChatText('');
    setChatError('');
  };

  const closeForm = () => {
    if (submitting) return;
    setSelected(null);
    setChatOpen(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    const price = parseFloat(form.unit_price);
    const days = form.timeline === 'instant' ? 0 : parseInt(form.days, 10);
    if (!(price > 0)) return setFormError('أدخل سعر وحدة صحيح');
    if (form.timeline === 'days' && !(days > 0)) return setFormError('أدخل عدد أيام التجهيز');
    setSubmitting(true);
    setFormError('');
    try {
      const qty = selected.quantity ?? 1;
      const timelineText = form.timeline === 'instant' ? 'تسليم فوري من المستودع' : `تجهيز خلال ${days} أيام`;
      const { error: insErr } = await supabase.from('rfq_responses').insert({
        rfq_id: selected.id,
        manufacturer_id: userId,
        unit_price: price,
        currency: form.currency,
        lead_time_days: form.timeline === 'instant' ? 1 : days,
        delivery_terms: form.shipping,
        notes: [timelineText, form.notes.trim()].filter(Boolean).join(' — '),
        total_price: price * qty,
      });
      if (insErr) throw insErr;
      setSelected(null);
      setChatOpen(false);
      setSuccess('تم إرسال عرض السعر بنجاح');
      setTimeout(() => setSuccess(''), 4000);
      await load();
      setTab('submitted');
    } catch (err: any) {
      setFormError(err?.message || 'فشل إرسال عرض السعر');
    } finally {
      setSubmitting(false);
    }
  };

  const loadChat = useCallback(
    async (convId: string) => {
      const { data } = await supabase
        .from('chat_messages')
        .select('id, sender_id, message, created_at')
        .eq('conversation_id', convId)
        .order('created_at', { ascending: true })
        .limit(100);
      setChatMsgs((data as ChatMsg[]) ?? []);
    },
    [supabase],
  );

  const openChat = async () => {
    if (!selected) return;
    if (!selected.buyer_id) {
      setChatError('لا يمكن بدء المحادثة: بيانات المشتري غير متاحة');
      setChatOpen(true);
      return;
    }
    setChatOpen(true);
    setChatBusy(true);
    setChatError('');
    try {
      const productKey = `rfq-${selected.id}`;
      const { data: existing } = await supabase
        .from('chat_conversations')
        .select('id')
        .eq('buyer_id', selected.buyer_id)
        .eq('manufacturer_id', userId)
        .eq('product_id', productKey)
        .maybeSingle();
      let convId = (existing as { id: string } | null)?.id ?? null;
      if (!convId) {
        const { data: created, error: cErr } = await supabase
          .from('chat_conversations')
          .insert({
            buyer_id: selected.buyer_id,
            manufacturer_id: userId,
            product_id: productKey,
            product_name: selected.product_name || selected.custom_product_description || 'طلب عرض سعر',
          })
          .select('id')
          .single();
        if (cErr) throw cErr;
        convId = (created as { id: string }).id;
      }
      setChatConvId(convId);
      await loadChat(convId);
    } catch (err: any) {
      setChatError(err?.message || 'تعذر فتح المحادثة');
    } finally {
      setChatBusy(false);
    }
  };

  const sendChat = async () => {
    const text = chatText.trim();
    if (!text || !chatConvId) return;
    setChatBusy(true);
    setChatError('');
    try {
      const { error: mErr } = await supabase.from('chat_messages').insert({
        conversation_id: chatConvId,
        sender_id: userId,
        sender_role: 'manufacturer',
        message: text,
      });
      if (mErr) throw mErr;
      await supabase
        .from('chat_conversations')
        .update({ last_message: text, last_message_at: new Date().toISOString() })
        .eq('id', chatConvId);
      setChatText('');
      await loadChat(chatConvId);
    } catch (err: any) {
      setChatError(err?.message || 'فشل إرسال الرسالة');
    } finally {
      setChatBusy(false);
    }
  };

  const renderRequestCard = (rfq: RfqRow, opts: { canQuote: boolean }) => {
    const title = rfq.product_name || rfq.custom_product_description || 'طلب بدون عنوان';
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
            <p className="text-slate-100 font-semibold">{rfq.quantity ?? '-'} {unitAr(rfq.unit)}</p>
          </div>
          <div className="bg-slate-950/70 rounded-lg px-2.5 py-2">
            <p className="text-slate-500">السعر المستهدف</p>
            <p className="text-slate-100 font-semibold">{rfq.target_price ? fmtMoney(rfq.target_price, rfq.currency) : 'غير محدد'}</p>
          </div>
        </div>
        <p className="text-xs text-slate-300 line-clamp-3 whitespace-pre-line">{rfq.specifications || 'لا توجد مواصفات مضافة'}</p>
        <div className="text-[11px] text-slate-400 flex gap-3 flex-wrap">
          {rfq.category && <span>{rfq.category}</span>}
          {rfq.destination_country && <span>{rfq.destination_country}</span>}
          {rfq.created_at && <span>{rfq.created_at.slice(0, 10)}</span>}
        </div>
        {opts.canQuote ? (
          <button
            type="button"
            onClick={() => openForm(rfq)}
            className="mt-auto h-10 rounded-xl text-sm font-bold transition-colors bg-purple-600 hover:bg-purple-500 text-white"
          >
            تقديم عرض سعر
          </button>
        ) : (
          <div className="mt-auto h-10 rounded-xl text-sm font-bold flex items-center justify-center bg-slate-800 text-slate-400 border border-slate-700">
            منتهي
          </div>
        )}
      </div>
    );
  };

  const renderResponseCard = (m: MyResponse, badge: { text: string; cls: string }) => {
    const r = m.rfq;
    const title = r?.product_name || r?.custom_product_description || 'طلب عرض سعر';
    return (
      <div key={m.id} className={`${CARD} p-4 flex flex-col gap-3`}>
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-bold text-white leading-snug break-words">{title}</h3>
          <span className={`text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap border ${badge.cls}`}>{badge.text}</span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-slate-950/70 rounded-lg px-2.5 py-2">
            <p className="text-slate-500">الكمية المطلوبة</p>
            <p className="text-slate-100 font-semibold">{r?.quantity ?? '-'} {unitAr(r?.unit)}</p>
          </div>
          <div className="bg-slate-950/70 rounded-lg px-2.5 py-2">
            <p className="text-slate-500">السعر المستهدف</p>
            <p className="text-slate-100 font-semibold">{r?.target_price ? fmtMoney(r.target_price, r.currency) : 'غير محدد'}</p>
          </div>
          <div className="bg-slate-950/70 rounded-lg px-2.5 py-2">
            <p className="text-slate-500">سعر وحدتي</p>
            <p className="text-emerald-300 font-semibold">{fmtMoney(m.unit_price, m.currency)}</p>
          </div>
          <div className="bg-slate-950/70 rounded-lg px-2.5 py-2">
            <p className="text-slate-500">الإجمالي</p>
            <p className="text-emerald-300 font-semibold">{fmtMoney(m.total_price, m.currency)}</p>
          </div>
        </div>
        <div className="text-[11px] text-slate-400 flex gap-3 flex-wrap">
          {m.delivery_terms && <span>{m.delivery_terms}</span>}
          {m.lead_time_days ? <span>تجهيز: {m.lead_time_days} يوم</span> : null}
          {m.created_at && <span>{m.created_at.slice(0, 10)}</span>}
        </div>
        {tab === 'accepted' && (
          <p className="text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2">
            العرض مقبول — جاهز لإنشاء الطلب والدفع عبر الضمان (Escrow)
          </p>
        )}
      </div>
    );
  };

  const emptyText: Record<TabKey, string> = {
    open: 'لا توجد طلبات أسعار مفتوحة حالياً',
    submitted: 'لم تقدّم أي عروض بانتظار مراجعة المشتري',
    accepted: 'لا توجد عروض مقبولة بعد',
    archived: 'لا توجد عناصر في الأرشيف',
  };

  const hasItems = counts[tab] > 0;

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3">
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

      <div className="flex gap-1 p-1 bg-slate-900 border border-slate-800 rounded-2xl overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`flex-1 min-w-fit whitespace-nowrap px-3 h-10 rounded-xl text-xs sm:text-sm font-bold transition-colors flex items-center justify-center gap-1.5 ${
              tab === t.key ? 'bg-purple-600 text-white' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <span>{t.label}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${tab === t.key ? 'bg-white/20' : 'bg-slate-800 text-slate-400'}`}>{counts[t.key]}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className={SELECT_SM} aria-label="تصفية حسب الفئة">
          <option value="">كل الفئات</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={provinceFilter} onChange={(e) => setProvinceFilter(e.target.value)} className={SELECT_SM} aria-label="تصفية حسب المحافظة">
          <option value="">كل المحافظات</option>
          {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {success && <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm rounded-xl px-3 py-2">{success}</div>}
      {error && <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-sm rounded-xl px-3 py-2">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !hasItems ? (
        <div className={`${CARD} p-10 text-center text-sm text-slate-400`}>{emptyText[tab]}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {tab === 'open' && openList.map((r) => renderRequestCard(r, { canQuote: true }))}
          {tab === 'submitted' &&
            submittedList.map((m) => renderResponseCard(m, { text: 'بانتظار مراجعة المشتري', cls: 'bg-amber-500/10 text-amber-300 border-amber-500/30' }))}
          {tab === 'accepted' &&
            acceptedList.map((m) => renderResponseCard(m, { text: 'مقبول', cls: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' }))}
          {tab === 'archived' && (
            <>
              {archivedList.map((m) => renderResponseCard(m, { text: 'منتهي', cls: 'bg-slate-700/40 text-slate-300 border-slate-600' }))}
              {archivedOpen.map((r) => renderRequestCard(r, { canQuote: false }))}
            </>
          )}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4" onClick={closeForm}>
          <div onClick={(e) => e.stopPropagation()} className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto p-5 space-y-4">
            <form onSubmit={submit} className="space-y-4">
              <div>
                <h4 className="text-base font-bold text-white">تقديم عرض سعر</h4>
                <p className="text-xs text-slate-400 mt-0.5 break-words">
                  {selected.product_name || selected.custom_product_description} · {selected.quantity ?? '-'} {unitAr(selected.unit)}
                </p>
                {selected.target_price ? (
                  <p className="text-xs text-slate-500 mt-0.5">السعر المستهدف: {fmtMoney(selected.target_price, selected.currency)}</p>
                ) : null}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs text-slate-400 mb-1">سعر الوحدة المعروض</label>
                  <input type="number" min="0" step="0.01" value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: e.target.value })} className={INPUT} required />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">العملة</label>
                  <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} className={INPUT}>
                    {CURRENCIES.map((c) => <option key={c} value={c}>{c} — {CURRENCY_LABEL[c]}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">موعد التسليم</label>
                <select value={form.timeline} onChange={(e) => setForm({ ...form, timeline: e.target.value })} className={INPUT}>
                  {TIMELINE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                {form.timeline === 'days' && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-slate-400 whitespace-nowrap">تجهيز خلال</span>
                    <input type="number" min="1" value={form.days} onChange={(e) => setForm({ ...form, days: e.target.value })} className={INPUT} placeholder="عدد الأيام" />
                    <span className="text-xs text-slate-400">أيام</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">مسؤولية الشحن</label>
                <select value={form.shipping} onChange={(e) => setForm({ ...form, shipping: e.target.value })} className={INPUT}>
                  {SHIPPING_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
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

              <button
                type="button"
                onClick={openChat}
                disabled={chatBusy}
                className="w-full h-11 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 text-sm font-bold border border-cyan-500/30"
              >
                💬 مفاوضة مباشرة مع المشتري
              </button>

              <div className="flex gap-2">
                <button type="submit" disabled={submitting} className="flex-1 h-11 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-60 text-white text-sm font-bold">
                  {submitting ? 'جاري الإرسال...' : 'إرسال العرض'}
                </button>
                <button type="button" onClick={closeForm} disabled={submitting} className="px-4 h-11 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm border border-slate-700">
                  إلغاء
                </button>
              </div>
            </form>

            {chatOpen && (
              <div className="border-t border-slate-800 pt-4 space-y-3">
                <h5 className="text-sm font-bold text-white">محادثة المشتري</h5>
                {chatError && <div className="text-red-300 text-xs bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{chatError}</div>}
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 h-40 overflow-y-auto space-y-2">
                  {chatBusy && chatMsgs.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center">جاري التحميل...</p>
                  ) : chatMsgs.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center">ابدأ التفاوض مع المشتري بإرسال رسالة</p>
                  ) : (
                    chatMsgs.map((m) => (
                      <div key={m.id} className={`flex ${m.sender_id === userId ? 'justify-start' : 'justify-end'}`}>
                        <div className={`max-w-[80%] px-3 py-1.5 rounded-xl text-xs break-words ${m.sender_id === userId ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-100'}`}>
                          {m.message}
                        </div>
                      </div>
                    ))
                  )}
                </div>
                {chatConvId && (
                  <div className="flex gap-2">
                    <input
                      value={chatText}
                      onChange={(e) => setChatText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          sendChat();
                        }
                      }}
                      placeholder="اكتب رسالتك..."
                      className={INPUT}
                    />
                    <button type="button" onClick={sendChat} disabled={chatBusy || !chatText.trim()} className="px-4 h-11 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-60 text-white text-sm font-bold whitespace-nowrap">
                      إرسال
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
