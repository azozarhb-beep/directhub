'use client';

import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';

interface AddInventoryMaterialModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

interface MaterialFormState {
  material_name: string;
  material_name_ar: string;
  material_code: string;
  category: string;
  quantity: string;
  unit: string;
  reorder_level: string;
  unit_cost: string;
  currency: string;
  warehouse_location: string;
}

const EMPTY_FORM: MaterialFormState = {
  material_name: '',
  material_name_ar: '',
  material_code: '',
  category: 'raw_material',
  quantity: '',
  unit: 'ton',
  reorder_level: '',
  unit_cost: '',
  currency: 'YER',
  warehouse_location: '',
};

const CATEGORIES = [
  { value: 'raw_material', ar: 'مواد خام أولية', en: 'Primary raw materials' },
  { value: 'packaging', ar: 'تعبئة وتغليف', en: 'Packaging' },
  { value: 'consumables', ar: 'مستهلكات', en: 'Consumables' },
];

const UNITS = [
  { value: 'ton', ar: 'طن', en: 'Ton' },
  { value: 'kg', ar: 'كجم', en: 'Kg' },
  { value: 'roll', ar: 'رول', en: 'Roll' },
  { value: 'carton', ar: 'كرتون', en: 'Carton' },
];

const CURRENCIES = [
  { value: 'YER', ar: 'ريال يمني (YER)', en: 'Yemeni Rial (YER)' },
  { value: 'SAR', ar: 'ريال سعودي (SAR)', en: 'Saudi Riyal (SAR)' },
  { value: 'USD', ar: 'دولار أمريكي (USD)', en: 'US Dollar (USD)' },
];

const inputClass =
  'w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-amber-500';

export default function AddInventoryMaterialModal({ open, onClose, onSaved }: AddInventoryMaterialModalProps) {
  const supabase = createClient();
  const { user } = useAuth();
  const { language } = useLanguage();
  const isAr = language === 'ar';

  const [form, setForm] = useState<MaterialFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const L = (ar: string, en: string) => (isAr ? ar : en);

  const setField = (key: keyof MaterialFormState, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleClose = () => {
    if (saving) return;
    setError('');
    setForm(EMPTY_FORM);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!user?.id) {
      setError(L('يجب تسجيل الدخول أولاً', 'Please sign in first'));
      return;
    }
    if (!form.material_name.trim() && !form.material_name_ar.trim()) {
      setError(L('أدخل اسم المادة', 'Enter the material name'));
      return;
    }
    const qty = Number(form.quantity);
    if (form.quantity === '' || Number.isNaN(qty) || qty < 0) {
      setError(L('أدخل كمية صحيحة', 'Enter a valid quantity'));
      return;
    }
    const reorder = form.reorder_level === '' ? null : Number(form.reorder_level);
    if (reorder !== null && (Number.isNaN(reorder) || reorder < 0)) {
      setError(L('حد إعادة التنبيه غير صحيح', 'Invalid alert threshold'));
      return;
    }
    const cost = form.unit_cost === '' ? null : Number(form.unit_cost);
    if (cost !== null && (Number.isNaN(cost) || cost < 0)) {
      setError(L('سعر التكلفة غير صحيح', 'Invalid unit cost'));
      return;
    }

    setSaving(true);
    try {
      const { error: insertError } = await supabase.from('inventory_items').insert({
        manufacturer_id: user.id,
        vendor_id: user.id,
        material_name: form.material_name.trim() || form.material_name_ar.trim(),
        material_name_ar: form.material_name_ar.trim() || null,
        material_code: form.material_code.trim() || null,
        category: form.category,
        unit: form.unit,
        quantity_available: qty,
        reorder_level: reorder,
        unit_cost: cost,
        currency: form.currency,
        warehouse_location: form.warehouse_location.trim() || null,
      });
      if (insertError) throw insertError;
      setForm(EMPTY_FORM);
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || L('فشل حفظ المادة', 'Failed to save material'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        dir={isAr ? 'rtl' : 'ltr'}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-card z-10">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center">
              <Icon name="ArchiveBoxIcon" size={20} className="text-amber-500" />
            </div>
            <h3 className="text-base font-bold text-foreground">
              {L('إضافة مادة إنتاج / خام', 'Add production / raw material')}
            </h3>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"
            aria-label={L('إغلاق', 'Close')}
          >
            <Icon name="XMarkIcon" size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">
                {L('اسم المادة / الخامة (عربي)', 'Material name (Arabic)')}
              </label>
              <input
                type="text"
                dir="rtl"
                value={form.material_name_ar}
                onChange={(e) => setField('material_name_ar', e.target.value)}
                className={inputClass}
                placeholder="مثال: حبيبات بلاستيك"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">
                {L('اسم المادة / الخامة (إنجليزي) - اختياري', 'Material name (English) - optional')}
              </label>
              <input
                type="text"
                dir="ltr"
                value={form.material_name}
                onChange={(e) => setField('material_name', e.target.value)}
                className={inputClass}
                placeholder="e.g. Plastic granules"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">
                {L('كود المادة (SKU)', 'Material code / SKU')}
              </label>
              <input
                type="text"
                dir="ltr"
                value={form.material_code}
                onChange={(e) => setField('material_code', e.target.value)}
                className={inputClass}
                placeholder="RM-0001"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">
                {L('التصنيف', 'Category')}
              </label>
              <select
                value={form.category}
                onChange={(e) => setField('category', e.target.value)}
                className={inputClass}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {isAr ? c.ar : c.en}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">
                {L('الكمية المتاحة', 'Available quantity')}
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={form.quantity}
                onChange={(e) => setField('quantity', e.target.value)}
                className={inputClass}
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">
                {L('وحدة القياس', 'Unit of measure')}
              </label>
              <select
                value={form.unit}
                onChange={(e) => setField('unit', e.target.value)}
                className={inputClass}
              >
                {UNITS.map((u) => (
                  <option key={u.value} value={u.value}>
                    {isAr ? u.ar : u.en}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">
              {L('حد إعادة التنبيه (الحد الأدنى)', 'Minimum alert threshold')}
            </label>
            <input
              type="number"
              min="0"
              step="any"
              value={form.reorder_level}
              onChange={(e) => setField('reorder_level', e.target.value)}
              className={inputClass}
              placeholder="0"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">
                {L('سعر التكلفة للوحدة', 'Unit cost')}
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={form.unit_cost}
                onChange={(e) => setField('unit_cost', e.target.value)}
                className={inputClass}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">
                {L('العملة', 'Currency')}
              </label>
              <select
                value={form.currency}
                onChange={(e) => setField('currency', e.target.value)}
                className={inputClass}
              >
                {CURRENCIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {isAr ? c.ar : c.en}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">
              {L('موقع التخزين', 'Warehouse / location')}
            </label>
            <input
              type="text"
              value={form.warehouse_location}
              onChange={(e) => setField('warehouse_location', e.target.value)}
              className={inputClass}
              placeholder={L('مثال: مستودع 1 - رف A', 'e.g. Warehouse 1 - Rack A')}
            />
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={saving}
              className="px-4 py-2 rounded-lg border border-border text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-50"
            >
              {L('إلغاء', 'Cancel')}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold disabled:opacity-60 flex items-center gap-2"
            >
              {saving && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {L('حفظ المادة', 'Save material')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
