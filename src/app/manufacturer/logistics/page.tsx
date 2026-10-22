'use client';

export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import ManufacturerModuleRoute from '@/components/manufacturer/ManufacturerModuleRoute';

function LogisticsRoute() {
  const params = useSearchParams();
  const view = params?.get('view') ?? undefined;
  return <ManufacturerModuleRoute localTab="seller_fulfillment" view={view} internationalKey="logistics" />;
}

export default function ManufacturerLogisticsPage() {
  return (
    <Suspense fallback={null}>
      <LogisticsRoute />
    </Suspense>
  );
}
