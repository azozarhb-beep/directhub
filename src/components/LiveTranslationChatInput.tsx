'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Icon from '@/components/ui/AppIcon';

// ─── Types ────────────────────────────────────────────────────────────────────
type SupportedLang = 'ar' | 'en' | 'zh' | 'tr';

interface LiveTranslationChatInputProps {
  /** Placeholder text for the textarea */
  placeholder?: string;
  /** The target language to translate into */
  targetLanguage?: SupportedLang;
  /** The source language of the user's input (for display only) */
  sourceLang?: SupportedLang;
  /** Called when the user submits the message — receives original + translated text */
  onSend?: (original: string, translated: string, targetLang: SupportedLang) => void;
  /** Called whenever the translated text changes (live) */
  onTranslationChange?: (translated: string) => void;
  /** Disable the input */
  disabled?: boolean;
  /** Max characters allowed */
  maxLength?: number;
  /** Show the language selector inside the widget */
  showLanguageSelector?: boolean;
  /** Initial target language */
  defaultTargetLang?: SupportedLang;
  /** Custom class for the outer wrapper */
  className?: string;
  /** Whether to show the translated preview below the input */
  showPreview?: boolean;
  /** Debounce delay in ms (default: 200) */
  debounceMs?: number;
  /**
   * When false, hides live-translation chrome and skips translate API calls
   * (use for local factory / local supplier / Yemen-local chats).
   * Pass `needsChatTranslation(...)` when mounting this component.
   * Default true so standalone usage keeps existing behavior.
   * Callers: UnifiedMessagingEngine, chat/page.
   */
  translationEnabled?: boolean;
}

const LANG_OPTIONS: { value: SupportedLang; label: string; flag: string; nativeName: string }[] = [
  { value: 'ar', label: 'Arabic',  flag: '🇸🇦', nativeName: 'العربية' },
  { value: 'en', label: 'English', flag: '🇬🇧', nativeName: 'English'  },
  { value: 'zh', label: 'Chinese', flag: '🇨🇳', nativeName: '中文'     },
  { value: 'tr', label: 'Turkish', flag: '🇹🇷', nativeName: 'Türkçe'   },
];

const LANG_DIR: Record<SupportedLang, 'rtl' | 'ltr'> = {
  ar: 'rtl',
  en: 'ltr',
  zh: 'ltr',
  tr: 'ltr',
};

// ─── Retry helper ─────────────────────────────────────────────────────────────
async function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

// ─── Translation helper with retry + fallback ─────────────────────────────────
// Returns the translated text on success, or the ORIGINAL text on any failure
// so the UI never freezes or shows a broken state.
async function translateText(
  text: string,
  targetLanguage: SupportedLang,
  signal?: AbortSignal,
  maxRetries = 2,
): Promise<{ result: string; isFallback: boolean }> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Bail out immediately if the caller aborted (e.g. user typed again)
    if (signal?.aborted) {
      return { result: text, isFallback: true };
    }

    try {
      const controller = new AbortController();
      // Timeout scales with text length: 30s for long B2B texts, 10s for short
      const timeoutMs = text.length >= 300 ? 30_000 : 10_000;
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      // If the outer signal aborts, also abort this fetch
      const onOuterAbort = () => controller.abort();
      signal?.addEventListener('abort', onOuterAbort, { once: true });

      let res: Response;
      try {
        res = await fetch('/api/ai/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, targetLanguage }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
        signal?.removeEventListener('abort', onOuterAbort);
      }

      // Server returned a non-2xx — treat as retryable
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();

      // Server-side fallback: API returned original text due to exhausted retries
      if (data.fallback) {
        return { result: data.translated || text, isFallback: true };
      }

      const translated = data.translated;
      if (!translated || typeof translated !== 'string' || !translated.trim()) {
        throw new Error('Empty translation');
      }

      return { result: translated.trim(), isFallback: false };
    } catch (err) {
      lastError = err;

      // Don't retry if aborted
      if (signal?.aborted) {
        return { result: text, isFallback: true };
      }

      // Back-off before next retry: 400ms, 800ms
      if (attempt < maxRetries) {
        await sleep(400 * Math.pow(2, attempt));
      }
    }
  }

  // All retries exhausted — return original text as safe fallback
  console.warn('[LiveTranslation] All retries failed, using original text:', lastError);
  return { result: text, isFallback: true };
}

