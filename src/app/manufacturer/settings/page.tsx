'use client';

export const dynamic = 'force-dynamic';

import ManufacturerModuleRoute from '@/components/manufacturer/ManufacturerModuleRoute';
import FinancialRouteGuard from '@/components/manufacturer/FinancialRouteGuard';

export default function ManufacturerSettingsPage() {
  return (
    <FinancialRouteGuard>
      <ManufacturerModuleRoute localTab="factory_settings" />
    </FinancialRouteGuard>
  );
}
