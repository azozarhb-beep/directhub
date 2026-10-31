'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import AgentOrderTrackingPanel from '@/app/agent/dashboard/AgentOrderTrackingPanel';

export default function AgentOrdersPage() {
  const router = useRouter();
  const { user, loading } = useAuth() as { user: { id: string } | null; loading?: boolean };

  useEffect(() => {
    if (loading === false && !user) router.replace('/agent/login');
  }, [user, loading, router]);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center" dir="rtl">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-6 pb-28" dir="rtl">
      <Link
        href="/agent/dashboard"
        className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground mb-4"
      >
        → العودة للوحة المندوب
      </Link>
      <AgentOrderTrackingPanel userId={user.id} />
    </main>
  );
}
