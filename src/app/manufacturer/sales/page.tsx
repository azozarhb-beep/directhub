'use client';

export const dynamic = 'force-dynamic';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { getIntlRoomStrings } from '@/lib/internationalRoomI18n';
import AllSalesMethodsPanel from '@/components/AllSalesMethodsPanel';
import FactoryRoomPageShell from '@/components/manufacturer/FactoryRoomPageShell';

export default function ManufacturerSalesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { language } = useLanguage();
  const s = getIntlRoomStrings(language);

  useEffect(() => {
    if (!loading && !user) router?.push('/manufacturer/login');
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <FactoryRoomPageShell title={s?.salesPageTitle}>
      <AllSalesMethodsPanel />
    </FactoryRoomPageShell>
  );
}
