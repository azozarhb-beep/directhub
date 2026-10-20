'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { createClient } from '@/lib/supabase/client';
import Header from '@/components/Header';
import Icon from '@/components/ui/AppIcon';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// ─── Room Identity ─────────────────────────────────────────────────────────────
const ROOM_ID = 'local-factory-control-room';
const ROOM_LABEL_AR = 'غرفة تحكم المصنع المحلي';
const ROOM_LABEL_EN = 'Local Factory Control Room';
const ROOM_MARKET = 'الجمهورية اليمنية — المصانع والمنتجون المحليون';

// ─── Types ────────────────────────────────────────────────────────────────────
interface FactoryStats {
  totalProducts: number;
  activeProducts: number;
  totalOrders: number;
  pendingOrders: number;
  completedOrders: number;
  totalRevenue: number;
  productionLines: number;
  activeLines: number;
  localInventoryValue: number;
  trustScore: number;
  verificationStatus: string;
}

interface ProductionLine {
  id: string;
  name: string;
  capacity_per_day: number;
  current_load: number;
  status: 'running' | 'idle' | 'maintenance';
  product_category: string;
}

interface LocalInventoryItem {
  id: string;
  sku: string;
  warehouse_location: string | null;
  stock_quantity: number;
  reorder_level: number;
  batch_number: string | null;
  updated_at: string;
  product_name_ar: string | null;
  product_name_en: string | null;
}

type ActiveTab = 'overview' | 'production' | 'inventory' | 'orders' | 'products' | 'erp' | 'settings';

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ─── Mock Production Lines ─────────────────────────────────────────────────────
const MOCK_PRODUCTION_LINES: ProductionLine[] = [
  { id: 'PL-YE-1', name: 'خط الإنتاج الرئيسي أ', capacity_per_day: 500, current_load: 85, status: 'running', product_category: 'مواد البناء' },
  { id: 'PL-YE-2', name: 'خط الإنتاج ب — التعبئة', capacity_per_day: 800, current_load: 62, status: 'running', product_category: 'المواد الغذائية' },
  { id: 'PL-YE-3', name: 'خط الإنتاج ج — التشطيب', capacity_per_day: 300, current_load: 0, status: 'maintenance', product_category: 'المنسوجات' },
  { id: 'PL-YE-4', name: 'خط الإنتاج د — التجميع', capacity_per_day: 400, current_load: 45, status: 'running', product_category: 'الإلكترونيات' },
];

const MONTHLY_PRODUCTION = [
  { month: 'يناير', output: 12000, target: 15000 },
  { month: 'فبراير', output: 14500, target: 15000 },
  { month: 'مارس', output: 13800, target: 15000 },
  { month: 'أبريل', output: 16200, target: 15000 },
  { month: 'مايو', output: 15700, target: 15000 },
  { month: 'يونيو', output: 14900, target: 15000 },
];

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border border-amber-200',
  active: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  approved: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  completed: 'bg-blue-50 text-blue-700 border border-blue-200',
  rejected: 'bg-red-50 text-red-700 border border-red-200',
  running: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  idle: 'bg-gray-50 text-gray-600 border border-gray-200',
  maintenance: 'bg-amber-50 text-amber-700 border border-amber-200',
  in_stock: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  low_stock: 'bg-amber-50 text-amber-700 border border-amber-200',
  out_of_stock: 'bg-red-50 text-red-700 border border-red-200',
};

