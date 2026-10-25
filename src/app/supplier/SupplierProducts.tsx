'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { SUPPLIER_UNIT_OPTIONS, supplierUnitLabel } from './supplierUnits';

interface ProductRow {
  id: string;
  name: string;
  name_ar: string | null;
  sku: string | null;
  category: string | null;
  description: string | null;
  unit: string;
  wholesale_price: number;
  retail_price: number | null;
  currency: string;
  min_order_qty: number;
  stock_quantity: number;
  status: string;
}

interface FormState {
  name: string;
  name_ar: string;
  sku: string;
  category: string;
  description: string;
  unit: string;
  wholesale_price: string;
  retail_price: string;
  currency: string;
  min_order_qty: string;
  stock_quantity: string;
  status: string;
}

const EMPTY_FORM: FormState = {
  name: '',
  name_ar: '',
  sku: '',
  category: '',
  description: '',
  unit: 'carton',
  wholesale_price: '',
  retail_price: '',
  currency: 'YER',
  min_order_qty: '1',
  stock_quantity: '0',
  status: 'active',
};

const STATUS_LABEL: Record<string, string> = { active: 'نشط', draft: 'مسودة', archived: 'مؤرشف' };
const STATUS_CLS: Record<string, string> = {
  active: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40',
  draft: 'bg-amber-500/15 text-amber-300 border border-amber-500/40',
  archived: 'bg-slate-700 text-slate-300 border border-slate-600',
};

const CARD = 'bg-slate-900 border border-slate-800 rounded-2xl';
const INPUT =
  'w-full h-11 px-3 rounded-xl border border-slate-700 bg-slate-950 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500';

interface SupplierProductsProps {
  userId: string;
}

