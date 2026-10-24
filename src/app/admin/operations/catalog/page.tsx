'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import OperationsShell from '../OperationsShell';
import { OpsProduct, inputCls, useOperationsData } from '../useOperationsData';

const CATEGORIES = ['تغليف', 'بلاستيك', 'منظفات', 'مواد خام'];
const CURRENCIES = ['YER', 'SAR', 'USD', 'AED', 'CNY', 'TRY'];

const categoryMatches = (cat: string, chip: string): boolean => {
  const c = (cat || '').toLowerCase();
  const map: Record<string, string[]> = {
    'تغليف': ['تغليف', 'packaging', 'packag'],
    'بلاستيك': ['بلاستيك', 'plastic'],
    'منظفات': ['منظفات', 'clean', 'hygiene', 'detergent'],
    'مواد خام': ['مواد خام', 'raw'],
  };
  return (map[chip] || [chip.toLowerCase()]).some((k) => c.includes(k));
};

export default function OperationsCatalogPage() {
  const { supabase, agents, products, setProducts, loading, error, load } = useOperationsData();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [currency, setCurrency] = useState('');
  const [agentFilter, setAgentFilter] = useState('');
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [toast, setToast] = useState('');

  const [editing, setEditing] = useState<OpsProduct | null>(null);
  const [editForm, setEditForm] = useState({ price: '', moq: '', stock: '' });
  const [editBusy, setEditBusy] = useState(false);

  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get('status');
    if (s === 'active' || s === 'pending' || s === 'paused') setStatus(s);
  }, []);

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000); };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (q && !`${p.title} ${p.sku} ${p.factoryName}`.toLowerCase().includes(q)) return false;
      if (agentFilter && p.agentId !== agentFilter) return false;
      if (category && !categoryMatches(p.category, category)) return false;
      if (currency && p.currency !== currency) return false;
      if (status === 'active' && !(p.isActive && p.isPublished)) return false;
      if (status === 'pending' && p.isPublished) return false;
      if (status === 'paused' && p.isActive) return false;
      return true;
    });
  }, [products, search, status, category, currency, agentFilter]);

  const toggleProduct = async (p: OpsProduct) => {
    setBusyKey(p.key);
    const next = !p.isActive;
    const { error: err } = await supabase.from(p.table).update({ is_active: next, updated_at: new Date().toISOString() }).eq('id', p.id);
    if (!err && p.table === 'agent_products') {
      await supabase.from('manufacturer_products').update({ is_active: next, updated_at: new Date().toISOString() }).eq('agent_product_id', p.id);
    }
    setBusyKey(null);
    if (err) { showToast(`فشل التحديث: ${err.message}`); return; }
    setProducts((prev) => prev.map((x) => (x.key === p.key ? { ...x, isActive: next } : x)));
    showToast(next ? 'تم تنشيط المنتج' : 'تم إيقاف المنتج');
  };

  const openEdit = (p: OpsProduct) => {
    setEditing(p);
    setEditForm({ price: String(p.price), moq: String(p.moq), stock: p.stock !== null ? String(p.stock) : '' });
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    const price = Number(editForm.price);
    const moq = Math.max(1, parseInt(editForm.moq, 10) || 1);
    if (!isFinite(price) || price < 0) { showToast('سعر غير صالح'); return; }
    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    let stock: number | null = editing.stock;
    if (editing.table === 'manufacturer_products') {
      payload.unit_price = price;
      payload.minimum_order_qty = moq;
    } else {
      payload.wholesale_price = price;
      payload.moq = moq;
    }
    if (editForm.stock !== '') { stock = Math.max(0, parseInt(editForm.stock, 10) || 0); payload.stock_quantity = stock; }
    setEditBusy(true);
    const { error: err } = await supabase.from(editing.table).update(payload).eq('id', editing.id);
    if (!err && editing.table === 'agent_products') {
      const mirror: Record<string, unknown> = { unit_price: price, minimum_order_qty: moq, updated_at: new Date().toISOString() };
      if (stock !== null) mirror.stock_quantity = stock;
      await supabase.from('manufacturer_products').update(mirror).eq('agent_product_id', editing.id);
    }
    setEditBusy(false);
    if (err) { showToast(`فشل الحفظ: ${err.message}`); return; }
    setProducts((prev) => prev.map((x) => (x.key === editing.key ? { ...x, price, moq, stock } : x)));
    setEditing(null);
    showToast('تم حفظ التعديلات');
  };

  return (
    <OperationsShell title="الكتالوج الشامل وسرعة المبيعات" subtitle="إدارة منتجات B2B الرئيسية: أسعار متعددة العملات، مواصفات التعبئة، والكميات المتوفرة" loading={loading} error={error} onRefresh={load}>
      <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث باسم المنتج، SKU، أو المصنع..." className={`${inputCls} md:col-span-2`} />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
          <option value="">كل الحالات</option>
          <option value="active">نشط ومعروض</option>
          <option value="pending">قيد الاعتماد</option>
          <option value="paused">موقوف</option>
        </select>
        <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={inputCls}>
          <option value="">كل العملات</option>
          {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)} className={`${inputCls} md:col-span-2`}>
          <option value="">كل المناديب</option>
          {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        <button onClick={() => setCategory('')} className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border ${!category ? 'bg-blue-600 border-blue-500' : 'bg-slate-900 border-slate-700 text-slate-400'}`}>كل الفئات</button>
        {CATEGORIES.map((c) => (
          <button key={c} onClick={() => setCategory(c)} className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border ${category === c ? 'bg-blue-600 border-blue-500' : 'bg-slate-900 border-slate-700 text-slate-400'}`}>{c}</button>
        ))}
      </div>
      <p className="text-[11px] text-slate-500 px-1">عدد المنتجات: {filtered.length}</p>

      <div className="w-full overflow-x-auto bg-slate-900 border border-slate-800 rounded-2xl">
        <table className="w-full min-w-[1100px] text-sm text-right">
          <thead className="bg-slate-950 text-slate-400 text-xs">
            <tr>
              <th className="p-3 font-bold">المنتج</th>
              <th className="p-3 font-bold">المصنع</th>
              <th className="p-3 font-bold">المندوب</th>
              <th className="p-3 font-bold">السعر / العملة</th>
              <th className="p-3 font-bold text-center">الحد الأدنى (MOQ)</th>
              <th className="p-3 font-bold text-center">المخزون</th>
              <th className="p-3 font-bold">الحالة</th>
              <th className="p-3 font-bold">الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="p-10 text-center text-slate-500">لا توجد منتجات مطابقة</td></tr>
            )}
            {filtered.map((p) => (
              <tr key={p.key} className={`border-t border-slate-800 hover:bg-slate-800/40 ${p.isActive ? '' : 'opacity-70'}`}>
                <td className="p-3">
                  <div className="flex items-center gap-2.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.image} alt={`صورة المنتج ${p.title}`} className="w-12 h-12 rounded-lg object-cover bg-slate-800 shrink-0" />
                    <div className="min-w-0">
                      <div className="font-bold truncate max-w-[220px]">{p.title}</div>
                      <div className="text-[10px] text-slate-500 font-mono" dir="ltr">SKU: {p.sku}</div>
                      {p.soldToday > 0 && <span className="text-[10px] text-emerald-300 font-bold">بيع {p.soldToday} اليوم</span>}
                    </div>
                  </div>
                </td>
                <td className="p-3 text-xs">
                  {p.factoryLink ? <Link href={p.factoryLink} className="text-blue-300 font-bold">{p.factoryName}</Link> : <span className="font-bold">{p.factoryName}</span>}
                </td>
                <td className="p-3 text-xs">{p.agentName}</td>
                <td className="p-3 font-black text-emerald-400 tabular-nums" dir="ltr">{p.price.toLocaleString('en-US')} {p.currency}</td>
                <td className="p-3 text-center tabular-nums">{p.moq}</td>
                <td className="p-3 text-center tabular-nums">{p.stock ?? '—'}</td>
                <td className="p-3">
                  {!p.isPublished
                    ? <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-600/20 text-amber-300">قيد الاعتماد</span>
                    : p.isActive
                      ? <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600/20 text-emerald-300">نشط</span>
                      : <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-600/20 text-red-300">موقوف</span>}
                </td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1.5">
                    <Link href={`/product/${p.id}`} target="_blank" className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-bold">معاينة</Link>
                    <button onClick={() => openEdit(p)} className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-bold">تعديل</button>
                    <button onClick={() => toggleProduct(p)} disabled={busyKey === p.key} className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold disabled:opacity-50 ${p.isActive ? 'bg-red-600/80 hover:bg-red-600' : 'bg-emerald-600 hover:bg-emerald-500'}`}>{p.isActive ? 'إيقاف' : 'تنشيط'}</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] bg-emerald-600 text-white text-sm font-bold px-4 py-2 rounded-xl shadow-xl">{toast}</div>}

      {editing && (
        <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4">
          <form onSubmit={saveEdit} className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-5 space-y-3">
            <div className="flex items-center">
              <h3 className="text-base font-black truncate">تعديل السعر والكمية — {editing.title}</h3>
              <button type="button" onClick={() => setEditing(null)} className="mr-auto w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700">✕</button>
            </div>
            <label className="block text-xs text-slate-300">سعر الجملة ({editing.currency})
              <input required type="number" step="0.01" min="0" dir="ltr" value={editForm.price} onChange={(e) => setEditForm({ ...editForm, price: e.target.value })} className={`mt-1 ${inputCls}`} />
            </label>
            <label className="block text-xs text-slate-300">الحد الأدنى للطلب (MOQ)
              <input required type="number" min="1" dir="ltr" value={editForm.moq} onChange={(e) => setEditForm({ ...editForm, moq: e.target.value })} className={`mt-1 ${inputCls}`} />
            </label>
            <label className="block text-xs text-slate-300">الكمية المتوفرة
              <input type="number" min="0" dir="ltr" value={editForm.stock} onChange={(e) => setEditForm({ ...editForm, stock: e.target.value })} className={`mt-1 ${inputCls}`} />
            </label>
            <button type="submit" disabled={editBusy} className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 font-bold text-sm">{editBusy ? 'جارٍ الحفظ...' : 'حفظ'}</button>
          </form>
        </div>
      )}
    </OperationsShell>
  );
}
