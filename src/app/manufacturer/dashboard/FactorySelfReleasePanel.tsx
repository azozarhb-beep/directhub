'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';

interface Checks {
  escrow_funded?: boolean;
  tranche_1_released?: boolean;
  bl_uploaded?: boolean;
  bl_verified?: boolean;
  already_released?: boolean;
}

interface Eligibility {
  eligible: boolean;
  reason: string | null;
  checks: Checks;
}

interface Props {
  orderId: string;
  /** Changing this value (e.g. bl_document_url / bl_verified_at) re-runs the eligibility check. */
  refreshKey?: string | null;
  onReleased?: () => void;
}

const REASON_LABEL: Record<string, string> = {
  not_authenticated: 'يجب تسجيل الدخول',
  order_not_found: 'الطلب غير موجود',
  not_order_owner: 'هذا الطلب لا يخص مصنعك',
  already_released: 'تم صرف الدفعة الثانية (40%) مسبقاً',
  escrow_not_funded: 'لم يتم إيداع الضمان بعد',
  tranche_1_pending: 'الدفعة الأولى (30%) لم تُصرف بعد',
  bl_not_uploaded: 'لم يتم رفع بوليصة الشحن (B/L)',
  bl_not_verified: 'بوليصة الشحن بانتظار التحقق',
};

export default function FactorySelfReleasePanel({ orderId, refreshKey, onReleased }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [releasing, setReleasing] = useState(false);
  const [elig, setElig] = useState<Eligibility | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const check = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('check_milestone_2_eligibility', { p_order_id: orderId });
    if (error) {
      setMsg({ ok: false, text: error.message });
      setElig(null);
    } else {
      setElig(data as Eligibility);
    }
    setLoading(false);
  }, [orderId, supabase]);

  useEffect(() => {
    setMsg(null);
    check();
  }, [check, refreshKey]);

  const handleRelease = async () => {
    setReleasing(true);
    setMsg(null);
    const { data, error } = await supabase.rpc('factory_self_release_milestone_2', { p_order_id: orderId });
    if (error) {
      setMsg({ ok: false, text: error.message });
    } else if ((data as any)?.released) {
      setMsg({ ok: true, text: 'تم صرف الدفعة الثانية (40%) إلى رصيد المصنع بنجاح.' });
      onReleased?.();
    } else {
      const reason = String((data as any)?.reason || '');
      setMsg({ ok: false, text: REASON_LABEL[reason] || 'تعذر صرف الدفعة حالياً' });
    }
    setReleasing(false);
    check();
  };

  const rows: { key: keyof Checks; label: string }[] = [
    { key: 'escrow_funded', label: 'تم إيداع الضمان' },
    { key: 'tranche_1_released', label: 'تم صرف الدفعة الأولى (30%)' },
    { key: 'bl_uploaded', label: 'تم رفع بوليصة الشحن (B/L)' },
    { key: 'bl_verified', label: 'تم التحقق من بوليصة الشحن' },
  ];

  const released = !!elig?.checks?.already_released;

  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 space-y-3" dir="rtl">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
          <Icon name="BanknotesIcon" size={18} className="text-emerald-700" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-bold text-emerald-900">صرف الدفعة الثانية (40%) ذاتياً</h4>
          <p className="text-[11px] text-emerald-800/80 leading-relaxed">
            يتم فحص الأهلية تلقائياً. تُفتح الدفعة فور التحقق من بوليصة الشحن بعد صرف الدفعة الأولى.
          </p>
        </div>
      </div>

      {loading && !elig ? (
        <div className="flex items-center gap-2 text-xs text-emerald-700">
          <Icon name="ArrowPathIcon" size={14} className="animate-spin" /> جارٍ فحص الأهلية...
        </div>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((r) => {
            const ok = !!elig?.checks?.[r.key] || (released && r.key !== 'already_released');
            return (
              <li key={r.key} className="flex items-center gap-1.5 text-[11px]">
                <Icon
                  name={ok ? 'CheckCircleIcon' : 'ClockIcon'}
                  size={13}
                  className={ok ? 'text-green-600' : 'text-muted-foreground'}
                />
                <span className={ok ? 'text-green-700' : 'text-muted-foreground'}>{r.label}</span>
              </li>
            );
          })}
        </ul>
      )}

      {elig && !elig.eligible && elig.reason && !released && (
        <p className="text-[11px] font-semibold text-amber-700">
          غير مؤهل حالياً: {REASON_LABEL[elig.reason] || elig.reason}
        </p>
      )}

      <button
        type="button"
        onClick={handleRelease}
        disabled={!elig?.eligible || releasing || released}
        className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-emerald-600 text-white text-xs font-bold disabled:opacity-40 hover:bg-emerald-700 transition-colors"
      >
        {releasing ? (
          <><Icon name="ArrowPathIcon" size={14} className="animate-spin" /> جارٍ الصرف...</>
        ) : released ? (
          <><Icon name="CheckIcon" size={14} /> تم الصرف</>
        ) : (
          <><Icon name="BanknotesIcon" size={14} /> صرف الدفعة الثانية (40%)</>
        )}
      </button>

      {msg && (
        <div
          className={`rounded-lg px-3 py-2 text-xs font-semibold border ${
            msg.ok ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {msg.text}
        </div>
      )}
    </div>
  );
}
