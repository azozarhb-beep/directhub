'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import Icon from '@/components/ui/AppIcon';

export type AnalyticsPeriod = '7d' | '30d' | '90d';

export interface CountryExport {
  country: string;
  country_ar: string;
  volume: number;
  shipments: number;
}

interface ExportShipmentRecord {
  id: string;
  country: string;
  country_ar: string;
  volume: number;
  /** Days before today the shipment was completed */
  daysAgo: number;
  product_ar: string;
  buyer: string;
  tons: number;
}

/** Source dataset: individual completed export shipments with age in days. */
export const EXPORT_SHIPMENTS: ExportShipmentRecord[] = [
  { id: 'EXP-1012', country: 'Saudi Arabia', country_ar: 'السعودية', volume: 38000, daysAgo: 3, product_ar: 'رولات أفلام التغليف', buyer: 'Al-Rajhi Trading', tons: 21 },
  { id: 'EXP-1011', country: 'Saudi Arabia', country_ar: 'السعودية', volume: 30000, daysAgo: 9, product_ar: 'حبيبات بلاستيك', buyer: 'Gulf Packaging Co.', tons: 18 },
  { id: 'EXP-1010', country: 'Saudi Arabia', country_ar: 'السعودية', volume: 32000, daysAgo: 21, product_ar: 'رولات أفلام التغليف', buyer: 'Al-Rajhi Trading', tons: 19 },
  { id: 'EXP-1007', country: 'Saudi Arabia', country_ar: 'السعودية', volume: 28000, daysAgo: 58, product_ar: 'مواد خام', buyer: 'Najd Industrial', tons: 16 },
  { id: 'EXP-1009', country: 'UAE', country_ar: 'الإمارات', volume: 36000, daysAgo: 6, product_ar: 'حبيبات بلاستيك', buyer: 'Emirates Polymers', tons: 22 },
  { id: 'EXP-1008', country: 'UAE', country_ar: 'الإمارات', volume: 34000, daysAgo: 27, product_ar: 'رولات أفلام التغليف', buyer: 'Emirates Polymers', tons: 20 },
  { id: 'EXP-1004', country: 'UAE', country_ar: 'الإمارات', volume: 24000, daysAgo: 71, product_ar: 'مواد خام', buyer: 'Dubai Pack LLC', tons: 14 },
  { id: 'EXP-1006', country: 'Oman', country_ar: 'عمان', volume: 31000, daysAgo: 14, product_ar: 'حبيبات بلاستيك', buyer: 'Muscat Plastics', tons: 17 },
  { id: 'EXP-1003', country: 'Oman', country_ar: 'عمان', volume: 30000, daysAgo: 64, product_ar: 'رولات أفلام التغليف', buyer: 'Muscat Plastics', tons: 17 },
  { id: 'EXP-1005', country: 'Yemen', country_ar: 'اليمن', volume: 18000, daysAgo: 12, product_ar: 'مواد خام', buyer: 'Sanaa Trading', tons: 11 },
  { id: 'EXP-1002', country: 'Yemen', country_ar: 'اليمن', volume: 15000, daysAgo: 45, product_ar: 'حبيبات بلاستيك', buyer: 'Aden Industries', tons: 9 },
  { id: 'EXP-1001', country: 'Egypt', country_ar: 'مصر', volume: 17000, daysAgo: 82, product_ar: 'مواد خام', buyer: 'Cairo Chem', tons: 10 },
];

export const PERIOD_DAYS: Record<AnalyticsPeriod, number> = { '7d': 7, '30d': 30, '90d': 90 };

/** Shipments that fall inside the selected period (0..days ago). */
export function getShipmentsForPeriod(period: AnalyticsPeriod): ExportShipmentRecord[] {
  const days = PERIOD_DAYS[period];
  return EXPORT_SHIPMENTS.filter((s) => s.daysAgo < days);
}

