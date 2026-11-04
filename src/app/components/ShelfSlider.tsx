'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import AppImage from '@/components/ui/AppImage';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { getCategoryShortLabel, CATEGORY_IMAGES } from '@/lib/categoryLabels';

interface ShelfCategory {
  id: string;
  slug: string;
  name_en: string;
  name_ar: string;
  image_url: string | null;
  product_count: number;
}

// دالة فحص وتأكيد جلب صور نهارية فائقة الوضوح لجميع الأرفف
function resolveShelfImage(shelf: { slug?: string; name_ar?: string; name_en?: string; image_url?: string | null }): string {
  if (shelf.image_url && (shelf.image_url.startsWith('http://') || shelf.image_url.startsWith('https://'))) {
    return shelf.image_url;
  }

  const slug = (shelf.slug || '').toLowerCase().trim();
  const slugKebab = slug.replace(/_/g, '-');
  const slugSnake = slug.replace(/-/g, '_');
  if (CATEGORY_IMAGES[slug] && CATEGORY_IMAGES[slug].startsWith('http')) return CATEGORY_IMAGES[slug];
  if (CATEGORY_IMAGES[slugKebab] && CATEGORY_IMAGES[slugKebab].startsWith('http')) return CATEGORY_IMAGES[slugKebab];
  if (CATEGORY_IMAGES[slugSnake] && CATEGORY_IMAGES[slugSnake].startsWith('http')) return CATEGORY_IMAGES[slugSnake];

  const nameAr = (shelf.name_ar || '').trim();
  if (nameAr.includes('منسوج') || nameAr.includes('ملابس') || nameAr.includes('أقمشة')) {
    return 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600&auto=format&fit=crop&q=80';
  }
  if (nameAr.includes('بناء') || nameAr.includes('إنشاء')) {
    return 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=600&auto=format&fit=crop&q=80';
  }
  if (nameAr.includes('آلات') || nameAr.includes('معدات') || nameAr.includes('صناع')) {
    return 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=600&auto=format&fit=crop&q=80';
  }
  if (nameAr.includes('إلكترون') || nameAr.includes('هواتف')) {
    return 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&auto=format&fit=crop&q=80';
  }
  if (nameAr.includes('سيار') || nameAr.includes('مركب')) {
    return 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=600&auto=format&fit=crop&q=80';
  }
  if (nameAr.includes('مواد خام') || nameAr.includes('كيميائ')) {
    return 'https://images.unsplash.com/photo-1603555501671-8f96b3fce8e4?w=600&auto=format&fit=crop&q=80';
  }
  if (nameAr.includes('أدوي') || nameAr.includes('دوائ') || nameAr.includes('صيدل')) {
    return 'https://images.unsplash.com/photo-1471864190281-a93a3070b6de?w=600&auto=format&fit=crop&q=80';
  }
  if (nameAr.includes('غذاء') || nameAr.includes('طعام') || nameAr.includes('زراع')) {
    return 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=600&auto=format&fit=crop&q=80';
  }
  if (nameAr.includes('تجميل') || nameAr.includes('عناية')) {
    return 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=600&auto=format&fit=crop&q=80';
  }
  if (nameAr.includes('منزل') || nameAr.includes('أثاث')) {
    return 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&auto=format&fit=crop&q=80';
  }
  if (nameAr.includes('معادن') || nameAr.includes('صلب') || nameAr.includes('حديد')) {
    return 'https://images.unsplash.com/photo-1504917599217-d4dc5ebe6122?w=600&auto=format&fit=crop&q=80';
  }

  const nameEn = (shelf.name_en || '').toLowerCase().trim();
  if (nameEn.includes('textil') || nameEn.includes('apparel')) return 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600&auto=format&fit=crop&q=80';
  if (nameEn.includes('construct') || nameEn.includes('build')) return 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=600&auto=format&fit=crop&q=80';
  if (nameEn.includes('machin')) return 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=600&auto=format&fit=crop&q=80';

  return 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=600&auto=format&fit=crop&q=80';
}

