'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

function getOrCreateSessionId(): string {
  try {
    let sid = sessionStorage.getItem('dh_sid');
    if (!sid) {
      sid = Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem('dh_sid', sid);
    }
    return sid;
  } catch {
    return Math.random().toString(36).slice(2);
  }
}

export default function VisitorTracker() {
  const pathname = usePathname();
  const { user } = useAuth();
  const lastTracked = useRef<string>('');

  useEffect(() => {
    // Skip admin and API routes
    if (pathname.startsWith('/admin') || pathname.startsWith('/api')) return;
    // Skip tracking for admin/manager users — their browsing must not pollute visitor stats
    const userRole = user?.user_metadata?.role;
    if (userRole === 'admin' || userRole === 'manager') return;
    // Avoid duplicate tracking for same path
    if (lastTracked.current === pathname) return;
    lastTracked.current = pathname;

    const sessionId = getOrCreateSessionId();
    const referrer = typeof document !== 'undefined' ? document.referrer : '';

    fetch('/api/track-visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId,
        page_path: pathname,
        referrer: referrer || undefined,
        user_id: user?.id || undefined,
      }),
    }).catch(() => { /* silent */ });
  }, [pathname, user?.id]);

  return null;
}
