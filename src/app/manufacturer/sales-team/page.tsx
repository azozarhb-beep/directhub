'use client';

export const dynamic = 'force-dynamic';

import ManufacturerModuleRoute from '@/components/manufacturer/ManufacturerModuleRoute';
import FinancialRouteGuard from '@/components/manufacturer/FinancialRouteGuard';

export default function ManufacturerSalesTeamPage() {
  return (
    <FinancialRouteGuard>
      <ManufacturerModuleRoute localTab="sales_team" />
    </FinancialRouteGuard>
  );
}
