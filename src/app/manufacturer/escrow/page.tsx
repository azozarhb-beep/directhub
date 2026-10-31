'use client';

export const dynamic = 'force-dynamic';

import ManufacturerModuleRoute from '@/components/manufacturer/ManufacturerModuleRoute';
import FinancialRouteGuard from '@/components/manufacturer/FinancialRouteGuard';

export default function ManufacturerEscrowPage() {
  return (
    <FinancialRouteGuard>
      <ManufacturerModuleRoute localTab="escrow_orders" internationalKey="escrow" />
    </FinancialRouteGuard>
  );
}
