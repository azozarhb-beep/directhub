'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { SUPPLIER_UNIT_OPTIONS, supplierUnitLabel } from './supplierUnits';

interface InventoryRow {
  id: string;
  item_name: string | null;
  sku: string;
  warehouse_location: string | null;
  stock_quantity: number;
  reorder_level: number;
  batch_number: string | null;
  unit: string;
  notes: string | null;
}

interface FormState {
  item_name: string;
  sku: string;
  warehouse_location: string;
  stock_quantity: string;
  reorder_level: string;
  batch_number: string;
  unit: string;
  notes: string;
}

const EMPTY_FORM: FormState = {
  item_name: '',
  sku: '',
  warehouse_location: '',
  stock_quantity: '0',
  reorder_level: '0',
  batch_number: '',
  unit: 'carton',
  notes: '',
};

const CARD = 'bg-slate-900 border border-slate-800 rounded-2xl';
const INPUT =
  'w-full h-11 px-3 rounded-xl border border-slate-700 bg-slate-950 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500';

interface SupplierInventoryProps {
  userId: string;
}

export default function SupplierInventory({ userId }: SupplierInventoryProps) {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setError('');
    const { data, error: err } = await supabase
      .from('local_inventory')
      .select('id, item_name, sku, warehouse_location, stock_quantity, reorder_level, batch_number, unit, notes')
      .eq('supplier_id', userId)
      .order('updated_at', { ascending: false });
    if (err) {
      setError(err.message);
      setRows([]);
    } else {
      setRows((data as InventoryRow[]) ?? []);
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

  const openEdit = (row: InventoryRow) => {
    setEditingId(row.id);
    setForm({
      item_name: row.item_name ?? '',
      sku: row.sku,
      warehouse_location: row.warehouse_location ?? '',
      stock_quantity: String(row.stock_quantity),
      reorder_level: String(row.reorder_level),
      batch_number: row.batch_number ?? '',
      unit: row.unit || 'piece',
      notes: row.notes ?? '',
    });
    setFormError('');
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!form.sku.trim()) {
      setFormError('رمز الصنف (SKU) مطلوب.');
      return;
    }
    const stock = parseInt(form.stock_quantity, 10);
    const reorder = parseInt(form.reorder_level, 10);
    if (Number.isNaN(stock) || stock < 0 || Number.isNaN(reorder) || reorder < 0) {
      setFormError('الكمية وحد إعادة الطلب يجب أن تكونا أرقامًا موجبة.');
      return;
    }
    setSaving(true);
    const payload = {
      supplier_id: userId,
      item_name: form.item_name.trim() || null,
      sku: form.sku.trim(),
      warehouse_location: form.warehouse_location.trim() || null,
      stock_quantity: stock,
      reorder_level: reorder,
      batch_number: form.batch_number.trim() || null,
      unit: form.unit,
      notes: form.notes.trim() || null,
    };
    const { error: err } = editingId
      ? await supabase.from('local_inventory').update(payload).eq('id', editingId).eq('supplier_id', userId)
      : await supabase.from('local_inventory').insert(payload);
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
    if (!confirm('هل أنت متأكد من حذف هذا الصنف من المستودع؟')) return;
    const { error: err } = await supabase.from('local_inventory').delete().eq('id', id).eq('supplier_id', userId);
    if (err) {
      setError(err.message);
      return;
    }
    await load();
  };

  const filtered = rows.filter((r) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      (r.item_name ?? '').toLowerCase().includes(q) ||
      r.sku.toLowerCase().includes(q) ||
      (r.warehouse_location ?? '').toLowerCase().includes(q)
    );
  });
  const lowStock = rows.filter((r) => r.stock_quantity <= r.reorder_level).length;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-gradient-to-l from-cyan-900/40 via-slate-900 to-slate-900 border border-cyan-500/20 p-5 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-black text-white">إدارة المستودع والمخزون</h2>
          <p className="text-xs text-slate-400 mt-1">
            {rows.length} صنف • {lowStock > 0 ? `${lowStock} تحت حد إعادة الطلب` : 'كل الأصناف ضمن الحد الآمن'}
          </p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-colors"
        >
          + إضافة صنف / بضاعة للمستودع
        </button>
      </div>

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="بحث بالاسم أو SKU أو موقع المستودع"
        className={INPUT}
      />

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-semibold rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className={`${CARD} p-10 text-center text-sm text-slate-400`}>لا توجد أصناف في المستودع بعد</div>
      ) : (
        <div className={`${CARD} overflow-x-auto`}>
          <table className="w-full text-sm">
            <thead className="bg-slate-800/60 text-slate-300">
              <tr>
                <th className="text-right px-4 py-3 font-medium">الصنف</th>
                <th className="text-right px-4 py-3 font-medium">SKU</th>
                <th className="text-right px-4 py-3 font-medium">الموقع</th>
                <th className="text-right px-4 py-3 font-medium">الكمية</th>
                <th className="text-right px-4 py-3 font-medium">حد إعادة الطلب</th>
                <th className="text-right px-4 py-3 font-medium">رقم الدفعة</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filtered.map((r) => {
                const low = r.stock_quantity <= r.reorder_level;
                return (
                  <tr key={r.id}>
                    <td className="px-4 py-3 text-white font-medium">{r.item_name || '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-300">{r.sku}</td>
                    <td className="px-4 py-3 text-slate-300">{r.warehouse_location || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={low ? 'text-amber-300 font-bold' : 'text-slate-100'}>
                        {r.stock_quantity} {supplierUnitLabel(r.unit)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{r.reorder_level}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{r.batch_number || '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-left">
                      <button type="button" onClick={() => openEdit(r)} className="text-cyan-300 text-xs font-semibold hover:underline ml-3">
                        تعديل
                      </button>
                      <button type="button" onClick={() => handleDelete(r.id)} className="text-red-400 text-xs font-semibold hover:underline">
                        حذف
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <form onSubmit={handleSave} className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-slate-900 border border-slate-700 rounded-2xl p-5 space-y-4" noValidate>
            <h3 className="text-base font-black text-white">
              {editingId ? 'تعديل صنف في المستودع' : '+ إضافة صنف / بضاعة للمستودع'}
            </h3>
            <div>
              <label htmlFor="inv-name" className="block text-xs font-bold text-slate-300 mb-1.5">اسم الصنف</label>
              <input id="inv-name" className={INPUT} value={form.item_name} onChange={(e) => setForm({ ...form, item_name: e.target.value })} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="inv-sku" className="block text-xs font-bold text-slate-300 mb-1.5">SKU *</label>
                <input id="inv-sku" dir="ltr" className={INPUT} value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
              </div>
              <div>
                <label htmlFor="inv-unit" className="block text-xs font-bold text-slate-300 mb-1.5">وحدة القياس التجارية</label>
                <select id="inv-unit" className={INPUT} value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
                  {SUPPLIER_UNIT_OPTIONS.map((u) => (
                    <option key={u.value} value={u.value}>{u.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="inv-qty" className="block text-xs font-bold text-slate-300 mb-1.5">الكمية بالمخزون</label>
                <input id="inv-qty" type="number" min={0} className={INPUT} value={form.stock_quantity} onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })} />
              </div>
              <div>
                <label htmlFor="inv-reorder" className="block text-xs font-bold text-slate-300 mb-1.5">حد إعادة الطلب</label>
                <input id="inv-reorder" type="number" min={0} className={INPUT} value={form.reorder_level} onChange={(e) => setForm({ ...form, reorder_level: e.target.value })} />
              </div>
              <div>
                <label htmlFor="inv-loc" className="block text-xs font-bold text-slate-300 mb-1.5">موقع المستودع</label>
                <input id="inv-loc" className={INPUT} value={form.warehouse_location} onChange={(e) => setForm({ ...form, warehouse_location: e.target.value })} />
              </div>
              <div>
                <label htmlFor="inv-batch" className="block text-xs font-bold text-slate-300 mb-1.5">رقم الدفعة</label>
                <input id="inv-batch" dir="ltr" className={INPUT} value={form.batch_number} onChange={(e) => setForm({ ...form, batch_number: e.target.value })} />
              </div>
            </div>
            <div>
              <label htmlFor="inv-notes" className="block text-xs font-bold text-slate-300 mb-1.5">ملاحظات</label>
              <textarea id="inv-notes" rows={2} className="w-full px-3 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            {formError && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-semibold rounded-xl px-4 py-3">{formError}</div>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowModal(false)} className="h-11 px-5 rounded-xl border border-slate-700 text-slate-300 text-sm font-semibold hover:bg-slate-800">
                إلغاء
              </button>
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
