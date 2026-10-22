'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';

interface MaterialDetailsDrawerProps {
  item: any | null;
  onClose: () => void;
  onChanged: () => void;
}

interface Movement {
  id: string;
  movement_type: string;
  quantity: number;
  balance_after: number | null;
  reference: string | null;
  note: string | null;
  created_at: string;
}

const inputClass =
  'w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-amber-500';

export default function MaterialDetailsDrawer({ item, onClose, onChanged }: MaterialDetailsDrawerProps) {
  const supabase = createClient();
  const { user } = useAuth();
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const L = (ar: string, en: string) => (isAr ? ar : en);

  const [movements, setMovements] = useState<Movement[]>([]);
  const [loadingMoves, setLoadingMoves] = useState(false);
  const [adjustMode, setAdjustMode] = useState<'in' | 'out' | null>(null);
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustRef, setAdjustRef] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [coaFile, setCoaFile] = useState<File | null>(null);
  const [current, setCurrent] = useState<any | null>(item);
  const [form, setForm] = useState({
    material_name: '',
    material_name_ar: '',
    material_code: '',
    unit_cost: '',
    warehouse_location: '',
    reorder_level: '',
    supplier_name: '',
    batch_number: '',
  });

  const syncForm = (it: any) =>
    setForm({
      material_name: it?.material_name || '',
      material_name_ar: it?.material_name_ar || '',
      material_code: it?.material_code || '',
      unit_cost: it?.unit_cost != null ? String(it.unit_cost) : '',
      warehouse_location: it?.warehouse_location || '',
      reorder_level: it?.reorder_level != null ? String(it.reorder_level) : '',
      supplier_name: it?.supplier_name || '',
      batch_number: it?.batch_number || '',
    });

  const loadMovements = useCallback(async (id: string) => {
    setLoadingMoves(true);
    try {
      const { data } = await supabase
        .from('inventory_movements')
        .select('*')
        .eq('item_id', id)
        .order('created_at', { ascending: false })
        .limit(100);
      setMovements((data as Movement[]) || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingMoves(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setCurrent(item);
    setAdjustMode(null);
    setAdjustQty('');
    setAdjustRef('');
    setError('');
    setEditing(false);
    setConfirmDelete(false);
    setCoaFile(null);
    if (item) {
      syncForm(item);
      loadMovements(item.id);
    } else {
      setMovements([]);
    }
  }, [item, loadMovements]);

  if (!item || !current) return null;

  const qty = Number(current.quantity_available ?? 0);
  const reorder = current.reorder_level != null ? Number(current.reorder_level) : null;
  const isLow = reorder != null && qty <= reorder;

  const refresh = async () => {
    const { data } = await supabase.from('inventory_items').select('*').eq('id', current.id).maybeSingle();
    if (data) {
      setCurrent(data);
      syncForm(data);
    }
    await loadMovements(current.id);
    onChanged();
  };

  const handleAdjust = async () => {
    if (!user?.id || !adjustMode) return;
    const amount = Number(adjustQty);
    if (adjustQty === '' || Number.isNaN(amount) || amount <= 0) {
      setError(L('أدخل كمية صحيحة', 'Enter a valid quantity'));
      return;
    }
    if (adjustMode === 'out' && amount > qty) {
      setError(L('الكمية المصروفة أكبر من المتاح', 'Quantity exceeds available stock'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      const newBalance = adjustMode === 'in' ? qty + amount : qty - amount;
      const { error: upErr } = await supabase
        .from('inventory_items')
        .update({ quantity_available: newBalance })
        .eq('id', current.id);
      if (upErr) throw upErr;
      const { error: mvErr } = await supabase.from('inventory_movements').insert({
        item_id: current.id,
        manufacturer_id: user.id,
        movement_type: adjustMode === 'in' ? 'purchased' : 'consumed',
        quantity: amount,
        balance_after: newBalance,
        reference: adjustRef.trim() || null,
      });
      if (mvErr) throw mvErr;
      setAdjustMode(null);
      setAdjustQty('');
      setAdjustRef('');
      await refresh();
    } catch (e: any) {
      setError(e?.message || L('فشل تحديث المخزون', 'Failed to update stock'));
    } finally {
      setBusy(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!user?.id) return;
    const reorderVal = form.reorder_level === '' ? null : Number(form.reorder_level);
    const costVal = form.unit_cost === '' ? null : Number(form.unit_cost);
    if (reorderVal !== null && (Number.isNaN(reorderVal) || reorderVal < 0)) {
      setError(L('حد إعادة الطلب غير صحيح', 'Invalid reorder threshold'));
      return;
    }
    if (costVal !== null && (Number.isNaN(costVal) || costVal < 0)) {
      setError(L('سعر التكلفة غير صحيح', 'Invalid unit cost'));
      return;
    }
    if (!form.material_name.trim() && !form.material_name_ar.trim()) {
      setError(L('أدخل اسم المادة', 'Enter the material name'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      const patch: Record<string, any> = {
        material_name: form.material_name.trim() || form.material_name_ar.trim(),
        material_name_ar: form.material_name_ar.trim() || null,
        material_code: form.material_code.trim() || null,
        unit_cost: costVal,
        warehouse_location: form.warehouse_location.trim() || null,
        reorder_level: reorderVal,
        supplier_name: form.supplier_name.trim() || null,
        batch_number: form.batch_number.trim() || null,
      };
      if (coaFile) {
        const ext = coaFile.name.split('.').pop() || 'pdf';
        const path = `factory-docs/${user.id}/coa/${current.id}_${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('factory-documents')
          .upload(path, coaFile, { upsert: false });
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from('factory-documents').getPublicUrl(path);
        patch.coa_url = urlData.publicUrl;
        patch.coa_name = coaFile.name;
      }
      const { error: updErr } = await supabase.from('inventory_items').update(patch).eq('id', current.id);
      if (updErr) throw updErr;
      setEditing(false);
      setCoaFile(null);
      await refresh();
    } catch (e: any) {
      setError(e?.message || L('فشل حفظ التعديلات', 'Failed to save changes'));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    setBusy(true);
    setError('');
    try {
      const { error: delErr } = await supabase.from('inventory_items').delete().eq('id', current.id);
      if (delErr) throw delErr;
      onChanged();
      onClose();
    } catch (e: any) {
      setError(e?.message || L('فشل حذف المادة', 'Failed to delete material'));
    } finally {
      setBusy(false);
    }
  };

  const fmtDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString(isAr ? 'ar' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' });
    } catch {
      return iso;
    }
  };

  const name = current.material_name_ar || current.material_name;

  return (
    <div className="fixed inset-0 z-[100] flex justify-end bg-black/60" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="bg-card border-l border-border w-full max-w-lg h-full overflow-y-auto"
        dir={isAr ? 'rtl' : 'ltr'}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-card z-10">
          <div className="min-w-0">
            <h3 className="text-base font-bold text-foreground truncate">{name}</h3>
            <p className="text-xs text-muted-foreground">{L('إدارة المادة', 'Material management')}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"
            aria-label={L('إغلاق', 'Close')}
          >
            <Icon name="XMarkIcon" size={20} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Stock summary */}
          <div className="rounded-xl border border-border p-4 bg-background">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs text-muted-foreground">{L('الكمية المتاحة', 'Available quantity')}</p>
                <p className="text-2xl font-bold text-foreground">
                  {qty} <span className="text-sm font-medium">{current.unit}</span>
                </p>
              </div>
              <span
                className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                  qty <= 0
                    ? 'bg-red-100 text-red-600'
                    : isLow
                    ? 'bg-amber-100 text-amber-700' :'bg-green-100 text-green-700'
                }`}
              >
                {qty <= 0
                  ? L('نفد', 'Out')
                  : isLow
                  ? L('⚠️ منخفض / إعادة طلب', '⚠️ Low / Reorder')
                  : L('متوفر', 'Available')}
              </span>
            </div>
            {reorder != null && (
              <p className="text-xs text-muted-foreground mt-2">
                {L('حد إعادة الطلب:', 'Reorder threshold:')}{' '}
                <strong className="text-foreground">
                  {reorder} {current.unit}
                </strong>
              </p>
            )}
          </div>

          {/* Quick adjust */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setAdjustMode(adjustMode === 'in' ? null : 'in');
                  setError('');
                }}
                className={`px-3 py-2.5 rounded-lg text-sm font-semibold border transition-colors ${
                  adjustMode === 'in' ?'bg-green-600 text-white border-green-600' :'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                }`}
              >
                + {L('توريد مخزون جديد', 'Stock In')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setAdjustMode(adjustMode === 'out' ? null : 'out');
                  setError('');
                }}
                className={`px-3 py-2.5 rounded-lg text-sm font-semibold border transition-colors ${
                  adjustMode === 'out' ?'bg-red-600 text-white border-red-600' :'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                }`}
              >
                − {L('صرف للإنتاج', 'Stock Out')}
              </button>
            </div>
            {adjustMode && (
              <div className="rounded-xl border border-border p-3 space-y-2 bg-background">
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(e.target.value)}
                  placeholder={`${L('الكمية', 'Quantity')} (${current.unit})`}
                  className={inputClass}
                />
                <input
                  type="text"
                  value={adjustRef}
                  onChange={(e) => setAdjustRef(e.target.value)}
                  placeholder={
                    adjustMode === 'in' ? L('مرجع التوريد / رقم الفاتورة (اختياري)', 'Purchase ref / invoice no. (optional)')
                      : L('خط الإنتاج / أمر التصنيع (اختياري)', 'Production line / order (optional)')
                  }
                  className={inputClass}
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleAdjust}
                  className="w-full px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold disabled:opacity-60"
                >
                  {busy ? L('جارٍ الحفظ...', 'Saving...') : L('تأكيد', 'Confirm')}
                </button>
              </div>
            )}
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
          )}

          {/* Supplier & spec details */}
          <div className="rounded-xl border border-border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-foreground">{L('تفاصيل المورد والمواصفات', 'Supplier & spec details')}</h4>
              {!editing && (
                <button
                  type="button"
                  onClick={() => {
                    syncForm(current);
                    setEditing(true);
                    setError('');
                  }}
                  className="text-xs font-semibold text-amber-600 hover:text-amber-700"
                >
                  {L('تعديل المادة', 'Edit')}
                </button>
              )}
            </div>

            {editing ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">{L('الاسم (عربي)', 'Name (Arabic)')}</label>
                    <input dir="rtl" className={inputClass} value={form.material_name_ar} onChange={(e) => setForm({ ...form, material_name_ar: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">{L('الاسم (إنجليزي)', 'Name (English)')}</label>
                    <input dir="ltr" className={inputClass} value={form.material_name} onChange={(e) => setForm({ ...form, material_name: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">{L('كود المادة', 'Material code')}</label>
                    <input dir="ltr" className={inputClass} value={form.material_code} onChange={(e) => setForm({ ...form, material_code: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">{L('موقع التخزين', 'Warehouse')}</label>
                    <input className={inputClass} value={form.warehouse_location} onChange={(e) => setForm({ ...form, warehouse_location: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">{L('سعر التكلفة', 'Unit cost')}</label>
                    <input type="number" min="0" step="any" className={inputClass} value={form.unit_cost} onChange={(e) => setForm({ ...form, unit_cost: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">
                      {L('حد إعادة الطلب', 'Reorder threshold')} ({current.unit})
                    </label>
                    <input type="number" min="0" step="any" className={inputClass} value={form.reorder_level} onChange={(e) => setForm({ ...form, reorder_level: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">{L('اسم المورد', 'Supplier name')}</label>
                    <input className={inputClass} value={form.supplier_name} onChange={(e) => setForm({ ...form, supplier_name: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">{L('رقم الدفعة (Batch)', 'Batch number')}</label>
                    <input dir="ltr" className={inputClass} value={form.batch_number} onChange={(e) => setForm({ ...form, batch_number: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    {L('شهادة التحليل (COA)', 'Certificate of Analysis (COA)')}
                  </label>
                  <input
                    type="file"
                    accept="application/pdf,image/jpeg,image/png,image/webp"
                    onChange={(e) => setCoaFile(e.target.files?.[0] || null)}
                    className="block w-full text-xs text-muted-foreground file:mr-3 file:rtl:ml-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-amber-500 file:text-white file:text-xs file:font-semibold"
                  />
                  {current.coa_name && !coaFile && (
                    <p className="text-[11px] text-muted-foreground mt-1">{L('الملف الحالي:', 'Current file:')} {current.coa_name}</p>
                  )}
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setEditing(false);
                      setCoaFile(null);
                      setError('');
                    }}
                    className="px-4 py-2 rounded-lg border border-border text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-50"
                  >
                    {L('إلغاء', 'Cancel')}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleSaveEdit}
                    className="px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold disabled:opacity-60"
                  >
                    {busy ? L('جارٍ الحفظ...', 'Saving...') : L('حفظ', 'Save')}
                  </button>
                </div>
              </div>
            ) : (
              <dl className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <dt className="text-muted-foreground">{L('المورد', 'Supplier')}</dt>
                  <dd className="font-semibold text-foreground">{current.supplier_name || '—'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{L('رقم الدفعة', 'Batch no.')}</dt>
                  <dd className="font-semibold text-foreground" dir="ltr">{current.batch_number || '—'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{L('كود المادة', 'Code')}</dt>
                  <dd className="font-semibold text-foreground" dir="ltr">{current.material_code || '—'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{L('موقع التخزين', 'Warehouse')}</dt>
                  <dd className="font-semibold text-foreground">{current.warehouse_location || '—'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{L('التكلفة', 'Unit cost')}</dt>
                  <dd className="font-semibold text-foreground">
                    {current.unit_cost != null ? `${current.unit_cost} ${current.currency || 'USD'}` : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{L('شهادة التحليل (COA)', 'COA')}</dt>
                  <dd className="font-semibold text-foreground">
                    {current.coa_url ? (
                      <a
                        href={current.coa_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-amber-600 hover:underline break-all"
                      >
                        {current.coa_name || L('عرض الملف', 'View file')}
                      </a>
                    ) : (
                      '—'
                    )}
                  </dd>
                </div>
              </dl>
            )}
          </div>

          {/* Movement history */}
          <div className="rounded-xl border border-border p-4">
            <h4 className="text-sm font-bold text-foreground mb-3">{L('سجل حركة المخزون', 'Stock movement history')}</h4>
            {loadingMoves ? (
              <div className="flex justify-center py-6">
                <div className="w-6 h-6 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : movements.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                {L('لا توجد حركات مسجلة بعد', 'No movements recorded yet')}
              </p>
            ) : (
              <ul className="space-y-2">
                {movements.map((m) => {
                  const inbound = m.movement_type === 'purchased' || m.movement_type === 'received';
                  return (
                    <li key={m.id} className="flex items-start justify-between gap-3 rounded-lg bg-background border border-border px-3 py-2">
                      <div className="min-w-0">
                        <p className={`text-xs font-semibold ${inbound ? 'text-green-700' : 'text-red-600'}`}>
                          {inbound
                            ? L('توريد / استلام', 'Purchased / Received')
                            : L('صرف لخطوط الإنتاج', 'Consumed by Production Lines')}
                        </p>
                        {m.reference && <p className="text-[11px] text-muted-foreground truncate">{m.reference}</p>}
                        <p className="text-[11px] text-muted-foreground">{fmtDate(m.created_at)}</p>
                      </div>
                      <div className="text-end shrink-0">
                        <p className={`text-sm font-bold ${inbound ? 'text-green-700' : 'text-red-600'}`} dir="ltr">
                          {inbound ? '+' : '−'}
                          {Number(m.quantity)} {current.unit}
                        </p>
                        {m.balance_after != null && (
                          <p className="text-[11px] text-muted-foreground" dir="ltr">
                            = {Number(m.balance_after)}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Delete */}
          <div className="flex items-center justify-between gap-2 pt-1">
            {confirmDelete ? (
              <div className="flex items-center gap-2 w-full">
                <p className="text-xs text-red-600 flex-1">
                  {L('سيتم حذف المادة وسجل حركتها نهائياً. هل أنت متأكد؟', 'This permanently deletes the material and its history. Are you sure?')}
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setConfirmDelete(false)}
                  className="px-3 py-2 rounded-lg border border-border text-xs font-semibold text-foreground hover:bg-muted"
                >
                  {L('إلغاء', 'Cancel')}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleDelete}
                  className="px-3 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold disabled:opacity-60"
                >
                  {L('تأكيد الحذف', 'Confirm delete')}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-sm font-semibold"
              >
                <Icon name="TrashIcon" size={16} />
                {L('حذف', 'Delete')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
