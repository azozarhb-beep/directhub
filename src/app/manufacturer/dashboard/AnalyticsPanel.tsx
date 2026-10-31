'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { useLanguage } from '@/contexts/LanguageContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { getShipmentsForPeriod, aggregateByCountry, formatShipmentsAr } from '@/components/manufacturer/ExportVolumeKPIs';
import { useLiveExportData } from '@/components/manufacturer/useLiveExportData';

const formatUSD = (amount: number, fractionDigits = 0): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(Number.isFinite(amount) ? amount : 0);

type LocalCurrency = 'YER' | 'SAR' | 'USD';

const normalizeCurrency = (c: unknown): LocalCurrency => {
  const v = typeof c === 'string' ? c.trim().toUpperCase() : '';
  if (v === 'SAR' || v === 'USD' || v === 'YER') return v;
  return 'YER';
};

const CURRENCY_SYMBOL_AR: Record<LocalCurrency, string> = { YER: 'ر.ي', SAR: 'ر.س', USD: '$' };

const AR_MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

/** "2026-09-24" → "24 سبتمبر". Falls back to the raw label when it isn't a date key. */
const formatArabicDay = (key: unknown): string => {
  const raw = typeof key === 'string' ? key : '';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!m) return raw;
  const month = AR_MONTHS[Number(m[2]) - 1];
  return month ? `${Number(m[3])} ${month}` : raw;
};

const CATEGORY_AR: Record<string, string> = {
  raw_materials: 'مواد خام',
  'raw-materials': 'مواد خام',
  packaging: 'تغليف',
  plastics: 'بلاستيك',
  plastics_rubber: 'بلاستيك ومطاط',
  chemicals: 'كيماويات',
  metals: 'معادن',
  textiles: 'منسوجات',
  food: 'أغذية',
  electronics: 'إلكترونيات',
  machinery: 'آلات ومعدات',
  construction: 'مواد بناء',
  agriculture: 'زراعة',
  other: 'أخرى',
};

const localizeCategory = (cat: unknown, language: string): string => {
  const raw = typeof cat === 'string' ? cat.trim() : '';
  if (!raw) return '';
  if (language !== 'ar') return raw.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return CATEGORY_AR[raw] || CATEGORY_AR[raw.toLowerCase()] || raw.replace(/[_-]+/g, ' ');
};

