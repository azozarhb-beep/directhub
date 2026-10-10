'use client';

import React from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import Icon from '@/components/ui/AppIcon';
import { useLanguage } from '@/contexts/LanguageContext';

const SLA_ICONS = ['ShieldCheckIcon', 'ClockIcon', 'EyeIcon', 'ScaleIcon', 'BanknotesIcon'] as const;
const SLA_COLORS = ['text-emerald-600', 'text-blue-600', 'text-purple-600', 'text-amber-600', 'text-red-600'];
const PHASE_COLORS = [
  'bg-blue-50 border-blue-200 text-blue-800',
  'bg-amber-50 border-amber-200 text-amber-800',
  'bg-emerald-50 border-emerald-200 text-emerald-800',
  'bg-red-50 border-red-200 text-red-800',
];

export default function ShippingTermsPage() {
  const { t, dir } = useLanguage();
  const s = t.shippingTerms;

  return (
    <div className="min-h-screen bg-background" dir={dir}>
      <Header />
      <div className="max-w-3xl mx-auto px-4 py-8 pb-24">
        <div className="bg-gradient-to-br from-blue-700 to-blue-500 rounded-2xl p-6 mb-8 text-white">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
              <Icon name="TruckIcon" size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">{s.title}</h1>
              <p className="text-blue-100 text-sm">{s.subtitle}</p>
            </div>
          </div>
          <p className="text-blue-50 text-sm leading-relaxed">{s.intro}</p>
        </div>

        <div className="space-y-6">
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center">
                <Icon name="DocumentTextIcon" size={18} className="text-blue-700" />
              </div>
              <h2 className="font-bold text-foreground">{s.slaTitle}</h2>
            </div>
            <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
              <p>{s.slaIntro}</p>
              <div className="space-y-2">
                {s.slaItems.map((text, i) => (
                  <div key={i} className="flex gap-2.5 p-2.5 bg-muted/30 rounded-lg">
                    <Icon name={SLA_ICONS[i] as any} size={16} className={`${SLA_COLORS[i]} shrink-0 mt-0.5`} />
                    <p className="text-xs">{text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center">
                <Icon name="LockClosedIcon" size={18} className="text-emerald-700" />
              </div>
              <h2 className="font-bold text-foreground">{s.escrowIntegrationTitle}</h2>
            </div>
            <div className="space-y-3">
              {s.phases.map((item, i) => (
                <div key={i} className={`p-3 rounded-xl border ${PHASE_COLORS[i]}`}>
                  <p className="text-[10px] font-bold uppercase tracking-wide opacity-70 mb-1">{item.phase}</p>
                  <p className="font-semibold text-sm mb-1">{item.title}</p>
                  <p className="text-xs opacity-80 leading-relaxed">{item.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-lg bg-purple-100 flex items-center justify-center">
                <Icon name="CheckCircleIcon" size={18} className="text-purple-700" />
              </div>
              <h2 className="font-bold text-foreground">{s.checkboxTitle}</h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">{s.checkboxIntro}</p>
            <div className="space-y-2">
              {s.checkboxItems.map((item, i) => (
                <div key={i} className="flex gap-2 p-2.5 bg-purple-50 border border-purple-100 rounded-lg">
                  <Icon name="CheckIcon" size={14} className="text-purple-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-purple-800">{item}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center">
                <Icon name="GlobeAltIcon" size={18} className="text-amber-700" />
              </div>
              <h2 className="font-bold text-foreground">{s.incotermsTitle}</h2>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {s.incoterms.map((item, i) => (
                <div key={i} className="flex items-center gap-2 p-2.5 bg-muted/30 rounded-lg">
                  <span className="font-mono font-bold text-xs text-amber-700 bg-amber-100 px-2 py-0.5 rounded">{item.term}</span>
                  <span className="text-xs text-muted-foreground">{item.desc}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
            <div className="flex items-start gap-2">
              <Icon name="ExclamationTriangleIcon" size={16} className="text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-red-800 mb-1">{s.thirdPartyTitle}</p>
                <p className="text-xs text-red-700 leading-relaxed">{s.thirdPartyBody}</p>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <Link href="/legal/buyer-protection" className="flex-1 flex items-center justify-center gap-2 h-11 border border-border rounded-xl text-sm font-semibold text-foreground hover:bg-muted transition-colors">
              <Icon name="ShieldCheckIcon" size={16} />
              {s.buyerProtectionLink}
            </Link>
            <Link href="/logistics/register" className="flex-1 flex items-center justify-center gap-2 h-11 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:opacity-90 transition-opacity">
              <Icon name="TruckIcon" size={16} />
              {s.registerLogistics}
            </Link>
          </div>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
