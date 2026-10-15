import { NextResponse, type NextRequest } from 'next/server';
import { isProtectedFromAI } from '@/lib/aiSecurityFirewall';
import { createServerClient } from '@supabase/ssr';
import {
  resolvePlatformRole,
  resolveCrossRoleRedirect,
  resolveDispatcherRedirect,
} from '@/lib/roomIsolation';

/**
 * DirectHub Middleware — Security Firewall v3
 *
 * RED LINE SECURITY WALL:
 * 1. Blocks all AI/translation API calls originating from protected admin/financial zones.
 * 2. Blocks known AI crawlers from accessing admin/financial pages.
 * 3. Returns 403 Forbidden for violations — NEVER for messaging/chat routes.
 *
 * PERMANENT RULE: /messaging and /chat must NEVER be blocked for real users.
 * Past false-positive bot UA matching caused recurring 403s on messaging after
 * Google login. Those routes are on an unconditional never-block allowlist.
 */

const AI_API_ROUTES = [
  '/api/ai/factory-assistant',
  '/api/ai/chat-completion',
  '/api/ai/translate',
];

// Known AI crawler / translation bot user-agent patterns to block from protected zones
// IMPORTANT: These patterns must be SPECIFIC enough to avoid false positives.
// Do NOT use broad terms like 'translate', 'google', 'bot', 'crawler', 'spider'
// alone — they can match legitimate browsers, extensions, or in-app WebViews.
const AI_BOT_PATTERNS = [
  'googlebot',
  'bingbot',
  'gptbot',
  'chatgpt-user',
  'openai-scraper',
  'anthropic-ai',
  'claude-web',
  'claudebot',
  'gemini-bot',
  'bard-bot',
  'perplexitybot',
  'bytespider',
  'ccbot',
  'deeplbot',
  'google-extended',
  'baiduspider',
  'yandexbot',
  'duckduckbot',
  'ahrefsbot',
  'semrushbot',
  'dotbot',
  'mj12bot',
];

// Auth/OAuth paths that must NEVER be blocked regardless of user-agent
const AUTH_ALLOWLIST = [
  '/auth/callback',
  '/auth/social-callback',
  '/auth/social-login',
  '/auth/role-selection',
  '/auth/reset-password',
  '/login',
  '/api/auth',
];

/**
 * PERMANENT never-block list.
 * Messaging/chat (and their translate APIs) must always reach authenticated users.
 * Evaluated BEFORE bot/firewall checks so these routes cannot regress into 403s.
 */
const NEVER_BLOCK_ROUTES = [
  '/messaging',
  '/chat',
  '/api/ai/translate',
  '/api/ai/factory-assistant',
];

// Protected page routes that must block AI bots entirely
// NOTE: /messaging and /chat must NEVER be added here.
const PROTECTED_PAGE_ROUTES = [
  '/admin',
  '/manufacturer/dashboard',
  '/manufacturer/erp',
  '/management',
  '/operations',
  '/analytics',
  '/invoices',
  '/kyc',
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
  '/factory/upload',
  '/factory/products',
  '/factory/local-dashboard',
  '/supplier/local-dashboard',
  '/agent/dashboard',
  '/agent/upload-license',
  '/agent/register-factory',
  '/agent/add-product',
  '/buyer-dashboard',
  '/logistics/dashboard',
  '/manufacturer/international-dashboard',
  '/manufacturer/b2b',
  '/manufacturer/b2c',
  '/api/escrow',
  '/api/payment',
  '/api/invoices',
  '/api/quotes',
  '/api/whatsapp',
  '/api/ai/admin-analysis',
];

function normalizePath(pathname: string): string {
  return pathname.toLowerCase().split('?')[0] || '/';
}

