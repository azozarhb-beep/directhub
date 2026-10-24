'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { createClient } from '@/lib/supabase/client';
import { useRealtimeOrders } from '@/lib/hooks/useRealtimeOrders';
import Header from '@/components/Header';
import * as HeroIcons from '@heroicons/react/24/outline';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import SupplierAdminMessaging from './SupplierAdminMessaging';
import SupplierFinancialHubWrapper from './SupplierFinancialHubWrapper';
import SupplierEscrowOrdersWrapper from './SupplierEscrowOrdersWrapper';
import SupplierBankAccountsWrapper from './SupplierBankAccountsWrapper';
import SupplierDisputesWrapper from './SupplierDisputesWrapper';
import SupplierArchiveWrapper from './SupplierArchiveWrapper';

// ─── Local safe icon wrapper (never renders a "?" fallback) ───────────────────
const ICON_MAP: Record<string, string> = {
  LayoutDashboard: 'Squares2X2Icon',
  Package: 'CubeIcon',
  ShoppingCart: 'ShoppingCartIcon',
  Boxes: 'ArchiveBoxIcon',
  Store: 'BuildingStorefrontIcon',
  FileText: 'DocumentTextIcon',
  Wallet: 'WalletIcon',
  ShieldCheck: 'ShieldCheckIcon',
  Building2: 'BuildingOffice2Icon',
  Flag: 'FlagIcon',
  FolderOpen: 'FolderOpenIcon',
  MessageSquare: 'ChatBubbleLeftRightIcon',
  Settings: 'Cog6ToothIcon',
  Banknote: 'BanknotesIcon',
  Users: 'UsersIcon',
  TrendingUp: 'ArrowTrendingUpIcon',
  Plus: 'PlusIcon',
  Receipt: 'ReceiptPercentIcon',
  Tag: 'TagIcon',
  CreditCard: 'CreditCardIcon',
  ArrowLeft: 'ArrowLeftIcon',
  ShoppingBag: 'ShoppingBagIcon',
  Star: 'StarIcon',
  Clock: 'ClockIcon',
  CheckCircle: 'CheckCircleIcon',
  Timer: 'ClockIcon',
  ExternalLink: 'ArrowTopRightOnSquareIcon',
  Info: 'InformationCircleIcon',
  BadgeCheck: 'CheckBadgeIcon',
};

function Icon({ name, size = 20, className = '' }: { name: string; size?: number; className?: string }) {
  const key = (ICON_MAP[name] || name) as keyof typeof HeroIcons;
  const Cmp = HeroIcons[key] as React.ComponentType<any> | undefined;
  if (!Cmp) return null;
  return <Cmp titleId="" aria-hidden width={size} height={size} className={className} />;
}

// ─── Room Identity ─────────────────────────────────────────────────────────────
const ROOM_ID = 'local-supplier-control-room';
const ROOM_LABEL_AR = 'غرفة تحكم المورد المحلي والتجاري';
const ROOM_LABEL_EN = 'Local & Commercial Supplier Control Room';
const ROOM_MARKET = 'السوق اليمني المحلي — Yemen Domestic Market';

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
  trustScore: number;
  verificationStatus: string;
  tier: string;
  localBuyersServed: number;
  wholesaleOrders: number;
  retailOrders: number;
}

interface LocalOrder {
  id: string;
  order_number: string;
  buyer_name: string;
  total_amount: number;
  currency: string;
  status: string;
  order_type: 'wholesale' | 'retail';
  city: string;
  created_at: string;
}

interface LocalProduct {
  id: string;
  name_ar: string;
  name_en: string;
  price: number;
  currency: string;
  status: string;
  stock_quantity: number;
  category: string;
  sales_type: 'wholesale' | 'retail' | 'both';
}

type ActiveTab = 'overview' | 'products' | 'orders' | 'rfq' | 'wholesale' | 'retail' | 'settings' | 'messaging' | 'financial_hub' | 'escrow_orders' | 'bank_accounts' | 'disputes' | 'archive';

const SUPPORTED_UNITS = ['بالة', 'درزن', 'كرتون', 'قطعة', 'طن', 'كجم'];
const SUPPORTED_CATEGORIES = ['ملابس', 'أقمشة', 'منتجات استهلاكية', 'تغليف', 'مواد خام'];
const ARABIC_MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

