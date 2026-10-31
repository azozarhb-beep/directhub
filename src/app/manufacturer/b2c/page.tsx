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

type Currency = 'YER' | 'USD';
type OrderStatus = 'new' | 'processing' | 'shipped' | 'delivered' | 'returned';

interface RetailOrder {
  id: string;
  order_number: string;
  customer_name: string;
  customer_country: string;
  product_name: string;
  quantity: number;
  total: number;
  currency: Currency;
  shipping_cost: number;
  status: OrderStatus;
  created_at: string;
  tracking_number: string;
}

interface RetailProduct {
  id: string;
  name: string;
  category: string;
  retail_price: number;
  b2b_price: number;
  currency: Currency;
  stock: number;
  unit: string;
  image_url: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapStatus(status: string | null | undefined): OrderStatus {
  const s = String(status || '').toLowerCase();
  if (s === 'delivered' || s === 'completed') return 'delivered';
  if (s === 'shipped' || s === 'in_transit' || s === 'out_for_delivery') return 'shipped';
  if (s === 'returned' || s === 'refunded') return 'returned';
  if (s === 'processing' || s === 'confirmed' || s === 'ready_for_dispatch' || s === 'in_production') return 'processing';
  return 'new';
}

function resolveCurrency(row: any): Currency {
  const itemCur = Array.isArray(row?.items)
    ? String(row.items.find((it: any) => it?.currency)?.currency || '').toUpperCase()
    : '';
  if (itemCur === 'YER' || itemCur === 'USD') return itemCur as Currency;
  const hasExportSignal = row?.incoterms || row?.incoterm_type || row?.port_of_discharge;
  if (hasExportSignal) return 'USD';
  return 'YER';
}

function formatMoney(amount: number, currency: Currency): string {
  const n = Number(amount || 0);
  return currency === 'USD'
    ? `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
    : `${n.toLocaleString('en-US', { maximumFractionDigits: 0 })} ر.ي`;
}

function formatDual(totals: Record<Currency, number>): string {
  const parts: string[] = [];
  if (totals.YER > 0) parts.push(formatMoney(totals.YER, 'YER'));
  if (totals.USD > 0) parts.push(formatMoney(totals.USD, 'USD'));
  return parts.length ? parts.join(' + ') : formatMoney(0, 'YER');
}

function orderStatusBadge(status: OrderStatus) {
  const map: Record<OrderStatus, { label: string; cls: string }> = {
    new: { label: 'جديد', cls: 'bg-sky-100 text-sky-700' },
    processing: { label: 'قيد التجهيز', cls: 'bg-amber-100 text-amber-700' },
    shipped: { label: 'تم الشحن', cls: 'bg-indigo-100 text-indigo-700' },
    delivered: { label: 'تم التسليم', cls: 'bg-emerald-100 text-emerald-700' },
    returned: { label: 'مُرتجع', cls: 'bg-red-100 text-red-700' },
  };
  const { label, cls } = map[status];
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{label}</span>;
}

type Tab = 'orders' | 'products' | 'analytics';

export default function B2CSalesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { dir } = useLanguage();
  const supabase = useMemo(() => createClient(), []);
  const [activeTab, setActiveTab] = useState<Tab>('orders');
  const [orders, setOrders] = useState<RetailOrder[]>([]);
  const [products, setProducts] = useState<RetailProduct[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (!authLoading && !user) router.push('/manufacturer/login');
  }, [user, authLoading, router]);

  const loadData = useCallback(async () => {
    if (!user) return;
    setDataLoading(true);
    setLoadError('');
    try {
      const [ordersRes, productsRes] = await Promise.all([
        supabase
          .from('orders')
          .select('id, order_number, items, total, shipping_cost, currency, status, order_category, order_type, tracking_code, tracking_number, incoterms, incoterm_type, port_of_discharge, shipping_address, created_at, user_profiles!orders_user_id_fkey(full_name, country)')
          .eq('factory_user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(200),
        supabase
          .from('manufacturer_products')
          .select('id, name, category, unit, unit_price, b2c_price, currency, stock_quantity, image_url, target_market, is_active')
          .eq('manufacturer_id', user.id)
          .in('target_market', ['B2C', 'BOTH'])
          .order('created_at', { ascending: false })
          .limit(200),
      ]);
      if (ordersRes.error) throw ordersRes.error;
      if (productsRes.error) throw productsRes.error;

      const retailOrders: RetailOrder[] = ((ordersRes.data as any[]) || [])
        .filter(o => {
          const explicit = String(o.order_type || '').trim().toLowerCase();
          if (explicit) return explicit === 'b2c';
          const cat = String(o.order_category || '').trim().toLowerCase();
          return cat === 'retail' || cat === 'b2c';
        })
        .map(o => {
          const items: any[] = Array.isArray(o.items) ? o.items : [];
          const first = items[0] || {};
          const qty = items.reduce((s, it) => s + Number(it?.quantity ?? it?.qty ?? 1), 0) || 1;
          const extra = items.length > 1 ? ` +${items.length - 1}` : '';
          const profile = Array.isArray(o.user_profiles) ? o.user_profiles[0] : o.user_profiles;
          return {
            id: o.id,
            order_number: o.order_number || String(o.id).slice(0, 8),
            customer_name: profile?.full_name || 'مشترٍ',
            customer_country: o.shipping_address?.country || profile?.country || '',
            product_name: `${first.name || first.product_name || 'منتج'}${extra}`,
            quantity: qty,
            total: Number(o.total || 0),
            currency: resolveCurrency(o),
            shipping_cost: Number(o.shipping_cost || 0),
            status: mapStatus(o.status),
            created_at: o.created_at || '',
            tracking_number: o.tracking_code || o.tracking_number || '',
          };
        });

      const retailProducts: RetailProduct[] = ((productsRes.data as any[]) || [])
        .filter(p => p.is_active !== false)
        .map(p => ({
          id: p.id,
          name: p.name || '—',
          category: String(p.category || '').replace(/_/g, ' '),
          retail_price: Number(p.b2c_price ?? p.unit_price ?? 0),
          b2b_price: Number(p.unit_price || 0),
          currency: String(p.currency || '').toUpperCase() === 'USD' ? 'USD' : 'YER',
          stock: Number(p.stock_quantity || 0),
          unit: p.unit || '',
          image_url: p.image_url || '',
        }));

      setOrders(retailOrders);
      setProducts(retailProducts);
    } catch (e: any) {
      setLoadError(e?.message || 'تعذر تحميل بيانات مبيعات التجزئة');
    } finally {
      setDataLoading(false);
    }
  }, [user, supabase]);

  useEffect(() => {
    if (user) loadData();
  }, [user, loadData]);

  const stats = useMemo(() => {
    const revenue: Record<Currency, number> = { YER: 0, USD: 0 };
    const counted = orders.filter(o => o.status !== 'returned');
    counted.forEach(o => { revenue[o.currency] += o.total; });
    const shipped = orders.filter(o => o.status === 'shipped' || o.status === 'delivered').length;
    const avg: Record<Currency, number> = {
      YER: counted.filter(o => o.currency === 'YER').length
        ? revenue.YER / counted.filter(o => o.currency === 'YER').length : 0,
      USD: counted.filter(o => o.currency === 'USD').length
        ? revenue.USD / counted.filter(o => o.currency === 'USD').length : 0,
    };
    const delivered = orders.filter(o => o.status === 'delivered').length;
    const returned = orders.filter(o => o.status === 'returned').length;
    const returnRate = orders.length ? (returned / orders.length) * 100 : 0;
    const deliveryRate = orders.length ? (delivered / orders.length) * 100 : 0;
    const qtyByName: Record<string, number> = {};
    orders.forEach(o => {
      const key = o.product_name;
      qtyByName[key] = (qtyByName[key] || 0) + o.quantity;
    });
    const top = Object.entries(qtyByName).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const topMax = top[0]?.[1] || 1;
    return { revenue, shipped, avg, returnRate, deliveryRate, top, topMax };
  }, [orders]);

  if (authLoading) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><div className="w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

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
            <button
              type="button"
              onClick={loadData}
              disabled={dataLoading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium transition-colors disabled:opacity-50"
            >
              <Icon name="ArrowPathIcon" size={14} className={dataLoading ? 'animate-spin' : ''} />
              تحديث
            </button>
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

        {loadError && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{loadError}</div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'إجمالي الإيرادات', value: formatDual(stats.revenue), icon: 'DollarSign', color: 'bg-rose-50 border-rose-200', iconColor: 'text-rose-600', valueColor: 'text-rose-700' },
            { label: 'طلبات مشحونة', value: stats.shipped.toString(), icon: 'Truck', color: 'bg-indigo-50 border-indigo-200', iconColor: 'text-indigo-600', valueColor: 'text-indigo-700' },
            { label: 'متوسط قيمة الطلب', value: formatDual(stats.avg), icon: 'BarChart2', color: 'bg-amber-50 border-amber-200', iconColor: 'text-amber-600', valueColor: 'text-amber-700' },
            { label: 'منتجات للتجزئة', value: products.length.toString(), icon: 'Package', color: 'bg-emerald-50 border-emerald-200', iconColor: 'text-emerald-600', valueColor: 'text-emerald-700' },
          ].map(kpi => (
            <div key={kpi.label} className={`${kpi.color} border rounded-xl p-4`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-slate-500 text-xs mb-1">{kpi.label}</p>
                  <p className={`text-xl font-bold break-words ${kpi.valueColor}`}>{dataLoading ? '…' : kpi.value}</p>
                </div>
                <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center shadow-sm shrink-0">
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

        {dataLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Tab: Retail Orders */}
            {activeTab === 'orders' && (
              <div className="space-y-3">
                {orders.length === 0 ? (
                  <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
                    <Icon name="ShoppingBag" size={28} className="text-slate-400 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">لا توجد طلبات تجزئة بعد. ستظهر طلبات المستهلكين هنا تلقائياً.</p>
                  </div>
                ) : (
                  orders.map(order => (
                    <div key={order.id} className="bg-white border border-slate-200 rounded-xl p-4 hover:border-rose-300 transition-all">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-lg bg-rose-50 flex items-center justify-center flex-shrink-0">
                            <Icon name="ShoppingBag" size={18} className="text-rose-600" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-slate-900 text-sm font-mono">{order.order_number}</span>
                              {orderStatusBadge(order.status)}
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">{order.currency}</span>
                            </div>
                            <p className="text-slate-700 text-sm mt-0.5">{order.product_name} × {order.quantity}</p>
                            <p className="text-slate-500 text-xs mt-0.5">{order.customer_name}{order.customer_country ? ` · ${order.customer_country}` : ''}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-slate-900 font-bold">{formatMoney(order.total, order.currency)}</p>
                          {order.shipping_cost > 0 && (
                            <p className="text-slate-500 text-xs">+ {formatMoney(order.shipping_cost, order.currency)} شحن</p>
                          )}
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
                  ))
                )}
              </div>
            )}

            {/* Tab: Retail Products */}
            {activeTab === 'products' && (
              products.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
                  <Icon name="Package" size={28} className="text-slate-400 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">لا توجد منتجات مفعّلة للتجزئة. فعّل خيار B2C على منتجاتك من لوحة المنتجات.</p>
                  <Link href="/manufacturer/products" className="inline-block mt-3 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium">إدارة المنتجات</Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {products.map(product => (
                    <div key={product.id} className="bg-white border border-slate-200 rounded-xl p-4 hover:border-rose-300 transition-all">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-semibold text-slate-900 text-sm">{product.name}</p>
                          <p className="text-slate-500 text-xs mt-0.5 capitalize">{product.category}</p>
                        </div>
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold">{product.currency}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div className="bg-rose-50 rounded-lg p-2 text-center">
                          <p className="text-rose-500 text-xs">سعر التجزئة</p>
                          <p className="text-rose-700 font-bold text-sm">{formatMoney(product.retail_price, product.currency)}</p>
                        </div>
                        <div className="bg-indigo-50 rounded-lg p-2 text-center">
                          <p className="text-indigo-500 text-xs">سعر B2B</p>
                          <p className="text-indigo-700 font-bold text-sm">{formatMoney(product.b2b_price, product.currency)}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-500 mb-3">
                        <span>المخزون: <span className="font-medium text-slate-700">{product.stock.toLocaleString('en-US')} {product.unit}</span></span>
                      </div>
                      <div className="flex gap-2">
                        <Link href="/manufacturer/products" className="flex-1 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs text-center transition-colors">تعديل السعر</Link>
                        <Link href={`/product/${product.id}`} className="flex-1 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs text-center transition-colors">عرض في المتجر</Link>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}

            {/* Tab: Analytics */}
            {activeTab === 'analytics' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[
                    { label: 'إجمالي طلبات التجزئة', value: orders.length.toLocaleString('en-US') },
                    { label: 'نسبة التسليم', value: `${stats.deliveryRate.toFixed(1)}%` },
                    { label: 'معدل الإرجاع', value: `${stats.returnRate.toFixed(1)}%` },
                  ].map(stat => (
                    <div key={stat.label} className="bg-white border border-slate-200 rounded-xl p-4">
                      <p className="text-slate-500 text-xs mb-1">{stat.label}</p>
                      <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
                    </div>
                  ))}
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <h3 className="font-semibold text-slate-900 text-sm mb-3">أفضل المنتجات مبيعاً (B2C)</h3>
                  {stats.top.length === 0 ? (
                    <p className="text-xs text-slate-500">لا توجد بيانات مبيعات كافية بعد.</p>
                  ) : (
                    <div className="space-y-2">
                      {stats.top.map(([name, qty], i) => {
                        const pct = Math.max(8, Math.round((qty / stats.topMax) * 100));
                        return (
                          <div key={name} className="flex items-center gap-3">
                            <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-700 text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                            <span className="flex-1 text-sm text-slate-700 truncate">{name}</span>
                            <div className="w-32 bg-slate-100 rounded-full h-1.5">
                              <div className="bg-rose-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs text-slate-500 w-12 text-right">{qty.toLocaleString('en-US')}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
