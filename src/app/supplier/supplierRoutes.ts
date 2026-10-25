export type SupplierLocalTab =
  | 'analytics' |'inventory' |'seller_fulfillment' |'sales_team' |'disputes' |'financial_hub' |'factory_orders' |'factory_settings' |'products' |'finance' |'escrow_orders' |'admin_messaging' |'archive' |'all_sales' |'contracts' |'invoicing' |'production';

export interface SupplierRouteDef {
  /** Segment under /supplier */
  slug: string;
  /** Dashboard tab rendered in module mode */
  tab: SupplierLocalTab;
  /** Manufacturer path prefixes mapped to this supplier route */
  manufacturerPaths: string[];
}

/** Each /manufacturer/... card path → its isolated /supplier/... equivalent. */
export const SUPPLIER_ROUTES: SupplierRouteDef[] = [
  { slug: 'products', tab: 'products', manufacturerPaths: ['/manufacturer/products'] },
  { slug: 'finance', tab: 'financial_hub', manufacturerPaths: ['/manufacturer/finance', '/manufacturer/revenue'] },
  { slug: 'escrow', tab: 'escrow_orders', manufacturerPaths: ['/manufacturer/escrow'] },
  { slug: 'messages', tab: 'admin_messaging', manufacturerPaths: ['/manufacturer/messages'] },
  { slug: 'archive', tab: 'archive', manufacturerPaths: ['/manufacturer/archive'] },
  { slug: 'sales-channels', tab: 'all_sales', manufacturerPaths: ['/manufacturer/sales-channels', '/manufacturer/all-sales'] },
  { slug: 'contracts', tab: 'contracts', manufacturerPaths: ['/manufacturer/contracts'] },
  { slug: 'invoicing', tab: 'invoicing', manufacturerPaths: ['/manufacturer/invoicing'] },
  { slug: 'production-lines', tab: 'production', manufacturerPaths: ['/manufacturer/production-lines', '/manufacturer/production'] },
  { slug: 'analytics', tab: 'analytics', manufacturerPaths: ['/manufacturer/analytics'] },
  { slug: 'materials', tab: 'inventory', manufacturerPaths: ['/manufacturer/materials', '/manufacturer/inventory', '/manufacturer/raw-materials'] },
  { slug: 'logistics', tab: 'seller_fulfillment', manufacturerPaths: ['/manufacturer/logistics'] },
  { slug: 'team', tab: 'sales_team', manufacturerPaths: ['/manufacturer/team', '/manufacturer/sales-team'] },
  { slug: 'disputes', tab: 'disputes', manufacturerPaths: ['/manufacturer/disputes'] },
  { slug: 'orders', tab: 'factory_orders', manufacturerPaths: ['/manufacturer/orders'] },
];

export function getSupplierRouteBySlug(slug: string | null | undefined): SupplierRouteDef | null {
  return SUPPLIER_ROUTES.find((r) => r.slug === slug) ?? null;
}

/**
 * Maps any `/manufacturer/...` href (optionally with a query string) to its
 * `/supplier/...` equivalent. Returns null when there is no supplier equivalent.
 */
export function toSupplierHref(href: string): string | null {
  if (!href) return null;
  const [pathPart, query] = href.split('?');
  const normalized = pathPart.replace(/\/+$/, '');
  if (normalized === '/manufacturer/settings') {
    return '/supplier/settings';
  }
  if (normalized === '/manufacturer' || normalized === '/manufacturer/dashboard') {
    return '/supplier';
  }
  const route = SUPPLIER_ROUTES.find((r) => r.manufacturerPaths.includes(normalized));
  if (!route) return null;
  return `/supplier/${route.slug}${query ? `?${query}` : ''}`;
}
