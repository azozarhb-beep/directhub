'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';

const CHUNK_ERROR_RE =
  /ChunkLoadError|Loading chunk .* failed|__webpack_modules__\[[^\]]*\] is not a function|reading 'call'/i;

function isChunkLoadError(error: Error | undefined): boolean {
  return CHUNK_ERROR_RE.test(`${error?.name ?? ''} ${error?.message ?? ''}`);
}

function hardReload() {
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('_cb', String(Date.now()));
    window.location.replace(url.toString());
  } catch {
    window.location.reload();
  }
}

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[App Error Boundary]', error);
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (isChunkLoadError(error)) {
      try {
        const now = Date.now();
        const last = Number(sessionStorage.getItem('dh_chunk_reload_at') || '0');
        let count = Number(sessionStorage.getItem('dh_chunk_reload_count') || '0');
        if (now - last > 60000) count = 0;
        if (now - last > 3000 && count < 3) {
          sessionStorage.setItem('dh_chunk_reload_at', String(now));
          sessionStorage.setItem('dh_chunk_reload_count', String(count + 1));
          timer = setTimeout(() => hardReload(), 800 + count * 1500);
        }
      } catch {
        timer = setTimeout(() => hardReload(), 1200);
      }
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [error]);

  const handleRetry = () => {
    if (isChunkLoadError(error)) {
      try {
        sessionStorage.removeItem('dh_chunk_reload_at');
        sessionStorage.removeItem('dh_chunk_reload_count');
      } catch {
        // ignore
      }
      hardReload();
      return;
    }
    reset();
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="text-center max-w-md w-full">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-orange-50 border border-orange-200 flex items-center justify-center">
            <Icon name="ExclamationTriangleIcon" size={28} className="text-orange-500" />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-foreground mb-2">Something went wrong</h1>
        <p className="text-muted-foreground mb-8 text-sm leading-relaxed">
          This page hit an unexpected error. You can try again, or continue browsing DirectHub.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            type="button"
            onClick={handleRetry}
            className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-lg font-medium hover:bg-primary/90 transition-colors"
          >
            <Icon name="ArrowPathIcon" size={16} />
            Try again
          </button>

          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 border border-border bg-background text-foreground px-6 py-3 rounded-lg font-medium hover:bg-muted transition-colors"
          >
            <Icon name="HomeIcon" size={16} />
            Back to Home
          </Link>
        </div>

        {error?.digest ? (
          <p className="mt-6 text-[11px] text-muted-foreground/70 font-mono">Ref: {error.digest}</p>
        ) : null}
      </div>
    </div>
  );
}
