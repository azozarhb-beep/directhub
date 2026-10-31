'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

interface DriverShellProps {
  title: string;
  subtitle?: string;
  backHref?: string;
  coordinationOrderId?: string;
  children: React.ReactNode;
}

export default function DriverShell({
  title,
  subtitle,
  backHref,
  coordinationOrderId,
  children,
}: DriverShellProps) {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50" dir="rtl">
        <p className="text-sm text-gray-500">جارٍ التحميل...</p>
      </div>
    );
  }

  const coordHref = coordinationOrderId
    ? `/logistics/coordination?id=${encodeURIComponent(coordinationOrderId)}`
    : '/logistics/coordination';

  return (
    <div className="min-h-screen bg-gray-50 pb-10" dir="rtl">
      <header className="sticky top-0 z-20 border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-md items-center gap-3 px-4 py-3">
          {backHref ? (
            <Link
              href={backHref}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-700"
              aria-label="رجوع"
            >
              →
            </Link>
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-100 text-lg">🚚</span>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-extrabold text-gray-900">{title}</h1>
            {subtitle ? <p className="truncate text-[11px] text-gray-500">{subtitle}</p> : null}
          </div>
          <Link
            href={coordHref}
            className="rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700"
          >
            💬 التنسيق
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-md space-y-4 px-4 py-4">{children}</main>
    </div>
  );
}
