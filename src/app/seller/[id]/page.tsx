'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import WishlistButton from '@/components/WishlistButton';
import { useLanguage } from '@/contexts/LanguageContext';

interface SellerProfile {
  id: string;
  full_name: string;
  company_name: string;
  country: string;
  city?: string;
  role: string;
  seller_category?: string;
  avatar_url?: string;
  created_at: string;
  established_year?: number | null;
}

interface Product {
  id: string;
  name: string;
  name_ar?: string;
  unit_price: number;
  currency?: string;
  unit: string;
  minimum_order_qty: number;
  inventory_status: string;
  category: string;
  origin_country?: string;
  image_url?: string;
  avg_rating?: number;
  review_count?: number;
  is_active: boolean;
}

interface Review {
  id: string;
  rating: number;
  title: string;
  body: string;
  created_at: string;
  reviewer_name?: string;
}

const CATEGORY_CONFIG: Record<string, { labelKey: 'certifiedFactory' | 'localSupplier'; icon: string; color: string }> = {
  local_factory: { labelKey: 'certifiedFactory', icon: '🏭', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  international_factory: { labelKey: 'certifiedFactory', icon: '🏭', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  local_supplier: { labelKey: 'localSupplier', icon: '🚚', color: 'bg-violet-50 text-violet-700 border-violet-200' },
};

function StarDisplay({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Icon
          key={s}
          name="StarIcon"
          size={size}
          variant="solid"
          className={s <= Math.round(value) ? 'text-amber-400' : 'text-muted'}
        />
      ))}
    </div>
  );
}

