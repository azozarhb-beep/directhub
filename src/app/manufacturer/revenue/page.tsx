'use client';

export const dynamic = 'force-dynamic';

import ManufacturerModuleRoute from '@/components/manufacturer/ManufacturerModuleRoute';

export default function ManufacturerRevenuePage() {
  return <ManufacturerModuleRoute localTab="finance" internationalKey="finance" />;
}
