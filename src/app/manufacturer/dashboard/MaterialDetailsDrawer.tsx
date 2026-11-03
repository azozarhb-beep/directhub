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

const CURRENCY_LABELS: Record<string, string> = {
  YER_SANAA: 'ر.ي (صنعاء - طبعة قديمة)',
  YER_ADEN: 'ر.ي (عدن - طبعة جديدة)',
  YER: 'ر.ي (صنعاء)',
  USD: 'دولار أمريكي ($ USD)',
  SAR: 'ريال سعودي (SAR)',
};

const inputClass =
  'w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 transition-colors';

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
    currency: 'YER_SANAA',
    warehouse_location: '',
    reorder_level: '',
    supplier_name: '',
    batch_number: '',
  });

  const formatCurrency = (amount?: number | null, cur?: string | null) => {
    if (amount == null) return '—';
    const c = String(cur || 'YER_SANAA').toUpperCase();
    const symbol =
      c === 'YER_SANAA' || c === 'YER' ? 'ر.ي (صنعاء)' :
      c === 'YER_ADEN' ? 'ر.ي (عدن)' :
      c === 'SAR' ? 'ر.س' :
      c === 'USD' ? '$' : c;
    return `${Number(amount).toLocaleString('en-US')} ${symbol}`;
  };

  const syncForm = (it: any) =>
    setForm({
      material_name: it?.material_name || '',
      material_name_ar: it?.material_name_ar || '',
      material_code: it?.material_code || '',
      unit_cost: it?.unit_cost != null ? String(it.unit_cost) : '',
      currency: it?.currency || 'YER_SANAA',
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
  }, [supabase]);

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
      setError(L('الكمية المصروفة أكبر من الرصيد المتوفر في المخزن', 'Quantity exceeds available stock'));
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
        reference: adjustRef.trim() || (adjustMode === 'in' ? 'توريد مخزني جديد' : 'صرف لخط الإنتاج والتصنيع'),
      });
      if (mvErr) throw mvErr;

      setAdjustMode(null);
      setAdjustQty('');
      setAdjustRef('');
      await refresh();
    } catch (e: any) {
      setError(e?.message || L('فشل تحديث حركة المخزون', 'Failed to update stock'));
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
        currency: form.currency,
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
      return new Date(iso).toLocaleString(isAr ? 'ar-SA' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' });
    } catch {
      return iso;
    }
  };

  const name = current.material_name_ar || current.material_name;

  return (
    <div className="fixed inset-0 z-[100] flex justify-end bg-black/60 backdrop-blur-sm" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="bg-card border-l border-border w-full max-w-lg h-full overflow-y-auto shadow-2xl"
        dir={isAr ? 'rtl' : 'ltr'}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-card z-10">
          <div className="min-w-0">
            <h3 className="text-base font-bold text-foreground truncate">{name}</h3>
            <p className="text-xs text-muted-foreground">{L('إدارة حركة المخزون وخطوط الإنتاج', 'Stock & Production Movement')}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
            aria-label={L('إغلاق', 'Close')}
          >
            <Icon name="XMarkIcon" size={20} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Stock summary */}
          <div className="rounded-2xl border border-border p-4 bg-muted/30">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-muted-foreground">{L('الرصيد الفعلي بالمخزن', 'Available stock')}</p>
                <p className="text-2xl font-black text-foreground mt-0.5">
                  {qty.toLocaleString('en-US')} <span className="text-xs font-bold text-primary">{current.unit}</span>
                </p>
              </div>
              <span
                className={`text-xs px-2.5 py-1 rounded-full font-bold border ${
                  qty <= 0
                    ? 'bg-red-50 text-red-700 border-red-200'
                    : isLow
                    ? 'bg-amber-50 text-amber-800 border-amber-300'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}
              >
                {qty <= 0
                  ? L('نفد المخزون', 'Out of Stock')
                  : isLow
                  ? L('⚠️ تنبيه: إعادة طلب', '⚠️ Reorder Alert')
                  : L('متوفر كافي', 'Available')}
              </span>
            </div>
            {reorder != null && (
              <p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border/60">
                {L('الحد الأدنى للتنبيه:', 'Reorder threshold:')}{' '}
                <strong className="text-foreground">
                  {reorder.toLocaleString('en-US')} {current.unit}
                </strong>
              </p>
            )}
          </div>

          {/* Quick adjust (Stock in / Stock out to production) */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setAdjustMode(adjustMode === 'in' ? null : 'in');
                  setError('');
                }}
                className={`px-3 py-2.5 rounded-xl text-xs sm:text-sm font-bold border transition-all ${
                  adjustMode === 'in' ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                }`}
              >
                + {L('توريد خامات جديدة', 'Stock In')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setAdjustMode(adjustMode === 'out' ? null : 'out');
                  setError('');
                }}
                className={`px-3 py-2.5 rounded-xl text-xs sm:text-sm font-bold border transition-all ${
                  adjustMode === 'out' ? 'bg-red-600 text-white border-red-600 shadow-sm' : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                }`}
              >
                − {L('صرف لخط الإنتاج', 'Dispense to Line')}
              </button>
            </div>
            {adjustMode && (
              <div className="rounded-xl border border-border p-3.5 space-y-2.5 bg-card shadow-sm">
                <label className="block text-xs font-bold text-foreground">
                  {adjustMode === 'in' ? L('الكمية الواردة للمخزن', 'Quantity In') : L('الكمية المصروفة للتشغيل والتصنيع', 'Quantity Out')} ({current.unit})
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(e.target.value)}
                  placeholder={`أدخل الكمية بـ (${current.unit})`}
                  className={inputClass}
                />
                <input
                  type="text"
                  value={adjustRef}
                  onChange={(e) => setAdjustRef(e.target.value)}
                  placeholder={
                    adjustMode === 'in'
                      ? L('رقم فاتورة الشراء / المورد / الشحنة (اختياري)', 'Invoice / Supplier / Batch ref')
                      : L('أمر التشغيل / خط الإنتاج / رقم الـ Batch (اختياري)', 'Production work order / line / batch')
                  }
                  className={inputClass}
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleAdjust}
                  className="w-full h-10 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs sm:text-sm font-bold disabled:opacity-60 transition-colors shadow-sm"
                >
                  {busy ? L('جارٍ التأكيد...', 'Saving...') : L('تأكيد وتسجيل الحركة في السجل', 'Confirm Movement')}
                </button>
              </div>
            )}
          </div>

          {error && (
            <div className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-center gap-1.5">
              <Icon name="ExclamationCircleIcon" size={15} />
              {error}
            </div>
          )}

          {/* Supplier & spec details */}
          <div className="rounded-2xl border border-border p-4 space-y-3 bg-card shadow-sm">
            <div className="flex items-center justify-between border-b border-border pb-2.5">
              <h4 className="text-xs sm:text-sm font-bold text-foreground">{L('بيانات التكلفة والموقع والمواصفات', 'Cost, Location & Specs')}</h4>
              {!editing && (
                <button
                  type="button"
                  onClick={() => {
                    syncForm(current);
                    setEditing(true);
                    setError('');
                  }}
                  className="text-xs font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1"
                >
                  <Icon name="PencilSquareIcon" size={13} />
                  {L('تعديل البيانات', 'Edit')}
                </button>
              )}
            </div>

            {editing ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">{L('الاسم (عربي) *', 'Name (Arabic) *')}</label>
                    <input dir="rtl" className={inputClass} value={form.material_name_ar} onChange={(e) => setForm({ ...form, material_name_ar: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">{L('الاسم (إنجليزي)', 'Name (English)')}</label>
                    <input dir="ltr" className={inputClass} value={form.material_name} onChange={(e) => setForm({ ...form, material_name: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">{L('كود المادة (SKU)', 'Material code')}</label>
                    <input dir="ltr" className={inputClass} value={form.material_code} onChange={(e) => setForm({ ...form, material_code: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">{L('موقع التخزين / المستودع', 'Warehouse')}</label>
                    <input className={inputClass} value={form.warehouse_location} onChange={(e) => setForm({ ...form, warehouse_location: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">{L('سعر تكلفة الوحدة', 'Unit cost')}</label>
                    <input type="number" min="0" step="any" className={inputClass} value={form.unit_cost} onChange={(e) => setForm({ ...form, unit_cost: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">{L('عملة التكلفة', 'Cost Currency')}</label>
                    <select
                      className={inputClass}
                      value={form.currency}
                      onChange={(e) => setForm({ ...form, currency: e.target.value })}
                    >
                      {Object.entries(CURRENCY_LABELS).map(([val, lbl]) => (
                        <option key={val} value={val}>{lbl}</option>
                      ))}
                    </select>
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
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">{L('رقم الدفعة (Batch Number)', 'Batch number')}</label>
                  <input dir="ltr" className={inputClass} value={form.batch_number} onChange={(e) => setForm({ ...form, batch_number: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    {L('شهادة التحليل / الفحص (COA)', 'Certificate of Analysis (COA)')}
                  </label>
                  <input
                    type="file"
                    accept="application/pdf,image/jpeg,image/png,image/webp"
                    onChange={(e) => setCoaFile(e.target.files?.[0] || null)}
                    className="block w-full text-xs text-muted-foreground file:mr-3 file:rtl:ml-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-amber-600 file:text-white file:text-xs file:font-bold"
                  />
                  {current.coa_name && !coaFile && (
                    <p className="text-[11px] text-muted-foreground mt-1">{L('الملف المرفق حالياً:', 'Current file:')} {current.coa_name}</p>
                  )}
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setEditing(false);
                      setCoaFile(null);
                      setError('');
                    }}
                    className="px-4 py-2 rounded-lg border border-border text-xs sm:text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-50"
                  >
                    {L('إلغاء', 'Cancel')}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleSaveEdit}
                    className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs sm:text-sm font-bold disabled:opacity-60 transition-colors shadow-sm"
                  >
                    {busy ? L('جارٍ الحفظ...', 'Saving...') : L('حفظ التعديلات', 'Save')}
                  </button>
                </div>
              </div>
            ) : (
              <dl className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-muted/30 p-2.5 rounded-xl">
                  <dt className="text-muted-foreground mb-0.5">{L('تكلفة شراء الوحدة', 'Unit cost')}</dt>
                  <dd className="font-bold text-primary">{formatCurrency(current.unit_cost, current.currency)}</dd>
                </div>
                <div className="bg-muted/30 p-2.5 rounded-xl">
                  <dt className="text-muted-foreground mb-0.5">{L('موقع التخزين والمستودع', 'Warehouse')}</dt>
                  <dd className="font-bold text-foreground">{current.warehouse_location || '—'}</dd>
                </div>
                <div className="bg-muted/30 p-2.5 rounded-xl">
                  <dt className="text-muted-foreground mb-0.5">{L('المورد المسجل', 'Supplier')}</dt>
                  <dd className="font-bold text-foreground">{current.supplier_name || '—'}</dd>
                </div>
                <div className="bg-muted/30 p-2.5 rounded-xl">
                  <dt className="text-muted-foreground mb-0.5">{L('رقم الدفعة (Batch)', 'Batch no.')}</dt>
                  <dd className="font-mono font-bold text-foreground" dir="ltr">{current.batch_number || '—'}</dd>
                </div>
                {current.coa_url && (
                  <div className="col-span-2 bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-800">{L('شهادة الفحص المخبري (COA)', 'COA Document')}</span>
                    <a
                      href={current.coa_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-bold text-emerald-700 hover:underline flex items-center gap-1"
                    >
                      <Icon name="DocumentArrowDownIcon" size={14} />
                      {current.coa_name || L('تحميل الملف', 'Download')}
                    </a>
                  </div>
                )}
              </dl>
            )}
          </div>

          {/* Movement history */}
          <div className="rounded-2xl border border-border p-4 bg-card shadow-sm">
            <h4 className="text-xs sm:text-sm font-bold text-foreground mb-3 flex items-center gap-2">
              <Icon name="ClockIcon" size={16} className="text-amber-600" />
              {L('سجل حركات التوريد والصرف للإنتاج', 'Movement & Consumption Log')}
            </h4>
            {loadingMoves ? (
              <div className="flex justify-center py-6">
                <div className="w-6 h-6 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : movements.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                {L('لا توجد حركات توريد أو صرف مسجلة بعد', 'No movements recorded yet')}
              </p>
            ) : (
              <ul className="space-y-2">
                {movements.map((m) => {
                  const inbound = m.movement_type === 'purchased' || m.movement_type === 'received';
                  return (
                    <li key={m.id} className="flex items-start justify-between gap-3 rounded-xl bg-muted/30 border border-border/80 px-3 py-2.5">
                      <div className="min-w-0">
                        <p className={`text-xs font-bold ${inbound ? 'text-emerald-700' : 'text-red-600'}`}>
                          {inbound
                            ? L('📥 توريد خام للمخزن', 'Stock Received')
                            : L('📤 صرف لخط الإنتاج والتصنيع', 'Issued to Production')}
                        </p>
                        {m.reference && <p className="text-[11px] font-semibold text-foreground/80 truncate mt-0.5">{m.reference}</p>}
                        <p className="text-[10px] text-muted-foreground mt-0.5">{fmtDate(m.created_at)}</p>
                      </div>
                      <div className="text-left shrink-0">
                        <p className={`text-sm font-black ${inbound ? 'text-emerald-700' : 'text-red-600'}`} dir="ltr">
                          {inbound ? '+' : '−'}{Number(m.quantity).toLocaleString('en-US')} {current.unit}
                        </p>
                        {m.balance_after != null && (
                          <p className="text-[10px] text-muted-foreground font-medium" dir="ltr">
                            الرصيد: {Number(m.balance_after).toLocaleString('en-US')}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Delete Action */}
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
            {confirmDelete ? (
              <div className="flex items-center gap-2 w-full bg-red-50 p-2.5 rounded-xl border border-red-200">
                <p className="text-xs text-red-700 flex-1 font-bold">
                  {L('سيتم حذف المادة وكامل سجل حركاتها نهائياً!', 'Confirm permanent deletion?')}
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setConfirmDelete(false)}
                  className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-foreground hover:bg-muted"
                >
                  {L('إلغاء', 'Cancel')}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleDelete}
                  className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold disabled:opacity-60"
                >
                  {L('نعم، احذف', 'Delete')}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold transition-colors"
              >
                <Icon name="TrashIcon" size={15} />
                {L('حذف الصنف من المخزن', 'Delete Material')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