export default function SupplierProducts({ userId }: SupplierProductsProps) {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const load = useCallback(async () => {
    setError('');
    const { data, error: err } = await supabase
      .from('supplier_products')
      .select('id, name, name_ar, sku, category, description, unit, wholesale_price, retail_price, currency, min_order_qty, stock_quantity, status')
      .eq('supplier_id', userId)
      .order('created_at', { ascending: false });
    if (err) {
      setError(err.message);
      setRows([]);
    } else {
      setRows((data as ProductRow[]) ?? []);
    }
    setLoading(false);
  }, [supabase, userId]);

  useEffect(() => {
    load();
  }, [load]);

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setShowModal(true);
  };

  const openEdit = (p: ProductRow) => {
    setEditingId(p.id);
    setForm({
      name: p.name,
      name_ar: p.name_ar ?? '',
      sku: p.sku ?? '',
      category: p.category ?? '',
      description: p.description ?? '',
      unit: p.unit || 'piece',
      wholesale_price: String(p.wholesale_price ?? ''),
      retail_price: p.retail_price == null ? '' : String(p.retail_price),
      currency: p.currency || 'YER',
      min_order_qty: String(p.min_order_qty ?? 1),
      stock_quantity: String(p.stock_quantity ?? 0),
      status: p.status || 'active',
    });
    setFormError('');
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!form.name.trim() && !form.name_ar.trim()) {
      setFormError('اسم المنتج مطلوب.');
      return;
    }
    const wholesale = parseFloat(form.wholesale_price);
    if (Number.isNaN(wholesale) || wholesale < 0) {
      setFormError('سعر الجملة مطلوب ويجب أن يكون رقمًا صحيحًا.');
      return;
    }
    const retail = form.retail_price.trim() === '' ? null : parseFloat(form.retail_price);
    if (retail !== null && (Number.isNaN(retail) || retail < 0)) {
      setFormError('سعر التجزئة غير صحيح.');
      return;
    }
    const minQty = parseInt(form.min_order_qty, 10);
    const stock = parseInt(form.stock_quantity, 10);
    if (Number.isNaN(minQty) || minQty < 1 || Number.isNaN(stock) || stock < 0) {
      setFormError('الحد الأدنى للطلب والمخزون يجب أن يكونا أرقامًا صحيحة.');
      return;
    }
    setSaving(true);
    const payload = {
      supplier_id: userId,
      name: form.name.trim() || form.name_ar.trim(),
      name_ar: form.name_ar.trim() || null,
      sku: form.sku.trim() || null,
      category: form.category.trim() || null,
      description: form.description.trim() || null,
      unit: form.unit,
      wholesale_price: wholesale,
      retail_price: retail,
      currency: form.currency,
      min_order_qty: minQty,
      stock_quantity: stock,
      status: form.status,
    };
    const { error: err } = editingId
      ? await supabase.from('supplier_products').update(payload).eq('id', editingId).eq('supplier_id', userId)
      : await supabase.from('supplier_products').insert(payload);
    setSaving(false);
    if (err) {
      setFormError(err.message);
      return;
    }
    setShowModal(false);
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
    await load();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-base sm:text-lg font-bold text-white">المنتجات للبيع (جملة وتجزئة)</h2>
        <button
          type="button"
          onClick={openAdd}
          className="bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-colors"
        >
          + إضافة منتج
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-semibold rounded-xl px-4 py-3">{error}</div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <div className={`${CARD} p-10 text-center text-sm text-slate-400`}>لا توجد منتجات بعد. أضف منتجك الأول.</div>
      ) : (
        <div className={`${CARD} overflow-x-auto`}>
          <table className="w-full text-sm">
            <thead className="bg-slate-800/60 text-slate-300">
              <tr>
                <th className="text-right px-4 py-3 font-medium">المنتج</th>
                <th className="text-right px-4 py-3 font-medium">الوحدة</th>
                <th className="text-right px-4 py-3 font-medium">سعر الجملة</th>
                <th className="text-right px-4 py-3 font-medium">سعر التجزئة</th>
                <th className="text-right px-4 py-3 font-medium">الحد الأدنى</th>
                <th className="text-right px-4 py-3 font-medium">المخزون</th>
                <th className="text-right px-4 py-3 font-medium">الحالة</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {rows.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-white">{p.name_ar || p.name}</p>
                    <p className="text-xs text-slate-500">{[p.sku, p.category].filter(Boolean).join(' • ') || '—'}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-300">{supplierUnitLabel(p.unit)}</td>
                  <td className="px-4 py-3 text-slate-100">{p.wholesale_price} {p.currency}</td>
                  <td className="px-4 py-3 text-slate-300">{p.retail_price == null ? '—' : `${p.retail_price} ${p.currency}`}</td>
                  <td className="px-4 py-3 text-slate-300">{p.min_order_qty}</td>
                  <td className="px-4 py-3 text-slate-300">{p.stock_quantity}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${STATUS_CLS[p.status] || STATUS_CLS.draft}`}>
                      {STATUS_LABEL[p.status] || p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-left">
                    <button type="button" onClick={() => openEdit(p)} className="text-cyan-300 text-xs font-semibold hover:underline ml-3">تعديل</button>
                    <button type="button" onClick={() => handleDelete(p.id)} className="text-red-400 text-xs font-semibold hover:underline">حذف</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <form onSubmit={handleSave} className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-slate-900 border border-slate-700 rounded-2xl p-5 space-y-4" noValidate>
            <h3 className="text-base font-black text-white">{editingId ? 'تعديل منتج' : 'إضافة منتج جديد'}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="sp-name-ar" className="block text-xs font-bold text-slate-300 mb-1.5">اسم المنتج (عربي) *</label>
                <input id="sp-name-ar" className={INPUT} value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} />
              </div>
              <div>
                <label htmlFor="sp-name" className="block text-xs font-bold text-slate-300 mb-1.5">Product name (English)</label>
                <input id="sp-name" dir="ltr" className={INPUT} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label htmlFor="sp-sku" className="block text-xs font-bold text-slate-300 mb-1.5">SKU</label>
                <input id="sp-sku" dir="ltr" className={INPUT} value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
              </div>
              <div>
                <label htmlFor="sp-cat" className="block text-xs font-bold text-slate-300 mb-1.5">التصنيف</label>
                <input id="sp-cat" className={INPUT} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
              </div>
              <div>
                <label htmlFor="sp-unit" className="block text-xs font-bold text-slate-300 mb-1.5">وحدة البيع</label>
                <select id="sp-unit" className={INPUT} value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
                  {SUPPLIER_UNIT_OPTIONS.map((u) => (
                    <option key={u.value} value={u.value}>{u.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="sp-currency" className="block text-xs font-bold text-slate-300 mb-1.5">العملة</label>
                <select id="sp-currency" className={INPUT} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                  <option value="YER">ريال يمني (YER)</option>
                  <option value="SAR">ريال سعودي (SAR)</option>
                  <option value="USD">دولار (USD)</option>
                </select>
              </div>
              <div>
                <label htmlFor="sp-wholesale" className="block text-xs font-bold text-slate-300 mb-1.5">سعر الجملة *</label>
                <input id="sp-wholesale" type="number" min={0} step="0.01" className={INPUT} value={form.wholesale_price} onChange={(e) => setForm({ ...form, wholesale_price: e.target.value })} />
              </div>
              <div>
                <label htmlFor="sp-retail" className="block text-xs font-bold text-slate-300 mb-1.5">سعر التجزئة</label>
                <input id="sp-retail" type="number" min={0} step="0.01" className={INPUT} value={form.retail_price} onChange={(e) => setForm({ ...form, retail_price: e.target.value })} />
              </div>
              <div>
                <label htmlFor="sp-moq" className="block text-xs font-bold text-slate-300 mb-1.5">الحد الأدنى للطلب</label>
                <input id="sp-moq" type="number" min={1} className={INPUT} value={form.min_order_qty} onChange={(e) => setForm({ ...form, min_order_qty: e.target.value })} />
              </div>
              <div>
                <label htmlFor="sp-stock" className="block text-xs font-bold text-slate-300 mb-1.5">الكمية المتاحة</label>
                <input id="sp-stock" type="number" min={0} className={INPUT} value={form.stock_quantity} onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })} />
              </div>
              <div>
                <label htmlFor="sp-status" className="block text-xs font-bold text-slate-300 mb-1.5">الحالة</label>
                <select id="sp-status" className={INPUT} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="active">نشط</option>
                  <option value="draft">مسودة</option>
                  <option value="archived">مؤرشف</option>
                </select>
              </div>
            </div>
            <div>
              <label htmlFor="sp-desc" className="block text-xs font-bold text-slate-300 mb-1.5">الوصف</label>
              <textarea id="sp-desc" rows={3} className="w-full px-3 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            {formError && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-semibold rounded-xl px-4 py-3">{formError}</div>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowModal(false)} className="h-11 px-5 rounded-xl border border-slate-700 text-slate-300 text-sm font-semibold hover:bg-slate-800">إلغاء</button>
              <button type="submit" disabled={saving} className="h-11 px-6 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-bold disabled:opacity-60">
                {saving ? 'جارٍ الحفظ...' : 'حفظ'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
