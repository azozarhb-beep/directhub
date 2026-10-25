'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
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
  unit_cost: number | null;
  cost_currency: string | null;
  inward_date: string | null;
  expiry_date: string | null;
  brand: string | null;
  sync_to_store: boolean | null;
  supplier_product_id: string | null;
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
  unit_cost: string;
  cost_currency: string;
  inward_date: string;
  expiry_date: string;
  brand: string;
  sync_to_store: boolean;
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
  unit_cost: '',
  cost_currency: 'YER',
  inward_date: '',
  expiry_date: '',
  brand: '',
  sync_to_store: false,
};

const CURRENCIES = [
  { value: 'YER', label: 'ريال يمني (YER)' },
  { value: 'SAR', label: 'ريال سعودي (SAR)' },
  { value: 'USD', label: 'دولار أمريكي (USD)' },
];

const SELECT_COLS =
  'id, item_name, sku, warehouse_location, stock_quantity, reorder_level, batch_number, unit, notes, unit_cost, cost_currency, inward_date, expiry_date, brand, sync_to_store, supplier_product_id';

const EXPIRY_ALERT_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

const CARD = 'bg-slate-900 border border-slate-800 rounded-2xl';
const INPUT =
  'w-full h-11 px-3 rounded-xl border border-slate-700 bg-slate-950 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500';
const LABEL = 'block text-xs font-bold text-slate-300 mb-1.5';

function daysUntil(dateStr: string | null, now: number): number | null {
  if (!dateStr) return null;
  const t = new Date(`${dateStr}T00:00:00`).getTime();
  if (Number.isNaN(t)) return null;
  return Math.ceil((t - now) / DAY_MS);
}

