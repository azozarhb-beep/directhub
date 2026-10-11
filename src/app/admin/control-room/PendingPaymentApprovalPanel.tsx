'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';

interface PendingPaymentOrder {
  id: string;
  order_number: string;
  status: string;
  escrow_status: string;
  payment_method: string;
  payment_reference: string | null;
  receipt_url: string | null;
  payment_proof_url: string | null;
  total: number;
  subtotal: number;
  created_at: string;
  notes: string | null;
  payment_verified: boolean;
  user_profiles?: {
    full_name: string;
    email: string;
    company_name: string | null;
    phone: string | null;
  } | null;
  // payment_submissions join
  payment_submissions?: Array<{
    payment_channel: string;
    wallet_provider: string | null;
    wallet_transfer_ref: string | null;
    wallet_receipt_url: string | null;
    bank_transfer_ref: string | null;
    bank_receipt_url: string | null;
    swift_ref: string | null;
    swift_receipt_url: string | null;
    verification_status: string;
  }>;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  local_wallet: '💚 محفظة إلكترونية محلية',
  local_bank_transfer: '🏦 تحويل بنكي محلي',
  international_swift: '🌐 تحويل SWIFT دولي',
  international_card: '💳 بطاقة دولية',
  bank_transfer: '🏦 تحويل بنكي',
  escrow: '🔒 ضمان (Escrow)',
  letter_of_credit: '📄 خطاب اعتماد',
  installments: '📅 أقساط',
};

