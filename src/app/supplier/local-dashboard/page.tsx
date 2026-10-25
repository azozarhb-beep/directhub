'use client';

export const dynamic = 'force-dynamic';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Legacy route — the supplier room now lives at /supplier (Icon Card Grid). */
export default function LegacySupplierDashboardRedirect() {
  const router = useRouter();

  useEffect(() => {
    router?.replace('/supplier');
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
