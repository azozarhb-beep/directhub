'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { useLanguage } from '@/contexts/LanguageContext';

const slides = [
  {
    // الآلات وخطوط الإنتاج
    src: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=1920&auto=format&fit=crop&q=90',
    alt: 'Smart Factory & Industrial Robotics',
    sectorAr: 'الآلات وخطوط الإنتاج',
    sectorEn: 'Machinery & Automation',
    sectorZh: '机械与自动化',
    sectorTr: 'Makineler ve Otomasyon',
    titleAr: 'خطوط إنتاج وآلات صناعية متطورة',
    titleEn: 'Advanced Production Lines & Machinery',
    subAr: 'توريد معدات المصانع وخطوط الإنتاج رأساً من المصانع العالمية بأسعار تنافسية وضمان موثق.',
    subEn: 'Source industrial machinery directly from global manufacturers at factory rates.',
  },
  {
    // الشحن البحري واللوجستيات
    src: 'https://images.unsplash.com/photo-1578575437130-527eed3abbec?w=1920&auto=format&fit=crop&q=90',
    alt: 'Global Ocean Freight Port & Logistics',
    sectorAr: 'الشحن واللوجستيات الدولية',
    sectorEn: 'Global Ocean Freight & Logistics',
    sectorZh: '全球海运与物流',
    sectorTr: 'Küresel Deniz Taşımacılığı ve Lojistik',
    titleAr: 'شحن بحري وسلاسل إمداد دولية',
    titleEn: 'Ocean Freight & Global Supply Chain',
    subAr: 'شحن الحاويات الكاملة والمجزأة وتخليص جمركي مباشر إلى الموانئ والمستودعات بضمان مالي مشروط.',
    subEn: 'Full container (FCL) & consolidated (LCL) freight with certified customs clearance.',
  },
  {
    // المعادن والصلب
    src: 'https://images.unsplash.com/photo-1504917599217-d4dc5ebe6122?w=1920&auto=format&fit=crop&q=90',
    alt: 'Industrial Steel & Heavy Manufacturing',
    sectorAr: 'المعادن والمواد الخام',
    sectorEn: 'Metals & Raw Materials',
    sectorZh: '金属与原材料',
    sectorTr: 'Metaller ve Ham Maddeler',
    titleAr: 'المعادن والصلب ومستلزمات الصناعة',
    titleEn: 'Steel, Metals & Industrial Raw Materials',
    subAr: 'عقود توريد وتوفير الخامات الصناعية بالجملة رأساً من المصانع الكبرى للمصانع والورش.',
    subEn: 'Bulk raw material supply contracts directly from primary steel & metal mills.',
  },
  {
    // التصنيع المباشر والمصانع المعتمدة
    src: 'https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=1920&auto=format&fit=crop&q=90',
    alt: 'High-Tech Precision Assembly',
    sectorAr: 'التقنية والتصنيع الذكي',
    sectorEn: 'Smart Electronics Assembly',
    sectorZh: '智能电子装配',
    sectorTr: 'Akıllı Elektronik Montaj',
    titleAr: 'تعامل مباشرة مع المصنّعين المعتمدين',
    titleEn: 'Direct Factory Sourcing With Zero Middlemen',
    subAr: 'شراء مباشر من كبرى مصانع الصين وتركيا والعالم بدون أي وسيط وبأفضل حد أدنى للطلب (MOQ).',
    subEn: 'Connect directly with verified manufacturers worldwide with transparent factory MOQ pricing.',
  },
  {
    // المستودعات والتوزيع الذكي
    src: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=1920&auto=format&fit=crop&q=90',
    alt: 'Modern Logistics & Warehousing Hub',
    sectorAr: 'المستودعات وحلول التوزيع',
    sectorEn: 'Warehousing & Distribution',
    sectorZh: '仓储与配送中心',
    sectorTr: 'Depolama ve Dağıtım Merkezleri',
    titleAr: 'حلول لوجستية وتتبع ذكي للمستودعات',
    titleEn: 'Smart Logistics & Warehouse Solutions',
    subAr: 'إدارة وتتبع مسار شحنتك لحظة بلحظة مع بيانات السائق ورمز استلام آمن (PIN).',
    subEn: 'Track your shipments end-to-end with verified driver cards and PIN security.',
  },
];

const INTERVAL_MS = 6000;

