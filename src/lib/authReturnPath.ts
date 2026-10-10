/**
 * Safe post-login return path helpers.
 * Used so OAuth users who open login from /messaging return there
 * instead of being forced to a role dashboard (which felt like a 403).
 */

export const AUTH_NEXT_COOKIE = 'dh_auth_next';

const BLOCKED_RETURN_PREFIXES = [
  '/auth/',
  '/api/',
  '/login',
  '/admin/login',
];

/**
 * Only allow same-origin relative paths. Reject open redirects.
 */
export function sanitizeReturnPath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let value = raw.trim();
  try {
    value = decodeURIComponent(value);
  } catch {
    return null;
  }
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return null;
  if (value.includes('://')) return null;
  const pathOnly = value.split('?')[0].split('#')[0].toLowerCase();
  if (BLOCKED_RETURN_PREFIXES.some((p) => pathOnly === p || pathOnly.startsWith(p))) return null;
  // Cap length to avoid abuse
  if (value.length > 200) return null;
  return value;
}

/** Client-side: persist intended return path before OAuth redirect. */
export function storeAuthReturnPath(path?: string): void {
  if (typeof window === 'undefined') return;
  const candidate = path || `${window.location.pathname}${window.location.search || ''}`;
  const safe = sanitizeReturnPath(candidate);
  if (!safe) return;
  try {
    document.cookie = `${AUTH_NEXT_COOKIE}=${encodeURIComponent(safe)}; Path=/; Max-Age=600; SameSite=Lax`;
    window.sessionStorage.setItem(AUTH_NEXT_COOKIE, safe);
  } catch {
    // ignore storage failures
  }
}
