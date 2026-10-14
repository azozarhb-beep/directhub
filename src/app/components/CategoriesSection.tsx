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

const MOCK_CATEGORIES: Category[] = [
  { id: 'c1', slug: 'electronics-mobile-phones', name_en: 'Electronics', name_ar: 'إلكترونيات', image_url: CATEGORY_IMAGES['electronics-mobile-phones'], product_count: 1240, supplier_count: 320, is_active: true },
  { id: 'c2', slug: 'automotive-vehicles', name_en: 'Automotive', name_ar: 'سيارات وقطع غيار', image_url: CATEGORY_IMAGES['automotive-vehicles'], product_count: 870, supplier_count: 210, is_active: true },
  { id: 'c3', slug: 'construction-building-materials', name_en: 'Construction', name_ar: 'مواد البناء', image_url: CATEGORY_IMAGES['construction-building-materials'], product_count: 1560, supplier_count: 430, is_active: true },
  { id: 'c4', slug: 'health-medical-equipment', name_en: 'Medical Equipment', name_ar: 'معدات طبية', image_url: CATEGORY_IMAGES['health-medical-equipment'], product_count: 640, supplier_count: 180, is_active: true },
  { id: 'c5', slug: 'home-appliances-furniture', name_en: 'Home Appliances', name_ar: 'أجهزة منزلية', image_url: CATEGORY_IMAGES['home-appliances-furniture'], product_count: 980, supplier_count: 260, is_active: true },
  { id: 'c6', slug: 'raw-materials-chemicals', name_en: 'Raw Materials', name_ar: 'مواد خام وكيماويات', image_url: CATEGORY_IMAGES['raw-materials-chemicals'], product_count: 2100, supplier_count: 510, is_active: true },
  { id: 'c7', slug: 'beauty-personal-care', name_en: 'Beauty & Care', name_ar: 'تجميل وعناية', image_url: CATEGORY_IMAGES['beauty-personal-care'], product_count: 730, supplier_count: 195, is_active: true },
  { id: 'c8', slug: 'pharmaceuticals-raw-materials', name_en: 'Pharmaceuticals', name_ar: 'أدوية ومستحضرات', image_url: CATEGORY_IMAGES['pharmaceuticals-raw-materials'], product_count: 450, supplier_count: 120, is_active: true },
];

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
          .limit(8);
        if (data && data.length > 0) {
          // Inject static image where DB image_url is null
          const enriched = data.map(cat => ({
            ...cat,
            image_url: cat.image_url || CATEGORY_IMAGES[cat.slug] || null,
          }));
          setCategories(enriched);
        } else {
          setCategories(MOCK_CATEGORIES);
        }
      } catch {
        setCategories(MOCK_CATEGORIES);
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
              {ui.title}
            </span>
            <h2 className="text-section-title font-extrabold text-foreground" suppressHydrationWarning>
              {ui.title}
            </h2>
          </div>
          <Link
            href="/categories"
            suppressHydrationWarning
            className={`inline-flex items-center gap-2 px-6 py-3 bg-foreground text-primary-foreground text-sm font-bold rounded-full hover:opacity-80 transition-opacity ${visible ? 'reveal-animate stagger-2' : 'opacity-0'}`}>
            {ui.viewAll}
            <Icon name="ArrowRightIcon" size={16} />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-muted animate-pulse rounded-xl" style={{ aspectRatio: '3/4' }} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 border border-border">
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
                href={`/search?category=${cat.slug}`}
                className={`group relative overflow-hidden border border-border bg-card ${visible ? 'reveal-animate' : 'opacity-0'}`}
                style={{ animationDelay: `${i * 0.06}s`, aspectRatio: '3/4' }}>
                
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
                <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 via-foreground/20 to-transparent" />

                {/* Content */}
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  {cat.product_count > 0 && (
                    <span className="text-[10px] font-bold uppercase tracking-widest text-primary-foreground/60 block mb-1">
                      {cat.product_count.toLocaleString()}+ {ui.products}
                    </span>
                  )}
                  <h3 className="text-sm md:text-base font-extrabold text-primary-foreground leading-tight">
                    {label}
                  </h3>
                </div>

                {/* Hover arrow */}
                <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-primary-foreground/10 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Icon name="ArrowRightIcon" size={14} className="text-primary-foreground" />
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
