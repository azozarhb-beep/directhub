'use client';

export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import ManufacturerModuleRoute from '@/components/manufacturer/ManufacturerModuleRoute';
import FinancialRouteGuard from '@/components/manufacturer/FinancialRouteGuard';

function FinanceRoute() {
  const params = useSearchParams();
  const view = params?.get('view') ?? undefined;
  return <ManufacturerModuleRoute localTab="financial_hub" view={view} internationalKey="finance" />;
}

export default function ManufacturerFinancePage() {
  return (
    <FinancialRouteGuard>
      <Suspense fallback={null}>
        <FinanceRoute />
      </Suspense>
    </FinancialRouteGuard>
  );
}
