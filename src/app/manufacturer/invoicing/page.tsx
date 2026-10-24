'use client';

export const dynamic = 'force-dynamic';

import ManufacturerModuleRoute from '@/components/manufacturer/ManufacturerModuleRoute';

export default function ManufacturerInvoicingPage() {
  return <ManufacturerModuleRoute localTab="invoicing" internationalKey="finance" />;
}
