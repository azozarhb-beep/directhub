'use client';

import React, { useEffect, useState } from 'react';
import { computeFreeTime, formatPenalty, FreeTimeInput } from '@/lib/portFreeTime';

interface PortFreeTimeBadgeProps {
  shipment: FreeTimeInput & {
    container_number?: string | null;
    port_name?: string | null;
    port_country?: string | null;
    shipping_line?: string | null;
  };
  compact?: boolean;
}

export default function PortFreeTimeBadge({ shipment, compact = false }: PortFreeTimeBadgeProps) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 60 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  if (!now) return null;
  const ft = computeFreeTime(shipment, now);
  if (!ft) return null;

  const styles = {
    green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-300',
    red: 'bg-red-50 text-red-700 border-red-300',
  }[ft.level];

  const label =
    ft.level === 'green' ?'ضمن المهلة المجانية / Within Free-Time'
      : ft.level === 'amber' ?'تحذير: مهلة التخليص والتفريغ شارفت على الانتهاء' :'تجاوز المهلة — احتساب غرامات أرضيات وتأخير يومية';

  const daysText =
    ft.remainingDays > 0
      ? `متبقي ${ft.remainingDays} يوم`
      : `متأخر ${ft.overdueDays} يوم`;

  return (
    <div className={`rounded-xl border px-3 py-2 text-xs ${styles}`} dir="rtl">
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`w-2 h-2 rounded-full ${ft.level === 'green' ? 'bg-emerald-500' : ft.level === 'amber' ? 'bg-amber-500 animate-pulse' : 'bg-red-500 animate-pulse'}`} />
        <span className="font-bold">{label}</span>
        <span className="font-mono font-semibold">({daysText})</span>
        {ft.urgent && (
          <span className="px-1.5 py-0.5 rounded-md bg-red-600 text-white text-[10px] font-bold">
            🔔 عاجل
          </span>
        )}
      </div>
      {!compact && (
        <div className="flex items-center gap-3 flex-wrap mt-1 text-[11px] opacity-90">
          {shipment.container_number && <span dir="ltr" className="font-mono">📦 {shipment.container_number}</span>}
          {shipment.port_name && <span>⚓ {shipment.port_name}{shipment.port_country ? ` — ${shipment.port_country}` : ''}</span>}
          {shipment.shipping_line && <span>🚢 {shipment.shipping_line}</span>}
        </div>
      )}
      {ft.level === 'red' && (
        <div className="mt-1.5 flex items-center gap-3 flex-wrap font-semibold">
          <span>أيام التأخير: {ft.overdueDays}</span>
          <span>إجمالي الغرامة المستحقة: <span dir="ltr" className="font-mono">{formatPenalty(ft.accruedPenalty, ft.currency)}</span></span>
        </div>
      )}
    </div>
  );
}
