'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { useSourcingFilter, SourcingTab } from '@/contexts/SourcingFilterContext';
import { useLanguage } from '@/contexts/LanguageContext';
import MarketplaceProductCard from '@/components/MarketplaceProductCard';

// Yemen country codes / names used to determine "local"
const LOCAL_COUNTRY_IDENTIFIERS = ['YE', 'Yemen', 'اليمن', 'yemen'];

interface Product {
  id: string;
  name: string;
  name_ar: string;
  image_url: string | null;
  unit_price: number;
  minimum_order_qty: number;
  unit: string;
  origin_country: string;
  is_active: boolean;
  category: string;
  seller_badge?: 'certified_factory' | 'local_supplier' | null;
  international_manufacturer_id?: string | null;
  user_profiles?: { company_name: string; full_name: string; country: string; role: string };
  supplier_profiles?: { is_verified: boolean; tier: string };
}

// ── Mock data shown when Supabase returns no results ──────────────────────────
const MOCK_PRODUCTS: Product[] = [
  {
    id: 'mock-1',
    name: 'Industrial Steel Pipes',
    name_ar: 'أنابيب فولاذية صناعية',
    image_url: null,
    unit_price: 45,
    minimum_order_qty: 500,
    unit: 'pcs',
    origin_country: 'China',
    is_active: true,
    category: 'building',
    user_profiles: { company_name: 'SteelPro Manufacturing', full_name: 'SteelPro', country: 'China', role: 'manufacturer' },
    supplier_profiles: { is_verified: true, tier: 'gold' },
  },
  {
    id: 'mock-2',
    name: 'LED Smart Lighting System',
    name_ar: 'نظام إضاءة LED ذكي',
    image_url: null,
    unit_price: 12,
    minimum_order_qty: 1000,
    unit: 'units',
    origin_country: 'China',
    is_active: true,
    category: 'electronics',
    user_profiles: { company_name: 'LightTech Co.', full_name: 'LightTech', country: 'China', role: 'manufacturer' },
    supplier_profiles: { is_verified: true, tier: 'silver' },
  },
  {
    id: 'mock-3',
    name: 'Cotton Fabric Roll',
    name_ar: 'لفة قماش قطني',
    image_url: null,
    unit_price: 3.5,
    minimum_order_qty: 2000,
    unit: 'meters',
    origin_country: 'Turkey',
    is_active: true,
    category: 'textiles',
    user_profiles: { company_name: 'TextileMaster', full_name: 'TextileMaster', country: 'Turkey', role: 'manufacturer' },
    supplier_profiles: { is_verified: false, tier: 'basic' },
  },
  {
    id: 'mock-4',
    name: 'CNC Milling Machine',
    name_ar: 'ماكينة تفريز CNC',
    image_url: null,
    unit_price: 8500,
    minimum_order_qty: 1,
    unit: 'unit',
    origin_country: 'Germany',
    is_active: true,
    category: 'machinery',
    user_profiles: { company_name: 'PrecisionMach GmbH', full_name: 'PrecisionMach', country: 'Germany', role: 'manufacturer' },
    supplier_profiles: { is_verified: true, tier: 'platinum' },
  },
  {
    id: 'mock-5',
    name: 'Organic Olive Oil',
    name_ar: 'زيت زيتون عضوي',
    image_url: null,
    unit_price: 8,
    minimum_order_qty: 500,
    unit: 'liters',
    origin_country: 'Saudi Arabia',
    is_active: true,
    category: 'food',
    user_profiles: { company_name: 'GreenFarm SA', full_name: 'GreenFarm', country: 'Saudi Arabia', role: 'manufacturer' },
    supplier_profiles: { is_verified: true, tier: 'gold' },
  },
  {
    id: 'mock-6',
    name: 'Industrial Chemicals Pack',
    name_ar: 'حزمة مواد كيميائية صناعية',
    image_url: null,
    unit_price: 25,
    minimum_order_qty: 200,
    unit: 'kg',
    origin_country: 'India',
    is_active: true,
    category: 'chemicals',
    user_profiles: { company_name: 'ChemIndia Ltd.', full_name: 'ChemIndia', country: 'India', role: 'manufacturer' },
    supplier_profiles: { is_verified: false, tier: 'basic' },
  },
];

