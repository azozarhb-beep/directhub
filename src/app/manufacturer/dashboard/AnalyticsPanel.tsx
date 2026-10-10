'use client';

import React from 'react';
import Icon from '@/components/ui/AppIcon';
import { useLanguage } from '@/contexts/LanguageContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

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
  analyticsPeriod: '7d' | '30d' | '90d';
  setAnalyticsPeriod: (v: '7d' | '30d' | '90d') => void;
  products: any[];
  companyName: string;
  user: any;
  t: any;
  md: any;
}

export default function AnalyticsPanel({
  analyticsLoading,
  analyticsData,
  analyticsStats,
  analyticsPeriod,
  setAnalyticsPeriod,
  products,
  companyName,
  user,
  t,
  md,
}: AnalyticsPanelProps) {
  const { language } = useLanguage();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-secondary to-secondary/80 rounded-2xl p-5 text-white">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
            <Icon name="ChartBarIcon" size={24} className="text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold">{t.manufacturerDashboard.sellerAnalytics.dashboardTitle}</h2>
            <p className="text-sm text-white/80">{t.manufacturerDashboard.sellerAnalytics.dashboardSubtitle}</p>
          </div>
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
                {p === '7d' ? t.manufacturerDashboard.sellerAnalytics['7days'] : p === '30d' ? t.manufacturerDashboard.sellerAnalytics['30days'] : t.manufacturerDashboard.sellerAnalytics['90days']}
              </button>
            ))}
          </div>
          {/* Export Buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => {
                const rows = [
                  [t.manufacturerDashboard.sellerAnalytics.csvDate, t.manufacturerDashboard.sellerAnalytics.csvViews, t.manufacturerDashboard.sellerAnalytics.csvOrders, t.manufacturerDashboard.sellerAnalytics.csvRevenue],
                  ...analyticsData.map((d: any) => [d.date, d.views, d.orders, d.revenue]),
                  [],
                  [t.manufacturerDashboard.sellerAnalytics.csvSummary, '', '', ''],
                  [t.manufacturerDashboard.sellerAnalytics.reportTotalViews, analyticsStats.totalViews, '', ''],
                  [t.manufacturerDashboard.sellerAnalytics.reportTotalOrders, analyticsStats.totalOrders, '', ''],
                  [t.manufacturerDashboard.sellerAnalytics.csvTotalRevenue, analyticsStats.totalRevenue, '', ''],
                  [t.manufacturerDashboard.sellerAnalytics.reportTotalRfqs, analyticsStats.totalRfqs, '', ''],
                  [t.manufacturerDashboard.sellerAnalytics.reportAvgRating, analyticsStats.avgRating.toFixed(2), '', ''],
                  [t.manufacturerDashboard.sellerAnalytics.activeProducts, analyticsStats.activeProducts, '', ''],
                ];
                const csv = rows.map(r => r.join(',')).join('\n');
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `analytics_${analyticsPeriod}_${new Date().toISOString().split('T')[0]}.csv`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              <Icon name="ArrowDownTrayIcon" size={14} />
              {t.manufacturerDashboard.sellerAnalytics.exportCsv}
            </button>
            <button
              onClick={() => {
                const lines: string[] = [];
                lines.push(t.manufacturerDashboard.sellerAnalytics.reportTitle);
                lines.push(`${t.manufacturerDashboard.sellerAnalytics.reportPeriod} ${analyticsPeriod === '7d' ? '7' : analyticsPeriod === '30d' ? '30' : '90'} ${t.manufacturerDashboard.sellerAnalytics.reportDays}`);
                lines.push(`${t.manufacturerDashboard.sellerAnalytics.reportGenerated}: ${new Date().toLocaleDateString(language === 'ar' ? 'ar-SA' : language === 'zh' ? 'zh-CN' : language === 'tr' ? 'tr-TR' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`);
                lines.push(`${t.manufacturerDashboard.sellerAnalytics.reportCompany}: ${companyName || user?.email || ''}`);
                lines.push('');
                lines.push(t.manufacturerDashboard.sellerAnalytics.reportSummary);
                lines.push(`${t.manufacturerDashboard.sellerAnalytics.reportTotalViews}: ${analyticsStats.totalViews}`);
                lines.push(`${t.manufacturerDashboard.sellerAnalytics.reportTotalOrders}: ${analyticsStats.totalOrders}`);
                lines.push(`${t.manufacturerDashboard.sellerAnalytics.reportTotalRevenue} ${analyticsStats.totalRevenue.toLocaleString()}`);
                lines.push(`${t.manufacturerDashboard.sellerAnalytics.reportTotalRfqs}: ${analyticsStats.totalRfqs}`);
                lines.push(`${t.manufacturerDashboard.sellerAnalytics.reportAvgRating}: ${analyticsStats.avgRating > 0 ? analyticsStats.avgRating.toFixed(2) : t.manufacturerDashboard.sellerAnalytics.reportNA}`);
                lines.push(`${t.manufacturerDashboard.sellerAnalytics.reportActiveProducts}: ${analyticsStats.activeProducts}`);
                lines.push(`${t.manufacturerDashboard.sellerAnalytics.reportAvgOrderValue} ${analyticsStats.totalOrders > 0 ? (analyticsStats.totalRevenue / analyticsStats.totalOrders).toFixed(2) : t.manufacturerDashboard.sellerAnalytics.reportNA}`);
                lines.push('');
                lines.push(t.manufacturerDashboard.sellerAnalytics.reportDailyBreakdown);
                lines.push(t.manufacturerDashboard.sellerAnalytics.reportDateHeader);
                analyticsData.forEach((d: any) => {
                  lines.push(`${d.date} | ${d.views} | ${d.orders} | SAR ${d.revenue}`);
                });
                lines.push('');
                lines.push(t.manufacturerDashboard.sellerAnalytics.reportProducts);
                products.forEach(p => {
                  lines.push(`${p.name} | ${p.category} | SAR ${p.unit_price} | ${p.inventory_status}`);
                });
                const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `analytics_report_${analyticsPeriod}_${new Date().toISOString().split('T')[0]}.txt`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              <Icon name="DocumentArrowDownIcon" size={14} />
              {t.manufacturerDashboard.sellerAnalytics.exportReport}
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
            {[
              { label: t.manufacturerDashboard.sellerAnalytics.productViews, value: analyticsStats.totalViews.toLocaleString(), icon: 'EyeIcon', color: 'text-blue-600', bg: 'bg-blue-50', change: '+12%' },
              { label: t.manufacturerDashboard.sellerAnalytics.totalOrders, value: analyticsStats.totalOrders.toLocaleString(), icon: 'ShoppingBagIcon', color: 'text-amber-600', bg: 'bg-amber-50', change: '+8%' },
              { label: t.manufacturerDashboard.sellerAnalytics.revenue, value: analyticsStats.totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 }), icon: 'BanknotesIcon', color: 'text-green-600', bg: 'bg-green-50', change: '+15%' },
              { label: t.manufacturerDashboard.sellerAnalytics.rfqsReceived, value: analyticsStats.totalRfqs.toLocaleString(), icon: 'DocumentTextIcon', color: 'text-purple-600', bg: 'bg-purple-50', change: '+5%' },
            ].map((kpi) => (
              <div key={kpi.label} className="bg-card border border-border rounded-2xl p-4">
                <div className={`w-10 h-10 rounded-xl ${kpi.bg} flex items-center justify-center mb-3`}>
                  <Icon name={kpi.icon as any} size={20} className={kpi.color} />
                </div>
                <p className="text-2xl font-extrabold text-foreground">{kpi.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{kpi.label}</p>
                <p className="text-xs text-green-600 font-semibold mt-1">{kpi.change} {t.manufacturerDashboard.sellerAnalytics.vsPrevPeriod}</p>
              </div>
            ))}
          </div>

          {/* Secondary stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-card border border-border rounded-2xl p-4 text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Icon name="StarIcon" size={16} variant="solid" className="text-amber-400" />
                <span className="text-2xl font-extrabold text-foreground">
                  {analyticsStats.avgRating > 0 ? analyticsStats.avgRating.toFixed(1) : '—'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{t.manufacturerDashboard.sellerAnalytics.avgRating}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{analyticsStats.reviewCount} {t.manufacturerDashboard.sellerAnalytics.reviews}</p>
            </div>
            <div className="bg-card border border-border rounded-2xl p-4 text-center">
              <p className="text-2xl font-extrabold text-foreground">{analyticsStats.activeProducts}</p>
              <p className="text-xs text-muted-foreground mt-1">{t.manufacturerDashboard.sellerAnalytics.activeProducts}</p>
            </div>
            <div className="bg-card border border-border rounded-2xl p-4 text-center">
              <p className="text-2xl font-extrabold text-foreground">
                {analyticsStats.totalOrders > 0
                  ? (analyticsStats.totalRevenue / analyticsStats.totalOrders).toLocaleString(undefined, { maximumFractionDigits: 0 })
                  : '—'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{t.manufacturerDashboard.sellerAnalytics.avgOrderValue}</p>
            </div>
          </div>

          {/* Views Chart */}
          {analyticsData.length > 0 && (
            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                <Icon name="EyeIcon" size={16} className="text-blue-600" />
                {t.manufacturerDashboard.sellerAnalytics.productViewsOverTime}
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
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#8A8680' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10, fill: '#8A8680' }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: '#fff', border: '1px solid #D4CFC8', borderRadius: 12, fontSize: 12 }} labelStyle={{ fontWeight: 700, color: '#1A1F1C' }} />
                  <Area type="monotone" dataKey="views" stroke="#C8611A" strokeWidth={2} fill="url(#viewsGradient)" name={t.manufacturerDashboard.sellerAnalytics.productViews} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Revenue Chart */}
          {analyticsData.length > 0 && (
            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                <Icon name="BanknotesIcon" size={16} className="text-green-600" />
                {t.manufacturerDashboard.sellerAnalytics.revenueAndOrders}
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={analyticsData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E8E4DE" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#8A8680' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10, fill: '#8A8680' }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: '#fff', border: '1px solid #D4CFC8', borderRadius: 12, fontSize: 12 }} labelStyle={{ fontWeight: 700, color: '#1A1F1C' }} />
                  <Bar dataKey="revenue" fill="#2E5E3E" radius={[4, 4, 0, 0]} name={t.manufacturerDashboard.sellerAnalytics.revenue} />
                  <Bar dataKey="orders" fill="#C8611A" radius={[4, 4, 0, 0]} name={t.manufacturerDashboard.sellerAnalytics.totalOrders} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Product Performance Table */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
              <Icon name="CubeIcon" size={16} className="text-primary" />
              {t.manufacturerDashboard.sellerAnalytics.productPerformance}
            </h3>
            {products.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">{t.manufacturerDashboard.sellerAnalytics.noProductsToAnalyze}</p>
            ) : (
              <div className="space-y-3">
                {products.slice(0, 8).map((product) => (
                  <div key={product.id} className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl">
                    <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                      <Icon name="CubeIcon" size={14} className="text-primary/60" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{product.name}</p>
                      <p className="text-[10px] text-muted-foreground">{product.category}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-bold text-foreground">{(product.unit_price || 0).toLocaleString()} SAR</p>
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
                      {product.inventory_status === 'in_stock' ? t.manufacturerDashboard.sellerAnalytics.inStock : product.inventory_status === 'low_stock' ? t.manufacturerDashboard.sellerAnalytics.low : t.manufacturerDashboard.sellerAnalytics.out}
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
