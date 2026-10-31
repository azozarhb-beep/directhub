'use client';

import React, { useEffect, useRef } from 'react';
import { sanitizeSupplierText } from './supplierTextSanitizer';

interface SupplierScopeProps {
  children: React.ReactNode;
}

/** Wraps shared panels and rewrites any residual industrial wording to commercial wording (supplier scope only). */
export default function SupplierScope({ children }: SupplierScopeProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let scheduled = false;
    let observer: MutationObserver;
    const run = () => {
      scheduled = false;
      observer.disconnect();
      sanitizeSupplierText(el);
      observer.observe(el, { childList: true, subtree: true, characterData: true });
    };
    observer = new MutationObserver(() => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(run);
    });
    sanitizeSupplierText(el);
    observer.observe(el, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, []);

  return <div ref={ref}>{children}</div>;
}
