'use client';

export const dynamic = 'force-dynamic';

import ManufacturerModuleRoute from '@/components/manufacturer/ManufacturerModuleRoute';

export default function ManufacturerRawMaterialsPage() {
  return <ManufacturerModuleRoute localTab="inventory" internationalKey="inventory" />;
}
