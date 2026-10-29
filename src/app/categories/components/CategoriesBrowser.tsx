'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { CATEGORY_IMAGES } from '@/lib/categoryLabels';
import MarketplaceProductCard from '@/components/MarketplaceProductCard';
import { pickFactoryName } from '@/lib/catalogDisplay';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Category {
  id: string;
  slug: string;
  name_en: string;
  name_ar: string;
  parent_id: string | null;
  depth: number;
  icon: string | null;
  image_url: string | null;
  sort_order: number;
  product_count: number;
  is_active: boolean;
}

interface Product {
  id: string;
  name: string;
  name_ar: string | null;
  category: string | null;
  category_id: string | null;
  unit_price: number | null;
  tiered_pricing?: unknown;
  origin_country: string | null;
  origin_type?: 'local' | 'international' | null;
  image_url: string | null;
  images?: unknown;
  minimum_order_qty: number | null;
  unit: string | null;
  is_active?: boolean;
  target_market?: string | null;
  manufacturer_id?: string | null;
  user_profiles?: { company_name: string | null; full_name: string | null } | null;
}

const PAGE_SIZE = 12;

// ─── B2B-only slugs & categories (industrial raw materials, bulk tonnage) ─────
const B2B_ONLY_SLUGS = new Set([
  'metals-steel',
  'plastics-rubber',
  'raw-materials-chemicals',
  'industrial-machinery',
  'energy-power',
  'construction-building-materials',
  'packaging-printing',
]);

const B2B_ONLY_CATEGORY_STRINGS = new Set([
  'metals',
  'plastics',
  'building',
  'construction',
  'machinery',
  'energy',
  'packaging',
  'raw-materials-chemicals',
  'raw_materials',
  'pharmaceuticals',
]);

// ─── Skeleton Card ────────────────────────────────────────────────────────────
const SkeletonCard: React.FC = () => (
  <div className="bg-card border border-border rounded-xl overflow-hidden animate-pulse">
    <div className="aspect-square bg-muted" />
    <div className="p-2.5 space-y-2">
      <div className="h-3 bg-muted rounded w-3/4" />
      <div className="h-3 bg-muted rounded w-1/2" />
      <div className="h-8 bg-muted rounded" />
      <div className="h-3 bg-muted rounded w-2/3" />
      <div className="h-3 bg-muted rounded w-1/2" />
      <div className="flex gap-1 mt-2">
        <div className="flex-1 h-7 bg-muted rounded-lg" />
        <div className="flex-1 h-7 bg-muted rounded-lg" />
        <div className="flex-1 h-7 bg-muted rounded-lg" />
      </div>
    </div>
  </div>
);

