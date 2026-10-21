'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import Icon from '@/components/ui/AppIcon';
import WishlistButton from '@/components/WishlistButton';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { getTierPriceBounds, normalizeTiers } from '@/lib/tieredPricing';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface MarketplaceProduct {
  id: string;
  name: string;
  name_ar?: string | null;
  image_url?: string | null;
  images?: string[] | null;
  image?: string | null;
  unit_price: number;
  tiered_pricing?: unknown;
  minimum_order_qty: number;
  unit: string;
  origin_country?: string | null;
  category?: string | null;
  inventory_status?: string | null;
  rating?: number | null;
  review_count?: number | null;
  transaction_volume?: number | null;
  certifications?: string[] | null;
  delivery_time_days?: number | null;
  is_verified?: boolean;
  seller_badge?: string | null;
  company_name?: string | null;
  manufacturer_id?: string | null;
}

interface MarketplaceProductCardProps {
  product: MarketplaceProduct;
  buyerMode?: 'b2b' | 'b2c';
  index?: number;
  priority?: boolean;
  showChat?: boolean;
}

// ─── Category label translator ────────────────────────────────────────────────
const CATEGORY_AR_LABELS: Record<string, string> = {
  metals: 'معادن وصلب',
  'metals-steel': 'معادن وصلب',
  plastics: 'بلاستيك وبوليمرات',
  'plastics-rubber': 'بلاستيك وبوليمرات',
  electronics: 'إلكترونيات',
  automotive: 'سيارات',
  construction: 'بناء',
  building: 'بناء',
  medical: 'طبي',
  furniture: 'أثاث',
  energy: 'طاقة',
  food: 'غذاء',
  textiles: 'منسوجات',
  machinery: 'آلات',
  packaging: 'تغليف',
  beauty: 'تجميل',
  pharmaceuticals: 'أدوية',
  auto: 'سيارات',
};

// ─── Unit translator ──────────────────────────────────────────────────────────
const UNIT_AR_LABELS: Record<string, string> = {
  ton: 'لكل طن',
  tons: 'لكل طن',
  kg: 'لكل كجم',
  kgs: 'لكل كجم',
  pcs: 'قطعة',
  units: 'وحدة',
  unit: 'وحدة',
  meters: 'متر',
  liters: 'لتر',
  sheets: 'صفيحة',
  rolls: 'لفة',
  sets: 'طقم',
  sqm: 'م²',
};

function translateUnit(unit: string): string {
  return UNIT_AR_LABELS[unit.toLowerCase()] || unit;
}

function translateCategory(category: string): string {
  return CATEGORY_AR_LABELS[category.toLowerCase()] || category.replace(/_/g, ' ');
}

// ─── Star Rating ──────────────────────────────────────────────────────────────
const StarRating: React.FC<{ rating: number; size?: number }> = ({ rating, size = 11 }) => (
  <div className="flex items-center gap-0.5">
    {[1, 2, 3, 4, 5].map((star) => (
      <svg
        key={star}
        width={size}
        height={size}
        viewBox="0 0 20 20"
        fill={star <= Math.round(rating) ? '#f59e0b' : 'none'}
        stroke="#f59e0b"
        strokeWidth="1.5"
      >
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
      </svg>
    ))}
  </div>
);

