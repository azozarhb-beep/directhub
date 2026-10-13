'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';
import toast from 'react-hot-toast';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DisputeTicket {
  id: string;
  shipment_id: string | null;
  order_id: string | null;
  partner_id: string;
  buyer_id: string | null;
  opened_by: string;
  opened_by_user_id: string | null;
  dispute_reason: string;
  dispute_reason_other: string | null;
  description: string;
  evidence_url: string | null;
  evidence_filename: string | null;
  disputed_amount: number | null;
  currency: string;
  escrow_frozen: boolean;
  escrow_frozen_at: string | null;
  status: string;
  admin_resolution_note: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  release_amount: number | null;
  refund_amount: number | null;
  deduction_amount: number | null;
  created_at: string;
  updated_at: string;
  orders?: { order_number: string | null; total: number; buyer_id: string | null } | null;
  logistics_shipments?: { shipment_number: string | null } | null;
  logistics_partners?: { company_name: string } | null;
  opener?: { full_name: string; email: string } | null;
}

const DISPUTE_REASONS: Record<string, string> = {
  cargo_damage:       'تلف البضاعة',
  weight_shortage:    'نقص في الوزن / الكمية',
  pricing_dispute:    'خلاف على التسعيرة',
  unjustified_delay:  'تأخير غير مبرر',
  missing_items:      'بضاعة مفقودة',
  other:              'سبب آخر',
};

const STATUS_META: Record<string, { label: string; color: string; icon: string }> = {
  open:                        { label: 'مفتوح',                    color: 'bg-red-50 text-red-700 border-red-200',         icon: 'ExclamationCircleIcon' },
  under_review:                { label: 'قيد المراجعة',             color: 'bg-blue-50 text-blue-700 border-blue-200',      icon: 'MagnifyingGlassIcon' },
  resolved_full_release:       { label: 'إفراج كامل للمكتب',        color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: 'CheckCircleIcon' },
  resolved_partial_deduction:  { label: 'خصم تعويض جزئي',           color: 'bg-amber-50 text-amber-700 border-amber-200',   icon: 'MinusCircleIcon' },
  resolved_full_refund:        { label: 'استرداد كامل للعميل',       color: 'bg-purple-50 text-purple-700 border-purple-200', icon: 'ArrowUturnLeftIcon' },
  closed:                      { label: 'مغلق',                     color: 'bg-gray-50 text-gray-600 border-gray-200',      icon: 'XCircleIcon' },
};

type ResolutionType = 'resolved_full_release' | 'resolved_partial_deduction' | 'resolved_full_refund';

const RESOLUTION_OPTIONS: { value: ResolutionType; label: string; desc: string; color: string; icon: string }[] = [
  {
    value: 'resolved_full_release',
    label: 'إفراج كامل للمكتب اللوجستي',
    desc: 'تحرير المبلغ الكامل لصالح الشريك اللوجستي',
    color: 'border-emerald-500 bg-emerald-500/10 text-emerald-300',
    icon: 'CheckCircleIcon',
  },
  {
    value: 'resolved_partial_deduction',
    label: 'خصم تعويض جزئي',
    desc: 'خصم مبلغ تعويض من الشريك وإفراج الباقي',
    color: 'border-amber-500 bg-amber-500/10 text-amber-300',
    icon: 'MinusCircleIcon',
  },
  {
    value: 'resolved_full_refund',
    label: 'استرداد كامل للعميل',
    desc: 'إعادة المبلغ الكامل للمشتري',
    color: 'border-purple-500 bg-purple-500/10 text-purple-300',
    icon: 'ArrowUturnLeftIcon',
  },
];

// ─── Resolution Modal ─────────────────────────────────────────────────────────

