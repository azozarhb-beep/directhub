'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';
import { useLanguage } from '@/contexts/LanguageContext';

// ─── Sales Method Types ───────────────────────────────────────────────────────

type SalesMethod = 'b2b_rfq' | 'b2s_light' | 'b2c_direct' | 'escrow_deal';
type TransactionStatus = 'pending' | 'active' | 'completed' | 'disputed' | 'cancelled';

interface SalesStats {
  totalRevenue: number;
  pendingOrders: number;
  activeEscrow: number;
  completedDeals: number;
  b2bDeals: number;
  b2sOrders: number;
  b2cOrders: number;
}

interface Transaction {
  id: string;
  type: SalesMethod;
  buyer_name: string;
  amount: number;
  currency: string;
  status: TransactionStatus;
  created_at: string;
  order_id?: string;
  escrow_status?: string;
}

// ─── Sales Method Config ──────────────────────────────────────────────────────


const SALES_METHODS: {
  id: SalesMethod;
  icon: string;
  color: string;
  bgColor: string;
  borderColor: string;
}[] = [
  {
    id: 'b2b_rfq',
    icon: 'BuildingOffice2Icon',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
  },
  {
    id: 'b2s_light',
    icon: 'BuildingStorefrontIcon',
    color: 'text-teal-600',
    bgColor: 'bg-teal-50',
    borderColor: 'border-teal-200',
  },
  {
    id: 'b2c_direct',
    icon: 'ShoppingBagIcon',
    color: 'text-pink-600',
    bgColor: 'bg-pink-50',
    borderColor: 'border-pink-200',
  },
  {
    id: 'escrow_deal',
    icon: 'ShieldCheckIcon',
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
  },
];

