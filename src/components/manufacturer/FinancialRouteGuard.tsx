'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSalesRepAccess, UNAUTHORIZED_ALERT } from '@/components/manufacturer/useSalesRepAccess';

interface FinancialRouteGuardProps {
  children: React.ReactNode;
}

/**
 * Blocks factory sub-accounts (active factory_sales_reps / sales_rep / manufacturer_agent)
 * from restricted routes. Children are NEVER rendered until the database check confirms
 * the user is not a sub-account. Redirects to /manufacturer with an unauthorized alert.
 */
export default function FinancialRouteGuard({ children }: FinancialRouteGuardProps) {
  const router = useRouter();
  const { loading, isSalesRep } = useSalesRepAccess();

  useEffect(() => {
    if (loading) return;
    if (isSalesRep) {
      alert(UNAUTHORIZED_ALERT);
      router.replace('/manufacturer');
    }
  }, [loading, isSalesRep, router]);

  if (loading || isSalesRep) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}
