'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function AdminDispatcherPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace('/login');
      return;
    }

    const role = (user?.user_metadata?.role || user?.app_metadata?.role || '') as string;
    const staffRole = (user?.user_metadata?.staff_role || user?.app_metadata?.staff_role || '') as string;

    if (role !== 'admin') {
      router.replace('/');
      return;
    }

    switch (staffRole) {
      case 'field_ops_manager':
      case 'field_agent':
        router.replace('/admin/field-ops');
        break;
      case 'logistics_officer':
        router.replace('/admin/logistics');
        break;
      case 'finance_auditor':
        router.replace('/admin/finance');
        break;
      case 'deals_manager':
        router.replace('/admin/products');
        break;
      default:
        router.replace('/admin/control-room');
        break;
    }
  }, [user, loading, router]);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-3">
      <div className="w-9 h-9 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      <span className="text-xs font-semibold text-slate-400">جاري توجيه الصلاحيات...</span>
    </div>
  );
}
