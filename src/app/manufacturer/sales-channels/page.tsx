'use client';

export const dynamic = 'force-dynamic';

import ManufacturerModuleRoute from '@/components/manufacturer/ManufacturerModuleRoute';

export default function ManufacturerSalesChannelsPage() {
  return <ManufacturerModuleRoute localTab="all_sales" />;
}
