'use client';

import React, { useEffect } from 'react';

const CHUNK_ERROR_RE =
  /ChunkLoadError|Loading chunk .* failed|Loading CSS chunk|timeout: .*\/_next\/static\/chunks|__webpack_modules__\[[^\]]*\] is not a function|reading 'call'/i;

function isChunkErr(error: Error | undefined): boolean {
  return CHUNK_ERROR_RE.test(`${error?.name || ''} ${error?.message || ''}`);
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Global Error Boundary]', error);
    if (!isChunkErr(error)) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const now = Date.now();
      const last = Number(sessionStorage.getItem('dh_chunk_reload_at') || '0');
      let count = Number(sessionStorage.getItem('dh_ge_reload_count') || '0');
      if (now - last > 60000) count = 0;
      if (count < 3) {
        sessionStorage.setItem('dh_chunk_reload_at', String(now));
        sessionStorage.setItem('dh_ge_reload_count', String(count + 1));
        timer = setTimeout(() => window.location.reload(), 1000 + count * 2000);
      }
    } catch {
      timer = setTimeout(() => window.location.reload(), 1500);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [error]);

  const handleRetry = () => {
    if (isChunkErr(error)) {
      try {
        sessionStorage.removeItem('dh_ge_reload_count');
      } catch {
        // ignore
      }
      window.location.reload();
      return;
    }
    reset();
  };

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily:
            'Plus Jakarta Sans, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
          background: '#f8fafc',
          color: '#0f172a',
          padding: 16,
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: 420, width: '100%' }}>
          <div
            style={{
              width: 64,
              height: 64,
              margin: '0 auto 24px',
              borderRadius: 16,
              background: '#fff7ed',
              border: '1px solid #fed7aa',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 28,
            }}
            aria-hidden="true"
          >
            !
          </div>

          <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 8px' }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: 14, color: '#64748b', margin: '0 0 32px', lineHeight: 1.5 }}>
            DirectHub could not load this screen. Try again, or go back to the home page.
          </p>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              alignItems: 'center',
            }}
          >
            <button
              type="button"
              onClick={handleRetry}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                background: '#ea580c',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '12px 24px',
                fontWeight: 600,
                fontSize: 14,
                cursor: 'pointer',
                minWidth: 160,
              }}
            >
              Try again
            </button>

            <a
              href="/"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                background: '#fff',
                color: '#0f172a',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                padding: '12px 24px',
                fontWeight: 600,
                fontSize: 14,
                textDecoration: 'none',
                minWidth: 160,
              }}
            >
              Back to Home
            </a>
          </div>

          {error?.digest ? (
            <p
              style={{
                marginTop: 24,
                fontSize: 11,
                color: '#94a3b8',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              }}
            >
              Ref: {error.digest}
            </p>
          ) : null}
        </div>
      </body>
    </html>
  );
}
