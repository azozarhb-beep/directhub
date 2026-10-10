'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';
import Header from '@/components/Header';
import { useLanguage } from '@/contexts/LanguageContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface InternationalFactory {
  id: string;
  user_id: string;
  company_name: string;
  country: string;
  city: string;
  industry: string;
  employee_count: string;
  annual_revenue: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  website: string;
  registration_status: 'pending' | 'under_review' | 'approved' | 'rejected';
  kyc_status: 'pending' | 'under_review' | 'approved' | 'rejected';
  is_approved: boolean;
  is_active: boolean;
  seller_category?: string;
  factory_type?: string;
  submitted_at: string;
  created_at?: string;
  admin_note?: string;
  user_profiles?: { full_name: string; email: string };
}

interface FactoryProduct {
  id: string;
  name: string;
  category: string;
  unit_price: number;
  stock_quantity: number;
  is_active: boolean;
  created_at: string;
  manufacturer_id: string;
}

type ActiveSection = 'overview' | 'factories' | 'products' | 'orders' | 'verification' | 'analytics';

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border border-amber-200',
  under_review: 'bg-blue-50 text-blue-700 border border-blue-200',
  approved: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  rejected: 'bg-red-50 text-red-700 border border-red-200',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'قيد الانتظار',
  under_review: 'قيد المراجعة',
  approved: 'موافق عليه',
  rejected: 'مرفوض',
};

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function InternationalFactoriesControlRoom() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { isRTL } = useLanguage();
  const supabase = createClient();

  const [activeSection, setActiveSection] = useState<ActiveSection>('overview');
  const [factories, setFactories] = useState<InternationalFactory[]>([]);
  const [products, setProducts] = useState<FactoryProduct[]>([]);
  const [loadingFactories, setLoadingFactories] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [countryFilter, setCountryFilter] = useState<string>('all');
  const [selectedFactory, setSelectedFactory] = useState<InternationalFactory | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // KPI state
  const [kpis, setKpis] = useState({
    total: 0,
    approved: 0,
    pending: 0,
    rejected: 0,
    activeProducts: 0,
    countries: 0,
  });

  // ── Auth guard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  // ── Fetch factories ─────────────────────────────────────────────────────────
  const fetchFactories = useCallback(async () => {
    setLoadingFactories(true);
    try {
      const { data, error } = await supabase
        .from('factory_registrations')
        .select('*, user_profiles(full_name, email)')
        .or('seller_category.eq.international_factory,factory_type.eq.international')
        .order('submitted_at', { ascending: false });

      if (error) throw error;
      const list = data || [];
      setFactories(list);

      // Compute KPIs
      const countries = new Set(list.map((f: InternationalFactory) => f.country).filter(Boolean));
      setKpis({
        total: list.length,
        approved: list.filter((f: InternationalFactory) => f.registration_status === 'approved').length,
        pending: list.filter((f: InternationalFactory) => f.registration_status === 'pending' || f.registration_status === 'under_review').length,
        rejected: list.filter((f: InternationalFactory) => f.registration_status === 'rejected').length,
        activeProducts: 0,
        countries: countries.size,
      });
    } catch (err) {
      console.error('Error fetching international factories:', err);
    } finally {
      setLoadingFactories(false);
    }
  }, [supabase]);

  // ── Fetch products ──────────────────────────────────────────────────────────
  const fetchProducts = useCallback(async () => {
    setLoadingProducts(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, category, unit_price, stock_quantity, is_active, created_at, manufacturer_id')
        .eq('origin_type', 'international')
        .order('created_at', { ascending: false })
        .limit(100);

      if (!error && data) {
        setProducts(data);
        setKpis(prev => ({ ...prev, activeProducts: data.filter((p: FactoryProduct) => p.is_active).length }));
      }
    } catch (err) {
      console.error('Error fetching products:', err);
    } finally {
      setLoadingProducts(false);
    }
  }, [supabase]);

  useEffect(() => {
    if (user) {
      fetchFactories();
    }
  }, [user, fetchFactories]);

  useEffect(() => {
    if (activeSection === 'products' && products.length === 0) {
      fetchProducts();
    }
  }, [activeSection, products.length, fetchProducts]);

  // ── Actions ─────────────────────────────────────────────────────────────────
  const showSuccess = (msg: string) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 3500); };
  const showError = (msg: string) => { setErrorMsg(msg); setTimeout(() => setErrorMsg(''), 4000); };

  const handleApprove = async (factoryId: string) => {
    setActionLoading(factoryId + '_approve');
    try {
      const { error } = await supabase
        .from('factory_registrations')
        .update({ registration_status: 'approved', is_approved: true, kyc_status: 'approved' })
        .eq('id', factoryId);
      if (error) throw error;
      showSuccess('تمت الموافقة على المصنع بنجاح');
      fetchFactories();
      setSelectedFactory(null);
    } catch {
      showError('فشل في الموافقة على المصنع');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (factoryId: string) => {
    setActionLoading(factoryId + '_reject');
    try {
      const { error } = await supabase
        .from('factory_registrations')
        .update({ registration_status: 'rejected', is_approved: false })
        .eq('id', factoryId);
      if (error) throw error;
      showSuccess('تم رفض المصنع');
      fetchFactories();
      setSelectedFactory(null);
    } catch {
      showError('فشل في رفض المصنع');
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleActive = async (factoryId: string, currentActive: boolean) => {
    setActionLoading(factoryId + '_toggle');
    try {
      const { error } = await supabase
        .from('factory_registrations')
        .update({ is_active: !currentActive })
        .eq('id', factoryId);
      if (error) throw error;
      showSuccess(currentActive ? 'تم تعطيل المصنع' : 'تم تفعيل المصنع');
      fetchFactories();
    } catch {
      showError('فشل في تغيير حالة المصنع');
    } finally {
      setActionLoading(null);
    }
  };

  // ── Filtered factories ──────────────────────────────────────────────────────
  const filteredFactories = factories.filter(f => {
    const matchSearch = !searchQuery ||
      f.company_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.contact_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.country?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.contact_email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = statusFilter === 'all' || f.registration_status === statusFilter;
    const matchCountry = countryFilter === 'all' || f.country === countryFilter;
    return matchSearch && matchStatus && matchCountry;
  });

  const uniqueCountries = Array.from(new Set(factories.map(f => f.country).filter(Boolean))).sort();

  // ── Sections config ─────────────────────────────────────────────────────────
  const sections: { key: ActiveSection; label: string; icon: string; gradient: string }[] = [
    { key: 'overview', label: 'نظرة عامة', icon: 'ChartBarIcon', gradient: 'linear-gradient(135deg,#3B82F6,#2563EB)' },
    { key: 'factories', label: 'المصانع الدولية', icon: 'BuildingOffice2Icon', gradient: 'linear-gradient(135deg,#F97316,#EA580C)' },
    { key: 'verification', label: 'التحقق والموافقة', icon: 'DocumentCheckIcon', gradient: 'linear-gradient(135deg,#F59E0B,#D97706)' },
    { key: 'products', label: 'المنتجات الدولية', icon: 'CubeIcon', gradient: 'linear-gradient(135deg,#8B5CF6,#7C3AED)' },
    { key: 'analytics', label: 'التحليلات', icon: 'PresentationChartLineIcon', gradient: 'linear-gradient(135deg,#10B981,#059669)' },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" dir={isRTL ? 'rtl' : 'ltr'}>
      <Header />

      {/* ── Page Header ─────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white px-4 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-4 mb-4">
            <Link href="/admin/control-room" className="flex items-center gap-2 text-white/60 hover:text-white text-sm transition-colors">
              <Icon name="ArrowRightIcon" size={14} />
              غرفة التحكم الرئيسية
            </Link>
            <span className="text-white/30">/</span>
            <span className="text-white/80 text-sm">المصانع الدولية</span>
          </div>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center">
                  <Icon name="GlobeAltIcon" size={24} className="text-blue-300" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">غرفة تحكم المصانع الدولية</h1>
                  <p className="text-white/60 text-sm">International Factories Control Room</p>
                </div>
              </div>
              <p className="text-white/50 text-sm max-w-xl">
                إدارة ومراقبة جميع المصانع الدولية المسجلة على المنصة — التحقق، الموافقة، المنتجات، والتحليلات
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={fetchFactories}
                className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-medium transition-colors"
              >
                <Icon name="ArrowPathIcon" size={14} />
                تحديث
              </button>
              <Link
                href="/admin/control-room"
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-bold transition-colors"
              >
                <Icon name="Cog6ToothIcon" size={14} />
                لوحة التحكم الكاملة
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ── Toast Messages ───────────────────────────────────────────────────── */}
      {successMsg && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-6 py-3 rounded-2xl shadow-xl text-sm font-medium flex items-center gap-2">
          <Icon name="CheckCircleIcon" size={16} />
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white px-6 py-3 rounded-2xl shadow-xl text-sm font-medium flex items-center gap-2">
          <Icon name="ExclamationCircleIcon" size={16} />
          {errorMsg}
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-6">

        {/* ── KPI Cards ───────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          {[
            { label: 'إجمالي المصانع', value: kpis.total, icon: 'BuildingOffice2Icon', color: 'bg-blue-50 border-blue-200 text-blue-700' },
            { label: 'موافق عليها', value: kpis.approved, icon: 'CheckBadgeIcon', color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
            { label: 'قيد المراجعة', value: kpis.pending, icon: 'ClockIcon', color: 'bg-amber-50 border-amber-200 text-amber-700' },
            { label: 'مرفوضة', value: kpis.rejected, icon: 'XCircleIcon', color: 'bg-red-50 border-red-200 text-red-700' },
            { label: 'منتجات نشطة', value: kpis.activeProducts, icon: 'CubeIcon', color: 'bg-purple-50 border-purple-200 text-purple-700' },
            { label: 'دول', value: kpis.countries, icon: 'GlobeAltIcon', color: 'bg-sky-50 border-sky-200 text-sky-700' },
          ].map((kpi, i) => (
            <div key={i} className={`rounded-2xl border p-4 ${kpi.color}`}>
              <div className="flex items-center gap-2 mb-1">
                <Icon name={kpi.icon as any} size={16} />
                <span className="text-xs font-medium opacity-80">{kpi.label}</span>
              </div>
              <p className="text-2xl font-bold">{kpi.value}</p>
            </div>
          ))}
        </div>

        {/* ── Section Tabs ─────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-2 mb-6">
          {sections.map(sec => {
            const isActive = activeSection === sec.key;
            return (
              <button
                key={sec.key}
                onClick={() => setActiveSection(sec.key)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 border ${
                  isActive
                    ? 'text-white border-transparent shadow-md'
                    : 'bg-card text-muted-foreground border-border hover:border-primary/30 hover:text-foreground'
                }`}
                style={isActive ? { background: sec.gradient } : {}}
              >
                <Icon name={sec.icon as any} size={15} />
                {sec.label}
              </button>
            );
          })}
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            SECTION: OVERVIEW
        ══════════════════════════════════════════════════════════════════════ */}
        {activeSection === 'overview' && (
          <div className="space-y-6">
            {/* Quick stats bento */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Approval rate */}
              <div className="bg-card border border-border rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-muted-foreground mb-3">معدل الموافقة</h3>
                <div className="flex items-end gap-2 mb-3">
                  <span className="text-4xl font-bold text-foreground">
                    {kpis.total > 0 ? Math.round((kpis.approved / kpis.total) * 100) : 0}%
                  </span>
                  <span className="text-muted-foreground text-sm mb-1">من الإجمالي</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-emerald-500 h-2 rounded-full transition-all"
                    style={{ width: `${kpis.total > 0 ? (kpis.approved / kpis.total) * 100 : 0}%` }}
                  />
                </div>
              </div>

              {/* Status breakdown */}
              <div className="bg-card border border-border rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-muted-foreground mb-3">توزيع الحالات</h3>
                <div className="space-y-2">
                  {[
                    { label: 'موافق عليها', count: kpis.approved, color: 'bg-emerald-500' },
                    { label: 'قيد المراجعة', count: kpis.pending, color: 'bg-amber-500' },
                    { label: 'مرفوضة', count: kpis.rejected, color: 'bg-red-500' },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${item.color}`} />
                      <span className="text-sm text-muted-foreground flex-1">{item.label}</span>
                      <span className="text-sm font-bold text-foreground">{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick actions */}
              <div className="bg-card border border-border rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-muted-foreground mb-3">إجراءات سريعة</h3>
                <div className="space-y-2">
                  <button
                    onClick={() => setActiveSection('verification')}
                    className="w-full flex items-center gap-2 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-xl text-sm font-medium transition-colors"
                  >
                    <Icon name="ClockIcon" size={14} />
                    مراجعة الطلبات المعلقة ({kpis.pending})
                  </button>
                  <button
                    onClick={() => setActiveSection('factories')}
                    className="w-full flex items-center gap-2 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-sm font-medium transition-colors"
                  >
                    <Icon name="BuildingOffice2Icon" size={14} />
                    عرض جميع المصانع ({kpis.total})
                  </button>
                  <button
                    onClick={() => setActiveSection('products')}
                    className="w-full flex items-center gap-2 px-3 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-xl text-sm font-medium transition-colors"
                  >
                    <Icon name="CubeIcon" size={14} />
                    المنتجات الدولية
                  </button>
                </div>
              </div>
            </div>

            {/* Recent factories */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                <h3 className="font-bold text-foreground">أحدث المصانع المسجلة</h3>
                <button onClick={() => setActiveSection('factories')} className="text-primary text-sm hover:underline">
                  عرض الكل
                </button>
              </div>
              {loadingFactories ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : factories.slice(0, 5).length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-sm">
                  لا توجد مصانع دولية مسجلة بعد
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {factories.slice(0, 5).map(factory => (
                    <div key={factory.id} className="px-5 py-3 flex items-center gap-3 hover:bg-muted/30 transition-colors">
                      <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                        <Icon name="BuildingOffice2Icon" size={16} className="text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground text-sm truncate">{factory.company_name}</p>
                        <p className="text-xs text-muted-foreground">{factory.country} · {factory.industry}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${STATUS_BADGE[factory.registration_status] || ''}`}>
                        {STATUS_LABELS[factory.registration_status] || factory.registration_status}
                      </span>
                      <span className="text-xs text-muted-foreground">{formatDate(factory.submitted_at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            SECTION: ALL FACTORIES
        ══════════════════════════════════════════════════════════════════════ */}
        {activeSection === 'factories' && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="bg-card border border-border rounded-2xl p-4 flex flex-wrap gap-3 items-center">
              <div className="flex-1 min-w-48 relative">
                <Icon name="MagnifyingGlassIcon" size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="بحث بالاسم، البلد، البريد..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full h-10 pr-9 pl-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary"
                />
              </div>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="h-10 px-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none"
              >
                <option value="all">جميع الحالات</option>
                <option value="pending">قيد الانتظار</option>
                <option value="under_review">قيد المراجعة</option>
                <option value="approved">موافق عليه</option>
                <option value="rejected">مرفوض</option>
              </select>
              <select
                value={countryFilter}
                onChange={e => setCountryFilter(e.target.value)}
                className="h-10 px-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none"
              >
                <option value="all">جميع الدول</option>
                {uniqueCountries.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <span className="text-sm text-muted-foreground">{filteredFactories.length} مصنع</span>
            </div>

            {/* Factory table */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              {loadingFactories ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : filteredFactories.length === 0 ? (
                <div className="py-16 text-center">
                  <Icon name="BuildingOffice2Icon" size={40} className="text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm">لا توجد مصانع تطابق معايير البحث</p>
                </div>
              ) : (
                <div className="overflow-x-auto -mx-6 px-6 sm:mx-0 sm:px-0">
                  <table className="w-full text-sm min-w-[500px]">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="text-right px-4 py-3 text-muted-foreground font-semibold">المصنع</th>
                        <th className="text-right px-4 py-3 text-muted-foreground font-semibold">البلد</th>
                        <th className="text-right px-4 py-3 text-muted-foreground font-semibold">الصناعة</th>
                        <th className="text-right px-4 py-3 text-muted-foreground font-semibold">الحالة</th>
                        <th className="text-right px-4 py-3 text-muted-foreground font-semibold">تاريخ التسجيل</th>
                        <th className="text-right px-4 py-3 text-muted-foreground font-semibold">إجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredFactories.map(factory => (
                        <tr key={factory.id} className="hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3">
                            <div>
                              <p className="font-semibold text-foreground">{factory.company_name}</p>
                              <p className="text-xs text-muted-foreground">{factory.contact_email}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{factory.country}</td>
                          <td className="px-4 py-3 text-muted-foreground">{factory.industry || '—'}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-lg text-[11px] font-bold ${STATUS_BADGE[factory.registration_status] || ''}`}>
                              {STATUS_LABELS[factory.registration_status] || factory.registration_status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(factory.submitted_at)}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => setSelectedFactory(factory)}
                                className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-medium transition-colors"
                              >
                                تفاصيل
                              </button>
                              {factory.registration_status !== 'approved' && (
                                <button
                                  onClick={() => handleApprove(factory.id)}
                                  disabled={actionLoading === factory.id + '_approve'}
                                  className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                                >
                                  {actionLoading === factory.id + '_approve' ? '...' : 'موافقة'}
                                </button>
                              )}
                              <button
                                onClick={() => handleToggleActive(factory.id, factory.is_active)}
                                disabled={actionLoading === factory.id + '_toggle'}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${
                                  factory.is_active
                                    ? 'bg-red-50 hover:bg-red-100 text-red-700' :'bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
                                }`}
                              >
                                {actionLoading === factory.id + '_toggle' ? '...' : factory.is_active ? 'تعطيل' : 'تفعيل'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            SECTION: VERIFICATION QUEUE
        ══════════════════════════════════════════════════════════════════════ */}
        {activeSection === 'verification' && (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
              <Icon name="ClockIcon" size={18} className="text-amber-600 shrink-0" />
              <p className="text-amber-800 text-sm font-medium">
                {kpis.pending} مصنع دولي بانتظار المراجعة والموافقة
              </p>
            </div>

            {factories.filter(f => f.registration_status === 'pending' || f.registration_status === 'under_review').length === 0 ? (
              <div className="bg-card border border-border rounded-2xl py-16 text-center">
                <Icon name="CheckCircleIcon" size={40} className="text-emerald-400 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">لا توجد طلبات معلقة — جميع المصانع تمت مراجعتها</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {factories
                  .filter(f => f.registration_status === 'pending' || f.registration_status === 'under_review')
                  .map(factory => (
                    <div key={factory.id} className="bg-card border border-amber-200 rounded-2xl overflow-hidden">
                      <div className="bg-amber-50 px-5 py-3 flex items-center justify-between border-b border-amber-200">
                        <div className="flex items-center gap-2">
                          <Icon name="BuildingOffice2Icon" size={16} className="text-amber-600" />
                          <span className="font-bold text-amber-900 text-sm">{factory.company_name}</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${STATUS_BADGE[factory.registration_status]}`}>
                          {STATUS_LABELS[factory.registration_status]}
                        </span>
                      </div>
                      <div className="p-5 space-y-2">
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-muted-foreground text-xs">البلد</span>
                            <p className="font-medium text-foreground">{factory.country || '—'}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground text-xs">الصناعة</span>
                            <p className="font-medium text-foreground">{factory.industry || '—'}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground text-xs">جهة الاتصال</span>
                            <p className="font-medium text-foreground">{factory.contact_name || '—'}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground text-xs">البريد الإلكتروني</span>
                            <p className="font-medium text-foreground text-xs truncate">{factory.contact_email || '—'}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground text-xs">الموظفون</span>
                            <p className="font-medium text-foreground">{factory.employee_count || '—'}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground text-xs">تاريخ التقديم</span>
                            <p className="font-medium text-foreground">{formatDate(factory.submitted_at)}</p>
                          </div>
                        </div>
                        <div className="flex gap-2 pt-2">
                          <button
                            onClick={() => handleApprove(factory.id)}
                            disabled={actionLoading === factory.id + '_approve'}
                            className="flex-1 flex items-center justify-center gap-2 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-50"
                          >
                            <Icon name="CheckIcon" size={14} />
                            {actionLoading === factory.id + '_approve' ? 'جاري...' : 'موافقة'}
                          </button>
                          <button
                            onClick={() => handleReject(factory.id)}
                            disabled={actionLoading === factory.id + '_reject'}
                            className="flex-1 flex items-center justify-center gap-2 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl text-sm font-bold transition-colors disabled:opacity-50"
                          >
                            <Icon name="XMarkIcon" size={14} />
                            {actionLoading === factory.id + '_reject' ? 'جاري...' : 'رفض'}
                          </button>
                          <button
                            onClick={() => setSelectedFactory(factory)}
                            className="px-3 py-2 bg-muted hover:bg-muted/80 text-muted-foreground rounded-xl text-sm transition-colors"
                          >
                            <Icon name="EyeIcon" size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            SECTION: PRODUCTS
        ══════════════════════════════════════════════════════════════════════ */}
        {activeSection === 'products' && (
          <div className="space-y-4">
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                <h3 className="font-bold text-foreground">المنتجات الدولية</h3>
                <span className="text-sm text-muted-foreground">{products.length} منتج</span>
              </div>
              {loadingProducts ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : products.length === 0 ? (
                <div className="py-16 text-center">
                  <Icon name="CubeIcon" size={40} className="text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm">لا توجد منتجات دولية مسجلة</p>
                </div>
              ) : (
                <div className="overflow-x-auto -mx-6 px-6 sm:mx-0 sm:px-0">
                  <table className="w-full text-sm min-w-[500px]">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="text-right px-4 py-3 text-muted-foreground font-semibold">المنتج</th>
                        <th className="text-right px-4 py-3 text-muted-foreground font-semibold">الفئة</th>
                        <th className="text-right px-4 py-3 text-muted-foreground font-semibold">السعر</th>
                        <th className="text-right px-4 py-3 text-muted-foreground font-semibold">المخزون</th>
                        <th className="text-right px-4 py-3 text-muted-foreground font-semibold">الحالة</th>
                        <th className="text-right px-4 py-3 text-muted-foreground font-semibold">التاريخ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {products.map(product => (
                        <tr key={product.id} className="hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3 font-medium text-foreground">{product.name}</td>
                          <td className="px-4 py-3 text-muted-foreground">{product.category}</td>
                          <td className="px-4 py-3 text-foreground font-semibold">${product.unit_price?.toFixed(2) || '—'}</td>
                          <td className="px-4 py-3 text-muted-foreground">{product.stock_quantity ?? '—'}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-lg text-[11px] font-bold ${
                              product.is_active
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :'bg-muted text-muted-foreground border border-border'
                            }`}>
                              {product.is_active ? 'نشط' : 'غير نشط'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(product.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            SECTION: ANALYTICS
        ══════════════════════════════════════════════════════════════════════ */}
        {activeSection === 'analytics' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Country distribution */}
              <div className="bg-card border border-border rounded-2xl p-5">
                <h3 className="font-bold text-foreground mb-4">توزيع المصانع حسب الدولة</h3>
                {factories.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-8">لا توجد بيانات</p>
                ) : (
                  <div className="space-y-2">
                    {Object.entries(
                      factories.reduce((acc: Record<string, number>, f) => {
                        if (f.country) acc[f.country] = (acc[f.country] || 0) + 1;
                        return acc;
                      }, {})
                    )
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 8)
                      .map(([country, count]) => (
                        <div key={country} className="flex items-center gap-3">
                          <span className="text-sm text-muted-foreground w-24 truncate">{country}</span>
                          <div className="flex-1 bg-muted rounded-full h-2">
                            <div
                              className="bg-blue-500 h-2 rounded-full"
                              style={{ width: `${(count / factories.length) * 100}%` }}
                            />
                          </div>
                          <span className="text-sm font-bold text-foreground w-6 text-right">{count}</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* Industry distribution */}
              <div className="bg-card border border-border rounded-2xl p-5">
                <h3 className="font-bold text-foreground mb-4">توزيع المصانع حسب الصناعة</h3>
                {factories.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-8">لا توجد بيانات</p>
                ) : (
                  <div className="space-y-2">
                    {Object.entries(
                      factories.reduce((acc: Record<string, number>, f) => {
                        const ind = f.industry || 'غير محدد';
                        acc[ind] = (acc[ind] || 0) + 1;
                        return acc;
                      }, {})
                    )
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 8)
                      .map(([industry, count]) => (
                        <div key={industry} className="flex items-center gap-3">
                          <span className="text-sm text-muted-foreground flex-1 truncate">{industry}</span>
                          <div className="w-24 bg-muted rounded-full h-2">
                            <div
                              className="bg-purple-500 h-2 rounded-full"
                              style={{ width: `${(count / factories.length) * 100}%` }}
                            />
                          </div>
                          <span className="text-sm font-bold text-foreground w-6 text-right">{count}</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>

            {/* Status summary table */}
            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="font-bold text-foreground mb-4">ملخص الإحصائيات</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: 'إجمالي المصانع الدولية', value: kpis.total, icon: 'BuildingOffice2Icon', color: 'text-blue-600' },
                  { label: 'موافق عليها', value: kpis.approved, icon: 'CheckBadgeIcon', color: 'text-emerald-600' },
                  { label: 'قيد المراجعة', value: kpis.pending, icon: 'ClockIcon', color: 'text-amber-600' },
                  { label: 'دول مختلفة', value: kpis.countries, icon: 'GlobeAltIcon', color: 'text-sky-600' },
                ].map((stat, i) => (
                  <div key={i} className="text-center p-4 bg-muted/30 rounded-xl">
                    <Icon name={stat.icon as any} size={24} className={`${stat.color} mx-auto mb-2`} />
                    <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Factory Detail Modal ─────────────────────────────────────────────── */}
      {selectedFactory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-card border-b border-border px-5 py-4 flex items-center justify-between">
              <h3 className="font-bold text-foreground">تفاصيل المصنع الدولي</h3>
              <button
                onClick={() => setSelectedFactory(null)}
                className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center"
              >
                <Icon name="XMarkIcon" size={16} className="text-muted-foreground" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {/* Header */}
              <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-xl">
                <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                  <Icon name="BuildingOffice2Icon" size={22} className="text-blue-600" />
                </div>
                <div>
                  <p className="font-bold text-foreground">{selectedFactory.company_name}</p>
                  <p className="text-sm text-muted-foreground">{selectedFactory.country} · {selectedFactory.industry}</p>
                </div>
                <span className={`mr-auto px-2 py-1 rounded-lg text-xs font-bold ${STATUS_BADGE[selectedFactory.registration_status]}`}>
                  {STATUS_LABELS[selectedFactory.registration_status]}
                </span>
              </div>

              {/* Details grid */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'اسم جهة الاتصال', value: selectedFactory.contact_name },
                  { label: 'البريد الإلكتروني', value: selectedFactory.contact_email },
                  { label: 'الهاتف', value: selectedFactory.contact_phone },
                  { label: 'الموقع الإلكتروني', value: selectedFactory.website },
                  { label: 'عدد الموظفين', value: selectedFactory.employee_count },
                  { label: 'الإيرادات السنوية', value: selectedFactory.annual_revenue },
                  { label: 'المدينة', value: selectedFactory.city },
                  { label: 'تاريخ التقديم', value: formatDate(selectedFactory.submitted_at) },
                ].map((item, i) => (
                  <div key={i} className="bg-muted/30 rounded-xl p-3">
                    <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
                    <p className="text-sm font-medium text-foreground truncate">{item.value || '—'}</p>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                {selectedFactory.registration_status !== 'approved' && (
                  <button
                    onClick={() => handleApprove(selectedFactory.id)}
                    disabled={actionLoading === selectedFactory.id + '_approve'}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-50"
                  >
                    <Icon name="CheckIcon" size={14} />
                    {actionLoading === selectedFactory.id + '_approve' ? 'جاري...' : 'موافقة'}
                  </button>
                )}
                {selectedFactory.registration_status !== 'rejected' && (
                  <button
                    onClick={() => handleReject(selectedFactory.id)}
                    disabled={actionLoading === selectedFactory.id + '_reject'}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl text-sm font-bold transition-colors disabled:opacity-50"
                  >
                    <Icon name="XMarkIcon" size={14} />
                    {actionLoading === selectedFactory.id + '_reject' ? 'جاري...' : 'رفض'}
                  </button>
                )}
                <button
                  onClick={() => setSelectedFactory(null)}
                  className="px-4 py-2.5 bg-muted hover:bg-muted/80 text-muted-foreground rounded-xl text-sm transition-colors"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
