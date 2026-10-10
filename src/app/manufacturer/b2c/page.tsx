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

interface RetailOrder {
  id: string;
  customer_name: string;
  customer_country: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total: number;
  currency: string;
  shipping_method: 'express' | 'standard' | 'economy';
  shipping_cost: number;
  status: 'new' | 'processing' | 'shipped' | 'delivered' | 'returned';
  created_at: string;
  tracking_number: string;
}

interface RetailProduct {
  id: string;
  name: string;
  category: string;
  retail_price: number;
  b2b_price: number;
  currency: string;
  stock: number;
  unit: string;
  min_retail_qty: number;
  max_retail_qty: number;
  fast_shipping_eligible: boolean;
  rating: number;
  reviews_count: number;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_RETAIL_ORDERS: RetailOrder[] = [
  { id: 'B2C-001', customer_name: 'Ahmed Al-Rashidi', customer_country: '🇸🇦 Saudi Arabia', product_name: 'Steel Pipe 1m', quantity: 10, unit_price: 12, total: 120, currency: 'USD', shipping_method: 'express', shipping_cost: 25, status: 'shipped', created_at: '2026-09-29', tracking_number: 'DHL-4892731' },
  { id: 'B2C-002', customer_name: 'Fatima Hassan', customer_country: '🇦🇪 UAE', product_name: 'Aluminium Sheet 1m²', quantity: 5, unit_price: 18, total: 90, currency: 'USD', shipping_method: 'standard', shipping_cost: 15, status: 'processing', created_at: '2026-09-30', tracking_number: '' },
  { id: 'B2C-003', customer_name: 'Omar Khalid', customer_country: '🇰🇼 Kuwait', product_name: 'Copper Wire 10m', quantity: 3, unit_price: 22, total: 66, currency: 'USD', shipping_method: 'express', shipping_cost: 20, status: 'delivered', created_at: '2026-09-25', tracking_number: 'FDX-7731829' },
  { id: 'B2C-004', customer_name: 'Layla Mahmoud', customer_country: '🇪🇬 Egypt', product_name: 'Plastic Granules 1kg', quantity: 20, unit_price: 4.5, total: 90, currency: 'USD', shipping_method: 'economy', shipping_cost: 8, status: 'new', created_at: '2026-10-01', tracking_number: '' },
];

const MOCK_RETAIL_PRODUCTS: RetailProduct[] = [
  { id: 'RP-1', name: 'Steel Pipe 1m', category: 'Metals', retail_price: 12, b2b_price: 8.5, currency: 'USD', stock: 450, unit: 'pcs', min_retail_qty: 1, max_retail_qty: 50, fast_shipping_eligible: true, rating: 4.7, reviews_count: 128 },
  { id: 'RP-2', name: 'Aluminium Sheet 1m²', category: 'Metals', retail_price: 18, b2b_price: 13, currency: 'USD', stock: 200, unit: 'pcs', min_retail_qty: 1, max_retail_qty: 20, fast_shipping_eligible: true, rating: 4.5, reviews_count: 87 },
  { id: 'RP-3', name: 'Copper Wire 10m', category: 'Electrical', retail_price: 22, b2b_price: 16, currency: 'USD', stock: 320, unit: 'rolls', min_retail_qty: 1, max_retail_qty: 30, fast_shipping_eligible: true, rating: 4.8, reviews_count: 203 },
  { id: 'RP-4', name: 'Plastic Granules 1kg', category: 'Plastics', retail_price: 4.5, b2b_price: 3.2, currency: 'USD', stock: 1200, unit: 'kg', min_retail_qty: 5, max_retail_qty: 100, fast_shipping_eligible: false, rating: 4.3, reviews_count: 56 },
  { id: 'RP-5', name: 'Cement Bag 25kg', category: 'Construction', retail_price: 6.5, b2b_price: 4.8, currency: 'USD', stock: 800, unit: 'bags', min_retail_qty: 1, max_retail_qty: 50, fast_shipping_eligible: false, rating: 4.6, reviews_count: 174 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function orderStatusBadge(status: RetailOrder['status']) {
  const map: Record<RetailOrder['status'], { label: string; cls: string }> = {
    new: { label: 'جديد', cls: 'bg-sky-100 text-sky-700' },
    processing: { label: 'قيد التجهيز', cls: 'bg-amber-100 text-amber-700' },
    shipped: { label: 'تم الشحن', cls: 'bg-indigo-100 text-indigo-700' },
    delivered: { label: 'تم التسليم', cls: 'bg-emerald-100 text-emerald-700' },
    returned: { label: 'مُرتجع', cls: 'bg-red-100 text-red-700' },
  };
  const { label, cls } = map[status];
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{label}</span>;
}

function shippingBadge(method: RetailOrder['shipping_method']) {
  const map: Record<RetailOrder['shipping_method'], { label: string; cls: string }> = {
    express: { label: '⚡ سريع', cls: 'bg-orange-100 text-orange-700' },
    standard: { label: '📦 عادي', cls: 'bg-blue-100 text-blue-700' },
    economy: { label: '💰 اقتصادي', cls: 'bg-slate-100 text-slate-600' },
  };
  const { label, cls } = map[method];
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{label}</span>;
}

type Tab = 'orders' | 'products' | 'analytics';

export default function B2CSalesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { dir } = useLanguage();
  const [activeTab, setActiveTab] = useState<Tab>('orders');

  useEffect(() => {
    if (!authLoading && !user) router.push('/manufacturer/login');
  }, [user, authLoading, router]);

  if (authLoading) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><div className="w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  const totalRevenue = MOCK_RETAIL_ORDERS.reduce((s, o) => s + o.total, 0);
  const shippedCount = MOCK_RETAIL_ORDERS.filter(o => o.status === 'shipped' || o.status === 'delivered').length;
  const avgOrderValue = totalRevenue / MOCK_RETAIL_ORDERS.length;

  return (
    <div className="min-h-screen bg-slate-50" dir={dir}>
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-screen-xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/manufacturer/dashboard"><AppLogo className="h-8 w-auto" /></Link>
            <div className="hidden sm:block w-px h-6 bg-slate-200" />
            <span className="hidden sm:block text-sm font-semibold text-rose-600">نظام المبيعات B2C</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/manufacturer/b2b" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-sm text-indigo-700 transition-colors">
              <Icon name="Building2" size={14} />
              <span className="hidden sm:inline">B2B</span>
            </Link>
            <Link href="/manufacturer/dashboard" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-sm text-slate-600 transition-colors">
              <Icon name="ArrowLeft" size={14} />
              <span className="hidden sm:inline">لوحة التحكم</span>
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-screen-xl mx-auto px-4 py-6 space-y-6">
        {/* Title */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">🛍️ نظام المبيعات للمستهلك (B2C)</h1>
            <p className="text-slate-500 text-sm mt-1">إدارة الطلبات الفردية، التجزئة، والشحن السريع للمستهلك النهائي</p>
          </div>
          <div className="flex gap-2">
            <Link href="/cart" className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium transition-colors">
              <Icon name="ShoppingCart" size={14} />
              سلة المشتريات
            </Link>
            <Link href="/checkout" className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors">
              <Icon name="CreditCard" size={14} />
              إتمام الدفع
            </Link>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'إجمالي الإيرادات', value: `$${totalRevenue.toFixed(0)}`, icon: 'DollarSign', color: 'bg-rose-50 border-rose-200', iconColor: 'text-rose-600', valueColor: 'text-rose-700' },
            { label: 'طلبات مشحونة', value: shippedCount.toString(), icon: 'Truck', color: 'bg-indigo-50 border-indigo-200', iconColor: 'text-indigo-600', valueColor: 'text-indigo-700' },
            { label: 'متوسط قيمة الطلب', value: `$${avgOrderValue.toFixed(0)}`, icon: 'BarChart2', color: 'bg-amber-50 border-amber-200', iconColor: 'text-amber-600', valueColor: 'text-amber-700' },
            { label: 'منتجات للتجزئة', value: MOCK_RETAIL_PRODUCTS.length.toString(), icon: 'Package', color: 'bg-emerald-50 border-emerald-200', iconColor: 'text-emerald-600', valueColor: 'text-emerald-700' },
          ].map(kpi => (
            <div key={kpi.label} className={`${kpi.color} border rounded-xl p-4`}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-slate-500 text-xs mb-1">{kpi.label}</p>
                  <p className={`text-2xl font-bold ${kpi.valueColor}`}>{kpi.value}</p>
                </div>
                <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center shadow-sm">
                  <Icon name={kpi.icon as any} size={18} className={kpi.iconColor} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white rounded-xl p-1 border border-slate-200 w-full overflow-x-auto">
          {([
            { id: 'orders', label: '📦 طلبات التجزئة' },
            { id: 'products', label: '🏷️ منتجات B2C' },
            { id: 'analytics', label: '📊 تحليلات المبيعات' },
          ] as { id: Tab; label: string }[]).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 min-w-max px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-rose-600 text-white shadow' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab: Retail Orders */}
        {activeTab === 'orders' && (
          <div className="space-y-3">
            {MOCK_RETAIL_ORDERS.map(order => (
              <div key={order.id} className="bg-white border border-slate-200 rounded-xl p-4 hover:border-rose-300 transition-all">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-rose-50 flex items-center justify-center flex-shrink-0">
                      <Icon name="ShoppingBag" size={18} className="text-rose-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-900 text-sm">{order.id}</span>
                        {orderStatusBadge(order.status)}
                        {shippingBadge(order.shipping_method)}
                      </div>
                      <p className="text-slate-700 text-sm mt-0.5">{order.product_name} × {order.quantity}</p>
                      <p className="text-slate-500 text-xs mt-0.5">{order.customer_name} · {order.customer_country}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-slate-900 font-bold">${order.total}</p>
                    <p className="text-slate-500 text-xs">+ ${order.shipping_cost} شحن</p>
                  </div>
                </div>
                {order.tracking_number && (
                  <div className="mt-3 flex items-center gap-2 bg-indigo-50 rounded-lg px-3 py-2">
                    <Icon name="MapPin" size={14} className="text-indigo-600" />
                    <span className="text-indigo-700 text-xs font-mono">{order.tracking_number}</span>
                    <span className="text-indigo-500 text-xs">— رقم التتبع</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Tab: Retail Products */}
        {activeTab === 'products' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {MOCK_RETAIL_PRODUCTS.map(product => (
              <div key={product.id} className="bg-white border border-slate-200 rounded-xl p-4 hover:border-rose-300 transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold text-slate-900 text-sm">{product.name}</p>
                    <p className="text-slate-500 text-xs mt-0.5">{product.category}</p>
                  </div>
                  {product.fast_shipping_eligible && (
                    <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">⚡ شحن سريع</span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="bg-rose-50 rounded-lg p-2 text-center">
                    <p className="text-rose-500 text-xs">سعر التجزئة</p>
                    <p className="text-rose-700 font-bold text-sm">${product.retail_price}</p>
                  </div>
                  <div className="bg-indigo-50 rounded-lg p-2 text-center">
                    <p className="text-indigo-500 text-xs">سعر B2B</p>
                    <p className="text-indigo-700 font-bold text-sm">${product.b2b_price}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500 mb-3">
                  <span>المخزون: <span className="font-medium text-slate-700">{product.stock.toLocaleString()} {product.unit}</span></span>
                  <span>⭐ {product.rating} ({product.reviews_count})</span>
                </div>
                <div className="flex gap-2">
                  <button className="flex-1 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs transition-colors">تعديل السعر</button>
                  <Link href={`/store/${product.id}`} className="flex-1 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs text-center transition-colors">عرض في المتجر</Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab: Analytics */}
        {activeTab === 'analytics' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { label: 'معدل التحويل', value: '3.8%', change: '+0.5%', positive: true },
                { label: 'متوسط وقت التسليم', value: '4.2 أيام', change: '-0.8 يوم', positive: true },
                { label: 'معدل الإرجاع', value: '2.1%', change: '-0.3%', positive: true },
              ].map(stat => (
                <div key={stat.label} className="bg-white border border-slate-200 rounded-xl p-4">
                  <p className="text-slate-500 text-xs mb-1">{stat.label}</p>
                  <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
                  <p className={`text-xs mt-1 font-medium ${stat.positive ? 'text-emerald-600' : 'text-red-600'}`}>{stat.change} مقارنة بالشهر الماضي</p>
                </div>
              ))}
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <h3 className="font-semibold text-slate-900 text-sm mb-3">أفضل المنتجات مبيعاً (B2C)</h3>
              <div className="space-y-2">
                {MOCK_RETAIL_PRODUCTS.slice(0, 4).map((p, i) => (
                  <div key={p.id} className="flex items-center gap-3">
                    <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-700 text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                    <span className="flex-1 text-sm text-slate-700">{p.name}</span>
                    <div className="w-32 bg-slate-100 rounded-full h-1.5">
                      <div className="bg-rose-500 h-1.5 rounded-full" style={{ width: `${100 - i * 18}%` }} />
                    </div>
                    <span className="text-xs text-slate-500 w-12 text-right">{100 - i * 18}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
