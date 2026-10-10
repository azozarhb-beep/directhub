import { NextRequest, NextResponse } from 'next/server';
import { completion } from '@rocketnew/llm-sdk';
import {
  normalizeServerKey,
  getServerCached,
  setServerCache,
  getInFlight,
  setInFlight,
  checkTranslateThrottle,
} from '@/lib/ai/serverCache';

/**
 * DirectHub Translation API — Free-first, unlimited length
 *
 * Chain (no paid quota required for normal use):
 *   1. MyMemory (free) — short texts + chunked long texts
 *   2. LibreTranslate (free public / self-host) — backup
 *   3. Gemini — optional last resort only if GEMINI_API_KEY works
 *   4. Original text — never break chat
 *
 * Supports: Arabic ↔ English ↔ Chinese ↔ Turkish
 */

export async function GET() {
  return NextResponse.json({
    status: 'ready',
    endpoint: '/api/ai/translate',
    method: 'POST',
    engine: 'MyMemory (primary, free) + LibreTranslate (backup) + Gemini (optional)',
    maxLength: 100000,
    languages: ['ar', 'en', 'zh', 'tr'],
    description: 'Free live B2B translation — any length, chunked automatically',
  });
}

const MYMEMORY_LANG_MAP: Record<string, string> = {
  ar: 'ar',
  en: 'en',
  zh: 'zh-CN',
  tr: 'tr',
};

const LIBRE_LANG_MAP: Record<string, string> = {
  ar: 'ar',
  en: 'en',
  zh: 'zh',
  tr: 'tr',
  'zh-CN': 'zh',
};

const LANGUAGE_NAMES: Record<string, string> = {
  ar: 'Arabic',
  en: 'English',
  zh: 'Chinese (Simplified)',
  tr: 'Turkish',
};

function detectSourceLang(text: string): string {
  if (/[\u0600-\u06FF]/.test(text)) return 'ar';
  if (/[\u4E00-\u9FFF\u3400-\u4DBF]/.test(text)) return 'zh-CN';
  if (/[\u0400-\u04FF]/.test(text)) return 'ru';
  return 'en';
}

/** Safe chunk size for MyMemory GET URLs (non-ASCII expands heavily when encoded). */
function getChunkSize(text: string): number {
  const nonAscii = (text.match(/[^\x00-\x7F]/g) || []).length;
  if (nonAscii / Math.max(text.length, 1) > 0.2) return 180;
  return 450;
}

