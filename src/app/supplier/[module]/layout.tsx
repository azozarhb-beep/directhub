import SupplierRoleGuard from '../SupplierRoleGuard';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface SupplierModuleLayoutProps {
  children: React.ReactNode;
  params: Promise<{ module: string }>;
}

export default async function SupplierModuleLayout({ children, params }: SupplierModuleLayoutProps) {
  const { module: slug } = await params;

  // /supplier/<factory uuid> is the public, buyer-facing factory profile
  if (slug && UUID_RE.test(slug)) {
    return <>{children}</>;
  }

  return <SupplierRoleGuard redirectTo={`/supplier/${slug ?? ''}`}>{children}</SupplierRoleGuard>;
}
