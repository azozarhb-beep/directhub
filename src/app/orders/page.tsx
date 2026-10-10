'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import Icon from '@/components/ui/AppIcon';
import { generateAndSendEscrowInvoice } from '@/lib/email';
import { PinVerifyModal } from '@/components/PinSecurity';
import { useLanguage } from '@/contexts/LanguageContext';
import OrderWhatsAppButton from '@/components/OrderWhatsAppButton';
import BuyerWarrantyDisplay from '@/components/BuyerWarrantyDisplay';

interface Order {
  id: string;
  order_number: string;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  escrow_status: string | null;
  items: any[];
  shipping_address: any;
  payment_method: string;
  subtotal: number;
  shipping_cost: number;
  total: number;
  notes: string;
  confirmed_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  created_at: string;
  updated_at: string;
  receipt_url: string | null;
  receipt_filename: string | null;
  payment_verified: boolean;
  payment_verified_at: string | null;
  admin_note: string | null;
  // Delivery timeline
  agreed_delivery_days: number | null;
  expected_delivery_date: string | null;
  delivery_otp_verified_at: string | null;
  funds_released_at: string | null;
  otp_sent_at: string | null;
  otp_email: string | null;
  // Delivery PIN
  delivery_pin: string | null;
  delivery_pin_generated_at: string | null;
  delivery_pin_verified_at: string | null;
  // Dispute / refund
  dispute_status: string | null;
  dispute_reported_at: string | null;
  dispute_opened_at: string | null;
  dispute_reason: string | null;
  dispute_tier: number | null;
  dispute_factory_resolution: string | null;
  dispute_factory_resolved_at: string | null;
  dispute_escalated_at: string | null;
  dispute_buyer_response: string | null;
  refund_status: string | null;
  refund_approved_at: string | null;
  refund_rejected_at: string | null;
  refund_admin_note: string | null;
  refund_amount: number | null;
  escrow_frozen_at: string | null;
  dispute_resolution: string | null;
  buyer_confirmed_at: string | null;
  admin_release_note: string | null;
  // Smart invoicing & negotiation
  factory_tax_ref: string | null;
  hard_deadline: string | null;
  hard_deadline_set_at: string | null;
  negotiated_price: number | null;
  negotiated_quantity: number | null;
  negotiated_delivery_days: number | null;
  accepted_quote_id: string | null;
}

interface StatusHistory {
  id: string;
  order_id: string;
  status: string;
  note: string;
  created_at: string;
}

// ─── Escrow Phase Config ──────────────────────────────────────────────────────

const ESCROW_PHASES = [
  { key: 'pending_payment', icon: 'BanknotesIcon', color: 'text-amber-700 bg-amber-50 border-amber-200', step: 0 },
  { key: 'pending_verification', icon: 'MagnifyingGlassIcon', color: 'text-blue-700 bg-blue-50 border-blue-200', step: 1 },
  { key: 'funds_secured', icon: 'LockClosedIcon', color: 'text-indigo-700 bg-indigo-50 border-indigo-200', step: 2 },
  { key: 'shipped', icon: 'TruckIcon', color: 'text-purple-700 bg-purple-50 border-purple-200', step: 3 },
  { key: 'ready_for_inspection', icon: 'MagnifyingGlassIcon', color: 'text-amber-700 bg-amber-50 border-amber-200', step: 4 },
  { key: 'pending_otp_confirmation', icon: 'EnvelopeIcon', color: 'text-orange-700 bg-orange-50 border-orange-200', step: 4 },
  { key: 'pending_admin_payout', icon: 'ClockIcon', color: 'text-emerald-700 bg-emerald-50 border-emerald-200', step: 5 },
  { key: 'escrow_frozen', icon: 'ShieldExclamationIcon', color: 'text-red-700 bg-red-50 border-red-200', step: 4 },
  { key: 'escrow_frozen_escalated', icon: 'ShieldExclamationIcon', color: 'text-red-700 bg-red-50 border-red-200', step: 4 },
  { key: 'refund_processed', icon: 'ArrowUturnLeftIcon', color: 'text-green-700 bg-green-50 border-green-200', step: 6 },
  { key: 'funds_released', icon: 'CheckBadgeIcon', color: 'text-green-700 bg-green-50 border-green-200', step: 6 },
];


const ESCROW_STEPS_DISPLAY = ['pending_payment', 'pending_verification', 'funds_secured', 'ready_for_inspection', 'funds_released'];

const STATUS_CONFIG = {
  pending: { labelKey: 'pending', color: 'text-yellow-700 bg-yellow-50 border-yellow-200', icon: 'ClockIcon', step: 0 },
  processing: { labelKey: 'processing', color: 'text-blue-700 bg-blue-50 border-blue-200', icon: 'CogIcon', step: 1 },
  shipped: { labelKey: 'shipped', color: 'text-purple-700 bg-purple-50 border-purple-200', icon: 'TruckIcon', step: 2 },
  delivered: { labelKey: 'delivered', color: 'text-green-700 bg-green-50 border-green-200', icon: 'CheckCircleIcon', step: 3 },
  cancelled: { labelKey: 'cancelled', color: 'text-red-700 bg-red-50 border-red-200', icon: 'XCircleIcon', step: -1 },
};



function getPhaseLabel(key: string, o: any): string {
  return o?.phases?.[key]?.label || key;
}
function getPhaseDescription(key: string, o: any): string {
  return o?.phases?.[key]?.description || '';
}
function getEscrowPhase(key: string | null) {
  return ESCROW_PHASES.find((p) => p.key === (key || 'pending_payment')) || ESCROW_PHASES[0];
}

