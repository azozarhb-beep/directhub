'use client';

import React from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';
import Icon from '@/components/ui/AppIcon';
import AppLogo from '@/components/ui/AppLogo';
import { useLanguage } from '@/contexts/LanguageContext';

const STEP_ICONS = ['🔍', '🔒', '🚚', '✅', '💸'];
const STEP_COLORS = [
  { color: 'bg-blue-50 border-blue-200 text-blue-700', dot: 'bg-blue-500' },
  { color: 'bg-amber-50 border-amber-200 text-amber-700', dot: 'bg-amber-500' },
  { color: 'bg-green-50 border-green-200 text-green-700', dot: 'bg-green-500' },
  { color: 'bg-purple-50 border-purple-200 text-purple-700', dot: 'bg-purple-500' },
  { color: 'bg-orange-50 border-orange-200 text-orange-700', dot: 'bg-orange-500' },
];
const WHY_ICONS = ['⚡', '🔐', '🌍'];
const BENEFIT_ICONS = ['🏭', '⛓️', '🛡️', '🌐'];

export default function AboutPage() {
  const { t, dir } = useLanguage();
  const a = t?.about;

  return (
    <div className="min-h-screen bg-background" dir={dir}>
      <Header />
      <main className="max-w-5xl mx-auto px-4 md:px-6 py-10 pb-28 md:pb-16 space-y-16">

        <section className="text-center space-y-5">
          <div className="flex justify-center">
            <AppLogo size={64} />
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-foreground leading-tight">
            {a?.heroTitle} <span className="text-primary">{a?.brandName}</span>
          </h1>
          <p className="text-base md:text-lg text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            <strong className="text-foreground">{a?.brandName} (DirectHub)</strong> {a?.heroBody}
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Link href="/search" className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-bold rounded-xl hover:opacity-90 transition-opacity text-sm">
              <Icon name="MagnifyingGlassIcon" size={16} />
              {a?.browseProducts}
            </Link>
            <Link href="/suppliers" className="inline-flex items-center gap-2 px-6 py-3 border border-border text-foreground font-bold rounded-xl hover:bg-muted transition-colors text-sm">
              <Icon name="BuildingOffice2Icon" size={16} />
              {a?.browseFactories}
            </Link>
          </div>
        </section>

        <section>
          <div className="text-center mb-8">
            <span className="inline-block bg-primary/10 text-primary text-xs font-bold px-3 py-1 rounded-full mb-3">{a?.whyBadge}</span>
            <h2 className="text-2xl font-extrabold text-foreground">{a?.whyTitle}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {a?.why?.map((p, i) => (
              <div key={p?.title} className="bg-card border border-border rounded-2xl p-6 hover:border-primary/30 hover:shadow-md transition-all">
                <div className="text-3xl mb-3">{WHY_ICONS?.[i]}</div>
                <h3 className="font-extrabold text-foreground mb-2">{p?.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{p?.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-gradient-to-l from-primary/5 to-orange-50 border border-primary/20 rounded-3xl p-8 md:p-10">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center shrink-0">
              <Icon name="EyeIcon" size={24} className="text-primary" />
            </div>
            <div>
              <span className="inline-block bg-primary/10 text-primary text-xs font-bold px-3 py-1 rounded-full mb-3">{a?.visionBadge}</span>
              <h2 className="text-xl font-extrabold text-foreground mb-3">{a?.visionTitle}</h2>
              <p className="text-muted-foreground leading-relaxed">{a?.visionBody}</p>
            </div>
          </div>
        </section>

        <section>
          <div className="text-center mb-8">
            <span className="inline-block bg-blue-100 text-blue-700 text-xs font-bold px-3 py-1 rounded-full mb-3">{a?.factoriesBadge}</span>
            <h2 className="text-2xl font-extrabold text-foreground">{a?.factoriesTitle}</h2>
            <p className="text-muted-foreground mt-3 max-w-2xl mx-auto">{a?.factoriesBody}</p>
          </div>

          <div className="bg-gradient-to-l from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-6 md:p-8">
            <div className="flex items-start gap-4 mb-5">
              <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center shrink-0">
                <Icon name="ShieldCheckIcon" size={24} className="text-amber-600" variant="solid" />
              </div>
              <div>
                <h3 className="font-extrabold text-amber-900 text-lg mb-1">{a?.escrowTitle}</h3>
                <p className="text-xs font-semibold text-amber-600 mb-2">{a?.escrowSubtitle}</p>
                <p className="text-amber-800 leading-relaxed text-sm">{a?.escrowBody}</p>
              </div>
            </div>
            <div className="bg-amber-100/60 rounded-xl px-4 py-3 flex items-center gap-2">
              <Icon name="CheckBadgeIcon" size={18} className="text-amber-700 shrink-0" variant="solid" />
              <p className="text-sm font-bold text-amber-900">{a?.escrowBadge}</p>
            </div>
          </div>
        </section>

        <section>
          <div className="text-center mb-8">
            <span className="inline-block bg-green-100 text-green-700 text-xs font-bold px-3 py-1 rounded-full mb-3">{a?.buyersBadge}</span>
            <h2 className="text-2xl font-extrabold text-foreground">{a?.buyersTitle}</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {a?.benefits?.map((b, i) => (
              <div key={b?.title} className="bg-card border border-border rounded-2xl p-5 flex gap-4 hover:border-primary/30 hover:shadow-sm transition-all">
                <div className="text-3xl shrink-0">{BENEFIT_ICONS?.[i]}</div>
                <div>
                  <h3 className="font-extrabold text-foreground mb-1">{b?.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{b?.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-gradient-to-l from-blue-50 to-indigo-50 border border-blue-200 rounded-3xl p-8 md:p-10">
          <div className="text-center mb-6">
            <span className="inline-block bg-blue-100 text-blue-700 text-xs font-bold px-3 py-1 rounded-full mb-3">{a?.factoryBadge}</span>
            <h2 className="text-2xl font-extrabold text-foreground">{a?.factoryTitle}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white/70 rounded-2xl p-5 border border-blue-100">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">🆓</span>
                <h3 className="font-extrabold text-foreground">{a?.noSubscriptionTitle}</h3>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{a?.noSubscriptionDesc}</p>
            </div>
            <div className="bg-white/70 rounded-2xl p-5 border border-blue-100">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">📜</span>
                <h3 className="font-extrabold text-foreground">{a?.clearContractsTitle}</h3>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{a?.clearContractsDesc}</p>
            </div>
          </div>
          <div className="mt-5 text-center">
            <Link href="/factory/register" className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors text-sm">
              <Icon name="BuildingOffice2Icon" size={16} />
              {a?.registerFactoryFree}
            </Link>
          </div>
        </section>

        <section>
          <div className="text-center mb-10">
            <span className="inline-block bg-primary/10 text-primary text-xs font-bold px-3 py-1 rounded-full mb-3">{a?.journeyBadge}</span>
            <h2 className="text-2xl font-extrabold text-foreground">{a?.journeyTitle}</h2>
            <p className="text-muted-foreground mt-2 max-w-xl mx-auto text-sm">{a?.journeySubtitle}</p>
          </div>
          <div className="relative">
            <div className="hidden md:block absolute top-8 right-8 left-8 h-0.5 bg-gradient-to-l from-orange-200 via-primary/30 to-blue-200 z-0" />
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 relative z-10">
              {a?.steps?.map((step, idx) => (
                <div key={step?.number} className={`bg-card border rounded-2xl p-5 text-center hover:shadow-md transition-all ${STEP_COLORS?.[idx]?.color}`}>
                  <div className={`w-10 h-10 rounded-full ${STEP_COLORS?.[idx]?.dot} text-white font-extrabold text-lg flex items-center justify-center mx-auto mb-3`}>
                    {step?.number}
                  </div>
                  <div className="text-2xl mb-2">{STEP_ICONS?.[idx]}</div>
                  <h3 className="font-extrabold text-sm mb-1">{step?.title}</h3>
                  <p className="text-[10px] font-semibold opacity-70 mb-2">{step?.subtitle}</p>
                  <p className="text-xs leading-relaxed opacity-80">{step?.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="text-center bg-gradient-to-l from-primary/10 to-orange-50 border border-primary/20 rounded-3xl p-10">
          <h2 className="text-2xl font-extrabold text-foreground mb-3">{a?.ctaTitle}</h2>
          <p className="text-muted-foreground mb-6 max-w-lg mx-auto">{a?.ctaBody}</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/search" className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-bold rounded-xl hover:opacity-90 transition-opacity">
              <Icon name="ShoppingBagIcon" size={16} />
              {a?.browseProducts}
            </Link>
            <Link href="/factory/register" className="inline-flex items-center gap-2 px-6 py-3 border border-border text-foreground font-bold rounded-xl hover:bg-muted transition-colors">
              <Icon name="BuildingOffice2Icon" size={16} />
              {a?.registerFactory}
            </Link>
          </div>
        </section>

      </main>
      <Footer />
      <BottomNav />
    </div>
  );
}
