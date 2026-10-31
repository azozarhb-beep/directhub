'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';
import { DISPUTE_REASON_OPTIONS, getDisputeReasonMeta, normalizeDisputeReason } from '@/lib/disputeReasons';

interface SupplierDisputesProps {
  userId: string;
}

type StatusFilter = 'all' | 'needs_reply' | 'awaiting_buyer' | 'resolved' | 'escalated';

const OPEN_STATUSES = ['open', 'factory_reviewing'];
const CLOSED_STATUSES = ['buyer_accepted', 'resolved_no_refund', 'resolved_refund'];

const SHORT_REASON_LABELS: Record<string, string> = {
  quality_defect: 'عيوب جودة ومواصفات',
  delivery_delay: 'تأخير التسليم والشحن',
  quantity_shortage: 'نقص الكميات',
  transit_damage: 'تلف وأضرار النقل',
  payment_dispute: 'خلافات الدفع والأسعار',
};

const REASON_BADGE_DARK: Record<string, string> = {
  quality_defect: 'bg-rose-500/15 text-rose-300 border-rose-500/40',
  delivery_delay: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
  quantity_shortage: 'bg-orange-500/15 text-orange-300 border-orange-500/40',
  transit_damage: 'bg-violet-500/15 text-violet-300 border-violet-500/40',
  payment_dispute: 'bg-sky-500/15 text-sky-300 border-sky-500/40',
};

const QUICK_ACTIONS: { type: 'compensation' | 'replacement' | 'other'; label: string; icon: string; note: string; cls: string }[] = [
  {
    type: 'compensation',
    label: 'عرض تسوية مالية',
    icon: 'BanknotesIcon',
    note: 'عرض تسوية مالية: تعويض/خصم على قيمة الطلب بعد مراجعة الشكوى.',
    cls: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20',
  },
  {
    type: 'replacement',
    label: 'شحن بديل',
    icon: 'TruckIcon',
    note: 'شحن بديل: سيتم إرسال شحنة بديلة للكمية/الصنف المتضرر على نفقة المورد.',
    cls: 'border-blue-500/40 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20',
  },
  {
    type: 'other',
    label: 'رفض الشكوى وإرفاق تقرير الفحص',
    icon: 'DocumentCheckIcon',
    note: 'رفض الشكوى: البضاعة مطابقة للمواصفات المتفق عليها، مرفق تقرير فحص الجودة المعتمد قبل الشحن.',
    cls: 'border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20',
  },
];

const RESOLUTION_TYPES: { value: string; label: string; icon: string }[] = [
  { value: 'compensation', label: 'تعويض / استرداد', icon: 'BanknotesIcon' },
  { value: 'replacement', label: 'استبدال البضاعة', icon: 'ArrowPathIcon' },
  { value: 'reschedule', label: 'إعادة جدولة', icon: 'CalendarDaysIcon' },
  { value: 'other', label: 'حل آخر', icon: 'WrenchScrewdriverIcon' },
];

const CARD = 'bg-slate-900 border border-slate-800 rounded-2xl';