function KPICard({ label, value, sub, icon, color }: { label: string; value: string | number; sub?: string; icon: string; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
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
export default function LocalFactoryControlRoom() {
  const { user, profile } = useAuth();
  const { dir } = useLanguage();
  const router = useRouter();
  const supabase = createClient();

  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [stats, setStats] = useState<FactoryStats>({
    totalProducts: 0, activeProducts: 0, totalOrders: 0, pendingOrders: 0,
    completedOrders: 0, totalRevenue: 0, productionLines: MOCK_PRODUCTION_LINES.length,
    activeLines: MOCK_PRODUCTION_LINES.filter(l => l.status === 'running').length,
    localInventoryValue: 0, trustScore: 0, verificationStatus: 'pending',
  });
  const [inventory, setInventory] = useState<LocalInventoryItem[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState<{ company_name?: string; city?: string; full_name?: string } | null>(null);

  // ─── Role Guard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) { router.replace('/login'); return; }
    const role = profile?.role || profile?.account_type || '';
    const sellerCat = profile?.seller_category || '';
    const isFactory = ['manufacturer', 'factory', 'local_factory'].some(r => role.toLowerCase().includes(r)) ||
      sellerCat === 'local_factory';
    if (profile && !isFactory && role !== 'admin') {
      router.replace('/my-account');
    }
  }, [user, profile, router]);

  // ─── Load Data ───────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [profileRes, productsRes, ordersRes] = await Promise.all([
        supabase.from('user_profiles').select('company_name, city, full_name, trust_score, verification_status').eq('id', user.id).single(),
        supabase.from('products').select('id, name, name_ar, price, currency, status, stock_quantity, category').eq('manufacturer_id', user.id).limit(30),
        supabase.from('orders').select('id, status, total, currency, created_at, factory_user_id').eq('factory_user_id', user.id).order('created_at', { ascending: false }).limit(30),
      ]);

      if (profileRes.data) setProfileData(profileRes.data);

      const prods = productsRes.data || [];
      const ords = ordersRes.data || [];

      const completed = ords.filter((o: any) => ['completed', 'delivered'].includes(o.status)).length;
      const pending = ords.filter((o: any) => ['pending', 'processing'].includes(o.status)).length;
      const revenue = ords.filter((o: any) => ['completed', 'delivered'].includes(o.status)).reduce((s: number, o: any) => s + (o.total || 0), 0);

      setStats(prev => ({
        ...prev,
        totalProducts: prods.length,
        activeProducts: prods.filter((p: any) => ['active', 'approved'].includes(p.status)).length,
        totalOrders: ords.length,
        pendingOrders: pending,
        completedOrders: completed,
        totalRevenue: revenue,
        localInventoryValue: prods.reduce((s: number, p: any) => s + (p.price || 0) * (p.stock_quantity || 0), 0),
        trustScore: profileRes.data?.trust_score || 0,
        verificationStatus: profileRes.data?.verification_status || 'pending',
      }));
    } catch (err) {
      console.error('LocalFactoryControlRoom load error:', err);
    } finally {
      setLoading(false);
    }
  }, [user, supabase]);

  // ─── Load Inventory from local_inventory table ───────────────────────────────
  const loadInventory = useCallback(async () => {
    if (!user) return;
    setInventoryLoading(true);
    try {
      const { data, error } = await supabase
        .from('local_inventory')
        .select(`
          id,
          sku,
          warehouse_location,
          stock_quantity,
          reorder_level,
          batch_number,
          updated_at,
          manufacturer_products (
            name,
            name_ar
          )
        `)
        .eq('supplier_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      const mapped: LocalInventoryItem[] = (data || []).map((row: any) => ({
        id: row.id,
        sku: row.sku,
        warehouse_location: row.warehouse_location,
        stock_quantity: row.stock_quantity,
        reorder_level: row.reorder_level,
        batch_number: row.batch_number,
        updated_at: row.updated_at,
        product_name_ar: row.manufacturer_products?.name_ar ?? null,
        product_name_en: row.manufacturer_products?.name ?? null,
      }));

      setInventory(mapped);
    } catch (err) {
      console.error('loadInventory error:', err);
    } finally {
      setInventoryLoading(false);
    }
  }, [user, supabase]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (activeTab === 'inventory') {
      loadInventory();
    }
  }, [activeTab, loadInventory]);

  const TABS: { id: ActiveTab; label: string; icon: string }[] = [
    { id: 'overview', label: 'نظرة عامة', icon: 'LayoutDashboard' },
    { id: 'production', label: 'خطوط الإنتاج', icon: 'Factory' },
    { id: 'inventory', label: 'المخزون المحلي', icon: 'Warehouse' },
    { id: 'orders', label: 'الطلبات', icon: 'ShoppingCart' },
    { id: 'products', label: 'المنتجات', icon: 'Package' },
    { id: 'erp', label: 'نظام ERP', icon: 'Database' },
    { id: 'settings', label: 'الإعدادات', icon: 'Settings' },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-500 text-sm">جارٍ تحميل غرفة تحكم المصنع...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50" dir={dir}>
      <Header />

      {/* ── Room Identity Banner ── */}
      <div className="bg-gradient-to-l from-orange-700 to-orange-900 text-white px-4 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Icon name="Factory" size={22} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight">{ROOM_LABEL_AR}</h1>
              <p className="text-orange-200 text-xs">{ROOM_MARKET}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="bg-white/20 text-white text-xs px-3 py-1 rounded-full border border-white/30">
              🇾🇪 اليمن فقط
            </span>
            <span className="bg-white/20 text-white text-xs px-3 py-1 rounded-full border border-white/30">
              {profileData?.company_name || profileData?.full_name || 'المصنع'}
            </span>
            <span className="bg-white/20 text-white text-xs px-3 py-1 rounded-full border border-white/30">
              {stats.activeLines}/{stats.productionLines} خط نشط
            </span>
          </div>
        </div>
      </div>

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
                    ? 'bg-orange-600 text-white shadow-sm'
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KPICard label="المنتجات المصنّعة" value={stats.totalProducts} sub={`${stats.activeProducts} نشط`} icon="Package" color="text-orange-700" />
              <KPICard label="الطلبات المحلية" value={stats.totalOrders} sub={`${stats.pendingOrders} معلّق`} icon="ShoppingCart" color="text-blue-700" />
              <KPICard label="قيمة المخزون (YER)" value={stats.localInventoryValue.toLocaleString()} sub="ريال يمني" icon="Warehouse" color="text-emerald-700" />
              <KPICard label="خطوط الإنتاج" value={`${stats.activeLines}/${stats.productionLines}`} sub="خط نشط" icon="Factory" color="text-purple-700" />
            </div>

            {/* Production Lines Summary */}
            <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
              <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Icon name="Factory" size={16} className="text-orange-600" />
                حالة خطوط الإنتاج
              </h3>
              <div className="space-y-3">
                {MOCK_PRODUCTION_LINES.map(line => (
                  <div key={line.id} className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-700">{line.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">{line.product_category}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_BADGE[line.status]}`}>
                            {line.status === 'running' ? 'يعمل' : line.status === 'idle' ? 'خامل' : 'صيانة'}
                          </span>
                        </div>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            line.status === 'maintenance' ? 'bg-amber-400' :
                            line.current_load > 80 ? 'bg-emerald-500' :
                            line.current_load > 50 ? 'bg-blue-500' : 'bg-gray-300'
                          }`}
                          style={{ width: `${line.current_load}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-sm font-bold text-gray-700 w-12 text-left">{line.current_load}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Monthly Production Chart */}
            <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
              <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Icon name="TrendingUp" size={16} className="text-orange-600" />
                الإنتاج الشهري مقابل الهدف
              </h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={MONTHLY_PRODUCTION}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="output" name="الإنتاج الفعلي" fill="#ea580c" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="target" name="الهدف" fill="#fed7aa" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
              <h3 className="font-semibold text-gray-800 mb-4">إجراءات سريعة</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'إضافة منتج', icon: 'Plus', href: '/my-account/add-product', color: 'bg-orange-50 text-orange-700 border-orange-200' },
                  { label: 'نظام ERP', icon: 'Database', href: '/manufacturer/erp', color: 'bg-blue-50 text-blue-700 border-blue-200' },
                  { label: 'الطلبات', icon: 'ShoppingCart', href: '/orders', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
                  { label: 'الرسائل', icon: 'MessageSquare', href: '/messaging', color: 'bg-purple-50 text-purple-700 border-purple-200' },
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

        {/* ── PRODUCTION TAB ── */}
        {activeTab === 'production' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-800">خطوط الإنتاج المحلية</h2>
              <span className="bg-orange-50 text-orange-700 border border-orange-200 text-xs px-3 py-1 rounded-full">
                {stats.activeLines} خط نشط من {stats.productionLines}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {MOCK_PRODUCTION_LINES.map(line => (
                <div key={line.id} className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-800">{line.name}</h3>
                      <p className="text-xs text-gray-500 mt-0.5">{line.product_category}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${STATUS_BADGE[line.status]}`}>
                      {line.status === 'running' ? '● يعمل' : line.status === 'idle' ? '○ خامل' : '⚠ صيانة'}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>الطاقة الإنتاجية اليومية</span>
                      <span className="font-medium text-gray-700">{line.capacity_per_day.toLocaleString()} وحدة</span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>الحمل الحالي</span>
                      <span className={`font-bold ${line.current_load > 80 ? 'text-emerald-600' : line.current_load > 50 ? 'text-blue-600' : 'text-gray-500'}`}>
                        {line.current_load}%
                      </span>
                    </div>
                    <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          line.status === 'maintenance' ? 'bg-amber-400' :
                          line.current_load > 80 ? 'bg-emerald-500' :
                          line.current_load > 50 ? 'bg-blue-500' : 'bg-gray-300'
                        }`}
                        style={{ width: `${line.current_load}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>الإنتاج الفعلي: {Math.round(line.capacity_per_day * line.current_load / 100).toLocaleString()} وحدة/يوم</span>
                      <span>المعرّف: {line.id}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── INVENTORY TAB ── */}
        {activeTab === 'inventory' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-800">المخزون المحلي</h2>
              <div className="flex gap-2">
                <span className="bg-red-50 text-red-700 border border-red-200 text-xs px-3 py-1 rounded-full">
                  {inventory.filter(i => i.stock_quantity === 0).length} نفد
                </span>
                <span className="bg-amber-50 text-amber-700 border border-amber-200 text-xs px-3 py-1 rounded-full">
                  {inventory.filter(i => i.stock_quantity > 0 && i.stock_quantity <= i.reorder_level).length} منخفض
                </span>
                <button
                  onClick={loadInventory}
                  className="flex items-center gap-1 bg-orange-50 text-orange-700 border border-orange-200 text-xs px-3 py-1 rounded-full hover:bg-orange-100 transition-colors"
                >
                  <Icon name="RefreshCw" size={12} />
                  تحديث
                </button>
              </div>
            </div>

            {inventoryLoading ? (
              <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
                <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-gray-500 text-sm">جارٍ تحميل بيانات المخزون...</p>
              </div>
            ) : inventory.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
                <Icon name="Warehouse" size={40} className="text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 mb-1">لا توجد بيانات مخزون بعد</p>
                <p className="text-gray-400 text-xs">أضف سجلات مخزون لتتبع مستويات المخزون المحلي</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-right px-4 py-3 text-gray-600 font-medium">المنتج / SKU</th>
                      <th className="text-right px-4 py-3 text-gray-600 font-medium">الموقع</th>
                      <th className="text-right px-4 py-3 text-gray-600 font-medium">الكمية</th>
                      <th className="text-right px-4 py-3 text-gray-600 font-medium">الحد الأدنى</th>
                      <th className="text-right px-4 py-3 text-gray-600 font-medium">رقم الدفعة</th>
                      <th className="text-right px-4 py-3 text-gray-600 font-medium">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {inventory.map(item => {
                      const status = item.stock_quantity === 0
                        ? 'out_of_stock'
                        : item.stock_quantity <= item.reorder_level
                        ? 'low_stock' :'in_stock';
                      return (
                        <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3">
                            {item.product_name_ar && (
                              <p className="font-medium text-gray-800">{item.product_name_ar}</p>
                            )}
                            {item.product_name_en && (
                              <p className="text-xs text-gray-400">{item.product_name_en}</p>
                            )}
                            <p className="font-mono text-xs text-gray-500 mt-0.5">{item.sku}</p>
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-xs">{item.warehouse_location || '—'}</td>
                          <td className="px-4 py-3 font-medium text-gray-700">{item.stock_quantity}</td>
                          <td className="px-4 py-3 text-gray-500">{item.reorder_level}</td>
                          <td className="px-4 py-3 text-gray-500 text-xs font-mono">{item.batch_number || '—'}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-1 rounded-full ${STATUS_BADGE[status]}`}>
                              {status === 'in_stock' ? 'متوفر' : status === 'low_stock' ? 'منخفض' : 'نفد'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── ORDERS TAB ── */}
        {activeTab === 'orders' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-800">الطلبات المحلية</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KPICard label="إجمالي الطلبات" value={stats.totalOrders} icon="ShoppingCart" color="text-orange-700" />
              <KPICard label="معلّقة" value={stats.pendingOrders} icon="Clock" color="text-amber-700" />
              <KPICard label="مكتملة" value={stats.completedOrders} icon="CheckCircle" color="text-emerald-700" />
              <KPICard label="الإيرادات (YER)" value={stats.totalRevenue.toLocaleString()} icon="Banknote" color="text-blue-700" />
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm text-center py-12">
              <Icon name="ShoppingCart" size={40} className="text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 mb-4">إدارة الطلبات من لوحة الطلبات المركزية</p>
              <Link href="/orders" className="inline-flex items-center gap-2 bg-orange-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-orange-700 transition-colors">
                <Icon name="ExternalLink" size={15} />
                فتح لوحة الطلبات
              </Link>
            </div>
          </div>
        )}

        {/* ── PRODUCTS TAB ── */}
        {activeTab === 'products' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-800">المنتجات المصنّعة محلياً</h2>
              <Link href="/my-account/add-product" className="flex items-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-700 transition-colors">
                <Icon name="Plus" size={15} />
                إضافة منتج
              </Link>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm text-center py-12">
              <Icon name="Package" size={40} className="text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 mb-4">إدارة منتجاتك من لوحة المصنع الرئيسية</p>
              <Link href="/manufacturer/dashboard" className="inline-flex items-center gap-2 bg-orange-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-orange-700 transition-colors">
                <Icon name="ExternalLink" size={15} />
                لوحة تحكم المصنع
              </Link>
            </div>
          </div>
        )}

        {/* ── ERP TAB ── */}
        {activeTab === 'erp' && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <Icon name="Database" size={20} className="text-blue-700" />
                <h2 className="text-lg font-bold text-blue-800">نظام ERP المحلي</h2>
              </div>
              <p className="text-blue-700 text-sm">نظام تخطيط موارد المؤسسة المخصص للمصانع المحلية في اليمن</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { label: 'إدارة المخزون', icon: 'Warehouse', desc: 'تتبع المواد الخام والمنتجات النهائية', href: '/manufacturer/erp' },
                { label: 'خطوط الإنتاج', icon: 'Factory', desc: 'جدولة وإدارة خطوط الإنتاج', href: '/manufacturer/erp' },
                { label: 'التقارير المالية', icon: 'BarChart2', desc: 'تقارير الإيرادات والتكاليف المحلية', href: '/manufacturer/erp' },
              ].map(item => (
                <Link key={item.label} href={item.href} className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-all hover:border-blue-200 group">
                  <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center mb-3 group-hover:bg-blue-100 transition-colors">
                    <Icon name={item.icon} size={20} className="text-blue-600" />
                  </div>
                  <h3 className="font-semibold text-gray-800 mb-1">{item.label}</h3>
                  <p className="text-xs text-gray-500">{item.desc}</p>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ── SETTINGS TAB ── */}
        {activeTab === 'settings' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-800">إعدادات غرفة التحكم</h2>
            <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm space-y-4">
              {[
                { label: 'معلومات المصنع', desc: 'تحديث بيانات المصنع والموقع', href: '/my-account/edit-profile', action: 'تعديل' },
                { label: 'الحسابات المالية', desc: 'إدارة حسابات الاستلام والدفع', href: '/financial-accounts', action: 'إدارة' },
                { label: 'التحقق من الهوية (KYC)', desc: 'رفع المستندات التجارية', href: '/kyc', action: 'التحقق' },
                { label: 'لوحة تحكم المصنع الكاملة', desc: 'الوصول إلى جميع ميزات المصنع', href: '/manufacturer/dashboard', action: 'فتح' },
              ].map((item, i, arr) => (
                <div key={item.label} className={`flex items-center justify-between py-3 ${i < arr.length - 1 ? 'border-b border-gray-50' : ''}`}>
                  <div>
                    <p className="font-medium text-gray-800">{item.label}</p>
                    <p className="text-xs text-gray-500">{item.desc}</p>
                  </div>
                  <Link href={item.href} className="text-orange-600 text-sm font-medium hover:underline">{item.action}</Link>
                </div>
              ))}
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <Icon name="Info" size={16} className="text-orange-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-orange-800 font-medium text-sm">غرفة تحكم مستقلة — المصانع المحلية</p>
                  <p className="text-orange-700 text-xs mt-1">
                    هذه الغرفة مخصصة حصرياً للمصانع والمنتجين المحليين في الجمهورية اليمنية.
                    معرّف الغرفة: <code className="bg-orange-100 px-1 rounded">{ROOM_ID}</code>
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
