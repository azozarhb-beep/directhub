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
  unit: 'kg',
  reorder_level: '',
  unit_cost: '',
  currency: 'YER_SANAA',
  warehouse_location: '',
};

const CATEGORIES = [
  { value: 'raw_material', ar: 'مواد خام أولية (بوليمرات، معادن، حبيبات...)', en: 'Primary raw materials' },
  { value: 'plastics_industries', ar: 'بلاستيك ومواد بتروكيماوية', en: 'Plastics & Petrochemicals' },
  { value: 'packaging', ar: 'مواد تعبئة وتغليف وكرتون', en: 'Packaging & Cartons' },
  { value: 'consumables', ar: 'مستهلكات إنتاج وصيانة', en: 'Production consumables' },
  { value: 'spare_parts', ar: 'قطع غيار قوالب ومعدات', en: 'Spare parts & Molds' },
  { value: 'construction_materials', ar: 'مواد بناء وإنشاءات', en: 'Building & construction materials' },
  { value: 'food_beverages', ar: 'خامات أغذية ومشروبات', en: 'Food & beverage ingredients' },
  { value: 'pharma_medical', ar: 'خامات ومستلزمات طبية', en: 'Pharmaceuticals & medical' },
  { value: 'chemicals', ar: 'أصباغ وكيماويات ومساعدات تشغيل', en: 'Masterbatch & Chemicals' },
];

const UNITS = [
  { value: 'kg', ar: 'كيلوجرام (كجم)', en: 'Kilogram (Kg)' },
  { value: 'ton', ar: 'طن متري', en: 'Metric Ton' },
  { value: 'bag', ar: 'كيس / شوالة (25-50 كجم)', en: 'Bag / Sack' },
  { value: 'roll', ar: 'رول / لفة', en: 'Roll' },
  { value: 'carton', ar: 'كرتون / صندوق', en: 'Carton / Box' },
  { value: 'drum', ar: 'برميل / درام', en: 'Drum / Barrel' },
  { value: 'liter', ar: 'لتر', en: 'Liter' },
  { value: 'sheet', ar: 'لوح / شيت', en: 'Sheet' },
  { value: 'piece', ar: 'قطعة', en: 'Piece' },
];

const CURRENCIES = [
  { value: 'YER_SANAA', ar: 'ريال يمني (صنعاء - طبعة قديمة)', en: 'YER (Sanaa - Old)' },
  { value: 'YER_ADEN', ar: 'ريال يمني (عدن - طبعة جديدة)', en: 'YER (Aden - New)' },
  { value: 'USD', ar: 'دولار أمريكي ($ USD)', en: 'US Dollar ($)' },
  { value: 'SAR', ar: 'ريال سعودي (SAR)', en: 'Saudi Riyal (SAR)' },
];

const inputClass =
  'w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 transition-colors';

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
      setError(L('يرجى إدخال اسم المادة الخام أو المستلزم', 'Enter the material name'));
      return;
    }
    const qty = Number(form.quantity);
    if (form.quantity === '' || Number.isNaN(qty) || qty < 0) {
      setError(L('أدخل كمية صحيحة للمخزون', 'Enter a valid quantity'));
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
      setError(err?.message || L('فشل حفظ المادة في المخزون', 'Failed to save material'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
        dir={isAr ? 'rtl' : 'ltr'}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-card z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center">
              <Icon name="ArchiveBoxIcon" size={22} className="text-amber-500" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">
                {L('توريد وتسجيل مادة خام / مستلزم إنتاج', 'Add Raw Material / Production Supply')}
              </h3>
              <p className="text-[11px] text-muted-foreground">
                {L('تسجيل الرصيد المتاح وتكلفة الشراء وموقع التخزين بالمصنع', 'Register stock quantity, purchase cost, and warehouse location')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
            aria-label={L('إغلاق', 'Close')}
          >
            <Icon name="XMarkIcon" size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-foreground mb-1">
                {L('اسم المادة الخام / المستلزم (عربي) *', 'Material Name (Arabic) *')}
              </label>
              <input
                type="text"
                dir="rtl"
                required
                value={form.material_name_ar}
                onChange={(e) => setField('material_name_ar', e.target.value)}
                className={inputClass}
                placeholder="مثال: حبيبات بولي إيثيلين HDPE أو كرتون مقوى"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                {L('اسم المادة (إنجليزي) - اختياري', 'Material Name (English) - optional')}
              </label>
              <input
                type="text"
                dir="ltr"
                value={form.material_name}
                onChange={(e) => setField('material_name', e.target.value)}
                className={inputClass}
                placeholder="e.g. HDPE Resin Granules"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">
                {L('كود الصنف / المادة بالمصنع (Code / SKU)', 'Material Code / SKU')}
              </label>
              <input
                type="text"
                dir="ltr"
                value={form.material_code}
                onChange={(e) => setField('material_code', e.target.value)}
                className={`${inputClass} font-mono`}
                placeholder="RM-PLAS-01"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">
                {L('تصنيف المادة الخام *', 'Category *')}
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

          <div className="p-3.5 bg-muted/40 rounded-xl border border-border space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  {L('الكمية الواردة / المتاحة *', 'Available Quantity *')}
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  required
                  value={form.quantity}
                  onChange={(e) => setField('quantity', e.target.value)}
                  className={`${inputClass} font-bold`}
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  {L('وحدة القياس *', 'Unit of Measure *')}
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
              <div>
                <label className="block text-xs font-bold text-amber-700 mb-1">
                  {L('حد إعادة التنبيه (الأدنى) ⚠️', 'Reorder Level ⚠️')}
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={form.reorder_level}
                  onChange={(e) => setField('reorder_level', e.target.value)}
                  className={`${inputClass} border-amber-300`}
                  placeholder="تنبيه قبل النفاد..."
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-border/60">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  {L('تكلفة شراء الوحدة', 'Unit Purchase Cost')}
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
                  {L('عملة التكلفة والشراء *', 'Cost Currency *')}
                </label>
                <select
                  value={form.currency}
                  onChange={(e) => setField('currency', e.target.value)}
                  className={`${inputClass} font-semibold`}
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {isAr ? c.ar : c.en}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-foreground mb-1">
              {L('موقع التخزين والمستودع', 'Warehouse / Storage Location')}
            </label>
            <input
              type="text"
              value={form.warehouse_location}
              onChange={(e) => setField('warehouse_location', e.target.value)}
              className={inputClass}
              placeholder={L('مثال: مستودع المصنع الرئيسي - عنبر المواد الخام رف 3 (صنعاء / عدن)', 'e.g. Main Factory Warehouse - Raw Material Bay Rack 3')}
            />
          </div>

          {error && (
            <div className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-center gap-1.5">
              <Icon name="ExclamationCircleIcon" size={15} />
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={saving}
              className="px-4 py-2 rounded-lg border border-border text-xs sm:text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-50 transition-colors"
            >
              {L('إلغاء', 'Cancel')}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs sm:text-sm font-bold disabled:opacity-60 flex items-center gap-2 transition-all shadow-sm"
            >
              {saving && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {L('حفظ وإيداع المادة في المخزون', 'Save and Add to Inventory')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
