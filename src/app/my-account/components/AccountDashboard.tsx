'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { PinSetupCard } from '@/components/PinSecurity';
import {
  resolvePlatformRole,
  getHomeRoomForRole,
  type PlatformRole,
} from '@/lib/roomIsolation';

type TabKey = 'overview' | 'orders' | 'products' | 'settings' | 'my-orders';

// Helper to determine if user is a regular buyer (not supplier/manufacturer)
function checkIsBuyer(profile: UserProfile | null): boolean {
  if (!profile) return true; // default to buyer restrictions until profile loads
  return resolvePlatformRole({
    role: profile.role,
    account_type: profile.account_type,
  }) === 'buyer';
}

// Helper to determine user's workspace role
function getUserWorkspaceRole(profile: UserProfile | null): PlatformRole {
  if (!profile) return 'buyer';
  return resolvePlatformRole({
    role: profile.role,
    account_type: profile.account_type,
  });
}

interface UserProfile {
  id: string;
  full_name: string;
  company_name: string;
  country: string;
  city: string;
  avatar_url: string | null;
  is_verified: boolean;
  role: string;
  created_at: string;
  transaction_pin_hash?: string | null;
  transaction_pin_set_at?: string | null;
  phone?: string | null;
  account_type?: string;
  account_role?: string;
  dashboard_path?: string;
  notif_new_inquiries?: boolean;
  notif_order_updates?: boolean;
  notif_weekly_digest?: boolean;
  notif_promotions?: boolean;
}

// Country → dial code mapping
const COUNTRY_DIAL_CODES: Record<string, string> = {
  'Qatar': '+974', 'Saudi Arabia': '+966', 'United Arab Emirates': '+971',
  'Kuwait': '+965', 'Bahrain': '+973', 'Oman': '+968', 'Jordan': '+962',
  'Egypt': '+20', 'Iraq': '+964', 'Lebanon': '+961', 'Syria': '+963',
  'Yemen': '+967', 'Libya': '+218', 'Tunisia': '+216', 'Algeria': '+213',
  'Morocco': '+212', 'Sudan': '+249', 'Turkey': '+90', 'Iran': '+98',
  'Pakistan': '+92', 'India': '+91', 'China': '+86', 'United States': '+1',
  'United Kingdom': '+44', 'Germany': '+49', 'France': '+33', 'Italy': '+39',
  'Spain': '+34', 'Russia': '+7', 'Brazil': '+55', 'Australia': '+61',
  'Canada': '+1', 'Japan': '+81', 'South Korea': '+82', 'Indonesia': '+62',
  'Malaysia': '+60', 'Singapore': '+65', 'Thailand': '+66', 'Vietnam': '+84',
  'Philippines': '+63', 'Bangladesh': '+880', 'Nigeria': '+234',
  'South Africa': '+27', 'Kenya': '+254', 'Ethiopia': '+251', 'Ghana': '+233',
  'Tanzania': '+255', 'Uganda': '+256', 'Mexico': '+52', 'Argentina': '+54',
  'Colombia': '+57', 'Chile': '+56', 'Peru': '+51', 'Netherlands': '+31',
  'Belgium': '+32', 'Sweden': '+46', 'Norway': '+47', 'Denmark': '+45',
  'Finland': '+358', 'Poland': '+48', 'Ukraine': '+380', 'Romania': '+40',
  'Greece': '+30', 'Portugal': '+351', 'Czech Republic': '+420',
  'Hungary': '+36', 'Austria': '+43', 'Switzerland': '+41', 'Israel': '+972',
  'Afghanistan': '+93', 'Sri Lanka': '+94', 'Nepal': '+977', 'Myanmar': '+95',
  'Cambodia': '+855', 'New Zealand': '+64',
};

// Dynamic city lists per country
const COUNTRY_CITIES: Record<string, string[]> = {
  'Yemen': ['صنعاء', 'عدن', 'تعز', 'الحديدة', 'إب', 'ذمار', 'حضرموت', 'المكلا', 'سيئون', 'صعدة', 'عمران', 'البيضاء', 'مأرب', 'شبوة', 'أبين', 'لحج', 'الضالع', 'ريمة', 'المهرة', 'حجة'],
  'Saudi Arabia': ['الرياض', 'جدة', 'مكة المكرمة', 'المدينة المنورة', 'الدمام', 'الخبر', 'الطائف', 'تبوك', 'بريدة', 'خميس مشيط', 'أبها', 'نجران', 'جيزان', 'حائل', 'الجبيل', 'ينبع', 'الأحساء', 'القطيف', 'عرعر', 'سكاكا'],
  'Iraq': ['بغداد', 'البصرة', 'الموصل', 'أربيل', 'كركوك', 'النجف', 'كربلاء', 'الحلة', 'الناصرية', 'العمارة', 'الكوت', 'الرمادي', 'تكريت', 'الفلوجة', 'السليمانية', 'دهوك', 'سامراء', 'بعقوبة', 'الديوانية', 'الكوفة'],
  'Egypt': ['القاهرة', 'الإسكندرية', 'الجيزة', 'شبرا الخيمة', 'بورسعيد', 'السويس', 'المنصورة', 'الإسماعيلية', 'الفيوم', 'الزقازيق', 'أسيوط', 'طنطا', 'المنيا', 'سوهاج', 'قنا', 'الأقصر', 'أسوان', 'دمياط', 'بني سويف', 'شرم الشيخ'],
};

function getDialCode(country: string): string {
  if (!country) return '';
  const trimmed = country.trim();
  if (COUNTRY_DIAL_CODES[trimmed]) return COUNTRY_DIAL_CODES[trimmed];
  const lower = trimmed.toLowerCase();
  const found = Object.entries(COUNTRY_DIAL_CODES).find(([k]) => k.toLowerCase() === lower);
  if (found) return found[1];
  const partial = Object.entries(COUNTRY_DIAL_CODES).find(([k]) => k.toLowerCase().includes(lower) || lower.includes(k.toLowerCase()));
  return partial ? partial[1] : '';
}

interface Order {
  id: string;
  order_number: string;
  status: string;
  total: number;
  created_at: string;
  items: any[];
}

interface Product {
  id: string;
  name: string;
  name_ar: string;
  unit_price: number;
  minimum_order_qty: number;
  unit: string;
  inventory_status: string;
  is_active: boolean;
  image_url: string | null;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'text-yellow-600 bg-yellow-50',
  processing: 'text-blue-600 bg-blue-50',
  shipped: 'text-purple-600 bg-purple-50',
  delivered: 'text-green-600 bg-green-50',
  cancelled: 'text-red-600 bg-red-50',
};