// ─── Mobile Product Card ──────────────────────────────────────────────────────
function MobileProductCard({ product }: { product: Product }) {
  const { t } = useLanguage();
  const sp = t.sellerProfile;
  const imageUrl = product.image_url || 'https://img.rocket.new/generatedImages/rocket_gen_img_1e59a0c95-1772134956918.png';
  const statusColor =
    product.inventory_status === 'in_stock' ?'bg-green-50 text-green-700'
      : product.inventory_status === 'low_stock' ?'bg-amber-50 text-amber-700' :'bg-red-50 text-red-700';
  const statusLabel =
    product.inventory_status === 'in_stock' ? sp.inStock : product.inventory_status === 'low_stock' ? sp.lowStock : sp.outOfStock;

  return (
    <Link
      href={`/product/${product.id}`}
      className="bg-card border border-border rounded-2xl overflow-hidden hover:border-primary/30 hover:shadow-md transition-all duration-200 group flex flex-col active:scale-[0.98]"
    >
      {/* Product image */}
      <div className="relative aspect-[4/3] bg-muted overflow-hidden">
        <img
          src={imageUrl}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />
        <div className="absolute top-2 right-2">
          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${statusColor}`}>{statusLabel}</span>
        </div>
      </div>

      <div className="p-3 flex flex-col flex-1">
        <h3 className="text-sm font-bold text-foreground mb-0.5 line-clamp-2 group-hover:text-primary transition-colors">
          {product.name}
        </h3>
        {product.name_ar && (
          <p className="text-xs text-muted-foreground mb-1.5 line-clamp-1 text-right" dir="rtl">{product.name_ar}</p>
        )}
        <div className="flex items-center justify-between mt-auto pt-2 border-t border-border">
          <div>
            <p className="text-base font-extrabold text-primary">
              {product.unit_price.toLocaleString()} <span className="text-xs font-medium">{String(product.currency || 'YER').toUpperCase() === 'USD' ? '$' : 'ر.ي'}</span>
            </p>
            <p className="text-[10px] text-muted-foreground">{sp.per} {product.unit} · {sp.moq} {product.minimum_order_qty}</p>
          </div>
          {(product.avg_rating || 0) > 0 && (
            <div className="flex items-center gap-1">
              <Icon name="StarIcon" size={12} variant="solid" className="text-amber-400" />
              <span className="text-xs font-semibold text-foreground">{(product.avg_rating || 0).toFixed(1)}</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

export default function SellerPublicProfilePage() {
  const { t, dir } = useLanguage();
  const sp = t.sellerProfile;
  const params = useParams();
  const id = typeof params?.id === 'string' ? params.id : '';
  const { user } = useAuth();
  const supabase = createClient();

  const [seller, setSeller] = useState<SellerProfile | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [avgRating, setAvgRating] = useState(0);
  const [totalReviews, setTotalReviews] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'products' | 'reviews'>('products');

  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const { data: profileData } = await supabase
        .from('user_profiles')
        .select('id, full_name, company_name, country, role, seller_category, avatar_url, created_at')
        .eq('id', id)
        .single();

      if (profileData) {
        // Also fetch established_year from factory_registrations
        const { data: regData } = await supabase
          .from('factory_registrations')
          .select('established_year')
          .eq('user_id', id)
          .maybeSingle();
        setSeller({ ...profileData, established_year: regData?.established_year ?? null });
      }

      const { data: productsData } = await supabase
        .from('manufacturer_products')
        .select('id, name, name_ar, unit_price, currency, unit, minimum_order_qty, inventory_status, category, origin_country, image_url, avg_rating, review_count, is_active')
        .eq('manufacturer_id', id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(12);

      if (productsData) setProducts(productsData);

      const { data: reviewsData } = await supabase
        .from('product_reviews')
        .select('id, rating, title, body, created_at, reviewer_id')
        .eq('factory_id', id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (reviewsData && reviewsData.length > 0) {
        const avg = reviewsData.reduce((s: number, r: any) => s + r.rating, 0) / reviewsData.length;
        setAvgRating(avg);
        setTotalReviews(reviewsData.length);
        setReviews(reviewsData.map((r: any) => ({ ...r, reviewer_name: sp.verifiedBuyer })));
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background" dir={dir}>
        <Header />
        <div className="flex items-center justify-center py-32">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
        <BottomNav />
      </div>
    );
  }

  if (!seller) {
    return (
      <div className="min-h-screen bg-background" dir={dir}>
        <Header />
        <div className="max-w-3xl mx-auto px-4 py-20 text-center">
          <h1 className="text-xl font-bold text-foreground mb-3">{sp.notFound}</h1>
          <Link href="/suppliers" className="text-primary text-sm font-semibold hover:underline">
            {sp.browseSuppliers}
          </Link>
        </div>
        <BottomNav />
      </div>
    );
  }

  const catKey = seller.seller_category || 'local_factory';
  const catCfg = CATEGORY_CONFIG[catKey] || CATEGORY_CONFIG.local_factory;
  const initials = (seller.company_name || seller.full_name || 'S').split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase();
  const memberSince = new Date(seller.created_at).getFullYear();

  return (
    <div className="min-h-screen bg-background flex flex-col" dir={dir}>
      <Header />

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 md:px-6 py-4 md:py-6 pb-36 md:pb-10">
        {/* Breadcrumb — hidden on mobile to save space */}
        <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground mb-5">
          <Link href="/" className="hover:text-foreground transition-colors">{sp.home}</Link>
          <Icon name="ChevronRightIcon" size={12} />
          <Link href="/suppliers" className="hover:text-foreground transition-colors">{sp.sellers}</Link>
          <Icon name="ChevronRightIcon" size={12} />
          <span className="text-foreground font-medium truncate">{seller.company_name || seller.full_name}</span>
        </div>

        {/* ── Hero Banner ── */}
        <div className="relative bg-gradient-to-br from-secondary/10 via-primary/5 to-background rounded-2xl overflow-hidden mb-5 border border-border">
          <div className="absolute inset-0 opacity-5 pointer-events-none">
            <div className="absolute top-4 right-8 w-32 h-32 bg-primary rounded-full blur-3xl" />
            <div className="absolute bottom-4 left-8 w-24 h-24 bg-secondary rounded-full blur-2xl" />
          </div>

          <div className="relative p-4 sm:p-6 md:p-8">
            {/* Mobile: compact stacked layout */}
            <div className="flex items-start gap-3 sm:gap-5">
              {/* Avatar */}
              <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-extrabold text-xl sm:text-2xl shrink-0 border-2 border-primary/20 overflow-hidden">
                {seller.avatar_url ? (
                  <img
                    src={seller.avatar_url}
                    alt={seller.company_name || seller.full_name}
                    className="w-full h-full object-cover"
                    loading="eager"
                  />
                ) : initials}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <h1 className="text-lg sm:text-xl md:text-2xl font-extrabold text-foreground leading-tight mb-1.5">
                  {seller.company_name || seller.full_name}
                </h1>

                {/* Experience Badge */}
                {seller.established_year && (
                  <div className="mb-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold">
                      <Icon name="TrophyIcon" size={13} variant="solid" />
                      {new Date().getFullYear() - seller.established_year > 0
                        ? sp.experienceYears.replace('{years}', String(new Date().getFullYear() - seller.established_year))
                        : sp.sinceYear.replace('{year}', String(seller.established_year))}
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border ${catCfg.color}`}>
                    <span>{catCfg.icon}</span>
                    <span className="hidden xs:inline">{sp[catCfg.labelKey]}</span>
                  </span>
                  {seller.country && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Icon name="MapPinIcon" size={12} />
                      {seller.country}
                    </span>
                  )}
                  <span className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
                    <Icon name="CalendarIcon" size={12} />
                    {sp.memberSince.replace('{year}', String(memberSince))}
                  </span>
                </div>

                {totalReviews > 0 && (
                  <div className="flex items-center gap-2">
                    <StarDisplay value={avgRating} size={14} />
                    <span className="text-sm font-bold text-foreground">{avgRating.toFixed(1)}</span>
                    <span className="text-xs text-muted-foreground">({totalReviews})</span>
                  </div>
                )}
              </div>
            </div>

            {/* Stats row — compact on mobile */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3 mt-4 pt-4 border-t border-border/50">
              <div className="text-center">
                <p className="text-lg sm:text-xl font-extrabold text-foreground">{products.length}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">{sp.products}</p>
              </div>
              <div className="text-center">
                <p className="text-lg sm:text-xl font-extrabold text-foreground">{totalReviews}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">{sp.reviews}</p>
              </div>
              <div className="text-center">
                <p className="text-lg sm:text-xl font-extrabold text-foreground">{avgRating > 0 ? avgRating.toFixed(1) : '—'}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">Avg Rating</p>
              </div>
            </div>

            {/* Desktop action buttons — hidden on mobile (shown in sticky bar) */}
            <div className="hidden sm:flex gap-3 mt-5">
              <Link
                href={`/chat/${seller.id}`}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground text-sm font-bold rounded-xl hover:opacity-90 transition-opacity"
              >
                <Icon name="ChatBubbleLeftRightIcon" size={16} />
                {sp.message}
              </Link>
              <Link
                href={`/rfq/new?supplier=${seller.id}`}
                className="flex-1 flex items-center justify-center gap-2 py-3 border border-border text-foreground text-sm font-semibold rounded-xl hover:bg-muted transition-colors"
              >
                <Icon name="DocumentTextIcon" size={16} />
                {sp.sendRfq}
              </Link>
              <WishlistButton itemType="seller" sellerId={seller.id} showLabel size="md" />
            </div>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-1 bg-muted p-1 rounded-xl mb-5 w-fit">
          {[
            { key: 'products', label: sp.products, count: products.length },
            { key: 'reviews', label: sp.reviews, count: totalReviews },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === tab.key
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                  activeTab === tab.key ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Products Tab ── */}
        {activeTab === 'products' && (
          <div>
            {products.length === 0 ? (
              <div className="text-center py-16 bg-card border border-border rounded-2xl">
                <div className="w-14 h-14 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Icon name="ArchiveBoxIcon" size={24} className="text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-foreground mb-1">{sp.noProducts}</h3>
                <p className="text-sm text-muted-foreground">This seller hasn't published any products.</p>
              </div>
            ) : (
              /* Mobile: 2-col grid; tablet+: 3-col */
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {products.map((product) => (
                  <MobileProductCard key={product.id} product={product} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Reviews Tab ── */}
        {activeTab === 'reviews' && (
          <div>
            {reviews.length === 0 ? (
              <div className="text-center py-16 bg-card border border-border rounded-2xl">
                <div className="w-14 h-14 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Icon name="StarIcon" size={24} className="text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-foreground mb-1">{sp.noReviews}</h3>
                <p className="text-sm text-muted-foreground">Be the first to review this seller.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Rating summary */}
                <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row gap-4 sm:gap-5">
                  <div className="flex flex-row sm:flex-col items-center justify-center sm:w-28 shrink-0 gap-3 sm:gap-1">
                    <span className="text-4xl font-extrabold text-foreground">{avgRating.toFixed(1)}</span>
                    <div className="flex flex-col items-center gap-1">
                      <StarDisplay value={Math.round(avgRating)} size={16} />
                      <span className="text-xs text-muted-foreground">{totalReviews} {sp.reviews}</span>
                    </div>
                  </div>
                  <div className="flex-1 space-y-1.5">
                    {[5, 4, 3, 2, 1].map((star) => {
                      const count = reviews.filter((r) => r.rating === star).length;
                      const pct = reviews.length ? (count / reviews.length) * 100 : 0;
                      return (
                        <div key={star} className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground w-3 text-right">{star}</span>
                          <Icon name="StarIcon" size={11} variant="solid" className="text-amber-400 shrink-0" />
                          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-amber-400 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-muted-foreground w-4">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Review list */}
                {reviews.map((review) => (
                  <div key={review.id} className="bg-card border border-border rounded-2xl p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <StarDisplay value={review.rating} size={14} />
                          <span className="text-xs font-semibold text-foreground">{review.title || 'Review'}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{review.reviewer_name}</p>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(review.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                    {review.body && (
                      <p className="text-sm text-muted-foreground leading-relaxed">{review.body}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── Mobile Sticky CTA Bar ── */}
      <div className="sm:hidden fixed bottom-16 left-0 right-0 z-40 bg-background/95 backdrop-blur-md border-t border-border px-4 py-3 flex gap-3 shadow-lg">
        <Link
          href={`/chat/${seller.id}`}
          className="flex-1 flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground text-sm font-bold rounded-xl active:opacity-80 transition-opacity"
        >
          <Icon name="ChatBubbleLeftRightIcon" size={16} />
          Message
        </Link>
        <Link
          href={`/rfq/new?supplier=${seller.id}`}
          className="flex-1 flex items-center justify-center gap-2 py-3 border-2 border-primary text-primary text-sm font-bold rounded-xl active:opacity-80 transition-opacity"
        >
          <Icon name="DocumentTextIcon" size={16} />
          {sp.sendRfq}
        </Link>
      </div>

      <Footer />
      <BottomNav />
    </div>
  );
}
