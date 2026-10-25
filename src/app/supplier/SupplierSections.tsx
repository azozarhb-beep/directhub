'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRealtimeOrders } from '@/lib/hooks/useRealtimeOrders';

import SupplierFinanceLedger from './local-dashboard/SupplierFinanceLedger';
import SupplierEscrowOrdersWrapper from './local-dashboard/SupplierEscrowOrdersWrapper';
import SupplierBankAccountsWrapper from './local-dashboard/SupplierBankAccountsWrapper';
import SupplierDisputes from './SupplierDisputes';
import SupplierArchiveWrapper from './local-dashboard/SupplierArchiveWrapper';
import SupplierMessagingHub from './SupplierMessagingHub';
import SupplierInventory from './SupplierInventory';
import SupplierProducts from './SupplierProducts';
import SupplierSettingsPanel from './settings/SupplierSettingsPanel';
import SupplierRfq from './SupplierRfq';
import SupplierDealLinks from './SupplierDealLinks';
import SupplierLogistics from './SupplierLogistics';
import SupplierAnalytics from './SupplierAnalytics';
import SupplierDistribution from './SupplierDistribution';
import SupplierScope from './SupplierScope';
import type { SupplierModuleKey } from './supplierModules';

interface SectionProps {
  moduleKey: SupplierModuleKey;
  userId: string;
  profileData: { company_name?: string; full_name?: string } | null;
}

interface LocalOrder {
  id: string;
  order_number: string;
  buyer_name: string;
  total_amount: number;
  currency: string;
  status: string;
  order_type: 'wholesale' | 'retail';
  created_at: string;
}

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-amber-500/15 text-amber-300 border border-amber-500/40',
  active: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40',
  approved: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40',
  completed: 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40',
  delivered: 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40',
  rejected: 'bg-red-500/15 text-red-300 border border-red-500/40',
  cancelled: 'bg-slate-700 text-slate-300 border border-slate-600',
  processing: 'bg-purple-500/15 text-purple-300 border border-purple-500/40',
  shipped: 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/40',
};

const CARD = 'bg-slate-900 border border-slate-800 rounded-2xl';

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className={`${CARD} p-10 text-center`}>
      <p className="text-slate-400 text-sm">{text}</p>
    </div>
  );
}

function OrdersSection({ userId }: { userId: string }) {
  const supabase = React.useMemo(() => createClient(), []);
  const [orders, setOrders] = useState<LocalOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('orders')
        .select('id, order_number, status, total, currency, created_at, order_category, user_profiles!orders_user_id_fkey(full_name, company_name)')
        .eq('factory_user_id', userId)
        .order('created_at', { ascending: false })
        .limit(200);
      setOrders(
        (data || []).map((o: any) => ({
          id: o.id,
          order_number: o.order_number || String(o.id).slice(0, 8),
          buyer_name: o.user_profiles?.company_name || o.user_profiles?.full_name || 'مشتري محلي',
          total_amount: o.total || 0,
          currency: o.currency || 'YER',
          status: o.status,
          order_type: o.order_category === 'wholesale' || o.order_category === 'bulk_wholesale' ? 'wholesale' : 'retail',
          created_at: o.created_at,
        }))
      );
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [supabase, userId]);

  useEffect(() => {
    load();
  }, [load]);

  useRealtimeOrders({
    channelName: 'supplier-hub-orders-rt',
    filterColumn: 'factory_user_id',
    userId,
    onOrderChange: load,
    enabled: !!userId,
  });

  const pending = orders.filter((o) => o.status === 'pending' || o.status === 'processing').length;
  const done = orders.filter((o) => o.status === 'completed' || o.status === 'delivered').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-base sm:text-lg font-bold text-white">إدارة الطلبات (جملة وتجزئة)</h2>
        <div className="flex gap-2">
          <span className="bg-amber-500/15 text-amber-300 border border-amber-500/40 text-xs px-3 py-1 rounded-full">{pending} معلّق</span>
          <span className="bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 text-xs px-3 py-1 rounded-full">{done} مكتمل</span>
        </div>
      </div>
      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : orders.length === 0 ? (
        <EmptyState text="لا توجد طلبات بعد" />
      ) : (
        <div className={`${CARD} overflow-x-auto`}>
          <table className="w-full text-sm">
            <thead className="bg-slate-800/60 text-slate-300">
              <tr>
                <th className="text-right px-4 py-3 font-medium">رقم الطلب</th>
                <th className="text-right px-4 py-3 font-medium">المشتري</th>
                <th className="text-right px-4 py-3 font-medium">النوع</th>
                <th className="text-right px-4 py-3 font-medium">المبلغ</th>
                <th className="text-right px-4 py-3 font-medium">الحالة</th>
                <th className="text-right px-4 py-3 font-medium">التاريخ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {orders.map((o) => (
                <tr key={o.id}>
                  <td className="px-4 py-3 font-mono text-xs text-slate-300">{o.order_number}</td>
                  <td className="px-4 py-3 text-slate-200">{o.buyer_name}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full border ${o.order_type === 'wholesale' ? 'bg-blue-500/15 text-blue-300 border-blue-500/40' : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'}`}>
                      {o.order_type === 'wholesale' ? 'جملة' : 'تجزئة'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-200">{o.total_amount} {o.currency}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${STATUS_BADGE[o.status] || STATUS_BADGE.pending}`}>{o.status}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{formatDate(o.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function SupplierSection({ moduleKey, userId, profileData }: SectionProps) {
  switch (moduleKey) {
    case 'inventory':
      return <SupplierInventory userId={userId} />;
    case 'products':
      return <SupplierProducts userId={userId} />;
    case 'distribution':
      return <SupplierDistribution userId={userId} />;
    case 'orders':
      return <OrdersSection userId={userId} />;
    case 'rfq':
      return <SupplierRfq userId={userId} />;
    case 'deal-links':
      return <SupplierDealLinks userId={userId} />;
    case 'logistics':
      return <SupplierLogistics userId={userId} />;
    case 'analytics':
      return <SupplierAnalytics userId={userId} />;
    case 'escrow':
      return (
        <SupplierScope>
          <SupplierEscrowOrdersWrapper userId={userId} />
        </SupplierScope>
      );
    case 'finance':
      return (
        <SupplierScope>
          <SupplierFinanceLedger userId={userId} />
        </SupplierScope>
      );
    case 'bank-accounts':
      return (
        <SupplierScope>
          <SupplierBankAccountsWrapper userId={userId} />
        </SupplierScope>
      );
    case 'settings':
      return <SupplierSettingsPanel userId={userId} />;
    case 'disputes':
      return (
        <SupplierScope>
          <SupplierDisputes userId={userId} />
        </SupplierScope>
      );
    case 'archive':
      return (
        <SupplierScope>
          <SupplierArchiveWrapper userId={userId} />
        </SupplierScope>
      );
    case 'messages':
      return (
        <SupplierScope>
          <SupplierMessagingHub userId={userId} />
        </SupplierScope>
      );
    default:
      return null;
  }
}