/** Shipments inside the previous equivalent period (days..2*days ago). */
export function getPreviousShipmentsForPeriod(period: AnalyticsPeriod): ExportShipmentRecord[] {
  const days = PERIOD_DAYS[period];
  return EXPORT_SHIPMENTS.filter((s) => s.daysAgo >= days && s.daysAgo < days * 2);
}

export function aggregateByCountry(records: ExportShipmentRecord[]): CountryExport[] {
  const map = new Map<string, CountryExport>();
  records.forEach((r) => {
    const existing = map.get(r.country);
    if (existing) {
      existing.volume += r.volume;
      existing.shipments += 1;
    } else {
      map.set(r.country, { country: r.country, country_ar: r.country_ar, volume: r.volume, shipments: 1 });
    }
  });
  return Array.from(map.values()).sort((a, b) => b.volume - a.volume);
}

export function getExportByCountry(period: AnalyticsPeriod): CountryExport[] {
  return aggregateByCountry(getShipmentsForPeriod(period));
}

export const EXPORT_BY_COUNTRY: CountryExport[] = getExportByCountry('90d');

export const TOTAL_EXPORT_VOLUME_USD: number = EXPORT_BY_COUNTRY.reduce((s, c) => s + c.volume, 0);

function formatUSD(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
}

/** Proper Arabic plural for "shipment". */
export function formatShipmentsAr(n: number): string {
  if (n === 1) return 'شحنة واحدة';
  if (n === 2) return 'شحنتان';
  if (n >= 3 && n <= 10) return `${n} شحنات`;
  return `${n} شحنة`;
}

const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

type DrilldownKey = 'shipments' | 'volume' | 'topMarket' | 'avg' | null;

/** Month bucket label based on shipment age, relative to the current date (computed client-side only). */
function monthLabel(daysAgo: number, now: Date): string {
  const d = new Date(now.getTime() - daysAgo * 86400000);
  return MONTHS_AR[d.getMonth()];
}

function monthOrderKey(daysAgo: number, now: Date): number {
  const d = new Date(now.getTime() - daysAgo * 86400000);
  return d.getFullYear() * 12 + d.getMonth();
}

interface ExportVolumeKPIsProps {
  period?: AnalyticsPeriod;
}

