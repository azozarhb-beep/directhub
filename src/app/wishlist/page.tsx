'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { useLanguage } from '@/contexts/LanguageContext';

interface WishlistProduct {
  id: string;
  item_type: 'product';
  created_at: string;
  product_id: string;
  product: {
    id: string;
    name: string;
    name_ar?: string;
    unit_price: number;
    unit: string;
    minimum_order_qty: number;
    inventory_status: string;
    category: string;
    origin_country?: string;
    image_url?: string;
    compressed_image_url?: string;
    images?: any[];
    product_images?: any[];
    manufacturer_id?: string;
    user_profiles?: { company_name?: string; full_name?: string };
  } | null;
}

interface WishlistSeller {
  id: string;
  item_type: 'seller';
  created_at: string;
  seller_id: string;
  seller: {
    id: string;
    full_name: string;
    company_name?: string;
    country?: string;
    seller_category?: string;
    avatar_url?: string;
  } | null;
}

type WishlistItem = WishlistProduct | WishlistSeller;

const CATEGORY_CONFIG: Record<string, { icon: string; color: string }> = {
  local_factory: { icon: '🏭', color: 'bg-blue-50 text-blue-700' },
  international_factory: { icon: '🌐', color: 'bg-purple-50 text-purple-700' },
  local_supplier: { icon: '🚚', color: 'bg-green-50 text-green-700' },
};

const STATUS_COLORS: Record<string, string> = {
  in_stock: 'bg-green-50 text-green-700',
  low_stock: 'bg-amber-50 text-amber-700',
  out_of_stock: 'bg-red-50 text-red-700',
  discontinued: 'bg-gray-50 text-gray-600',
};

