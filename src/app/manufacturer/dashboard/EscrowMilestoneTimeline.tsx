'use client';

import React, { useRef, useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';

export interface EscrowMilestoneOrder {
  id: string;
  order_number?: string;
  total?: number;
  escrow_status?: string;
  factory_accepted_at?: string | null;
  factory_status?: string | null;
  ready_for_inspection_at?: string | null;
  milestone_1_paid?: boolean | null;
  milestone_2_paid?: boolean | null;
  milestone_3_paid?: boolean | null;
  qc_report_url?: string | null;
  qc_approved_at?: string | null;
  bl_document_url?: string | null;
  bl_verified_at?: string | null;
  bill_of_lading_url?: string | null;
}

type StepState = 'paid' | 'pending' | 'locked';

interface Step {
  key: 1 | 2 | 3;
  pct: number;
  amount: number;
  state: StepState;
  label: string;
  hint: string;
}

const FUNDED_STATUSES = [
  'funds_secured',
  'shipped',
  'ready_for_inspection',
  'pending_otp_confirmation',
  'pending_admin_payout',
  'funds_released',
];

export function computeMilestones(order: EscrowMilestoneOrder): Step[] {
  const total = Number(order.total || 0);
  const funded = FUNDED_STATUSES.includes(order.escrow_status || '');
  const accepted = !!order.factory_accepted_at || order.factory_status === 'accepted' || funded;
  const blUrl = order.bl_document_url || order.bill_of_lading_url || null;
  const ready = order.escrow_status === 'ready_for_inspection' || !!order.ready_for_inspection_at;
  const qcApproved = !!order.qc_report_url;

  const m1Paid = !!order.milestone_1_paid || (funded && accepted && order.escrow_status === 'funds_released');
  const m2Paid = !!order.milestone_2_paid || order.escrow_status === 'funds_released';
  const m3Paid = !!order.milestone_3_paid || order.escrow_status === 'funds_released';

  const m1Ready = funded && accepted;
  const m2Ready = ready && qcApproved;
  const m3Ready = !!blUrl && !!order.bl_verified_at;

  const s1: StepState = m1Paid ? 'paid' : m1Ready ? 'pending' : 'locked';
  const s2: StepState = m2Paid ? 'paid' : m2Ready ? 'pending' : 'locked';
  const s3: StepState = m3Paid ? 'paid' : m3Ready ? 'pending' : 'locked';

  return [
    {
      key: 1,
      pct: 30,
      amount: total * 0.3,
      state: s1,
      label: s1 === 'paid' ? 'دفعة بدء الإنتاج (30%) - محولة' : 'دفعة بدء الإنتاج (30%) - بانتظار التمويل وقبول المصنع',
      hint: 'تُحرَّر فور إيداع المشتري 100% في الضمان وقبول المصنع لأمر الشراء.',
    },
    {
      key: 2,
      pct: 40,
      amount: total * 0.4,
      state: s2,
      label: s2 === 'paid' ? 'دفعة فحص الجودة (40%) - محولة' : 'دفعة فحص الجودة (40%) - بانتظار اعتماد المندوب',
      hint: 'تُفتح عند إعلان "جاهز للفحص" واعتماد المندوب لتقرير فحص ميداني بالصور.',
    },
    {
      key: 3,
      pct: 30,
      amount: total * 0.3,
      state: s3,
      label: s3 === 'paid' ? 'دفعة الشحن النهائي (30%) - مكتملة' : 'دفعة الشحن النهائي (30%) - بانتظار بوليصة الشحن',
      hint: 'تُفتح عند رفع بوليصة الشحن (B/L) أو إيصال تسليم الحاوية والتحقق منها.',
    },
  ];
}

interface Props {
  order: EscrowMilestoneOrder;
  userId?: string;
  compact?: boolean;
  onChanged?: () => void;
}

const BUCKET = 'order-receipts';

export default function EscrowMilestoneTimeline({ order, userId, compact = false, onChanged }: Props) {
  const supabase = createClient();
  const blInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const steps = computeMilestones(order);
  const blUrl = order.bl_document_url || order.bill_of_lading_url || null;
  const ready = order.escrow_status === 'ready_for_inspection' || !!order.ready_for_inspection_at;

  const handleBlUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !order.id) return;
    if (file.size > 10 * 1024 * 1024) {
      setMsg({ ok: false, text: 'حجم الملف يتجاوز 10 ميجابايت' });
      return;
    }
    setUploading(true);
    setMsg(null);
    try {
      const ext = (file.name.split('.').pop() || 'pdf').toLowerCase();
      const path = `${userId || 'factory'}/bl/${order.id}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
        upsert: true,
        contentType: file.type || undefined,
      });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const url = pub?.publicUrl;
      if (!url) throw new Error('تعذر الحصول على رابط الملف');
      const { error: updErr } = await supabase
        .from('orders')
        .update({ bl_document_url: url, bl_verified_at: null })
        .eq('id', order.id);
      if (updErr) throw updErr;
      setMsg({ ok: true, text: 'تم رفع بوليصة الشحن — بانتظار التحقق منها من الإدارة المالية.' });
      onChanged?.();
    } catch (err: any) {
      setMsg({ ok: false, text: err?.message || 'فشل رفع المستند' });
    } finally {
      setUploading(false);
    }
  };

  const stateStyle = (s: StepState) =>
    s === 'paid'
      ? { dot: 'bg-green-600 text-white border-green-600', card: 'border-green-200 bg-green-50/60', text: 'text-green-800', badge: 'bg-green-100 text-green-700 border-green-200', badgeText: 'محولة' }
      : s === 'pending'
      ? { dot: 'bg-amber-500 text-white border-amber-500', card: 'border-amber-300 bg-amber-50/60', text: 'text-amber-900', badge: 'bg-amber-100 text-amber-700 border-amber-200', badgeText: 'جاهزة للصرف' }
      : { dot: 'bg-muted text-muted-foreground border-border', card: 'border-border bg-muted/30', text: 'text-muted-foreground', badge: 'bg-muted text-muted-foreground border-border', badgeText: 'مقفلة' };

  if (compact) {
    return (
      <div className="flex items-center gap-1.5 mt-2" dir="rtl" aria-label="مراحل الدفع">
        {steps.map((s, i) => {
          const st = stateStyle(s.state);
          return (
            <React.Fragment key={s.key}>
              <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[10px] font-bold ${st.badge}`}>
                <span>{s.pct}%</span>
                {s.state === 'paid' && <Icon name="CheckIcon" size={10} />}
              </div>
              {i < steps.length - 1 && <div className={`flex-1 h-0.5 ${s.state === 'paid' ? 'bg-green-400' : 'bg-border'}`} />}
            </React.Fragment>
          );
        })}
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-4 space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-foreground">مراحل صرف الضمان (30% / 40% / 30%)</h4>
        <span className="text-[10px] text-muted-foreground">إجمالي الطلب: ${Number(order.total || 0).toLocaleString('en-US')}</span>
      </div>

      <ol className="space-y-3">
        {steps.map((s, i) => {
          const st = stateStyle(s.state);
          return (
            <li key={s.key} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold shrink-0 ${st.dot}`}>
                  {s.state === 'paid' ? <Icon name="CheckIcon" size={14} /> : s.key}
                </div>
                {i < steps.length - 1 && <div className={`w-0.5 flex-1 min-h-[16px] mt-1 ${s.state === 'paid' ? 'bg-green-400' : 'bg-border'}`} />}
              </div>
              <div className={`flex-1 rounded-xl border p-3 ${st.card}`}>
                <div className="flex items-start justify-between gap-2">
                  <p className={`text-sm font-bold ${st.text}`}>{s.label}</p>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${st.badge}`}>{st.badgeText}</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{s.hint}</p>
                <p className={`text-xs font-bold mt-1.5 ${st.text}`}>
                  ${s.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>

                {s.key === 2 && (
                  <div className="mt-2 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <Icon name={ready ? 'CheckCircleIcon' : 'ClockIcon'} size={13} className={ready ? 'text-green-600' : 'text-muted-foreground'} />
                      <span className={ready ? 'text-green-700' : 'text-muted-foreground'}>
                        {ready ? 'تم إعلان "جاهز للفحص"' : 'بانتظار إعلان "جاهز للفحص" من المصنع (زر الإعلان أدناه)'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <Icon name={order.qc_report_url ? 'CheckCircleIcon' : 'ClockIcon'} size={13} className={order.qc_report_url ? 'text-green-600' : 'text-muted-foreground'} />
                      <span className={order.qc_report_url ? 'text-green-700' : 'text-muted-foreground'}>
                        {order.qc_report_url ? 'اعتمد المندوب تقرير الفحص بالصور' : 'بانتظار تقرير فحص المندوب المعتمد بالصور'}
                      </span>
                      {order.qc_report_url && (
                        <a href={order.qc_report_url} target="_blank" rel="noopener noreferrer" className="text-primary underline mr-1">
                          عرض التقرير
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {s.key === 3 && (
                  <div className="mt-2 space-y-2">
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <Icon name={blUrl ? 'CheckCircleIcon' : 'ClockIcon'} size={13} className={blUrl ? 'text-green-600' : 'text-muted-foreground'} />
                      <span className={blUrl ? 'text-green-700' : 'text-muted-foreground'}>
                        {blUrl ? (order.bl_verified_at ? 'تم التحقق من بوليصة الشحن' : 'تم الرفع — بانتظار التحقق') : 'لم يتم رفع بوليصة الشحن / إيصال تسليم الحاوية'}
                      </span>
                      {blUrl && (
                        <a href={blUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline mr-1">
                          عرض المستند
                        </a>
                      )}
                    </div>
                    {s.state !== 'paid' && (
                      <>
                        <input
                          ref={blInputRef}
                          type="file"
                          accept="application/pdf,image/jpeg,image/png,image/webp"
                          className="hidden"
                          onChange={handleBlUpload}
                        />
                        <button
                          type="button"
                          onClick={() => blInputRef.current?.click()}
                          disabled={uploading}
                          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-bold disabled:opacity-50 hover:opacity-90 transition-opacity"
                        >
                          {uploading ? (
                            <><Icon name="ArrowPathIcon" size={14} className="animate-spin" /> جاري الرفع...</>
                          ) : (
                            <><Icon name="ArrowUpTrayIcon" size={14} /> {blUrl ? 'استبدال بوليصة الشحن / إيصال التسليم' : 'رفع بوليصة الشحن / إيصال تسليم الحاوية'}</>
                          )}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {msg && (
        <div className={`rounded-lg px-3 py-2 text-xs font-semibold border ${msg.ok ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          {msg.text}
        </div>
      )}
    </div>
  );
}
