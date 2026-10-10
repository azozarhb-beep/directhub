'use client';

import React, { useState, useEffect, useCallback } from 'react';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';
import { useLanguage } from '@/contexts/LanguageContext';

interface Order {
  id: string;
  order_number: string;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  items: any[];
  shipping_address: any;
  payment_method: string;
  subtotal: number;
  shipping_cost: number;
  total: number;
  notes: string;
  receipt_url: string | null;
  receipt_filename: string | null;
  payment_verified: boolean;
  payment_verified_at: string | null;
  admin_note: string;
  confirmed_at: string | null;
  created_at: string;
  user_id: string;
  // Delivery timeline
  agreed_delivery_days: number | null;
  expected_delivery_date: string | null;
  delivery_otp_verified_at: string | null;
  funds_released_at: string | null;
  // Dispute / refund
  dispute_status: string | null;
  dispute_reported_at: string | null;
  dispute_reason: string | null;
  refund_status: string | null;
  refund_approved_at: string | null;
  refund_rejected_at: string | null;
  refund_admin_note: string | null;
  refund_amount: number | null;
  user_profiles?: {
    full_name: string;
    email: string;
    company_name: string;
    phone: string;
  };
}

interface ManufacturerPaymentSettings {
  id: string;
  manufacturer_id: string;
  bank_name: string;
  bank_account_holder: string;
  iban: string;
  swift_code: string;
  account_number: string;
  bank_country: string;
  bank_city: string;
  bank_branch: string;
  bank_currency: string;
  usdt_trc20_address: string;
  usdt_erc20_address: string;
  bitcoin_address: string;
  ethereum_address: string;
  other_wallet_label: string;
  other_wallet_address: string;
  is_verified: boolean;
  verified_at: string | null;
  admin_note: string;
  manufacturer?: {
    full_name: string;
    email: string;
    company_name: string;
  };
}

const STATUS_CONFIG = {
  pending: { labelKey: 'statusPending', color: 'text-yellow-700 bg-yellow-50 border-yellow-200', icon: 'ClockIcon' },
  processing: { labelKey: 'statusProcessing', color: 'text-blue-700 bg-blue-50 border-blue-200', icon: 'CogIcon' },
  shipped: { labelKey: 'statusShipped', color: 'text-purple-700 bg-purple-50 border-purple-200', icon: 'TruckIcon' },
  delivered: { labelKey: 'statusDelivered', color: 'text-green-700 bg-green-50 border-green-200', icon: 'CheckCircleIcon' },
  cancelled: { labelKey: 'statusCancelled', color: 'text-red-700 bg-red-50 border-red-200', icon: 'XCircleIcon' },
};

type FilterTab = 'all' | 'pending' | 'needs_receipt' | 'verified' | 'processing' | 'disputes';
type AdminTab = 'orders' | 'payment_settings';

