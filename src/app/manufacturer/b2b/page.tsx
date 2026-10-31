'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';

import Icon from '@/components/ui/AppIcon';
import AppLogo from '@/components/ui/AppLogo';
import { useLanguage } from '@/contexts/LanguageContext';

// ─── Types ────────────────────────────────────────────────────────────────────

type RFQStatus = 'new' | 'negotiating' | 'quoted' | 'accepted' | 'rejected';

interface RFQRequest {
  id: string;
  buyer_company: string;
  buyer_country: string;
  product_name: string;
  quantity: number;
  unit: string;
  target_price: number;
  currency: string;
  delivery_date: string;
  status: RFQStatus;
  created_at: string;
  notes: string;
  incoterms: string;
}

interface BulkOrder {
  id: string;
  company: string;
  country: string;
  product: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total: number;
  currency: string;
  contract_type: 'spot' | 'annual' | 'quarterly';
  escrow_status: 'pending' | 'funded' | 'milestone_1' | 'milestone_2' | 'released';
  milestones: { label: string; amount: number; status: 'pending' | 'completed' }[];
}

interface SupplyContract {
  id: string;
  company: string;
  country: string;
  product: string;
  monthly_volume: number;
  unit: string;
  unit_price: number;
  currency: string;
  duration_months: number;
  start_date: string;
  end_date: string;
  status: 'active' | 'pending_signature' | 'expired' | 'terminated';
  auto_renew: boolean;
}

// ─── Live mappers (bulk orders from `orders`, contracts from accepted `custom_quotes`) ───

function firstItem(items: unknown): Record<string, any> {
  return Array.isArray(items) && items.length > 0 && typeof items[0] === 'object' && items[0] !== null ? (items[0] as Record<string, any>) : {};
}

function orderCountry(order: Record<string, any>): string {
  const addr = order?.shipping_address;
  if (addr && typeof addr === 'object' && addr.country) return String(addr.country);
  return String(order?.port_of_discharge || '—');
}

function orderCompany(order: Record<string, any>): string {
  const addr = order?.shipping_address;
  if (addr && typeof addr === 'object') {
    const n = addr.company || addr.company_name || addr.full_name || addr.name;
    if (n) return String(n);
  }
  return order?.order_number ? `Buyer · ${order.order_number}` : 'Buyer';
}

function mapOrderToBulkOrder(order: Record<string, any>, stage2Released: boolean, stage1Released: boolean, stage3Released: boolean): BulkOrder {
  const total = Number(order?.total) || 0;
  const item = firstItem(order?.items);
  const quantity = Number(item.quantity ?? item.qty) || Number(order?.container_count) || 1;
  const unitPrice = Number(item.unit_price ?? item.price) || (quantity > 0 ? total / quantity : total);
  const m1 = !!order?.milestone_1_paid || stage1Released || order?.escrow_status === 'funds_released';
  const m2 = !!order?.milestone_2_paid || stage2Released || order?.escrow_status === 'funds_released';
  const m3 = !!order?.milestone_3_paid || stage3Released || order?.escrow_status === 'funds_released';
  const funded = ['funds_secured', 'shipped', 'ready_for_inspection', 'pending_otp_confirmation', 'pending_admin_payout', 'funds_released'].includes(String(order?.escrow_status || ''));
  const escrow_status: BulkOrder['escrow_status'] =
    order?.escrow_status === 'funds_released' || m3 ? 'released' : m2 ? 'milestone_2' : m1 ? 'milestone_1' : funded ? 'funded' : 'pending';
  return {
    id: String(order?.order_number || order?.id || ''),
    company: orderCompany(order),
    country: orderCountry(order),
    product: String(item.name_ar || item.name || item.product_name || item.title || 'Order items'),
    quantity,
    unit: String(item.unit || 'units'),
    unit_price: Math.round(unitPrice * 100) / 100,
    total,
    currency: String(order?.currency || 'USD'),
    contract_type: 'spot',
    escrow_status,
    milestones: [
      { label: 'دفعة أولى (30%) — عند التصنيع', amount: Math.round(total * 0.3 * 100) / 100, status: m1 ? 'completed' : 'pending' },
      { label: 'دفعة ثانية (40%) — عند الشحن (B/L)', amount: Math.round(total * 0.4 * 100) / 100, status: m2 ? 'completed' : 'pending' },
      { label: 'دفعة نهائية (30%) — عند التسليم', amount: Math.round(total * 0.3 * 100) / 100, status: m3 ? 'completed' : 'pending' },
    ],
  };
}

