'use client';

export const dynamic = 'force-dynamic';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import AppLogo from '@/components/ui/AppLogo';
import FactoryControlHub from '@/components/manufacturer/FactoryControlHub';
import { Globe } from 'lucide-react';

export default function ManufacturerHubPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

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
    <div className="min-h-screen bg-slate-950 text-slate-100" dir="rtl">
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40">
        <div className="max-w-screen-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <AppLogo className="h-8 w-auto" />
          <div className="hidden sm:block w-px h-6 bg-slate-700" />
          <div className="flex items-center gap-2 min-w-0">
            <Globe size={16} className="text-cyan-300 flex-shrink-0" />
            <h1 className="text-base sm:text-lg font-bold text-white truncate">مركز تحكم المصنع</h1>
          </div>
        </div>
      </header>
      <main className="max-w-screen-2xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-slate-700/60" />
          <span className="text-xs text-slate-400 font-medium px-3 py-1 bg-slate-800 rounded-full border border-slate-700 whitespace-nowrap">
            🏭 أدوات إدارة المصنع
          </span>
          <div className="flex-1 h-px bg-slate-700/60" />
        </div>
        <FactoryControlHub userId={user?.id} />
      </main>
    </div>
  );
}
