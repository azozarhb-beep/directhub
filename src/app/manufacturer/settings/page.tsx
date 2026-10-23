'use client';

export const dynamic = 'force-dynamic';

import ManufacturerModuleRoute from '@/components/manufacturer/ManufacturerModuleRoute';

export default function ManufacturerSettingsPage() {
  return <ManufacturerModuleRoute localTab="factory_settings" />;
}
