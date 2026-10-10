'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import Icon from '@/components/ui/AppIcon';
import { useLanguage } from '@/contexts/LanguageContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DashboardOrder {
  id: string;
  order_number: string;
  status: string;
  escrow_status: string | null;
  items: any[];
  subtotal: number;
  total: number;
  created_at: string;
  confirmed_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  funds_released_at: string | null;
  payment_verified_at: string | null;
  production_started_at: string | null;
  quality_check_at: string | null;
  expected_delivery_date: string | null;
  agreed_delivery_days: number | null;
  tracking_number: string | null;
  shipping_carrier: string | null;
  dispute_status: string | null;
  manufacturer_id: string | null;
}

interface TrackingStats {
  total: number;
  pending: number;
  inProduction: number;
  shipped: number;
  delivered: number;
  disputed: number;
  totalValue: number;
}

// ─── Status Config ────────────────────────────────────────────────────────────

const STATUS_STEPS: Record<string, number> = {
  pending: 0,
  pending_payment: 0,
  pending_verification: 1,
  funds_secured: 2,
  processing: 2,
  in_production: 3,
  shipped: 4,
  ready_for_inspection: 5,
  pending_otp_confirmation: 5,
  pending_admin_payout: 5,
  delivered: 6,
  funds_released: 6,
  complete: 6,
};

