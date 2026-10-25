'use client';

export const dynamic = 'force-dynamic';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { persistActiveRole, readActiveRole } from '@/lib/roleCookies';
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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <div className="sticky top-14 z-40 bg-card/95 backdrop-blur-md border-b border-border/60 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-2 sm:py-0 sm:h-14 flex items-center gap-3">
          <Link
            href="/supplier"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary/10 text-primary text-xs sm:text-sm font-bold hover:bg-primary/20 active:scale-95 transition-all whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span aria-hidden="true">→</span>
            <span>رجوع إلى لوحة التحكم</span>
          </Link>
          <h1 className="flex-1 min-w-0 text-sm sm:text-lg font-black text-foreground truncate">
            إعدادات وتوثيق المورد
          </h1>
        </div>
      </div>
      <main className="max-w-3xl mx-auto px-4 md:px-6 py-6">
        <SupplierSettingsPanel userId={user?.id} />
      </main>
    </div>
  );
}
