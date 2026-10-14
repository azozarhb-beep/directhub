'use client';

import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { validateVesselImo } from '@/lib/oceanCarrier';

export interface MaritimeBookingDetails {
  vessel_name: string;
  vessel_imo_number: string;
  voyage_number: string;
  booking_reference: string;
  container_numbers: string[];
  maritime_booked_at: string;
}

interface MaritimeBookingModalProps {
  orderId: string;
  orderLabel: string;
  partnerId: string;
  initial?: Partial<MaritimeBookingDetails>;
  onClose: () => void;
  onSaved: (details: MaritimeBookingDetails) => void;
}

const CONTAINER_NO_REGEX = /^[A-Z]{4}\d{7}$/;

export default function MaritimeBookingModal({
  orderId,
  orderLabel,
  partnerId,
  initial,
  onClose,
  onSaved,
}: MaritimeBookingModalProps) {
  const supabase = createClient();
  const [vesselName, setVesselName] = useState(initial?.vessel_name || '');
  const [vesselImo, setVesselImo] = useState(initial?.vessel_imo_number || '');
  const [voyage, setVoyage] = useState(initial?.voyage_number || '');
  const [bookingRef, setBookingRef] = useState(initial?.booking_reference || '');
  const [containers, setContainers] = useState((initial?.container_numbers || []).join('\n'));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const inputClass =
    'w-full h-11 px-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setError('');

    const name = vesselName.trim();
    const imo = vesselImo.trim().replace(/^IMO\s*/i, '');
    const voy = voyage.trim();
    const ref = bookingRef.trim();
    const list = containers
      .split(/[\s,;]+/)
      .map(c => c.trim().toUpperCase())
      .filter(Boolean);

    if (!name || !imo || !voy || !ref || list.length === 0) {
      setError('جميع الحقول إلزامية. / All fields are required.');
      return;
    }
    if (!validateVesselImo(imo)) {
      setError('رقم IMO للسفينة غير صالح (7 أرقام مع رقم تحقق). / Invalid vessel IMO number.');
      return;
    }
    const badContainer = list.find(c => !CONTAINER_NO_REGEX.test(c));
    if (badContainer) {
      setError(`رقم الحاوية غير صالح: ${badContainer} (الصيغة: 4 أحرف + 7 أرقام) / Invalid container number.`);
      return;
    }

    setSubmitting(true);
    const bookedAt = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        shipping_mode: 'ocean',
        vessel_name: name,
        vessel_imo_number: imo,
        voyage_number: voy,
        booking_reference: ref,
        container_numbers: list,
        maritime_booked_at: bookedAt,
        status: 'in_transit',
        updated_at: bookedAt,
      })
      .eq('id', orderId)
      .eq('logistics_partner_id', partnerId);

    setSubmitting(false);
    if (updateError) {
      setError(updateError.message || 'تعذر حفظ بيانات الحجز البحري.');
      return;
    }

    onSaved({
      vessel_name: name,
      vessel_imo_number: imo,
      voyage_number: voy,
      booking_reference: ref,
      container_numbers: list,
      maritime_booked_at: bookedAt,
    });
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
              <Icon name="GlobeAltIcon" size={18} className="text-blue-600" />
            </div>
            <div>
              <p className="font-bold text-foreground text-sm">بطاقة الحجز البحري (Maritime Booking)</p>
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
              اسم السفينة (Vessel Name) <span className="text-red-500">*</span>
            </label>
            <input value={vesselName} onChange={e => setVesselName(e.target.value)} placeholder="MSC ANNA" className={inputClass} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                رقم IMO للسفينة <span className="text-red-500">*</span>
              </label>
              <input
                dir="ltr"
                inputMode="numeric"
                maxLength={7}
                value={vesselImo}
                onChange={e => setVesselImo(e.target.value.replace(/\D/g, '').slice(0, 7))}
                placeholder="9074729"
                className={`${inputClass} text-left`}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                رقم الرحلة (Voyage) <span className="text-red-500">*</span>
              </label>
              <input
                dir="ltr"
                value={voyage}
                onChange={e => setVoyage(e.target.value)}
                placeholder="245E"
                className={`${inputClass} text-left`}
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              مرجع الحجز (Booking Reference) <span className="text-red-500">*</span>
            </label>
            <input
              dir="ltr"
              value={bookingRef}
              onChange={e => setBookingRef(e.target.value)}
              placeholder="BKG123456789"
              className={`${inputClass} text-left`}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              أرقام الحاويات (Container Numbers) <span className="text-red-500">*</span>
            </label>
            <textarea
              dir="ltr"
              rows={3}
              value={containers}
              onChange={e => setContainers(e.target.value)}
              placeholder={'MSCU1234567\nTGHU7654321'}
              className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm font-mono resize-none focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              required
            />
            <p className="text-[11px] text-muted-foreground mt-1">رقم في كل سطر أو مفصولة بفاصلة.</p>
          </div>

          {error && (
            <div className="px-3 py-2 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">{error}</div>
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
                <Icon name="GlobeAltIcon" size={16} />
              )}
              تأكيد الحجز
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
