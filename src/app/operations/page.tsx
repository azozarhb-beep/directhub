'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import Icon from '@/components/ui/AppIcon';
import { useLanguage } from '@/contexts/LanguageContext';

interface OpsStats {
  totalOrders: number;
  pendingOrders: number;
  processingOrders: number;
  shippedOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  disputedOrders: number;
  totalRevenue: number;
  pendingRevenue: number;
  platformCommission: number;
  activeFactories: number;
  pendingKYC: number;
  totalUsers: number;
  newUsersToday: number;
  openRFQs: number;
}

interface RecentOrder {
  id: string;
  order_number: string;
  status: string;
  escrow_status: string | null;
  total: number;
  created_at: string;
  dispute_status: string | null;
  payment_verified: boolean;
  user_profiles?: { full_name: string; company_name: string };
}

interface RecentActivity {
  id: string;
  type: 'order' | 'kyc' | 'dispute' | 'user' | 'rfq';
  title: string;
  subtitle: string;
  time: string;
  color: string;
  icon: string;
}

const ORDER_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  processing: 'bg-blue-50 text-blue-700 border-blue-200',
  shipped: 'bg-purple-50 text-purple-700 border-purple-200',
  delivered: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
};

type ActiveTab = 'overview' | 'orders' | 'tracking' | 'activity';

