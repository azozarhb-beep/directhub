'use client';

import React, { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Global Error Boundary]', error);
    if (/ChunkLoadError|Loading chunk .* failed|__webpack_modules__\[[^\]]*\] is not a function|reading 'call'/i.test(`${error?.name} ${error?.message}`)) {
      try {
        const last = Number(sessionStorage.getItem('dh_chunk_reload_at') || '0');
        if (Date.now() - last > 10000) {
          sessionStorage.setItem('dh_chunk_reload_at', String(Date.now()));
          window.location.reload();
        }
      } catch {
        window.location.reload();
      }
    }
  }, [error]);

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
              onClick={() => reset()}
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
