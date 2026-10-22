'use client';

export const dynamic = 'force-dynamic';

import ManufacturerModuleRoute from '@/components/manufacturer/ManufacturerModuleRoute';

export default function ManufacturerInventoryPage() {
  return <ManufacturerModuleRoute localTab="inventory" internationalKey="inventory" />;
}
