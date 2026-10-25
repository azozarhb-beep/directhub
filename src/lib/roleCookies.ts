/**
 * Sync platform role hints into cookies so middleware can resolve rooms
 * without a Supabase profile round-trip on every HTML navigation.
 *
 * Cookie names must match the readers in `src/middleware.ts`.
 */

export const ROLE_COOKIE_NAMES = {
  role: 'dh_role',
  accountType: 'dh_account_type',
  sellerCategory: 'dh_seller_category',
  accountRole: 'dh_account_role',
  activeRole: 'dh_active_role',
} as const;

export const ACTIVE_ROLE_STORAGE_KEY = 'activeRole';

const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function setCookie(name: string, value: string) {
  if (typeof document === 'undefined') return;
  const safe = encodeURIComponent(value.trim());
  document.cookie = `${name}=${safe}; Path=/; Max-Age=${MAX_AGE_SECONDS}; SameSite=Lax`;
}

function clearCookie(name: string) {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export type RoleCookieHints = {
  role?: string | null;
  account_type?: string | null;
  seller_category?: string | null;
  account_role?: string | null;
};

/** Persist role / account_type / seller_category / account_role for middleware room isolation. */
export function syncRoleCookies(hints: RoleCookieHints): void {
  if (hints.role) setCookie(ROLE_COOKIE_NAMES.role, hints.role);
  else clearCookie(ROLE_COOKIE_NAMES.role);

  if (hints.account_type) setCookie(ROLE_COOKIE_NAMES.accountType, hints.account_type);
  else clearCookie(ROLE_COOKIE_NAMES.accountType);

  if (hints.seller_category) setCookie(ROLE_COOKIE_NAMES.sellerCategory, hints.seller_category);
  else clearCookie(ROLE_COOKIE_NAMES.sellerCategory);

  if (hints.account_role) setCookie(ROLE_COOKIE_NAMES.accountRole, hints.account_role);
  else clearCookie(ROLE_COOKIE_NAMES.accountRole);
}

/** Clear role cookies on sign-out. */
export function clearRoleCookies(): void {
  clearCookie(ROLE_COOKIE_NAMES.role);
  clearCookie(ROLE_COOKIE_NAMES.accountType);
  clearCookie(ROLE_COOKIE_NAMES.sellerCategory);
  clearCookie(ROLE_COOKIE_NAMES.accountRole);
  clearActiveRole();
}

/** Persist the active role (e.g. 'supplier') in both a cookie (for middleware) and localStorage (for client guards). */
export function persistActiveRole(activeRole: string | null | undefined): void {
  if (typeof document === 'undefined') return;
  if (!activeRole) {
    clearActiveRole();
    return;
  }
  const value = activeRole.trim();
  document.cookie = `${ROLE_COOKIE_NAMES.activeRole}=${encodeURIComponent(value)}; Path=/; Max-Age=${60 * 60 * 24 * 30}; SameSite=Lax`;
  try {
    window.localStorage.setItem(ACTIVE_ROLE_STORAGE_KEY, value);
  } catch {
    // storage unavailable — cookie still holds the role
  }
}

/** Read the persisted active role (localStorage first, then cookie). */
export function readActiveRole(): string | null {
  if (typeof document === 'undefined') return null;
  try {
    const stored = window.localStorage.getItem(ACTIVE_ROLE_STORAGE_KEY);
    if (stored) return stored;
  } catch {
    // ignore
  }
  const match = document.cookie
    .split('; ')
    .find((c) => c.startsWith(`${ROLE_COOKIE_NAMES.activeRole}=`));
  if (!match) return null;
  try {
    return decodeURIComponent(match.split('=')[1] || '') || null;
  } catch {
    return null;
  }
}

export function clearActiveRole(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${ROLE_COOKIE_NAMES.activeRole}=; Path=/; Max-Age=0; SameSite=Lax`;
  try {
    window.localStorage.removeItem(ACTIVE_ROLE_STORAGE_KEY);
  } catch {
    // ignore
  }
}
