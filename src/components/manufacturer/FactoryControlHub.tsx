'use client';

import React from 'react';
import Link from 'next/link';
import {
  FACTORY_MODULES,
  FACTORY_SECTIONS,
  type FactoryModuleDef,
  type FactoryModuleKey,
} from '@/components/manufacturer/factoryModules';
import { useFactoryHubCounts, type FactoryModuleCounts } from '@/components/manufacturer/useFactoryHubCounts';
import { useSalesRepAccess } from '@/components/manufacturer/useSalesRepAccess';

/** Modules a sales-rep sub-account may see on the hub. Everything else is removed. */
const SALES_REP_ALLOWED_MODULES: FactoryModuleKey[] = ['products', 'inventory', 'rfq', 'orders', 'logistics'];

interface Badge {
  label: string;
  tone: 'neutral' | 'warn' | 'ok' | 'info';
}

const TONE_CLASS: Record<Badge['tone'], string> = {
  neutral: 'bg-slate-800/80 text-slate-300 border-slate-600/60',
  warn: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
  ok: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  info: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40',
};

function dynamicBadges(def: FactoryModuleDef, c: FactoryModuleCounts): Badge[] {
  const out: Badge[] = [];
  switch (def.key) {
    case 'products':
      out.push({ label: `${c.products} منتج`, tone: 'info' });
      if (c.activeProducts > 0) out.push({ label: `${c.activeProducts} نشط`, tone: 'ok' });
      break;
    case 'inventory':
      out.push({ label: `${c.inventory} مادة`, tone: 'info' });
      if (c.lowStock > 0) out.push({ label: `⚠ ${c.lowStock} مخزون منخفض`, tone: 'warn' });
      break;
    case 'rfq':
      out.push({ label: `${c.rfq} عرض مقدم`, tone: 'info' });
      break;
    case 'orders':
      out.push({ label: `${c.orders} طلب`, tone: 'info' });
      if (c.pendingOrders > 0) out.push({ label: `${c.pendingOrders} قيد المعالجة`, tone: 'warn' });
      break;
    case 'escrow':
      out.push({ label: `${c.escrow} طلب ضمان`, tone: 'info' });
      if (c.escrowPending > 0) out.push({ label: `${c.escrowPending} بانتظار التحرير`, tone: 'warn' });
      break;
    case 'bank-accounts':
      out.push({ label: `${c.bankAccounts} حساب`, tone: 'info' });
      break;
    case 'documents':
      out.push({ label: `${c.documents} مستند`, tone: 'info' });
      break;
    default:
      break;
  }
  return out;
}

interface FactoryControlHubProps {
  userId?: string | null;
}

export default function FactoryControlHub({ userId }: FactoryControlHubProps) {
  const { counts } = useFactoryHubCounts(userId);
  const { loading: roleLoading, isSalesRep } = useSalesRepAccess();

  if (roleLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // استبعاد بطاقة مراسلة الإدارة وأي بطاقة مراسلات بشكل قطعي
  const visibleModules = FACTORY_MODULES.filter(
    (m) =>
      m.key !== 'messages' &&
      !m.title.includes('مراسلة') &&
      (!isSalesRep || SALES_REP_ALLOWED_MODULES.includes(m.key))
  );

  return (
    <div className="space-y-6 sm:space-y-8" dir="rtl">
      {FACTORY_SECTIONS.map((section) => {
        const modules = visibleModules.filter((m) => m.section === section.key);
        if (modules.length === 0) return null;
        return (
          <section key={section.key} aria-labelledby={`hub-${section.key}`}>
            <div className="flex items-center gap-2.5 mb-2.5 sm:mb-3">
              <div className="w-1.5 h-5 sm:h-6 rounded-full bg-cyan-500 shrink-0" />
              <div>
                <h2 id={`hub-${section.key}`} className="text-sm sm:text-base font-bold text-white leading-tight">
                  {section.title}
                </h2>
                <p className="text-[10px] sm:text-[11px] text-slate-400">{section.subtitle}</p>
              </div>
            </div>

            {/* شبكة البطاقات المدمجة: عمودين في الهواتف وثلاثة في الشاشات الأكبر */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3.5">
              {modules.map((m) => {
                const badges: Badge[] = [
                  ...dynamicBadges(m, counts),
                  ...m.staticBadges.map((label) => ({ label, tone: 'neutral' as const })),
                ];

                return (
                  <Link
                    key={m.key}
                    href={m.href}
                    className={`group relative flex flex-col justify-between rounded-2xl border bg-gradient-to-br ${m.accent} p-3 sm:p-4 min-h-[125px] sm:min-h-[140px] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/40 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-1.5 mb-1.5">
                        <span className="text-2xl sm:text-3xl select-none" aria-hidden="true">{m.icon}</span>
                        <span className="text-slate-400 group-hover:text-cyan-300 group-hover:-translate-x-0.5 transition-all text-base" aria-hidden="true">←</span>
                      </div>
                      <h3 className="text-xs sm:text-sm font-bold text-white leading-snug line-clamp-1">{m.title}</h3>
                      <p className="text-[10px] sm:text-[11px] text-slate-300/80 leading-snug line-clamp-2 mt-0.5">{m.hint}</p>
                    </div>

                    {badges.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-2 mt-auto">
                        {badges.map((b) => (
                          <span
                            key={`${m.key}-${b.label}`}
                            className={`px-1.5 sm:px-2 py-0.5 rounded-md border text-[9px] sm:text-[10px] font-semibold tracking-tight ${TONE_CLASS[b.tone]}`}
                          >
                            {b.label}
                          </span>
                        ))}
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