function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '—';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function formatDateOnly(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '—';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function formatAmount(total: unknown, currency?: string | null): string {
  const n = Number(total) || 0;
  return `${n.toLocaleString('en-US')} ${currency || 'USD'}`;
}

export default function SupplierDisputes({ userId }: SupplierDisputesProps) {
  const supabase = useMemo(() => createClient(), []);

  const [disputes, setDisputes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any | null>(null);
  const [reasonFilter, setReasonFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [resolutionType, setResolutionType] = useState('');
  const [resolutionNote, setResolutionNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  const fetchDisputes = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*, user_profiles!orders_user_id_fkey(full_name, email, company_name)')
        .eq('factory_user_id', userId)
        .not('dispute_status', 'is', null)
        .order('dispute_opened_at', { ascending: false });
      if (error) throw error;
      const rows = (data || []).filter((o: any) => o.dispute_status && o.dispute_status !== 'none');
      setDisputes(rows);
      setSelected((prev: any | null) => (prev ? rows.find((r: any) => r.id === prev.id) ?? null : prev));
    } catch (err) {
      console.error('Failed to fetch supplier disputes:', err);
    } finally {
      setLoading(false);
    }
  }, [userId, supabase]);

  useEffect(() => {
    fetchDisputes();
  }, [fetchDisputes]);

  const statusMatch = (d: any, f: StatusFilter) => {
    switch (f) {
      case 'needs_reply': return OPEN_STATUSES.includes(d.dispute_status);
      case 'awaiting_buyer': return d.dispute_status === 'factory_resolved';
      case 'resolved': return d.dispute_status === 'buyer_accepted' || d.dispute_status === 'resolved_no_refund';
      case 'escalated': return d.dispute_status === 'escalated';
      default: return true;
    }
  };

  const visible = disputes.filter(
    (d) => (reasonFilter === 'all' || normalizeDisputeReason(d.dispute_reason) === reasonFilter) && statusMatch(d, statusFilter)
  );
  const reasonCount = (code: string) => disputes.filter((d) => normalizeDisputeReason(d.dispute_reason) === code).length;
  const countBy = (f: StatusFilter) => disputes.filter((d) => statusMatch(d, f)).length;
  const needsReplyCount = countBy('needs_reply');

  const selectDispute = (order: any) => {
    setSelected(order);
    setMessage('');
    setResolutionType('');
    setResolutionNote('');
  };

  const quickResolve = (type: string, note: string) => {
    setResolutionType(type);
    setResolutionNote(note);
  };

  const handleResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !resolutionType || !resolutionNote.trim()) return;
    setSubmitting(true);
    setMessage('');
    try {
      const res = await fetch('/api/escrow/dispute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'factory_resolve',
          order_id: selected.id,
          resolution_type: resolutionType,
          resolution_note: resolutionNote,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'تعذر إرسال الحل');
      setMessage(data.message || 'تم إرسال الحل بنجاح');
      setResolutionType('');
      setResolutionNote('');
      setSelected((prev: any | null) => (prev ? { ...prev, dispute_status: 'factory_resolved', dispute_factory_resolution: resolutionNote } : prev));
      await fetchDisputes();
    } catch (err: any) {
      setMessage(`❌ ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const summaryCards: { key: StatusFilter; label: string; count: number; cls: string; active: string }[] = [
    { key: 'needs_reply', label: 'يحتاج ردًا', count: countBy('needs_reply'), cls: 'bg-orange-500/10 text-orange-300 border-orange-500/30', active: 'ring-2 ring-orange-400' },
    { key: 'awaiting_buyer', label: 'بانتظار المشتري', count: countBy('awaiting_buyer'), cls: 'bg-blue-500/10 text-blue-300 border-blue-500/30', active: 'ring-2 ring-blue-400' },
    { key: 'resolved', label: 'محلول', count: countBy('resolved'), cls: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30', active: 'ring-2 ring-emerald-400' },
    { key: 'escalated', label: 'مُصعَّد للإدارة', count: countBy('escalated'), cls: 'bg-red-500/10 text-red-300 border-red-500/30', active: 'ring-2 ring-red-400' },
  ];

  const sel = selected;
  const selIsOpen = sel ? OPEN_STATUSES.includes(sel.dispute_status) : false;
  const selReason = sel ? getDisputeReasonMeta(sel.dispute_reason) : null;

  return (
    <div className="space-y-5" dir="rtl">
      {/* Header */}
      <div className="bg-gradient-to-l from-orange-600 to-red-700 rounded-2xl p-5 text-white">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
            <Icon name="FlagIcon" size={24} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold">مركز فض النزاعات التجارية</h2>
            <p className="text-sm text-white/80">أدر شكاوى المشترين على طلباتك وقدّم حلولك المباشرة</p>
          </div>
          <div className="text-center shrink-0">
            <p className="text-2xl font-bold">{needsReplyCount}</p>
            <p className="text-xs text-white/70">يحتاج ردًا</p>
          </div>
        </div>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 bg-sky-500/10 border border-sky-500/30 rounded-xl px-4 py-3">
        <Icon name="InformationCircleIcon" size={18} className="text-sky-300 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-sky-200">نظام النزاعات ثنائي المستوى</p>
          <p className="text-xs text-sky-300/80 mt-0.5">المستوى الأول: تقدّم حلاً مباشرة للمشتري خلال 48 ساعة. إذا رفضه، يُصعَّد النزاع للإدارة ويُجمَّد الضمان المالي.</p>
        </div>
      </div>

      {/* Summary cards (also act as status filters) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {summaryCards.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setStatusFilter((prev) => (prev === s.key ? 'all' : s.key))}
            aria-pressed={statusFilter === s.key}
            className={`rounded-xl border p-4 text-start min-w-0 transition-all hover:brightness-125 ${s.cls} ${statusFilter === s.key ? s.active : ''}`}
          >
            <p className="text-2xl font-bold">{s.count}</p>
            <p className="text-xs font-medium mt-0.5 leading-snug break-words whitespace-normal">{s.label}</p>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-7 h-7 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {/* List */}
          <div className="lg:col-span-2 space-y-2 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="text-sm font-bold text-white">النزاعات الواردة ({visible.length})</p>
              <button
                type="button"
                onClick={fetchDisputes}
                className="shrink-0 text-xs text-cyan-300 border border-cyan-500/30 rounded-lg px-2.5 py-1 hover:bg-cyan-500/10 flex items-center gap-1"
              >
                <Icon name="ArrowPathIcon" size={12} /> تحديث
              </button>
            </div>

            <div className="flex flex-wrap gap-2 mb-2">
              <button
                type="button"
                onClick={() => setReasonFilter('all')}
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${reasonFilter === 'all' ? 'bg-cyan-500 text-slate-950 border-cyan-400' : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-cyan-500/50'}`}
              >
                الكل ({disputes.length})
              </button>
              {DISPUTE_REASON_OPTIONS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setReasonFilter(r.value)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${reasonFilter === r.value ? 'bg-cyan-500 text-slate-950 border-cyan-400' : `${REASON_BADGE_DARK[r.value]} hover:brightness-125`}`}
                >
                  {r.emoji} {SHORT_REASON_LABELS[r.value] ?? r.labelAr} ({reasonCount(r.value)})
                </button>
              ))}
            </div>

            {visible.length === 0 ? (
              <div className={`${CARD} p-8 text-center`}>
                <Icon name="CheckCircleIcon" size={28} className="text-emerald-400 mx-auto mb-2" />
                <p className="text-sm font-semibold text-white">لا توجد نزاعات حالياً</p>
                <p className="text-xs text-slate-400 mt-1">ستظهر هنا شكاوى المشترين عند فتح نزاع على أي طلب</p>
              </div>
            ) : (
              visible.map((order: any) => {
                const isOpen = OPEN_STATUSES.includes(order.dispute_status);
                const isResolved = order.dispute_status === 'factory_resolved';
                const isEscalated = order.dispute_status === 'escalated';
                const isClosed = CLOSED_STATUSES.includes(order.dispute_status);
                const isSelected = selected?.id === order.id;
                const rm = getDisputeReasonMeta(order.dispute_reason);
                return (
                  <button
                    key={order.id}
                    type="button"
                    onClick={() => selectDispute(order)}
                    className={`w-full text-start rounded-xl border-2 p-4 transition-all ${
                      isSelected ? 'border-cyan-400 bg-slate-900 shadow-sm'
                        : isOpen ? 'border-orange-500/40 bg-orange-500/5' : isEscalated ?'border-red-500/40 bg-red-500/5' : isResolved ?'border-blue-500/40 bg-blue-500/5' : isClosed ?'border-emerald-500/30 bg-emerald-500/5' :'border-slate-800 bg-slate-900 hover:border-orange-500/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-white font-mono truncate">{order.order_number}</p>
                        <p className="text-xs text-slate-400 truncate">
                          {order.user_profiles?.full_name || order.user_profiles?.company_name || 'المشتري'}
                        </p>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                          isOpen ? 'bg-orange-500/15 text-orange-300 border-orange-500/40' : isEscalated ?'bg-red-500/15 text-red-300 border-red-500/40' : isResolved ?'bg-blue-500/15 text-blue-300 border-blue-500/40' :'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                        }`}
                      >
                        {isOpen ? 'يحتاج رد' : isEscalated ? 'مُصعَّد' : isResolved ? 'انتظار المشتري' : 'مغلق'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      {rm ? (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${REASON_BADGE_DARK[rm.value]}`}>
                          {rm.emoji} {rm.labelAr}
                        </span>
                      ) : (
                        <p className="text-xs text-slate-400">{order.dispute_reason || 'عدم مطابقة المواصفات'}</p>
                      )}
                      <p className="text-sm font-bold text-white shrink-0">{formatAmount(order.total, order.currency)}</p>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Detail */}
          <div className={visible.length === 0 && !sel ? 'hidden' : 'lg:col-span-3 min-w-0'}>
            {!sel ? (
              <div className={`${CARD} p-8 text-center`}>
                <Icon name="CursorArrowRaysIcon" size={28} className="text-slate-500 mx-auto mb-2" />
                <p className="text-sm text-slate-400">اختر نزاعًا من القائمة لعرض التفاصيل</p>
              </div>
            ) : (
              <div className={`${CARD} p-5 space-y-4`}>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-white">طلب {sel.order_number}</h3>
                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                      selIsOpen ? 'bg-orange-500/15 text-orange-300 border-orange-500/40'
                        : sel.dispute_status === 'escalated' ? 'bg-red-500/15 text-red-300 border-red-500/40'
                        : sel.dispute_status === 'factory_resolved'? 'bg-blue-500/15 text-blue-300 border-blue-500/40' :'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                    }`}
                  >
                    {selIsOpen ? 'يحتاج ردك'
                      : sel.dispute_status === 'escalated' ? 'مُصعَّد للإدارة'
                      : sel.dispute_status === 'factory_resolved'? 'بانتظار رد المشتري' :'مغلق'}
                  </span>
                </div>

                {/* Buyer */}
                <div className="bg-slate-800/60 rounded-xl p-3 space-y-1">
                  <p className="text-xs font-semibold text-slate-400">المشتري</p>
                  <p className="text-sm font-semibold text-white">
                    {sel.user_profiles?.full_name || sel.user_profiles?.company_name || 'غير محدد'}
                  </p>
                  <p className="text-xs text-slate-400 break-all">{sel.user_profiles?.email || '—'}</p>
                </div>

                {/* Details */}
                <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4 space-y-2">
                  <p className="text-xs font-bold text-orange-300 flex items-center gap-2">
                    <Icon name="FlagIcon" size={14} />
                    تفاصيل النزاع
                  </p>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="text-slate-400">سبب النزاع</p>
                      <p className="font-bold text-orange-300 mt-0.5">
                        {selReason ? `${selReason.emoji} ${selReason.labelAr}` : sel.dispute_reason || 'عدم مطابقة المواصفات'}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400">تاريخ الإبلاغ</p>
                      <p className="font-semibold text-white mt-0.5">{formatDateTime(sel.dispute_opened_at)}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">المبلغ</p>
                      <p className="font-bold text-white mt-0.5">{formatAmount(sel.total, sel.currency)}</p>
                    </div>
                    {sel.expected_delivery_date && (
                      <div>
                        <p className="text-slate-400">التسليم المتوقع</p>
                        <p className="font-semibold text-white mt-0.5">{formatDateOnly(sel.expected_delivery_date)}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Escalated */}
                {sel.dispute_status === 'escalated' && (
                  <div className="bg-red-500/10 border-2 border-red-500/40 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <Icon name="ShieldExclamationIcon" size={20} className="text-red-300 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-bold text-red-200">تم تصعيد النزاع للإدارة</p>
                        <p className="text-xs text-red-300/90 mt-1">الإدارة ستراجع النزاع وتتخذ القرار النهائي، والضمان المالي مجمّد لحين الفصل.</p>
                        {sel.dispute_escalated_at && (
                          <p className="text-xs text-red-300 mt-1">تاريخ التصعيد: {formatDateTime(sel.dispute_escalated_at)}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Supplier already resolved */}
                {sel.dispute_status === 'factory_resolved' && sel.dispute_factory_resolution && (
                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
                    <p className="text-xs font-bold text-blue-200 mb-2 flex items-center gap-1.5">
                      <Icon name="CheckCircleIcon" size={13} />
                      الحل الذي أرسلته
                    </p>
                    <p className="text-sm text-white">{sel.dispute_factory_resolution}</p>
                    <p className="text-xs text-blue-300 mt-2">بانتظار قبول المشتري أو تصعيده للإدارة.</p>
                  </div>
                )}

                {/* Resolution form */}
                {selIsOpen && (
                  <form onSubmit={handleResolve} className="space-y-3">
                    <div className="border-t border-slate-800 pt-3">
                      <p className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                        <Icon name="WrenchScrewdriverIcon" size={15} className="text-cyan-300" />
                        تقديم حل للنزاع
                      </p>

                      {message && (
                        <div
                          className={`rounded-lg px-3 py-2 flex items-center gap-2 mb-3 text-xs font-medium ${
                            message.startsWith('❌')
                              ? 'bg-red-500/10 border border-red-500/40 text-red-300' :'bg-emerald-500/10 border border-emerald-500/40 text-emerald-300'
                          }`}
                        >
                          <Icon name={message.startsWith('❌') ? 'ExclamationCircleIcon' : 'CheckCircleIcon'} size={14} />
                          {message}
                        </div>
                      )}

                      <div className="mb-3">
                        <label className="block text-xs font-semibold text-slate-200 mb-2">إجراءات الحل السريع (المستوى الأول)</label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          {QUICK_ACTIONS.map((q) => (
                            <button
                              key={q.type + q.label}
                              type="button"
                              onClick={() => quickResolve(q.type, q.note)}
                              className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border-2 text-xs font-bold transition-colors ${q.cls}`}
                            >
                              <Icon name={q.icon} size={14} /> {q.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="mb-3">
                        <label className="block text-xs font-semibold text-slate-200 mb-2">
                          نوع الحل المقترح <span className="text-red-400">*</span>
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          {RESOLUTION_TYPES.map((opt) => {
                            const active = resolutionType === opt.value;
                            return (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => setResolutionType(opt.value)}
                                className={`flex items-center gap-2 p-3 rounded-xl border-2 text-start transition-all ${
                                  active ? 'border-cyan-400 bg-cyan-500/10' : 'border-slate-700 hover:border-cyan-500/50'
                                }`}
                              >
                                <Icon name={opt.icon} size={16} className={active ? 'text-cyan-300' : 'text-slate-400'} />
                                <span className={`text-xs font-semibold ${active ? 'text-cyan-200' : 'text-slate-200'}`}>{opt.label}</span>
                                {active && <Icon name="CheckCircleIcon" size={14} className="text-cyan-300 ms-auto shrink-0" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="mb-3">
                        <label className="block text-xs font-semibold text-slate-200 mb-1.5">
                          تفاصيل الحل <span className="text-red-400">*</span>
                        </label>
                        <textarea
                          value={resolutionNote}
                          onChange={(e) => setResolutionNote(e.target.value)}
                          rows={3}
                          required
                          placeholder="اشرح الحل المقترح بالتفصيل..."
                          className="w-full px-3 py-2.5 rounded-lg border border-slate-700 bg-slate-950 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/30 resize-none"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={submitting || !resolutionType || !resolutionNote.trim()}
                        className="w-full h-11 bg-cyan-500 text-slate-950 font-bold rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-cyan-400 transition-colors"
                      >
                        {submitting ? (
                          <>
                            <Icon name="ArrowPathIcon" size={15} className="animate-spin" /> جارٍ الإرسال...
                          </>
                        ) : (
                          <>
                            <Icon name="PaperAirplaneIcon" size={15} /> إرسال الحل
                          </>
                        )}
                      </button>
                      <p className="text-[10px] text-slate-400 text-center mt-1.5">سيتم إشعار المشتري فور إرسال الحل.</p>
                    </div>
                  </form>
                )}

                {/* Closed */}
                {['buyer_accepted', 'resolved_no_refund'].includes(sel.dispute_status) && (
                  <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex items-start gap-3">
                    <Icon name="CheckBadgeIcon" size={20} className="text-emerald-300 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-emerald-200">تم إغلاق النزاع بنجاح</p>
                      <p className="text-xs text-emerald-300/90 mt-0.5">
                        {sel.dispute_status === 'buyer_accepted' ? 'قبل المشتري الحل المقترح.' : 'أغلقت الإدارة النزاع دون استرداد.'}
                      </p>
                    </div>
                  </div>
                )}
                {sel.dispute_status === 'resolved_refund' && (
                  <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex items-start gap-3">
                    <Icon name="CheckBadgeIcon" size={20} className="text-emerald-300 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-emerald-200">تم إغلاق النزاع باسترداد للمشتري</p>
                      <p className="text-xs text-emerald-300/90 mt-0.5">قررت الإدارة استرداد المبلغ للمشتري.</p>
                    </div>
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
