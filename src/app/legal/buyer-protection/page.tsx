'use client';

import React from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import Icon from '@/components/ui/AppIcon';
import { useLanguage } from '@/contexts/LanguageContext';

export default function BuyerProtectionPage() {
  const { t, dir } = useLanguage();
  const p = t.buyerProtection;

  return (
    <div className="min-h-screen bg-background" dir={dir}>
      <Header />
      <div className="max-w-3xl mx-auto px-4 py-8 pb-24">
        <div className="bg-gradient-to-br from-emerald-700 to-emerald-500 rounded-2xl p-6 mb-8 text-white">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
              <Icon name="ShieldCheckIcon" size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">{p.title}</h1>
              <p className="text-emerald-100 text-sm">{p.subtitle}</p>
            </div>
          </div>
          <p className="text-emerald-50 text-sm leading-relaxed">{p.intro}</p>
        </div>

        <div className="space-y-6">
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center">
                <Icon name="LockClosedIcon" size={18} className="text-emerald-700" />
              </div>
              <h2 className="font-bold text-foreground">{p.escrowTitle}</h2>
            </div>
            <div className="space-y-3">
              {[
                { icon: 'BanknotesIcon', color: 'text-emerald-600', title: p.fundHoldTitle, body: p.fundHoldBody },
                { icon: 'CheckCircleIcon', color: 'text-blue-600', title: p.conditionalReleaseTitle, body: p.conditionalReleaseBody },
                { icon: 'ArrowUturnLeftIcon', color: 'text-amber-600', title: p.refundTitle, body: p.refundBody },
              ].map((item, i) => (
                <div key={i} className="flex gap-3 p-3 bg-muted/30 rounded-xl">
                  <Icon name={item.icon as any} size={18} className={`${item.color} shrink-0 mt-0.5`} />
                  <div>
                    <p className="font-semibold text-foreground text-sm">{item.title}</p>
                    <p className="text-muted-foreground text-xs leading-relaxed mt-0.5">{item.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center">
                <Icon name="TruckIcon" size={18} className="text-blue-700" />
              </div>
              <h2 className="font-bold text-foreground">{p.logisticsTitle}</h2>
            </div>
            <div className="space-y-3">
              {[
                { icon: 'DocumentCheckIcon', color: 'text-blue-600', title: p.partnersTitle, body: p.partnersBody },
                { icon: 'ShieldExclamationIcon', color: 'text-purple-600', title: p.slaTitle, body: p.slaBody },
                { icon: 'CurrencyDollarIcon', color: 'text-emerald-600', title: p.shippingEscrowTitle, body: p.shippingEscrowBody },
              ].map((item, i) => (
                <div key={i} className="flex gap-3 p-3 bg-muted/30 rounded-xl">
                  <Icon name={item.icon as any} size={18} className={`${item.color} shrink-0 mt-0.5`} />
                  <div>
                    <p className="font-semibold text-foreground text-sm">{item.title}</p>
                    <p className="text-muted-foreground text-xs leading-relaxed mt-0.5">{item.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center">
                <Icon name="ArrowUturnLeftIcon" size={18} className="text-amber-700" />
              </div>
              <h2 className="font-bold text-foreground">{p.refundCasesTitle}</h2>
            </div>
            <div className="space-y-3">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                <p className="text-xs font-bold text-emerald-800 mb-2 flex items-center gap-1.5">
                  <Icon name="CheckCircleIcon" size={14} /> {p.fullRefund}
                </p>
                <ul className="space-y-1">
                  {p.fullRefundItems.map((item, i) => (
                    <li key={i} className="text-xs text-emerald-700 flex gap-1.5"><span>•</span>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <p className="text-xs font-bold text-amber-800 mb-2 flex items-center gap-1.5">
                  <Icon name="AdjustmentsHorizontalIcon" size={14} /> {p.partialRefund}
                </p>
                <ul className="space-y-1">
                  {p.partialRefundItems.map((item, i) => (
                    <li key={i} className="text-xs text-amber-700 flex gap-1.5"><span>•</span>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center">
                <Icon name="ExclamationTriangleIcon" size={18} className="text-red-700" />
              </div>
              <h2 className="font-bold text-foreground">{p.disputeTitle}</h2>
            </div>
            <div className="space-y-2">
              {p.disputeSteps.map((item, i) => (
                <div key={i} className="flex gap-3 p-3 bg-muted/30 rounded-xl">
                  <span className="w-6 h-6 rounded-full bg-red-100 text-red-700 text-xs font-bold flex items-center justify-center shrink-0">{item.step}</span>
                  <div>
                    <p className="font-semibold text-foreground text-sm">{item.title}</p>
                    <p className="text-muted-foreground text-xs leading-relaxed">{item.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 bg-muted/50 border border-border rounded-xl">
            <p className="text-xs text-muted-foreground leading-relaxed">
              <strong className="text-foreground">{p.disclaimerLabel}</strong> {p.disclaimer}
            </p>
          </div>

          <div className="flex gap-3">
            <Link href="/legal/shipping-terms" className="flex-1 flex items-center justify-center gap-2 h-11 border border-border rounded-xl text-sm font-semibold text-foreground hover:bg-muted transition-colors">
              <Icon name="TruckIcon" size={16} />
              {p.shippingTermsLink}
            </Link>
            <Link href="/logistics/register" className="flex-1 flex items-center justify-center gap-2 h-11 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:opacity-90 transition-opacity">
              <Icon name="UserPlusIcon" size={16} />
              {p.registerLogistics}
            </Link>
          </div>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
