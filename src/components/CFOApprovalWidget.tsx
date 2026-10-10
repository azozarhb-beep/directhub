'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';

interface CFOOrder {
  id: string;
  order_number: string;
  total: number;
  escrow_payment_type: string;
  cfo_approval_status: string | null;
  platform_commission_amount: number;
  platform_commission_rate_label: string | null;
  wire_transfer_verified: boolean;
  created_at: string;
  user_profiles?: { full_name: string; email: string } | null;
}

interface CFOApprovalWidgetProps {
  isAdmin?: boolean;
  userId?: string;
  compact?: boolean;
}

export default function CFOApprovalWidget({ isAdmin = false, userId, compact = false }: CFOApprovalWidgetProps) {
  const supabase = createClient();
  const [orders, setOrders] = useState<CFOOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState('');
  const [rejectNote, setRejectNote] = useState<Record<string, string>>({});
  const [showRejectInput, setShowRejectInput] = useState<string | null>(null);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('orders')
        .select('id, order_number, total, escrow_payment_type, cfo_approval_status, platform_commission_amount, platform_commission_rate_label, wire_transfer_verified, created_at')
        .eq('escrow_payment_type', 'cash_upfront_escrow')
        .order('created_at', { ascending: false });

      if (isAdmin) {
        // Admin sees all pending CFO approvals
        query = query.in('cfo_approval_status', ['pending_cfo_approval', 'cfo_approved', 'cfo_rejected']);
      } else if (userId) {
        // Buyer sees their own cash upfront orders
        query = query.eq('user_id', userId);
      }

      const { data } = await query.limit(20);
      setOrders((data || []) as CFOOrder[]);
    } catch (err) {
      console.error('[CFO Widget]', err);
    } finally {
      setLoading(false);
    }
  }, [supabase, isAdmin, userId]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const handleApprove = async (orderId: string) => {
    setActionLoading(orderId + '_approve');
    try {
      await supabase
        .from('orders')
        .update({
          cfo_approval_status: 'cfo_approved',
          cfo_approved_at: new Date().toISOString(),
          escrow_status: 'funds_secured',
        })
        .eq('id', orderId);

      await supabase.from('cfo_approval_log').insert({
        order_id: orderId,
        action: 'approved',
        note: 'تمت الموافقة من قِبَل المدير المالي',
      });

      showSuccess('✅ تمت الموافقة على الطلب وتجميد المبلغ في الضمان');
      fetchOrders();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading('');
    }
  };

  const handleReject = async (orderId: string) => {
    const note = rejectNote[orderId] || '';
    setActionLoading(orderId + '_reject');
    try {
      await supabase
        .from('orders')
        .update({
          cfo_approval_status: 'cfo_rejected',
          cfo_rejection_reason: note,
        })
        .eq('id', orderId);

      await supabase.from('cfo_approval_log').insert({
        order_id: orderId,
        action: 'rejected',
        note: note || 'رُفض من قِبَل المدير المالي',
      });

      showSuccess('تم رفض الطلب وإشعار المشتري');
      setShowRejectInput(null);
      fetchOrders();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading('');
    }
  };

  const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
    pending_cfo_approval: { label: 'بانتظار موافقة المدير المالي', color: 'text-amber-700 bg-amber-50 border-amber-200', icon: 'ClockIcon' },
    cfo_approved: { label: 'موافقة المدير المالي ✓', color: 'text-emerald-700 bg-emerald-50 border-emerald-200', icon: 'CheckBadgeIcon' },
    cfo_rejected: { label: 'مرفوض من المدير المالي', color: 'text-red-700 bg-red-50 border-red-200', icon: 'XCircleIcon' },
  };

  const pendingCount = orders.filter(o => o.cfo_approval_status === 'pending_cfo_approval').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <Icon name="BanknotesIcon" size={32} className="mx-auto mb-2 opacity-30" />
        <p className="text-sm">لا توجد طلبات دفع نقدي مسبق</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
            <Icon name="BuildingLibraryIcon" size={16} className="text-amber-700" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-sm">اعتماد المدير المالي (CFO)</h3>
            <p className="text-xs text-gray-500">مراجعة طلبات الدفع النقدي الكامل عبر الضمان</p>
          </div>
        </div>
        {pendingCount > 0 && (
          <span className="px-2.5 py-1 bg-amber-100 text-amber-700 text-xs font-bold rounded-full border border-amber-200">
            {pendingCount} بانتظار الموافقة
          </span>
        )}
      </div>

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl px-4 py-3 text-sm flex items-center gap-2">
          <Icon name="CheckCircleIcon" size={16} />
          {successMsg}
        </div>
      )}

      {/* Orders */}
      <div className="space-y-3">
        {orders.map(order => {
          const statusCfg = STATUS_CONFIG[order.cfo_approval_status || ''] || null;
          const isPending = order.cfo_approval_status === 'pending_cfo_approval';

          return (
            <div key={order.id} className={`border rounded-xl overflow-hidden ${isPending ? 'border-amber-300 bg-amber-50/30' : 'border-gray-200 bg-white'}`}>
              {/* Order Info */}
              <div className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 bg-gradient-to-br from-amber-500 to-orange-500 rounded-lg flex items-center justify-center shrink-0">
                      <Icon name="BanknotesIcon" size={16} className="text-white" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">
                        طلب #{order.order_number || order.id.slice(0, 8)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(order.created_at).toLocaleDateString('ar-SA')}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-gray-900">${(order.total || 0).toLocaleString()}</p>
                    <p className="text-xs text-amber-600 font-medium">دفع نقدي كامل</p>
                  </div>
                </div>

                {/* Commission & Wire Status */}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="bg-white border border-gray-100 rounded-lg px-3 py-2">
                    <p className="text-[10px] text-gray-500 mb-0.5">عمولة المنصة</p>
                    <p className="text-sm font-bold text-primary">
                      ${(order.platform_commission_amount || 0).toLocaleString()}
                    </p>
                    {order.platform_commission_rate_label && (
                      <p className="text-[10px] text-gray-400">{order.platform_commission_rate_label}</p>
                    )}
                  </div>
                  <div className={`border rounded-lg px-3 py-2 ${order.wire_transfer_verified ? 'bg-emerald-50 border-emerald-100' : 'bg-gray-50 border-gray-100'}`}>
                    <p className="text-[10px] text-gray-500 mb-0.5">تحقق SWIFT</p>
                    <div className="flex items-center gap-1">
                      <Icon
                        name={order.wire_transfer_verified ? 'CheckBadgeIcon' : 'ClockIcon'}
                        size={14}
                        className={order.wire_transfer_verified ? 'text-emerald-600' : 'text-gray-400'}
                      />
                      <p className={`text-xs font-semibold ${order.wire_transfer_verified ? 'text-emerald-700' : 'text-gray-500'}`}>
                        {order.wire_transfer_verified ? 'تم التحقق' : 'بانتظار التحقق'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Status Badge */}
                {statusCfg && (
                  <div className={`mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold w-fit ${statusCfg.color}`}>
                    <Icon name={statusCfg.icon as any} size={13} />
                    {statusCfg.label}
                  </div>
                )}
              </div>

              {/* Admin Actions */}
              {isAdmin && isPending && (
                <div className="border-t border-amber-200 bg-amber-50 px-4 py-3">
                  {showRejectInput === order.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={rejectNote[order.id] || ''}
                        onChange={e => setRejectNote(prev => ({ ...prev, [order.id]: e.target.value }))}
                        placeholder="سبب الرفض (اختياري)..."
                        rows={2}
                        className="w-full px-3 py-2 text-xs border border-red-200 rounded-lg bg-white resize-none focus:outline-none focus:border-red-400"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleReject(order.id)}
                          disabled={actionLoading === order.id + '_reject'}
                          className="flex-1 h-8 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-1"
                        >
                          {actionLoading === order.id + '_reject' ? (
                            <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                          ) : <Icon name="XMarkIcon" size={12} />}
                          تأكيد الرفض
                        </button>
                        <button
                          onClick={() => setShowRejectInput(null)}
                          className="px-3 h-8 bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg hover:bg-gray-300"
                        >
                          إلغاء
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprove(order.id)}
                        disabled={actionLoading === order.id + '_approve'}
                        className="flex-1 h-9 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-1.5"
                      >
                        {actionLoading === order.id + '_approve' ? (
                          <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                        ) : <Icon name="CheckBadgeIcon" size={14} />}
                        موافقة وتجميد في الضمان
                      </button>
                      <button
                        onClick={() => setShowRejectInput(order.id)}
                        className="px-3 h-9 bg-red-100 text-red-700 text-xs font-bold rounded-lg hover:bg-red-200 border border-red-200 flex items-center gap-1"
                      >
                        <Icon name="XMarkIcon" size={13} />
                        رفض
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
