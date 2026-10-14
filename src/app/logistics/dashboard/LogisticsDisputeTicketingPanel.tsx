'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';
import toast from 'react-hot-toast';
import { uploadLogisticsFile, LOGISTICS_FILE_ACCEPT } from '@/lib/logisticsUpload';

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
  resolved_at: string | null;
  release_amount: number | null;
  refund_amount: number | null;
  deduction_amount: number | null;
  created_at: string;
  updated_at: string;
  orders?: { order_number: string | null; total: number } | null;
  logistics_shipments?: { tracking_number: string | null; bl_number: string | null } | null;
}

interface ActiveShipmentOption {
  id: string;
  order_id: string | null;
  tracking_number: string | null;
  bl_number: string | null;
  transport_type: string | null;
  route_origin_port: string | null;
  route_destination_port: string | null;
  shipment_status: string | null;
}

interface LogisticsDisputeTicketingPanelProps {
  partnerId: string;
  userId: string;
  openedBy?: 'logistics_partner' | 'buyer';
  buyerId?: string | null;
  shipmentId?: string | null;
  orderId?: string | null;
  disputedAmount?: number | null;
}

const DISPUTE_REASONS = [
  { value: 'cargo_damage',       label: 'تلف البضاعة',              icon: '📦' },
  { value: 'weight_shortage',    label: 'نقص في الوزن / الكمية',    icon: '⚖️' },
  { value: 'pricing_dispute',    label: 'خلاف على التسعيرة',        icon: '💰' },
  { value: 'unjustified_delay',  label: 'تأخير غير مبرر',           icon: '⏰' },
  { value: 'missing_items',      label: 'بضاعة مفقودة',             icon: '🔍' },
  { value: 'other',              label: 'سبب آخر',                  icon: '📋' },
];

const ACTIVE_SHIPMENT_STATUSES = ['pending', 'picked_up', 'in_transit', 'arrived_at_hub', 'out_for_delivery'];

const STATUS_META: Record<string, { label: string; color: string; icon: string }> = {
  open:                        { label: 'مفتوح',                    color: 'bg-red-50 text-red-700 border-red-200',         icon: 'ExclamationCircleIcon' },
  under_review:                { label: 'قيد المراجعة',             color: 'bg-blue-50 text-blue-700 border-blue-200',      icon: 'MagnifyingGlassIcon' },
  resolved_full_release:       { label: 'محسوم: إفراج كامل',        color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: 'CheckCircleIcon' },
  resolved_partial_deduction:  { label: 'محسوم: خصم جزئي',          color: 'bg-amber-50 text-amber-700 border-amber-200',   icon: 'MinusCircleIcon' },
  resolved_full_refund:        { label: 'محسوم: استرداد كامل',       color: 'bg-purple-50 text-purple-700 border-purple-200', icon: 'ArrowUturnLeftIcon' },
  closed:                      { label: 'مغلق',                     color: 'bg-gray-50 text-gray-600 border-gray-200',      icon: 'XCircleIcon' },
};

// ─── Open Dispute Form ────────────────────────────────────────────────────────

