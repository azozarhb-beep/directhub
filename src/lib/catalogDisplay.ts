export const BRAND_PLACEHOLDER_IMAGE = '/assets/images/directhub-placeholder.svg';

const UNIT_AR: Record<string, string> = {
  piece: 'قطعة',
  pieces: 'قطعة',
  pcs: 'قطعة',
  pc: 'قطعة',
  unit: 'وحدة',
  units: 'وحدة',
  box: 'كرتون',
  boxes: 'كرتون',
  carton: 'كرتون',
  pallet: 'طبلية',
  pallets: 'طبلية',
  kg: 'كجم',
  kgs: 'كجم',
  kilogram: 'كجم',
  ton: 'طن',
  tons: 'طن',
  tonne: 'طن',
  bag: 'كيس',
  bags: 'كيس',
  sack: 'كيس',
  roll: 'لفة',
  rolls: 'لفة',
  drum: 'برميل',
  drums: 'برميل',
  barrel: 'برميل',
  meter: 'متر',
  meters: 'متر',
  metre: 'متر',
  m: 'متر',
  sqm: 'م²',
  liter: 'لتر',
  liters: 'لتر',
  litre: 'لتر',
  l: 'لتر',
  set: 'طقم',
  sets: 'طقم',
  sheet: 'صفيحة',
  sheets: 'صفيحة',
  gallon: 'جالون',
  pack: 'حزمة',
  packs: 'حزمة',
};

/** Translate an English unit label to Arabic. Unknown / already-Arabic units pass through. */
export function translateUnitAr(unit?: string | null): string {
  const raw = (unit || '').trim();
  if (!raw) return 'قطعة';
  return UNIT_AR[raw.toLowerCase()] || raw;
}

/** Format a price strictly in YER: "1,250.00 ر.ي" */
export function formatYer(amount: number | string | null | undefined): string {
  const n = Number(amount) || 0;
  return `${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ر.ي`;
}

/** Format a price strictly in USD: "$1,250.00" */
export function formatUsd(amount: number | string | null | undefined): string {
  const n = Number(amount) || 0;
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export type OriginType = 'local' | 'international';

/** Strict two-currency rule: international => USD, local => YER. */
export function currencyForOrigin(origin?: string | null): 'USD' | 'YER' {
  return String(origin || 'local').toLowerCase() === 'international' ? 'USD' : 'YER';
}

/** Format a price using the currency dictated by the product origin (USD for international, YER for local). */
export function formatPriceByOrigin(
  amount: number | string | null | undefined,
  origin?: string | null
): string {
  return currencyForOrigin(origin) === 'USD' ? formatUsd(amount) : formatYer(amount);
}

const HIDDEN_VENDOR_PATTERNS = [/مكتب\s*التنسيق/i, /coordination\s*office/i, /field\s*agent/i, /مندوب/i, /وكيل\s*ميداني/i];

/** Returns true when a vendor label is an agent / coordination-office label that must never be shown to buyers. */
export function isHiddenVendorLabel(name?: string | null): boolean {
  const s = (name || '').trim();
  if (!s) return false;
  return HIDDEN_VENDOR_PATTERNS.some((re) => re.test(s));
}

/** Pick the factory name for display, skipping any agent / coordination labels. */
export function pickFactoryName(...candidates: Array<string | null | undefined>): string | null {
  for (const c of candidates) {
    const s = (c || '').trim();
    if (s && !isHiddenVendorLabel(s)) return s;
  }
  return null;
}
