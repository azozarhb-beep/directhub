'use client';

export const dynamic = 'force-dynamic';

import ManufacturerModuleRoute from '@/components/manufacturer/ManufacturerModuleRoute';

export default function ManufacturerProductsPage() {
  return <ManufacturerModuleRoute localTab="products" internationalKey="products" />;
}