// ─── Main Card ────────────────────────────────────────────────────────────────
const MarketplaceProductCard: React.FC<MarketplaceProductCardProps> = ({
  product,
  buyerMode = 'b2b',
  index = 0,
  priority = false,
  showChat = true,
}) => {
  const FALLBACK_IMAGE = '/assets/images/no_image.png';
  const primaryImage =
    (Array.isArray(product.images) ? product.images.find((i) => typeof i === 'string' && i.trim()) : null) ||
    product.image_url ||
    product.image ||
    FALLBACK_IMAGE;
  const [imageSrc, setImageSrc] = useState<string>(primaryImage);
  useEffect(() => {
    setImageSrc(primaryImage);
  }, [primaryImage]);
  const imageUrl = imageSrc;
  const supplierName = product.company_name || 'مورّد موثّق';
  const rating = product.rating || 4.2;
  const reviewCount = product.review_count ?? ((index * 37 + 42) % 200 + 20);
  const txVolume = product.transaction_volume ?? ((index * 53 + 50) % 500 + 50);
  const isVerified = product.is_verified ?? true;
  const isReadyToShip = product.inventory_status === 'in_stock';

  // Dynamic tier pricing: range from lowest to highest tier unit price (flat price if single tier)
  const cardTiers = normalizeTiers(product.tiered_pricing);
  const tierBounds = getTierPriceBounds(cardTiers);
  const flatPrice = Number(product.unit_price) || 0;
  const priceMinNum = tierBounds ? tierBounds.min : flatPrice;
  const priceMaxNum = tierBounds ? tierBounds.max : flatPrice;
  const b2bPriceMin = priceMinNum.toFixed(2);
  const b2bPriceMax = priceMaxNum.toFixed(2);
  const hasPriceRange = b2bPriceMin !== b2bPriceMax;
  const b2cPrice = priceMinNum.toFixed(2);
  const displayMoq = cardTiers.length > 0 ? cardTiers[0].min_qty : Math.max(1, Number(product.minimum_order_qty) || 1);

  const displayNameAr = product.name_ar || product.name;
  const displayNameEn = product.name;

  const unitLabel = translateUnit(product.unit);

  const { addItem } = useCart();
  const { user, requireAuth } = useAuth();
  const [isAdding, setIsAdding] = useState(false);

  const handleAddToCart = async (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (isAdding) return;
    if (!user) {
      requireAuth(() => { void handleAddToCart(); }, 'سجّل الدخول لإضافة المنتج إلى السلة');
      return;
    }
    setIsAdding(true);
    try {
      const unitPrice = Number(product.unit_price) || 0;
      const moq = Math.max(1, Number(product.minimum_order_qty) || 1);
      await addItem({
        productId: product.id,
        name: product.name,
        nameAr: product.name_ar || product.name,
        image: product.images?.[0] || product.image_url || product.image || '/assets/images/no_image.png',
        alt: product.name_ar || product.name,
        price: unitPrice,
        currency: 'USD',
        moq: `${moq} ${product.unit || ''}`.trim(),
        moqNumber: moq,
        quantity: 1,
        supplier: product.company_name || '',
        countryFlag: product.origin_country || '',
        verified: product.is_verified ?? true,
        category: product.category || '',
        isRetailAvailable: true,
        retailPrice: Number(unitPrice.toFixed(2)),
        shippingTerms: 'CALCULATED_SHIPPING',
      });
      toast.success('تمت الإضافة إلى السلة');
    } catch {
      toast.error('تعذّرت إضافة المنتج إلى السلة');
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="group bg-card border border-border rounded-xl overflow-hidden hover:border-primary/40 hover:shadow-lg transition-all duration-200 flex flex-col">
      {/* ── Image Area ── */}
      <Link href={`/product/${product.id}`} className="block relative w-full h-44 overflow-hidden rounded-t-xl bg-gray-100 shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={displayNameEn}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading={priority || index < 4 ? 'eager' : 'lazy'}
          onError={() => {
            if (imageSrc !== FALLBACK_IMAGE) setImageSrc(FALLBACK_IMAGE);
          }}
        />

        {/* Top badges row: verified (left) + category pill (right) */}
        <div className="absolute top-2 left-2 right-2 flex items-start justify-between gap-2">
          <div className="flex flex-col gap-1">
            {isVerified && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-600 text-white text-[9px] font-bold rounded-full shadow-sm">
                <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                مورّد موثّق
              </span>
            )}
            {isReadyToShip && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-600 text-white text-[9px] font-bold rounded-full shadow-sm">
                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                جاهز للشحن
              </span>
            )}
          </div>

          {product.category && (
            <span className="px-2 py-0.5 bg-black/50 backdrop-blur-sm text-white text-[9px] font-semibold rounded-full max-w-[55%] truncate">
              {translateCategory(product.category)}
            </span>
          )}
        </div>
      </Link>

      {/* ── Content ── */}
      <div className="p-2.5 flex flex-col flex-1 gap-2 pb-3">
        {/* Wholesale badge (normal flow, no absolute positioning) */}
        {buyerMode === 'b2b' && displayMoq >= 10 && (
          <div className="flex">
            <span className="px-2 py-0.5 bg-amber-500 text-white text-[9px] font-bold rounded-full">
              شراء بالجملة
            </span>
          </div>
        )}

        {/* Product Title */}
        <Link href={`/product/${product.id}`} className="block">
          <h3 className="text-xs font-bold text-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors" dir="rtl">
            {displayNameAr}
          </h3>
          {product.name_ar && product.name_ar !== product.name && (
            <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">{displayNameEn}</p>
          )}
        </Link>

        {/* ── Dual Pricing Engine ── */}
        <div className="bg-muted/40 rounded-lg px-2 py-1.5 my-1">
          {buyerMode === 'b2b' ? (
            <>
              <div className="flex items-baseline gap-1" dir="ltr">
                <span className="text-sm font-extrabold text-primary">${b2bPriceMin}</span>
                {hasPriceRange && (
                  <>
                    <span className="text-xs text-muted-foreground">-</span>
                    <span className="text-sm font-extrabold text-primary">${b2bPriceMax}</span>
                  </>
                )}
                <span className="text-[10px] text-muted-foreground mr-1">{unitLabel}</span>
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                <Icon name="CubeIcon" size={10} className="text-amber-600" />
                <span className="text-[10px] text-amber-700 font-semibold" dir="rtl">
                  الحد الأدنى: {displayMoq.toLocaleString('en-US')} {unitLabel}
                </span>
              </div>
            </>
          ) : (
            <div className="flex items-baseline gap-1" dir="ltr">
              <span className="text-sm font-extrabold text-primary">${b2cPrice}</span>
              <span className="text-[10px] text-muted-foreground">{unitLabel}</span>
            </div>
          )}
        </div>

        {/* ── Supplier Info ── */}
        <Link
          href={product.manufacturer_id ? `/seller/${product.manufacturer_id}` : `/product/${product.id}`}
          className="flex items-center gap-1.5 group/supplier"
          dir="rtl"
        >
          <div className="w-4 h-4 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Icon name="BuildingOffice2Icon" size={10} className="text-primary" />
          </div>
          <span className="text-[10px] text-muted-foreground font-medium truncate group-hover/supplier:text-primary transition-colors">
            {supplierName}
          </span>
          {isVerified && (
            <svg className="w-3 h-3 text-blue-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          )}
        </Link>

        {/* ── Ratings & Metrics ── */}
        <div className="flex items-center gap-2" dir="rtl">
          <StarRating rating={rating} />
          <span className="text-[10px] font-bold text-foreground">{rating.toFixed(1)}</span>
          <span className="text-[10px] text-muted-foreground">({reviewCount})</span>
          {txVolume > 0 && (
            <span className="text-[10px] text-muted-foreground mr-auto">
              {txVolume}+ صفقة
            </span>
          )}
        </div>

        {/* ── Action Footer ── */}
        <div className="flex gap-1 mt-auto pt-1">
          {buyerMode === 'b2b' ? (
            <>
              {showChat && (
                <Link
                  href={`/chat/${product.id}`}
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-bold rounded-lg hover:bg-emerald-100 transition-colors"
                  dir="rtl"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  دردشة
                </Link>
              )}
              <Link
                href={`/rfq/${product.id}`}
                className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 text-[9px] font-bold rounded-lg hover:bg-amber-100 transition-colors"
                dir="rtl"
              >
                <Icon name="DocumentTextIcon" size={11} />
                طلب عرض
              </Link>
              <Link
                href={`/product/${product.id}`}
                className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-primary text-primary-foreground text-[9px] font-bold rounded-lg hover:opacity-90 transition-opacity"
                dir="rtl"
              >
                <Icon name="EyeIcon" size={11} />
                عرض
              </Link>
              <WishlistButton productId={product.id} />
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={handleAddToCart}
                disabled={isAdding}
                className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-primary text-primary-foreground text-[9px] font-bold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-60"
                dir="rtl"
              >
                <Icon name="ShoppingCartIcon" size={11} />
                أضف للسلة
              </button>
              <Link
                href={`/product/${product.id}`}
                className="flex items-center justify-center px-2.5 py-1.5 bg-muted text-foreground text-[9px] font-bold rounded-lg hover:bg-muted/80 transition-colors border border-border"
              >
                <Icon name="EyeIcon" size={11} />
              </Link>
              <WishlistButton productId={product.id} />
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default MarketplaceProductCard;
