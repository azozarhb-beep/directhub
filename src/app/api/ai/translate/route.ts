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
 * DirectHub Professional B2B Translation API
 * Engine: Fast Instant Map + Google Neural (Primary) + Gemini Flash (Smart B2B Fallback)
 * Zero Hallucination — Clean Commercial & Industrial terminology
 */

export async function GET() {
  return NextResponse.json({
    status: 'ready',
    endpoint: '/api/ai/translate',
    method: 'POST',
    engine: 'Google Neural Engine (Primary) + Gemini Flash (B2B Backup)',
    languages: ['ar', 'en', 'zh', 'tr'],
    description: 'Clean, instantaneous B2B live trade translation',
  });
}

// قاموس فوري للردود السريعة والتحيات والمصطلحات الشائعة (0ms Latency)
const INSTANT_PHRASES: Record<string, Record<string, string>> = {
  ar_to_en: {
    'مرحبا': 'Hello',
    'هلو': 'Hello',
    'أهلا': 'Welcome',
    'السلام عليكم': 'Peace be upon you / Hello',
    'شكرا': 'Thank you',
    'شكرا جزيلا': 'Thank you very much',
    'كم السعر': 'What is the price?',
    'الحد الأدنى للطلب': 'Minimum Order Quantity (MOQ)',
    'عينة': 'Sample',
    'الضمان المالي': 'Trade Assurance / Escrow',
    'مواصفات': 'Specifications',
  },
  en_to_ar: {
    'hello': 'مرحباً',
    'hi': 'أهلاً',
    'welcome': 'أهلاً وسهلاً',
    'thank you': 'شكراً لك',
    'thanks': 'شكراً',
    'moq': 'الحد الأدنى للطلب',
    'sample': 'عينة',
    'trade assurance': 'الضمان التجاري',
    'fob': 'تسليم على ظهر السفينة (FOB)',
    'cif': 'واصل إلى الميناء (CIF)',
  },
  ar_to_zh: {
    'مرحبا': '你好',
    'هلو': '你好',
    'أهلا': '欢迎',
    'شكرا': '谢谢',
  },
  ar_to_tr: {
    'مرحبا': 'Merhaba',
    'هلو': 'Merhaba',
    'أهلا': 'Hoş geldiniz',
    'شكرا': 'Teşekkürler',
  },
};

const LANGUAGE_CODES: Record<string, string> = {
  ar: 'ar',
  en: 'en',
  zh: 'zh-CN',
  tr: 'tr',
};

const LANGUAGE_NAMES: Record<string, string> = {
  ar: 'Arabic',
  en: 'English',
  zh: 'Chinese (Simplified)',
  tr: 'Turkish',
};

function detectSourceLang(text: string): string {
  if (/[\u0600-\u06FF]/.test(text)) return 'ar';
  if (/[\u4E00-\u9FFF\u3400-\u4DBF]/.test(text)) return 'zh';
  if (/[\u0400-\u04FF]/.test(text)) return 'ru';
  return 'en';
}