function mapQuoteToContract(q: Record<string, any>): SupplyContract {
  const start = String(q?.accepted_at || q?.created_at || '').slice(0, 10);
  const end = String(q?.expires_at || '').slice(0, 10);
  const durationMonths = start && end ? Math.max(1, Math.round((new Date(end).getTime() - new Date(start).getTime()) / (30 * 86400000))) : 0;
  const rawStatus = String(q?.status || 'pending');
  const status: SupplyContract['status'] =
    rawStatus === 'accepted' ? (end && new Date(end).getTime() < Date.now() ? 'expired' : 'active')
    : rawStatus === 'pending' ? 'pending_signature'
    : rawStatus === 'expired'? 'expired' :'terminated';
  return {
    id: `SC-${String(q?.id || '').slice(0, 8).toUpperCase()}`,
    company: 'Buyer',
    country: String(q?.port_of_loading || '—'),
    product: String(q?.product_title || 'Supply contract'),
    monthly_volume: Number(q?.quantity) || 0,
    unit: 'units',
    unit_price: Number(q?.quoted_price) || 0,
    currency: String(q?.currency || 'USD'),
    duration_months: durationMonths,
    start_date: start,
    end_date: end,
    status,
    auto_renew: false,
  };
}

const QUOTE_INCOTERMS = ['EXW', 'FOB', 'CIF'] as const;
const CONTAINER_OPTIONS = [
  { value: '', label: 'بدون تحديد' },
  { value: '20ft', label: "20ft" },
  { value: '40ft_hq', label: '40ft HQ' },
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapRfqStatus(raw: string | null | undefined, hasQuote: boolean, quoteStatus?: string | null): RFQStatus {
  if (quoteStatus === 'accepted') return 'accepted';
  if (quoteStatus === 'rejected') return 'rejected';
  const s = (raw || '').toLowerCase();
  if (s === 'accepted') return 'accepted';
  if (s === 'rejected' || s === 'expired') return 'rejected';
  if (hasQuote || s === 'responded') return 'quoted';
  return 'new';
}

function rfqStatusBadge(status: RFQStatus) {
  const map: Record<RFQStatus, { label: string; cls: string }> = {
    new: { label: 'جديد', cls: 'bg-sky-100 text-sky-700 border border-sky-200' },
    negotiating: { label: 'تفاوض', cls: 'bg-amber-100 text-amber-700 border border-amber-200' },
    quoted: { label: 'تم التسعير', cls: 'bg-purple-100 text-purple-700 border border-purple-200' },
    accepted: { label: 'مقبول', cls: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
    rejected: { label: 'مرفوض', cls: 'bg-red-100 text-red-700 border border-red-200' },
  };
  const { label, cls } = map[status];
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{label}</span>;
}

function escrowBadge(status: BulkOrder['escrow_status']) {
  const map: Record<BulkOrder['escrow_status'], { label: string; cls: string }> = {
    pending: { label: 'بانتظار التمويل', cls: 'bg-slate-100 text-slate-600' },
    funded: { label: 'ممول في الضمان', cls: 'bg-blue-100 text-blue-700' },
    milestone_1: { label: 'مرحلة 1 مكتملة', cls: 'bg-amber-100 text-amber-700' },
    milestone_2: { label: 'مرحلة 2 مكتملة', cls: 'bg-indigo-100 text-indigo-700' },
    released: { label: 'تم الإفراج', cls: 'bg-emerald-100 text-emerald-700' },
  };
  const { label, cls } = map[status];
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{label}</span>;
}

function contractStatusBadge(status: SupplyContract['status']) {
  const map: Record<SupplyContract['status'], { label: string; cls: string }> = {
    active: { label: 'نشط', cls: 'bg-emerald-100 text-emerald-700' },
    pending_signature: { label: 'بانتظار التوقيع', cls: 'bg-amber-100 text-amber-700' },
    expired: { label: 'منتهي', cls: 'bg-slate-100 text-slate-600' },
    terminated: { label: 'مُنهى', cls: 'bg-red-100 text-red-700' },
  };
  const { label, cls } = map[status];
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{label}</span>;
}

type Tab = 'rfq' | 'bulk_orders' | 'contracts';

export default function B2BSalesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { dir } = useLanguage();
  const supabase = useMemo(() => createClient(), []);
  const [activeTab, setActiveTab] = useState<Tab>('rfq');
  const [rfqs, setRfqs] = useState<RFQRequest[]>([]);
  const [rfqsLoading, setRfqsLoading] = useState(true);
  const [rfqError, setRfqError] = useState('');
  const [selectedRFQ, setSelectedRFQ] = useState<RFQRequest | null>(null);
  const [quotePrice, setQuotePrice] = useState('');
  const [quoteNote, setQuoteNote] = useState('');
  const [quoteIncoterm, setQuoteIncoterm] = useState<(typeof QUOTE_INCOTERMS)[number]>('FOB');
  const [quoteCbm, setQuoteCbm] = useState('');
  const [quoteContainer, setQuoteContainer] = useState('');
  const [quoteLeadDays, setQuoteLeadDays] = useState('');
  const [quoteSubmitting, setQuoteSubmitting] = useState(false);
  const [quoteError, setQuoteError] = useState('');
  const [showQuoteForm, setShowQuoteForm] = useState(false);
  const [bulkOrders, setBulkOrders] = useState<BulkOrder[]>([]);
  const [contracts, setContracts] = useState<SupplyContract[]>([]);
  const [poLoading, setPoLoading] = useState(true);
  const [poError, setPoError] = useState('');

  useEffect(() => {
    if (!authLoading && !user) router.push('/manufacturer/login');
  }, [user, authLoading, router]);

  const loadPoAndContracts = useCallback(async () => {
    if (!user?.id) return;
    setPoError('');
    try {
      const [ordersRes, quotesRes] = await Promise.all([
        supabase
          .from('orders')
          .select('id, order_number, total, currency, items, shipping_address, port_of_discharge, container_count, escrow_status, milestone_1_paid, milestone_2_paid, milestone_3_paid, bl_document_url, bill_of_lading_url, bl_verified_at, status, created_at')
          .eq('factory_user_id', user.id)
          .not('escrow_status', 'is', null)
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('custom_quotes')
          .select('id, product_title, quantity, quoted_price, currency, status, accepted_at, expires_at, created_at, port_of_loading')
          .eq('factory_user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(100),
      ]);
      if (ordersRes.error) throw ordersRes.error;
      const orderRows = ((ordersRes.data || []) as any[]).filter((o) => String(o?.status || '').toLowerCase() !== 'cancelled');
      const orderIds = orderRows.map((o) => o.id);
      const stagesByOrder = new Map<string, Set<number>>();
      if (orderIds.length > 0) {
        const relRes = await supabase.from('escrow_milestone_releases').select('order_id, stage').in('order_id', orderIds);
        ((relRes.data || []) as Array<{ order_id: string; stage: number }>).forEach((r) => {
          const set = stagesByOrder.get(r.order_id) ?? new Set<number>();
          set.add(Number(r.stage));
          stagesByOrder.set(r.order_id, set);
        });
      }
      setBulkOrders(
        orderRows.map((o) => {
          const stages = stagesByOrder.get(o.id);
          return mapOrderToBulkOrder(o, !!stages?.has(2), !!stages?.has(1), !!stages?.has(3));
        })
      );
      setContracts(((quotesRes.data || []) as any[]).filter((q) => q.status !== 'superseded').map(mapQuoteToContract));
    } catch (e: any) {
      setPoError(e?.message || 'تعذر تحميل الطلبات والعقود');
    } finally {
      setPoLoading(false);
    }
  }, [supabase, user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    loadPoAndContracts();
    const channel = supabase
      .channel(`b2b-po-live-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `factory_user_id=eq.${user.id}` }, () => loadPoAndContracts())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'escrow_milestone_releases' }, () => loadPoAndContracts())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'custom_quotes', filter: `factory_user_id=eq.${user.id}` }, () => loadPoAndContracts())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, supabase, loadPoAndContracts]);

  const loadRfqs = useCallback(async () => {
    if (!user?.id) return;
    setRfqError('');
    try {
      const [rfqRes, respRes, quoteRes] = await Promise.all([
        supabase
          .from('rfq_requests')
          .select('id, product_name, custom_product_description, quantity, unit, target_price, currency, destination_country, incoterms, additional_notes, customization_notes, status, expires_at, created_at')
          .in('status', ['pending', 'responded', 'accepted', 'rejected'])
          .order('created_at', { ascending: false })
          .limit(100),
        supabase.from('rfq_responses').select('rfq_id').eq('manufacturer_id', user.id),
        supabase
          .from('custom_quotes')
          .select('id, status, notes, quantity')
          .eq('factory_user_id', user.id),
      ]);
      if (rfqRes.error) throw rfqRes.error;
      const respondedIds = new Set(((respRes.data || []) as Array<{ rfq_id: string }>).map((r) => r.rfq_id));
      const quotes = (quoteRes.data || []) as Array<{ id: string; status: string | null }>;
      const anyAccepted = quotes.some((q) => q.status === 'accepted');
      const rows = ((rfqRes.data || []) as any[]).map((r): RFQRequest => ({
        id: r.id,
        buyer_company: r.destination_country ? `Buyer · ${r.destination_country}` : 'Buyer',
        buyer_country: r.destination_country || '—',
        product_name: r.product_name || r.custom_product_description || 'RFQ',
        quantity: Number(r.quantity) || 0,
        unit: r.unit || 'units',
        target_price: Number(r.target_price) || 0,
        currency: r.currency || 'USD',
        delivery_date: r.expires_at ? String(r.expires_at).slice(0, 10) : '',
        status: mapRfqStatus(r.status, respondedIds.has(r.id), r.status === 'accepted' && anyAccepted ? 'accepted' : null),
        created_at: r.created_at || '',
        notes: r.additional_notes || r.customization_notes || '',
        incoterms: r.incoterms || '',
      }));
      setRfqs(rows);
    } catch (e: any) {
      setRfqError(e?.message || 'تعذر تحميل طلبات عروض الأسعار');
    } finally {
      setRfqsLoading(false);
    }
  }, [supabase, user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    loadRfqs();
    const channel = supabase
      .channel(`b2b-rfq-live-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rfq_requests' }, () => loadRfqs())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rfq_responses' }, () => loadRfqs())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'custom_quotes', filter: `factory_user_id=eq.${user.id}` }, () => loadRfqs())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, supabase, loadRfqs]);

  const openQuoteForm = (rfq: RFQRequest) => {
    setSelectedRFQ(rfq);
    setQuotePrice('');
    setQuoteNote('');
    setQuoteCbm('');
    setQuoteContainer('');
    setQuoteLeadDays('');
    const inc = (rfq.incoterms || '').toUpperCase();
    setQuoteIncoterm((QUOTE_INCOTERMS as readonly string[]).includes(inc) ? (inc as (typeof QUOTE_INCOTERMS)[number]) : 'FOB');
    setQuoteError('');
    setShowQuoteForm(true);
  };

  const submitQuote = async () => {
    if (!selectedRFQ || !user?.id) return;
    const price = parseFloat(quotePrice);
    const lead = parseInt(quoteLeadDays, 10);
    if (!price || price <= 0) { setQuoteError('أدخل سعراً صحيحاً (USD)'); return; }
    if (!lead || lead <= 0) { setQuoteError('أدخل مدة التسليم بالأيام'); return; }
    setQuoteSubmitting(true);
    setQuoteError('');
    try {
      const notes = [quoteNote.trim(), `Incoterm: ${quoteIncoterm}`, quoteContainer ? `Container: ${quoteContainer}` : '', quoteCbm ? `CBM: ${quoteCbm}` : '']
        .filter(Boolean)
        .join(' | ');
      const { error } = await supabase.from('rfq_responses').insert({
        rfq_id: selectedRFQ.id,
        manufacturer_id: user.id,
        unit_price: price,
        currency: 'USD',
        lead_time_days: lead,
        notes,
        total_price: price * (selectedRFQ.quantity || 1),
      });
      if (error) throw error;
      setShowQuoteForm(false);
      setSelectedRFQ(null);
      loadRfqs();
    } catch (e: any) {
      setQuoteError(e?.message || 'فشل إرسال العرض');
    } finally {
      setQuoteSubmitting(false);
    }
  };

  if (authLoading) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  const totalRFQValue = rfqs.reduce((s, r) => s + r.quantity * r.target_price, 0);
  const activeContracts = contracts.filter(c => c.status === 'active').length;
  const escrowFunded = bulkOrders.reduce((s, o) => s + (o.escrow_status !== 'pending' ? o.total : 0), 0);

  return (
    <div className="min-h-screen bg-slate-50" dir={dir}>
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-screen-xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/manufacturer/dashboard"><AppLogo className="h-8 w-auto" /></Link>
            <div className="hidden sm:block w-px h-6 bg-slate-200" />
            <span className="hidden sm:block text-sm font-semibold text-indigo-700">نظام المبيعات B2B</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/manufacturer/dashboard" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-sm text-slate-600 transition-colors">
              <Icon name="ArrowLeft" size={14} />
              <span className="hidden sm:inline">لوحة التحكم</span>
            </Link>
            <Link href="/manufacturer/international-dashboard" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-sm text-white transition-colors">
              <Icon name="Globe" size={14} />
              <span className="hidden sm:inline">الدولي</span>
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-screen-xl mx-auto px-4 py-6 space-y-6">
        {/* Title */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900">🏢 نظام المبيعات للشركات (B2B)</h1>
          <p className="text-slate-500 text-sm mt-1">إدارة طلبات عروض الأسعار، الطلبات بالجملة، وعقود التوريد طويلة الأجل</p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'طلبات RFQ النشطة', value: rfqs.filter(r => r.status !== 'rejected').length.toString(), icon: 'FileQuestion', color: 'bg-indigo-50 border-indigo-200', iconColor: 'text-indigo-600', valueColor: 'text-indigo-700' },
            { label: 'قيمة الطلبات المحتملة', value: `$${(totalRFQValue / 1000).toFixed(0)}K`, icon: 'DollarSign', color: 'bg-emerald-50 border-emerald-200', iconColor: 'text-emerald-600', valueColor: 'text-emerald-700' },
            { label: 'محتجز في الضمان', value: `$${(escrowFunded / 1000).toFixed(0)}K`, icon: 'Shield', color: 'bg-amber-50 border-amber-200', iconColor: 'text-amber-600', valueColor: 'text-amber-700' },
            { label: 'عقود توريد نشطة', value: activeContracts.toString(), icon: 'FileText', color: 'bg-purple-50 border-purple-200', iconColor: 'text-purple-600', valueColor: 'text-purple-700' },
          ].map(kpi => (
            <div key={kpi.label} className={`${kpi.color} border rounded-xl p-4`}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-slate-500 text-xs mb-1">{kpi.label}</p>
                  <p className={`text-2xl font-bold ${kpi.valueColor}`}>{kpi.value}</p>
                </div>
                <div className={`w-9 h-9 rounded-lg bg-white flex items-center justify-center shadow-sm`}>
                  <Icon name={kpi.icon as any} size={18} className={kpi.iconColor} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white rounded-xl p-1 border border-slate-200 w-full overflow-x-auto">
          {([
            { id: 'rfq', label: '📋 طلبات RFQ والتفاوض' },
            { id: 'bulk_orders', label: '📦 الطلبات بالجملة والضمان' },
            { id: 'contracts', label: '📄 عقود التوريد' },
          ] as { id: Tab; label: string }[]).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 min-w-max px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-indigo-600 text-white shadow' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab: RFQ (live) */}
        {activeTab === 'rfq' && (
          <div className="space-y-3">
            {rfqError && (
              <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{rfqError}</div>
            )}
            {rfqsLoading ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : rfqs.length === 0 ? (
              <div className="bg-white border border-dashed border-slate-300 rounded-xl p-10 text-center text-slate-500 text-sm">
                لا توجد طلبات عروض أسعار حالياً
              </div>
            ) : rfqs.map(rfq => (
              <div key={rfq.id} className="bg-white border border-slate-200 rounded-xl p-4 hover:border-indigo-300 transition-all">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                      <Icon name="FileQuestion" size={18} className="text-indigo-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-900 text-sm font-mono">RFQ-{rfq.id.slice(0, 8).toUpperCase()}</span>
                        {rfqStatusBadge(rfq.status)}
                        {rfq.incoterms && <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold">{rfq.incoterms}</span>}
                      </div>
                      <p className="text-slate-700 text-sm mt-0.5">{rfq.product_name}</p>
                      <p className="text-slate-500 text-xs mt-0.5">{rfq.buyer_company}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-slate-900 font-bold">{rfq.quantity.toLocaleString('en-US')} {rfq.unit}</p>
                    <p className="text-slate-500 text-xs">هدف: ${rfq.target_price}/{rfq.unit}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-slate-500 text-xs bg-slate-50 rounded-lg px-3 py-1.5 flex-1">{rfq.notes || '—'}</p>
                  {rfq.status === 'new' || rfq.status === 'negotiating' ? (
                    <button
                      onClick={() => openQuoteForm(rfq)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium transition-colors"
                    >
                      <Icon name="Send" size={12} />
                      إرسال عرض سعر
                    </button>
                  ) : rfq.status === 'accepted' ? (
                    <button
                      onClick={() => setActiveTab('bulk_orders')}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium transition-colors"
                    >
                      <Icon name="ShoppingCart" size={12} />
                      إنشاء طلب جملة
                    </button>
                  ) : null}
                </div>
              </div>
            ))}

            {/* Quote Form Modal */}
            {showQuoteForm && selectedRFQ && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-slate-900">إرسال عرض سعر</h3>
                    <button onClick={() => setShowQuoteForm(false)} className="text-slate-400 hover:text-slate-600"><Icon name="X" size={20} /></button>
                  </div>
                  <div className="space-y-3">
                    <div className="bg-slate-50 rounded-lg p-3 text-sm">
                      <p className="text-slate-500">المنتج: <span className="text-slate-900 font-medium">{selectedRFQ.product_name}</span></p>
                      <p className="text-slate-500 mt-1">الكمية: <span className="text-slate-900 font-medium">{selectedRFQ.quantity.toLocaleString('en-US')} {selectedRFQ.unit}</span></p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">سعر العرض (USD / {selectedRFQ.unit})</label>
                      <input type="number" min={0} step="0.01" value={quotePrice} onChange={e => setQuotePrice(e.target.value)} placeholder={`السعر المستهدف: ${selectedRFQ.target_price}`} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Incoterm</label>
                        <select value={quoteIncoterm} onChange={e => setQuoteIncoterm(e.target.value as (typeof QUOTE_INCOTERMS)[number])} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                          {QUOTE_INCOTERMS.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">مدة التسليم (يوم)</label>
                        <input type="number" min={1} value={quoteLeadDays} onChange={e => setQuoteLeadDays(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">CBM</label>
                        <input type="number" min={0} step="0.01" value={quoteCbm} onChange={e => setQuoteCbm(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">سعة الحاوية</label>
                        <select value={quoteContainer} onChange={e => setQuoteContainer(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                          {CONTAINER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">ملاحظات العرض</label>
                      <textarea value={quoteNote} onChange={e => setQuoteNote(e.target.value)} rows={3} placeholder="شروط الدفع، الشهادات المرفقة..." className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
                    </div>
                    {quoteError && <p className="text-xs text-red-600">{quoteError}</p>}
                    <div className="flex gap-2 pt-2">
                      <button onClick={() => setShowQuoteForm(false)} className="flex-1 px-4 py-2 rounded-lg border border-slate-300 text-slate-600 text-sm hover:bg-slate-50 transition-colors">إلغاء</button>
                      <button onClick={submitQuote} disabled={quoteSubmitting} className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-60">
                        {quoteSubmitting ? '...' : 'إرسال العرض'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab: Bulk Orders & Escrow */}
        {activeTab === 'bulk_orders' && (
          <div className="space-y-4">
            {poError && (
              <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{poError}</div>
            )}
            {poLoading ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : bulkOrders.length === 0 ? (
              <div className="bg-white border border-dashed border-slate-300 rounded-xl p-10 text-center text-slate-500 text-sm">
                لا توجد طلبات شراء بالجملة حالياً
              </div>
            ) : bulkOrders.map(order => (
              <div key={order.id} className="bg-white border border-slate-200 rounded-xl p-5">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-900">{order.id}</span>
                      {escrowBadge(order.escrow_status)}
                      <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{order.contract_type === 'spot' ? 'صفقة فورية' : order.contract_type === 'annual' ? 'عقد سنوي' : 'عقد ربع سنوي'}</span>
                    </div>
                    <p className="text-slate-700 text-sm mt-1">{order.product} · {order.company} · {order.country}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-slate-900">${order.total.toLocaleString('en-US')}</p>
                    <p className="text-slate-500 text-xs">{order.quantity.toLocaleString('en-US')} {order.unit} × ${order.unit_price}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">مراحل الدفع (Escrow)</p>
                  {order.milestones.map((m, i) => (
                    <div key={i} className={`flex items-center justify-between p-3 rounded-lg ${m.status === 'completed' ? 'bg-emerald-50 border border-emerald-200' : 'bg-slate-50 border border-slate-200'}`}>
                      <div className="flex items-center gap-2">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center ${m.status === 'completed' ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                          {m.status === 'completed' ? <Icon name="Check" size={12} className="text-white" /> : <span className="text-white text-xs font-bold">{i + 1}</span>}
                        </div>
                        <span className="text-sm text-slate-700">{m.label}</span>
                      </div>
                      <span className={`text-sm font-bold ${m.status === 'completed' ? 'text-emerald-700' : 'text-slate-500'}`}>${m.amount.toLocaleString('en-US')}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex gap-2">
                  <button className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm transition-colors">
                    <Icon name="FileText" size={14} />
                    عرض العقد
                  </button>
                  <button className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm transition-colors">
                    <Icon name="Shield" size={14} />
                    إدارة الضمان
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab: Supply Contracts */}
        {activeTab === 'contracts' && (
          <div className="space-y-3">
            <div className="flex justify-end">
              <button className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors">
                <Icon name="Plus" size={14} />
                عقد توريد جديد
              </button>
            </div>
            {poLoading ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : contracts.length === 0 ? (
              <div className="bg-white border border-dashed border-slate-300 rounded-xl p-10 text-center text-slate-500 text-sm">
                لا توجد عقود توريد حالياً
              </div>
            ) : contracts.map(contract => (
              <div key={contract.id} className="bg-white border border-slate-200 rounded-xl p-4 hover:border-indigo-300 transition-all">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-900 text-sm">{contract.id}</span>
                      {contractStatusBadge(contract.status)}
                      {contract.auto_renew && <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">تجديد تلقائي</span>}
                    </div>
                    <p className="text-slate-700 text-sm mt-0.5">{contract.product}</p>
                    <p className="text-slate-500 text-xs mt-0.5">{contract.company} · {contract.country}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-slate-900 font-bold">{contract.monthly_volume.toLocaleString('en-US')} {contract.unit}/شهر</p>
                    <p className="text-slate-500 text-xs">${contract.unit_price}/{contract.unit} · {contract.currency}</p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {[
                    { label: 'مدة العقد', value: `${contract.duration_months} شهر` },
                    { label: 'تاريخ البداية', value: contract.start_date },
                    { label: 'تاريخ الانتهاء', value: contract.end_date },
                  ].map(d => (
                    <div key={d.label} className="bg-slate-50 rounded-lg p-2 text-center">
                      <p className="text-slate-500 text-xs">{d.label}</p>
                      <p className="text-slate-800 text-xs font-medium mt-0.5">{d.value}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <button className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs transition-colors">
                    <Icon name="Eye" size={12} />
                    عرض العقد
                  </button>
                  {contract.status === 'pending_signature' && (
                    <button className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs transition-colors">
                      <Icon name="PenTool" size={12} />
                      توقيع العقد
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
