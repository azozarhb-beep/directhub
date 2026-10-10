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

// ─── Types ───────────────────────────────────────────────────────────────────

interface Order {
  id: string;
  order_number: string;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  escrow_status: string | null;
  items: any[];
  shipping_address: any;
  subtotal: number;
  shipping_cost: number;
  total: number;
  confirmed_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  created_at: string;
  updated_at: string;
  agreed_delivery_days: number | null;
  expected_delivery_date: string | null;
  delivery_otp_verified_at: string | null;
  funds_released_at: string | null;
  otp_sent_at: string | null;
  otp_email: string | null;
  dispute_status: string | null;
  refund_status: string | null;
  platform_commission: number | null;
  commission_rate_label: string | null;
  receipt_url: string | null;
  payment_verified: boolean;
  payment_verified_at: string | null;
  admin_note: string | null;
  factory_notified_at: string | null;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
  order_id?: string;
}

interface StatusHistoryItem {
  id: string;
  order_id: string;
  status: string;
  note: string;
  created_at: string;
}

// ─── Escrow Phase Config ──────────────────────────────────────────────────────

const ESCROW_PHASES = [
  {
    key: 'pending_payment',
    label: 'Payment Pending',
    icon: 'BanknotesIcon' as const,
    description: 'Upload your bank transfer receipt to proceed.',
    colorDot: 'bg-amber-500',
    colorBadge: 'text-amber-700 bg-amber-50 border-amber-200',
    step: 0,
  },
  {
    key: 'pending_verification',
    label: 'Verifying Payment',
    icon: 'MagnifyingGlassIcon' as const,
    description: 'Admin is reviewing your bank transfer receipt.',
    colorDot: 'bg-blue-500',
    colorBadge: 'text-blue-700 bg-blue-50 border-blue-200',
    step: 1,
  },
  {
    key: 'funds_secured',
    label: 'Funds Secured',
    icon: 'LockClosedIcon' as const,
    description: 'Funds locked in escrow. Supplier notified to ship.',
    colorDot: 'bg-indigo-500',
    colorBadge: 'text-indigo-700 bg-indigo-50 border-indigo-200',
    step: 2,
  },
  {
    key: 'shipped',
    label: 'Goods Shipped',
    icon: 'TruckIcon' as const,
    description: 'Your goods are on the way. Confirm receipt when delivered.',
    colorDot: 'bg-purple-500',
    colorBadge: 'text-purple-700 bg-purple-50 border-purple-200',
    step: 3,
  },
  {
    key: 'pending_otp_confirmation',
    label: 'Awaiting Confirmation',
    icon: 'EnvelopeIcon' as const,
    description: 'Enter the OTP sent to your email to confirm receipt.',
    colorDot: 'bg-orange-500',
    colorBadge: 'text-orange-700 bg-orange-50 border-orange-200',
    step: 4,
  },
  {
    key: 'pending_admin_payout',
    label: 'Received — Awaiting Admin',
    icon: 'ClockIcon' as const,
    description: 'Receipt confirmed. Admin will review and release funds to the factory soon.',
    colorDot: 'bg-emerald-500',
    colorBadge: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    step: 5,
  },
  {
    key: 'funds_released',
    label: 'Funds Released',
    icon: 'CheckBadgeIcon' as const,
    description: 'Transaction complete. Funds released to supplier.',
    colorDot: 'bg-green-500',
    colorBadge: 'text-green-700 bg-green-50 border-green-200',
    step: 6,
  },
];

function getEscrowPhase(key: string | null) {
  return ESCROW_PHASES.find((p) => p.key === (key || 'pending_payment')) || ESCROW_PHASES[0];
}

function getEscrowStep(key: string | null): number {
  return getEscrowPhase(key).step;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDateTime(dateStr: string | null) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function getDaysRemaining(dateStr: string): number {
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function formatCurrency(amount: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 0 }).format(amount);
}

// ─── Escrow Progress Bar ──────────────────────────────────────────────────────

