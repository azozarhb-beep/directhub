'use client';

import React, { useEffect, useState } from 'react';
import { getChatMediaSignedUrl, openChatMedia } from '@/lib/chatMedia';

function useSignedSrc(src: string | null | undefined): string {
  const [resolved, setResolved] = useState('');
  useEffect(() => {
    let active = true;
    if (!src) {
      setResolved('');
      return;
    }
    if (src.startsWith('blob:') || src.startsWith('data:')) {
      setResolved(src);
      return;
    }
    getChatMediaSignedUrl(src).then((u) => {
      if (active) setResolved(u || '');
    });
    return () => {
      active = false;
    };
  }, [src]);
  return resolved;
}

interface SignedChatImageProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  onClickOpen?: boolean;
}

/** Renders an <img> from a private chat bucket by resolving an authenticated signed URL. */
export function SignedChatImage({ src, alt, className, onClickOpen = false }: SignedChatImageProps) {
  const resolved = useSignedSrc(src);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (failed || !resolved) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={resolved}
      alt={alt}
      className={className}
      onClick={onClickOpen ? () => void openChatMedia(src) : undefined}
      onError={() => setFailed(true)}
    />
  );
}

interface SignedChatVideoProps {
  src: string | null | undefined;
  className?: string;
}

/** Renders a <video> from a private chat bucket using an authenticated signed URL. */
export function SignedChatVideo({ src, className }: SignedChatVideoProps) {
  const resolved = useSignedSrc(src);
  if (!resolved) return null;
  return <video src={resolved} controls className={className} preload="metadata" />;
}

interface SignedChatLinkProps {
  href: string | null | undefined;
  className?: string;
  children: React.ReactNode;
}

/** Opens a private chat attachment (PDF/file) via a short-lived signed URL. */
export function SignedChatLink({ href, className, children }: SignedChatLinkProps) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      className={className}
      onClick={async (e) => {
        e.preventDefault();
        if (busy) return;
        setBusy(true);
        try {
          const ok = await openChatMedia(href);
          if (!ok && typeof window !== 'undefined') {
            window.alert('تعذر فتح المرفق: انتهت صلاحية الرابط أو لا تملك صلاحية.');
          }
        } finally {
          setBusy(false);
        }
      }}
    >
      {children}
    </button>
  );
}
