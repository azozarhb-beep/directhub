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
 * Role is derived from the authenticated user's database profile (never cookies).
 */
export default async function SupplierRoleGuard({ redirectTo = '/supplier', children }: SupplierRoleGuardProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?redirect=${encodeURIComponent(redirectTo)}`);
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, account_type, seller_category')
    .eq('id', user.id)
    .maybeSingle();

  const meta = (user.user_metadata ?? {}) as Record<string, string | undefined>;
  const app = (user.app_metadata ?? {}) as Record<string, string | undefined>;

  const role = resolvePlatformRole({
    role: (profile?.role as string | null | undefined) ?? app.role ?? meta.role ?? null,
    account_type: (profile?.account_type as string | null | undefined) ?? meta.account_type ?? null,
    seller_category: (profile?.seller_category as string | null | undefined) ?? meta.seller_category ?? null,
    metadataRole: meta.account_role ?? meta.user_role ?? null,
  });

  if (role !== 'commercial_supplier' && role !== 'admin') {
    redirect(role === 'unknown' ? '/login' : ROLE_HOME_PATH[role]);
  }

  return <>{children}</>;
}
