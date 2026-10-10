/**
 * Gate chat translation UI to international counterparts only.
 * Local factory / local supplier / Yemen-local peers should not see Translate chrome.
 */

/** Yemen / platform-local country identifiers (ISO, EN, AR, common variants). */
export const YEMEN_LOCAL_COUNTRY_IDENTIFIERS = [
  'YE',
  'YEM',
  'Yemen',
  'yemen',
  'YEMEN',
  'اليمن',
] as const;

const LOCAL_SELLER_CATEGORIES = new Set(['local_factory', 'local_supplier']);
const INTERNATIONAL_SELLER_CATEGORIES = new Set(['international_factory']);

/** Normalize DB factory_type aliases onto seller_category-style keys. */
const FACTORY_TYPE_ALIASES: Record<string, string> = {
  international: 'international_factory',
  intl: 'international_factory',
  local: 'local_factory',
  local_factory: 'local_factory',
  local_supplier: 'local_supplier',
  international_factory: 'international_factory',
};

export type ChatTranslationCounterpart = {
  /** user_profiles.seller_category or equivalent */
  sellerCategory?: string | null;
  /** factories.factory_type when seller_category is unavailable */
  factoryType?: string | null;
  /** Origin / supplier / peer country (name or ISO) */
  country?: string | null;
};

function normalizeCountry(country?: string | null): string {
  return (country || '').trim();
}

/** True when country is Yemen / platform-local (case-insensitive for Latin forms). */
export function isYemenLocalCountry(country?: string | null): boolean {
  const raw = normalizeCountry(country);
  if (!raw) return false;
  const lower = raw.toLowerCase();
  return YEMEN_LOCAL_COUNTRY_IDENTIFIERS.some((id) => {
    if (id === 'اليمن') return raw === id;
    return id.toLowerCase() === lower;
  });
}

function resolveEntityType(counterpart: ChatTranslationCounterpart): string | null {
  const cat = (counterpart.sellerCategory || '').trim().toLowerCase();
  if (cat) return FACTORY_TYPE_ALIASES[cat] || cat;
  const ft = (counterpart.factoryType || '').trim().toLowerCase();
  if (!ft) return null;
  return FACTORY_TYPE_ALIASES[ft] || ft;
}

/**
 * Whether Translate buttons / live-translation chrome should appear for this chat.
 *
 * Rules (seller category / factory_type win when present):
 * - international_factory → show
 * - local_factory / local_supplier → hide
 * - else: hide for Yemen-local country; show for any other non-empty foreign country
 * - unknown (no category, no country) → hide (local-local by default)
 */
export function needsChatTranslation(counterpart: ChatTranslationCounterpart): boolean {
  const entityType = resolveEntityType(counterpart);

  if (entityType && INTERNATIONAL_SELLER_CATEGORIES.has(entityType)) {
    return true;
  }
  if (entityType && LOCAL_SELLER_CATEGORIES.has(entityType)) {
    return false;
  }

  const country = normalizeCountry(counterpart.country);
  if (!country) return false;
  if (isYemenLocalCountry(country)) return false;
  return true;
}
