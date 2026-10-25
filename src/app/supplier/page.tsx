'use client';

export const dynamic = 'force-dynamic';

import React, { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { persistActiveRole, readActiveRole } from '@/lib/roleCookies';
import ManufacturerDashboard from '@/app/manufacturer/dashboard/page';
import { toSupplierHref } from './supplierRoutes';

const TEXT_REPLACEMENTS: Array<[string, string]> = [
  ['لوحة تحكم المصنع', 'لوحة تحكم المورد والوكيل التجاري'],
  ['إعدادات وتوثيق المصنع', 'إعدادات وتوثيق المورد'],
];

/** Replaces factory wording with supplier wording inside the given root only. */
function swapTexts(root: HTMLElement) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let current = walker.nextNode();
  while (current) {
    const value = current.nodeValue;
    if (value && TEXT_REPLACEMENTS.some(([from]) => value.includes(from))) {
      nodes.push(current as Text);
    }
    current = walker.nextNode();
  }
  nodes.forEach((node) => {
    let next = node.nodeValue || '';
    TEXT_REPLACEMENTS.forEach(([from, to]) => {
      next = next.split(from).join(to);
    });
    node.nodeValue = next;
  });
}

/** Points every dashboard card at its isolated /supplier/... route. */
function rewriteCardLinks(root: HTMLElement) {
  root.querySelectorAll<HTMLAnchorElement>('a[href^="/manufacturer"]').forEach((a) => {
    const href = a.getAttribute('href') || '';
    const mapped = toSupplierHref(href);
    if (mapped) a.setAttribute('href', mapped);
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

  // Supplier wording + isolated card links on top of the shared dashboard UI.
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const apply = () => {
      swapTexts(root);
      rewriteCardLinks(root);
    };
    apply();
    const observer = new MutationObserver(() => {
      observer.disconnect();
      apply();
      observer.observe(root, { childList: true, subtree: true, characterData: true });
    });
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, []);

  // Capture-phase guard: any card click on a /manufacturer/... link stays inside /supplier.
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const onClickCapture = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest?.('a') as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.getAttribute('href') || '';
      if (!href.startsWith('/manufacturer') && !href.startsWith('/supplier')) return;
      const mapped = href.startsWith('/supplier') ? href : toSupplierHref(href);
      if (mapped) {
        event.preventDefault();
        event.stopPropagation();
        router.push(mapped);
      }
    };
    root.addEventListener('click', onClickCapture, true);
    return () => root.removeEventListener('click', onClickCapture, true);
  }, [router]);

  return (
    <div ref={containerRef}>
      <ManufacturerDashboard />
    </div>
  );
}
