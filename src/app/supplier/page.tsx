import SupplierRoleGuard from './SupplierRoleGuard';
import SupplierDashboard from './SupplierDashboard';

export const dynamic = 'force-dynamic';

export default function SupplierPage() {
  return (
    <SupplierRoleGuard redirectTo="/supplier">
      <SupplierDashboard />
    </SupplierRoleGuard>
  );
}
