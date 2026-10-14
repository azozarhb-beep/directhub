'use client';

import React, { useId } from 'react';
import {
  CONTAINER_TYPES,
  DEMURRAGE_CURRENCIES,
  FREE_DAYS_PRESETS,
  PORT_COUNTRIES,
  PORT_ROLES,
  SHIPPING_LINES,
  getPortsForCountry,
} from '@/lib/portFreeTime';

export interface PortFreeTimeFormValues {
  container_number: string;
  container_type: string;
  shipping_line: string;
  port_country: string;
  port_name: string;
  port_role: string;
  discharge_date: string;
  free_days_limit: string;
  daily_demurrage_rate: string;
  demurrage_currency: string;
}

export const EMPTY_PORT_FREE_TIME: PortFreeTimeFormValues = {
  container_number: '',
  container_type: '',
  shipping_line: '',
  port_country: '',
  port_name: '',
  port_role: '',
  discharge_date: '',
  free_days_limit: '',
  daily_demurrage_rate: '',
  demurrage_currency: 'USD',
};

export function portFreeTimePayload(v: PortFreeTimeFormValues) {
  const days = v.free_days_limit.trim() === '' ? null : Number(v.free_days_limit);
  const rate = v.daily_demurrage_rate.trim() === '' ? null : Number(v.daily_demurrage_rate);
  return {
    container_number: v.container_number.trim() || null,
    container_type: v.container_type || null,
    shipping_line: v.shipping_line.trim() || null,
    port_country: v.port_country.trim() || null,
    port_name: v.port_name.trim() || null,
    port_role: v.port_role || null,
    discharge_date: v.discharge_date || null,
    free_days_limit: days !== null && Number.isFinite(days) && days >= 0 ? days : null,
    daily_demurrage_rate: rate !== null && Number.isFinite(rate) && rate >= 0 ? rate : null,
    demurrage_currency: v.demurrage_currency || 'USD',
  };
}

interface Props {
  values: PortFreeTimeFormValues;
  onChange: (next: PortFreeTimeFormValues) => void;
}

const inputCls =
  'w-full h-10 px-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary';
const labelCls = 'block text-xs font-semibold text-muted-foreground mb-1';

export default function PortFreeTimeFields({ values, onChange }: Props) {
  const uid = useId();
  const set = (patch: Partial<PortFreeTimeFormValues>) => onChange({ ...values, ...patch });
  const ports = getPortsForCountry(values.port_country);

  return (
    <div className="space-y-3 border border-dashed border-primary/30 rounded-2xl p-3 bg-primary/5" dir="rtl">
      <p className="text-xs font-bold text-primary">⏱️ مهلة الأرضيات والتأخير (Free-Time / Demurrage)</p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>رقم الحاوية</label>
          <input
            dir="ltr"
            value={values.container_number}
            onChange={e => set({ container_number: e.target.value.toUpperCase() })}
            placeholder="MSKU1234567"
            className={`${inputCls} font-mono`}
          />
        </div>
        <div>
          <label className={labelCls}>حجم / نوع الحاوية</label>
          <select value={values.container_type} onChange={e => set({ container_type: e.target.value })} className={inputCls}>
            <option value="">— اختر —</option>
            {CONTAINER_TYPES.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className={labelCls}>خط الملاحة (Shipping Line)</label>
        <input
          dir="ltr"
          list={`${uid}-lines`}
          value={values.shipping_line}
          onChange={e => set({ shipping_line: e.target.value })}
          placeholder="Maersk, MSC, CMA CGM..."
          className={inputCls}
        />
        <datalist id={`${uid}-lines`}>
          {SHIPPING_LINES.map(l => <option key={l} value={l} />)}
        </datalist>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>دولة الميناء (ابحث أو اكتب)</label>
          <input
            list={`${uid}-countries`}
            value={values.port_country}
            onChange={e => set({ port_country: e.target.value })}
            placeholder="Yemen, Egypt, China..."
            className={inputCls}
          />
          <datalist id={`${uid}-countries`}>
            {PORT_COUNTRIES.map(c => <option key={c} value={c} />)}
          </datalist>
        </div>
        <div>
          <label className={labelCls}>اسم الميناء (ابحث أو اكتب)</label>
          <input
            list={`${uid}-ports`}
            value={values.port_name}
            onChange={e => set({ port_name: e.target.value })}
            placeholder="Hodeidah Port..."
            className={inputCls}
          />
          <datalist id={`${uid}-ports`}>
            {ports.map(p => <option key={p} value={p} />)}
          </datalist>
        </div>
      </div>

      <div>
        <label className={labelCls}>وظيفة الميناء / المرحلة</label>
        <select value={values.port_role} onChange={e => set({ port_role: e.target.value })} className={inputCls}>
          <option value="">— اختر —</option>
          {PORT_ROLES.map(r => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>تاريخ وصول السفينة / تفريغ الحاوية</label>
          <input
            type="date"
            value={values.discharge_date}
            onChange={e => set({ discharge_date: e.target.value })}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>المهلة المجانية (أيام)</label>
          <input
            type="number"
            min={0}
            list={`${uid}-days`}
            value={values.free_days_limit}
            onChange={e => set({ free_days_limit: e.target.value })}
            placeholder="7, 10, 14, 21"
            className={inputCls}
          />
          <datalist id={`${uid}-days`}>
            {FREE_DAYS_PRESETS.map(d => <option key={d} value={d} />)}
          </datalist>
        </div>
      </div>

      <div>
        <label className={labelCls}>غرامة الأرضيات / التأخير اليومية</label>
        <div className="flex gap-2">
          <input
            type="number"
            min={0}
            step="0.01"
            value={values.daily_demurrage_rate}
            onChange={e => set({ daily_demurrage_rate: e.target.value })}
            placeholder="0.00"
            className={`${inputCls} flex-1`}
          />
          <select
            value={values.demurrage_currency}
            onChange={e => set({ demurrage_currency: e.target.value })}
            className="h-10 px-3 rounded-xl border border-border bg-background text-sm w-28"
          >
            {DEMURRAGE_CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}
