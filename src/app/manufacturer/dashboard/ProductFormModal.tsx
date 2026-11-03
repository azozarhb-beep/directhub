'use client';

import React from 'react';
import Icon from '@/components/ui/AppIcon';
import AIProductAssistant from '@/components/AIProductAssistant';
import { MultilingualProductFields, SupplierLanguageBadge } from '@/components/LocalizedProductDisplay';
import { CATEGORIES } from './dashboardConfig';
import type { ProductFormData } from './dashboardTypes';

interface ProductFormModalProps {
  isEditing: boolean;
  formData: ProductFormData;
  setFormData: (data: ProductFormData) => void;
  formError: string;
  formLoading: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

const UNIT_OPTIONS = [
  { value: 'piece', label: 'قطعة (Piece)' },
  { value: 'kg', label: 'كيلوجرام (Kg)' },
  { value: 'ton', label: 'طن متري (Ton)' },
  { value: 'box', label: 'كرتون / صندوق (Box)' },
  { value: 'meter', label: 'متر (Meter)' },
  { value: 'sheet', label: 'لوح / شيت (Sheet)' },
  { value: 'roll', label: 'لفة / رول (Roll)' },
  { value: 'liter', label: 'لتر (Liter)' },
  { value: 'pallet', label: 'طبلية / بالتة (Pallet)' },
];

const ORIGIN_GROUPS: { label: string; options: { value: string; label: string }[] }[] = [
  {
    label: '🌍 الدول العربية والمنطقة',
    options: [
      { value: 'Yemen', label: '🇾🇪 اليمن (إنتاج محلي)' },
      { value: 'Saudi Arabia', label: '🇸🇦 السعودية' },
      { value: 'UAE', label: '🇦🇪 الإمارات' },
      { value: 'Oman', label: '🇴🇲 عُمان' },
      { value: 'Kuwait', label: '🇰🇼 الكويت' },
      { value: 'Qatar', label: '🇶🇦 قطر' },
      { value: 'Bahrain', label: '🇧🇭 البحرين' },
      { value: 'Egypt', label: '🇪🇬 مصر' },
      { value: 'Jordan', label: '🇯🇴 الأردن' },
      { value: 'Iraq', label: '🇮🇶 العراق' },
      { value: 'Algeria', label: '🇩🇿 الجزائر' },
      { value: 'Morocco', label: '🇲🇦 المغرب' },
    ],
  },
  {
    label: '🌏 آسيا',
    options: [
      { value: 'China', label: '🇨🇳 الصين (China)' },
      { value: 'Turkey', label: '🇹🇷 تركيا (Turkey)' },
      { value: 'India', label: '🇮🇳 الهند (India)' },
      { value: 'South Korea', label: '🇰🇷 كوريا الجنوبية' },
      { value: 'Japan', label: '🇯🇵 اليابان' },
      { value: 'Taiwan', label: '🇹🇼 تايوان' },
      { value: 'Vietnam', label: '🇻🇳 فيتنام' },
      { value: 'Malaysia', label: '🇲🇾 ماليزيا' },
      { value: 'Indonesia', label: '🇮🇩 إندونيسيا' },
    ],
  },
  {
    label: '🌍 أوروبا وأمريكا',
    options: [
      { value: 'Germany', label: '🇩🇪 ألمانيا' },
      { value: 'Italy', label: '🇮🇹 إيطاليا' },
      { value: 'UK', label: '🇬🇧 بريطانيا' },
      { value: 'USA', label: '🇺🇸 أمريكا' },
    ],
  },
];

const inputCls =
  'w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors';
const selectCls =
  'w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary transition-colors';

export default function ProductFormModal({
  isEditing,
  formData,
  setFormData,
  formError,
  formLoading,
  onClose,
  onSubmit,
}: ProductFormModalProps) {
  const origin = formData.origin_country || 'Yemen';
  const isChineseLang = ['China', 'Taiwan', 'Hong Kong'].includes(origin);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-4 pb-4 sm:pb-0 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-card rounded-2xl border border-border shadow-xl max-h-[90vh] overflow-y-auto" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-card z-10">
          <div>
            <h2 className="font-bold text-foreground text-base">
              {isEditing ? 'تعديل بيانات المنتج' : 'إضافة منتج محلي جديد'}
            </h2>
            <p className="text-[11px] text-muted-foreground">التسعير بالريال اليمني (ر.ي / YER)</p>
          </div>
          <div className="flex items-center gap-2">
            <AIProductAssistant
              categorySlug={formData.category}
              categoryName={CATEGORIES.find((c) => c.value === formData.category)?.label}
              productName={formData.name}
            />
            <button
              type="button"
              aria-label="إغلاق"
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Icon name="XMarkIcon" size={18} />
            </button>
          </div>
        </div>

        <form onSubmit={onSubmit} className="p-5 space-y-4">
          {formError && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm flex items-center gap-2">
              <Icon name="ExclamationCircleIcon" size={16} />
              {formError}
            </div>
          )}

