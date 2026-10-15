/**
 * Role-room isolation — single source of truth for platform "rooms".
 *
 * Rules:
 * - Each role has a home room (dashboard / ERP / control-room).
 * - Cross-role deep links to exclusive rooms redirect to the caller's home
 *   (never 403 — messaging/chat must stay reachable).
 * - Local ERP (`/manufacturer/erp`) is for local factory / local manufacturer
 *   entities only; international / non-local entities stay on the manufacturer
 *   dashboard without the local ERP room UX.
 * - Admins may enter any room for support; do not rewrite control-room here.
 */

export type PlatformRole =
  | 'buyer' | 'manufacturer' | 'commercial_supplier' | 'agent' | 'logistics' | 'admin' | 'unknown';

export interface RoleProfileHints {
  role?: string | null;
  account_type?: string | null;
  seller_category?: string | null;
  /** Auth user_metadata / app_metadata role fallback */
  metadataRole?: string | null;
}

/** Home path for each platform role after login / wrong-room redirect. */
export const ROLE_HOME_PATH: Record<Exclude<PlatformRole, 'unknown'>, string> = {
  buyer: '/buyer-dashboard',
  manufacturer: '/manufacturer/dashboard',
  commercial_supplier: '/supplier/local-dashboard',
  agent: '/agent/dashboard',
  logistics: '/logistics/dashboard',
  admin: '/admin/control-room',
};

/**
 * Exclusive room prefixes. Visiting one without the matching role
 * (or admin) redirects to ROLE_HOME_PATH[role].
 *
 * `/manufacturer/dashboard` is intentionally omitted from middleware
 * enforcement so factory sales reps (non-manufacturer JWT) can still land;
 * that page keeps its own guard.
 */
export const EXCLUSIVE_ROOM_PREFIXES: { prefix: string; roles: PlatformRole[] }[] = [
  { prefix: '/buyer-dashboard', roles: ['buyer'] },
  { prefix: '/manufacturer/erp', roles: ['manufacturer'] },
  { prefix: '/manufacturer/international-dashboard', roles: ['manufacturer'] },
  { prefix: '/manufacturer/b2b', roles: ['manufacturer'] },
  { prefix: '/manufacturer/b2c', roles: ['manufacturer'] },
  // Strict isolation: supplier dashboard is ONLY for commercial_supplier
  { prefix: '/supplier/local-dashboard', roles: ['commercial_supplier'] },
  // Strict isolation: factory dashboard is ONLY for manufacturer (local/international factory)
  { prefix: '/factory/local-dashboard', roles: ['manufacturer'] },
  { prefix: '/agent/dashboard', roles: ['agent'] },
  { prefix: '/agent/upload-license', roles: ['agent'] },
  { prefix: '/agent/register-factory', roles: ['agent'] },
  { prefix: '/agent/add-product', roles: ['agent'] },
  { prefix: '/logistics/dashboard', roles: ['logistics'] },
  { prefix: '/admin/control-room', roles: ['admin'] },
  { prefix: '/admin', roles: ['admin'] },
];

/** Paths that must never be blocked or role-redirected. */
export const ALWAYS_OPEN_PREFIXES = [
  '/messaging',
  '/chat',
  '/auth',
  '/login',
  '/api/auth',
  '/api/ai/translate',
  '/api/ai/factory-assistant',
];

const LOCAL_SELLER_CATEGORIES = new Set([
  'local_factory',
  'local_supplier',
]);

const LOCAL_FACTORY_TYPES = new Set([
  'local',
  'local_factory',
  'local_supplier',
]);

const INTERNATIONAL_MARKERS = new Set([
  'international_factory',
  'international',
  'intl',
]);

function normalizePath(pathname: string): string {
  return (pathname || '/').toLowerCase().split('?')[0].split('#')[0] || '/';
}

function matchesPrefix(pathname: string, prefix: string): boolean {
  const p = normalizePath(pathname);
  const pre = prefix.toLowerCase();
  return p === pre || p.startsWith(pre + '/');
}

export function isAlwaysOpenPath(pathname: string): boolean {
  return ALWAYS_OPEN_PREFIXES.some((pre) => matchesPrefix(pathname, pre));
}

export function resolvePlatformRole(hints: RoleProfileHints): PlatformRole {
  const candidates = [
    hints.role,
    hints.metadataRole,
    hints.account_type,
  ]
    .filter(Boolean)
    .map((v) => String(v).toLowerCase().trim());

  for (const c of candidates) {
    if (c === 'admin') return 'admin';
    if (c === 'field_agent' || c === 'agent') return 'agent';
    if (
      c === 'logistics_partner' ||
      c === 'logistics' ||
      c === 'shipping_partner'
    ) {
      return 'logistics';
    }
    // Commercial supplier — must be checked BEFORE generic manufacturer/supplier
    if (
      c === 'commercial_supplier' ||
      c === 'supplier' ||
      c === 'local_supplier'
    ) {
      return 'commercial_supplier';
    }
    if (
      c === 'manufacturer' ||
      c === 'factory' ||
      c === 'seller' ||
      c === 'vendor'
    ) {
      return 'manufacturer';
    }
    if (c === 'buyer' || c === 'consumer' || c === 'b2s_store') return 'buyer';
  }

  const seller = (hints.seller_category || '').toLowerCase();
  if (seller === 'local_supplier' || seller === 'commercial_supplier') {
    return 'commercial_supplier';
  }
  if (
    seller === 'local_factory' ||
    seller === 'international_factory'
  ) {
    return 'manufacturer';
  }

  if (candidates.length === 0) return 'unknown';
  return 'buyer';
}

