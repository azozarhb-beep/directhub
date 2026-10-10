'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import AppImage from '@/components/ui/AppImage';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { getCategoryShortLabel } from '@/lib/categoryLabels';

interface ShelfCategory {
  id: string;
  slug: string;
  name_en: string;
  name_ar: string;
  image_url: string | null;
  product_count: number;
}

const FALLBACK_SHELVES = [
  { id: 'f1', slug: 'electronics-mobile-phones', name_en: 'Electronics', name_ar: 'إلكترونيات', image_url: null, product_count: 0 },
  { id: 'f2', slug: 'automotive-vehicles', name_en: 'Automotive', name_ar: 'سيارات', image_url: null, product_count: 0 },
  { id: 'f3', slug: 'home-appliances-furniture', name_en: 'Home Appliances', name_ar: 'أدوات منزلية', image_url: null, product_count: 0 },
  { id: 'f4', slug: 'raw-materials-chemicals', name_en: 'Raw Materials', name_ar: 'مواد خام', image_url: null, product_count: 0 },
  { id: 'f5', slug: 'construction-building-materials', name_en: 'Construction', name_ar: 'مواد بناء', image_url: null, product_count: 0 },
  { id: 'f6', slug: 'health-medical-equipment', name_en: 'Medical', name_ar: 'معدات طبية', image_url: null, product_count: 0 },
  { id: 'f7', slug: 'beauty-personal-care', name_en: 'Beauty & Care', name_ar: 'تجميل', image_url: null, product_count: 0 },
  { id: 'f8', slug: 'pharmaceuticals-raw-materials', name_en: 'Pharmaceuticals', name_ar: 'أدوية', image_url: null, product_count: 0 },
];

const SHELF_COLORS = [
  'from-violet-600 to-violet-900',
  'from-slate-600 to-slate-900',
  'from-amber-600 to-amber-900',
  'from-orange-600 to-orange-900',
  'from-stone-600 to-stone-900',
  'from-emerald-600 to-emerald-900',
  'from-pink-600 to-pink-900',
  'from-blue-600 to-blue-900',
];

const ShelfSlider: React.FC = () => {
  const [shelves, setShelves] = useState<ShelfCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const trackRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number | null>(null);
  const posRef = useRef(0);
  const pausedRef = useRef(false);
  const { isRTL, language, t } = useLanguage();
  const supabase = createClient();

  useEffect(() => {
    const fetch = async () => {
      try {
        const { data } = await supabase
          .from('product_categories')
          .select('id, slug, name_en, name_ar, image_url, product_count')
          .eq('is_active', true)
          .is('parent_id', null)
          .order('sort_order', { ascending: true })
          .limit(10);
        setShelves(data && data.length > 0 ? data : FALLBACK_SHELVES);
      } catch {
        setShelves(FALLBACK_SHELVES);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  // Auto-scroll animation (RTL: right→left, LTR: left→right)
  useEffect(() => {
    if (loading || shelves.length === 0) return;
    const track = trackRef.current;
    if (!track) return;

    const speed = 0.5; // px per frame
    const direction = isRTL ? 1 : -1;

    const animate = () => {
      if (!pausedRef.current && track) {
        posRef.current += speed * direction;
        const halfWidth = track.scrollWidth / 2;
        // Loop: when we've scrolled one full set, reset
        if (Math.abs(posRef.current) >= halfWidth) {
          posRef.current = 0;
        }
        track.style.transform = `translateX(${posRef.current}px)`;
      }
      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [loading, shelves, isRTL]);

  if (loading) {
    return (
      <div className="w-full bg-background border-b border-border py-4 overflow-hidden">
        <div className="flex gap-3 px-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex-shrink-0 w-36 h-24 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  // Duplicate shelves for seamless loop
  const doubled = [...shelves, ...shelves];

  return (
    <div
      className="w-full bg-background border-b border-border overflow-hidden py-4 select-none"
      onMouseEnter={() => { pausedRef.current = true; }}
      onMouseLeave={() => { pausedRef.current = false; }}
      onTouchStart={() => { pausedRef.current = true; }}
      onTouchEnd={() => { pausedRef.current = false; }}
      aria-label={t.shelfSlider?.categoryShelves || 'Category Shelves'}
    >
      {/* Section label */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-px w-5 bg-primary" />
          <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            {t.shelfSlider?.categoryShelves || 'Category Shelves'}
          </span>
        </div>
        <Link
          href="/categories"
          className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
        >
          {t.shelfSlider?.viewAll || 'View All'}
          <Icon name="ArrowRightIcon" size={12} />
        </Link>
      </div>

      {/* Scrolling track */}
      <div className="relative overflow-hidden">
        {/* Fade edges */}
        <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />

        <div
          ref={trackRef}
          className="flex gap-3 px-4 will-change-transform"
          style={{ width: 'max-content' }}
        >
          {doubled.map((shelf, idx) => {
            const colorClass = SHELF_COLORS[idx % SHELF_COLORS.length];
            const label = getCategoryShortLabel(shelf.slug, language, {
              fallbackEn: shelf.name_en,
              fallbackAr: shelf.name_ar,
            });

            return (
              <Link
                key={`${shelf.id}-${idx}`}
                href={`/search?category=${shelf.slug}`}
                className="flex-shrink-0 group relative overflow-hidden rounded-xl border border-border"
                style={{ width: 144, height: 96 }}
                tabIndex={idx >= shelves.length ? -1 : 0}
                aria-hidden={idx >= shelves.length}
              >
                {/* Background image or gradient */}
                {shelf.image_url ? (
                  <AppImage
                    src={shelf.image_url}
                    alt={`${shelf.name_en} shelf`}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                    sizes="144px"
                  />
                ) : (
                  <div className={`absolute inset-0 bg-gradient-to-br ${colorClass}`} />
                )}

                {/* Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

                {/* Placeholder product slots */}
                <div className="absolute top-2 right-2 flex gap-1">
                  {[0, 1].map((s) => (
                    <div
                      key={s}
                      className="w-5 h-5 rounded bg-white/20 border border-white/30 flex items-center justify-center"
                    >
                      <Icon name="CubeIcon" size={9} className="text-white/50" />
                    </div>
                  ))}
                </div>

                {/* Label */}
                <div className="absolute bottom-0 left-0 right-0 p-2.5">
                  <p className="text-[11px] font-bold text-white leading-tight line-clamp-2">{label}</p>
                  {shelf.product_count > 0 && (
                    <p className="text-[9px] text-white/60 mt-0.5">
                      {shelf.product_count}+ {t.shelfSlider?.items || 'items'}
                    </p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ShelfSlider;