const csvCell = (v: unknown): string => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const downloadFile = (content: string, mime: string, filename: string) => {
  const blob = new Blob(['\uFEFF' + content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

/** Returns null when growth shouldn't be shown (no data in either period). */
const growthLabel = (current: number, previous: number): { text: string; positive: boolean } | null => {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  if (current === 0 && previous === 0) return null;
  if (previous === 0) return { text: '+100%', positive: true };
  const pct = Math.round(((current - previous) / previous) * 100);
  return { text: `${pct > 0 ? '+' : ''}${pct}%`, positive: pct >= 0 };
};

interface AnalyticsPanelProps {
  analyticsLoading: boolean;
  analyticsData: any[];
  analyticsStats: {
    totalViews: number;
    totalOrders: number;
    totalRfqs: number;
    avgRating: number;
    reviewCount: number;
    activeProducts: number;
    totalRevenue: number;
  };
  analyticsPrev?: { totalOrders: number; totalRfqs: number; totalRevenue: number };
  analyticsPeriod: '7d' | '30d' | '90d';
  setAnalyticsPeriod: (v: '7d' | '30d' | '90d') => void;
  products: any[];
  companyName: string;
  user: any;
  t: any;
  md: any;
  /** 'local' enables the Yemeni-manufacturer enhancements; omitted = international behaviour. */
  variant?: 'local' | 'international';
  /** Factory's active currency (local variant). Defaults to YER. */
  currency?: string | null;
}

type Channel = 'all' | 'b2b' | 'b2c';

export default function AnalyticsPanel({
  analyticsLoading,
  analyticsData,
  analyticsStats,
  analyticsPrev,
  analyticsPeriod,
  setAnalyticsPeriod,
  products,
  companyName,
  user,
  t,
  md,
  variant = 'international',
  currency,
}: AnalyticsPanelProps) {
  const { language } = useLanguage();
  const isLocal = variant === 'local';
  const [channel, setChannel] = useState<Channel>('all');
  const activeCurrency = normalizeCurrency(currency);

  /** Money formatter: local variant uses the factory currency; international stays USD. */
  const fmtMoney = (amount: number, fractionDigits = 0): string => {
    if (!isLocal) return formatUSD(amount, fractionDigits);
    const n = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(Number.isFinite(amount) ? amount : 0);
    return activeCurrency === 'USD' ? `$${n}` : `${n} ${CURRENCY_SYMBOL_AR[activeCurrency]}`;
  };
  const fmtAxisMoney = (v: number): string => {
    if (!isLocal) return v >= 1000 ? `$${v / 1000}K` : `$${v}`;
    const n = v >= 1000000 ? `${+(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${+(v / 1000).toFixed(1)}K` : `${v}`;
    return activeCurrency === 'USD' ? `$${n}` : n;
  };
  const fmtDate = (d: unknown): string => (isLocal ? formatArabicDay(d) : String(d ?? ''));

  // Channel-segmented series (local variant only; rows without channel fields fall back to totals)
  const chartData = isLocal
    ? analyticsData.map((d: any) => {
        if (channel === 'b2b') return { ...d, orders: d.ordersB2B ?? 0, revenue: d.revenueB2B ?? 0 };
        if (channel === 'b2c') return { ...d, orders: d.ordersB2C ?? 0, revenue: d.revenueB2C ?? 0 };
        return d;
      })
    : analyticsData;
  const safeNum = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  const fmtInt = (v: unknown): string => new Intl.NumberFormat('en-US').format(safeNum(v));
  const sa = t.manufacturerDashboard.sellerAnalytics;
  const periodDays = analyticsPeriod === '7d' ? 7 : analyticsPeriod === '30d' ? 30 : 90;
  const prev = analyticsPrev ?? { totalOrders: 0, totalRfqs: 0, totalRevenue: 0 };

  const { records: liveExportRecords } = useLiveExportData(user?.id);
  const exportShipments = getShipmentsForPeriod(liveExportRecords, analyticsPeriod);
  const exportByCountry = aggregateByCountry(exportShipments);

  const handleExportCsv = () => {
    const rows: unknown[][] = [
      [sa.csvDate, sa.csvViews, sa.csvOrders, sa.csvRevenue],
      ...analyticsData.map((d: any) => [fmtDate(d.date), d.views, d.orders, d.revenue]),
      [],
      [sa.csvSummary, `${periodDays} ${sa.reportDays}`],
      [sa.reportTotalViews, analyticsStats.totalViews],
      [sa.reportTotalOrders, analyticsStats.totalOrders],
      [sa.csvTotalRevenue, analyticsStats.totalRevenue],
      [sa.reportTotalRfqs, analyticsStats.totalRfqs],
      [sa.reportAvgRating, analyticsStats.avgRating.toFixed(2)],
      [sa.activeProducts, analyticsStats.activeProducts],
      [],
      ['Country', 'Shipments', 'Export Volume (USD)'],
      ...exportByCountry.map((c) => [c.country_ar, c.shipments, c.volume]),
    ];
    const csv = rows.map((r) => r.map(csvCell).join(',')).join('\n');
    downloadFile(csv, 'text/csv;charset=utf-8;', `analytics_${analyticsPeriod}_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const handleExportReport = () => {
    const lines: string[] = [];
    lines.push(sa.reportTitle);
    lines.push(`${sa.reportPeriod} ${periodDays} ${sa.reportDays}`);
    lines.push(`${sa.reportGenerated}: ${new Date().toLocaleDateString(language === 'ar' ? 'ar-SA' : language === 'zh' ? 'zh-CN' : language === 'tr' ? 'tr-TR' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`);
    lines.push(`${sa.reportCompany}: ${companyName || user?.email || ''}`);
    lines.push('');
    lines.push(sa.reportSummary);
    lines.push(`${sa.reportTotalViews}: ${analyticsStats.totalViews}`);
    lines.push(`${sa.reportTotalOrders}: ${analyticsStats.totalOrders}`);
    lines.push(`${sa.reportTotalRevenue}${analyticsStats.totalRevenue.toFixed(2)}`);
    lines.push(`${sa.reportTotalRfqs}: ${analyticsStats.totalRfqs}`);
    lines.push(`${sa.reportAvgRating}: ${analyticsStats.avgRating > 0 ? analyticsStats.avgRating.toFixed(2) : sa.reportNA}`);
    lines.push(`${sa.reportActiveProducts}: ${analyticsStats.activeProducts}`);
    lines.push(`${sa.reportAvgOrderValue}${analyticsStats.totalOrders > 0 ? (analyticsStats.totalRevenue / analyticsStats.totalOrders).toFixed(2) : sa.reportNA}`);
    lines.push('');
    lines.push('=== الصادرات حسب الدولة ===');
    exportByCountry.forEach((c) => {
      lines.push(`${c.country_ar} | ${formatShipmentsAr(c.shipments)} | ${formatUSD(c.volume, 2)}`);
    });
    lines.push('');
    lines.push(sa.reportDailyBreakdown);
    lines.push(sa.reportDateHeader);
    analyticsData.forEach((d: any) => {
      lines.push(`${fmtDate(d.date)} | ${d.views} | ${d.orders} | ${fmtMoney(Number(d.revenue) || 0, 2)}`);
    });
    lines.push('');
    lines.push(sa.reportProducts);
    products.forEach((p) => {
      lines.push(`${p.name} | ${localizeCategory(p.category, language)} | ${fmtMoney(Number(p.unit_price) || 0, 2)} | ${p.inventory_status}`);
    });
    downloadFile(lines.join('\n'), 'text/plain;charset=utf-8;', `analytics_report_${analyticsPeriod}_${new Date().toISOString().split('T')[0]}.txt`);
  };

  const kpiCards = [
    { label: sa.productViews, value: fmtInt(analyticsStats?.totalViews), icon: 'EyeIcon', color: 'text-blue-600', bg: 'bg-blue-50', growth: null as ReturnType<typeof growthLabel>, href: '/manufacturer/products' },
    { label: sa.totalOrders, value: fmtInt(analyticsStats?.totalOrders), icon: 'ShoppingBagIcon', color: 'text-amber-600', bg: 'bg-amber-50', growth: growthLabel(analyticsStats.totalOrders, prev.totalOrders), href: '/manufacturer/orders' },
    { label: sa.revenue, value: fmtMoney(safeNum(analyticsStats?.totalRevenue), 0), icon: 'BanknotesIcon', color: 'text-green-600', bg: 'bg-green-50', growth: growthLabel(analyticsStats.totalRevenue, prev.totalRevenue), href: '/manufacturer/finance' },
    { label: sa.rfqsReceived, value: fmtInt(analyticsStats?.totalRfqs), icon: 'DocumentTextIcon', color: 'text-purple-600', bg: 'bg-purple-50', growth: growthLabel(analyticsStats.totalRfqs, prev.totalRfqs), href: '/manufacturer/rfq' },
  ];

  const cardInteractive = 'block cursor-pointer transition-all hover:border-primary/40 hover:shadow-md active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary';

  const channelOptions: { key: Channel; label: string }[] = [
    { key: 'all', label: 'الكل' },
    { key: 'b2b', label: 'صفقات الجملة B2B' },
    { key: 'b2c', label: 'مبيعات التجزئة B2C' },
  ];

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className={isLocal ? 'bg-secondary rounded-2xl p-5 text-white' : 'bg-gradient-to-r from-secondary to-secondary/80 rounded-2xl p-5 text-white'}>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex-1" />
          {/* Period selector */}
          <div className="flex gap-1 bg-white/10 p-1 rounded-xl">
            {(['7d', '30d', '90d'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setAnalyticsPeriod(p)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  analyticsPeriod === p ? 'bg-white text-secondary' : 'text-white/80 hover:text-white'
                }`}
              >
                {p === '7d' ? sa['7days'] : p === '30d' ? sa['30days'] : sa['90days']}
              </button>
            ))}
          </div>
          {/* Export Buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleExportCsv}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              <Icon name="ArrowDownTrayIcon" size={14} />
              {sa.exportCsv}
            </button>
            <button
              onClick={handleExportReport}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              <Icon name="DocumentArrowDownIcon" size={14} />
              {sa.exportReport}
            </button>
          </div>
        </div>
      </div>

      {analyticsLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {kpiCards.map((kpi) => {
              const inner = (
                <>
                  <div className={`w-10 h-10 rounded-xl ${kpi.bg} flex items-center justify-center mb-3`}>
                    <Icon name={kpi.icon as any} size={20} className={kpi.color} />
                  </div>
                  <p className="text-2xl font-extrabold text-foreground">{kpi.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{kpi.label}</p>
                  {kpi.growth ? (
                    <p className={`text-xs font-semibold mt-1 ${kpi.growth.positive ? 'text-green-600' : 'text-red-600'}`}>
                      <span dir="ltr">{kpi.growth.text}</span> {sa.vsPrevPeriod}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground font-semibold mt-1">-</p>
                  )}
                </>
              );
              return isLocal ? (
                <Link key={kpi.label} href={kpi.href} className={`bg-card border border-border rounded-2xl p-4 ${cardInteractive}`}>
                  {inner}
                </Link>
              ) : (
                <div key={kpi.label} className="bg-card border border-border rounded-2xl p-4">
                  {inner}
                </div>
              );
            })}
          </div>

          {/* Secondary stats */}
          <div className="grid grid-cols-3 gap-4">
            {(() => {
              const ratingInner = (
                <>
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Icon name="StarIcon" size={16} variant="solid" className="text-amber-400" />
                    <span className="text-2xl font-extrabold text-foreground">
                      {analyticsStats.avgRating > 0 ? analyticsStats.avgRating.toFixed(1) : '—'}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{sa.avgRating}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{analyticsStats.reviewCount} {sa.reviews}</p>
                </>
              );
              const activeInner = (
                <>
                  <p className="text-2xl font-extrabold text-foreground">{analyticsStats.activeProducts}</p>
                  <p className="text-xs text-muted-foreground mt-1">{sa.activeProducts}</p>
                </>
              );
              const base = 'bg-card border border-border rounded-2xl p-4 text-center';
              return isLocal ? (
                <>
                  <Link href="/manufacturer/products#reviews" className={`${base} ${cardInteractive}`}>{ratingInner}</Link>
                  <Link href="/manufacturer/products" className={`${base} ${cardInteractive}`}>{activeInner}</Link>
                </>
              ) : (
                <>
                  <div className={base}>{ratingInner}</div>
                  <div className={base}>{activeInner}</div>
                </>
              );
            })()}
            <div className="bg-card border border-border rounded-2xl p-4 text-center">
              <p className="text-2xl font-extrabold text-foreground">
                {analyticsStats.totalOrders > 0
                  ? fmtMoney(analyticsStats.totalRevenue / analyticsStats.totalOrders, 0)
                  : '—'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{sa.avgOrderValue}</p>
            </div>
          </div>

          {/* Views Chart */}
          {analyticsData.length > 0 && analyticsStats.totalViews > 0 && (
            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                <Icon name="EyeIcon" size={16} className="text-blue-600" />
                {sa.productViewsOverTime}
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={analyticsData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="viewsGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#C8611A" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#C8611A" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E8E4DE" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#8A8680' }} tickLine={false} axisLine={false} interval="preserveStartEnd" tickFormatter={fmtDate} />
                  <YAxis tick={{ fontSize: 10, fill: '#8A8680' }} tickLine={false} axisLine={false} />
                  <Tooltip labelFormatter={fmtDate} contentStyle={{ background: '#fff', border: '1px solid #D4CFC8', borderRadius: 12, fontSize: 12, color: '#111827' }} labelStyle={{ fontWeight: 700, color: '#111827' }} />
                  <Area type="monotone" dataKey="views" stroke="#C8611A" strokeWidth={2} fill="url(#viewsGradient)" name={sa.productViews} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Revenue Chart */}
          {analyticsData.length > 0 && (
            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                <Icon name="BanknotesIcon" size={16} className="text-green-600" />
                {sa.revenueAndOrders}
              </h3>
              {isLocal && (
                <div className="flex gap-1 bg-muted p-1 rounded-xl mb-4 overflow-x-auto" role="tablist" aria-label="قناة البيع">
                  {channelOptions.map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      role="tab"
                      aria-selected={channel === opt.key}
                      onClick={() => setChannel(opt.key)}
                      className={`flex-1 whitespace-nowrap px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${
                        channel === opt.key ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} margin={{ top: 5, right: 10, left: isLocal ? 0 : -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E8E4DE" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#8A8680' }} tickLine={false} axisLine={false} interval="preserveStartEnd" tickFormatter={fmtDate} />
                  <YAxis tick={{ fontSize: 10, fill: '#8A8680' }} tickLine={false} axisLine={false} tickFormatter={fmtAxisMoney} />
                  <Tooltip labelFormatter={fmtDate} formatter={(value: any, name: any) => (name === sa.revenue ? fmtMoney(Number(value) || 0, isLocal ? 0 : 2) : value)} contentStyle={{ background: '#fff', border: '1px solid #D4CFC8', borderRadius: 12, fontSize: 12, color: '#111827' }} labelStyle={{ fontWeight: 700, color: '#111827' }} />
                  <Bar dataKey="revenue" fill="#2E5E3E" radius={[4, 4, 0, 0]} name={sa.revenue} />
                  <Bar dataKey="orders" fill="#C8611A" radius={[4, 4, 0, 0]} name={sa.totalOrders} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Product Performance Table */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
              <Icon name="CubeIcon" size={16} className="text-primary" />
              {sa.productPerformance}
            </h3>
            {products.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">{sa.noProductsToAnalyze}</p>
            ) : (
              <div className="space-y-3">
                {products.slice(0, 8).map((product) => (
                  <div key={product.id} className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl">
                    <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                      <Icon name="CubeIcon" size={14} className="text-primary/60" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground break-words leading-snug" dir="auto">{product.name}</p>
                      <p className="text-[10px] text-muted-foreground">{localizeCategory(product.category, language)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-bold text-foreground" dir="ltr">{fmtMoney(Number(product.unit_price) || 0, 2)}</p>
                      <div className="flex items-center gap-1 justify-end mt-0.5">
                        <Icon name="StarIcon" size={10} variant="solid" className="text-amber-400" />
                        <span className="text-[10px] text-muted-foreground">
                          {(product as any).avg_rating ? Number((product as any).avg_rating).toFixed(1) : '—'}
                        </span>
                      </div>
                    </div>
                    <div className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${
                      product.inventory_status === 'in_stock' ? 'bg-green-50 text-green-700' :
                      product.inventory_status === 'low_stock' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'
                    }`}>
                      {product.inventory_status === 'in_stock' ? sa.inStock : product.inventory_status === 'low_stock' ? sa.low : sa.out}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
