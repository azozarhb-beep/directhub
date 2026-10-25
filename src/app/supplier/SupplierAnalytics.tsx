'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { supplierUnitLabel } from './supplierUnits';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  Legend,
} from 'recharts';

interface SupplierAnalyticsProps {
  userId: string;
}

interface OrderRow {
  id: string;
  status: string | null;
  escrow_status: string | null;
  total: number | null;
  currency: string | null;
  created_at: string;
  items: unknown;
}

interface StockRow {
  item_name: string | null;
  sku: string;
  stock_quantity: number;
  reorder_level: number;
  unit: string | null;
  updated_at: string | null;
}

interface QuoteRow {
  id: string;
  status: string | null;
  checkout_order_id: string | null;
  created_at: string;
}

type Period = 7 | 30 | 90;

const CARD = 'bg-slate-900 border border-slate-800 rounded-2xl';
const TIP_STYLE = { background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 12 };

const FULFILLED_STATUSES = ['delivered', 'completed'];
const IN_TRANSIT_STATUSES = ['shipped', 'in_transit', 'out_for_delivery'];
const CANCELED_STATUSES = ['cancelled', 'canceled', 'refunded', 'rejected'];
const ESCROW_HELD_STATUSES = ['funds_secured', 'shipped', 'ready_for_inspection', 'pending_otp_confirmation', 'pending_admin_payout'];
const ESCROW_CLEARED_STATUSES = ['funds_released'];

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

