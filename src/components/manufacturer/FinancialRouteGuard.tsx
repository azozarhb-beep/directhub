'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';

const BLOCKED_ROLES = ['sales_rep', 'manufacturer_agent'];

interface FinancialRouteGuardProps {
  children: React.ReactNode;
}

/**
 * Blocks sub-account agents (sales_rep / manufacturer_agent) from financial routes.
 * Redirects immediately to /manufacturer with an unauthorized alert.
 */
export default function FinancialRouteGuard({ children }: FinancialRouteGuardProps) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setAllowed(true);
      return;
    }
    let cancelled = false;
    const check = async () => {
      const metaRole = (user.user_metadata?.role as string | undefined) || '';
      let blocked = BLOCKED_ROLES.includes(metaRole);
      if (!blocked) {
        try {
          const supabase = createClient();
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('role, factory_id')
            .eq('id', user.id)
            .maybeSingle();
          if (profile && BLOCKED_ROLES.includes(profile.role as string)) blocked = true;
          if (!blocked && profile?.role !== 'manufacturer' && profile?.role !== 'admin') {
            const { data: rep } = await supabase
              .from('factory_sales_reps')
              .select('id')
              .eq('rep_user_id', user.id)
              .eq('status', 'active')
              .maybeSingle();
            if (rep) blocked = true;
          }
        } catch {
          // fall through: not blocked if lookup fails
        }
      }
      if (cancelled) return;
      if (blocked) {
        alert('غير مصرح لك بالوصول إلى الصفحات المالية.\nUnauthorized: financial pages are restricted.');
        router.replace('/manufacturer');
      } else {
        setAllowed(true);
      }
    };
    void check();
    return () => {
      cancelled = true;
    };
  }, [user, loading, router]);

  if (!allowed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}
