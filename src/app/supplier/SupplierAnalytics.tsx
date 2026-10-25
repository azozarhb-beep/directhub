'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

interface SupplierAnalyticsProps {
  userId: string;
}

interface OrderRow {
  id: string;
  status: string;
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
}

type Period = 7 | 30 | 90;

const CARD = 'bg-slate-900 border border-slate-800 rounded-2xl';

const SOLD_STATUSES = ['confirmed', 'processing', 'shipped', 'delivered', 'completed'];

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function lineQty(li: any): number {
  const n = Number(li?.quantity ?? li?.qty ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function lineKey(li: any): string {
  return String(li?.sku ?? li?.product_name ?? li?.name ?? li?.title ?? '').trim().toLowerCase();
}

export default function SupplierAnalytics({ userId }: SupplierAnalyticsProps) {
  const supabase = useMemo(() => createClient(), []);
  const [period, setPeriod] = useState<Period>(30);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [stock, setStock] = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const since = new Date(Date.now() - period * 2 * 86400000).toISOString();
    const [oRes, sRes] = await Promise.all([
      supabase
        .from('orders')
        .select('id, status, total, currency, created_at, items')
        .eq('factory_user_id', userId)
        .gte('created_at', since)
        .order('created_at', { ascending: true })
        .limit(1000),
      supabase.from('local_inventory').select('item_name, sku, stock_quantity, reorder_level').eq('supplier_id', userId),
    ]);
    if (oRes.error) setError(oRes.error.message);
    setOrders((oRes.data as OrderRow[]) ?? []);
    setStock((sRes.data as StockRow[]) ?? []);
    setLoading(false);
  }, [supabase, userId, period]);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    const cutoff = Date.now() - period * 86400000;
    const prevCutoff = Date.now() - period * 2 * 86400000;
    const inPeriod = orders.filter((o) => new Date(o.created_at).getTime() >= cutoff);
    const inPrev = orders.filter((o) => {
      const t = new Date(o.created_at).getTime();
      return t >= prevCutoff && t < cutoff;
    });
    const sold = (list: OrderRow[]) => list.filter((o) => SOLD_STATUSES.includes(o.status));
    const revenue = (list: OrderRow[]) => sold(list).reduce((s, o) => s + Number(o.total || 0), 0);

    const soldNow = sold(inPeriod);
    const unitsByKey = new Map<string, number>();
    soldNow.forEach((o) => {
      const lines = Array.isArray(o.items) ? (o.items as any[]) : [];
      lines.forEach((li) => {
        const k = lineKey(li);
        if (!k) return;
        unitsByKey.set(k, (unitsByKey.get(k) || 0) + lineQty(li));
      });
    });
    const unitsSold = Array.from(unitsByKey.values()).reduce((a, b) => a + b, 0);

    const totalStock = stock.reduce((s, r) => s + Number(r.stock_quantity || 0), 0);
    const avgStock = totalStock + unitsSold / 2;
    const turnover = avgStock > 0 ? unitsSold / avgStock : 0;

    const byDay = new Map<string, { revenue: number; orders: number }>();
    for (let i = period - 1; i >= 0; i--) {
      byDay.set(dayKey(new Date(Date.now() - i * 86400000).toISOString()), { revenue: 0, orders: 0 });
    }
    soldNow.forEach((o) => {
      const k = dayKey(o.created_at);
      const cur = byDay.get(k);
      if (cur) {
        cur.revenue += Number(o.total || 0);
        cur.orders += 1;
      }
    });
    const series = Array.from(byDay.entries()).map(([date, v]) => ({ date: date.slice(5), revenue: Math.round(v.revenue), orders: v.orders }));

    const topItems = Array.from(unitsByKey.entries())
      .map(([name, units]) => {
        const inv = stock.find((r) => (r.sku || '').toLowerCase() === name || (r.item_name || '').toLowerCase() === name);
        const onHand = inv ? Number(inv.stock_quantity || 0) : null;
        return { name, units, onHand, rotation: onHand !== null && onHand + units > 0 ? units / (onHand + units) : null };
      })
      .sort((a, b) => b.units - a.units)
      .slice(0, 8);

    const lowStock = stock.filter((r) => Number(r.reorder_level) > 0 && Number(r.stock_quantity) <= Number(r.reorder_level));

    const growth = (cur: number, prev: number): string | null => {
      if (cur === 0 && prev === 0) return null;
      if (prev === 0) return '+100%';
      const pct = Math.round(((cur - prev) / prev) * 100);
      return `${pct > 0 ? '+' : ''}${pct}%`;
    };

    return {
      revenue: revenue(inPeriod),
      revenueGrowth: growth(revenue(inPeriod), revenue(inPrev)),
      orderCount: soldNow.length,
      ordersGrowth: growth(soldNow.length, sold(inPrev).length),
      unitsSold,
      turnover,
      series,
      topItems,
      lowStock,
      totalStock,
    };
  }, [orders, stock, period]);

  return (
    <div className="space-y-5" dir="rtl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-black text-white">تحليلات المبيعات ومعدل دوران المخزون</h2>
          <p className="text-xs text-slate-400">أداء آخر {period} يوماً</p>
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
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className={`${CARD} p-4`}>
              <p className="text-[11px] text-slate-400">إجمالي المبيعات</p>
              <p className="text-lg font-black text-white mt-1">{Math.round(stats.revenue).toLocaleString('en-US')}</p>
              <p className="text-[11px] text-slate-500">YER {stats.revenueGrowth ? `· ${stats.revenueGrowth}` : ''}</p>
            </div>
            <div className={`${CARD} p-4`}>
              <p className="text-[11px] text-slate-400">عدد الطلبات المنفذة</p>
              <p className="text-lg font-black text-white mt-1">{stats.orderCount}</p>
              <p className="text-[11px] text-slate-500">{stats.ordersGrowth ?? '—'}</p>
            </div>
            <div className={`${CARD} p-4`}>
              <p className="text-[11px] text-slate-400">الوحدات المباعة</p>
              <p className="text-lg font-black text-white mt-1">{stats.unitsSold.toLocaleString('en-US')}</p>
              <p className="text-[11px] text-slate-500">المخزون الحالي {stats.totalStock.toLocaleString('en-US')}</p>
            </div>
            <div className={`${CARD} p-4`}>
              <p className="text-[11px] text-slate-400">معدل دوران المخزون</p>
              <p className="text-lg font-black text-violet-300 mt-1">{stats.turnover.toFixed(2)}x</p>
              <p className="text-[11px] text-slate-500">خلال الفترة</p>
            </div>
          </div>

          <div className={`${CARD} p-4`}>
            <h3 className="text-sm font-black text-white mb-3">المبيعات اليومية</h3>
            <div className="h-56" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.series}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={10} />
                  <YAxis stroke="#64748b" fontSize={10} />
                  <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} />
                  <Area type="monotone" dataKey="revenue" name="المبيعات" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.25} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className={`${CARD} p-4`}>
              <h3 className="text-sm font-black text-white mb-3">الأصناف الأكثر مبيعاً</h3>
              {stats.topItems.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">لا توجد مبيعات في هذه الفترة</p>
              ) : (
                <>
                  <div className="h-44 mb-3" dir="ltr">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.topItems}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="name" stroke="#64748b" fontSize={10} />
                        <YAxis stroke="#64748b" fontSize={10} />
                        <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} />
                        <Bar dataKey="units" name="الوحدات المباعة" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="divide-y divide-slate-800">
                    {stats.topItems.map((t) => (
                      <li key={t.name} className="py-2 flex items-center justify-between text-xs gap-2">
                        <span className="text-slate-200 truncate">{t.name}</span>
                        <span className="text-slate-400 shrink-0">
                          {t.units} مباع{t.rotation !== null ? ` · دوران ${(t.rotation * 100).toFixed(0)}%` : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>

            <div className={`${CARD} p-4`}>
              <h3 className="text-sm font-black text-white mb-3">تنبيهات المخزون المنخفض</h3>
              {stats.lowStock.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">لا توجد أصناف تحت حد إعادة الطلب</p>
              ) : (
                <ul className="divide-y divide-slate-800">
                  {stats.lowStock.map((r) => (
                    <li key={r.sku} className="py-2 flex items-center justify-between text-xs gap-2">
                      <span className="text-slate-200 truncate">{r.item_name || r.sku}</span>
                      <span className="text-red-300 shrink-0">المتاح {r.stock_quantity} / الحد {r.reorder_level}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
