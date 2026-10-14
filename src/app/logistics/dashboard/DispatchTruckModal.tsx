'use client';

import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';

export const TRUCK_TYPE_OPTIONS = [
  'سطحة 40 قدم',
  'دينا / صندوق مغلق',
  'قلاب',
  'براد',
];

interface DispatchTruckModalProps {
  orderId: string;
  orderLabel: string;
  partnerId: string;
  onClose: () => void;
  onDispatched: (details: {
    driver_name: string;
    driver_phone: string;
    truck_plate: string;
    truck_type: string;
    dispatched_at: string;
  }) => void;
}

export default function DispatchTruckModal({
  orderId,
  orderLabel,
  partnerId,
  onClose,
  onDispatched,
}: DispatchTruckModalProps) {
  const supabase = createClient();
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [truckPlate, setTruckPlate] = useState('');
  const [truckType, setTruckType] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setError('');

    const name = driverName.trim();
    const phone = driverPhone.trim();
    const plate = truckPlate.trim();

    if (!name || !phone || !plate || !truckType) {
      setError('جميع الحقول إلزامية، يرجى تعبئتها بالكامل.');
      return;
    }
    if (!/^\+?[0-9\s-]{7,16}$/.test(phone)) {
      setError('رقم هاتف السائق غير صالح.');
      return;
    }

    setSubmitting(true);
    const dispatchedAt = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        driver_name: name,
        driver_phone: phone,
        truck_plate: plate,
        truck_type: truckType,
        dispatched_at: dispatchedAt,
        status: 'in_transit',
        updated_at: dispatchedAt,
      })
      .eq('id', orderId)
      .eq('logistics_partner_id', partnerId);

    setSubmitting(false);
    if (updateError) {
      setError(updateError.message || 'تعذر حفظ بيانات الإرسال.');
      return;
    }

    onDispatched({
      driver_name: name,
      driver_phone: phone,
      truck_plate: plate,
      truck_type: truckType,
      dispatched_at: dispatchedAt,
    });
  };

  const inputClass =
    'w-full h-11 px-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20';

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4"
      dir="rtl"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-card border border-border rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-cyan-100 flex items-center justify-center">
              <Icon name="TruckIcon" size={18} className="text-cyan-600" />
            </div>
            <div>
              <p className="font-bold text-foreground text-sm">تعيين السائق والقاطرة</p>
              <p className="text-[11px] text-muted-foreground">طلب #{orderLabel}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="إغلاق"
            className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground"
          >
            <Icon name="XMarkIcon" size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              اسم السائق <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={driverName}
              onChange={e => setDriverName(e.target.value)}
              placeholder="الاسم الكامل للسائق"
              className={inputClass}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              رقم هاتف السائق <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              inputMode="tel"
              dir="ltr"
              value={driverPhone}
              onChange={e => setDriverPhone(e.target.value)}
              placeholder="+967 7XX XXX XXX"
              className={`${inputClass} text-left`}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              رقم لوحة الشاحنة / القاطرة <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={truckPlate}
              onChange={e => setTruckPlate(e.target.value)}
              placeholder="مثال: 123456"
              className={inputClass}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              نوع القاطرة <span className="text-red-500">*</span>
            </label>
            <select
              value={truckType}
              onChange={e => setTruckType(e.target.value)}
              className={inputClass}
              required
            >
              <option value="">اختر نوع القاطرة</option>
              {TRUCK_TYPE_OPTIONS.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {error && (
            <div className="px-3 py-2 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 h-11 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <Icon name="TruckIcon" size={16} />
              )}
              تأكيد الإرسال
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="h-11 px-5 rounded-xl border border-border bg-background text-foreground text-sm font-semibold hover:bg-muted"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