// ─── Debounce hook ────────────────────────────────────────────────────────────
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function LiveTranslationChatInput({
  placeholder,
  targetLanguage,
  sourceLang,
  onSend,
  onTranslationChange,
  disabled = false,
  maxLength = 8000,
  showLanguageSelector = true,
  defaultTargetLang = 'en',
  className = '',
  showPreview = true,
  debounceMs = 200,
  translationEnabled = true,
}: LiveTranslationChatInputProps) {
  const [text, setText] = useState('');
  const [translated, setTranslated] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationError, setTranslationError] = useState(false);
  const [isFallback, setIsFallback] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [activeLang, setActiveLang] = useState<SupportedLang>(targetLanguage ?? defaultTargetLang);
  const [showLangDropdown, setShowLangDropdown] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [copied, setCopied] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(false);

  const debouncedText = useDebounce(text, debounceMs);

  // Track mount state
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  // Sync external targetLanguage prop
  useEffect(() => {
    if (targetLanguage) setActiveLang(targetLanguage);
  }, [targetLanguage]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 320) + 'px';
  }, [text]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowLangDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Live translation with debounce
  useEffect(() => {
    if (!translationEnabled) {
      setTranslated('');
      setIsTranslating(false);
      setTranslationError(false);
      setIsFallback(false);
      onTranslationChange?.('');
      return;
    }
    if (!debouncedText.trim()) {
      setTranslated('');
      setTranslationError(false);
      setIsFallback(false);
      setRetryCount(0);
      onTranslationChange?.('');
      return;
    }

    // Cancel any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsTranslating(true);
    setTranslationError(false);
    setIsFallback(false);

    translateText(debouncedText, activeLang, controller.signal)
      .then(({ result, isFallback: fb }) => {
        if (!isMountedRef.current || controller.signal.aborted) return;
        setTranslated(result);
        setIsFallback(fb);
        setTranslationError(false);
        onTranslationChange?.(result);
      })
      .catch(() => {
        // translateText never throws — this is a safety net
        if (!isMountedRef.current || controller.signal.aborted) return;
        setTranslated(debouncedText); // show original as fallback
        setIsFallback(true);
        setTranslationError(false);
        onTranslationChange?.(debouncedText);
      })
      .finally(() => {
        if (!isMountedRef.current || controller.signal.aborted) return;
        setIsTranslating(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedText, activeLang, translationEnabled]);

  // Re-translate when language changes
  const handleLangChange = useCallback((lang: SupportedLang) => {
    setActiveLang(lang);
    setShowLangDropdown(false);
    if (text.trim()) {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setIsTranslating(true);
      setIsFallback(false);
      translateText(text, lang, controller.signal).then(({ result, isFallback: fb }) => {
        if (!isMountedRef.current || controller.signal.aborted) return;
        setTranslated(result);
        setIsFallback(fb);
        onTranslationChange?.(result);
      }).catch(() => {
        if (!isMountedRef.current || controller.signal.aborted) return;
        setTranslated(text);
        setIsFallback(true);
        onTranslationChange?.(text);
      }).finally(() => {
        if (!isMountedRef.current || controller.signal.aborted) return;
        setIsTranslating(false);
      });
    }
  }, [text, onTranslationChange]);

  const handleSend = useCallback(async () => {
    if (!text.trim() || isSending || disabled) return;
    setIsSending(true);
    try {
      let finalTranslation = translationEnabled ? translated : text;
      if (translationEnabled && !finalTranslation && text.trim()) {
        const { result } = await translateText(text, activeLang);
        finalTranslation = result;
      }
      await onSend?.(text, finalTranslation, activeLang);
      if (!isMountedRef.current) return;
      setText('');
      setTranslated('');
      setIsFallback(false);
      setRetryCount(0);
    } catch {
      // Even if send fails, don't freeze — just reset sending state
    } finally {
      if (isMountedRef.current) setIsSending(false);
    }
  }, [text, translated, activeLang, isSending, disabled, onSend, translationEnabled]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleCopyTranslation = useCallback(() => {
    if (!translated) return;
    navigator.clipboard.writeText(translated).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }, [translated]);

  const handleClear = useCallback(() => {
    abortRef.current?.abort();
    setText('');
    setTranslated('');
    setTranslationError(false);
    setIsFallback(false);
    setRetryCount(0);
    textareaRef.current?.focus();
  }, []);

  // Manual retry trigger
  const handleManualRetry = useCallback(() => {
    if (!text.trim() || isTranslating) return;
    setRetryCount((c) => c + 1);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setIsTranslating(true);
    setIsFallback(false);
    translateText(text, activeLang, controller.signal).then(({ result, isFallback: fb }) => {
      if (!isMountedRef.current || controller.signal.aborted) return;
      setTranslated(result);
      setIsFallback(fb);
      onTranslationChange?.(result);
    }).catch(() => {
      if (!isMountedRef.current || controller.signal.aborted) return;
      setTranslated(text);
      setIsFallback(true);
      onTranslationChange?.(text);
    }).finally(() => {
      if (!isMountedRef.current || controller.signal.aborted) return;
      setIsTranslating(false);
    });
  }, [text, activeLang, isTranslating, onTranslationChange]);

  const activeLangOption = LANG_OPTIONS.find(l => l.value === activeLang)!;
  const charCount = text.length;
  const isNearLimit = charCount > maxLength * 0.85;
  const isAtLimit = charCount >= maxLength;
  const canSend = text.trim().length > 0 && !disabled && !isSending;
  const translationDir = LANG_DIR[activeLang];

  // Show the floating preview when user is typing (has text) and preview is enabled
  const showFloatingPreview = translationEnabled && showPreview && text.trim().length > 0;
  // Show skeleton when debounced text hasn't caught up yet OR actively translating
  const showSkeleton = isTranslating || (text.trim().length > 0 && !debouncedText.trim());
  const effectiveShowLanguageSelector = translationEnabled && showLanguageSelector;

  return (
    <div className={`relative flex flex-col gap-0 ${className}`}>

      {/* ── Floating Live Translation Preview (above input) ──────────────────── */}
      {showFloatingPreview && (
        <div
          className={`
            mb-2 rounded-2xl border shadow-lg overflow-hidden
            bg-white border-blue-200
            transition-all duration-300 ease-out
            opacity-100 translate-y-0
          `}
          style={{
            boxShadow: '0 4px 24px 0 rgba(59,130,246,0.13), 0 1.5px 6px 0 rgba(59,130,246,0.08)',
          }}
        >
          {/* Preview header */}
          <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-blue-600 to-indigo-600">
            {/* Live pulse dot */}
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
            </span>
            <span className="text-[11px] font-semibold text-white tracking-wide">
              ترجمة حية
            </span>
            <span className="text-white/60 text-[11px]">·</span>
            <span className="text-sm">{activeLangOption.flag}</span>
            <span className="text-[11px] font-medium text-white/90">
              {activeLangOption.nativeName}
            </span>

            {/* Fallback badge */}
            {isFallback && !isTranslating && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-400/30 text-amber-100 text-[10px] font-medium">
                <Icon name="ArrowPathIcon" size={10} />
                نص أصلي
              </span>
            )}

            <div className="flex items-center gap-1 ml-auto">
              {/* Manual retry button — shown when fallback is active */}
              {isFallback && !isTranslating && (
                <button
                  type="button"
                  onClick={handleManualRetry}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-medium text-white/80 hover:text-white hover:bg-white/20 transition-colors"
                  title="إعادة المحاولة"
                >
                  <Icon name="ArrowPathIcon" size={12} />
                  <span>إعادة</span>
                </button>
              )}
              {/* Copy button */}
              {translated && !isTranslating && (
                <button
                  type="button"
                  onClick={handleCopyTranslation}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-medium text-white/80 hover:text-white hover:bg-white/20 transition-colors"
                  title="نسخ الترجمة"
                >
                  {copied ? (
                    <>
                      <Icon name="CheckIcon" size={12} />
                      <span>تم النسخ</span>
                    </>
                  ) : (
                    <>
                      <Icon name="ClipboardDocumentIcon" size={12} />
                      <span>نسخ</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Preview body */}
          <div className="px-4 py-3 bg-gradient-to-br from-blue-50/60 to-indigo-50/40 min-h-[44px]">
            {showSkeleton && !translated ? (
              /* Skeleton loading — shows while waiting for debounce + API */
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-flex gap-0.5">
                    <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                  <span className="text-[11px] text-blue-500 font-medium">جارٍ الترجمة…</span>
                </div>
                <div className="h-3 bg-blue-200/50 rounded-full animate-pulse w-4/5" />
                <div className="h-3 bg-blue-200/50 rounded-full animate-pulse w-3/5" />
              </div>
            ) : translationError ? (
              /* Hard error state — should never appear now, but kept as safety net */
              <span className="flex items-center gap-1.5 text-[12px] text-amber-600 font-medium">
                <Icon name="ExclamationTriangleIcon" size={13} className="shrink-0" />
                تعذّرت الترجمة — يُعرض النص الأصلي
              </span>
            ) : (
              <div className="relative">
                {/* Subtle updating shimmer when re-translating with existing text */}
                {isTranslating && translated && (
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-100/60 to-transparent animate-pulse rounded" />
                )}
                <p
                  dir={translationDir}
                  className={`text-sm leading-relaxed whitespace-pre-wrap break-words ${isFallback ? 'text-amber-700' : 'text-gray-800'}`}
                  style={{ fontFamily: activeLang === 'zh' ? '"Noto Sans SC", sans-serif' : 'inherit' }}
                >
                  {translated}
                </p>
                {isFallback && !isTranslating && (
                  <p className="mt-1 text-[10px] text-amber-500">
                    ⚠ الترجمة غير متاحة حالياً — يُعرض النص الأصلي. المحادثة تعمل بشكل طبيعي.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Footer badge */}
          <div className="px-3 py-1.5 bg-white/80 border-t border-blue-100/60 flex items-center justify-between">
            <span className="text-[10px] text-blue-400/80 font-medium">
              ✦ DirectHub Translation Engine · Gemini AI
            </span>
            {translated && !isTranslating && !isFallback && (
              <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
                <Icon name="CheckCircleIcon" size={11} className="shrink-0" />
                جاهزة للإرسال
              </span>
            )}
            {isFallback && !isTranslating && (
              <span className="flex items-center gap-1 text-[10px] text-amber-500 font-medium">
                <Icon name="ExclamationTriangleIcon" size={11} className="shrink-0" />
                وضع الاحتياطي
              </span>
            )}
          </div>

          {/* Downward pointer arrow connecting preview to input */}
          <div
            className="absolute bottom-0 left-6 translate-y-full"
            style={{ width: 0, height: 0, borderLeft: '8px solid transparent', borderRight: '8px solid transparent', borderTop: '8px solid #bfdbfe' }}
          />
        </div>
      )}

      {/* ── Main Input Card ─────────────────────────────────────────────────── */}
      <div
        className={`
          relative flex flex-col rounded-2xl border bg-white shadow-sm transition-all duration-200
          ${disabled ? 'opacity-60 pointer-events-none' : 'border-gray-200 focus-within:border-blue-400 focus-within:shadow-md focus-within:shadow-blue-50'}
          ${showFloatingPreview ? 'border-blue-300' : ''}
        `}
      >
        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => {
            if (e.target.value.length <= maxLength) setText(e.target.value);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder ?? 'اكتب رسالتك هنا… (سيتم ترجمتها تلقائياً)'}
          disabled={disabled}
          rows={2}
          dir={sourceLang ? LANG_DIR[sourceLang] : 'auto'}
          className="
            w-full resize-none bg-transparent px-4 pt-3.5 pb-2 text-sm text-gray-800
            placeholder:text-gray-400 focus:outline-none leading-relaxed
            min-h-[52px] max-h-[320px] overflow-y-auto
          "
          style={{ fontFamily: 'inherit' }}
        />

        {/* Bottom toolbar */}
        <div className="flex items-center gap-2 px-3 pb-2.5 pt-1">
          {/* Language selector */}
          {effectiveShowLanguageSelector && (
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setShowLangDropdown(v => !v)}
                className="
                  flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl
                  bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-300
                  text-xs font-medium text-gray-600 hover:text-blue-700
                  transition-all duration-150 select-none
                "
                title="اختر لغة الترجمة"
              >
                <span className="text-base leading-none">{activeLangOption.flag}</span>
                <span className="hidden sm:inline">{activeLangOption.nativeName}</span>
                <Icon name="ChevronDownIcon" size={12} className={`transition-transform duration-200 ${showLangDropdown ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown — opens upward */}
              {showLangDropdown && (
                <div className="
                  absolute bottom-full mb-2 left-0 z-50
                  bg-white rounded-xl shadow-xl border border-gray-100
                  py-1.5 min-w-[160px] overflow-hidden
                  animate-in fade-in slide-in-from-bottom-2 duration-150
                ">
                  <p className="px-3 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                    ترجمة إلى
                  </p>
                  {LANG_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleLangChange(opt.value)}
                      className={`
                        w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors
                        ${activeLang === opt.value
                          ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-700 hover:bg-gray-50'}
                      `}
                    >
                      <span className="text-base">{opt.flag}</span>
                      <span>{opt.nativeName}</span>
                      {activeLang === opt.value && (
                        <Icon name="CheckIcon" size={13} className="ml-auto text-blue-600" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Translation status indicator (compact, inside toolbar) */}
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            {isTranslating && text.trim() && (
              <span className="flex items-center gap-1 text-[11px] text-blue-500 font-medium">
                <span className="inline-flex gap-0.5">
                  <span className="w-1 h-1 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1 h-1 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1 h-1 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
                جارٍ الترجمة…
              </span>
            )}
            {!isTranslating && translated && !translationError && !isFallback && (
              <span className="flex items-center gap-1 text-[11px] text-emerald-600 font-medium truncate">
                <Icon name="CheckCircleIcon" size={12} className="shrink-0" />
                <span className="truncate">تمت الترجمة</span>
              </span>
            )}
            {!isTranslating && isFallback && (
              <button
                type="button"
                onClick={handleManualRetry}
                className="flex items-center gap-1 text-[11px] text-amber-600 font-medium hover:text-amber-700 transition-colors"
                title="إعادة محاولة الترجمة"
              >
                <Icon name="ArrowPathIcon" size={12} className="shrink-0" />
                <span>إعادة المحاولة</span>
              </button>
            )}
            {translationError && (
              <span className="flex items-center gap-1 text-[11px] text-amber-600 font-medium">
                <Icon name="ExclamationTriangleIcon" size={12} className="shrink-0" />
                تعذّرت الترجمة
              </span>
            )}
          </div>

          {/* Char counter */}
          {charCount > 0 && (
            <span className={`text-[11px] font-mono shrink-0 ${isAtLimit ? 'text-red-500 font-bold' : isNearLimit ? 'text-amber-500' : 'text-gray-400'}`}>
              {charCount}/{maxLength}
            </span>
          )}

          {/* Clear button */}
          {text.length > 0 && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              title="مسح النص"
            >
              <Icon name="XMarkIcon" size={14} />
            </button>
          )}

          {/* Send button */}
          <button
            type="button"
            onClick={handleSend}
            disabled={!canSend}
            className={`
              flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold
              transition-all duration-200 shrink-0
              ${canSend
                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow-md active:scale-95'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'}
            `}
            title="إرسال (Enter)"
          >
            {isSending ? (
              <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : (
              <Icon name="PaperAirplaneIcon" size={14} />
            )}
            <span className="hidden sm:inline">إرسال</span>
          </button>
        </div>
      </div>
    </div>
  );
}