const ProductCard: React.FC<{product: Product; index: number; isInternational?: boolean}> = React.memo(({ product, index, isInternational = false }) => {
  const { t } = useLanguage();
  const cardRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { threshold: 0.05, rootMargin: '40px' }
    );
    if (cardRef.current) observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={cardRef}
      className={`${visible ? 'reveal-animate' : 'opacity-0'}`}
      style={{ animationDelay: `${Math.min(index * 0.06, 0.3)}s` }}
    >
      <MarketplaceProductCard
        product={{
          id: product.id,
          name: product.name,
          name_ar: product.name_ar,
          image_url: product.image_url,
          unit_price: product.unit_price,
          minimum_order_qty: product.minimum_order_qty,
          unit: product.unit,
          origin_country: product.origin_country,
          category: product.category,
          is_verified: product.supplier_profiles?.is_verified ?? false,
          seller_badge: product.seller_badge,
          company_name: product.user_profiles?.company_name || product.user_profiles?.full_name,
          manufacturer_id: product.international_manufacturer_id,
        }}
        buyerMode="b2b"
        index={index}
        priority={index < 2}
      />
    </div>
  );
});

ProductCard.displayName = 'ProductCard';

// ── Placeholder card shown when a slot has no product yet ──────────────────
const PLACEHOLDER_ICONS = [
  'CubeIcon', 'BeakerIcon', 'WrenchScrewdriverIcon', 'TruckIcon', 'SparklesIcon', 'GlobeAltIcon',
] as const;

const PlaceholderCard: React.FC<{ index: number }> = ({ index }) => {
  const { t } = useLanguage();
  const ui = t.featuredProducts;
  const iconName = PLACEHOLDER_ICONS[index % PLACEHOLDER_ICONS.length];
  return (
    <div className="bg-card rounded-2xl overflow-hidden border border-dashed border-border/60 flex flex-col">
      {/* Image area */}
      <div className="aspect-square bg-muted/40 flex flex-col items-center justify-center gap-3 relative">
        <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
          <Icon name={iconName} size={28} className="text-muted-foreground/50" />
        </div>
        {/* Slot number badge */}
        <span className="absolute top-3 right-3 text-[10px] font-bold text-muted-foreground/50 bg-muted px-2 py-0.5 rounded-full">
          #{index + 1}
        </span>
      </div>

      {/* Content area */}
      <div className="p-3 md:p-4 flex flex-col flex-1 justify-between">
        <div className="space-y-2 mb-3">
          {/* Fake title bar */}
          <div className="h-3.5 bg-muted/60 rounded-full w-3/4" />
          <div className="h-3 bg-muted/40 rounded-full w-1/2" />
        </div>

        {/* Placeholder label */}
        <div className="flex flex-col items-center justify-center py-3 text-center gap-1.5">
          <Icon name="PlusCircleIcon" size={20} className="text-muted-foreground/40" />
          <p className="text-[11px] font-semibold text-muted-foreground/60 leading-snug">
            {ui.placeholderSlot}
          </p>
        </div>

        {/* Fake CTA */}
        <div className="h-9 bg-muted/40 rounded-xl w-full mt-1" />
      </div>
    </div>
  );
};

// Build the tab label shown above the product grid
function getTabLabel(tab: SourcingTab, ui: any): string {
  if (tab === 'local_manufacturers') return ui.localManufacturers;
  if (tab === 'local_suppliers') return ui.localSuppliers;
  return ui.globalManufacturers;
}

