'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { CATEGORY_IMAGES } from '@/lib/categoryLabels';
import MarketplaceProductCard from '@/components/MarketplaceProductCard';

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
  origin_country: string | null;
  image_url: string | null;
  minimum_order_qty: number | null;
  unit: string | null;
  is_active?: boolean;
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

// ─── Mock fallback categories ─────────────────────────────────────────────────
const MOCK_CATEGORIES: Category[] = [
  { id: 'mc1', slug: 'electronics-mobile-phones', name_en: 'Electronics', name_ar: 'إلكترونيات', parent_id: null, depth: 0, icon: null, image_url: CATEGORY_IMAGES['electronics-mobile-phones'], sort_order: 1, product_count: 1240, is_active: true },
  { id: 'mc2', slug: 'automotive-vehicles', name_en: 'Automotive', name_ar: 'سيارات', parent_id: null, depth: 0, icon: null, image_url: CATEGORY_IMAGES['automotive-vehicles'], sort_order: 2, product_count: 870, is_active: true },
  { id: 'mc3', slug: 'construction-building-materials', name_en: 'Construction', name_ar: 'بناء', parent_id: null, depth: 0, icon: null, image_url: CATEGORY_IMAGES['construction-building-materials'], sort_order: 3, product_count: 1560, is_active: true },
  { id: 'mc4', slug: 'health-medical-equipment', name_en: 'Medical', name_ar: 'طبي', parent_id: null, depth: 0, icon: null, image_url: CATEGORY_IMAGES['health-medical-equipment'], sort_order: 4, product_count: 640, is_active: true },
  { id: 'mc5', slug: 'home-appliances-furniture', name_en: 'Home & Furniture', name_ar: 'أجهزة وأثاث', parent_id: null, depth: 0, icon: null, image_url: CATEGORY_IMAGES['home-appliances-furniture'], sort_order: 5, product_count: 980, is_active: true },
  { id: 'mc6', slug: 'raw-materials-chemicals', name_en: 'Raw Materials', name_ar: 'مواد خام', parent_id: null, depth: 0, icon: null, image_url: CATEGORY_IMAGES['raw-materials-chemicals'], sort_order: 6, product_count: 2100, is_active: true },
  { id: 'mc7', slug: 'beauty-personal-care', name_en: 'Beauty', name_ar: 'تجميل', parent_id: null, depth: 0, icon: null, image_url: CATEGORY_IMAGES['beauty-personal-care'], sort_order: 7, product_count: 730, is_active: true },
  { id: 'mc8', slug: 'food-agriculture', name_en: 'Food & Agri', name_ar: 'غذاء وزراعة', parent_id: null, depth: 0, icon: null, image_url: CATEGORY_IMAGES['food-agriculture'], sort_order: 8, product_count: 890, is_active: true },
  { id: 'mc9', slug: 'textiles-apparel', name_en: 'Textiles', name_ar: 'منسوجات', parent_id: null, depth: 0, icon: null, image_url: CATEGORY_IMAGES['textiles-apparel'], sort_order: 9, product_count: 670, is_active: true },
  { id: 'mc10', slug: 'industrial-machinery', name_en: 'Machinery', name_ar: 'آلات', parent_id: null, depth: 0, icon: null, image_url: CATEGORY_IMAGES['industrial-machinery'], sort_order: 10, product_count: 1100, is_active: true },
  { id: 'mc11', slug: 'metals-steel', name_en: 'Metals & Steel', name_ar: 'معادن وصلب', parent_id: null, depth: 0, icon: null, image_url: CATEGORY_IMAGES['metals-steel'], sort_order: 11, product_count: 760, is_active: true },
  { id: 'mc12', slug: 'packaging-printing', name_en: 'Packaging', name_ar: 'تغليف', parent_id: null, depth: 0, icon: null, image_url: CATEGORY_IMAGES['packaging-printing'], sort_order: 12, product_count: 430, is_active: true },
  { id: 'mc13', slug: 'energy-power', name_en: 'Energy', name_ar: 'طاقة', parent_id: null, depth: 0, icon: null, image_url: CATEGORY_IMAGES['energy-power'], sort_order: 13, product_count: 340, is_active: true },
  { id: 'mc14', slug: 'plastics-rubber', name_en: 'Plastics', name_ar: 'بلاستيك', parent_id: null, depth: 0, icon: null, image_url: CATEGORY_IMAGES['plastics-rubber'], sort_order: 14, product_count: 580, is_active: true },
];

