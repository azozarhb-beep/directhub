'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';

// ─── Types ────────────────────────────────────────────────────────────────────
interface SellerOrder {
  id: string;
  order_number: string;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  escrow_status: string | null;
  items: any[];
  shipping_address: any;
  payment_method: string;
  total: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  payment_verified: boolean;
  dispute_status: string | null;
  user_id: string;
  factory_user_id: string | null;
  // buyer info joined
  buyer_name?: string;
  buyer_email?: string;
}

interface DashboardStats {
  total: number;
  pending: number;
  processing: number;
  shipped: number;
  delivered: number;
  cancelled: number;
  revenue: number;
  pendingRevenue: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

const STATUS_CONFIG: Record<string, { label: string; labelAr: string; color: string; icon: string }> = {
  pending:    { label: 'Pending',    labelAr: 'قيد الانتظار', color: 'bg-amber-50 text-amber-700 border-amber-200',   icon: 'ClockIcon' },
  processing: { label: 'Processing', labelAr: 'قيد التجهيز',  color: 'bg-blue-50 text-blue-700 border-blue-200',       icon: 'CogIcon' },
  shipped:    { label: 'Shipped',    labelAr: 'تم الشحن',     color: 'bg-purple-50 text-purple-700 border-purple-200', icon: 'TruckIcon' },
  delivered:  { label: 'Delivered',  labelAr: 'تم التسليم',   color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: 'CheckCircleIcon' },
  cancelled:  { label: 'Cancelled',  labelAr: 'ملغي',         color: 'bg-red-50 text-red-700 border-red-200',          icon: 'XCircleIcon' },
};

const ESCROW_LABELS: Record<string, { label: string; color: string }> = {
  pending_payment:       { label: 'Awaiting Payment',    color: 'text-amber-600' },
  pending_verification:  { label: 'Verifying Payment',   color: 'text-blue-600' },
  funds_secured:         { label: 'Funds Secured ✓',     color: 'text-indigo-600' },
  shipped:               { label: 'Shipped',              color: 'text-purple-600' },
  ready_for_inspection:  { label: 'Ready for Inspection', color: 'text-amber-600' },
  pending_admin_payout:  { label: 'Payout Pending',       color: 'text-emerald-600' },
  funds_released:        { label: 'Funds Released ✓',     color: 'text-green-600' },
  escrow_frozen:         { label: 'Escrow Frozen ⚠',      color: 'text-red-600' },
  refund_processed:      { label: 'Refunded',             color: 'text-gray-600' },
};

type FilterStatus = 'all' | 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({
  icon, label, value, sub, color, accent,
}: {
  icon: string; label: string; value: string | number; sub?: string; color: string; accent: string;
}) {
  return (
    <div className={`rounded-2xl border p-5 flex flex-col gap-2 ${color}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</span>
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${accent}`}>
          <Icon name={icon as any} size={16} className="text-white" />
        </div>
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

// ─── Order Row ────────────────────────────────────────────────────────────────
function OrderRow({
  order, isRTL, onSelect, isSelected,
}: {
  order: SellerOrder; isRTL: boolean; onSelect: (o: SellerOrder) => void; isSelected: boolean;
}) {
  const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
  const escrow = order.escrow_status ? ESCROW_LABELS[order.escrow_status] : null;
  const itemCount = Array.isArray(order.items) ? order.items.length : 0;

  return (
    <button
      onClick={() => onSelect(order)}
      className={`w-full text-left px-4 py-3.5 border-b border-border last:border-0 hover:bg-muted/40 transition-colors ${isSelected ? 'bg-primary/5 border-l-2 border-l-primary' : ''}`}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-foreground">#{order.order_number}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${cfg.color}`}>
              {isRTL ? cfg.labelAr : cfg.label}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {itemCount} {itemCount === 1 ? 'item' : 'items'} · {formatDate(order.created_at)}
          </p>
          {escrow && (
            <p className={`text-xs font-medium mt-0.5 ${escrow.color}`}>{escrow.label}</p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-bold text-foreground">${formatCurrency(order.total)}</p>
          {order.payment_verified && (
            <span className="text-xs text-emerald-600 font-medium">✓ Paid</span>
          )}
        </div>
      </div>
    </button>
  );
}

// ─── Order Detail Panel ───────────────────────────────────────────────────────
function OrderDetailPanel({
  order, isRTL, onStatusUpdate, updating,
}: {
  order: SellerOrder; isRTL: boolean; onStatusUpdate: (id: string, status: string) => void; updating: boolean;
}) {
  const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
  const escrow = order.escrow_status ? ESCROW_LABELS[order.escrow_status] : null;
  const items = Array.isArray(order.items) ? order.items : [];
  const addr = order.shipping_address || {};

  const nextStatuses: Record<string, string[]> = {
    pending:    ['processing', 'cancelled'],
    processing: ['shipped', 'cancelled'],
    shipped:    ['delivered'],
    delivered:  [],
    cancelled:  [],
  };
  const allowedNext = nextStatuses[order.status] || [];

  return (
    <div className="flex flex-col h-full overflow-y-auto" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="px-5 py-4 border-b border-border bg-muted/20">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-foreground">Order #{order.order_number}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{formatDate(order.created_at)}</p>
          </div>
          <span className={`text-xs px-2.5 py-1 rounded-full border font-semibold ${cfg.color}`}>
            {isRTL ? cfg.labelAr : cfg.label}
          </span>
        </div>
        {escrow && (
          <div className={`mt-2 text-xs font-semibold ${escrow.color}`}>
            Escrow: {escrow.label}
          </div>
        )}
      </div>

      <div className="flex-1 px-5 py-4 space-y-5">
        {/* Payment */}
        <div className="rounded-xl border border-border p-4 bg-card">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3">Payment</p>
          <div className="flex items-center justify-between">
            <span className="text-sm text-foreground">Total</span>
            <span className="text-lg font-bold text-foreground">${formatCurrency(order.total)}</span>
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-xs text-muted-foreground">Method</span>
            <span className="text-xs font-medium text-foreground capitalize">{order.payment_method || '—'}</span>
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-xs text-muted-foreground">Payment Status</span>
            <span className={`text-xs font-semibold ${order.payment_verified ? 'text-emerald-600' : 'text-amber-600'}`}>
              {order.payment_verified ? '✓ Verified' : 'Pending'}
            </span>
          </div>
        </div>

        {/* Items */}
        {items.length > 0 && (
          <div className="rounded-xl border border-border p-4 bg-card">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3">Order Items ({items.length})</p>
            <div className="space-y-2.5">
              {items.map((item: any, idx: number) => (
                <div key={idx} className="flex items-start gap-3">
                  {item.image && (
                    <img src={item.image} alt={item.name || 'Product'} className="w-10 h-10 rounded-lg object-cover border border-border shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{item.name || item.name_en || 'Product'}</p>
                    <p className="text-xs text-muted-foreground">Qty: {item.quantity} · ${formatCurrency(item.price || 0)}</p>
                  </div>
                  <p className="text-sm font-bold text-foreground shrink-0">${formatCurrency((item.price || 0) * (item.quantity || 1))}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Shipping Address */}
        {(addr.full_name || addr.city || addr.country) && (
          <div className="rounded-xl border border-border p-4 bg-card">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3">Shipping Address</p>
            <div className="text-sm text-foreground space-y-0.5">
              {addr.full_name && <p className="font-semibold">{addr.full_name}</p>}
              {addr.address_line1 && <p>{addr.address_line1}</p>}
              {addr.address_line2 && <p>{addr.address_line2}</p>}
              <p>{[addr.city, addr.state, addr.postal_code].filter(Boolean).join(', ')}</p>
              {addr.country && <p>{addr.country}</p>}
              {addr.phone && <p className="text-muted-foreground">{addr.phone}</p>}
            </div>
          </div>
        )}

        {/* Notes */}
        {order.notes && (
          <div className="rounded-xl border border-border p-4 bg-card">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">Buyer Notes</p>
            <p className="text-sm text-foreground">{order.notes}</p>
          </div>
        )}

        {/* Dispute */}
        {order.dispute_status && (
          <div className="rounded-xl border border-red-200 p-4 bg-red-50">
            <div className="flex items-center gap-2">
              <Icon name="ExclamationTriangleIcon" size={16} className="text-red-600 shrink-0" />
              <p className="text-sm font-semibold text-red-700">Dispute: {order.dispute_status.replace(/_/g, ' ')}</p>
            </div>
            <Link href="/disputes" className="text-xs text-red-600 underline mt-1 inline-block">View in Disputes Center →</Link>
          </div>
        )}

        {/* Status Actions */}
        {allowedNext.length > 0 && (
          <div className="rounded-xl border border-border p-4 bg-card">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3">Update Order Status</p>
            <div className="flex flex-wrap gap-2">
              {allowedNext.map((nextStatus) => {
                const nc = STATUS_CONFIG[nextStatus];
                return (
                  <button
                    key={nextStatus}
                    onClick={() => onStatusUpdate(order.id, nextStatus)}
                    disabled={updating}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-all disabled:opacity-50 ${nc.color} hover:opacity-80`}
                  >
                    <Icon name={nc.icon as any} size={13} />
                    {isRTL ? nc.labelAr : nc.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Quick Links */}
        <div className="flex gap-2 flex-wrap">
          <Link href="/messaging" className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-muted text-foreground hover:bg-muted/80 transition-colors border border-border">
            <Icon name="ChatBubbleLeftRightIcon" size={13} /> Message Buyer
          </Link>
          <Link href="/invoices" className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-muted text-foreground hover:bg-muted/80 transition-colors border border-border">
            <Icon name="DocumentTextIcon" size={13} /> Invoice
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SellerOrderDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { t, isRTL } = useLanguage();
  const supabase = createClient();

  const [orders, setOrders] = useState<SellerOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<SellerOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [updating, setUpdating] = useState(false);
  const [updateMsg, setUpdateMsg] = useState('');
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [stats, setStats] = useState<DashboardStats>({
    total: 0, pending: 0, processing: 0, shipped: 0, delivered: 0, cancelled: 0, revenue: 0, pendingRevenue: 0,
  });

  // Auth guard
  useEffect(() => {
    if (authLoading) return;
    if (!user) router.push('/login');
  }, [user, authLoading, router]);

  const fetchOrders = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error: fetchError } = await supabase
        .from('orders')
        .select('id, order_number, status, total, created_at, updated_at, items, escrow_status, dispute_status, payment_verified, shipping_address, notes, factory_user_id, user_id, payment_method')
        .eq('factory_user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(200);

      if (fetchError) throw fetchError;
      const rows = (data || []) as SellerOrder[];
      setOrders(rows);

      // Compute stats
      const s: DashboardStats = { total: rows.length, pending: 0, processing: 0, shipped: 0, delivered: 0, cancelled: 0, revenue: 0, pendingRevenue: 0 };
      rows.forEach((o) => {
        if (o.status in s) (s as any)[o.status]++;
        if (o.status === 'delivered') s.revenue += o.total || 0;
        if (o.status === 'pending' || o.status === 'processing') s.pendingRevenue += o.total || 0;
      });
      setStats(s);

      if (rows.length > 0 && !selectedOrder) setSelectedOrder(rows[0]);
    } catch (err: any) {
      setError(err.message || 'Failed to load orders.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchOrders();

      const channel = supabase
        .channel('seller-orders-realtime')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `factory_user_id=eq.${user.id}`,
        }, (payload) => {
          if (payload.eventType === 'INSERT') {
            const newOrder = payload.new as SellerOrder;
            setOrders((prev) => [newOrder, ...prev]);
            setStats((prev) => ({
              ...prev,
              total: prev.total + 1,
              [newOrder.status]: (prev as any)[newOrder.status] + 1,
              pendingRevenue: newOrder.status === 'pending' ? prev.pendingRevenue + newOrder.total : prev.pendingRevenue,
            }));
          } else if (payload.eventType === 'UPDATE') {
            setOrders((prev) => prev.map((o) => o.id === (payload.new as SellerOrder).id ? payload.new as SellerOrder : o));
            if (selectedOrder?.id === (payload.new as SellerOrder).id) {
              setSelectedOrder(payload.new as SellerOrder);
            }
          }
        })
        .subscribe((status) => setRealtimeConnected(status === 'SUBSCRIBED'));

      return () => { supabase.removeChannel(channel); };
    }
  }, [user]);

  const handleStatusUpdate = async (orderId: string, newStatus: string) => {
    setUpdating(true);
    setUpdateMsg('');
    try {
      const { error: updateError } = await supabase
        .from('orders')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', orderId)
        .eq('factory_user_id', user!.id);

      if (updateError) throw updateError;

      setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status: newStatus as any } : o));
      if (selectedOrder?.id === orderId) setSelectedOrder((prev) => prev ? { ...prev, status: newStatus as any } : prev);
      setUpdateMsg('Status updated successfully');
      setTimeout(() => setUpdateMsg(''), 3000);
    } catch (err: any) {
      setUpdateMsg('Failed to update: ' + err.message);
    } finally {
      setUpdating(false);
    }
  };

  const filteredOrders = orders.filter((o) => {
    const matchesStatus = filterStatus === 'all' || o.status === filterStatus;
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || o.order_number?.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  const filterTabs: { key: FilterStatus; label: string; count: number }[] = [
    { key: 'all',        label: 'All',        count: stats.total },
    { key: 'pending',    label: 'Pending',    count: stats.pending },
    { key: 'processing', label: 'Processing', count: stats.processing },
    { key: 'shipped',    label: 'Shipped',    count: stats.shipped },
    { key: 'delivered',  label: 'Delivered',  count: stats.delivered },
    { key: 'cancelled',  label: 'Cancelled',  count: stats.cancelled },
  ];

  return (
    <div className="min-h-screen bg-background" dir={isRTL ? 'rtl' : 'ltr'}>
      <Header />

      <main className="max-w-7xl mx-auto px-4 md:px-6 py-6">
        {/* ── Page Title ── */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link href="/seller/onboarding" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                Seller Hub
              </Link>
              <Icon name="ChevronRightIcon" size={12} className="text-muted-foreground" />
              <span className="text-xs text-primary font-semibold">Order Dashboard</span>
            </div>
            <h1 className="text-2xl font-bold text-foreground">Seller Order Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Track and manage all incoming orders from buyers</p>
          </div>
          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${realtimeConnected ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${realtimeConnected ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`} />
              {realtimeConnected ? 'LIVE' : 'Offline'}
            </div>
            <button onClick={fetchOrders} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-muted text-foreground hover:bg-muted/80 border border-border transition-colors">
              <Icon name="ArrowPathIcon" size={13} /> Refresh
            </button>
          </div>
        </div>

        {/* ── Stats Bento ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatCard icon="ClipboardDocumentListIcon" label="Total Orders" value={stats.total} color="bg-card border-border" accent="bg-slate-500" />
          <StatCard icon="ClockIcon" label="Pending" value={stats.pending} sub={`$${formatCurrency(stats.pendingRevenue)} pending revenue`} color="bg-amber-50/50 border-amber-100" accent="bg-amber-500" />
          <StatCard icon="CheckCircleIcon" label="Delivered" value={stats.delivered} sub={`$${formatCurrency(stats.revenue)} earned`} color="bg-emerald-50/50 border-emerald-100" accent="bg-emerald-500" />
          <StatCard icon="TruckIcon" label="In Transit" value={stats.shipped} color="bg-purple-50/50 border-purple-100" accent="bg-purple-500" />
        </div>

        {/* ── Update Message ── */}
        {updateMsg && (
          <div className={`mb-4 px-4 py-2.5 rounded-xl text-sm font-medium border ${updateMsg.startsWith('Failed') ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
            {updateMsg}
          </div>
        )}

        {/* ── Error ── */}
        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* ── Main Layout: List + Detail ── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Orders List */}
          <div className="lg:col-span-2 bg-card border border-border rounded-2xl overflow-hidden flex flex-col">
            {/* Search */}
            <div className="px-4 pt-4 pb-3 border-b border-border">
              <div className="relative">
                <Icon name="MagnifyingGlassIcon" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search by order number..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm bg-muted/50 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary"
                />
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex overflow-x-auto hide-scrollbar border-b border-border px-2 py-1.5 gap-1">
              {filterTabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setFilterStatus(tab.key)}
                  className={`shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${filterStatus === tab.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
                >
                  {tab.label}
                  {tab.count > 0 && (
                    <span className={`text-[10px] px-1 rounded-full ${filterStatus === tab.key ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground'}`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Order List */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-muted-foreground">Loading orders...</p>
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 px-4 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center">
                    <Icon name="InboxIcon" size={22} className="text-muted-foreground" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">No orders found</p>
                  <p className="text-xs text-muted-foreground">
                    {filterStatus !== 'all' ? 'Try changing the filter above.' : 'Orders from buyers will appear here once placed.'}
                  </p>
                </div>
              ) : (
                filteredOrders.map((order) => (
                  <OrderRow
                    key={order.id}
                    order={order}
                    isRTL={isRTL}
                    onSelect={setSelectedOrder}
                    isSelected={selectedOrder?.id === order.id}
                  />
                ))
              )}
            </div>

            {/* Footer count */}
            {!loading && filteredOrders.length > 0 && (
              <div className="px-4 py-2.5 border-t border-border bg-muted/20">
                <p className="text-xs text-muted-foreground">{filteredOrders.length} order{filteredOrders.length !== 1 ? 's' : ''}</p>
              </div>
            )}
          </div>

          {/* Order Detail */}
          <div className="lg:col-span-3 bg-card border border-border rounded-2xl overflow-hidden" style={{ minHeight: '500px' }}>
            {selectedOrder ? (
              <OrderDetailPanel
                order={selectedOrder}
                isRTL={isRTL}
                onStatusUpdate={handleStatusUpdate}
                updating={updating}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full py-20 gap-4 text-center px-6">
                <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
                  <Icon name="ClipboardDocumentListIcon" size={26} className="text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Select an order</p>
                  <p className="text-xs text-muted-foreground mt-1">Click any order from the list to view details and manage its status.</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Quick Links ── */}
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { href: '/seller/onboarding', icon: 'RocketLaunchIcon', label: 'Seller Onboarding' },
            { href: '/seller/products',   icon: 'CubeIcon',          label: 'My Products' },
            { href: '/invoices',          icon: 'DocumentTextIcon',  label: 'Invoices' },
            { href: '/disputes',          icon: 'ScaleIcon',         label: 'Disputes' },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center gap-2.5 px-4 py-3 rounded-xl border border-border bg-card hover:bg-muted/50 transition-colors group"
            >
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                <Icon name={link.icon as any} size={15} className="text-primary" />
              </div>
              <span className="text-sm font-semibold text-foreground">{link.label}</span>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
