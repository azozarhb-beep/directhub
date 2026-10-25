'use client';

export const dynamic = 'force-dynamic';

import React, { useEffect, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { persistActiveRole, readActiveRole } from '@/lib/roleCookies';
import ManufacturerDashboard from '@/app/manufacturer/dashboard/page';
import { getSupplierRouteBySlug, toSupplierHref } from '../supplierRoutes';
import { applySupplierInventoryAdapter } from '../supplierInventoryAdapter';

const TEXT_REPLACEMENTS: Array<[string, string]> = [
  ['لوحة تحكم المصنع', 'لوحة تحكم المورد والوكيل التجاري'],
  ['إعدادات وتوثيق المصنع', 'إعدادات وتوثيق المورد'],
];

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

/** Rewrites every /manufacturer/... anchor that has a supplier equivalent. */
function rewriteLinks(root: HTMLElement) {
  root.querySelectorAll<HTMLAnchorElement>('a[href^="/manufacturer"]').forEach((a) => {
    const href = a.getAttribute('href') || '';
    const mapped = toSupplierHref(href);
    if (mapped) a.setAttribute('href', mapped);
  });
  fixBackLinks(root);
}

const BACK_LABEL = 'رجوع إلى لوحة التحكم';

/** Forces every "رجوع إلى لوحة التحكم" control inside /supplier/* to point at /supplier. */
function fixBackLinks(root: HTMLElement) {
  root.querySelectorAll<HTMLAnchorElement>('a').forEach((a) => {
    if (a.textContent?.includes(BACK_LABEL) && a.getAttribute('href') !== '/supplier') {
      a.setAttribute('href', '/supplier');
    }
  });
}

export default function SupplierModulePage() {
  const params = useParams<{ module: string }>();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const slug = params?.module;
  const route = getSupplierRouteBySlug(slug);
  const view = searchParams?.get('view') ?? undefined;
  const ready = !loading && !!user && !!route;

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`/login?redirect=/supplier/${slug ?? ''}`);
      return;
    }
    if (!route) {
      router.replace('/supplier');
      return;
    }
    if (readActiveRole() !== 'supplier') persistActiveRole('supplier');
  }, [loading, user, route, slug, router]);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const isInventory = route?.tab === 'inventory';
    const apply = () => {
      swapTexts(root);
      rewriteLinks(root);
      applySupplierInventoryAdapter(root, isInventory);
    };
    apply();
    const observer = new MutationObserver(() => {
      observer.disconnect();
      apply();
      observer.observe(root, { childList: true, subtree: true, characterData: true });
    });
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [route?.tab, ready]);

  // Capture-phase guard: any click on a /manufacturer/... link stays inside /supplier.
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const onClickCapture = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const backControl = target?.closest?.('a,button') as HTMLElement | null;
      if (backControl && backControl.textContent?.includes(BACK_LABEL)) {
        event.preventDefault();
        event.stopPropagation();
        router.push('/supplier');
        return;
      }
      const anchor = target?.closest?.('a') as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.getAttribute('href') || '';
      if (!href.startsWith('/manufacturer')) return;
      const mapped = toSupplierHref(href);
      if (mapped) {
        event.preventDefault();
        event.stopPropagation();
        router.push(mapped);
      }
    };
    root.addEventListener('click', onClickCapture, true);
    return () => root.removeEventListener('click', onClickCapture, true);
  }, [router, ready]);

  if (loading || !user || !route) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div ref={containerRef}>
      <ManufacturerDashboard moduleTab={route.tab} moduleView={view} />
    </div>
  );
}
