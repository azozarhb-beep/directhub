'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import { supplierUnitLabel } from './supplierUnits';
import { buildArabicCategoryOptions, categoryToArabic, SUPPLIER_PRODUCT_CATEGORIES } from './supplierCategories';
import SupplierProductForm from './SupplierProductForm';
import { DealLinkModal, QuickEditModal } from './SupplierProductModals';
import {
  PRODUCT_SELECT,
  PRODUCT_SELECT_WITH_VIEWS,
  STOCK_CLS,
  STOCK_LABEL,
  deliveryTermsLabel,
  formatMoney,
  stockState,
  type ProductRow,
  type StockState,
} from './supplierProductTypes';
import {
  PERF_BADGE_CLS,
  PERF_BADGE_LABEL,
  buildProductPerformance,
  formatCompact,
  revenueEntries,
} from './supplierPerformance';

const STATUS_LABEL: Record<string, string> = { active: 'نشط', draft: 'مسودة', archived: 'غير نشط' };
const STATUS_CLS: Record<string, string> = {
  active: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40',
  draft: 'bg-amber-500/15 text-amber-300 border border-amber-500/40',
  archived: 'bg-slate-700 text-slate-300 border border-slate-600',
};

const CARD = 'bg-slate-900 border border-slate-800 rounded-2xl';
const FIELD =
  'h-10 px-3 rounded-xl border border-slate-700 bg-slate-950 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500';