function OpenDisputeForm({
  partnerId,
  userId,
  openedBy,
  buyerId,
  shipmentId,
  orderId,
  disputedAmount,
  onSubmitted,
  onCancel,
}: {
  partnerId: string;
  userId: string;
  openedBy: 'logistics_partner' | 'buyer';
  buyerId?: string | null;
  shipmentId?: string | null;
  orderId?: string | null;
  disputedAmount?: number | null;
  onSubmitted: () => void;
  onCancel: () => void;
}) {
  const supabase = createClient();
  const [reason, setReason] = useState('');
  const [otherReason, setOtherReason] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState(disputedAmount ? String(disputedAmount) : '');
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [activeShipments, setActiveShipments] = useState<ActiveShipmentOption[]>([]);
  const [loadingShipments, setLoadingShipments] = useState(true);
  const [selectedShipmentId, setSelectedShipmentId] = useState<string>(shipmentId || '');

  useEffect(() => {
    let cancelled = false;
    const loadShipments = async () => {
      setLoadingShipments(true);
      const { data } = await supabase
        .from('logistics_shipments')
        .select('id, order_id, tracking_number, bl_number, transport_type, route_origin_port, route_destination_port, shipment_status')
        .eq('logistics_partner_id', partnerId)
        .in('shipment_status', ACTIVE_SHIPMENT_STATUSES)
        .order('created_at', { ascending: false });
      if (!cancelled) {
        setActiveShipments((data as ActiveShipmentOption[]) || []);
        setLoadingShipments(false);
      }
    };
    loadShipments();
    return () => { cancelled = true; };
  }, [partnerId]);

  const selectedShipment = activeShipments.find(s => s.id === selectedShipmentId) || null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) setEvidenceFiles(prev => [...prev, ...files]);
    e.target.value = '';
  };

  const removeFile = (index: number) => {
    setEvidenceFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!selectedShipmentId) { toast.error('يرجى اختيار الشحنة المتنازع عليها'); return; }
    if (!reason) { toast.error('يرجى اختيار سبب النزاع'); return; }
    if (!description.trim()) { toast.error('يرجى كتابة وصف النزاع'); return; }

    setSubmitting(true);
    const effectiveOrderId = selectedShipment?.order_id || orderId || null;

    try {
      // Upload evidence files using the same flow as the chat (chat-media bucket)
      const uploaded: { name: string; url: string; path: string; type: string; size: number }[] = [];
      for (const file of evidenceFiles) {
        let up;
        try {
          up = await uploadLogisticsFile(file, userId, 'dispute-evidence');
        } catch (upErr: any) {
          throw new Error(`"${file.name}": ${upErr?.message || 'فشل رفع الملف'}`);
        }
        uploaded.push({ name: up.fileName, url: up.publicUrl, path: up.storagePath, type: up.fileType, size: up.fileSize });
      }

      // Insert dispute ticket
      const { data: ticket, error } = await supabase
        .from('logistics_dispute_tickets')
        .insert({
          shipment_id: selectedShipmentId,
          order_id: effectiveOrderId,
          partner_id: partnerId,
          buyer_id: buyerId || null,
          opened_by: openedBy,
          opened_by_user_id: userId,
          dispute_reason: reason,
          dispute_reason_other: reason === 'other' ? otherReason : null,
          description,
          evidence_url: uploaded[0]?.url || null,
          evidence_filename: uploaded[0]?.name || null,
          disputed_amount: amount ? parseFloat(amount) : null,
          currency: 'USD',
          escrow_frozen: true,
          escrow_frozen_at: new Date().toISOString(),
          status: 'open',
        })
        .select('id')
        .single();

      if (error) throw error;

      // Save every evidence file in dispute_attachments
      if (ticket?.id && uploaded.length > 0) {
        const { error: attErr } = await supabase.from('dispute_attachments').insert(
          uploaded.map(u => ({
            dispute_id: ticket.id,
            partner_id: partnerId,
            uploaded_by: userId,
            file_name: u.name,
            file_url: u.url,
            storage_path: u.path,
            file_type: u.type || null,
            file_size: u.size,
          }))
        );
        if (attErr) toast.error(`تم فتح النزاع لكن فشل حفظ المرفقات: ${attErr.message}`);
      }

      // Freeze escrow for the order linked to the selected shipment
      if (effectiveOrderId) {
        await supabase
          .from('orders')
          .update({ status: 'disputed', updated_at: new Date().toISOString() })
          .eq('id', effectiveOrderId);
      }

      // Notify admin
      await supabase.from('notifications').insert({
        user_id: null,
        type: 'logistics_dispute_opened',
        title: '🚨 نزاع لوجستي جديد',
        body: `تم فتح تذكرة نزاع جديدة — السبب: ${DISPUTE_REASONS.find(r => r.value === reason)?.label || reason}`,
        is_read: false,
        metadata: { partner_id: partnerId, order_id: effectiveOrderId, shipment_id: selectedShipmentId, opened_by: openedBy },
      });

      toast.success('تم فتح تذكرة النزاع وتجميد مبلغ الضمان (Escrow) بنجاح');
      onSubmitted();
    } catch (err: any) {
      toast.error(err?.message || 'فشل فتح النزاع. يرجى المحاولة مجدداً');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Escrow freeze notice */}
      <div className="flex items-start gap-2.5 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl">
        <Icon name="LockClosedIcon" size={16} className="text-red-400 mt-0.5 shrink-0" />
        <div>
          <p className="text-xs font-bold text-red-300">تنبيه: تجميد تلقائي لمبلغ الضمان</p>
          <p className="text-xs text-red-400 mt-0.5">
            بمجرد فتح النزاع، سيتم تجميد مبلغ الشحنة في محفظة الضمان (Escrow) تلقائياً حتى يتم حسم النزاع من قِبل الإدارة.
          </p>
        </div>
      </div>

      {/* Shipment selector */}
      <div>
        <label className="block text-xs font-semibold text-slate-300 mb-1.5">
          اختر الشحنة المتنازع عليها * (Select Shipment / B/L)
        </label>
        <select
          value={selectedShipmentId}
          onChange={e => setSelectedShipmentId(e.target.value)}
          disabled={loadingShipments}
          className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-red-500 disabled:opacity-60"
        >
          <option value="">
            {loadingShipments ? 'جاري تحميل الشحنات...' : activeShipments.length === 0 ? 'لا توجد شحنات نشطة' : '— اختر الشحنة —'}
          </option>
          {activeShipments.map(s => (
            <option key={s.id} value={s.id}>
              {s.tracking_number || 'بدون رقم'}
              {s.bl_number ? ` • B/L: ${s.bl_number}` : ''}
              {s.route_origin_port || s.route_destination_port ? ` • ${s.route_origin_port || '—'} → ${s.route_destination_port || '—'}` : ''}
            </option>
          ))}
        </select>
        <p className="text-[10px] text-slate-500 mt-1">
          سيتم تجميد الضمان المالي (Escrow Freeze) المرتبط بالشحنة المختارة.
        </p>
      </div>

      {/* Reason */}
      <div>
        <label className="block text-xs font-semibold text-slate-300 mb-2">
          سبب النزاع <span className="text-red-400">*</span>
        </label>
        <div className="grid grid-cols-2 gap-2">
          {DISPUTE_REASONS.map(r => (
            <button
              key={r.value}
              onClick={() => setReason(r.value)}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-medium transition-all text-right ${
                reason === r.value
                  ? 'border-red-500 bg-red-500/20 text-red-300' :'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600'
              }`}
            >
              <span className="text-base">{r.icon}</span>
              <span>{r.label}</span>
            </button>
          ))}
        </div>
      </div>

      {reason === 'other' && (
        <input
          type="text"
          value={otherReason}
          onChange={e => setOtherReason(e.target.value)}
          placeholder="اكتب سبب النزاع..."
          className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500"
        />
      )}

      {/* Description */}
      <div>
        <label className="block text-xs font-semibold text-slate-300 mb-1.5">
          وصف النزاع <span className="text-red-400">*</span>
        </label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="اشرح تفاصيل النزاع بوضوح..."
          rows={3}
          className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500 resize-none"
        />
      </div>

      {/* Disputed Amount */}
      <div>
        <label className="block text-xs font-semibold text-slate-300 mb-1.5">
          المبلغ المتنازع عليه (USD) — اختياري
        </label>
        <input
          type="number"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          placeholder="0.00"
          min="0"
          step="0.01"
          className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500"
        />
      </div>

      {/* Evidence Upload */}
      <div>
        <label className="block text-xs font-semibold text-slate-300 mb-1.5">
          رفع دليل / إثبات (صور الضرر ومستندات الفحص) — اختياري
        </label>
        <label className="flex items-center gap-3 px-4 py-3 border border-dashed border-slate-700 rounded-xl cursor-pointer hover:border-red-500/50 transition-colors bg-slate-800/50">
          <Icon name="PaperClipIcon" size={18} className="text-slate-500" />
          <span className="text-xs text-slate-400">
            {evidenceFiles.length > 0 ? `إضافة ملفات أخرى (${evidenceFiles.length} مختار)` : 'صورة أو مستند PDF'}
          </span>
          <input
            type="file"
            accept={LOGISTICS_FILE_ACCEPT}
            multiple
            onChange={handleFileChange}
            className="hidden"
          />
        </label>
        {evidenceFiles.length > 0 && (
          <ul className="mt-2 space-y-1.5">
            {evidenceFiles.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-2 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg">
                <span className="text-xs text-slate-300 truncate">
                  {f.name} <span className="text-slate-500">({(f.size / 1024).toFixed(0)} KB)</span>
                </span>
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  className="text-slate-500 hover:text-red-400 shrink-0"
                  aria-label="إزالة الملف"
                >
                  <Icon name="XMarkIcon" size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={onCancel}
          className="flex-1 px-4 py-2.5 rounded-xl border border-slate-600 text-slate-300 text-sm font-medium hover:bg-slate-700 transition-colors"
        >
          إلغاء
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting || !selectedShipmentId || !reason || !description.trim()}
          className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
        >
          {submitting ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Icon name="ExclamationCircleIcon" size={14} />
          )}
          فتح تذكرة النزاع وتجميد Escrow
        </button>
      </div>
    </div>
  );
}

// ─── Dispute List ─────────────────────────────────────────────────────────────

function DisputeList({ tickets }: { tickets: DisputeTicket[] }) {
  if (tickets.length === 0) {
    return (
      <div className="text-center py-10">
        <Icon name="CheckCircleIcon" size={40} className="text-emerald-500 mx-auto mb-3" />
        <p className="text-slate-300 font-semibold">لا توجد نزاعات مفتوحة</p>
        <p className="text-slate-500 text-sm mt-1">جميع شحناتك تسير بشكل طبيعي</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {tickets.map(ticket => {
        const meta = STATUS_META[ticket.status] || STATUS_META['open'];
        const reasonLabel = DISPUTE_REASONS.find(r => r.value === ticket.dispute_reason)?.label || ticket.dispute_reason;
        return (
          <div key={ticket.id} className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${meta.color}`}>
                    <Icon name={meta.icon as any} size={10} />
                    {meta.label}
                  </span>
                  {ticket.escrow_frozen && ticket.status === 'open' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                      <Icon name="LockClosedIcon" size={10} />
                      Escrow مجمّد
                    </span>
                  )}
                </div>
                <p className="text-sm font-semibold text-white mt-1.5">{reasonLabel}</p>
                {(ticket.logistics_shipments?.tracking_number || ticket.logistics_shipments?.bl_number) && (
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {ticket.logistics_shipments?.tracking_number || ''}
                    {ticket.logistics_shipments?.bl_number ? ` • B/L: ${ticket.logistics_shipments.bl_number}` : ''}
                  </p>
                )}
                <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{ticket.description}</p>
              </div>
              {ticket.disputed_amount && (
                <div className="text-right shrink-0">
                  <p className="text-xs text-slate-500">المبلغ المتنازع</p>
                  <p className="text-sm font-bold text-white">${ticket.disputed_amount.toFixed(2)}</p>
                </div>
              )}
            </div>

            {/* Resolution info */}
            {ticket.admin_resolution_note && (
              <div className="px-3 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                <p className="text-xs font-semibold text-emerald-400 mb-0.5">قرار الإدارة:</p>
                <p className="text-xs text-emerald-300">{ticket.admin_resolution_note}</p>
                {ticket.resolved_at && (
                  <p className="text-[10px] text-emerald-500 mt-1">
                    {new Date(ticket.resolved_at).toLocaleDateString('ar-SA')}
                  </p>
                )}
              </div>
            )}

            <div className="flex items-center justify-between text-[10px] text-slate-500">
              <span>
                فُتح بواسطة: {ticket.opened_by === 'logistics_partner' ? 'الشريك اللوجستي' : ticket.opened_by === 'buyer' ? 'المشتري' : 'الإدارة'}
              </span>
              <span>{new Date(ticket.created_at).toLocaleDateString('ar-SA')}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export default function LogisticsDisputeTicketingPanel({
  partnerId,
  userId,
  openedBy = 'logistics_partner',
  buyerId,
  shipmentId,
  orderId,
  disputedAmount,
}: LogisticsDisputeTicketingPanelProps) {
  const supabase = createClient();
  const [tickets, setTickets] = useState<DisputeTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('logistics_dispute_tickets')
        .select(`
          *,
          orders(order_number, total),
          logistics_shipments(tracking_number, bl_number)
        `)
        .eq('partner_id', partnerId)
        .order('created_at', { ascending: false });
      setTickets(data || []);
    } catch {
      setTickets([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();

    // Realtime subscription
    const channel = supabase
      .channel(`disputes-${partnerId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'logistics_dispute_tickets',
        filter: `partner_id=eq.${partnerId}`,
      }, () => fetchTickets())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [partnerId]);

  const openCount = tickets.filter(t => t.status === 'open' || t.status === 'under_review').length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-red-500/20 flex items-center justify-center">
            <Icon name="ExclamationCircleIcon" size={18} className="text-red-400" />
          </div>
          <div>
            <h3 className="font-bold text-white text-sm">نظام رفع النزاعات</h3>
            <p className="text-xs text-slate-400">
              {openCount > 0 ? `${openCount} نزاع مفتوح` : 'لا توجد نزاعات مفتوحة'}
            </p>
          </div>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-colors"
          >
            <Icon name="PlusCircleIcon" size={14} />
            فتح نزاع جديد
          </button>
        )}
      </div>

      {/* Open Dispute Form */}
      {showForm && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <Icon name="DocumentPlusIcon" size={16} className="text-red-400" />
            فتح تذكرة نزاع جديدة
          </h4>
          <OpenDisputeForm
            partnerId={partnerId}
            userId={userId}
            openedBy={openedBy}
            buyerId={buyerId}
            shipmentId={shipmentId}
            orderId={orderId}
            disputedAmount={disputedAmount}
            onSubmitted={() => { setShowForm(false); fetchTickets(); }}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      {/* Tickets List */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <DisputeList tickets={tickets} />
      )}
    </div>
  );
}
