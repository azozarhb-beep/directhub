'use client';

export const dynamic = 'force-dynamic';

import ManufacturerModuleRoute from '@/components/manufacturer/ManufacturerModuleRoute';

export default function ManufacturerMessagesPage() {
  return <ManufacturerModuleRoute localTab="admin_messaging" internationalKey="messages" />;
}
