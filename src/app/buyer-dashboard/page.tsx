'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { useRealtimeOrders } from '@/lib/hooks/useRealtimeOrders';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import Icon from '@/components/ui/AppIcon';
import { useLanguage } from '@/contexts/LanguageContext';
import CreateRFQModal from '@/components/CreateRFQModal';
import {
  resolvePlatformRole,
  getHomeRoomForRole,
} from '@/lib/roomIsolation';
import CFOApprovalWidget from '@/components/CFOApprovalWidget';
import { Truck, ShieldCheck, AlertTriangle } from 'lucide-react';
import BuyerEscrowTrackingPanel from './BuyerEscrowTrackingPanel';
import BuyerArchivePanel from './BuyerArchivePanel';
import BuyerSellerFulfillmentPanel from './BuyerSellerFulfillmentPanel';

interface BuyerStats {
  totalOrders: number;
  pendingOrders: number;
  deliveredOrders: number;
  totalSpent: number;
  activeRFQs: number;
  wishlistCount: number;
  disputeCount: number;
  savedAddresses: number;
}

interface RecentOrder {
  id: string;
  order_number: string;
  status: string;
  total: number;
  created_at: string;
  items: any[];
  escrow_status: string | null;
  dispute_status: string | null;
}

interface RecentRFQ {
  id: string;
  product_name: string;
  status: string;
  quantity: number;
  unit: string;
  currency: string;
  target_price: number | null;
  created_at: string;
  quote_count: number;
}

const STATUS_CONFIG: Record<string, { labelKey: string; color: string; icon: string }> = {
  pending: { labelKey: 'statusPending', color: 'bg-amber-50 text-amber-700 border border-amber-200', icon: 'ClockIcon' },
  processing: { labelKey: 'statusProcessing', color: 'bg-blue-50 text-blue-700 border border-blue-200', icon: 'CogIcon' },
  shipped: { labelKey: 'statusShipped', color: 'bg-purple-50 text-purple-700 border border-purple-200', icon: 'TruckIcon' },
  delivered: { labelKey: 'statusDelivered', color: 'bg-emerald-50 text-emerald-700 border border-emerald-200', icon: 'CheckCircleIcon' },
  cancelled: { labelKey: 'statusCancelled', color: 'bg-red-50 text-red-700 border border-red-200', icon: 'XCircleIcon' },
};

const RFQ_STATUS_CONFIG: Record<string, { labelKey: string; color: string; icon: string; dotColor: string }> = {
  pending: { labelKey: 'rfqPending', color: 'bg-amber-50 text-amber-700 border border-amber-200', icon: 'ClockIcon', dotColor: 'bg-amber-400' },
  responded: { labelKey: 'rfqResponded', color: 'bg-blue-50 text-blue-700 border border-blue-200', icon: 'ChatBubbleLeftRightIcon', dotColor: 'bg-blue-500' },
  accepted: { labelKey: 'rfqAccepted', color: 'bg-emerald-50 text-emerald-700 border border-emerald-200', icon: 'CheckCircleIcon', dotColor: 'bg-emerald-500' },
  rejected: { labelKey: 'rfqRejected', color: 'bg-red-50 text-red-700 border border-red-200', icon: 'XCircleIcon', dotColor: 'bg-red-400' },
  expired: { labelKey: 'rfqExpired', color: 'bg-gray-100 text-gray-500 border border-gray-200', icon: 'ExclamationCircleIcon', dotColor: 'bg-gray-400' },
  open: { labelKey: 'rfqOpen', color: 'bg-emerald-50 text-emerald-700 border border-emerald-200', icon: 'CheckCircleIcon', dotColor: 'bg-emerald-400' },
  quoted: { labelKey: 'rfqQuoted', color: 'bg-blue-50 text-blue-700 border border-blue-200', icon: 'ChatBubbleLeftRightIcon', dotColor: 'bg-blue-500' },
  closed: { labelKey: 'rfqClosed', color: 'bg-gray-100 text-gray-600 border border-gray-200', icon: 'XCircleIcon', dotColor: 'bg-gray-400' },
  awarded: { labelKey: 'rfqAwarded', color: 'bg-purple-50 text-purple-700 border border-purple-200', icon: 'CheckBadgeIcon', dotColor: 'bg-purple-500' },
};

