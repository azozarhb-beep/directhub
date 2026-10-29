'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import AppImage from '@/components/ui/AppImage';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSourcingFilter } from '@/contexts/SourcingFilterContext';
import { getCategoryFullLabel, CATEGORY_IMAGES } from '@/lib/categoryLabels';

interface MasterCategory {
  id: string;
  slug: string;
  name_en: string;
  name_ar: string;
  description_en: string | null;
  image_url: string | null;
  icon: string | null;
  product_count: number;
  supplier_count: number;
  sort_order: number;
}

// Map of slug → icon name for fallback rendering
const CATEGORY_ICONS: Record<string, string> = {
  'pharmaceuticals-raw-materials': 'BeakerIcon',
  'raw-materials-chemicals': 'CubeTransparentIcon',
  'electronics-mobile-phones': 'DevicePhoneMobileIcon',
  'automotive-vehicles': 'TruckIcon',
  'beauty-personal-care': 'SparklesIcon',
  'health-medical-equipment': 'HeartIcon',
  'home-appliances-furniture': 'HomeIcon',
  'construction-building-materials': 'BuildingOffice2Icon',
  'office-school-supplies': 'DocumentTextIcon',
  'toys-sports-entertainment': 'PuzzlePieceIcon',
  'food-agriculture': 'ShoppingBagIcon',
  'textiles-apparel': 'SwatchIcon',
  'industrial-machinery': 'WrenchScrewdriverIcon',
  'metals-steel': 'CubeIcon',
  'packaging-printing': 'ArchiveBoxIcon',
  'energy-power': 'BoltIcon',
  'plastics-rubber': 'BeakerIcon',
  'cleaning-hygiene': 'SparklesIcon',
  'furniture-interiors': 'HomeIcon',
  'agriculture-farming': 'GlobeAltIcon',
};

// Gradient colors per category for visual variety
const CATEGORY_GRADIENTS: Record<string, string> = {
  'pharmaceuticals-raw-materials': 'from-blue-900/40 via-blue-900/60 to-transparent',
  'raw-materials-chemicals': 'from-orange-900/40 via-orange-900/60 to-transparent',
  'electronics-mobile-phones': 'from-violet-900/40 via-violet-900/60 to-transparent',
  'automotive-vehicles': 'from-slate-900/40 via-slate-900/60 to-transparent',
  'beauty-personal-care': 'from-pink-900/40 via-pink-900/60 to-transparent',
  'health-medical-equipment': 'from-emerald-900/40 via-emerald-900/60 to-transparent',
  'home-appliances-furniture': 'from-amber-900/40 via-amber-900/60 to-transparent',
  'construction-building-materials': 'from-stone-900/40 via-stone-900/60 to-transparent',
  'office-school-supplies': 'from-cyan-900/40 via-cyan-900/60 to-transparent',
  'toys-sports-entertainment': 'from-red-900/40 via-red-900/60 to-transparent',
  'food-agriculture': 'from-green-900/40 via-green-900/60 to-transparent',
  'textiles-apparel': 'from-purple-900/40 via-purple-900/60 to-transparent',
  'industrial-machinery': 'from-gray-900/40 via-gray-900/60 to-transparent',
  'metals-steel': 'from-zinc-900/40 via-zinc-900/60 to-transparent',
  'packaging-printing': 'from-teal-900/40 via-teal-900/60 to-transparent',
  'energy-power': 'from-yellow-900/40 via-yellow-900/60 to-transparent',
  'plastics-rubber': 'from-indigo-900/40 via-indigo-900/60 to-transparent',
  'cleaning-hygiene': 'from-sky-900/40 via-sky-900/60 to-transparent',
  'furniture-interiors': 'from-rose-900/40 via-rose-900/60 to-transparent',
  'agriculture-farming': 'from-lime-900/40 via-lime-900/60 to-transparent',
};

// The 20 master slugs in display order
const MASTER_SLUGS = [
  'pharmaceuticals-raw-materials',
  'raw-materials-chemicals',
  'electronics-mobile-phones',
  'automotive-vehicles',
  'beauty-personal-care',
  'health-medical-equipment',
  'home-appliances-furniture',
  'construction-building-materials',
  'office-school-supplies',
  'toys-sports-entertainment',
  'food-agriculture',
  'textiles-apparel',
  'industrial-machinery',
  'metals-steel',
  'packaging-printing',
  'energy-power',
  'plastics-rubber',
  'cleaning-hygiene',
  'furniture-interiors',
  'agriculture-farming',
];

const LOCAL_COUNTRY_IDENTIFIERS = ['SA', 'Saudi Arabia', 'المملكة العربية السعودية', 'KSA', 'saudi arabia'];