// Hydration-safe date formatter — uses explicit numeric parts, no locale-dependent output
function formatDateSafe(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Hydration-safe month+year formatter (e.g. "Jan 2024")
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function formatMonthYear(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

// Hydration-safe number formatter — avoids toLocaleString locale differences
function formatNumber(n: number): string {
  const parts = Math.floor(n).toString().split('');
  const result: string[] = [];
  parts.reverse().forEach((ch, i) => {
    if (i > 0 && i % 3 === 0) result.push(',');
    result.push(ch);
  });
  return result.reverse().join('');
}

/* ─── Workspace Banner ─── */
const WorkspaceBanner: React.FC<{ profile: UserProfile | null; router: ReturnType<typeof useRouter> }> = ({ profile, router }) => {
  const workspaceRole = getUserWorkspaceRole(profile);
  if (workspaceRole === 'buyer' || workspaceRole === 'unknown') return null;

  const accountRole = (profile?.account_role || '').toLowerCase().trim();

  // Determine title, description, and destination based on account_role
  let title = '';
  let description = '';
  let destination = profile?.dashboard_path || getHomeRoomForRole(workspaceRole);

  if (accountRole === 'commercial_supplier') {
    title = 'غرفة تحكم المورّد التجاري';
    description = 'إدارة منتجاتك ومخزونك وطلبات الجملة والتجزئة';
    destination = '/supplier/local-dashboard';
  } else if (accountRole === 'local_manufacturer') {
    title = 'غرفة تحكم المصنع المحلي';
    description = 'إدارة خطوط الإنتاج والقدرة التشغيلية والمنتجات';
    destination = '/factory/local-dashboard';
  } else if (accountRole === 'international_manufacturer') {
    title = 'غرفة تحكم المصنع الدولي';
    description = 'إدارة منتجاتك وعروضك للأسواق الدولية';
    destination = '/manufacturer/international-dashboard';
  } else if (accountRole === 'logistics_partner') {
    title = 'غرفة تحكم المندوب اللوجستي';
    description = 'إدارة الشحنات والتوصيلات وتتبع الطلبات';
    destination = '/logistics/dashboard';
  } else if (accountRole === 'field_agent') {
    title = 'غرفة تحكم المندوب الميداني';
    description = 'إدارة مهامك الميدانية وتسجيل المصانع والعمولات';
    destination = '/agent/dashboard';
  } else if (workspaceRole === 'manufacturer') {
    title = 'مساحة عمل المصنّع';
    description = 'إدارة منتجاتك وطلباتك وملف المصنع';
    destination = getHomeRoomForRole(workspaceRole);
  } else if (workspaceRole === 'logistics') {
    title = 'غرفة تحكم اللوجستيات';
    description = 'إدارة الشحنات والتوصيلات';
    destination = '/logistics/dashboard';
  } else if (workspaceRole === 'agent') {
    title = 'غرفة تحكم المندوب الميداني';
    description = 'إدارة مهامك الميدانية والعمولات';
    destination = '/agent/dashboard';
  } else {
    title = 'مساحة العمل';
    description = 'الوصول إلى لوحة التحكم الخاصة بك';
    destination = getHomeRoomForRole(workspaceRole);
  }

  return (
    <div className="bg-gradient-to-r from-primary/10 to-orange-50 border border-primary/20 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-4">
      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
        <Icon name="BuildingOffice2Icon" size={24} className="text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-extrabold text-foreground mb-0.5">
          {title}
        </p>
        <p className="text-xs text-muted-foreground">
          {description}
        </p>
      </div>
      <button
        onClick={() => router.push(destination)}
        className="px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-xl hover:opacity-90 transition-opacity shrink-0"
      >
        الذهاب إلى مساحة العمل
      </button>
    </div>
  );
};

/* ─── Smart Add Product Listing Button ─── */
const AddProductListingButton: React.FC<{ user: any; label: string; sublabel: string; checkingLabel: string }> = ({ user, label, sublabel, checkingLabel }) => {
  const router = useRouter();
  const [checking, setChecking] = useState(false);

  const handleClick = async () => {
    if (checking) return;
    if (!user) { router.push('/factory/register'); return; }
    setChecking(true);
    try {
      const supabase = createClient();
      const { data } = await supabase.from('factory_registrations').select('id').eq('user_id', user.id).maybeSingle();
      router.push(data ? '/manufacturer/dashboard' : '/factory/register');
    } catch {
      router.push('/factory/register');
    } finally {
      setChecking(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={checking}
      className="flex flex-col items-center gap-3 p-4 bg-card border border-border rounded-2xl hover:shadow-md hover:border-orange-300 transition-all text-center group w-full disabled:opacity-70"
    >
      <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center group-hover:bg-orange-200 transition-colors shrink-0">
        {checking
          ? <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          : <Icon name="PlusCircleIcon" size={22} className="text-orange-600" />
        }
      </div>
      <div className="min-w-0">
        <span className="text-xs font-bold text-foreground group-hover:text-orange-600 transition-colors block leading-tight">
          {checking ? checkingLabel : label}
        </span>
        <span className="text-[11px] text-muted-foreground mt-0.5 block">{sublabel}</span>
      </div>
    </button>
  );
};

/* ─── Tracking Code Input ─── */
const TrackingCodeInput: React.FC<{ orderId: string }> = ({ orderId }) => {
  const [code, setCode] = useState('');
  const [saved, setSaved] = useState(false);
  const { t } = useLanguage();
  const ma = t.myAccount;

  const handleSave = async () => {
    if (!code.trim()) return;
    const supabase = createClient();
    const { error } = await supabase.from('orders').update({ tracking_code: code }).eq('id', orderId);
    if (error) return;
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="mt-3 flex items-center gap-2">
      <div className="flex-1 relative">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder={ma.enterProductCode}
          className="w-full text-xs px-3 py-2 pr-8 border border-border rounded-xl bg-muted/40 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-muted-foreground/60 font-mono"
          dir="ltr"
        />
        <Icon name="QrCodeIcon" size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
      </div>
      <button
        onClick={handleSave}
        className={`px-3 py-2 text-xs font-bold rounded-xl transition-all shrink-0 ${saved ? 'bg-green-500 text-white' : 'bg-primary text-primary-foreground hover:opacity-90'}`}
      >
        {saved ? ma.stDone : ma.save}
      </button>
    </div>
  );
};

/* ─── My Orders Tab ─── */
const MyOrdersTab: React.FC<{ orders: Order[]; dataLoading: boolean; orderStats: { total: number; pending: number; completed: number; totalSpent: number } }> = ({ orders, dataLoading, orderStats }) => {
  const { t, dir, isRTL, language } = useLanguage();
  const ma = t.myAccount;
  const [activeOrderTab, setActiveOrderTab] = useState<'processing' | 'ready' | 'shipped' | 'completed' | 'history'>('processing');

  // Categorize orders by status
  const processingOrders = orders.filter(o => ['pending', 'processing', 'confirmed', 'manufacturing', 'preparing'].includes(o.status));
  const readyOrders = orders.filter(o => ['ready', 'ready_for_pickup', 'ready_to_ship'].includes(o.status));
  const shippedOrders = orders.filter(o => ['shipped', 'in_transit', 'out_for_delivery'].includes(o.status));
  const completedOrders = orders.filter(o => ['delivered', 'completed'].includes(o.status));
  const allOrders = orders;

  const getStatusLabel = (status: string) => {
    const map: Record<string, string> = {
      pending: ma.waiting,
      processing: ma.stProcessing,
      confirmed: ma.stConfirmed,
      manufacturing: ma.stManufacturing,
      preparing: ma.stPreparing,
      ready: ma.ready,
      ready_for_pickup: ma.readyForPickup,
      ready_to_ship: ma.readyToShip,
      shipped: ma.shipped,
      in_transit: ma.stInTransit,
      out_for_delivery: ma.outForDelivery,
      delivered: ma.stDelivered,
      completed: ma.stCompleted,
      cancelled: ma.stCancelled,
    };
    return map[status] || status;
  };

  const getEstimatedDelivery = (order: Order) => {
    const created = new Date(order.created_at);
    const estimated = new Date(created);
    estimated.setDate(estimated.getDate() + 14);
    return formatDateSafe(estimated.toISOString());
  };

  const orderTabs = [
    { key: 'processing' as const, label: ma.stInProgress, icon: 'WrenchScrewdriverIcon', count: processingOrders.length, color: 'text-amber-600', activeBg: 'bg-amber-500', activeBorder: 'border-amber-500', badge: 'bg-amber-100 text-amber-700' },
    { key: 'ready' as const, label: ma.ready, icon: 'CheckBadgeIcon', count: readyOrders.length, color: 'text-emerald-600', activeBg: 'bg-emerald-500', activeBorder: 'border-emerald-500', badge: 'bg-emerald-100 text-emerald-700' },
    { key: 'shipped' as const, label: ma.stShipped, icon: 'TruckIcon', count: shippedOrders.length, color: 'text-blue-600', activeBg: 'bg-blue-500', activeBorder: 'border-blue-500', badge: 'bg-blue-100 text-blue-700' },
    { key: 'completed' as const, label: ma.completed, icon: 'CheckCircleIcon', count: completedOrders.length, color: 'text-green-600', activeBg: 'bg-green-500', activeBorder: 'border-green-500', badge: 'bg-green-100 text-green-700' },
    { key: 'history' as const, label: ma.fullOrderLog, icon: 'ClockIcon', count: allOrders.length, color: 'text-muted-foreground', activeBg: 'bg-foreground', activeBorder: 'border-foreground', badge: 'bg-muted text-muted-foreground' },
  ];

  if (dataLoading) {
    return (
      <div className="flex flex-col gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-card border border-border rounded-2xl p-5 animate-pulse h-28" />
        ))}
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="text-center py-20 bg-card border border-border rounded-2xl">
        <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Icon name="ClipboardDocumentListIcon" size={28} className="text-muted-foreground" />
        </div>
        <h3 className="text-base font-bold text-foreground mb-2">{ma.noOrdersYet}</h3>
        <p className="text-sm text-muted-foreground mb-4">{ma.startBrowsing}</p>
        <Link href="/search" className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground text-sm font-bold rounded-xl">
          <Icon name="MagnifyingGlassIcon" size={14} />
          {ma.browseProducts}
        </Link>
      </div>
    );
  }

  const currentTabData = orderTabs.find(t => t.key === activeOrderTab)!;

  return (
    <div className="flex flex-col gap-6" dir={dir}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-foreground">{ma.myOrders}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{orderStats.total} {ma.totalOrders || 'total orders'}</p>
        </div>
        <Link href="/orders" className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-xl hover:opacity-90 transition-opacity self-start sm:self-auto">
          <Icon name="ArrowTopRightOnSquareIcon" size={14} />
          {ma.fullOrderHistory}
        </Link>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: ma.totalOrders, value: orderStats.total, icon: 'ClipboardDocumentListIcon', color: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/20' },
          { label: ma.stInProgress, value: processingOrders.length, icon: 'WrenchScrewdriverIcon', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
          { label: ma.stShipped, value: shippedOrders.length, icon: 'TruckIcon', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
          { label: ma.stCompletedFem, value: completedOrders.length, icon: 'CheckCircleIcon', color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' },
        ].map((stat) => (
          <div key={stat.label} className={`bg-card border ${stat.border} rounded-2xl p-4 flex items-center gap-3`}>
            <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center shrink-0`}>
              <Icon name={stat.icon as Parameters<typeof Icon>[0]['name']} size={18} className={stat.color} />
            </div>
            <div>
              <p className="text-xl font-extrabold text-foreground leading-none">{stat.value}</p>
              <p className="text-[10px] text-muted-foreground font-medium mt-0.5">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Status Tabs ── */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {/* Tab bar */}
        <div className="flex overflow-x-auto border-b border-border scrollbar-hide">
          {orderTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveOrderTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-3.5 text-xs font-bold whitespace-nowrap border-b-2 transition-all shrink-0 ${
                activeOrderTab === tab.key
                  ? `${tab.activeBorder} text-foreground bg-muted/40`
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/20'
              }`}
            >
              <Icon name={tab.icon as Parameters<typeof Icon>[0]['name']} size={15} className={activeOrderTab === tab.key ? tab.color : ''} />
              {tab.label}
              {tab.count > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${activeOrderTab === tab.key ? tab.badge : 'bg-muted text-muted-foreground'}`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="p-4 md:p-5">

          {/* ── قيد التنفيذ ── */}
          {activeOrderTab === 'processing' && (
            <div className="flex flex-col gap-3">
              {processingOrders.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <Icon name="WrenchScrewdriverIcon" size={22} className="text-amber-400" />
                  </div>
                  <p className="text-sm font-bold text-foreground mb-1">{ma.noProcessing}</p>
                  <p className="text-xs text-muted-foreground">{ma.processingEmpty}</p>
                </div>
              ) : (
                processingOrders.map((order) => (
                  <div key={order.id} className="bg-amber-50/50 border border-amber-200 rounded-2xl p-4 md:p-5">
                    <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                      <div className="w-11 h-11 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                        <Icon name="WrenchScrewdriverIcon" size={19} className="text-amber-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          <p className="text-sm font-extrabold text-foreground">{ma.orderHash.replace('{num}', order.order_number)}</p>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                            {getStatusLabel(order.status)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">
                          {ma.orderDate} {formatDateSafe(order.created_at)}
                        </p>
                        {/* Progress bar */}
                        <div className="flex items-center gap-2 mb-1">
                          <div className="flex-1 h-1.5 bg-amber-100 rounded-full overflow-hidden">
                            <div className="h-full bg-amber-500 rounded-full animate-pulse" style={{ width: order.status === 'processing' ? '40%' : order.status === 'confirmed' ? '20%' : '65%' }} />
                          </div>
                          <span className="text-[10px] text-amber-600 font-bold shrink-0">
                            {order.status === 'processing' ? '40%' : order.status === 'confirmed' ? '20%' : '65%'}
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mb-1">{ma.expectedDeliveryLabel} {getEstimatedDelivery(order)}</p>
                        {/* Tracking code */}
                        <TrackingCodeInput orderId={order.id} />
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <p className="text-base font-extrabold text-foreground">${formatNumber(order.total || 0)}</p>
                        <Link href={`/orders/${order.id}`} className="px-3 py-1.5 text-xs font-bold border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors text-amber-700">
                          {ma.details}
                        </Link>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── {ma.ready} ── */}
          {activeOrderTab === 'ready' && (
            <div className="flex flex-col gap-3">
              {readyOrders.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <Icon name="CheckBadgeIcon" size={22} className="text-emerald-400" />
                  </div>
                  <p className="text-sm font-bold text-foreground mb-1">{ma.noReadyOrders}</p>
                  <p className="text-xs text-muted-foreground">{ma.readyOrdersEmpty}</p>
                </div>
              ) : (
                readyOrders.map((order) => (
                  <div key={order.id} className="bg-emerald-50/50 border border-emerald-200 rounded-2xl p-4 md:p-5">
                    <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                      <div className="w-11 h-11 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                        <Icon name="CheckBadgeIcon" size={19} className="text-emerald-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          <p className="text-sm font-extrabold text-foreground">{ma.orderHash.replace('{num}', order.order_number)}</p>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                            {getStatusLabel(order.status)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">
                          {ma.orderDate} {formatDateSafe(order.created_at)}
                        </p>
                        {/* Ready alert */}
                        <div className="flex items-center gap-2 p-2.5 bg-emerald-50 border border-emerald-100 rounded-xl mb-2">
                          <Icon name="BellAlertIcon" size={14} className="text-emerald-600 shrink-0" />
                          <p className="text-xs font-bold text-emerald-700">{ma.orderReady}</p>
                        </div>
                        {/* Tracking code */}
                        <TrackingCodeInput orderId={order.id} />
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <p className="text-base font-extrabold text-foreground">${formatNumber(order.total || 0)}</p>
                        <Link href={`/orders/${order.id}`} className="px-3 py-1.5 text-xs font-bold border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors text-emerald-700">
                          {ma.details}
                        </Link>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── مشحون ── */}
          {activeOrderTab === 'shipped' && (
            <div className="flex flex-col gap-3">
              {shippedOrders.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <Icon name="TruckIcon" size={22} className="text-blue-400" />
                  </div>
                  <p className="text-sm font-bold text-foreground mb-1">{ma.noShipments}</p>
                  <p className="text-xs text-muted-foreground">{ma.shippedEmpty}</p>
                </div>
              ) : (
                shippedOrders.map((order) => (
                  <div key={order.id} className="bg-blue-50/50 border border-blue-200 rounded-2xl p-4 md:p-5">
                    <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                      <div className="w-11 h-11 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                        <Icon name="TruckIcon" size={19} className="text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          <p className="text-sm font-extrabold text-foreground">{ma.orderHash.replace('{num}', order.order_number)}</p>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                            {getStatusLabel(order.status)}
                          </span>
                        </div>
                        {/* Delivery date */}
                        <div className="flex items-center gap-2 mb-2 p-2.5 bg-blue-50 border border-blue-100 rounded-xl">
                          <Icon name="CalendarDaysIcon" size={14} className="text-blue-600 shrink-0" />
                          <div>
                            <p className="text-[10px] text-blue-500 font-medium">{ma.expectedDelivery}</p>
                            <p className="text-xs font-extrabold text-blue-700">{getEstimatedDelivery(order)}</p>
                          </div>
                        </div>
                        {/* Shipping steps */}
                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground mb-2">
                          {[ma.shipped, ma.stInTransit, ma.stArrivedRegion, ma.delivery].map((step, idx) => {
                            const stepIndex = order.status === 'shipped' ? 0 : order.status === 'in_transit' ? 1 : order.status === 'out_for_delivery' ? 2 : 0;
                            const isActive = idx <= stepIndex;
                            return (
                              <React.Fragment key={step}>
                                <div className={`flex flex-col items-center gap-1 ${isActive ? 'text-blue-600' : 'text-muted-foreground/50'}`}>
                                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${isActive ? 'border-blue-500 bg-blue-500' : 'border-muted-foreground/30'}`}>
                                    {isActive && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                                  </div>
                                  <span className="text-[9px] font-medium text-center leading-tight w-12">{step}</span>
                                </div>
                                {idx < 3 && <div className={`flex-1 h-0.5 mb-3 ${idx < stepIndex ? 'bg-blue-400' : 'bg-muted'}`} />}
                              </React.Fragment>
                            );
                          })}
                        </div>
                        {/* Tracking code */}
                        <TrackingCodeInput orderId={order.id} />
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <p className="text-base font-extrabold text-foreground">${formatNumber(order.total || 0)}</p>
                        <Link href={`/orders/${order.id}`} className="px-3 py-1.5 text-xs font-bold border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors text-blue-700">
                          {ma.details}
                        </Link>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── {ma.completed} ── */}
          {activeOrderTab === 'completed' && (
            <div className="flex flex-col gap-3">
              {completedOrders.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <Icon name="CheckCircleIcon" size={22} className="text-green-400" />
                  </div>
                  <p className="text-sm font-bold text-foreground mb-1">{ma.noCompleted}</p>
                  <p className="text-xs text-muted-foreground">{ma.receivedEmpty}</p>
                </div>
              ) : (
                completedOrders.map((order) => (
                  <div key={order.id} className="bg-green-50/50 border border-green-200 rounded-2xl p-4 md:p-5">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                      <div className="w-11 h-11 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
                        <Icon name="CheckCircleIcon" size={19} className="text-green-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <p className="text-sm font-extrabold text-foreground">{ma.orderHash.replace('{num}', order.order_number)}</p>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                            {getStatusLabel(order.status)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {ma.receivedDate} {formatDateSafe(order.created_at)}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <p className="text-base font-extrabold text-foreground">${formatNumber(order.total || 0)}</p>
                        <Link href={`/orders/${order.id}`} className="px-3 py-1.5 text-xs font-bold border border-green-200 rounded-lg hover:bg-green-100 transition-colors text-green-700">
                          {ma.details}
                        </Link>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── {ma.fullOrderLog} ── */}
          {activeOrderTab === 'history' && (
            <div className="flex flex-col gap-3">
              {allOrders.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-12 h-12 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <Icon name="ClockIcon" size={22} className="text-muted-foreground" />
                  </div>
                  <p className="text-sm font-bold text-foreground mb-1">{ma.noOrderHistory}</p>
                  <p className="text-xs text-muted-foreground">{ma.allOrdersEmpty}</p>
                </div>
              ) : (
                <>
                  {allOrders.map((order) => (
                    <div key={order.id} className="bg-card border border-border rounded-2xl p-4 md:p-5 hover:shadow-sm transition-shadow">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                        <div className="w-11 h-11 rounded-xl bg-muted flex items-center justify-center shrink-0">
                          <Icon name="ShoppingBagIcon" size={19} className="text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <p className="text-sm font-extrabold text-foreground">{ma.orderHash.replace('{num}', order.order_number)}</p>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${STATUS_COLORS[order.status] || 'text-muted-foreground bg-muted'}`}>
                              {getStatusLabel(order.status)}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground font-mono">
                            {formatDateSafe(order.created_at)}
                          </p>
                          {/* Show tracking code for undelivered orders */}
                          {!['delivered', 'completed', 'cancelled'].includes(order.status) && (
                            <TrackingCodeInput orderId={order.id} />
                          )}
                        </div>
                        <div className="flex sm:flex-col items-center sm:items-end gap-3 shrink-0">
                          <p className="text-base font-extrabold text-foreground">${formatNumber(order.total || 0)}</p>
                          <Link href={`/orders/${order.id}`} className="px-3 py-1.5 text-xs font-bold border border-border rounded-lg hover:bg-muted transition-colors text-foreground">
                            {ma.orderDetails}
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="mt-2 text-center">
                    <Link href="/orders" className="inline-flex items-center gap-2 px-6 py-2.5 border border-border rounded-xl text-sm font-bold text-foreground hover:bg-muted transition-colors">
                      <Icon name="ArrowTopRightOnSquareIcon" size={14} />
                      {ma.viewFullOrderHistory}
                    </Link>
                  </div>
                </>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

/* ─── KYC Status Card ─── */
const KYCStatusCard: React.FC<{ userId: string }> = ({ userId }) => {
  const router = useRouter();
  const { t } = useLanguage();
  const [kycStatus, setKycStatus] = useState<'none' | 'pending' | 'under_review' | 'approved' | 'rejected'>('none');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchKYC = async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from('factory_registrations')
          .select('kyc_status')
          .eq('user_id', userId)
          .maybeSingle();
        setKycStatus(data?.kyc_status ?? 'none');
      } catch {
        setKycStatus('none');
      } finally {
        setLoading(false);
      }
    };
    fetchKYC();
  }, [userId]);

  const statusConfig = {
    none: { label: 'Not Submitted', labelAr: 'لم يُقدَّم', color: 'text-muted-foreground', bg: 'bg-muted', border: 'border-border', icon: 'IdentificationIcon', iconColor: 'text-muted-foreground', badgeBg: 'bg-muted text-muted-foreground' },
    pending: { label: 'Pending Review', labelAr: 'قيد المراجعة', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', icon: 'ClockIcon', iconColor: 'text-amber-600', badgeBg: 'bg-amber-100 text-amber-700' },
    under_review: { label: 'Under Review', labelAr: 'تحت المراجعة', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', icon: 'MagnifyingGlassIcon', iconColor: 'text-blue-600', badgeBg: 'bg-blue-100 text-blue-700' },
    approved: { label: 'Verified', labelAr: 'موثّق', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: 'ShieldCheckIcon', iconColor: 'text-emerald-600', badgeBg: 'bg-emerald-100 text-emerald-700' },
    rejected: { label: 'Action Required', labelAr: 'يتطلب إجراء', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', icon: 'ExclamationCircleIcon', iconColor: 'text-red-600', badgeBg: 'bg-red-100 text-red-700' },
  };

  const cfg = statusConfig[kycStatus];

  return (
    <div className={`bg-card border ${cfg.border} rounded-2xl p-5`}>
      <h3 className="text-sm font-extrabold text-foreground mb-4 flex items-center gap-2">
        <div className={`w-7 h-7 rounded-full ${cfg.bg} flex items-center justify-center`}>
          <Icon name="IdentificationIcon" size={14} className={cfg.iconColor} />
        </div>
        KYC Verification
      </h3>

      {loading ? (
        <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-xl animate-pulse">
          <div className="w-10 h-10 rounded-xl bg-muted shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-muted rounded w-2/3" />
            <div className="h-2.5 bg-muted rounded w-1/2" />
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className={`flex items-center gap-3 p-3 ${cfg.bg} border ${cfg.border} rounded-xl`}>
            <div className={`w-10 h-10 rounded-xl bg-card flex items-center justify-center shrink-0`}>
              <Icon name={cfg.icon as Parameters<typeof Icon>[0]['name']} size={18} className={cfg.iconColor} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-extrabold text-foreground">Identity Verification</p>
              <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full mt-0.5 ${cfg.badgeBg}`}>
                {cfg.label}
              </span>
            </div>
          </div>

          {kycStatus === 'approved' && (
            <div className="flex items-center gap-2 p-2.5 bg-emerald-50 border border-emerald-100 rounded-xl">
              <Icon name="CheckBadgeIcon" size={14} className="text-emerald-600 shrink-0" />
              <p className="text-[11px] font-bold text-emerald-700">Your business is fully verified on DirectHub</p>
            </div>
          )}

          {kycStatus === 'rejected' && (
            <div className="flex items-center gap-2 p-2.5 bg-red-50 border border-red-100 rounded-xl">
              <Icon name="ExclamationCircleIcon" size={14} className="text-red-600 shrink-0" />
              <p className="text-[11px] font-bold text-red-700">Documents need attention — please resubmit</p>
            </div>
          )}

          <button
            onClick={() => router.push('/kyc')}
            className={`w-full flex items-center justify-center gap-2 py-2.5 text-xs font-bold rounded-xl transition-all ${
              kycStatus === 'approved' ?'border border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                : kycStatus === 'rejected' ?'bg-red-600 text-white hover:bg-red-700'
                : kycStatus === 'none' ?'bg-primary text-primary-foreground hover:opacity-90' :'border border-border text-foreground hover:bg-muted'
            }`}
          >
            <Icon name={kycStatus === 'approved' ? 'EyeIcon' : kycStatus === 'none' ? 'PlusCircleIcon' : 'ArrowTopRightOnSquareIcon'} size={13} />
            {kycStatus === 'approved' ? 'View KYC Documents' : kycStatus === 'none' ? 'Start KYC Verification' : kycStatus === 'rejected' ? 'Resubmit Documents' : 'Track KYC Status'}
          </button>
        </div>
      )}
    </div>
  );
};

// ─── Live Order Status Widget ───────────────────────────────────────────────
interface LiveStatusEvent {
  orderId: string;
  orderNumber: string;
  oldStatus: string;
  newStatus: string;
  timestamp: string;
}

const LIVE_STATUS_COLORS: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  pending:    { bg: 'bg-yellow-50',  text: 'text-yellow-700',  border: 'border-yellow-200', dot: 'bg-yellow-400' },
  processing: { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200',   dot: 'bg-blue-500' },
  shipped:    { bg: 'bg-purple-50',  text: 'text-purple-700',  border: 'border-purple-200', dot: 'bg-purple-500' },
  delivered:  { bg: 'bg-green-50',   text: 'text-green-700',   border: 'border-green-200',  dot: 'bg-green-500' },
  cancelled:  { bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200',    dot: 'bg-red-500' },
};

const LIVE_STATUS_ICONS: Record<string, string> = {
  pending:    'ClockIcon',
  processing: 'WrenchScrewdriverIcon',
  shipped:    'TruckIcon',
  delivered:  'CheckCircleIcon',
  cancelled:  'XCircleIcon',
};

const LiveOrderStatusWidget: React.FC<{
  orders: Order[];
  liveEvents: LiveStatusEvent[];
  isConnected: boolean;
  language: string;
}> = ({ orders, liveEvents, isConnected, language }) => {
  const { t, isRTL } = useLanguage();
  const ma = t.myAccount;
  const isAr = language === 'ar';

  const activeOrders = orders.filter(o => !['delivered', 'cancelled'].includes(o.status));

  const getStatusLabel = (status: string) => {
    const map: Record<string, { ar: string; en: string }> = {
      pending:    { ar: 'قيد الانتظار',   en: 'Pending' },
      processing: { ar: 'قيد التنفيذ',    en: 'Processing' },
      shipped:    { ar: 'تم الشحن',       en: 'Shipped' },
      delivered:  { ar: 'تم التسليم',     en: 'Delivered' },
      cancelled:  { ar: 'ملغي',           en: 'Cancelled' },
    };
    return isAr ? (map[status]?.ar || status) : (map[status]?.en || status);
  };

  const getStatusProgress = (status: string): number => {
    const map: Record<string, number> = {
      pending: 15, processing: 40, shipped: 75, delivered: 100, cancelled: 0,
    };
    return map[status] ?? 0;
  };

  if (orders.length === 0) return null;

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-gradient-to-r from-primary/5 to-transparent">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
            <Icon name="SignalIcon" size={16} className="text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-foreground">
              {isAr ? 'حالة الطلبات المباشرة' : 'Live Order Status'}
            </h3>
            <p className="text-[10px] text-muted-foreground">
              {isAr ? 'تحديثات فورية لطلباتك' : 'Real-time updates for your orders'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isConnected ? (
            <span className="flex items-center gap-1.5 px-2.5 py-1 bg-green-50 border border-green-200 rounded-full text-[10px] font-extrabold text-green-700">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              {isAr ? 'مباشر' : 'LIVE'}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 px-2.5 py-1 bg-muted border border-border rounded-full text-[10px] font-bold text-muted-foreground">
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
              {isAr ? 'غير متصل' : 'Offline'}
            </span>
          )}
        </div>
      </div>

      {/* Live Events Feed */}
      {liveEvents.length > 0 && (
        <div className="px-5 py-3 border-b border-border bg-amber-50/60">
          <p className="text-[10px] font-extrabold text-amber-700 mb-2 flex items-center gap-1.5">
            <Icon name="BellAlertIcon" size={12} className="text-amber-600" />
            {isAr ? 'آخر التحديثات' : 'Recent Updates'}
          </p>
          <div className="flex flex-col gap-1.5">
            {liveEvents.slice(0, 3).map((ev, i) => {
              const cfg = LIVE_STATUS_COLORS[ev.newStatus] || LIVE_STATUS_COLORS.pending;
              return (
                <div key={i} className={`flex items-center gap-2 px-3 py-2 ${cfg.bg} border ${cfg.border} rounded-xl`}>
                  <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot} animate-pulse`} />
                  <p className="text-xs font-bold text-foreground flex-1 min-w-0 truncate">
                    {isAr
                      ? `طلب #${ev.orderNumber} — تحديث الحالة إلى: ${getStatusLabel(ev.newStatus)}`
                      : `Order #${ev.orderNumber} — Status updated to: ${getStatusLabel(ev.newStatus)}`
                    }
                  </p>
                  <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full shrink-0 ${cfg.bg} ${cfg.text}`}>
                    {getStatusLabel(ev.newStatus)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Active Orders List */}
      <div className="p-5">
        {activeOrders.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Icon name="CheckCircleIcon" size={22} className="text-green-500" />
            </div>
            <p className="text-sm font-bold text-foreground mb-1">
              {isAr ? 'لا توجد طلبات نشطة' : 'No Active Orders'}
            </p>
            <p className="text-xs text-muted-foreground">
              {isAr ? 'جميع طلباتك مكتملة أو لا توجد طلبات حالياً' : 'All orders completed or no orders yet'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {activeOrders.map((order) => {
              const cfg = LIVE_STATUS_COLORS[order.status] || LIVE_STATUS_COLORS.pending;
              const iconName = LIVE_STATUS_ICONS[order.status] || 'ClockIcon';
              const progress = getStatusProgress(order.status);
              const isJustUpdated = liveEvents.some(ev => ev.orderId === order.id);

              return (
                <div
                  key={order.id}
                  className={`border rounded-2xl p-4 transition-all duration-500 ${
                    isJustUpdated
                      ? `${cfg.bg} ${cfg.border} shadow-md`
                      : 'bg-card border-border'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${cfg.bg}`}>
                      <Icon name={iconName as Parameters<typeof Icon>[0]['name']} size={18} className={cfg.text} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <p className="text-sm font-extrabold text-foreground">
                          {isAr ? `طلب #${order.order_number}` : `Order #${order.order_number}`}
                        </p>
                        <span className={`flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text} border ${cfg.border}`}>
                          {isJustUpdated && <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} animate-pulse`} />}
                          {getStatusLabel(order.status)}
                        </span>
                        {isJustUpdated && (
                          <span className="text-[9px] font-extrabold px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full border border-amber-200">
                            {isAr ? '🔔 محدّث' : '🔔 Updated'}
                          </span>
                        )}
                      </div>
                      {/* Progress bar */}
                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-700 ${
                              order.status === 'delivered' ? 'bg-green-500' :
                              order.status === 'shipped'   ? 'bg-purple-500' :
                              order.status === 'processing'? 'bg-blue-500' :
                              order.status === 'cancelled' ? 'bg-red-400' : 'bg-yellow-400'
                            }`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-bold text-muted-foreground shrink-0">{progress}%</span>
                      </div>
                      {/* Milestone steps */}
                      <div className="flex items-center gap-1 mt-2.5">
                        {(['pending', 'processing', 'shipped', 'delivered'] as const).map((step, idx) => {
                          const stepProgress = getStatusProgress(step);
                          const currentProgress = getStatusProgress(order.status);
                          const isActive = currentProgress >= stepProgress && order.status !== 'cancelled';
                          const isCurrent = order.status === step;
                          const stepLabels: Record<string, { ar: string; en: string }> = {
                            pending:    { ar: 'انتظار', en: 'Pending' },
                            processing: { ar: 'تنفيذ',  en: 'Processing' },
                            shipped:    { ar: 'شحن',    en: 'Shipped' },
                            delivered:  { ar: 'تسليم',  en: 'Delivered' },
                          };
                          return (
                            <React.Fragment key={step}>
                              <div className="flex flex-col items-center gap-0.5">
                                <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center transition-all ${
                                  isActive
                                    ? isCurrent
                                      ? 'border-primary bg-primary scale-110' :'border-primary bg-primary' :'border-muted-foreground/30 bg-transparent'
                                }`}>
                                  {isActive && <div className="w-1 h-1 bg-white rounded-full" />}
                                </div>
                                <span className={`text-[8px] font-bold leading-none ${isActive ? 'text-primary' : 'text-muted-foreground/50'}`}>
                                  {isAr ? stepLabels[step].ar : stepLabels[step].en}
                                </span>
                              </div>
                              {idx < 3 && (
                                <div className={`flex-1 h-0.5 mb-3 transition-all ${
                                  getStatusProgress(order.status) > stepProgress ? 'bg-primary' : 'bg-muted'
                                }`} />
                              )}
                            </React.Fragment>
                          );
                        })}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-extrabold text-foreground">${formatNumber(order.total || 0)}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{formatDateSafe(order.created_at)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* All orders link */}
        {orders.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {isAr
                ? `${orders.length} طلب إجمالي · ${activeOrders.length} نشط`
                : `${orders.length} total orders · ${activeOrders.length} active`
              }
            </p>
            <Link
              href="/order-tracking/dashboard"
              className="flex items-center gap-1.5 text-xs font-bold text-primary hover:opacity-70 transition-opacity"
            >
              <Icon name="ArrowTopRightOnSquareIcon" size={12} />
              {isAr ? 'لوحة التتبع' : 'Tracking Dashboard'}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};
// ─────────────────────────────────────────────────────────────────────────────

const AccountDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [profileSaveToast, setProfileSaveToast] = useState(false);
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const {t, isRTL, dir, language} = useLanguage();
  const ma = t.myAccount;
  const supabase = createClient();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [orderStats, setOrderStats] = useState({ total: 0, pending: 0, completed: 0, totalSpent: 0 });
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);

  const [hasLocalPassword, setHasLocalPassword] = useState(false);
  const [isGoogleUser, setIsGoogleUser] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ newPassword: '', confirmPassword: '', currentPassword: '' });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Notification preferences state
  const [notifPrefs, setNotifPrefs] = useState({
    notif_new_inquiries: true,
    notif_order_updates: true,
    notif_weekly_digest: true,
    notif_promotions: false,
  });
  const [notifSaving, setNotifSaving] = useState<string | null>(null);
  const [notifToast, setNotifToast] = useState<string | null>(null);

  const [liveEvents, setLiveEvents] = useState<LiveStatusEvent[]>([]);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const liveEventsRef = useRef<LiveStatusEvent[]>([]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) router.push('/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      setDataLoading(true);
      try {
        const [profileRes, ordersRes, productsRes] = await Promise.all([
          supabase.from('user_profiles').select('*').eq('id', user.id).single(),
          supabase.from('orders').select('id, order_number, status, total, created_at, items').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20),
          supabase.from('manufacturer_products').select('id, name, name_ar, unit_price, minimum_order_qty, unit, inventory_status, is_active, image_url, created_at').eq('manufacturer_id', user.id).order('created_at', { ascending: false }),
        ]);
        if (profileRes.data) {
          setProfile(profileRes.data);
          // Load notification preferences from profile
          setNotifPrefs({
            notif_new_inquiries: profileRes.data.notif_new_inquiries ?? true,
            notif_order_updates: profileRes.data.notif_order_updates ?? true,
            notif_weekly_digest: profileRes.data.notif_weekly_digest ?? true,
            notif_promotions: profileRes.data.notif_promotions ?? false,
          });
        }
        if (ordersRes.data) {
          const total = ordersRes.data.length;
          const pending = ordersRes.data.filter((o: Order) => ['pending', 'processing', 'shipped'].includes(o.status)).length;
          const completed = ordersRes.data.filter((o: Order) => o.status === 'delivered').length;
          const totalSpent = ordersRes.data.reduce((sum: number, o: Order) => sum + (o.total || 0), 0);
          setOrders(ordersRes.data);
          setOrderStats({ total, pending, completed, totalSpent });
        }
        if (productsRes.data) setProducts(productsRes.data);
        const identities = user.identities ?? [];
        setIsGoogleUser(!!identities.find((id: any) => id.provider === 'google'));
        setHasLocalPassword(!!identities.find((id: any) => id.provider === 'email'));
      } catch { /* keep empty */ } finally { setDataLoading(false); }
    };
    fetchData();
  }, [user]);

  // ── Real-time subscription for live order status ──────────────────────────
  useEffect(() => {
    if (!user) return;

        const channel = supabase
      .channel(`live-orders-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const updated = payload.new as Order & { status: string };
          const old = payload.old as Order & { status: string };

          // Update orders list in-place
          setOrders((prev) =>
            prev.map((o) =>
              o.id === updated.id ? { ...o, status: updated.status, total: updated.total } : o
            )
          );

          // Recalculate stats
          setOrders((prev) => {
            const total = prev.length;
            const pending = prev.filter((o) => ['pending', 'processing', 'shipped'].includes(o.status)).length;
            const completed = prev.filter((o) => o.status === 'delivered').length;
            const totalSpent = prev.reduce((sum, o) => sum + (o.total || 0), 0);
            setOrderStats({ total, pending, completed, totalSpent });
            return prev;
          });

          // Add live event if status changed
          if (old.status !== updated.status) {
            const event: LiveStatusEvent = {
              orderId: updated.id,
              orderNumber: updated.order_number,
              oldStatus: old.status,
              newStatus: updated.status,
              timestamp: new Date().toISOString(),
            };
            liveEventsRef.current = [event, ...liveEventsRef.current].slice(0, 5);
            setLiveEvents([...liveEventsRef.current]);
          }
        }
      )
      .subscribe((status) => {
        setIsRealtimeConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);
  // ─────────────────────────────────────────────────────────────────────────

  const isProfileIncomplete = !dataLoading && profile !== null && (
    !profile.full_name?.trim() || !profile.company_name?.trim() || !profile.country?.trim() || !profile.city?.trim() || !profile.phone?.trim()
  );

  const handleUploadSuccess = () => {
    setUploadSuccess(true);
    setTimeout(() => setUploadSuccess(false), 4000);
  };

  const handleToggleNotif = async (key: keyof typeof notifPrefs) => {
    if (!user || notifSaving) return;
    const newValue = !notifPrefs[key];
    const optimisticPrefs = { ...notifPrefs, [key]: newValue };
    setNotifPrefs(optimisticPrefs);
    setNotifSaving(key);
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ [key]: newValue })
        .eq('id', user.id);
      if (error) throw error;
      setNotifToast(newValue ? (t.myAccount.notifEnabled || 'Enabled') : (t.myAccount.notifDisabled || 'Disabled'));
      setTimeout(() => setNotifToast(null), 2000);
    } catch {
      setNotifPrefs(notifPrefs);
    } finally {
      setNotifSaving(null);
    }
  };

  const handleSavePassword = async () => {
    if (!user) return;
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordMsg({ text: t.myAccount.passwordsNoMatch, type: 'error' });
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      setPasswordMsg({ text: t.myAccount.passwordTooShort, type: 'error' });
      return;
    }
    setPasswordSaving(true);
    setPasswordMsg(null);
    try {
      const { error } = await supabase.auth.updateUser({ password: passwordForm.newPassword });
      if (error) throw error;
      setPasswordMsg({ text: hasLocalPassword ? t.myAccount.passwordChanged : t.myAccount.passwordCreated, type: 'success' });
      setHasLocalPassword(true);
      setPasswordForm({ newPassword: '', confirmPassword: '', currentPassword: '' });
      setTimeout(() => { setPasswordMsg(null); setShowPasswordForm(false); }, 3000);
    } catch (err: any) {
      setPasswordMsg({ text: err.message || t.myAccount.passwordFailed, type: 'error' });
    } finally { setPasswordSaving(false); }
  };

  const handleDeleteProduct = async (productId: string, productName: string) => {
    const confirmed = window.confirm(
      language === 'ar'
        ? `هل أنت متأكد من حذف المنتج "${productName}"؟ لا يمكن التراجع عن هذا الإجراء.`
        : `Are you sure you want to delete "${productName}"? This action cannot be undone.`
    );
    if (!confirmed) return;
    setDeletingProductId(productId);
    try {
      const { error } = await supabase
        .from('manufacturer_products')
        .delete()
        .eq('id', productId);
      if (error) throw error;
      setProducts((prev) => prev.filter((p) => p.id !== productId));
    } catch (err: any) {
      alert(language === 'ar' ? 'فشل حذف المنتج. يرجى المحاولة مرة أخرى.' : 'Failed to delete product. Please try again.');
    } finally {
      setDeletingProductId(null);
    }
  };

  const isBuyer = checkIsBuyer(profile);

  const tabs: { key: TabKey; label: string; icon: string; badge?: number }[] = [
    { key: 'overview', label: t.myAccount.tabOverview, icon: 'HomeIcon' },
    { key: 'orders', label: t.myAccount.tabOrders, icon: 'ShoppingBagIcon', badge: orderStats.pending || undefined },
    ...(isBuyer
      ? [{ key: 'my-orders' as TabKey, label: t.myAccount.myOrders, icon: 'ClipboardDocumentListIcon', badge: orderStats.pending || undefined }]
      : [{ key: 'products' as TabKey, label: t.myAccount.tabProducts, icon: 'ArchiveBoxIcon' }]
    ),
    { key: 'settings', label: t.myAccount.tabSettings, icon: 'Cog6ToothIcon' },
  ];

  const displayName = profile?.full_name || user?.email?.split('@')[0] || t.myAccount.roleUser;
  const displayCompany = profile?.company_name || '';
  const displayCountry = profile?.country || '';
  const isVerified = profile?.is_verified || false;
  const memberSince = profile?.created_at ? formatMonthYear(profile.created_at) : '';

  if (authLoading || !user) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="mobile-safe-bottom md:pb-0" dir={isRTL ? 'rtl' : 'ltr'}>

      {/* ── SUCCESS TOAST ── */}
      {profileSaveToast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-5 py-3 bg-green-600 text-white rounded-2xl shadow-2xl animate-fade-in text-sm font-bold">
          <Icon name="CheckCircleIcon" size={18} className="text-white shrink-0" />
          {t.myAccount.savedOk || 'Profile saved successfully ✓'}
        </div>
      )}

      {/* ── INCOMPLETE PROFILE BANNER ── */}
      {isProfileIncomplete && !bannerDismissed && (
        <div className="bg-gradient-to-l from-amber-500 to-orange-500 text-white">
          <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                <Icon name="ExclamationCircleIcon" size={18} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold leading-snug">{t.myAccount.incompleteProfile}</p>
                <p className="text-xs text-white/80 mt-0.5">{t.myAccount.incompleteProfileSub}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
              <button onClick={() => setActiveTab('settings')} className="px-4 py-2 bg-white text-orange-600 text-xs font-extrabold rounded-xl hover:bg-orange-50 transition-colors whitespace-nowrap">
                {t.myAccount.completeNow}
              </button>
              <button onClick={() => setBannerDismissed(true)} className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/20 hover:bg-white/30 transition-colors" aria-label="Dismiss">
                <Icon name="XMarkIcon" size={14} className="text-white" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PROFILE HEADER ── */}
      <div className="bg-foreground relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-10 relative z-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            {/* Avatar */}
            <div className="relative shrink-0">
              <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl overflow-hidden border-2 border-white/20 flex items-center justify-center bg-gradient-to-br from-orange-500 to-orange-700">
                {profile?.avatar_url ? (
                  <AppImage src={profile.avatar_url} alt={displayName} width={96} height={96} className="object-cover w-full h-full" />
                ) : (
                  <span className="text-3xl font-extrabold text-white">{displayName.charAt(0).toUpperCase()}</span>
                )}
              </div>
              {isVerified && (
                <div className="absolute -bottom-2 -right-2 w-7 h-7 bg-accent rounded-full border-2 border-foreground flex items-center justify-center">
                  <Icon name="CheckBadgeIcon" size={14} variant="solid" className="text-accent-foreground" />
                </div>
              )}
            </div>
            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="text-xl md:text-2xl font-extrabold text-primary-foreground">{displayName}</h1>
                {isVerified && (
                  <span className="px-2.5 py-0.5 bg-accent text-accent-foreground text-[10px] font-extrabold rounded-full uppercase tracking-wide">
                    ✓ {t.myAccount.verified}
                  </span>
                )}
              </div>
              {displayCompany && <p className="text-sm text-primary-foreground/60 font-medium mb-2">{displayCompany}</p>}
              <div className="flex flex-wrap items-center gap-4 text-xs text-primary-foreground/50">
                {displayCountry && <span className="flex items-center gap-1"><Icon name="MapPinIcon" size={12} />{displayCountry}</span>}
                {memberSince && <span className="flex items-center gap-1"><Icon name="CalendarDaysIcon" size={12} />{t.myAccount.memberSince} {memberSince}</span>}
              </div>
            </div>
            {/* Actions */}
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => {
                  const workspaceRole = getUserWorkspaceRole(profile);
                  if (workspaceRole === 'manufacturer') {
                    router.push('/my-account/supplier-profile');
                  } else {
                    router.push('/my-account/edit-profile');
                  }
                }}
                className="px-4 py-2 border border-primary-foreground/20 text-primary-foreground text-xs font-bold rounded-xl hover:bg-primary-foreground/10 transition-colors"
              >
                {t.myAccount.editProfile}
              </button>
              <button onClick={() => router.push('/rfq/create')} className="px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-xl hover:opacity-90 transition-opacity">
                {t.myAccount.postRFQ}
              </button>
            </div>
          </div>

          {/* Stats bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-8">
            {[
              { label: t.myAccount.statTotalOrders, value: orderStats.total.toString(), icon: 'ShoppingBagIcon', color: 'text-primary', bg: 'bg-primary/10' },
              { label: t.myAccount.statPending, value: orderStats.pending.toString(), icon: 'ClockIcon', color: 'text-yellow-600', bg: 'bg-yellow-50' },
              { label: t.myAccount.statCompleted, value: orderStats.completed.toString(), icon: 'CheckCircleIcon', color: 'text-accent', bg: 'bg-accent/10' },
              { label: t.myAccount.statTotalSpent, value: `$${formatNumber(orderStats.totalSpent)}`, icon: 'BanknotesIcon', color: 'text-blue-600', bg: 'bg-blue-50' },
            ].map((stat) => (
              <div key={stat.label} className="bg-primary-foreground/5 border border-primary-foreground/10 rounded-xl p-4 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center shrink-0`}>
                  <Icon name={stat.icon as Parameters<typeof Icon>[0]['name']} size={18} className={stat.color} />
                </div>
                <div className="min-w-0">
                  <p className="text-lg font-extrabold text-primary-foreground leading-none">{stat.value}</p>
                  <p className="text-[10px] text-primary-foreground/50 font-medium mt-0.5 truncate">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── TAB NAVIGATION — Card Grid (no horizontal scroll) ── */}
      <div className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-4">
          <div className="grid grid-cols-4 gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => {
                  setActiveTab(tab.key);
                }}
                className={`relative flex flex-col items-center gap-1.5 px-2 py-3 rounded-2xl font-bold text-xs transition-all ${
                  activeTab === tab.key
                    ? 'bg-primary text-primary-foreground shadow-md'
                    : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <Icon name={tab.icon as Parameters<typeof Icon>[0]['name']} size={20} />
                <span className="leading-tight text-center">{tab.label}</span>
                {tab.badge ? (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[9px] font-extrabold rounded-full flex items-center justify-center">
                    {tab.badge}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── TAB CONTENT ── */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">

        {/* ════ OVERVIEW TAB ════ */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Recent orders */}
            <div className="lg:col-span-8">
              {/* ── Workspace Command Center Banner ── */}
              <div className="mb-6">
                <WorkspaceBanner profile={profile} router={router} />
              </div>

              {/* ── Live Order Status Widget ── */}
              {!dataLoading && orders.length > 0 && (
                <div className="mb-6">
                  <LiveOrderStatusWidget
                    orders={orders}
                    liveEvents={liveEvents}
                    isConnected={isRealtimeConnected}
                    language={language}
                  />
                </div>
              )}

              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-extrabold text-foreground">{t.myAccount.recentOrders}</h2>
                <button onClick={() => setActiveTab('orders')} className="text-xs font-bold text-primary hover:opacity-70 flex items-center gap-1 transition-opacity">
                  {t.myAccount.viewAll} <Icon name={isRTL ? 'ArrowLeftIcon' : 'ArrowRightIcon'} size={12} />
                </button>
              </div>

              {dataLoading ? (
                <div className="flex flex-col gap-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex items-center gap-4 p-4 bg-card border border-border rounded-2xl animate-pulse">
                      <div className="w-12 h-12 rounded-xl bg-muted shrink-0" />
                      <div className="flex-1 space-y-2"><div className="h-4 bg-muted rounded w-3/4" /><div className="h-3 bg-muted rounded w-1/2" /></div>
                    </div>
                  ))}
                </div>
              ) : orders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center bg-card border border-border rounded-2xl">
                  <div className="w-14 h-14 bg-muted rounded-2xl flex items-center justify-center mb-4">
                    <Icon name="ShoppingBagIcon" size={24} className="text-muted-foreground" />
                  </div>
                  <h3 className="text-sm font-bold text-foreground mb-1">{t.myAccount.noOrders}</h3>
                  <p className="text-xs text-muted-foreground mb-4">{t.myAccount.noOrdersSub}</p>
                  <Link href="/search" className="px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-xl">{t.myAccount.browseProducts}</Link>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {orders.slice(0, 3).map((order) => (
                    <div key={order.id} className="flex items-center gap-4 p-4 bg-card border border-border rounded-2xl hover:shadow-sm transition-shadow">
                      <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                        <Icon name="ShoppingBagIcon" size={20} className="text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-foreground truncate">{t.myAccount.orderNumber}{order.order_number}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                          {formatDateSafe(order.created_at)}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-extrabold text-foreground">${formatNumber(order.total || 0)}</p>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${STATUS_COLORS[order.status] || 'text-muted-foreground bg-muted'}`}>{order.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right: Quick actions as cards */}
            <div className="lg:col-span-4 flex flex-col gap-4">
              <div className="bg-card border border-border rounded-2xl p-5">
                <h3 className="text-sm font-extrabold text-foreground mb-4">{t.myAccount.quickActions}</h3>
                <div className="grid grid-cols-2 gap-3">
                  {/* Post RFQ */}
                  <button
                    onClick={() => router.push('/rfq/create')}
                    className="flex flex-col items-center gap-3 p-4 bg-card border border-border rounded-2xl hover:shadow-md hover:border-primary/40 transition-all text-center group w-full"
                  >
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                      <Icon name="PlusCircleIcon" size={22} className="text-primary" />
                    </div>
                    <span className="text-xs font-bold text-foreground group-hover:text-primary transition-colors leading-tight">{t.myAccount.actionPostRFQ}</span>
                  </button>
                  {/* Browse */}
                  <Link href="/search" className="flex flex-col items-center gap-3 p-4 bg-card border border-border rounded-2xl hover:shadow-md hover:border-blue-300 transition-all text-center group">
                    <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                      <Icon name="MagnifyingGlassIcon" size={22} className="text-blue-600" />
                    </div>
                    <span className="text-xs font-bold text-foreground group-hover:text-blue-600 transition-colors leading-tight">{t.myAccount.actionBrowse}</span>
                  </Link>
                  {/* Invoices */}
                  <Link href="/invoices" className="flex flex-col items-center gap-3 p-4 bg-card border border-border rounded-2xl hover:shadow-md hover:border-gray-300 transition-all text-center group">
                    <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center group-hover:bg-gray-200 transition-colors">
                      <Icon name="DocumentArrowDownIcon" size={22} className="text-gray-600" />
                    </div>
                    <span className="text-xs font-bold text-foreground group-hover:text-gray-700 transition-colors leading-tight">{t.myAccount.actionInvoices}</span>
                  </Link>
                  {/* Financial */}
                  <Link href="/financial-accounts" className="flex flex-col items-center gap-3 p-4 bg-card border border-border rounded-2xl hover:shadow-md hover:border-green-300 transition-all text-center group">
                    <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center group-hover:bg-green-200 transition-colors">
                      <Icon name="BanknotesIcon" size={22} className="text-green-600" />
                    </div>
                    <span className="text-xs font-bold text-foreground group-hover:text-green-600 transition-colors leading-tight">{t.myAccount.actionFinancial}</span>
                  </Link>
                  {/* Add Product */}
                  {!isBuyer && <AddProductListingButton
                    user={user}
                    label={t.myAccount.actionAddProduct}
                    sublabel={t.myAccount.actionAddProductSub}
                    checkingLabel={t.myAccount.checkingVerification}
                  />}
                  {/* Upgrade — buyer only */}
                  {isBuyer && (
                    <Link href="/account/upgrade" className="flex flex-col items-center gap-3 p-4 bg-card border border-amber-200 rounded-2xl hover:shadow-md hover:border-amber-400 transition-all text-center group">
                      <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center group-hover:bg-amber-200 transition-colors">
                        <Icon name="ArrowUpCircleIcon" size={22} className="text-amber-600" />
                      </div>
                      <span className="text-xs font-bold text-foreground group-hover:text-amber-700 transition-colors leading-tight">{t.myAccount.actionUpgrade}</span>
                    </Link>
                  )}
                </div>
              </div>

              {/* Platform Info Links */}
              <div className="bg-gradient-to-br from-primary/5 to-orange-50 border border-primary/20 rounded-2xl p-5">
                <h3 className="text-sm font-extrabold text-foreground mb-3 flex items-center gap-2">
                  <span>🏢</span>{t.myAccount.platformInfo}
                </h3>
                <div className="flex flex-col gap-1">
                  {[
                    { label: t.myAccount.aboutUs, icon: '🏢', href: '/about' },
                    { label: t.myAccount.whyDirectHub, icon: '⚡', href: '/about#why' },
                    { label: t.myAccount.safeBuying, icon: '🛡️', href: '/about#journey' },
                    { label: t.myAccount.buyerBenefits, icon: '🎯', href: '/about#buyers' },
                    { label: t.myAccount.factoryPartnership, icon: '🏭', href: '/about#factories' },
                    { label: t.myAccount.strategicVision, icon: '🌐', href: '/about#vision' },
                  ].map((link) => (
                    <Link key={link.href} href={link.href} className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-primary/10 hover:text-primary transition-colors text-sm font-medium text-foreground group">
                      <span className="text-base">{link.icon}</span>
                      <span className="flex-1">{link.label}</span>
                      <Icon name={isRTL ? 'ChevronLeftIcon' : 'ChevronRightIcon'} size={12} className="text-muted-foreground group-hover:text-primary shrink-0" />
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════ ORDERS TAB ════ */}
        {activeTab === 'orders' && (
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-lg font-extrabold text-foreground">{t.myAccount.allOrders}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{orderStats.total} {t.myAccount.listings}</p>
              </div>
              <Link href="/orders" className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-xl hover:opacity-90 transition-opacity">
                <Icon name="ArrowTopRightOnSquareIcon" size={14} />
                {t.myAccount.fullOrderHistory}
              </Link>
            </div>

            {dataLoading ? (
              <div className="flex flex-col gap-3">{[...Array(5)].map((_, i) => <div key={i} className="bg-card border border-border rounded-2xl p-5 animate-pulse h-24" />)}</div>
            ) : orders.length === 0 ? (
              <div className="text-center py-20 bg-card border border-border rounded-2xl">
                <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Icon name="ShoppingBagIcon" size={28} className="text-muted-foreground" />
                </div>
                <h3 className="text-base font-bold text-foreground mb-2">{t.myAccount.noOrders}</h3>
                <p className="text-sm text-muted-foreground mb-4">{t.myAccount.noOrdersSub}</p>
                <Link href="/search" className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground text-sm font-bold rounded-xl">{t.myAccount.browseProducts}</Link>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {orders.map((order) => (
                  <div key={order.id} className="bg-card border border-border rounded-2xl p-4 md:p-5 hover:shadow-sm transition-shadow">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                      <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                        <Icon name="ShoppingBagIcon" size={22} className="text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <p className="text-sm font-extrabold text-foreground">{t.myAccount.orderNumber}{order.order_number}</p>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${STATUS_COLORS[order.status] || 'text-muted-foreground bg-muted'}`}>{order.status}</span>
                        </div>
                        <p className="text-xs text-muted-foreground font-mono">
                          {formatDateSafe(order.created_at)}
                        </p>
                      </div>
                      <div className="flex sm:flex-col items-center sm:items-end gap-3 shrink-0">
                        <p className="text-lg font-extrabold text-foreground">${formatNumber(order.total || 0)}</p>
                        <Link href={`/orders/${order.id}`} className="px-3 py-1.5 text-xs font-bold border border-border rounded-lg hover:bg-muted transition-colors text-foreground">{t.myAccount.orderDetails}</Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ════ PRODUCTS TAB ════ */}
        {activeTab === 'products' && (
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-lg font-extrabold text-foreground">{t.myAccount.myProducts}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{products.length} {t.myAccount.listings}</p>
              </div>
              <button onClick={() => router.push('/my-account/add-product')} className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground text-sm font-bold rounded-xl hover:opacity-90 transition-opacity">
                <Icon name="PlusIcon" size={16} />
                {t.myAccount.addNewProduct}
              </button>
            </div>

            {dataLoading ? (
              <div className="flex flex-col gap-4">{[...Array(3)].map((_, i) => <div key={i} className="bg-card border border-border rounded-2xl p-5 animate-pulse h-24" />)}</div>
            ) : products.length === 0 ? (
              <div onClick={() => router.push('/my-account/add-product')} className="border-2 border-dashed border-border rounded-2xl p-12 text-center hover:border-primary/40 transition-colors cursor-pointer group">
                <div className="w-14 h-14 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/10 transition-colors">
                  <Icon name="PlusIcon" size={28} className="text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <h3 className="text-base font-bold text-foreground mb-1">{t.myAccount.noProducts}</h3>
                <p className="text-sm text-muted-foreground mb-1">{t.myAccount.noProductsSub}</p>
                <p className="text-xs text-muted-foreground">{t.myAccount.addFirstProduct}</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {products.map((product) => (
                  <div key={product.id} className="bg-card border border-border rounded-2xl p-4 md:p-5 hover:shadow-sm transition-shadow">
                    <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                      <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-muted flex items-center justify-center">
                        {product.image_url ? (
                          <AppImage src={product.image_url} alt={product.name} width={64} height={64} className="object-cover w-full h-full" />
                        ) : (
                          <Icon name="ArchiveBoxIcon" size={24} className="text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-start justify-between gap-2 mb-1">
                          <div>
                            <p className="text-sm font-extrabold text-foreground">{product.name}</p>
                            {product.name_ar && <p className="text-xs text-muted-foreground">{product.name_ar}</p>}
                          </div>
                          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0 ${product.is_active ? 'text-green-700 bg-green-50' : 'text-gray-600 bg-gray-100'}`}>
                            {product.is_active ? t.myAccount.active : t.myAccount.inactive}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-4 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1 font-semibold text-foreground">
                            <Icon name="CurrencyDollarIcon" size={12} className="text-primary" />
                            ${product.unit_price}/{product.unit}
                          </span>
                          <span className="flex items-center gap-1">
                            <Icon name="CubeIcon" size={12} className="text-primary" />
                            {t.myAccount.moq}: {formatNumber(product.minimum_order_qty)} {product.unit}
                          </span>
                          <span className={`flex items-center gap-1 font-semibold capitalize ${product.inventory_status === 'in_stock' ? 'text-green-600' : product.inventory_status === 'low_stock' ? 'text-yellow-600' : 'text-red-600'}`}>
                            <Icon name="CheckCircleIcon" size={12} />
                            {product.inventory_status?.replace('_', ' ')}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Link href={`/product/${product.id}`} className="px-3 py-1.5 text-xs font-bold border border-border rounded-lg hover:bg-muted transition-colors text-foreground">{t.myAccount.view}</Link>
                        <Link href={`/my-account/edit-product/${product.id}`} className="px-3 py-1.5 text-xs font-bold border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors text-blue-700">{t.myAccount.edit}</Link>
                        <button
                          onClick={() => handleDeleteProduct(product.id, product.name)}
                          disabled={deletingProductId === product.id}
                          className="px-3 py-1.5 text-xs font-bold border border-red-300 rounded-lg hover:bg-red-50 transition-colors text-red-600 disabled:opacity-50"
                        >
                          {deletingProductId === product.id ? '...' : t.myAccount.delete}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                <div onClick={() => router.push('/my-account/add-product')} className="mt-2 border-2 border-dashed border-border rounded-2xl p-8 text-center hover:border-primary/40 transition-colors cursor-pointer group">
                  <div className="w-12 h-12 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-3 group-hover:bg-primary/10 transition-colors">
                    <Icon name="PlusIcon" size={24} className="text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <p className="text-sm font-bold text-foreground mb-1">{t.myAccount.addAnotherProduct}</p>
                  <p className="text-xs text-muted-foreground">{t.myAccount.addAnotherProductSub}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════ MY ORDERS TAB (buyers only) ════ */}
        {activeTab === 'my-orders' && (
          <MyOrdersTab orders={orders} dataLoading={dataLoading} orderStats={orderStats} />
        )}

        {/* ════ SETTINGS TAB ════ */}
        {activeTab === 'settings' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 flex flex-col gap-5">
              {/* Profile Edit Card */}
              <div className="bg-card border border-border rounded-2xl p-6">
                <h3 className="text-base font-extrabold text-foreground mb-5 flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                    <Icon name="UserCircleIcon" size={16} className="text-blue-600" />
                  </div>
                  {t.myAccount.personalInfo}
                </h3>

                {/* Profile summary */}
                <div className="flex items-center gap-4 p-4 bg-muted/40 rounded-xl mb-5">
                  <div className="w-14 h-14 rounded-xl overflow-hidden border-2 border-border bg-muted flex items-center justify-center shrink-0">
                    {profile?.avatar_url ? (
                      <AppImage src={profile.avatar_url} alt={displayName} width={56} height={56} className="object-cover w-full h-full" />
                    ) : (
                      <span className="text-xl font-extrabold text-primary">{displayName.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-extrabold text-foreground truncate">{displayName}</p>
                    {displayCompany && <p className="text-xs text-muted-foreground truncate">{displayCompany}</p>}
                    <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
                      {user?.email && <span className="flex items-center gap-1"><Icon name="EnvelopeIcon" size={11} />{user.email}</span>}
                      {displayCountry && <span className="flex items-center gap-1"><Icon name="MapPinIcon" size={11} />{displayCountry}{profile?.city ? `, ${profile.city}` : ''}</span>}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    const workspaceRole = getUserWorkspaceRole(profile);
                    if (workspaceRole === 'manufacturer') {
                      router.push('/my-account/supplier-profile');
                    } else {
                      router.push('/my-account/edit-profile');
                    }
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground text-sm font-extrabold rounded-xl hover:opacity-90 transition-opacity shadow-md shadow-primary/20"
                >
                  <Icon name="PencilSquareIcon" size={16} />
                  {getUserWorkspaceRole(profile) === 'manufacturer' ? t.myAccount.editManufacturerProfile : t.myAccount.editBuyerProfile}
                </button>
                <p className="text-[11px] text-muted-foreground text-center mt-2 flex items-center justify-center gap-1">
                  <Icon name="InformationCircleIcon" size={11} />
                  {getUserWorkspaceRole(profile) === 'manufacturer' ? t.myAccount.editManufacturerProfileHint : t.myAccount.editBuyerProfileHint}
                </p>
              </div>

              {/* Notifications */}
              <div className="bg-card border border-border rounded-2xl p-6">
                <h3 className="text-base font-extrabold text-foreground mb-1 flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
                    <Icon name="BellIcon" size={16} className="text-orange-600" />
                  </div>
                  {t.myAccount.notificationPrefs}
                </h3>
                <p className="text-xs text-muted-foreground mb-5 ps-10">{t.myAccount.notifSubtitle}</p>

                {/* Notification saved toast */}
                {notifToast && (
                  <div className="mb-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 border border-green-200 text-green-700 text-xs font-medium">
                    <Icon name="CheckCircleIcon" size={14} />
                    {t.myAccount.notifSaved} — {notifToast}
                  </div>
                )}

                <div className="flex flex-col gap-4">
                  {([
                    { key: 'notif_new_inquiries' as const, label: t.myAccount.notifNewInquiries, icon: 'ChatBubbleLeftRightIcon', color: 'text-blue-600', bg: 'bg-blue-50' },
                    { key: 'notif_order_updates' as const, label: t.myAccount.notifOrderUpdates, icon: 'TruckIcon', color: 'text-purple-600', bg: 'bg-purple-50' },
                    { key: 'notif_weekly_digest' as const, label: t.myAccount.notifWeeklyDigest, icon: 'ChartBarIcon', color: 'text-teal-600', bg: 'bg-teal-50' },
                    { key: 'notif_promotions' as const, label: t.myAccount.notifPromotions, icon: 'TagIcon', color: 'text-orange-600', bg: 'bg-orange-50' },
                  ] as const).map((pref) => {
                    const isEnabled = notifPrefs[pref.key];
                    const isSaving = notifSaving === pref.key;
                    return (
                      <div key={pref.key} className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className={`w-8 h-8 rounded-full ${pref.bg} flex items-center justify-center shrink-0`}>
                            <Icon name={pref.icon as Parameters<typeof Icon>[0]['name']} size={15} className={pref.color} />
                          </div>
                          <span className="text-sm font-medium text-foreground leading-tight">{pref.label}</span>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={isEnabled}
                          aria-label={pref.label}
                          disabled={isSaving}
                          onClick={() => handleToggleNotif(pref.key)}
                          className={`relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${isEnabled ? 'bg-primary' : 'bg-muted'} ${isSaving ? 'opacity-60 cursor-wait' : 'cursor-pointer'}`}
                        >
                          <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${isEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right sidebar */}
            <div className="lg:col-span-4 flex flex-col gap-4">
              {!isBuyer && <PinSetupCard hasPinSet={!!profile?.transaction_pin_hash} onPinSet={() => setProfile((prev) => prev ? { ...prev, transaction_pin_hash: 'set' } : prev)} />}

              {!isBuyer && <KYCStatusCard userId={user.id} />}

              {/* Security */}
              <div className="bg-card border border-border rounded-2xl p-5">
                <h3 className="text-sm font-extrabold text-foreground mb-4 flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center">
                    <Icon name="LockClosedIcon" size={14} className="text-purple-600" />
                  </div>
                  {t.myAccount.security}
                </h3>
                <div className="flex flex-col gap-3">
                  {/* Password management */}
                  <div>
                    <button onClick={() => setShowPasswordForm((v) => !v)} className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted transition-colors text-left w-full">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                        <Icon name="KeyIcon" size={14} className="text-indigo-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-semibold text-foreground block">
                          {hasLocalPassword ? t.myAccount.changePassword : t.myAccount.createPassword}
                        </span>
                        {isGoogleUser && !hasLocalPassword && (
                          <span className="text-[10px] text-muted-foreground">{t.myAccount.googleUserPasswordNote.slice(0, 40)}...</span>
                        )}
                      </div>
                      <Icon name={showPasswordForm ? 'ChevronUpIcon' : 'ChevronDownIcon'} size={14} className="text-muted-foreground" />
                    </button>
                    {showPasswordForm && (
                      <div className="mt-2 p-4 bg-muted/50 border border-border rounded-xl flex flex-col gap-3">
                        {isGoogleUser && !hasLocalPassword && (
                          <p className="text-xs text-muted-foreground leading-relaxed">{t.myAccount.googleUserPasswordNote}</p>
                        )}
                        {passwordMsg && (
                          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${passwordMsg.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
                            <Icon name={passwordMsg.type === 'success' ? 'CheckCircleIcon' : 'ExclamationCircleIcon'} size={14} />
                            {passwordMsg.text}
                          </div>
                        )}
                        <div>
                          <label className="block text-xs font-bold text-muted-foreground mb-1">{t.myAccount.newPassword}</label>
                          <input type="password" value={passwordForm.newPassword} onChange={(e) => setPasswordForm((p) => ({ ...p, newPassword: e.target.value }))} placeholder="••••••••" className="w-full px-3 py-2 border border-border rounded-lg text-sm text-foreground bg-background focus:outline-none focus:border-primary transition-colors" />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-muted-foreground mb-1">{t.myAccount.confirmPassword}</label>
                          <input type="password" value={passwordForm.confirmPassword} onChange={(e) => setPasswordForm((p) => ({ ...p, confirmPassword: e.target.value }))} placeholder="••••••••" className="w-full px-3 py-2 border border-border rounded-lg text-sm text-foreground bg-background focus:outline-none focus:border-primary transition-colors" />
                        </div>
                        <div className="flex gap-2 pt-1">
                          <button onClick={handleSavePassword} disabled={passwordSaving || !passwordForm.newPassword || !passwordForm.confirmPassword} className="flex-1 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-1.5">
                            {passwordSaving ? <><Icon name="ArrowPathIcon" size={13} className="animate-spin" /> {t.myAccount.saving}</> : <><Icon name="CheckIcon" size={13} /> {hasLocalPassword ? t.myAccount.changePassword : t.myAccount.createPassword}</>}
                          </button>
                          <button onClick={() => { setShowPasswordForm(false); setPasswordMsg(null); setPasswordForm({ newPassword: '', confirmPassword: '', currentPassword: '' }); }} className="px-3 py-2 border border-border text-xs font-bold rounded-lg hover:bg-muted transition-colors text-foreground">
                            {t.myAccount.cancel}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Log Out button inside security section */}
                  <button
                    onClick={async () => {
                      const supabaseClient = createClient();
                      await supabaseClient.auth.signOut();
                      router.push('/login');
                    }}
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-red-50 transition-colors text-left w-full border border-transparent hover:border-red-200"
                  >
                    <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                      <Icon name="ArrowRightOnRectangleIcon" size={14} className="text-red-600" />
                    </div>
                    <span className="text-sm font-semibold text-red-600 flex-1">{t.myAccount.signOut}</span>
                    <Icon name={isRTL ? 'ChevronLeftIcon' : 'ChevronRightIcon'} size={14} className="text-red-400" />
                  </button>

                  {[
                    { label: t.myAccount.twoFactorAuth, icon: 'ShieldCheckIcon', bg: 'bg-gray-100', color: 'text-gray-400' },
                    { label: t.myAccount.activeSessions, icon: 'DevicePhoneMobileIcon', bg: 'bg-gray-100', color: 'text-gray-400' },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 opacity-60 cursor-not-allowed text-left">
                      <div className={`w-8 h-8 rounded-full ${item.bg} flex items-center justify-center shrink-0`}>
                        <Icon name={item.icon as Parameters<typeof Icon>[0]['name']} size={14} className={item.color} />
                      </div>
                      <span className="text-sm font-semibold text-muted-foreground flex-1">{item.label}</span>
                      <span className="text-[10px] font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full whitespace-nowrap">Coming Soon</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Product Upload Form Modal */}
      {uploadSuccess && (
        <div className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 bg-accent text-accent-foreground rounded-2xl shadow-xl text-sm font-bold animate-fade-in">
          <Icon name="CheckCircleIcon" size={18} variant="solid" />
          {t.myAccount.addAnotherProductSub}
        </div>
      )}
    </div>
  );
};

export default AccountDashboard;