'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { supplierUnitLabel } from './supplierUnits';
import { PRODUCT_SELECT, PRODUCT_SELECT_WITH_VIEWS, type ProductRow } from './supplierProductTypes';
import {
  PERF_BADGE_CLS,
  PERF_BADGE_LABEL,
  buildProductPerformance,
  formatCompact,
  revenueEntries,
  type ProductPerf,
} from './supplierPerformance';

interface Props {
  userId: string;
}

interface OrderLite {
  status: string | null;
  escrow_status: string | null;
  created_at: string;
  items: unknown;
}

interface Ranked {
  product: ProductRow;
  perf: ProductPerf;
}

const CARD = 'bg-slate-900 border border-slate-800 rounded-2xl';

function Thumb({ p }: { p: ProductRow }) {
  return (
    <div className="w-12 h-12 rounded-lg overflow-hidden border border-slate-700 bg-slate-950 shrink-0 flex items-center justify-center">
      {p.image_url ? (
        <img src={p.image_url} alt={p.name_ar || p.name} className="w-full h-full object-cover" />
      ) : (
        <span className="text-xl" aria-hidden="true">📦</span>
      )}
    </div>
  );
}

function RevenueText({ perf, fallback }: { perf: ProductPerf; fallback: string }) {
  const revs = revenueEntries(perf.revenue);
  if (revs.length === 0) return <>0 {fallback}</>;
  return <>{revs.map(([c, v]) => `${formatCompact(v)} ${c}`).join(' • ')}</>;
}