const MasterCategoriesGrid: React.FC = () => {
  const [categories, setCategories] = useState<MasterCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [localCount, setLocalCount] = useState<Record<string, number>>({});
  const [globalCount, setGlobalCount] = useState<Record<string, number>>({});
  const [activeScope, setActiveScope] = useState<'all' | 'local' | 'global'>('all');
  const { t, dir, language } = useLanguage();
  const ui = t.masterCategories;
  const { activeTab, setActiveTab } = useSourcingFilter();
  const supabase = createClient();

  // Fetch master categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const { data } = await supabase
          .from('product_categories')
          .select('id, slug, name_en, name_ar, description_en, image_url, icon, product_count, supplier_count, sort_order')
          .eq('is_active', true)
          .is('parent_id', null)
          .in('slug', MASTER_SLUGS)
          .order('sort_order', { ascending: true });

        // Build a map of DB results by slug
        const dbMap: Record<string, MasterCategory> = {};
        if (data && data.length > 0) {
          data.forEach(c => { dbMap[c.slug] = c; });
        }

        // Only show categories that exist in the database
        const merged = MASTER_SLUGS
          .filter(slug => !!dbMap[slug])
          .map(slug => ({ ...dbMap[slug], image_url: dbMap[slug].image_url || CATEGORY_IMAGES[slug] || null })) as MasterCategory[];

        setCategories(merged);
      } catch {
        setCategories([]);
      } finally {
        setLoading(false);
      }
    };
    fetchCategories();
  }, []);

  // Fetch local/global product counts per category
  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const { data: products } = await supabase
          .from('manufacturer_products')
          .select('industry_sector, origin_country')
          .eq('is_active', true);

        if (!products) return;

        const lc: Record<string, number> = {};
        const gc: Record<string, number> = {};

        products.forEach(p => {
          if (!p.industry_sector) return;
          const isLocal = LOCAL_COUNTRY_IDENTIFIERS.some(id =>
            p.origin_country?.toLowerCase() === id.toLowerCase()
          );
          if (isLocal) {
            lc[p.industry_sector] = (lc[p.industry_sector] || 0) + 1;
          } else {
            gc[p.industry_sector] = (gc[p.industry_sector] || 0) + 1;
          }
        });

        setLocalCount(lc);
        setGlobalCount(gc);
      } catch {
        // silent
      }
    };
    fetchCounts();
  }, []);

  const handleCategoryClick = useCallback((slug: string) => {
    setSelectedCategory(prev => prev === slug ? null : slug);
  }, []);

  const handleScopeFilter = useCallback((scope: 'all' | 'local' | 'global', slug: string) => {
    setActiveScope(scope);
    if (scope === 'local') {
      setActiveTab('local_manufacturers');
    } else if (scope === 'global') {
      setActiveTab('global_manufacturers');
    }
  }, [setActiveTab]);

  const getDisplayName = (cat: MasterCategory) =>
    getCategoryFullLabel(
      cat.slug,
      language,
      { name_en: cat.name_en, name_ar: cat.name_ar },
      (t as any).search?.categories as Record<string, string> | undefined
    );

  if (loading) {
    return (
      <section className="bg-background py-8 border-b border-border" dir={dir} suppressHydrationWarning>
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-4 w-48 bg-muted animate-pulse rounded" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="h-28 bg-muted animate-pulse rounded-xl" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-background py-8 border-b border-border" dir={dir} aria-label="Industrial Categories" suppressHydrationWarning>
      <div className="max-w-7xl mx-auto px-4 md:px-6">

        {/* Section header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <span className="h-px w-6 bg-primary" />
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
              {ui.title}
            </h2>
          </div>
          <Link
            href="/categories"
            className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
          >
            {ui.viewAll}
            <Icon name="ArrowRightIcon" size={12} />
          </Link>
        </div>

        {categories.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center bg-muted/30 border border-dashed border-border rounded-2xl">
            <Icon name="Squares2X2Icon" size={32} className="text-muted-foreground/60 mb-3" />
            <p className="text-sm font-bold text-foreground">
              {language === 'ar' ? 'لا توجد فئات متاحة حالياً' : 'No categories available yet'}
            </p>
          </div>
        )}

        {/* 20-category grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2.5 md:gap-3">
          {categories.map((cat) => {
            const iconName = (cat.icon || CATEGORY_ICONS[cat.slug] || 'TagIcon') as string;
            const gradient = CATEGORY_GRADIENTS[cat.slug] || 'from-gray-600/80 to-gray-900/90';
            const isSelected = selectedCategory === cat.slug;
            const imageUrl = cat.image_url || CATEGORY_IMAGES[cat.slug] || null;

            return (
              <div key={cat.id} className="relative">
                {/* Category tile */}
                <button
                  type="button"
                  onClick={() => handleCategoryClick(cat.slug)}
                  className={`w-full group relative overflow-hidden rounded-xl border transition-all duration-200 text-left ${
                    isSelected
                      ? 'border-primary ring-2 ring-primary/30 shadow-md'
                      : 'border-border hover:border-primary/50 hover:shadow-sm'
                  }`}
                  style={{ aspectRatio: '4/3' }}
                  aria-expanded={isSelected}
                  aria-label={getDisplayName(cat)}
                >
                  {/* Background image */}
                  {imageUrl ? (
                    <AppImage
                      src={imageUrl}
                      alt={`${cat.name_en} industrial sector`}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 20vw"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-muted" />
                  )}

                  {/* Gradient overlay */}
                  <div className={`absolute inset-0 bg-gradient-to-t ${gradient}`} />

                  {/* Content */}
                  <div className="absolute inset-0 flex flex-col justify-end p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Icon name={iconName as Parameters<typeof Icon>[0]['name']} size={14} className="text-white/80 shrink-0" />
                    </div>
                    <h3 className="text-xs font-bold text-white leading-tight line-clamp-2">
                      {getDisplayName(cat)}
                    </h3>
                    {cat.product_count > 0 && (
                      <p className="text-[10px] text-white/60 mt-0.5">
                        {cat.product_count.toLocaleString()}+ {ui.products}
                      </p>
                    )}
                  </div>

                  {/* Selected indicator */}
                  {isSelected && (
                    <div className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                      <Icon name="CheckIcon" size={10} className="text-primary-foreground" />
                    </div>
                  )}
                </button>

                {/* Expanded local/global filter panel */}
                {isSelected && (
                  <div className="absolute top-full left-0 right-0 z-30 mt-1.5 bg-card border border-border rounded-xl shadow-xl p-3 min-w-[180px]">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                      {ui.filterByScope}
                    </p>

                    {/* All */}
                    <Link
                      href={`/search?category=${cat.slug}`}
                      className="flex items-center justify-between w-full px-3 py-2 rounded-lg hover:bg-muted transition-colors mb-1 text-left"
                      onClick={() => setSelectedCategory(null)}
                    >
                      <span className="text-xs font-semibold text-foreground">
                        {ui.allSources}
                      </span>
                      <Icon name="ArrowRightIcon" size={12} className="text-muted-foreground" />
                    </Link>

                    {/* Local */}
                    <Link
                      href={`/search?category=${cat.slug}&scope=local`}
                      className="flex items-center justify-between w-full px-3 py-2 rounded-lg hover:bg-muted transition-colors mb-1 text-left"
                      onClick={() => {
                        handleScopeFilter('local', cat.slug);
                        setSelectedCategory(null);
                      }}
                    >
                      <div>
                        <span className="text-xs font-semibold text-foreground block">
                          {ui.localFactories}
                        </span>
                        {localCount[cat.slug] !== undefined && (
                          <span className="text-[10px] text-muted-foreground">
                            {localCount[cat.slug]} {ui.products}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-md">
                        {ui.local}
                      </span>
                    </Link>

                    {/* Global */}
                    <Link
                      href={`/search?category=${cat.slug}&scope=global`}
                      className="flex items-center justify-between w-full px-3 py-2 rounded-lg hover:bg-muted transition-colors text-left"
                      onClick={() => {
                        handleScopeFilter('global', cat.slug);
                        setSelectedCategory(null);
                      }}
                    >
                      <div>
                        <span className="text-xs font-semibold text-foreground block">
                          {ui.globalFactories}
                        </span>
                        {globalCount[cat.slug] !== undefined && (
                          <span className="text-[10px] text-muted-foreground">
                            {globalCount[cat.slug]} {ui.products}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-md">
                        {ui.global}
                      </span>
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Scope quick-filter bar */}
        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border">
          <span className="text-xs text-muted-foreground font-medium shrink-0">
            {ui.quickFilter}
          </span>
          <div className="flex gap-2 overflow-x-auto hide-scrollbar">
            {[
              { key: 'all' as const, label: ui.allSources },
              { key: 'local' as const, label: ui.localFactories },
              { key: 'global' as const, label: ui.globalFactories },
            ].map(item => (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  setActiveScope(item.key);
                  if (item.key === 'local') setActiveTab('local_manufacturers');
                  else if (item.key === 'global') setActiveTab('global_manufacturers');
                  else setActiveTab('local_manufacturers');
                }}
                className={`shrink-0 px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors whitespace-nowrap ${
                  activeScope === item.key
                    ? 'bg-foreground text-primary-foreground border-foreground'
                    : 'bg-background text-muted-foreground border-border hover:border-foreground hover:text-foreground'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Click-outside overlay to close expanded panel */}
      {selectedCategory && (
        <div
          className="fixed inset-0 z-20"
          onClick={() => setSelectedCategory(null)}
          aria-hidden="true"
        />
      )}
    </section>
  );
};

export default MasterCategoriesGrid;
