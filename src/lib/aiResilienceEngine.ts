/**
 * DirectHub AI Resilience & Fallback Engine
 *
 * Three-layer defence against RESOURCE_EXHAUSTED (HTTP 429) errors:
 *   1. Smart Rate-Limiting Queue  — serialises requests with configurable delay
 *   2. Model Fallback Cascade     — auto-switches to lighter model on failure
 *   3. Free-Tier Protection       — stays within Gemini free quotas at all times
 *
 * Model cascade (lightest first to minimise quota usage):
 *   Primary:  gemini/gemini-3.5-flash-lite  (fast, free tier supported)
 *   Fallback: gemini/gemini-3.5-flash       (heavier, used only when primary fails)
 *
 * This module is SERVER-SIDE ONLY (used inside Next.js API routes).
 */

import { completion } from '@rocketnew/llm-sdk';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AIOptions {
  /** Primary model to use (default: gemini/gemini-3.5-flash-lite — lightest free model) */
  model?: string;
  /** Fallback model when primary is exhausted (default: gemini/gemini-3.5-flash) */
  fallbackModel?: string;
  /** Sampling temperature 0-1 (default: 0.7) */
  temperature?: number;
  /** Max tokens in the response (default: 512 — conservative for free tier) */
  maxOutputTokens?: number;
  /** System prompt to prepend */
  systemPrompt?: string;
  /** Hard timeout per attempt in ms (default: 20_000) */
  timeoutMs?: number;
}

// ─── Queue Manager ────────────────────────────────────────────────────────────

class AIQueueManager {
  private queue: Array<() => Promise<void>> = [];
  private processing = false;
  /** Minimum gap between consecutive API calls (ms) — keeps us under 10 RPM */
  private readonly delayMs: number;

  constructor(delayMs = 2_000) {
    this.delayMs = delayMs;
  }

  enqueue<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push(async () => {
        try {
          resolve(await task());
        } catch (err) {
          reject(err);
        }
      });
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const task = this.queue.shift();
      if (task) {
        try {
          await task();
        } catch (e) {
          console.error('[AIQueue] Task error:', e);
        }
        // Throttle gap between requests
        await new Promise<void>((r) => setTimeout(r, this.delayMs));
      }
    }

    this.processing = false;
  }
}

// Singleton queue shared across all API routes in the same Node.js process
const aiQueue = new AIQueueManager(2_000);

// ─── Core helper: single attempt with hard timeout ────────────────────────────

async function attemptGeneration(
  prompt: string,
  model: string,
  options: AIOptions,
  apiKey: string,
): Promise<string> {
  const timeoutMs = options.timeoutMs ?? 20_000;

  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(
      () => reject(new Error(`AI request timed out after ${timeoutMs}ms`)),
      timeoutMs,
    );
  });

  try {
    const messages: Array<{ role: 'system' | 'user'; content: string }> = [];
    if (options.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    const callPromise = completion({
      model,
      messages,
      stream: false,
      api_key: apiKey,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxOutputTokens ?? 512,
    });

    const response = await Promise.race([callPromise, timeoutPromise]);
    const text = (response as any)?.choices?.[0]?.message?.content;

    if (!text || typeof text !== 'string' || !text.trim()) {
      throw new Error('Empty response from AI model');
    }

    return text.trim();
  } finally {
    if (timeoutHandle !== null) clearTimeout(timeoutHandle);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Safe, resilient AI content generation.
 *
 * Uses lightest model first (flash-8b) to minimise quota consumption.
 * Falls back to flash on exhaustion. Returns Arabic error string on total failure.
 *
 * Never throws.
 */
export async function safeGenerateAIContent(
  prompt: string,
  options: AIOptions = {},
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('[AIResilience] GEMINI_API_KEY not configured');
    return 'عذراً، مفتاح الذكاء الاصطناعي غير مهيأ. يرجى التحقق من إعدادات المنصة.';
  }

  // Use lightest model as primary to preserve free quota
  const primaryModel = options.model ?? 'gemini/gemini-3.5-flash-lite';
  const fallbackModel = options.fallbackModel ?? 'gemini/gemini-3.5-flash';

  return aiQueue.enqueue(async () => {
    // ── Attempt 1: primary model ──────────────────────────────────────────
    try {
      return await attemptGeneration(prompt, primaryModel, options, apiKey);
    } catch (primaryError: unknown) {
      const errMsg = primaryError instanceof Error ? primaryError.message : String(primaryError);
      const isExhausted =
        errMsg.includes('429') ||
        errMsg.includes('RESOURCE_EXHAUSTED') ||
        errMsg.includes('quota') ||
        errMsg.includes('rate limit') ||
        errMsg.includes('rateLimitExceeded');

      console.warn(
        `[AIResilience] Primary model (${primaryModel}) failed: ${errMsg}`,
        isExhausted ? '→ quota exhausted, skipping same-key retry' : '',
      );

      // On RESOURCE_EXHAUSTED the fallback model usually shares the same key/quota.
      // Fail fast so callers can use static FALLBACK_IDEAS instead of waiting 5s+.
      if (isExhausted) {
        return 'عذراً، النظام يتعرض لضغط مؤقت في خوادم الذكاء الاصطناعي. يرجى المحاولة بعد قليل.';
      }

      // ── Attempt 2: fallback model (non-quota failures only) ──────────────
      try {
        const fallbackOptions: AIOptions = {
          ...options,
          maxOutputTokens: Math.min(options.maxOutputTokens ?? 512, 512),
        };
        const result = await attemptGeneration(prompt, fallbackModel, fallbackOptions, apiKey);
        console.info(`[AIResilience] Fallback model (${fallbackModel}) succeeded`);
        return result;
      } catch (fallbackError: unknown) {
        const fbMsg = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
        console.error(`[AIResilience] Fallback model (${fallbackModel}) also failed: ${fbMsg}`);
        return 'عذراً، النظام يتعرض لضغط مؤقت في خوادم الذكاء الاصطناعي. يرجى المحاولة بعد قليل.';
      }
    }
  });
}

/**
 * Lightweight wrapper for translation-specific calls.
 * NOTE: Translation now uses MyMemory free API via /api/ai/translate route.
 * This function is kept as a server-side fallback only.
 */
export async function safeTranslateContent(
  text: string,
  targetLanguageName: string,
  options: Partial<AIOptions> = {},
): Promise<string> {
  const prompt = `Translate the following B2B trade message into ${targetLanguageName}. Return ONLY the translated text — no explanations, no quotes, no extra text. Keep brand names like "DirectHub" and "دايركت هب" unchanged. If the text is already in ${targetLanguageName}, return it as-is.\n\n${text}`;

  return safeGenerateAIContent(prompt, {
    model: 'gemini/gemini-3.5-flash-lite',
    fallbackModel: 'gemini/gemini-3.5-flash',
    temperature: 0.3,
    maxOutputTokens: 256,
    ...options,
  });
}