/** Staff role that is strictly contained to the logistics command center. */
export const LOGISTICS_DISPATCHER_ROLE = 'LOGISTICS_DISPATCHER';
export const LOGISTICS_DISPATCHER_HOME = '/admin/logistics';

/** Staff role that is strictly contained to the field-ops command center. */
export const FIELD_OPS_MANAGER_ROLE = 'FIELD_OPS_MANAGER';
export const FIELD_OPS_MANAGER_HOME = '/admin/field-ops';

/** Staff role that is strictly contained to the financial escrow command center. */
export const ESCROW_OFFICER_ROLE = 'ESCROW_OFFICER';
export const ESCROW_OFFICER_HOME = '/admin/finance';

/**
 * FIELD_OPS_MANAGER staff may only use /admin/field-ops (plus always-open
 * messaging/auth paths). /admin, /admin/finance and any other privileged
 * area redirect back to the field-ops command center.
 */
export function resolveFieldOpsRedirect(
  pathname: string,
  staffRole?: string | null
): string | null {
  if ((staffRole || '').toUpperCase() !== FIELD_OPS_MANAGER_ROLE) return null;
  if (isAlwaysOpenPath(pathname)) return null;
  const p = normalizePath(pathname);
  if (
    p === FIELD_OPS_MANAGER_HOME ||
    p.startsWith(FIELD_OPS_MANAGER_HOME + '/') ||
    p.startsWith('/api/')
  ) {
    return null;
  }
  const privileged = ['/admin', '/management', '/operations', '/analytics', '/financial-accounts', '/invoices', '/kyc'];
  if (privileged.some((pre) => matchesPrefix(p, pre))) return FIELD_OPS_MANAGER_HOME;
  return null;
}

/**
 * ESCROW_OFFICER staff may only use /admin/finance. Catalog editing (field-ops),
 * factory licensing, logistics and every other privileged area redirect back.
 */
export function resolveEscrowOfficerRedirect(
  pathname: string,
  staffRole?: string | null
): string | null {
  if ((staffRole || '').toUpperCase() !== ESCROW_OFFICER_ROLE) return null;
  if (isAlwaysOpenPath(pathname)) return null;
  const p = normalizePath(pathname);
  if (
    p === ESCROW_OFFICER_HOME ||
    p.startsWith(ESCROW_OFFICER_HOME + '/') ||
    p.startsWith('/api/')
  ) {
    return null;
  }
  const privileged = ['/admin', '/management', '/operations', '/analytics', '/financial-accounts', '/invoices', '/kyc', '/factory', '/agent/register-factory', '/agent/upload-license', '/manufacturer/erp'];
  if (privileged.some((pre) => matchesPrefix(p, pre))) return ESCROW_OFFICER_HOME;
  return null;
}

/**
 * LOGISTICS_DISPATCHER staff may only use /admin/logistics (plus always-open
 * messaging/auth paths). Any other page redirects to the command center.
 */
export function resolveDispatcherRedirect(
  pathname: string,
  staffRole?: string | null
): string | null {
  if ((staffRole || '').toUpperCase() !== LOGISTICS_DISPATCHER_ROLE) return null;
  if (isAlwaysOpenPath(pathname)) return null;
  const p = normalizePath(pathname);
  if (
    p === LOGISTICS_DISPATCHER_HOME ||
    p.startsWith(LOGISTICS_DISPATCHER_HOME + '/') ||
    p.startsWith('/api/') ||
    p === '/logistics'|| p.startsWith('/logistics/')
  ) {
    return null;
  }
  // Only confine privileged areas; public pages remain reachable.
  const privileged = ['/admin', '/management', '/operations', '/analytics', '/financial-accounts', '/invoices', '/kyc'];
  if (privileged.some((pre) => matchesPrefix(p, pre))) return LOGISTICS_DISPATCHER_HOME;
  return null;
}

export function getHomeRoomForRole(role: PlatformRole): string {
  if (role === 'unknown') return '/my-account';
  return ROLE_HOME_PATH[role];
}

/**
 * If pathname is an exclusive room the role cannot use, return their home room.
 * Returns null when access is allowed (or path is always-open / non-exclusive).
 * Admins are never redirected away from exclusive rooms.
 */
