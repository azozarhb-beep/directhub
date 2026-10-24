'use client';

import React, { Component, ReactNode, useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

// ── Safe dynamic loader that catches ChunkLoadErrors at import time ──────────
function useSafeComponent(loader: () => Promise<{ default: React.ComponentType }>) {
  const [Comp, setComp] = useState<React.ComponentType | null>(null);

  useEffect(() => {
    let cancelled = false;
    loader()
      .then((mod) => {
        if (!cancelled) setComp(() => mod.default);
      })
      .catch((err: Error) => {
        const isChunk =
          err?.name === 'ChunkLoadError' || err?.message?.includes('Loading chunk') ||
          err?.message?.includes('ChunkLoadError') ||
          err?.message?.includes('failed to fetch dynamically imported module');

        if (isChunk && typeof window !== 'undefined') {
          const reloadKey = 'chunk_reload_ts';
          const lastReload = sessionStorage.getItem(reloadKey);
          const now = Date.now();
          if (!lastReload || now - parseInt(lastReload, 10) > 5 * 60 * 1000) {
            sessionStorage.setItem(reloadKey, String(now));
            const url = new URL(window.location.href);
            url.searchParams.set('_cb', String(now));
            window.location.replace(url.toString());
          }
        }
        // Silently fail — component simply won't render
        if (!cancelled) setComp(null);
      });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return Comp;
}

// ── Error boundary for any runtime errors inside the loaded components ───────
interface BoundaryState { hasError: boolean }

class ChunkErrorBoundary extends Component<{ children: ReactNode }, BoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): Partial<BoundaryState> {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.warn('[AssistantsLoader] Runtime error in assistant:', error.message);
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

// ── Lazy wrappers ─────────────────────────────────────────────────────────────
function SafeDirectHubAssistant() {
  const Comp = useSafeComponent(() => import('@/components/DirectHubAssistant'));
  if (!Comp) return null;
  return (
    <ChunkErrorBoundary>
      <Comp />
    </ChunkErrorBoundary>
  );
}

function SafeAmalPartnerAssistant() {
  const Comp = useSafeComponent(() => import('@/components/AmalPartnerAssistant'));
  if (!Comp) return null;
  return (
    <ChunkErrorBoundary>
      <Comp />
    </ChunkErrorBoundary>
  );
}

function SafePWAInstallBanner() {
  const Comp = useSafeComponent(() => import('@/components/PWAInstallBanner'));
  if (!Comp) return null;
  return (
    <ChunkErrorBoundary>
      <Comp />
    </ChunkErrorBoundary>
  );
}

function SafePushSubscriptionManager() {
  const Comp = useSafeComponent(() => import('@/components/PushSubscriptionManager'));
  if (!Comp) return null;
  return (
    <ChunkErrorBoundary>
      <Comp />
    </ChunkErrorBoundary>
  );
}

function SafeVisitorTracker() {
  const Comp = useSafeComponent(() => import('@/components/VisitorTracker'));
  if (!Comp) return null;
  return (
    <ChunkErrorBoundary>
      <Comp />
    </ChunkErrorBoundary>
  );
}

export default function AssistantsLoader() {
  return (
    <>
      <SafeVisitorTracker />
      <SafePushSubscriptionManager />
      <SafePWAInstallBanner />
      <SafeDirectHubAssistant />
      <SafeAmalPartnerAssistant />
    </>
  );
}
