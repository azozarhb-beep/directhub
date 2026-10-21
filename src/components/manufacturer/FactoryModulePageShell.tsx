'use client';

import React from 'react';
import Link from 'next/link';
import AppLogo from '@/components/ui/AppLogo';
import { FACTORY_BACK_LABEL, FACTORY_HUB_PATH } from '@/components/manufacturer/factoryModules';

interface FactoryModulePageShellProps {
  title: string;
  icon?: string;
  actionLabel?: string;
  onAction?: () => void;
  children: React.ReactNode;
}

export default function FactoryModulePageShell({
  title,
  icon,
  actionLabel,
  onAction,
  children,
}: FactoryModulePageShellProps) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100" dir="rtl">
      <header className="bg-slate-900/95 backdrop-blur border-b border-slate-800 sticky top-0 z-40">
        <div className="max-w-screen-2xl mx-auto px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href={FACTORY_HUB_PATH}
              className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs sm:text-sm font-semibold shadow transition-colors whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
            >
              {FACTORY_BACK_LABEL}
            </Link>
            <div className="hidden md:block w-px h-6 bg-slate-700" />
            <AppLogo className="h-7 w-auto hidden md:block" />
          </div>
          <div className="flex items-center justify-between gap-3 min-w-0">
            <h1 className="text-base sm:text-lg font-bold text-white truncate">
              {icon ? <span className="me-2" aria-hidden="true">{icon}</span> : null}
              {title}
            </h1>
            {actionLabel ? (
              <button
                type="button"
                onClick={onAction}
                className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs sm:text-sm font-semibold shadow transition-all whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
              >
                {actionLabel}
              </button>
            ) : null}
          </div>
        </div>
      </header>
      <main className="max-w-screen-2xl mx-auto px-4 py-6">
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">{children}</div>
      </main>
    </div>
  );
}