/** 1. محرك Google Neural السريع والنظيف (بدون أي هلوسة طبية أو نصوص شاذة) */
async function translateWithGoogle(
  text: string,
  sourceLang: string,
  targetLang: string,
  signal?: AbortSignal
): Promise<string> {
  const sl = sourceLang.split('-')[0];
  const tl = targetLang.split('-')[0];

  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`;

  const res = await fetch(url, {
    method: 'GET',
    signal,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      Accept: 'application/json',
    },
  });

  if (!res.ok) throw new Error(`Google Translate HTTP ${res.status}`);

  const data = await res.json();
  if (!Array.isArray(data) || !Array.isArray(data[0])) {
    throw new Error('Invalid Google response format');
  }

  const translated = data[0].map((item: any) => item[0]).filter(Boolean).join('');
  if (!translated || !translated.trim()) {
    throw new Error('Google returned empty translation');
  }

  return translated.trim();
}

/** 2. محرك Gemini التجاري الصارم (كاحتياطي ذكي عند الحاجة) */
async function translateWithGemini(
  text: string,
  targetLanguage: string
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

  const targetLangName = LANGUAGE_NAMES[targetLanguage] || targetLanguage;
  const sourceLang = detectSourceLang(text);
  const sourceLangName = LANGUAGE_NAMES[sourceLang] || sourceLang;

  const systemPrompt = `You are a professional B2B Industrial Trade Translation Engine for DirectHub (like Alibaba TradeManager).
Translate accurately from ${sourceLangName} to ${targetLangName}.
CRITICAL RULES:
1. Return ONLY the translated raw text without quotes, commentary, or conversational filler.
2. Maintain professional commercial and B2B terminology (MOQ, Trade Assurance, Specifications, Escrow).
3. NEVER add explanations, notes, or unrelated medical jargon.`;

  const response = await completion({
    model: 'gemini/gemini-2.5-flash',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: text },
    ],
    stream: false,
    api_key: apiKey,
    temperature: 0.1,
    max_tokens: 1000,
  } as Parameters<typeof completion>[0]);

  const translated = (response as any)?.choices?.[0]?.message?.content;
  if (!translated || typeof translated !== 'string' || !translated.trim()) {
    throw new Error('Gemini returned empty translation');
  }

  return translated.replace(/^["']|["']$/g, '').trim();
}

async function translateText(
  text: string,
  targetLanguage: string
): Promise<{ translated: string; fallback: boolean; engine: string }> {
  const clean = text.trim();
  const sourceLang = detectSourceLang(clean);
  const targetKey = targetLanguage.split('-')[0];

  if (sourceLang === targetKey) {
    return { translated: clean, fallback: true, engine: 'same-language' };
  }

  // فحص القاموس الفوري للتحيات والردود السريعة (0ms)
  const dictKey = `${sourceLang}_to_${targetKey}`;
  if (INSTANT_PHRASES[dictKey]?.[clean.toLowerCase()]) {
    return {
      translated: INSTANT_PHRASES[dictKey][clean.toLowerCase()],
      fallback: false,
      engine: 'instant-dict',
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12_000);

  try {
    // 1) استخدام محرك Google Neural الأساسي
    try {
      const result = await translateWithGoogle(clean, sourceLang, targetLanguage, controller.signal);
      clearTimeout(timeoutId);
      return { translated: result, fallback: false, engine: 'google-neural' };
    } catch (err) {
      console.warn('[Translate] Google Neural failed, switching to Gemini:', err);
    }

    // 2) التبديل للذكاء الاصطناعي Gemini في حال تعذر المحرك الأول
    try {
      const geminiResult = await translateWithGemini(clean, targetLanguage);
      clearTimeout(timeoutId);
      return { translated: geminiResult, fallback: false, engine: 'gemini-b2b' };
    } catch (err) {
      console.warn('[Translate] Gemini backup failed:', err);
    }

    clearTimeout(timeoutId);
    return { translated: clean, fallback: true, engine: 'original' };
  } catch {
    clearTimeout(timeoutId);
    return { translated: clean, fallback: true, engine: 'original' };
  }
}

export async function POST(request: NextRequest) {
  let text = '';
  let targetLanguage = 'en';

  try {
    const body = await request.json();
    text = body?.text ?? '';
    targetLanguage = body?.targetLanguage ?? 'en';
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body', translated: '' },
      { status: 400 }
    );
  }

  const throttleCheck = checkTranslateThrottle();
  if (!throttleCheck.allowed) {
    return NextResponse.json(
      { translated: text, fallback: true, error: throttleCheck.reason },
      { status: 429 }
    );
  }

  if (!text || !targetLanguage) {
    return NextResponse.json(
      { error: 'Missing text or targetLanguage', translated: text || '' },
      { status: 400 }
    );
  }

  if (text.trim().length < 2) {
    return NextResponse.json({ translated: text, fallback: true, cached: false });
  }

  const cacheKey = normalizeServerKey(`b2b-trans:${targetLanguage}:${text.trim()}`);

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

  const translationPromise = translateText(text, targetLanguage).then((result) => {
    if (!result.fallback && cacheKey) {
      setServerCache(cacheKey, result.translated);
    }
    return result;
  });

  setInFlight(cacheKey, translationPromise.then((r) => r.translated));

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
