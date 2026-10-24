'use client';

export const dynamic = 'force-dynamic';

import FactoryModuleView from '@/components/manufacturer/FactoryModuleView';
import FinancialRouteGuard from '@/components/manufacturer/FinancialRouteGuard';

export default function ManufacturerBankAccountsPage() {
  return (
    <FinancialRouteGuard>
      <FactoryModuleView moduleKey="bank-accounts" />
    </FinancialRouteGuard>
  );
}
