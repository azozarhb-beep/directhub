/**
 * Server-side AI response cache for Next.js API routes.
 * Uses a module-level Map that persists across requests within the same
 * Node.js process (hot between requests in production).
 *
 * Free-tier throttle counters are also tracked here so all API routes
 * share the same rate-limit state.
 */

interface ServerCacheEntry {
  response: string;
  timestamp: number;
  hits: number;
}

interface ServerThrottle {
  minuteCount: number;
  minuteWindowStart: number;
  dayCount: number;
  dayWindowStart: number;
}

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours server-side
const MAX_ENTRIES = 1000;

// Shared across all API route invocations in the same process
const serverCache = new Map<string, ServerCacheEntry>();
const throttle: ServerThrottle = {
  minuteCount: 0,
  minuteWindowStart: Date.now(),
  dayCount: 0,
  dayWindowStart: Date.now(),
};

// Free-tier limits (conservative — well below Gemini free quotas)
// Gemini free tier = 5 RPM; we cap at 4 to leave headroom for other routes
const MAX_RPM = 4;
const MAX_RPD = 200;

// ── Dedicated translate throttle (separate from shared quota) ─────────────────
// Translation now uses MyMemory free API (no Gemini quota) — set high limits
const translateThrottle: ServerThrottle = {
  minuteCount: 0,
  minuteWindowStart: Date.now(),
  dayCount: 0,
  dayWindowStart: Date.now(),
};
const TRANSLATE_MAX_RPM = 60;   // MyMemory has no strict RPM limit
const TRANSLATE_MAX_RPD = 5000; // MyMemory allows 10k words/day free

// ── In-flight deduplication: prevents concurrent identical requests ────────────
const inFlight = new Map<string, Promise<string>>();

export function normalizeServerKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300);
}

export function getServerCached(key: string): string | null {
  const entry = serverCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    serverCache.delete(key);
    return null;
  }
  entry.hits++;
  return entry.response;
}

export function setServerCache(key: string, response: string): void {
  if (serverCache.size >= MAX_ENTRIES) {
    // Evict oldest
    const oldest = [...serverCache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
    if (oldest) serverCache.delete(oldest[0]);
  }
  serverCache.set(key, { response, timestamp: Date.now(), hits: 0 });
}

/**
 * Check if the current request is within free-tier limits (shared quota).
 * Returns { allowed: true } or { allowed: false, reason: string }.
 */
export function checkServerThrottle(): { allowed: boolean; reason?: string } {
  const now = Date.now();

  // Reset minute window
  if (now - throttle.minuteWindowStart > 60_000) {
    throttle.minuteCount = 0;
    throttle.minuteWindowStart = now;
  }

  // Reset day window
  if (now - throttle.dayWindowStart > 86_400_000) {
    throttle.dayCount = 0;
    throttle.dayWindowStart = now;
  }

  if (throttle.minuteCount >= MAX_RPM) {
    return { allowed: false, reason: `Rate limit: ${MAX_RPM} requests/minute exceeded. Retry in ${Math.ceil((60_000 - (now - throttle.minuteWindowStart)) / 1000)}s` };
  }

  if (throttle.dayCount >= MAX_RPD) {
    return { allowed: false, reason: `Daily quota: ${MAX_RPD} requests/day exceeded. Resets at midnight UTC.` };
  }

  throttle.minuteCount++;
  throttle.dayCount++;
  return { allowed: true };
}

/**
 * Check if the translate route is within its dedicated rate limit.
 * Uses a separate counter from the shared throttle.
 */
export function checkTranslateThrottle(): { allowed: boolean; reason?: string } {
  const now = Date.now();

  if (now - translateThrottle.minuteWindowStart > 60_000) {
    translateThrottle.minuteCount = 0;
    translateThrottle.minuteWindowStart = now;
  }

  if (now - translateThrottle.dayWindowStart > 86_400_000) {
    translateThrottle.dayCount = 0;
    translateThrottle.dayWindowStart = now;
  }

  if (translateThrottle.minuteCount >= TRANSLATE_MAX_RPM) {
    const waitSec = Math.ceil((60_000 - (now - translateThrottle.minuteWindowStart)) / 1000);
    return { allowed: false, reason: `Translate rate limit: ${TRANSLATE_MAX_RPM} RPM exceeded. Retry in ${waitSec}s` };
  }

  if (translateThrottle.dayCount >= TRANSLATE_MAX_RPD) {
    return { allowed: false, reason: `Translate daily quota: ${TRANSLATE_MAX_RPD} RPD exceeded.` };
  }

  translateThrottle.minuteCount++;
  translateThrottle.dayCount++;
  return { allowed: true };
}

/**
 * In-flight deduplication: if an identical translation is already in progress,
 * return the same promise instead of firing a second API call.
 */
export function getInFlight(key: string): Promise<string> | undefined {
  return inFlight.get(key);
}

export function setInFlight(key: string, promise: Promise<string>): void {
  inFlight.set(key, promise);
  promise.finally(() => inFlight.delete(key));
}

export function getServerThrottleStatus() {
  return {
    minuteCount: throttle.minuteCount,
    maxRPM: MAX_RPM,
    dayCount: throttle.dayCount,
    maxRPD: MAX_RPD,
    translateMinuteCount: translateThrottle.minuteCount,
    translateMaxRPM: TRANSLATE_MAX_RPM,
    cacheSize: serverCache.size,
    inFlightCount: inFlight.size,
  };
}

export function clearServerCache(): void {
  serverCache.clear();
}
