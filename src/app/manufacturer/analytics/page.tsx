'use client';

export const dynamic = 'force-dynamic';

import ManufacturerModuleRoute from '@/components/manufacturer/ManufacturerModuleRoute';

export default function ManufacturerAnalyticsPage() {
  return <ManufacturerModuleRoute localTab="analytics" internationalKey="analytics" />;
}
