'use client';

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Icon from '@/components/ui/AppIcon';

export type AnalyticsPeriod = '7d' | '30d' | '90d';

export interface CountryExport {
  country: string;
  country_ar: string;
  volume: number;
  shipments: number;
}

interface ExportShipmentRecord {
  country: string;
  country_ar: string;
  volume: number;
  /** Days before today the shipment was completed */
  daysAgo: number;
}

/** Source dataset: individual completed export shipments with age in days. */
export const EXPORT_SHIPMENTS: ExportShipmentRecord[] = [
  { country: 'Saudi Arabia', country_ar: 'السعودية', volume: 38000, daysAgo: 3 },
  { country: 'Saudi Arabia', country_ar: 'السعودية', volume: 30000, daysAgo: 9 },
  { country: 'Saudi Arabia', country_ar: 'السعودية', volume: 32000, daysAgo: 21 },
  { country: 'Saudi Arabia', country_ar: 'السعودية', volume: 28000, daysAgo: 58 },
  { country: 'UAE', country_ar: 'الإمارات', volume: 36000, daysAgo: 6 },
  { country: 'UAE', country_ar: 'الإمارات', volume: 34000, daysAgo: 27 },
  { country: 'UAE', country_ar: 'الإمارات', volume: 24000, daysAgo: 71 },
  { country: 'Oman', country_ar: 'عمان', volume: 31000, daysAgo: 14 },
  { country: 'Oman', country_ar: 'عمان', volume: 30000, daysAgo: 64 },
  { country: 'Yemen', country_ar: 'اليمن', volume: 18000, daysAgo: 12 },
  { country: 'Yemen', country_ar: 'اليمن', volume: 15000, daysAgo: 45 },
  { country: 'Egypt', country_ar: 'مصر', volume: 17000, daysAgo: 82 },
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

interface ExportVolumeKPIsProps {
  period?: AnalyticsPeriod;
}

export default function ExportVolumeKPIs({ period = '30d' }: ExportVolumeKPIsProps) {
  const data = getExportByCountry(period);
  const total = data.reduce((s, c) => s + c.volume, 0);
  const shipments = data.reduce((s, c) => s + c.shipments, 0);
  const avg = shipments > 0 ? total / shipments : 0;
  const top = data.length > 0 ? data.reduce((a, b) => (b.volume > a.volume ? b : a), data[0]) : undefined;

  const kpis = [
    { label: 'حجم الصادرات (USD)', value: formatUSD(total), icon: 'GlobeAltIcon', color: 'text-cyan-600', bg: 'bg-cyan-50' },
    { label: 'عدد شحنات التصدير', value: String(shipments), icon: 'TruckIcon', color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'متوسط قيمة الشحنة', value: shipments > 0 ? formatUSD(avg) : '—', icon: 'BanknotesIcon', color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'أعلى سوق تصدير', value: top?.country_ar ?? '—', icon: 'FlagIcon', color: 'text-amber-600', bg: 'bg-amber-50' },
  ];

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
        {kpis.map(kpi => (
          <div key={kpi.label} className="bg-card border border-border rounded-2xl p-4">
            <div className={`w-10 h-10 rounded-xl ${kpi.bg} flex items-center justify-center mb-3`}>
              <Icon name={kpi.icon as any} size={20} className={kpi.color} />
            </div>
            <p className="text-xl font-extrabold text-foreground" dir="ltr">{kpi.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{kpi.label}</p>
          </div>
        ))}
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
    </div>
  );
}
