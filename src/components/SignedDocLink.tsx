'use client';

import React, { useState } from 'react';
import { openFactoryDocument } from '@/lib/factoryDocuments';

interface SignedDocLinkProps {
  url: string | null | undefined;
  className?: string;
  children: React.ReactNode;
}

export default function SignedDocLink({ url, className, children }: SignedDocLinkProps) {
  const [busy, setBusy] = useState(false);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const ok = await openFactoryDocument(url);
      if (!ok && typeof window !== 'undefined') {
        window.alert('تعذر فتح المستند: ليس لديك صلاحية أو انتهت صلاحية الرابط.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <button type="button" onClick={handleClick} disabled={busy} className={className}>
      {busy ? '...' : children}
    </button>
  );
}
