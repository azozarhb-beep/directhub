'use client';

export const dynamic = 'force-dynamic';

import ManufacturerModuleRoute from '@/components/manufacturer/ManufacturerModuleRoute';
import FinancialRouteGuard from '@/components/manufacturer/FinancialRouteGuard';

export default function ManufacturerInvoicingPage() {
  return (
    <FinancialRouteGuard>
      <ManufacturerModuleRoute localTab="invoicing" internationalKey="finance" />
    </FinancialRouteGuard>
  );
}
