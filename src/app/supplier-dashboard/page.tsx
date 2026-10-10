'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import Header from '@/components/Header';
import Icon from '@/components/ui/AppIcon';

// ─── Types ────────────────────────────────────────────────────────────────────
interface SupplierStats {
  totalProducts: number;
  activeProducts: number;
  totalOrders: number;
  pendingOrders: number;
  completedOrders: number;
  totalRevenue: number;
  pendingRFQs: number;
  respondedRFQs: number;
  avgResponseRate: number;
  trustScore: number;
  verificationStatus: string;
  tier: string;
}

interface Product {
  id: string;
  name_en: string;
  name_ar: string;
  price: number;
  currency: string;
  status: string;
  stock_quantity: number;
  category: string;
  created_at: string;
  images: string[];
}

interface Order {
  id: string;
  order_number: string;
  buyer_name: string;
  total_amount: number;
  currency: string;
  status: string;
  created_at: string;
  items_count: number;
}

interface RFQItem {
  id: string;
  product_name: string;
  buyer_name: string;
  quantity: number;
  unit: string;
  status: string;
  created_at: string;
  budget_min: number;
  budget_max: number;
  currency: string;
}

type ActiveTab = 'overview' | 'products' | 'orders' | 'rfq' | 'analytics' | 'messaging' | 'settings';

// ─── Stable date formatter ────────────────────────────────────────────────────
function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border border-amber-200',
  active: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  approved: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  completed: 'bg-blue-50 text-blue-700 border border-blue-200',
  rejected: 'bg-red-50 text-red-700 border border-red-200',
  cancelled: 'bg-gray-50 text-gray-600 border border-gray-200',
  processing: 'bg-purple-50 text-purple-700 border border-purple-200',
  shipped: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
  responded: 'bg-teal-50 text-teal-700 border border-teal-200',
  inactive: 'bg-gray-50 text-gray-500 border border-gray-200',
};

