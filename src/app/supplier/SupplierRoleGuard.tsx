import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { resolvePlatformRole, ROLE_HOME_PATH } from '@/lib/roomIsolation';

interface SupplierRoleGuardProps {
  /** Path to return to after login. */
  redirectTo?: string;
  children: React.ReactNode;
}

/**
 * Server-side authorization for the supplier room.
 * Role is derived from the authenticated user's database profile.
 */
export default async function SupplierRoleGuard({ redirectTo = '/supplier', children }: SupplierRoleGuardProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?redirect=${encodeURIComponent(redirectTo)}`);
  }

  // 1. جلب كافة الحقول التي تحدد نوع ورتبة حساب المورد
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, account_type, seller_category, account_role')
    .eq('id', user.id)
    .maybeSingle();

  const meta = (user.user_metadata ?? {}) as Record<string, string | undefined>;
  const app = (user.app_metadata ?? {}) as Record<string, string | undefined>;

  // 2. التحقق المباشر من مسميات المورد المحلي والتجاري والإدارة
  const accountRole = (profile?.account_role || meta.account_role || '').toLowerCase().trim();
  const directRole = (profile?.role || meta.role || app.role || '').toLowerCase().trim();
  const accountType = (profile?.account_type || meta.account_type || '').toLowerCase().trim();

  const isSupplier =
    accountRole === 'commercial_supplier' ||
    accountRole === 'supplier' ||
    directRole === 'supplier' ||
    directRole === 'commercial_supplier' ||
    directRole === 'admin' ||
    accountType === 'supplier' ||
    accountType === 'commercial_supplier';

  if (isSupplier) {
    return <>{children}</>;
  }

  // 3. التحقق الاحتياطي عبر roomIsolation
  const role = resolvePlatformRole({
    role: (profile?.role as string | null | undefined) ?? app.role ?? meta.role ?? null,
    account_type: (profile?.account_type as string | null | undefined) ?? meta.account_type ?? null,
    seller_category: (profile?.seller_category as string | null | undefined) ?? meta.seller_category ?? null,
    metadataRole: profile?.account_role ?? meta.account_role ?? meta.user_role ?? null,
  });

  if (role === 'commercial_supplier' || (role as string) === 'supplier' || role === 'admin') {
    return <>{children}</>;
  }

  // إذا كان الحساب مشترياً عادياً فقط يتم تحويله
  redirect(role === 'unknown' ? '/login' : (ROLE_HOME_PATH[role] || '/my-account'));
}
