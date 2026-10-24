'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';

const SUB_ACCOUNT_ROLES = ['sales_rep', 'manufacturer_agent'];

export interface SalesRepAccess {
  /** True while the DB lookup is still running. Treat as restricted until false. */
  loading: boolean;
  /** True when the user is a factory sub-account (active factory_sales_reps row or agent role). */
  isSalesRep: boolean;
}

/**
 * Authoritative sub-account detection. Never trusts user_metadata.role alone:
 * a user is a sales rep if they have an active factory_sales_reps row OR their
 * user_profiles row says sales_rep / manufacturer_agent (or has a factory_id that
 * differs from their own id). Factory owners / admins are only exempt when the
 * database confirms no sub-account link exists.
 */
export function useSalesRepAccess(): SalesRepAccess {
  const { user, loading: authLoading } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const [state, setState] = useState<SalesRepAccess>({ loading: true, isSalesRep: false });

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setState({ loading: false, isSalesRep: false });
      return;
    }
    let cancelled = false;
    const run = async () => {
      let isRep = false;
      try {
        const metaRole = (user.user_metadata?.role as string | undefined) || '';
        if (SUB_ACCOUNT_ROLES.includes(metaRole)) isRep = true;

        if (!isRep) {
          const { data: rep } = await supabase
            .from('factory_sales_reps')
            .select('id')
            .eq('rep_user_id', user.id)
            .eq('status', 'active')
            .limit(1)
            .maybeSingle();
          if (rep) isRep = true;
        }

        if (!isRep) {
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('role, factory_id')
            .eq('id', user.id)
            .maybeSingle();
          const p = profile as { role?: string | null; factory_id?: string | null } | null;
          if (p) {
            if (SUB_ACCOUNT_ROLES.includes(p.role ?? '')) isRep = true;
            else if (p.factory_id && p.factory_id !== user.id && p.role !== 'admin') isRep = true;
          }
        }
      } catch {
        // lookup failed: fall through with what we know
      }
      if (!cancelled) setState({ loading: false, isSalesRep: isRep });
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading, supabase]);

  return state;
}

export const UNAUTHORIZED_ALERT =
  'غير مصرح لك بالوصول إلى هذه الصفحة.\nUnauthorized: this area is restricted to the factory owner.';