export default function WishlistPage() {
  const { t, dir } = useLanguage();
  const w = t.wishlist;

  const { user, loading: authLoading, requireAuth } = useAuth();
  const { addItem: addToCart, isInCart } = useCart();
  const supabase = createClient();

  const [activeTab, setActiveTab] = useState<'products' | 'sellers'>('products');
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([]);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [addingToCart, setAddingToCart] = useState<string | null>(null);
  const [guaranteeExpanded, setGuaranteeExpanded] = useState(false);

  const STATUS_LABELS: Record<string, string> = {
    in_stock: w.statusInStock,
    low_stock: w.statusLowStock,
    out_of_stock: w.statusOutOfStock,
    discontinued: w.statusDiscontinued,
  };

  const CATEGORY_LABELS: Record<string, string> = {
    local_factory: w.catLocalFactory,
    international_factory: w.catInternationalFactory,
    local_supplier: w.catLocalSupplier,
  };

  const fetchWishlist = useCallback(async () => {
    if (!user) return;
    setFetchLoading(true);
    try {
      const { data, error } = await supabase
        .from('wishlists')
        .select(`
          id, item_type, created_at, product_id, seller_id,
          product:manufacturer_products!wishlists_product_id_fkey(
            id, name, name_ar, unit_price, unit, minimum_order_qty,
            inventory_status, category, origin_country,
            image_url, compressed_image_url, images, product_images,
            manufacturer_id
          ),
          seller:user_profiles!wishlists_seller_id_fkey(id, full_name, company_name, country, seller_category, avatar_url)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Wishlist fetch error:', error.message);
      }
      setWishlistItems((data as any[]) || []);
    } catch (err: any) {
      console.error('Wishlist fetch exception:', err?.message);
    } finally {
      setFetchLoading(false);
    }
  }, [user, supabase]);

  useEffect(() => {
    if (!authLoading && user) {
      fetchWishlist();
    } else if (!authLoading && !user) {
      setFetchLoading(false);
    }
  }, [fetchWishlist, authLoading, user]);

  // Optimistic remove: remove from UI immediately, then delete from Supabase
  const removeItem = async (id: string) => {
    // Optimistic update — remove instantly from UI
    setWishlistItems((prev) => prev.filter((item) => item.id !== id));
    // Fire-and-forget delete (no await needed for UI)
    supabase.from('wishlists').delete().eq('id', id).then(({ error }) => {
      if (error) {
        // Revert on failure by re-fetching
        fetchWishlist();
      }
    });
  };

  const handleAddToCart = async (item: WishlistProduct) => {
    const product = item.product;
    if (!product) return;
    setAddingToCart(item.id);
    try {
      await addToCart({
        productId: product.id,
        name: product.name,
        nameAr: product.name_ar || product.name,
        image: product.image_url || '',
        alt: product.name_ar || product.name,
        price: product.unit_price,
        currency: 'USD',
        moq: `${product.minimum_order_qty} ${product.unit}`,
        moqNumber: product.minimum_order_qty,
        quantity: product.minimum_order_qty || 1,
        supplier: '',
        countryFlag: product.origin_country || '',
        verified: false,
        category: product.category || '',
        isRetailAvailable: false,
        retailPrice: product.unit_price,
      });
    } catch {
      // silent
    } finally {
      setAddingToCart(null);
    }
  };

  const productItems = wishlistItems.filter((i) => i.item_type === 'product') as WishlistProduct[];
  const sellerItems = wishlistItems.filter((i) => i.item_type === 'seller') as WishlistSeller[];

  const platformLinks = [
    { label: w.linkAbout, href: '/about', icon: '🏢' },
    { label: w.linkWhy, href: '/about#why', icon: '⚡' },
    { label: w.linkJourney, href: '/about#journey', icon: '🛡️' },
    { label: w.linkBuyers, href: '/about#buyers', icon: '🎯' },
    { label: w.linkFactories, href: '/about#factories', icon: '🏭' },
    { label: w.linkVision, href: '/about#vision', icon: '🌐' },
  ];

  // ── Auth loading spinner ──────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Unauthenticated state ─────────────────────────────────────────────────
  if (!user) {
    return (
      <div className="min-h-screen bg-background" dir={dir}>
        <Header />
        <main className="max-w-7xl mx-auto px-4 md:px-6 py-16 pb-28 md:pb-16 flex flex-col items-center justify-center min-h-[60vh]">
          <div className="bg-card border border-border rounded-2xl p-10 text-center max-w-md w-full shadow-sm">
            <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-5">
              <Icon name="HeartIcon" size={32} className="text-red-400" variant="solid" />
            </div>
            <h1 className="text-xl font-extrabold text-foreground mb-2">
              {w.title}
            </h1>
            <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
              {dir === 'rtl' ?'يجب تسجيل الدخول لعرض قائمة المفضلة وإدارة المنتجات المحفوظة.' :'Please sign in to view your wishlist and manage your saved products.'}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => requireAuth(undefined, dir === 'rtl' ? 'سجّل دخولك للوصول إلى مفضلتك' : 'Sign in to access your wishlist')}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground text-sm font-bold rounded-xl hover:opacity-90 transition-opacity"
              >
                <Icon name="ArrowRightOnRectangleIcon" size={16} />
                {dir === 'rtl' ? 'تسجيل الدخول' : 'Sign In'}
              </button>
              <Link
                href="/search"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-border text-foreground text-sm font-bold rounded-xl hover:bg-muted transition-colors"
              >
                <Icon name="MagnifyingGlassIcon" size={16} />
                {w.browseProducts}
              </Link>
            </div>
          </div>
        </main>
        <Footer />
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" dir={dir}>
      <Header />
      <main className="max-w-7xl mx-auto px-4 md:px-6 py-6 pb-28 md:pb-10">

        {/* Guarantee Banner */}
        <div className="mb-6 rounded-2xl overflow-hidden border border-amber-200 bg-gradient-to-l from-amber-50 to-orange-50 shadow-sm">
          <button
            onClick={() => setGuaranteeExpanded(!guaranteeExpanded)}
            className="w-full flex items-center justify-between px-5 py-4 text-start"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                <Icon name="ShieldCheckIcon" size={22} className="text-amber-600" variant="solid" />
              </div>
              <div className="text-start">
                <p className="font-extrabold text-amber-900 text-sm">{w.guaranteeTitle}</p>
                <p className="text-xs text-amber-700 mt-0.5">{w.guaranteeSubtitle}</p>
              </div>
            </div>
            <Icon
              name={guaranteeExpanded ? 'ChevronUpIcon' : 'ChevronDownIcon'}
              size={18}
              className="text-amber-600 shrink-0"
            />
          </button>

          {guaranteeExpanded && (
            <div className="px-5 pb-5 border-t border-amber-200">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                <div className="bg-white/70 rounded-xl p-4 border border-amber-100">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">🔒</span>
                    <p className="font-bold text-amber-900 text-sm">{w.escrowTitle}</p>
                  </div>
                  <p className="text-xs text-amber-800 leading-relaxed">{w.escrowDesc}</p>
                </div>
                <div className="bg-white/70 rounded-xl p-4 border border-amber-100">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">🛡️</span>
                    <p className="font-bold text-amber-900 text-sm">{w.buyerRightsTitle}</p>
                  </div>
                  <p className="text-xs text-amber-800 leading-relaxed">{w.buyerRightsDesc}</p>
                </div>
                <div className="bg-white/70 rounded-xl p-4 border border-amber-100">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">🏭</span>
                    <p className="font-bold text-amber-900 text-sm">{w.factoryRightsTitle}</p>
                  </div>
                  <p className="text-xs text-amber-800 leading-relaxed">{w.factoryRightsDesc}</p>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                <Icon name="CheckBadgeIcon" size={18} className="text-green-600 shrink-0" variant="solid" />
                <p className="text-xs text-green-800 font-semibold">{w.guaranteeFooter}</p>
              </div>
            </div>
          )}
        </div>

        {/* Platform Links */}
        <div className="mb-6 bg-card border border-border rounded-2xl p-4">
          <p className="text-xs font-bold text-muted-foreground mb-3">{w.platformLinks}</p>
          <div className="flex flex-wrap gap-2">
            {platformLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-muted/60 hover:bg-primary/10 hover:text-primary text-xs font-semibold rounded-lg transition-colors text-foreground"
              >
                <span>{link.icon}</span>
                {link.label}
              </a>
            ))}
          </div>
        </div>

        {/* Page Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-extrabold text-foreground flex items-center gap-2">
              <Icon name="HeartIcon" size={22} className="text-red-500" variant="solid" />
              {w.title}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {wishlistItems.length} {wishlistItems.length === 1 ? w.itemSaved : w.itemsSaved}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-muted/40 rounded-xl p-1 mb-6 w-fit">
          <button
            onClick={() => setActiveTab('products')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              activeTab === 'products' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon name="CubeIcon" size={15} />
            {w.tabProducts}
            {productItems.length > 0 && (
              <span className="w-5 h-5 bg-primary text-primary-foreground text-[10px] font-extrabold rounded-full flex items-center justify-center">
                {productItems.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('sellers')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              activeTab === 'sellers' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon name="BuildingOffice2Icon" size={15} />
            {w.tabSellers}
            {sellerItems.length > 0 && (
              <span className="w-5 h-5 bg-primary text-primary-foreground text-[10px] font-extrabold rounded-full flex items-center justify-center">
                {sellerItems.length}
              </span>
            )}
          </button>
        </div>

        {/* Content */}
        {fetchLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Products Tab */}
            {activeTab === 'products' && (
              <>
                {productItems.length === 0 ? (
                  /* ── Professional Empty State ── */
                  <div className="bg-card border border-border rounded-2xl py-16 px-8 text-center">
                    <div className="w-20 h-20 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-5">
                      <Icon name="HeartIcon" size={40} className="text-red-300" variant="solid" />
                    </div>
                    <h2 className="text-lg font-extrabold text-foreground mb-2">{w.emptyProductsTitle}</h2>
                    <p className="text-sm text-muted-foreground mb-6 max-w-xs mx-auto leading-relaxed">
                      {w.emptyProductsSubtitle}
                    </p>
                    <Link
                      href="/search"
                      className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground text-sm font-bold rounded-xl hover:opacity-90 transition-opacity"
                    >
                      <Icon name="MagnifyingGlassIcon" size={16} />
                      {w.browseProducts}
                    </Link>
                  </div>
                ) : (
                  /* ── Responsive Product Grid ── */
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {productItems.map((item) => {
                      const product = item.product;
                      if (!product) return null;
                      // Resolve best available image: image_url → compressed_image_url → first from images array → first from product_images → fallback
                      const resolveImage = (): string => {
                        if (product.image_url) return product.image_url;
                        if (product.compressed_image_url) return product.compressed_image_url;
                        if (Array.isArray(product.images) && product.images.length > 0) {
                          const first = product.images[0];
                          if (typeof first === 'string') return first;
                          if (first?.src) return first.src;
                          if (first?.url) return first.url;
                        }
                        if (Array.isArray(product.product_images) && product.product_images.length > 0) {
                          const first = product.product_images[0];
                          if (typeof first === 'string') return first;
                          if (first?.src) return first.src;
                          if (first?.url) return first.url;
                        }
                        return '/assets/images/no_image.png';
                      };
                      const imageUrl = resolveImage();
                      const statusColor = STATUS_COLORS[product.inventory_status] || 'bg-gray-50 text-gray-600';
                      const statusLabel = STATUS_LABELS[product.inventory_status] || product.inventory_status?.replace('_', ' ') || '';
                      const displayName = product.name_ar || product.name;
                      const inCart = isInCart(product.id);
                      const isAddingThis = addingToCart === item.id;
                      const canAddToCart = product.inventory_status !== 'out_of_stock' && product.inventory_status !== 'discontinued';

                      return (
                        <div
                          key={item.id}
                          className="bg-card border border-border rounded-2xl overflow-hidden hover:border-primary/30 hover:shadow-md transition-all group flex flex-col"
                        >
                          {/* Product Image */}
                          <div className="relative aspect-[4/3] bg-muted overflow-hidden">
                            <img
                              src={imageUrl}
                              alt={displayName}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              loading="lazy"
                            />
                            {/* Status badge */}
                            <div className="absolute top-2 end-2">
                              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${statusColor}`}>
                                {statusLabel}
                              </span>
                            </div>
                            {/* Remove button (optimistic) */}
                            <button
                              onClick={() => removeItem(item.id)}
                              className="absolute top-2 start-2 w-8 h-8 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-red-50 transition-colors shadow-sm"
                              title={w.removeFromWishlist}
                            >
                              <Icon name="HeartIcon" size={16} className="text-red-500" variant="solid" />
                            </button>
                          </div>

                          {/* Product Info */}
                          <div className="p-3 flex flex-col flex-1">
                            <Link href={`/product/${product.id}`} className="hover:text-primary transition-colors">
                              <h3 className="text-sm font-bold text-foreground line-clamp-2 mb-1">{displayName}</h3>
                            </Link>
                            {product.origin_country && (
                              <p className="text-[10px] text-muted-foreground mb-2 line-clamp-1 flex items-center gap-1">
                                <Icon name="MapPinIcon" size={10} />
                                {product.origin_country}
                              </p>
                            )}

                            {/* Price */}
                            <div className="mt-auto pt-2 border-t border-border">
                              <div className="flex items-center justify-between mb-2">
                                <div>
                                  <p className="text-base font-extrabold text-primary">
                                    {product.unit_price?.toLocaleString()}
                                    <span className="text-xs font-medium text-muted-foreground ms-1">/{product.unit}</span>
                                  </p>
                                  <p className="text-[10px] text-muted-foreground">{w.minOrder} {product.minimum_order_qty}</p>
                                </div>
                                <Link
                                  href={`/product/${product.id}`}
                                  className="px-3 py-1.5 bg-muted/60 text-foreground text-xs font-bold rounded-lg hover:bg-muted transition-colors"
                                >
                                  {w.view}
                                </Link>
                              </div>

                              {/* Quick Action Buttons */}
                              <div className="flex gap-2">
                                {/* Add to Cart */}
                                <button
                                  onClick={() => handleAddToCart(item)}
                                  disabled={isAddingThis || inCart || !canAddToCart}
                                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all ${
                                    inCart
                                      ? 'bg-green-50 text-green-700 border border-green-200 cursor-default'
                                      : canAddToCart
                                      ? 'bg-primary text-primary-foreground hover:opacity-90'
                                      : 'bg-muted text-muted-foreground cursor-not-allowed'
                                  }`}
                                >
                                  {isAddingThis ? (
                                    <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                  ) : inCart ? (
                                    <>
                                      <Icon name="CheckIcon" size={13} />
                                      {dir === 'rtl' ? 'في السلة' : 'In Cart'}
                                    </>
                                  ) : (
                                    <>
                                      <Icon name="ShoppingCartIcon" size={13} />
                                      {dir === 'rtl' ? 'أضف للسلة' : 'Add to Cart'}
                                    </>
                                  )}
                                </button>

                                {/* RFQ Button */}
                                <Link
                                  href={`/rfq/${product.id}`}
                                  className="flex-1 flex items-center justify-center gap-1.5 py-2 border border-primary/30 text-primary text-xs font-bold rounded-xl hover:bg-primary/10 transition-colors"
                                >
                                  <Icon name="DocumentTextIcon" size={13} />
                                  {dir === 'rtl' ? 'طلب عرض سعر' : 'RFQ'}
                                </Link>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {/* Sellers Tab */}
            {activeTab === 'sellers' && (
              <>
                {sellerItems.length === 0 ? (
                  <div className="bg-card border border-border rounded-2xl py-16 px-8 text-center">
                    <div className="w-20 h-20 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-5">
                      <Icon name="BuildingOffice2Icon" size={40} className="text-blue-300" />
                    </div>
                    <h2 className="text-lg font-extrabold text-foreground mb-2">{w.emptySellersTitle}</h2>
                    <p className="text-sm text-muted-foreground mb-6 max-w-xs mx-auto leading-relaxed">
                      {w.emptySellersSubtitle}
                    </p>
                    <Link
                      href="/suppliers"
                      className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground text-sm font-bold rounded-xl hover:opacity-90 transition-opacity"
                    >
                      <Icon name="BuildingOffice2Icon" size={16} />
                      {w.browseSuppliers}
                    </Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {sellerItems.map((item) => {
                      const seller = item.seller;
                      if (!seller) return null;
                      const catKey = seller.seller_category || 'local_factory';
                      const catCfg = CATEGORY_CONFIG[catKey] || CATEGORY_CONFIG.local_factory;
                      const catLabel = CATEGORY_LABELS[catKey] || catKey.replace('_', ' ');
                      const initials = (seller.company_name || seller.full_name || 'M')
                        .split(' ').slice(0, 2).map((word: string) => word[0]).join('').toUpperCase();

                      return (
                        <div key={item.id} className="bg-card border border-border rounded-2xl p-5 hover:border-primary/30 hover:shadow-md transition-all group">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-extrabold text-lg border border-primary/20 overflow-hidden shrink-0">
                                {seller.avatar_url ? (
                                  <img src={seller.avatar_url} alt={seller.company_name || seller.full_name} className="w-full h-full object-cover" />
                                ) : initials}
                              </div>
                              <div>
                                <Link href={`/seller/${seller.id}`} className="hover:text-primary transition-colors">
                                  <h3 className="font-bold text-sm text-foreground line-clamp-1">
                                    {seller.company_name || seller.full_name}
                                  </h3>
                                </Link>
                                <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full mt-1 ${catCfg.color}`}>
                                  {catCfg.icon} {catLabel}
                                </span>
                              </div>
                            </div>
                            {/* Optimistic remove */}
                            <button
                              onClick={() => removeItem(item.id)}
                              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-red-50 transition-colors"
                              title={w.removeFromWishlist}
                            >
                              <Icon name="HeartIcon" size={16} className="text-red-500" variant="solid" />
                            </button>
                          </div>

                          {seller.country && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-4">
                              <Icon name="MapPinIcon" size={12} />
                              {seller.country}
                            </div>
                          )}

                          <div className="flex gap-2">
                            <Link
                              href={`/seller/${seller.id}`}
                              className="flex-1 py-2 bg-primary/10 text-primary text-xs font-bold rounded-xl text-center hover:bg-primary/20 transition-colors"
                            >
                              {w.viewProfile}
                            </Link>
                            <Link
                              href="/messaging"
                              className="flex-1 py-2 border border-border text-foreground text-xs font-bold rounded-xl text-center hover:bg-muted transition-colors"
                            >
                              {w.message}
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </main>
      <Footer />
      <BottomNav />
    </div>
  );
}
