import en from '@/locales/en.json';
import ar from '@/locales/ar.json';
import zh from '@/locales/zh.json';
import tr from '@/locales/tr.json';

// ============================================================
// ⚠️  PERMANENT PLATFORM-WIDE LOCALIZATION RULE  ⚠️
// ============================================================
// Every new page, button, feature, or text added to DirectHub
// MUST be fully dynamic and auto-adapt to the user's browser
// language (browser locale) with NO hardcoded strings.
//
// Rules for all future development:
//  1. NEVER hardcode user-facing strings in JSX/TSX.
//  2. ALL text must come from src/locales/{lang}.json via
//     getTranslations(language) or the useLanguage() hook.
//  3. New keys must be added to ALL locale files:
//     en.json, ar.json, zh.json, tr.json
//  4. Arabic browsers (ar-*) must see a fully Arabic UI.
//  5. The default language is ALWAYS detected from the browser
//     via detectBrowserLanguage() — never assume 'en'.
//  6. Use the useLanguage() hook in every component:
//       const { t, language, isRTL } = useLanguage();
//
// Violation of this rule breaks the platform's multilingual
// promise and must be corrected before merging any PR.
// ============================================================

/** Exported rule constant — import this as a reminder in new modules */
export const LOCALIZATION_RULE = {
  version: '1.0',
  enforced: true,
  description:
    'All user-facing strings must use getTranslations() / useLanguage(). No hardcoded text. Browser locale is the default.',
  localeFiles: ['en.json', 'ar.json', 'zh.json', 'tr.json'],
  hook: 'useLanguage()',
  defaultDetection: 'detectBrowserLanguage()',
} as const;

export type Language = 'en' | 'ar' | 'zh' | 'tr';

export const SUPPORTED_LANGUAGES: { code: Language; label: string; nativeLabel: string; dir: 'ltr' | 'rtl'; flag: string; countryCode: string }[] = [
  { code: 'en', label: 'English', nativeLabel: 'EN', dir: 'ltr', flag: '🇬🇧', countryCode: 'GB' },
  { code: 'ar', label: 'Arabic', nativeLabel: 'ع', dir: 'rtl', flag: '🇸🇦', countryCode: 'SA' },
  { code: 'zh', label: 'Chinese', nativeLabel: '中', dir: 'ltr', flag: '🇨🇳', countryCode: 'CN' },
  { code: 'tr', label: 'Turkish', nativeLabel: 'TR', dir: 'ltr', flag: '🇹🇷', countryCode: 'TR' },
];

// Map supplier/factory origin countries to their preferred language
export const COUNTRY_LANGUAGE_MAP: Record<string, Language> = {
  // Arabic-speaking countries
  'Saudi Arabia': 'ar',
  'UAE': 'ar',
  'United Arab Emirates': 'ar',
  'Yemen': 'ar',
  'Egypt': 'ar',
  'Jordan': 'ar',
  'Kuwait': 'ar',
  'Qatar': 'ar',
  'Bahrain': 'ar',
  'Oman': 'ar',
  'Iraq': 'ar',
  'Syria': 'ar',
  'Lebanon': 'ar',
  'Libya': 'ar',
  'Tunisia': 'ar',
  'Algeria': 'ar',
  'Morocco': 'ar',
  'Sudan': 'ar',
  // Chinese-speaking countries/regions
  'China': 'zh',
  'Taiwan': 'zh',
  'Hong Kong': 'zh',
  'Macau': 'zh',
  // Turkish-speaking countries
  'Turkey': 'tr',
  'Türkiye': 'tr',
  'Azerbaijan': 'tr',
  'Turkmenistan': 'tr',
  'Uzbekistan': 'tr',
  'Kazakhstan': 'tr',
  'Kyrgyzstan': 'tr',
};

/**
 * Detect the preferred language for a supplier/factory based on their origin country.
 * Falls back to 'en' if no mapping found.
 */
export function detectSupplierLanguage(originCountry: string): Language {
  if (!originCountry) return 'en';
  return COUNTRY_LANGUAGE_MAP[originCountry] || 'en';
}

const translations: Record<Language, typeof en> = {
  en,
  ar,
  zh: zh as unknown as typeof en,
  tr: tr as unknown as typeof en,
};

export function getTranslations(language: Language): typeof en {
  return translations[language] || translations.en;
}

/** Set only when the user explicitly picks a language via the UI toggle */
export const LANG_MANUAL_KEY = 'dh_lang_manual';
export const LANG_STORAGE_KEY = 'dh_lang';
/** Cookie read by the root layout so SSR lang/dir match the first client render. */
export const LANG_COOKIE = 'dh_lang';

export function isSupportedLanguage(value: string | null | undefined): value is Language {
  return value === 'en' || value === 'ar' || value === 'zh' || value === 'tr';
}

export function dirForLanguage(language: Language): 'ltr' | 'rtl' {
  return language === 'ar' ? 'rtl' : 'ltr';
}

/** Persist the active language for the next server render. */
export function writeLanguageCookie(lang: Language): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${LANG_COOKIE}=${encodeURIComponent(lang)}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

function languageFromNavigator(): Language {
  const lang = (navigator.language || (navigator as any).userLanguage || 'en').toLowerCase();
  if (lang.startsWith('ar')) return 'ar';
  if (lang.startsWith('zh')) return 'zh';
  if (lang.startsWith('tr')) return 'tr';
  return 'en';
}

/**
 * Detect UI language:
 * - If the user manually chose a language (dh_lang_manual === 'true'), use dh_lang.
 * - Otherwise check the dh_lang cookie (set by the server layout) to match SSR.
 * - Only fall back to navigator.language if no cookie is present at all.
 */
export function detectBrowserLanguage(): Language {
  if (typeof window === 'undefined') return 'en';
  try {
    const isManual = localStorage.getItem(LANG_MANUAL_KEY) === 'true';
    if (isManual) {
      const stored = localStorage.getItem(LANG_STORAGE_KEY) as Language | null;
      if (stored && ['en', 'ar', 'zh', 'tr'].includes(stored)) {
        return stored;
      }
    }
  } catch (_) {}
  // Check the dh_lang cookie — this is what the server used for SSR.
  // Using it here ensures the first client render matches the server render.
  try {
    const match = document.cookie.match(/(?:^|; )dh_lang=([^;]*)/);
    if (match) {
      const cookieLang = decodeURIComponent(match[1]) as Language;
      if (['en', 'ar', 'zh', 'tr'].includes(cookieLang)) {
        return cookieLang;
      }
    }
  } catch (_) {}
  // No cookie set yet — detect from browser locale and set cookie for next SSR.
  return languageFromNavigator();
}

/**
 * Returns the platform name locked to its canonical form per language direction.
 * EN/ZH/TR (LTR) → "Direct Hub" * AR (RTL)        →"دايركت هب"
 * This value must NEVER be passed through any translation engine.
 */
export function getPlatformName(language: Language): string {
  return language === 'ar' ? 'دايركت هب' : 'Direct Hub';
}

export function getStoredLanguage(): Language {
  return detectBrowserLanguage();
}

/**
 * Persist language. Pass `{ manual: true }` only when the user clicked the toggle.
 * Auto-detection must NOT set dh_lang_manual.
 */
export function storeLanguage(lang: Language, options?: { manual?: boolean }): void {
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lang);
    if (options?.manual) {
      localStorage.setItem(LANG_MANUAL_KEY, 'true');
    }
  } catch (_) {}
  writeLanguageCookie(lang);
}
