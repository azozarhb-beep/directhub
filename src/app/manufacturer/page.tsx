'use client';

export const dynamic = 'force-dynamic';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import AppLogo from '@/components/ui/AppLogo';
import FactoryControlHub from '@/components/manufacturer/FactoryControlHub';
import { Globe, TrendingUp, Ship, AlertTriangle } from 'lucide-react';

const STAT_CARDS = [
  { key: 'exports', href: '/manufacturer/analytics', label: 'حجم الصادرات', value: '$333K', sub: 'هذا الشهر', icon: TrendingUp, color: 'from-cyan-600 to-cyan-800' },
  { key: 'in_transit', href: '/manufacturer/logistics', label: 'الشحنات في الطريق', value: '1', sub: 'شحنة نشطة', icon: Ship, color: 'from-indigo-600 to-indigo-800' },
  { key: 'held', href: '/manufacturer/logistics', label: 'شحنات محتجزة', value: '1', sub: 'تحتاج مراجعة', icon: AlertTriangle, color: 'from-red-600 to-red-800' },
];

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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {STAT_CARDS?.map((card) => (
            <button
              type="button"
              key={card?.key}
              onClick={() => router?.push(card?.href)}
              className={`bg-gradient-to-br ${card?.color} rounded-xl p-4 border border-white/10 text-start w-full cursor-pointer transition-all duration-150 hover:scale-[1.02] hover:border-white/30 active:scale-95`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-white/70 text-xs mb-1">{card?.label}</p>
                  <p className="text-2xl font-bold text-white">{card?.value}</p>
                  <p className="text-white/50 text-xs mt-1">{card?.sub}</p>
                </div>
                <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center">
                  <card.icon size={18} className="text-white" />
                </div>
              </div>
            </button>
          ))}
        </div>
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
