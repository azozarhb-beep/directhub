'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { getCategoryFullLabel, CATEGORY_IMAGES } from '@/lib/categoryLabels';

interface Category {
  id: string;
  slug: string;
  name_en: string;
  name_ar: string;
  image_url: string | null;
  product_count: number;
  supplier_count: number;
  is_active: boolean;
}

const CATEGORY_GRADIENTS = [
  'from-violet-600 to-violet-900',
  'from-slate-600 to-slate-900',
  'from-stone-600 to-stone-900',
  'from-emerald-600 to-emerald-900',
  'from-amber-600 to-amber-900',
  'from-orange-600 to-orange-900',
  'from-pink-600 to-pink-900',
  'from-blue-600 to-blue-900',
];

// دالة فحص وجلب الصورة السحابية وتجاوز الروابط المحلية المكسورة
function resolveCategoryImage(cat: { slug?: string; name_ar?: string; name_en?: string; image_url?: string | null }): string {
  // 1. إذا كان الرابط في قاعدة البيانات رابطاً سحابياً صحيحاً (http/https)
  if (cat.image_url && (cat.image_url.startsWith('http://') || cat.image_url.startsWith('https://'))) {
    return cat.image_url;
  }

  // 2. البحث بالاسم الرمزي (Slug) بصيغه المختلفة
  const slug = (cat.slug || '').toLowerCase();
  const slugKebab = slug.replace(/_/g, '-');
  const slugSnake = slug.replace(/-/g, '_');
  if (CATEGORY_IMAGES[slug]) return CATEGORY_IMAGES[slug];
  if (CATEGORY_IMAGES[slugKebab]) return CATEGORY_IMAGES[slugKebab];
  if (CATEGORY_IMAGES[slugSnake]) return CATEGORY_IMAGES[slugSnake];

  // 3. الفحص بالاسم العربي مباشرة لضمان عدم ظهور أي بطاقة فارغة
  const nameAr = cat.name_ar || '';
  if (nameAr.includes('آلات') || nameAr.includes('معدات') || nameAr.includes('صناع')) {
    return 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=800&auto=format&fit=crop&q=80';
  }
  if (nameAr.includes('منسوج') || nameAr.includes('ملابس') || nameAr.includes('أقمشة')) {
    return 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800&auto=format&fit=crop&q=80';
  }
  if (nameAr.includes('إلكترون') || nameAr.includes('هواتف')) {
    return 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&auto=format&fit=crop&q=80';
  }
  if (nameAr.includes('سيار') || nameAr.includes('مركب')) {
    return 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800&auto=format&fit=crop&q=80';
  }
  if (nameAr.includes('مواد خام') || nameAr.includes('كيميائ')) {
    return 'https://images.unsplash.com/photo-1603555501671-8f96b3fce8e4?w=800&auto=format&fit=crop&q=80';
  }
  if (nameAr.includes('أدوي') || nameAr.includes('دوائ') || nameAr.includes('صيدل')) {
    return 'https://images.unsplash.com/photo-1471864190281-a93a3070b6de?w=800&auto=format&fit=crop&q=80';
  }
  if (nameAr.includes('بناء') || nameAr.includes('إنشاء')) {
    return 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800&auto=format&fit=crop&q=80';
  }
  if (nameAr.includes('غذاء') || nameAr.includes('طعام') || nameAr.includes('زراع')) {
    return 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&auto=format&fit=crop&q=80';
  }

  // 4. الفحص بالاسم الإنجليزي
  const nameEn = (cat.name_en || '').toLowerCase();
  if (nameEn.includes('machin')) {
    return 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=800&auto=format&fit=crop&q=80';
  }
  if (nameEn.includes('textil') || nameEn.includes('apparel') || nameEn.includes('cloth')) {
    return 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800&auto=format&fit=crop&q=80';
  }

  return 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=800&auto=format&fit=crop&q=80';
}

