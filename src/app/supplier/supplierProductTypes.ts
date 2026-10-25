export interface PriceTier {
  min_qty: string;
  max_qty: string;
  price: string;
}

export type DeliveryTerms = 'exw_warehouse' | 'buyer_ships' | 'delivery_included';

export const DELIVERY_TERMS_OPTIONS: Array<{ value: DeliveryTerms; label: string }> = [
  { value: 'exw_warehouse', label: 'تسليم مستودع (EXW)' },
  { value: 'buyer_ships', label: 'شحن على المشتري' },
  { value: 'delivery_included', label: 'توصيل شامل' },
];

export function deliveryTermsLabel(v: string | null | undefined): string {
  return DELIVERY_TERMS_OPTIONS.find((o) => o.value === v)?.label ?? '—';
}

export interface ProductVariants {
  colors: string[];
  sizes: string[];
  flavors: string[];
}

export const EMPTY_VARIANTS: ProductVariants = { colors: [], sizes: [], flavors: [] };

export interface ProductRow {
  id: string;
  name: string;
  name_ar: string | null;
  sku: string | null;
  category: string | null;
  description: string | null;
  unit: string;
  wholesale_price: number;
  retail_price: number | null;
  currency: string;
  min_order_qty: number;
  stock_quantity: number;
  status: string;
  image_url: string | null;
  gallery_urls: string[] | null;
  price_tiers: Array<{ min_qty: number; max_qty: number | null; price: number }> | null;
  units_per_pack: number | null;
  gross_weight_kg: number | null;
  dimensions: string | null;
  variants: Partial<ProductVariants> | null;
  low_stock_threshold: number | null;
  shelf_location: string | null;
  delivery_terms: string | null;
}

export const PRODUCT_SELECT =
  'id, name, name_ar, sku, category, description, unit, wholesale_price, retail_price, currency, min_order_qty, stock_quantity, status, image_url, gallery_urls, price_tiers, units_per_pack, gross_weight_kg, dimensions, variants, low_stock_threshold, shelf_location, delivery_terms';

export type StockState = 'in' | 'low' | 'out';

export function stockState(p: Pick<ProductRow, 'stock_quantity' | 'low_stock_threshold'>): StockState {
  const q = Number(p.stock_quantity ?? 0);
  const t = Number(p.low_stock_threshold ?? 0);
  if (q <= 0) return 'out';
  if (t > 0 && q <= t) return 'low';
  return 'in';
}

export const STOCK_LABEL: Record<StockState, string> = { in: 'متوفر', low: 'منخفض', out: 'نافد المخزون' };
export const STOCK_CLS: Record<StockState, string> = {
  in: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40',
  low: 'bg-amber-500/15 text-amber-300 border border-amber-500/40',
  out: 'bg-red-500/15 text-red-300 border border-red-500/40',
};

export function formatMoney(n: number | null | undefined): string {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(Number(n));
}
