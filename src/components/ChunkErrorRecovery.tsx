'use client';

import { useEffect } from 'react';

const RELOAD_KEY = 'dh_chunk_reload_at';
const RELOAD_COUNT_KEY = 'dh_chunk_reload_count';
const RELOAD_WINDOW_MS = 3000;
const MAX_RELOADS = 3;

function isChunkError(value: unknown): boolean {
  if (!value) return false;
  const err = value as { name?: string; message?: string };
  const text = `${err?.name || ''} ${err?.message || String(value)}`;
  return /ChunkLoadError|Loading chunk [^\s]+ failed|Loading CSS chunk|timeout: [^\s]*\/_next\/static\/|Failed to fetch dynamically imported module|__webpack_modules__\[[^\]]*\] is not a function|originalFactory\.call|Cannot read properties of undefined \(reading 'call'\)/i.test(
    text
  );
}

function isNextChunkUrl(url: string | undefined | null): boolean {
  return !!url && /\/_next\/static\/(chunks|css)\//.test(url);
}

// The global-error chunk is only needed once a fatal render error occurs.
// A transient failure to load it (dev recompilation, preview proxy hiccup)
// must not trigger a full page reload nor consume the reload budget.
function isGlobalErrorChunk(value: unknown): boolean {
  if (!value) return false;
  const err = value as { message?: string; request?: string };
  const text = `${err?.message || ''} ${err?.request || ''} ${typeof value === 'string' ? value : ''}`;
  return /app\/global-error/i.test(text);
}

function reloadOnce() {
  try {
    const now = Date.now();
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || '0');
    let count = Number(sessionStorage.getItem(RELOAD_COUNT_KEY) || '0');
    if (now - last > 60000) count = 0;
    if (now - last < RELOAD_WINDOW_MS) return;
    if (count >= MAX_RELOADS) return;
    sessionStorage.setItem(RELOAD_KEY, String(now));
    sessionStorage.setItem(RELOAD_COUNT_KEY, String(count + 1));
  } catch {
    // sessionStorage unavailable — fall through to a single reload attempt
  }
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('_cb', String(Date.now()));
    window.location.replace(url.toString());
  } catch {
    window.location.reload();
  }
}

export default function ChunkErrorRecovery() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      if (isGlobalErrorChunk(event.error) || isGlobalErrorChunk(event.message)) {
        event.preventDefault();
        return;
      }
      if (isChunkError(event.error) || isChunkError(event.message)) reloadOnce();
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      if (isGlobalErrorChunk(event.reason)) {
        event.preventDefault();
        return;
      }
      if (isChunkError(event.reason)) reloadOnce();
    };
    // Script/link load failures do not bubble; capture them to detect stale chunks.
    const onResourceError = (event: Event) => {
      const target = event.target as (HTMLScriptElement & HTMLLinkElement) | null;
      if (!target || target === (window as unknown as EventTarget)) return;
      const src = target.src || target.href;
      if (/app\/global-error/i.test(src || '')) return;
      if (isNextChunkUrl(src)) reloadOnce();
    };
    window.addEventListener('error', onError);
    window.addEventListener('error', onResourceError, true);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('error', onResourceError, true);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  return null;
}
