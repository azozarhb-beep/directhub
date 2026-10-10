/**
 * DirectHub Live Translator
 *
 * Free-first B2B message translation (Arabic ↔ English ↔ Chinese ↔ Turkish)
 *
 *   1. MyMemory Free API (primary) — chunked for long texts
 *   2. LibreTranslate (backup)
 *   3. safeTranslateContent / Gemini (optional last resort)
 *   4. Original text (final fallback) — never breaks the chat
 *
 * SERVER-SIDE ONLY — import inside Next.js API routes.
 */

import { completion } from '@rocketnew/llm-sdk';
import { safeTranslateContent } from './aiResilienceEngine';

export type SupportedLanguage = 'ar' | 'en' | 'zh' | 'tr';

export interface TranslationResult {
  translatedText: string;
  /** true when the original text was returned due to an error or same-language detection */
  isFallback: boolean;
  targetLanguage: SupportedLanguage;
}

const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  ar: 'Arabic',
  en: 'English',
  zh: 'Chinese (Simplified)',
  tr: 'Turkish',
};

const MYMEMORY_CODES: Record<SupportedLanguage, string> = {
  ar: 'ar',
  en: 'en',
  zh: 'zh-CN',
  tr: 'tr',
};

const LIBRE_CODES: Record<SupportedLanguage, string> = {
  ar: 'ar',
  en: 'en',
  zh: 'zh',
  tr: 'tr',
};

function detectSourceCode(text: string): string {
  if (/[\u0600-\u06FF]/.test(text)) return 'ar';
  if (/[\u4E00-\u9FFF]/.test(text)) return 'zh-CN';
  return 'en';
}

function getChunkSize(text: string): number {
  const nonAscii = (text.match(/[^\x00-\x7F]/g) || []).length;
  if (nonAscii / Math.max(text.length, 1) > 0.2) return 180;
  return 450;
}

function splitIntoChunks(text: string, chunkSize: number): string[] {
  const lines = text.split('\n');
  const chunks: string[] = [];
  let currentChunk = '';

  for (const line of lines) {
    const candidate = currentChunk ? currentChunk + '\n' + line : line;
    if (candidate.length <= chunkSize) {
      currentChunk = candidate;
    } else {
      if (currentChunk) chunks.push(currentChunk);
      if (line.length > chunkSize) {
        const parts = line.includes(' ') ? line.split(' ') : line.match(/.{1,40}/g) || [line];
        let wordChunk = '';
        for (const part of parts) {
          const sep = line.includes(' ') ? ' ' : '';
          const wCandidate = wordChunk ? wordChunk + sep + part : part;
          if (wCandidate.length <= chunkSize) {
            wordChunk = wCandidate;
          } else {
            if (wordChunk) chunks.push(wordChunk);
            if (part.length > chunkSize) {
              for (let i = 0; i < part.length; i += chunkSize) {
                chunks.push(part.slice(i, i + chunkSize));
              }
              wordChunk = '';
            } else {
              wordChunk = part;
            }
          }
        }
        currentChunk = wordChunk;
      } else {
        currentChunk = line;
      }
    }
  }
  if (currentChunk) chunks.push(currentChunk);
  return chunks.length > 0 ? chunks : [text];
}

async function translateWithMyMemory(
  text: string,
  targetLang: SupportedLanguage,
): Promise<string | null> {
  const sourceLang = detectSourceCode(text);
  const targetCode = MYMEMORY_CODES[targetLang];

  if (sourceLang.split('-')[0] === targetCode.split('-')[0]) return text;

  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(`${sourceLang}|${targetCode}`)}`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) return null;

    const data = await res.json();
    if (data?.responseStatus !== 200 && data?.responseStatus !== '200') return null;

    const translated = data?.responseData?.translatedText;
    if (!translated || typeof translated !== 'string' || !translated.trim()) return null;
    if (translated.toUpperCase().includes('PLEASE SELECT')) return text;

    return translated.trim();
  } catch {
    return null;
  }
}

async function translateWithMyMemoryChunked(
  text: string,
  targetLang: SupportedLanguage,
): Promise<string | null> {
  const chunks = splitIntoChunks(text, getChunkSize(text));
  const translatedChunks: string[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const result = await translateWithMyMemory(chunks[i], targetLang);
    translatedChunks.push(result ?? chunks[i]);
    if (i < chunks.length - 1) {
      await new Promise<void>((r) => setTimeout(r, 120));
    }
  }

  return translatedChunks.join('\n');
}

async function translateWithLibre(
  text: string,
  targetLang: SupportedLanguage,
): Promise<string | null> {
  const source = detectSourceCode(text).split('-')[0];
  const target = LIBRE_CODES[targetLang];
  if (source === target) return text;

  const endpoints = [
    process.env.LIBRETRANSLATE_URL,
    'https://libretranslate.com/translate',
  ].filter(Boolean) as string[];

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          q: text,
          source,
          target,
          format: 'text',
          ...(process.env.LIBRETRANSLATE_API_KEY
            ? { api_key: process.env.LIBRETRANSLATE_API_KEY }
            : {}),
        }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) continue;
      const data = await res.json();
      const translated = data?.translatedText;
      if (translated && typeof translated === 'string' && translated.trim()) {
        return translated.trim();
      }
    } catch {
      // try next endpoint
    }
  }
  return null;
}

async function translateWithGemini(
  text: string,
  targetLang: SupportedLanguage,
): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const targetLangName = LANGUAGE_NAMES[targetLang];
  const sourceLangCode = detectSourceCode(text);
  const sourceLangName = LANGUAGE_NAMES[sourceLangCode.split('-')[0] as SupportedLanguage] || sourceLangCode;

  try {
    const response = await completion({
      model: 'gemini/gemini-3.5-flash-lite',
      messages: [
        {
          role: 'system',
          content: `You are a professional B2B trade translation engine for DirectHub marketplace.
