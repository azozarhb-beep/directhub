'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { useLanguage } from '@/contexts/LanguageContext';

const slides = [
  {
    src: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=1920&auto=format&fit=crop&q=85',
    alt: 'Global Industrial Machinery & Production Automation',
    sectorAr: 'الآلات وخطوط الإنتاج الصناعية',
    sectorEn: 'Industrial Machinery & Automation',
    sectorZh: '工业机械与自动化',
    sectorTr: 'Endüstriyel Makineler ve Otomasyon',
  },
  {
    src: 'https://images.unsplash.com/photo-1578575437130-527eed3abbec?w=1920&auto=format&fit=crop&q=85',
    alt: 'Mega Ocean Container Freight & Global Maritime Logistics',
    sectorAr: 'الشحن البحري وسلاسل الإمداد الدولية',
    sectorEn: 'Ocean Freight & Global Supply Chain',
    sectorZh: '海运与全球供应链',
    sectorTr: 'Deniz Taşımacılığı ve Küresel Tedarik',
  },
  {
    src: 'https://images.unsplash.com/photo-1504917599217-d4dc5ebe6122?w=1920&auto=format&fit=crop&q=85',
    alt: 'Heavy Metals, Steel & Industrial Manufacturing',
    sectorAr: 'المعادن والصلب والتصنيع الثقيل',
    sectorEn: 'Metals, Steel & Heavy Industry',
    sectorZh: '金属、钢铁与重工业',
    sectorTr: 'Metaller, Çelik ve Ağır Sanayi',
  },
  {
    src: 'https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=1920&auto=format&fit=crop&q=85',
    alt: 'Smart Robotics & Precision Factory Assembly',
    sectorAr: 'أتمتة المصانع الذكية والروبوتات',
    sectorEn: 'Smart Robotics & Automated Assembly',
    sectorZh: '智能机器人与自动化装配',
    sectorTr: 'Akıllı Robotik ve Otomatik Montaj',
  },
  {
    src: 'https://images.unsplash.com/photo-1553413077-190dd305871c?w=1920&auto=format&fit=crop&q=85',
    alt: 'Advanced Global Logistics Hub & Warehousing',
    sectorAr: 'المستودعات والمراكز اللوجستية الكبرى',
    sectorEn: 'Global Logistics Hubs & Warehousing',
    sectorZh: '全球物流枢纽与仓储',
    sectorTr: 'Küresel Lojistik Merkezleri ve Depolama',
  },
];

const INTERVAL_MS = 5500;