function decodeCookie(value?: string | null): string | null {
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function matchesRoute(pathname: string, route: string): boolean {
  const normalized = normalizePath(pathname);
  return normalized === route || normalized.startsWith(route + '/');
}

function isAIBot(userAgent: string): boolean {
  const ua = userAgent.toLowerCase();
  return AI_BOT_PATTERNS.some(pattern => ua.includes(pattern));
}

function isProtectedPage(pathname: string): boolean {
  return PROTECTED_PAGE_ROUTES.some(route => matchesRoute(pathname, route));
}

function isAuthAllowlisted(pathname: string): boolean {
  return AUTH_ALLOWLIST.some(route => matchesRoute(pathname, route));
}

function isNeverBlocked(pathname: string): boolean {
  return NEVER_BLOCK_ROUTES.some(route => matchesRoute(pathname, route));
}

/** True for browser document navigations (not XHR/fetch/API clients). */
function isHtmlNavigation(request: NextRequest): boolean {
  const accept = (request.headers.get('accept') || '').toLowerCase();
  const dest = (request.headers.get('sec-fetch-dest') || '').toLowerCase();
  const mode = (request.headers.get('sec-fetch-mode') || '').toLowerCase();
  if (dest === 'document' || mode === 'navigate') return true;
  if (accept.includes('text/html')) return true;
  return false;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const userAgent = request.headers.get('user-agent') || '';

  // ── Supabase SSR session refresh ─────────────────────────────────────────────
  // Refresh session tokens and write updated cookies back to the response.
  // Must run before any other logic so the session is always up-to-date.
  let supabaseResponse = NextResponse.next({ request });

  const supabaseSSR = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh the session — this updates the cookie if the token was refreshed
  const { data: { user: sessionUser } } = await supabaseSSR.auth.getUser();

  // ── ALWAYS allow auth/OAuth paths through — never block these ───────────────
  if (isAuthAllowlisted(pathname)) {
    return supabaseResponse;
  }

  // ── PERMANENT: messaging/chat must NEVER return 403 ─────────────────────────
  // Prevents recurrence of false bot-UA blocks after Google login / WebViews.
  if (isNeverBlocked(pathname)) {
    return supabaseResponse;
  }

  // ── Role-room isolation (redirect, never 403) ───────────────────────────────
  // Logged-in users who deep-link into another role's exclusive room are sent
  // to their own home room. Messaging/chat already returned above.
  //
  // Role hints come from JWT metadata PLUS `dh_*` cookies synced from
  // `user_profiles` by AuthContext (see `src/lib/roleCookies.ts`). Middleware
  // still avoids a DB round-trip. Page-level guards (e.g. ERP canAccessLocalErp)
  // remain the source of truth when cookies are stale or missing.
  if (sessionUser && isHtmlNavigation(request)) {
    const meta = sessionUser.user_metadata || {};
    const app = sessionUser.app_metadata || {};
    const cookieRole =
      decodeCookie(request.cookies.get('dh_role')?.value) ||
      decodeCookie(request.cookies.get('user_role')?.value) ||
      decodeCookie(request.cookies.get('role')?.value) ||
      null;
    const cookieAccountType =
      decodeCookie(request.cookies.get('dh_account_type')?.value) ||
      decodeCookie(request.cookies.get('account_type')?.value) ||
      null;
    const cookieSellerCategory =
      decodeCookie(request.cookies.get('dh_seller_category')?.value) ||
      decodeCookie(request.cookies.get('seller_category')?.value) ||
      null;
    const cookieAccountRole =
      decodeCookie(request.cookies.get('dh_account_role')?.value) ||
      decodeCookie(request.cookies.get('account_role')?.value) ||
      null;

    const platformRole = resolvePlatformRole({
      role:
        (meta.role as string | undefined) ||
        (app.role as string | undefined) ||
        cookieRole ||
        null,
      account_type:
        (meta.account_type as string | undefined) ||
        (app.account_type as string | undefined) ||
        cookieAccountType ||
        null,
      seller_category:
        (meta.seller_category as string | undefined) ||
        (app.seller_category as string | undefined) ||
        cookieSellerCategory ||
        null,
      metadataRole:
        (meta.account_role as string | undefined) ||
        (app.account_role as string | undefined) ||
        (meta.user_role as string | undefined) ||
        (app.user_role as string | undefined) ||
        (meta.role as string | undefined) ||
        (app.role as string | undefined) ||
        cookieAccountRole ||
        cookieRole ||
        null,
    });
    const staffRole =
      (meta.staff_role as string | undefined) || (app.staff_role as string | undefined) || null;
    const isDispatcher = (staffRole || '').toUpperCase() === 'LOGISTICS_DISPATCHER';
    const roomRedirect = isDispatcher
      ? resolveDispatcherRedirect(pathname, staffRole)
      : resolveCrossRoleRedirect(pathname, platformRole);
    if (roomRedirect && normalizePath(pathname) !== normalizePath(roomRedirect)) {
      const url = request.nextUrl.clone();
      url.pathname = roomRedirect;
      url.search = '';
      const redirectResponse = NextResponse.redirect(url);
      supabaseResponse.cookies.getAll().forEach(({ name, value }) => {
        redirectResponse.cookies.set(name, value);
      });
      return redirectResponse;
    }
  }

  // ── RED LINE: Block AI bots from protected page routes ──────────────────────
  // Extra safety: never 403 HTML navigations with opaque JSON — real users
  // browsing protected pages in unusual browsers should still reach the app;
  // page-level auth (Supabase session) remains the gate.
  if (isAIBot(userAgent) && isProtectedPage(pathname)) {
    if (isHtmlNavigation(request)) {
      const response = NextResponse.next();
      response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
      response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      return response;
    }
    return new NextResponse(
      JSON.stringify({
        error: 'Access Denied',
        message: 'Automated access to this protected zone is strictly forbidden.',
        code: 'AI_BOT_BLOCKED_403',
      }),
      {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
          'X-Robots-Tag': 'noindex, nofollow, noarchive, nosnippet',
        },
      }
    );
  }

  // ── AI/Translation API Firewall ──────────────────────────────────────────────
  const isAIRoute = AI_API_ROUTES.some((route) => pathname.startsWith(route));

  if (isAIRoute) {
    // admin-analysis has its own Supabase admin auth check — allow through
    if (pathname.startsWith('/api/ai/admin-analysis')) {
      return NextResponse.next();
    }

    // Check source path header (set by client hooks for traceability)
    // NOTE: Only block when x-source-path is explicitly set to a protected zone.
    // Do NOT block based on Referer — the Referer reflects the page the user is
    // browsing, not the data being accessed. Public visitors on any page should
    // be able to use the AI assistant.
    const sourcePath = request.headers.get('x-source-path') || '';
    if (sourcePath && isProtectedFromAI(sourcePath)) {
      return new NextResponse(
        JSON.stringify({
          error: 'Access Denied',
          message:
            'AI and translation services are not permitted in protected administrative and financial zones.',
          code: 'AI_FIREWALL_BLOCKED',
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Block AI bots from calling AI APIs entirely
    if (isAIBot(userAgent)) {
      return new NextResponse(
        JSON.stringify({
          error: 'Access Denied',
          message: 'Automated AI access to this API is not permitted.',
          code: 'AI_BOT_API_BLOCKED_403',
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  }

  // ── Add security headers to all protected page responses ────────────────────
  if (isProtectedPage(pathname)) {
    supabaseResponse.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
    supabaseResponse.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
