'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import CreateRFQModal from '@/components/CreateRFQModal';

interface RFQRequest {
  id: string;
  buyer_id: string;
  product_name: string;
  supplier_name: string;
  supplier_country: string;
  quantity: number;
  unit: string;
  target_price: number | null;
  currency: string;
  destination_country: string;
  status: 'pending' | 'responded' | 'accepted' | 'rejected' | 'expired';
  created_at: string;
  expires_at: string;
  buyer_profile?: { full_name: string; company_name: string; country: string };
  response_count?: number;
}

interface RFQResponse {
  id: string;
  rfq_id: string;
  manufacturer_id: string;
  unit_price: number;
  currency: string;
  min_order_qty: number;
  lead_time_days: number;
  validity_days: number;
  payment_terms: string;
  notes: string;
  created_at: string;
  manufacturer_profile?: { full_name: string; company_name: string; country: string };
}

const STATUS_CONFIG = {
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: 'ClockIcon' },
  responded: { label: 'Responded', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: 'ChatBubbleLeftRightIcon' },
  accepted: { label: 'Accepted', color: 'bg-green-100 text-green-700 border-green-200', icon: 'CheckCircleIcon' },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700 border-red-200', icon: 'XCircleIcon' },
  expired: { label: 'Expired', color: 'bg-gray-100 text-gray-500 border-gray-200', icon: 'ExclamationCircleIcon' },
};

