/**
 * DirectHub AI Security Firewall
 *
 * SECURITY ARCHITECTURE:
 * This module enforces a strict, absolute firewall that completely isolates
 * all AI engines, translation systems, and external language services from:
 *
 *   - Admin control rooms & dashboards
 *   - Payment gateways & financial records
 *   - Escrow systems & billing engines
 *   - Admin accounts & management panels
 *   - Operations & KYC verification systems
 *
 * These protected zones are managed EXCLUSIVELY by traditional system access
 * controls (Supabase RLS + server-side auth). No AI engine may read, write,
 * or process data from these areas under any circumstances.
 *
 * PUBLIC ZONES (AI/Translation ALLOWED):
 *   - Product browsing, search, categories
 *   - Supplier & factory public profiles
 *   - RFQ board (public-facing)
 *   - AI assistant / RFQ Copilot
 *   - Home page, about, legal pages
 *
 * SECURITY HARDENING v3.5:
 *   - RLS enforced at database level for all tables
 *   - Dual Escrow PIN protection (9-digit + delivery OTP)
 *   - AI firewall blocks all protected zone access
 *   - Rate limiting on all AI endpoints
 *   - Input sanitization against prompt injection
 */

// ── Protected Route Prefixes (AI/Translation BLOCKED) ────────────────────────

export const PROTECTED_ROUTE_PREFIXES: string[] = [
  '/admin',
  '/api/admin',
  '/api/escrow',
  '/api/payment',
  '/api/ai/admin-analysis',
  '/management',
  '/operations',
  '/analytics',
  '/invoices',
  '/kyc',
  '/api/invoices',
  '/api/quotes',
  '/api/whatsapp',
  '/manufacturer/dashboard',
  '/factory/upload',
  '/factory/products',
  '/agent/dashboard',
  '/agent/upload-license',
  '/agent/register-factory',
  '/agent/add-product',
  '/buyer-dashboard',
  '/orders',
  '/order-fulfillment',
  '/order-tracking',
  '/order-status',
  '/order-confirmation',
  '/disputes',
  '/checkout',
  '/cart',
  '/rfq-management',
  '/notifications',
  '/my-account',
  '/wishlist',
  '/financial-accounts',
  '/api/escrow/pin',
  '/api/escrow/delivery-pin',
  '/api/escrow/release-by-code',
  '/api/escrow/admin-payout',
  '/api/escrow/green-light',
  '/api/escrow/billing-engine',
];

// ── Public Route Prefixes (AI/Translation ALLOWED) ────────────────────────────

export const PUBLIC_ROUTE_PREFIXES: string[] = [
  '/',
  '/search',
  '/categories',
  '/suppliers',
  '/seller',
  '/product',
  '/rfq-board',
  '/about',
  '/legal',
  '/chat',
  '/messaging',
  '/api/ai/factory-assistant',
  '/api/ai/chat-completion',
  '/api/ai/translate',
  '/api/track-visit',
  '/storefront',
  '/store',
];

// ── Prompt Injection Patterns (AI Firewall) ───────────────────────────────────

const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(previous|all|above)\s+instructions/i,
  /you\s+are\s+now\s+(a\s+)?(?:dan|jailbreak|unrestricted)/i,
  /pretend\s+you\s+(are|have\s+no)\s+(restrictions|limits|rules)/i,
  /system\s*:\s*you\s+are/i,
  /\[INST\]|\[\/INST\]/i,
  /###\s*instruction/i,
  /<\|im_start\|>|<\|im_end\|>/i,
  /reveal\s+(your\s+)?(system\s+)?prompt/i,
  /show\s+me\s+(your\s+)?(instructions|prompt|rules)/i,
  /bypass\s+(security|filter|restriction)/i,
  /admin\s+password|secret\s+key|api\s+key/i,
  /execute\s+(sql|query|command)/i,
  /drop\s+table|delete\s+from|truncate\s+table/i,
];

