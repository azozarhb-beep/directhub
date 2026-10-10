/**
 * DirectHub AI Free-Tier Guard
 *
 * Enforces a 100% free-tier architecture for all AI integrations:
 * 1. Aggressive in-memory + localStorage response caching
 * 2. Strict per-minute / per-day request throttling
 * 3. Smart queue management with deduplication
 * 4. Pre-built B2B answer library (zero API calls for common queries)
 *
 * Gemini free tier limits (as of 2025):
 *   gemini-2.5-flash: 10 RPM, 250 RPD, 1M TPM
 *   gemini-1.5-flash: 15 RPM, 500 RPD, 1M TPM
 *
 * This guard keeps usage well below those ceilings.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

interface CacheEntry {
  response: string;
  timestamp: number;
  hits: number;
}

interface ThrottleState {
  minuteCount: number;
  minuteWindowStart: number;
  dayCount: number;
  dayWindowStart: number;
}

interface QueueItem {
  key: string;
  resolve: (value: string | null) => void;
  reject: (reason?: unknown) => void;
  executor: () => Promise<string>;
  addedAt: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_MEMORY_ENTRIES = 500;
const MAX_RPM = 8;          // stay under 10 RPM free limit
const MAX_RPD = 200;         // stay under 250 RPD free limit
const QUEUE_MAX_SIZE = 20;
const QUEUE_TIMEOUT_MS = 30_000;
const LS_CACHE_KEY = 'dh_ai_cache_v2';
const LS_THROTTLE_KEY = 'dh_ai_throttle_v2';

// ─── B2B Static Answer Library ────────────────────────────────────────────────
// Common queries answered locally — zero API calls, instant response.

const B2B_STATIC_ANSWERS: Array<{ patterns: RegExp[]; answer: string }> = [
  {
    patterns: [/أكياس بلاستيك|plastic bag|حقيبة بلاستيك|كيس بلاستيك/i],
    answer: `**أكياس البلاستيك على دايركت هب** 🛍️

نوفر مجموعة واسعة من أكياس البلاستيك مباشرةً من المصانع:

• **أكياس HDPE** (البولي إيثيلين عالي الكثافة) — للتعبئة الصناعية والتجزئة
• **أكياس LDPE** — للتغليف الخفيف والأكياس الناعمة
• **أكياس PP** (البولي بروبيلين) — للمنتجات الغذائية والزراعية
• **أكياس مطبوعة** — طباعة مخصصة بشعارك وألوانك

**الحد الأدنى للطلب (MOQ):** يبدأ من 1,000 كيلوغرام عادةً
**الشهادات:** ISO 9001، FDA للاستخدام الغذائي

لإرسال طلب عرض سعر (RFQ) لأكياس البلاستيك، اضغط على "إنشاء RFQ" أو تواصل معنا مباشرة.`,
  },
  {
    patterns: [/بوليمر|polymer|بولي إيثيلين|polyethylene|بولي بروبيلين|polypropylene|pvc|بي في سي/i],
    answer: `**البوليمرات والمواد البلاستيكية الخام** ⚗️

دايركت هب يربطك مباشرةً بموردي البوليمرات:

• **PE (بولي إيثيلين):** HDPE، LDPE، LLDPE — للتعبئة والأنابيب
• **PP (بولي بروبيلين):** Homopolymer & Copolymer — للحاويات والأجزاء الصناعية
• **PVC:** صلب وليّن — للأنابيب والكابلات والنوافذ
• **PS (بولي ستايرين):** للتغليف والأجهزة المنزلية
• **PET:** للزجاجات والألياف الصناعية

**المصادر:** موردون محليون + مصانع دولية (الصين، تركيا، الخليج)
**الشحن:** EXW / FOB / CIF حسب الطلب

أرسل RFQ الآن لتلقي عروض أسعار تنافسية خلال 24 ساعة.`,
  },
  {
    patterns: [/تغليف|packaging|عبوات|carton|كرتون|box|صندوق/i],
    answer: `**مواد التغليف والتعبئة** 📦

نوفر حلول تغليف شاملة من المصانع مباشرةً:

• **كراتين مموجة** — بجميع المقاسات والسماكات
• **أكياس تغليف** — BOPP، PE، Kraft
• **علب كرتونية** — مطبوعة أو سادة
• **أفلام تغليف** — Stretch Film، Shrink Film
• **أوعية بلاستيكية** — للمواد الغذائية والكيماوية

**الطباعة المخصصة:** متاحة على معظم المنتجات
**MOQ:** يبدأ من 500-1,000 وحدة

هل تريد إنشاء RFQ لمواد تغليف محددة؟`,
  },
  {
    patterns: [/rfq|طلب عرض سعر|request for quotation|كيف أرسل طلب|how to request/i],
    answer: `**كيفية إرسال طلب عرض سعر (RFQ)** 📋

**الخطوات:**
1. اضغط على **"إنشاء RFQ"** من الصفحة الرئيسية أو من /rfq/create
2. اختر **الفئة** ونوع المنتج
3. أدخل **المواصفات التفصيلية** (الكمية، الجودة، المقاس، الشهادات المطلوبة)
4. حدد **الميزانية التقريبية** وشروط الشحن المفضلة
5. اضغط **"إرسال"** — سيصل طلبك لأفضل الموردين المطابقين

**مميزات RFQ في دايركت هب:**
✅ يصل لعشرات الموردين المؤهلين دفعة واحدة
✅ تلقي عروض أسعار خلال 24-48 ساعة
✅ مقارنة العروض جنباً إلى جنب
✅ التفاوض المباشر مع الموردين عبر المنصة

هل تريد مساعدة في صياغة طلب RFQ لمنتج معين؟`,
  },
  {
    patterns: [/شحن|shipping|incoterm|fob|cif|exw|ddp|freight|شحن بحري|air freight/i],
    answer: `**شروط الشحن والإنكوترمز** 🚢

**الشروط المتاحة على دايركت هب:**

| الشرط | المعنى | الأنسب لـ |
|-------|--------|----------|
| **EXW** | من مصنع البائع | المشترون ذوو الخبرة |
| **FOB** | حتى ميناء الشحن | الطلبات البحرية الكبيرة |
| **CIF** | شحن + تأمين مدفوع | الطلبات المتوسطة |
| **DDP** | توصيل كامل للباب | الطلبات الصغيرة والمتوسطة |
| **DAP** | توصيل لنقطة محددة | مرونة في التسليم |

**أوقات الشحن التقريبية:**
• شحن بحري FCL: 15-45 يوم
• شحن بحري LCL: 20-50 يوم
• شحن جوي: 3-7 أيام
• شحن بري (إقليمي): 3-10 أيام

أي شرط شحن يناسب طلبك؟`,
  },
  {
    patterns: [/تسجيل|register|انضمام|join|كيف أسجل|how to register|مصنع|factory|مورد|supplier/i],
    answer: `**التسجيل في دايركت هب** 🏭

**أنواع الشركاء:**
1. **مصنع محلي** — مصنع في اليمن أو الخليج
2. **مورد محلي** — موزع أو شركة تجارية
3. **مصنع دولي** — مصنع خارج المنطقة
4. **شريك لوجستي** — شركة شحن ونقل

**خطوات التسجيل:**
1. اذهب إلى /factory/register أو /auth/role-selection
2. اختر نوع شريكك
3. أدخل بيانات الشركة والتواصل
4. ارفع المستندات المطلوبة (سجل تجاري، رقم ضريبي، شهادات)
5. التحقق الفوري بالذكاء الاصطناعي

**المستندات المطلوبة:**
• السجل التجاري
• الرقم الضريبي
• شهادات الجودة (ISO، CE، Halal إن وجدت)

هل تريد بدء التسجيل الآن؟`,
  },
  {
    patterns: [/ضمان|escrow|دفع|payment|حماية|protection|أمان|secure/i],
    answer: `**نظام الضمان المالي في دايركت هب** 🔒

**كيف يعمل الضمان:**
1. المشتري يودع المبلغ في حساب الضمان المحمي
2. المورد يشحن البضاعة بعد تأكيد الإيداع
3. المشتري يستلم البضاعة ويتحقق منها
4. يتم تحرير المبلغ للمورد بعد التأكيد

**حماية المشتري:**
✅ استرداد كامل إذا لم تصل البضاعة
✅ استرداد جزئي إذا كانت البضاعة غير مطابقة
✅ فريق دايركت هب يتوسط في النزاعات

**حماية المورد:**
✅ ضمان الدفع عند التسليم الناجح
✅ لا مخاطر من عدم الدفع
✅ تحرير فوري بعد تأكيد الاستلام

**طرق الدفع:** تحويل بنكي، محفظة إلكترونية محلية، تحويل دولي`,
  },
  {
    patterns: [/مرحبا|أهلا|hello|hi|السلام|مساء|صباح/i],
    answer: `أهلاً وسهلاً! 👋

أنا **أمل** — مساعدتك الذكية في دايركت هب.

يمكنني مساعدتك في:
• 🔍 البحث عن منتجات ومصانع
• 📋 إنشاء طلبات عروض أسعار (RFQ)
• 🌍 الترجمة الفورية (عربي ↔ إنجليزي ↔ صيني ↔ تركي)
• 🏭 التسجيل كمصنع أو مورد
• 🚢 الاستفسار عن الشحن والإنكوترمز
• 💰 فهم نظام الضمان المالي

كيف يمكنني مساعدتك اليوم؟`,
  },
];

// ─── In-Memory Cache ──────────────────────────────────────────────────────────

const memoryCache = new Map<string, CacheEntry>();

function normalizeKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

function getCacheKey(messages: Array<{ role: string; content: string }>): string {
  const lastUser = [...messages].reverse().find(m => m.role === 'user');
  return normalizeKey(lastUser?.content || JSON.stringify(messages));
}

// ─── localStorage Persistence ─────────────────────────────────────────────────

function loadPersistentCache(): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(LS_CACHE_KEY);
    if (!raw) return;
    const entries: Record<string, CacheEntry> = JSON.parse(raw);
    const now = Date.now();
    for (const [key, entry] of Object.entries(entries)) {
      if (now - entry.timestamp < CACHE_TTL_MS) {
        memoryCache.set(key, entry);
      }
    }
  } catch {
    // ignore parse errors
  }
}

function savePersistentCache(): void {
  if (typeof window === 'undefined') return;
  try {
    const obj: Record<string, CacheEntry> = {};
    for (const [key, entry] of memoryCache.entries()) {
      obj[key] = entry;
    }
    localStorage.setItem(LS_CACHE_KEY, JSON.stringify(obj));
  } catch {
    // quota exceeded — clear old entries
    try { localStorage.removeItem(LS_CACHE_KEY); } catch { /* ignore */ }
  }
}