function splitIntoChunks(text: string, chunkSize: number): string[] {
  const lines = text.split('\n');
  const chunks: string[] = [];
  let currentChunk = '';

  const flushWordSplit = (line: string) => {
    // Prefer word boundaries; for CJK without spaces, split by character groups
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
  };

  for (const line of lines) {
    const candidate = currentChunk ? currentChunk + '\n' + line : line;
    if (candidate.length <= chunkSize) {
      currentChunk = candidate;
    } else {
      if (currentChunk) chunks.push(currentChunk);
      if (line.length > chunkSize) {
        flushWordSplit(line);
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
  sourceLang: string,
  targetLang: string,
  signal?: AbortSignal,
): Promise<string> {
  const langPair = `${sourceLang}|${targetLang}`;
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(langPair)}&de=admin@direct-hub.net`;

  const res = await fetch(url, {
    method: 'GET',
    signal,
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) throw new Error(`MyMemory HTTP ${res.status}`);

  const data = await res.json();

  if (data?.responseStatus !== 200 && data?.responseStatus !== '200') {
    throw new Error(`MyMemory error: ${data?.responseMessage || 'unknown'}`);
  }

  const translated = data?.responseData?.translatedText;
  if (!translated || typeof translated !== 'string' || !translated.trim()) {
    throw new Error('MyMemory returned empty translation');
  }

  if (translated.toUpperCase().includes('PLEASE SELECT')) {
    return text;
  }

  return translated.trim();
}

async function translateWithMyMemoryChunked(
  text: string,
  sourceLang: string,
  targetLang: string,
  signal?: AbortSignal,
): Promise<string> {
  const chunkSize = getChunkSize(text);
  const chunks = splitIntoChunks(text, chunkSize);
  const translatedChunks: string[] = [];

  for (let i = 0; i < chunks.length; i++) {
    if (signal?.aborted) throw new Error('Aborted');
    const chunk = chunks[i];
    try {
      const result = await translateWithMyMemory(chunk, sourceLang, targetLang, signal);
      translatedChunks.push(result);
    } catch {
      translatedChunks.push(chunk);
    }
    if (i < chunks.length - 1) {
      await new Promise<void>((r) => setTimeout(r, 120));
    }
  }

  return translatedChunks.join('\n');
}

async function translateWithLibreTranslate(
  text: string,
  sourceLang: string,
  targetLang: string,
  signal?: AbortSignal,
): Promise<string> {
  const source = LIBRE_LANG_MAP[sourceLang] || sourceLang.split('-')[0];
  const target = LIBRE_LANG_MAP[targetLang] || targetLang.split('-')[0];

  const endpoints = [
    process.env.LIBRETRANSLATE_URL,
    'https://libretranslate.com/translate',
  ].filter(Boolean) as string[];

  let lastError: Error | null = null;

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        signal,
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
      });

      if (!res.ok) {
        lastError = new Error(`LibreTranslate HTTP ${res.status}`);
        continue;
      }

      const data = await res.json();
      const translated = data?.translatedText;
      if (!translated || typeof translated !== 'string' || !translated.trim()) {
        lastError = new Error('LibreTranslate empty response');
        continue;
      }
      return translated.trim();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError || new Error('LibreTranslate unavailable');
}

async function translateWithLibreChunked(
  text: string,
  sourceLang: string,
  targetLang: string,
  signal?: AbortSignal,
): Promise<string> {
  // LibreTranslate handles longer payloads; still chunk very large texts
  const chunks = splitIntoChunks(text, 2000);
  const out: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    if (signal?.aborted) throw new Error('Aborted');
    try {
      out.push(await translateWithLibreTranslate(chunks[i], sourceLang, targetLang, signal));
    } catch {
      out.push(chunks[i]);
    }
    if (i < chunks.length - 1) {
      await new Promise<void>((r) => setTimeout(r, 100));
    }
  }
  return out.join('\n');
}

async function translateWithGemini(
  text: string,
  targetLanguage: string,
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

  const targetLangName = LANGUAGE_NAMES[targetLanguage] || targetLanguage;
  const sourceLang = detectSourceLang(text);
  const sourceLangName = LANGUAGE_NAMES[sourceLang.split('-')[0]] || sourceLang;

  const systemPrompt = `You are a professional B2B trade translation engine for DirectHub marketplace.
Your task: Translate the user's text from ${sourceLangName} to ${targetLangName}.

CRITICAL RULES:
1. Return ONLY the translated text — no explanations, no notes, no prefixes
2. Preserve ALL formatting exactly: line breaks, bullet points, numbered lists
3. Preserve ALL special characters, numbers, product codes, and technical specifications
4. Preserve paragraph structure
5. Maintain professional B2B trade communication tone
6. Do NOT add any commentary or wrapper text`;

  const response = await completion({
    model: 'gemini/gemini-3.5-flash-lite',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: text },
    ],
    stream: false,
    api_key: apiKey,
    temperature: 0.1,
    max_tokens: 16000,
  } as Parameters<typeof completion>[0]);

  const translated = (response as any)?.choices?.[0]?.message?.content;
  if (!translated || typeof translated !== 'string' || !translated.trim()) {
    throw new Error('Gemini returned empty translation');
  }

  return translated.trim();
}

async function translateText(
  text: string,
  targetLanguage: string,
): Promise<{ translated: string; fallback: boolean; engine: string }> {
  const targetLangCode = MYMEMORY_LANG_MAP[targetLanguage] || targetLanguage;
  const sourceLangCode = detectSourceLang(text);

  const normalizedSource = sourceLangCode.split('-')[0];
  const normalizedTarget = targetLangCode.split('-')[0];
  if (normalizedSource === normalizedTarget) {
    return { translated: text, fallback: true, engine: 'same-language' };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60_000);

  try {
    // 1) Free MyMemory (chunked for any length)
    try {
      const result =
        text.length <= getChunkSize(text)
          ? await translateWithMyMemory(text, sourceLangCode, targetLangCode, controller.signal)
          : await translateWithMyMemoryChunked(text, sourceLangCode, targetLangCode, controller.signal);
      clearTimeout(timeoutId);
      return { translated: result, fallback: false, engine: text.length > 450 ? 'mymemory-chunked' : 'mymemory' };
    } catch (err) {
      console.warn('[Translate] MyMemory failed:', err instanceof Error ? err.message : err);
    }

    // 2) LibreTranslate backup (free)
    try {
      const result = await translateWithLibreChunked(
        text,
        sourceLangCode,
        targetLangCode,
        controller.signal,
      );
      clearTimeout(timeoutId);
      return { translated: result, fallback: false, engine: 'libretranslate' };
    } catch (err) {
      console.warn('[Translate] LibreTranslate failed:', err instanceof Error ? err.message : err);
    }

    // 3) Optional Gemini last resort (may hit quota — never required)
    try {
      const result = await translateWithGemini(text, targetLanguage);
      clearTimeout(timeoutId);
      return { translated: result, fallback: false, engine: 'gemini-fallback' };
    } catch (err) {
      console.warn('[Translate] Gemini fallback failed:', err instanceof Error ? err.message : err);
    }

    clearTimeout(timeoutId);
    return { translated: text, fallback: true, engine: 'original' };
  } catch {
    clearTimeout(timeoutId);
    return { translated: text, fallback: true, engine: 'original' };
  }
}

/** Soft ceiling — still processes via chunking; reject only absurd payloads */
const MAX_TEXT_LENGTH = 100_000;

export async function POST(request: NextRequest) {
  let text = '';
  let targetLanguage = '';

  try {
    const body = await request.json();
    text = body?.text ?? '';
    targetLanguage = body?.targetLanguage ?? '';
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body', translated: '' },
      { status: 400 },
    );
  }

  const throttleCheck = checkTranslateThrottle();
  if (!throttleCheck.allowed) {
    return NextResponse.json(
      { translated: text, fallback: true, error: throttleCheck.reason },
      { status: 429 },
    );
  }

  if (!text || !targetLanguage) {
    return NextResponse.json(
      { error: 'Missing text or targetLanguage', translated: text || '' },
      { status: 400 },
    );
  }

  if (text.trim().length < 2) {
    return NextResponse.json({ translated: text, fallback: true, cached: false });
  }

  if (text.length > MAX_TEXT_LENGTH) {
    // Soft-trim rather than hard-fail — translate first 100k
    text = text.slice(0, MAX_TEXT_LENGTH);
  }

  const shouldCache = text.length <= 2000;
  const cacheKey = shouldCache ? normalizeServerKey(`translate:${targetLanguage}:${text}`) : null;

  if (cacheKey) {
    const cached = getServerCached(cacheKey);
    if (cached) {
      return NextResponse.json({ translated: cached, fallback: false, cached: true });
    }

    const existing = getInFlight(cacheKey);
    if (existing) {
      try {
        const translated = await existing;
        return NextResponse.json({ translated, fallback: false, cached: true });
      } catch {
        // Fall through
      }
    }
  }

  const translationPromise = translateText(text, targetLanguage).then((result) => {
    if (!result.fallback && cacheKey) {
      setServerCache(cacheKey, result.translated);
    }
    return result;
  });

  if (cacheKey) {
    setInFlight(cacheKey, translationPromise.then((r) => r.translated));
  }

  try {
    const result = await translationPromise;
    return NextResponse.json({
      translated: result.translated,
      fallback: result.fallback,
      engine: result.engine,
    });
  } catch {
    return NextResponse.json({ translated: text, fallback: true, engine: 'original' });
  }
}