Translate from ${sourceLangName} to ${targetLangName}.
RULES:
- Return ONLY the translated text, no explanations or prefixes
- Preserve ALL formatting: line breaks, bullet points, numbered lists
- Preserve ALL numbers, product codes, technical specs
- Maintain professional B2B trade communication tone`,
        },
        { role: 'user', content: text },
      ],
      stream: false,
      api_key: apiKey,
      temperature: 0.1,
      max_tokens: 16000,
    } as Parameters<typeof completion>[0]);

    const translated = (response as any)?.choices?.[0]?.message?.content;
    if (!translated || typeof translated !== 'string' || !translated.trim()) return null;
    return translated.trim();
  } catch (err) {
    console.warn('[LiveTranslator] Gemini failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Translate a B2B chat message into the target language.
 * Never throws — returns the original text as `translatedText` on failure.
 * Handles unlimited text length via free chunked MyMemory.
 */
export async function translateChatMessage(
  text: string,
  targetLang: SupportedLanguage,
): Promise<TranslationResult> {
  if (!text || !text.trim()) {
    return { translatedText: text, isFallback: true, targetLanguage: targetLang };
  }

  const trimmed = text.trim();

  // 1) Free MyMemory (chunked for long / non-ASCII)
  try {
    const myMemoryResult =
      trimmed.length <= getChunkSize(trimmed)
        ? await translateWithMyMemory(trimmed, targetLang)
        : await translateWithMyMemoryChunked(trimmed, targetLang);
    if (myMemoryResult !== null) {
      return { translatedText: myMemoryResult, isFallback: false, targetLanguage: targetLang };
    }
  } catch {
    // fall through
  }

  // 2) LibreTranslate backup
  try {
    const libre = await translateWithLibre(trimmed, targetLang);
    if (libre !== null) {
      return { translatedText: libre, isFallback: false, targetLanguage: targetLang };
    }
  } catch {
    // fall through
  }

  // 3) Optional Gemini / resilience engine
  try {
    const geminiResult = await translateWithGemini(trimmed, targetLang);
    if (geminiResult !== null) {
      return { translatedText: geminiResult, isFallback: false, targetLanguage: targetLang };
    }
  } catch {
    // fall through
  }

  try {
    const targetLanguageName = LANGUAGE_NAMES[targetLang] ?? 'English';
    const translated = await safeTranslateContent(trimmed, targetLanguageName);
    const isErrorMsg = translated.startsWith('عذراً') || translated.includes('يرجى المحاولة');
    if (!isErrorMsg) {
      return { translatedText: translated, isFallback: false, targetLanguage: targetLang };
    }
  } catch (error) {
    console.error('[LiveTranslator] translateChatMessage failed:', error);
  }

  return { translatedText: text, isFallback: true, targetLanguage: targetLang };
}

export async function autoTranslateChatMessage(
  text: string,
  preferredTargetLang?: SupportedLanguage,
): Promise<TranslationResult> {
  if (!text || !text.trim()) {
    return { translatedText: text, isFallback: true, targetLanguage: preferredTargetLang ?? 'en' };
  }

  let targetLang: SupportedLanguage;

  if (preferredTargetLang) {
    targetLang = preferredTargetLang;
  } else {
    const hasArabic = /[\u0600-\u06FF]/.test(text);
    const hasChinese = /[\u4E00-\u9FFF]/.test(text);

    if (hasArabic) {
      targetLang = 'en';
    } else if (hasChinese) {
      targetLang = 'ar';
    } else {
      targetLang = 'ar';
    }
  }

  return translateChatMessage(text, targetLang);
}
