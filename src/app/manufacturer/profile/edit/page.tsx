'use client';

export const dynamic = 'force-dynamic';

import SupplierProfilePage from '@/app/my-account/supplier-profile/page';

export default function ManufacturerProfileEditPage() {
  return <SupplierProfilePage backPath="/manufacturer/settings" />;
}
