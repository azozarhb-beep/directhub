'use client';

export const dynamic = 'force-dynamic';

import ManufacturerModuleRoute from '@/components/manufacturer/ManufacturerModuleRoute';
import FinancialRouteGuard from '@/components/manufacturer/FinancialRouteGuard';

export default function ManufacturerRevenuePage() {
  return (
    <FinancialRouteGuard>
      <ManufacturerModuleRoute localTab="finance" internationalKey="finance" />
    </FinancialRouteGuard>
  );
}
