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

// Fallback mock categories shown when Supabase returns empty
const MOCK_MASTER_CATEGORIES: MasterCategory[] = [
  { id: 'm1', slug: 'pharmaceuticals-raw-materials', name_en: 'Pharmaceuticals', name_ar: 'أدوية ومستحضرات', description_en: null, image_url: CATEGORY_IMAGES['pharmaceuticals-raw-materials'], icon: 'BeakerIcon', product_count: 450, supplier_count: 120, sort_order: 1 },
  { id: 'm2', slug: 'raw-materials-chemicals', name_en: 'Raw Materials', name_ar: 'مواد خام وكيماويات', description_en: null, image_url: CATEGORY_IMAGES['raw-materials-chemicals'], icon: 'CubeTransparentIcon', product_count: 2100, supplier_count: 510, sort_order: 2 },
  { id: 'm3', slug: 'electronics-mobile-phones', name_en: 'Electronics', name_ar: 'إلكترونيات', description_en: null, image_url: CATEGORY_IMAGES['electronics-mobile-phones'], icon: 'DevicePhoneMobileIcon', product_count: 1240, supplier_count: 320, sort_order: 3 },
  { id: 'm4', slug: 'automotive-vehicles', name_en: 'Automotive', name_ar: 'سيارات وقطع غيار', description_en: null, image_url: CATEGORY_IMAGES['automotive-vehicles'], icon: 'TruckIcon', product_count: 870, supplier_count: 210, sort_order: 4 },
  { id: 'm5', slug: 'beauty-personal-care', name_en: 'Beauty & Care', name_ar: 'تجميل وعناية', description_en: null, image_url: CATEGORY_IMAGES['beauty-personal-care'], icon: 'SparklesIcon', product_count: 730, supplier_count: 195, sort_order: 5 },
  { id: 'm6', slug: 'health-medical-equipment', name_en: 'Medical Equipment', name_ar: 'معدات طبية', description_en: null, image_url: CATEGORY_IMAGES['health-medical-equipment'], icon: 'HeartIcon', product_count: 640, supplier_count: 180, sort_order: 6 },
  { id: 'm7', slug: 'home-appliances-furniture', name_en: 'Home Appliances', name_ar: 'أجهزة منزلية', description_en: null, image_url: CATEGORY_IMAGES['home-appliances-furniture'], icon: 'HomeIcon', product_count: 980, supplier_count: 260, sort_order: 7 },
  { id: 'm8', slug: 'construction-building-materials', name_en: 'Construction', name_ar: 'مواد البناء', description_en: null, image_url: CATEGORY_IMAGES['construction-building-materials'], icon: 'BuildingOffice2Icon', product_count: 1560, supplier_count: 430, sort_order: 8 },
  { id: 'm9', slug: 'office-school-supplies', name_en: 'Office & School', name_ar: 'مستلزمات مكتبية', description_en: null, image_url: CATEGORY_IMAGES['office-school-supplies'], icon: 'DocumentTextIcon', product_count: 380, supplier_count: 95, sort_order: 9 },
  { id: 'm10', slug: 'toys-sports-entertainment', name_en: 'Toys & Sports', name_ar: 'ألعاب ورياضة', description_en: null, image_url: CATEGORY_IMAGES['toys-sports-entertainment'], icon: 'PuzzlePieceIcon', product_count: 520, supplier_count: 140, sort_order: 10 },
  { id: 'm11', slug: 'food-agriculture', name_en: 'Food & Agriculture', name_ar: 'الغذاء والزراعة', description_en: null, image_url: CATEGORY_IMAGES['food-agriculture'], icon: 'ShoppingBagIcon', product_count: 890, supplier_count: 230, sort_order: 11 },
  { id: 'm12', slug: 'textiles-apparel', name_en: 'Textiles & Apparel', name_ar: 'المنسوجات والملابس', description_en: null, image_url: CATEGORY_IMAGES['textiles-apparel'], icon: 'SwatchIcon', product_count: 670, supplier_count: 175, sort_order: 12 },
  { id: 'm13', slug: 'industrial-machinery', name_en: 'Industrial Machinery', name_ar: 'الآلات الصناعية', description_en: null, image_url: CATEGORY_IMAGES['industrial-machinery'], icon: 'WrenchScrewdriverIcon', product_count: 1100, supplier_count: 290, sort_order: 13 },
  { id: 'm14', slug: 'metals-steel', name_en: 'Metals & Steel', name_ar: 'المعادن والصلب', description_en: null, image_url: CATEGORY_IMAGES['metals-steel'], icon: 'CubeIcon', product_count: 760, supplier_count: 200, sort_order: 14 },
  { id: 'm15', slug: 'packaging-printing', name_en: 'Packaging & Printing', name_ar: 'التغليف والطباعة', description_en: null, image_url: CATEGORY_IMAGES['packaging-printing'], icon: 'ArchiveBoxIcon', product_count: 430, supplier_count: 115, sort_order: 15 },
  { id: 'm16', slug: 'energy-power', name_en: 'Energy & Power', name_ar: 'الطاقة والكهرباء', description_en: null, image_url: CATEGORY_IMAGES['energy-power'], icon: 'BoltIcon', product_count: 340, supplier_count: 90, sort_order: 16 },
  { id: 'm17', slug: 'plastics-rubber', name_en: 'Plastics & Rubber', name_ar: 'البلاستيك والمطاط', description_en: null, image_url: CATEGORY_IMAGES['plastics-rubber'], icon: 'BeakerIcon', product_count: 580, supplier_count: 155, sort_order: 17 },
  { id: 'm18', slug: 'cleaning-hygiene', name_en: 'Cleaning & Hygiene', name_ar: 'التنظيف والنظافة', description_en: null, image_url: CATEGORY_IMAGES['cleaning-hygiene'], icon: 'SparklesIcon', product_count: 310, supplier_count: 85, sort_order: 18 },
  { id: 'm19', slug: 'furniture-interiors', name_en: 'Furniture & Interiors', name_ar: 'الأثاث والديكور', description_en: null, image_url: CATEGORY_IMAGES['furniture-interiors'], icon: 'HomeIcon', product_count: 490, supplier_count: 130, sort_order: 19 },
  { id: 'm20', slug: 'agriculture-farming', name_en: 'Agriculture & Farming', name_ar: 'الزراعة والمزارع', description_en: null, image_url: CATEGORY_IMAGES['agriculture-farming'], icon: 'GlobeAltIcon', product_count: 420, supplier_count: 110, sort_order: 20 },
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

        // Merge: for each master slug, prefer DB row, fall back to mock
        const merged = MASTER_SLUGS.map(slug => {
          if (dbMap[slug]) {
            return { ...dbMap[slug], image_url: dbMap[slug].image_url || CATEGORY_IMAGES[slug] || null };
          }
          // Fall back to mock for this slug
          return MOCK_MASTER_CATEGORIES.find(m => m.slug === slug) || null;
        }).filter(Boolean) as MasterCategory[];

        setCategories(merged.length > 0 ? merged : MOCK_MASTER_CATEGORIES);
      } catch {
        setCategories(MOCK_MASTER_CATEGORIES);
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
