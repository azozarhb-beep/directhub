'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import {
  resolveManufacturerRoomForUser,
  INTERNATIONAL_FACTORY_ROOM_PATH,
} from '@/lib/roomIsolation';

export type FactoryRoomStatus = 'loading' | 'local' | 'international';

/**
 * Resolves whether the signed-in manufacturer belongs to the local or the
 * international factory room. Mirrors the guard used by /manufacturer/dashboard.
 * Redirects unauthenticated visitors to the manufacturer login.
 */
export function useFactoryRoom(): FactoryRoomStatus {
  const { user, loading } = useAuth();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [status, setStatus] = useState<FactoryRoomStatus>('loading');

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/manufacturer/login');
      return;
    }
    let cancelled = false;
    const run = async () => {
      const impersonating =
        typeof window !== 'undefined' && !!localStorage.getItem('impersonated_factory_id');
      if (impersonating) {
        if (!cancelled) setStatus('local');
        return;
      }
      const room = await resolveManufacturerRoomForUser(supabase, user.id, user.email);
      if (!cancelled) setStatus(room === INTERNATIONAL_FACTORY_ROOM_PATH ? 'international' : 'local');
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [user, loading, router, supabase]);

  return status;
}

export function FactoryRoomSpinner() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