export default function OrderFulfillmentPage() {
  const { t, dir, isRTL, language } = useLanguage();
  const ui = t.orderFulfillment;
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const supabase = createClient();

  const [adminTab, setAdminTab] = useState<AdminTab>('orders');
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [adminNote, setAdminNote] = useState('');
  const [newStatus, setNewStatus] = useState<Order['status']>('processing');
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Payment settings state
  const [paymentSettingsList, setPaymentSettingsList] = useState<ManufacturerPaymentSettings[]>([]);
  const [paymentSettingsLoading, setPaymentSettingsLoading] = useState(false);
  const [selectedPaymentSetting, setSelectedPaymentSetting] = useState<ManufacturerPaymentSettings | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [verifyNote, setVerifyNote] = useState('');
  const [verifySuccess, setVerifySuccess] = useState('');
  const [verifyError, setVerifyError] = useState('');

  // Refund state
  const [refundNote, setRefundNote] = useState('');
  const [refundAmount, setRefundAmount] = useState<number | ''>('');
  const [refundLoading, setRefundLoading] = useState(false);

  const isAdmin = user?.user_metadata?.role === 'admin' || user?.app_metadata?.role === 'admin';

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (!authLoading && user && !isAdmin) {
      router.push('/');
    }
  }, [user, authLoading, isAdmin, router]);

  const fetchOrders = useCallback(async () => {
    if (!user || !isAdmin) return;
    setLoading(true);
    try {
      const { data, error: fetchError } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          status,
          items,
          shipping_address,
          payment_method,
          subtotal,
          shipping_cost,
          total,
          notes,
          receipt_url,
          receipt_filename,
          payment_verified,
          payment_verified_at,
          admin_note,
          confirmed_at,
          created_at,
          user_id,
          agreed_delivery_days,
          expected_delivery_date,
          delivery_otp_verified_at,
          funds_released_at,
          dispute_status,
          dispute_reported_at,
          dispute_reason,
          refund_status,
          refund_approved_at,
          refund_rejected_at,
          refund_admin_note,
          refund_amount,
          user_profiles!orders_user_id_fkey (
            full_name,
            email,
            company_name,
            phone
          )
        `)
        .order('created_at', { ascending: false })
        .limit(150);

      if (fetchError) throw fetchError;
      setOrders(data || []);
      if (data && data.length > 0 && !selectedOrder) {
        setSelectedOrder(data[0]);
        setNewStatus(data[0].status);
        setAdminNote(data[0].admin_note || '');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load orders.');
    } finally {
      setLoading(false);
    }
  }, [user, isAdmin]);

  const fetchPaymentSettings = useCallback(async () => {
    if (!user || !isAdmin) return;
    setPaymentSettingsLoading(true);
    try {
      const { data, error: fetchError } = await supabase
        .from('manufacturer_payment_settings')
        .select(`
          id,
          manufacturer_id,
          bank_name,
          bank_account_holder,
          iban,
          swift_code,
          account_number,
          bank_country,
          bank_city,
          bank_branch,
          bank_currency,
          usdt_trc20_address,
          usdt_erc20_address,
          bitcoin_address,
          ethereum_address,
          other_wallet_label,
          other_wallet_address,
          is_verified,
          verified_at,
          admin_note,
          created_at,
          manufacturer:manufacturer_id (
            full_name,
            email,
            company_name
          )
        `)
        .order('created_at', { ascending: false })
        .limit(100);
      if (fetchError) throw fetchError;
      setPaymentSettingsList(data || []);
      if (data && data.length > 0 && !selectedPaymentSetting) {
        setSelectedPaymentSetting(data[0]);
        setVerifyNote(data[0].admin_note || '');
      }
    } catch (err: any) {
      console.error('Failed to fetch payment settings:', err);
    } finally {
      setPaymentSettingsLoading(false);
    }
  }, [user, isAdmin]);

  useEffect(() => {
    if (user && isAdmin) {
      fetchOrders();
      fetchPaymentSettings();

      let realtimeTimer: ReturnType<typeof setTimeout> | null = null;
      const channel = supabase
        .channel('fulfillment-orders')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
          if (realtimeTimer) clearTimeout(realtimeTimer);
          realtimeTimer = setTimeout(() => fetchOrders(), 2000);
        })
        .subscribe();

      return () => {
        if (realtimeTimer) clearTimeout(realtimeTimer);
        supabase.removeChannel(channel);
      };
    }
  }, [user, isAdmin, fetchOrders, fetchPaymentSettings]);

  const handleSelectOrder = (order: Order) => {
    setSelectedOrder(order);
    setNewStatus(order.status);
    setAdminNote(order.admin_note || '');
    setRefundNote(order.refund_admin_note || '');
    setRefundAmount(order.refund_amount || '');
    setSuccessMsg('');
    setError('');
  };

  const handleVerifyPayment = async () => {
    if (!selectedOrder || !user) return;
    setActionLoading(true);
    setError('');
    try {
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          payment_verified: true,
          payment_verified_at: new Date().toISOString(),
          payment_verified_by: user.id,
          admin_note: adminNote,
          status: 'processing',
        })
        .eq('id', selectedOrder.id);

      if (updateError) throw updateError;

      await supabase.from('order_status_history').insert({
        order_id: selectedOrder.id,
        status: 'processing',
        note: `Payment verified by admin. ${adminNote ? 'Note: ' + adminNote : ''}`,
      });

      setSuccessMsg('Payment verified and order moved to Processing.');
      fetchOrders();
    } catch (err: any) {
      setError(err.message || 'Failed to verify payment.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (!selectedOrder || !user) return;
    setActionLoading(true);
    setError('');
    try {
      const updateData: any = {
        status: newStatus,
        admin_note: adminNote,
      };
      if (newStatus === 'shipped') updateData.shipped_at = new Date().toISOString();
      if (newStatus === 'delivered') updateData.delivered_at = new Date().toISOString();

      const { error: updateError } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', selectedOrder.id);

      if (updateError) throw updateError;

      await supabase.from('order_status_history').insert({
        order_id: selectedOrder.id,
        status: newStatus,
        note: adminNote || `Status updated to ${newStatus} by admin.`,
      });

      setSuccessMsg(`Order status updated to ${(ui as any)[STATUS_CONFIG[newStatus]?.labelKey]}.`);
      fetchOrders();
    } catch (err: any) {
      setError(err.message || 'Failed to update status.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleVerifyPaymentSettings = async (settingId: string) => {
    if (!user) return;
    setVerifyingId(settingId);
    setVerifyError('');
    setVerifySuccess('');
    try {
      const { error: updateError } = await supabase
        .from('manufacturer_payment_settings')
        .update({
          is_verified: true,
          verified_at: new Date().toISOString(),
          verified_by: user.id,
          admin_note: verifyNote,
        })
        .eq('id', settingId);
      if (updateError) throw updateError;
      setVerifySuccess('Payment settings verified successfully.');
      await fetchPaymentSettings();
    } catch (err: any) {
      setVerifyError(err.message || 'Failed to verify payment settings.');
    } finally {
      setVerifyingId(null);
    }
  };

  const handleUnverifyPaymentSettings = async (settingId: string) => {
    if (!user) return;
    setVerifyingId(settingId);
    setVerifyError('');
    setVerifySuccess('');
    try {
      const { error: updateError } = await supabase
        .from('manufacturer_payment_settings')
        .update({
          is_verified: false,
          verified_at: null,
          admin_note: verifyNote,
        })
        .eq('id', settingId);
      if (updateError) throw updateError;
      setVerifySuccess('Verification removed.');
      await fetchPaymentSettings();
    } catch (err: any) {
      setVerifyError(err.message || 'Failed to update.');
    } finally {
      setVerifyingId(null);
    }
  };

  const handleApproveRefund = async () => {
    if (!selectedOrder || !user) return;
    setRefundLoading(true);
    setError('');
    try {
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          refund_status: 'approved',
          refund_approved_at: new Date().toISOString(),
          refund_approved_by: user.id,
          refund_admin_note: refundNote,
          refund_amount: refundAmount !== '' ? Number(refundAmount) : selectedOrder.total,
          dispute_status: 'resolved',
        })
        .eq('id', selectedOrder.id);

      if (updateError) throw updateError;

      await supabase.from('order_status_history').insert({
        order_id: selectedOrder.id,
        status: selectedOrder.status,
        note: `Refund approved by admin. Amount: $${refundAmount || selectedOrder.total}. Note: ${refundNote || 'No note.'}`,
      });

      setSuccessMsg('Refund approved. Buyer will be notified.');
      fetchOrders();
    } catch (err: any) {
      setError(err.message || 'Failed to approve refund.');
    } finally {
      setRefundLoading(false);
    }
  };

  const handleRejectRefund = async () => {
    if (!selectedOrder || !user) return;
    setRefundLoading(true);
    setError('');
    try {
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          refund_status: 'rejected',
          refund_rejected_at: new Date().toISOString(),
          refund_rejected_by: user.id,
          refund_admin_note: refundNote,
          dispute_status: 'rejected',
        })
        .eq('id', selectedOrder.id);

      if (updateError) throw updateError;

      await supabase.from('order_status_history').insert({
        order_id: selectedOrder.id,
        status: selectedOrder.status,
        note: `Refund request rejected by admin. Note: ${refundNote || 'No note.'}`,
      });

      setSuccessMsg('Refund request rejected.');
      fetchOrders();
    } catch (err: any) {
      setError(err.message || 'Failed to reject refund.');
    } finally {
      setRefundLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const filteredOrders = orders.filter((o) => {
    const matchesSearch =
      !searchQuery ||
      o.order_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.user_profiles?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.user_profiles?.company_name?.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    switch (activeTab) {
      case 'pending': return o.status === 'pending' && !o.payment_verified;
      case 'needs_receipt': return o.status === 'pending' && !o.receipt_url;
      case 'verified': return o.payment_verified;
      case 'processing': return o.status === 'processing';
      case 'disputes': return !!o.dispute_status;
      default: return true;
    }
  });

  const tabCounts = {
    all: orders.length,
    pending: orders.filter((o) => o.status === 'pending' && !o.payment_verified).length,
    needs_receipt: orders.filter((o) => o.status === 'pending' && !o.receipt_url).length,
    verified: orders.filter((o) => o.payment_verified).length,
    processing: orders.filter((o) => o.status === 'processing').length,
    disputes: orders.filter((o) => !!o.dispute_status).length,
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Icon name="ArrowPathIcon" size={32} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !isAdmin) return null;

  return (
    <div className="min-h-screen bg-background" dir={dir}>
      <main className="max-w-7xl mx-auto px-4 md:px-6 py-6 pb-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Icon name="ClipboardDocumentListIcon" size={22} className="text-primary" />
              {ui.adminDashboard}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">{ui.adminSubtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <Icon name="ExclamationTriangleIcon" size={14} className="text-amber-600" />
              <span className="text-xs font-semibold text-amber-800">{ui.awaitingVerification.replace('{count}', String(tabCounts.pending))}</span>
            </div>
          </div>
        </div>

        {/* Admin Tabs */}
        <div className="flex gap-1 mb-6 border-b border-border">
          <button
            onClick={() => setAdminTab('orders')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px ${
              adminTab === 'orders' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon name="ClipboardDocumentListIcon" size={16} />
            {ui.fulfillmentTab}
          </button>
          <button
            onClick={() => setAdminTab('payment_settings')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px ${
              adminTab === 'payment_settings' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon name="BanknotesIcon" size={16} />
            {ui.factoryPaymentsTab}
            {paymentSettingsList.filter((p) => !p.is_verified).length > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                {ui.pendingCount.replace('{count}', String(paymentSettingsList.filter((p) => !p.is_verified).length))}
              </span>
            )}
          </button>
        </div>

        {/* ── ORDER FULFILLMENT TAB ── */}
        {adminTab === 'orders' && (
          <>
        {/* Search */}
        <div className="mb-4">
          <div className="relative max-w-sm">
            <Icon name="MagnifyingGlassIcon" size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder={ui.searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pr-9 pl-4 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
              dir={dir}
            />
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-1 mb-5 overflow-x-auto pb-1">
          {([
            { key: 'all', label: ui.allOrders },
            { key: 'pending', label: ui.awaitingVerify },
            { key: 'needs_receipt', label: ui.noReceipt },
            { key: 'verified', label: ui.verified },
            { key: 'processing', label: ui.processing },
            { key: 'disputes', label: ui.disputes },
          ] as { key: FilterTab; label: string }[]).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === tab.key
                  ? tab.key === 'disputes' ? 'bg-red-600 text-white' : 'bg-primary text-primary-foreground'
                  : 'bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              {tab.label}
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${activeTab === tab.key ? 'bg-white/20 text-white' : tab.key === 'disputes' && tabCounts.disputes > 0 ? 'bg-red-100 text-red-700' : 'bg-muted text-muted-foreground'}`}>
                {tabCounts[tab.key]}
              </span>
            </button>
          ))}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm mb-4 flex items-center gap-2">
            <Icon name="ExclamationCircleIcon" size={16} /> {error}
          </div>
        )}

        {filteredOrders.length === 0 ? (
          <div className="bg-card rounded-2xl border border-border p-12 text-center">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <Icon name="ClipboardDocumentListIcon" size={28} className="text-muted-foreground" />
            </div>
            <h3 className="text-base font-semibold text-foreground mb-2">{ui.emptyTitle}</h3>
            <p className="text-sm text-muted-foreground">{ui.emptyDesc}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
            {/* Orders List */}
            <div className="lg:col-span-2 space-y-2.5 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
              {filteredOrders.map((order) => {
                const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
                const isSelected = selectedOrder?.id === order.id;
                return (
                  <button
                    key={order.id}
                    onClick={() => handleSelectOrder(order)}
                    className={`w-full text-left bg-card rounded-xl border-2 p-4 transition-all ${isSelected ? 'border-primary shadow-sm' : order.dispute_status && order.refund_status === 'pending_review' ? 'border-red-300 hover:border-red-400' : 'border-border hover:border-primary/40'}`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-foreground font-mono">{order.order_number}</p>
                        <p className="text-xs text-muted-foreground truncate">{order.user_profiles?.company_name || order.user_profiles?.full_name || 'Unknown'}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={`shrink-0 text-xs font-semibold px-2 py-1 rounded-full border ${cfg.color}`}>
                          {(ui as any)[cfg.labelKey]}
                        </span>
                        {order.dispute_status && order.refund_status === 'pending_review' && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
                            Dispute
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {order.receipt_url ? (
                          <span className="flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
                            <Icon name="PaperClipIcon" size={10} /> Receipt
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                            <Icon name="ExclamationTriangleIcon" size={10} /> No receipt
                          </span>
                        )}
                        {order.payment_verified && (
                          <span className="flex items-center gap-1 text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                            <Icon name="CheckBadgeIcon" size={10} /> Verified
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-bold text-foreground shrink-0">${order.total?.toLocaleString()}</p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1.5">{formatDate(order.created_at)}</p>
                  </button>
                );
              })}
            </div>

            {/* Order Detail Panel */}
            {selectedOrder && (
              <div className="lg:col-span-3 space-y-4">
                {/* Order Info */}
                <div className="bg-card rounded-2xl border border-border p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-base font-bold text-foreground font-mono">{selectedOrder.order_number}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">{formatDate(selectedOrder.created_at)}</p>
                    </div>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${STATUS_CONFIG[selectedOrder.status]?.color}`}>
                      {(ui as any)[STATUS_CONFIG[selectedOrder.status]?.labelKey]}
                    </span>
                  </div>

                  {/* Customer Info */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-muted/40 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground mb-1">Customer</p>
                      <p className="text-sm font-semibold text-foreground">{selectedOrder.user_profiles?.full_name || '—'}</p>
                      <p className="text-xs text-muted-foreground">{selectedOrder.user_profiles?.email || '—'}</p>
                    </div>
                    <div className="bg-muted/40 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground mb-1">Company</p>
                      <p className="text-sm font-semibold text-foreground">{selectedOrder.user_profiles?.company_name || '—'}</p>
                      <p className="text-xs text-muted-foreground">{selectedOrder.user_profiles?.phone || '—'}</p>
                    </div>
                  </div>

                  {/* Order Items */}
                  <div className="mb-4">
                    <p className="text-xs font-semibold text-foreground mb-2">Items ({selectedOrder.items?.length || 0})</p>
                    <div className="space-y-2">
                      {(selectedOrder.items || []).slice(0, 3).map((item: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between text-sm">
                          <span className="text-foreground truncate flex-1 mr-2">{item.name}</span>
                          <span className="text-muted-foreground shrink-0">×{item.quantity}</span>
                          <span className="font-semibold text-foreground shrink-0 ml-3">${(item.price * item.quantity).toLocaleString()}</span>
                        </div>
                      ))}
                      {(selectedOrder.items?.length || 0) > 3 && (
                        <p className="text-xs text-muted-foreground">+{selectedOrder.items.length - 3} more items</p>
                      )}
                    </div>
                    <div className="border-t border-border mt-3 pt-3 flex justify-between">
                      <span className="text-sm font-bold text-foreground">Total</span>
                      <span className="text-sm font-bold text-primary">${selectedOrder.total?.toLocaleString()} USD</span>
                    </div>
                  </div>

                  {/* Shipping Address */}
                  {selectedOrder.shipping_address && (
                    <div className="bg-muted/40 rounded-lg p-3 mb-4">
                      <p className="text-xs text-muted-foreground mb-1">Shipping Address</p>
                      <p className="text-sm text-foreground">
                        {selectedOrder.shipping_address.address}, {selectedOrder.shipping_address.city}, {selectedOrder.shipping_address.country}
                      </p>
                    </div>
                  )}
                </div>

                {/* Receipt Section */}
                <div className="bg-card rounded-2xl border border-border p-5">
                  <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                    <Icon name="PaperClipIcon" size={16} className="text-primary" />
                    Bank Transfer Receipt
                  </h3>

                  {selectedOrder.receipt_url ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl p-3">
                        <Icon name="DocumentTextIcon" size={20} className="text-green-600 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-green-800">Receipt uploaded</p>
                          <p className="text-xs text-green-700 truncate">{selectedOrder.receipt_filename || 'receipt file'}</p>
                        </div>
                        <a
                          href={selectedOrder.receipt_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 transition-colors"
                        >
                          <Icon name="EyeIcon" size={12} /> View
                        </a>
                      </div>

                      {/* Receipt preview if image */}
                      {selectedOrder.receipt_url && (
                        selectedOrder.receipt_filename?.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                          <div className="rounded-xl overflow-hidden border border-border">
                            <img
                              src={selectedOrder.receipt_url}
                              alt="Bank transfer receipt"
                              className="w-full max-h-56 object-contain bg-muted/30"
                            />
                          </div>
                        ) : null
                      )}

                      {selectedOrder.payment_verified ? (
                        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                          <Icon name="CheckBadgeIcon" size={16} className="text-blue-600" />
                          <p className="text-xs text-blue-800 font-semibold">
                            Payment verified on {selectedOrder.payment_verified_at ? formatDate(selectedOrder.payment_verified_at) : '—'}
                          </p>
                        </div>
                      ) : (
                        <button
                          onClick={handleVerifyPayment}
                          disabled={actionLoading}
                          className="w-full h-10 bg-green-600 text-white font-semibold rounded-lg text-sm disabled:opacity-60 flex items-center justify-center gap-2 hover:bg-green-700 transition-colors"
                        >
                          {actionLoading ? (
                            <><Icon name="ArrowPathIcon" size={16} className="animate-spin" /> Verifying...</>
                          ) : (
                            <><Icon name="CheckBadgeIcon" size={16} /> Verify Payment & Approve</>
                          )}
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
                      <Icon name="ExclamationTriangleIcon" size={18} className="text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-amber-800">No receipt uploaded yet</p>
                        <p className="text-xs text-amber-700 mt-0.5">The customer has not uploaded a bank transfer receipt. You can contact them or wait for the upload.</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Delivery Timeline Info (in detail panel) */}
                {selectedOrder && (selectedOrder.expected_delivery_date || selectedOrder.agreed_delivery_days) && (
                  <div className="bg-card rounded-2xl border border-border p-5">
                    <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                      <Icon name="CalendarDaysIcon" size={16} className="text-primary" />
                      Delivery Timeline
                    </h3>
                    <div className="space-y-2">
                      {selectedOrder.agreed_delivery_days && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Agreed Duration</span>
                          <span className="font-semibold text-foreground">{selectedOrder.agreed_delivery_days} days</span>
                        </div>
                      )}
                      {selectedOrder.expected_delivery_date && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Expected Delivery</span>
                          <span className="font-semibold text-foreground">{formatDate(selectedOrder.expected_delivery_date)}</span>
                        </div>
                      )}
                      {selectedOrder.delivery_otp_verified_at ? (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">OTP Verified (Delivered)</span>
                          <span className="font-semibold text-green-700">{formatDate(selectedOrder.delivery_otp_verified_at)}</span>
                        </div>
                      ) : selectedOrder.expected_delivery_date && new Date() > new Date(selectedOrder.expected_delivery_date) ? (
                        <div className="flex items-center gap-2 text-xs text-red-700 font-semibold bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-1">
                          <Icon name="ExclamationTriangleIcon" size={14} />
                          Delivery overdue — no OTP confirmation received
                        </div>
                      ) : null}
                      {selectedOrder.funds_released_at && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Funds Released</span>
                          <span className="font-semibold text-green-700">{formatDate(selectedOrder.funds_released_at)}</span>
                        </div>
                      )}
                    </div>

                    {/* Admin: Set agreed delivery days */}
                    {!selectedOrder.delivery_otp_verified_at && (
                      <div className="mt-4 pt-4 border-t border-border">
                        <p className="text-xs font-medium text-foreground mb-2">Update Agreed Delivery Duration</p>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={1}
                            max={365}
                            placeholder="Days"
                            id="admin-delivery-days"
                            className="w-24 h-9 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
                          />
                          <button
                            onClick={async () => {
                              const input = document.getElementById('admin-delivery-days') as HTMLInputElement;
                              const days = parseInt(input?.value || '0');
                              if (!days || days < 1 || !selectedOrder) return;
                              const expectedDate = new Date(
                                (selectedOrder.confirmed_at ? new Date(selectedOrder.confirmed_at) : new Date()).getTime() + days * 24 * 60 * 60 * 1000
                              ).toISOString();
                              const { error: updateErr } = await supabase
                                .from('orders')
                                .update({ agreed_delivery_days: days, expected_delivery_date: expectedDate })
                                .eq('id', selectedOrder.id);
                              if (!updateErr) {
                                setSuccessMsg(`Delivery timeline set to ${days} days.`);
                                fetchOrders();
                              }
                            }}
                            className="h-9 px-4 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:opacity-90 transition-opacity"
                          >
                            Set Timeline
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Dispute & Refund Panel */}
                {selectedOrder && selectedOrder.dispute_status && (
                  <div className={`rounded-2xl border p-5 ${selectedOrder.refund_status === 'approved' ? 'bg-green-50 border-green-200' : selectedOrder.refund_status === 'rejected' ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
                    <h3 className={`text-sm font-bold mb-4 flex items-center gap-2 ${selectedOrder.refund_status === 'approved' ? 'text-green-800' : selectedOrder.refund_status === 'rejected' ? 'text-red-800' : 'text-amber-800'}`}>
                      <Icon name="ShieldExclamationIcon" size={16} />
                      Dispute & Refund Review
                    </h3>

                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Dispute Status</span>
                        <span className="font-semibold capitalize text-foreground">{selectedOrder.dispute_status?.replace('_', ' ')}</span>
                      </div>
                      {selectedOrder.dispute_reported_at && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Reported On</span>
                          <span className="font-semibold text-foreground">{formatDate(selectedOrder.dispute_reported_at)}</span>
                        </div>
                      )}
                      {selectedOrder.refund_status && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Refund Status</span>
                          <span className={`font-semibold capitalize ${selectedOrder.refund_status === 'approved' ? 'text-green-700' : selectedOrder.refund_status === 'rejected' ? 'text-red-700' : 'text-amber-700'}`}>
                            {selectedOrder.refund_status?.replace('_', ' ')}
                          </span>
                        </div>
                      )}
                    </div>

                    {selectedOrder.dispute_reason && (
                      <div className="bg-white/60 rounded-xl p-3 mb-4">
                        <p className="text-xs text-muted-foreground mb-1 font-medium">Buyer's Reason</p>
                        <p className="text-sm text-foreground">{selectedOrder.dispute_reason}</p>
                      </div>
                    )}

                    {/* Admin refund actions — only if pending review */}
                    {selectedOrder.refund_status === 'pending_review' && (
                      <div className="space-y-3 pt-3 border-t border-amber-200">
                        <div>
                          <label className="block text-xs font-medium text-foreground mb-1.5">Refund Amount (USD)</label>
                          <input
                            type="number"
                            min={0}
                            value={refundAmount}
                            onChange={(e) => setRefundAmount(e.target.value === '' ? '' : Number(e.target.value))}
                            placeholder={`Max: $${selectedOrder.total?.toLocaleString()}`}
                            className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-foreground mb-1.5">Admin Note (sent to buyer)</label>
                          <textarea
                            value={refundNote}
                            onChange={(e) => setRefundNote(e.target.value)}
                            rows={2}
                            placeholder="Explain the decision to the buyer..."
                            className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors resize-none"
                          />
                        </div>
                        <div className="flex gap-3">
                          <button
                            onClick={handleApproveRefund}
                            disabled={refundLoading}
                            className="flex-1 h-10 bg-green-600 text-white font-semibold rounded-lg text-sm disabled:opacity-60 flex items-center justify-center gap-2 hover:bg-green-700 transition-colors"
                          >
                            {refundLoading ? (
                              <><Icon name="ArrowPathIcon" size={15} className="animate-spin" /> Processing...</>
                            ) : (
                              <><Icon name="CheckCircleIcon" size={15} /> Approve Refund</>
                            )}
                          </button>
                          <button
                            onClick={handleRejectRefund}
                            disabled={refundLoading}
                            className="flex-1 h-10 border border-red-300 text-red-700 font-semibold rounded-lg text-sm disabled:opacity-60 flex items-center justify-center gap-2 hover:bg-red-50 transition-colors"
                          >
                            {refundLoading ? (
                              <><Icon name="ArrowPathIcon" size={15} className="animate-spin" /> Processing...</>
                            ) : (
                              <><Icon name="XCircleIcon" size={15} /> Reject</>
                            )}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Show final decision */}
                    {(selectedOrder.refund_status === 'approved' || selectedOrder.refund_status === 'rejected') && (
                      <div className={`rounded-xl p-3 mt-2 ${selectedOrder.refund_status === 'approved' ? 'bg-green-100 border border-green-200' : 'bg-red-100 border border-red-200'}`}>
                        <p className={`text-xs font-semibold ${selectedOrder.refund_status === 'approved' ? 'text-green-800' : 'text-red-800'}`}>
                          {selectedOrder.refund_status === 'approved'
                            ? `✓ Refund approved — $${selectedOrder.refund_amount?.toLocaleString()} USD on ${selectedOrder.refund_approved_at ? formatDate(selectedOrder.refund_approved_at) : '—'}`
                            : `✗ Refund rejected on ${selectedOrder.refund_rejected_at ? formatDate(selectedOrder.refund_rejected_at) : '—'}`}
                        </p>
                        {selectedOrder.refund_admin_note && (
                          <p className="text-xs text-muted-foreground mt-1">{selectedOrder.refund_admin_note}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Admin Actions */}
                <div className="bg-card rounded-2xl border border-border p-5">
                  <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                    <Icon name="CogIcon" size={16} className="text-primary" />
                    {ui.adminActions}
                  </h3>

                  {successMsg && (
                    <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm mb-4 flex items-center gap-2">
                      <Icon name="CheckCircleIcon" size={16} /> {successMsg}
                    </div>
                  )}

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1.5">{ui.updateStatus}</label>
                      <select
                        value={newStatus}
                        onChange={(e) => setNewStatus(e.target.value as Order['status'])}
                        className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
                      >
                        <option value="pending">{ui.statusPending}</option>
                        <option value="processing">{ui.statusProcessing}</option>
                        <option value="shipped">{ui.statusShipped}</option>
                        <option value="delivered">{ui.statusDelivered}</option>
                        <option value="cancelled">{ui.statusCancelled}</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1.5">{ui.adminNote}</label>
                      <textarea
                        value={adminNote}
                        onChange={(e) => setAdminNote(e.target.value)}
                        rows={3}
                        placeholder={ui.adminNotePlaceholder}
                        className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors resize-none"
                        dir={dir}
                      />
                    </div>

                    <button
                      onClick={handleUpdateStatus}
                      disabled={actionLoading}
                      className="w-full h-10 bg-primary text-primary-foreground font-semibold rounded-lg text-sm disabled:opacity-60 flex items-center justify-center gap-2 transition-opacity active:opacity-80"
                    >
                      {actionLoading ? (
                        <><Icon name="ArrowPathIcon" size={16} className="animate-spin" /> {ui.updating}</>
                      ) : (
                        <><Icon name="CheckIcon" size={16} /> {ui.updateOrder}</>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
          </>
        )}

        {/* ── MANUFACTURER PAYMENTS TAB ── */}
        {adminTab === 'payment_settings' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-muted-foreground">
                {ui.paymentsReview}
              </p>
              <span className="text-xs font-semibold text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
                {ui.factoriesCount.replace('{count}', String(paymentSettingsList.length))}
              </span>
            </div>

            {verifySuccess && (
              <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm mb-4 flex items-center gap-2">
                <Icon name="CheckCircleIcon" size={16} /> {verifySuccess}
              </div>
            )}
            {verifyError && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm mb-4 flex items-center gap-2">
                <Icon name="ExclamationCircleIcon" size={16} /> {verifyError}
              </div>
            )}

            {paymentSettingsLoading ? (
              <div className="flex items-center justify-center py-20">
                <Icon name="ArrowPathIcon" size={24} className="animate-spin text-primary" />
              </div>
            ) : paymentSettingsList.length === 0 ? (
              <div className="bg-card rounded-2xl border border-border p-12 text-center">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                  <Icon name="BanknotesIcon" size={28} className="text-muted-foreground" />
                </div>
                <h3 className="text-base font-semibold text-foreground mb-2">No payment settings yet</h3>
                <p className="text-sm text-muted-foreground">Manufacturers have not submitted their payment details yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
                {/* Manufacturers List */}
                <div className="lg:col-span-2 space-y-2.5 max-h-[calc(100vh-300px)] overflow-y-auto pr-1">
                  {paymentSettingsList.map((ps) => (
                    <button
                      key={ps.id}
                      onClick={() => { setSelectedPaymentSetting(ps); setVerifyNote(ps.admin_note || ''); setVerifySuccess(''); setVerifyError(''); }}
                      className={`w-full text-left bg-card rounded-xl border-2 p-4 transition-all ${selectedPaymentSetting?.id === ps.id ? 'border-primary shadow-sm' : 'border-border hover:border-primary/40'}`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-foreground truncate">{ps.manufacturer?.company_name || ps.manufacturer?.full_name || 'Manufacturer'}</p>
                          <p className="text-xs text-muted-foreground truncate">{ps.manufacturer?.email || '—'}</p>
                        </div>
                        {ps.is_verified ? (
                          <span className="shrink-0 flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200">
                            <Icon name="CheckBadgeIcon" size={10} /> Verified
                          </span>
                        ) : (
                          <span className="shrink-0 flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                            <Icon name="ClockIcon" size={10} /> Pending
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        {ps.bank_name && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                            <Icon name="BuildingLibraryIcon" size={10} /> {ps.bank_name}
                          </span>
                        )}
                        {ps.usdt_trc20_address && (
                          <span className="flex items-center gap-1 text-xs text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                            <Icon name="WalletIcon" size={10} /> Wallet
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>

                {/* Payment Detail Panel */}
                {selectedPaymentSetting && (
                  <div className="lg:col-span-3 space-y-4">
                    {/* Manufacturer Info */}
                    <div className="bg-card rounded-2xl border border-border p-5">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-base font-bold text-foreground">{selectedPaymentSetting.manufacturer?.company_name || selectedPaymentSetting.manufacturer?.full_name || 'Manufacturer'}</h3>
                          <p className="text-xs text-muted-foreground mt-0.5">{selectedPaymentSetting.manufacturer?.email || '—'}</p>
                        </div>
                        {selectedPaymentSetting.is_verified ? (
                          <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-700 border border-green-200">
                            <Icon name="CheckBadgeIcon" size={12} /> Verified
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                            <Icon name="ClockIcon" size={12} /> Awaiting Verification
                          </span>
                        )}
                      </div>

                      {/* Bank Details */}
                      {(selectedPaymentSetting.bank_name || selectedPaymentSetting.iban || selectedPaymentSetting.swift_code) && (
                        <div className="mb-4">
                          <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                            <Icon name="BuildingLibraryIcon" size={14} className="text-primary" /> Bank Account
                          </p>
                          <div className="bg-muted/40 rounded-xl p-4 space-y-2.5">
                            {selectedPaymentSetting.bank_name && (
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-muted-foreground">Bank Name</span>
                                <span className="text-xs font-semibold text-foreground">{selectedPaymentSetting.bank_name}</span>
                              </div>
                            )}
                            {selectedPaymentSetting.bank_account_holder && (
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-muted-foreground">Account Holder</span>
                                <span className="text-xs font-semibold text-foreground">{selectedPaymentSetting.bank_account_holder}</span>
                              </div>
                            )}
                            {selectedPaymentSetting.iban && (
                              <div className="flex justify-between items-center gap-3">
                                <span className="text-xs text-muted-foreground shrink-0">IBAN</span>
                                <span className="text-xs font-mono font-semibold text-foreground break-all text-right">{selectedPaymentSetting.iban}</span>
                              </div>
                            )}
                            {selectedPaymentSetting.swift_code && (
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-muted-foreground">SWIFT / BIC</span>
                                <span className="text-xs font-mono font-semibold text-foreground">{selectedPaymentSetting.swift_code}</span>
                              </div>
                            )}
                            {selectedPaymentSetting.bank_country && (
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-muted-foreground">Country / Currency</span>
                                <span className="text-xs font-semibold text-foreground">{selectedPaymentSetting.bank_country} · {selectedPaymentSetting.bank_currency}</span>
                              </div>
                            )}
                            {selectedPaymentSetting.bank_city && (
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-muted-foreground">City / Branch</span>
                                <span className="text-xs font-semibold text-foreground">{selectedPaymentSetting.bank_city}{selectedPaymentSetting.bank_branch ? ` · ${selectedPaymentSetting.bank_branch}` : ''}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Digital Wallets */}
                      {(selectedPaymentSetting.usdt_trc20_address || selectedPaymentSetting.usdt_erc20_address || selectedPaymentSetting.bitcoin_address || selectedPaymentSetting.ethereum_address || selectedPaymentSetting.other_wallet_address) && (
                        <div className="mb-4">
                          <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                            <Icon name="WalletIcon" size={14} className="text-purple-600" /> Digital Wallets
                          </p>
                          <div className="bg-muted/40 rounded-xl p-4 space-y-2.5">
                            {selectedPaymentSetting.usdt_trc20_address && (
                              <div>
                                <p className="text-xs text-muted-foreground mb-0.5">USDT (TRC-20)</p>
                                <p className="text-xs font-mono text-foreground break-all">{selectedPaymentSetting.usdt_trc20_address}</p>
                              </div>
                            )}
                            {selectedPaymentSetting.usdt_erc20_address && (
                              <div>
                                <p className="text-xs text-muted-foreground mb-0.5">USDT (ERC-20)</p>
                                <p className="text-xs font-mono text-foreground break-all">{selectedPaymentSetting.usdt_erc20_address}</p>
                              </div>
                            )}
                            {selectedPaymentSetting.bitcoin_address && (
                              <div>
                                <p className="text-xs text-muted-foreground mb-0.5">Bitcoin (BTC)</p>
                                <p className="text-xs font-mono text-foreground break-all">{selectedPaymentSetting.bitcoin_address}</p>
                              </div>
                            )}
                            {selectedPaymentSetting.ethereum_address && (
                              <div>
                                <p className="text-xs text-muted-foreground mb-0.5">Ethereum (ETH)</p>
                                <p className="text-xs font-mono text-foreground break-all">{selectedPaymentSetting.ethereum_address}</p>
                              </div>
                            )}
                            {selectedPaymentSetting.other_wallet_address && (
                              <div>
                                <p className="text-xs text-muted-foreground mb-0.5">{selectedPaymentSetting.other_wallet_label || 'Other Wallet'}</p>
                                <p className="text-xs font-mono text-foreground break-all">{selectedPaymentSetting.other_wallet_address}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {selectedPaymentSetting.is_verified && selectedPaymentSetting.verified_at && (
                        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mb-4">
                          <Icon name="CheckBadgeIcon" size={14} className="text-green-600" />
                          <p className="text-xs text-green-800">Verified on {formatDate(selectedPaymentSetting.verified_at)}</p>
                        </div>
                      )}
                    </div>

                    {/* Admin Verification Panel */}
                    <div className="bg-card rounded-2xl border border-border p-5">
                      <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                        <Icon name="ShieldCheckIcon" size={16} className="text-primary" />
                        Verification & Settlement
                      </h3>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-medium text-foreground mb-1.5">Admin Note (optional)</label>
                          <textarea
                            value={verifyNote}
                            onChange={(e) => setVerifyNote(e.target.value)}
                            rows={2}
                            placeholder="Add a note for this manufacturer..."
                            className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors resize-none"
                          />
                        </div>
                        <div className="flex gap-3">
                          {!selectedPaymentSetting.is_verified ? (
                            <button
                              onClick={() => handleVerifyPaymentSettings(selectedPaymentSetting.id)}
                              disabled={verifyingId === selectedPaymentSetting.id}
                              className="flex-1 h-10 bg-green-600 text-white font-semibold rounded-lg text-sm disabled:opacity-60 flex items-center justify-center gap-2 hover:bg-green-700 transition-colors"
                            >
                              {verifyingId === selectedPaymentSetting.id ? (
                                <><Icon name="ArrowPathIcon" size={15} className="animate-spin" /> Verifying...</>
                              ) : (
                                <><Icon name="CheckBadgeIcon" size={15} /> Verify & Approve</>
                              )}
                            </button>
                          ) : (
                            <button
                              onClick={() => handleUnverifyPaymentSettings(selectedPaymentSetting.id)}
                              disabled={verifyingId === selectedPaymentSetting.id}
                              className="flex-1 h-10 border border-red-200 text-red-600 font-semibold rounded-lg text-sm disabled:opacity-60 flex items-center justify-center gap-2 hover:bg-red-50 transition-colors"
                            >
                              {verifyingId === selectedPaymentSetting.id ? (
                                <><Icon name="ArrowPathIcon" size={15} className="animate-spin" /> Updating...</>
                              ) : (
                                <><Icon name="XCircleIcon" size={15} /> Remove Verification</>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
