'use client';

export const dynamic = 'force-dynamic';

import ManufacturerModuleRoute from '@/components/manufacturer/ManufacturerModuleRoute';

export default function ManufacturerDisputesPage() {
  return <ManufacturerModuleRoute localTab="disputes" internationalKey="messages" />;
}