const TIER_BADGE: Record<string, string> = {
  standard: 'bg-gray-100 text-gray-700',
  verified: 'bg-blue-100 text-blue-700',
  premium: 'bg-amber-100 text-amber-700',
};

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KPICard({
  label,
  value,
  sub,
  icon,
  gradient,
  trend,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: string;
  gradient: string;
  trend?: { value: number; positive: boolean };
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center shadow-sm"
          style={{ background: gradient }}
        >
          <Icon name={icon} size={22} className="text-white" />
        </div>
        {trend && (
          <span
            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              trend.positive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
            }`}
          >
            {trend.positive ? '+' : ''}{trend.value}%
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="text-sm font-medium text-foreground mt-0.5">{label}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SupplierDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const { t, isRTL, language } = useLanguage();
  const router = useRouter();
  const supabase = createClient();

  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [stats, setStats] = useState<SupplierStats>({
    totalProducts: 0,
    activeProducts: 0,
    totalOrders: 0,
    pendingOrders: 0,
    completedOrders: 0,
    totalRevenue: 0,
    pendingRFQs: 0,
    respondedRFQs: 0,
    avgResponseRate: 0,
    trustScore: 0,
    verificationStatus: 'pending',
    tier: 'standard',
  });
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [rfqs, setRFQs] = useState<RFQItem[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [productSearch, setProductSearch] = useState('');
  const [orderFilter, setOrderFilter] = useState<string>('all');
  const [rfqFilter, setRFQFilter] = useState<string>('all');

  // ── Auth guard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [authLoading, user, router]);

  // ── Data fetch ──────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Profile
      const { data: profileData } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
      setProfile(profileData);

      // Products
      const { data: productsData } = await supabase
        .from('products')
        .select('id, name_en, name_ar, price, currency, status, stock_quantity, category, created_at, images')
        .eq('manufacturer_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);
      const prods = productsData || [];
      setProducts(prods);

      // Orders
      const { data: ordersData } = await supabase
        .from('orders')
        .select('id, order_number, total_amount, currency, status, created_at, buyer_id')
        .eq('manufacturer_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);

      // Enrich orders with buyer names
      const enrichedOrders: Order[] = await Promise.all(
        (ordersData || []).map(async (o: any) => {
          let buyerName = '—';
          if (o.buyer_id) {
            const { data: bp } = await supabase
              .from('user_profiles')
              .select('full_name, company_name')
              .eq('id', o.buyer_id)
              .maybeSingle();
            buyerName = bp?.company_name || bp?.full_name || '—';
          }
          return {
            id: o.id,
            order_number: o.order_number || o.id.slice(0, 8).toUpperCase(),
            buyer_name: buyerName,
            total_amount: o.total_amount || 0,
            currency: o.currency || 'USD',
            status: o.status || 'pending',
            created_at: o.created_at,
            items_count: 1,
          };
        })
      );
      setOrders(enrichedOrders);

      // RFQs
      const { data: rfqData } = await supabase
        .from('rfq_requests')
        .select('id, product_name, quantity, unit, status, created_at, budget_min, budget_max, currency, buyer_id')
        .eq('manufacturer_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);

      const enrichedRFQs: RFQItem[] = await Promise.all(
        (rfqData || []).map(async (r: any) => {
          let buyerName = '—';
          if (r.buyer_id) {
            const { data: bp } = await supabase
              .from('user_profiles')
              .select('full_name, company_name')
              .eq('id', r.buyer_id)
              .maybeSingle();
            buyerName = bp?.company_name || bp?.full_name || '—';
          }
          return {
            id: r.id,
            product_name: r.product_name || '—',
            buyer_name: buyerName,
            quantity: r.quantity || 0,
            unit: r.unit || 'unit',
            status: r.status || 'pending',
            created_at: r.created_at,
            budget_min: r.budget_min || 0,
            budget_max: r.budget_max || 0,
            currency: r.currency || 'USD',
          };
        })
      );
      setRFQs(enrichedRFQs);

      // Compute stats
      const activeProds = prods.filter((p: any) => p.status === 'active' || p.status === 'approved').length;
      const pendingOrds = enrichedOrders.filter(o => o.status === 'pending' || o.status === 'processing').length;
      const completedOrds = enrichedOrders.filter(o => o.status === 'completed' || o.status === 'delivered').length;
      const totalRev = enrichedOrders
        .filter(o => o.status === 'completed' || o.status === 'delivered')
        .reduce((sum, o) => sum + (o.total_amount || 0), 0);
      const pendingRFQCount = enrichedRFQs.filter(r => r.status === 'pending').length;
      const respondedRFQCount = enrichedRFQs.filter(r => r.status === 'responded' || r.status === 'accepted').length;
      const responseRate = enrichedRFQs.length > 0
        ? Math.round((respondedRFQCount / enrichedRFQs.length) * 100)
        : 0;

      setStats({
        totalProducts: prods.length,
        activeProducts: activeProds,
        totalOrders: enrichedOrders.length,
        pendingOrders: pendingOrds,
        completedOrders: completedOrds,
        totalRevenue: totalRev,
        pendingRFQs: pendingRFQCount,
        respondedRFQs: respondedRFQCount,
        avgResponseRate: responseRate,
        trustScore: profileData?.trust_score || 0,
        verificationStatus: profileData?.kyc_status || profileData?.registration_status || 'pending',
        tier: profileData?.tier || 'standard',
      });
    } catch (err) {
      console.error('Supplier dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [user, supabase]);

  useEffect(() => {
    if (user) fetchData();
  }, [user, fetchData]);

  // ── Tab definitions ─────────────────────────────────────────────────────────
  const tabs: { key: ActiveTab; label: string; labelAr: string; icon: string; gradient: string }[] = [
    { key: 'overview',   label: 'Overview',   labelAr: 'نظرة عامة',    icon: 'HomeModernIcon',              gradient: 'linear-gradient(135deg,#1a1a2e,#16213e)' },
    { key: 'products',   label: 'Products',   labelAr: 'المنتجات',     icon: 'CubeIcon',                    gradient: 'linear-gradient(135deg,#0f3460,#533483)' },
    { key: 'orders',     label: 'Orders',     labelAr: 'الطلبات',      icon: 'ShoppingBagIcon',             gradient: 'linear-gradient(135deg,#1a472a,#2d6a4f)' },
    { key: 'rfq',        label: 'RFQ Inbox',  labelAr: 'طلبات الأسعار',icon: 'ClipboardDocumentListIcon',   gradient: 'linear-gradient(135deg,#7b2d00,#c05621)' },
    { key: 'analytics',  label: 'Analytics',  labelAr: 'التحليلات',    icon: 'ChartBarIcon',                gradient: 'linear-gradient(135deg,#1e3a5f,#2563eb)' },
    { key: 'messaging',  label: 'Messaging',  labelAr: 'الرسائل',      icon: 'ChatBubbleLeftRightIcon',     gradient: 'linear-gradient(135deg,#3d1a78,#7c3aed)' },
    { key: 'settings',   label: 'Settings',   labelAr: 'الإعدادات',    icon: 'Cog6ToothIcon',               gradient: 'linear-gradient(135deg,#374151,#6b7280)' },
  ];

  const tabLabel = (tab: typeof tabs[0]) => isRTL ? tab.labelAr : tab.label;

  // ── Filtered data ───────────────────────────────────────────────────────────
  const filteredProducts = products.filter(p => {
    const name = isRTL ? (p.name_ar || p.name_en) : (p.name_en || p.name_ar);
    return name?.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.category?.toLowerCase().includes(productSearch.toLowerCase());
  });

  const filteredOrders = orderFilter === 'all'
    ? orders
    : orders.filter(o => o.status === orderFilter);

  const filteredRFQs = rfqFilter === 'all'
    ? rfqs
    : rfqs.filter(r => r.status === rfqFilter);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-2xl animate-pulse" style={{ background: 'linear-gradient(135deg,#D4AF37,#B8860B)' }} />
            <p className="text-muted-foreground text-sm">{isRTL ? 'جارٍ التحميل...' : 'Loading dashboard...'}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const companyName = profile?.company_name || user?.user_metadata?.company_name || (isRTL ? 'شركتي' : 'My Company');
  const fullName = profile?.full_name || user?.user_metadata?.full_name || (isRTL ? 'المورد' : 'Supplier');

  return (
    <div className="min-h-screen bg-background" dir={isRTL ? 'rtl' : 'ltr'}>
      <Header />

      {/* ── Hero Banner ── */}
      <div
        className="relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%)' }}
      >
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, #D4AF37 0%, transparent 50%), radial-gradient(circle at 80% 20%, #B8860B 0%, transparent 40%)' }}
        />
        <div className="relative max-w-7xl mx-auto px-4 md:px-6 py-8 md:py-10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg shrink-0"
                style={{ background: 'linear-gradient(135deg,#D4AF37,#B8860B)' }}
              >
                <Icon name="BuildingStorefrontIcon" size={28} className="text-white" />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-white">
                  {isRTL ? `لوحة تحكم المورد التجاري` : 'Commercial Supplier Dashboard'}
                </h1>
                <p className="text-white/70 text-sm mt-0.5">{companyName} · {fullName}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${TIER_BADGE[stats.tier] || TIER_BADGE.standard}`}>
                    {stats.tier === 'premium' ? (isRTL ? 'مميز' : 'Premium') :
                     stats.tier === 'verified' ? (isRTL ? 'موثّق' : 'Verified') :
                     (isRTL ? 'قياسي' : 'Standard')}
                  </span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[stats.verificationStatus] || STATUS_BADGE.pending}`}>
                    {stats.verificationStatus === 'approved' ? (isRTL ? 'معتمد' : 'Approved') :
                     stats.verificationStatus === 'pending' ? (isRTL ? 'قيد المراجعة' : 'Pending Review') :
                     stats.verificationStatus}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/my-account/add-product"
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all hover:shadow-lg"
                style={{ background: 'linear-gradient(135deg,#D4AF37,#B8860B)', color: '#1a1a2e' }}
              >
                <Icon name="PlusIcon" size={16} />
                {isRTL ? 'إضافة منتج' : 'Add Product'}
              </Link>
              <Link
                href="/rfq-board"
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-white/30 text-white hover:bg-white/10 transition-all"
              >
                <Icon name="ClipboardDocumentListIcon" size={16} />
                {isRTL ? 'لوحة طلبات الأسعار' : 'RFQ Board'}
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tab Navigation ── */}
      <div className="sticky top-14 md:top-16 z-30 bg-card border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide py-1">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all shrink-0 ${
                  activeTab === tab.key
                    ? 'text-white shadow-md'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
                style={activeTab === tab.key ? { background: tab.gradient } : {}}
              >
                <Icon name={tab.icon} size={16} />
                {tabLabel(tab)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">

        {/* ── OVERVIEW ── */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* KPI Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KPICard
                label={isRTL ? 'إجمالي المنتجات' : 'Total Products'}
                value={stats.totalProducts}
                sub={`${stats.activeProducts} ${isRTL ? 'نشط' : 'active'}`}
                icon="CubeIcon"
                gradient="linear-gradient(135deg,#0f3460,#533483)"
              />
              <KPICard
                label={isRTL ? 'إجمالي الطلبات' : 'Total Orders'}
                value={stats.totalOrders}
                sub={`${stats.pendingOrders} ${isRTL ? 'معلّق' : 'pending'}`}
                icon="ShoppingBagIcon"
                gradient="linear-gradient(135deg,#1a472a,#2d6a4f)"
              />
              <KPICard
                label={isRTL ? 'إجمالي الإيرادات' : 'Total Revenue'}
                value={`$${stats.totalRevenue.toLocaleString()}`}
                sub={`${stats.completedOrders} ${isRTL ? 'طلب مكتمل' : 'completed orders'}`}
                icon="BanknotesIcon"
                gradient="linear-gradient(135deg,#D4AF37,#B8860B)"
              />
              <KPICard
                label={isRTL ? 'معدل الاستجابة' : 'Response Rate'}
                value={`${stats.avgResponseRate}%`}
                sub={`${stats.pendingRFQs} ${isRTL ? 'طلب معلّق' : 'pending RFQs'}`}
                icon="ChartBarIcon"
                gradient="linear-gradient(135deg,#1e3a5f,#2563eb)"
              />
            </div>

            {/* Quick Actions */}
            <div className="rounded-2xl border border-border bg-card p-5">
              <h2 className="font-bold text-foreground mb-4 flex items-center gap-2">
                <Icon name="BoltIcon" size={18} className="text-primary" />
                {isRTL ? 'الإجراءات السريعة' : 'Quick Actions'}
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { href: '/my-account/add-product', icon: 'PlusCircleIcon', label: isRTL ? 'إضافة منتج' : 'Add Product', color: '#0f3460' },
                  { href: '/rfq-board', icon: 'ClipboardDocumentListIcon', label: isRTL ? 'لوحة طلبات الأسعار' : 'RFQ Board', color: '#7b2d00' },
                  { href: '/messaging', icon: 'ChatBubbleLeftRightIcon', label: isRTL ? 'الرسائل' : 'Messages', color: '#3d1a78' },
                  { href: '/invoices', icon: 'DocumentTextIcon', label: isRTL ? 'الفواتير' : 'Invoices', color: '#1a472a' },
                  { href: '/orders', icon: 'TruckIcon', label: isRTL ? 'تتبع الطلبات' : 'Track Orders', color: '#1e3a5f' },
                  { href: '/financial-accounts', icon: 'BanknotesIcon', label: isRTL ? 'الحسابات المالية' : 'Financial Accounts', color: '#D4AF37' },
                  { href: '/kyc', icon: 'ShieldCheckIcon', label: isRTL ? 'التحقق KYC' : 'KYC Verification', color: '#374151' },
                  { href: '/supplier/local-dashboard', icon: 'BuildingStorefrontIcon', label: isRTL ? 'غرفة التحكم المحلية' : 'Local Control Room', color: '#065f46' },
                  { href: '/my-account', icon: 'UserCircleIcon', label: isRTL ? 'الملف الشخصي' : 'My Profile', color: '#533483' },
                ].map(action => (
                  <Link
                    key={action.href}
                    href={action.href}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border hover:border-primary/30 hover:shadow-sm transition-all group"
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform"
                      style={{ background: action.color }}
                    >
                      <Icon name={action.icon} size={20} className="text-white" />
                    </div>
                    <span className="text-xs font-semibold text-foreground text-center leading-tight">{action.label}</span>
                  </Link>
                ))}
              </div>
            </div>

            {/* Recent Orders */}
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-foreground flex items-center gap-2">
                  <Icon name="ShoppingBagIcon" size={18} className="text-primary" />
                  {isRTL ? 'آخر الطلبات' : 'Recent Orders'}
                </h2>
                <button onClick={() => setActiveTab('orders')} className="text-xs text-primary font-semibold hover:underline">
                  {isRTL ? 'عرض الكل' : 'View All'}
                </button>
              </div>
              {orders.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  {isRTL ? 'لا توجد طلبات حتى الآن' : 'No orders yet'}
                </div>
              ) : (
                <div className="space-y-2">
                  {orders.slice(0, 5).map(order => (
                    <div key={order.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/40 hover:bg-muted/70 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                          <Icon name="ShoppingBagIcon" size={16} className="text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">#{order.order_number}</p>
                          <p className="text-xs text-muted-foreground">{order.buyer_name} · {formatDate(order.created_at)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-foreground">{order.currency} {order.total_amount.toLocaleString()}</span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[order.status] || STATUS_BADGE.pending}`}>
                          {order.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pending RFQs */}
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-foreground flex items-center gap-2">
                  <Icon name="ClipboardDocumentListIcon" size={18} className="text-primary" />
                  {isRTL ? 'طلبات الأسعار المعلّقة' : 'Pending RFQs'}
                </h2>
                <button onClick={() => setActiveTab('rfq')} className="text-xs text-primary font-semibold hover:underline">
                  {isRTL ? 'عرض الكل' : 'View All'}
                </button>
              </div>
              {rfqs.filter(r => r.status === 'pending').length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  {isRTL ? 'لا توجد طلبات أسعار معلّقة' : 'No pending RFQs'}
                </div>
              ) : (
                <div className="space-y-2">
                  {rfqs.filter(r => r.status === 'pending').slice(0, 5).map(rfq => (
                    <div key={rfq.id} className="flex items-center justify-between p-3 rounded-xl bg-amber-50/50 border border-amber-100 hover:bg-amber-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                          <Icon name="ClipboardDocumentListIcon" size={16} className="text-amber-700" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">{rfq.product_name}</p>
                          <p className="text-xs text-muted-foreground">{rfq.buyer_name} · {rfq.quantity} {rfq.unit}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {rfq.budget_max > 0 && (
                          <span className="text-xs text-muted-foreground">{rfq.currency} {rfq.budget_min}–{rfq.budget_max}</span>
                        )}
                        <Link
                          href="/rfq-management"
                          className="text-xs font-bold px-3 py-1.5 rounded-lg text-white transition-colors"
                          style={{ background: 'linear-gradient(135deg,#D4AF37,#B8860B)' }}
                        >
                          {isRTL ? 'رد' : 'Respond'}
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── PRODUCTS ── */}
        {activeTab === 'products' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="font-bold text-foreground text-lg">
                {isRTL ? `المنتجات (${products.length})` : `Products (${products.length})`}
              </h2>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Icon name="MagnifyingGlassIcon" size={16} className="absolute top-1/2 -translate-y-1/2 text-muted-foreground" style={{ [isRTL ? 'right' : 'left']: '10px' }} />
                  <input
                    type="text"
                    value={productSearch}
                    onChange={e => setProductSearch(e.target.value)}
                    placeholder={isRTL ? 'بحث في المنتجات...' : 'Search products...'}
                    className={`border border-border rounded-xl py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30 ${isRTL ? 'pr-9 pl-3' : 'pl-9 pr-3'}`}
                    style={{ width: '200px' }}
                  />
                </div>
                <Link
                  href="/my-account/add-product"
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white transition-all hover:shadow-md"
                  style={{ background: 'linear-gradient(135deg,#D4AF37,#B8860B)' }}
                >
                  <Icon name="PlusIcon" size={16} />
                  {isRTL ? 'إضافة منتج' : 'Add Product'}
                </Link>
              </div>
            </div>

            {filteredProducts.length === 0 ? (
              <div className="rounded-2xl border border-border bg-card p-12 text-center">
                <Icon name="CubeIcon" size={40} className="text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">{isRTL ? 'لا توجد منتجات' : 'No products found'}</p>
                <Link href="/my-account/add-product" className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white" style={{ background: 'linear-gradient(135deg,#D4AF37,#B8860B)' }}>
                  {isRTL ? 'أضف منتجك الأول' : 'Add Your First Product'}
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredProducts.map(product => {
                  const name = isRTL ? (product.name_ar || product.name_en) : (product.name_en || product.name_ar);
                  return (
                    <div key={product.id} className="rounded-2xl border border-border bg-card overflow-hidden hover:shadow-md transition-shadow">
                      <div className="h-36 bg-muted flex items-center justify-center">
                        {product.images?.[0] ? (
                          <img src={product.images[0]} alt={name} className="w-full h-full object-cover" />
                        ) : (
                          <Icon name="PhotoIcon" size={32} className="text-muted-foreground" />
                        )}
                      </div>
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <p className="font-semibold text-foreground text-sm leading-tight line-clamp-2">{name}</p>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${STATUS_BADGE[product.status] || STATUS_BADGE.pending}`}>
                            {product.status}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">{product.category}</p>
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-foreground">{product.currency} {product.price?.toLocaleString()}</span>
                          <span className="text-xs text-muted-foreground">{isRTL ? 'المخزون:' : 'Stock:'} {product.stock_quantity}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-3">
                          <Link href={`/product/${product.id}`} className="flex-1 text-center text-xs font-semibold py-1.5 rounded-lg border border-border hover:bg-muted transition-colors">
                            {isRTL ? 'عرض' : 'View'}
                          </Link>
                          <Link href={`/my-account/add-product?edit=${product.id}`} className="flex-1 text-center text-xs font-semibold py-1.5 rounded-lg text-white transition-colors" style={{ background: 'linear-gradient(135deg,#0f3460,#533483)' }}>
                            {isRTL ? 'تعديل' : 'Edit'}
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── ORDERS ── */}
        {activeTab === 'orders' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="font-bold text-foreground text-lg">
                {isRTL ? `الطلبات (${orders.length})` : `Orders (${orders.length})`}
              </h2>
              <div className="flex items-center gap-2 flex-wrap">
                {['all', 'pending', 'processing', 'shipped', 'completed', 'cancelled'].map(f => (
                  <button
                    key={f}
                    onClick={() => setOrderFilter(f)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                      orderFilter === f ? 'text-white shadow-sm' : 'border border-border text-muted-foreground hover:bg-muted'
                    }`}
                    style={orderFilter === f ? { background: 'linear-gradient(135deg,#1a472a,#2d6a4f)' } : {}}
                  >
                    {f === 'all' ? (isRTL ? 'الكل' : 'All') : f}
                  </button>
                ))}
              </div>
            </div>

            {filteredOrders.length === 0 ? (
              <div className="rounded-2xl border border-border bg-card p-12 text-center">
                <Icon name="ShoppingBagIcon" size={40} className="text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">{isRTL ? 'لا توجد طلبات' : 'No orders found'}</p>
              </div>
            ) : (
              <div className="rounded-2xl border border-border bg-card overflow-hidden">
                <div className="overflow-x-auto -mx-6 px-6 sm:mx-0 sm:px-0">
                  <table className="w-full text-sm min-w-[500px]">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        <th className={`px-4 py-3 font-semibold text-muted-foreground ${isRTL ? 'text-right' : 'text-left'}`}>{isRTL ? 'رقم الطلب' : 'Order #'}</th>
                        <th className={`px-4 py-3 font-semibold text-muted-foreground ${isRTL ? 'text-right' : 'text-left'}`}>{isRTL ? 'المشتري' : 'Buyer'}</th>
                        <th className={`px-4 py-3 font-semibold text-muted-foreground ${isRTL ? 'text-right' : 'text-left'}`}>{isRTL ? 'المبلغ' : 'Amount'}</th>
                        <th className={`px-4 py-3 font-semibold text-muted-foreground ${isRTL ? 'text-right' : 'text-left'}`}>{isRTL ? 'الحالة' : 'Status'}</th>
                        <th className={`px-4 py-3 font-semibold text-muted-foreground ${isRTL ? 'text-right' : 'text-left'}`}>{isRTL ? 'التاريخ' : 'Date'}</th>
                        <th className={`px-4 py-3 font-semibold text-muted-foreground ${isRTL ? 'text-right' : 'text-left'}`}>{isRTL ? 'إجراء' : 'Action'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOrders.map((order, idx) => (
                        <tr key={order.id} className={`border-b border-border last:border-0 hover:bg-muted/30 transition-colors ${idx % 2 === 0 ? '' : 'bg-muted/10'}`}>
                          <td className="px-4 py-3 font-mono text-xs font-semibold text-foreground">#{order.order_number}</td>
                          <td className="px-4 py-3 text-foreground">{order.buyer_name}</td>
                          <td className="px-4 py-3 font-bold text-foreground">{order.currency} {order.total_amount.toLocaleString()}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[order.status] || STATUS_BADGE.pending}`}>
                              {order.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(order.created_at)}</td>
                          <td className="px-4 py-3">
                            <Link href="/orders" className="text-xs font-semibold text-primary hover:underline">
                              {isRTL ? 'عرض' : 'View'}
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── RFQ INBOX ── */}
        {activeTab === 'rfq' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="font-bold text-foreground text-lg">
                {isRTL ? `صندوق طلبات الأسعار (${rfqs.length})` : `RFQ Inbox (${rfqs.length})`}
              </h2>
              <div className="flex items-center gap-2 flex-wrap">
                {['all', 'pending', 'responded', 'accepted', 'rejected'].map(f => (
                  <button
                    key={f}
                    onClick={() => setRFQFilter(f)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                      rfqFilter === f ? 'text-white shadow-sm' : 'border border-border text-muted-foreground hover:bg-muted'
                    }`}
                    style={rfqFilter === f ? { background: 'linear-gradient(135deg,#7b2d00,#c05621)' } : {}}
                  >
                    {f === 'all' ? (isRTL ? 'الكل' : 'All') : f}
                  </button>
                ))}
              </div>
            </div>

            {filteredRFQs.length === 0 ? (
              <div className="rounded-2xl border border-border bg-card p-12 text-center">
                <Icon name="ClipboardDocumentListIcon" size={40} className="text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">{isRTL ? 'لا توجد طلبات أسعار' : 'No RFQs found'}</p>
                <Link href="/rfq-board" className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white" style={{ background: 'linear-gradient(135deg,#D4AF37,#B8860B)' }}>
                  {isRTL ? 'تصفح لوحة طلبات الأسعار' : 'Browse RFQ Board'}
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredRFQs.map(rfq => (
                  <div key={rfq.id} className="rounded-2xl border border-border bg-card p-4 hover:shadow-sm transition-shadow">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
                          <Icon name="ClipboardDocumentListIcon" size={18} className="text-amber-700" />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">{rfq.product_name}</p>
                          <p className="text-sm text-muted-foreground mt-0.5">
                            {isRTL ? 'المشتري:' : 'Buyer:'} {rfq.buyer_name} ·
                            {isRTL ? ' الكمية:' : ' Qty:'} {rfq.quantity} {rfq.unit}
                          </p>
                          {rfq.budget_max > 0 && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {isRTL ? 'الميزانية:' : 'Budget:'} {rfq.currency} {rfq.budget_min.toLocaleString()} – {rfq.budget_max.toLocaleString()}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground mt-0.5">{formatDate(rfq.created_at)}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[rfq.status] || STATUS_BADGE.pending}`}>
                          {rfq.status}
                        </span>
                        {rfq.status === 'pending' && (
                          <Link
                            href="/rfq-management"
                            className="text-xs font-bold px-3 py-1.5 rounded-lg text-white transition-all hover:shadow-md"
                            style={{ background: 'linear-gradient(135deg,#D4AF37,#B8860B)' }}
                          >
                            {isRTL ? 'رد على الطلب' : 'Respond'}
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── ANALYTICS ── */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <h2 className="font-bold text-foreground text-lg">{isRTL ? 'التحليلات والأداء' : 'Analytics & Performance'}</h2>

            {/* Performance Summary */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="rounded-2xl border border-border bg-card p-5">
                <p className="text-xs text-muted-foreground mb-1">{isRTL ? 'معدل إتمام الطلبات' : 'Order Completion Rate'}</p>
                <p className="text-3xl font-bold text-foreground">
                  {stats.totalOrders > 0 ? Math.round((stats.completedOrders / stats.totalOrders) * 100) : 0}%
                </p>
                <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${stats.totalOrders > 0 ? Math.round((stats.completedOrders / stats.totalOrders) * 100) : 0}%`,
                      background: 'linear-gradient(90deg,#1a472a,#2d6a4f)',
                    }}
                  />
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-card p-5">
                <p className="text-xs text-muted-foreground mb-1">{isRTL ? 'معدل الاستجابة للطلبات' : 'RFQ Response Rate'}</p>
                <p className="text-3xl font-bold text-foreground">{stats.avgResponseRate}%</p>
                <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${stats.avgResponseRate}%`, background: 'linear-gradient(90deg,#7b2d00,#c05621)' }}
                  />
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-card p-5 col-span-2 md:col-span-1">
                <p className="text-xs text-muted-foreground mb-1">{isRTL ? 'درجة الثقة' : 'Trust Score'}</p>
                <p className="text-3xl font-bold text-foreground">{stats.trustScore}%</p>
                <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${stats.trustScore}%`, background: 'linear-gradient(90deg,#D4AF37,#B8860B)' }}
                  />
                </div>
              </div>
            </div>

            {/* Stats breakdown */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: isRTL ? 'إجمالي المنتجات' : 'Total Products', value: stats.totalProducts, icon: 'CubeIcon', color: '#0f3460' },
                { label: isRTL ? 'المنتجات النشطة' : 'Active Products', value: stats.activeProducts, icon: 'CheckCircleIcon', color: '#1a472a' },
                { label: isRTL ? 'إجمالي الطلبات' : 'Total Orders', value: stats.totalOrders, icon: 'ShoppingBagIcon', color: '#1e3a5f' },
                { label: isRTL ? 'الإيرادات المكتملة' : 'Completed Revenue', value: `$${stats.totalRevenue.toLocaleString()}`, icon: 'BanknotesIcon', color: '#D4AF37' },
                { label: isRTL ? 'طلبات معلّقة' : 'Pending Orders', value: stats.pendingOrders, icon: 'ClockIcon', color: '#7b2d00' },
                { label: isRTL ? 'طلبات مكتملة' : 'Completed Orders', value: stats.completedOrders, icon: 'CheckBadgeIcon', color: '#1a472a' },
                { label: isRTL ? 'طلبات أسعار معلّقة' : 'Pending RFQs', value: stats.pendingRFQs, icon: 'ClipboardDocumentListIcon', color: '#533483' },
                { label: isRTL ? 'طلبات أسعار مُجابة' : 'Responded RFQs', value: stats.respondedRFQs, icon: 'ChatBubbleLeftRightIcon', color: '#374151' },
              ].map((item, i) => (
                <div key={i} className="rounded-2xl border border-border bg-card p-4">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: item.color }}>
                    <Icon name={item.icon} size={18} className="text-white" />
                  </div>
                  <p className="text-xl font-bold text-foreground">{item.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.label}</p>
                </div>
              ))}
            </div>

            {/* Link to full analytics */}
            <div className="rounded-2xl border border-border bg-card p-5 flex items-center justify-between">
              <div>
                <p className="font-semibold text-foreground">{isRTL ? 'التحليلات المتقدمة' : 'Advanced Analytics'}</p>
                <p className="text-sm text-muted-foreground mt-0.5">{isRTL ? 'عرض تقارير مفصّلة وبيانات الأداء' : 'View detailed reports and performance data'}</p>
              </div>
              <Link
                href="/analytics"
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:shadow-md"
                style={{ background: 'linear-gradient(135deg,#1e3a5f,#2563eb)' }}
              >
                <Icon name="ChartBarIcon" size={16} />
                {isRTL ? 'فتح التحليلات' : 'Open Analytics'}
              </Link>
            </div>
          </div>
        )}

        {/* ── MESSAGING ── */}
        {activeTab === 'messaging' && (
          <div className="space-y-4">
            <h2 className="font-bold text-foreground text-lg">{isRTL ? 'مركز الرسائل' : 'Messaging Center'}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { href: '/messaging', icon: 'ChatBubbleLeftRightIcon', label: isRTL ? 'الرسائل المباشرة' : 'Direct Messages', desc: isRTL ? 'تواصل مع المشترين مباشرة' : 'Communicate directly with buyers', gradient: 'linear-gradient(135deg,#3d1a78,#7c3aed)' },
                { href: '/rfq-management', icon: 'ClipboardDocumentListIcon', label: isRTL ? 'إدارة طلبات الأسعار' : 'RFQ Management', desc: isRTL ? 'رد على طلبات الأسعار الواردة' : 'Respond to incoming RFQ requests', gradient: 'linear-gradient(135deg,#7b2d00,#c05621)' },
                { href: '/rfq-board', icon: 'GlobeAltIcon', label: isRTL ? 'لوحة طلبات الأسعار' : 'RFQ Board', desc: isRTL ? 'تصفح طلبات الأسعار المتاحة' : 'Browse available RFQ requests', gradient: 'linear-gradient(135deg,#1a1a2e,#16213e)' },
                { href: '/notifications', icon: 'BellIcon', label: isRTL ? 'الإشعارات' : 'Notifications', desc: isRTL ? 'إدارة جميع الإشعارات' : 'Manage all your notifications', gradient: 'linear-gradient(135deg,#1e3a5f,#2563eb)' },
              ].map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-4 p-5 rounded-2xl border border-border bg-card hover:shadow-md transition-all group"
                >
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform"
                    style={{ background: item.gradient }}
                  >
                    <Icon name={item.icon} size={24} className="text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{item.label}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">{item.desc}</p>
                  </div>
                  <Icon name={isRTL ? 'ChevronLeftIcon' : 'ChevronRightIcon'} size={18} className="text-muted-foreground ms-auto" />
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ── SETTINGS ── */}
        {activeTab === 'settings' && (
          <div className="space-y-4">
            <h2 className="font-bold text-foreground text-lg">{isRTL ? 'إعدادات الحساب' : 'Account Settings'}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { href: '/my-account/edit-profile', icon: 'UserCircleIcon', label: isRTL ? 'تعديل الملف الشخصي' : 'Edit Profile', desc: isRTL ? 'تحديث بيانات الشركة والتواصل' : 'Update company and contact details', gradient: 'linear-gradient(135deg,#1a1a2e,#16213e)' },
                { href: '/my-account/supplier-profile', icon: 'BuildingStorefrontIcon', label: isRTL ? 'ملف المورد' : 'Supplier Profile', desc: isRTL ? 'إدارة ملف المورد التجاري' : 'Manage your commercial supplier profile', gradient: 'linear-gradient(135deg,#0f3460,#533483)' },
                { href: '/kyc', icon: 'ShieldCheckIcon', label: isRTL ? 'التحقق من الهوية KYC' : 'KYC Verification', desc: isRTL ? 'رفع وثائق التحقق' : 'Upload verification documents', gradient: 'linear-gradient(135deg,#1a472a,#2d6a4f)' },
                { href: '/financial-accounts', icon: 'BanknotesIcon', label: isRTL ? 'الحسابات المالية' : 'Financial Accounts', desc: isRTL ? 'إدارة الحسابات البنكية والمدفوعات' : 'Manage bank accounts and payments', gradient: 'linear-gradient(135deg,#D4AF37,#B8860B)' },
                { href: '/account/upgrade', icon: 'StarIcon', label: isRTL ? 'ترقية الحساب' : 'Upgrade Account', desc: isRTL ? 'الترقية إلى خطة مميزة' : 'Upgrade to a premium plan', gradient: 'linear-gradient(135deg,#7b2d00,#c05621)' },
                { href: '/notifications', icon: 'BellIcon', label: isRTL ? 'إعدادات الإشعارات' : 'Notification Settings', desc: isRTL ? 'تخصيص تفضيلات الإشعارات' : 'Customize notification preferences', gradient: 'linear-gradient(135deg,#374151,#6b7280)' },
              ].map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-4 p-5 rounded-2xl border border-border bg-card hover:shadow-md transition-all group"
                >
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform"
                    style={{ background: item.gradient }}
                  >
                    <Icon name={item.icon} size={24} className="text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{item.label}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">{item.desc}</p>
                  </div>
                  <Icon name={isRTL ? 'ChevronLeftIcon' : 'ChevronRightIcon'} size={18} className="text-muted-foreground ms-auto" />
                </Link>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
