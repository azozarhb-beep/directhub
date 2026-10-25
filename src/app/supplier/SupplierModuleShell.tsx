'use client';

import React from 'react';
import Link from 'next/link';

interface SupplierModuleShellProps {
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

/** Sticky header for /supplier sub-pages. The back link always returns to /supplier. */
export default function SupplierModuleShell({ title, actions, children }: SupplierModuleShellProps) {
  return (
    <div className="min-h-screen bg-slate-950" dir="rtl">
      <div className="sticky top-14 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-2 sm:py-0 sm:h-14 flex items-center gap-3 flex-wrap">
          <Link
            href="/supplier"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-cyan-500/10 text-cyan-300 text-xs sm:text-sm font-bold hover:bg-cyan-500/20 active:scale-95 transition-all whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          >
            <span aria-hidden="true">→</span>
            <span>رجوع إلى لوحة التحكم</span>
          </Link>
          <h1 className="flex-1 min-w-0 text-sm sm:text-lg font-black text-white truncate">{title}</h1>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>
      </div>
      <main className="max-w-6xl mx-auto px-4 md:px-6 py-6">{children}</main>
    </div>
  );
}