const HeroSection: React.FC = () => {
  const [current, setCurrent] = useState(0);
  const [loaded, setLoaded] = useState<boolean[]>(slides.map((_, i) => i === 0));
  const { t, language, isRTL } = useLanguage();

  const getSectorLabel = (slide: (typeof slides)[0]) => {
    if (language === 'ar') return slide.sectorAr;
    if (language === 'zh') return slide.sectorZh;
    if (language === 'tr') return slide.sectorTr;
    return slide.sectorEn;
  };

  const next = useCallback(() => {
    setCurrent((prev) => (prev + 1) % slides.length);
  }, []);

  useEffect(() => {
    const timer = setInterval(next, INTERVAL_MS);
    return () => clearInterval(timer);
  }, [next]);

  useEffect(() => {
    const nextIdx = (current + 1) % slides.length;
    setLoaded((prev) => {
      if (prev[nextIdx]) return prev;
      const updated = [...prev];
      updated[nextIdx] = true;
      return updated;
    });
  }, [current]);

  return (
    <section
      className="relative w-full overflow-hidden bg-slate-950"
      style={{ minHeight: '100svh' }}
      aria-label="DirectHub hero"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Slider images with smooth cinematic Ken-Burns zoom */}
      <div className="absolute inset-0 z-0">
        {slides.map((slide, idx) =>
          loaded[idx] ? (
            <div
              key={idx}
              className="absolute inset-0 transition-opacity duration-1000 ease-in-out"
              style={{ opacity: idx === current ? 1 : 0 }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={slide.src}
                alt={slide.alt}
                className={`w-full h-full object-cover object-center transition-transform duration-[7000ms] ease-out ${
                  idx === current ? 'scale-105' : 'scale-100'
                }`}
                loading={idx === 0 ? 'eager' : 'lazy'}
              />
            </div>
          ) : null
        )}

        {/* Cinematic dark gradients */}
        <div className="absolute inset-0 bg-black/60" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-black/35" />
      </div>

      {/* Content */}
      <div
        className="relative z-10 flex flex-col items-center justify-center text-center w-full px-4 sm:px-6 md:px-8"
        style={{
          minHeight: '100svh',
          paddingTop: 'calc(4.5rem + env(safe-area-inset-top, 0px))',
          paddingBottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))',
        }}
      >
        {/* Sector badge */}
        <div className="mb-4 flex items-center gap-2 px-3.5 py-1.5 bg-white/10 backdrop-blur-md rounded-full border border-white/20 shadow-lg">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-white text-xs font-semibold tracking-wide">
            {getSectorLabel(slides[current])}
          </span>
        </div>

        {/* Main heading */}
        <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-white leading-tight mb-4 max-w-4xl tracking-tight drop-shadow-md">
          {t.hero.title}
        </h1>

        {/* Subtitle */}
        <p className="text-white/85 text-sm sm:text-base md:text-lg max-w-2xl mb-8 leading-relaxed font-normal drop-shadow">
          {t.hero.subtitle}
        </p>

        {/* Search bar */}
        <div className="w-full max-w-2xl mb-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const input = (e.currentTarget.querySelector('input') as HTMLInputElement)?.value?.trim();
              if (input) window.location.href = `/search?q=${encodeURIComponent(input)}`;
              else window.location.href = '/search';
            }}
            className="flex items-stretch h-12 sm:h-14 rounded-2xl overflow-hidden shadow-2xl border border-white/25 bg-white/95 backdrop-blur-sm"
          >
            <input
              type="text"
              placeholder={t.hero.searchPlaceholder}
              className="flex-1 px-4 sm:px-5 text-sm sm:text-base bg-transparent text-gray-900 placeholder:text-gray-500 focus:outline-none"
              aria-label={t.hero.searchPlaceholder}
            />

            <button
              type="submit"
              className="shrink-0 px-5 sm:px-7 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm sm:text-base active:opacity-85 transition-opacity flex items-center gap-2"
            >
              <Icon name="MagnifyingGlassIcon" size={18} />
              <span className="hidden sm:inline">{t.hero.searchButton}</span>
            </button>
          </form>
        </div>

        {/* CTA buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/categories"
            className="flex items-center gap-2 px-5 py-2.5 bg-white/15 hover:bg-white/25 backdrop-blur-md text-white font-semibold text-sm rounded-xl border border-white/30 transition-all shadow-md active:scale-95"
          >
            <Icon name="Squares2X2Icon" size={16} />
            {t.hero.browseCategories}
          </Link>
          <Link
            href="/rfq/create"
            className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm rounded-xl transition-all shadow-lg active:scale-95"
          >
            <Icon name="DocumentTextIcon" size={16} />
            {t.nav.postRFQ}
          </Link>
        </div>

        {/* Stats row */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-6 sm:gap-10">
          {[
            { value: '50K+', label: t.hero.stats.suppliers },
            { value: '200K+', label: t.hero.stats.products },
            { value: '80+', label: t.hero.stats.countries },
            { value: '10K+', label: t.hero.stats.orders },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-2xl sm:text-3xl font-black text-white drop-shadow">{stat.value}</p>
              <p className="text-white/75 text-xs sm:text-sm mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Slide indicators */}
        <div className="absolute bottom-8 flex items-center gap-1.5">
          {slides.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrent(idx)}
              className={`rounded-full transition-all duration-300 ${
                idx === current ? 'w-7 h-1.5 bg-white shadow-md' : 'w-1.5 h-1.5 bg-white/40 hover:bg-white/70'
              }`}
              aria-label={`Slide ${idx + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
