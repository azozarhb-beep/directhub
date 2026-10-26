'use client';

import React from 'react';
import { formatNumber } from '@/lib/driverPortal';

interface CargoMetricsProps {
  grossWeightKg: number | null;
  volumeCbm: number | null;
  palletCount: number | null;
}

export default function CargoMetrics({ grossWeightKg, volumeCbm, palletCount }: CargoMetricsProps) {
  const items = [
    { icon: '⚖️', label: 'الوزن الإجمالي', value: `${formatNumber(grossWeightKg)} كجم` },
    { icon: '📦', label: 'الحجم', value: `${formatNumber(volumeCbm, 2)} م³` },
    { icon: '🧱', label: 'الباليتات', value: formatNumber(palletCount) },
  ];
  return (
    <div className="grid grid-cols-3 gap-2">
      {items.map((it) => (
        <div key={it.label} className="rounded-2xl border border-gray-200 bg-white p-3 text-center">
          <p className="text-xl">{it.icon}</p>
          <p className="mt-1 text-sm font-extrabold text-gray-900" dir="ltr">{it.value}</p>
          <p className="text-[10px] font-medium text-gray-500">{it.label}</p>
        </div>
      ))}
    </div>
  );
}
