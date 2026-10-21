'use client';

export const dynamic = 'force-dynamic';

import FactoryModuleView from '@/components/manufacturer/FactoryModuleView';

export default function ManufacturerProductsPage() {
  return <FactoryModuleView moduleKey="products" />;
}
