'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface FactoryModuleCounts {
  products: number;
  activeProducts: number;
  inventory: number;
  lowStock: number;
  rfq: number;
  orders: number;
  pendingOrders: number;
  escrow: number;
  escrowPending: number;
  bankAccounts: number;
  documents: number;
  messages: number;
  disputes: number;
}

const EMPTY_COUNTS: FactoryModuleCounts = {
  products: 0,
  activeProducts: 0,
  inventory: 0,
  lowStock: 0,
  rfq: 0,
  orders: 0,
  pendingOrders: 0,
  escrow: 0,
  escrowPending: 0,
  bankAccounts: 0,
  documents: 0,
  messages: 0,
  disputes: 0,
};

async function safe<T>(fn: () => PromiseLike<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

/** Lightweight live counters used for hub-card badges. Every query is failure-tolerant. */
export function useFactoryHubCounts(userId?: string | null): { counts: FactoryModuleCounts; loading: boolean } {
  const supabase = React.useMemo(() => createClient(), []);
  const [counts, setCounts] = React.useState<FactoryModuleCounts>(EMPTY_COUNTS);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const emptyRes = { data: null as any, count: 0, error: null as any };
      const [products, inventory, rfq, orders, escrow, banks, docs, threads, disputes] = await Promise.all([
        safe(() => supabase.from('manufacturer_products').select('id, is_active', { count: 'exact' }).eq('manufacturer_id', userId), emptyRes),
        safe(() => supabase.from('inventory_items').select('id, quantity_available, reorder_level', { count: 'exact' }).eq('manufacturer_id', userId), emptyRes),
        safe(() => supabase.from('rfq_responses').select('id', { count: 'exact', head: true }).eq('supplier_id', userId), emptyRes),
        safe(() => supabase.from('orders').select('id, status', { count: 'exact' }).eq('factory_user_id', userId), emptyRes),
        safe(() => supabase.from('orders').select('id, escrow_status', { count: 'exact' }).eq('factory_user_id', userId).not('escrow_status', 'is', null), emptyRes),
        safe(() => supabase.from('manufacturer_bank_accounts').select('id', { count: 'exact', head: true }).eq('manufacturer_id', userId), emptyRes),
        safe(() => supabase.from('factory_documents').select('id', { count: 'exact', head: true }).eq('factory_id', userId), emptyRes),
        safe(() => supabase.from('factory_threads').select('id', { count: 'exact', head: true }).eq('factory_id', userId), emptyRes),
        safe(() => supabase.from('order_disputes').select('id', { count: 'exact', head: true }).eq('factory_id', userId), emptyRes),
      ]);
      if (cancelled) return;
      const prodRows: any[] = products?.data ?? [];
      const invRows: any[] = inventory?.data ?? [];
      const orderRows: any[] = orders?.data ?? [];
      const escrowRows: any[] = escrow?.data ?? [];
      setCounts({
        products: products?.count ?? prodRows.length,
        activeProducts: prodRows.filter((p) => p?.is_active).length,
        inventory: inventory?.count ?? invRows.length,
        lowStock: invRows.filter(
          (i) => i?.reorder_level != null && Number(i?.quantity_available ?? 0) <= Number(i.reorder_level)
        ).length,
        rfq: rfq?.count ?? 0,
        orders: orders?.count ?? orderRows.length,
        pendingOrders: orderRows.filter((o) => ['pending', 'processing', 'confirmed'].includes(String(o?.status))).length,
        escrow: escrow?.count ?? escrowRows.length,
        escrowPending: escrowRows.filter((o) => o?.escrow_status && o.escrow_status !== 'funds_released').length,
        bankAccounts: banks?.count ?? 0,
        documents: docs?.count ?? 0,
        messages: threads?.count ?? 0,
        disputes: disputes?.count ?? 0,
      });
      setLoading(false);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [userId, supabase]);

  return { counts, loading };
}
