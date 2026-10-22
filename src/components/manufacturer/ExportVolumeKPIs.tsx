'use client';

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Icon from '@/components/ui/AppIcon';

interface CountryExport {
  country: string;
  country_ar: string;
  volume: number;
  shipments: number;
}

export const EXPORT_BY_COUNTRY: CountryExport[] = [
  { country: 'Saudi Arabia', country_ar: 'السعودية', volume: 128000, shipments: 4 },
  { country: 'UAE', country_ar: 'الإمارات', volume: 94000, shipments: 3 },
  { country: 'Oman', country_ar: 'عمان', volume: 61000, shipments: 2 },
  { country: 'Yemen', country_ar: 'اليمن', volume: 33000, shipments: 2 },
  { country: 'Egypt', country_ar: 'مصر', volume: 17000, shipments: 1 },
];

export const TOTAL_EXPORT_VOLUME_USD: number = EXPORT_BY_COUNTRY.reduce((s, c) => s + c.volume, 0);

function formatUSD(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
}

export default function ExportVolumeKPIs() {
  const total = EXPORT_BY_COUNTRY.reduce((s, c) => s + c.volume, 0);
  const shipments = EXPORT_BY_COUNTRY.reduce((s, c) => s + c.shipments, 0);
  const avg = shipments > 0 ? total / shipments : 0;
  const top = EXPORT_BY_COUNTRY.reduce((a, b) => (b.volume > a.volume ? b : a), EXPORT_BY_COUNTRY[0]);

  const kpis = [
    { label: 'حجم الصادرات (USD)', value: formatUSD(total), icon: 'GlobeAltIcon', color: 'text-cyan-600', bg: 'bg-cyan-50' },
    { label: 'عدد شحنات التصدير', value: String(shipments), icon: 'TruckIcon', color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'متوسط قيمة الشحنة', value: formatUSD(avg), icon: 'BanknotesIcon', color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'أعلى سوق تصدير', value: top?.country_ar ?? '—', icon: 'FlagIcon', color: 'text-amber-600', bg: 'bg-amber-50' },
  ];

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center gap-3 px-1">
        <div className="w-1 h-8 bg-gradient-to-b from-cyan-500 to-indigo-600 rounded-full" />
        <div>
          <h2 className="text-base font-bold text-foreground">مؤشرات حجم الصادرات</h2>
          <p className="text-xs text-muted-foreground">Export Volume KPIs & Country Breakdown</p>
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
          <div dir="ltr">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={EXPORT_BY_COUNTRY} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E4DE" />
                <XAxis dataKey="country_ar" tick={{ fontSize: 10, fill: '#8A8680' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#8A8680' }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `$${v / 1000}K`} />
                <Tooltip formatter={(value: any) => formatUSD(Number(value) || 0)} contentStyle={{ background: '#fff', border: '1px solid #D4CFC8', borderRadius: 12, fontSize: 12 }} />
                <Bar dataKey="volume" fill="#0891b2" radius={[4, 4, 0, 0]} name="Export Volume (USD)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="text-sm font-bold text-foreground mb-4">تفصيل الدول</h3>
          <div className="space-y-3">
            {EXPORT_BY_COUNTRY.map(c => {
              const pct = total > 0 ? Math.round((c.volume / total) * 100) : 0;
              return (
                <div key={c.country}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium text-foreground">{c.country_ar} <span className="text-muted-foreground">· {c.shipments} شحنة</span></span>
                    <span className="text-muted-foreground" dir="ltr">{formatUSD(c.volume)} ({pct}%)</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-cyan-600 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
