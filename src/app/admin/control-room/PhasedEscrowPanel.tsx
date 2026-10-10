'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';
import { useLanguage } from '@/contexts/LanguageContext';
import CFOApprovalWidget from '@/components/CFOApprovalWidget';

// ─── Types ────────────────────────────────────────────────────────────────────

interface EscrowPhase {
  id: string;
  order_id: string;
  phase_name: string;
  phase_type: string;
  percentage: number;
  amount_usd: number;
  status: 'pending' | 'released' | 'held' | 'cancelled';
  recipient_type: string;
  release_condition: string;
  released_at: string | null;
  admin_note: string | null;
  created_at: string;
}

interface OrderWithEscrow {
  id: string;
  total_amount: number;
  status: string;
  buyer_id: string;
  manufacturer_id: string;
  created_at: string;
  phases: EscrowPhase[];
  user_profiles?: { full_name: string; email: string };
}

const PHASE_TYPE_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  deposit: { label: 'إيداع كامل', color: 'text-slate-700 bg-slate-100', icon: 'BanknotesIcon' },
  advance_factory: { label: 'دفعة مقدمة للمصنع (30%)', color: 'text-emerald-700 bg-emerald-100', icon: 'BuildingOffice2Icon' },
  shipping: { label: 'شريك الشحن', color: 'text-blue-700 bg-blue-100', icon: 'TruckIcon' },
  customs: { label: 'التخليص الجمركي', color: 'text-violet-700 bg-violet-100', icon: 'DocumentCheckIcon' },
  local_delivery: { label: 'التوصيل المحلي', color: 'text-amber-700 bg-amber-100', icon: 'MapPinIcon' },
  final_release: { label: 'الإفراج النهائي', color: 'text-teal-700 bg-teal-100', icon: 'CheckBadgeIcon' },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  pending: { label: 'معلّق', color: 'text-amber-700 bg-amber-50 border-amber-200', dot: 'bg-amber-400' },
  released: { label: 'مُفرَج عنه', color: 'text-emerald-700 bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500' },
  held: { label: 'محتجز', color: 'text-red-700 bg-red-50 border-red-200', dot: 'bg-red-500' },
  cancelled: { label: 'ملغي', color: 'text-gray-600 bg-gray-50 border-gray-200', dot: 'bg-gray-400' },
};

// ─── Escrow Phase Creator ─────────────────────────────────────────────────────