const TYPE_LABELS: Record<SalesMethod, string> = {
  b2b_rfq:    'B2B',
  b2s_light:  'B2S',
  b2c_direct: 'B2C',
  escrow_deal:'Escrow',
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function AllSalesMethodsPanel() {
  const { t, dir, language, isRTL } = useLanguage();
  const ui = t.admin.salesMethods;
  const methods = [
    {
      ...SALES_METHODS[0],
      title: ui.b2bTitle, desc: ui.b2bDesc, badge: 'RFQ + Escrow',
      actions: [
        { label: ui.actionRfqBoard, href: '/rfq-management', icon: 'DocumentTextIcon', primary: true },
        { label: ui.actionEscrow, href: '/financial-accounts', icon: 'ShieldCheckIcon' },
        { label: ui.actionInvoices, href: '/invoices', icon: 'DocumentDuplicateIcon' },
      ],
    },
    {
      ...SALES_METHODS[1],
      title: ui.b2sTitle, desc: ui.b2sDesc, badge: ui.b2sBadge,
      actions: [
        { label: ui.actionFulfillment, href: '/order-fulfillment', icon: 'CheckBadgeIcon', primary: true },
        { label: ui.actionIncoming, href: '/orders', icon: 'ArchiveBoxIcon' },
        { label: ui.actionTracking, href: '/order-tracking', icon: 'TruckIcon' },
      ],
    },
    {
      ...SALES_METHODS[2],
      title: ui.b2cTitle, desc: ui.b2cDesc, badge: ui.b2cBadge,
      actions: [
        { label: ui.actionMyProducts, href: '/seller/products', icon: 'CubeIcon', primary: true },
        { label: ui.actionOrders, href: '/orders', icon: 'ArchiveBoxIcon' },
        { label: ui.actionReviews, href: '/my-account', icon: 'StarIcon' },
      ],
    },
    {
      ...SALES_METHODS[3],
      title: ui.escrowTitle, desc: ui.escrowDesc, badge: ui.escrowBadge,
      actions: [
        { label: ui.actionFinancial, href: '/financial-accounts', icon: 'BanknotesIcon', primary: true },
        { label: ui.actionDisputes, href: '/disputes', icon: 'ScaleIcon' },
        { label: ui.actionInvoices, href: '/invoices', icon: 'DocumentDuplicateIcon' },
      ],
    },
  ];
  const statusConfig = {
    pending:   { label: ui.statusPending, color: 'text-amber-700',  bg: 'bg-amber-50' },
    active:    { label: ui.statusActive, color: 'text-blue-700',   bg: 'bg-blue-50' },
    completed: { label: ui.statusCompleted, color: 'text-green-700',  bg: 'bg-green-50' },
    disputed:  { label: ui.statusDisputed, color: 'text-red-700',    bg: 'bg-red-50' },
    cancelled: { label: ui.statusCancelled, color: 'text-gray-600',   bg: 'bg-gray-100' },
  } as const;


  const { user } = useAuth();
  const supabase = createClient();

  const [stats, setStats] = useState<SalesStats>({
    totalRevenue: 0,
    pendingOrders: 0,
    activeEscrow: 0,
    completedDeals: 0,
    b2bDeals: 0,
    b2sOrders: 0,
    b2cOrders: 0,
  });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeMethod, setActiveMethod] = useState<SalesMethod | 'all'>('all');

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Fetch orders for this seller
      const { data: orders } = await supabase
        .from('orders')
        .select('id, total_amount, currency, status, created_at, buyer_id, escrow_status, order_type')
        .eq('seller_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (orders) {
        const txns: Transaction[] = orders.map(o => ({
          id: o.id,
          type: (o.order_type === 'rfq' ? 'b2b_rfq' : o.order_type === 'b2s' ? 'b2s_light' : o.escrow_status ? 'escrow_deal' : 'b2c_direct') as SalesMethod,
          buyer_name: ui.buyer,
          amount: o.total_amount || 0,
          currency: o.currency || 'SAR',
          status: (o.status || 'pending') as TransactionStatus,
          created_at: o.created_at,
          order_id: o.id,
          escrow_status: o.escrow_status,
        }));
        setTransactions(txns);

        const completed = orders.filter(o => o.status === 'delivered' || o.status === 'completed');
        const escrowActive = orders.filter(o => o.escrow_status && o.escrow_status !== 'released');
        setStats({
          totalRevenue: completed.reduce((s, o) => s + (o.total_amount || 0), 0),
          pendingOrders: orders.filter(o => o.status === 'pending').length,
          activeEscrow: escrowActive.length,
          completedDeals: completed.length,
          b2bDeals: orders.filter(o => o.order_type === 'rfq').length,
          b2sOrders: orders.filter(o => o.order_type === 'b2s').length,
          b2cOrders: orders.filter(o => !o.order_type || o.order_type === 'b2c').length,
        });
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredTxns = activeMethod === 'all'
    ? transactions
    : transactions.filter(t => t.type === activeMethod);

  return (
    <div className="space-y-6" dir={dir}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">{ui.title}</h2>
          <p className="text-sm text-gray-500 mt-0.5">{ui.subtitle}</p>
        </div>
        <button onClick={fetchData} className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors">
          <Icon name="ArrowPathIcon" size={18} className="text-gray-600" />
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: ui.totalRevenue, value: `${stats.totalRevenue.toLocaleString()} ${ui.sar}`, icon: 'BanknotesIcon', color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: ui.pendingOrders, value: stats.pendingOrders, icon: 'ClockIcon', color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: ui.activeEscrow, value: stats.activeEscrow, icon: 'ShieldCheckIcon', color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: ui.completedDeals, value: stats.completedDeals, icon: 'CheckBadgeIcon', color: 'text-green-600', bg: 'bg-green-50' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center shrink-0`}>
              <Icon name={s.icon as any} size={20} className={s.color} />
            </div>
            <div>
              <p className="text-xs text-gray-500">{s.label}</p>
              <p className="font-bold text-gray-900 text-sm">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Sales Method Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {methods.map(method => (
          <div key={method.id} className={`bg-white rounded-2xl border ${method.borderColor} p-5`}>
            <div className="flex items-start gap-3 mb-4">
              <div className={`w-11 h-11 rounded-xl ${method.bgColor} flex items-center justify-center shrink-0`}>
                <Icon name={method.icon as any} size={22} className={method.color} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <h3 className="font-bold text-gray-900 text-sm">{method.title}</h3>
                  <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${method.bgColor} ${method.color}`}>
                    {method.badge}
                  </span>
                </div>
                <p className="text-xs text-gray-500">{method.desc}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {method.actions.map(action => (
                <Link
                  key={action.href}
                  href={action.href}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                    action.primary
                      ? `${method.bgColor} ${method.color} hover:opacity-80`
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Icon name={action.icon as any} size={13} />
                  {action.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-bold text-gray-900 text-sm">{ui.recentTxns}</h3>
          {/* Filter tabs */}
          <div className="flex gap-1">
            {(['all', 'b2b_rfq', 'b2s_light', 'b2c_direct', 'escrow_deal'] as const).map(m => (
              <button
                key={m}
                onClick={() => setActiveMethod(m)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  activeMethod === m ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {m === 'all' ? t.admin.all : TYPE_LABELS[m]}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-sm text-gray-500">{ui.loading}</p>
          </div>
        ) : filteredTxns.length === 0 ? (
          <div className="p-8 text-center">
            <Icon name="ArchiveBoxIcon" size={32} className="text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">{ui.empty}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filteredTxns.map(txn => {
              const statusCfg = statusConfig[txn.status] || statusConfig.pending;
              return (
                <div key={txn.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-gray-600">{TYPE_LABELS[txn.type]}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{ui.orderLabel.replace('{id}', txn.id.slice(0, 8))}</p>
                    <p className="text-xs text-gray-500">{new Date(txn.created_at).toLocaleDateString(language === 'ar' ? 'ar-SA' : undefined)}</p>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-gray-900">{txn.amount.toLocaleString()} {txn.currency}</p>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusCfg.bg} ${statusCfg.color}`}>
                      {statusCfg.label}
                    </span>
                  </div>
                  {txn.order_id && (
                    <Link href={`/orders`} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                      <Icon name="ArrowTopRightOnSquareIcon" size={14} className="text-gray-400" />
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