interface SupplierCredentials {
  commercialRegister: string;
  tradeName: string;
  taxNumber: string;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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
};

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KPICard({ label, value, sub, icon, color }: { label: string; value: string | number; sub?: string; icon: string; color: string }) {
  return (
    <div className={`bg-white rounded-xl border border-gray-100 p-4 shadow-sm`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-500 mb-1">{label}</p>
          <p className={`text-2xl font-bold ${color}`}>{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
        </div>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color.replace('text-', 'bg-').replace('-700', '-50').replace('-600', '-50')}`}>
          <Icon name={icon} size={20} className={color} />
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function LocalSupplierControlRoom() {
  const { user, profile } = useAuth();
  const { dir } = useLanguage();
  const router = useRouter();
  const supabase = createClient();

  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [stats, setStats] = useState<SupplierStats>({
    totalProducts: 0, activeProducts: 0, totalOrders: 0, pendingOrders: 0,
    completedOrders: 0, totalRevenue: 0, pendingRFQs: 0, respondedRFQs: 0,
    trustScore: 0, verificationStatus: 'pending', tier: 'standard',
    localBuyersServed: 0, wholesaleOrders: 0, retailOrders: 0,
  });
  const [orders, setOrders] = useState<LocalOrder[]>([]);
  const [products, setProducts] = useState<LocalProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState<{ company_name?: string; city?: string; full_name?: string } | null>(null);
  const [credentials, setCredentials] = useState<SupplierCredentials>({ commercialRegister: '', tradeName: '', taxNumber: '' });

  // ─── Role Guard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) {
      router.replace('/login');
      return;
    }
    const role = profile?.role || profile?.account_type || '';
    const sellerCat = profile?.seller_category || '';
    const allowedRoles = ['manufacturer', 'supplier', 'seller', 'vendor', 'local_supplier', 'factory'];
    const isAllowed = allowedRoles.some(r => role.toLowerCase().includes(r)) ||
      sellerCat === 'local_supplier' || sellerCat === 'local_factory';
    if (profile && !isAllowed && role !== 'admin') {
      router.replace('/my-account');
    }
  }, [user, profile, router]);

  // ─── Load Data ───────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [profileRes, productsRes, ordersRes, regRes] = await Promise.all([
        supabase.from('user_profiles').select('company_name, city, full_name, trust_score, verification_status, account_tier').eq('id', user.id).single(),
        supabase.from('products').select('id, name, name_ar, price, currency, status, stock_quantity, category').eq('manufacturer_id', user.id).limit(20),
        supabase.from('orders').select('id, order_number, status, total, currency, created_at, shipping_address, order_category, factory_user_id, user_profiles!orders_user_id_fkey(full_name, company_name)').eq('factory_user_id', user.id).order('created_at', { ascending: false }).limit(200),
        supabase.from('factory_registrations').select('company_name, commercial_registration_number, tax_id').eq('user_id', user.id).limit(1).maybeSingle(),
      ]);

      if (profileRes.data) {
        setProfileData(profileRes.data);
        setStats(prev => ({
          ...prev,
          trustScore: profileRes.data.trust_score || 0,
          verificationStatus: profileRes.data.verification_status || 'pending',
          tier: profileRes.data.account_tier || 'standard',
        }));
      }

      const prods = productsRes.data || [];
      const ords = ordersRes.data || [];

      setProducts(prods.map((p: any) => ({
        id: p.id, name_ar: p.name_ar || p.name, name_en: p.name,
        price: p.price, currency: p.currency || 'YER', status: p.status,
        stock_quantity: p.stock_quantity || 0, category: p.category,
        sales_type: 'both' as const,
      })));

      const mappedOrders: LocalOrder[] = ords.map((o: any) => ({
        id: o.id, order_number: o.order_number || o.id.slice(0, 8),
        buyer_name: o.user_profiles?.company_name || o.user_profiles?.full_name || 'مشتري محلي', total_amount: o.total || 0,
        currency: o.currency || 'YER', status: o.status,
        order_type: (o.order_category === 'wholesale' || o.order_category === 'bulk_wholesale') ? 'wholesale' : 'retail',
        city: 'صنعاء', created_at: o.created_at,
      }));
      setOrders(mappedOrders);

      const completed = ords.filter((o: any) => o.status === 'completed' || o.status === 'delivered').length;
      const pending = ords.filter((o: any) => o.status === 'pending' || o.status === 'processing').length;
      const revenue = ords.filter((o: any) => o.status === 'completed' || o.status === 'delivered').reduce((sum: number, o: any) => sum + (o.total || 0), 0);

      setStats(prev => ({
        ...prev,
        totalProducts: prods.length,
        activeProducts: prods.filter((p: any) => p.status === 'active' || p.status === 'approved').length,
        totalOrders: ords.length,
        pendingOrders: pending,
        completedOrders: completed,
        totalRevenue: revenue,
        wholesaleOrders: mappedOrders.filter(o => o.order_type === 'wholesale').length,
        retailOrders: mappedOrders.filter(o => o.order_type === 'retail').length,
        localBuyersServed: new Set(ords.map((o: any) => o.buyer_id)).size,
      }));

      if (regRes?.data) {
        setCredentials({
          commercialRegister: regRes.data.commercial_registration_number || '',
          tradeName: regRes.data.company_name || '',
          taxNumber: regRes.data.tax_id || '',
        });
      }
    } catch (err) {
      console.error('LocalSupplierControlRoom load error:', err);
    } finally {
      setLoading(false);
    }
  }, [user, supabase]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Real-time order sync ─────────────────────────────────────────────────
  useRealtimeOrders({
    channelName: 'local-supplier-orders-rt',
    filterColumn: 'factory_user_id',
    userId: user?.id,
    onOrderChange: loadData,
    enabled: !!user,
  });

  // Real sales chart data built from actual orders (last 6 months)
  const salesChartData = React.useMemo(() => {
    const now = new Date();
    const buckets: { key: string; month: string; wholesale: number; retail: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({ key: `${d.getFullYear()}-${d.getMonth()}`, month: ARABIC_MONTHS[d.getMonth()], wholesale: 0, retail: 0 });
    }
    orders.forEach(o => {
      if (o.status === 'cancelled' || o.status === 'rejected') return;
      const d = new Date(o.created_at);
      if (isNaN(d.getTime())) return;
      const b = buckets.find(x => x.key === `${d.getFullYear()}-${d.getMonth()}`);
      if (!b) return;
      if (o.order_type === 'wholesale') b.wholesale += o.total_amount || 0;
      else b.retail += o.total_amount || 0;
    });
    return buckets;
  }, [orders]);

  const wholesaleTotal = salesChartData.reduce((s, b) => s + b.wholesale, 0);
  const retailTotal = salesChartData.reduce((s, b) => s + b.retail, 0);
  const hasSales = wholesaleTotal + retailTotal > 0;
  const isVerified = stats.verificationStatus === 'verified' || stats.verificationStatus === 'approved';

  const TABS: { id: ActiveTab; label: string; icon: string }[] = [
    { id: 'overview', label: 'نظرة عامة', icon: 'LayoutDashboard' },
    { id: 'products', label: 'المنتجات', icon: 'Package' },
    { id: 'orders', label: 'الطلبات المحلية', icon: 'ShoppingCart' },
    { id: 'wholesale', label: 'البيع بالجملة', icon: 'Boxes' },
    { id: 'retail', label: 'البيع بالتجزئة', icon: 'Store' },
    { id: 'rfq', label: 'طلبات الأسعار', icon: 'FileText' },
    { id: 'financial_hub', label: 'المركز المالي', icon: 'Wallet' },
    { id: 'escrow_orders', label: 'طلبات الضمان', icon: 'ShieldCheck' },
    { id: 'bank_accounts', label: 'الحسابات البنكية', icon: 'Building2' },
    { id: 'disputes', label: 'النزاعات', icon: 'Flag' },
    { id: 'archive', label: 'الأرشيف', icon: 'FolderOpen' },
    { id: 'messaging', label: 'التواصل مع الإدارة', icon: 'MessageSquare' },
    { id: 'settings', label: 'الإعدادات', icon: 'Settings' },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-500 text-sm">جارٍ تحميل غرفة التحكم...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50" dir={dir}>
      <Header />

      {/* ── Room Identity Banner ── */}
      <div className="bg-gradient-to-l from-emerald-700 to-emerald-900 text-white px-4 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Icon name="Store" size={22} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight">{ROOM_LABEL_AR}</h1>
              <p className="text-emerald-200 text-xs">{ROOM_MARKET}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="bg-white/20 text-white text-xs px-3 py-1 rounded-full border border-white/30">
              🇾🇪 اليمن فقط
            </span>
            <span className="bg-white/20 text-white text-xs px-3 py-1 rounded-full border border-white/30">
              {profileData?.company_name || profileData?.full_name || 'المورد'}
            </span>
            <span className={`text-xs px-3 py-1 rounded-full font-medium ${
              stats.verificationStatus === 'verified' ? 'bg-blue-400/30 text-blue-100' : 'bg-amber-400/30 text-amber-100'
            }`}>
              {stats.verificationStatus === 'verified' ? '✓ موثّق' : '⏳ قيد التحقق'}
            </span>
          </div>
        </div>
      </div>

      {/* ── Verification Banner ── */}
      {isVerified && (
        <div className="bg-blue-50 border-b border-blue-200 px-4 py-3">
          <div className="max-w-7xl mx-auto flex items-center gap-2 text-blue-800 text-sm font-medium">
            <Icon name="BadgeCheck" size={18} className="text-blue-600 flex-shrink-0" />
            <span>حساب المورد موثق بالكامل بنسبة 100% (السجل التجاري والاسم التجاري المعتمد)</span>
          </div>
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto py-2 scrollbar-hide">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                  activeTab === tab.id
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Icon name={tab.icon} size={15} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">

        {/* ── OVERVIEW TAB ── */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KPICard label="إجمالي المنتجات" value={stats.totalProducts} sub={`${stats.activeProducts} نشط`} icon="Package" color="text-emerald-700" />
              <KPICard label="الطلبات المحلية" value={stats.totalOrders} sub={`${stats.pendingOrders} معلّق`} icon="ShoppingCart" color="text-blue-700" />
              <KPICard label="الإيرادات (YER)" value={stats.totalRevenue.toLocaleString()} sub="ريال يمني" icon="Banknote" color="text-amber-700" />
              <KPICard label="المشترون المحليون" value={stats.localBuyersServed} sub="عميل نشط" icon="Users" color="text-purple-700" />
            </div>

            {/* B2B vs B2C split */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                    <Icon name="Boxes" size={16} className="text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800 text-sm">البيع بالجملة (Wholesale)</h3>
                    <p className="text-xs text-gray-500">طلبات الشركات والتجار</p>
                  </div>
                </div>
                <div className="flex items-end gap-4">
                  <div>
                    <p className="text-3xl font-bold text-blue-700">{stats.wholesaleOrders}</p>
                    <p className="text-xs text-gray-500">طلب جملة</p>
                  </div>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full"
                      style={{ width: `${stats.totalOrders ? (stats.wholesaleOrders / stats.totalOrders) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-blue-600">
                    {stats.totalOrders ? Math.round((stats.wholesaleOrders / stats.totalOrders) * 100) : 0}%
                  </span>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
                    <Icon name="Store" size={16} className="text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800 text-sm">البيع بالتجزئة (Retail)</h3>
                    <p className="text-xs text-gray-500">طلبات الأفراد والمستهلكين</p>
                  </div>
                </div>
                <div className="flex items-end gap-4">
                  <div>
                    <p className="text-3xl font-bold text-emerald-700">{stats.retailOrders}</p>
                    <p className="text-xs text-gray-500">طلب تجزئة</p>
                  </div>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${stats.totalOrders ? (stats.retailOrders / stats.totalOrders) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-emerald-600">
                    {stats.totalOrders ? Math.round((stats.retailOrders / stats.totalOrders) * 100) : 0}%
                  </span>
                </div>
              </div>
            </div>

            {/* Monthly Sales Chart */}
            <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
              <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Icon name="TrendingUp" size={16} className="text-emerald-600" />
                المبيعات الشهرية — السوق المحلي (YER)
              </h3>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-blue-50 rounded-lg p-3">
                  <p className="text-xs text-blue-700">البيع بالجملة</p>
                  <p className="text-base font-bold text-blue-800">{wholesaleTotal.toLocaleString('en-US')} YER</p>
                </div>
                <div className="bg-emerald-50 rounded-lg p-3">
                  <p className="text-xs text-emerald-700">البيع بالتجزئة</p>
                  <p className="text-base font-bold text-emerald-800">{retailTotal.toLocaleString('en-US')} YER</p>
                </div>
              </div>
              {hasSales ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={salesChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => `${v.toLocaleString('en-US')} YER`} />
                    <Bar dataKey="wholesale" name="جملة" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="retail" name="تجزئة" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[160px] flex flex-col items-center justify-center text-center border border-dashed border-gray-200 rounded-lg">
                  <p className="text-2xl font-bold text-gray-400">0 YER</p>
                  <p className="text-xs text-gray-400 mt-1">لا توجد مبيعات بعد — ستظهر البيانات عند اكتمال أول طلب</p>
                </div>
              )}
            </div>

            {/* Supported units & categories */}
            <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm space-y-3">
              <div>
                <h3 className="font-semibold text-gray-800 text-sm mb-2">وحدات البيع المدعومة</h3>
                <div className="flex flex-wrap gap-2">
                  {SUPPORTED_UNITS.map(u => (
                    <span key={u} className="text-xs px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">{u}</span>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-gray-800 text-sm mb-2">الفئات التجارية</h3>
                <div className="flex flex-wrap gap-2">
                  {SUPPORTED_CATEGORIES.map(c => (
                    <span key={c} className="text-xs px-3 py-1 rounded-full bg-gray-50 text-gray-700 border border-gray-200">{c}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
              <h3 className="font-semibold text-gray-800 mb-4">إجراءات سريعة</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'إضافة منتج', icon: 'Plus', href: '/my-account/add-product', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
                  { label: 'طلبات الأسعار', icon: 'FileText', href: '/rfq-management', color: 'bg-blue-50 text-blue-700 border-blue-200' },
                  { label: 'الرسائل', icon: 'MessageSquare', href: '/messaging', color: 'bg-purple-50 text-purple-700 border-purple-200' },
                  { label: 'الفواتير', icon: 'Receipt', href: '/invoices', color: 'bg-amber-50 text-amber-700 border-amber-200' },
                ].map(action => (
                  <Link key={action.label} href={action.href}
                    className={`flex items-center gap-2 px-4 py-3 rounded-lg border text-sm font-medium transition-all hover:shadow-sm ${action.color}`}>
                    <Icon name={action.icon} size={16} />
                    {action.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── PRODUCTS TAB ── */}
        {activeTab === 'products' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-800">منتجاتي في السوق المحلي</h2>
              <Link href="/my-account/add-product" className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors">
                <Icon name="Plus" size={15} />
                إضافة منتج
              </Link>
            </div>
            {products.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
                <Icon name="Package" size={40} className="text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">لا توجد منتجات بعد</p>
                <Link href="/my-account/add-product" className="mt-3 inline-block text-emerald-600 text-sm font-medium hover:underline">
                  أضف منتجك الأول
                </Link>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-right px-4 py-3 text-gray-600 font-medium">المنتج</th>
                      <th className="text-right px-4 py-3 text-gray-600 font-medium">السعر (YER)</th>
                      <th className="text-right px-4 py-3 text-gray-600 font-medium">المخزون</th>
                      <th className="text-right px-4 py-3 text-gray-600 font-medium">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {products.map(p => (
                      <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-800">{p.name_ar || p.name_en}</p>
                          <p className="text-xs text-gray-400">{p.category}</p>
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-700">{p.price?.toLocaleString()} {p.currency}</td>
                        <td className="px-4 py-3 text-gray-600">{p.stock_quantity}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-1 rounded-full ${STATUS_BADGE[p.status] || STATUS_BADGE.pending}`}>
                            {p.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── ORDERS TAB ── */}
        {activeTab === 'orders' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-800">الطلبات المحلية</h2>
              <div className="flex gap-2">
                <span className="bg-amber-50 text-amber-700 border border-amber-200 text-xs px-3 py-1 rounded-full">
                  {stats.pendingOrders} معلّق
                </span>
                <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs px-3 py-1 rounded-full">
                  {stats.completedOrders} مكتمل
                </span>
              </div>
            </div>
            {orders.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
                <Icon name="ShoppingCart" size={40} className="text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">لا توجد طلبات بعد</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-right px-4 py-3 text-gray-600 font-medium">رقم الطلب</th>
                      <th className="text-right px-4 py-3 text-gray-600 font-medium">المشتري</th>
                      <th className="text-right px-4 py-3 text-gray-600 font-medium">النوع</th>
                      <th className="text-right px-4 py-3 text-gray-600 font-medium">المبلغ</th>
                      <th className="text-right px-4 py-3 text-gray-600 font-medium">الحالة</th>
                      <th className="text-right px-4 py-3 text-gray-600 font-medium">التاريخ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {orders.map(o => (
                      <tr key={o.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-gray-600">{o.order_number}</td>
                        <td className="px-4 py-3 text-gray-700">{o.buyer_name}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-1 rounded-full ${o.order_type === 'wholesale' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                            {o.order_type === 'wholesale' ? 'جملة' : 'تجزئة'}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-700">{o.total_amount?.toLocaleString()} {o.currency}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-1 rounded-full ${STATUS_BADGE[o.status] || STATUS_BADGE.pending}`}>
                            {o.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(o.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── WHOLESALE TAB ── */}
        {activeTab === 'wholesale' && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <Icon name="Boxes" size={20} className="text-blue-700" />
                <h2 className="text-lg font-bold text-blue-800">إدارة البيع بالجملة</h2>
              </div>
              <p className="text-blue-700 text-sm">إدارة طلبات الجملة من الشركات والتجار داخل السوق اليمني المحلي</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { label: 'الحد الأدنى للطلب', value: 'قابل للتخصيص', icon: 'Package', color: 'text-blue-700' },
                { label: 'وحدات الجملة', value: 'بالة / درزن / كرتون', icon: 'Boxes', color: 'text-emerald-700' },
                { label: 'شروط الدفع', value: 'ضمان مالي / تحويل بنكي', icon: 'CreditCard', color: 'text-amber-700' },
              ].map(item => (
                <div key={item.label} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon name={item.icon} size={16} className={item.color} />
                    <p className="text-xs text-gray-500">{item.label}</p>
                  </div>
                  <p className={`text-xl font-bold ${item.color}`}>{item.value}</p>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
              <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <Icon name="FileText" size={16} className="text-blue-600" />
                طلبات عروض الأسعار (RFQ) — الجملة
              </h3>
              <p className="text-gray-500 text-sm mb-4">استقبل وأدر طلبات الأسعار من تجار الجملة في السوق المحلي</p>
              <Link href="/rfq-management" className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                <Icon name="ArrowLeft" size={15} />
                إدارة طلبات الأسعار
              </Link>
            </div>
          </div>
        )}

        {/* ── RETAIL TAB ── */}
        {activeTab === 'retail' && (
          <div className="space-y-4">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <Icon name="Store" size={20} className="text-emerald-700" />
                <h2 className="text-lg font-bold text-emerald-800">إدارة البيع بالتجزئة</h2>
              </div>
              <p className="text-emerald-700 text-sm">إدارة مبيعات التجزئة للمستهلكين الأفراد داخل اليمن</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { label: 'طلبات التجزئة', value: String(stats.retailOrders), icon: 'ShoppingBag', color: 'text-emerald-700' },
                { label: 'مبيعات التجزئة (YER)', value: retailTotal.toLocaleString('en-US'), icon: 'TrendingUp', color: 'text-blue-700' },
                { label: 'وحدات التجزئة', value: 'قطعة / كجم', icon: 'Package', color: 'text-amber-700' },
              ].map(item => (
                <div key={item.label} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon name={item.icon} size={16} className={item.color} />
                    <p className="text-xs text-gray-500">{item.label}</p>
                  </div>
                  <p className={`text-xl font-bold ${item.color}`}>{item.value}</p>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
              <h3 className="font-semibold text-gray-800 mb-3">واجهة المتجر الإلكتروني</h3>
              <p className="text-gray-500 text-sm mb-4">عرض منتجاتك للمستهلكين الأفراد عبر واجهة المتجر</p>
              <Link href="/seller/products" className="inline-flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors">
                <Icon name="Store" size={15} />
                إدارة المتجر
              </Link>
            </div>
          </div>
        )}

        {/* ── RFQ TAB ── */}
        {activeTab === 'rfq' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-800">طلبات عروض الأسعار المحلية</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KPICard label="طلبات معلّقة" value={stats.pendingRFQs} icon="Clock" color="text-amber-700" />
              <KPICard label="تم الرد عليها" value={stats.respondedRFQs} icon="CheckCircle" color="text-emerald-700" />
              <KPICard label="معدل الاستجابة" value={`${stats.totalOrders ? Math.round((stats.respondedRFQs / (stats.pendingRFQs + stats.respondedRFQs || 1)) * 100) : 0}%`} icon="TrendingUp" color="text-blue-700" />
              <KPICard label="إجمالي الطلبات" value={stats.pendingRFQs + stats.respondedRFQs} icon="FileText" color="text-purple-700" />
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm text-center py-12">
              <Icon name="FileText" size={40} className="text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 mb-4">إدارة طلبات الأسعار من لوحة RFQ المركزية</p>
              <Link href="/rfq-management" className="inline-flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                <Icon name="ExternalLink" size={15} />
                فتح لوحة RFQ
              </Link>
            </div>
          </div>
        )}

        {/* ── SETTINGS TAB ── */}
        {activeTab === 'settings' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-800">إعدادات غرفة التحكم</h2>
            <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
              <h3 className="font-semibold text-gray-800 text-sm mb-3">بيانات التوثيق</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  { label: 'السجل التجاري', value: credentials.commercialRegister },
                  { label: 'الاسم التجاري', value: credentials.tradeName || profileData?.company_name || '' },
                  { label: 'الرقم الضريبي', value: credentials.taxNumber },
                ].map(f => (
                  <div key={f.label} className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 mb-1">{f.label}</p>
                    <p className="text-sm font-medium text-gray-800">{f.value || '—'}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-gray-50">
                <div>
                  <p className="font-medium text-gray-800">معلومات الشركة</p>
                  <p className="text-xs text-gray-500">تحديث بيانات المورد والعنوان التجاري</p>
                </div>
                <Link href="/my-account/edit-profile" className="text-emerald-600 text-sm font-medium hover:underline">تعديل</Link>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-gray-50">
                <div>
                  <p className="font-medium text-gray-800">الحسابات المالية</p>
                  <p className="text-xs text-gray-500">إدارة حسابات الاستلام والدفع</p>
                </div>
                <Link href="/financial-accounts" className="text-emerald-600 text-sm font-medium hover:underline">إدارة</Link>
              </div>
              <div className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium text-gray-800">التحقق من الهوية (KYC)</p>
                  <p className="text-xs text-gray-500">رفع المستندات التجارية للتحقق</p>
                </div>
                <Link href="/kyc" className="text-emerald-600 text-sm font-medium hover:underline">التحقق</Link>
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <Icon name="Info" size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-amber-800 font-medium text-sm">غرفة تحكم مستقلة</p>
                  <p className="text-amber-700 text-xs mt-1">
                    هذه الغرفة مخصصة حصرياً للموردين والتجار المحليين في السوق اليمني.
                    معرّف الغرفة: <code className="bg-amber-100 px-1 rounded">{ROOM_ID}</code>
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── MESSAGING TAB ── */}
        {activeTab === 'messaging' && user && (
          <SupplierAdminMessaging
            userId={user.id}
            companyName={profileData?.company_name}
            fullName={profileData?.full_name}
          />
        )}

        {/* ── FINANCIAL HUB TAB ── */}
        {activeTab === 'financial_hub' && user && (
          <SupplierFinancialHubWrapper userId={user.id} />
        )}

        {/* ── ESCROW ORDERS TAB ── */}
        {activeTab === 'escrow_orders' && user && (
          <SupplierEscrowOrdersWrapper userId={user.id} />
        )}

        {/* ── BANK ACCOUNTS TAB ── */}
        {activeTab === 'bank_accounts' && user && (
          <SupplierBankAccountsWrapper userId={user.id} />
        )}

        {/* ── DISPUTES TAB ── */}
        {activeTab === 'disputes' && user && (
          <SupplierDisputesWrapper userId={user.id} />
        )}

        {/* ── ARCHIVE TAB ── */}
        {activeTab === 'archive' && user && (
          <SupplierArchiveWrapper userId={user.id} />
        )}
      </div>
    </div>
  );
}
