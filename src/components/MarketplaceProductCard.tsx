'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import Icon from '@/components/ui/AppIcon';
import WishlistButton from '@/components/WishlistButton';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface MarketplaceProduct {
  id: string;
  name: string;
  name_ar?: string | null;
  image_url?: string | null;
  unit_price: number;
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
  const imageUrl = product.image_url || '/assets/images/no_image.png';
  const supplierName = product.company_name || 'Verified Supplier';
  const rating = product.rating || 4.2;
  const reviewCount = product.review_count ?? ((index * 37 + 42) % 200 + 20);
  const txVolume = product.transaction_volume ?? ((index * 53 + 50) % 500 + 50);
  const isVerified = product.is_verified ?? true;
  const isReadyToShip = product.inventory_status === 'in_stock';

  // B2B tier pricing: show range based on unit_price
  const b2bPriceMin = (product.unit_price * 0.85).toFixed(2);
  const b2bPriceMax = product.unit_price.toFixed(2);
  const b2cPrice = (product.unit_price * 1.15).toFixed(2);

  const displayNameAr = product.name_ar || product.name;
  const displayNameEn = product.name;

  return (
    <div className="group bg-card border border-border rounded-xl overflow-hidden hover:border-primary/40 hover:shadow-lg transition-all duration-200 flex flex-col">
      {/* ── Image Area ── */}
      <Link href={`/product/${product.id}`} className="block relative aspect-square bg-muted overflow-hidden shrink-0">
        <Image
          src={imageUrl}
          alt={displayNameEn}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-300"
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
          priority={priority || index < 4}
          loading={priority || index < 4 ? 'eager' : 'lazy'}
        />

        {/* Overlay badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {isVerified && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-600 text-white text-[9px] font-bold rounded-full shadow-sm">
              <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              مورد موثق
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

        {/* Category badge top-right */}
        {product.category && (
          <div className="absolute top-2 right-2">
            <span className="px-2 py-0.5 bg-black/50 backdrop-blur-sm text-white text-[9px] font-semibold rounded-full capitalize">
              {product.category.replace(/_/g, ' ')}
            </span>
          </div>
        )}

        {/* B2B bulk badge bottom */}
        {buyerMode === 'b2b' && product.minimum_order_qty >= 10 && (
          <div className="absolute bottom-2 left-2">
            <span className="px-2 py-0.5 bg-amber-500 text-white text-[9px] font-bold rounded-full">
              شراء بالجملة
            </span>
          </div>
        )}
      </Link>

      {/* ── Content ── */}
      <div className="p-2.5 flex flex-col flex-1 gap-1.5">
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
        <div className="bg-muted/40 rounded-lg px-2 py-1.5">
          {buyerMode === 'b2b' ? (
            <>
              <div className="flex items-baseline gap-1">
                <span className="text-sm font-extrabold text-primary">${b2bPriceMin}</span>
                <span className="text-xs text-muted-foreground">-</span>
                <span className="text-sm font-extrabold text-primary">${b2bPriceMax}</span>
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                <Icon name="CubeIcon" size={10} className="text-amber-600" />
                <span className="text-[10px] text-amber-700 font-semibold" dir="rtl">
                  الحد الأدنى: {product.minimum_order_qty.toLocaleString()} {product.unit}
                </span>
              </div>
            </>
          ) : (
            <div className="flex items-baseline gap-1">
              <span className="text-sm font-extrabold text-primary">${b2cPrice}</span>
              <span className="text-[10px] text-muted-foreground">/ {product.unit}</span>
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
              <Link
                href={`/cart`}
                className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-primary text-primary-foreground text-[9px] font-bold rounded-lg hover:opacity-90 transition-opacity"
                dir="rtl"
              >
                <Icon name="ShoppingCartIcon" size={11} />
                أضف للسلة
              </Link>
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
