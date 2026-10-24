'use client';

export const dynamic = 'force-dynamic';

import ManufacturerModuleRoute from '@/components/manufacturer/ManufacturerModuleRoute';

export default function ManufacturerProductionLinesPage() {
  return <ManufacturerModuleRoute localTab="production" internationalKey="production" />;
}
