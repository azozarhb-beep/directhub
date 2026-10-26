'use client';

export const dynamic = 'force-dynamic';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { persistActiveRole, readActiveRole } from '@/lib/roleCookies';
import SupplierModuleShell from '../SupplierModuleShell';
import SupplierSettingsPanel from './SupplierSettingsPanel';

export default function SupplierSettingsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router?.replace('/login?redirect=/supplier/settings');
      return;
    }
    if (readActiveRole() !== 'supplier') persistActiveRole('supplier');
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="w-8 h-8 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <SupplierModuleShell title="إعدادات وتوثيق المورد" hideTitle>
      <div className="max-w-3xl mx-auto">
        <SupplierSettingsPanel userId={user?.id} />
      </div>
    </SupplierModuleShell>
  );
}