const HeroSection: React.FC = () => {
  const [current, setCurrent] = useState(0);
  const [loaded, setLoaded] = useState<boolean[]>(slides.map((_, i) => i === 0));
  const { t, language, isRTL } = useLanguage();

  const getSlideData = (slide: (typeof slides)[0]) => {
    if (language === 'ar') {
      return { sector: slide.sectorAr, title: slide.titleAr, sub: slide.subAr };
    }
    return { sector: slide.sectorEn, title: slide.titleEn, sub: slide.subEn };
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

  const activeData = getSlideData(slides[current]);

  return (
    <section
      className="relative w-full overflow-hidden bg-slate-900"
      style={{ minHeight: '100svh' }}
      aria-label="DirectHub hero"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* خلفيات السلايدر المضيئة والمتحركة بدقة عالية */}
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

        {/* تدرج خفيف وشفاف يُبرز جمال الصور ويحفظ وضوح النصوص */}
        <div className="absolute inset-0 bg-black/35" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/30" />
      </div>

      {/* المحتوى والنصوص الحركية التفاعلية */}
      <div
        className="relative z-10 flex flex-col items-center justify-center text-center w-full px-4 sm:px-6 md:px-8"
        style={{
          minHeight: '100svh',
          paddingTop: 'calc(6rem + env(safe-area-inset-top, 0px))',
          paddingBottom: 'calc(5.5rem + env(safe-area-inset-bottom, 0px))',
        }}
      >
        {/* شارة القطاع التفاعلية */}
        <div className="mb-3.5 flex items-center gap-2 px-3.5 py-1.5 bg-black/40 backdrop-blur-md rounded-full border border-white/20 shadow-lg">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-white text-xs font-semibold tracking-wide">
            {activeData.sector}
          </span>
        </div>

        {/* العنوان الرئيسي — يتغير بسلاسة مع كل صورة */}
        <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-white leading-tight mb-3 max-w-4xl tracking-tight drop-shadow-lg transition-all duration-500">
          {activeData.title}
        </h1>

        {/* الوصف — يتغير مع كل صورة */}
        <p className="text-white/90 text-xs sm:text-base md:text-lg max-w-2xl mb-7 leading-relaxed font-medium drop-shadow-md transition-all duration-500">
          {activeData.sub}
        </p>

        {/* شريط البحث المطور */}
        <div className="w-full max-w-2xl mb-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const input = (e.currentTarget.querySelector('input') as HTMLInputElement)?.value?.trim();
              if (input) window.location.href = `/search?q=${encodeURIComponent(input)}`;
              else window.location.href = '/search';
            }}
            className="flex items-stretch h-12 sm:h-14 rounded-2xl overflow-hidden shadow-2xl border border-white/30 bg-white/95 backdrop-blur-md"
          >
            <input
              type="text"
              placeholder={t.hero.searchPlaceholder}
              className="flex-1 px-4 sm:px-5 text-sm sm:text-base bg-transparent text-gray-900 placeholder:text-gray-500 focus:outline-none text-right"
              aria-label={t.hero.searchPlaceholder}
            />

            <button
              type="submit"
              className="shrink-0 px-5 sm:px-7 bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm sm:text-base active:opacity-85 transition-colors flex items-center gap-2"
            >
              <Icon name="MagnifyingGlassIcon" size={18} />
              <span className="hidden sm:inline">{t.hero.searchButton}</span>
            </button>
          </form>
        </div>

        {/* أزرار الإجراءات السريعة */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/categories"
            className="flex items-center gap-2 px-5 py-2.5 bg-black/40 hover:bg-black/60 backdrop-blur-md text-white font-semibold text-sm rounded-xl border border-white/30 transition-all shadow-md active:scale-95"
          >
            <Icon name="Squares2X2Icon" size={16} />
            {t.hero.browseCategories}
          </Link>
          <Link
            href="/rfq/create"
            className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm rounded-xl transition-all shadow-lg active:scale-95"
          >
            <Icon name="DocumentTextIcon" size={16} />
            {t.nav.postRFQ}
          </Link>
        </div>

        {/* إحصائيات المنصة */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-6 sm:gap-10">
          {[
            { value: '50K+', label: t.hero.stats.suppliers },
            { value: '200K+', label: t.hero.stats.products },
            { value: '80+', label: t.hero.stats.countries },
            { value: '10K+', label: t.hero.stats.orders },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-xl sm:text-2xl font-black text-white drop-shadow-md">{stat.value}</p>
              <p className="text-white/80 text-[11px] sm:text-xs mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* مؤشرات التبديل التلقائي */}
        <div className="absolute bottom-5 flex items-center gap-1.5">
          {slides.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrent(idx)}
              className={`rounded-full transition-all duration-300 ${
                idx === current ? 'w-7 h-1.5 bg-orange-500 shadow-md' : 'w-1.5 h-1.5 bg-white/50 hover:bg-white/80'
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