export default function OperationsDashboard() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const supabase = createClient();
  const { t, dir, isRTL, language } = useLanguage();
  const pg = t.operationsPage;
  const statusLabel = (status: string) => ({
    pending: pg.statusPending,
    processing: pg.statusProcessing,
    shipped: pg.statusShipped,
    delivered: pg.statusDelivered,
    cancelled: pg.statusCancelled,
  } as Record<string, string>)[status] || status;

  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [stats, setStats] = useState<OpsStats>({
    totalOrders: 0, pendingOrders: 0, processingOrders: 0, shippedOrders: 0,
    deliveredOrders: 0, cancelledOrders: 0, disputedOrders: 0,
    totalRevenue: 0, pendingRevenue: 0, platformCommission: 0,
    activeFactories: 0, pendingKYC: 0, totalUsers: 0, newUsersToday: 0, openRFQs: 0,
  });
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [activities, setActivities] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('all');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const userRole = user?.user_metadata?.role || 'buyer';
  const isAdmin = userRole === 'admin';

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/login'); return; }
    if (!isAdmin) { router.push('/'); return; }
  }, [user, authLoading, isAdmin, router]);

  const fetchData = useCallback(async () => {
    if (!user || !isAdmin) return;
    setLoading(true);
    try {
      // Use parallel queries with tight limits — count-only queries for stats, small list for display
      const [ordersRes, factoriesCountRes, usersCountRes, rfqsCountRes, newUsersTodayRes] = await Promise.all([
        supabase
          .from('orders')
          .select('id, order_number, status, escrow_status, total, created_at, dispute_status, payment_verified, user_profiles!orders_user_id_fkey(full_name, company_name)')
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('factory_registrations')
          .select('id, kyc_status, is_active')
          .limit(300),
        supabase
          .from('user_profiles')
          .select('id', { count: 'exact', head: true }),
        supabase
          .from('rfq_requests')
          .select('id, status')
          .eq('status', 'open')
          .limit(200),
        supabase
          .from('user_profiles')
          .select('id')
          .gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
          .limit(100),
      ]);

      const orders = ordersRes.data || [];
      const factories = factoriesCountRes.data || [];
      const totalUsers = usersCountRes.count ?? 0;
      const openRFQs = rfqsCountRes.data?.length ?? 0;
      const newUsersToday = newUsersTodayRes.data?.length ?? 0;

      const newStats: OpsStats = {
        totalOrders: orders.length,
        pendingOrders: orders.filter((o: any) => o.status === 'pending').length,
        processingOrders: orders.filter((o: any) => o.status === 'processing').length,
        shippedOrders: orders.filter((o: any) => o.status === 'shipped').length,
        deliveredOrders: orders.filter((o: any) => o.status === 'delivered').length,
        cancelledOrders: orders.filter((o: any) => o.status === 'cancelled').length,
        disputedOrders: orders.filter((o: any) => o.dispute_status && !['none', null].includes(o.dispute_status)).length,
        totalRevenue: orders.filter((o: any) => o.status === 'delivered').reduce((s: number, o: any) => s + (o.total || 0), 0),
        pendingRevenue: orders.filter((o: any) => ['processing', 'shipped'].includes(o.status)).reduce((s: number, o: any) => s + (o.total || 0), 0),
        platformCommission: orders.filter((o: any) => o.status === 'delivered').reduce((s: number, o: any) => s + (o.total || 0), 0) * 0.03,
        activeFactories: factories.filter((f: any) => f.is_active).length,
        pendingKYC: factories.filter((f: any) => ['pending', 'under_review'].includes(f.kyc_status)).length,
        totalUsers,
        newUsersToday,
        openRFQs,
      };

      setStats(newStats);
      setRecentOrders(orders.slice(0, 20) as RecentOrder[]);

      // Build activity feed
      const activityItems: RecentActivity[] = [
        ...orders.slice(0, 5).map((o: any) => ({
          id: o.id,
          type: 'order' as const,
          title: pg.orderHash.replace('{num}', o.order_number),
          subtitle: `${statusLabel(o.status)} — $${o.total?.toLocaleString()}`,
          time: o.created_at,
          color: 'bg-blue-50 text-blue-600',
          icon: 'ShoppingBagIcon',
        })),
        ...factories.filter((f: any) => f.kyc_status === 'under_review').slice(0, 3).map((f: any) => ({
          id: f.id,
          type: 'kyc' as const,
          title: pg.newKYCRequest,
          subtitle: pg.factoryDocsReview,
          time: new Date().toISOString(),
          color: 'bg-amber-50 text-amber-600',
          icon: 'ShieldCheckIcon',
        })),
      ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 10);

      setActivities(activityItems);
    } catch (err) {
      console.error('Operations fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [user, isAdmin, supabase]);

  useEffect(() => {
    if (user && isAdmin) fetchData();
  }, [user, isAdmin, fetchData]);

  // Real-time subscription — debounced to avoid cascading refetches
  useEffect(() => {
    if (!user || !isAdmin) return;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const debouncedFetch = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => fetchData(), 3000);
    };
    const channel = supabase
      .channel('ops-dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, debouncedFetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'factory_registrations' }, debouncedFetch)
      .subscribe();
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [user, isAdmin, supabase, fetchData]);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleOrderStatusUpdate = async (orderId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', orderId);
      if (error) throw error;
      setRecentOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status: newStatus } : o));
      showToast(pg.statusUpdateSuccess);
    } catch (err: any) {
      showToast(err.message || pg.refreshFailed, 'error');
    }
  };

  const filteredOrders = recentOrders.filter((o) => {
    const matchSearch = !orderSearch || o.order_number.toLowerCase().includes(orderSearch.toLowerCase());
    const matchStatus = orderStatusFilter === 'all' || o.status === orderStatusFilter;
    return matchSearch && matchStatus;
  });

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAdmin) return null;

  const TABS: { key: ActiveTab; label: string; icon: string }[] = [
    { key: 'overview', label: pg.tabOverview, icon: 'ChartBarIcon' },
    { key: 'orders', label: pg.tabOrders, icon: 'ShoppingBagIcon' },
    { key: 'tracking', label: pg.tabTracking, icon: 'MapPinIcon' },
    { key: 'activity', label: pg.tabActivity, icon: 'ClockIcon' },
  ];

  return (
    <div className="min-h-screen bg-background" dir={dir}>
      <Header />

      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 ${toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
          <Icon name={toast.type === 'success' ? 'CheckCircleIcon' : 'ExclamationCircleIcon'} size={16} />
          {toast.msg}
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 py-8 pb-24">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-violet-50 rounded-xl flex items-center justify-center">
              <Icon name="CpuChipIcon" size={22} className="text-violet-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">{pg.dashboardTitle}</h1>
              <p className="text-sm text-muted-foreground">{pg.subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchData}
              className="flex items-center gap-2 px-3 py-2 bg-muted text-foreground text-sm rounded-xl hover:bg-muted/80 transition-colors"
            >
              <Icon name="ArrowPathIcon" size={16} />
              {pg.refresh}
            </button>
            <a href="/admin/control-room" className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-xl">
              <Icon name="ShieldCheckIcon" size={16} />
              {pg.controlRoom}
            </a>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-muted/50 rounded-xl p-1 mb-8 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${
                activeTab === tab.key
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon name={tab.icon as any} size={16} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW TAB ── */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* KPI Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: pg.totalOrders, value: stats.totalOrders, icon: 'ShoppingBagIcon', color: 'bg-blue-50 text-blue-700', sub: pg.pendingSub.replace('{count}', String(stats.pendingOrders)) },
                { label: pg.realizedRevenue, value: `$${stats.totalRevenue.toLocaleString()}`, icon: 'BanknotesIcon', color: 'bg-emerald-50 text-emerald-700', sub: pg.commissionSub.replace('{amount}', stats.platformCommission.toFixed(0)) },
                { label: pg.pendingRevenue, value: `$${stats.pendingRevenue.toLocaleString()}`, icon: 'ClockIcon', color: 'bg-amber-50 text-amber-700', sub: pg.activeOrdersSub.replace('{count}', String(stats.processingOrders + stats.shippedOrders)) },
                { label: pg.openDisputes, value: stats.disputedOrders, icon: 'ScaleIcon', color: 'bg-red-50 text-red-700', sub: pg.needsFollowUp },
              ].map((kpi) => (
                <div key={kpi.label} className={`rounded-2xl p-5 border border-border ${kpi.color}`}>
                  <Icon name={kpi.icon as any} size={22} className="mb-3 opacity-70" />
                  <p className="text-2xl font-bold">{kpi.value}</p>
                  <p className="text-sm font-semibold mt-1">{kpi.label}</p>
                  <p className="text-xs opacity-70 mt-0.5">{kpi.sub}</p>
                </div>
              ))}
            </div>

            {/* Secondary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: pg.activeFactories, value: stats.activeFactories, icon: 'BuildingOffice2Icon', color: 'bg-violet-50 text-violet-700' },
                { label: pg.pendingKYC, value: stats.pendingKYC, icon: 'ShieldCheckIcon', color: 'bg-orange-50 text-orange-700' },
                { label: pg.totalUsers, value: stats.totalUsers, icon: 'UsersIcon', color: 'bg-sky-50 text-sky-700' },
                { label: pg.openRFQs, value: stats.openRFQs, icon: 'DocumentTextIcon', color: 'bg-pink-50 text-pink-700' },
              ].map((stat) => (
                <div key={stat.label} className={`rounded-2xl p-4 border border-border ${stat.color}`}>
                  <Icon name={stat.icon as any} size={18} className="mb-2 opacity-70" />
                  <p className="text-xl font-bold">{stat.value}</p>
                  <p className="text-xs font-medium opacity-70 mt-0.5">{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Order Status Breakdown */}
            <div className="bg-card border border-border rounded-2xl p-6">
              <h2 className="font-bold text-foreground mb-5 flex items-center gap-2">
                <Icon name="ChartPieIcon" size={18} className="text-primary" />
                {pg.statusDistribution}
              </h2>
              <div className="space-y-3">
                {[
                  { label: pg.statusPending, value: stats.pendingOrders, color: 'bg-amber-400', total: stats.totalOrders },
                  { label: pg.statusProcessing, value: stats.processingOrders, color: 'bg-blue-400', total: stats.totalOrders },
                  { label: pg.statusShipped, value: stats.shippedOrders, color: 'bg-purple-400', total: stats.totalOrders },
                  { label: pg.statusDelivered, value: stats.deliveredOrders, color: 'bg-emerald-400', total: stats.totalOrders },
                  { label: pg.statusCancelled, value: stats.cancelledOrders, color: 'bg-red-400', total: stats.totalOrders },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground w-24 shrink-0">{item.label}</span>
                    <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${item.color} transition-all duration-700`}
                        style={{ width: item.total > 0 ? `${(item.value / item.total) * 100}%` : '0%' }}
                      />
                    </div>
                    <span className="text-sm font-bold text-foreground w-8 text-right">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Links */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: pg.quickKYC, href: '/kyc', icon: 'ShieldCheckIcon', color: 'bg-amber-50 hover:bg-amber-100 text-amber-700' },
                { label: pg.quickDisputes, href: '/disputes', icon: 'ScaleIcon', color: 'bg-red-50 hover:bg-red-100 text-red-700' },
                { label: pg.controlRoom, href: '/admin/control-room', icon: 'CpuChipIcon', color: 'bg-violet-50 hover:bg-violet-100 text-violet-700' },
                { label: pg.quickFulfillment, href: '/order-fulfillment', icon: 'TruckIcon', color: 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700' },
              ].map((link) => (
                <a key={link.label} href={link.href} className={`flex flex-col items-center gap-2 p-4 rounded-2xl border border-border transition-colors ${link.color}`}>
                  <Icon name={link.icon as any} size={24} />
                  <span className="text-sm font-semibold text-center">{link.label}</span>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* ── ORDERS TAB ── */}
        {activeTab === 'orders' && (
          <div>
            <div className="flex items-center gap-3 mb-5 flex-wrap">
              <div className="relative flex-1 min-w-48">
                <Icon name="MagnifyingGlassIcon" size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder={pg.searchOrderPlaceholder}
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  className="w-full pr-9 pl-4 py-2.5 text-sm border border-border rounded-xl bg-card focus:outline-none focus:border-primary"
                />
              </div>
              <select
                value={orderStatusFilter}
                onChange={(e) => setOrderStatusFilter(e.target.value)}
                className="px-3 py-2.5 text-sm border border-border rounded-xl bg-card text-foreground focus:outline-none focus:border-primary"
              >
                <option value="all">{pg.allStatuses}</option>
                {Object.keys(ORDER_STATUS_COLORS).map((k) => (
                  <option key={k} value={k}>{statusLabel(k)}</option>
                ))}
              </select>
              <span className="text-sm text-muted-foreground">{pg.orderCount.replace('{count}', String(filteredOrders.length))}</span>
            </div>

            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="overflow-x-auto -mx-6 px-6 sm:mx-0 sm:px-0">
                <table className="w-full text-sm min-w-[500px]">
                  <thead className="bg-muted/50 border-b border-border">
                    <tr>
                      <th className="text-right px-4 py-3 font-semibold text-muted-foreground">{pg.colOrderNum}</th>
                      <th className="text-right px-4 py-3 font-semibold text-muted-foreground">{pg.colBuyer}</th>
                      <th className="text-right px-4 py-3 font-semibold text-muted-foreground">{pg.colAmount}</th>
                      <th className="text-right px-4 py-3 font-semibold text-muted-foreground">{pg.colStatus}</th>
                      <th className="text-right px-4 py-3 font-semibold text-muted-foreground">{pg.colEscrow}</th>
                      <th className="text-right px-4 py-3 font-semibold text-muted-foreground">{pg.colDate}</th>
                      <th className="text-right px-4 py-3 font-semibold text-muted-foreground">{pg.colAction}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredOrders.map((order) => {
                      const statusCfg = { label: statusLabel(order.status), color: ORDER_STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-600 border-gray-200' };
                      return (
                        <tr key={order.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 font-mono font-semibold text-primary">#{order.order_number}</td>
                          <td className="px-4 py-3 text-foreground max-w-32 truncate">
                            {order.user_profiles?.company_name || order.user_profiles?.full_name || '—'}
                          </td>
                          <td className="px-4 py-3 font-semibold text-foreground">${order.total?.toLocaleString()}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${statusCfg.color}`}>
                              {statusCfg.label}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {order.escrow_status ? (
                              <span className="text-xs text-muted-foreground">{order.escrow_status.replace(/_/g, ' ')}</span>
                            ) : '—'}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">
                            {new Date(order.created_at).toLocaleDateString(language === 'ar' ? 'ar-SA' : language === 'zh' ? 'zh-CN' : language === 'tr' ? 'tr-TR' : 'en-US')}
                          </td>
                          <td className="px-4 py-3">
                            <select
                              value={order.status}
                              onChange={(e) => handleOrderStatusUpdate(order.id, e.target.value)}
                              className="text-xs px-2 py-1 border border-border rounded-lg bg-background focus:outline-none focus:border-primary"
                            >
                              {Object.keys(ORDER_STATUS_COLORS).map((k) => (
                                <option key={k} value={k}>{statusLabel(k)}</option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {filteredOrders.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <Icon name="ShoppingBagIcon" size={32} className="mx-auto mb-3 opacity-30" />
                    <p>{pg.noOrders}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── TRACKING TAB ── */}
        {activeTab === 'tracking' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  title: pg.needPaymentConfirm,
                  orders: recentOrders.filter((o) => o.status === 'pending' && !o.payment_verified),
                  color: 'border-amber-200 bg-amber-50',
                  badge: 'bg-amber-100 text-amber-700',
                  icon: 'BanknotesIcon',
                },
                {
                  title: pg.inShippingPhase,
                  orders: recentOrders.filter((o) => o.status === 'shipped'),
                  color: 'border-purple-200 bg-purple-50',
                  badge: 'bg-purple-100 text-purple-700',
                  icon: 'TruckIcon',
                },
                {
                  title: pg.disputedOrders,
                  orders: recentOrders.filter((o) => o.dispute_status && !['none', null].includes(o.dispute_status)),
                  color: 'border-red-200 bg-red-50',
                  badge: 'bg-red-100 text-red-700',
                  icon: 'ScaleIcon',
                },
              ].map((group) => (
                <div key={group.title} className={`rounded-2xl border p-5 ${group.color}`}>
                  <div className="flex items-center gap-2 mb-4">
                    <Icon name={group.icon as any} size={18} className="opacity-70" />
                    <h3 className="font-semibold text-sm">{group.title}</h3>
                    <span className={`ml-auto px-2 py-0.5 rounded-full text-xs font-bold ${group.badge}`}>
                      {group.orders.length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {group.orders.slice(0, 5).map((o) => (
                      <div key={o.id} className="bg-white/70 rounded-xl px-3 py-2">
                        <p className="text-xs font-semibold text-foreground">#{o.order_number}</p>
                        <p className="text-xs text-muted-foreground">${o.total?.toLocaleString()}</p>
                      </div>
                    ))}
                    {group.orders.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-4">{pg.noOrders}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Escrow Flow */}
            <div className="bg-card border border-border rounded-2xl p-6">
              <h2 className="font-bold text-foreground mb-5 flex items-center gap-2">
                <Icon name="LockClosedIcon" size={18} className="text-primary" />
                {pg.escrowMovement}
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  { key: 'pending_payment', label: pg.escrowPendingPayment, color: 'bg-gray-50 text-gray-600' },
                  { key: 'pending_verification', label: pg.escrowPendingVerification, color: 'bg-amber-50 text-amber-700' },
                  { key: 'funds_secured', label: pg.escrowFundsSecured, color: 'bg-blue-50 text-blue-700' },
                  { key: 'shipped', label: pg.statusShipped, color: 'bg-purple-50 text-purple-700' },
                  { key: 'funds_released', label: pg.escrowFundsReleased, color: 'bg-emerald-50 text-emerald-700' },
                ].map((phase) => {
                  const count = recentOrders.filter((o) => o.escrow_status === phase.key).length;
                  return (
                    <div key={phase.key} className={`rounded-xl p-3 text-center border border-border ${phase.color}`}>
                      <p className="text-xl font-bold">{count}</p>
                      <p className="text-xs font-medium mt-1 opacity-80">{phase.label}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── ACTIVITY TAB ── */}
        {activeTab === 'activity' && (
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="font-bold text-foreground flex items-center gap-2">
                <Icon name="ClockIcon" size={18} className="text-primary" />
                {pg.recentActivity}
              </h2>
            </div>
            <div className="divide-y divide-border">
              {activities.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Icon name="ClockIcon" size={32} className="mx-auto mb-3 opacity-30" />
                  <p>{pg.noRecentActivity}</p>
                </div>
              ) : (
                activities.map((activity) => (
                  <div key={activity.id} className="flex items-start gap-4 px-5 py-4 hover:bg-muted/30 transition-colors">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${activity.color}`}>
                      <Icon name={activity.icon as any} size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">{activity.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{activity.subtitle}</p>
                    </div>
                    <p className="text-xs text-muted-foreground shrink-0">
                      {new Date(activity.time).toLocaleDateString(language === 'ar' ? 'ar-SA' : language === 'zh' ? 'zh-CN' : language === 'tr' ? 'tr-TR' : 'en-US')}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
