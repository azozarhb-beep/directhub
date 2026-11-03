'use client';

import React, { useState, useMemo } from 'react';
import Icon from '@/components/ui/AppIcon';
import AddInventoryMaterialModal from './AddInventoryMaterialModal';
import MaterialDetailsDrawer from './MaterialDetailsDrawer';

interface InventoryPanelProps {
  inventoryItems: any[];
  inventoryLoading: boolean;
  showAddInventoryModal: boolean;
  setShowAddInventoryModal: (v: boolean) => void;
  inventoryForm: {
    material_name: string;
    material_name_ar: string;
    category: string;
    unit: string;
    quantity: string;
    unit_cost: string;
    supplier_name: string;
    notes: string;
  };
  setInventoryForm: (v: any) => void;
  inventoryFormLoading: boolean;
  inventoryFormError: string;
  md: any;
  onSaved?: () => void;
}

export default function InventoryPanel({
  inventoryItems,
  inventoryLoading,
  showAddInventoryModal,
  setShowAddInventoryModal,
  inventoryForm,
  setInventoryForm,
  inventoryFormLoading,
  inventoryFormError,
  md,
  onSaved,
}: InventoryPanelProps) {
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'low' | 'out'>('all');

  const currencyLabel = (c?: string | null) => {
    const k = String(c || 'YER_SANAA').toUpperCase();
    if (k === 'YER_SANAA' || k === 'YER') return 'ر.ي (صنعاء)';
    if (k === 'YER_ADEN') return 'ر.ي (عدن)';
    if (k === 'USD') return '$';
    if (k === 'SAR') return 'ر.س';
    return k;
  };

  const stats = useMemo(() => {
    let available = 0;
    let low = 0;
    let out = 0;

    (inventoryItems || []).forEach((item: any) => {
      const qty = Number(item.quantity_available ?? 0);
      const reorder = item.reorder_level != null ? Number(item.reorder_level) : null;
      if (qty <= 0) {
        out += 1;
      } else if (reorder != null && qty <= reorder) {
        low += 1;
      } else {
        available += 1;
      }
    });

    return {
      total: (inventoryItems || []).length,
      available,
      low,
      out,
    };
  }, [inventoryItems]);

  const filteredItems = useMemo(() => {
    return (inventoryItems || []).filter((item: any) => {
      const nameMatch =
        (item.material_name_ar || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.material_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.material_code || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.warehouse_location || '').toLowerCase().includes(searchQuery.toLowerCase());

      if (!nameMatch) return false;

      const qty = Number(item.quantity_available ?? 0);
      const reorder = item.reorder_level != null ? Number(item.reorder_level) : null;
      const isOut = qty <= 0;
      const isLow = qty > 0 && reorder != null && qty <= reorder;

      if (statusFilter === 'available') return !isOut && !isLow;
      if (statusFilter === 'low') return isLow;
      if (statusFilter === 'out') return isOut;
      return true;
    });
  }, [inventoryItems, searchQuery, statusFilter]);

  return (
    <div className="space-y-5" dir="rtl">
      <AddInventoryMaterialModal
        open={showAddInventoryModal}
        onClose={() => setShowAddInventoryModal(false)}
        onSaved={() => onSaved?.()}
      />
      <MaterialDetailsDrawer
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        onChanged={() => onSaved?.()}
      />

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-amber-600 to-orange-600 rounded-2xl p-5 text-white shadow-md">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
              <Icon name="ArchiveBoxIcon" size={24} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">{md?.tabInventory || 'إدارة المخزون والمواد الخام'}</h2>
              <p className="text-amber-100 text-xs sm:text-sm mt-0.5">
                تتبع كميات المواد الأولية، مستودعات التخزين بالمحافظات، وتنبيهات إعادة الطلب التلقائية.
              </p>
            </div>
          </div>
          {!inventoryLoading && (
            <button
              type="button"
              onClick={() => setShowAddInventoryModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-white text-amber-700 rounded-xl text-sm font-bold hover:bg-amber-50 transition-colors shadow-sm shrink-0"
            >
              <Icon name="PlusIcon" size={16} />
              {md?.addMaterialNew || 'إضافة مادة خام / مخزون جديد'}
            </button>
          )}
        </div>
      </div>

      {/* Inventory Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'إجمالي الأصناف والمواد', value: stats.total, color: 'border-border bg-card text-foreground', filter: 'all' },
          { label: 'متوفر بكميات كافية', value: stats.available, color: 'border-emerald-200 bg-emerald-50/60 text-emerald-800', filter: 'available' },
          { label: '⚠️ منخفض (بحاجة لإعادة طلب)', value: stats.low, color: 'border-amber-300 bg-amber-50/60 text-amber-800', filter: 'low' },
          { label: 'نفد من المخزن', value: stats.out, color: 'border-red-200 bg-red-50/60 text-red-700', filter: 'out' },
        ].map((s) => (
          <button
            type="button"
            key={s.label}
            onClick={() => setStatusFilter(s.filter as any)}
            className={`p-3.5 rounded-xl border text-right transition-all hover:shadow-sm ${s.color} ${statusFilter === s.filter ? 'ring-2 ring-primary ring-offset-1' : ''}`}
          >
            <p className="text-2xl font-black">{s.value}</p>
            <p className="text-xs font-semibold mt-1 opacity-90">{s.label}</p>
          </button>
        ))}
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-card border border-border rounded-xl p-3 flex flex-wrap gap-2.5 items-center">
        <div className="flex-1 min-w-[200px] relative">
          <Icon name="MagnifyingGlassIcon" size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث باسم المادة، الكود، أو موقع المستودع..."
            className="w-full h-9 pr-9 pl-3 rounded-lg border border-border bg-background text-foreground text-xs focus:outline-none focus:border-primary transition-colors"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="h-9 px-3 rounded-lg border border-border bg-background text-foreground text-xs font-semibold focus:outline-none focus:border-primary transition-colors"
        >
          <option value="all">كل حالات المخزون</option>
          <option value="available">المتوفر فقط</option>
          <option value="low">المنخفض (إعادة طلب)</option>
          <option value="out">النافد</option>
        </select>
      </div>

      {/* Items Grid */}
      {inventoryLoading ? (
        <div className="flex items-center justify-center py-16 bg-card border border-border rounded-2xl">
          <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-card border border-border rounded-2xl p-6">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 border-2 border-amber-200 flex items-center justify-center mb-4">
            <Icon name="ArchiveBoxIcon" size={28} className="text-amber-500" />
          </div>
          <h3 className="text-base font-bold text-foreground mb-1">
            {inventoryItems.length === 0 ? (md?.noInventoryMaterials || 'لا توجد مواد خام مسجلة بالمخزن بعد') : 'لا توجد نتائج مطابقة لبحثك'}
          </h3>
          <p className="text-xs text-muted-foreground mb-4 max-w-sm">
            {inventoryItems.length === 0
              ? (md?.addMaterialsHint || 'سجّل المواد الأولية والمخزون الداخلي لمصنعك لتتبع الاستهلاك والتكاليف وربطها بعمليات التصنيع.')
              : 'جرب تغيير كلمة البحث أو حالة الفلتر.'}
          </p>
          {inventoryItems.length === 0 && (
            <button
              onClick={() => setShowAddInventoryModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-amber-600 text-white rounded-xl text-xs font-bold hover:bg-amber-700 transition-colors shadow-sm"
            >
              <Icon name="PlusIcon" size={15} />
              {md?.addMaterialNew || 'إضافة أول مادة خام'}
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filteredItems.map((item: any) => {
            const qty = Number(item.quantity_available ?? 0);
            const reorder = item.reorder_level != null ? Number(item.reorder_level) : null;
            const isLow = qty > 0 && reorder != null && qty <= reorder;
            const isOut = qty <= 0;
            return (
              <div
                key={item.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedItem(item)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedItem(item);
                  }
                }}
                className="bg-card border border-border rounded-xl p-4 cursor-pointer hover:border-amber-400 hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-amber-500 text-right"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <p className="font-bold text-sm text-foreground">{item.material_name_ar || item.material_name}</p>
                    <p className="text-xs text-muted-foreground capitalize mt-0.5">{item.category?.replace('_', ' ') || md?.material || 'مادة خام'}</p>
                    {(item.material_code || item.warehouse_location) && (
                      <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1 font-medium">
                        <Icon name="BuildingOfficeIcon" size={12} className="text-amber-600 shrink-0" />
                        <span>{item.warehouse_location || 'المستودع الرئيسي'}</span>
                        {item.material_code && <span className="font-mono text-muted-foreground/80">({item.material_code})</span>}
                      </p>
                    )}
                  </div>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold whitespace-nowrap border ${
                    isOut
                      ? 'bg-red-50 text-red-700 border-red-200'
                      : isLow
                      ? 'bg-amber-50 text-amber-800 border-amber-300'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}>
                    {isOut ? (md?.depleted || 'نفد المخزون') : isLow ? '⚠️ تنبيه: إعادة طلب' : (md?.available || 'متوفر')}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs pt-2 border-t border-border/60">
                  <span className="text-muted-foreground">
                    الكمية: <strong className="text-foreground text-sm font-bold">{item.quantity_available ?? 0} {item.unit}</strong>
                  </span>
                  {item.unit_cost && (
                    <span className="text-muted-foreground">
                      التكلفة: <strong className="text-primary font-bold">{item.unit_cost} {currencyLabel(item.currency)}</strong>
                    </span>
                  )}
                </div>

                {isLow && (
                  <div className="mt-2.5 flex items-center gap-1.5 text-[11px] font-bold text-amber-800 bg-amber-50/80 border border-amber-200 rounded-lg px-2.5 py-1">
                    <Icon name="ExclamationTriangleIcon" size={13} className="text-amber-600 shrink-0" />
                    <span>الكمية وصلت لحد إعادة الطلب ({reorder} {item.unit}) — يرجى تزويد المخزن</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
