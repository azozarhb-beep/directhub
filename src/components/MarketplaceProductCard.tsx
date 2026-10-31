'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { getTierPriceBounds, normalizeTiers } from '@/lib/tieredPricing';
import { BRAND_PLACEHOLDER_IMAGE, formatPriceByOrigin, pickFactoryName, translateUnitAr } from '@/lib/catalogDisplay';

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
  origin_type?: 'local' | 'international' | null;
}

interface MarketplaceProductCardProps {
  product: MarketplaceProduct;
  buyerMode?: 'b2b' | 'b2c';
  index?: number;
  priority?: boolean;
  /** @deprecated Card no longer renders action buttons; kept for backwards compatibility */
  showChat?: boolean;
}

// ─── Unit translator ──────────────────────────────────────────────────────────
function translateUnit(unit: string): string {
  return translateUnitAr(unit);
}

// ─── Main Card ────────────────────────────────────────────────────────────────
const MarketplaceProductCard: React.FC<MarketplaceProductCardProps> = ({
  product,
  buyerMode = 'b2b',
  index = 0,
  priority = false,
}) => {
  const FALLBACK_IMAGE = BRAND_PLACEHOLDER_IMAGE;
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
  const supplierName = pickFactoryName(product.company_name) || 'مصنع موثّق';
  const isVerified = product.is_verified ?? true;

  // Dynamic tier pricing: range from lowest to highest tier unit price (flat price if single tier)
  const cardTiers = normalizeTiers(product.tiered_pricing);
  const tierBounds = getTierPriceBounds(cardTiers);
  const flatPrice = Number(product.unit_price) || 0;
  const priceMinNum = tierBounds ? tierBounds.min : flatPrice;
  const priceMaxNum = tierBounds ? tierBounds.max : flatPrice;
  const b2bPriceMin = formatPriceByOrigin(priceMinNum, product.origin_type);
  const b2bPriceMax = formatPriceByOrigin(priceMaxNum, product.origin_type);
  const hasPriceRange = b2bPriceMin !== b2bPriceMax;
  const b2cPrice = formatPriceByOrigin(priceMinNum, product.origin_type);
  const displayMoq = cardTiers.length > 0 ? cardTiers[0].min_qty : Math.max(1, Number(product.minimum_order_qty) || 1);

  const displayNameAr = product.name_ar || product.name;
  const displayNameEn = product.name;

  const unitLabel = translateUnit(product.unit);

  return (
    <div className="group relative bg-card border border-border rounded-xl overflow-hidden hover:border-primary/40 hover:shadow-lg transition-all duration-200 flex flex-col">
      {/* Whole-card click target */}
      <Link
        href={`/product/${product.id}`}
        aria-label={displayNameAr}
        className="absolute inset-0 z-10"
      />

      {/* ── Image Area ── */}
      <div className="block relative w-full h-44 overflow-hidden rounded-t-xl bg-gray-100 shrink-0">
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
      </div>

      {/* ── Content ── */}
      <div className="p-2.5 flex flex-col flex-1 gap-2 pb-3">
        {/* Product Title */}
        <div className="block">
          <h3 className="text-xs font-bold text-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors" dir="rtl">
            {displayNameAr}
          </h3>
        </div>

        {/* ── Pricing (YER) + MOQ ── */}
        <div className="bg-muted/40 rounded-lg px-2 py-1.5">
          {buyerMode === 'b2b' ? (
            <>
              <div className="flex items-baseline gap-1 flex-wrap" dir="rtl">
                <span className="text-sm font-extrabold text-primary">{b2bPriceMin}</span>
                {hasPriceRange && (
                  <>
                    <span className="text-xs text-muted-foreground">-</span>
                    <span className="text-sm font-extrabold text-primary">{b2bPriceMax}</span>
                  </>
                )}
                <span className="text-[10px] text-muted-foreground">/ {unitLabel}</span>
              </div>
              <div className="flex items-center gap-1 mt-0.5" dir="rtl">
                <Icon name="CubeIcon" size={10} className="text-amber-600" />
                <span className="text-[10px] text-amber-700 font-semibold">
                  الحد الأدنى: {displayMoq.toLocaleString('en-US')} {unitLabel}
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-baseline gap-1 flex-wrap" dir="rtl">
                <span className="text-sm font-extrabold text-primary">{b2cPrice}</span>
                <span className="text-[10px] text-muted-foreground">/ {unitLabel}</span>
              </div>
              <div className="flex items-center gap-1 mt-0.5" dir="rtl">
                <Icon name="CubeIcon" size={10} className="text-amber-600" />
                <span className="text-[10px] text-amber-700 font-semibold">
                  الحد الأدنى: {displayMoq.toLocaleString('en-US')} {unitLabel}
                </span>
              </div>
            </>
          )}
        </div>

        {/* ── Factory name + verified badge ── */}
        <div className="flex items-center gap-1.5 mt-auto" dir="rtl">
          <div className="w-4 h-4 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Icon name="BuildingOffice2Icon" size={10} className="text-primary" />
          </div>
          <span className="text-[10px] text-muted-foreground font-medium truncate">
            {supplierName}
          </span>
          {isVerified && (
            <svg className="w-3 h-3 text-blue-500 shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-label="موثّق">
              <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          )}
        </div>
      </div>
    </div>
  );
};

export default MarketplaceProductCard;