// ─── Mock products fallback ───────────────────────────────────────────────────
const MOCK_PRODUCTS: Product[] = [
  { id: 'p1', name: 'LED Smart Lighting System', name_ar: 'نظام إضاءة LED ذكي', category: 'electronics', category_id: 'mc1', unit_price: 12.00, origin_country: 'CN', image_url: null, minimum_order_qty: 1000, unit: 'units' },
  { id: 'p2', name: 'Industrial Steel Pipes', name_ar: 'أنابيب فولاذية صناعية', category: 'building', category_id: 'mc3', unit_price: 45.00, origin_country: 'IN', image_url: null, minimum_order_qty: 500, unit: 'pcs' },
  { id: 'p3', name: 'Solar Panel 400W Monocrystalline', name_ar: 'لوح طاقة شمسية 400 واط', category: 'energy', category_id: 'mc13', unit_price: 89.00, origin_country: 'CN', image_url: null, minimum_order_qty: 50, unit: 'pcs' },
  { id: 'p4', name: 'Industrial CNC Milling Machine', name_ar: 'ماكينة تفريز CNC صناعية', category: 'machinery', category_id: 'mc10', unit_price: 4500.00, origin_country: 'DE', image_url: null, minimum_order_qty: 1, unit: 'unit' },
  { id: 'p5', name: 'Stainless Steel Bolts M12', name_ar: 'براغي ستانلس ستيل M12', category: 'metals', category_id: 'mc11', unit_price: 0.85, origin_country: 'CN', image_url: null, minimum_order_qty: 5000, unit: 'pcs' },
  { id: 'p6', name: 'Cotton Fabric Roll 100%', name_ar: 'رول قماش قطن 100%', category: 'textiles', category_id: 'mc9', unit_price: 3.20, origin_country: 'EG', image_url: null, minimum_order_qty: 200, unit: 'meters' },
  { id: 'p7', name: 'Pharmaceutical Grade Gelatin', name_ar: 'جيلاتين صيدلاني الدرجة', category: 'pharmaceuticals', category_id: 'mc6', unit_price: 18.50, origin_country: 'FR', image_url: null, minimum_order_qty: 100, unit: 'kg' },
  { id: 'p8', name: 'Hydraulic Excavator 20T', name_ar: 'حفارة هيدروليكية 20 طن', category: 'construction', category_id: 'mc3', unit_price: 85000.00, origin_country: 'JP', image_url: null, minimum_order_qty: 1, unit: 'unit' },
  { id: 'p9', name: 'Organic Olive Oil Extra Virgin', name_ar: 'زيت زيتون عضوي بكر ممتاز', category: 'food', category_id: 'mc8', unit_price: 6.50, origin_country: 'TN', image_url: null, minimum_order_qty: 500, unit: 'liters' },
  { id: 'p10', name: 'Aluminum Alloy Sheet 3mm', name_ar: 'صفيحة ألومنيوم سبيكة 3مم', category: 'metals', category_id: 'mc11', unit_price: 2.80, origin_country: 'CN', image_url: null, minimum_order_qty: 1000, unit: 'sheets' },
  { id: 'p11', name: 'Industrial Air Compressor 50L', name_ar: 'ضاغط هواء صناعي 50 لتر', category: 'machinery', category_id: 'mc10', unit_price: 320.00, origin_country: 'IT', image_url: null, minimum_order_qty: 5, unit: 'units' },
  { id: 'p12', name: 'HDPE Plastic Granules', name_ar: 'حبيبات بلاستيك HDPE', category: 'plastics', category_id: 'mc14', unit_price: 1.20, origin_country: 'SA', image_url: null, minimum_order_qty: 2000, unit: 'kg' },
  { id: 'p13', name: 'Corrugated Cardboard Boxes', name_ar: 'صناديق كرتون مموج', category: 'packaging', category_id: 'mc12', unit_price: 0.45, origin_country: 'CN', image_url: null, minimum_order_qty: 10000, unit: 'pcs' },
  { id: 'p14', name: 'Surgical Gloves Latex Free', name_ar: 'قفازات جراحية خالية من اللاتكس', category: 'medical', category_id: 'mc4', unit_price: 0.12, origin_country: 'MY', image_url: null, minimum_order_qty: 50000, unit: 'pcs' },
  { id: 'p15', name: 'Argan Oil Pure Organic', name_ar: 'زيت أرغان نقي عضوي', category: 'beauty', category_id: 'mc7', unit_price: 25.00, origin_country: 'MA', image_url: null, minimum_order_qty: 100, unit: 'liters' },
  { id: 'p16', name: 'Ceramic Floor Tiles 60x60', name_ar: 'بلاط أرضيات سيراميك 60×60', category: 'building', category_id: 'mc3', unit_price: 8.50, origin_country: 'ES', image_url: null, minimum_order_qty: 500, unit: 'sqm' },
  { id: 'p17', name: 'Automotive Brake Pads Set', name_ar: 'طقم تيل فرامل سيارات', category: 'auto', category_id: 'mc2', unit_price: 22.00, origin_country: 'DE', image_url: null, minimum_order_qty: 100, unit: 'sets' },
  { id: 'p18', name: 'Polyester Fabric 150gsm', name_ar: 'قماش بوليستر 150 جرام', category: 'textiles', category_id: 'mc9', unit_price: 1.80, origin_country: 'CN', image_url: null, minimum_order_qty: 1000, unit: 'meters' },
  { id: 'p19', name: 'Lithium Battery Pack 48V', name_ar: 'حزمة بطارية ليثيوم 48 فولت', category: 'energy', category_id: 'mc13', unit_price: 180.00, origin_country: 'CN', image_url: null, minimum_order_qty: 20, unit: 'pcs' },
  { id: 'p20', name: 'Stainless Steel Kitchen Sink', name_ar: 'حوض مطبخ ستانلس ستيل', category: 'furniture', category_id: 'mc5', unit_price: 65.00, origin_country: 'TR', image_url: null, minimum_order_qty: 50, unit: 'pcs' },
  { id: 'p21', name: 'Wheat Flour Premium Grade', name_ar: 'دقيق قمح درجة ممتازة', category: 'food', category_id: 'mc8', unit_price: 0.55, origin_country: 'UA', image_url: null, minimum_order_qty: 5000, unit: 'kg' },
  { id: 'p22', name: 'PVC Pipes 4 inch', name_ar: 'أنابيب PVC 4 بوصة', category: 'plastics', category_id: 'mc14', unit_price: 3.50, origin_country: 'CN', image_url: null, minimum_order_qty: 500, unit: 'pcs' },
  { id: 'p23', name: 'Industrial Safety Helmets', name_ar: 'خوذات سلامة صناعية', category: 'construction', category_id: 'mc3', unit_price: 4.20, origin_country: 'CN', image_url: null, minimum_order_qty: 500, unit: 'pcs' },
  { id: 'p24', name: 'Copper Wire 2.5mm Roll', name_ar: 'سلك نحاس 2.5مم لفة', category: 'electronics', category_id: 'mc1', unit_price: 12.50, origin_country: 'EG', image_url: null, minimum_order_qty: 100, unit: 'rolls' },
];

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
            .select('id, name, name_ar, category, category_id, unit_price, origin_country, image_url, minimum_order_qty, unit, user_profiles!manufacturer_products_manufacturer_id_fkey(company_name, full_name)')
            .eq('is_active', true)
            .limit(300),
        ]);

        setAllCategories(
          catRes.data && catRes.data.length > 0
            ? catRes.data.map((c: Category) => ({ ...c, image_url: c.image_url || CATEGORY_IMAGES[c.slug] || null }))
            : MOCK_CATEGORIES
        );
        setAllProducts(prodRes.data && prodRes.data.length > 0 ? prodRes.data : MOCK_PRODUCTS);
      } catch {
        setAllCategories(MOCK_CATEGORIES);
        setAllProducts(MOCK_PRODUCTS);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Filter products
  const filteredProducts = useMemo(() => {
    let list = allProducts;

    // B2B/B2C filtering: restrict industrial/bulk products to B2B only
    if (buyerMode === 'b2c') {
      list = list.filter((p) => {
        const cat = allCategories.find((c) => c.id === p.category_id);
        const catSlug = cat?.slug || '';
        const isB2BOnly =
          B2B_ONLY_SLUGS.has(catSlug) ||
          B2B_ONLY_CATEGORY_STRINGS.has(p.category || '') ||
          (p.minimum_order_qty !== null && p.minimum_order_qty >= 500);
        return !isB2BOnly;
      });
    }

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
    <div className="pb-32 md:pb-12 min-h-screen bg-background" dir={dir}>

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

      {/* ── Sticky Search + Mode Bar ── */}
      <div className="sticky top-0 z-40 bg-card/95 backdrop-blur-md border-b border-border">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-3 flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
          {/* Search */}
          <div className="flex-1 flex items-center gap-2 border border-border rounded-xl px-3 py-2 bg-background focus-within:border-primary transition-colors">
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

          {/* B2B / B2C toggle */}
          <div className="flex items-center border border-border rounded-xl overflow-hidden shrink-0">
            <button
              onClick={() => setBuyerMode('b2c')}
              className={`h-9 px-3 text-xs font-bold transition-colors whitespace-nowrap ${buyerMode === 'b2c' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
            >
              تجزئة وأفراد (B2C)
            </button>
            <button
              onClick={() => setBuyerMode('b2b')}
              className={`h-9 px-3 text-xs font-bold transition-colors whitespace-nowrap ${buyerMode === 'b2b' ? 'bg-foreground text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
            >
              جملة وشركات (B2B)
            </button>
          </div>
        </div>

        {/* ── Category Tabs ── */}
        <div
          ref={tabsRef}
          className="max-w-5xl mx-auto px-4 md:px-6 pb-3 flex gap-2 overflow-x-auto scrollbar-hide"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {/* All tab */}
          <button
            data-cat="all"
            onClick={() => handleCategorySelect('all')}
            className={`shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold border transition-all whitespace-nowrap ${
              selectedCategory === 'all' ?'bg-primary text-primary-foreground border-primary shadow-sm' :'bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground'
            }`}
          >
            <Icon name="Squares2X2Icon" size={13} />
            {language === 'ar' ? 'الكل' : 'All'}
          </button>

          {/* جهات التصنيع المحلية / الموردون المحليون / جهات التصنيع */}
          {[
            { id: 'local', label_ar: 'جهات التصنيع المحلية', label_en: 'Local Manufacturers' },
            { id: 'suppliers', label_ar: 'الموردون المحليين', label_en: 'Local Suppliers' },
            { id: 'exporters', label_ar: 'جهات التصنيع العالمية', label_en: 'Manufacturers' },
          ].map((tab) => (
            <button
              key={tab.id}
              data-cat={tab.id}
              onClick={() => handleCategorySelect(tab.id)}
              className={`shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold border transition-all whitespace-nowrap ${
                selectedCategory === tab.id
                  ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                  : 'bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground'
              }`}
            >
              {language === 'ar' ? tab.label_ar : tab.label_en}
            </button>
          ))}

          {/* Dynamic category tabs */}
          {allCategories.map((cat) => (
            <button
              key={cat.id}
              data-cat={cat.id}
              onClick={() => handleCategorySelect(cat.id)}
              className={`shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold border transition-all whitespace-nowrap ${
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
                    unit_price: product.unit_price || 0,
                    minimum_order_qty: product.minimum_order_qty || 1,
                    unit: product.unit || (language === 'ar' ? 'قطعة' : 'pcs'),
                    origin_country: product.origin_country,
                    category: product.category,
                    is_verified: true,
                    manufacturer_id: product.manufacturer_id,
                    company_name: (Array.isArray(product.user_profiles) ? product.user_profiles[0] : product.user_profiles)?.company_name || undefined,
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