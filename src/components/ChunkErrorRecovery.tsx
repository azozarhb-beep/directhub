'use client';

import { useEffect } from 'react';

const RELOAD_KEY = 'dh_chunk_reload_at';
const RELOAD_WINDOW_MS = 30000;

function isChunkError(value: unknown): boolean {
  if (!value) return false;
  const err = value as { name?: string; message?: string };
  const text = `${err?.name || ''} ${err?.message || String(value)}`;
  return /ChunkLoadError|Loading chunk [\w/-]+ failed|Loading CSS chunk/i.test(text);
}

function reloadOnce() {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || '0');
    if (Date.now() - last < RELOAD_WINDOW_MS) return;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    // sessionStorage unavailable — fall through to a single reload attempt
  }
  window.location.reload();
}

export default function ChunkErrorRecovery() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      if (isChunkError(event.error) || isChunkError(event.message)) reloadOnce();
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      if (isChunkError(event.reason)) reloadOnce();
    };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  return null;
}
