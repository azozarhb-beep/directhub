'use client';

// ============================================================
// PERMANENT RULE: This context is the single source of truth
// for language detection. Priority order:
//   1. Manual user selection (localStorage dh_lang_manual)
//   2. Supabase user_profiles.preferred_language (logged-in users)
//   3. Browser locale (navigator.language)
//   4. localStorage / cookie from previous session
// Never bypass this with hardcoded language values.
// See: src/lib/i18n.ts → LOCALIZATION_RULE
// ============================================================

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import {
  Language,
  getTranslations,
  SUPPORTED_LANGUAGES,
  detectBrowserLanguage,
  storeLanguage,
  dirForLanguage,
  writeLanguageCookie,
  isSupportedLanguage,
  LANG_MANUAL_KEY,
} from '@/lib/i18n';
import { createClient } from '@/lib/supabase/client';
import type en from '@/locales/en.json';

// Local storage key used for the persisted language
const LANG_STORAGE_KEY = 'dh_lang';

// Persist the preferred language to the Supabase user_profiles table
async function persistProfileLanguage(userId: string, lang: Language) {
  try {
    const supabase = createClient();
    await supabase
      .from('user_profiles')
      .update({ preferred_language: lang })
      .eq('id', userId);
  } catch (_) {
    // Non-critical — localStorage already saved the preference
  }
}

interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: typeof en;
  dir: 'ltr' | 'rtl';
  isRTL: boolean;
}

const LanguageContext = createContext<LanguageContextValue>({
  language: 'en',
  setLanguage: () => {},
  t: getTranslations('en'),
  dir: 'ltr',
  isRTL: false,
});

function applyLangDir(lang: Language) {
  const langConfig = SUPPORTED_LANGUAGES.find((l) => l.code === lang);
  const dir = langConfig?.dir || 'ltr';
  document.documentElement.lang = lang;
  document.documentElement.dir = dir;
  // Also update <body> dir for PWA standalone mode compatibility
  document.body.dir = dir;
}

export function LanguageProvider({
  children,
  initialLanguage = 'en',
}: {
  children: React.ReactNode;
  /** Must match the <html lang> rendered by the server layout. */
  initialLanguage?: Language;
}) {
  // Start from the server-provided language so the first client render matches SSR.
  const [language, setLanguageState] = useState<Language>(initialLanguage);
  const [mounted, setMounted] = useState(false);

  // Track whether the user has manually chosen a language this session
  // so we don't override it with the DB value.
  const manualOverrideRef = useRef(false);

  // ─── Mount effect: browser detection + Supabase sync ───────────────────────
  useEffect(() => {
    let cancelled = false;

    async function initLanguage() {
      // Step 1 — Check for a manual override stored in localStorage.
      let isManual = false;
      try {
        isManual = localStorage.getItem(LANG_MANUAL_KEY) === 'true';
      } catch (_) {}

      if (isManual) {
        // User previously chose manually — respect that choice, skip DB sync.
        const detected = detectBrowserLanguage(); // returns stored manual lang
        if (!cancelled) {
          setLanguageState(detected);
          storeLanguage(detected);
          writeLanguageCookie(detected);
          applyLangDir(detected);
          manualOverrideRef.current = true;
        }
        return;
      }

      // Step 2 — Try to load preferred_language from Supabase user_profiles.
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user && !cancelled) {
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('preferred_language')
            .eq('id', user.id)
            .maybeSingle();

          if (profile?.preferred_language && isSupportedLanguage(profile.preferred_language)) {
            const dbLang = profile.preferred_language as Language;
            if (!cancelled) {
              setLanguageState(dbLang);
              storeLanguage(dbLang);
              writeLanguageCookie(dbLang);
              applyLangDir(dbLang);
              setMounted(true);
            }
            return;
          }
        }
      } catch (_) {
        // Supabase unavailable — fall through to browser detection
      }

      // Step 3 — Fall back to browser locale / cookie.
      if (!cancelled) {
        const detected = detectBrowserLanguage();
        setLanguageState(detected);
        storeLanguage(detected);
        writeLanguageCookie(detected);
        applyLangDir(detected);
      }
    }

    initLanguage().finally(() => {
      if (!cancelled) setMounted(true);
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Apply dir/lang attributes whenever language changes after mount ────────
  useEffect(() => {
    if (mounted) {
      applyLangDir(language);
    }
  }, [language, mounted]);

  // ─── Cross-tab sync: another tab changed the language ──────────────────────
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== LANG_STORAGE_KEY || !e.newValue) return;
      if (!isSupportedLanguage(e.newValue)) return;
      const next = e.newValue as Language;
      setLanguageState((prev) => {
        if (prev === next) return prev;
        writeLanguageCookie(next);
        applyLangDir(next);
        return next;
      });
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // ─── After login/logout: pull the saved profile language (unless user chose manually) ─
  useEffect(() => {
    const supabase = createClient();
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== 'SIGNED_IN' || !session?.user) return;
      if (manualOverrideRef.current) {
        // Keep the local manual choice and push it to the account.
        let current: string | null = null;
        try {
          current = localStorage.getItem(LANG_STORAGE_KEY);
        } catch (_) {}
        if (current && isSupportedLanguage(current)) {
          void persistProfileLanguage(session.user.id, current as Language);
        }
        return;
      }
      void (async () => {
        try {
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('preferred_language')
            .eq('id', session.user.id)
            .maybeSingle();
          const dbLang = profile?.preferred_language;
          if (dbLang && isSupportedLanguage(dbLang)) {
            setLanguageState(dbLang as Language);
            storeLanguage(dbLang as Language);
            applyLangDir(dbLang as Language);
          }
        } catch (_) {}
      })();
    });
    return () => sub?.subscription?.unsubscribe();
  }, []);

  // ─── Manual language toggle ─────────────────────────────────────────────────
  // Marks the preference as manual so browser locale / DB are not forced again.
  // Also persists the choice back to Supabase user_profiles when logged in.
  const setLanguage = useCallback(async (lang: Language) => {
    manualOverrideRef.current = true;
    setLanguageState(lang);
    storeLanguage(lang, { manual: true });
    applyLangDir(lang);

    // Persist to Supabase so the preference follows the user across devices.
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        await persistProfileLanguage(user.id, lang);
      }
    } catch (_) {
      // Non-critical — localStorage already saved the preference
    }
  }, []);

  const t = getTranslations(language);
  const dir = dirForLanguage(language);
  const isRTL = dir === 'rtl';

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, dir, isRTL }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