function EscrowProgressBar({ escrowStatus, phaseLabels }: { escrowStatus: string | null; phaseLabels?: Record<string, { label: string; description: string }> }) {
  const currentStep = getEscrowStep(escrowStatus);
  const displayPhases = ESCROW_PHASES.filter((p) => p.key !== 'pending_otp_confirmation');

  return (
    <div className="relative">
      {/* Connector line */}
      <div className="absolute top-4 left-4 right-4 h-0.5 bg-border" />
      <div
        className="absolute top-4 left-4 h-0.5 bg-primary transition-all duration-700"
        style={{
          width: `${Math.min(currentStep / (displayPhases.length - 1), 1) * (100 - (8 / displayPhases.length))}%`,
        }}
      />
      <div className="relative flex justify-between">
        {displayPhases.map((phase, idx) => {
          const isDone = idx < currentStep;
          const isCurrent = phase.key === (escrowStatus || 'pending_payment') ||
            (escrowStatus === 'pending_otp_confirmation' && phase.key === 'shipped');
          return (
            <div key={phase.key} className="flex flex-col items-center gap-2 flex-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center border-2 z-10 transition-all ${
                  isDone
                    ? 'bg-primary border-primary'
                    : isCurrent
                    ? 'bg-primary/10 border-primary ring-4 ring-primary/20' :'bg-card border-border'
                }`}
              >
                {isDone ? (
                  <Icon name="CheckIcon" size={14} className="text-primary-foreground" />
                ) : (
                  <Icon name={phase.icon} size={14} className={isCurrent ? 'text-primary' : 'text-muted-foreground'} />
                )}
              </div>
              <p className={`text-[10px] font-semibold text-center leading-tight max-w-[60px] ${
                isCurrent ? 'text-primary' : isDone ? 'text-foreground/70' : 'text-muted-foreground'
              }`}>
                {phaseLabels?.[phase.key]?.label || phase.label}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Fund Release Timeline ────────────────────────────────────────────────────

function FundReleaseTimeline({ order }: { order: Order }) {
  const currency = order.items?.[0]?.currency || 'USD';
  const escrowFee = order.subtotal * 0.015;
  const totalHeld = order.subtotal + escrowFee + order.shipping_cost;
  const supplierAdvance = totalHeld * 0.7;
  const buyerReserve = totalHeld * 0.3;
  const isReleased = order.escrow_status === 'funds_released';
  const isSecured = ['funds_secured', 'shipped', 'pending_otp_confirmation', 'funds_released'].includes(order.escrow_status || '');

  const milestones = [
    {
      label: 'Payment Received',
      sublabel: 'Funds enter escrow',
      date: order.payment_verified_at || order.confirmed_at,
      done: isSecured || isReleased,
      icon: 'BanknotesIcon' as const,
      color: 'text-blue-600',
      bg: 'bg-blue-50 border-blue-200',
    },
    {
      label: '70% Supplier Advance',
      sublabel: formatCurrency(supplierAdvance, currency),
      date: order.factory_notified_at,
      done: isSecured || isReleased,
      icon: 'ArrowUpRightIcon' as const,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50 border-indigo-200',
    },
    {
      label: 'Delivery Confirmed',
      sublabel: 'OTP verification',
      date: order.delivery_otp_verified_at,
      done: !!order.delivery_otp_verified_at || isReleased,
      icon: 'CheckCircleIcon' as const,
      color: 'text-purple-600',
      bg: 'bg-purple-50 border-purple-200',
    },
    {
      label: '30% Balance Released',
      sublabel: formatCurrency(buyerReserve, currency),
      date: order.funds_released_at,
      done: isReleased,
      icon: 'CheckBadgeIcon' as const,
      color: 'text-green-600',
      bg: 'bg-green-50 border-green-200',
    },
  ];

  return (
    <div className="space-y-3">
      {milestones.map((m, idx) => (
        <div key={idx} className="flex items-start gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center border shrink-0 ${m.done ? m.bg : 'bg-muted/40 border-border'}`}>
            <Icon name={m.icon} size={16} className={m.done ? m.color : 'text-muted-foreground'} />
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <div className="flex items-center justify-between gap-2">
              <p className={`text-sm font-semibold ${m.done ? 'text-foreground' : 'text-muted-foreground'}`}>{m.label}</p>
              {m.done && m.date && (
                <span className="text-[10px] text-muted-foreground shrink-0">{formatDate(m.date)}</span>
              )}
              {!m.done && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">Pending</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{m.sublabel}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Shipment Updates ─────────────────────────────────────────────────────────

function ShipmentUpdates({ order, history }: { order: Order; history: StatusHistoryItem[] }) {
  const currency = order.items?.[0]?.currency || 'USD';
  const daysLeft = order.expected_delivery_date ? getDaysRemaining(order.expected_delivery_date) : null;
  const isOverdue = daysLeft !== null && daysLeft < 0 && order.status !== 'delivered';
  const isShipped = ['shipped', 'pending_otp_confirmation', 'funds_released'].includes(order.escrow_status || '');

  return (
    <div className="space-y-4">
      {/* Delivery window */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-muted/40 rounded-xl p-3 text-center">
          <p className="text-[10px] text-muted-foreground mb-1">Order Date</p>
          <p className="text-xs font-bold text-foreground">{formatDate(order.confirmed_at || order.created_at)}</p>
        </div>
        <div className="bg-muted/40 rounded-xl p-3 text-center">
          <p className="text-[10px] text-muted-foreground mb-1">Transit Days</p>
          <p className="text-xs font-bold text-foreground">{order.agreed_delivery_days ? `${order.agreed_delivery_days}d` : '—'}</p>
        </div>
        <div className={`rounded-xl p-3 text-center ${isOverdue ? 'bg-red-50 border border-red-200' : 'bg-muted/40'}`}>
          <p className={`text-[10px] mb-1 ${isOverdue ? 'text-red-500' : 'text-muted-foreground'}`}>Expected By</p>
          <p className={`text-xs font-bold ${isOverdue ? 'text-red-700' : 'text-foreground'}`}>
            {order.expected_delivery_date ? formatDate(order.expected_delivery_date) : '—'}
          </p>
        </div>
      </div>

      {/* Days remaining pill */}
      {daysLeft !== null && order.status !== 'delivered' && (
        <div className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-sm font-medium ${
          isOverdue
            ? 'bg-red-50 border-red-200 text-red-700'
            : daysLeft <= 3
            ? 'bg-amber-50 border-amber-200 text-amber-700' :'bg-green-50 border-green-200 text-green-700'
        }`}>
          <Icon name={isOverdue ? 'ExclamationTriangleIcon' : 'ClockIcon'} size={15} />
          {isOverdue
            ? `Delivery overdue by ${Math.abs(daysLeft)} day${Math.abs(daysLeft) !== 1 ? 's' : ''}`
            : daysLeft === 0
            ? 'Expected delivery today'
            : `${daysLeft} day${daysLeft !== 1 ? 's' : ''} until expected delivery`}
        </div>
      )}

      {/* Shipped date */}
      {order.shipped_at && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-purple-50 border border-purple-200">
          <Icon name="TruckIcon" size={16} className="text-purple-600 shrink-0" />
          <div>
            <p className="text-xs font-semibold text-purple-700">Shipped</p>
            <p className="text-xs text-purple-600">{formatDateTime(order.shipped_at)}</p>
          </div>
        </div>
      )}

      {/* Tracking placeholder */}
      <div className={`flex items-center gap-3 p-3.5 rounded-xl border border-dashed ${
        isShipped ? 'border-primary/40 bg-primary/5' : 'border-border bg-muted/20'
      }`}>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isShipped ? 'bg-primary/10' : 'bg-muted'}`}>
          <Icon name="MapPinIcon" size={16} className={isShipped ? 'text-primary' : 'text-muted-foreground'} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-foreground">Shipment Tracking</p>
          <p className="text-xs text-muted-foreground">
            {isShipped ? 'Live tracking available — view in Orders' : 'Tracking activates once supplier ships'}
          </p>
        </div>
        <Link
          href={`/orders`}
          className={`shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            isShipped ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'bg-muted text-muted-foreground'
          }`}
        >
          <Icon name="ArrowTopRightOnSquareIcon" size={12} />
          {isShipped ? 'Track' : 'Pending'}
        </Link>
      </div>

      {/* Status history */}
      {history.length > 0 && (
        <div>
          <p className="text-xs font-bold text-foreground mb-2.5 flex items-center gap-1.5">
            <Icon name="ClockIcon" size={13} className="text-muted-foreground" />
            Activity Log
          </p>
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {history.slice().reverse().map((h) => (
              <div key={h.id} className="flex items-start gap-2.5 text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-primary/60 mt-1.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-foreground/80 leading-snug">{h.note}</p>
                  <p className="text-muted-foreground mt-0.5">{formatDateTime(h.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Buyer Notifications ──────────────────────────────────────────────────────

function BuyerNotifications({ notifications, onMarkRead }: {
  notifications: Notification[];
  onMarkRead: (id: string) => void;
}) {
  if (notifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mb-3">
          <Icon name="BellSlashIcon" size={18} className="text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">No notifications yet</p>
        <p className="text-xs text-muted-foreground mt-1">You'll be notified on key order milestones</p>
      </div>
    );
  }

  const typeIcon: Record<string, { icon: any; color: string; bg: string }> = {
    order: { icon: 'ShoppingBagIcon', color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
    payment: { icon: 'BanknotesIcon', color: 'text-green-600', bg: 'bg-green-50 border-green-200' },
    escrow: { icon: 'LockClosedIcon', color: 'text-indigo-600', bg: 'bg-indigo-50 border-indigo-200' },
    shipment: { icon: 'TruckIcon', color: 'text-purple-600', bg: 'bg-purple-50 border-purple-200' },
    dispute: { icon: 'ExclamationTriangleIcon', color: 'text-red-600', bg: 'bg-red-50 border-red-200' },
    default: { icon: 'BellIcon', color: 'text-primary', bg: 'bg-primary/10 border-primary/20' },
  };

  return (
    <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
      {notifications.map((n) => {
        const cfg = typeIcon[n.type] || typeIcon.default;
        return (
          <div
            key={n.id}
            className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${
              n.is_read ? 'bg-muted/20 border-border' : 'bg-card border-primary/20 shadow-sm'
            }`}
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center border shrink-0 ${cfg.bg}`}>
              <Icon name={cfg.icon} size={15} className={cfg.color} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <p className={`text-xs font-semibold leading-snug ${n.is_read ? 'text-foreground/70' : 'text-foreground'}`}>
                  {n.title}
                </p>
                {!n.is_read && (
                  <button
                    onClick={() => onMarkRead(n.id)}
                    className="shrink-0 w-4 h-4 rounded-full bg-primary/20 hover:bg-primary/40 flex items-center justify-center transition-colors"
                    title="Mark as read"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  </button>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{n.message}</p>
              <p className="text-[10px] text-muted-foreground mt-1">{formatDateTime(n.created_at)}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function OrderStatusPage() {
  const { t, dir, language } = useLanguage();
  const os = t.orderStatus;

  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const supabase = createClient();

  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [statusHistory, setStatusHistory] = useState<StatusHistoryItem[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'escrow' | 'funds' | 'shipment' | 'notifications'>('escrow');

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  const fetchOrders = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      const list = data || [];
      setOrders(list);
      if (list.length > 0 && !selectedOrder) {
        setSelectedOrder(list[0]);
        fetchHistory(list[0].id);
      }
    } catch (_) {}
    finally { setLoading(false); }
  }, [user]);

  const fetchHistory = async (orderId: string) => {
    const { data } = await supabase
      .from('order_status_history')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });
    setStatusHistory(data || []);
  };

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30);
    setNotifications(data || []);
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchOrders();
      fetchNotifications();

      // Real-time: orders
      const ordersChannel = supabase
        .channel('order-status-orders')
        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'orders',
          filter: `user_id=eq.${user.id}`,
        }, (payload) => {
          if (payload.eventType === 'UPDATE') {
            setOrders((prev) => prev.map((o) => o.id === (payload.new as Order).id ? payload.new as Order : o));
            setSelectedOrder((prev) => prev?.id === (payload.new as Order).id ? payload.new as Order : prev);
          } else if (payload.eventType === 'INSERT') {
            setOrders((prev) => [payload.new as Order, ...prev]);
          }
        })
        .subscribe();

      // Real-time: notifications
      const notifChannel = supabase
        .channel('order-status-notifs')
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        }, () => fetchNotifications())
        .subscribe();

      return () => {
        supabase.removeChannel(ordersChannel);
        supabase.removeChannel(notifChannel);
      };
    }
  }, [user]);

  const handleSelectOrder = (order: Order) => {
    setSelectedOrder(order);
    fetchHistory(order.id);
  };

  const handleMarkRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Icon name="ArrowPathIcon" size={32} className="animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading order status…</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const currentPhase = selectedOrder ? getEscrowPhase(selectedOrder.escrow_status) : null;
  const currency = selectedOrder?.items?.[0]?.currency || 'USD';

  const TABS = [
    { key: 'escrow' as const, label: 'Escrow', icon: 'LockClosedIcon' as const },
    { key: 'funds' as const, label: 'Funds', icon: 'BanknotesIcon' as const },
    { key: 'shipment' as const, label: 'Shipment', icon: 'TruckIcon' as const },
    { key: 'notifications' as const, label: 'Alerts', icon: 'BellIcon' as const, badge: unreadCount },
  ];

  return (
    <div className="min-h-screen bg-background" dir={dir}>
      <Header />
      <main className="max-w-6xl mx-auto px-4 md:px-6 py-6 pb-28 md:pb-12">

        {/* Page header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-bold text-foreground">{os.title}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Live escrow tracking & shipment updates</p>
          </div>
          <Link
            href="/orders"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-muted text-foreground text-sm font-medium hover:bg-muted/80 transition-colors"
          >
            <Icon name="ClipboardDocumentListIcon" size={15} />
            <span className="hidden sm:inline">{os.allOrders}</span>
          </Link>
        </div>

        {orders.length === 0 ? (
          <div className="bg-card rounded-2xl border border-border p-12 text-center">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <Icon name="ShoppingBagIcon" size={28} className="text-muted-foreground" />
            </div>
            <h3 className="text-base font-semibold text-foreground mb-2">No orders yet</h3>
            <p className="text-sm text-muted-foreground mb-5">Place your first bulk order to track its escrow status here.</p>
            <Link href="/" className="px-5 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-lg inline-flex items-center gap-2">
              <Icon name="MagnifyingGlassIcon" size={16} /> Browse Products
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

            {/* ── Order List ── */}
            <div className="lg:col-span-2 space-y-2.5">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1 mb-3">Your Orders</p>
              {orders.map((order) => {
                const phase = getEscrowPhase(order.escrow_status);
                const isSelected = selectedOrder?.id === order.id;
                const daysLeft = order.expected_delivery_date ? getDaysRemaining(order.expected_delivery_date) : null;
                const isOverdue = daysLeft !== null && daysLeft < 0 && order.status !== 'delivered';

                return (
                  <button
                    key={order.id}
                    onClick={() => handleSelectOrder(order)}
                    className={`w-full text-left bg-card rounded-xl border-2 p-4 transition-all ${
                      isSelected ? 'border-primary shadow-sm' : 'border-border hover:border-primary/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2.5">
                      <div>
                        <p className="text-sm font-bold text-foreground font-mono">{order.order_number}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{formatDate(order.created_at)}</p>
                      </div>
                      <span className={`shrink-0 text-[10px] font-bold px-2 py-1 rounded-full border ${phase.colorBadge}`}>
                        {(os.phases as any)?.[phase.key]?.label || phase.label}
                      </span>
                    </div>

                    {/* Mini escrow progress */}
                    <div className="flex items-center gap-1 mb-2.5">
                      {[0, 1, 2, 3, 5].map((stepVal, i) => (
                        <div
                          key={i}
                          className={`h-1 flex-1 rounded-full transition-all ${
                            getEscrowStep(order.escrow_status) >= stepVal ? 'bg-primary' : 'bg-border'
                          }`}
                        />
                      ))}
                    </div>

                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">{order.items?.length || 0} item(s)</p>
                      <div className="flex items-center gap-2">
                        {isOverdue && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
                            Overdue
                          </span>
                        )}
                        <p className="text-sm font-bold text-foreground">{formatCurrency(order.total, currency)}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* ── Detail Panel ── */}
            {selectedOrder && (
              <div className="lg:col-span-3 space-y-4">

                {/* Current phase banner */}
                <div className={`rounded-2xl border p-4 ${currentPhase?.colorBadge}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/60 flex items-center justify-center shrink-0">
                      <Icon name={currentPhase!.icon} size={20} className={currentPhase!.colorBadge.split(' ')[0]} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-bold">{currentPhase!.label}</p>
                        <span className="flex items-center gap-1 text-[10px] font-semibold">
                          <span className={`w-1.5 h-1.5 rounded-full ${currentPhase!.colorDot} animate-pulse`} />
                          Live
                        </span>
                      </div>
                      <p className="text-xs opacity-80">{currentPhase!.description}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs opacity-70">Order</p>
                      <p className="text-xs font-bold font-mono">{selectedOrder.order_number}</p>
                    </div>
                  </div>
                </div>

                {/* Tabs */}
                <div className="bg-card rounded-2xl border border-border overflow-hidden">
                  <div className="flex border-b border-border">
                    {TABS.map((tab) => (
                      <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold transition-colors relative ${
                          activeTab === tab.key
                            ? 'text-primary bg-primary/5' :'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                        }`}
                      >
                        <Icon name={tab.icon} size={14} />
                        <span className="hidden sm:inline">{tab.label}</span>
                        {tab.badge && tab.badge > 0 ? (
                          <span className="absolute top-1.5 right-1.5 min-w-[14px] h-3.5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5">
                            {tab.badge > 9 ? '9+' : tab.badge}
                          </span>
                        ) : null}
                        {activeTab === tab.key && (
                          <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-t-full" />
                        )}
                      </button>
                    ))}
                  </div>

                  <div className="p-5">
                    {/* Escrow Phase Tab */}
                    {activeTab === 'escrow' && (
                      <div className="space-y-5">
                        <EscrowProgressBar phaseLabels={os.phases as any} escrowStatus={selectedOrder.escrow_status} />
                        <div className="h-px bg-border" />
                        {/* Phase detail list */}
                        <div className="space-y-3">
                          {ESCROW_PHASES.map((phase, idx) => {
                            const currentStep = getEscrowStep(selectedOrder.escrow_status);
                            const isDone = idx < currentStep;
                            const isCurrent = phase.key === (selectedOrder.escrow_status || 'pending_payment');
                            return (
                              <div
                                key={phase.key}
                                className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${
                                  isCurrent
                                    ? `${phase.colorBadge} shadow-sm`
                                    : isDone
                                    ? 'bg-muted/20 border-border opacity-60' :'bg-muted/10 border-border opacity-40'
                                }`}
                              >
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                  isDone ? 'bg-primary/10' : isCurrent ? 'bg-white/60' : 'bg-muted'
                                }`}>
                                  {isDone ? (
                                    <Icon name="CheckIcon" size={14} className="text-primary" />
                                  ) : (
                                    <Icon name={phase.icon} size={14} className={isCurrent ? phase.colorBadge.split(' ')[0] : 'text-muted-foreground'} />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-bold">{(os.phases as any)?.[phase.key]?.label || phase.label}</p>
                                  {isCurrent && <p className="text-xs opacity-80 mt-0.5">{(os.phases as any)?.[phase.key]?.description || phase.description}</p>}
                                </div>
                                {isDone && <Icon name="CheckCircleIcon" size={16} className="text-primary shrink-0 mt-0.5" />}
                                {isCurrent && <span className={`w-2 h-2 rounded-full ${phase.colorDot} animate-pulse shrink-0 mt-1`} />}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Fund Release Tab */}
                    {activeTab === 'funds' && (
                      <div className="space-y-5">
                        {/* Total held */}
                        <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-200 rounded-xl p-4">
                          <p className="text-xs text-indigo-600 font-semibold mb-1">Total Held in Escrow</p>
                          <p className="text-2xl font-bold text-indigo-800">
                            {formatCurrency(selectedOrder.subtotal * 1.015 + selectedOrder.shipping_cost, currency)}
                          </p>
                          <div className="mt-3 h-2 rounded-full overflow-hidden flex bg-indigo-100">
                            <div className="bg-indigo-500 h-full" style={{ width: '70%' }} />
                            <div className="bg-indigo-200 h-full" style={{ width: '30%' }} />
                          </div>
                          <div className="flex justify-between mt-1.5 text-[10px] text-indigo-600">
                            <span>70% Supplier Advance</span>
                            <span>30% Buyer Reserve</span>
                          </div>
                        </div>
                        <FundReleaseTimeline order={selectedOrder} />
                      </div>
                    )}

                    {/* Shipment Tab */}
                    {activeTab === 'shipment' && (
                      <ShipmentUpdates order={selectedOrder} history={statusHistory} />
                    )}

                    {/* Notifications Tab */}
                    {activeTab === 'notifications' && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-foreground">
                            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
                          </p>
                          {unreadCount > 0 && (
                            <button
                              onClick={() => notifications.filter((n) => !n.is_read).forEach((n) => handleMarkRead(n.id))}
                              className="text-xs text-primary font-medium hover:underline"
                            >
                              Mark all read
                            </button>
                          )}
                        </div>
                        <BuyerNotifications notifications={notifications} onMarkRead={handleMarkRead} />
                      </div>
                    )}
                  </div>
                </div>

                {/* Quick actions */}
                <div className="grid grid-cols-2 gap-3">
                  <Link
                    href="/orders"
                    className="flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
                  >
                    <Icon name="ClipboardDocumentListIcon" size={15} />
                    Manage Order
                  </Link>
                  <Link
                    href="/notifications"
                    className="flex items-center justify-center gap-2 py-3 rounded-xl bg-muted text-foreground text-sm font-semibold hover:bg-muted/80 transition-colors"
                  >
                    <Icon name="BellIcon" size={15} />
                    All Notifications
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
