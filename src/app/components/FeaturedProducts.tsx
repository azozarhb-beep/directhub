'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { useSourcingFilter, SourcingTab } from '@/contexts/SourcingFilterContext';
import { useLanguage } from '@/contexts/LanguageContext';
import MarketplaceProductCard from '@/components/MarketplaceProductCard';
import { pickFactoryName } from '@/lib/catalogDisplay';

interface Product {
  id: string;
  name: string;
  name_ar: string;
  image_url: string | null;
  unit_price: number;
  tiered_pricing?: unknown;
  minimum_order_qty: number;
  unit: string;
  origin_country: string;
  is_active: boolean;
  category: string;
  seller_badge?: 'certified_factory' | 'local_supplier' | null;
  international_manufacturer_id?: string | null;
  origin_type?: 'local' | 'international' | null;
  user_profiles?: { company_name: string; full_name: string; country: string; role: string; };
  supplier_profiles?: { is_verified: boolean; tier: string; };
}

const ProductCard: React.FC<{ product: Product; index: number; isInternational?: boolean; }> = React.memo(({ product, index, isInternational = false }) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
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
          tiered_pricing: product.tiered_pricing,
          minimum_order_qty: product.minimum_order_qty,
          unit: product.unit,
          origin_country: product.origin_country,
          category: product.category,
          is_verified: product.supplier_profiles?.is_verified ?? true,
          seller_badge: product.seller_badge,
          company_name: pickFactoryName(product.user_profiles?.company_name, product.user_profiles?.full_name) || undefined,
          manufacturer_id: product.international_manufacturer_id,
          origin_type: product.origin_type ?? (isInternational ? 'international' : 'local')
        }}
        buyerMode="b2b"
        index={index}
        priority={index < 2}
      />
    </div>
  );
});

ProductCard.displayName = 'ProductCard';

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
    'chemicals': ui.chemicals
  };

  useEffect(() => {
    const PRODUCT_SELECT =
      'id, name, name_ar, image_url, unit_price, tiered_pricing, minimum_order_qty, unit, origin_country, origin_type, is_active, category, seller_badge, international_manufacturer_id, user_profiles!manufacturer_products_manufacturer_id_fkey(company_name, full_name, country, role, supplier_profiles(is_verified, tier))';

    const normalizeProducts = (rows: any[]): Product[] =>
      (rows || []).map((row) => {
        const profile = Array.isArray(row.user_profiles) ? row.user_profiles[0] : row.user_profiles;
        const supplierRaw = profile?.supplier_profiles;
        const supplier = Array.isArray(supplierRaw) ? supplierRaw[0] : supplierRaw;
        return {
          ...row,
          user_profiles: profile ? {
            company_name: profile.company_name,
            full_name: profile.full_name,
            country: profile.country,
            role: profile.role
          } : undefined,
          supplier_profiles: supplier ? {
            is_verified: !!supplier.is_verified,
            tier: supplier.tier || 'basic'
          } : undefined
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
          .limit(10);

        if (activeFilter !== 'All') {
          query = query.eq('category', activeFilter);
        }

        // تطبيق الفرز الأساسي للتبويبات
        if (activeTab === 'local_manufacturers' || activeTab === 'local_suppliers') {
          query = query.eq('origin_type', 'local');
        } else if (activeTab === 'global_manufacturers') {
          query = query.eq('origin_type', 'international');
        }

        const { data, error } = await query;
        if (error) throw error;

        let result = normalizeProducts(data || []);

        // إذا كان التبويب لا يحتوي على منتجات محددة، استدعِ البضائع النشطة مباشرة لضمان امتلاء الصفحة
        if (result.length === 0) {
          let fallbackQuery = supabase
            .from('manufacturer_products')
            .select(PRODUCT_SELECT)
            .eq('is_active', true)
            .order('created_at', { ascending: false })
            .limit(10);

          if (activeFilter !== 'All') {
            fallbackQuery = fallbackQuery.eq('category', activeFilter);
          }

          const { data: fallbackData } = await fallbackQuery;
          result = normalizeProducts(fallbackData || []);
        }

        setProducts(result);
      } catch (err) {
        // خطة طوارئ: جلب مباشر للمنتجات بدون أي قيود ربط
        try {
          const { data: safeData } = await supabase
            .from('manufacturer_products')
            .select('id, name, name_ar, image_url, unit_price, minimum_order_qty, unit, origin_country, origin_type, category, is_active')
            .eq('is_active', true)
            .limit(10);

          setProducts((safeData as Product[]) || []);
        } catch {
          setProducts([]);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [activeFilter, activeTab]);

  const tabLabel = getTabLabel(activeTab, ui);

  return (
    <section dir={dir} className="bg-background py-8 md:py-12 border-b border-border">
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground block mb-2">
              01 — {ui.title}
            </span>
            <h2 className="text-lg md:text-xl font-extrabold text-foreground">
              {tabLabel} · <span className="text-muted-foreground font-light text-base">{ui.factoryDirect}</span>
            </h2>
          </div>

          {/* فلاتر التصنيف */}
          <div className="flex flex-wrap gap-1.5 overflow-x-auto hide-scrollbar">
            {filters.map((f) => (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={`px-3 py-1.5 text-xs font-bold rounded-full border transition-colors whitespace-nowrap ${
                  activeFilter === f
                    ? 'bg-foreground text-background border-foreground'
                    : 'bg-background text-muted-foreground border-border hover:border-foreground hover:text-foreground'
                }`}
              >
                {filterLabels[f] || f}
              </button>
            ))}
          </div>
        </div>

        {/* شبكة المنتجات */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-card rounded-2xl border border-border overflow-hidden animate-pulse">
                <div className="aspect-square bg-muted" />
                <div className="p-3 space-y-2">
                  <div className="h-3.5 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                  <div className="h-7 bg-muted rounded mt-2" />
                </div>
              </div>
            ))}
          </div>
        ) : products.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
            {products.map((product, index) => (
              <ProductCard
                key={product.id}
                product={product}
                index={index}
                isInternational={activeTab === 'global_manufacturers' || product.origin_type === 'international'}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center bg-muted/20 border border-border/50 rounded-2xl">
            <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-3">
              <Icon name="CubeIcon" size={24} className="text-muted-foreground/60" />
            </div>
            <p className="text-sm font-bold text-foreground">
              {isRTL ? 'تصفح كافة منتجات الكتالوج' : 'Browse All Catalog Products'}
            </p>
            <p className="text-xs text-muted-foreground mt-1 mb-4">
              {isRTL ? 'يمكنك استعراض جميع البضائع المتاحة عبر محرك البحث' : 'Explore all available goods in the marketplace'}
            </p>
            <Link
              href="/search"
              className="px-5 py-2 bg-foreground text-background text-xs font-bold rounded-xl hover:opacity-90 transition-opacity"
            >
              {isRTL ? 'تصفح الكتالوج الشامل' : 'View All Products'}
            </Link>
          </div>
        )}

        {/* زر عرض المزيد */}
        <div className="flex justify-center mt-8">
          <Link
            href="/search"
            className="inline-flex items-center gap-2 px-5 py-2.5 border border-border text-xs font-semibold text-foreground rounded-xl hover:bg-muted transition-colors"
          >
            {ui.viewAll}
            <Icon name="ArrowRightIcon" size={14} className={isRTL ? 'rotate-180' : ''} />
          </Link>
        </div>
      </div>
    </section>
  );
};

export default FeaturedProducts;
