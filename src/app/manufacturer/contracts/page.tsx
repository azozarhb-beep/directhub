'use client';

export const dynamic = 'force-dynamic';

import ManufacturerModuleRoute from '@/components/manufacturer/ManufacturerModuleRoute';
import FinancialRouteGuard from '@/components/manufacturer/FinancialRouteGuard';

export default function ManufacturerContractsPage() {
  return (
    <FinancialRouteGuard>
      <ManufacturerModuleRoute localTab="contracts" />
    </FinancialRouteGuard>
  );
}