function lineQty(li: any): number {
  const n = Number(li?.quantity ?? li?.qty ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function lineKey(li: any): string {
  return String(li?.sku ?? li?.product_name ?? li?.name ?? li?.title ?? '').trim().toLowerCase();
}

function lineLabel(li: any): string {
  return String(li?.product_name ?? li?.name ?? li?.title ?? li?.sku ?? '').trim();
}

function orderStage(o: OrderRow): 'canceled' | 'fulfilled' | 'transit' | 'active' {
  const s = (o.status || '').toLowerCase();
  const e = (o.escrow_status || '').toLowerCase();
  if (CANCELED_STATUSES.includes(s) || e === 'cancelled' || e === 'refund_processed') return 'canceled';
  if (FULFILLED_STATUSES.includes(s) || e === 'funds_released') return 'fulfilled';
  if (IN_TRANSIT_STATUSES.includes(s) || e === 'shipped') return 'transit';
  return 'active';
}

function growth(cur: number, prev: number): string | null {
  if (cur === 0 && prev === 0) return null;
  if (prev === 0) return '+100%';
  const pct = Math.round(((cur - prev) / prev) * 100);
  return `${pct > 0 ? '+' : ''}${pct}%`;
}

function GrowthBadge({ value }: { value: string | null }) {
  if (!value) return <span className="text-slate-500">—</span>;
  const up = value.startsWith('+');
  return <span className={up ? 'text-emerald-400' : 'text-red-400'}>{value}</span>;
}

export default function SupplierAnalytics({ userId }: SupplierAnalyticsProps) {
  const supabase = useMemo(() => createClient(), []);
  const [period, setPeriod] = useState<Period>(30);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [stock, setStock] = useState<StockRow[]>([]);
  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const since = new Date(Date.now() - 60 * 86400000 - period * 86400000).toISOString();
    const [oRes, sRes, qRes] = await Promise.all([
      supabase
        .from('orders')
        .select('id, status, escrow_status, total, currency, created_at, items')
        .eq('factory_user_id', userId)
        .gte('created_at', since)
        .order('created_at', { ascending: true })
        .limit(2000),
      supabase
        .from('local_inventory')
        .select('item_name, sku, stock_quantity, reorder_level, unit, updated_at')
        .eq('supplier_id', userId),
      supabase
        .from('custom_quotes')
        .select('id, status, checkout_order_id, created_at')
        .eq('factory_user_id', userId)
        .is('conversation_id', null)
        .order('created_at', { ascending: false })
        .limit(500),
    ]);
    if (oRes.error) setError(oRes.error.message);
    setOrders((oRes.data as OrderRow[]) ?? []);
    setStock((sRes.data as StockRow[]) ?? []);
    setQuotes((qRes.data as QuoteRow[]) ?? []);
    setLoading(false);
  }, [supabase, userId, period]);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    const now = Date.now();
    const cutoff = now - period * 86400000;
    const prevCutoff = now - period * 2 * 86400000;
    const inRange = (o: OrderRow, from: number, to: number) => {
      const t = new Date(o.created_at).getTime();
      return t >= from && t < to;
    };
    const countedRevenue = (o: OrderRow) => orderStage(o) !== 'canceled';
    const revenueOf = (list: OrderRow[]) => list.filter(countedRevenue).reduce((s, o) => s + Number(o.total || 0), 0);

    const inPeriod = orders.filter((o) => inRange(o, cutoff, now + 1));
    const inPrev = orders.filter((o) => inRange(o, prevCutoff, cutoff));

    // Weekly / monthly growth curves
    const weekNow = orders.filter((o) => inRange(o, now - 7 * 86400000, now + 1));
    const weekPrev = orders.filter((o) => inRange(o, now - 14 * 86400000, now - 7 * 86400000));
    const monthNow = orders.filter((o) => inRange(o, now - 30 * 86400000, now + 1));
    const monthPrev = orders.filter((o) => inRange(o, now - 60 * 86400000, now - 30 * 86400000));

    const dailySeries: { date: string; revenue: number }[] = [];
    const byDay = new Map<string, number>();
    for (let i = period - 1; i >= 0; i--) {
      byDay.set(dayKey(new Date(now - i * 86400000).toISOString()), 0);
    }
    inPeriod.filter(countedRevenue).forEach((o) => {
      const k = dayKey(o.created_at);
      if (byDay.has(k)) byDay.set(k, (byDay.get(k) || 0) + Number(o.total || 0));
    });
    byDay.forEach((v, k) => dailySeries.push({ date: k.slice(5), revenue: Math.round(v) }));

    const weeklySeries: { label: string; revenue: number }[] = [];
    for (let w = 7; w >= 0; w--) {
      const to = now - w * 7 * 86400000;
      const from = to - 7 * 86400000;
      weeklySeries.push({
        label: `أ${8 - w}`,
        revenue: Math.round(revenueOf(orders.filter((o) => inRange(o, from, to)))),
      });
    }
    const monthlySeries: { label: string; revenue: number }[] = [];
    for (let m = 2; m >= 0; m--) {
      const to = now - m * 30 * 86400000;
      const from = to - 30 * 86400000;
      monthlySeries.push({
        label: m === 0 ? 'هذا الشهر' : m === 1 ? 'الشهر الماضي' : 'قبل شهرين',
        revenue: Math.round(revenueOf(orders.filter((o) => inRange(o, from, to)))),
      });
    }

    // Order velocity
    const velocity = { active: 0, transit: 0, fulfilled: 0, canceled: 0 };
    inPeriod.forEach((o) => {
      velocity[orderStage(o)] += 1;
    });

    // Top selling items by commercial volume (with unit)
    const salesByKey = new Map<string, { label: string; units: number; revenue: number }>();
    inPeriod
      .filter(countedRevenue)
      .forEach((o) => {
        const lines = Array.isArray(o.items) ? (o.items as any[]) : [];
        lines.forEach((li) => {
          const k = lineKey(li);
          if (!k) return;
          const price = Number(li?.price ?? li?.unit_price ?? 0);
          const cur = salesByKey.get(k) || { label: lineLabel(li) || k, units: 0, revenue: 0 };
          cur.units += lineQty(li);
          cur.revenue += price * lineQty(li);
          salesByKey.set(k, cur);
        });
      });

    const findStock = (k: string) =>
      stock.find((r) => (r.sku || '').toLowerCase() === k || (r.item_name || '').toLowerCase() === k);

    const topItems = Array.from(salesByKey.entries())
      .map(([k, v]) => {
        const inv = findStock(k);
        return {
          key: k,
          name: v.label,
          units: v.units,
          revenue: v.revenue,
          unitLabel: inv ? supplierUnitLabel(inv.unit) : 'وحدة',
        };
      })
      .sort((a, b) => b.units - a.units)
      .slice(0, 8);

    // Deal links performance
    const totalLinks = quotes.length;
    const convertedLinks = quotes.filter((q) => q.status === 'accepted' || !!q.checkout_order_id).length;
    const pendingLinks = quotes.filter((q) => q.status === 'pending' && !q.checkout_order_id).length;
    const expiredLinks = quotes.filter((q) => q.status === 'expired' || q.status === 'rejected').length;
    const conversionRate = totalLinks > 0 ? (convertedLinks / totalLinks) * 100 : 0;

    // Inventory movement: fast vs slow
    const movement = stock.map((r) => {
      const k1 = (r.sku || '').toLowerCase();
      const k2 = (r.item_name || '').toLowerCase();
      const sold = (salesByKey.get(k1)?.units ?? 0) || (salesByKey.get(k2)?.units ?? 0);
      const onHand = Number(r.stock_quantity || 0);
      const velocityRatio = onHand + sold > 0 ? sold / (onHand + sold) : 0;
      return { row: r, sold, onHand, ratio: velocityRatio };
    });
    const fastMoving = movement
      .filter((m) => m.sold > 0 && m.ratio >= 0.3)
      .sort((a, b) => b.ratio - a.ratio)
      .slice(0, 6);
    const slowMoving = movement
      .filter((m) => m.onHand > 0 && (m.sold === 0 || m.ratio < 0.1))
      .sort((a, b) => b.onHand - a.onHand)
      .slice(0, 6);

    // Outflow (sold lines) / Inflow (restock updates) logs
    const outflowLog = inPeriod
      .filter(countedRevenue)
      .flatMap((o) => {
        const lines = Array.isArray(o.items) ? (o.items as any[]) : [];
        return lines
          .filter((li) => lineKey(li))
          .map((li) => ({
            at: o.created_at,
            name: lineLabel(li) || lineKey(li),
            qty: lineQty(li),
            unit: supplierUnitLabel(findStock(lineKey(li))?.unit),
          }));
      })
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 8);
    const inflowLog = stock
      .filter((r) => r.updated_at && new Date(r.updated_at).getTime() >= cutoff && Number(r.stock_quantity) > 0)
      .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))
      .slice(0, 8);
    const totalOutflow = Array.from(salesByKey.values()).reduce((s, v) => s + v.units, 0);
    const totalOnHand = stock.reduce((s, r) => s + Number(r.stock_quantity || 0), 0);

    const flowSeries: { date: string; outflow: number }[] = [];
    const outByDay = new Map<string, number>();
    for (let i = Math.min(period, 14) - 1; i >= 0; i--) {
      outByDay.set(dayKey(new Date(now - i * 86400000).toISOString()), 0);
    }
    inPeriod.filter(countedRevenue).forEach((o) => {
      const k = dayKey(o.created_at);
      if (!outByDay.has(k)) return;
      const lines = Array.isArray(o.items) ? (o.items as any[]) : [];
      outByDay.set(k, (outByDay.get(k) || 0) + lines.reduce((s, li) => s + lineQty(li), 0));
    });
    outByDay.forEach((v, k) => flowSeries.push({ date: k.slice(5), outflow: v }));

    // Depletion alerts by safety level
    const lowStock = stock
      .filter((r) => Number(r.reorder_level) > 0 && Number(r.stock_quantity) <= Number(r.reorder_level))
      .sort(
        (a, b) =>
          Number(a.stock_quantity) / Math.max(Number(a.reorder_level), 1) -
          Number(b.stock_quantity) / Math.max(Number(b.reorder_level), 1),
      );

    // Financial indicators (all orders loaded, not only the selected period)
    const heldFunds = orders
      .filter((o) => ESCROW_HELD_STATUSES.includes((o.escrow_status || '').toLowerCase()) && orderStage(o) !== 'canceled')
      .reduce((s, o) => s + Number(o.total || 0), 0);
    const heldCount = orders.filter((o) => ESCROW_HELD_STATUSES.includes((o.escrow_status || '').toLowerCase())).length;
    const clearedFunds = orders
      .filter((o) => ESCROW_CLEARED_STATUSES.includes((o.escrow_status || '').toLowerCase()))
      .reduce((s, o) => s + Number(o.total || 0), 0);
    const clearedCount = orders.filter((o) => ESCROW_CLEARED_STATUSES.includes((o.escrow_status || '').toLowerCase())).length;

    return {
      revenue: revenueOf(inPeriod),
      revenueGrowth: growth(revenueOf(inPeriod), revenueOf(inPrev)),
      weekRevenue: revenueOf(weekNow),
      weekGrowth: growth(revenueOf(weekNow), revenueOf(weekPrev)),
      monthRevenue: revenueOf(monthNow),
      monthGrowth: growth(revenueOf(monthNow), revenueOf(monthPrev)),
      dailySeries,
      weeklySeries,
      monthlySeries,
      velocity,
      orderTotal: inPeriod.length,
      topItems,
      totalLinks,
      convertedLinks,
      pendingLinks,
      expiredLinks,
      conversionRate,
      fastMoving,
      slowMoving,
      outflowLog,
      inflowLog,
      totalOutflow,
      totalOnHand,
      flowSeries,
      lowStock,
      heldFunds,
      heldCount,
      clearedFunds,
      clearedCount,
    };
  }, [orders, stock, quotes, period]);

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-black text-white">المؤشرات التجارية وحركة المخزون</h2>
          <p className="text-xs text-slate-400">أداء آخر {period} يوماً · جميع المبالغ بالريال اليمني (YER)</p>
        </div>
        <div className="flex gap-1.5">
          {([7, 30, 90] as Period[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`h-9 px-3 rounded-lg text-xs font-bold transition-colors ${period === p ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
            >
              {p} يوم
            </button>
          ))}
        </div>
      </div>

      {error && <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-sm rounded-xl px-3 py-2">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* ───────── 1. Sales movement KPIs ───────── */}
          <section className="space-y-4">
            <h3 className="text-sm font-black text-cyan-300">١. مؤشرات حركة المبيعات</h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className={`${CARD} p-4`}>
                <p className="text-[11px] text-slate-400">إجمالي المبيعات (الفترة)</p>
                <p className="text-xl font-black text-white mt-1">{fmt(stats.revenue)}</p>
                <p className="text-[11px] text-slate-500">
                  YER · <GrowthBadge value={stats.revenueGrowth} />
                </p>
              </div>
              <div className={`${CARD} p-4`}>
                <p className="text-[11px] text-slate-400">مبيعات آخر 7 أيام</p>
                <p className="text-xl font-black text-white mt-1">{fmt(stats.weekRevenue)}</p>
                <p className="text-[11px] text-slate-500">
                  YER · نمو أسبوعي <GrowthBadge value={stats.weekGrowth} />
                </p>
              </div>
              <div className={`${CARD} p-4`}>
                <p className="text-[11px] text-slate-400">مبيعات آخر 30 يوماً</p>
                <p className="text-xl font-black text-white mt-1">{fmt(stats.monthRevenue)}</p>
                <p className="text-[11px] text-slate-500">
                  YER · نمو شهري <GrowthBadge value={stats.monthGrowth} />
                </p>
              </div>
            </div>

            <div className={`${CARD} p-4`}>
              <h4 className="text-sm font-black text-white mb-3">منحنى إجمالي المبيعات اليومي (YER)</h4>
              <div className="h-56" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats.dailySeries}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="date" stroke="#64748b" fontSize={10} />
                    <YAxis stroke="#64748b" fontSize={10} />
                    <Tooltip contentStyle={TIP_STYLE} />
                    <Area type="monotone" dataKey="revenue" name="المبيعات (YER)" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.25} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className={`${CARD} p-4`}>
                <h4 className="text-sm font-black text-white mb-3">النمو الأسبوعي (آخر 8 أسابيع)</h4>
                <div className="h-48" dir="ltr">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={stats.weeklySeries}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="label" stroke="#64748b" fontSize={10} />
                      <YAxis stroke="#64748b" fontSize={10} />
                      <Tooltip contentStyle={TIP_STYLE} />
                      <Area type="monotone" dataKey="revenue" name="YER" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className={`${CARD} p-4`}>
                <h4 className="text-sm font-black text-white mb-3">النمو الشهري (آخر 3 أشهر)</h4>
                <div className="h-48" dir="ltr">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.monthlySeries}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="label" stroke="#64748b" fontSize={10} />
                      <YAxis stroke="#64748b" fontSize={10} />
                      <Tooltip contentStyle={TIP_STYLE} />
                      <Bar dataKey="revenue" name="YER" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Order velocity */}
            <div className={`${CARD} p-4`}>
              <h4 className="text-sm font-black text-white mb-3">حركة وتدفق الطلبات ({stats.orderTotal} طلب)</h4>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-3">
                  <p className="text-[11px] text-amber-300">نشطة (قيد المعالجة)</p>
                  <p className="text-xl font-black text-white mt-1">{stats.velocity.active}</p>
                </div>
                <div className="rounded-xl bg-sky-500/10 border border-sky-500/30 p-3">
                  <p className="text-[11px] text-sky-300">قيد الشحن</p>
                  <p className="text-xl font-black text-white mt-1">{stats.velocity.transit}</p>
                </div>
                <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3">
                  <p className="text-[11px] text-emerald-300">مكتملة التسليم</p>
                  <p className="text-xl font-black text-white mt-1">{stats.velocity.fulfilled}</p>
                </div>
                <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-3">
                  <p className="text-[11px] text-red-300">ملغاة</p>
                  <p className="text-xl font-black text-white mt-1">{stats.velocity.canceled}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Top selling */}
              <div className={`${CARD} p-4`}>
                <h4 className="text-sm font-black text-white mb-3">أعلى الأصناف مبيعاً وحركة</h4>
                {stats.topItems.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-8">لا توجد مبيعات في هذه الفترة</p>
                ) : (
                  <ol className="divide-y divide-slate-800">
                    {stats.topItems.map((t, i) => (
                      <li key={t.key} className="py-2.5 flex items-center gap-3 text-xs">
                        <span className="w-6 h-6 shrink-0 rounded-full bg-cyan-500/15 text-cyan-300 font-black flex items-center justify-center">
                          {i + 1}
                        </span>
                        <span className="flex-1 min-w-0 text-slate-200 truncate">{t.name}</span>
                        <span className="text-right shrink-0">
                          <span className="block text-white font-bold">
                            {fmt(t.units)} {t.unitLabel}
                          </span>
                          <span className="block text-[10px] text-slate-500">{fmt(t.revenue)} YER</span>
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>

              {/* Deal links */}
              <div className={`${CARD} p-4`}>
                <h4 className="text-sm font-black text-white mb-3">أداء صفقات الروابط المباشرة</h4>
                <div className="flex items-end gap-3 mb-4">
                  <p className="text-4xl font-black text-pink-300">{stats.conversionRate.toFixed(0)}%</p>
                  <p className="text-xs text-slate-400 pb-1">معدل تحويل روابط الصفقات إلى طلبات</p>
                </div>
                <div className="h-2.5 rounded-full bg-slate-800 overflow-hidden mb-4">
                  <div className="h-full bg-pink-500" style={{ width: `${Math.min(100, stats.conversionRate)}%` }} />
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-slate-800/60 p-2.5">
                    <p className="text-slate-400">روابط منشأة</p>
                    <p className="text-white font-black text-base">{stats.totalLinks}</p>
                  </div>
                  <div className="rounded-lg bg-emerald-500/10 p-2.5">
                    <p className="text-emerald-300">تحولت لصفقة</p>
                    <p className="text-white font-black text-base">{stats.convertedLinks}</p>
                  </div>
                  <div className="rounded-lg bg-amber-500/10 p-2.5">
                    <p className="text-amber-300">بانتظار العميل</p>
                    <p className="text-white font-black text-base">{stats.pendingLinks}</p>
                  </div>
                  <div className="rounded-lg bg-slate-800/60 p-2.5">
                    <p className="text-slate-400">منتهية / مرفوضة</p>
                    <p className="text-white font-black text-base">{stats.expiredLinks}</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ───────── 2. Inventory movement ───────── */}
          <section className="space-y-4">
            <h3 className="text-sm font-black text-cyan-300">٢. مؤشرات حركة المخزون والمستودع</h3>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className={`${CARD} p-4`}>
                <h4 className="text-sm font-black text-emerald-300 mb-3">الأصناف سريعة الحركة</h4>
                {stats.fastMoving.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-6">لا توجد أصناف سريعة الحركة في هذه الفترة</p>
                ) : (
                  <ul className="divide-y divide-slate-800">
                    {stats.fastMoving.map((m) => (
                      <li key={m.row.sku} className="py-2 flex items-center justify-between gap-2 text-xs">
                        <span className="text-slate-200 truncate">{m.row.item_name || m.row.sku}</span>
                        <span className="text-slate-400 shrink-0">
                          مباع {fmt(m.sold)} · متاح {fmt(m.onHand)} {supplierUnitLabel(m.row.unit)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className={`${CARD} p-4`}>
                <h4 className="text-sm font-black text-amber-300 mb-3">البضائع الراكدة (بطيئة الحركة)</h4>
                {stats.slowMoving.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-6">لا توجد بضائع راكدة</p>
                ) : (
                  <ul className="divide-y divide-slate-800">
                    {stats.slowMoving.map((m) => (
                      <li key={m.row.sku} className="py-2 flex items-center justify-between gap-2 text-xs">
                        <span className="text-slate-200 truncate">{m.row.item_name || m.row.sku}</span>
                        <span className="text-slate-400 shrink-0">
                          راكد {fmt(m.onHand)} {supplierUnitLabel(m.row.unit)} · مباع {fmt(m.sold)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className={`${CARD} p-4`}>
              <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                <h4 className="text-sm font-black text-white">حركة الوارد والصادر من المستودع</h4>
                <p className="text-[11px] text-slate-400">
                  الصادر خلال الفترة {fmt(stats.totalOutflow)} · الرصيد الحالي {fmt(stats.totalOnHand)}
                </p>
              </div>
              <div className="h-44 mb-4" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.flowSeries}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="date" stroke="#64748b" fontSize={10} />
                    <YAxis stroke="#64748b" fontSize={10} />
                    <Tooltip contentStyle={TIP_STYLE} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="outflow" name="الصادر (وحدات)" fill="#f97316" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-bold text-orange-300 mb-2">سجل الصادر (مبيعات)</p>
                  {stats.outflowLog.length === 0 ? (
                    <p className="text-xs text-slate-500 py-3">لا يوجد صادر في هذه الفترة</p>
                  ) : (
                    <ul className="divide-y divide-slate-800">
                      {stats.outflowLog.map((l, i) => (
                        <li key={`${l.at}-${i}`} className="py-1.5 flex items-center justify-between gap-2 text-xs">
                          <span className="text-slate-200 truncate">{l.name}</span>
                          <span className="text-orange-300 shrink-0">
                            −{fmt(l.qty)} {l.unit} · {l.at.slice(5, 10)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <p className="text-xs font-bold text-emerald-300 mb-2">سجل الوارد (تحديثات رصيد المستودع)</p>
                  {stats.inflowLog.length === 0 ? (
                    <p className="text-xs text-slate-500 py-3">لا توجد تحديثات وارد في هذه الفترة</p>
                  ) : (
                    <ul className="divide-y divide-slate-800">
                      {stats.inflowLog.map((r) => (
                        <li key={`${r.sku}-${r.updated_at}`} className="py-1.5 flex items-center justify-between gap-2 text-xs">
                          <span className="text-slate-200 truncate">{r.item_name || r.sku}</span>
                          <span className="text-emerald-300 shrink-0">
                            رصيد {fmt(Number(r.stock_quantity))} {supplierUnitLabel(r.unit)} · {String(r.updated_at).slice(5, 10)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>

            <div className={`${CARD} p-4`}>
              <h4 className="text-sm font-black text-white mb-3">تنبيهات قرب نفاد المخزون (حد الأمان)</h4>
              {stats.lowStock.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">جميع الأصناف أعلى من حد الأمان</p>
              ) : (
                <ul className="divide-y divide-slate-800">
                  {stats.lowStock.map((r) => {
                    const pct = Math.min(100, (Number(r.stock_quantity) / Math.max(Number(r.reorder_level), 1)) * 100);
                    const empty = Number(r.stock_quantity) <= 0;
                    return (
                      <li key={r.sku} className="py-2.5 text-xs">
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="text-slate-200 truncate">{r.item_name || r.sku}</span>
                          <span className={`shrink-0 font-bold ${empty ? 'text-red-400' : 'text-amber-300'}`}>
                            {empty ? 'نفد المخزون' : 'قرب النفاد'} · المتاح {fmt(Number(r.stock_quantity))} / الحد {fmt(Number(r.reorder_level))}{' '}
                            {supplierUnitLabel(r.unit)}
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                          <div className={`h-full ${empty ? 'bg-red-500' : 'bg-amber-400'}`} style={{ width: `${pct}%` }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>

          {/* ───────── 3. Financial & cash flow ───────── */}
          <section className="space-y-4">
            <h3 className="text-sm font-black text-cyan-300">٣. مؤشرات التدفق المالي</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-2xl p-5 bg-gradient-to-br from-blue-600/25 to-blue-900/10 border border-blue-500/30">
                <p className="text-[11px] text-blue-300">أموال الضمان المالي المعلقة قيد التسليم</p>
                <p className="text-2xl font-black text-white mt-1">{fmt(stats.heldFunds)}</p>
                <p className="text-[11px] text-slate-400">YER · {stats.heldCount} طلب بانتظار تأكيد الاستلام</p>
              </div>
              <div className="rounded-2xl p-5 bg-gradient-to-br from-emerald-600/25 to-emerald-900/10 border border-emerald-500/30">
                <p className="text-[11px] text-emerald-300">الأرباح المحررة الجاهزة للتحويل البنكي</p>
                <p className="text-2xl font-black text-white mt-1">{fmt(stats.clearedFunds)}</p>
                <p className="text-[11px] text-slate-400">YER · {stats.clearedCount} طلب تم تحرير أمواله</p>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
