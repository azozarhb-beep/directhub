'use client';

import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import { type BidCurrency } from '@/lib/oceanCarrier';

export interface OpenLoad {
  id: string;
  tracking_number: string;
  origin_address: string | null;
  destination_address: string | null;
  cargo_type: string | null;
  container_type: string | null;
  weight_kg: number | null;
  volume_cbm: number | null;
  pickup_date: string | null;
  delivery_deadline: string | null;
  target_budget: number | null;
  budget_currency: string | null;
  notes: string | null;
}

interface SubmitQuoteModalProps {
  load: OpenLoad;
  partnerId: string;
  onClose: () => void;
  onSubmitted: (shipmentId: string) => void;
}

const VALIDITY_OPTIONS = [
  { hours: 24, label: '24 ساعة (24h)' },
  { hours: 48, label: '48 ساعة (48h)' },
  { hours: 168, label: '7 أيام (7 days)' },
];

export default function SubmitQuoteModal({ load, partnerId, onClose, onSubmitted }: SubmitQuoteModalProps) {
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<'USD' | 'YER'>(load.budget_currency === 'YER' ? 'YER' : 'USD');
  const [transit, setTransit] = useState('');
  const [transitUnit, setTransitUnit] = useState<'days' | 'hours'>('days');
  const [validityHours, setValidityHours] = useState(48);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setError('');

    const amountNum = Number(amount);
    const transitNum = Number(transit);
    if (!amountNum || amountNum <= 0) {
      setError('أدخل سعراً صحيحاً أكبر من صفر.');
      return;
    }
    if (!transitNum || transitNum <= 0) {
      setError('أدخل مدة النقل المتوقعة.');
      return;
    }

    setSubmitting(true);
    try {
      const supabase = createClient();
      const expiresAt = new Date(Date.now() + validityHours * 3600 * 1000).toISOString();
      const { error: insertError } = await supabase.from('logistics_bids').insert({
        shipment_id: load.id,
        partner_id: partnerId,
        bid_amount: amountNum,
        currency,
        transit_days: transitNum,
        transit_unit: transitUnit,
        validity_hours: validityHours,
        expires_at: expiresAt,
        service_notes: notes.trim() || null,
        status: 'pending',
      });
      if (insertError) {
        if (insertError.code === '23505') {
          setError('لقد قدّمت عرضاً على هذه الشحنة مسبقاً.');
        } else {
          setError(insertError.message || 'تعذر إرسال العرض.');
        }
        return;
      }
      toast.success('تم إرسال عرض السعر بنجاح');
      onSubmitted(load.id);
    } catch (err: any) {
      setError(err?.message || 'حدث خطأ غير متوقع.');
    } finally {
      setSubmitting(false);
    }
  };

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
            <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
              <Icon name="BanknotesIcon" size={18} className="text-blue-600" />
            </div>
            <div>
              <p className="font-bold text-foreground text-sm">تقديم عرض سعر (Submit Quote)</p>
              <p className="text-[11px] text-muted-foreground">
                {load.origin_address || '—'} ← {load.destination_address || '—'}
              </p>
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
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">السعر المعروض (Quoted Price)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                dir="ltr"
                placeholder="0.00"
                className="w-full h-11 px-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">العملة</label>
              <select
                value={currency}
                onChange={e => setCurrency(e.target.value as 'USD' | 'YER')}
                className="w-full h-11 px-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary"
              >
                <option value="USD">USD</option>
                <option value="YER">YER</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">مدة النقل المتوقعة (Transit)</label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={transit}
                onChange={e => setTransit(e.target.value)}
                dir="ltr"
                placeholder="3"
                className="w-full h-11 px-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">الوحدة</label>
              <select
                value={transitUnit}
                onChange={e => setTransitUnit(e.target.value as 'days' | 'hours')}
                className="w-full h-11 px-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary"
              >
                <option value="days">أيام</option>
                <option value="hours">ساعات</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">صلاحية العرض (Validity)</label>
            <select
              value={validityHours}
              onChange={e => setValidityHours(Number(e.target.value))}
              className="w-full h-11 px-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary"
            >
              {VALIDITY_OPTIONS.map(v => (
                <option key={v.hours} value={v.hours}>{v.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
              ملاحظات الخدمة / شروط خاصة
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="مثال: شامل التخليص والعتالة / نقل فقط"
              className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm resize-none focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 h-11 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              {submitting ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Icon name="PaperAirplaneIcon" size={16} />
              )}
              {submitting ? 'جاري الإرسال...' : 'إرسال العرض'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 h-11 rounded-xl border border-border text-sm text-foreground hover:bg-muted transition-colors"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