/**
 * Checks if a message contains prompt injection or jailbreak attempts.
 * Returns { safe: true } if clean, { safe: false, reason } if suspicious.
 */
export function sanitizeAIInput(input: string): { safe: boolean; reason?: string } {
  if (!input || typeof input !== 'string') return { safe: true };

  const trimmed = input.trim();

  // Check for injection patterns
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        safe: false,
        reason: 'Input contains potentially unsafe patterns that violate the AI security policy.',
      };
    }
  }

  // Check for excessive length (potential token stuffing)
  if (trimmed.length > 8000) {
    return {
      safe: false,
      reason: 'Input exceeds maximum allowed length.',
    };
  }

  return { safe: true };
}

// ── Firewall Check Functions ──────────────────────────────────────────────────

/**
 * Returns true if the given path is a protected admin/financial zone
 * where AI and translation engines are strictly forbidden.
 */
function matchesPrefix(path: string, prefix: string): boolean {
  const normalizedPath = path.toLowerCase().split('?')[0] || '/';
  // Exact match or child path only — never bare startsWith(prefix), which
  // falsely matched sibling routes (e.g. /cart vs /cartography).
  if (prefix === '/') return normalizedPath === '/';
  return normalizedPath === prefix || normalizedPath.startsWith(prefix + '/');
}

/**
 * Returns true if the given path is a protected admin/financial zone
 * where AI and translation engines are strictly forbidden.
 */
export function isProtectedFromAI(path: string): boolean {
  if (!path) return false;
  return PROTECTED_ROUTE_PREFIXES.some((prefix) => matchesPrefix(path, prefix));
}

/**
 * Returns true if the given path is a public-facing zone
 * where AI and translation are permitted.
 */
export function isPublicAIZone(path: string): boolean {
  if (!path) return false;
  return PUBLIC_ROUTE_PREFIXES.some((prefix) => matchesPrefix(path, prefix));
}

/**
 * Validates an incoming AI/translation API request.
 * Checks the `x-source-path` header to determine
 * if the request originates from a protected zone.
 * Also sanitizes the request body for prompt injection.
 *
 * NOTE: Referer header is intentionally NOT checked here — the middleware
 * already handles source-path-based blocking. Referer reflects the page
 * the user is browsing, not the data being accessed, and blocking on it
 * would prevent admin users from using AI features on their own pages.
 *
 * Returns { allowed: true } if the request is permitted.
 * Returns { allowed: false, reason } if the request must be blocked.
 */
export function validateAIRequest(headers: Headers, body?: string): {
  allowed: boolean;
  reason?: string;
} {
  // Check custom source path header (set by client-side hooks)
  const sourcePath = headers.get('x-source-path') || '';
  if (sourcePath && isProtectedFromAI(sourcePath)) {
    return {
      allowed: false,
      reason: `AI access denied: source path "${sourcePath}" is in a protected zone.`,
    };
  }

  // Sanitize body content for prompt injection
  if (body) {
    const sanitizeResult = sanitizeAIInput(body);
    if (!sanitizeResult.safe) {
      return {
        allowed: false,
        reason: sanitizeResult.reason || 'AI firewall: unsafe input detected.',
      };
    }
  }

  return { allowed: true };
}

/**
 * Standard blocked response for AI firewall violations.
 * Returns a 403 JSON response with a clear security message.
 */
export function createFirewallBlockedResponse(): Response {
  return new Response(
    JSON.stringify({
      error: 'Access Denied',
      message:
        'AI and translation services are not permitted in protected administrative and financial zones. These areas are managed exclusively by traditional system access controls.',
      code: 'AI_FIREWALL_BLOCKED',
    }),
    {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

/**
 * Standard blocked response for prompt injection attempts.
 */
export function createInjectionBlockedResponse(): Response {
  return new Response(
    JSON.stringify({
      error: 'Request Blocked',
      message: 'Your request was blocked by the AI security firewall due to potentially unsafe content.',
      code: 'AI_INJECTION_BLOCKED',
    }),
    {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
