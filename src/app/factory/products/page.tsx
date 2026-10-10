'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import Icon from '@/components/ui/AppIcon';
import { useLanguage } from '@/contexts/LanguageContext';

interface FactoryProduct {
  id: string;
  name: string;
  name_ar: string;
  name_zh?: string;
  name_tr?: string;
  description: string;
  description_ar: string;
  description_zh?: string;
  description_tr?: string;
  category: string;
  sku: string;
  unit: string;
  unit_price: number;
  minimum_order_qty: number;
  stock_quantity: number;
  inventory_status: string;
  origin_country: string;
  factory_type: 'local' | 'international';
  certifications: string[];
  hs_code: string;
  lead_time_days: number;
  sample_available: boolean;
  sample_price: number;
  is_active: boolean;
  created_at: string;
  manufacturer_id: string;
  specifications_en: Record<string, string>;
  specifications_ar: Record<string, string>;
  user_profiles?: {
    full_name: string;
    company_name: string;
  };
}

const STATUS_COLORS: Record<string, string> = {
  in_stock: 'bg-green-100 text-green-700',
  low_stock: 'bg-yellow-100 text-yellow-700',
  out_of_stock: 'bg-red-100 text-red-700',
  discontinued: 'bg-gray-100 text-gray-600',
};

export default function FactoryProductsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { t, language, isRTL } = useLanguage();
  const supabase = createClient();

  const [products, setProducts] = useState<FactoryProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterType, setFilterType] = useState<'all' | 'local' | 'international'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'priority' | 'price_asc' | 'price_desc' | 'newest'>('priority');

  // Debounce search to avoid firing a query on every keystroke
  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError('');
    const controller = new AbortController();
    try {
      let query = supabase
        .from('manufacturer_products')
        .select(
          'id, name, name_ar, name_zh, name_tr, description, description_ar, description_zh, description_tr, category, sku, unit, unit_price, minimum_order_qty, stock_quantity, inventory_status, origin_country, factory_type, certifications, hs_code, lead_time_days, sample_available, sample_price, is_active, created_at, manufacturer_id'
        )
        .eq('is_active', true)
        .limit(200);

      if (filterCategory !== 'all') {
        query = query.eq('category', filterCategory);
      }
      if (filterType !== 'all') {
        query = query.eq('factory_type', filterType);
      }
      if (searchQuery.trim()) {
        query = query.or(`name.ilike.%${searchQuery.trim()}%,name_ar.ilike.%${searchQuery.trim()}%`);
      }

      // Apply server-side ordering where possible
      if (sortBy === 'price_asc') {
        query = query.order('unit_price', { ascending: true });
      } else if (sortBy === 'price_desc') {
        query = query.order('unit_price', { ascending: false });
      } else if (sortBy === 'newest') {
        query = query.order('created_at', { ascending: false });
      } else {
        // priority: local first, then newest — fetch and sort client-side
        query = query.order('created_at', { ascending: false });
      }

      const { data, error: fetchErr } = await query;
      if (fetchErr) throw fetchErr;

      let sorted = data || [];

      if (sortBy === 'priority') {
        sorted = sorted.sort((a, b) => {
          const aLocal = a.factory_type === 'local' ? 1 : 0;
          const bLocal = b.factory_type === 'local' ? 1 : 0;
          if (aLocal !== bLocal) return bLocal - aLocal;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
      }

      setProducts(sorted);
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        setError(err.message || 'Failed to load factory products.');
      }
    } finally {
      setLoading(false);
    }
    return () => controller.abort();
  }, [filterCategory, filterType, debouncedSearch, sortBy, supabase]);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login?redirect=/factory/products');
  }, [user, authLoading, router]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const localCount = products.filter((p) => p.factory_type === 'local').length;
  const intlCount = products.filter((p) => p.factory_type === 'international').length;

  const getProductName = (product: FactoryProduct): string => {
    if (language === 'ar' && product.name_ar) return product.name_ar;
    if (language === 'zh' && product.name_zh) return product.name_zh;
    if (language === 'tr' && product.name_tr) return product.name_tr;
    return product.name;
  };

  const getProductDescription = (product: FactoryProduct): string => {
    if (language === 'ar' && product.description_ar) return product.description_ar;
    if (language === 'zh' && product.description_zh) return product.description_zh;
    if (language === 'tr' && product.description_tr) return product.description_tr;
    return product.description;
  };

  const getCategoryLabel = (cat: string) =>
    t.categories[cat as keyof typeof t.categories] || cat;

  const getStatusLabel = (status: string) =>
    t.status[status as keyof typeof t.status] || status.replace('_', ' ');

  return (
    <div className="min-h-screen bg-background" dir={isRTL ? 'rtl' : 'ltr'}>
      <Header />
      <main className="max-w-7xl mx-auto px-4 md:px-6 py-6 pb-28 md:pb-12">

        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl font-bold text-foreground">{t.factoryProducts.title}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {t.factoryProducts.subtitle}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {user && (
              <Link
                href="/factory/register"
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg active:opacity-80 transition-opacity"
              >
                <Icon name="PlusIcon" size={15} /> {t.factoryProducts.registerFactory}
              </Link>
            )}
          </div>
        </div>

        {/* Stats bar */}
        <div className="flex items-center gap-4 mb-5 p-3 bg-card border border-border rounded-xl">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{localCount}</span> {t.factoryProducts.local}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{intlCount}</span> {t.factoryProducts.international}
            </span>
          </div>
          <div className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
            <Icon name="StarIcon" size={12} className="text-primary" />
            {t.factoryProducts.localFirst}
          </div>
        </div>

        {/* Filters */}
        <div className="bg-card border border-border rounded-xl p-4 mb-5 flex flex-wrap gap-3 items-center">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Icon name="MagnifyingGlassIcon" size={15} className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-muted-foreground`} />
              <input
                type="text"
                placeholder={t.factoryProducts.searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full h-9 ${isRTL ? 'pr-9 pl-4' : 'pl-9 pr-4'} rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary transition-colors`}
              />
            </div>
          </div>

          {/* Factory type filter */}
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            {(['all', 'local', 'international'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors capitalize ${filterType === type ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {type === 'all' ? t.factoryProducts.all : type === 'local' ? t.factoryProducts.localLabel : t.factoryProducts.internationalLabel}
              </button>
            ))}
          </div>

          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="h-9 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary transition-colors"
          >
            <option value="all">{t.factoryProducts.allCategories}</option>
            {Object.entries(t.categories).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="h-9 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary transition-colors"
          >
            <option value="priority">{t.factoryProducts.sortLocalFirst}</option>
            <option value="newest">{t.factoryProducts.sortNewest}</option>
            <option value="price_asc">{t.factoryProducts.sortPriceLow}</option>
            <option value="price_desc">{t.factoryProducts.sortPriceHigh}</option>
          </select>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm flex items-center gap-2 mb-4">
            <Icon name="ExclamationCircleIcon" size={16} /> {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Icon name="ArrowPathIcon" size={28} className="animate-spin text-primary" />
          </div>
        ) : products.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-12 text-center">
            <div className="w-14 h-14 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Icon name="BuildingOffice2Icon" size={26} className="text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-foreground mb-1">{t.factoryProducts.noProductsFound}</h3>
            <p className="text-sm text-muted-foreground mb-5">
              {searchQuery || filterCategory !== 'all' || filterType !== 'all'
                ? t.factoryProducts.tryAdjusting
                : t.factoryProducts.beFirst}
            </p>
            {user && (
              <Link href="/factory/register" className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg">
                <Icon name="PlusIcon" size={15} /> {t.factoryProducts.registerYourFactory}
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {products.map((product) => {
              const isLocal = product.factory_type === 'local';
              return (
                <div
                  key={product.id}
                  className="bg-card border border-border rounded-2xl overflow-hidden hover:shadow-md hover:border-primary/30 transition-all group"
                >
                  {/* Type badge */}
                  <div className="px-4 pt-4 pb-0 flex items-center justify-between">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${isLocal ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                      {isLocal ? t.factoryProducts.localLabel : t.factoryProducts.internationalLabel}
                    </span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[product.inventory_status] || 'bg-gray-100 text-gray-600'}`}>
                      {getStatusLabel(product.inventory_status)}
                    </span>
                  </div>

                  <div className="p-4">
                    <h3 className="font-semibold text-foreground text-sm leading-tight mb-1 line-clamp-2 group-hover:text-primary transition-colors">
                      {getProductName(product)}
                    </h3>
                    {/* Show English name as secondary when viewing in another language */}
                    {language !== 'en' && product.name && (
                      <p className="text-xs text-muted-foreground mb-1 line-clamp-1">{product.name}</p>
                    )}
                    {language === 'en' && product.name_ar && (
                      <p className="text-xs text-muted-foreground mb-1 line-clamp-1" dir="rtl">{product.name_ar}</p>
                    )}
                    {getProductDescription(product) && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{getProductDescription(product)}</p>
                    )}

                    <div className="space-y-1.5 mb-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{t.factoryProducts.category}</span>
                        <span className="text-foreground font-medium">{getCategoryLabel(product.category)}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{t.factoryProducts.origin}</span>
                        <span className="text-foreground font-medium">{product.origin_country || '—'}</span>
                      </div>
                      {product.lead_time_days > 0 && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">{t.factoryProducts.leadTime}</span>
                          <span className="text-foreground font-medium">{product.lead_time_days} {t.factoryProducts.days}</span>
                        </div>
                      )}
                      {product.hs_code && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">{t.factoryProducts.hsCode}</span>
                          <span className="font-mono text-foreground">{product.hs_code}</span>
                        </div>
                      )}
                    </div>

                    {/* Certifications */}
                    {Array.isArray(product.certifications) && product.certifications.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {product.certifications.slice(0, 3).map((cert) => (
                          <span key={cert} className="px-1.5 py-0.5 bg-muted text-muted-foreground text-xs rounded font-medium">{cert}</span>
                        ))}
                        {product.certifications.length > 3 && (
                          <span className="px-1.5 py-0.5 bg-muted text-muted-foreground text-xs rounded font-medium">+{product.certifications.length - 3}</span>
                        )}
                      </div>
                    )}

                    <div className="flex items-end justify-between pt-2 border-t border-border">
                      <div>
                        <p className="text-lg font-bold text-foreground">${product.unit_price.toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground">
                          {t.factoryProducts.per} {product.unit} · {t.factoryProducts.moq}: {product.minimum_order_qty}
                        </p>
                      </div>
                      {product.sample_available && (
                        <span className="text-xs text-primary font-medium">{t.factoryProducts.sampleAvailable}</span>
                      )}
                    </div>

                    {/* Supplier info */}
                    {product.user_profiles && (
                      <div className="mt-3 pt-3 border-t border-border flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                          {(product.user_profiles.company_name || product.user_profiles.full_name || 'F').charAt(0).toUpperCase()}
                        </div>
                        <span className="text-xs text-muted-foreground truncate">
                          {product.user_profiles.company_name || product.user_profiles.full_name}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
