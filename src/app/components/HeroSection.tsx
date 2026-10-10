'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { useLanguage } from '@/contexts/LanguageContext';

const slides = [
{
  src: "https://img.rocket.new/generatedImages/rocket_gen_img_101ca374c-1769457255068.png",
  alt: 'Modern automated smart factory floor with robotic arms and production lines',
  sectorAr: 'المصانع الذكية',
  sectorEn: 'Smart Factories',
  sectorZh: '智能工厂',
  sectorTr: 'Akıllı Fabrikalar'
},
{
  src: "https://img.rocket.new/generatedImages/rocket_gen_img_1b2c6474c-1769255184820.png",
  alt: 'Advanced electronics manufacturing facility with precision assembly equipment',
  sectorAr: 'الإلكترونيات',
  sectorEn: 'Electronics',
  sectorZh: '电子产品',
  sectorTr: 'Elektronik'
},
{
  src: "https://img.rocket.new/generatedImages/rocket_gen_img_1dc55ce30-1766910371765.png",
  alt: 'Heavy industrial machinery manufacturing plant with large steel equipment',
  sectorAr: 'الآلات الثقيلة',
  sectorEn: 'Heavy Machinery',
  sectorZh: '重型机械',
  sectorTr: 'Ağır Makineler'
},
{
  src: "https://img.rocket.new/generatedImages/rocket_gen_img_154a65a1f-1788189547073.png",
  alt: 'Global logistics and warehouse facility with automated conveyor systems',
  sectorAr: 'اللوجستيات',
  sectorEn: 'Logistics',
  sectorZh: '物流',
  sectorTr: 'Lojistik'
},
{
  src: "https://img.rocket.new/generatedImages/rocket_gen_img_14b65d0e6-1767641849366.png",
  alt: 'High-tech circuit board and semiconductor manufacturing clean room',
  sectorAr: 'أشباه الموصلات',
  sectorEn: 'Semiconductors',
  sectorZh: '半导体',
  sectorTr: 'Yarı İletkenler'
}];


const INTERVAL_MS = 4500;

const HeroSection: React.FC = () => {
  const [current, setCurrent] = useState(0);
  const [loaded, setLoaded] = useState<boolean[]>(slides.map((_, i) => i === 0));
  const { t, language, isRTL } = useLanguage();

  const getSectorLabel = (slide: typeof slides[0]) => {
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
      className="relative w-full overflow-hidden"
      style={{ minHeight: '100svh' }}
      aria-label="DirectHub hero"
      dir={isRTL ? 'rtl' : 'ltr'}>
      

      {/* Slider images */}
      <div className="absolute inset-0 z-0">
        {slides.map((slide, idx) =>
        loaded[idx] ?
        <div
          key={idx}
          className="absolute inset-0 transition-opacity duration-1000"
          style={{ opacity: idx === current ? 1 : 0 }}>

              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
            src={slide.src}
            alt={slide.alt}
            className="w-full h-full object-cover object-center"
            loading={idx === 0 ? 'eager' : 'lazy'} />

            </div> :
        null
        )}

        {/* Dark overlay layers */}
        <div className="absolute inset-0 bg-black/65" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/30" />
      </div>

      {/* Content */}
      <div
        className="relative z-10 flex flex-col items-center justify-center text-center w-full px-4 sm:px-6 md:px-8"
        style={{
          minHeight: '100svh',
          paddingTop: 'calc(4rem + env(safe-area-inset-top, 0px))',
          paddingBottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))'
        }}>

        {/* Sector badge */}
        <div className="mb-4 flex items-center gap-2 px-3 py-1.5 bg-white/10 backdrop-blur-sm rounded-full border border-white/20">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-white/90 text-xs font-medium">{getSectorLabel(slides[current])}</span>
        </div>

        {/* Main heading */}
        <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold text-white leading-tight mb-4 max-w-4xl">
          {t.hero.title}
        </h1>

        {/* Subtitle */}
        <p className="text-white/80 text-sm sm:text-base md:text-lg max-w-2xl mb-8 leading-relaxed">
          {t.hero.subtitle}
        </p>

        {/* Search bar */}
        <div className="w-full max-w-2xl mb-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const input = (e.currentTarget.querySelector('input') as HTMLInputElement)?.value?.trim();
              if (input) window.location.href = `/search?q=${encodeURIComponent(input)}`;else
              window.location.href = '/search';
            }}
            className="flex items-stretch h-12 sm:h-14 rounded-xl overflow-hidden shadow-2xl border border-white/20">
            
            <input
              type="text"
              placeholder={t.hero.searchPlaceholder}
              className="flex-1 px-4 sm:px-5 text-sm sm:text-base bg-white/95 text-gray-900 placeholder:text-gray-500 focus:outline-none"
              aria-label={t.hero.searchPlaceholder} />
            
            <button
              type="submit"
              className="shrink-0 px-5 sm:px-7 bg-primary text-primary-foreground font-bold text-sm sm:text-base active:opacity-80 transition-opacity flex items-center gap-2">
              
              <Icon name="MagnifyingGlassIcon" size={18} />
              <span className="hidden sm:inline">{t.hero.searchButton}</span>
            </button>
          </form>
        </div>

        {/* CTA buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/categories"
            className="flex items-center gap-2 px-5 py-2.5 bg-white/15 hover:bg-white/25 backdrop-blur-sm text-white font-semibold text-sm rounded-xl border border-white/30 transition-colors">
            
            <Icon name="Squares2X2Icon" size={16} />
            {t.hero.browseCategories}
          </Link>
          <Link
            href="/rfq/create"

            className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm rounded-xl transition-colors">
            
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
          { value: '10K+', label: t.hero.stats.orders }].
          map((stat) =>
          <div key={stat.label} className="text-center">
              <p className="text-2xl sm:text-3xl font-extrabold text-white">{stat.value}</p>
              <p className="text-white/70 text-xs sm:text-sm mt-0.5">{stat.label}</p>
            </div>
          )}
        </div>

        {/* Slide indicators */}
        <div className="absolute bottom-8 flex items-center gap-1.5">
          {slides.map((_, idx) =>
          <button
            key={idx}
            onClick={() => setCurrent(idx)}
            className={`rounded-full transition-all duration-300 ${idx === current ? 'w-6 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/40'}`}
            aria-label={`Slide ${idx + 1}`} />

          )}
        </div>
      </div>
    </section>);

};

export default HeroSection;
