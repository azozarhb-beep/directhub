'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

import Icon from '@/components/ui/AppIcon';
import AppLogo from '@/components/ui/AppLogo';
import { useLanguage } from '@/contexts/LanguageContext';

// ─── Types ────────────────────────────────────────────────────────────────────

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
  status: 'new' | 'negotiating' | 'quoted' | 'accepted' | 'rejected';
  created_at: string;
  notes: string;
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

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_RFQS: RFQRequest[] = [
  { id: 'RFQ-2024-001', buyer_company: 'Müller Industries GmbH', buyer_country: '🇩🇪 Germany', product_name: 'Steel Pipes DN100', quantity: 2000, unit: 'pcs', target_price: 45, currency: 'USD', delivery_date: '2026-11-15', status: 'negotiating', created_at: '2026-09-28', notes: 'نحتاج شهادة ISO 9001 وتقرير اختبار المواد' },
  { id: 'RFQ-2024-002', buyer_company: 'Riyadh Contracting Co.', buyer_country: '🇸🇦 Saudi Arabia', product_name: 'Cement 50kg Bags', quantity: 50000, unit: 'bags', target_price: 8.5, currency: 'USD', delivery_date: '2026-10-30', status: 'new', created_at: '2026-09-30', notes: 'مطلوب شهادة مطابقة SASO' },
  { id: 'RFQ-2024-003', buyer_company: 'Istanbul Metals A.Ş.', buyer_country: '🇹🇷 Turkey', product_name: 'Copper Wire 2.5mm', quantity: 5000, unit: 'kg', target_price: 12, currency: 'EUR', delivery_date: '2026-11-01', status: 'quoted', created_at: '2026-09-25', notes: 'التسليم CIF ميناء إسطنبول' },
  { id: 'RFQ-2024-004', buyer_company: 'Mumbai Exports Ltd', buyer_country: '🇮🇳 India', product_name: 'Aluminium Sheets 3mm', quantity: 8000, unit: 'kg', target_price: 3.2, currency: 'USD', delivery_date: '2026-12-01', status: 'accepted', created_at: '2026-09-20', notes: 'موافق على الشروط — بانتظار العقد' },
];

const MOCK_BULK_ORDERS: BulkOrder[] = [
  {
    id: 'BO-001', company: 'Müller Industries GmbH', country: '🇩🇪 Germany', product: 'Steel Pipes DN100', quantity: 2000, unit: 'pcs', unit_price: 47, total: 94000, currency: 'USD', contract_type: 'spot', escrow_status: 'milestone_1',
    milestones: [
      { label: 'دفعة أولى (30%) — عند التصنيع', amount: 28200, status: 'completed' },
      { label: 'دفعة ثانية (40%) — عند الشحن', amount: 37600, status: 'completed' },
      { label: 'دفعة نهائية (30%) — عند التسليم', amount: 28200, status: 'pending' },
    ],
  },
  {
    id: 'BO-002', company: 'Riyadh Contracting Co.', country: '🇸🇦 Saudi Arabia', product: 'Cement 50kg Bags', quantity: 50000, unit: 'bags', unit_price: 9, total: 450000, currency: 'USD', contract_type: 'quarterly', escrow_status: 'funded',
    milestones: [
      { label: 'دفعة أولى (25%) — عند التأكيد', amount: 112500, status: 'completed' },
      { label: 'دفعة ثانية (50%) — عند الشحن', amount: 225000, status: 'pending' },
      { label: 'دفعة نهائية (25%) — عند التسليم', amount: 112500, status: 'pending' },
    ],
  },
];

