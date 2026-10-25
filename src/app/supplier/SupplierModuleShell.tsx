'use client';

import React from 'react';
import Link from 'next/link';
import SupplierTopBar from './SupplierTopBar';

interface SupplierModuleShellProps {
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

/** Top bar + sticky sub-header for /supplier sub-pages. The back link always returns to /supplier. */
export default function SupplierModuleShell({ title, actions, children }: SupplierModuleShellProps) {
  return (
    <div className="min-h-screen bg-slate-950" dir="rtl">
      <SupplierTopBar />
      <div className="sticky top-14 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-2 sm:py-0 sm:h-14 flex items-center gap-2 sm:gap-3 flex-wrap">
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/supplier"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-cyan-500/10 text-cyan-300 text-xs sm:text-sm font-bold hover:bg-cyan-500/20 active:scale-95 transition-all whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              <span aria-hidden="true">→</span>
              <span>رجوع إلى لوحة التحكم</span>
            </Link>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-slate-800 border border-slate-700 text-slate-200 text-xs sm:text-sm font-bold hover:bg-slate-700 active:scale-95 transition-all whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              <span aria-hidden="true">🏪</span>
              <span>العودة للمتجر</span>
            </Link>
          </div>
          <h1 className="flex-1 min-w-[8rem] text-sm sm:text-lg font-black text-white truncate">{title}</h1>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>
      </div>
      <main className="max-w-6xl mx-auto px-4 md:px-6 pt-8 pb-6 scroll-mt-32">{children}</main>
    </div>
  );
}