const CategoriesSection: React.FC = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const { language, t, dir } = useLanguage();
  const ui = t.masterCategories;
  const supabase = createClient();

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { threshold: 0.05 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const { data } = await supabase
          .from('product_categories')
          .select('id, slug, name_en, name_ar, image_url, product_count, supplier_count, is_active')
          .eq('is_active', true)
          .is('parent_id', null)
          .order('sort_order', { ascending: true })
          .limit(12);

        if (data && data.length > 0) {
          const enriched = data.map(cat => ({
            ...cat,
            image_url: resolveCategoryImage(cat),
          }));
          setCategories(enriched);
        } else {
          setCategories([]);
        }
      } catch {
        setCategories([]);
      } finally {
        setLoading(false);
      }
    };
    fetchCategories();
  }, []);

  return (
    <section ref={sectionRef} className="bg-muted/30 py-16 border-b border-border" dir={dir} suppressHydrationWarning>
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div className={visible ? 'reveal-animate' : 'opacity-0'}>
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground block mb-3" suppressHydrationWarning>
              {language === 'ar' ? 'أرفف التصنيفات' : ui.title}
            </span>
            <h2 className="text-section-title font-extrabold text-foreground" suppressHydrationWarning>
              {language === 'ar' ? 'أرفف التصنيفات' : ui.title}
            </h2>
          </div>
          <Link
            href="/categories"
            suppressHydrationWarning
            className={`inline-flex items-center gap-2 px-6 py-3 bg-foreground text-primary-foreground text-sm font-bold rounded-full hover:opacity-80 transition-opacity ${visible ? 'reveal-animate stagger-2' : 'opacity-0'}`}>
            {ui.viewAll}
            <Icon name="ArrowRightIcon" size={16} className={language === 'ar' ? 'rotate-180' : ''} />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-muted animate-pulse rounded-xl" style={{ aspectRatio: '3/4' }} />
            ))}
          </div>
        ) : categories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center bg-card border border-dashed border-border rounded-2xl">
            <Icon name="Squares2X2Icon" size={32} className="text-muted-foreground/60 mb-3" />
            <p className="text-sm font-bold text-foreground">
              {language === 'ar' ? 'لا توجد فئات متاحة حالياً' : 'No categories available yet'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            {categories.map((cat, i) => {
              const label = getCategoryFullLabel(
                cat.slug,
                language,
                { name_en: cat.name_en, name_ar: cat.name_ar },
                (t as any).search?.categories as Record<string, string> | undefined
              );
              return (
                <Link
                  key={cat.id}
                  href={`/search?category=${cat.slug}&mode=b2b`}
                  className={`group relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm hover:shadow-md transition-all ${visible ? 'reveal-animate' : 'opacity-0'}`}
                  style={{ animationDelay: `${i * 0.06}s`, aspectRatio: '4/3' }}>
                  
                  {cat.image_url ? (
                    <AppImage
                      src={cat.image_url}
                      alt={label}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-700"
                      sizes="(max-width: 768px) 50vw, 25vw" />
                  ) : (
                    <div className={`absolute inset-0 bg-gradient-to-br ${CATEGORY_GRADIENTS[i % CATEGORY_GRADIENTS.length]}`} />
                  )}

                  {/* Gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />

                  {/* Content */}
                  <div className="absolute bottom-0 left-0 right-0 p-3.5 text-right">
                    {cat.product_count > 0 && (
                      <span className="text-[10px] font-bold text-white/70 block mb-0.5">
                        {cat.product_count.toLocaleString()}+ {language === 'ar' ? 'منتج' : ui.products}
                      </span>
                    )}
                    <h3 className="text-sm font-extrabold text-white leading-tight">
                      {label}
                    </h3>
                  </div>

                  {/* Hover arrow */}
                  <div className="absolute top-2.5 left-2.5 w-7 h-7 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Icon name="ArrowRightIcon" size={12} className="text-white" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};

export default CategoriesSection;
