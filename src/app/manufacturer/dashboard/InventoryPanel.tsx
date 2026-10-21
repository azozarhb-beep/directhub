'use client';

import React from 'react';
import Icon from '@/components/ui/AppIcon';
import AddInventoryMaterialModal from './AddInventoryMaterialModal';


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
  return (
    <div className="space-y-5">
      <AddInventoryMaterialModal
        open={showAddInventoryModal}
        onClose={() => setShowAddInventoryModal(false)}
        onSaved={() => onSaved?.()}
      />
      <div className="bg-gradient-to-r from-amber-500 to-orange-600 rounded-2xl p-5 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Icon name="ArchiveBoxIcon" size={22} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">{md.tabInventory}</h2>
              <p className="text-amber-100 text-xs">{md.inventoryHeading}</p>
            </div>
          </div>
          <button
            onClick={() => setShowAddInventoryModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-semibold transition-colors"
          >
            <Icon name="PlusIcon" size={16} />
            {md.addMaterialAction}
          </button>
        </div>
      </div>

      {inventoryLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : inventoryItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 border-2 border-amber-200 flex items-center justify-center mb-4">
            <Icon name="ArchiveBoxIcon" size={28} className="text-amber-400" />
          </div>
          <h3 className="text-base font-bold text-foreground mb-1">{md.noInventoryMaterials}</h3>
          <p className="text-sm text-muted-foreground mb-4">{md.addMaterialsHint}</p>
          <button
            onClick={() => setShowAddInventoryModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-semibold hover:bg-amber-600 transition-colors"
          >
            <Icon name="PlusIcon" size={16} />
            {md.addMaterialNew}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {inventoryItems.map((item: any) => (
            <div key={item.id} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <p className="font-bold text-sm text-foreground">{item.material_name_ar || item.material_name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{item.category?.replace('_', ' ') || md.material}</p>
                  {(item.material_code || item.warehouse_location) && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {item.material_code ? `${item.material_code}` : ''}
                      {item.material_code && item.warehouse_location ? ' · ' : ''}
                      {item.warehouse_location || ''}
                    </p>
                  )}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                  item.quantity_available > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                }`}>
                  {item.quantity_available > 0 ? md.available : md.depleted}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{md.qtyLabel} <strong className="text-foreground">{item.quantity_available ?? 0} {item.unit}</strong></span>
                {item.unit_cost && <span>{md.costLabel} <strong className="text-foreground">{item.unit_cost} {item.currency || 'USD'}</strong></span>}
              </div>
              {item.reorder_level && item.quantity_available <= item.reorder_level && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 rounded-lg px-2 py-1">
                  <Icon name="ExclamationTriangleIcon" size={13} />
                  {md.reorderLevelHint}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
