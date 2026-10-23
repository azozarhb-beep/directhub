'use client';

import React from 'react';
import Icon from '@/components/ui/AppIcon';
import { EMPTY_TIER_ROW, type TierFormRow } from '@/lib/tieredPricing';

export const TIER_CURRENCIES = [
  { value: 'YER', label: 'ريال يمني (YER)' },
  { value: 'SAR', label: 'ريال سعودي (SAR)' },
  { value: 'USD', label: 'دولار أمريكي (USD)' },
] as const;

interface TierPricingEditorProps {
  tiers: TierFormRow[];
  onChange: (tiers: TierFormRow[]) => void;
  unitLabel?: string;
  currency?: string;
  onCurrencyChange?: (currency: string) => void;
}

const inputCls =
  'w-full h-10 px-3 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary text-start';

export default function TierPricingEditor({ tiers, onChange, unitLabel, currency = 'YER', onCurrencyChange }: TierPricingEditorProps) {
  const update = (idx: number, field: keyof TierFormRow, value: string) => {
    onChange(tiers.map((t, i) => (i === idx ? { ...t, [field]: value } : t)));
  };

  const addTier = () => {
    const last = tiers[tiers.length - 1];
    const lastMax = last ? parseInt(last.max_qty, 10) : NaN;
    const lastMin = last ? parseInt(last.min_qty, 10) : NaN;
    const nextMin = Number.isFinite(lastMax) ? lastMax + 1 : Number.isFinite(lastMin) ? lastMin + 10 : 1;
    const next = tiers.map((t, i) =>
      i === tiers.length - 1 && t.max_qty.trim() === '' ? { ...t, max_qty: String(nextMin - 1) } : t
    );
    onChange([...next, { min_qty: String(nextMin), max_qty: '', unit_price_usd: '' }]);
  };

  const removeTier = (idx: number) => {
    if (tiers.length <= 1) return;
    onChange(tiers.filter((_, i) => i !== idx));
  };

  const rows = tiers.length ? tiers : [EMPTY_TIER_ROW];

  return (
    <div className="rounded-2xl border border-border p-3 space-y-3 bg-muted/20">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold text-foreground">
          تسعير الكميات والجملة ({currency}){unitLabel ? ` / ${unitLabel}` : ''} *
        </p>
        <div className="flex items-center gap-2">
          <select
            value={currency}
            onChange={(e) => onCurrencyChange?.(e.target.value)}
            aria-label="العملة"
            className="h-8 px-2 rounded-lg border border-border bg-background text-xs font-semibold text-foreground focus:outline-none focus:border-primary"
          >
            {TIER_CURRENCIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={addTier}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 transition-opacity"
          >
            + إضافة شريحة كمية
          </button>
        </div>
      </div>

      <div className="hidden sm:grid grid-cols-[1fr_1fr_1fr_40px] gap-2 px-1">
        <span className="text-[10px] font-semibold text-muted-foreground">الكمية الدنيا</span>
        <span className="text-[10px] font-semibold text-muted-foreground">الكمية القصوى (فارغ لما فوق ذلك)</span>
        <span className="text-[10px] font-semibold text-muted-foreground">سعر الوحدة ({currency})</span>
        <span />
      </div>

      <div className="space-y-2">
        {rows.map((tier, idx) => (
          <div key={idx} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_40px] gap-2 items-center">
            <input
              type="number"
              min="1"
              value={tier.min_qty}
              onChange={(e) => update(idx, 'min_qty', e.target.value)}
              placeholder="الكمية الدنيا (مثال: 1)"
              aria-label="الكمية الدنيا"
              dir="ltr"
              className={inputCls}
            />
            <input
              type="number"
              min="1"
              value={tier.max_qty}
              onChange={(e) => update(idx, 'max_qty', e.target.value)}
              placeholder="الكمية القصوى (فارغ لما فوق ذلك)"
              aria-label="الكمية القصوى"
              dir="ltr"
              className={inputCls}
            />
            <input
              type="number"
              min="0"
              step="0.01"
              value={tier.unit_price_usd}
              onChange={(e) => update(idx, 'unit_price_usd', e.target.value)}
              placeholder="سعر الوحدة"
              aria-label="سعر الوحدة"
              dir="ltr"
              className={inputCls}
            />
            <button
              type="button"
              onClick={() => removeTier(idx)}
              disabled={rows.length <= 1}
              aria-label="حذف الشريحة"
              title="حذف"
              className="h-10 w-10 flex items-center justify-center rounded-xl border border-border text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Icon name="TrashIcon" size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
