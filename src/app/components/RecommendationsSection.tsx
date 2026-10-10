'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';

interface RecommendedProduct {
  id: string;
  name: string;
  name_ar: string;
  image_url: string | null;
  unit_price: number;
  unit: string;
  minimum_order_qty: number;
  category: string;
  origin_country: string;
}

interface SearchHistory {
  category: string;
  query: string;
}

const RecommendationsSection: React.FC = () => {
  const { user } = useAuth();
  const { isRTL, language } = useLanguage();
  const supabase = createClient();

  const [recommended, setRecommended] = useState<RecommendedProduct[]>([]);
  const [trending, setTrending] = useState<RecommendedProduct[]>([]);
  const [searchHistory, setSearchHistory] = useState<SearchHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<'recommended' | 'trending'>('recommended');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Get search history from localStorage
        let rawHistory: SearchHistory[] = [];
        try {
          rawHistory = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('dh_search_history') || '[]')
            : [];
          if (!Array.isArray(rawHistory)) rawHistory = [];
        } catch {
          rawHistory = [];
        }
        setSearchHistory(rawHistory.slice(0, 5));

        // Determine categories from search history or wishlist
        let targetCategories: string[] = rawHistory
          .map((h: SearchHistory) => h.category)
          .filter(Boolean)
          .slice(0, 3);

        // If user is logged in, also check wishlist for category hints
        if (user && targetCategories.length === 0) {
          const { data: wishlistData } = await supabase
            .from('wishlists')
            .select('product:manufacturer_products(category)')
            .eq('user_id', user.id)
            .eq('item_type', 'product')
            .limit(5);

          if (wishlistData) {
            targetCategories = wishlistData
              .map((w: any) => w.product?.category)
              .filter(Boolean)
              .slice(0, 3);
          }
        }

        // Fetch recommended products based on categories
        let recQuery = supabase
          .from('manufacturer_products')
          .select('id, name, name_ar, image_url, unit_price, unit, minimum_order_qty, category, origin_country')
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(8);

        if (targetCategories.length > 0) {
          recQuery = recQuery.in('category', targetCategories);
        }

        const { data: recData } = await recQuery;

        // If no category-specific results, fall back to latest
        if (!recData || recData.length < 4) {
          const { data: fallback } = await supabase
            .from('manufacturer_products')
            .select('id, name, name_ar, image_url, unit_price, unit, minimum_order_qty, category, origin_country')
            .eq('is_active', true)
            .order('created_at', { ascending: false })
            .limit(8);
          setRecommended(fallback || []);
        } else {
          setRecommended(recData);
        }

        // Fetch trending (most recently added, different from recommended)
        const { data: trendData } = await supabase
          .from('manufacturer_products')
          .select('id, name, name_ar, image_url, unit_price, unit, minimum_order_qty, category, origin_country')
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(8);
        setTrending(trendData || []);
      } catch {
        setRecommended([]);
        setTrending([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const displayProducts = activeSection === 'recommended' ? recommended : trending;

  if (loading) {
    return (
      <section className="bg-muted/20 py-12 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <div className="h-6 w-48 bg-muted animate-pulse rounded mb-6" />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-muted animate-pulse rounded-xl h-52" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (displayProducts.length === 0 && searchHistory.length === 0) return null;

  return (
    <section className="bg-muted/20 py-12 border-b border-border">
      <div className="max-w-7xl mx-auto px-4 md:px-6">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-7">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground block mb-2">
              {isRTL ? 'مقترحات لك' : 'Picked For You'}
            </span>
            <h2 className="text-xl md:text-2xl font-extrabold text-foreground">
              {isRTL ? 'توصيات ومفضلات' : 'Recommendations & Favorites'}
              <br />
              <span className="text-muted-foreground font-light italic text-base">
                {isRTL ? 'بناءً على اهتماماتك' : 'Based on your interests.'}
              </span>
            </h2>
          </div>

          {/* Tab switcher */}
          <div className="flex items-center gap-1 bg-muted rounded-full p-1 self-start md:self-auto">
            <button
              onClick={() => setActiveSection('recommended')}
              className={`px-4 py-1.5 text-xs font-bold rounded-full transition-all ${
                activeSection === 'recommended' ?'bg-foreground text-primary-foreground shadow-sm' :'text-muted-foreground hover:text-foreground'
              }`}
            >
              {isRTL ? 'مقترحة' : 'Recommended'}
            </button>
            <button
              onClick={() => setActiveSection('trending')}
              className={`px-4 py-1.5 text-xs font-bold rounded-full transition-all ${
                activeSection === 'trending' ?'bg-foreground text-primary-foreground shadow-sm' :'text-muted-foreground hover:text-foreground'
              }`}
            >
              {isRTL ? 'الأحدث' : 'Trending'}
            </button>
          </div>
        </div>

        {/* Search history chips */}
        {searchHistory.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            <span className="text-xs text-muted-foreground flex items-center gap-1 mr-1">
              <Icon name="ClockIcon" size={12} />
              {isRTL ? 'بحثت مؤخراً:' : 'Recent searches:'}
            </span>
            {searchHistory.map((h, i) => (
              <Link
                key={i}
                href={`/search?q=${encodeURIComponent(h.query || h.category)}&category=${h.category || ''}`}
                className="px-3 py-1 text-xs font-medium bg-background border border-border rounded-full text-foreground hover:border-primary hover:text-primary transition-colors"
              >
                {h.query || h.category}
              </Link>
            ))}
          </div>
        )}

        {/* Products grid */}
        {displayProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <Icon name="HeartIcon" size={24} className="text-muted-foreground" />
            </div>
            <p className="text-sm font-semibold text-foreground mb-1">
              {isRTL ? 'لا توجد توصيات بعد' : 'No recommendations yet'}
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              {isRTL ? 'ابدأ بتصفح المنتجات لنقترح عليك ما يناسبك' : 'Browse products to get personalized suggestions'}
            </p>
            <Link
              href="/search"
              className="px-5 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-full"
            >
              {isRTL ? 'استكشف المنتجات' : 'Explore Products'}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 md:gap-4">
            {displayProducts.map((product, i) => (
              <Link
                key={product.id}
                href={`/product/${product.id}`}
                className="group bg-card rounded-2xl overflow-hidden border border-border hover:border-primary/40 hover:shadow-md transition-all duration-200"
                style={{ animationDelay: `${i * 0.05}s` }}
              >
                {/* Image */}
                <div className="relative aspect-square bg-muted overflow-hidden">
                  <AppImage
                    src={product.image_url || '/assets/images/no_image.png'}
                    alt={product.name}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                    sizes="(max-width: 640px) 50vw, 25vw"
                  />
                  <div className="absolute top-2 left-2 px-2 py-0.5 bg-foreground/70 text-primary-foreground text-[9px] font-semibold rounded-md capitalize">
                    {product.category?.replace(/_/g, ' ')}
                  </div>
                </div>

                {/* Info */}
                <div className="p-3">
                  <h3 className="text-xs font-bold text-foreground truncate mb-1">
                    {language === 'ar' && product.name_ar ? product.name_ar : product.name}
                  </h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-sm font-extrabold text-foreground">${Number(product.unit_price || 0).toFixed(2)}</span>
                    <span className="text-[10px] text-muted-foreground">/ {product.unit}</span>
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    <Icon name="CubeIcon" size={10} className="text-primary" />
                    <span className="text-[10px] text-primary font-semibold">
                      MOQ: {Number(product.minimum_order_qty || 0)}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* View more */}
        {displayProducts.length > 0 && (
          <div className="flex justify-center mt-8">
            <Link
              href="/search"
              className="inline-flex items-center gap-2 px-6 py-3 bg-foreground text-primary-foreground text-sm font-bold rounded-full hover:opacity-80 transition-opacity"
            >
              {isRTL ? 'عرض المزيد' : 'View More'}
              <Icon name="ArrowRightIcon" size={16} />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
};

export default RecommendationsSection;