function ResolutionModal({
  ticket,
  adminUserId,
  onClose,
  onResolved,
}: {
  ticket: DisputeTicket;
  adminUserId: string;
  onClose: () => void;
  onResolved: () => void;
}) {
  const supabase = createClient();
  const [resolution, setResolution] = useState<ResolutionType | ''>('');
  const [note, setNote] = useState('');
  const [deductionAmount, setDeductionAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const totalAmount = ticket.disputed_amount || ticket.orders?.total || 0;

  const handleResolve = async () => {
    if (!resolution) { toast.error('يرجى اختيار نوع الحسم'); return; }
    if (!note.trim()) { toast.error('يرجى كتابة سبب القرار'); return; }
    if (resolution === 'resolved_partial_deduction' && !deductionAmount) {
      toast.error('يرجى تحديد مبلغ الخصم');
      return;
    }

    setSubmitting(true);
    try {
      const deduction = resolution === 'resolved_partial_deduction' ? parseFloat(deductionAmount) : 0;
      const releaseAmt = resolution === 'resolved_full_release'
        ? totalAmount
        : resolution === 'resolved_partial_deduction'
          ? totalAmount - deduction
          : 0;
      const refundAmt = resolution === 'resolved_full_refund'
        ? totalAmount
        : resolution === 'resolved_partial_deduction'
          ? deduction
          : 0;

      // Update dispute ticket
      const { error } = await supabase
        .from('logistics_dispute_tickets')
        .update({
          status: resolution,
          admin_resolution_note: note,
          resolved_by: adminUserId,
          resolved_at: new Date().toISOString(),
          escrow_frozen: false,
          release_amount: releaseAmt,
          refund_amount: refundAmt,
          deduction_amount: deduction,
          updated_at: new Date().toISOString(),
        })
        .eq('id', ticket.id);

      if (error) throw error;

      // Update order status back to normal if fully resolved
      if (ticket.order_id) {
        const newOrderStatus = resolution === 'resolved_full_refund' ? 'refunded' : 'delivered';
        await supabase
          .from('orders')
          .update({ status: newOrderStatus, updated_at: new Date().toISOString() })
          .eq('id', ticket.order_id);
      }

      // Notify logistics partner
      if (ticket.partner_id) {
        await supabase.from('notifications').insert({
          user_id: null,
          type: 'dispute_resolved',
          title: 'تم حسم النزاع',
          body: `تم حسم النزاع من قِبل الإدارة: ${STATUS_META[resolution]?.label || resolution}. ${note}`,
          is_read: false,
          metadata: { dispute_id: ticket.id, resolution, partner_id: ticket.partner_id },
        });
      }

      toast.success('تم حسم النزاع وتحديث الأرصدة بنجاح');
      onResolved();
      onClose();
    } catch (err: any) {
      toast.error(err?.message || 'فشل حسم النزاع');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 bg-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <Icon name="ScaleIcon" size={18} className="text-amber-400" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">حسم النزاع — التحكيم الإداري</h3>
              <p className="text-xs text-slate-400">
                {DISPUTE_REASONS[ticket.dispute_reason] || ticket.dispute_reason}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-slate-700 flex items-center justify-center">
            <Icon name="XMarkIcon" size={16} className="text-slate-400" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Dispute Summary */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-3 space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">الشريك اللوجستي:</span>
              <span className="text-white font-medium">{ticket.logistics_partners?.company_name || '—'}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">المبلغ المتنازع عليه:</span>
              <span className="text-white font-bold">${totalAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">وصف النزاع:</span>
              <span className="text-white text-right max-w-[60%]">{ticket.description}</span>
            </div>
            {ticket.evidence_url && (
              <a
                href={ticket.evidence_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 mt-1"
              >
                <Icon name="PaperClipIcon" size={12} />
                عرض الدليل المرفق
              </a>
            )}
          </div>

          {/* Resolution Options */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              قرار الحسم <span className="text-red-400">*</span>
            </label>
            <div className="space-y-2">
              {RESOLUTION_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setResolution(opt.value)}
                  className={`w-full flex items-start gap-3 px-4 py-3 rounded-xl border text-right transition-all ${
                    resolution === opt.value
                      ? opt.color
                      : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  <Icon name={opt.icon as any} size={18} className="mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-bold">{opt.label}</p>
                    <p className="text-xs opacity-70 mt-0.5">{opt.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Deduction amount for partial */}
          {resolution === 'resolved_partial_deduction' && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                مبلغ الخصم (USD) <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                value={deductionAmount}
                onChange={e => setDeductionAmount(e.target.value)}
                placeholder="0.00"
                min="0"
                max={totalAmount}
                step="0.01"
                className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
              {deductionAmount && parseFloat(deductionAmount) > 0 && (
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div className="px-3 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                    <p className="text-emerald-400 font-semibold">يُفرج للشريك</p>
                    <p className="text-emerald-300 font-bold">${(totalAmount - parseFloat(deductionAmount)).toFixed(2)}</p>
                  </div>
                  <div className="px-3 py-2 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                    <p className="text-purple-400 font-semibold">يُعاد للعميل</p>
                    <p className="text-purple-300 font-bold">${parseFloat(deductionAmount).toFixed(2)}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Resolution Note */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              سبب القرار / ملاحظات الإدارة <span className="text-red-400">*</span>
            </label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="اكتب سبب القرار وأي ملاحظات إضافية..."
              rows={3}
              className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 resize-none"
            />
          </div>

          {/* Auto-update notice */}
          <div className="flex items-start gap-2 px-3 py-2.5 bg-blue-500/10 border border-blue-500/30 rounded-xl">
            <Icon name="BoltIcon" size={14} className="text-blue-400 mt-0.5 shrink-0" />
            <p className="text-xs text-blue-300">
              سيتم تحديث أرصدة المحافظ تلقائياً وإرسال إشعار للطرفين فور تأكيد القرار.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-700 bg-slate-800 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-600 text-slate-300 text-sm font-medium hover:bg-slate-700 transition-colors"
          >
            إلغاء
          </button>
          <button
            onClick={handleResolve}
            disabled={submitting || !resolution || !note.trim()}
            className="flex-1 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {submitting ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Icon name="ScaleIcon" size={14} />
            )}
            تأكيد القرار وتحديث الأرصدة
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Admin Panel ─────────────────────────────────────────────────────────

export default function AdminDisputeArbitrationPanel({ adminUserId }: { adminUserId: string }) {
  const supabase = createClient();
  const [tickets, setTickets] = useState<DisputeTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'open' | 'under_review' | 'resolved'>('open');
  const [selectedTicket, setSelectedTicket] = useState<DisputeTicket | null>(null);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('logistics_dispute_tickets')
        .select(`
          *,
          orders(order_number, total, buyer_id),
          logistics_shipments(shipment_number),
          logistics_partners(company_name),
          opener:user_profiles!logistics_dispute_tickets_opened_by_user_id_fkey(full_name, email)
        `)
        .order('created_at', { ascending: false });

      if (filter === 'open') query = query.eq('status', 'open');
      else if (filter === 'under_review') query = query.eq('status', 'under_review');
      else if (filter === 'resolved') query = query.in('status', ['resolved_full_release', 'resolved_partial_deduction', 'resolved_full_refund', 'closed']);

      const { data } = await query;
      setTickets(data || []);
    } catch {
      setTickets([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();

    const channel = supabase
      .channel('admin-disputes-all')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'logistics_dispute_tickets',
      }, () => fetchTickets())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [filter]);

  const markUnderReview = async (ticketId: string) => {
    await supabase
      .from('logistics_dispute_tickets')
      .update({ status: 'under_review', updated_at: new Date().toISOString() })
      .eq('id', ticketId);
    toast.success('تم تحديث حالة النزاع إلى "قيد المراجعة"');
    fetchTickets();
  };

  const openCount = tickets.filter(t => t.status === 'open').length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
            <Icon name="ScaleIcon" size={20} className="text-amber-400" />
          </div>
          <div>
            <h2 className="font-bold text-white">نافذة التحكيم وإغلاق النزاعات</h2>
            <p className="text-xs text-slate-400">
              {openCount > 0 ? (
                <span className="text-red-400 font-semibold">{openCount} نزاع يتطلب مراجعة فورية</span>
              ) : 'لا توجد نزاعات مفتوحة'}
            </p>
          </div>
        </div>
        {openCount > 0 && (
          <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold bg-red-500 text-white animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-white" />
            {openCount} جديد
          </span>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'open',         label: 'مفتوحة' },
          { key: 'under_review', label: 'قيد المراجعة' },
          { key: 'resolved',     label: 'محسومة' },
          { key: 'all',          label: 'الكل' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key as typeof filter)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === tab.key
                ? 'bg-amber-500 text-white' :'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tickets */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-12">
          <Icon name="CheckCircleIcon" size={40} className="text-emerald-500 mx-auto mb-3" />
          <p className="text-slate-300 font-semibold">لا توجد نزاعات في هذه الفئة</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map(ticket => {
            const meta = STATUS_META[ticket.status] || STATUS_META['open'];
            const reasonLabel = DISPUTE_REASONS[ticket.dispute_reason] || ticket.dispute_reason;
            const isOpen = ticket.status === 'open' || ticket.status === 'under_review';

            return (
              <div
                key={ticket.id}
                className={`bg-slate-800 border rounded-xl p-4 space-y-3 ${
                  ticket.status === 'open' ? 'border-red-500/50' : 'border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${meta.color}`}>
                        <Icon name={meta.icon as any} size={10} />
                        {meta.label}
                      </span>
                      {ticket.escrow_frozen && isOpen && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          <Icon name="LockClosedIcon" size={10} />
                          Escrow مجمّد
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-bold text-white">{reasonLabel}</p>
                    <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{ticket.description}</p>
                    <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-500">
                      <span>🏢 {ticket.logistics_partners?.company_name || '—'}</span>
                      {ticket.orders?.order_number && (
                        <span>📦 طلب #{ticket.orders.order_number}</span>
                      )}
                      <span>📅 {new Date(ticket.created_at).toLocaleDateString('ar-SA')}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    {ticket.disputed_amount && (
                      <p className="text-sm font-bold text-white">${ticket.disputed_amount.toFixed(2)}</p>
                    )}
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {ticket.opened_by === 'logistics_partner' ? 'الشريك' : ticket.opened_by === 'buyer' ? 'المشتري' : 'الإدارة'}
                    </p>
                  </div>
                </div>

                {/* Evidence */}
                {ticket.evidence_url && (
                  <a
                    href={ticket.evidence_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300"
                  >
                    <Icon name="PaperClipIcon" size={12} />
                    عرض الدليل المرفق
                  </a>
                )}

                {/* Resolution info */}
                {ticket.admin_resolution_note && (
                  <div className="px-3 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                    <p className="text-xs font-semibold text-emerald-400 mb-0.5">قرار الإدارة:</p>
                    <p className="text-xs text-emerald-300">{ticket.admin_resolution_note}</p>
                    <div className="flex gap-3 mt-1.5 text-[10px] text-emerald-500">
                      {ticket.release_amount != null && ticket.release_amount > 0 && (
                        <span>✅ أُفرج: ${ticket.release_amount.toFixed(2)}</span>
                      )}
                      {ticket.refund_amount != null && ticket.refund_amount > 0 && (
                        <span>↩️ استُرد: ${ticket.refund_amount.toFixed(2)}</span>
                      )}
                      {ticket.deduction_amount != null && ticket.deduction_amount > 0 && (
                        <span>➖ خُصم: ${ticket.deduction_amount.toFixed(2)}</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Actions */}
                {isOpen && (
                  <div className="flex gap-2 pt-1">
                    {ticket.status === 'open' && (
                      <button
                        onClick={() => markUnderReview(ticket.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors"
                      >
                        <Icon name="MagnifyingGlassIcon" size={12} />
                        بدء المراجعة
                      </button>
                    )}
                    <button
                      onClick={() => setSelectedTicket(ticket)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold transition-colors"
                    >
                      <Icon name="ScaleIcon" size={12} />
                      حسم النزاع
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Resolution Modal */}
      {selectedTicket && (
        <ResolutionModal
          ticket={selectedTicket}
          adminUserId={adminUserId}
          onClose={() => setSelectedTicket(null)}
          onResolved={() => { setSelectedTicket(null); fetchTickets(); }}
        />
      )}
    </div>
  );
}
