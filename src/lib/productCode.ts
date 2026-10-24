export const PUBLIC_SITE_URL = 'https://direct-hub.net';

export interface ShareableProduct {
  id: string;
  name: string;
  name_ar?: string | null;
  sku?: string | null;
  slug?: string | null;
  currency?: string | null;
}

export function isDomesticCurrency(currency?: string | null): boolean {
  return String(currency || 'YER').toUpperCase() === 'YER';
}

export function getSiteBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || PUBLIC_SITE_URL).replace(/\/+$/, '');
}

/** Canonical public product URL: /p/[product_id]. */
export function buildPublicProductUrl(productId: string): string {
  return `${getSiteBaseUrl()}/p/${productId}`;
}

/** Display code (falls back to a stable placeholder when the DB has not yet assigned one). */
export function getProductCode(product: ShareableProduct): string {
  const sku = (product.sku || '').trim();
  if (sku) return sku;
  return isDomesticCurrency(product.currency) ? 'DH-YE-----' : 'DH-INT-----';
}

/** Clipboard / WhatsApp text for the "نسخ رابط وكود المنتج" action. */
export function buildProductShareText(product: ShareableProduct): string {
  const name = (product.name_ar || '').trim() || product.name;
  return `الصنف: ${name}\nالكود: ${getProductCode(product)}\nالمواصفات والطلب المباشر:\n${buildPublicProductUrl(product.id)}`;
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