function fmt(n: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(n);
}

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
  const [now, setNow] = useState<number>(0);

  useEffect(() => {
    setNow(Date.now());
  }, []);

  const load = useCallback(async () => {
    setError('');
    const { data, error: err } = await supabase
      .from('local_inventory')
      .select(SELECT_COLS)
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
      unit_cost: row.unit_cost == null ? '' : String(row.unit_cost),
      cost_currency: row.cost_currency || 'YER',
      inward_date: row.inward_date ?? '',
      expiry_date: row.expiry_date ?? '',
      brand: row.brand ?? '',
      sync_to_store: Boolean(row.sync_to_store),
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
    const cost = form.unit_cost.trim() === '' ? null : parseFloat(form.unit_cost);
    if (cost !== null && (Number.isNaN(cost) || cost < 0)) {
      setFormError('تكلفة الوحدة غير صحيحة.');
      return;
    }
    if (form.inward_date && form.expiry_date && form.expiry_date < form.inward_date) {
      setFormError('تاريخ الانتهاء يجب أن يكون بعد تاريخ استلام الدفعة.');
      return;
    }
    setSaving(true);

    const existing = editingId ? rows.find((r) => r.id === editingId) : undefined;
    let linkedProductId: string | null = existing?.supplier_product_id ?? null;

    if (form.sync_to_store) {
      const productPayload = {
        supplier_id: userId,
        name: form.item_name.trim() || form.sku.trim(),
        name_ar: form.item_name.trim() || null,
        sku: form.sku.trim(),
        unit: form.unit,
        currency: form.cost_currency,
        stock_quantity: stock,
        low_stock_threshold: reorder,
        shelf_location: form.warehouse_location.trim() || null,
        status: 'active',
      };
      if (linkedProductId) {
        const { error: pErr } = await supabase
          .from('supplier_products')
          .update(productPayload)
          .eq('id', linkedProductId)
          .eq('supplier_id', userId);
        if (pErr) {
          setSaving(false);
          setFormError(pErr.message);
          return;
        }
      } else {
        const { data: created, error: pErr } = await supabase
          .from('supplier_products')
          .insert({ ...productPayload, wholesale_price: 0 })
          .select('id')
          .single();
        if (pErr) {
          setSaving(false);
          setFormError(pErr.message);
          return;
        }
        linkedProductId = (created as { id: string } | null)?.id ?? null;
      }
    } else if (linkedProductId) {
      await supabase
        .from('supplier_products')
        .update({ status: 'draft' })
        .eq('id', linkedProductId)
        .eq('supplier_id', userId);
    }

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
      unit_cost: cost,
      cost_currency: form.cost_currency,
      inward_date: form.inward_date || null,
      expiry_date: form.expiry_date || null,
      brand: form.brand.trim() || null,
      sync_to_store: form.sync_to_store,
      supplier_product_id: linkedProductId,
    };
    const { error: err } = editingId
      ? await supabase.from('local_inventory').update(payload).eq('id', editingId).eq('supplier_id', userId)
      : await supabase.from('local_inventory').insert(payload);
    setSaving(false);
    if (err) {
      setFormError(err.message);
      return;
    }
    if (form.sync_to_store) {
      toast.success('تم عرض الصنف في المتجر (المنتجات)');
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
      (r.warehouse_location ?? '').toLowerCase().includes(q) ||
      (r.brand ?? '').toLowerCase().includes(q)
    );
  });
  const lowStock = rows.filter((r) => r.stock_quantity <= r.reorder_level).length;

  const expiringCount = useMemo(() => {
    if (!now) return 0;
    return rows.filter((r) => {
      const d = daysUntil(r.expiry_date, now);
      return d !== null && d <= EXPIRY_ALERT_DAYS;
    }).length;
  }, [rows, now]);

  const valuation = useMemo(() => {
    const totals: Record<string, number> = {};
    rows.forEach((r) => {
      if (r.unit_cost == null) return;
      const cur = r.cost_currency || 'YER';
      totals[cur] = (totals[cur] ?? 0) + Number(r.unit_cost) * Number(r.stock_quantity ?? 0);
    });
    return CURRENCIES.map((c) => ({ currency: c.value, total: totals[c.value] ?? 0 })).filter((v) => v.total > 0);
  }, [rows]);

  const formExpiryDays = now ? daysUntil(form.expiry_date || null, now) : null;

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

      {(valuation.length > 0 || expiringCount > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className={`${CARD} p-4`}>
            <p className="text-xs font-bold text-slate-400 mb-2">إجمالي قيمة المخزون (بسعر التكلفة)</p>
            {valuation.length === 0 ? (
              <p className="text-sm text-slate-500">—</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {valuation.map((v) => (
                  <span key={v.currency} className="px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-200 text-sm font-black">
                    {fmt(v.total)} {v.currency}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className={`${CARD} p-4`}>
            <p className="text-xs font-bold text-slate-400 mb-2">تنبيهات الصلاحية</p>
            {expiringCount > 0 ? (
              <p className="text-sm font-bold text-amber-300">
                {expiringCount} صنف منتهي أو قارب على الانتهاء خلال {EXPIRY_ALERT_DAYS} يومًا
              </p>
            ) : (
              <p className="text-sm text-emerald-300 font-semibold">لا توجد أصناف قاربت على الانتهاء</p>
            )}
          </div>
        </div>
      )}

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="بحث بالاسم أو SKU أو العلامة التجارية أو موقع المستودع"
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
                <th className="text-right px-4 py-3 font-medium">العلامة التجارية</th>
                <th className="text-right px-4 py-3 font-medium">الموقع</th>
                <th className="text-right px-4 py-3 font-medium">الكمية</th>
                <th className="text-right px-4 py-3 font-medium">التكلفة</th>
                <th className="text-right px-4 py-3 font-medium">الصلاحية</th>
                <th className="text-right px-4 py-3 font-medium">رقم الدفعة</th>
                <th className="text-right px-4 py-3 font-medium">المتجر</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filtered.map((r) => {
                const low = r.stock_quantity <= r.reorder_level;
                const days = now ? daysUntil(r.expiry_date, now) : null;
                const expired = days !== null && days < 0;
                const nearing = days !== null && days >= 0 && days <= EXPIRY_ALERT_DAYS;
                return (
                  <tr key={r.id}>
                    <td className="px-4 py-3 text-white font-medium">{r.item_name || '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-300">{r.sku}</td>
                    <td className="px-4 py-3 text-slate-300">{r.brand || '—'}</td>
                    <td className="px-4 py-3 text-slate-300">{r.warehouse_location || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={low ? 'text-amber-300 font-bold' : 'text-slate-100'}>
                        {r.stock_quantity} {supplierUnitLabel(r.unit)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-300 whitespace-nowrap">
                      {r.unit_cost == null ? '—' : `${fmt(Number(r.unit_cost))} ${r.cost_currency || 'YER'}`}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {!r.expiry_date ? (
                        <span className="text-slate-500 text-xs">—</span>
                      ) : expired ? (
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-red-500/15 text-red-300 border border-red-500/40">
                          منتهي ({r.expiry_date})
                        </span>
                      ) : nearing ? (
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/40">
                          ينتهي خلال {days} يوم
                        </span>
                      ) : (
                        <span className="text-slate-300 text-xs">{r.expiry_date}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{r.batch_number || '—'}</td>
                    <td className="px-4 py-3">
                      {r.sync_to_store ? (
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/40">معروض</span>
                      ) : (
                        <span className="text-slate-500 text-xs">—</span>
                      )}
                    </td>
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
              <label htmlFor="inv-name" className={LABEL}>اسم الصنف</label>
              <input id="inv-name" className={INPUT} value={form.item_name} onChange={(e) => setForm({ ...form, item_name: e.target.value })} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="inv-sku" className={LABEL}>SKU *</label>
                <input id="inv-sku" dir="ltr" className={INPUT} value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
              </div>
              <div>
                <label htmlFor="inv-unit" className={LABEL}>وحدة القياس التجارية</label>
                <select id="inv-unit" className={INPUT} value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
                  {SUPPLIER_UNIT_OPTIONS.map((u) => (
                    <option key={u.value} value={u.value}>{u.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="inv-qty" className={LABEL}>الكمية بالمخزون</label>
                <input id="inv-qty" type="number" min={0} className={INPUT} value={form.stock_quantity} onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })} />
              </div>
              <div>
                <label htmlFor="inv-reorder" className={LABEL}>حد إعادة الطلب</label>
                <input id="inv-reorder" type="number" min={0} className={INPUT} value={form.reorder_level} onChange={(e) => setForm({ ...form, reorder_level: e.target.value })} />
              </div>
              <div>
                <label htmlFor="inv-loc" className={LABEL}>موقع المستودع</label>
                <input id="inv-loc" className={INPUT} value={form.warehouse_location} onChange={(e) => setForm({ ...form, warehouse_location: e.target.value })} />
              </div>
              <div>
                <label htmlFor="inv-batch" className={LABEL}>رقم الدفعة</label>
                <input id="inv-batch" dir="ltr" className={INPUT} value={form.batch_number} onChange={(e) => setForm({ ...form, batch_number: e.target.value })} />
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 space-y-3">
              <p className="text-xs font-black text-cyan-300">تقييم المخزون</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="inv-cost" className={LABEL}>تكلفة الوحدة / كلفة الشراء</label>
                  <input id="inv-cost" type="number" min={0} step="0.01" dir="ltr" className={INPUT} value={form.unit_cost} onChange={(e) => setForm({ ...form, unit_cost: e.target.value })} />
                </div>
                <div>
                  <label htmlFor="inv-currency" className={LABEL}>العملة</label>
                  <select id="inv-currency" className={INPUT} value={form.cost_currency} onChange={(e) => setForm({ ...form, cost_currency: e.target.value })}>
                    {CURRENCIES.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              {form.unit_cost.trim() !== '' && !Number.isNaN(parseFloat(form.unit_cost)) && !Number.isNaN(parseInt(form.stock_quantity, 10)) && (
                <p className="text-xs text-slate-400">
                  قيمة هذا الصنف: <span className="text-cyan-200 font-bold">{fmt(parseFloat(form.unit_cost) * parseInt(form.stock_quantity, 10))} {form.cost_currency}</span>
                </p>
              )}
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 space-y-3">
              <p className="text-xs font-black text-cyan-300">التواريخ والصلاحية</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="inv-inward" className={LABEL}>تاريخ استلام الدفعة</label>
                  <input id="inv-inward" type="date" dir="ltr" className={INPUT} value={form.inward_date} onChange={(e) => setForm({ ...form, inward_date: e.target.value })} />
                </div>
                <div>
                  <label htmlFor="inv-expiry" className={LABEL}>تاريخ الانتهاء / الصلاحية (اختياري)</label>
                  <input id="inv-expiry" type="date" dir="ltr" className={INPUT} value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} />
                </div>
              </div>
              {formExpiryDays !== null && formExpiryDays < 0 && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-semibold rounded-xl px-3 py-2">
                  تنبيه: هذه الدفعة منتهية الصلاحية.
                </div>
              )}
              {formExpiryDays !== null && formExpiryDays >= 0 && formExpiryDays <= EXPIRY_ALERT_DAYS && (
                <div className="bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold rounded-xl px-3 py-2">
                  تنبيه: تنتهي صلاحية هذه الدفعة خلال {formExpiryDays} يومًا.
                </div>
              )}
            </div>

            <div>
              <label htmlFor="inv-brand" className={LABEL}>العلامة التجارية / الجهة المصنعة الموكلة</label>
              <input id="inv-brand" className={INPUT} value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
            </div>

            <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/40 p-3">
              <div>
                <p className="text-sm font-bold text-white">عرض الصنف مباشرة للبيع في المتجر والطلبات</p>
                <p className="text-[11px] text-slate-400 mt-0.5">يتم ربط الصنف تلقائيًا مع صفحة المنتجات</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={form.sync_to_store}
                aria-label="عرض الصنف مباشرة للبيع في المتجر والطلبات"
                onClick={() => setForm({ ...form, sync_to_store: !form.sync_to_store })}
                className={`relative shrink-0 w-12 h-7 rounded-full transition-colors ${form.sync_to_store ? 'bg-cyan-600' : 'bg-slate-700'}`}
              >
                <span
                  className={`absolute top-0.5 w-6 h-6 rounded-full bg-white transition-all ${form.sync_to_store ? 'right-0.5' : 'right-[22px]'}`}
                />
              </button>
            </div>

            <div>
              <label htmlFor="inv-notes" className={LABEL}>ملاحظات</label>
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
