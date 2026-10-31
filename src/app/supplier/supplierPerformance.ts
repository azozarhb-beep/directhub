export type PerformanceBadge = 'top' | 'repeat' | 'slow';

export interface ProductPerf {
  views: number;
  unitsSold: number;
  orderCount: number;
  revenue: Record<string, number>;
  badge: PerformanceBadge;
}

export const PERF_BADGE_LABEL: Record<PerformanceBadge, string> = {
  top: 'الأكثر مبيعاً 🔥',
  repeat: 'طلب متكرر',
  slow: 'راكد / منخفض الحركة',
};

export const PERF_BADGE_CLS: Record<PerformanceBadge, string> = {
  top: 'bg-orange-500/15 text-orange-300 border border-orange-500/40',
  repeat: 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40',
  slow: 'bg-slate-700 text-slate-300 border border-slate-600',
};

export interface PerfProductInput {
  id: string;
  name: string;
  name_ar: string | null;
  sku: string | null;
  unit: string;
  currency: string;
  wholesale_price: number;
  stock_quantity: number;
  image_url: string | null;
  view_count?: number | null;
}

interface OrderLike {
  status: string | null;
  escrow_status: string | null;
  created_at: string;
  items: unknown;
}

const CANCELED = ['cancelled', 'canceled', 'refunded', 'rejected', 'returned'];

function norm(v: unknown): string {
  return String(v ?? '').trim().toLowerCase();
}

function isCounted(o: OrderLike): boolean {
  const s = norm(o.status);
  const e = norm(o.escrow_status);
  return !CANCELED.includes(s) && e !== 'cancelled' && e !== 'refund_processed';
}

export function formatCompact(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

/** Builds per-product performance by matching order line items to products via id, SKU, or name. */
export function buildProductPerformance(
  products: PerfProductInput[],
  orders: OrderLike[],
): Map<string, ProductPerf> {
  const index = new Map<string, string>();
  products.forEach((p) => {
    index.set(norm(p.id), p.id);
    if (p.sku) index.set(norm(p.sku), p.id);
    if (p.name) index.set(norm(p.name), p.id);
    if (p.name_ar) index.set(norm(p.name_ar), p.id);
  });

  const acc = new Map<string, { units: number; orders: number; revenue: Record<string, number> }>();
  products.forEach((p) => acc.set(p.id, { units: 0, orders: 0, revenue: {} }));

  orders.filter(isCounted).forEach((o) => {
    const lines = Array.isArray(o.items) ? (o.items as any[]) : [];
    const seen = new Set<string>();
    lines.forEach((li) => {
      const candidates = [li?.product_id, li?.id, li?.sku, li?.product_name, li?.name, li?.title];
      let pid: string | undefined;
      for (const c of candidates) {
        const hit = index.get(norm(c));
        if (hit) {
          pid = hit;
          break;
        }
      }
      if (!pid) return;
      const qty = Number(li?.quantity ?? li?.qty ?? 0);
      if (!Number.isFinite(qty) || qty <= 0) return;
      const price = Number(li?.price ?? li?.unit_price ?? 0);
      const product = products.find((p) => p.id === pid);
      const cur = String(li?.currency ?? product?.currency ?? 'YER').toUpperCase();
      const slot = acc.get(pid)!;
      slot.units += qty;
      slot.revenue[cur] = (slot.revenue[cur] || 0) + (Number.isFinite(price) ? price * qty : 0);
      if (!seen.has(pid)) {
        slot.orders += 1;
        seen.add(pid);
      }
    });
  });

  const maxUnits = Math.max(0, ...Array.from(acc.values()).map((v) => v.units));
  const result = new Map<string, ProductPerf>();
  products.forEach((p) => {
    const a = acc.get(p.id)!;
    let badge: PerformanceBadge = 'slow';
    if (a.units > 0 && a.units === maxUnits && a.units >= 2) badge = 'top';
    else if (a.orders >= 2) badge = 'repeat';
    else if (a.units > 0 && a.units >= maxUnits * 0.5) badge = 'repeat';
    result.set(p.id, {
      views: Number(p.view_count ?? 0),
      unitsSold: a.units,
      orderCount: a.orders,
      revenue: a.revenue,
      badge,
    });
  });
  return result;
}

export function revenueEntries(rev: Record<string, number>): Array<[string, number]> {
  return Object.entries(rev).filter(([, v]) => v > 0);
}