const FeaturedProducts: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('All');
  const supabase = createClient();
  const { activeTab } = useSourcingFilter();
  const { t, dir, isRTL } = useLanguage();
  const ui = t.featuredProducts;

  const filters = ['All', 'machinery', 'textiles', 'electronics', 'building', 'food', 'chemicals'];
  const filterLabels: Record<string, string> = {
    'All': ui.all,
    'machinery': ui.machinery,
    'textiles': ui.textiles,
    'electronics': ui.electronics,
    'building': ui.building,
    'food': ui.food,
    'chemicals': ui.chemicals,
  };

  useEffect(() => {
    const PRODUCT_SELECT =
      'id, name, name_ar, image_url, unit_price, minimum_order_qty, unit, origin_country, is_active, category, seller_badge, international_manufacturer_id, user_profiles!manufacturer_products_manufacturer_id_fkey(company_name, full_name, country, role, supplier_profiles(is_verified, tier))';

    const normalizeProducts = (rows: any[]): Product[] =>
      (rows || []).map((row) => {
        const profile = Array.isArray(row.user_profiles) ? row.user_profiles[0] : row.user_profiles;
        const supplierRaw = profile?.supplier_profiles;
        const supplier = Array.isArray(supplierRaw) ? supplierRaw[0] : supplierRaw;
        return {
          ...row,
          user_profiles: profile
            ? {
                company_name: profile.company_name,
                full_name: profile.full_name,
                country: profile.country,
                role: profile.role,
              }
            : undefined,
          supplier_profiles: supplier
            ? { is_verified: !!supplier.is_verified, tier: supplier.tier || 'basic' }
            : undefined,
        } as Product;
      });

    const fetchProducts = async () => {
      setLoading(true);
      try {
        let query = supabase
          .from('manufacturer_products')
          .select(PRODUCT_SELECT)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(6);

        if (activeFilter !== 'All') {
          query = query.eq('category', activeFilter);
        }

        // ── Dynamic Supabase filter based on active sourcing tab ──
        if (activeTab === 'local_manufacturers') {
          // Local origin + manufacturer role
          query = query
            .in('origin_country', LOCAL_COUNTRY_IDENTIFIERS)
            .eq('user_profiles.role', 'manufacturer');
        } else if (activeTab === 'local_suppliers') {
          // Local origin + supplier role (non-manufacturer)
          query = query
            .in('origin_country', LOCAL_COUNTRY_IDENTIFIERS)
            .eq('user_profiles.role', 'supplier');
        } else if (activeTab === 'global_manufacturers') {
          // NOT local origin — international manufacturers
          // PostgREST not.in syntax: values as comma-separated list in parentheses
          query = query.not('origin_country', 'in', `(${LOCAL_COUNTRY_IDENTIFIERS.join(',')})`);
        }

        const { data, error } = await query;
        if (error) throw error;

        // Client-side fallback filter for local tabs if DB role filter returns empty
        // (handles cases where role is stored differently)
        let result = normalizeProducts(data || []);
        if (result.length === 0 && (activeTab === 'local_manufacturers' || activeTab === 'local_suppliers')) {
          // Fallback: just filter by local origin without role constraint
          let fallbackQuery = supabase
            .from('manufacturer_products')
            .select(PRODUCT_SELECT)
            .eq('is_active', true)
            .in('origin_country', LOCAL_COUNTRY_IDENTIFIERS)
            .order('created_at', { ascending: false })
            .limit(6);
          if (activeFilter !== 'All') {
            fallbackQuery = fallbackQuery.eq('category', activeFilter);
          }
          const { data: fallbackData } = await fallbackQuery;
          result = normalizeProducts(fallbackData || []);
        }

        setProducts(result.length > 0 ? result : MOCK_PRODUCTS);
      } catch {
        setProducts(MOCK_PRODUCTS);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, [activeFilter, activeTab]);

  const tabLabel = getTabLabel(activeTab, ui);

  return (
    <section dir={dir} className="bg-background py-12 md:py-16 border-b border-border">
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-5 mb-8 md:mb-10">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground block mb-3">
              01 — {ui.title}
            </span>
            <h2 className="text-section-title font-extrabold text-foreground">
              {tabLabel}<br />
              <span className="text-muted-foreground font-light italic">
                {ui.factoryDirect}
              </span>
            </h2>
          </div>

          {/* ── Category filters (appear directly under section title) ── */}
          <div className="flex flex-wrap gap-2 overflow-x-auto hide-scrollbar">
            {filters.map((f) => (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={`px-4 py-2 text-xs font-bold rounded-full border transition-colors whitespace-nowrap ${
                  activeFilter === f
                    ? 'bg-foreground text-primary-foreground border-foreground'
                    : 'bg-background text-muted-foreground border-border hover:border-foreground hover:text-foreground'
                }`}>
                {filterLabels[f] || f}
              </button>
            ))}
          </div>
        </div>

        {/* Products Grid */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-card rounded-2xl border border-border overflow-hidden animate-pulse">
                <div className="aspect-square bg-muted" />
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                  <div className="h-8 bg-muted rounded mt-3" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Always render 6 slots: real products first, then placeholders */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
              {Array.from({ length: 6 }).map((_, index) => {
                const product = products[index];
                return product ? (
                  <ProductCard key={product.id} product={product} index={index} isInternational={activeTab === 'global_manufacturers'} />
                ) : (
                  <PlaceholderCard key={`placeholder-${index}`} index={index} />
                );
              })}
            </div>

            {/* Invite-to-upload banner — shown only when there are empty slots */}
            {products.length < 6 && (
              <div className="mt-6 flex items-center gap-4 px-5 py-4 bg-muted/40 border border-dashed border-border rounded-2xl">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon name="RocketLaunchIcon" size={20} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground">
                    {ui.areYouManufacturer}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
{ui.slotsAvailable.replace('{count}', String(6 - products.length))}
                  </p>
                </div>
                <Link
                  href="/factory/upload"
                  className="shrink-0 px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-xl whitespace-nowrap hover:opacity-90 transition-opacity">
                  {ui.uploadProduct}
                </Link>
              </div>
            )}
          </>
        )}

        {/* View all link */}
        <div className="flex justify-center mt-8">
          <Link
            href="/search"
            className="inline-flex items-center gap-2 px-6 py-3 border border-border text-sm font-semibold text-foreground rounded-xl hover:bg-muted transition-colors"
          >
            {ui.viewAll}
            <Icon name="ArrowRightIcon" size={16} />
          </Link>
        </div>
      </div>
    </section>
  );
};

export default FeaturedProducts;