          <MultilingualProductFields
            originCountry={formData.origin_country || 'Yemen'}
            fields={{
              name: formData.name,
              name_ar: formData.name_ar,
              name_zh: formData.name_zh,
              name_tr: formData.name_tr,
              description: formData.description,
              description_ar: formData.description_ar,
              description_zh: formData.description_zh,
              description_tr: formData.description_tr,
            }}
            onChange={(field, value) => setFormData({ ...formData, [field]: value })}
            disabled={formLoading}
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">الفئة / التصنيف *</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className={selectCls}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">رمز المنتج (SKU / الكود)</label>
              <input
                type="text"
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                placeholder="مثال: DH-PLAS-01"
                className={inputCls}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">وحدة القياس</label>
              <select
                value={formData.unit || 'piece'}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                className={selectCls}
              >
                {UNIT_OPTIONS.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                سعر الوحدة <span className="text-primary font-bold">(ر.ي)</span> *
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={formData.unit_price}
                  onChange={(e) => setFormData({ ...formData, unit_price: e.target.value })}
                  placeholder="0.00"
                  className={`${inputCls} pl-10`}
                />
                <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 text-[11px] font-bold text-muted-foreground pointer-events-none">
                  ر.ي
                </span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">أدنى طلب (MOQ)</label>
              <input
                type="number"
                min="1"
                value={formData.minimum_order_qty}
                onChange={(e) => setFormData({ ...formData, minimum_order_qty: e.target.value })}
                placeholder="1"
                className={inputCls}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">الكمية المتوفرة بالمخزون</label>
              <input
                type="number"
                min="0"
                step="any"
                value={formData.stock_quantity}
                onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                placeholder="0"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">حالة التوفر</label>
              <select
                value={formData.inventory_status}
                onChange={(e) => setFormData({ ...formData, inventory_status: e.target.value })}
                className={selectCls}
              >
                <option value="in_stock">متوفر وجاهز للطلب</option>
                <option value="low_stock">مخزون محدود</option>
                <option value="out_of_stock">غير متوفر حالياً</option>
                <option value="discontinued">إنتاج حسب الطلب / متوقف</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              بلد المنشأ / التصنيع
              {origin && <SupplierLanguageBadge originCountry={origin} size="sm" />}
            </label>
            <select
              value={origin}
              onChange={(e) => setFormData({ ...formData, origin_country: e.target.value })}
              className={selectCls}
            >
              {ORIGIN_GROUPS.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </optgroup>
              ))}
              <option value="Other">بلد آخر (أخرى)</option>
            </select>
            {origin && ['China', 'Turkey', 'Taiwan', 'Hong Kong'].includes(origin) && (
              <p className="text-[11px] text-blue-600 mt-1 flex items-center gap-1">
                <span>🌐</span>
                {isChineseLang
                  ? 'ستظهر الحقول باللغة الصينية (中文) في التبويب العلوي تلقائياً'
                  : 'ستظهر الحقول باللغة التركية (Türkçe) في التبويب العلوي تلقائياً'}
              </p>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-10 border border-border rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={formLoading}
              className="flex-1 h-10 bg-primary text-primary-foreground rounded-lg text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2 transition-opacity active:opacity-80"
            >
              {formLoading ? (
                <>
                  <Icon name="ArrowPathIcon" size={15} className="animate-spin" /> جارٍ الحفظ...
                </>
              ) : isEditing ? (
                'حفظ التعديلات'
              ) : (
                'إضافة المنتج إلى الكتالوج'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
