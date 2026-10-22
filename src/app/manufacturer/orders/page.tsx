'use client';

export const dynamic = 'force-dynamic';

import ManufacturerModuleRoute from '@/components/manufacturer/ManufacturerModuleRoute';

export default function ManufacturerOrdersPage() {
  return <ManufacturerModuleRoute localTab="factory_orders" internationalKey="orders" />;
}