const MOCK_CONTRACTS: SupplyContract[] = [
  { id: 'SC-001', company: 'Istanbul Metals A.Ş.', country: '🇹🇷 Turkey', product: 'Copper Wire 2.5mm', monthly_volume: 5000, unit: 'kg', unit_price: 13.5, currency: 'EUR', duration_months: 12, start_date: '2026-01-01', end_date: '2026-12-31', status: 'active', auto_renew: true },
  { id: 'SC-002', company: 'Shenzhen Trade Co.', country: '🇨🇳 China', product: 'Aluminium Sheets', monthly_volume: 10000, unit: 'kg', unit_price: 3.8, currency: 'USD', duration_months: 6, start_date: '2026-07-01', end_date: '2026-12-31', status: 'active', auto_renew: false },
  { id: 'SC-003', company: 'Cairo Industrial Group', country: '🇪🇬 Egypt', product: 'Steel Rebar 12mm', monthly_volume: 20000, unit: 'kg', unit_price: 0.85, currency: 'USD', duration_months: 24, start_date: '2025-01-01', end_date: '2026-12-31', status: 'pending_signature', auto_renew: true },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rfqStatusBadge(status: RFQRequest['status']) {
  const map: Record<RFQRequest['status'], { label: string; cls: string }> = {
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
  const [activeTab, setActiveTab] = useState<Tab>('rfq');
  const [selectedRFQ, setSelectedRFQ] = useState<RFQRequest | null>(null);
  const [quotePrice, setQuotePrice] = useState('');
  const [quoteNote, setQuoteNote] = useState('');
  const [showQuoteForm, setShowQuoteForm] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.push('/manufacturer/login');
  }, [user, authLoading, router]);

  if (authLoading) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  const totalRFQValue = MOCK_RFQS.reduce((s, r) => s + r.quantity * r.target_price, 0);
  const activeContracts = MOCK_CONTRACTS.filter(c => c.status === 'active').length;
  const escrowFunded = MOCK_BULK_ORDERS.reduce((s, o) => s + (o.escrow_status !== 'pending' ? o.total : 0), 0);

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
            { label: 'طلبات RFQ النشطة', value: MOCK_RFQS.filter(r => r.status !== 'rejected').length.toString(), icon: 'FileQuestion', color: 'bg-indigo-50 border-indigo-200', iconColor: 'text-indigo-600', valueColor: 'text-indigo-700' },
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

        {/* Tab: RFQ */}
        {activeTab === 'rfq' && (
          <div className="space-y-3">
            {MOCK_RFQS.map(rfq => (
              <div key={rfq.id} className="bg-white border border-slate-200 rounded-xl p-4 hover:border-indigo-300 transition-all">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                      <Icon name="FileQuestion" size={18} className="text-indigo-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-900 text-sm">{rfq.id}</span>
                        {rfqStatusBadge(rfq.status)}
                      </div>
                      <p className="text-slate-700 text-sm mt-0.5">{rfq.product_name}</p>
                      <p className="text-slate-500 text-xs mt-0.5">{rfq.buyer_company} · {rfq.buyer_country}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-slate-900 font-bold">{rfq.quantity.toLocaleString()} {rfq.unit}</p>
                    <p className="text-slate-500 text-xs">هدف: ${rfq.target_price}/{rfq.unit}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-slate-500 text-xs bg-slate-50 rounded-lg px-3 py-1.5 flex-1">{rfq.notes}</p>
                  {rfq.status === 'new' || rfq.status === 'negotiating' ? (
                    <button
                      onClick={() => { setSelectedRFQ(rfq); setShowQuoteForm(true); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium transition-colors"
                    >
                      <Icon name="Send" size={12} />
                      إرسال عرض سعر
                    </button>
                  ) : rfq.status === 'accepted' ? (
                    <Link href="/manufacturer/b2b#bulk_orders" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium transition-colors">
                      <Icon name="ShoppingCart" size={12} />
                      إنشاء طلب جملة
                    </Link>
                  ) : null}
                </div>
              </div>
            ))}

            {/* Quote Form Modal */}
            {showQuoteForm && selectedRFQ && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-slate-900">إرسال عرض سعر</h3>
                    <button onClick={() => setShowQuoteForm(false)} className="text-slate-400 hover:text-slate-600"><Icon name="X" size={20} /></button>
                  </div>
                  <div className="space-y-3">
                    <div className="bg-slate-50 rounded-lg p-3 text-sm">
                      <p className="text-slate-500">الطلب: <span className="text-slate-900 font-medium">{selectedRFQ.id}</span></p>
                      <p className="text-slate-500 mt-1">المنتج: <span className="text-slate-900 font-medium">{selectedRFQ.product_name}</span></p>
                      <p className="text-slate-500 mt-1">الكمية: <span className="text-slate-900 font-medium">{selectedRFQ.quantity.toLocaleString()} {selectedRFQ.unit}</span></p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">سعر العرض ({selectedRFQ.currency}/{selectedRFQ.unit})</label>
                      <input type="number" value={quotePrice} onChange={e => setQuotePrice(e.target.value)} placeholder={`السعر المستهدف: ${selectedRFQ.target_price}`} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">ملاحظات العرض</label>
                      <textarea value={quoteNote} onChange={e => setQuoteNote(e.target.value)} rows={3} placeholder="شروط الدفع، مدة التسليم، الشهادات المرفقة..." className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button onClick={() => setShowQuoteForm(false)} className="flex-1 px-4 py-2 rounded-lg border border-slate-300 text-slate-600 text-sm hover:bg-slate-50 transition-colors">إلغاء</button>
                      <button onClick={() => { setShowQuoteForm(false); setQuotePrice(''); setQuoteNote(''); }} className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors">إرسال العرض</button>
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
            {MOCK_BULK_ORDERS.map(order => (
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
                    <p className="text-2xl font-bold text-slate-900">${order.total.toLocaleString()}</p>
                    <p className="text-slate-500 text-xs">{order.quantity.toLocaleString()} {order.unit} × ${order.unit_price}</p>
                  </div>
                </div>

                {/* Milestones */}
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
                      <span className={`text-sm font-bold ${m.status === 'completed' ? 'text-emerald-700' : 'text-slate-500'}`}>${m.amount.toLocaleString()}</span>
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
            {MOCK_CONTRACTS.map(contract => (
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
                    <p className="text-slate-900 font-bold">{contract.monthly_volume.toLocaleString()} {contract.unit}/شهر</p>
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
