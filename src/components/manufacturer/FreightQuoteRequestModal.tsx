'use client';

import React, { useState } from 'react';
import toast from 'react-hot-toast';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';

interface FreightQuoteRequestModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const YEMEN_GOVERNORATES: string[] = [
  'صنعاء',
  'عدن',
  'الحديدة',
  'تعز',
  'حضرموت',
  'إب',
  'ذمار',
  'مأرب',
  'لحج',
  'أبين',
  'شبوة',
  'المهرة',
  'حجة',
  'صعدة',
  'عمران',
  'البيضاء',
  'الجوف',
  'ريمة',
  'المحويت',
  'الضالع',
  'سقطرى',
  'أمانة العاصمة',
];

const VEHICLE_TYPES: { value: string; label: string }[] = [
  { value: 'dyna', label: 'دينا (Medium Truck / Dyna)' },
  { value: 'heavy_trailer', label: 'شاحنة نقل ثقيل / تريلا (Heavy Trailer)' },
  { value: 'pickup', label: 'دباب / نقل خفيف (Pickup / Small Van)' },
];

const CARGO_TYPES: string[] = [
  'رولات تغليف',
  'بضائع مصنعة',
  'مواد خام',
  'مواد غذائية',
  'مواد بناء',
  'أخرى',
];

const inputCls =
  'w-full h-10 px-3 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30';

export default function FreightQuoteRequestModal({ open, onClose, onCreated }: FreightQuoteRequestModalProps) {
  const supabase = createClient();
  const [origin, setOrigin] = useState('صنعاء');
  const [destination, setDestination] = useState('عدن');
  const [vehicleType, setVehicleType] = useState('dyna');
  const [weight, setWeight] = useState('');
  const [weightUnit, setWeightUnit] = useState<'ton' | 'kg'>('ton');
  const [cargoType, setCargoType] = useState('رولات تغليف');
  const [pickupDate, setPickupDate] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const w = Number(weight);
    if (!origin || !destination) {
      toast.error('يرجى تحديد مدينة التحميل والتفريغ.');
      return;
    }
    if (origin === destination) {
      toast.error('يجب أن تختلف وجهة التفريغ عن نقطة التحميل.');
      return;
    }
    if (!w || w <= 0) {
      toast.error('يرجى إدخال وزن صحيح للبضاعة.');
      return;
    }
    if (!pickupDate) {
      toast.error('يرجى تحديد تاريخ التحميل.');
      return;
    }

    setSubmitting(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id;
      if (!uid) {
        toast.error('يجب تسجيل الدخول أولاً.');
        return;
      }
      const weightKg = weightUnit === 'ton' ? w * 1000 : w;
      const vehicle = VEHICLE_TYPES.find(v => v.value === vehicleType);
      const trackingNumber = `YF-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

      const { error } = await supabase.from('logistics_shipments').insert({
        tracking_number: trackingNumber,
        created_by: uid,
        origin_address: origin,
        destination_address: destination,
        cargo_type: cargoType,
        container_type: vehicle?.label || vehicleType,
        weight_kg: weightKg,
        pickup_date: new Date(`${pickupDate}T08:00:00Z`).toISOString(),
        budget_currency: 'YER',
        is_open_for_bids: true,
        notes: notes.trim() || null,
        metadata: {
          scope: 'yemen_domestic',
          vehicle_type: vehicleType,
          weight_input: w,
          weight_unit: weightUnit,
        },
      });

      if (error) {
        toast.error(error.message || 'تعذر إرسال طلب الشحن.');
        return;
      }
      toast.success('تم إرسال طلب عرض سعر الشحن إلى شركات النقل');
      setWeight('');
      setNotes('');
      setPickupDate('');
      onCreated();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4" role="dialog" aria-modal="true" dir="rtl">
      <form
        onSubmit={handleSubmit}
        className="bg-card border border-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 space-y-4 shadow-xl"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
              <Icon name="TruckIcon" size={18} className="text-blue-600" />
            </div>
            <p className="font-bold text-sm text-foreground">طلب عرض سعر شحن / نقل بضاعة</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="إغلاق"
            className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center"
          >
            <Icon name="XMarkIcon" size={16} className="text-muted-foreground" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground">من (مدينة / محافظة التحميل)</label>
            <select value={origin} onChange={e => setOrigin(e.target.value)} className={inputCls}>
              {YEMEN_GOVERNORATES.map(g => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground">إلى (مدينة / محافظة التفريغ)</label>
            <select value={destination} onChange={e => setDestination(e.target.value)} className={inputCls}>
              {YEMEN_GOVERNORATES.map(g => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-foreground">نوع المركبة</label>
          <select value={vehicleType} onChange={e => setVehicleType(e.target.value)} className={inputCls}>
            {VEHICLE_TYPES.map(v => (
              <option key={v.value} value={v.value}>
                {v.label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground">وزن البضاعة</label>
            <div className="flex gap-2">
              <input
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                value={weight}
                onChange={e => setWeight(e.target.value)}
                placeholder="0"
                className={inputCls}
                dir="ltr"
              />
              <select
                value={weightUnit}
                onChange={e => setWeightUnit(e.target.value as 'ton' | 'kg')}
                className="h-10 px-2 rounded-xl border border-border bg-background text-sm text-foreground shrink-0"
              >
                <option value="ton">طن</option>
                <option value="kg">كجم</option>
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground">نوع البضاعة</label>
            <select value={cargoType} onChange={e => setCargoType(e.target.value)} className={inputCls}>
              {CARGO_TYPES.map(c => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-foreground">تاريخ التحميل</label>
          <input
            type="date"
            value={pickupDate}
            onChange={e => setPickupDate(e.target.value)}
            className={inputCls}
            dir="ltr"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-foreground">ملاحظات (اختياري)</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <div className="flex gap-2 pt-1">
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 h-10 rounded-xl bg-primary hover:opacity-90 disabled:opacity-60 text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2"
          >
            {submitting && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            إرسال الطلب
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 h-10 rounded-xl border border-border text-sm text-foreground hover:bg-muted"
          >
            إلغاء
          </button>
        </div>
      </form>
    </div>
  );
}
