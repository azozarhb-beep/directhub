'use client';

import React from 'react';
import Link from 'next/link';
import AppLogo from '@/components/ui/AppLogo';
import { useLanguage } from '@/contexts/LanguageContext';
import { getIntlRoomStrings } from '@/lib/internationalRoomI18n';

interface FactoryRoomPageShellProps {
  title: string;
  backHref?: string;
  children: React.ReactNode;
}

export default function FactoryRoomPageShell({
  title,
  backHref = '/manufacturer/international-dashboard',
  children,
}: FactoryRoomPageShellProps) {
  const { dir, language } = useLanguage();
  const s = getIntlRoomStrings(language);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100" dir={dir}>
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40">
        <div className="max-w-screen-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <AppLogo className="h-8 w-auto" />
            <div className="hidden sm:block w-px h-6 bg-slate-700" />
            <h1 className="text-base sm:text-lg font-bold text-white truncate">{title}</h1>
          </div>
          <Link
            href={backHref}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-semibold shadow transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
          >
            {s.backToControlRoom}
          </Link>
        </div>
      </header>
      <main className="max-w-screen-2xl mx-auto px-4 py-6">
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">{children}</div>
      </main>
    </div>
  );
}
