export const PUBLIC_SITE_URL = 'https://direct-hub.net';

export interface ShareableProduct {
  id: string;
  name: string;
  name_ar?: string | null;
  sku?: string | null;
  slug?: string | null;
  short_id?: string | null;
  currency?: string | null;
}

export function isDomesticCurrency(currency?: string | null): boolean {
  return String(currency || 'YER').toUpperCase() === 'YER';
}

export function getSiteBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || PUBLIC_SITE_URL).replace(/\/+$/, '');
}

/**
 * Canonical public product URL: /p/[short_id | slug | id].
 * Prefers the shortest stable identifier so the link never wraps in WhatsApp/SMS.
 * Accepts a plain id string (legacy) or a product-like object.
 */
export function buildPublicProductUrl(
  productOrId: string | Pick<ShareableProduct, 'id' | 'short_id' | 'slug'>
): string {
  const ref =
    typeof productOrId === 'string'
      ? productOrId
      : (productOrId.short_id || '').trim() || (productOrId.slug || '').trim() || productOrId.id;
  return `${getSiteBaseUrl()}/p/${encodeURIComponent(ref)}`;
}

/** Display code (falls back to a stable placeholder when the DB has not yet assigned one). */
export function getProductCode(product: ShareableProduct): string {
  const sku = (product.sku || '').trim();
  if (sku) return sku;
  return isDomesticCurrency(product.currency) ? 'DH-YE-----' : 'DH-INT-----';
}

/**
 * Clipboard / WhatsApp text for the "نسخ رابط وكود المنتج" action.
 * The URL sits alone on its final line: no trailing spaces, no hidden/bidi characters.
 */
export function buildProductShareText(product: ShareableProduct): string {
  const clean = (s: string) =>
    s.replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF\u00A0]/g, ' ').replace(/\s+/g, ' ').trim();
  const name = clean((product.name_ar || '').trim() || product.name);
  const url = buildPublicProductUrl(product).replace(/\s+/g, '');
  return [`الصنف: ${name}`, `الكود: ${clean(getProductCode(product))}`, 'رابط الطلب:', url].join('\n');
}

export async function copyProductShareText(product: ShareableProduct): Promise<boolean> {
  const text = buildProductShareText(product);
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to legacy fallback
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