export default function ExportVolumeKPIs({ period = '30d' }: ExportVolumeKPIsProps) {
  const [active, setActive] = useState<DrilldownKey>(null);
  const [now, setNow] = useState<Date | null>(null);

  React.useEffect(() => {
    setNow(new Date());
  }, []);

  const records = useMemo(() => getShipmentsForPeriod(period), [period]);
  const data = useMemo(() => aggregateByCountry(records), [records]);
  const total = data.reduce((s, c) => s + c.volume, 0);
  const shipments = data.reduce((s, c) => s + c.shipments, 0);
  const avg = shipments > 0 ? total / shipments : 0;
  const top = data.length > 0 ? data.reduce((a, b) => (b.volume > a.volume ? b : a), data[0]) : undefined;

  const kpis: { key: Exclude<DrilldownKey, null>; label: string; value: string; icon: string; color: string; bg: string; ring: string }[] = [
    { key: 'volume', label: 'حجم الصادرات (USD)', value: formatUSD(total), icon: 'GlobeAltIcon', color: 'text-cyan-600', bg: 'bg-cyan-50', ring: 'ring-cyan-500' },
    { key: 'shipments', label: 'عدد شحنات التصدير', value: String(shipments), icon: 'TruckIcon', color: 'text-indigo-600', bg: 'bg-indigo-50', ring: 'ring-indigo-500' },
    { key: 'avg', label: 'متوسط قيمة الشحنة', value: shipments > 0 ? formatUSD(avg) : '—', icon: 'BanknotesIcon', color: 'text-green-600', bg: 'bg-green-50', ring: 'ring-green-500' },
    { key: 'topMarket', label: 'أعلى سوق تصدير', value: top?.country_ar ?? '—', icon: 'FlagIcon', color: 'text-amber-600', bg: 'bg-amber-50', ring: 'ring-amber-500' },
  ];

  // ---- Drilldown datasets ----
  const byProduct = useMemo(() => {
    const m = new Map<string, { name: string; volume: number; count: number }>();
    records.forEach((r) => {
      const e = m.get(r.product_ar);
      if (e) { e.volume += r.volume; e.count += 1; } else m.set(r.product_ar, { name: r.product_ar, volume: r.volume, count: 1 });
    });
    return Array.from(m.values()).sort((a, b) => b.volume - a.volume);
  }, [records]);

  const byMonth = useMemo(() => {
    if (!now) return [] as { key: number; month: string; volume: number; count: number; avg: number }[];
    const m = new Map<number, { key: number; month: string; volume: number; count: number; avg: number }>();
    records.forEach((r) => {
      const k = monthOrderKey(r.daysAgo, now);
      const e = m.get(k);
      if (e) { e.volume += r.volume; e.count += 1; } else m.set(k, { key: k, month: monthLabel(r.daysAgo, now), volume: r.volume, count: 1, avg: 0 });
    });
    return Array.from(m.values())
      .sort((a, b) => a.key - b.key)
      .map((e) => ({ ...e, avg: Math.round(e.volume / e.count) }));
  }, [records, now]);

  const productMonthRows = useMemo(() => {
    if (!now) return [] as { product: string; month: string; key: number; volume: number }[];
    const m = new Map<string, { product: string; month: string; key: number; volume: number }>();
    records.forEach((r) => {
      const k = monthOrderKey(r.daysAgo, now);
      const id = `${r.product_ar}|${k}`;
      const e = m.get(id);
      if (e) e.volume += r.volume; else m.set(id, { product: r.product_ar, month: monthLabel(r.daysAgo, now), key: k, volume: r.volume });
    });
    return Array.from(m.values()).sort((a, b) => b.key - a.key || b.volume - a.volume);
  }, [records, now]);

  const completedList = useMemo(() => [...records].sort((a, b) => a.daysAgo - b.daysAgo), [records]);

  const topCountryRecords = useMemo(
    () => (top ? records.filter((r) => r.country === top.country).sort((a, b) => a.daysAgo - b.daysAgo) : []),
    [records, top]
  );
  const topBuyers = useMemo(() => {
    const m = new Map<string, { buyer: string; volume: number; count: number }>();
    topCountryRecords.forEach((r) => {
      const e = m.get(r.buyer);
      if (e) { e.volume += r.volume; e.count += 1; } else m.set(r.buyer, { buyer: r.buyer, volume: r.volume, count: 1 });
    });
    return Array.from(m.values()).sort((a, b) => b.volume - a.volume);
  }, [topCountryRecords]);
  const topTons = topCountryRecords.reduce((s, r) => s + r.tons, 0);

  const minShipment = records.length > 0 ? records.reduce((a, b) => (b.volume < a.volume ? b : a), records[0]) : undefined;
  const maxShipment = records.length > 0 ? records.reduce((a, b) => (b.volume > a.volume ? b : a), records[0]) : undefined;

  const daysAgoLabel = (d: number) => (d === 0 ? 'اليوم' : d === 1 ? 'أمس' : `قبل ${d} يوماً`);
  const close = () => setActive(null);

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center gap-3 px-1">
        <div className="w-1 h-8 bg-gradient-to-b from-cyan-500 to-indigo-600 rounded-full" />
        <div>
          <h2 className="text-base font-bold text-slate-100">مؤشرات حجم الصادرات</h2>
          <p className="text-xs text-slate-300">Export Volume KPIs & Country Breakdown</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map(kpi => {
          const isActive = active === kpi.key;
          return (
            <button
              key={kpi.key}
              type="button"
              onClick={() => setActive(kpi.key)}
              aria-pressed={isActive}
              className={`text-right bg-card border border-border rounded-2xl p-4 cursor-pointer transition-transform duration-150 hover:scale-[1.03] active:scale-[0.98] focus:outline-none focus-visible:ring-2 ${kpi.ring} ${isActive ? `ring-2 ${kpi.ring}` : ''}`}
            >
              <div className={`w-10 h-10 rounded-xl ${kpi.bg} flex items-center justify-center mb-3`}>
                <Icon name={kpi.icon as any} size={20} className={kpi.color} />
              </div>
              <p className="text-xl font-extrabold text-foreground" dir="ltr">{kpi.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{kpi.label}</p>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="text-sm font-bold text-foreground mb-4">الصادرات حسب الدولة (USD)</h3>
          {data.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">لا توجد صادرات خلال هذه الفترة</p>
          ) : (
            <div dir="ltr">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E8E4DE" />
                  <XAxis dataKey="country_ar" tick={{ fontSize: 10, fill: '#8A8680' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#8A8680' }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `$${v / 1000}K`} />
                  <Tooltip
                    formatter={(value: any) => [formatUSD(Number(value) || 0), 'حجم الصادرات (USD)']}
                    contentStyle={{ background: '#fff', border: '1px solid #D4CFC8', borderRadius: 12, fontSize: 12, color: '#111827' }}
                    labelStyle={{ fontWeight: 700, color: '#111827' }}
                    itemStyle={{ color: '#0e7490' }}
                  />
                  <Bar dataKey="volume" fill="#0891b2" radius={[4, 4, 0, 0]} name="حجم الصادرات (USD)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="text-sm font-bold text-foreground mb-4">تفصيل الدول</h3>
          {data.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">لا توجد صادرات خلال هذه الفترة</p>
          ) : (
            <div className="space-y-3">
              {data.map(c => {
                const pct = total > 0 ? Math.round((c.volume / total) * 100) : 0;
                return (
                  <div key={c.country}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium text-foreground">{c.country_ar} <span className="text-muted-foreground">· {formatShipmentsAr(c.shipments)}</span></span>
                      <span className="text-muted-foreground" dir="ltr">{formatUSD(c.volume)} ({pct}%)</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-cyan-600 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Drawer: completed export shipments */}
      {active === 'shipments' && (
        <div className="fixed inset-0 z-[100] flex" dir="rtl">
          <div className="absolute inset-0 bg-black/50" onClick={close} />
          <aside className="relative mr-0 ml-auto h-full w-full max-w-md bg-white text-slate-900 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <div>
                <h3 className="text-base font-bold">شحنات التصدير المكتملة</h3>
                <p className="text-xs text-slate-500">{formatShipmentsAr(completedList.length)} خلال الفترة المحددة</p>
              </div>
              <button type="button" onClick={close} aria-label="إغلاق" className="p-2 rounded-lg hover:bg-slate-100">
                <Icon name="XMarkIcon" size={20} className="text-slate-600" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {completedList.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-12">لا توجد شحنات مكتملة خلال هذه الفترة</p>
              ) : (
                completedList.map((s) => (
                  <div key={s.id} className="border border-slate-200 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-bold" dir="ltr">{s.id}</span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-semibold">مكتملة</span>
                    </div>
                    <p className="text-xs text-slate-600">{s.country_ar} · {s.product_ar}</p>
                    <div className="flex items-center justify-between mt-2 text-xs">
                      <span className="text-slate-500">{daysAgoLabel(s.daysAgo)}</span>
                      <span className="font-bold text-slate-900" dir="ltr">{formatUSD(s.volume)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </aside>
        </div>
      )}

      {/* Modal: revenue by product and month */}
      {active === 'volume' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" dir="rtl">
          <div className="absolute inset-0 bg-black/50" onClick={close} />
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white text-slate-900 rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 sticky top-0 bg-white">
              <div>
                <h3 className="text-base font-bold">تفصيل إيرادات التصدير</h3>
                <p className="text-xs text-slate-500">الإجمالي: <span dir="ltr">{formatUSD(total)}</span></p>
              </div>
              <button type="button" onClick={close} aria-label="إغلاق" className="p-2 rounded-lg hover:bg-slate-100">
                <Icon name="XMarkIcon" size={20} className="text-slate-600" />
              </button>
            </div>
            <div className="p-5 space-y-6">
              {records.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">لا توجد صادرات خلال هذه الفترة</p>
              ) : (
                <>
                  <div>
                    <h4 className="text-sm font-bold mb-3">حسب المنتج</h4>
                    <div className="space-y-3">
                      {byProduct.map((p) => {
                        const pct = total > 0 ? Math.round((p.volume / total) * 100) : 0;
                        return (
                          <div key={p.name}>
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className="font-medium">{p.name} <span className="text-slate-500">· {formatShipmentsAr(p.count)}</span></span>
                              <span className="text-slate-600" dir="ltr">{formatUSD(p.volume)} ({pct}%)</span>
                            </div>
                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-cyan-600 rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-bold mb-3">حسب الشهر</h4>
                    <div dir="ltr">
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={byMonth} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                          <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#475569' }} tickLine={false} axisLine={false} />
                          <YAxis tick={{ fontSize: 10, fill: '#475569' }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `$${v / 1000}K`} />
                          <Tooltip
                            formatter={(value: any) => [formatUSD(Number(value) || 0), 'الإيراد']}
                            contentStyle={{ background: '#fff', border: '1px solid #D4CFC8', borderRadius: 12, fontSize: 12, color: '#111827' }}
                            labelStyle={{ fontWeight: 700, color: '#111827' }}
                            itemStyle={{ color: '#0e7490' }}
                          />
                          <Bar dataKey="volume" fill="#0891b2" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-bold mb-3">المنتج × الشهر</h4>
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      {productMonthRows.map((r, i) => (
                        <div key={`${r.product}-${r.key}`} className={`flex items-center justify-between px-3 py-2 text-xs ${i % 2 === 0 ? 'bg-slate-50' : 'bg-white'}`}>
                          <span className="font-medium">{r.product} <span className="text-slate-500">· {r.month}</span></span>
                          <span className="font-bold" dir="ltr">{formatUSD(r.volume)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: top export market performance */}
      {active === 'topMarket' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" dir="rtl">
          <div className="absolute inset-0 bg-black/50" onClick={close} />
          <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white text-slate-900 rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 sticky top-0 bg-white">
              <div>
                <h3 className="text-base font-bold">أداء سوق {top?.country_ar ?? '—'}</h3>
                <p className="text-xs text-slate-500">أعلى سوق تصدير خلال الفترة المحددة</p>
              </div>
              <button type="button" onClick={close} aria-label="إغلاق" className="p-2 rounded-lg hover:bg-slate-100">
                <Icon name="XMarkIcon" size={20} className="text-slate-600" />
              </button>
            </div>
            <div className="p-5 space-y-5">
              {!top ? (
                <p className="text-sm text-slate-500 text-center py-8">لا توجد صادرات خلال هذه الفترة</p>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-slate-50 rounded-xl p-3 text-center">
                      <p className="text-[11px] text-slate-500">الإيراد</p>
                      <p className="text-sm font-extrabold" dir="ltr">{formatUSD(top.volume)}</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3 text-center">
                      <p className="text-[11px] text-slate-500">الشحنات</p>
                      <p className="text-sm font-extrabold">{formatShipmentsAr(top.shipments)}</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3 text-center">
                      <p className="text-[11px] text-slate-500">إجمالي الأطنان</p>
                      <p className="text-sm font-extrabold">{topTons} طن</p>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-bold mb-2">أهم المشترين</h4>
                    <div className="space-y-2">
                      {topBuyers.map((b) => (
                        <div key={b.buyer} className="flex items-center justify-between border border-slate-200 rounded-xl px-3 py-2 text-xs">
                          <span className="font-medium" dir="ltr">{b.buyer}</span>
                          <span className="text-slate-600">{formatShipmentsAr(b.count)} · <span className="font-bold text-slate-900" dir="ltr">{formatUSD(b.volume)}</span></span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-bold mb-2">سجل الصادرات</h4>
                    <div className="space-y-2">
                      {topCountryRecords.map((r) => (
                        <div key={r.id} className="flex items-center justify-between text-xs border-b border-slate-100 pb-2">
                          <span><span className="font-bold" dir="ltr">{r.id}</span> <span className="text-slate-500">· {r.product_ar} · {r.tons} طن</span></span>
                          <span className="text-slate-500">{daysAgoLabel(r.daysAgo)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: avg shipment value metrics */}
      {active === 'avg' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" dir="rtl">
          <div className="absolute inset-0 bg-black/50" onClick={close} />
          <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white text-slate-900 rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 sticky top-0 bg-white">
              <div>
                <h3 className="text-base font-bold">متوسط قيمة الشحنة</h3>
                <p className="text-xs text-slate-500">المتوسط: <span dir="ltr">{shipments > 0 ? formatUSD(avg) : '—'}</span></p>
              </div>
              <button type="button" onClick={close} aria-label="إغلاق" className="p-2 rounded-lg hover:bg-slate-100">
                <Icon name="XMarkIcon" size={20} className="text-slate-600" />
              </button>
            </div>
            <div className="p-5 space-y-5">
              {records.length === 0 || !minShipment || !maxShipment ? (
                <p className="text-sm text-slate-500 text-center py-8">لا توجد صادرات خلال هذه الفترة</p>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-red-50 rounded-xl p-3">
                      <p className="text-[11px] text-red-700 font-semibold">أقل قيمة شحنة</p>
                      <p className="text-lg font-extrabold text-slate-900" dir="ltr">{formatUSD(minShipment.volume)}</p>
                      <p className="text-[11px] text-slate-600">{minShipment.country_ar} · <span dir="ltr">{minShipment.id}</span></p>
                    </div>
                    <div className="bg-green-50 rounded-xl p-3">
                      <p className="text-[11px] text-green-700 font-semibold">أعلى قيمة شحنة</p>
                      <p className="text-lg font-extrabold text-slate-900" dir="ltr">{formatUSD(maxShipment.volume)}</p>
                      <p className="text-[11px] text-slate-600">{maxShipment.country_ar} · <span dir="ltr">{maxShipment.id}</span></p>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-bold mb-3">الاتجاه الشهري للمتوسط</h4>
                    <div dir="ltr">
                      <ResponsiveContainer width="100%" height={200}>
                        <LineChart data={byMonth} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                          <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#475569' }} tickLine={false} axisLine={false} />
                          <YAxis tick={{ fontSize: 10, fill: '#475569' }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `$${v / 1000}K`} />
                          <Tooltip
                            formatter={(value: any) => [formatUSD(Number(value) || 0), 'متوسط الشحنة']}
                            contentStyle={{ background: '#fff', border: '1px solid #D4CFC8', borderRadius: 12, fontSize: 12, color: '#111827' }}
                            labelStyle={{ fontWeight: 700, color: '#111827' }}
                            itemStyle={{ color: '#15803d' }}
                          />
                          <Line type="monotone" dataKey="avg" stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="mt-3 border border-slate-200 rounded-xl overflow-hidden">
                      {byMonth.map((m, i) => (
                        <div key={m.key} className={`flex items-center justify-between px-3 py-2 text-xs ${i % 2 === 0 ? 'bg-slate-50' : 'bg-white'}`}>
                          <span className="font-medium">{m.month} <span className="text-slate-500">· {formatShipmentsAr(m.count)}</span></span>
                          <span className="font-bold" dir="ltr">{formatUSD(m.avg)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
