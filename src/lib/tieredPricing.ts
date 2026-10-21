export interface TierRow {
  min_qty: number;
  max_qty: number | null;
  unit_price: number;
}

export interface TierFormRow {
  min_qty: string;
  max_qty: string;
  unit_price_usd: string;
}

export const EMPTY_TIER_ROW: TierFormRow = { min_qty: '1', max_qty: '', unit_price_usd: '' };

/** Normalises any stored tiered_pricing JSONB (new or legacy shape) into a sorted TierRow[]. */
export function normalizeTiers(raw: unknown): TierRow[] {
  if (!Array.isArray(raw)) return [];
  const rows: TierRow[] = [];
  for (const item of raw as Record<string, unknown>[]) {
    if (!item || typeof item !== 'object') continue;
    const min = Number(item.min_qty ?? item.minQty);
    const price = Number(item.unit_price ?? item.unit_price_usd ?? item.price);
    const maxRaw = item.max_qty ?? item.maxQty;
    const max = maxRaw === null || maxRaw === undefined || maxRaw === '' || maxRaw === '+' ? null : Number(maxRaw);
    if (!Number.isFinite(min) || min < 1 || !Number.isFinite(price) || price <= 0) continue;
    rows.push({ min_qty: min, max_qty: max !== null && Number.isFinite(max) ? max : null, unit_price: price });
  }
  return rows.sort((a, b) => a.min_qty - b.min_qty);
}

/** Converts stored tiers to editable form rows. */
export function tiersToFormRows(raw: unknown): TierFormRow[] {
  const tiers = normalizeTiers(raw);
  return tiers.map((t) => ({
    min_qty: String(t.min_qty),
    max_qty: t.max_qty === null ? '' : String(t.max_qty),
    unit_price_usd: String(t.unit_price),
  }));
}

/** Validates form rows. Returns an error message or null. */
export function validateTierRows(rows: TierFormRow[]): string | null {
  if (rows.length === 0) return 'Add at least one pricing tier';
  let prevMax: number | null | undefined;
  for (let i = 0; i < rows.length; i++) {
    const min = parseInt(rows[i].min_qty, 10);
    const price = parseFloat(rows[i].unit_price_usd);
    const max = rows[i].max_qty.trim() === '' ? null : parseInt(rows[i].max_qty, 10);
    if (!Number.isFinite(min) || min < 1) return `Tier ${i + 1}: min quantity must be at least 1`;
    if (!Number.isFinite(price) || price <= 0) return `Tier ${i + 1}: unit price must be greater than 0`;
    if (max !== null && (!Number.isFinite(max) || max < min)) return `Tier ${i + 1}: max quantity must be ≥ min quantity`;
    if (max === null && i < rows.length - 1) return `Tier ${i + 1}: only the last tier can have an empty max quantity`;
    if (i > 0 && prevMax !== null && prevMax !== undefined && min <= prevMax) {
      return `Tier ${i + 1}: min quantity must be greater than the previous tier's max`;
    }
    prevMax = max;
  }
  return null;
}

/** Converts valid form rows to the JSONB payload. */
export function formRowsToPayload(rows: TierFormRow[]): TierRow[] {
  return rows
    .map((r) => ({
      min_qty: parseInt(r.min_qty, 10),
      max_qty: r.max_qty.trim() === '' ? null : parseInt(r.max_qty, 10),
      unit_price: parseFloat(r.unit_price_usd),
    }))
    .filter((r) => Number.isFinite(r.min_qty) && Number.isFinite(r.unit_price) && r.unit_price > 0)
    .sort((a, b) => a.min_qty - b.min_qty);
}

export function getTierPriceBounds(tiers: TierRow[]): { min: number; max: number } | null {
  if (!tiers.length) return null;
  const prices = tiers.map((t) => t.unit_price);
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

/** Finds the tier that matches a given quantity. Quantities below the first tier use the first tier. */
export function findTierForQty(tiers: TierRow[], qty: number): TierRow | null {
  if (!tiers.length) return null;
  const sorted = [...tiers].sort((a, b) => a.min_qty - b.min_qty);
  let match: TierRow | null = null;
  for (const t of sorted) {
    if (qty >= t.min_qty && (t.max_qty === null || qty <= t.max_qty)) {
      match = t;
      break;
    }
  }
  if (match) return match;
  if (qty < sorted[0].min_qty) return sorted[0];
  return sorted[sorted.length - 1];
}

export function formatUsd(value: number): string {
  return `$${value.toFixed(2)}`;
}
