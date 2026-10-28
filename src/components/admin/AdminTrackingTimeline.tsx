'use client';

import React from 'react';
import Icon from '@/components/ui/AppIcon';

export interface TrackingActor {
  id?: string | null;
  name?: string | null;
  role?: string | null;
  email?: string | null;
  referral_code?: string | null;
}

export interface TrackingStep {
  key: string;
  title: string;
  subtitle: string;
  icon: string;
  actor?: TrackingActor | null;
  extra?: string | null;
}

interface AdminTrackingTimelineProps {
  title: string;
  steps: TrackingStep[];
}

const ROLE_LABELS: Record<string, string> = {
  agent: 'مندوب ميداني',
  manufacturer: 'المصنع',
};

export default function AdminTrackingTimeline({ title, steps }: AdminTrackingTimelineProps) {
  return (
    <section className="rounded-2xl bg-[#161b22] border border-[#30363d] p-4" dir="rtl" aria-label={title}>
      <div className="flex items-center gap-2 mb-4">
        <Icon name="ClipboardDocumentListIcon" size={18} className="text-blue-400" />
        <h2 className="text-sm font-bold text-white">{title}</h2>
        <span className="mr-auto px-2 py-0.5 rounded-full bg-red-900/50 border border-red-800 text-red-300 text-[10px] font-bold">للإدارة فقط</span>
      </div>
      <ol className="relative space-y-4 pr-6 border-r-2 border-slate-700">
        {steps?.map?.((s) => (
          <li key={s.key} className="relative">
            <span className="absolute -right-[37px] top-0 w-7 h-7 rounded-full bg-slate-800 border-2 border-blue-500 flex items-center justify-center">
              <Icon name={s.icon} size={14} className="text-blue-300" />
            </span>
            <p className="text-xs text-slate-400">{s.subtitle}</p>
            <p className="text-sm font-bold text-white">{s.title}</p>
            {s.actor?.name ? (
              <div className="mt-1 text-xs text-slate-300 space-y-0.5">
                <p>
                  <span className="text-slate-100 font-semibold">{s.actor.name}</span>
                  {s.actor.role ? <span className="text-slate-500"> · {ROLE_LABELS[s.actor.role] || s.actor.role}</span> : null}
                </p>
                {s.actor.referral_code ? <p className="text-slate-500">كود الإحالة: {s.actor.referral_code}</p> : null}
                {s.actor.email ? <p className="text-slate-500">{s.actor.email}</p> : null}
              </div>
            ) : (
              <p className="mt-1 text-xs text-slate-500">غير متوفر / لا يوجد مندوب</p>
            )}
            {s.extra ? <p className="mt-1 text-[11px] text-amber-300">{s.extra}</p> : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
