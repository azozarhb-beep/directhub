'use client';

export const dynamic = 'force-dynamic';

import FactoryModuleView from '@/components/manufacturer/FactoryModuleView';

export default function ManufacturerDocumentsPage() {
  return <FactoryModuleView moduleKey="documents" />;
}