function normalizeDigits(s: string): string {
  return s
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

function csvCell(v: unknown): string {
  const s = v == null ? '' : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

interface SupplierProductsProps {
  userId: string;
}

export default function SupplierProducts({ userId }: SupplierProductsProps) {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ProductRow | null>(null);
  const [quickEdit, setQuickEdit] = useState<ProductRow | null>(null);
  const [dealFor, setDealFor] = useState<ProductRow | null>(null);

  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [stockFilter, setStockFilter] = useState<'all' | StockState>('all');
  const [currencyFilter, setCurrencyFilter] = useState('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [perfOrders, setPerfOrders] = useState<
    Array<{ status: string | null; escrow_status: string | null; created_at: string; items: unknown }>
  >([]);

  const load = useCallback(async () => {
    setError('');
    let { data, error: err } = await supabase
      .from('supplier_products')
      .select(PRODUCT_SELECT_WITH_VIEWS)
      .eq('supplier_id', userId)
      .order('created_at', { ascending: false });
    if (err) {
      const retry = await supabase
        .from('supplier_products')
        .select(PRODUCT_SELECT)
        .eq('supplier_id', userId)
        .order('created_at', { ascending: false });
      data = retry.data as typeof data;
      err = retry.error;
    }
    if (err) {
      setError(err.message);
      setRows([]);
    } else {
      setRows((data as unknown as ProductRow[]) ?? []);
    }
    const { data: ord } = await supabase
      .from('orders')
      .select('status, escrow_status, created_at, items')
      .eq('factory_user_id', userId)
      .order('created_at', { ascending: false })
      .limit(2000);
    setPerfOrders((ord as typeof perfOrders) ?? []);
    setLoading(false);
  }, [supabase, userId]);

  useEffect(() => {
    load();
  }, [load]);

  const categories = useMemo(
    () => buildArabicCategoryOptions(SUPPLIER_PRODUCT_CATEGORIES, rows.map((r) => r.category)),
    [rows]
  );

  const filtered = useMemo(() => {
    const q = normalizeDigits(search.trim().toLowerCase());
    return rows.filter((p) => {
      if (catFilter !== 'all' && categoryToArabic(p.category) !== catFilter) return false;
      if (currencyFilter !== 'all' && p.currency !== currencyFilter) return false;
      if (stockFilter !== 'all' && stockState(p) !== stockFilter) return false;
      if (!q) return true;
      const hay = [p.name, p.name_ar, p.sku].filter(Boolean).join(' ').toLowerCase();
      return normalizeDigits(hay).includes(q);
    });
  }, [rows, search, catFilter, currencyFilter, stockFilter]);

  const allVisibleSelected = filtered.length > 0 && filtered.every((p) => selected.has(p.id));

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) filtered.forEach((p) => next.delete(p.id));
      else filtered.forEach((p) => next.add(p.id));
      return next;
    });

  const openAdd = () => {
    setEditing(null);
    setShowForm(true);
  };

  const openEdit = (p: ProductRow) => {
    setEditing(p);
    setShowForm(true);
  };

  const handleSaved = async () => {
    setShowForm(false);
    setQuickEdit(null);
    setLoading(true);
    await load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا المنتج؟')) return;
    const { error: err } = await supabase.from('supplier_products').delete().eq('id', id).eq('supplier_id', userId);
    if (err) {
      setError(err.message);
      return;
    }
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    await load();
  };

  const bulkSetStatus = async (status: 'active' | 'archived') => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    setBulkBusy(true);
    const { error: err } = await supabase
      .from('supplier_products')
      .update({ status })
      .in('id', ids)
      .eq('supplier_id', userId);
    setBulkBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    toast.success(status === 'active' ? 'تم تفعيل المنتجات المحددة' : 'تم إلغاء تفعيل المنتجات المحددة');
    setSelected(new Set());
    await load();
  };

  const exportCsv = () => {
    const list = selected.size > 0 ? rows.filter((p) => selected.has(p.id)) : filtered;
    if (list.length === 0) {
      toast.error('لا توجد منتجات للتصدير');
      return;
    }
    const header = [
      'الاسم بالعربية', 'Name', 'SKU', 'التصنيف', 'الوحدة', 'العملة', 'سعر الجملة', 'سعر التجزئة',
      'الحد الأدنى للطلب', 'المخزون', 'حد الأمان', 'حالة المخزون', 'رقم الرف', 'شروط التسليم', 'الحالة',
    ];
    const lines = list.map((p) =>
      [
        p.name_ar, p.name, p.sku, p.category, supplierUnitLabel(p.unit), p.currency, p.wholesale_price,
        p.retail_price, p.min_order_qty, p.stock_quantity, p.low_stock_threshold ?? 0,
        STOCK_LABEL[stockState(p)], p.shelf_location, deliveryTermsLabel(p.delivery_terms),
        STATUS_LABEL[p.status] || p.status,
      ].map(csvCell).join(',')
    );
    const csv = '\uFEFF' + [header.map(csvCell).join(','), ...lines].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'supplier-products.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const whatsappHref = (p: ProductRow) => {
    const lines = [
      `*${p.name_ar || p.name}*`,
      p.name_ar && p.name ? p.name : '',
      p.sku ? `SKU: ${p.sku}` : '',
      `سعر الجملة: ${formatMoney(p.wholesale_price)} ${p.currency} / ${supplierUnitLabel(p.unit)}`,
      p.retail_price != null ? `سعر التجزئة: ${formatMoney(p.retail_price)} ${p.currency}` : '',
      `الحد الأدنى للطلب: ${p.min_order_qty} ${supplierUnitLabel(p.unit)}`,
      p.units_per_pack ? `عدد الوحدات في ${supplierUnitLabel(p.unit)}: ${p.units_per_pack}` : '',
      `شروط التسليم: ${deliveryTermsLabel(p.delivery_terms)}`,
      `الحالة: ${STOCK_LABEL[stockState(p)]}`,
      p.image_url ? p.image_url : '',
    ].filter(Boolean);
    return `https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`;
  };

  const perfMap = useMemo(() => buildProductPerformance(rows, perfOrders), [rows, perfOrders]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-end gap-2 flex-wrap">
        <button
          type="button"
          onClick={exportCsv}
          className="h-10 px-4 rounded-xl border border-slate-700 text-slate-200 text-sm font-bold hover:bg-slate-800 transition-colors"
        >
          تصدير Excel / CSV
        </button>
        <button
          type="button"
          onClick={openAdd}
          className="h-10 bg-cyan-600 hover:bg-cyan-500 text-white px-4 rounded-xl text-sm font-bold transition-colors"
        >
          + إضافة منتج جديد
        </button>
      </div>

      <div className={`${CARD} p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2`}>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث بالاسم أو SKU / الباركود"
          aria-label="بحث في المنتجات"
          className={`${FIELD} sm:col-span-2 lg:col-span-1`}
        />
        <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} aria-label="تصفية حسب التصنيف" className={FIELD}>
          <option value="all">كل التصنيفات</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select value={stockFilter} onChange={(e) => setStockFilter(e.target.value as 'all' | StockState)} aria-label="تصفية حسب حالة المخزون" className={FIELD}>
          <option value="all">كل حالات المخزون</option>
          <option value="in">متوفر</option>
          <option value="low">منخفض</option>
          <option value="out">نافد المخزون</option>
        </select>
        <select value={currencyFilter} onChange={(e) => setCurrencyFilter(e.target.value)} aria-label="تصفية حسب العملة" className={FIELD}>
          <option value="all">كل العملات</option>
          <option value="YER">YER</option>
          <option value="SAR">SAR</option>
          <option value="USD">USD</option>
        </select>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-2 flex-wrap bg-cyan-500/10 border border-cyan-500/30 rounded-xl px-3 py-2">
          <span className="text-xs font-bold text-cyan-200">تم تحديد {selected.size} منتج</span>
          <button type="button" disabled={bulkBusy} onClick={() => bulkSetStatus('active')} className="h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold disabled:opacity-60">تفعيل</button>
          <button type="button" disabled={bulkBusy} onClick={() => bulkSetStatus('archived')} className="h-8 px-3 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold disabled:opacity-60">إلغاء التفعيل</button>
          <button type="button" onClick={() => setSelected(new Set())} className="h-8 px-3 rounded-lg text-xs font-bold text-slate-300 hover:bg-slate-800">مسح التحديد</button>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-semibold rounded-xl px-4 py-3">{error}</div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <div className={`${CARD} p-10 text-center text-sm text-slate-400`}>لا توجد منتجات بعد. أضف منتجك الأول.</div>
      ) : filtered.length === 0 ? (
        <div className={`${CARD} p-10 text-center text-sm text-slate-400`}>لا توجد نتائج مطابقة للبحث أو التصفية.</div>
      ) : (
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-xs text-slate-400 px-1 cursor-pointer w-fit">
            <input type="checkbox" checked={allVisibleSelected} onChange={toggleAll} className="accent-cyan-500 w-4 h-4" />
            تحديد الكل ({filtered.length})
          </label>
          {filtered.map((p) => {
            const st = stockState(p);
            const thr = Number(p.low_stock_threshold ?? 0);
            const perf = perfMap.get(p.id);
            const revs = perf ? revenueEntries(perf.revenue) : [];
            return (
              <div key={p.id} className={`${CARD} p-3 sm:p-4 flex flex-col lg:flex-row lg:items-center gap-3`}>
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <input
                    type="checkbox"
                    checked={selected.has(p.id)}
                    onChange={() => toggleSelect(p.id)}
                    aria-label={`تحديد ${p.name_ar || p.name}`}
                    className="accent-cyan-500 w-4 h-4 shrink-0"
                  />
                  <div className="w-16 h-16 rounded-xl overflow-hidden border border-slate-700 bg-slate-950 shrink-0 flex items-center justify-center">
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name_ar || p.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-2xl" aria-hidden="true">📦</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-white text-sm truncate">{p.name_ar || p.name}</p>
                    {p.name_ar && p.name && p.name !== p.name_ar && (
                      <p className="text-xs text-slate-400 truncate" dir="ltr">{p.name}</p>
                    )}
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {[p.sku ? `SKU: ${p.sku}` : '', p.category, supplierUnitLabel(p.unit)].filter(Boolean).join(' • ')}
                    </p>
                    <span className={`inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full ${STATUS_CLS[p.status] || STATUS_CLS.draft}`}>
                      {STATUS_LABEL[p.status] || p.status}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4 flex-wrap lg:justify-center">
                  <div>
                    <p className="text-[10px] text-slate-500">جملة</p>
                    <p className="text-sm font-black text-white">
                      {formatMoney(p.wholesale_price)}{' '}
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">{p.currency}</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500">تجزئة</p>
                    <p className="text-sm font-bold text-slate-300">
                      {p.retail_price == null ? '—' : formatMoney(p.retail_price)}{' '}
                      {p.retail_price != null && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 border border-slate-600">{p.currency}</span>
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500">المخزون</p>
                    <p className="text-sm font-black text-white flex items-center gap-1.5">
                      {p.stock_quantity}
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${STOCK_CLS[st]}`}>
                        {st === 'low' ? `منخفض (≤ ${thr})` : STOCK_LABEL[st]}
                      </span>
                    </p>
                  </div>
                </div>

                {perf && (
                  <div className="flex items-center gap-4 flex-wrap lg:justify-center border-t border-slate-800 pt-3 lg:border-t-0 lg:pt-0 lg:border-r lg:pr-4 lg:border-slate-800">
                    <div>
                      <p className="text-[10px] text-slate-500">👁️ المشاهدات</p>
                      <p className="text-sm font-black text-white">{formatCompact(perf.views)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500">📦 إجمالي المباع</p>
                      <p className="text-sm font-black text-white">
                        {formatCompact(perf.unitsSold)}{' '}
                        <span className="text-[10px] font-bold text-slate-400">{supplierUnitLabel(p.unit)}</span>
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500">💰 الإيرادات</p>
                      {revs.length === 0 ? (
                        <p className="text-sm font-black text-white">0 <span className="text-[10px] text-slate-400">{p.currency}</span></p>
                      ) : (
                        <div className="text-sm font-black text-white space-y-0.5">
                          {revs.map(([cur, val]) => (
                            <p key={cur}>
                              {formatCompact(val)}{' '}
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">{cur}</span>
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                    <span className={`text-[10px] px-2 py-1 rounded-full font-bold whitespace-nowrap ${PERF_BADGE_CLS[perf.badge]}`}>
                      {PERF_BADGE_LABEL[perf.badge]}
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-1.5 flex-wrap lg:justify-end">
                  <button type="button" onClick={() => setQuickEdit(p)} className="h-8 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 text-[11px] font-bold">
                    تعديل سريع
                  </button>
                  <button type="button" onClick={() => setDealFor(p)} className="h-8 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-pink-300 text-[11px] font-bold">
                    رابط صفقة
                  </button>
                  <a href={whatsappHref(p)} target="_blank" rel="noopener noreferrer" className="h-8 px-2.5 rounded-lg bg-green-600 hover:bg-green-500 text-white text-[11px] font-bold inline-flex items-center">
                    واتساب
                  </a>
                  <button type="button" onClick={() => openEdit(p)} className="h-8 px-2.5 rounded-lg border border-slate-700 text-slate-200 text-[11px] font-bold hover:bg-slate-800">
                    تعديل كامل
                  </button>
                  <button type="button" onClick={() => handleDelete(p.id)} className="h-8 px-2.5 rounded-lg border border-red-500/40 text-red-400 text-[11px] font-bold hover:bg-red-500/10">
                    حذف
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <SupplierProductForm
          key={editing?.id ?? 'new'}
          userId={userId}
          product={editing}
          onClose={() => setShowForm(false)}
          onSaved={handleSaved}
        />
      )}
      {quickEdit && <QuickEditModal userId={userId} product={quickEdit} onClose={() => setQuickEdit(null)} onSaved={handleSaved} />}
      {dealFor && <DealLinkModal product={dealFor} onClose={() => setDealFor(null)} />}
    </div>
  );
}
