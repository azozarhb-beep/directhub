'use client';

import React, { useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';
import { useLanguage } from '@/contexts/LanguageContext';
import { getCategoryAllLabel, getCategoryShortLabel } from '@/lib/categoryLabels';

interface Category {
  slug: string;
  icon: string;
  /** Optional override key for short labels (e.g. chemicals vs raw-materials) */
  pillKey?: string;
  color: string;
}

const CATEGORIES: Category[] = [
  { slug: 'raw-materials-chemicals', icon: 'CubeTransparentIcon', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  { slug: 'electronics-mobile-phones', icon: 'DevicePhoneMobileIcon', color: 'bg-violet-50 text-violet-700 border-violet-200' },
  { slug: 'pharmaceuticals-raw-materials', icon: 'BeakerIcon', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { slug: 'automotive-vehicles', icon: 'TruckIcon', color: 'bg-slate-50 text-slate-700 border-slate-200' },
  { slug: 'beauty-personal-care', icon: 'SparklesIcon', color: 'bg-pink-50 text-pink-700 border-pink-200' },
  { slug: 'raw-materials-chemicals', pillKey: 'chemicals', icon: 'FireIcon', color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  { slug: 'home-appliances-furniture', icon: 'HomeIcon', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { slug: 'construction-building-materials', icon: 'BuildingOffice2Icon', color: 'bg-stone-50 text-stone-700 border-stone-200' },
  { slug: 'health-medical-equipment', icon: 'HeartIcon', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { slug: 'office-school-supplies', icon: 'DocumentTextIcon', color: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  { slug: 'toys-sports-entertainment', icon: 'PuzzlePieceIcon', color: 'bg-red-50 text-red-700 border-red-200' },
  { slug: 'food-agriculture', icon: 'ShoppingBagIcon', color: 'bg-green-50 text-green-700 border-green-200' },
  { slug: 'textiles-apparel', icon: 'SwatchIcon', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  { slug: 'industrial-machinery', icon: 'WrenchScrewdriverIcon', color: 'bg-gray-50 text-gray-700 border-gray-200' },
  { slug: 'metals-steel', icon: 'CubeIcon', color: 'bg-zinc-50 text-zinc-700 border-zinc-200' },
  { slug: 'packaging-printing', icon: 'ArchiveBoxIcon', color: 'bg-teal-50 text-teal-700 border-teal-200' },
  { slug: 'energy-power', icon: 'BoltIcon', color: 'bg-yellow-50 text-yellow-800 border-yellow-300' },
  { slug: 'plastics-rubber', icon: 'BeakerIcon', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { slug: 'cleaning-hygiene', icon: 'SparklesIcon', color: 'bg-sky-50 text-sky-700 border-sky-200' },
  { slug: 'furniture-interiors', icon: 'HomeIcon', color: 'bg-rose-50 text-rose-700 border-rose-200' },
  { slug: 'agriculture-farming', icon: 'GlobeAltIcon', color: 'bg-lime-50 text-lime-700 border-lime-200' },
];

interface HorizontalCategoryBarProps {
  onCategorySelect?: (slug: string | null) => void;
  selectedSlug?: string | null;
}

const HorizontalCategoryBar: React.FC<HorizontalCategoryBarProps> = ({
  onCategorySelect,
  selectedSlug,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { language, isRTL } = useLanguage();
  // Always initialize with null to avoid SSR/client mismatch
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Sync selectedSlug prop and mark as mounted after hydration
  useEffect(() => {
    setMounted(true);
    if (selectedSlug !== undefined) {
      setActiveSlug(selectedSlug ?? null);
    }
  }, [selectedSlug]);

  const handleSelect = (slug: string) => {
    const next = activeSlug === slug ? null : slug;
    setActiveSlug(next);
    if (onCategorySelect) {
      onCategorySelect(next);
    } else {
      if (next) {
        router.push(`/search?category=${next}`);
      }
    }
  };

  const scroll = (dir: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const amount = 200;
    scrollRef.current.scrollBy({ left: dir === 'left' ? -amount : amount, behavior: 'smooth' });
  };

  // Use stable icons on server; only use RTL-aware icons after mount
  const leftScrollIcon = mounted && isRTL ? 'ChevronRightIcon' : 'ChevronLeftIcon';
  const rightScrollIcon = mounted && isRTL ? 'ChevronLeftIcon' : 'ChevronRightIcon';
  const dirAttr = mounted ? (isRTL ? 'rtl' : 'ltr') : 'ltr';

  return (
    <div className="w-full bg-background border-b border-border/50 shadow-sm" suppressHydrationWarning>
      <div className="max-w-7xl mx-auto px-2 md:px-6 py-2 flex items-center gap-1" suppressHydrationWarning>
        {/* Left scroll arrow */}
        <button
          onClick={() => scroll(mounted && isRTL ? 'right' : 'left')}
          className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-muted/60 hover:bg-muted text-muted-foreground transition-colors hidden sm:flex"
          aria-label="Scroll left"
          suppressHydrationWarning
        >
          <Icon name={leftScrollIcon as Parameters<typeof Icon>[0]['name']} size={14} />
        </button>

        {/* Scrollable pills */}
        <div
          ref={scrollRef}
          className="flex-1 flex items-center gap-2 overflow-x-auto scrollbar-hide py-1"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          dir={dirAttr}
          suppressHydrationWarning
        >
          {/* "All" pill */}
          <button
            onClick={() => {
              setActiveSlug(null);
              if (onCategorySelect) onCategorySelect(null);
            }}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all whitespace-nowrap ${
              activeSlug === null
                ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                : 'bg-muted/40 text-muted-foreground border-border hover:bg-muted'
            }`}
          >
            <Icon name="Squares2X2Icon" size={13} />
            {getCategoryAllLabel(language)}
          </button>

          {CATEGORIES.map((cat, idx) => {
            const pillId = `${cat.slug}-${idx}`;
            const isActive = activeSlug === pillId;
            const label = getCategoryShortLabel(cat.slug, language, { pillKey: cat.pillKey });
            return (
              <button
                key={pillId}
                onClick={() => {
                  const next = activeSlug === pillId ? null : pillId;
                  setActiveSlug(next);
                  if (onCategorySelect) {
                    onCategorySelect(next ? cat.slug : null);
                  } else {
                    router.push(next ? `/search?category=${cat.slug}` : '/search');
                  }
                }}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                    : `${cat.color} hover:opacity-80`
                }`}
              >
                <Icon name={cat.icon as Parameters<typeof Icon>[0]['name']} size={13} />
                {label}
              </button>
            );
          })}
        </div>

        {/* Right scroll arrow */}
        <button
          onClick={() => scroll(mounted && isRTL ? 'left' : 'right')}
          className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-muted/60 hover:bg-muted text-muted-foreground transition-colors hidden sm:flex"
          aria-label="Scroll right"
          suppressHydrationWarning
        >
          <Icon name={rightScrollIcon as Parameters<typeof Icon>[0]['name']} size={14} />
        </button>
      </div>
    </div>
  );
};

export default HorizontalCategoryBar;