export function resolveCrossRoleRedirect(
  pathname: string,
  role: PlatformRole
): string | null {
  if (isAlwaysOpenPath(pathname)) return null;
  if (role === 'admin') return null;

  const path = normalizePath(pathname);
  for (const room of EXCLUSIVE_ROOM_PREFIXES) {
    if (!matchesPrefix(path, room.prefix)) continue;
    if (role === 'unknown') {
      // Unresolved role: send to account rather than 403.
      return '/my-account';
    }
    if (!room.roles.includes(role)) {
      return getHomeRoomForRole(role);
    }
    return null;
  }
  return null;
}

/**
 * Whether a post-login `next` / return path is safe for this role.
 * Always-open paths (messaging) and non-exclusive paths pass.
 */
export function canUseReturnPath(pathname: string, role: PlatformRole): boolean {
  if (!pathname || !pathname.startsWith('/')) return false;
  if (isAlwaysOpenPath(pathname)) return true;
  return resolveCrossRoleRedirect(pathname, role) === null;
}

/**
 * Local ERP room is for local factory / local manufacturer entities only.
 * International (and other non-local markers) must not get the ERP UX.
 * Admins may open ERP for support.
 */
export function canAccessLocalErp(hints: {
  role?: string | null;
  metadataRole?: string | null;
  seller_category?: string | null;
  factory_type?: string | null;
  account_type?: string | null;
}): boolean {
  const platformRole = resolvePlatformRole({
    role: hints.role,
    metadataRole: hints.metadataRole,
    account_type: hints.account_type,
    seller_category: hints.seller_category,
  });
  if (platformRole === 'admin') return true;
  if (platformRole !== 'manufacturer') return false;

  const seller = (hints.seller_category || '').toLowerCase().trim();
  const factoryType = (hints.factory_type || '').toLowerCase().trim();
  const accountType = (hints.account_type || '').toLowerCase().trim();

  if (INTERNATIONAL_MARKERS.has(seller) || INTERNATIONAL_MARKERS.has(factoryType)) {
    return false;
  }

  if (LOCAL_SELLER_CATEGORIES.has(seller) || LOCAL_FACTORY_TYPES.has(factoryType)) {
    return true;
  }

  // Registered as factory / manufacturer without an international marker → local ERP OK
  if (
    accountType === 'factory' ||
    accountType === 'manufacturer'|| (hints.role ||'').toLowerCase() === 'manufacturer' ||
    (hints.metadataRole || '').toLowerCase() === 'manufacturer'
  ) {
    // Explicit international account_type would already have been caught above;
    // empty seller_category defaults to allowing local ERP for manufacturer role.
    if (seller === '' && factoryType === '') return true;
  }

  return false;
}

/** Fallback home when local ERP is denied for a manufacturer. */
export const MANUFACTURER_DASHBOARD_PATH = ROLE_HOME_PATH.manufacturer;

// ─── Room Metadata ─────────────────────────────────────────────────────────────
/**
 * Metadata for each isolated control room.
 * Used for UI identity banners and audit logging.
 */
export interface RoomMetadata {
  id: string;
  labelAr: string;
  labelEn: string;
  market: string;
  color: string;
  icon: string;
  path: string;
}

export const CONTROL_ROOMS: RoomMetadata[] = [
  {
    id: 'local-supplier-control-room',
    labelAr: 'غرفة تحكم المورد المحلي والتجاري',
    labelEn: 'Local & Commercial Supplier Control Room',
    market: 'السوق اليمني المحلي — Yemen Domestic Market',
    color: 'emerald',
    icon: 'Store',
    path: '/supplier/local-dashboard',
  },
  {
    id: 'local-factory-control-room',
    labelAr: 'غرفة تحكم المصنع المحلي',
    labelEn: 'Local Factory Control Room',
    market: 'الجمهورية اليمنية — المصانع والمنتجون المحليون',
    color: 'orange',
    icon: 'Factory',
    path: '/factory/local-dashboard',
  },
  {
    id: 'international-factory-control-room',
    labelAr: 'غرفة تحكم المصنع الدولي',
    labelEn: 'International Factory Control Room',
    market: 'الأسواق الدولية — Global Export Markets',
    color: 'blue',
    icon: 'Globe',
    path: '/manufacturer/international-dashboard',
  },
  {
    id: 'field-agent-dashboard',
    labelAr: 'لوحة تحكم المندوب الميداني',
    labelEn: 'Field Agent Dashboard',
    market: 'تسجيل المصانع والتحقق الميداني',
    color: 'violet',
    icon: 'UserCheck',
    path: '/agent/dashboard',
  },
  {
    id: 'logistics-office-dashboard',
    labelAr: 'لوحة تحكم المكتب اللوجستي',
    labelEn: 'Logistics Partner Dashboard',
    market: 'إدارة الشحنات والتوصيل اللوجستي',
    color: 'cyan',
    icon: 'Truck',
    path: '/logistics/dashboard',
  },
];

export function getRoomMetadata(path: string): RoomMetadata | null {
  return CONTROL_ROOMS.find(r => path.startsWith(r.path)) || null;
}