export default function BuyerDashboard() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const supabase = createClient();
  const { t, dir, language } = useLanguage();
  const b = t.buyerDashboard;

  const [stats, setStats] = useState<BuyerStats>({
    totalOrders: 0, pendingOrders: 0, deliveredOrders: 0, totalSpent: 0,
    activeRFQs: 0, wishlistCount: 0, disputeCount: 0, savedAddresses: 0,
  });
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [recentRFQs, setRecentRFQs] = useState<RecentRFQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'orders' | 'rfqs' | 'escrow' | 'escrow_tracking' | 'seller_fulfillment' | 'archive'>('overview');
  const [showCreateRFQ, setShowCreateRFQ] = useState(false);
  const [rfqSuccessMsg, setRfqSuccessMsg] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/login?redirect=/buyer-dashboard');
      return;
    }
    const platformRole = resolvePlatformRole({
      metadataRole:
        (user.user_metadata?.role as string | undefined) ||
        (user.app_metadata?.role as string | undefined) ||
        null,
    });
    if (platformRole !== 'buyer' && platformRole !== 'admin' && platformRole !== 'unknown') {
      router.replace(getHomeRoomForRole(platformRole));
    }
  }, [user, authLoading, router]);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [ordersRes, rfqsRes, wishlistRes] = await Promise.all([
        supabase.from('orders').select('id, order_number, status, total, created_at, items, escrow_status, dispute_status').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20),
        supabase.from('rfq_requests').select('id, product_name, status, quantity, unit, currency, target_price, created_at').eq('buyer_id', user.id).order('created_at', { ascending: false }).limit(20),
        supabase.from('wishlists').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      ]);

      const orders = ordersRes.data || [];
      const rfqsRaw = rfqsRes.data || [];

      // Enrich RFQs with quote counts
      const rfqsEnriched: RecentRFQ[] = await Promise.all(
        rfqsRaw.map(async (rfq: any) => {
          const { count } = await supabase
            .from('rfq_responses')
            .select('*', { count: 'exact', head: true })
            .eq('rfq_id', rfq.id);
          return { ...rfq, quote_count: count || 0 };
        })
      );

      setStats({
        totalOrders: orders.length,
        pendingOrders: orders.filter((o: any) => ['pending', 'processing', 'shipped'].includes(o.status)).length,
        deliveredOrders: orders.filter((o: any) => o.status === 'delivered').length,
        totalSpent: orders.filter((o: any) => o.status === 'delivered').reduce((s: number, o: any) => s + (o.total || 0), 0),
        activeRFQs: rfqsEnriched.filter((r) => ['pending', 'responded', 'open'].includes(r.status)).length,
        wishlistCount: wishlistRes.count || 0,
        disputeCount: orders.filter((o: any) => o.dispute_status && !['none', null].includes(o.dispute_status)).length,
        savedAddresses: 0,
      });

      setRecentOrders(orders.slice(0, 5) as RecentOrder[]);
      setRecentRFQs(rfqsEnriched);
    } catch (err) {
      console.error('Buyer dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [user, supabase]);

  useEffect(() => {
    if (user) fetchData();
  }, [user, fetchData]);

  // Real-time subscription for RFQ updates
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('buyer-rfq-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rfq_requests', filter: `buyer_id=eq.${user.id}` },
        () => { fetchData(); }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'rfq_responses' },
        () => { fetchData(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, supabase, fetchData]);

  // ── Real-time order sync ─────────────────────────────────────────────────
  useRealtimeOrders({
    channelName: 'buyer-dashboard-orders-rt',
    filterColumn: 'user_id',
    userId: user?.id,
    onOrderChange: fetchData,
    enabled: !!user,
  });

  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Buyer';

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">{b.loading}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" dir={dir}>
      <Header />

      {/* RFQ Success Toast */}
      {rfqSuccessMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-xl text-sm font-semibold animate-fade-in">
          <Icon name="CheckCircleIcon" size={18} />
          {rfqSuccessMsg}
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 md:px-6 py-6 mobile-safe-bottom md:pb-8">

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {b.welcomeBack.replace('{name}', userName)}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {b.subtitle}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCreateRFQ(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity"
            >
              <Icon name="PlusIcon" size={16} />
              {b.postRFQ}
            </button>
            <Link href="/search" className="flex items-center gap-2 px-4 py-2 border border-border text-sm font-medium rounded-lg hover:bg-muted transition-colors">
              <Icon name="MagnifyingGlassIcon" size={16} />
              {b.browse}
            </Link>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: b.totalOrders, value: stats.totalOrders, icon: 'ShoppingBagIcon', color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: b.activeOrders, value: stats.pendingOrders, icon: 'ClockIcon', color: 'text-amber-600', bg: 'bg-amber-50' },
            { label: b.delivered, value: stats.deliveredOrders, icon: 'CheckCircleIcon', color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: b.totalSpent, value: `$${stats.totalSpent.toLocaleString()}`, icon: 'BanknotesIcon', color: 'text-purple-600', bg: 'bg-purple-50' },
          ].map((stat, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4">
              <div className={`w-9 h-9 ${stat.bg} rounded-lg flex items-center justify-center mb-3`}>
                <Icon name={stat.icon as any} size={18} className={stat.color} />
              </div>
              <p className="text-2xl font-bold text-foreground">{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: b.myOrders, href: '/orders', icon: 'TruckIcon', badge: stats.pendingOrders > 0 ? stats.pendingOrders : undefined },
            { label: b.wishlist, href: '/wishlist', icon: 'HeartIcon', badge: stats.wishlistCount > 0 ? stats.wishlistCount : undefined },
            { label: b.myRFQs, href: '/rfq-board', icon: 'DocumentTextIcon', badge: stats.activeRFQs > 0 ? stats.activeRFQs : undefined },
            { label: b.disputes, href: '/disputes', icon: 'ScaleIcon', badge: stats.disputeCount > 0 ? stats.disputeCount : undefined },
          ].map((action, i) => (
            <Link key={i} href={action.href} className="relative bg-card border border-border rounded-xl p-4 flex flex-col items-center gap-2 hover:border-primary/40 hover:bg-muted/30 transition-colors group">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <Icon name={action.icon as any} size={20} className="text-primary" />
              </div>
              <span className="text-xs font-semibold text-foreground text-center">{action.label}</span>
              {action.badge !== undefined && (
                <span className="absolute top-2 right-2 min-w-[18px] h-[18px] bg-primary text-primary-foreground text-[9px] font-bold rounded-full flex items-center justify-center px-1">
                  {action.badge}
                </span>
              )}
            </Link>
          ))}
        </div>

        {/* Live Quick-Action Shortcut Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {/* Shipment Tracking */}
          <Link
            href="/order-tracking"
            className="group relative bg-gradient-to-br from-blue-50 to-blue-100/60 border border-blue-200 rounded-2xl p-5 flex items-start gap-4 hover:shadow-md hover:border-blue-400 transition-all overflow-hidden"
          >
            <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
              <Truck className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-blue-900">
                {language === 'ar' ? 'تتبع الشحنات' : 'Shipment Tracking'}
              </p>
              <p className="text-xs text-blue-700/80 mt-0.5 leading-relaxed">
                {language === 'ar' ?'تابع حالة طلباتك ومواقع الشحن لحظة بلحظة' :'Track your orders and shipment locations in real time'}
              </p>
              {stats.pendingOrders > 0 && (
                <span className="inline-flex items-center gap-1 mt-2 text-[10px] font-bold text-blue-700 bg-blue-200/70 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                  {stats.pendingOrders} {language === 'ar' ? 'طلب نشط' : 'active shipment(s)'}
                </span>
              )}
            </div>
            <div className="absolute bottom-0 right-0 w-20 h-20 bg-blue-200/30 rounded-full -mb-8 -mr-8 pointer-events-none" />
          </Link>

          {/* Escrow Management */}
          <button
            onClick={() => setActiveTab('escrow')}
            className="group relative bg-gradient-to-br from-emerald-50 to-emerald-100/60 border border-emerald-200 rounded-2xl p-5 flex items-start gap-4 hover:shadow-md hover:border-emerald-400 transition-all overflow-hidden text-left w-full"
          >
            <div className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-emerald-900">
                {language === 'ar' ? 'إدارة الضمان المالي (Escrow)' : 'Escrow Management'}
              </p>
              <p className="text-xs text-emerald-700/80 mt-0.5 leading-relaxed">
                {language === 'ar' ?'راجع حالة الدفع المحمي وموافقات CFO' :'Review protected payment status and CFO approvals'}
              </p>
              <span className="inline-flex items-center gap-1 mt-2 text-[10px] font-bold text-emerald-700 bg-emerald-200/70 px-2 py-0.5 rounded-full">
                <ShieldCheck className="w-3 h-3" />
                {language === 'ar' ? 'مدفوعات محمية' : 'Secured Payments'}
              </span>
            </div>
            <div className="absolute bottom-0 right-0 w-20 h-20 bg-emerald-200/30 rounded-full -mb-8 -mr-8 pointer-events-none" />
          </button>

          {/* Disputes */}
          <Link
            href="/disputes"
            className="group relative bg-gradient-to-br from-amber-50 to-orange-100/60 border border-amber-200 rounded-2xl p-5 flex items-start gap-4 hover:shadow-md hover:border-amber-400 transition-all overflow-hidden"
          >
            <div className="w-12 h-12 bg-amber-500 rounded-xl flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
              <AlertTriangle className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-amber-900">
                {language === 'ar' ? 'النزاعات والمطالبات' : 'Disputes & Claims'}
              </p>
              <p className="text-xs text-amber-700/80 mt-0.5 leading-relaxed">
                {language === 'ar' ?'أدر نزاعاتك المفتوحة وتابع حالة المطالبات' :'Manage open disputes and track claim statuses'}
              </p>
              {stats.disputeCount > 0 ? (
                <span className="inline-flex items-center gap-1 mt-2 text-[10px] font-bold text-amber-700 bg-amber-200/70 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
                  {stats.disputeCount} {language === 'ar' ? 'نزاع مفتوح' : 'open dispute(s)'}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 mt-2 text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                  {language === 'ar' ? 'لا توجد نزاعات' : 'No open disputes'}
                </span>
              )}
            </div>
            <div className="absolute bottom-0 right-0 w-20 h-20 bg-amber-200/30 rounded-full -mb-8 -mr-8 pointer-events-none" />
          </Link>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-muted/50 p-1 rounded-xl mb-5 w-fit overflow-x-auto">
          {(['overview', 'orders', 'rfqs', 'escrow', 'escrow_tracking', 'seller_fulfillment', 'archive'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors whitespace-nowrap ${
                activeTab === tab ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab === 'overview' ? b.overview
                : tab === 'orders' ? b.orders
                : tab === 'rfqs' ? b.myRFQs
                : tab === 'escrow' ? (language === 'ar' ? '🏦 اعتماد CFO' : '🏦 CFO Escrow')
                : tab === 'escrow_tracking' ? (language === 'ar' ? '📦 متابعة الضمان المالي' : '📦 Escrow Tracking')
                : tab === 'seller_fulfillment' ? (language === 'ar' ? '🚢 الشحن الشامل' : '🚢 Seller Shipping')
                : (language === 'ar' ? '🗂 المستندات' : '🗂 Documents')}
              {tab === 'rfqs' && stats.activeRFQs > 0 && (
                <span className="ms-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] bg-primary text-primary-foreground text-[9px] font-bold rounded-full px-1">
                  {stats.activeRFQs}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Recent Orders */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <h2 className="font-semibold text-foreground">{b.recentOrders}</h2>
                <Link href="/orders" className="text-xs text-primary font-medium hover:underline">{b.viewAll}</Link>
              </div>
              <div className="divide-y divide-border">
                {recentOrders.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-2">
                    <Icon name="ShoppingBagIcon" size={32} className="text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">{b.noOrdersYet}</p>
                    <Link href="/search" className="text-xs text-primary font-medium hover:underline">{b.startShopping}</Link>
                  </div>
                ) : recentOrders.map((order) => {
                  const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
                  return (
                    <Link key={order.id} href="/orders" className="flex items-center gap-3 px-5 py-3.5 hover:bg-muted/30 transition-colors">
                      <div className="w-9 h-9 bg-muted rounded-lg flex items-center justify-center shrink-0">
                        <Icon name={cfg.icon as any} size={16} className="text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">#{order.order_number}</p>
                        <p className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleDateString()}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.color}`}>
                          {(b as any)[cfg.labelKey] || cfg.labelKey}
                        </span>
                        <span className="text-xs font-bold text-foreground">${order.total?.toLocaleString()}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Recent RFQs */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold text-foreground">{b.myRFQs}</h2>
                  {stats.activeRFQs > 0 && (
                    <span className="min-w-[20px] h-5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center px-1.5">
                      {stats.activeRFQs}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowCreateRFQ(true)}
                    className="flex items-center gap-1 text-xs text-primary font-semibold hover:underline"
                  >
                    <Icon name="PlusIcon" size={12} />
                    {b.new}
                  </button>
                  <span className="text-muted-foreground">·</span>
                  <Link href="/rfq-board" className="text-xs text-primary font-medium hover:underline">{b.viewAll}</Link>
                </div>
              </div>
              <div className="divide-y divide-border">
                {recentRFQs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-2">
                    <Icon name="DocumentTextIcon" size={32} className="text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">{b.noRFQsYet}</p>
                    <button onClick={() => setShowCreateRFQ(true)} className="text-xs text-primary font-medium hover:underline">
                      {b.postAnRFQ}
                    </button>
                  </div>
                ) : recentRFQs.slice(0, 5).map((rfq) => {
                  const cfg = RFQ_STATUS_CONFIG[rfq.status] || RFQ_STATUS_CONFIG.pending;
                  return (
                    <Link key={rfq.id} href="/rfq-board" className="flex items-center gap-3 px-5 py-3.5 hover:bg-muted/30 transition-colors">
                      <div className="w-9 h-9 bg-muted rounded-lg flex items-center justify-center shrink-0 relative">
                        <Icon name="DocumentTextIcon" size={16} className="text-muted-foreground" />
                        <span className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-card ${cfg.dotColor}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{rfq.product_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {b.qty.replace('{qty}', String(rfq.quantity)).replace('{unit}', rfq.unit || '')}
                          {rfq.quote_count > 0 && (
                            <span className="ms-2 text-blue-600 font-semibold">
                              · {rfq.quote_count} {rfq.quote_count === 1 ? b.offer : b.offers}
                            </span>
                          )}
                        </p>
                      </div>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${cfg.color}`}>
                        {(b as any)[cfg.labelKey] || cfg.labelKey}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Spending Summary */}
            <div className="bg-card border border-border rounded-xl p-5 lg:col-span-2">
              <h2 className="font-semibold text-foreground mb-4">{b.accountSummary}</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: b.totalSpent, value: `$${stats.totalSpent.toLocaleString()}`, icon: 'BanknotesIcon', color: 'text-emerald-600' },
                  { label: b.completedOrders, value: stats.deliveredOrders, icon: 'CheckBadgeIcon', color: 'text-blue-600' },
                  { label: b.activeOrders, value: stats.pendingOrders, icon: 'ArrowPathIcon', color: 'text-amber-600' },
                  { label: b.openDisputes, value: stats.disputeCount, icon: 'ExclamationTriangleIcon', color: 'text-red-600' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                    <Icon name={item.icon as any} size={20} className={item.color} />
                    <div>
                      <p className="text-lg font-bold text-foreground">{item.value}</p>
                      <p className="text-xs text-muted-foreground">{item.label}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Orders Tab */}
        {activeTab === 'orders' && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="font-semibold text-foreground">{b.allOrders}</h2>
              <Link href="/orders" className="text-xs text-primary font-medium hover:underline">{b.fullPage}</Link>
            </div>
            <div className="divide-y divide-border">
              {recentOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <Icon name="ShoppingBagIcon" size={40} className="text-muted-foreground/30" />
                  <p className="text-muted-foreground">{b.noOrdersYet}</p>
                  <Link href="/search" className="px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg">
                    {b.startShopping}
                  </Link>
                </div>
              ) : recentOrders.map((order) => {
                const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
                return (
                  <Link key={order.id} href="/orders" className="flex items-center gap-4 px-5 py-4 hover:bg-muted/30 transition-colors">
                    <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center shrink-0">
                      <Icon name="ShoppingBagIcon" size={18} className="text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">#{order.order_number}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {Array.isArray(order.items) ? `${order.items.length} ${b.items}` : ''} · {new Date(order.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.color}`}>
                        {(b as any)[cfg.labelKey] || cfg.labelKey}
                      </span>
                      <span className="text-sm font-bold text-foreground">${order.total?.toLocaleString()}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* RFQs Tab */}
        {activeTab === 'rfqs' && (
          <div className="space-y-4">
            {/* RFQ Status Summary */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: b.pending, value: recentRFQs.filter(r => r.status === 'pending').length, color: 'text-amber-600 bg-amber-50', icon: 'ClockIcon' },
                { label: b.offersReceived, value: recentRFQs.filter(r => r.status === 'responded').length, color: 'text-blue-600 bg-blue-50', icon: 'ChatBubbleLeftRightIcon' },
                { label: b.accepted, value: recentRFQs.filter(r => r.status === 'accepted').length, color: 'text-emerald-600 bg-emerald-50', icon: 'CheckCircleIcon' },
              ].map((s, i) => (
                <div key={i} className={`flex items-center gap-3 p-3 rounded-xl ${s.color}`}>
                  <Icon name={s.icon as any} size={18} />
                  <div>
                    <p className="text-xl font-bold">{s.value}</p>
                    <p className="text-xs font-medium">{s.label}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <h2 className="font-semibold text-foreground">{b.myQuoteRequests}</h2>
                <button
                  onClick={() => setShowCreateRFQ(true)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:opacity-90 transition-opacity"
                >
                  <Icon name="PlusIcon" size={14} />
                  {b.createRFQ}
                </button>
              </div>
              <div className="divide-y divide-border">
                {recentRFQs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-3">
                    <Icon name="DocumentTextIcon" size={40} className="text-muted-foreground/30" />
                    <p className="text-muted-foreground">{b.noRFQsYet}</p>
                    <button
                      onClick={() => setShowCreateRFQ(true)}
                      className="px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg"
                    >
                      {b.postAnRFQ}
                    </button>
                  </div>
                ) : recentRFQs.map((rfq) => {
                  const cfg = RFQ_STATUS_CONFIG[rfq.status] || RFQ_STATUS_CONFIG.pending;
                  return (
                    <Link key={rfq.id} href="/rfq-board" className="flex items-center gap-4 px-5 py-4 hover:bg-muted/30 transition-colors">
                      <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center shrink-0 relative">
                        <Icon name="DocumentTextIcon" size={18} className="text-muted-foreground" />
                        <span className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-card ${cfg.dotColor}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{rfq.product_name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {b.qty.replace('{qty}', String(rfq.quantity)).replace('{unit}', rfq.unit || '')}
                          {rfq.target_price && (
                            <span className="ms-2">· {rfq.currency} {rfq.target_price.toLocaleString()}</span>
                          )}
                          {rfq.quote_count > 0 && (
                            <span className="ms-2 text-blue-600 font-semibold">
                              · {rfq.quote_count} {rfq.quote_count === 1 ? b.offer : b.offers}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.color}`}>
                          {(b as any)[cfg.labelKey] || cfg.labelKey}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{new Date(rfq.created_at).toLocaleDateString()}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Escrow CFO Tab */}
        {activeTab === 'escrow' && (
          <div className="bg-card border border-border rounded-xl p-5">
            <CFOApprovalWidget userId={user?.id} isAdmin={false} />
          </div>
        )}

        {/* Escrow Tracking Tab */}
        {activeTab === 'escrow_tracking' && (
          <div className="bg-card border border-border rounded-xl p-5">
            <BuyerEscrowTrackingPanel userId={user?.id} />
          </div>
        )}

        {/* Seller Fulfillment Tab */}
        {activeTab === 'seller_fulfillment' && user?.id && (
          <BuyerSellerFulfillmentPanel userId={user.id} />
        )}

        {/* Archive Tab */}
        {activeTab === 'archive' && (
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
            <h2 className="text-lg font-semibold text-white mb-4">{language === 'ar' ? 'المستندات المشتركة' : 'Shared Documents'}</h2>
            <BuyerArchivePanel userId={user?.id} />
          </div>
        )}
      </main>
      <BottomNav />

      {showCreateRFQ && (
        <CreateRFQModal
          onClose={() => setShowCreateRFQ(false)}
          onSuccess={(newRfq) => {
            setRecentRFQs(prev => [{ ...newRfq, quote_count: 0 }, ...prev]);
            setStats(prev => ({ ...prev, activeRFQs: prev.activeRFQs + 1 }));
            const msg = b.rfqSuccess;
            setRfqSuccessMsg(msg);
            setTimeout(() => setRfqSuccessMsg(''), 4000);
          }}
        />
      )}
    </div>
  );
}
