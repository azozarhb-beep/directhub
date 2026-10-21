'use client';

import React from 'react';
import Icon from '@/components/ui/AppIcon';
import { EMPTY_TIER_ROW, type TierFormRow } from '@/lib/tieredPricing';

interface TierPricingEditorProps {
  tiers: TierFormRow[];
  onChange: (tiers: TierFormRow[]) => void;
  unitLabel?: string;
}

const inputCls =
  'w-full h-10 px-3 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary text-start';

export default function TierPricingEditor({ tiers, onChange, unitLabel }: TierPricingEditorProps) {
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
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-foreground">
          Tiered Pricing (USD){unitLabel ? ` / ${unitLabel}` : ''} *
        </p>
        <button
          type="button"
          onClick={addTier}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 transition-opacity"
        >
          <Icon name="PlusIcon" size={12} />
          Add Tier
        </button>
      </div>

      <div className="hidden sm:grid grid-cols-[1fr_1fr_1fr_40px] gap-2 px-1">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase">Min Qty</span>
        <span className="text-[10px] font-semibold text-muted-foreground uppercase">Max Qty (empty = +)</span>
        <span className="text-[10px] font-semibold text-muted-foreground uppercase">Unit Price (USD)</span>
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
              placeholder="Min qty (e.g. 1)"
              aria-label="Min quantity"
              dir="ltr"
              className={inputCls}
            />
            <input
              type="number"
              min="1"
              value={tier.max_qty}
              onChange={(e) => update(idx, 'max_qty', e.target.value)}
              placeholder="Max qty (empty = +)"
              aria-label="Max quantity"
              dir="ltr"
              className={inputCls}
            />
            <input
              type="number"
              min="0"
              step="0.01"
              value={tier.unit_price_usd}
              onChange={(e) => update(idx, 'unit_price_usd', e.target.value)}
              placeholder="Unit price (e.g. 2.10)"
              aria-label="Unit price USD"
              dir="ltr"
              className={inputCls}
            />
            <button
              type="button"
              onClick={() => removeTier(idx)}
              disabled={rows.length <= 1}
              aria-label="Remove tier"
              title="Remove"
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
