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
} as const;

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
};

/** Persist role / account_type / seller_category for middleware room isolation. */
export function syncRoleCookies(hints: RoleCookieHints): void {
  if (hints.role) setCookie(ROLE_COOKIE_NAMES.role, hints.role);
  else clearCookie(ROLE_COOKIE_NAMES.role);

  if (hints.account_type) setCookie(ROLE_COOKIE_NAMES.accountType, hints.account_type);
  else clearCookie(ROLE_COOKIE_NAMES.accountType);

  if (hints.seller_category) setCookie(ROLE_COOKIE_NAMES.sellerCategory, hints.seller_category);
  else clearCookie(ROLE_COOKIE_NAMES.sellerCategory);
}

/** Clear role cookies on sign-out. */
export function clearRoleCookies(): void {
  clearCookie(ROLE_COOKIE_NAMES.role);
  clearCookie(ROLE_COOKIE_NAMES.accountType);
  clearCookie(ROLE_COOKIE_NAMES.sellerCategory);
}