function RFQCard({
  rfq,
  isManufacturer,
  onRespond,
  onUpdateStatus,
}: {
  rfq: RFQRequest;
  isManufacturer: boolean;
  onRespond: (rfq: RFQRequest) => void;
  onUpdateStatus: (id: string, status: RFQRequest['status']) => void;
}) {
  const statusCfg = STATUS_CONFIG[rfq.status];
  const daysLeft = Math.max(0, Math.ceil((new Date(rfq.expires_at).getTime() - Date.now()) / 86400000));

  return (
    <div className="bg-card border border-border rounded-2xl p-5 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground text-sm truncate">{rfq.product_name}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isManufacturer
              ? `Buyer: ${rfq.buyer_profile?.company_name || rfq.buyer_profile?.full_name || 'Anonymous'} · ${rfq.buyer_profile?.country || ''}`
              : `Supplier: ${rfq.supplier_name} · ${rfq.supplier_country}`}
          </p>
        </div>
        <span className={`shrink-0 text-xs font-medium px-2.5 py-1 rounded-full border ${statusCfg.color}`}>
          {statusCfg.label}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Quantity</p>
          <p className="text-sm font-semibold text-foreground">{rfq.quantity.toLocaleString()} {rfq.unit}</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Target Price</p>
          <p className="text-sm font-semibold text-foreground">
            {rfq.target_price ? `${rfq.currency} ${rfq.target_price.toLocaleString()}` : 'Open'}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Destination</p>
          <p className="text-sm font-semibold text-foreground">{rfq.destination_country || '—'}</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Expires</p>
          <p className={`text-sm font-semibold ${daysLeft <= 3 ? 'text-red-600' : 'text-foreground'}`}>
            {daysLeft === 0 ? 'Today' : `${daysLeft}d left`}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-border">
        <p className="text-xs text-muted-foreground">
          {new Date(rfq.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          {rfq.response_count !== undefined && (
            <span className="ml-2 text-primary font-medium">{rfq.response_count} response{rfq.response_count !== 1 ? 's' : ''}</span>
          )}
        </p>
        <div className="flex gap-2">
          {isManufacturer && rfq.status === 'pending' && (
            <button
              onClick={() => onRespond(rfq)}
              className="px-3 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:opacity-90 transition-opacity"
            >
              Submit Quote
            </button>
          )}
          {!isManufacturer && rfq.status === 'responded' && (
            <>
              <button
                onClick={() => onUpdateStatus(rfq.id, 'accepted')}
                className="px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg hover:opacity-90 transition-opacity"
              >
                Accept
              </button>
              <button
                onClick={() => onUpdateStatus(rfq.id, 'rejected')}
                className="px-3 py-1.5 border border-border text-muted-foreground text-xs font-semibold rounded-lg hover:bg-muted transition-colors"
              >
                Reject
              </button>
            </>
          )}
          {!isManufacturer && (
            <Link
              href={`/rfq/${rfq.id}`}
              className="px-3 py-1.5 border border-border text-foreground text-xs font-semibold rounded-lg hover:bg-muted transition-colors"
            >
              View
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function RespondModal({
  rfq,
  onClose,
  onSubmit,
}: {
  rfq: RFQRequest;
  onClose: () => void;
  onSubmit: (data: Partial<RFQResponse>) => Promise<void>;
}) {
  const [form, setForm] = useState({
    unit_price: '',
    currency: 'USD',
    min_order_qty: String(rfq.quantity),
    lead_time_days: '14',
    validity_days: '30',
    payment_terms: 'T/T',
    notes: '',
    sample_available: false,
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    await onSubmit({
      unit_price: parseFloat(form.unit_price),
      currency: form.currency,
      min_order_qty: parseInt(form.min_order_qty),
      lead_time_days: parseInt(form.lead_time_days),
      validity_days: parseInt(form.validity_days),
      payment_terms: form.payment_terms,
      notes: form.notes,
      sample_available: form.sample_available,
    });
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-xl">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h2 className="font-semibold text-foreground">Submit Quote</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{rfq.product_name} · {rfq.quantity} {rfq.unit}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors">
            <Icon name="XMarkIcon" size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-foreground mb-1.5 block">Unit Price *</label>
              <input
                type="number" step="0.01" required
                value={form.unit_price}
                onChange={e => setForm(f => ({ ...f, unit_price: e.target.value }))}
                placeholder="0.00"
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground mb-1.5 block">Currency</label>
              <select
                value={form.currency}
                onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
              >
                {['USD', 'EUR', 'CNY', 'AED', 'SAR', 'EGP', 'YER'].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-foreground mb-1.5 block">Min. Order Qty</label>
              <input
                type="number" required
                value={form.min_order_qty}
                onChange={e => setForm(f => ({ ...f, min_order_qty: e.target.value }))}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground mb-1.5 block">Lead Time (days)</label>
              <input
                type="number" required
                value={form.lead_time_days}
                onChange={e => setForm(f => ({ ...f, lead_time_days: e.target.value }))}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-foreground mb-1.5 block">Payment Terms</label>
              <select
                value={form.payment_terms}
                onChange={e => setForm(f => ({ ...f, payment_terms: e.target.value }))}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
              >
                {['T/T', 'L/C', 'D/P', 'Western Union', 'PayPal'].map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-foreground mb-1.5 block">Quote Valid (days)</label>
              <input
                type="number"
                value={form.validity_days}
                onChange={e => setForm(f => ({ ...f, validity_days: e.target.value }))}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-foreground mb-1.5 block">Notes / Terms</label>
            <textarea
              rows={3}
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Additional terms, packaging details, shipping info..."
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-primary resize-none"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.sample_available}
              onChange={e => setForm(f => ({ ...f, sample_available: e.target.checked }))}
              className="w-4 h-4 rounded border-border text-primary"
            />
            <span className="text-sm text-foreground">Sample available</span>
          </label>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-border text-foreground text-sm font-medium rounded-xl hover:bg-muted transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              {submitting ? 'Submitting...' : 'Submit Quote'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function RFQBoardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const supabase = createClient();
  const { t, isRTL, language } = useLanguage();

  const [rfqs, setRfqs] = useState<RFQRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'responded' | 'accepted'>('all');
  const [respondingTo, setRespondingTo] = useState<RFQRequest | null>(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const isManufacturer = user?.user_metadata?.role === 'manufacturer';

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login?redirect=/rfq-board');
    }
  }, [user, authLoading, router]);

  const fetchRFQs = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      let query = supabase
        .from('rfq_requests')
        .select('id, product_name, description, quantity, unit, currency, target_price, status, created_at, buyer_id, sector, country, delivery_deadline, attachments, is_public')
        .order('created_at', { ascending: false })
        .limit(50);

      if (!isManufacturer) {
        // Buyers see only their own RFQs
        query = query.eq('buyer_id', user.id);
      } else {
        // Suppliers/factories see all published pending RFQs
        query = query.eq('is_published', true);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Enrich with buyer profiles for manufacturers
      if (isManufacturer && data) {
        const buyerIds = [...new Set(data.map(r => r.buyer_id))];
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('id, full_name, company_name, country')
          .in('id', buyerIds);

        const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]));
        setRfqs(data.map(r => ({ ...r, buyer_profile: profileMap[r.buyer_id] })));
      } else if (data && data.length > 0) {
        // Batch fetch all response counts in a single query instead of N+1 loop
        const rfqIds = data.map(r => r.id);
        const { data: responsesData } = await supabase
          .from('rfq_responses')
          .select('rfq_id')
          .in('rfq_id', rfqIds);

        const countMap: Record<string, number> = {};
        (responsesData || []).forEach((r: any) => {
          countMap[r.rfq_id] = (countMap[r.rfq_id] || 0) + 1;
        });

        setRfqs(data.map(r => ({ ...r, response_count: countMap[r.id] || 0 })));
      } else {
        setRfqs([]);
      }
    } catch {
      setRfqs([]);
    } finally {
      setLoading(false);
    }
  }, [user, isManufacturer, supabase]);

  useEffect(() => {
    if (user) fetchRFQs();
  }, [user, fetchRFQs]);

  // Real-time subscription
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('rfq-board-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rfq_requests' }, () => {
        fetchRFQs();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'rfq_responses' }, () => {
        fetchRFQs();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, supabase, fetchRFQs]);

  const handleRespond = async (data: Partial<RFQResponse>) => {
    if (!respondingTo || !user) return;
    try {
      const { error } = await supabase.from('rfq_responses').insert({
        rfq_id: respondingTo.id,
        manufacturer_id: user.id,
        ...data,
      });
      if (error) throw error;

      // Update RFQ status to responded
      await supabase.from('rfq_requests').update({ status: 'responded' }).eq('id', respondingTo.id);

      setRespondingTo(null);
      setSuccessMsg(isRTL ? 'تم إرسال عرض السعر بنجاح!' : 'Quote submitted successfully!');
      setTimeout(() => setSuccessMsg(''), 3000);
      fetchRFQs();
    } catch (err: any) {
      alert(err.message || 'Failed to submit quote');
    }
  };

  const handleUpdateStatus = async (id: string, status: RFQRequest['status']) => {
    try {
      await supabase.from('rfq_requests').update({ status }).eq('id', id);
      fetchRFQs();
    } catch {}
  };

  const filtered = rfqs.filter(r => activeTab === 'all' || r.status === activeTab);

  const tabs = [
    { key: 'all', label: isRTL ? 'الكل' : 'All RFQs', count: rfqs.length },
    { key: 'pending', label: isRTL ? 'قيد الانتظار' : 'Pending', count: rfqs.filter(r => r.status === 'pending').length },
    { key: 'responded', label: isRTL ? 'تم الرد' : 'Responded', count: rfqs.filter(r => r.status === 'responded').length },
    { key: 'accepted', label: isRTL ? 'مقبول' : 'Accepted', count: rfqs.filter(r => r.status === 'accepted').length },
  ] as const;

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col" dir={isRTL ? 'rtl' : 'ltr'}>
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col" dir={isRTL ? 'rtl' : 'ltr'}>
      <Header />
      <main className="flex-1">
        {/* Header */}
        <div className="bg-gradient-to-br from-primary/8 via-background to-background border-b border-border">
          <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 md:py-10">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-xs font-semibold px-3 py-1.5 rounded-full mb-3">
                  <Icon name="DocumentTextIcon" size={14} />
                  {isManufacturer
                    ? (isRTL ? 'سوق طلبات التوريد للمصانع' : 'Supplier & Factory RFQ Marketplace')
                    : (isRTL ? 'لوحة إدارة طلبات الأسعار' : 'RFQ Management Board')}
                </div>
                <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                  {isManufacturer
                    ? (isRTL ? 'سوق طلبات التوريد للمصانع' : 'Supplier & Factory Marketplace')
                    : (isRTL ? 'طلبات الأسعار الخاصة بي' : 'My Quote Requests')}
                </h1>
                <p className="text-muted-foreground text-sm mt-1">
                  {isManufacturer
                    ? (isRTL
                        ? 'تصفح طلبات التوريد الواردة من المشترين وقدّم عروضاً تنافسية للفوز بالصفقات.' :'Browse incoming procurement requests from buyers and submit competitive quotes to win deals.')
                    : (isRTL
                        ? 'تتبّع طلبات الأسعار المقدّمة وإدارة العروض الواردة من الموردين والمصانع.' :'Track your RFQ submissions and manage incoming quotes from manufacturers.')}
                </p>
                {isManufacturer && (
                  <div className="flex items-center gap-2 mt-3">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs text-emerald-600 font-semibold">
                      {isRTL ? `${rfqs.filter(r => r.status === 'pending').length} طلب جديد ينتظر عرضك` : `${rfqs.filter(r => r.status === 'pending').length} new requests awaiting your quote`}
                    </span>
                  </div>
                )}
              </div>
              {!isManufacturer && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="shrink-0 flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity"
                >
                  <Icon name="PlusIcon" size={16} />
                  {t.rfqBoard.postRFQ}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
          {/* Success message */}
          {successMsg && (
            <div className="mb-4 flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm">
              <Icon name="CheckCircleIcon" size={16} />
              {successMsg}
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              { label: isRTL ? 'إجمالي الطلبات' : 'Total RFQs', value: rfqs.length, icon: 'DocumentTextIcon', color: 'text-blue-600 bg-blue-50' },
              { label: isRTL ? 'قيد الانتظار' : 'Pending', value: rfqs.filter(r => r.status === 'pending').length, icon: 'ClockIcon', color: 'text-yellow-600 bg-yellow-50' },
              { label: isRTL ? 'تم الرد' : 'Responded', value: rfqs.filter(r => r.status === 'responded').length, icon: 'ChatBubbleLeftRightIcon', color: 'text-purple-600 bg-purple-50' },
              { label: isRTL ? 'مقبول' : 'Accepted', value: rfqs.filter(r => r.status === 'accepted').length, icon: 'CheckCircleIcon', color: 'text-green-600 bg-green-50' },
            ].map(stat => (
              <div key={stat.label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${stat.color}`}>
                  <Icon name={stat.icon as any} size={20} />
                </div>
                <div>
                  <p className="text-xl font-bold text-foreground">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-muted p-1 rounded-xl mb-5 w-fit">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === tab.key
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                    activeTab === tab.key ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-6">
            {/* RFQ List */}
            <div>
              {loading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="bg-card border border-border rounded-2xl p-5 animate-pulse">
                      <div className="flex justify-between mb-3">
                        <div className="h-4 bg-muted rounded w-1/3" />
                        <div className="h-6 bg-muted rounded w-20" />
                      </div>
                      <div className="grid grid-cols-4 gap-3">
                        {[...Array(4)].map((_, j) => <div key={j} className="h-8 bg-muted rounded" />)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-16 bg-card border border-border rounded-2xl">
                  <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Icon name="DocumentTextIcon" size={28} className="text-muted-foreground" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">
                    {activeTab === 'all' ? (isRTL ?'لا توجد طلبات بعد' : 'No RFQs yet')
                      : (isRTL ? `لا توجد طلبات ${activeTab}` : `No ${activeTab} RFQs`)}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {isManufacturer
                      ? (isRTL ? 'لا توجد طلبات أسعار متاحة حالياً. تحقق لاحقاً.' : 'No quote requests available at the moment. Check back soon.')
                      : (isRTL ? 'ابدأ بنشر أول طلب سعر لك.' : 'Start by posting your first RFQ.')}
                  </p>
                  {!isManufacturer && (
                    <button
                      onClick={() => setShowCreateModal(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-xl"
                    >
                      <Icon name="PlusIcon" size={16} />
                      {isRTL ? 'نشر طلب سعر' : 'Post RFQ'}
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {filtered.map(rfq => (
                    <RFQCard
                      key={rfq.id}
                      rfq={rfq}
                      isManufacturer={isManufacturer}
                      onRespond={setRespondingTo}
                      onUpdateStatus={handleUpdateStatus}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />

      {respondingTo && (
        <RespondModal
          rfq={respondingTo}
          onClose={() => setRespondingTo(null)}
          onSubmit={handleRespond}
        />
      )}

      {showCreateModal && (
        <CreateRFQModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={(newRfq) => {
            setRfqs(prev => [{ ...newRfq, response_count: 0 }, ...prev]);
            setSuccessMsg(isRTL ? 'تم إرسال طلب السعر بنجاح! سيظهر الآن في سوق الموردين.' : 'RFQ submitted successfully! It is now live in the supplier marketplace.');
            setTimeout(() => setSuccessMsg(''), 4000);
          }}
        />
      )}
    </div>
  );
}
