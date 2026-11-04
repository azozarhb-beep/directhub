'use client';

import React, { useState, useMemo, useEffect, Suspense, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';

// ─── Types ────────────────────────────────────────────────────────────────────
interface SearchProduct {
  id: string;
  name: string;
  name_ar: string;
  description: string;
  category: string;
  category_id?: string;
  unit_price: number;
  minimum_order_qty: number;
  unit: string;
  origin_country: string;
  inventory_status: string;
  is_active: boolean;
  created_at: string;
  manufacturer_id: string;
  image_url?: string;
  certifications?: string[];
  delivery_time_days?: number;
  rating?: number;
  specifications_en?: string;
  sales_model?: string;
  origin_type?: 'local' | 'international' | null;
  user_profiles?: { full_name: string; company_name: string; seller_category?: string };
}

interface SearchFactory {
  id: string;
  full_name: string;
  company_name: string;
  country: string;
  seller_category?: string;
  avatar_url?: string;
  created_at: string;
  product_count?: number;
  avg_rating?: number;
}

interface SectorOption {
  id: string;
  name_ar: string;
  name_en: string | null;
}

interface SectorProductOption {
  id: string;
  name_ar: string;
  name_en: string | null;
}

interface FilterState {
  category: string;
  country: string;
  priceMin: string;
  priceMax: string;
  moqMin: string;
  moqMax: string;
  certifications: string[];
  deliveryTime: string;
  sortBy: string;
  supplierType: string;
  minRating: string;
  specsKeyword: string;
  inventoryStatus: string;
  sampleAvailable: boolean;
  warrantyMin: string;
  weightMax: string;
  salesModel?: string;
  sectorId?: string;
  sectorProduct?: string;
}

// ─── Static Constants ────────────────────────────────────────────────────────
const CERTIFICATION_OPTIONS = [
  'ISO 9001:2015', 'ISO 14001', 'CE Mark', 'RoHS', 'OEKO-TEX',
  'FDA Approved', 'GMP', 'SGS Certified', 'FSC Certified', 'REACH',
];

const COUNTRY_OPTIONS = [
  'Yemen', 'China', 'Turkey', 'India', 'Egypt', 'UAE', 'Saudi Arabia',
  'Germany', 'South Korea', 'Vietnam', 'Bangladesh', 'Pakistan',
  'Indonesia', 'Malaysia', 'Thailand', 'Brazil', 'Mexico',
];

// معرّفات الجمهورية اليمنية للمنتجات المحلية
const LOCAL_COUNTRY_IDS = ['YE', 'Yemen', 'اليمن', 'yemen', 'صنعاء', 'عدن'];

// ─── Dual-Mode B2B/B2C Intent Engine ─────────────────────────────────────────
export type SearchIntent = 'finished_product' | 'raw_material' | 'neutral';
export type BuyerIntent = 'b2b' | 'b2c' | 'neutral';

interface IntentScore {
  searchIntent: SearchIntent;
  buyerIntent: BuyerIntent;
  b2bScore: number;
  b2cScore: number;
  confidence: 'high' | 'medium' | 'low';
  signals: string[];
}

const B2B_SIGNALS: Array<{ pattern: string; weight: number; label: string }> = [
  { pattern: 'bulk order', weight: 10, label: 'Bulk Order' },
  { pattern: 'wholesale', weight: 10, label: 'Wholesale' },
  { pattern: 'bulk buy', weight: 9, label: 'Bulk Buy' },
  { pattern: 'bulk purchase', weight: 9, label: 'Bulk Purchase' },
  { pattern: 'large order', weight: 8, label: 'Large Order' },
  { pattern: 'minimum order', weight: 7, label: 'MOQ' },
  { pattern: 'moq', weight: 7, label: 'MOQ' },
  { pattern: 'rfq', weight: 10, label: 'RFQ' },
  { pattern: 'procurement', weight: 9, label: 'Procurement' },
  { pattern: 'sourcing', weight: 8, label: 'Sourcing' },
  { pattern: 'b2b', weight: 10, label: 'B2B' },
  { pattern: 'raw material', weight: 8, label: 'Raw Material' },
  { pattern: 'raw materials', weight: 8, label: 'Raw Materials' },
  { pattern: 'جملة', weight: 10, label: 'بالجملة' },
  { pattern: 'بالجملة', weight: 10, label: 'بالجملة' },
  { pattern: 'مصنع', weight: 7, label: 'مصنع' },
  { pattern: 'مورد', weight: 7, label: 'مورد' },
  { pattern: 'توريد', weight: 8, label: 'توريد' },
  { pattern: 'استيراد', weight: 7, label: 'استيراد' },
  { pattern: 'مواد خام', weight: 8, label: 'مواد خام' },
  { pattern: 'طلب كميات', weight: 9, label: 'طلب كميات' },
  { pattern: 'عروض أسعار', weight: 9, label: 'عروض أسعار' },
];

const B2C_SIGNALS: Array<{ pattern: string; weight: number; label: string }> = [
  { pattern: 'buy one', weight: 8, label: 'Single Unit' },
  { pattern: 'single unit', weight: 8, label: 'Single Unit' },
  { pattern: 'retail', weight: 7, label: 'Retail' },
  { pattern: 'personal use', weight: 9, label: 'Personal Use' },
  { pattern: 'for home', weight: 8, label: 'Home Use' },
  { pattern: 'one piece', weight: 7, label: 'Single Piece' },
  { pattern: 'small quantity', weight: 7, label: 'Small Qty' },
  { pattern: 'buy now', weight: 7, label: 'Buy Now' },
  { pattern: 'b2c', weight: 10, label: 'B2C' },
  { pattern: 'قطعة واحدة', weight: 8, label: 'قطعة واحدة' },
  { pattern: 'للاستخدام الشخصي', weight: 9, label: 'استخدام شخصي' },
  { pattern: 'سعر التجزئة', weight: 7, label: 'تجزئة' },
];

const FINISHED_PRODUCT_KEYWORDS = [
  'finished product', 'finished goods', 'end product', 'consumer goods', 'منتج نهائي', 'مصنع منتجات', 'منتجات جاهزة'
];

const RAW_MATERIAL_KEYWORDS = [
  'raw material', 'raw materials', 'industrial supply', 'bulk material', 'commodity',
  'مواد خام', 'مورد مواد', 'مواد أولية', 'مدخلات إنتاج', 'مستلزمات تصنيع'
];

function analyzeSearchIntentFull(query: string): IntentScore {
  if (!query.trim()) {
    return { searchIntent: 'neutral', buyerIntent: 'neutral', b2bScore: 0, b2cScore: 0, confidence: 'low', signals: [] };
  }

  const lower = query.toLowerCase();
  let b2bScore = 0;
  const b2bSignals: string[] = [];
  for (const sig of B2B_SIGNALS) {
    if (lower.includes(sig.pattern.toLowerCase())) {
      b2bScore += sig.weight;
      if (!b2bSignals.includes(sig.label)) b2bSignals.push(sig.label);
    }
  }

  let b2cScore = 0;
  const b2cSignals: string[] = [];
  for (const sig of B2C_SIGNALS) {
    if (lower.includes(sig.pattern.toLowerCase())) {
      b2cScore += sig.weight;
      if (!b2cSignals.includes(sig.label)) b2cSignals.push(sig.label);
    }
  }

  let buyerIntent: BuyerIntent = 'neutral';
  const scoreDiff = b2bScore - b2cScore;
  if (b2bScore === 0 && b2cScore === 0) buyerIntent = 'neutral';
  else if (scoreDiff >= 6) buyerIntent = 'b2b';
  else if (scoreDiff <= -6) buyerIntent = 'b2c';
  else if (b2bScore > b2cScore) buyerIntent = 'b2b';
  else if (b2cScore > b2bScore) buyerIntent = 'b2c';

  const hasFinished = FINISHED_PRODUCT_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()));
  const hasRaw = RAW_MATERIAL_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()));
  let searchIntent: SearchIntent = 'neutral';
  if (hasFinished && !hasRaw) searchIntent = 'finished_product';
  else if (hasRaw && !hasFinished) searchIntent = 'raw_material';

  const maxScore = Math.max(b2bScore, b2cScore);
  let confidence: 'high' | 'medium' | 'low' = 'low';
  if (maxScore >= 15) confidence = 'high';
  else if (maxScore >= 7) confidence = 'medium';

  const signals = buyerIntent === 'b2b' ? b2bSignals : buyerIntent === 'b2c' ? b2cSignals : [];
  return { searchIntent, buyerIntent, b2bScore, b2cScore, confidence, signals };
}

