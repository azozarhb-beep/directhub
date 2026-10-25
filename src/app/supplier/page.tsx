'use client';

export const dynamic = 'force-dynamic';

import React, { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { persistActiveRole, readActiveRole } from '@/lib/roleCookies';
import ManufacturerDashboard from '@/app/manufacturer/dashboard/page';

const ORIGINAL_TITLE = 'لوحة تحكم المصنع';
const SUPPLIER_TITLE = 'لوحة تحكم المورد والوكيل التجاري';

/** Replaces the factory title text with the supplier title inside the given root only. */
function swapTitleText(root: HTMLElement) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let current = walker.nextNode();
  while (current) {
    if (current.nodeValue && current.nodeValue.includes(ORIGINAL_TITLE)) {
      nodes.push(current as Text);
    }
    current = walker.nextNode();
  }
  nodes.forEach((node) => {
    node.nodeValue = (node.nodeValue || '').split(ORIGINAL_TITLE).join(SUPPLIER_TITLE);
  });
}

export default function SupplierPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);

  // Keep the supplier role pinned so a refresh never falls back to /manufacturer.
  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login?redirect=/supplier');
      return;
    }
    if (readActiveRole() !== 'supplier') persistActiveRole('supplier');
  }, [loading, user, router]);

  // Only the main header title differs from the manufacturer dashboard.
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    swapTitleText(root);
    const observer = new MutationObserver(() => {
      observer.disconnect();
      swapTitleText(root);
      observer.observe(root, { childList: true, subtree: true, characterData: true });
    });
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef}>
      <ManufacturerDashboard />
    </div>
  );
}
