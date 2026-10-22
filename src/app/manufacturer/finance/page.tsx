'use client';

export const dynamic = 'force-dynamic';

import ManufacturerModuleRoute from '@/components/manufacturer/ManufacturerModuleRoute';

export default function ManufacturerFinancePage() {
  return <ManufacturerModuleRoute localTab="financial_hub" internationalKey="finance" />;
}