export default function SupplierProductInsights({ userId }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [orders, setOrders] = useState<OrderLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    let { data, error: err } = await supabase
      .from('supplier_products')
      .select(PRODUCT_SELECT_WITH_VIEWS)
      .eq('supplier_id', userId);
    if (err) {
      const retry = await supabase.from('supplier_products').select(PRODUCT_SELECT).eq('supplier_id', userId);
      data = retry.data as typeof data;
      err = retry.error;
    }
    if (err) setError(err.message);
    setProducts((data as unknown as ProductRow[]) ?? []);
    const { data: ord } = await supabase
      .from('orders')
      .select('status, escrow_status, created_at, items')
      .eq('factory_user_id', userId)
      .order('created_at', { ascending: false })
      .limit(2000);
    setOrders((ord as OrderLite[]) ?? []);
    setLoading(false);
  }, [supabase, userId]);

  useEffect(() => {
    load();
  }, [load]);

  const ranked: Ranked[] = useMemo(() => {
    const map = buildProductPerformance(products, orders);
    return products.map((product) => ({ product, perf: map.get(product.id)! }));
  }, [products, orders]);

  const topSelling = useMemo(
    () => [...ranked].filter((r) => r.perf.unitsSold > 0).sort((a, b) => b.perf.unitsSold - a.perf.unitsSold).slice(0, 8),
    [ranked],
  );
  const mostViewed = useMemo(
    () => [...ranked].filter((r) => r.perf.views > 0).sort((a, b) => b.perf.views - a.perf.views).slice(0, 8),
    [ranked],
  );
  const slowStock = useMemo(
    () =>
      [...ranked]
        .filter((r) => r.product.status === 'active' && Number(r.product.stock_quantity) > 0 && r.perf.unitsSold === 0)
        .sort((a, b) => Number(b.product.stock_quantity) - Number(a.product.stock_quantity))
        .slice(0, 10),
    [ranked],
  );

  const totals = useMemo(() => {
    const views = ranked.reduce((s, r) => s + r.perf.views, 0);
    const sold = ranked.reduce((s, r) => s + r.perf.unitsSold, 0);
    return { views, sold };
  }, [ranked]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8" dir="rtl">
      {error && <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-sm rounded-xl px-3 py-2">{error}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className={`${CARD} p-4`}>
          <p className="text-[11px] text-slate-400">👁️ إجمالي المشاهدات</p>
          <p className="text-xl font-black text-white mt-1">{formatCompact(totals.views)}</p>
        </div>
        <div className={`${CARD} p-4`}>
          <p className="text-[11px] text-slate-400">📦 إجمالي القطع المباعة</p>
          <p className="text-xl font-black text-white mt-1">{formatCompact(totals.sold)}</p>
        </div>
        <div className={`${CARD} p-4`}>
          <p className="text-[11px] text-slate-400">🛍️ عدد المنتجات</p>
          <p className="text-xl font-black text-white mt-1">{products.length}</p>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-black text-orange-300">🔥 الأصناف الأكثر طلباً ومبيعاً</h2>
        {topSelling.length === 0 ? (
          <div className={`${CARD} p-6 text-center text-sm text-slate-400`}>لا توجد مبيعات مسجلة بعد.</div>
        ) : (
          <div className="space-y-2">
            {topSelling.map((r, i) => (
              <div key={r.product.id} className={`${CARD} p-3 flex items-center gap-3`}>
                <span className="w-7 h-7 rounded-full bg-orange-500/15 text-orange-300 text-xs font-black flex items-center justify-center shrink-0">{i + 1}</span>
                <Thumb p={r.product} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-white truncate">{r.product.name_ar || r.product.name}</p>
                  <p className="text-[11px] text-slate-400">
                    <RevenueText perf={r.perf} fallback={r.product.currency} />
                  </p>
                </div>
                <div className="text-left shrink-0">
                  <p className="text-sm font-black text-white">
                    {formatCompact(r.perf.unitsSold)} <span className="text-[10px] text-slate-400">{supplierUnitLabel(r.product.unit)}</span>
                  </p>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${PERF_BADGE_CLS[r.perf.badge]}`}>{PERF_BADGE_LABEL[r.perf.badge]}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-black text-cyan-300">👁️ الأكثر زيارة من المشترين</h2>
        {mostViewed.length === 0 ? (
          <div className={`${CARD} p-6 text-center text-sm text-slate-400`}>لا توجد مشاهدات مسجلة بعد.</div>
        ) : (
          <div className="space-y-2">
            {mostViewed.map((r, i) => (
              <div key={r.product.id} className={`${CARD} p-3 flex items-center gap-3`}>
                <span className="w-7 h-7 rounded-full bg-cyan-500/15 text-cyan-300 text-xs font-black flex items-center justify-center shrink-0">{i + 1}</span>
                <Thumb p={r.product} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-white truncate">{r.product.name_ar || r.product.name}</p>
                  <p className="text-[11px] text-slate-400">المباع: {formatCompact(r.perf.unitsSold)} {supplierUnitLabel(r.product.unit)}</p>
                </div>
                <p className="text-sm font-black text-white shrink-0">{formatCompact(r.perf.views)} <span className="text-[10px] text-slate-400">مشاهدة</span></p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-black text-amber-300">🐌 أصناف راكدة تحتاج إلى تخفيض أو عروض أسعار</h2>
        {slowStock.length === 0 ? (
          <div className={`${CARD} p-6 text-center text-sm text-slate-400`}>لا توجد أصناف راكدة حالياً.</div>
        ) : (
          <div className="space-y-2">
            {slowStock.map((r) => (
              <div key={r.product.id} className={`${CARD} p-3 flex items-center gap-3 flex-wrap`}>
                <Thumb p={r.product} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-white truncate">{r.product.name_ar || r.product.name}</p>
                  <p className="text-[11px] text-slate-400">
                    مخزون راكد: {formatCompact(Number(r.product.stock_quantity))} {supplierUnitLabel(r.product.unit)} · لم تُسجَّل مبيعات
                  </p>
                </div>
                <Link
                  href="/supplier/rfq"
                  className="h-8 px-3 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-300 text-[11px] font-bold inline-flex items-center hover:bg-amber-500/25 transition-colors"
                >
                  إنشاء عرض سعر
                </Link>
                <Link
                  href="/supplier/products"
                  className="h-8 px-3 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-[11px] font-bold inline-flex items-center hover:bg-slate-700 transition-colors"
                >
                  تعديل السعر
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>

    </div>
  );
}
