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

const ORIGIN_GROUPS: { label: string; options: { value: string; label: string }[] }[] = [
  {
    label: '🌏 Asia',
    options: [
      { value: 'China', label: '🇨🇳 China' },
      { value: 'India', label: '🇮🇳 India' },
      { value: 'Turkey', label: '🇹🇷 Turkey' },
      { value: 'Japan', label: '🇯🇵 Japan' },
      { value: 'South Korea', label: '🇰🇷 South Korea' },
      { value: 'Taiwan', label: '🇹🇼 Taiwan' },
      { value: 'Vietnam', label: '🇻🇳 Vietnam' },
      { value: 'Bangladesh', label: '🇧🇩 Bangladesh' },
      { value: 'Pakistan', label: '🇵🇰 Pakistan' },
      { value: 'Indonesia', label: '🇮🇩 Indonesia' },
      { value: 'Malaysia', label: '🇲🇾 Malaysia' },
      { value: 'Thailand', label: '🇹🇭 Thailand' },
    ],
  },
  {
    label: '🌍 Arab Countries',
    options: [
      { value: 'Saudi Arabia', label: '🇸🇦 Saudi Arabia' },
      { value: 'UAE', label: '🇦🇪 UAE' },
      { value: 'Kuwait', label: '🇰🇼 Kuwait' },
      { value: 'Qatar', label: '🇶🇦 Qatar' },
      { value: 'Bahrain', label: '🇧🇭 Bahrain' },
      { value: 'Oman', label: '🇴🇲 Oman' },
      { value: 'Egypt', label: '🇪🇬 Egypt' },
      { value: 'Jordan', label: '🇯🇴 Jordan' },
      { value: 'Iraq', label: '🇮🇶 Iraq' },
      { value: 'Yemen', label: '🇾🇪 Yemen' },
      { value: 'Morocco', label: '🇲🇦 Morocco' },
      { value: 'Algeria', label: '🇩🇿 Algeria' },
      { value: 'Tunisia', label: '🇹🇳 Tunisia' },
      { value: 'Libya', label: '🇱🇾 Libya' },
    ],
  },
  {
    label: '🌍 Europe',
    options: [
      { value: 'Germany', label: '🇩🇪 Germany' },
      { value: 'Italy', label: '🇮🇹 Italy' },
      { value: 'France', label: '🇫🇷 France' },
      { value: 'UK', label: '🇬🇧 UK' },
      { value: 'Spain', label: '🇪🇸 Spain' },
      { value: 'Poland', label: '🇵🇱 Poland' },
      { value: 'Netherlands', label: '🇳🇱 Netherlands' },
    ],
  },
  {
    label: '🌎 Americas',
    options: [
      { value: 'USA', label: '🇺🇸 USA' },
      { value: 'Canada', label: '🇨🇦 Canada' },
      { value: 'Brazil', label: '🇧🇷 Brazil' },
      { value: 'Mexico', label: '🇲🇽 Mexico' },
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
  const origin = formData.origin_country;
  const isChineseLang = ['China', 'Taiwan', 'Hong Kong'].includes(origin);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-4 pb-4 sm:pb-0">
      <div className="w-full max-w-lg bg-card rounded-2xl border border-border shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-card z-10">
          <h2 className="font-bold text-foreground">{isEditing ? 'تعديل المنتج' : 'إضافة منتج جديد'}</h2>
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
            originCountry={formData.origin_country}
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
              <label className="block text-xs font-medium text-foreground mb-1">الفئة *</label>
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
              <label className="block text-xs font-medium text-foreground mb-1">رمز المنتج (SKU)</label>
              <input
                type="text"
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                placeholder="e.g. STL-001"
                className={inputCls}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">الوحدة</label>
              <select
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                className={selectCls}
              >
                {['kg', 'ton', 'liter', 'piece', 'meter', 'sheet', 'roll', 'box', 'pallet'].map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">سعر الوحدة</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.unit_price}
                onChange={(e) => setFormData({ ...formData, unit_price: e.target.value })}
                placeholder="0.00"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">الحد الأدنى للطلب</label>
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
              <label className="block text-xs font-medium text-foreground mb-1">كمية المخزون</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.stock_quantity}
                onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                placeholder="0"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">حالة المخزون</label>
              <select
                value={formData.inventory_status}
                onChange={(e) => setFormData({ ...formData, inventory_status: e.target.value })}
                className={selectCls}
              >
                <option value="in_stock">متوفر</option>
                <option value="low_stock">مخزون منخفض</option>
                <option value="out_of_stock">نفد المخزون</option>
                <option value="discontinued">متوقف</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              Origin Country
              {origin && <SupplierLanguageBadge originCountry={origin} size="sm" />}
            </label>
            <select
              value={origin}
              onChange={(e) => setFormData({ ...formData, origin_country: e.target.value })}
              className={selectCls}
            >
              <option value="">اختر الدولة</option>
              {ORIGIN_GROUPS.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </optgroup>
              ))}
              <option value="Other">Other</option>
            </select>
            {origin && ['China', 'Turkey', 'Taiwan', 'Hong Kong'].includes(origin) && (
              <p className="text-[11px] text-blue-600 mt-1 flex items-center gap-1">
                <span>🌐</span>
                {isChineseLang
                  ? 'Chinese (中文) fields will appear in the language tabs above'
                  : 'Turkish (Türkçe) fields will appear in the language tabs above'}
              </p>
            )}
          </div>

          <div className="flex gap-3 pt-1">
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
                'إضافة المنتج'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
