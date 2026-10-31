import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { resolvePlatformRole, ROLE_HOME_PATH } from '@/lib/roomIsolation';

export const dynamic = 'force-dynamic';

interface SupplierLayoutProps {
  children: React.ReactNode;
}

export default async function SupplierLayout({ children }: SupplierLayoutProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?redirect=/supplier');
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, account_type, seller_category')
    .eq('id', user.id)
    .maybeSingle();

  const meta = (user.user_metadata ?? {}) as Record<string, string | undefined>;
  const app = (user.app_metadata ?? {}) as Record<string, string | undefined>;

  // Authorization is derived from the database profile only (never from cookies).
  const role = resolvePlatformRole({
    role: profile?.role ?? app.role ?? meta.role ?? null,
    account_type: profile?.account_type ?? meta.account_type ?? null,
    seller_category: profile?.seller_category ?? meta.seller_category ?? null,
    metadataRole: meta.account_role ?? meta.user_role ?? null,
  });

  if (role !== 'commercial_supplier' && role !== 'admin') {
    redirect(role === 'unknown' ? '/login' : ROLE_HOME_PATH[role]);
  }

  return <>{children}</>;
}