const FALLBACK_SHELVES: ShelfCategory[] = [
  { id: 'f1', slug: 'electronics-mobile-phones', name_en: 'Electronics', name_ar: 'إلكترونيات', image_url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&auto=format&fit=crop&q=80', product_count: 0 },
  { id: 'f2', slug: 'automotive-vehicles', name_en: 'Automotive', name_ar: 'سيارات', image_url: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=600&auto=format&fit=crop&q=80', product_count: 0 },
  { id: 'f3', slug: 'textiles-apparel', name_en: 'Textiles', name_ar: 'منسوجات', image_url: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600&auto=format&fit=crop&q=80', product_count: 0 },
  { id: 'f4', slug: 'raw-materials-chemicals', name_en: 'Raw Materials', name_ar: 'مواد خام', image_url: 'https://images.unsplash.com/photo-1603555501671-8f96b3fce8e4?w=600&auto=format&fit=crop&q=80', product_count: 0 },
  { id: 'f5', slug: 'construction-building-materials', name_en: 'Construction', name_ar: 'مواد بناء', image_url: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=600&auto=format&fit=crop&q=80', product_count: 0 },
  { id: 'f6', slug: 'industrial-machinery', name_en: 'Machinery', name_ar: 'آلات ومعدات', image_url: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=600&auto=format&fit=crop&q=80', product_count: 0 },
  { id: 'f7', slug: 'beauty-personal-care', name_en: 'Beauty & Care', name_ar: 'تجميل', image_url: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=600&auto=format&fit=crop&q=80', product_count: 0 },
  { id: 'f8', slug: 'pharmaceuticals-raw-materials', name_en: 'Pharmaceuticals', name_ar: 'أدوية', image_url: 'https://images.unsplash.com/photo-1471864190281-a93a3070b6de?w=600&auto=format&fit=crop&q=80', product_count: 0 },
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
    const fetchShelves = async () => {
      try {
        const { data } = await supabase
          .from('product_categories')
          .select('id, slug, name_en, name_ar, image_url, product_count')
          .eq('is_active', true)
          .is('parent_id', null)
          .order('sort_order', { ascending: true })
          .limit(12);

        if (data && data.length > 0) {
          const enriched = data.map((item) => ({
            ...item,
            image_url: resolveShelfImage(item),
          }));
          setShelves(enriched);
        } else {
          setShelves(FALLBACK_SHELVES);
        }
      } catch {
        setShelves(FALLBACK_SHELVES);
      } finally {
        setLoading(false);
      }
    };
    fetchShelves();
  }, []);

  // تحريك شريط الأرفف تلقائياً بشكل سلس ومستمر
  useEffect(() => {
    if (loading || shelves.length === 0) return;
    const track = trackRef.current;
    if (!track) return;

    const speed = 0.5;
    const direction = isRTL ? 1 : -1;

    const animate = () => {
      if (!pausedRef.current && track) {
        posRef.current += speed * direction;
        const halfWidth = track.scrollWidth / 2;
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
            <div key={i} className="flex-shrink-0 w-36 h-24 bg-muted animate-pulse rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  const doubled = [...shelves, ...shelves];

  return (
    <div
      className="w-full bg-background border-b border-border overflow-hidden py-4 select-none"
      onMouseEnter={() => { pausedRef.current = true; }}
      onMouseLeave={() => { pausedRef.current = false; }}
      onTouchStart={() => { pausedRef.current = true; }}
      onTouchEnd={() => { pausedRef.current = false; }}
      aria-label={language === 'ar' ? 'أرفف التصنيفات' : (t.shelfSlider?.categoryShelves || 'Category Shelves')}
    >
      {/* عنوان الشريط وزر عرض الكل */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-px w-5 bg-primary" />
          <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            {language === 'ar' ? 'أرفف التصنيفات' : (t.shelfSlider?.categoryShelves || 'Category Shelves')}
          </span>
        </div>
        <Link
          href="/categories"
          className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
        >
          {language === 'ar' ? 'عرض الكل' : (t.shelfSlider?.viewAll || 'View All')}
          <Icon name="ArrowRightIcon" size={12} className={isRTL ? 'rotate-180' : ''} />
        </Link>
      </div>

      {/* مسار الحركة الدائرية المستمرة */}
      <div className="relative overflow-hidden">
        <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />

        <div
          ref={trackRef}
          className="flex gap-3 px-4 will-change-transform"
          style={{ width: 'max-content' }}
        >
          {doubled.map((shelf, idx) => {
            const label = getCategoryShortLabel(shelf.slug, language, {
              fallbackEn: shelf.name_en,
              fallbackAr: shelf.name_ar,
            });
            const imageUrl = shelf.image_url || resolveShelfImage(shelf);

            return (
              <Link
                key={`${shelf.id}-${idx}`}
                href={`/search?category=${shelf.slug}&mode=b2b`}
                className="flex-shrink-0 group relative overflow-hidden rounded-2xl border border-border shadow-sm hover:shadow-md transition-all duration-300"
                style={{ width: 148, height: 96 }}
                tabIndex={idx >= shelves.length ? -1 : 0}
                aria-hidden={idx >= shelves.length}
              >
                {/* خلفية الصورة السحابية النهارية الفائقة */}
                <AppImage
                  src={imageUrl}
                  alt={`${shelf.name_en} shelf`}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                  sizes="148px"
                />

                {/* تدرج ظلي متوازن يضمن قراءة النص بوضوح مع إبراز الصورة */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />

                {/* تفاصيل البطاقة بدون أي أيقونات عائمة */}
                <div className="absolute bottom-0 left-0 right-0 p-2.5 text-right">
                  <p className="text-xs font-extrabold text-white leading-tight drop-shadow-sm line-clamp-1">
                    {label}
                  </p>
                  {shelf.product_count > 0 && (
                    <p className="text-[10px] text-white/75 mt-0.5 font-medium">
                      {shelf.product_count.toLocaleString()}+ {language === 'ar' ? 'منتج' : (t.shelfSlider?.items || 'items')}
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
