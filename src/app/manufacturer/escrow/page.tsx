'use client';

export const dynamic = 'force-dynamic';

import ManufacturerModuleRoute from '@/components/manufacturer/ManufacturerModuleRoute';

export default function ManufacturerEscrowPage() {
  return <ManufacturerModuleRoute localTab="escrow_orders" internationalKey="escrow" />;
}
