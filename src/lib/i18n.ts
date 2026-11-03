import en from '@/locales/en.json';
import ar from '@/locales/ar.json';
import zh from '@/locales/zh.json';
import tr from '@/locales/tr.json';

// ============================================================
// ⚠️  PERMANENT PLATFORM-WIDE LOCALIZATION RULE  ⚠️
// ============================================================

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

export const COUNTRY_LANGUAGE_MAP: Record<string, Language> = {
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
  'China': 'zh',
  'Taiwan': 'zh',
  'Hong Kong': 'zh',
  'Macau': 'zh',
  'Turkey': 'tr',
  'Türkiye': 'tr',
  'Azerbaijan': 'tr',
  'Turkmenistan': 'tr',
  'Uzbekistan': 'tr',
  'Kazakhstan': 'tr',
  'Kyrgyzstan': 'tr',
};

export function detectSupplierLanguage(originCountry: string): Language {
  if (!originCountry) return 'en';
  return COUNTRY_LANGUAGE_MAP[originCountry] || 'en';
}

function deepMerge<T extends Record<string, any>>(base: T, override: any): T {
  if (!override || typeof override !== 'object') return base;
  const result: any = Array.isArray(base) ? [...base] : { ...base };
  for (const key of Object.keys(override)) {
    if (
      override[key] &&
      typeof override[key] === 'object' &&
      !Array.isArray(override[key]) &&
      base[key] &&
      typeof base[key] === 'object'
    ) {
      result[key] = deepMerge(base[key], override[key]);
    } else if (override[key] !== undefined && override[key] !== '') {
      result[key] = override[key];
    }
  }
  return result;
}

const translations: Record<Language, typeof en> = {
  en,
  ar: deepMerge(en, ar),
  zh: deepMerge(en, zh),
  tr: deepMerge(en, tr),
};

export function getTranslations(language: Language): typeof en {
  return translations[language] || translations.en;
}

export const LANG_MANUAL_KEY = 'dh_lang_manual';
export const LANG_STORAGE_KEY = 'dh_lang';
export const LANG_COOKIE = 'dh_lang';

export function isSupportedLanguage(value: string | null | undefined): value is Language {
  return value === 'en' || value === 'ar' || value === 'zh' || value === 'tr';
}

export function dirForLanguage(language: Language): 'ltr' | 'rtl' {
  return language === 'ar' ? 'rtl' : 'ltr';
}

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
  try {
    const match = document.cookie.match(/(?:^|; )dh_lang=([^;]*)/);
    if (match) {
      const cookieLang = decodeURIComponent(match[1]) as Language;
      if (['en', 'ar', 'zh', 'tr'].includes(cookieLang)) {
        return cookieLang;
      }
    }
  } catch (_) {}
  return languageFromNavigator();
}

export function getPlatformName(language: Language): string {
  return language === 'ar' ? 'دايركت هب' : 'Direct Hub';
}

export function getStoredLanguage(): Language {
  return detectBrowserLanguage();
}

export function storeLanguage(lang: Language, options?: { manual?: boolean }): void {
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lang);
    if (options?.manual) {
      localStorage.setItem(LANG_MANUAL_KEY, 'true');
    }
  } catch (_) {}
  writeLanguageCookie(lang);
}