export default function PendingPaymentApprovalPanel({ adminUserId }: { adminUserId: string }) {
  const supabase = createClient();
  const [orders, setOrders] = useState<PendingPaymentOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedProof, setSelectedProof] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState('');

  const fetchPendingOrders = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id, order_number, status, escrow_status, payment_method,
          payment_reference, receipt_url, payment_proof_url,
          total, subtotal, created_at, notes, payment_verified,
          user_profiles!orders_user_id_fkey(full_name, email, company_name, phone)
        `)
        .eq('escrow_status', 'pending_verification')
        .eq('payment_verified', false)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      // Fetch payment submissions for each order
      const orderIds = (data || []).map((o: any) => o.id);
      let submissions: any[] = [];
      if (orderIds.length > 0) {
        const { data: subData } = await supabase
          .from('payment_submissions')
          .select('order_id, payment_channel, wallet_provider, wallet_transfer_ref, wallet_receipt_url, bank_transfer_ref, bank_receipt_url, swift_ref, swift_receipt_url, verification_status')
          .in('order_id', orderIds);
        submissions = subData || [];
      }

      const enriched = (data || []).map((o: any) => ({
        ...o,
        payment_submissions: submissions.filter((s: any) => s.order_id === o.id),
      }));

      setOrders(enriched);
    } catch (err: any) {
      console.error('[PendingPaymentApprovalPanel]', err.message);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchPendingOrders();
  }, [fetchPendingOrders]);

  const handleApprove = async (orderId: string, orderNumber: string, newStatus: 'processing' | 'escrow_secured') => {
    setActionLoading(orderId);
    try {
      const now = new Date().toISOString();

      // Update order
      await supabase.from('orders').update({
        payment_verified: true,
        payment_verified_at: now,
        payment_verified_by: adminUserId,
        escrow_status: newStatus === 'escrow_secured' ? 'funds_secured' : 'pending_payment',
        status: newStatus === 'escrow_secured' ? 'processing' : 'processing',
        admin_note: `تم اعتماد الدفع يدوياً بواسطة المشرف — ${now}`,
      }).eq('id', orderId);

      // Update payment_submissions verification status
      await supabase.from('payment_submissions').update({
        verification_status: 'verified',
        verified_at: now,
        verified_by: adminUserId,
      }).eq('order_id', orderId);

      // Add status history
      await supabase.from('order_status_history').insert({
        order_id: orderId,
        status: 'processing',
        note: `✅ تم اعتماد الدفع يدوياً — الحالة الجديدة: ${newStatus === 'escrow_secured' ? 'escrow_secured' : 'processing'}`,
      });

      setSuccessMsg(`✅ تم اعتماد الدفع للطلب ${orderNumber}`);
      setTimeout(() => setSuccessMsg(''), 4000);
      fetchPendingOrders();
    } catch (err: any) {
      console.error('[Approve Payment]', err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (orderId: string, orderNumber: string) => {
    setActionLoading(orderId + '_reject');
    try {
      const now = new Date().toISOString();

      await supabase.from('orders').update({
        escrow_status: 'pending_payment',
        admin_note: `تم رفض الدفع بواسطة المشرف — ${now} — يرجى إعادة الإرسال`,
      }).eq('id', orderId);

      await supabase.from('payment_submissions').update({
        verification_status: 'rejected',
        rejection_reason: 'رفض يدوي من المشرف',
      }).eq('order_id', orderId);

      await supabase.from('order_status_history').insert({
        order_id: orderId,
        status: 'pending',
        note: `❌ تم رفض الدفع — يرجى إعادة الإرسال مع مرجع صحيح`,
      });

      setSuccessMsg(`❌ تم رفض الدفع للطلب ${orderNumber}`);
      setTimeout(() => setSuccessMsg(''), 4000);
      fetchPendingOrders();
    } catch (err: any) {
      console.error('[Reject Payment]', err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const getTransactionRef = (order: PendingPaymentOrder): string => {
    if (order.payment_reference) return order.payment_reference;
    const sub = order.payment_submissions?.[0];
    if (!sub) return '—';
    return sub.wallet_transfer_ref || sub.bank_transfer_ref || sub.swift_ref || '—';
  };

  const getProofUrl = (order: PendingPaymentOrder): string | null => {
    if (order.payment_proof_url) return order.payment_proof_url;
    if (order.receipt_url) return order.receipt_url;
    const sub = order.payment_submissions?.[0];
    if (!sub) return null;
    return sub.wallet_receipt_url || sub.bank_receipt_url || sub.swift_receipt_url || null;
  };

  const filtered = orders.filter((o) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (o.order_number || '').toLowerCase().includes(q) ||
      (o.user_profiles?.full_name || '').toLowerCase().includes(q) ||
      (o.user_profiles?.company_name || '').toLowerCase().includes(q) ||
      (o.payment_reference || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-500 to-orange-600 rounded-2xl p-5 text-white">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
            <Icon name="ClockIcon" size={24} className="text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold">اعتماد المدفوعات اليدوي</h2>
            <p className="text-sm text-white/80">الطلبات بانتظار التحقق من الدفع وإصدار الموافقة</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <p className="text-3xl font-bold">{orders.length}</p>
              <p className="text-xs text-white/70">طلب معلق</p>
            </div>
            <button
              onClick={fetchPendingOrders}
              disabled={loading}
              className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-2"
            >
              {loading ? <Icon name="ArrowPathIcon" size={14} className="animate-spin" /> : <Icon name="ArrowPathIcon" size={14} />}
              تحديث
            </button>
          </div>
        </div>
      </div>

      {/* Success message */}
      {successMsg && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl px-4 py-3 text-sm font-medium">
          <Icon name="CheckCircleIcon" size={16} className="text-emerald-600" />
          {successMsg}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'إجمالي المعلقة', value: orders.length.toString(), color: 'text-amber-600 bg-amber-50 border-amber-200' },
          { label: 'محافظ إلكترونية', value: orders.filter(o => o.payment_method === 'local_wallet').length.toString(), color: 'text-green-600 bg-green-50 border-green-200' },
          { label: 'تحويلات بنكية', value: orders.filter(o => ['local_bank_transfer', 'bank_transfer'].includes(o.payment_method)).length.toString(), color: 'text-blue-600 bg-blue-50 border-blue-200' },
          { label: 'مع صورة إيصال', value: orders.filter(o => getProofUrl(o) !== null).length.toString(), color: 'text-purple-600 bg-purple-50 border-purple-200' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border p-4 ${s.color}`}>
            <p className="text-xl font-bold">{s.value}</p>
            <p className="text-xs font-medium mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Icon name="MagnifyingGlassIcon" size={14} className="absolute top-1/2 -translate-y-1/2 right-3 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="بحث برقم الطلب أو اسم المشتري أو رقم الحوالة..."
          className="w-full pr-8 pl-3 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:border-primary"
          dir="rtl"
        />
      </div>

      {/* Orders List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Icon name="ArrowPathIcon" size={28} className="animate-spin text-amber-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <Icon name="CheckCircleIcon" size={32} className="text-green-600" />
          </div>
          <p className="text-lg font-bold text-foreground mb-1">لا توجد طلبات معلقة</p>
          <p className="text-sm text-muted-foreground">جميع المدفوعات تمت معالجتها</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((order) => {
            const txRef = getTransactionRef(order);
            const proofUrl = getProofUrl(order);
            const isApproving = actionLoading === order.id;
            const isRejecting = actionLoading === order.id + '_reject';
            const sub = order.payment_submissions?.[0];

            return (
              <div key={order.id} className="bg-card border-2 border-amber-200 rounded-2xl p-5 space-y-4">
                {/* Order Header */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                      <Icon name="ClockIcon" size={18} className="text-amber-600" />
                    </div>
                    <div>
                      <p className="font-bold text-foreground font-mono">{order.order_number}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(order.created_at)}</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200 shrink-0">
                    ⏳ بانتظار الاعتماد
                  </span>
                </div>

                {/* Order Details Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Buyer Info */}
                  <div className="bg-muted/30 rounded-xl p-3">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1.5">المشتري</p>
                    <p className="text-sm font-bold text-foreground">{order.user_profiles?.full_name || '—'}</p>
                    <p className="text-xs text-muted-foreground">{order.user_profiles?.company_name || ''}</p>
                    <p className="text-xs text-muted-foreground">{order.user_profiles?.email || ''}</p>
                    {order.user_profiles?.phone && (
                      <p className="text-xs text-muted-foreground">{order.user_profiles.phone}</p>
                    )}
                  </div>

                  {/* Payment Info */}
                  <div className="bg-muted/30 rounded-xl p-3">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1.5">معلومات الدفع</p>
                    <p className="text-sm font-semibold text-foreground">
                      {PAYMENT_METHOD_LABELS[order.payment_method] || order.payment_method || '—'}
                    </p>
                    {sub?.wallet_provider && (
                      <p className="text-xs text-green-700 font-medium mt-0.5">المحفظة: {sub.wallet_provider}</p>
                    )}
                    <p className="text-lg font-bold text-primary mt-1">
                      ${(order.total || order.subtotal || 0).toLocaleString('en-US')}
                    </p>
                  </div>
                </div>

                {/* Transaction Reference */}
                <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Icon name="LinkIcon" size={13} className="text-indigo-600" />
                    <p className="text-xs font-bold text-indigo-900">رقم مرجع الحوالة / رقم العملية</p>
                  </div>
                  <p className={`text-sm font-mono font-bold ${txRef === '—' ? 'text-red-500' : 'text-indigo-800'}`}>
                    {txRef}
                  </p>
                  {txRef === '—' && (
                    <p className="text-[10px] text-red-600 mt-0.5">⚠️ لم يتم إدخال رقم مرجع</p>
                  )}
                </div>

                {/* Proof of Payment */}
                {proofUrl ? (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Icon name="PhotoIcon" size={14} className="text-green-600" />
                        <p className="text-xs font-bold text-green-800">صورة سند التحويل</p>
                        <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">✅ مرفق</span>
                      </div>
                      <button
                        onClick={() => setSelectedProof(proofUrl)}
                        className="text-xs font-bold text-green-700 hover:underline flex items-center gap-1"
                      >
                        <Icon name="EyeIcon" size={12} />
                        عرض
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2">
                    <Icon name="ExclamationTriangleIcon" size={14} className="text-amber-600" />
                    <p className="text-xs text-amber-800">لم يتم رفع صورة سند التحويل</p>
                  </div>
                )}

                {/* Notes */}
                {order.notes && (
                  <div className="bg-muted/30 rounded-xl p-3">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">ملاحظات</p>
                    <p className="text-xs text-foreground leading-relaxed">{order.notes}</p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3 pt-1">
                  <button
                    onClick={() => handleApprove(order.id, order.order_number, 'processing')}
                    disabled={isApproving || isRejecting}
                    className="flex-1 h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
                  >
                    {isApproving ? (
                      <Icon name="ArrowPathIcon" size={14} className="animate-spin" />
                    ) : (
                      <Icon name="CheckCircleIcon" size={14} />
                    )}
                    اعتماد → processing
                  </button>
                  <button
                    onClick={() => handleApprove(order.id, order.order_number, 'escrow_secured')}
                    disabled={isApproving || isRejecting}
                    className="flex-1 h-11 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
                  >
                    {isApproving ? (
                      <Icon name="ArrowPathIcon" size={14} className="animate-spin" />
                    ) : (
                      <Icon name="ShieldCheckIcon" size={14} />
                    )}
                    اعتماد → escrow_secured
                  </button>
                  <button
                    onClick={() => handleReject(order.id, order.order_number)}
                    disabled={isApproving || isRejecting}
                    className="h-11 px-4 bg-red-50 hover:bg-red-100 text-red-700 font-bold rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-1.5 transition-colors border border-red-200"
                  >
                    {isRejecting ? (
                      <Icon name="ArrowPathIcon" size={14} className="animate-spin" />
                    ) : (
                      <Icon name="XCircleIcon" size={14} />
                    )}
                    رفض
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Proof Image Modal */}
      {selectedProof && (
        <div
          className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setSelectedProof(null)}
        >
          <div className="relative max-w-2xl w-full" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setSelectedProof(null)}
              className="absolute -top-10 left-0 text-white flex items-center gap-2 text-sm font-semibold"
            >
              <Icon name="XMarkIcon" size={18} />
              إغلاق
            </button>
            <img
              src={selectedProof}
              alt="صورة سند التحويل"
              className="w-full rounded-2xl shadow-2xl max-h-[80vh] object-contain bg-white"
            />
          </div>
        </div>
      )}
    </div>
  );
}
