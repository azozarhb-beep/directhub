'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Icon from '@/components/ui/AppIcon';

interface OperationsShellProps {
  title: string;
  subtitle?: string;
  loading?: boolean;
  error?: string;
  onRefresh?: () => void;
  children: React.ReactNode;
}

export default function OperationsShell({ title, subtitle, loading, error, onRefresh, children }: OperationsShellProps) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const role = (user?.user_metadata?.role || user?.app_metadata?.role || '') as string;
  const staffRole = (user?.user_metadata?.staff_role || user?.app_metadata?.staff_role || '') as string;
  const canAccess = role === 'admin' || staffRole === 'FIELD_OPS_MANAGER';

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/login'); return; }
    if (!canAccess) router.push('/');
  }, [user, authLoading, canAccess, router]);

  if (authLoading || !user || !canAccess) {
    return (
      <div className="fixed inset-0 z-50 w-full h-[100dvh] bg-slate-950 text-white flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-slate-700 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 w-full h-[100dvh] bg-slate-950 text-white flex flex-col z-50 overflow-hidden" dir="rtl">
      <header className="sticky top-0 z-20 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-3 sm:px-5 py-3 flex flex-wrap items-center gap-2 sm:gap-3">
        <Link
          href="/admin/field-ops"
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-semibold transition-colors"
        >
          <span aria-hidden>←</span>
          <span>عودة إلى غرفة العمليات الرئيسية</span>
        </Link>
        <nav className="flex-1 min-w-0 text-xs sm:text-sm text-slate-400 truncate">
          <Link href="/admin/field-ops" className="hover:text-white">غرفة العمليات</Link>
          <span className="mx-1.5">/</span>
          <span className="text-white font-bold">{title}</span>
        </nav>
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={loading}
            title="تحديث"
            className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center disabled:opacity-50 transition-colors"
          >
            <Icon name="ArrowPathIcon" size={18} className={`text-white ${loading ? 'animate-spin' : ''}`} />
          </button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto p-3 sm:p-5 pb-24 space-y-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black">{title}</h1>
          {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
        </div>
        {error && <div className="bg-red-950/60 border border-red-800 text-red-200 text-xs rounded-xl p-3">{error}</div>}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-slate-700 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