export default function OrdersPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const supabase = createClient();
  const { t, dir, language } = useLanguage();
  const o = t.orders;

  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [statusHistory, setStatusHistory] = useState<StatusHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Realtime connection indicator
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [lastRealtimeUpdate, setLastRealtimeUpdate] = useState<Date | null>(null);

  // Receipt upload state
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [receiptSuccess, setReceiptSuccess] = useState('');

  // PIN verification state (required before OTP)
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinVerified, setPinVerified] = useState(false);

  // OTP state
  const [otpSending, setOtpSending] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpEmail, setOtpEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [otpSuccess, setOtpSuccess] = useState('');

  // Delivery PIN state
  const [deliveryPin, setDeliveryPin] = useState<string | null>(null);
  const [deliveryPinLoading, setDeliveryPinLoading] = useState(false);
  const [deliveryPinRevealed, setDeliveryPinRevealed] = useState(false);
  const [deliveryPinUsed, setDeliveryPinUsed] = useState(false);

  // Release code state (escrow release by buyer)
  const [releaseCode, setReleaseCode] = useState('');
  const [releaseCodeLoading, setReleaseCodeLoading] = useState(false);
  const [releaseCodeMsg, setReleaseCodeMsg] = useState('');
  const [releaseCodeSuccess, setReleaseCodeSuccess] = useState(false);

  // Dispute modal state
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeReason, setDisputeReason] = useState<'late_delivery' | 'product_mismatch' | ''>('');
  const [disputeDescription, setDisputeDescription] = useState('');
  const [disputeLoading, setDisputeLoading] = useState(false);
  const [disputeSuccess, setDisputeSuccess] = useState('');
  const [escalateLoading, setEscalateLoading] = useState(false);
  const [acceptResolutionLoading, setAcceptResolutionLoading] = useState(false);
  const [invoiceGenerating, setInvoiceGenerating] = useState(false);
  const [invoiceMsg, setInvoiceMsg] = useState('');

  // Negotiation history state
  const [negotiationHistory, setNegotiationHistory] = useState<any[]>([]);
  const [loadingNegHistory, setLoadingNegHistory] = useState(false);
  const [showNegHistory, setShowNegHistory] = useState(false);

  // Factory tax reference state
  const [factoryTaxRef, setFactoryTaxRef] = useState('');
  const [savingTaxRef, setSavingTaxRef] = useState(false);
  const [taxRefMsg, setTaxRefMsg] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!user) router.push('/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      fetchOrders();

      // ─── Realtime: Orders (buyer view) ──────────────────────────────────
      const ordersChannel = supabase
        .channel('orders_realtime_escrow')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `user_id=eq.${user.id}`,
        }, (payload) => {
          setLastRealtimeUpdate(new Date());
          if (payload.eventType === 'INSERT') {
            setOrders((prev) => [payload.new as Order, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setOrders((prev) => prev.map((o) => o.id === (payload.new as Order).id ? payload.new as Order : o));
            if (selectedOrder?.id === (payload.new as Order).id) {
              setSelectedOrder(payload.new as Order);
            }
          }
        })
        .subscribe((status) => {
          setRealtimeConnected(status === 'SUBSCRIBED');
        });

      // ─── Realtime: Order Status History ─────────────────────────────────
      // Subscribes to all status history inserts; filters client-side by selectedOrder
      const historyChannel = supabase
        .channel('order_status_history_realtime')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'order_status_history',
        }, (payload) => {
          const newEntry = payload.new as StatusHistory;
          // Only append if it belongs to the currently selected order
          setStatusHistory((prev) => {
            if (prev.some((h) => h.id === newEntry.id)) return prev;
            // Check if this entry belongs to the selected order
            if (selectedOrder?.id === newEntry.order_id) {
              return [...prev, newEntry];
            }
            return prev;
          });
        })
        .subscribe();

      return () => {
        supabase.removeChannel(ordersChannel);
        supabase.removeChannel(historyChannel);
      };
    }
  }, [user]);

  const fetchOrders = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error: fetchError } = await supabase
        .from('orders')
        .select('id, order_number, status, total, created_at, items, escrow_status, dispute_status, payment_verified, shipping_address, notes, factory_user_id, user_id, release_code, delivery_pin, payment_method')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (fetchError) throw fetchError;
      setOrders(data || []);
      if (data && data.length > 0 && !selectedOrder) {
        setSelectedOrder(data[0]);
        fetchStatusHistory(data[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load orders.');
    } finally {
      setLoading(false);
    }
  };

  const fetchStatusHistory = async (orderId: string) => {
    try {
      const { data } = await supabase
        .from('order_status_history')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: true });
      setStatusHistory(data || []);
    } catch (err: any) {
      console.log('Status history error:', err.message);
    }
  };

  const handleSelectOrder = (order: Order) => {
    setSelectedOrder(order);
    fetchStatusHistory(order.id);
    setDisputeSuccess('');
    setOtpSent(false);
    setOtpCode('');
    setOtpError('');
    setOtpSuccess('');
    setReceiptSuccess('');
    setPinVerified(false);
    // Reset delivery PIN state
    setDeliveryPin(null);
    setDeliveryPinRevealed(false);
    setDeliveryPinUsed(false);
    // Reset release code state
    setReleaseCode('');
    setReleaseCodeMsg('');
    setReleaseCodeSuccess(false);
    // Reset negotiation history
    setNegotiationHistory([]);
    setShowNegHistory(false);
    setTaxRefMsg('');
    setFactoryTaxRef(order.factory_tax_ref || '');
    // Fetch negotiation history if order has a quote
    if (order.accepted_quote_id) {
      fetchNegotiationHistory(order.id);
    }
  };

  // ─── Receipt Upload ───────────────────────────────────────────────────────

  const handleReceiptUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiptFile || !selectedOrder || !user) return;
    setUploadingReceipt(true);
    setError('');
    try {
      let receiptUrl = '';
      let receiptFilename = receiptFile.name;

      // Try storage upload
      try {
        const ext = receiptFile.name.split('.').pop();
        const path = `receipts/${user.id}/${selectedOrder.id}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from('payment-receipts')
          .upload(path, receiptFile, { upsert: true });
        if (!uploadErr) {
          const { data: urlData } = supabase.storage.from('payment-receipts').getPublicUrl(path);
          receiptUrl = urlData?.publicUrl || '';
        }
      } catch (storageErr: any) {
        console.warn('Storage upload skipped:', storageErr?.message);
        receiptUrl = `receipt_${Date.now()}_${receiptFile.name}`;
      }

      const { error: updateErr } = await supabase
        .from('orders')
        .update({
          receipt_url: receiptUrl,
          receipt_filename: receiptFilename,
          escrow_status: 'pending_verification',
        })
        .eq('id', selectedOrder.id)
        .eq('user_id', user.id);

      if (updateErr) throw updateErr;

      await supabase.from('order_status_history').insert({
        order_id: selectedOrder.id,
        status: selectedOrder.status,
        note: `Buyer uploaded bank transfer receipt: ${receiptFilename}. Awaiting admin verification.`,
      });

      setReceiptSuccess('Receipt uploaded successfully. Admin will verify your payment shortly.');
      setReceiptFile(null);
      fetchOrders();
    } catch (err: any) {
      setError(err.message || 'Failed to upload receipt.');
    } finally {
      setUploadingReceipt(false);
    }
  };

  // ─── OTP Flow ─────────────────────────────────────────────────────────────

  const handleSendOtp = async () => {
    if (!selectedOrder || !user) return;
    setOtpSending(true);
    setOtpError('');
    try {
      const res = await fetch('/api/escrow/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send', order_id: selectedOrder.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send OTP');
      setOtpSent(true);
      setOtpEmail(data.email || '');
    } catch (err: any) {
      setOtpError(err.message);
    } finally {
      setOtpSending(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!selectedOrder || !user || !otpCode.trim()) return;
    setOtpVerifying(true);
    setOtpError('');
    try {
      const res = await fetch('/api/escrow/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', order_id: selectedOrder.id, otp_code: otpCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'OTP verification failed');
      setOtpSuccess(data.message || 'Receipt confirmed! Admin notified to release funds.');
      setOtpCode('');
      fetchOrders();
    } catch (err: any) {
      setOtpError(err.message);
    } finally {
      setOtpVerifying(false);
    }
  };

  // ─── Delivery PIN ─────────────────────────────────────────────────────────

  const handleReleaseByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder || !releaseCode.trim()) return;
    setReleaseCodeLoading(true);
    setReleaseCodeMsg('');
    setReleaseCodeSuccess(false);
    try {
      const res = await fetch('/api/escrow/release-by-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: selectedOrder.id,
          release_code: releaseCode.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || o.verifyFailed);
      setReleaseCodeMsg(data.message || o.verifySuccess);
      setReleaseCodeSuccess(true);
      setReleaseCode('');
      // Refresh orders list
      await fetchOrders();
      setSelectedOrder((prev: any) =>
        prev ? { ...prev, escrow_status: 'funds_released', status: 'delivered' } : prev
      );
    } catch (err: any) {
      setReleaseCodeMsg(err.message || o.verifyFailed);
      setReleaseCodeSuccess(false);
    } finally {
      setReleaseCodeLoading(false);
    }
  };

  const handleFetchOrGenerateDeliveryPin = async () => {
    if (!selectedOrder || !user) return;
    setDeliveryPinLoading(true);
    try {
      // First try to get existing PIN
      const getRes = await fetch('/api/escrow/delivery-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get', order_id: selectedOrder.id }),
      });
      const getData = await getRes.json();
      if (getRes.ok && getData.pin) {
        setDeliveryPin(getData.pin);
        setDeliveryPinUsed(!!getData.is_used);
        setDeliveryPinRevealed(true);
        return;
      }
      // Generate new PIN
      const genRes = await fetch('/api/escrow/delivery-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate', order_id: selectedOrder.id }),
      });
      const genData = await genRes.json();
      if (!genRes.ok) throw new Error(genData.error || 'Failed to generate PIN');
      setDeliveryPin(genData.pin);
      setDeliveryPinUsed(false);
      setDeliveryPinRevealed(true);
    } catch (err: any) {
      setError(err.message || 'Failed to load delivery PIN.');
    } finally {
      setDeliveryPinLoading(false);
    }
  };

  // ─── Dispute ──────────────────────────────────────────────────────────────

  const isDeliveryOverdue = (order: Order): boolean => {
    if (!order.expected_delivery_date) return false;
    if (order.status === 'delivered') return false;
    if (order.delivery_otp_verified_at) return false;
    return new Date() > new Date(order.expected_delivery_date);
  };

  const canOpenDispute = (order: Order): boolean => {
    // Can open dispute if: delivery overdue OR order is in shipped/funds_secured state
    // AND no existing open dispute
    if (order.dispute_status && order.dispute_status !== 'none') return false;
    if (order.escrow_status === 'escrow_frozen') return false;
    if (order.escrow_status === 'refund_processed') return false;
    if (order.escrow_status === 'funds_released') return false;
    if (order.status === 'cancelled') return false;
    // Allow dispute if overdue OR if shipped (product mismatch possible)
    const isActive = ['funds_secured', 'shipped', 'pending_otp_confirmation', 'pending_admin_payout'].includes(order.escrow_status || '');
    return isDeliveryOverdue(order) || isActive;
  };

  const handleOpenDispute = async () => {
    if (!selectedOrder || !user || !disputeReason) return;
    setDisputeLoading(true);
    setError('');
    try {
      const res = await fetch('/api/escrow/dispute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'open',
          order_id: selectedOrder.id,
          reason: disputeReason,
          description: disputeDescription,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to open dispute');
      setDisputeSuccess(data.message || o.disputeOpened);
      setShowDisputeModal(false);
      setDisputeReason('');
      setDisputeDescription('');
      fetchOrders();
    } catch (err: any) {
      setError(err.message || 'Failed to open dispute.');
    } finally {
      setDisputeLoading(false);
    }
  };

  // Keep legacy handler for backward compat
  const handleReportDispute = handleOpenDispute;

  // ─── Accept Factory Resolution (Level 1 close) ────────────────────────────
  const handleAcceptResolution = async () => {
    if (!selectedOrder || !user) return;
    setAcceptResolutionLoading(true);
    setError('');
    try {
      const res = await fetch('/api/escrow/dispute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'buyer_accept', order_id: selectedOrder.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to accept resolution');
      setDisputeSuccess(data.message || o.disputeAccepted);
      fetchOrders();
    } catch (err: any) {
      setError(err.message || 'Failed to accept resolution.');
    } finally {
      setAcceptResolutionLoading(false);
    }
  };

  // ─── Escalate to Admin (Level 2) ──────────────────────────────────────────
  const handleEscalateToAdmin = async () => {
    if (!selectedOrder || !user) return;
    if (!confirm(o.escalateConfirm)) return;
    setEscalateLoading(true);
    setError('');
    try {
      const res = await fetch('/api/escrow/dispute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'buyer_escalate', order_id: selectedOrder.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to escalate dispute');
      setDisputeSuccess(data.message || o.disputeEscalated);
      fetchOrders();
    } catch (err: any) {
      setError(err.message || 'Failed to escalate dispute.');
    } finally {
      setEscalateLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const handleRequestInvoice = async (order: any) => {
    setInvoiceGenerating(true);
    setInvoiceMsg('');
    try {
      const result = await generateAndSendEscrowInvoice(order.id);
      if (!result.success) throw new Error(result.error || 'Failed to generate invoice');
      setInvoiceMsg(`Invoice ${result.invoice?.invoice_number} generated${result.emailSent ? ' and sent to your email' : ''}.`);
    } catch (err: any) {
      setInvoiceMsg('Failed to generate invoice. Please try again.');
    } finally {
      setInvoiceGenerating(false);
    }
  };

  const fetchNegotiationHistory = async (orderId: string) => {
    setLoadingNegHistory(true);
    try {
      const { data } = await supabase
        .from('order_negotiation_history')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: true });
      setNegotiationHistory(data || []);
    } catch (err: any) {
      console.warn('Negotiation history fetch error:', err?.message);
      setNegotiationHistory([]);
    } finally {
      setLoadingNegHistory(false);
    }
  };

  const handleSaveFactoryTaxRef = async () => {
    if (!selectedOrder || !factoryTaxRef.trim()) return;
    setSavingTaxRef(true);
    setTaxRefMsg('');
    try {
      const { error } = await supabase
        .from('orders')
        .update({ factory_tax_ref: factoryTaxRef.trim() })
        .eq('id', selectedOrder.id);
      if (error) throw error;
      setTaxRefMsg(o.taxRefSaved);
      setSelectedOrder((prev: any) => prev ? { ...prev, factory_tax_ref: factoryTaxRef.trim() } : prev);
    } catch (err: any) {
      setTaxRefMsg(o.taxRefFailed.replace('{error}', err.message));
    } finally {
      setSavingTaxRef(false);
    }
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const getDaysRemaining = (dateStr: string): number => {
    const diff = new Date(dateStr).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Icon name="ArrowPathIcon" size={32} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background" dir={dir}>
      <Header />
      <main className="max-w-6xl mx-auto px-4 md:px-6 py-6 mobile-safe-bottom md:pb-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-foreground">{t.orders.title}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{t.orders.subtitle}</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Realtime connection indicator */}
            <div className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold transition-colors ${realtimeConnected ? 'bg-green-50 border-green-200 text-green-700' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${realtimeConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
              {realtimeConnected ? 'Live' : 'Connecting...'}
            </div>
            <Link href="/checkout" className="hidden md:flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg transition-opacity active:opacity-80">
              <Icon name="PlusIcon" size={16} /> {t.common.next}
            </Link>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm mb-4 flex items-center gap-2">
            <Icon name="ExclamationCircleIcon" size={16} />
            {error}
            <button onClick={() => setError('')} className="ml-auto"><Icon name="XMarkIcon" size={14} /></button>
          </div>
        )}

        {orders.length === 0 ? (
          <div className="bg-card rounded-2xl border border-border p-12 text-center">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <Icon name="ShoppingBagIcon" size={28} className="text-muted-foreground" />
            </div>
            <h3 className="text-base font-semibold text-foreground mb-2">{t.orders.noOrders}</h3>
            <p className="text-sm text-muted-foreground mb-5">{t.orders.noOrdersSubtitle}</p>
            <Link href="/" className="px-5 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-lg inline-flex items-center gap-2">
              <Icon name="MagnifyingGlassIcon" size={16} /> {t.search.browseCategories}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
            {/* Orders List */}
            <div className="lg:col-span-2 space-y-3">
              {orders.map((order) => {
                const phase = getEscrowPhase(order.escrow_status);
                const isSelected = selectedOrder?.id === order.id;
                const overdue = isDeliveryOverdue(order);
                return (
                  <button
                    key={order.id}
                    onClick={() => handleSelectOrder(order)}
                    className={`w-full text-left bg-card rounded-xl border-2 p-4 transition-all ${isSelected ? 'border-primary shadow-sm' : 'border-border hover:border-primary/40'}`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <p className="text-sm font-bold text-foreground font-mono">{order.order_number}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{formatDate(order.created_at)}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full border ${phase.color}`}>
                          {getPhaseLabel(phase.key, o)}
                        </span>
                        {overdue && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
                            Overdue
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">{o.itemsCount.replace('{count}', String(order.items?.length || 0))}</p>
                      <p className="text-sm font-bold text-foreground">${order.total?.toLocaleString()} USD</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Order Detail */}
            {selectedOrder && (
              <div className="lg:col-span-3 space-y-4">

                {/* ─── Escrow Progress Bar ─────────────────────────────── */}
                <div className="bg-card rounded-2xl border border-border p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                      <Icon name="ShieldCheckIcon" size={16} className="text-primary" />
                      {o.escrowStatus}
                    </h3>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${getEscrowPhase(selectedOrder.escrow_status).color}`}>
                      {getPhaseLabel(getEscrowPhase(selectedOrder.escrow_status).key, o)}
                    </span>
                  </div>

                  {/* Step indicators */}
                  <div className="relative mb-4">
                    <div className="absolute top-4 left-4 right-4 h-0.5 bg-border" />
                    {(() => {
                      const currentStep = getEscrowPhase(selectedOrder.escrow_status).step;
                      const displaySteps = ESCROW_STEPS_DISPLAY;
                      const progressPct = Math.min((currentStep / (displaySteps.length - 1)) * 100, 100);
                      return (
                        <>
                          <div className="absolute top-4 left-4 h-0.5 bg-primary transition-all duration-500" style={{ width: `calc(${progressPct}% - 8px)` }} />
                          <div className="relative flex justify-between">
                            {displaySteps.map((stepKey) => {
                              const phase = ESCROW_PHASES.find((p) => p.key === stepKey)!;
                              const isDone = phase.step <= currentStep;
                              const isCurrent = stepKey === (selectedOrder.escrow_status || 'pending_payment');
                              return (
                                <div key={stepKey} className="flex flex-col items-center gap-1.5">
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${isCurrent ? 'border-primary bg-primary text-primary-foreground shadow-md' : isDone ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card text-muted-foreground'}`}>
                                    <Icon name={phase.icon as any} size={14} />
                                  </div>
                                  <span className={`text-[10px] font-medium text-center max-w-[60px] leading-tight ${isCurrent ? 'text-primary' : isDone ? 'text-foreground' : 'text-muted-foreground'}`}>
                                    {getPhaseLabel(phase.key, o)}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
                    {getPhaseDescription(getEscrowPhase(selectedOrder.escrow_status).key, o)}
                  </p>

                  {/* ─── WhatsApp Notification Links ──────────────────── */}
                  {(() => {
                    const buyerPhone = user?.user_metadata?.phone as string | undefined;
                    const buyerCountry = user?.user_metadata?.country as string | undefined;
                    const escrowStatus = selectedOrder.escrow_status;
                    const orderStatus = selectedOrder.status;
                    const showShipped =
                      escrowStatus === 'shipped' ||
                      escrowStatus === 'ready_for_inspection' ||
                      escrowStatus === 'pending_otp_confirmation' ||
                      orderStatus === 'shipped' ||
                      orderStatus === 'delivered';
                    if (!buyerPhone) return null;
                    return (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mt-2">
                        <p className="text-[10px] font-semibold text-emerald-700 uppercase mb-2 flex items-center gap-1">
                          <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                          إشعارات واتساب
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          <OrderWhatsAppButton
                            phone={buyerPhone}
                            country={buyerCountry}
                            event="order_placed_buyer"
                          />
                          {showShipped && (
                            <OrderWhatsAppButton
                              phone={buyerPhone}
                              country={buyerCountry}
                              event="shipped_buyer"
                            />
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* ─── Phase 1: Upload Receipt ─────────────────────────── */}
                {(!selectedOrder.escrow_status || selectedOrder.escrow_status === 'pending_payment') && (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
                    <div className="flex items-start gap-3 mb-4">
                      <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center shrink-0">
                        <Icon name="BanknotesIcon" size={20} className="text-amber-700" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-amber-900">Upload Bank Transfer Receipt</h3>
                        <p className="text-xs text-amber-700 mt-0.5">Upload proof of your bank transfer to begin escrow verification</p>
                      </div>
                    </div>
                    {receiptSuccess ? (
                      <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                        <Icon name="CheckCircleIcon" size={16} />
                        {receiptSuccess}
                      </div>
                    ) : (
                      <form onSubmit={handleReceiptUpload} className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-amber-900 mb-1.5">Transfer Receipt (PDF, JPG, PNG)</label>
                          <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                            className="w-full text-xs text-amber-800 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-amber-100 file:text-amber-800 hover:file:bg-amber-200 cursor-pointer"
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={!receiptFile || uploadingReceipt}
                          className="w-full h-10 bg-amber-600 text-white font-semibold rounded-lg text-sm disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-amber-700 transition-colors"
                        >
                          {uploadingReceipt ? (
                            <><Icon name="ArrowPathIcon" size={15} className="animate-spin" /> Uploading...</>
                          ) : (
                            <><Icon name="ArrowUpTrayIcon" size={15} /> Submit Receipt</>
                          )}
                        </button>
                      </form>
                    )}
                  </div>
                )}

                {/* ─── Phase 2: Pending Verification ───────────────────── */}
                {selectedOrder.escrow_status === 'pending_verification' && (
                  <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                        <Icon name="MagnifyingGlassIcon" size={20} className="text-blue-700" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-blue-900">Payment Under Review</h3>
                        <p className="text-xs text-blue-700 mt-1">
                          Your bank transfer receipt has been submitted. Our admin team is verifying the payment. You will be notified once funds are secured in escrow.
                        </p>
                        {selectedOrder.receipt_filename && (
                          <p className="text-xs text-blue-600 mt-2 flex items-center gap-1">
                            <Icon name="DocumentIcon" size={12} />
                            Receipt: {selectedOrder.receipt_filename}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* ─── Phase 3: Funds Secured ───────────────────────────── */}
                {selectedOrder.escrow_status === 'funds_secured' && (
                  <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-5">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center shrink-0">
                        <Icon name="LockClosedIcon" size={20} className="text-indigo-700" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-indigo-900">Funds Secured in Escrow ✓</h3>
                        <p className="text-xs text-indigo-700 mt-1">
                          Payment verified. Your funds are safely held in escrow. The factory has been notified and will begin shipping your order.
                        </p>
                        {selectedOrder.payment_verified_at && (
                          <p className="text-xs text-indigo-600 mt-2">Verified: {formatDate(selectedOrder.payment_verified_at)}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* ─── Phase: Ready for Inspection — Release Code Entry ── */}
                {selectedOrder.escrow_status === 'ready_for_inspection' && !releaseCodeSuccess && (
                  <div className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-400 rounded-2xl p-5">
                    <div className="flex items-start gap-3 mb-4">
                      <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center shrink-0">
                        <Icon name="MagnifyingGlassIcon" size={20} className="text-amber-700" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-sm font-bold text-amber-900">{o.readyInspectTitle}</h3>
                        <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                          {o.readyInspectBody}
                        </p>
                      </div>
                    </div>

                    {/* Warning */}
                    <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 mb-4">
                      <Icon name="ExclamationTriangleIcon" size={15} className="text-red-600 shrink-0 mt-0.5" />
                      <p className="text-xs text-red-700">
                        {o.readyInspectWarn}
                      </p>
                    </div>

                    {releaseCodeMsg && (
                      <div className={`rounded-xl px-4 py-3 flex items-start gap-2 mb-4 ${releaseCodeSuccess ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                        <Icon name={releaseCodeSuccess ? 'CheckBadgeIcon' : 'ExclamationCircleIcon'} size={16} className={releaseCodeSuccess ? 'text-green-600 shrink-0 mt-0.5' : 'text-red-600 shrink-0 mt-0.5'} />
                        <p className={`text-sm font-semibold ${releaseCodeSuccess ? 'text-green-800' : 'text-red-800'}`}>{releaseCodeMsg}</p>
                      </div>
                    )}

                    <form onSubmit={handleReleaseByCode} className="space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-amber-800 mb-2">
                          {o.releaseCodeLabel} <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          value={releaseCode}
                          onChange={(e) => setReleaseCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          placeholder="_ _ _ _ _ _"
                          className="w-full h-14 px-4 rounded-xl border-2 border-amber-300 bg-white text-foreground text-center text-2xl font-black tracking-[0.4em] focus:outline-none focus:border-amber-500 transition-colors font-mono"
                        />
                        <p className="text-[10px] text-amber-600 mt-1.5 text-center">
                          {o.releaseCodeHint}
                        </p>
                      </div>
                      <button
                        type="submit"
                        disabled={releaseCodeLoading || releaseCode.length !== 6}
                        className="w-full h-12 bg-amber-600 text-white font-bold rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-amber-700 transition-colors"
                      >
                        {releaseCodeLoading ? (
                          <><Icon name="ArrowPathIcon" size={16} className="animate-spin" /> {o.verifying}</>
                        ) : (
                          <><Icon name="CheckBadgeIcon" size={16} /> {o.confirmInspectRelease}</>
                        )}
                      </button>
                    </form>
                  </div>
                )}

                {/* ─── Release Code Success ─────────────────────────────── */}
                {releaseCodeSuccess && (
                  <div className="bg-green-50 border-2 border-green-300 rounded-2xl p-5">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center shrink-0">
                        <Icon name="CheckBadgeIcon" size={20} className="text-green-700" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-green-900">{o.successTitle}</h3>
                        <p className="text-xs text-green-700 mt-1">{releaseCodeMsg}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* ─── Delivery PIN Card (shown from funds_secured onwards) ── */}
                {['funds_secured', 'shipped', 'pending_otp_confirmation', 'pending_admin_payout'].includes(selectedOrder.escrow_status || '') && !selectedOrder.delivery_pin_verified_at && (
                  <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-300 rounded-2xl p-5">
                    <div className="flex items-start gap-3 mb-4">
                      <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center shrink-0">
                        <Icon name="KeyIcon" size={20} className="text-emerald-700" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-sm font-bold text-emerald-900">{o.secretPinTitle}</h3>
                        <p className="text-xs text-emerald-700 mt-1 leading-relaxed">
                          {o.secretPinBody}
                        </p>
                      </div>
                    </div>

                    {!deliveryPinRevealed ? (
                      <button
                        onClick={handleFetchOrGenerateDeliveryPin}
                        disabled={deliveryPinLoading}
                        className="w-full h-12 bg-emerald-600 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 hover:bg-emerald-700 transition-colors disabled:opacity-50"
                      >
                        {deliveryPinLoading ? (
                          <><Icon name="ArrowPathIcon" size={16} className="animate-spin" /> {o.loading}</>
                        ) : (
                          <><Icon name="EyeIcon" size={16} /> {o.showSecretPin}</>
                        )}
                      </button>
                    ) : (
                      <div className="space-y-3">
                        {/* PIN Display */}
                        <div className="bg-white border-2 border-emerald-400 rounded-xl p-4 text-center">
                          <p className="text-xs text-emerald-600 font-semibold mb-2 uppercase tracking-wider">{o.secretPinLabel}</p>
                          <div className="flex items-center justify-center gap-2">
                            <p className="text-4xl font-black text-emerald-800 tracking-[0.3em] font-mono">
                              {deliveryPin}
                            </p>
                            <button
                              onClick={() => {
                                if (deliveryPin) {
                                  navigator.clipboard?.writeText(deliveryPin);
                                }
                              }}
                              className="w-8 h-8 rounded-lg bg-emerald-100 hover:bg-emerald-200 flex items-center justify-center transition-colors"
                              title={o.copyCode}
                            >
                              <Icon name="ClipboardDocumentIcon" size={15} className="text-emerald-700" />
                            </button>
                          </div>
                          {deliveryPinUsed && (
                            <p className="text-xs text-emerald-600 mt-2 font-semibold">{o.pinUsed}</p>
                          )}
                        </div>

                        {/* Warning */}
                        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                          <Icon name="ExclamationTriangleIcon" size={15} className="text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs font-bold text-amber-800">{o.importantWarning}</p>
                            <p className="text-xs text-amber-700 mt-0.5">
                              {o.pinWarnBody}
                            </p>
                          </div>
                        </div>

                        <button
                          onClick={() => setDeliveryPinRevealed(false)}
                          className="w-full text-xs text-emerald-700 hover:text-emerald-900 underline"
                        >
                          {o.hidePin}
                        </button>
                      </div>
                    )}

                    {/* DirectHub Privacy Shield notice */}
                    <div className="mt-3 flex items-center gap-2 text-[10px] text-emerald-600">
                      <Icon name="ShieldCheckIcon" size={12} className="shrink-0" />
                      <span>{o.privacyShield}</span>
                    </div>
                  </div>
                )}

                {/* ─── Delivery PIN Used — Order Complete ──────────────── */}
                {selectedOrder.delivery_pin_verified_at && selectedOrder.escrow_status === 'funds_released' && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-start gap-3">
                    <Icon name="KeyIcon" size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-emerald-800">{o.deliveryConfirmedPin}</p>
                      <p className="text-xs text-emerald-700 mt-0.5">
                        {o.deliveryConfirmedPinBody.replace('{date}', new Date(selectedOrder.delivery_pin_verified_at).toLocaleString(language === 'ar' ? 'ar-SA' : language === 'zh' ? 'zh-CN' : language === 'tr' ? 'tr-TR' : 'en-US'))}
                      </p>
                    </div>
                  </div>
                )}

                {/* ─── Phase 4: Shipped — Confirm Receipt ──────────────── */}
                {selectedOrder.escrow_status === 'shipped' && (
                  <div className="bg-purple-50 border border-purple-200 rounded-2xl p-5">
                    <div className="flex items-start gap-3 mb-4">
                      <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center shrink-0">
                        <Icon name="TruckIcon" size={20} className="text-purple-700" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-purple-900">Goods Shipped — Confirm Receipt</h3>
                        <p className="text-xs text-purple-700 mt-1">
                          Your order has been shipped. Once you receive and inspect the goods, click below to confirm receipt. An OTP will be sent to your email.
                        </p>
                      </div>
                    </div>
                    {/* PIN security notice */}
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-100 border border-purple-200 mb-3">
                      <Icon name="ShieldCheckIcon" size={14} className="text-purple-700 shrink-0" />
                      <p className="text-xs text-purple-800 font-medium">
                        {o.pinRequired}
                      </p>
                    </div>
                    <button
                      onClick={() => setShowPinModal(true)}
                      disabled={otpSending}
                      className="w-full h-11 bg-purple-600 text-white font-semibold rounded-lg text-sm disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-purple-700 transition-colors"
                    >
                      {otpSending ? (
                        <><Icon name="ArrowPathIcon" size={15} className="animate-spin" /> Sending OTP...</>
                      ) : (
                        <><Icon name="ShieldCheckIcon" size={15} /> Verify PIN & Confirm Receipt</>
                      )}
                    </button>
                  </div>
                )}

                {/* ─── Phase 5: OTP Entry ───────────────────────────────── */}
                {(selectedOrder.escrow_status === 'pending_otp_confirmation' || otpSent) && !otpSuccess && (
                  <div className="bg-orange-50 border border-orange-200 rounded-2xl p-5">
                    <div className="flex items-start gap-3 mb-4">
                      <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center shrink-0">
                        <Icon name="EnvelopeIcon" size={20} className="text-orange-700" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-orange-900">Enter Verification Code</h3>
                        <p className="text-xs text-orange-700 mt-1">
                          A 6-digit OTP has been sent to your registered email address
                          {(otpEmail || selectedOrder.otp_email) && (
                            <span className="font-semibold"> ({otpEmail || selectedOrder.otp_email})</span>
                          )}. Enter it below to confirm receipt.
                        </p>
                      </div>
                    </div>

                    {otpError && (
                      <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
                        <Icon name="ExclamationCircleIcon" size={14} />
                        {otpError}
                      </div>
                    )}

                    <div className="space-y-3">
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="Enter 6-digit OTP"
                        className="w-full h-12 px-4 rounded-xl border-2 border-orange-200 bg-white text-foreground text-center text-xl font-bold tracking-widest focus:outline-none focus:border-orange-500 transition-colors"
                      />
                      <button
                        onClick={handleVerifyOtp}
                        disabled={otpVerifying || otpCode.length !== 6}
                        className="w-full h-11 bg-orange-600 text-white font-semibold rounded-lg text-sm disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-orange-700 transition-colors"
                      >
                        {otpVerifying ? (
                          <><Icon name="ArrowPathIcon" size={15} className="animate-spin" /> Verifying...</>
                        ) : (
                          <><Icon name="CheckCircleIcon" size={15} /> Confirm Receipt</>
                        )}
                      </button>
                      <button
                        onClick={handleSendOtp}
                        disabled={otpSending}
                        className="w-full text-xs text-orange-700 hover:text-orange-900 underline"
                      >
                        {otpSending ? 'Resending...' : 'Resend OTP'}
                      </button>
                    </div>
                  </div>
                )}

                {/* ─── OTP Success ──────────────────────────────────────── */}
                {otpSuccess && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex items-start gap-3">
                    <Icon name="CheckBadgeIcon" size={22} className="text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-emerald-800">{o.receiptConfirmed}</p>
                      <p className="text-xs text-emerald-700 mt-0.5">{otpSuccess}</p>
                      <p className="text-xs text-emerald-600 mt-2 bg-emerald-100 rounded-lg px-3 py-2">
                        {o.adminNotified}
                      </p>
                    </div>
                  </div>
                )}

                {/* ─── Phase: Pending Admin Payout ─────────────────────── */}
                {selectedOrder.escrow_status === 'pending_admin_payout' && !otpSuccess && (
                  <div className="bg-emerald-50 border-2 border-emerald-300 rounded-2xl p-5">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center shrink-0">
                        <Icon name="ClockIcon" size={20} className="text-emerald-700" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-emerald-900">{o.awaitingAdminTitle}</h3>
                        <p className="text-xs text-emerald-700 mt-1 leading-relaxed">
                          {o.awaitingAdminBody}
                        </p>
                        {selectedOrder.buyer_confirmed_at && (
                          <p className="text-xs text-emerald-600 mt-2 flex items-center gap-1">
                            <Icon name="CheckCircleIcon" size={12} />
                            {o.confirmDateLabel.replace('{date}', new Date(selectedOrder.buyer_confirmed_at).toLocaleString(language === 'ar' ? 'ar-SA' : language === 'zh' ? 'zh-CN' : language === 'tr' ? 'tr-TR' : 'en-US'))}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* ─── Phase 6: Funds Released ──────────────────────────── */}
                {selectedOrder.escrow_status === 'funds_released' && (
                  <div className="bg-green-50 border border-green-200 rounded-2xl p-5">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center shrink-0">
                        <Icon name="CheckBadgeIcon" size={20} className="text-green-700" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-green-900">{o.txnCompleteTitle}</h3>
                        <p className="text-xs text-green-700 mt-1">
                          {o.txnCompleteBody}
                        </p>
                        {selectedOrder.funds_released_at && (
                          <p className="text-xs text-green-600 mt-2">{o.completionDateLabel.replace('{date}', formatDate(selectedOrder.funds_released_at))}</p>
                        )}
                        {selectedOrder.admin_release_note && (
                          <p className="text-xs text-green-700 mt-1 italic">{selectedOrder.admin_release_note}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* ─── Commercial Invoice ───────────────────────────────── */}
                {['funds_secured', 'shipped', 'pending_otp_confirmation', 'funds_released'].includes(selectedOrder.escrow_status || '') && (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center shrink-0">
                        <Icon name="DocumentTextIcon" size={20} className="text-amber-700" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-amber-900">Commercial Invoice</h3>
                        <p className="text-xs text-amber-700 mt-0.5">
                          Request an official commercial invoice for this escrow order. It will be emailed to your registered address.
                        </p>
                      </div>
                    </div>
                    {invoiceMsg && (
                      <div className={`rounded-lg px-3 py-2 flex items-center gap-2 mb-3 ${invoiceMsg.includes('Failed') ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
                        <Icon name={invoiceMsg.includes('Failed') ? 'ExclamationCircleIcon' : 'CheckCircleIcon'} size={14} className={invoiceMsg.includes('Failed') ? 'text-red-600' : 'text-green-600'} />
                        <p className={`text-xs font-medium ${invoiceMsg.includes('Failed') ? 'text-red-700' : 'text-green-700'}`}>{invoiceMsg}</p>
                      </div>
                    )}
                    <button
                      onClick={() => handleRequestInvoice(selectedOrder)}
                      disabled={invoiceGenerating}
                      className="w-full h-10 bg-amber-600 text-white font-semibold rounded-lg text-sm flex items-center justify-center gap-2 hover:bg-amber-700 transition-colors disabled:opacity-50"
                    >
                      {invoiceGenerating ? <Icon name="ArrowPathIcon" size={15} className="animate-spin" /> : <Icon name="EnvelopeIcon" size={15} />}
                      {invoiceGenerating ? 'Generating...' : 'Get Invoice via Email'}
                    </button>
                  </div>
                )}

                {/* ─── Dispute Section ──────────────────────────────────── */}
                {disputeSuccess && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
                    <Icon name="CheckCircleIcon" size={18} className="text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-blue-800">{o.complaintSubmitted}</p>
                      <p className="text-xs text-blue-700 mt-0.5">{disputeSuccess}</p>
                    </div>
                  </div>
                )}

                {/* ─── Level 1: Dispute Sent to Factory (awaiting factory response) ── */}
                {selectedOrder.dispute_status === 'open' && !['escrow_frozen', 'escrow_frozen_escalated', 'refund_processed'].includes(selectedOrder.escrow_status || '') && !disputeSuccess && (
                  <div className="bg-orange-50 border-2 border-orange-300 rounded-2xl p-5">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center shrink-0">
                        <Icon name="ClockIcon" size={20} className="text-orange-600" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-sm font-bold text-orange-800">{o.tier1Title}</h3>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-200 text-orange-800">Level 1</span>
                        </div>
                        <p className="text-xs text-orange-700 leading-relaxed">
                          {o.tier1Body}
                        </p>
                      </div>
                    </div>
                    <div className="bg-white/60 rounded-xl p-3 space-y-1.5 border border-orange-200 mb-3">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">{o.complaintReason}</span>
                        <span className="font-semibold text-orange-700">
                          {selectedOrder.dispute_reason === 'late_delivery' ? `⏰ ${o.lateDelivery}` : `⚠️ ${o.specMismatch}`}
                        </span>
                      </div>
                      {selectedOrder.dispute_opened_at && (
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">{o.reportedAt}</span>
                          <span className="font-medium">{new Date(selectedOrder.dispute_opened_at).toLocaleString(language === 'ar' ? 'ar-SA' : language === 'zh' ? 'zh-CN' : language === 'tr' ? 'tr-TR' : 'en-US')}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">{o.protectedAmount}</span>
                        <span className="font-bold text-orange-700">${selectedOrder.total?.toLocaleString()} USD</span>
                      </div>
                    </div>
                    <button
                      onClick={handleEscalateToAdmin}
                      disabled={escalateLoading}
                      className="w-full h-10 bg-red-600 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 hover:bg-red-700 transition-colors disabled:opacity-50"
                    >
                      {escalateLoading ? (
                        <><Icon name="ArrowPathIcon" size={14} className="animate-spin" /> {o.escalating}</>
                      ) : (
                        <><Icon name="ArrowUpCircleIcon" size={15} /> {o.escalateToAdmin}</>
                      )}
                    </button>
                    <p className="text-[10px] text-orange-600 text-center mt-2">
                      {o.escalateHint}
                    </p>
                  </div>
                )}

                {/* ─── Level 1: Factory Offered Resolution — Buyer Response ── */}
                {selectedOrder.dispute_status === 'factory_resolved' && !disputeSuccess && (
                  <div className="bg-blue-50 border-2 border-blue-400 rounded-2xl p-5">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                        <Icon name="BuildingOffice2Icon" size={20} className="text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-sm font-bold text-blue-800">{o.factoryResolutionTitle}</h3>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-200 text-blue-800">Level 1</span>
                        </div>
                        <p className="text-xs text-blue-700 leading-relaxed">
                          {o.factoryResolutionBody}
                        </p>
                      </div>
                    </div>

                    {/* Factory Resolution Details */}
                    {selectedOrder.dispute_factory_resolution && (
                      <div className="bg-white border border-blue-200 rounded-xl p-4 mb-4">
                        <p className="text-xs font-bold text-blue-800 mb-2 flex items-center gap-1.5">
                          <Icon name="ChatBubbleLeftRightIcon" size={13} />
                          {o.proposedResolution}
                        </p>
                        <p className="text-sm text-foreground leading-relaxed">{selectedOrder.dispute_factory_resolution}</p>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={handleAcceptResolution}
                        disabled={acceptResolutionLoading}
                        className="h-11 bg-emerald-600 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 hover:bg-emerald-700 transition-colors disabled:opacity-50"
                      >
                        {acceptResolutionLoading ? (
                          <Icon name="ArrowPathIcon" size={14} className="animate-spin" />
                        ) : (
                          <><Icon name="CheckCircleIcon" size={15} /> {o.acceptResolution}</>
                        )}
                      </button>
                      <button
                        onClick={handleEscalateToAdmin}
                        disabled={escalateLoading}
                        className="h-11 bg-red-600 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 hover:bg-red-700 transition-colors disabled:opacity-50"
                      >
                        {escalateLoading ? (
                          <Icon name="ArrowPathIcon" size={14} className="animate-spin" />
                        ) : (
                          <><Icon name="ArrowUpCircleIcon" size={15} /> {o.rejectEscalate}</>
                        )}
                      </button>
                    </div>
                    <p className="text-[10px] text-muted-foreground text-center mt-2">
                      {o.resolutionHint}
                    </p>
                  </div>
                )}

                {/* ─── Level 2: Escalated to Admin — Escrow Frozen ─────────── */}
                {(selectedOrder.escrow_status === 'escrow_frozen_escalated' || (selectedOrder.dispute_status === 'escalated' && selectedOrder.escrow_status === 'escrow_frozen')) && (
                  <div className="bg-red-50 border-2 border-red-400 rounded-2xl p-5">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center shrink-0">
                        <Icon name="ShieldExclamationIcon" size={20} className="text-red-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-sm font-bold text-red-800">{o.tier2Title}</h3>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-200 text-red-800">Level 2</span>
                        </div>
                        <p className="text-xs text-red-700 mt-1 leading-relaxed">
                          {o.tier2Body}
                        </p>
                      </div>
                    </div>
                    <div className="bg-white/60 rounded-xl p-3 space-y-1.5 border border-red-200">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">{o.complaintReason}</span>
                        <span className="font-semibold text-red-700">
                          {selectedOrder.dispute_reason === 'late_delivery' ? `⏰ ${o.lateDelivery}` : `⚠️ ${o.specMismatch}`}
                        </span>
                      </div>
                      {selectedOrder.dispute_escalated_at && (
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">{o.escalatedAt}</span>
                          <span className="font-medium">{new Date(selectedOrder.dispute_escalated_at).toLocaleString(language === 'ar' ? 'ar-SA' : language === 'zh' ? 'zh-CN' : language === 'tr' ? 'tr-TR' : 'en-US')}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">{o.frozenAmount}</span>
                        <span className="font-bold text-red-700">${selectedOrder.total?.toLocaleString()} USD</span>
                      </div>
                    </div>
                    <div className="mt-3 bg-red-100 rounded-xl px-4 py-3 flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
                      <p className="text-xs text-red-700 font-medium">
                        {o.adminReviewing}
                      </p>
                    </div>
                  </div>
                )}

                {/* ─── Legacy: Escrow Frozen (old system) ──────────────────── */}
                {selectedOrder.escrow_status === 'escrow_frozen' && !['open', 'factory_resolved', 'escalated'].includes(selectedOrder.dispute_status || '') && (
                  <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-5">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center shrink-0">
                        <Icon name="ShieldExclamationIcon" size={20} className="text-red-600" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-red-800">{o.escrowFrozenTitle}</h3>
                        <p className="text-xs text-red-700 mt-1 leading-relaxed">
                          {o.escrowFrozenBody}
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-red-600 mt-3 text-center bg-red-100 rounded-lg py-2 px-3">
                      {o.adminWillContact}
                    </p>
                  </div>
                )}

                {/* ─── Refund Processed Banner ──────────────────────────── */}
                {selectedOrder.escrow_status === 'refund_processed' && (
                  <div className="bg-green-50 border-2 border-green-300 rounded-2xl p-5">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center shrink-0">
                        <Icon name="ArrowUturnLeftIcon" size={20} className="text-green-700" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-green-800">{o.refundApprovedTitle}</h3>
                        <p className="text-xs text-green-700 mt-1 leading-relaxed">
                          {o.refundApprovedBody}
                        </p>
                        <div className="mt-2 space-y-1">
                          <p className="text-xs font-bold text-green-700">{o.refundAmount.replace('{amount}', String(selectedOrder.total?.toLocaleString() || '0'))}</p>
                          {selectedOrder.refund_processed_at && (
                            <p className="text-xs text-green-600">{o.refundDate.replace('{date}', new Date(selectedOrder.refund_processed_at).toLocaleString(language === 'ar' ? 'ar-SA' : language === 'zh' ? 'zh-CN' : language === 'tr' ? 'tr-TR' : 'en-US'))}</p>
                          )}
                          {selectedOrder.admin_release_note && (
                            <p className="text-xs text-green-600 italic">{o.adminNote.replace('{note}', selectedOrder.admin_release_note)}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ─── Open Dispute Button (Level 1) ───────────────────── */}
                {canOpenDispute(selectedOrder) && !disputeSuccess && (
                  <div className="bg-orange-50 border border-orange-200 rounded-2xl p-5">
                    <div className="flex items-start gap-3 mb-4">
                      <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center shrink-0">
                        <Icon name="ExclamationTriangleIcon" size={20} className="text-orange-600" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-orange-800">{o.haveProblemTitle}</h3>
                        <p className="text-xs text-orange-700 mt-0.5">
                          {isDeliveryOverdue(selectedOrder)
                            ? o.haveProblemLate : o.haveProblemSpec}
                        </p>
                        <p className="text-[10px] text-orange-600 mt-1 bg-orange-100 rounded px-2 py-1 inline-block">
                          {o.tier1Hint}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowDisputeModal(true)}
                      className="w-full h-11 bg-orange-600 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 hover:bg-orange-700 transition-colors shadow-sm"
                    >
                      <Icon name="FlagIcon" size={16} /> {o.reportProblem}
                    </button>
                  </div>
                )}

                {/* ─── Existing Dispute Status (non-frozen) ────────────── */}
                {selectedOrder.dispute_status && !['escrow_frozen', 'refund_processed'].includes(selectedOrder.escrow_status || '') && selectedOrder.dispute_status !== 'resolved_refund' && (
                  <div className={`rounded-2xl border p-5 ${selectedOrder.refund_status === 'approved' ? 'bg-green-50 border-green-200' : selectedOrder.refund_status === 'rejected' ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
                    <h3 className={`text-sm font-bold mb-3 flex items-center gap-2 ${selectedOrder.refund_status === 'approved' ? 'text-green-800' : selectedOrder.refund_status === 'rejected' ? 'text-red-800' : 'text-amber-800'}`}>
                      <Icon name="ShieldExclamationIcon" size={16} />
                      {o.disputeRefundStatus}
                    </h3>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{o.disputeStatus}</span>
                        <span className="font-semibold capitalize text-foreground">{selectedOrder.dispute_status?.replace('_', ' ')}</span>
                      </div>
                      {selectedOrder.refund_status && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{o.refundStatus}</span>
                          <span className={`font-semibold capitalize ${selectedOrder.refund_status === 'approved' ? 'text-green-700' : selectedOrder.refund_status === 'rejected' ? 'text-red-700' : 'text-amber-700'}`}>
                            {selectedOrder.refund_status?.replace('_', ' ')}
                          </span>
                        </div>
                      )}
                      {selectedOrder.refund_admin_note && (
                        <div className="mt-2 bg-white/60 rounded-lg p-3">
                          <p className="text-xs text-muted-foreground mb-1">{o.adminNoteLabel}</p>
                          <p className="text-xs text-foreground">{selectedOrder.refund_admin_note}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ─── Order Info ───────────────────────────────────────── */}
                <div className="bg-card rounded-2xl border border-border p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-foreground">Order Details</h3>
                    <div className="flex items-center gap-2">
                      {realtimeConnected && (
                        <span className="flex items-center gap-1 text-[10px] font-semibold text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                          Live Updates
                        </span>
                      )}
                      <span className="text-xs font-mono text-muted-foreground">{selectedOrder.order_number}</span>
                    </div>
                  </div>

                  <div className="space-y-2 mb-4">
                    {selectedOrder.items?.map((item: any, i: number) => (
                      <div key={i} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                        <div>
                          <p className="text-sm font-medium text-foreground">{item.name}</p>
                          <p className="text-xs text-muted-foreground">{item.supplier} · Qty: {item.quantity}</p>
                        </div>
                        <p className="text-sm font-semibold text-foreground">${(item.price * item.quantity).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>

                  <BuyerWarrantyDisplay orderId={selectedOrder.id} />

                  <div className="bg-muted/50 rounded-lg p-3 space-y-1.5 mb-4">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="text-foreground">${selectedOrder.subtotal?.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Shipping</span>
                      <span className="text-foreground">${selectedOrder.shipping_cost?.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold border-t border-border pt-1.5">
                      <span className="text-foreground">Total</span>
                      <span className="text-primary">${selectedOrder.total?.toLocaleString()} USD</span>
                    </div>
                  </div>

                  {/* ─── Expected Delivery Date — Legal Reference ──────── */}
                  {selectedOrder.expected_delivery_date && (
                    <div className={`rounded-xl border p-3 mb-4 ${isDeliveryOverdue(selectedOrder) ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <Icon name="CalendarDaysIcon" size={14} className={isDeliveryOverdue(selectedOrder) ? 'text-red-600' : 'text-blue-600'} />
                        <p className={`text-xs font-bold ${isDeliveryOverdue(selectedOrder) ? 'text-red-800' : 'text-blue-800'}`}>
                          {o.expectedDeliveryLegal}
                        </p>
                      </div>
                      <p className={`text-sm font-bold ${isDeliveryOverdue(selectedOrder) ? 'text-red-700' : 'text-blue-700'}`}>
                        {new Date(selectedOrder.expected_delivery_date).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' })}
                      </p>
                      {selectedOrder.agreed_delivery_days && (
                        <p className={`text-xs mt-0.5 ${isDeliveryOverdue(selectedOrder) ? 'text-red-600' : 'text-blue-600'}`}>
                          {o.agreedDuration.replace('{days}', String(selectedOrder.agreed_delivery_days))}
                        </p>
                      )}
                      {isDeliveryOverdue(selectedOrder) && (
                        <p className="text-xs text-red-600 font-semibold mt-1 flex items-center gap-1">
                          <Icon name="ExclamationCircleIcon" size={12} />
                          {o.deadlinePassed}
                        </p>
                      )}
                    </div>
                  )}

                  {selectedOrder.shipping_address && (
                    <div className="flex items-start gap-3">
                      <Icon name="MapPinIcon" size={16} className="text-muted-foreground mt-0.5 shrink-0" />
                      <div className="text-xs text-muted-foreground">
                        <p className="font-medium text-foreground">{selectedOrder.shipping_address.fullName}</p>
                        <p>{selectedOrder.shipping_address.company}</p>
                        <p>{selectedOrder.shipping_address.address}, {selectedOrder.shipping_address.city}</p>
                        <p>{selectedOrder.shipping_address.country} {selectedOrder.shipping_address.postalCode}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* ─── Status History ───────────────────────────────────── */}
                {statusHistory.length > 0 && (
                  <div className="bg-card rounded-2xl border border-border p-5">
                    <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                      <Icon name="ClockIcon" size={16} className="text-primary" />
                      Tracking History
                    </h3>
                    <div className="space-y-4">
                      {statusHistory.map((entry, i) => {
                        const cfg = STATUS_CONFIG[entry.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
                        const isLatest = i === statusHistory.length - 1;
                        return (
                          <div key={entry.id} className="flex gap-3">
                            <div className="flex flex-col items-center">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${isLatest ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-muted text-muted-foreground'}`}>
                                <Icon name={cfg.icon as any} size={14} />
                              </div>
                              {i < statusHistory.length - 1 && <div className="w-0.5 flex-1 bg-border mt-1" />}
                            </div>
                            <div className="flex-1 pb-4">
                              <div className="flex items-center justify-between">
                                <p className={`text-sm font-semibold ${isLatest ? 'text-foreground' : 'text-muted-foreground'}`}>{(o.status as any)[cfg.labelKey] || cfg.labelKey}</p>
                                <div className="text-right">
                                  <p className="text-xs text-muted-foreground">{formatDate(entry.created_at)}</p>
                                  <p className="text-xs text-muted-foreground">{formatTime(entry.created_at)}</p>
                                </div>
                              </div>
                              {entry.note && <p className="text-xs text-muted-foreground mt-0.5">{entry.note}</p>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ─── Negotiation History Log ──────────────────────────── */}
                {(negotiationHistory.length > 0 || selectedOrder.accepted_quote_id) && (
                  <div className="bg-card rounded-2xl border border-border p-5">
                    <button
                      onClick={() => {
                        setShowNegHistory(!showNegHistory);
                        if (!showNegHistory && negotiationHistory.length === 0 && selectedOrder.accepted_quote_id) {
                          fetchNegotiationHistory(selectedOrder.id);
                        }
                      }}
                      className="w-full flex items-center justify-between mb-1"
                    >
                      <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                        <Icon name="DocumentTextIcon" size={16} className="text-blue-600" />
                        {o.negotiationLog}
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                          {o.legalAnnex}
                        </span>
                      </h3>
                      <Icon name={showNegHistory ? 'ChevronUpIcon' : 'ChevronDownIcon'} size={16} className="text-muted-foreground" />
                    </button>
                    <p className="text-[11px] text-muted-foreground mb-3">
                      {o.negotiationLogDesc}
                    </p>

                    {showNegHistory && (
                      <>
                        {/* Hard Deadline Banner */}
                        {selectedOrder.hard_deadline && (
                          <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border-2 border-red-300 rounded-xl mb-4">
                            <Icon name="CalendarDaysIcon" size={18} className="text-red-600 shrink-0" />
                            <div>
                              <p className="text-xs font-bold text-red-800">📅 {o.hardDeadline}</p>
                              <p className="text-sm font-black text-red-700">
                                {new Date(selectedOrder.hard_deadline).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' })}
                              </p>
                              <p className="text-[10px] text-red-600 mt-0.5">{o.hardDeadlineNote}</p>
                            </div>
                          </div>
                        )}

                        {/* Negotiated Values Summary */}
                        {(selectedOrder.negotiated_price || selectedOrder.negotiated_quantity) && (
                          <div className="grid grid-cols-3 gap-2 mb-4">
                            {selectedOrder.negotiated_price && (
                              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
                                <p className="text-[10px] text-blue-600 font-semibold uppercase tracking-wide">{o.agreedPrice}</p>
                                <p className="text-sm font-black text-blue-800 mt-0.5">${Number(selectedOrder.negotiated_price).toLocaleString()}</p>
                              </div>
                            )}
                            {selectedOrder.negotiated_quantity && (
                              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
                                <p className="text-[10px] text-blue-600 font-semibold uppercase tracking-wide">{o.quantity}</p>
                                <p className="text-sm font-black text-blue-800 mt-0.5">{selectedOrder.negotiated_quantity.toLocaleString()}</p>
                              </div>
                            )}
                            {selectedOrder.negotiated_delivery_days && (
                              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
                                <p className="text-[10px] text-blue-600 font-semibold uppercase tracking-wide">{o.deliveryDays}</p>
                                <p className="text-sm font-black text-blue-800 mt-0.5">{o.days.replace('{n}', String(selectedOrder.negotiated_delivery_days))}</p>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Incoterms from accepted quote — official shipping terms record */}
                        {negotiationHistory.some(e => e.details?.incoterm) && (() => {
                          const acceptedEntry = negotiationHistory.find(e => e.event_type === 'quote_accepted' && e.details?.incoterm);
                          const invoiceEntry = negotiationHistory.find(e => e.event_type === 'invoice_generated' && e.details?.incoterm);
                          const entry = acceptedEntry || invoiceEntry;
                          if (!entry) return null;
                          const incoterm = entry.details.incoterm;
                          const port = entry.details.port_of_loading;
                          return (
                            <div className={`mb-4 rounded-xl border-2 p-4 ${incoterm === 'FOB' ? 'bg-blue-50 border-blue-300' : 'bg-amber-50 border-amber-300'}`}>
                              <div className="flex items-center gap-2 mb-2">
                                <Icon name="TruckIcon" size={15} className={incoterm === 'FOB' ? 'text-blue-700' : 'text-amber-700'} />
                                <p className={`text-xs font-bold uppercase tracking-wide ${incoterm === 'FOB' ? 'text-blue-800' : 'text-amber-800'}`}>
                                  {o.shippingTermsAnnex}
                                </p>
                              </div>
                              <div className="flex items-start gap-4">
                                <div>
                                  <p className={`text-2xl font-black ${incoterm === 'FOB' ? 'text-blue-900' : 'text-amber-900'}`}>{incoterm}</p>
                                  <p className={`text-[10px] mt-0.5 ${incoterm === 'FOB' ? 'text-blue-700' : 'text-amber-700'}`}>
                                    {incoterm === 'FOB' ? 'Free On Board' : 'Ex Works'}
                                  </p>
                                </div>
                                {incoterm === 'FOB' && port && (
                                  <div className="flex-1">
                                    <p className="text-[10px] text-blue-600 font-semibold uppercase tracking-wide">{o.loadingPort}</p>
                                    <p className="text-sm font-bold text-blue-900 mt-0.5">{port}</p>
                                    <p className="text-[10px] text-blue-600 mt-0.5">{o.loadingPortNote}</p>
                                  </div>
                                )}
                                {incoterm === 'EXW' && (
                                  <div className="flex-1">
                                    <p className="text-[10px] text-amber-700 leading-relaxed">
                                      {o.exwNote}
                                    </p>
                                  </div>
                                )}
                              </div>
                              <div className="mt-2 flex items-start gap-1.5 px-2 py-1.5 bg-white/60 rounded-lg border border-current/20">
                                <Icon name="InformationCircleIcon" size={11} className={`shrink-0 mt-0.5 ${incoterm === 'FOB' ? 'text-blue-600' : 'text-amber-600'}`} />
                                <p className={`text-[10px] leading-relaxed ${incoterm === 'FOB' ? 'text-blue-700' : 'text-amber-700'}`}>
                                  {o.termsAnnexNote}
                                </p>
                              </div>
                            </div>
                          );
                        })()}

                        {/* History Timeline */}
                        {loadingNegHistory ? (
                          <div className="flex items-center justify-center py-6">
                            <Icon name="ArrowPathIcon" size={20} className="animate-spin text-primary" />
                          </div>
                        ) : negotiationHistory.length === 0 ? (
                          <p className="text-xs text-muted-foreground text-center py-4">{o.noNegotiationLog}</p>
                        ) : (
                          <div className="space-y-3">
                            {negotiationHistory.map((entry, i) => {
                              const isLast = i === negotiationHistory.length - 1;
                              const eventColors: Record<string, string> = {
                                quote_sent: 'bg-blue-100 text-blue-700 border-blue-200',
                                quote_accepted: 'bg-emerald-100 text-emerald-700 border-emerald-200',
                                quote_rejected: 'bg-red-100 text-red-700 border-red-200',
                                invoice_generated: 'bg-amber-100 text-amber-700 border-amber-200',
                                invoice_updated: 'bg-amber-100 text-amber-700 border-amber-200',
                                deadline_set: 'bg-red-100 text-red-700 border-red-200',
                                price_changed: 'bg-purple-100 text-purple-700 border-purple-200',
                              };
                              const colorClass = eventColors[entry.event_type] || 'bg-gray-100 text-gray-700 border-gray-200';
                              return (
                                <div key={entry.id} className="flex gap-3">
                                  <div className="flex flex-col items-center shrink-0">
                                    <div className={`w-7 h-7 rounded-full flex items-center justify-center border text-[10px] font-bold ${colorClass}`}>
                                      {i + 1}
                                    </div>
                                    {!isLast && <div className="w-0.5 flex-1 bg-border mt-1 min-h-[16px]" />}
                                  </div>
                                  <div className={`flex-1 pb-3 ${isLast ? '' : ''}`}>
                                    <div className="flex items-start justify-between gap-2">
                                      <p className="text-xs font-bold text-foreground leading-snug">{entry.summary}</p>
                                      <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">
                                        {new Date(entry.created_at).toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' })}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                      <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${colorClass}`}>
                                        {entry.event_type.replace(/_/g, ' ')}
                                      </span>
                                      <span className="text-[10px] text-muted-foreground">
                                        {entry.actor_role === 'factory' ? `🏭 ${o.actorFactory}` : entry.actor_role === 'buyer' ? `🛒 ${o.actorBuyer}` : entry.actor_role === 'system' ? `⚙️ ${o.actorSystem}` : `👤 ${o.actorUser}`}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* ─── Factory Tax Reference Field ──────────────────────── */}
                <div className="bg-card rounded-2xl border border-border p-5">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center shrink-0">
                      <Icon name="DocumentTextIcon" size={16} className="text-gray-600" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-foreground">{o.factoryTaxRefTitle}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {o.factoryTaxRefDesc}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={factoryTaxRef}
                      onChange={e => setFactoryTaxRef(e.target.value)}
                      placeholder={o.factoryTaxRefPlaceholder}
                      className="flex-1 h-9 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary"
                    />
                    <button
                      onClick={handleSaveFactoryTaxRef}
                      disabled={savingTaxRef || !factoryTaxRef.trim()}
                      className="px-4 h-9 bg-gray-700 text-white text-xs font-semibold rounded-lg disabled:opacity-50 hover:bg-gray-800 transition-colors flex items-center gap-1.5"
                    >
                      {savingTaxRef ? <Icon name="ArrowPathIcon" size={13} className="animate-spin" /> : <Icon name="CheckIcon" size={13} />}
                      {o.save}
                    </button>
                  </div>
                  {taxRefMsg && (
                    <p className={`text-xs mt-2 ${taxRefMsg.includes(o.taxRefFailed.split(':')[0]) || taxRefMsg.toLowerCase().includes('fail') ? 'text-red-600' : 'text-emerald-600'}`}>{taxRefMsg}</p>
                  )}
                  {selectedOrder.factory_tax_ref && (
                    <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                      <Icon name="CheckCircleIcon" size={12} className="text-emerald-500" />
                      {o.savedRef} <span className="font-mono font-semibold text-foreground">{selectedOrder.factory_tax_ref}</span>
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
      <BottomNav />

      {/* Dispute Modal — Level 1: Report to Factory */}
      {showDisputeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-md shadow-xl">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                  <Icon name="FlagIcon" size={20} className="text-orange-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">{o.reportModalTitle}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{o.reportModalOrder.replace('{number}', selectedOrder?.order_number || '')}</p>
                </div>
              </div>
              <button onClick={() => setShowDisputeModal(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                <Icon name="XMarkIcon" size={20} />
              </button>
            </div>

            {/* Level 1 info notice */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4 flex items-start gap-2">
              <Icon name="InformationCircleIcon" size={16} className="text-blue-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-blue-800 font-semibold">{o.tier1DirectTitle}</p>
                <p className="text-xs text-blue-700 mt-0.5">
                  {o.tier1DirectBody}
                </p>
              </div>
            </div>

            {/* Reason selection */}
            <div className="mb-4">
              <label className="block text-xs font-bold text-foreground mb-2">{o.complaintReason} <span className="text-red-500">*</span></label>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setDisputeReason('late_delivery')}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${disputeReason === 'late_delivery' ? 'border-red-500 bg-red-50' : 'border-border hover:border-red-300'}`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${disputeReason === 'late_delivery' ? 'bg-red-100' : 'bg-muted'}`}>
                    <Icon name="ClockIcon" size={16} className={disputeReason === 'late_delivery' ? 'text-red-600' : 'text-muted-foreground'} />
                  </div>
                  <div>
                    <p className={`text-sm font-semibold ${disputeReason === 'late_delivery' ? 'text-red-800' : 'text-foreground'}`}>{o.lateDelivery}</p>
                    <p className="text-xs text-muted-foreground">{o.lateDeliveryDesc}</p>
                  </div>
                  {disputeReason === 'late_delivery' && <Icon name="CheckCircleIcon" size={18} className="text-red-600 ml-auto shrink-0" />}
                </button>

                <button
                  type="button"
                  onClick={() => setDisputeReason('product_mismatch')}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${disputeReason === 'product_mismatch' ? 'border-red-500 bg-red-50' : 'border-border hover:border-red-300'}`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${disputeReason === 'product_mismatch' ? 'bg-red-100' : 'bg-muted'}`}>
                    <Icon name="ExclamationTriangleIcon" size={16} className={disputeReason === 'product_mismatch' ? 'text-red-600' : 'text-muted-foreground'} />
                  </div>
                  <div>
                    <p className={`text-sm font-semibold ${disputeReason === 'product_mismatch' ? 'text-red-800' : 'text-foreground'}`}>{o.specMismatchTitle}</p>
                    <p className="text-xs text-muted-foreground">{o.specMismatchDesc}</p>
                  </div>
                  {disputeReason === 'product_mismatch' && <Icon name="CheckCircleIcon" size={18} className="text-red-600 ml-auto shrink-0" />}
                </button>
              </div>
            </div>

            {/* Description */}
            <div className="mb-5">
              <label className="block text-xs font-medium text-foreground mb-1.5">{o.additionalDetails}</label>
              <textarea
                value={disputeDescription}
                onChange={(e) => setDisputeDescription(e.target.value)}
                rows={3}
                placeholder={o.additionalDetailsPlaceholder}
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors resize-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setShowDisputeModal(false); setDisputeReason(''); setDisputeDescription(''); }}
                className="flex-1 h-10 border border-border text-foreground font-semibold rounded-lg text-sm hover:bg-muted transition-colors"
              >
                {o.cancel}
              </button>
              <button
                onClick={handleOpenDispute}
                disabled={disputeLoading || !disputeReason}
                className="flex-1 h-10 bg-orange-600 text-white font-bold rounded-lg text-sm disabled:opacity-60 flex items-center justify-center gap-2 hover:bg-orange-700 transition-colors"
              >
                {disputeLoading ? (
                  <><Icon name="ArrowPathIcon" size={15} className="animate-spin" /> {o.sending}</>
                ) : (
                  <><Icon name="FlagIcon" size={15} /> {o.reportFactory}</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PIN Verification Modal — required before escrow OTP */}
      <PinVerifyModal
        isOpen={showPinModal}
        onClose={() => setShowPinModal(false)}
        onSuccess={() => {
          setPinVerified(true);
          setShowPinModal(false);
          handleSendOtp();
        }}
        orderId={selectedOrder?.id}
        title={o.pinModalTitle}
        description={o.pinModalDesc}
      />
    </div>
  );
}
