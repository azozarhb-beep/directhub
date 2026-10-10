'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import Icon from '@/components/ui/AppIcon';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

interface PlatformKPIs {
  totalRevenue: number;
  revenueGrowth: number;
  totalOrders: number;
  ordersGrowth: number;
  totalUsers: number;
  usersGrowth: number;
  platformCommission: number;
  commissionGrowth: number;
  avgOrderValue: number;
  conversionRate: number;
  activeFactories: number;
  openRFQs: number;
  disputeRate: number;
  deliverySuccessRate: number;
}

interface MonthlyData {
  month: string;
  revenue: number;
  orders: number;
  users: number;
  commission: number;
}

interface OrderStatusDist {
  name: string;
  value: number;
  color: string;
}

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];


export default function AnalyticsDashboard() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const supabase = createClient();
  const { t, dir, isRTL, language } = useLanguage();
  const pg = t.analyticsPage;

  const [kpis, setKpis] = useState<PlatformKPIs>({
    totalRevenue: 0, revenueGrowth: 0, totalOrders: 0, ordersGrowth: 0,
    totalUsers: 0, usersGrowth: 0, platformCommission: 0, commissionGrowth: 0,
    avgOrderValue: 0, conversionRate: 0, activeFactories: 0, openRFQs: 0,
    disputeRate: 0, deliverySuccessRate: 0,
  });
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [orderStatusDist, setOrderStatusDist] = useState<OrderStatusDist[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeMetric, setActiveMetric] = useState<'revenue' | 'orders' | 'users' | 'commission'>('revenue');
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d');

  const userRole = user?.user_metadata?.role || 'buyer';
  const isAdmin = userRole === 'admin';

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/login'); return; }
    if (!isAdmin) { router.push('/'); return; }
  }, [user, authLoading, isAdmin, router]);

  const fetchAnalytics = useCallback(async () => {
    if (!user || !isAdmin) return;
    setLoading(true);
    try {
      // Fetch only last 90 days of orders for performance — sufficient for all KPI calculations
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

      const [ordersRes, usersRes, factoriesRes, rfqsRes] = await Promise.all([
        supabase
          .from('orders')
          .select('id, status, total, created_at, dispute_status')
          .gte('created_at', ninetyDaysAgo)
          .order('created_at', { ascending: false })
          .limit(300),
        supabase
          .from('user_profiles')
          .select('id, created_at')
          .gte('created_at', ninetyDaysAgo)
          .limit(300),
        supabase
          .from('factory_registrations')
          .select('id, is_active, kyc_status')
          .limit(100),
        supabase
          .from('rfq_requests')
          .select('id, status')
          .limit(100),
      ]);

      const orders = ordersRes.data || [];
      const users = usersRes.data || [];
      const factories = factoriesRes.data || [];
      const rfqs = rfqsRes.data || [];

      const deliveredOrders = orders.filter((o: any) => o.status === 'delivered');
      const totalRevenue = deliveredOrders.reduce((s: number, o: any) => s + (o.total || 0), 0);
      const platformCommission = totalRevenue * 0.03;
      const avgOrderValue = deliveredOrders.length > 0 ? totalRevenue / deliveredOrders.length : 0;
      const disputedOrders = orders.filter((o: any) => o.dispute_status && !['none', null].includes(o.dispute_status));
      const disputeRate = orders.length > 0 ? (disputedOrders.length / orders.length) * 100 : 0;
      const deliverySuccessRate = orders.length > 0 ? (deliveredOrders.length / orders.length) * 100 : 0;

      // Current month vs last month for growth
      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

      const thisMonthOrders = orders.filter((o: any) => new Date(o.created_at) >= thisMonthStart);
      const lastMonthOrders = orders.filter((o: any) => new Date(o.created_at) >= lastMonthStart && new Date(o.created_at) < thisMonthStart);
      const ordersGrowth = lastMonthOrders.length > 0 ? ((thisMonthOrders.length - lastMonthOrders.length) / lastMonthOrders.length) * 100 : 0;

      const thisMonthRevenue = thisMonthOrders.filter((o: any) => o.status === 'delivered').reduce((s: number, o: any) => s + (o.total || 0), 0);
      const lastMonthRevenue = lastMonthOrders.filter((o: any) => o.status === 'delivered').reduce((s: number, o: any) => s + (o.total || 0), 0);
      const revenueGrowth = lastMonthRevenue > 0 ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 : 0;

      const thisMonthUsers = users.filter((u: any) => new Date(u.created_at) >= thisMonthStart);
      const lastMonthUsers = users.filter((u: any) => new Date(u.created_at) >= lastMonthStart && new Date(u.created_at) < thisMonthStart);
      const usersGrowth = lastMonthUsers.length > 0 ? ((thisMonthUsers.length - lastMonthUsers.length) / lastMonthUsers.length) * 100 : 0;

      setKpis({
        totalRevenue,
        revenueGrowth,
        totalOrders: orders.length,
        ordersGrowth,
        totalUsers: users.length,
        usersGrowth,
        platformCommission,
        commissionGrowth: revenueGrowth,
        avgOrderValue,
        conversionRate: 0,
        activeFactories: factories.filter((f: any) => f.is_active).length,
        openRFQs: rfqs.filter((r: any) => r.status === 'open').length,
        disputeRate,
        deliverySuccessRate,
      });

      // Build monthly data (last 6 months)
      const monthly: MonthlyData[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const nextD = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
        const mOrders = orders.filter((o: any) => {
          const t = new Date(o.created_at);
          return t >= d && t < nextD;
        });
        const mRevenue = mOrders.filter((o: any) => o.status === 'delivered').reduce((s: number, o: any) => s + (o.total || 0), 0);
        const mUsers = users.filter((u: any) => {
          const t = new Date(u.created_at);
          return t >= d && t < nextD;
        });
        monthly.push({
          month: (pg.months as string[])[d.getMonth()],
          revenue: Math.round(mRevenue),
          orders: mOrders.length,
          users: mUsers.length,
          commission: Math.round(mRevenue * 0.03),
        });
      }
      setMonthlyData(monthly);

      // Order status distribution
      const statusCounts = {
        pending: orders.filter((o: any) => o.status === 'pending').length,
        processing: orders.filter((o: any) => o.status === 'processing').length,
        shipped: orders.filter((o: any) => o.status === 'shipped').length,
        delivered: orders.filter((o: any) => o.status === 'delivered').length,
        cancelled: orders.filter((o: any) => o.status === 'cancelled').length,
      };
      setOrderStatusDist([
        { name: pg.statusDelivered, value: statusCounts.delivered, color: '#10b981' },
        { name: pg.statusProcessing, value: statusCounts.processing, color: '#3b82f6' },
        { name: pg.statusShipped, value: statusCounts.shipped, color: '#8b5cf6' },
        { name: pg.statusPending, value: statusCounts.pending, color: '#f59e0b' },
        { name: pg.statusCancelled, value: statusCounts.cancelled, color: '#ef4444' },
      ].filter((s) => s.value > 0));
    } catch (err) {
      console.error('Analytics fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [user, isAdmin, supabase, language, pg]);

  useEffect(() => {
    if (user && isAdmin) fetchAnalytics();
  }, [user, isAdmin, fetchAnalytics]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">{pg.loadingAnalytics}</p>
        </div>
      </div>
    );
  }

  const metricConfig = {
    revenue: { label: pg.revenue, color: '#3b82f6', dataKey: 'revenue', prefix: '$' },
    orders: { label: pg.orders, color: '#10b981', dataKey: 'orders', prefix: '' },
    users: { label: pg.users, color: '#8b5cf6', dataKey: 'users', prefix: '' },
    commission: { label: pg.commission, color: '#f59e0b', dataKey: 'commission', prefix: '$' },
  };

  const activeMetricCfg = metricConfig[activeMetric];

  return (
    <div className="min-h-screen bg-background" dir={dir}>
      <Header />
      <main className="max-w-7xl mx-auto px-4 md:px-6 py-6 pb-24 md:pb-8">

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {pg.performanceTitle}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {pg.performanceSubtitle}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {(['7d', '30d', '90d', '1y'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  dateRange === range ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                {range}
              </button>
            ))}
            <button onClick={fetchAnalytics} className="w-8 h-8 flex items-center justify-center bg-muted rounded-lg hover:bg-muted/80 transition-colors" title={pg.refresh}>
              <Icon name="ArrowPathIcon" size={14} className="text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            {
              label: pg.totalRevenue,
              value: `$${kpis.totalRevenue.toLocaleString()}`,
              growth: kpis.revenueGrowth,
              icon: 'BanknotesIcon',
              color: 'text-blue-600',
              bg: 'bg-blue-50',
            },
            {
              label: pg.totalOrders,
              value: kpis.totalOrders.toLocaleString(),
              growth: kpis.ordersGrowth,
              icon: 'ShoppingBagIcon',
              color: 'text-emerald-600',
              bg: 'bg-emerald-50',
            },
            {
              label: pg.totalUsers,
              value: kpis.totalUsers.toLocaleString(),
              growth: kpis.usersGrowth,
              icon: 'UsersIcon',
              color: 'text-purple-600',
              bg: 'bg-purple-50',
            },
            {
              label: pg.platformCommission,
              value: `$${kpis.platformCommission.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
              growth: kpis.commissionGrowth,
              icon: 'CurrencyDollarIcon',
              color: 'text-amber-600',
              bg: 'bg-amber-50',
            },
          ].map((kpi, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-start justify-between mb-3">
                <div className={`w-9 h-9 ${kpi.bg} rounded-lg flex items-center justify-center`}>
                  <Icon name={kpi.icon as any} size={18} className={kpi.color} />
                </div>
                <span className={`text-xs font-semibold flex items-center gap-0.5 ${kpi.growth >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  <Icon name={kpi.growth >= 0 ? 'ArrowTrendingUpIcon' : 'ArrowTrendingDownIcon'} size={12} />
                  {Math.abs(kpi.growth).toFixed(1)}%
                </span>
              </div>
              <p className="text-xl font-bold text-foreground">{kpi.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{kpi.label}</p>
            </div>
          ))}
        </div>

        {/* Secondary KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: pg.avgOrderValue, value: `$${kpis.avgOrderValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, icon: 'ChartBarIcon' },
            { label: pg.activeFactories, value: kpis.activeFactories, icon: 'BuildingOffice2Icon' },
            { label: pg.deliveryRate, value: `${kpis.deliverySuccessRate.toFixed(1)}%`, icon: 'TruckIcon' },
            { label: pg.disputeRate, value: `${kpis.disputeRate.toFixed(1)}%`, icon: 'ScaleIcon' },
          ].map((item, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
              <div className="w-9 h-9 bg-muted rounded-lg flex items-center justify-center shrink-0">
                <Icon name={item.icon as any} size={16} className="text-muted-foreground" />
              </div>
              <div>
                <p className="text-lg font-bold text-foreground">{item.value}</p>
                <p className="text-xs text-muted-foreground">{item.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Main Chart */}
        <div className="bg-card border border-border rounded-xl p-5 mb-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
            <h2 className="font-semibold text-foreground">{pg.monthlyTrends}</h2>
            <div className="flex gap-1 bg-muted/50 p-1 rounded-lg">
              {(Object.keys(metricConfig) as Array<keyof typeof metricConfig>).map((key) => (
                <button
                  key={key}
                  onClick={() => setActiveMetric(key)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                    activeMetric === key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {metricConfig[key].label}
                </button>
              ))}
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="colorMetric" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={activeMetricCfg.color} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={activeMetricCfg.color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false}
                  tickFormatter={(v) => `${activeMetricCfg.prefix}${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`} />
                <Tooltip
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                  formatter={(value: any) => [`${activeMetricCfg.prefix}${Number(value).toLocaleString()}`, activeMetricCfg.label]}
                />
                <Area type="monotone" dataKey={activeMetricCfg.dataKey} stroke={activeMetricCfg.color} strokeWidth={2} fill="url(#colorMetric)" dot={{ fill: activeMetricCfg.color, r: 3 }} activeDot={{ r: 5 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bottom Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Orders Bar Chart */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="font-semibold text-foreground mb-5">{pg.monthlyOrders}</h2>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                  <Bar dataKey="orders" fill="#3b82f6" radius={[4, 4, 0, 0]} name={pg.orders} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Order Status Pie */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="font-semibold text-foreground mb-5">{pg.statusDistribution}</h2>
            {orderStatusDist.length === 0 ? (
              <div className="h-52 flex items-center justify-center">
                <p className="text-sm text-muted-foreground">{pg.noData}</p>
              </div>
            ) : (
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={orderStatusDist} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                      {orderStatusDist.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                      formatter={(value: any, name: any) => [value, name]}
                    />
                    <Legend formatter={(value) => value} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