// ─── Throttle State ───────────────────────────────────────────────────────────

function loadThrottleState(): ThrottleState {
  const now = Date.now();
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(LS_THROTTLE_KEY);
      if (raw) {
        const state: ThrottleState = JSON.parse(raw);
        // Reset minute window if expired
        if (now - state.minuteWindowStart > 60_000) {
          state.minuteCount = 0;
          state.minuteWindowStart = now;
        }
        // Reset day window if expired
        if (now - state.dayWindowStart > 86_400_000) {
          state.dayCount = 0;
          state.dayWindowStart = now;
        }
        return state;
      }
    } catch { /* ignore */ }
  }
  return { minuteCount: 0, minuteWindowStart: now, dayCount: 0, dayWindowStart: now };
}

function saveThrottleState(state: ThrottleState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LS_THROTTLE_KEY, JSON.stringify(state));
  } catch { /* ignore */ }
}

// ─── Request Queue ────────────────────────────────────────────────────────────

const requestQueue: QueueItem[] = [];
let isProcessingQueue = false;
const pendingKeys = new Set<string>();

async function processQueue(): Promise<void> {
  if (isProcessingQueue) return;
  isProcessingQueue = true;

  while (requestQueue.length > 0) {
    const item = requestQueue.shift()!;
    pendingKeys.delete(item.key);

    // Check if timed out
    if (Date.now() - item.addedAt > QUEUE_TIMEOUT_MS) {
      item.reject(new Error('Queue timeout — please try again'));
      continue;
    }

    // Check throttle before each execution
    const throttleState = loadThrottleState();
    const now = Date.now();

    if (now - throttleState.minuteWindowStart > 60_000) {
      throttleState.minuteCount = 0;
      throttleState.minuteWindowStart = now;
    }
    if (now - throttleState.dayWindowStart > 86_400_000) {
      throttleState.dayCount = 0;
      throttleState.dayWindowStart = now;
    }

    if (throttleState.minuteCount >= MAX_RPM) {
      // Wait until next minute window
      const waitMs = 60_000 - (now - throttleState.minuteWindowStart) + 100;
      await new Promise(r => setTimeout(r, waitMs));
      // Re-add to front of queue
      requestQueue.unshift(item);
      continue;
    }

    if (throttleState.dayCount >= MAX_RPD) {
      item.reject(new Error('Daily AI quota reached — please try again tomorrow'));
      continue;
    }

    // Execute the request
    throttleState.minuteCount++;
    throttleState.dayCount++;
    saveThrottleState(throttleState);

    try {
      const result = await item.executor();
      item.resolve(result);
    } catch (err) {
      item.reject(err);
    }

    // Small delay between requests to avoid burst
    await new Promise(r => setTimeout(r, 200));
  }

  isProcessingQueue = false;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Initialize cache from localStorage (call once on app start) */
export function initFreeTierGuard(): void {
  loadPersistentCache();
}

/**
 * Check if a user message matches a static B2B answer.
 * Returns the answer string or null.
 */
export function getStaticAnswer(userMessage: string): string | null {
  for (const entry of B2B_STATIC_ANSWERS) {
    if (entry.patterns.some(p => p.test(userMessage))) {
      return entry.answer;
    }
  }
  return null;
}

/**
 * Get a cached response for the given messages array.
 * Returns the cached string or null.
 */
export function getCachedResponse(
  messages: Array<{ role: string; content: string }>
): string | null {
  const key = getCacheKey(messages);
  const entry = memoryCache.get(key);
  if (!entry) return null;

  const now = Date.now();
  if (now - entry.timestamp > CACHE_TTL_MS) {
    memoryCache.delete(key);
    return null;
  }

  entry.hits++;
  return entry.response;
}

/**
 * Store a response in the cache.
 */
export function setCachedResponse(
  messages: Array<{ role: string; content: string }>,
  response: string
): void {
  const key = getCacheKey(messages);

  // Evict oldest entries if at capacity
  if (memoryCache.size >= MAX_MEMORY_ENTRIES) {
    const oldest = [...memoryCache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
    if (oldest) memoryCache.delete(oldest[0]);
  }

  memoryCache.set(key, { response, timestamp: Date.now(), hits: 0 });
  savePersistentCache();
}

/**
 * Enqueue an AI request with deduplication and throttling.
 * If the same key is already pending, returns a shared promise.
 *
 * @param messages - The messages array (used as cache key)
 * @param executor - Async function that calls the actual AI API
 * @returns The AI response string
 */
export function enqueueAIRequest(
  messages: Array<{ role: string; content: string }>,
  executor: () => Promise<string>
): Promise<string> {
  const key = getCacheKey(messages);

  // Deduplicate: if same key already in queue, don't add again
  if (pendingKeys.has(key)) {
    return new Promise((resolve, reject) => {
      // Wait a bit then check cache (the in-flight request will populate it)
      const poll = setInterval(() => {
        const cached = getCachedResponse(messages);
        if (cached) {
          clearInterval(poll);
          resolve(cached);
        }
      }, 300);
      setTimeout(() => {
        clearInterval(poll);
        reject(new Error('Deduplicated request timed out'));
      }, QUEUE_TIMEOUT_MS);
    });
  }

  if (requestQueue.length >= QUEUE_MAX_SIZE) {
    return Promise.reject(new Error('Request queue is full — please wait a moment'));
  }

  pendingKeys.add(key);

  return new Promise<string>((resolve, reject) => {
    requestQueue.push({ key, resolve, reject, executor, addedAt: Date.now() });
    processQueue();
  });
}

/**
 * Get current throttle status (for admin display).
 */
export function getThrottleStatus(): {
  minuteCount: number;
  maxRPM: number;
  dayCount: number;
  maxRPD: number;
  queueSize: number;
  cacheSize: number;
} {
  const state = loadThrottleState();
  return {
    minuteCount: state.minuteCount,
    maxRPM: MAX_RPM,
    dayCount: state.dayCount,
    maxRPD: MAX_RPD,
    queueSize: requestQueue.length,
    cacheSize: memoryCache.size,
  };
}

/**
 * Clear all cached responses (admin utility).
 */
export function clearAICache(): void {
  memoryCache.clear();
  if (typeof window !== 'undefined') {
    try { localStorage.removeItem(LS_CACHE_KEY); } catch { /* ignore */ }
  }
}