// ─── Star Rating ──────────────────────────────────────────────────────────────
const StarRating: React.FC<{ rating: number; size?: number }> = ({ rating, size = 12 }) => (
  <div className="flex items-center gap-0.5">
    {[1, 2, 3, 4, 5].map((star) => (
      <svg key={star} width={size} height={size} viewBox="0 0 20 20" fill={star <= Math.round(rating) ? '#f59e0b' : 'none'} stroke="#f59e0b" strokeWidth="1.5">
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
      </svg>
    ))}
  </div>
);

// ─── Product Card (Internal Platform Routes Only) ─────────────────────────────
const ProductCard: React.FC<{ product: SearchProduct; view: 'grid' | 'list'; inStockLabel: string; buyerMode: 'b2c' | 'b2b' }> = ({ product, view, inStockLabel, buyerMode }) => {
  const imageUrl = product.image_url || 'https://img.rocket.new/generatedImages/rocket_gen_img_1e59a0c95-1772134956918.png';
  const companyName = product.user_profiles?.company_name || product.user_profiles?.full_name || 'مصنع معتمد';
  const rating = product.rating || 4.2;

  if (view === 'list') {
    return (
      <div className="flex gap-3 sm:gap-4 bg-card border border-border rounded-xl p-3 sm:p-4 hover:border-primary/40 hover:shadow-md transition-all group">
        <Link href={`/product/${product.id}`} className="relative w-20 h-20 sm:w-28 sm:h-28 shrink-0 rounded-xl overflow-hidden bg-muted">
          <AppImage src={imageUrl} alt={product.name} fill className="object-cover group-hover:scale-105 transition-transform duration-300" sizes="112px" />
          {product.inventory_status === 'in_stock' && (
            <div className="absolute bottom-1.5 left-1.5">
              <span className="text-[9px] font-bold px-1.5 py-0.5 bg-emerald-500 text-white rounded-full">{inStockLabel}</span>
            </div>
          )}
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="min-w-0">
              <Link href={`/product/${product.id}`}>
                <h3 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors line-clamp-1">{product.name_ar || product.name}</h3>
              </Link>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{companyName} · {product.origin_country}</p>
            </div>
            <span className="text-[10px] font-semibold px-2 py-0.5 bg-muted text-muted-foreground rounded-full shrink-0 capitalize whitespace-nowrap hidden sm:inline-flex">
              {product.category?.replace(/_/g, ' ')}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mb-2 line-clamp-2 hidden sm:block">{product.description}</p>
          {product.certifications && product.certifications.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {product.certifications.slice(0, 3).map((cert) => (
                <span key={cert} className="text-[9px] font-semibold px-1.5 py-0.5 bg-blue-50 text-blue-600 border border-blue-100 rounded-full">{cert}</span>
              ))}
            </div>
          )}
          {buyerMode === 'b2b' && (
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-[9px] font-bold px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full flex items-center gap-1">
                الحد الأدنى: {product.minimum_order_qty.toLocaleString()} {product.unit}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between flex-wrap gap-1">
            <div className="flex items-end gap-2 sm:gap-3 flex-wrap">
              <div>
                <span className="text-base sm:text-lg font-bold text-foreground">${Number(product.unit_price || 0).toLocaleString()}</span>
                <span className="text-xs text-muted-foreground ml-1">/{product.unit}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <StarRating rating={rating} />
                <span className="text-xs font-semibold text-foreground">{rating.toFixed(1)}</span>
              </div>
              <Link
                href={`/rfq/create?productId=${product.id}`}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 px-3 py-1 bg-primary text-primary-foreground text-[10px] font-bold rounded-lg hover:opacity-90 transition-opacity"
              >
                طلب تسعير
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Grid View ──
  const isVerified = true;
  const isReadyToShip = product.inventory_status === 'in_stock';
  const b2bPriceMin = (Number(product.unit_price || 0) * 0.85).toFixed(2);
  const b2bPriceMax = Number(product.unit_price || 0).toFixed(2);
  const b2cPrice = Number(product.unit_price || 0).toFixed(2);
  const txVolume = Math.floor((product.id?.charCodeAt(0) || 5) * 7 + 50);

  return (
    <div className="group bg-card border border-border rounded-xl overflow-hidden hover:border-primary/40 hover:shadow-lg transition-all duration-200 flex flex-col">
      <Link href={`/product/${product.id}`} className="block relative aspect-square bg-muted overflow-hidden shrink-0">
        <AppImage
          src={imageUrl}
          alt={product.name}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-300"
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
        />
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {isVerified && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-600 text-white text-[9px] font-bold rounded-full shadow-sm">
              مصنع موثق
            </span>
          )}
          {isReadyToShip && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-600 text-white text-[9px] font-bold rounded-full shadow-sm">
              جاهز للشحن
            </span>
          )}
        </div>
      </Link>

      <div className="p-2.5 flex flex-col flex-1 gap-1.5">
        <Link href={`/product/${product.id}`} className="block">
          <h3 className="text-xs font-bold text-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors" dir="rtl">
            {product.name_ar || product.name}
          </h3>
        </Link>

        <div className="bg-muted/40 rounded-lg px-2 py-1.5">
          {buyerMode === 'b2b' ? (
            <>
              <div className="flex items-baseline gap-1">
                <span className="text-sm font-extrabold text-primary">${b2bPriceMin}</span>
                <span className="text-xs text-muted-foreground">-</span>
                <span className="text-sm font-extrabold text-primary">${b2bPriceMax}</span>
              </div>
              <div className="flex items-center gap-1 mt-0.5" dir="rtl">
                <span className="text-[10px] text-amber-700 font-semibold">
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

        <div className="flex items-center gap-1.5" dir="rtl">
          <span className="text-[10px] text-muted-foreground font-medium truncate">{companyName}</span>
        </div>

        <div className="flex items-center gap-1.5" dir="rtl">
          <StarRating rating={rating} />
          <span className="text-[10px] font-bold text-foreground">{rating.toFixed(1)}</span>
          <span className="text-[10px] text-muted-foreground ml-auto">{txVolume}+ صفقة</span>
        </div>

        <div className="flex gap-1 mt-auto pt-1">
          <Link
            href={`/messaging?productId=${encodeURIComponent(product.id)}`}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold rounded-lg hover:bg-emerald-100 transition-colors"
          >
            <Icon name="ChatBubbleLeftRightIcon" size={13} />
            دردشة
          </Link>
          <Link
            href={`/rfq/create?productId=${encodeURIComponent(product.id)}`}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold rounded-lg hover:bg-amber-100 transition-colors"
          >
            <Icon name="DocumentTextIcon" size={13} />
            طلب تسعير
          </Link>
        </div>
      </div>
    </div>
  );
};

// ─── Factory Card ─────────────────────────────────────────────────────────────
const FactoryCard: React.FC<{ factory: SearchFactory; labels: { localFactory: string; internationalFactory: string; localSupplier: string; since: string; products: string } }> = ({ factory, labels }) => {
  const CATEGORY_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
    local_factory: { label: labels.localFactory, icon: '🏭', color: 'bg-blue-50 text-blue-700 border-blue-200' },
    international_factory: { label: labels.internationalFactory, icon: '🌐', color: 'bg-purple-50 text-purple-700 border-purple-200' },
    local_supplier: { label: labels.localSupplier, icon: '🚚', color: 'bg-green-50 text-green-700 border-green-200' },
  };
  const catKey = factory.seller_category || 'local_factory';
  const catCfg = CATEGORY_CONFIG[catKey] || CATEGORY_CONFIG.local_factory;
  const initials = (factory.company_name || factory.full_name || 'S').split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  const memberYear = new Date(factory.created_at).getFullYear();

  return (
    <Link href={`/seller/${factory.id}`} className="bg-card border border-border rounded-xl p-4 hover:border-primary/40 hover:shadow-md transition-all group flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-extrabold text-base shrink-0 border border-primary/20 overflow-hidden">
          {factory.avatar_url ? (
            <img src={factory.avatar_url} alt={factory.company_name || factory.full_name} className="w-full h-full object-cover" />
          ) : initials}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors line-clamp-1">
            {factory.company_name || factory.full_name}
          </h3>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${catCfg.color}`}>
              {catCfg.icon} {catCfg.label}
            </span>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border pt-3">
        <span className="flex items-center gap-1">
          <Icon name="MapPinIcon" size={11} />
          {factory.country || 'اليمن'}
        </span>
        <span className="flex items-center gap-1">
          <Icon name="CalendarIcon" size={11} />
          {labels.since} {memberYear}
        </span>
        {(factory.product_count || 0) > 0 && (
          <span className="flex items-center gap-1">
            <Icon name="CubeIcon" size={11} />
            {factory.product_count} {labels.products}
          </span>
        )}
      </div>
    </Link>
  );
};

// ─── Filter Sidebar ───────────────────────────────────────────────────────────
const FilterSidebar: React.FC<{
  filters: FilterState;
  onChange: (key: keyof FilterState, value: any) => void;
  onReset: () => void;
  countries: string[];
  activeCount: number;
  activeTab: 'products' | 'factories';
  sectors: SectorOption[];
  sectorProducts: SectorProductOption[];
  t: any;
}> = ({ filters, onChange, onReset, countries, activeCount, activeTab, sectors, sectorProducts, t }) => {
  const { isRTL } = useLanguage();
  const allCountries = [...new Set([...COUNTRY_OPTIONS, ...countries])].sort();
  const fl = t.search.filterLabels;
  const st = t.search.supplierType;
  const cats = t.search.categories;

  const SUPPLIER_TYPE_OPTIONS = [
    { value: 'all', label: st.all },
    { value: 'local_factory', label: st.local_factory },
    { value: 'international_factory', label: st.international_factory },
    { value: 'local_supplier', label: st.local_supplier },
  ];

  const CATEGORY_OPTIONS = [
    { value: 'all', label: cats.all },
    { value: 'electronics', label: cats.electronics },
    { value: 'machinery', label: cats.machinery },
    { value: 'textiles', label: cats.textiles },
    { value: 'building', label: cats.building },
    { value: 'food', label: cats.food },
    { value: 'chemicals', label: cats.chemicals },
    { value: 'auto', label: cats.auto },
    { value: 'packaging', label: cats.packaging },
    { value: 'energy', label: cats.energy },
    { value: 'medical', label: cats.medical },
    { value: 'furniture', label: cats.furniture },
    { value: 'raw_materials', label: cats.raw_materials },
  ];

  return (
    <aside className="w-full space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon name="AdjustmentsHorizontalIcon" size={16} className="text-primary" />
          <span className="font-bold text-sm text-foreground">{fl.filters}</span>
          {activeCount > 0 && (
            <span className="w-5 h-5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
              {activeCount}
            </span>
          )}
        </div>
        {activeCount > 0 && (
          <button onClick={onReset} className="text-xs font-semibold text-primary hover:underline">
            {fl.resetAll}
          </button>
        )}
      </div>

      <div className="bg-card border border-border rounded-xl p-4 space-y-2.5">
        <p className="text-xs font-bold text-foreground uppercase tracking-wide">{fl.supplierType}</p>
        <div className="space-y-1.5">
          {SUPPLIER_TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onChange('supplierType', opt.value)}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-between ${
                filters.supplierType === opt.value
                  ? 'bg-primary/10 text-primary border border-primary/30'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent'
              }`}
            >
              <span>{opt.label}</span>
              {filters.supplierType === opt.value && <Icon name="CheckIcon" size={12} className="text-primary" />}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'products' && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-2.5">
          <p className="text-xs font-bold text-foreground uppercase tracking-wide">{fl.category}</p>
          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
            {CATEGORY_OPTIONS.map((cat) => (
              <button
                key={cat.value}
                onClick={() => onChange('category', cat.value)}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  filters.category === cat.value
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="bg-card border border-border rounded-xl p-4 space-y-2.5">
        <p className="text-xs font-bold text-foreground uppercase tracking-wide">{fl.supplierLocation}</p>
        <select
          value={filters.country}
          onChange={(e) => onChange('country', e.target.value)}
          className="w-full h-9 px-3 rounded-lg border border-border bg-background text-foreground text-xs font-medium focus:outline-none focus:border-primary"
        >
          <option value="all">{fl.allCountries}</option>
          {allCountries.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>
    </aside>
  );
};

// ─── Main Search Results ──────────────────────────────────────────────────────
function SearchResults() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { t, language } = useLanguage();

  const queryParam = searchParams.get('q') || '';
  const categoryParam = searchParams.get('category') || 'all';
  const tabParam = (searchParams.get('tab') as 'products' | 'factories') || 'products';
  const scopeParam = searchParams.get('scope') || searchParams.get('origin') || 'all';
  const modeParam = searchParams.get('mode') as 'b2c' | 'b2b' | null;

  const [inputValue, setInputValue] = useState(queryParam);
  const [query, setQuery] = useState(queryParam);
  const [activeTab, setActiveTab] = useState<'products' | 'factories'>(tabParam);
  const [scopeFilter, setScopeFilter] = useState<'all' | 'local' | 'global'>(
    scopeParam === 'local' ? 'local' : scopeParam === 'international' || scopeParam === 'global' ? 'global' : 'all'
  );

  // جعل نمط الجملة B2B هو الافتراضي ما لم يُحدد العكس
  const [buyerMode, setBuyerMode] = useState<'b2c' | 'b2b'>(modeParam === 'b2c' ? 'b2c' : 'b2b');

  const [filters, setFilters] = useState<FilterState>({
    category: categoryParam,
    country: 'all',
    priceMin: '',
    priceMax: '',
    moqMin: '',
    moqMax: '',
    certifications: [],
    deliveryTime: 'all',
    sortBy: 'relevance',
    supplierType: 'all',
    minRating: '',
    specsKeyword: '',
    inventoryStatus: 'all',
    sampleAvailable: false,
    warrantyMin: '',
    weightMax: '',
    salesModel: 'all',
  });

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dbProducts, setDbProducts] = useState<SearchProduct[]>([]);
  const [dbFactories, setDbFactories] = useState<SearchFactory[]>([]);
  const [dbLoading, setDbLoading] = useState(true);
  const [countries, setCountries] = useState<string[]>([]);
  const [sectors, setSectors] = useState<SectorOption[]>([]);
  const [sectorProducts, setSectorProducts] = useState<SectorProductOption[]>([]);

  useEffect(() => {
    setQuery(queryParam);
    setInputValue(queryParam);
  }, [queryParam]);

  useEffect(() => {
    setFilters((prev) => ({ ...prev, category: categoryParam }));
  }, [categoryParam]);

  useEffect(() => {
    if (scopeParam === 'local') setScopeFilter('local');
    else if (scopeParam === 'international' || scopeParam === 'global') setScopeFilter('global');
    else setScopeFilter('all');
  }, [scopeParam]);

  useEffect(() => {
    if (modeParam === 'b2c' || modeParam === 'b2b') {
      setBuyerMode(modeParam);
    }
  }, [modeParam]);

  useEffect(() => {
    setActiveTab(tabParam);
  }, [tabParam]);

  const fetchProducts = useCallback(async () => {
    setDbLoading(true);
    try {
      const trimmedQuery = query.trim();

      let q = supabase
        .from('manufacturer_products')
        .select('id, name, name_ar, image_url, unit_price, minimum_order_qty, unit, origin_country, origin_type, category, is_active, seller_badge, description, inventory_status, created_at, manufacturer_id, sales_model, user_profiles!manufacturer_products_manufacturer_id_fkey(full_name, company_name, seller_category)')
        .eq('is_active', true);

      if (trimmedQuery) {
        q = q.or(`name.ilike.%${trimmedQuery}%,name_ar.ilike.%${trimmedQuery}%,description.ilike.%${trimmedQuery}%`);
      }

      if (filters.category !== 'all') {
        q = q.eq('category', filters.category);
      }

      const { data, error } = await q.limit(100);
      if (!error && data) {
        setDbProducts(data as SearchProduct[]);
        const uniqueCountries = [...new Set(data.map((p: any) => p.origin_country).filter(Boolean))];
        setCountries(uniqueCountries);
      }
    } catch {
      setDbProducts([]);
    } finally {
      setDbLoading(false);
    }
  }, [query, filters.category]);

  const fetchFactories = useCallback(async () => {
    setDbLoading(true);
    try {
      let q = supabase
        .from('user_profiles')
        .select('id, full_name, company_name, country, seller_category, avatar_url, created_at')
        .in('role', ['manufacturer', 'supplier', 'factory']);

      if (query.trim()) {
        q = q.or(`full_name.ilike.%${query.trim()}%,company_name.ilike.%${query.trim()}%`);
      }

      const { data, error } = await q.order('created_at', { ascending: false }).limit(50);
      if (!error && data) {
        setDbFactories(data as SearchFactory[]);
      }
    } catch {
      setDbFactories([]);
    } finally {
      setDbLoading(false);
    }
  }, [query]);

  useEffect(() => {
    if (activeTab === 'products') fetchProducts();
    else fetchFactories();
  }, [activeTab, fetchProducts, fetchFactories]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputValue.trim();
    setQuery(trimmed);
    const params = new URLSearchParams();
    if (trimmed) params.set('q', trimmed);
    if (filters.category !== 'all') params.set('category', filters.category);
    params.set('tab', activeTab);
    params.set('mode', buyerMode);
    router.push(`/search?${params.toString()}`);
  };

  const handleFilterChange = (key: keyof FilterState, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleReset = () => {
    setFilters({
      category: 'all',
      country: 'all',
      priceMin: '',
      priceMax: '',
      moqMin: '',
      moqMax: '',
      certifications: [],
      deliveryTime: 'all',
      sortBy: 'relevance',
      supplierType: 'all',
      minRating: '',
      specsKeyword: '',
      inventoryStatus: 'all',
      sampleAvailable: false,
      warrantyMin: '',
      weightMax: '',
      salesModel: 'all',
      sectorId: 'all',
      sectorProduct: 'all',
    });
  };

  // الفرز الدقيق بناءً على النطاق الجغرافي (اليمن مقابل الدولي)
  const productResults = useMemo(() => {
    let filtered = [...dbProducts];

    if (scopeFilter === 'local') {
      filtered = filtered.filter((p) => {
        const c = (p.origin_country || '').toLowerCase().trim();
        return p.origin_type === 'local' || LOCAL_COUNTRY_IDS.some((id) => c === id.toLowerCase()) || c === '';
      });
    } else if (scopeFilter === 'global') {
      filtered = filtered.filter((p) => {
        const c = (p.origin_country || '').toLowerCase().trim();
        return p.origin_type === 'international' || (!LOCAL_COUNTRY_IDS.some((id) => c === id.toLowerCase()) && c !== '');
      });
    }

    if (filters.category !== 'all') {
      filtered = filtered.filter((p) => p.category === filters.category);
    }

    return filtered;
  }, [dbProducts, scopeFilter, filters.category]);

  const factoryResults = useMemo(() => {
    let filtered = [...dbFactories];
    if (scopeFilter === 'local') {
      filtered = filtered.filter((f) => f.seller_category === 'local_factory' || f.seller_category === 'local_supplier');
    } else if (scopeFilter === 'global') {
      filtered = filtered.filter((f) => f.seller_category === 'international_factory');
    }
    return filtered;
  }, [dbFactories, scopeFilter]);

  const originCounts = useMemo(() => {
    const all = dbProducts.length;
    const local = dbProducts.filter((p) => {
      const c = (p.origin_country || '').toLowerCase().trim();
      return p.origin_type === 'local' || LOCAL_COUNTRY_IDS.some((id) => c === id.toLowerCase()) || c === '';
    }).length;
    const international = all - local;
    return { all, local, international };
  }, [dbProducts]);

  const currentResults = activeTab === 'products' ? productResults : factoryResults;

  const TABS = [
    { key: 'products', label: language === 'ar' ? 'المنتجات' : 'Products', icon: 'CubeIcon' },
    { key: 'factories', label: language === 'ar' ? 'المصانع والموردون' : 'Factories & Suppliers', icon: 'BuildingOffice2Icon' },
  ];

  const factoryCardLabels = {
    localFactory: 'مصنع محلي',
    internationalFactory: 'مصنع عالمي',
    localSupplier: 'مورد محلي',
    since: 'منذ',
    products: 'منتج',
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="max-w-7xl mx-auto px-4 md:px-6 py-5 pb-24 md:pb-10">
        {/* Search Bar */}
        <form onSubmit={handleSearch} className="mb-4">
          <div className="flex items-stretch h-12 border border-border rounded-xl overflow-hidden bg-card focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/30 transition-colors shadow-sm">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={language === 'ar' ? 'ابحث عن منتجات، مصانع، مواد خام...' : 'Search products, factories, materials...'}
              className="flex-1 px-4 text-sm bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            <button
              type="submit"
              className="shrink-0 px-5 bg-primary text-primary-foreground text-sm font-bold flex items-center gap-2 active:opacity-80 transition-opacity"
            >
              <Icon name="MagnifyingGlassIcon" size={16} />
              <span>{language === 'ar' ? 'بحث' : 'Search'}</span>
            </button>
          </div>
        </form>

        {/* Tabs: Products / Factories */}
        <div className="flex gap-1 bg-muted p-1 rounded-xl mb-4 w-fit">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as 'products' | 'factories')}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg transition-colors whitespace-nowrap ${
                activeTab === tab.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon name={tab.icon as any} size={14} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── أشرطة فرز المنشأ: الكل / محلي (اليمن) / دولي ── */}
        <div className="flex items-center gap-2 mb-5 overflow-x-auto hide-scrollbar pb-1">
          {[
            {
              key: 'all' as const,
              label: language === 'ar' ? 'جميع البضائع' : 'All Goods',
              icon: '🌐',
              count: originCounts.all,
              activeClass: 'bg-foreground text-background shadow-sm',
              inactiveClass: 'bg-card border border-border text-muted-foreground hover:text-foreground',
            },
            {
              key: 'local' as const,
              label: language === 'ar' ? 'منتجات محلية' : 'Local Goods',
              icon: '🇾🇪',
              count: originCounts.local,
              activeClass: 'bg-emerald-600 text-white shadow-sm',
              inactiveClass: 'bg-card border border-border text-muted-foreground hover:text-foreground hover:border-emerald-300',
            },
            {
              key: 'global' as const,
              label: language === 'ar' ? 'بضائع دولية واستيراد' : 'International Goods',
              icon: '✈️',
              count: originCounts.international,
              activeClass: 'bg-blue-600 text-white shadow-sm',
              inactiveClass: 'bg-card border border-border text-muted-foreground hover:text-foreground hover:border-blue-300',
            },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setScopeFilter(tab.key);
                const params = new URLSearchParams();
                if (query) params.set('q', query);
                params.set('tab', activeTab);
                params.set('scope', tab.key);
                params.set('mode', buyerMode);
                router.push(`/search?${params.toString()}`);
              }}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 ${
                scopeFilter === tab.key ? tab.activeClass : tab.inactiveClass
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              {!dbLoading && (
                <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-extrabold ${
                  scopeFilter === tab.key ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Layout */}
        <div className="flex gap-6 items-start">
          <div className="hidden lg:block w-60 xl:w-64 shrink-0 sticky top-20">
            <FilterSidebar
              filters={filters}
              onChange={handleFilterChange}
              onReset={handleReset}
              countries={countries}
              activeCount={0}
              activeTab={activeTab}
              sectors={sectors}
              sectorProducts={sectorProducts}
              t={t}
            />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-3 mb-4">
              <p className="text-sm font-bold text-foreground">
                {currentResults.length} {language === 'ar' ? 'عنصر متوفر' : 'items available'}
              </p>

              {activeTab === 'products' && (
                <div className="flex items-center gap-2">
                  <div className="flex items-center border border-border rounded-lg overflow-hidden">
                    <button
                      onClick={() => setBuyerMode('b2b')}
                      className={`h-8 px-3 text-xs font-bold transition-colors ${buyerMode === 'b2b' ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted'}`}
                    >
                      جملة (B2B)
                    </button>
                    <button
                      onClick={() => setBuyerMode('b2c')}
                      className={`h-8 px-3 text-xs font-bold transition-colors ${buyerMode === 'b2c' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
                    >
                      تجزئة (B2C)
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Results Grid */}
            {dbLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="bg-card border border-border rounded-xl aspect-square animate-pulse" />
                ))}
              </div>
            ) : currentResults.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 px-4 text-center bg-card border border-border rounded-2xl">
                <Icon name="CubeIcon" size={40} className="text-muted-foreground/40 mb-3" />
                <h3 className="text-base font-bold text-foreground mb-1">
                  {language === 'ar' ? 'لا توجد بضائع متوفرة تطابق هذا الفرز' : 'No products found'}
                </h3>
                <p className="text-xs text-muted-foreground mb-4">
                  {language === 'ar' ? 'يمكنك تقديم طلب تسعير مخصص وسيتواصل معك الموردون مباشرة' : 'Submit an RFQ to receive custom quotes'}
                </p>
                <Link
                  href="/rfq/create"
                  className="px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-xl"
                >
                  {language === 'ar' ? 'طلب تسعير خاص (RFQ)' : 'Create RFQ'}
                </Link>
              </div>
            ) : activeTab === 'products' ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {(productResults as SearchProduct[]).map((product) => (
                  <ProductCard key={product.id} product={product} view={viewMode} inStockLabel="متوفر" buyerMode={buyerMode} />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(factoryResults as SearchFactory[]).map((factory) => (
                  <FactoryCard key={factory.id} factory={factory} labels={factoryCardLabels} />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <Icon name="ArrowPathIcon" size={28} className="animate-spin text-primary" />
        </div>
      }
    >
      <SearchResults />
    </Suspense>
  );
}