function CreatePhasesModal({
  orderId,
  orderTotal,
  onClose,
  onCreated,
}: {
  orderId: string;
  orderTotal: number;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { t, language } = useLanguage();
  const ui = t.admin.phasedEscrow;
  const stageLabels: Record<string, string> = {
    deposit: ui.stageDeposit,
    advance_factory: ui.stageAdvance,
    shipping: ui.stageShipping,
    customs: ui.stageCustoms,
    local_delivery: ui.stageLocalDelivery,
    final_release: ui.stageFinal,
  };
  const phaseStatusLabels: Record<string, string> = {
    pending: ui.statusPending,
    released: ui.statusReleased,
    held: ui.statusHeld,
    cancelled: ui.statusCancelled,
  };
  const supabase = createClient();
  const [advancePercent, setAdvancePercent] = useState(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const phases = [
    { phase_type: 'deposit', phase_name: 'إيداع الضمان الكامل', percentage: 100, recipient_type: 'platform', release_condition: 'تحويل فوري إلى حساب الضمان' },
    { phase_type: 'advance_factory', phase_name: `دفعة مقدمة للمصنع (${advancePercent}%)`, percentage: advancePercent, recipient_type: 'factory', release_condition: 'قبول المصنع لأمر الإنتاج' },
    { phase_type: 'shipping', phase_name: 'مدفوعات شريك الشحن', percentage: 15, recipient_type: 'logistics_partner', release_condition: 'تأكيد استلام البضاعة من المصنع' },
    { phase_type: 'customs', phase_name: 'رسوم التخليص الجمركي', percentage: 10, recipient_type: 'logistics_partner', release_condition: 'إتمام التخليص الجمركي وتحميل المستندات' },
    { phase_type: 'local_delivery', phase_name: 'التوصيل المحلي', percentage: 10, recipient_type: 'logistics_partner', release_condition: 'تأكيد التوصيل برمز PIN' },
    { phase_type: 'final_release', phase_name: `الإفراج النهائي (${100 - advancePercent - 35}%)`, percentage: 100 - advancePercent - 35, recipient_type: 'factory', release_condition: 'تأكيد استلام المشتري وانتهاء فترة النزاع' },
  ];

  const handleCreate = async () => {
    setLoading(true);
    setError('');
    try {
      const inserts = phases.map(p => ({
        order_id: orderId,
        phase_name: p.phase_name,
        phase_type: p.phase_type,
        percentage: p.percentage,
        amount_usd: (orderTotal * p.percentage) / 100,
        recipient_type: p.recipient_type,
        release_condition: p.release_condition,
        status: 'pending',
      }));
      const { error } = await supabase.from('escrow_phases').insert(inserts);
      if (error) throw error;
      onCreated();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0 bg-white">
        <h3 className="font-bold text-gray-900">{ui.createStages}</h3>
        <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center">
          <Icon name="XMarkIcon" size={16} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            نسبة الدفعة المقدمة للمصنع (%)
          </label>
          <input
            type="range" min={10} max={50} step={5}
            value={advancePercent}
            onChange={e => setAdvancePercent(Number(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>10%</span>
            <span className="font-bold text-primary">{advancePercent}% = ${((orderTotal * advancePercent) / 100).toLocaleString()}</span>
            <span>50%</span>
          </div>
        </div>

        <div className="space-y-2">
          {phases.map((p, i) => (
            <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PHASE_TYPE_CONFIG[p.phase_type]?.color}`}>
                  {PHASE_TYPE_CONFIG[p.phase_type]?.label}
                </span>
              </div>
              <div className="text-right">
                <span className="text-sm font-bold text-gray-900">{p.percentage}%</span>
                <span className="text-xs text-gray-500 mr-1">${((orderTotal * p.percentage) / 100).toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">{error}</div>
        )}

        <button
          onClick={handleCreate}
          disabled={loading}
          className="w-full h-11 bg-primary text-white rounded-xl font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Icon name="PlusIcon" size={16} />}
          {ui.createStages}
        </button>
      </div>
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export default function PhasedEscrowPanel() {
  const { t, dir, language, isRTL } = useLanguage();
  const ui = t.admin.phasedEscrow;
  const stageLabels: Record<string, string> = {
    deposit: ui.stageDeposit,
    advance_factory: ui.stageAdvance,
    shipping: ui.stageShipping,
    customs: ui.stageCustoms,
    local_delivery: ui.stageLocalDelivery,
    final_release: ui.stageFinal,
  };
  const phaseStatusLabels: Record<string, string> = {
    pending: ui.statusPending,
    released: ui.statusReleased,
    held: ui.statusHeld,
    cancelled: ui.statusCancelled,
  };

  const supabase = createClient();
  const [orders, setOrders] = useState<any[]>([]);
  const [phases, setPhases] = useState<Record<string, EscrowPhase[]>>({});
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState<{ orderId: string; total: number } | null>(null);
  const [actionLoading, setActionLoading] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: ordersData } = await supabase
      .from('orders')
      .select('id, total_amount, status, buyer_id, manufacturer_id, created_at')
      .order('created_at', { ascending: false })
      .limit(30);

    const { data: phasesData } = await supabase
      .from('escrow_phases')
      .select('*')
      .order('created_at', { ascending: true });

    setOrders(ordersData || []);
    const grouped: Record<string, EscrowPhase[]> = {};
    (phasesData || []).forEach((p: EscrowPhase) => {
      if (!grouped[p.order_id]) grouped[p.order_id] = [];
      grouped[p.order_id].push(p);
    });
    setPhases(grouped);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const releasePhase = async (phaseId: string) => {
    setActionLoading(phaseId);
    await supabase.from('escrow_phases').update({ status: 'released', released_at: new Date().toISOString() }).eq('id', phaseId);
    await fetchData();
    showSuccess('تم الإفراج عن المرحلة بنجاح');
    setActionLoading('');
  };

  const holdPhase = async (phaseId: string) => {
    setActionLoading(phaseId + 'hold');
    await supabase.from('escrow_phases').update({ status: 'held' }).eq('id', phaseId);
    await fetchData();
    showSuccess('تم تجميد المرحلة');
    setActionLoading('');
  };

  const totalEscrow = orders.reduce((s, o) => s + (o.total_amount || 0), 0);
  const releasedPhases = Object.values(phases).flat().filter(p => p.status === 'released');
  const pendingPhases = Object.values(phases).flat().filter(p => p.status === 'pending');

  return (
    <div className="space-y-5" dir={dir}>
      {/* CFO Approval Widget — Cash Upfront Escrow */}
      <div className="bg-white border border-amber-200 rounded-xl p-5">
        <CFOApprovalWidget isAdmin={true} />
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: ui.totalEscrow, value: `$${totalEscrow.toLocaleString()}`, icon: 'BanknotesIcon', color: 'text-emerald-600 bg-emerald-50' },
          { label: ui.statusPending, value: pendingPhases.length, icon: 'ClockIcon', color: 'text-amber-600 bg-amber-50' },
          { label: ui.releasedPhases, value: releasedPhases.length, icon: 'CheckCircleIcon', color: 'text-blue-600 bg-blue-50' },
          { label: ui.activeOrders, value: orders.length, icon: 'ShoppingBagIcon', color: 'text-violet-600 bg-violet-50' },
        ].map((kpi, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-xl p-4">
            <div className={`w-9 h-9 rounded-lg ${kpi.color} flex items-center justify-center mb-2`}>
              <Icon name={kpi.icon as any} size={18} className={kpi.color.split(' ')[0]} />
            </div>
            <div className="text-xl font-bold text-gray-900">{kpi.value}</div>
            <div className="text-xs text-gray-500">{kpi.label}</div>
          </div>
        ))}
      </div>

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl px-4 py-3 text-sm flex items-center gap-2">
          <Icon name="CheckCircleIcon" size={16} />
          {successMsg}
        </div>
      )}

      {/* Orders List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Icon name="BanknotesIcon" size={40} className="mx-auto mb-3 opacity-30" />
          <p>{ui.noOrders}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map(order => {
            const orderPhases = phases[order.id] || [];
            const isExpanded = selectedOrder === order.id;
            const hasPhases = orderPhases.length > 0;
            const releasedCount = orderPhases.filter(p => p.status === 'released').length;

            return (
              <div key={order.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                {/* Order Header */}
                <div
                  className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => setSelectedOrder(isExpanded ? null : order.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center">
                      <Icon name="ShoppingBagIcon" size={16} className="text-primary" />
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900 text-sm">{ui.orderLabel} #{order.id.slice(0, 8)}</div>
                      <div className="text-xs text-gray-500">{new Date(order.created_at).toLocaleDateString('ar-SA')}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="font-bold text-gray-900">${(order.total_amount || 0).toLocaleString()}</div>
                      {hasPhases && (
                        <div className="text-xs text-gray-500">{ui.phasesReleased.replace('{released}', String(releasedCount)).replace('{total}', String(orderPhases.length))}</div>
                      )}
                    </div>
                    {!hasPhases && (
                      <button
                        onClick={e => { e.stopPropagation(); setShowCreateModal({ orderId: order.id, total: order.total_amount || 0 }); }}
                        className="text-xs bg-primary text-white px-3 py-1.5 rounded-lg hover:bg-primary/90 transition-colors"
                      >
                        إنشاء مراحل
                      </button>
                    )}
                    <Icon name={isExpanded ? 'ChevronUpIcon' : 'ChevronDownIcon'} size={16} className="text-gray-400" />
                  </div>
                </div>

                {/* Phases */}
                {isExpanded && hasPhases && (
                  <div className="border-t border-gray-100 px-5 py-4 space-y-3">
                    {orderPhases.map(phase => {
                      const cfg = PHASE_TYPE_CONFIG[phase.phase_type] || { label: phase.phase_type, color: 'text-gray-700 bg-gray-100', icon: 'BanknotesIcon' };
                      const statusCfg = STATUS_CONFIG[phase.status];
                      return (
                        <div key={phase.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg ${cfg.color} flex items-center justify-center`}>
                              <Icon name={cfg.icon as any} size={15} className={cfg.color.split(' ')[0]} />
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-900">{phase.phase_name}</div>
                              <div className="text-xs text-gray-500">{phase.release_condition}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <div className="font-bold text-gray-900 text-sm">${phase.amount_usd.toLocaleString()}</div>
                              <div className="text-xs text-gray-500">{phase.percentage}%</div>
                            </div>
                            <span className={`text-xs px-2 py-1 rounded-full border font-medium ${statusCfg.color}`}>
                              <span className={`inline-block w-1.5 h-1.5 rounded-full ${statusCfg.dot} mr-1`} />
                              {(phaseStatusLabels[phase.status] || statusCfg.label)}
                            </span>
                            {phase.status === 'pending' && (
                              <div className="flex gap-1.5">
                                <button
                                  onClick={() => releasePhase(phase.id)}
                                  disabled={actionLoading === phase.id}
                                  className="text-xs bg-emerald-600 text-white px-2.5 py-1.5 rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1"
                                >
                                  {actionLoading === phase.id ? <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" /> : <Icon name="CheckIcon" size={12} />}
                                  إفراج
                                </button>
                                <button
                                  onClick={() => holdPhase(phase.id)}
                                  disabled={actionLoading === phase.id + 'hold'}
                                  className="text-xs bg-red-600 text-white px-2.5 py-1.5 rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-1"
                                >
                                  <Icon name="LockClosedIcon" size={12} />
                                  تجميد
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {isExpanded && !hasPhases && (
                  <div className="border-t border-gray-100 px-5 py-6 text-center text-gray-400 text-sm">
                    لم يتم إنشاء مراحل الضمان لهذا الطلب بعد
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showCreateModal && (
        <CreatePhasesModal
          orderId={showCreateModal.orderId}
          orderTotal={showCreateModal.total}
          onClose={() => setShowCreateModal(null)}
          onCreated={fetchData}
        />
      )}
    </div>
  );
}
