'use client';

import { createBrowserClient } from '@supabase/ssr';

// ── Singleton stored on window to survive Next.js module hot-reloads ─────────
// A plain module-level variable is reset every time the module is re-evaluated
// (e.g. HMR, navigation). Storing on window ensures only ONE client ever exists
// per browser tab, which prevents two clients simultaneously trying to refresh
// the same token (the root cause of refresh_token_already_used).
declare global {
  interface Window {
    __supabase_client__: ReturnType<typeof createBrowserClient> | undefined;
  }
}

export function createClient() {
  // SSR / server context — create a fresh client (no singleton needed server-side)
  if (typeof window === 'undefined') {
    return createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => [],
          setAll: () => {},
        },
      }
    );
  }

  // Browser: return the window-level singleton so it survives module re-evaluation
  if (window.__supabase_client__) return window.__supabase_client__;

  window.__supabase_client__ = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        detectSessionInUrl: true,
        persistSession: true,
        autoRefreshToken: true,
        // Do NOT set a custom `lock` here.
        // navigator.locks (Web Locks API) causes permanent deadlocks in Next.js
        // due to React Strict Mode double-mount, HMR teardown, and Android Chrome
        // not releasing locks from previous sessions.
        // Supabase uses processLock by default, which serializes within a single
        // tab without the Web Locks API — this is the correct behavior.
      },
    }
  );

  return window.__supabase_client__;
}
