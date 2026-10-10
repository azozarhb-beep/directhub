'use client';

import React, { useState, useCallback } from 'react';
import Icon from '@/components/ui/AppIcon';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PriceTier {
  id: string;
  min_qty: number;
  max_qty: number | null; // null = unlimited (last tier)
  unit_price_usd: number;
  label?: string;
}

export interface TieredPricingConfig {
  product_id?: string;
  product_name?: string;
  currency: 'USD';
  tiers: PriceTier[];
}

interface TieredPricingManagerProps {
  /** Optional: pre-load a product's existing tiers */
  initialConfig?: TieredPricingConfig;
  /** Called whenever tiers change — parent can persist */
  onChange?: (config: TieredPricingConfig) => void;
  /** Optional product name label */
  productName?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function formatUSD(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value);
}

const DEFAULT_TIERS: PriceTier[] = [
  { id: generateId(), min_qty: 1, max_qty: 9, unit_price_usd: 0 },
  { id: generateId(), min_qty: 10, max_qty: 49, unit_price_usd: 0 },
  { id: generateId(), min_qty: 50, max_qty: null, unit_price_usd: 0 },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function TieredPricingManager({
  initialConfig,
  onChange,
  productName,
}: TieredPricingManagerProps) {
  const [tiers, setTiers] = useState<PriceTier[]>(
    initialConfig?.tiers?.length ? initialConfig.tiers : DEFAULT_TIERS
  );
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const notifyChange = useCallback(
    (updatedTiers: PriceTier[]) => {
      onChange?.({
        product_name: productName,
        currency: 'USD',
        tiers: updatedTiers,
      });
    },
    [onChange, productName]
  );

  // ── Validation ──────────────────────────────────────────────────────────────

  function validate(updatedTiers: PriceTier[]): boolean {
    const newErrors: Record<string, string> = {};
    updatedTiers.forEach((tier, idx) => {
      if (tier.min_qty < 1) {
        newErrors[`${tier.id}_min`] = 'Min qty must be ≥ 1';
      }
      if (tier.max_qty !== null && tier.max_qty <= tier.min_qty) {
        newErrors[`${tier.id}_max`] = 'Max qty must be greater than min qty';
      }
      if (tier.unit_price_usd < 0) {
        newErrors[`${tier.id}_price`] = 'Price cannot be negative';
      }
      // Check overlap with previous tier
      if (idx > 0) {
        const prev = updatedTiers[idx - 1];
        const expectedMin = prev.max_qty !== null ? prev.max_qty + 1 : null;
        if (expectedMin !== null && tier.min_qty !== expectedMin) {
          newErrors[`${tier.id}_min`] = `Min qty should be ${expectedMin} (continues from previous tier)`;
        }
      }
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  // ── Handlers ────────────────────────────────────────────────────────────────

  function updateTier(id: string, field: keyof PriceTier, raw: string) {
    let updated = tiers.map((t) => {
      if (t.id !== id) return t;
      if (field === 'max_qty') {
        const val = raw === '' ? null : parseInt(raw, 10);
        return { ...t, max_qty: isNaN(val as number) ? null : val };
      }
      if (field === 'min_qty') {
        return { ...t, min_qty: parseInt(raw, 10) || 0 };
      }
      if (field === 'unit_price_usd') {
        return { ...t, unit_price_usd: parseFloat(raw) || 0 };
      }
      return t;
    });
    setTiers(updated);
    setSaved(false);
    validate(updated);
    notifyChange(updated);
  }

  function addTier() {
    const last = tiers[tiers.length - 1];
    const newMin = last.max_qty !== null ? last.max_qty + 1 : (last.min_qty + 10);
    // Make previous last tier bounded
    const updatedLast = { ...last, max_qty: newMin - 1 };
    const newTier: PriceTier = {
      id: generateId(),
      min_qty: newMin,
      max_qty: null,
      unit_price_usd: 0,
    };
    let updated = [...tiers.slice(0, -1), updatedLast, newTier];
    setTiers(updated);
    setSaved(false);
    validate(updated);
    notifyChange(updated);
  }

  function removeTier(id: string) {
    if (tiers.length <= 1) return;
    const idx = tiers.findIndex((t) => t.id === id);
    let updated = tiers.filter((t) => t.id !== id);
    // If we removed the last tier, make the new last tier unbounded
    if (idx === tiers.length - 1 && updated.length > 0) {
      updated = updated.map((t, i) =>
        i === updated.length - 1 ? { ...t, max_qty: null } : t
      );
    }
    setTiers(updated);
    setSaved(false);
    validate(updated);
    notifyChange(updated);
  }

  function handleSave() {
    if (!validate(tiers)) return;
    setSaved(true);
    notifyChange(tiers);
    setTimeout(() => setSaved(false), 3000);
  }

  function resetToDefault() {
    const fresh = DEFAULT_TIERS.map((t) => ({ ...t, id: generateId() }));
    setTiers(fresh);
    setSaved(false);
    setErrors({});
    notifyChange(fresh);
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const hasErrors = Object.keys(errors).length > 0;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-blue-600 to-indigo-600">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center">
            <Icon name="Layers" className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-white font-bold text-sm leading-tight">
              Tiered Pricing Manager
            </h3>
            <p className="text-blue-100 text-xs mt-0.5">
              {productName ? `Product: ${productName}` : 'Volume-based USD pricing brackets'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs bg-white/20 text-white px-2 py-0.5 rounded-full font-medium">
            USD
          </span>
          <span className="text-xs bg-white/20 text-white px-2 py-0.5 rounded-full font-medium">
            {tiers.length} {tiers.length === 1 ? 'Tier' : 'Tiers'}
          </span>
        </div>
      </div>

      {/* Description */}
      <div className="px-5 py-3 bg-blue-50 border-b border-blue-100">
        <p className="text-xs text-blue-700 leading-relaxed">
          Define quantity brackets and their corresponding unit prices in USD. Buyers will automatically see the applicable price based on their order quantity.
          The last tier is always open-ended (no upper limit).
        </p>
      </div>

      {/* Tiers Table */}
      <div className="p-5">
        {/* Column Headers */}
        <div className="grid grid-cols-12 gap-2 mb-2 px-1">
          <div className="col-span-1 text-xs font-semibold text-muted-foreground text-center">#</div>
          <div className="col-span-3 text-xs font-semibold text-muted-foreground">Min Qty</div>
          <div className="col-span-3 text-xs font-semibold text-muted-foreground">Max Qty</div>
          <div className="col-span-4 text-xs font-semibold text-muted-foreground">Unit Price (USD)</div>
          <div className="col-span-1"></div>
        </div>

        {/* Tier Rows */}
        <div className="space-y-2">
          {tiers.map((tier, idx) => {
            const isLast = idx === tiers.length - 1;
            const minError = errors[`${tier.id}_min`];
            const maxError = errors[`${tier.id}_max`];
            const priceError = errors[`${tier.id}_price`];

            return (
              <div key={tier.id} className="group">
                <div className={`grid grid-cols-12 gap-2 items-center p-2 rounded-lg border transition-colors ${
                  minError || maxError || priceError
                    ? 'border-red-300 bg-red-50' :'border-border bg-background hover:bg-muted/30'
                }`}>
                  {/* Index badge */}
                  <div className="col-span-1 flex justify-center">
                    <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${
                      idx === 0
                        ? 'bg-blue-100 text-blue-700'
                        : idx === tiers.length - 1
                        ? 'bg-indigo-100 text-indigo-700' :'bg-muted text-muted-foreground'
                    }`}>
                      {idx + 1}
                    </span>
                  </div>

                  {/* Min Qty */}
                  <div className="col-span-3">
                    <input
                      type="number"
                      min={1}
                      value={tier.min_qty}
                      onChange={(e) => updateTier(tier.id, 'min_qty', e.target.value)}
                      className={`w-full text-sm border rounded-md px-2 py-1.5 bg-background focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        minError ? 'border-red-400' : 'border-border'
                      }`}
                      placeholder="1"
                    />
                  </div>

                  {/* Max Qty */}
                  <div className="col-span-3">
                    {isLast ? (
                      <div className="flex items-center gap-1.5 px-2 py-1.5 bg-indigo-50 border border-indigo-200 rounded-md">
                        <Icon name="Infinity" className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                        <span className="text-xs text-indigo-600 font-medium">Unlimited</span>
                      </div>
                    ) : (
                      <input
                        type="number"
                        min={tier.min_qty + 1}
                        value={tier.max_qty ?? ''}
                        onChange={(e) => updateTier(tier.id, 'max_qty', e.target.value)}
                        className={`w-full text-sm border rounded-md px-2 py-1.5 bg-background focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          maxError ? 'border-red-400' : 'border-border'
                        }`}
                        placeholder="e.g. 49"
                      />
                    )}
                  </div>

                  {/* Unit Price USD */}
                  <div className="col-span-4">
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">$</span>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={tier.unit_price_usd || ''}
                        onChange={(e) => updateTier(tier.id, 'unit_price_usd', e.target.value)}
                        className={`w-full text-sm border rounded-md pl-5 pr-2 py-1.5 bg-background focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          priceError ? 'border-red-400' : 'border-border'
                        }`}
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  {/* Remove */}
                  <div className="col-span-1 flex justify-center">
                    <button
                      onClick={() => removeTier(tier.id)}
                      disabled={tiers.length <= 1}
                      className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title="Remove tier"
                    >
                      <Icon name="X" className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Inline errors */}
                {(minError || maxError || priceError) && (
                  <div className="mt-1 px-2 space-y-0.5">
                    {minError && <p className="text-xs text-red-500">{minError}</p>}
                    {maxError && <p className="text-xs text-red-500">{maxError}</p>}
                    {priceError && <p className="text-xs text-red-500">{priceError}</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Add Tier */}
        <button
          onClick={addTier}
          className="mt-3 w-full flex items-center justify-center gap-2 py-2 border-2 border-dashed border-blue-300 rounded-lg text-blue-600 hover:bg-blue-50 hover:border-blue-400 transition-colors text-sm font-medium"
        >
          <Icon name="Plus" className="w-4 h-4" />
          Add Pricing Tier
        </button>
      </div>

      {/* Preview Table */}
      {tiers.some((t) => t.unit_price_usd > 0) && (
        <div className="px-5 pb-4">
          <div className="bg-muted/40 rounded-lg p-3 border border-border">
            <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
              <Icon name="Eye" className="w-3.5 h-3.5 text-muted-foreground" />
              Buyer Preview
            </p>
            <div className="space-y-1">
              {tiers.map((tier, idx) => (
                <div key={tier.id} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    {tier.max_qty !== null
                      ? `${tier.min_qty} – ${tier.max_qty} units`
                      : `${tier.min_qty}+ units`}
                  </span>
                  <span className={`font-semibold ${
                    idx === 0 ? 'text-foreground' : 'text-emerald-600'
                  }`}>
                    {tier.unit_price_usd > 0 ? formatUSD(tier.unit_price_usd) : '—'} / unit
                    {idx > 0 && tier.unit_price_usd > 0 && tiers[0].unit_price_usd > 0 && (
                      <span className="ml-1 text-emerald-500 font-normal">
                        ({Math.round((1 - tier.unit_price_usd / tiers[0].unit_price_usd) * 100)}% off)
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Footer Actions */}
      <div className="px-5 py-3 border-t border-border bg-muted/20 flex items-center justify-between gap-3">
        <button
          onClick={resetToDefault}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors"
        >
          <Icon name="RotateCcw" className="w-3.5 h-3.5" />
          Reset to Default
        </button>

        <div className="flex items-center gap-2">
          {saved && (
            <span className="text-xs text-emerald-600 flex items-center gap-1 font-medium">
              <Icon name="CheckCircle" className="w-3.5 h-3.5" />
              Pricing saved
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={hasErrors}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-muted disabled:text-muted-foreground text-white text-xs font-semibold rounded-lg transition-colors"
          >
            <Icon name="Save" className="w-3.5 h-3.5" />
            Save Pricing
          </button>
        </div>
      </div>
    </div>
  );
}