const PIPELINE_STAGES = [
  { key: 'placed', label: 'Placed', icon: 'ShoppingBagIcon', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', dot: 'bg-blue-500' },
  { key: 'verified', label: 'Verified', icon: 'BanknotesIcon', color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200', dot: 'bg-indigo-500' },
  { key: 'secured', label: 'Secured', icon: 'LockClosedIcon', color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-200', dot: 'bg-violet-500' },
  { key: 'production', label: 'Production', icon: 'CogIcon', color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200', dot: 'bg-purple-500' },
  { key: 'shipped', label: 'Shipped', icon: 'TruckIcon', color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200', dot: 'bg-orange-500' },
  { key: 'inspection', label: 'Inspection', icon: 'MagnifyingGlassIcon', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', dot: 'bg-amber-500' },
  { key: 'complete', label: 'Complete', icon: 'CheckBadgeIcon', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-500' },
];

const STATUS_BADGE: Record<string, { label: string; color: string; icon: string }> = {
  pending: { label: 'Pending', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: 'ClockIcon' },
  pending_payment: { label: 'Awaiting Payment', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: 'BanknotesIcon' },
  pending_verification: { label: 'Verifying', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: 'MagnifyingGlassIcon' },
  funds_secured: { label: 'Funds Secured', color: 'bg-indigo-50 text-indigo-700 border-indigo-200', icon: 'LockClosedIcon' },
  processing: { label: 'Processing', color: 'bg-violet-50 text-violet-700 border-violet-200', icon: 'CogIcon' },
  shipped: { label: 'Shipped', color: 'bg-orange-50 text-orange-700 border-orange-200', icon: 'TruckIcon' },
  ready_for_inspection: { label: 'Inspection', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: 'MagnifyingGlassIcon' },
  pending_otp_confirmation: { label: 'Confirm OTP', color: 'bg-orange-50 text-orange-700 border-orange-200', icon: 'EnvelopeIcon' },
  pending_admin_payout: { label: 'Payout Pending', color: 'bg-teal-50 text-teal-700 border-teal-200', icon: 'ClockIcon' },
  delivered: { label: 'Delivered', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: 'CheckCircleIcon' },
  funds_released: { label: 'Complete', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: 'CheckBadgeIcon' },
  escrow_frozen: { label: 'Disputed', color: 'bg-red-50 text-red-700 border-red-200', icon: 'ShieldExclamationIcon' },
  cancelled: { label: 'Cancelled', color: 'bg-gray-100 text-gray-600 border-gray-200', icon: 'XCircleIcon' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getOrderStep(order: DashboardOrder): number {
  const escrow = order.escrow_status || '';
  const status = order.status || '';
  const key = escrow || status;
  return STATUS_STEPS[key] ?? 0;
}

function getStatusBadge(order: DashboardOrder) {
  const key = order.escrow_status || order.status || 'pending';
  return STATUS_BADGE[key] || STATUS_BADGE['pending'];
}

function formatDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatCurrency(v: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(v);
}

function getDeliveryProgress(order: DashboardOrder): number {
  if (!order.created_at || !order.agreed_delivery_days) return 0;
  const start = new Date(order.created_at).getTime();
  const now = Date.now();
  const total = order.agreed_delivery_days * 24 * 60 * 60 * 1000;
  return Math.min(Math.round(((now - start) / total) * 100), 100);
}

function getDaysRemaining(order: DashboardOrder): number | null {
  if (!order.expected_delivery_date) return null;
  const diff = new Date(order.expected_delivery_date).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

// ─── Mini Pipeline Component ──────────────────────────────────────────────────

function MiniPipeline({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {PIPELINE_STAGES.map((stage, idx) => {
        const done = idx < step;
        const active = idx === step;
        return (
          <React.Fragment key={stage.key}>
            <div
              title={stage.label}
              className={`w-5 h-5 rounded-full flex items-center justify-center transition-all ${
                done
                  ? 'bg-primary'
                  : active
                  ? `${stage.bg} border ${stage.border}`
                  : 'bg-muted border border-border'
              }`}
            >
              {done ? (
                <Icon name="CheckIcon" size={9} className="text-primary-foreground" />
              ) : (
                <Icon name={stage.icon as any} size={9} className={active ? stage.color : 'text-muted-foreground'} />
              )}
            </div>
            {idx < PIPELINE_STAGES.length - 1 && (
              <div className={`h-0.5 w-3 rounded-full ${idx < step ? 'bg-primary' : 'bg-border'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, sub, color, bg, border }: {
  icon: string; label: string; value: string | number; sub?: string;
  color: string; bg: string; border: string;
}) {
  return (
    <div className={`rounded-2xl border ${border} ${bg} p-4 flex items-start gap-3`}>
      <div className={`w-10 h-10 rounded-xl ${bg} border ${border} flex items-center justify-center shrink-0`}>
        <Icon name={icon as any} size={18} className={color} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground font-medium truncate">{label}</p>
        <p className={`text-xl font-bold ${color}`}>{value}</p>
        {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Order Row ────────────────────────────────────────────────────────────────

function OrderRow({ order, onClick }: { order: DashboardOrder; onClick: () => void }) {
  const badge = getStatusBadge(order);
  const step = getOrderStep(order);
  const daysLeft = getDaysRemaining(order);
  const deliveryPct = getDeliveryProgress(order);
  const itemCount = Array.isArray(order.items) ? order.items.length : 0;
  const firstItem = Array.isArray(order.items) && order.items[0];
  const productName = firstItem?.name || firstItem?.product_name || 'Order Items';

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-card border border-border rounded-2xl p-4 hover:border-primary/40 hover:shadow-sm transition-all duration-200 group"
    >
      <div className="flex items-start gap-3">
        {/* Order icon */}
        <div className="w-10 h-10 rounded-xl bg-muted border border-border flex items-center justify-center shrink-0 group-hover:bg-primary/5 transition-colors">
          <Icon name="ShoppingBagIcon" size={16} className="text-muted-foreground group-hover:text-primary transition-colors" />
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-bold text-foreground truncate">#{order.order_number}</span>
              {order.dispute_status && (
                <span className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 shrink-0">
                  <Icon name="ExclamationTriangleIcon" size={8} />
                  Dispute
                </span>
              )}
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${badge.color}`}>
              {badge.label}
            </span>
          </div>

          <p className="text-[11px] text-muted-foreground truncate mb-2">
            {productName}{itemCount > 1 ? ` +${itemCount - 1} more` : ''}
          </p>

          {/* Pipeline */}
          <MiniPipeline step={step} />

          {/* Bottom row */}
          <div className="flex items-center justify-between mt-2 gap-2">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-foreground">{formatCurrency(order.total || order.subtotal || 0)}</span>
              <span className="text-[10px] text-muted-foreground">{formatDate(order.created_at)}</span>
            </div>

            {/* Delivery countdown */}
            {daysLeft !== null && step < 6 && (
              <div className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                daysLeft < 0
                  ? 'bg-red-50 text-red-700 border-red-200'
                  : daysLeft <= 3
                  ? 'bg-amber-50 text-amber-700 border-amber-200' :'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}>
                <Icon name="ClockIcon" size={9} />
                {daysLeft < 0 ? `${Math.abs(daysLeft)}d late` : `${daysLeft}d left`}
              </div>
            )}

            {/* Delivery progress bar */}
            {order.agreed_delivery_days && step < 6 && (
              <div className="flex items-center gap-1.5 min-w-0">
                <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      deliveryPct >= 90 ? 'bg-red-500' : deliveryPct >= 70 ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${deliveryPct}%` }}
                  />
                </div>
                <span className="text-[9px] text-muted-foreground shrink-0">{deliveryPct}%</span>
              </div>
            )}
          </div>
        </div>

        <Icon name="ChevronRightIcon" size={14} className="text-muted-foreground shrink-0 mt-1 group-hover:text-primary transition-colors" />
      </div>
    </button>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

type FilterTab = 'all' | 'active' | 'shipped' | 'delivered' | 'disputed';

export default function OrderTrackingDashboard() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const supabase = createClient();
  const { dir } = useLanguage();

  const [orders, setOrders] = useState<DashboardOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [stats, setStats] = useState<TrackingStats>({
    total: 0, pending: 0, inProduction: 0, shipped: 0, delivered: 0, disputed: 0, totalValue: 0,
  });

  // ─── Auth guard ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (authLoading) return;
    if (!user) router.push('/login?redirect=/order-tracking/dashboard');
  }, [user, authLoading, router]);

  // ─── Fetch orders ─────────────────────────────────────────────────────────
  const fetchOrders = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error: err } = await supabase
        .from('orders')
        .select('id, order_number, status, escrow_status, items, subtotal, total, created_at, confirmed_at, shipped_at, delivered_at, funds_released_at, payment_verified_at, production_started_at, quality_check_at, expected_delivery_date, agreed_delivery_days, tracking_number, shipping_carrier, dispute_status, manufacturer_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (err) throw err;
      const list = (data || []) as DashboardOrder[];
      setOrders(list);

      // Compute stats
      const s: TrackingStats = {
        total: list.length,
        pending: 0,
        inProduction: 0,
        shipped: 0,
        delivered: 0,
        disputed: 0,
        totalValue: 0,
      };
      list.forEach((o) => {
        const step = getOrderStep(o);
        if (step <= 1) s.pending++;
        else if (step <= 3) s.inProduction++;
        else if (step === 4 || step === 5) s.shipped++;
        else if (step === 6) s.delivered++;
        if (o.dispute_status) s.disputed++;
        s.totalValue += o.total || o.subtotal || 0;
      });
      setStats(s);
    } catch (e: any) {
      setError(e.message || 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [user, supabase]);

  useEffect(() => {
    if (user) {
      fetchOrders();

      const channel = supabase
        .channel('order-tracking-dashboard')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `user_id=eq.${user.id}`,
        }, (payload) => {
          setLastUpdate(new Date());
          if (payload.eventType === 'INSERT') {
            setOrders((prev) => [payload.new as DashboardOrder, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setOrders((prev) =>
              prev.map((o) => o.id === (payload.new as DashboardOrder).id ? payload.new as DashboardOrder : o)
            );
          }
        })
        .subscribe((status) => setRealtimeConnected(status === 'SUBSCRIBED'));

      return () => { supabase.removeChannel(channel); };
    }
  }, [user, fetchOrders, supabase]);

  // ─── Filtering ────────────────────────────────────────────────────────────
  const filteredOrders = orders.filter((o) => {
    const step = getOrderStep(o);
    const matchesFilter =
      activeFilter === 'all' ? true :
      activeFilter === 'active' ? step >= 1 && step <= 3 :
      activeFilter === 'shipped' ? step === 4 || step === 5 :
      activeFilter === 'delivered' ? step === 6 :
      activeFilter === 'disputed' ? !!o.dispute_status :
      true;

    const q = searchQuery.toLowerCase();
    const matchesSearch = !q ||
      o.order_number?.toLowerCase().includes(q) ||
      o.tracking_number?.toLowerCase().includes(q) ||
      (Array.isArray(o.items) && o.items.some((item: any) =>
        (item.name || item.product_name || '').toLowerCase().includes(q)
      ));

    return matchesFilter && matchesSearch;
  });

  const filterTabs: { key: FilterTab; label: string; count: number; icon: string }[] = [
    { key: 'all', label: 'All Orders', count: stats.total, icon: 'Squares2X2Icon' },
    { key: 'active', label: 'Active', count: stats.pending + stats.inProduction, icon: 'CogIcon' },
    { key: 'shipped', label: 'In Transit', count: stats.shipped, icon: 'TruckIcon' },
    { key: 'delivered', label: 'Delivered', count: stats.delivered, icon: 'CheckBadgeIcon' },
    { key: 'disputed', label: 'Disputed', count: stats.disputed, icon: 'ShieldExclamationIcon' },
  ];

  if (authLoading || (loading && orders.length === 0)) {
    return (
      <div className="min-h-screen bg-background" dir={dir}>
        <Header />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">Loading your orders…</p>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" dir={dir}>
      <Header />

      <main className="max-w-5xl mx-auto px-4 md:px-6 py-6 pb-24 space-y-6">

        {/* ── Page Header ── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Icon name="MapPinIcon" size={16} className="text-primary" />
              </div>
              <h1 className="text-xl font-bold text-foreground">Order Tracking</h1>
              {realtimeConnected && (
                <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Track all your orders in real-time — from payment to delivery
              {lastUpdate && (
                <span className="ml-2 text-primary">· Updated {lastUpdate.toLocaleTimeString()}</span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/order-tracking"
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-muted border border-border hover:border-primary/40 transition-colors text-foreground"
            >
              <Icon name="MagnifyingGlassIcon" size={13} />
              Track Order
            </Link>
            <Link
              href="/orders"
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Icon name="ClipboardDocumentListIcon" size={13} />
              Manage Orders
            </Link>
          </div>
        </div>

        {/* ── Stats Bento Grid ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            icon="ShoppingBagIcon"
            label="Total Orders"
            value={stats.total}
            sub={formatCurrency(stats.totalValue) + ' total value'}
            color="text-blue-700"
            bg="bg-blue-50"
            border="border-blue-200"
          />
          <StatCard
            icon="CogIcon"
            label="In Progress"
            value={stats.pending + stats.inProduction}
            sub={`${stats.inProduction} in production`}
            color="text-violet-700"
            bg="bg-violet-50"
            border="border-violet-200"
          />
          <StatCard
            icon="TruckIcon"
            label="In Transit"
            value={stats.shipped}
            sub="Shipped & awaiting delivery"
            color="text-orange-700"
            bg="bg-orange-50"
            border="border-orange-200"
          />
          <StatCard
            icon="CheckBadgeIcon"
            label="Delivered"
            value={stats.delivered}
            sub={stats.disputed > 0 ? `${stats.disputed} disputed` : 'All clear'}
            color="text-emerald-700"
            bg="bg-emerald-50"
            border="border-emerald-200"
          />
        </div>

        {/* ── Pipeline Legend ── */}
        <div className="bg-card border border-border rounded-2xl p-4">
          <p className="text-xs font-bold text-foreground mb-3">Order Pipeline Stages</p>
          <div className="flex items-center gap-1 flex-wrap">
            {PIPELINE_STAGES.map((stage, idx) => (
              <React.Fragment key={stage.key}>
                <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl ${stage.bg} border ${stage.border}`}>
                  <Icon name={stage.icon as any} size={11} className={stage.color} />
                  <span className={`text-[10px] font-semibold ${stage.color}`}>{stage.label}</span>
                </div>
                {idx < PIPELINE_STAGES.length - 1 && (
                  <Icon name="ChevronRightIcon" size={10} className="text-muted-foreground" />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* ── Search + Filter ── */}
        <div className="space-y-3">
          {/* Search */}
          <div className="relative">
            <Icon name="MagnifyingGlassIcon" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by order number, tracking number, or product…"
              className="w-full pl-9 pr-4 py-2.5 text-sm bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors placeholder:text-muted-foreground"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <Icon name="XMarkIcon" size={14} />
              </button>
            )}
          </div>

          {/* Filter tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
            {filterTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveFilter(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border ${
                  activeFilter === tab.key
                    ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                    : 'bg-card text-muted-foreground border-border hover:border-primary/30 hover:text-foreground'
                }`}
              >
                <Icon name={tab.icon as any} size={12} />
                {tab.label}
                {tab.count > 0 && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    activeFilter === tab.key ? 'bg-white/20 text-primary-foreground' : 'bg-muted text-muted-foreground'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── Orders List ── */}
        {error ? (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
            <Icon name="ExclamationTriangleIcon" size={24} className="text-red-500 mx-auto mb-2" />
            <p className="text-sm font-semibold text-red-700">{error}</p>
            <button
              onClick={fetchOrders}
              className="mt-3 text-xs font-bold px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors"
            >
              Retry
            </button>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-10 text-center">
            <div className="w-14 h-14 rounded-2xl bg-muted border border-border flex items-center justify-center mx-auto mb-4">
              <Icon name="TruckIcon" size={24} className="text-muted-foreground" />
            </div>
            <p className="text-sm font-bold text-foreground mb-1">
              {searchQuery ? 'No orders match your search' : activeFilter === 'all' ? 'No orders yet' : `No ${activeFilter} orders`}
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              {searchQuery ? 'Try a different search term' : 'Your orders will appear here once placed'}
            </p>
            {!searchQuery && (
              <Link
                href="/"
                className="inline-flex items-center gap-2 text-xs font-bold px-4 py-2 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors"
              >
                <Icon name="ShoppingBagIcon" size={13} />
                Start Shopping
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Showing <span className="font-semibold text-foreground">{filteredOrders.length}</span> order{filteredOrders.length !== 1 ? 's' : ''}
              </p>
              {loading && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <div className="w-3 h-3 border border-primary border-t-transparent rounded-full animate-spin" />
                  Refreshing…
                </div>
              )}
            </div>

            {filteredOrders.map((order) => (
              <OrderRow
                key={order.id}
                order={order}
                onClick={() => router.push(`/order-tracking?order=${order.id}`)}
              />
            ))}
          </div>
        )}

        {/* ── Quick Actions ── */}
        {orders.length > 0 && (
          <div className="bg-card border border-border rounded-2xl p-4">
            <p className="text-xs font-bold text-foreground mb-3">Quick Actions</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {[
                { href: '/orders', icon: 'ClipboardDocumentListIcon', label: 'Manage Orders', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
                { href: '/disputes', icon: 'ScaleIcon', label: 'Disputes', color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
                { href: '/invoices', icon: 'DocumentTextIcon', label: 'Invoices', color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-200' },
                { href: '/buyer-dashboard', icon: 'HomeModernIcon', label: 'Buyer Dashboard', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
              ].map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className={`flex items-center gap-2 p-3 rounded-xl ${action.bg} border ${action.border} hover:shadow-sm transition-all group`}
                >
                  <Icon name={action.icon as any} size={15} className={action.color} />
                  <span className={`text-xs font-semibold ${action.color}`}>{action.label}</span>
                  <Icon name="ArrowRightIcon" size={11} className={`${action.color} ml-auto opacity-0 group-hover:opacity-100 transition-opacity`} />
                </Link>
              ))}
            </div>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