// ─── Main Browser ─────────────────────────────────────────────────────────────
const CategoriesBrowser: React.FC = () => {
  const { t, isRTL, language, dir } = useLanguage();
  const supabase = createClient();

  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [buyerMode, setBuyerMode] = useState<'b2c' | 'b2b'>('b2b');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const loaderRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);

  // Load data
  useEffect(() => {
    const load = async () => {
      try {
        const [catRes, prodRes] = await Promise.all([
          supabase
            .from('product_categories')
            .select('id, slug, name_en, name_ar, parent_id, depth, icon, image_url, sort_order, product_count, is_active')
            .eq('is_active', true)
            .eq('depth', 0)
            .order('sort_order', { ascending: true }),
          supabase
            .from('manufacturer_products')
            .select('id, name, name_ar, category, category_id, unit_price, tiered_pricing, origin_country, origin_type, image_url, images, minimum_order_qty, unit, target_market, manufacturer_id, user_profiles!manufacturer_products_manufacturer_id_fkey(company_name, full_name)')
            .eq('is_active', true)
            .limit(300),
        ]);

        setAllCategories(
          catRes.data && catRes.data.length > 0
            ? catRes.data.map((c: Category) => ({ ...c, image_url: c.image_url || CATEGORY_IMAGES[c.slug] || null }))
            : []
        );
        setAllProducts(prodRes.data && prodRes.data.length > 0 ? prodRes.data : []);
      } catch {
        setAllCategories([]);
        setAllProducts([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Filter products
  const filteredProducts = useMemo(() => {
    let list = allProducts;

    // Strict B2B/B2C isolation based on the product's target_market
    list = list.filter((p) => {
      const market = (p.target_market || 'B2B').toUpperCase();
      return buyerMode === 'b2c'
        ? market === 'B2C' || market === 'BOTH'
        : market === 'B2B' || market === 'BOTH';
    });

    if (selectedCategory !== 'all') {
      const cat = allCategories.find((c) => c.id === selectedCategory);
      if (cat) {
        list = list.filter(
          (p) =>
            p.category_id === cat.id ||
            p.category === cat.slug ||
            p.category === cat.name_en.toLowerCase() ||
            (p.category && cat.slug.includes(p.category))
        );
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.name_ar && p.name_ar.includes(q)) ||
          (p.category && p.category.toLowerCase().includes(q))
      );
    }

    return list;
  }, [allProducts, selectedCategory, searchQuery, allCategories, buyerMode]);

  const visibleProducts = useMemo(() => filteredProducts.slice(0, visibleCount), [filteredProducts, visibleCount]);
  const hasMore = visibleCount < filteredProducts.length;

  // Reset visible count when filter changes
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [selectedCategory, searchQuery]);

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    if (!loaderRef.current || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingMore) {
          setLoadingMore(true);
          setTimeout(() => {
            setVisibleCount((prev) => prev + PAGE_SIZE);
            setLoadingMore(false);
          }, 400);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadingMore]);

  // Scroll category tab into view
  const scrollTabIntoView = useCallback((id: string) => {
    if (!tabsRef.current) return;
    const btn = tabsRef.current.querySelector(`[data-cat="${id}"]`) as HTMLElement;
    if (btn) btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, []);

  const handleCategorySelect = useCallback((id: string) => {
    setSelectedCategory(id);
    scrollTabIntoView(id);
  }, [scrollTabIntoView]);

  const selectedCatLabel = useMemo(() => {
    if (selectedCategory === 'all') return language === 'ar' ? 'الكل' : 'All';
    const cat = allCategories.find((c) => c.id === selectedCategory);
    if (!cat) return '';
    return language === 'ar' ? cat.name_ar : cat.name_en;
  }, [selectedCategory, allCategories, language]);

  return (
    <div className="pb-[calc(8rem+env(safe-area-inset-bottom))] md:pb-12 min-h-screen bg-background" dir={dir}>

      {/* ── Page Header ── */}
      <div className="bg-foreground py-6 md:py-10 border-b border-border/20 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.04] hidden md:block"
          style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '28px 28px' }}
        />
        <div className="max-w-5xl mx-auto px-4 md:px-6 relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <span className="h-px w-6 bg-primary" />
            <span className="text-xs font-bold uppercase tracking-widest text-primary/80">
              {t.categories?.masterTree || 'Categories'}
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-primary-foreground mb-1">
            {t.categories?.pageTitle || 'Browse All Categories'}
          </h1>
          <p className="text-sm text-primary-foreground/60 font-medium">
            {allCategories.length} {t.categories?.sectors || 'sectors'} · {allProducts.length}+ {t.categories?.productsCount || 'products'}
          </p>
        </div>
      </div>

      {/* ── Search (non-sticky) ── */}
      <div className="max-w-5xl mx-auto px-4 md:px-6 pt-3">
        <div className="flex items-center gap-2 border border-border rounded-xl px-3 py-2 bg-background focus-within:border-primary transition-colors">
          <Icon name="MagnifyingGlassIcon" size={16} className="text-muted-foreground shrink-0" />
          <input
            type="text"
            placeholder={t.categories?.searchPlaceholder || 'ابحث عن منتجات، مصنعين، موردين...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 text-sm bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none"
            dir="rtl"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="text-muted-foreground hover:text-foreground">
              <Icon name="XMarkIcon" size={14} />
            </button>
          )}
        </div>
      </div>

      {/* ── Unified Sticky Filter Row: B2B/B2C toggle + category pills ── */}
      <div className="sticky top-0 z-40 bg-card/95 backdrop-blur-md border-b border-border mt-3">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-2.5 flex items-center gap-2">
          {/* B2B / B2C toggle */}
          <div className="flex items-center border border-border rounded-full overflow-hidden shrink-0">
            <button
              onClick={() => setBuyerMode('b2b')}
              className={`h-8 px-3 text-xs font-bold transition-colors whitespace-nowrap ${buyerMode === 'b2b' ? 'bg-foreground text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
            >
              جملة (B2B)
            </button>
            <button
              onClick={() => setBuyerMode('b2c')}
              className={`h-8 px-3 text-xs font-bold transition-colors whitespace-nowrap ${buyerMode === 'b2c' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
            >
              تجزئة (B2C)
            </button>
          </div>

          <span className="h-5 w-px bg-border shrink-0" aria-hidden="true" />

          {/* Category pills */}
          <div
            ref={tabsRef}
            className="flex-1 flex gap-2 overflow-x-auto scrollbar-hide"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            <button
              data-cat="all"
              onClick={() => handleCategorySelect('all')}
              className={`shrink-0 flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold border transition-all whitespace-nowrap ${
                selectedCategory === 'all' ? 'bg-primary text-primary-foreground border-primary shadow-sm' : 'bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground'
              }`}
            >
              {language === 'ar' ? 'الكل' : 'All'}
            </button>

            {allCategories.map((cat) => (
              <button
                key={cat.id}
                data-cat={cat.id}
                onClick={() => handleCategorySelect(cat.id)}
                className={`shrink-0 flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold border transition-all whitespace-nowrap ${
                  selectedCategory === cat.id
                    ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                    : 'bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground'
                }`}
              >
                {language === 'ar' ? cat.name_ar : cat.name_en}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Results Count ── */}
      {!loading && (
        <div className="max-w-5xl mx-auto px-4 md:px-6 pt-4 pb-2 flex items-center justify-between">
          <p className="text-xs text-muted-foreground font-medium" dir="rtl">
            {filteredProducts.length > 0 ? (
              <>
                <span className="font-bold text-foreground">{filteredProducts.length}</span>
                {' '}{language === 'ar' ? 'منتج' : 'products'}
                {selectedCategory !== 'all' && (
                  <> {language === 'ar' ? 'في' : 'in'} <span className="font-bold text-primary">{selectedCatLabel}</span></>
                )}
              </>
            ) : (
              language === 'ar' ? 'لا توجد منتجات' : 'No products found'
            )}
          </p>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-xs text-primary font-bold hover:underline"
            >
              {language === 'ar' ? 'مسح البحث' : 'Clear search'}
            </button>
          )}
        </div>
      )}

      {/* ── Product Grid ── */}
      <div className="max-w-5xl mx-auto px-4 md:px-6 pb-6">
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mt-2">
            {[...Array(8)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-center">
            <Icon name="MagnifyingGlassIcon" size={48} className="text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-lg font-bold text-foreground mb-2">
              {language === 'ar' ? 'لا توجد منتجات' : 'No products found'}
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              {language === 'ar' ? 'جرب تغيير الفئة أو كلمة البحث' : 'Try a different category or search term'}
            </p>
            <button
              onClick={() => { setSelectedCategory('all'); setSearchQuery(''); }}
              className="px-4 py-2 bg-primary text-primary-foreground text-sm font-bold rounded-xl hover:opacity-90 transition-opacity"
            >
              {language === 'ar' ? 'عرض الكل' : 'Show all'}
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mt-2">
              {visibleProducts.map((product, idx) => (
                <MarketplaceProductCard
                  key={product.id}
                  product={{
                    id: product.id,
                    name: product.name,
                    name_ar: product.name_ar,
                    image_url: product.image_url,
                    images: Array.isArray(product.images)
                      ? (product.images as unknown[]).filter((i): i is string => typeof i === 'string' && i.length > 0)
                      : null,
                    unit_price: product.unit_price || 0,
                    tiered_pricing: product.tiered_pricing,
                    minimum_order_qty: product.minimum_order_qty || 1,
                    unit: product.unit || (language === 'ar' ? 'قطعة' : 'pcs'),
                    origin_country: product.origin_country,
                    category: product.category,
                    is_verified: true,
                    manufacturer_id: product.manufacturer_id,
                    origin_type: product.origin_type ?? 'local',
                    company_name: pickFactoryName(
                      (Array.isArray(product.user_profiles) ? product.user_profiles[0] : product.user_profiles)?.company_name,
                      (Array.isArray(product.user_profiles) ? product.user_profiles[0] : product.user_profiles)?.full_name
                    ) || undefined,
                  }}
                  buyerMode={buyerMode}
                  index={idx}
                  priority={idx < 4}
                  showChat={true}
                />
              ))}
            </div>

            {/* ── Infinite Scroll Loader ── */}
            {hasMore && (
              <div ref={loaderRef} className="flex justify-center items-center py-8 gap-3">
                {loadingMore ? (
                  <>
                    <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm text-muted-foreground">
                      {language === 'ar' ? 'جارٍ التحميل...' : 'Loading more...'}
                    </span>
                  </>
                ) : (
                  <div className="h-4" />
                )}
              </div>
            )}

            {/* ── End of results ── */}
            {!hasMore && filteredProducts.length > PAGE_SIZE && (
              <div className="flex flex-col items-center py-8 gap-2">
                <div className="w-12 h-px bg-border" />
                <p className="text-xs text-muted-foreground">
                  {language === 'ar'
                    ? `تم عرض جميع ${filteredProducts.length} منتج`
                    : `All ${filteredProducts.length} products shown`}
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Footer CTA ── */}
      {!loading && (
        <div className="max-w-5xl mx-auto px-4 md:px-6 pb-6">
          <div className="bg-muted/40 border border-border rounded-2xl p-6 text-center">
            <h2 className="text-base font-extrabold text-foreground mb-1">
              {t.categories?.ctaTitle || 'List Your Products'}
            </h2>
            <p className="text-xs text-muted-foreground mb-4">
              {t.categories?.ctaDesc || 'Join thousands of verified suppliers on DirectHub'}
            </p>
            <Link
              href="/factory/register"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-foreground text-primary-foreground text-sm font-bold rounded-xl hover:opacity-90 transition-opacity"
            >
              <Icon name="PlusCircleIcon" size={16} />
              {t.categories?.ctaBtn || 'Register as Supplier'}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};

export default CategoriesBrowser;