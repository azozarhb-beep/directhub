'use client';

import React from 'react';
import Icon from '@/components/ui/AppIcon';

interface DeleteProductModalProps {
  onCancel: () => void;
  onConfirm: () => void;
}

export default function DeleteProductModal({ onCancel, onConfirm }: DeleteProductModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-sm bg-card rounded-2xl border border-border shadow-xl p-6">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <Icon name="TrashIcon" size={22} className="text-red-600" />
        </div>
        <h3 className="text-center font-bold text-foreground mb-1">حذف المنتج؟</h3>
        <p className="text-center text-sm text-muted-foreground mb-5">
          لا يمكن التراجع عن هذا الإجراء. سيتم حذف المنتج نهائياً.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 h-10 border border-border rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 h-10 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors"
          >
            حذف
          </button>
        </div>
      </div>
    </div>
  );
}
