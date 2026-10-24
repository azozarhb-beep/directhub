'use client';

export const dynamic = 'force-dynamic';

import ManufacturerModuleRoute from '@/components/manufacturer/ManufacturerModuleRoute';
import FinancialRouteGuard from '@/components/manufacturer/FinancialRouteGuard';

export default function ManufacturerAllSalesPage() {
  return (
    <FinancialRouteGuard>
      <ManufacturerModuleRoute localTab="all_sales" />
    </FinancialRouteGuard>
  );
}
