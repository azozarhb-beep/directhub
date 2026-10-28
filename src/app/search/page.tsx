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

// ─── Static (non-translated) constants ───────────────────────────────────────
const CERTIFICATION_OPTIONS = [
  'ISO 9001:2015', 'ISO 14001', 'CE Mark', 'RoHS', 'OEKO-TEX',
  'FDA Approved', 'GMP', 'SGS Certified', 'FSC Certified', 'REACH',
];

const COUNTRY_OPTIONS = [
  'China', 'Turkey', 'India', 'Egypt', 'UAE', 'Saudi Arabia',
  'Germany', 'South Korea', 'Vietnam', 'Bangladesh', 'Pakistan',
  'Indonesia', 'Malaysia', 'Thailand', 'Brazil', 'Mexico',
];

// ─── Dual-Mode B2B/B2C Intelligent Intent Engine ─────────────────────────────

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

// Weighted B2B keyword signals
const B2B_SIGNALS: Array<{ pattern: string; weight: number; label: string }> = [
  // Procurement / bulk intent
  { pattern: 'bulk order', weight: 10, label: 'Bulk Order' },
  { pattern: 'wholesale', weight: 10, label: 'Wholesale' },
  { pattern: 'bulk buy', weight: 9, label: 'Bulk Buy' },
  { pattern: 'bulk purchase', weight: 9, label: 'Bulk Purchase' },
  { pattern: 'large order', weight: 8, label: 'Large Order' },
  { pattern: 'mass order', weight: 8, label: 'Mass Order' },
  { pattern: 'volume order', weight: 8, label: 'Volume Order' },
  { pattern: 'minimum order', weight: 7, label: 'MOQ' },
  { pattern: 'moq', weight: 7, label: 'MOQ' },
  // RFQ / procurement
  { pattern: 'rfq', weight: 10, label: 'RFQ' },
  { pattern: 'request for quotation', weight: 10, label: 'RFQ' },
  { pattern: 'request for quote', weight: 10, label: 'RFQ' },
  { pattern: 'procurement', weight: 9, label: 'Procurement' },
  { pattern: 'sourcing', weight: 8, label: 'Sourcing' },
  { pattern: 'supplier', weight: 6, label: 'Supplier Search' },
  { pattern: 'manufacturer', weight: 6, label: 'Manufacturer' },
  { pattern: 'factory', weight: 6, label: 'Factory' },
  { pattern: 'oem', weight: 9, label: 'OEM' },
  { pattern: 'odm', weight: 9, label: 'ODM' },
  { pattern: 'private label', weight: 8, label: 'Private Label' },
  { pattern: 'contract manufacturing', weight: 10, label: 'Contract Mfg' },
  // Business terms
  { pattern: 'b2b', weight: 10, label: 'B2B' },
  { pattern: 'business to business', weight: 10, label: 'B2B' },
  { pattern: 'trade', weight: 5, label: 'Trade' },
  { pattern: 'import', weight: 6, label: 'Import' },
  { pattern: 'export', weight: 6, label: 'Export' },
  { pattern: 'distributor', weight: 7, label: 'Distributor' },
  { pattern: 'reseller', weight: 7, label: 'Reseller' },
  // Raw materials / industrial
  { pattern: 'raw material', weight: 8, label: 'Raw Material' },
  { pattern: 'raw materials', weight: 8, label: 'Raw Materials' },
  { pattern: 'industrial supply', weight: 7, label: 'Industrial Supply' },
  { pattern: 'feedstock', weight: 8, label: 'Feedstock' },
  { pattern: 'commodity', weight: 6, label: 'Commodity' },
  { pattern: 'ton', weight: 4, label: 'Tonnage' },
  { pattern: 'metric ton', weight: 6, label: 'Metric Ton' },
  { pattern: 'pallet', weight: 5, label: 'Pallet' },
  { pattern: 'container', weight: 5, label: 'Container' },
  // Arabic B2B signals
  { pattern: 'جملة', weight: 10, label: 'بالجملة' },
  { pattern: 'بالجملة', weight: 10, label: 'بالجملة' },
  { pattern: 'مصنع', weight: 7, label: 'مصنع' },
  { pattern: 'مورد', weight: 7, label: 'مورد' },
  { pattern: 'توريد', weight: 8, label: 'توريد' },
  { pattern: 'استيراد', weight: 7, label: 'استيراد' },
  { pattern: 'تصدير', weight: 7, label: 'تصدير' },
  { pattern: 'مواد خام', weight: 8, label: 'مواد خام' },
  { pattern: 'طلب كميات', weight: 9, label: 'طلب كميات' },
  { pattern: 'عروض أسعار', weight: 9, label: 'عروض أسعار' },
];

// Weighted B2C keyword signals
const B2C_SIGNALS: Array<{ pattern: string; weight: number; label: string }> = [
  // Retail / consumer
  { pattern: 'buy one', weight: 8, label: 'Single Unit' },
  { pattern: 'single unit', weight: 8, label: 'Single Unit' },
  { pattern: 'retail', weight: 7, label: 'Retail' },
  { pattern: 'personal use', weight: 9, label: 'Personal Use' },
  { pattern: 'for home', weight: 8, label: 'Home Use' },
  { pattern: 'home use', weight: 8, label: 'Home Use' },
  { pattern: 'consumer', weight: 6, label: 'Consumer' },
  { pattern: 'individual', weight: 6, label: 'Individual' },
  { pattern: 'one piece', weight: 7, label: 'Single Piece' },
  { pattern: 'small quantity', weight: 7, label: 'Small Qty' },
  { pattern: 'sample', weight: 5, label: 'Sample' },
  { pattern: 'gift', weight: 6, label: 'Gift' },
  // Direct purchase
  { pattern: 'buy now', weight: 7, label: 'Buy Now' },
  { pattern: 'add to cart', weight: 8, label: 'Cart' },
  { pattern: 'order online', weight: 7, label: 'Online Order' },
  { pattern: 'cheap', weight: 5, label: 'Retail Price' },
  { pattern: 'affordable', weight: 5, label: 'Affordable' },
  { pattern: 'best price', weight: 5, label: 'Best Price' },
  // B2C explicit
  { pattern: 'b2c', weight: 10, label: 'B2C' },
  { pattern: 'end consumer', weight: 9, label: 'End Consumer' },
  // Arabic B2C signals
  { pattern: 'قطعة واحدة', weight: 8, label: 'قطعة واحدة' },
  { pattern: 'للاستخدام الشخصي', weight: 9, label: 'استخدام شخصي' },
  { pattern: 'للمنزل', weight: 8, label: 'للمنزل' },
  { pattern: 'اشتري الآن', weight: 7, label: 'اشتري الآن' },
  { pattern: 'سعر التجزئة', weight: 7, label: 'تجزئة' },
];

// Finished product vs raw material signals (for tab routing)
const FINISHED_PRODUCT_KEYWORDS = [
  'finished product', 'finished goods', 'end product', 'final product',
  'consumer product', 'ready product', 'manufactured product', 'assembled product',
  'finished factory', 'product factory', 'product manufacturer', 'end product manufacturer',
  'finished product factory', 'finished goods factory', 'consumer goods factory',
  'ready-made', 'readymade', 'oem', 'odm', 'branded product', 'retail product',
  'electronics factory', 'appliance factory', 'furniture factory', 'clothing factory',
  'garment factory', 'shoe factory', 'toy factory', 'cosmetics factory',
  'food factory', 'beverage factory', 'pharmaceutical factory',
  'منتج نهائي', 'مصنع منتجات', 'منتجات جاهزة', 'مصنع نهائي',
];

const RAW_MATERIAL_KEYWORDS = [
  'raw material', 'raw materials', 'raw input', 'manufacturing input',
  'production supply', 'production supplies', 'industrial supply', 'industrial supplies',
  'bulk material', 'bulk materials', 'commodity', 'commodities',
  'raw supplier', 'material supplier', 'ingredient supplier', 'component supplier',
  'steel supplier', 'metal supplier', 'chemical supplier', 'plastic supplier',
  'fabric supplier', 'textile supplier', 'lumber supplier', 'wood supplier',
  'grain supplier', 'mineral supplier', 'ore supplier', 'crude',
  'feedstock', 'base material', 'unprocessed', 'unfinished material',
  'مواد خام', 'مورد مواد', 'مواد أولية', 'مدخلات إنتاج', 'مستلزمات تصنيع',
  'مواد بناء', 'مواد صناعية',
];

/**
 * Dual-mode B2B/B2C intelligent intent detector.
 * Returns a scored IntentScore with buyer intent, search intent, confidence, and matched signals.
 */
function analyzeSearchIntentFull(query: string): IntentScore {
  if (!query.trim()) {
    return { searchIntent: 'neutral', buyerIntent: 'neutral', b2bScore: 0, b2cScore: 0, confidence: 'low', signals: [] };
  }

  const lower = query.toLowerCase();

  // ── Score B2B signals ──
  let b2bScore = 0;
  const b2bSignals: string[] = [];
  for (const sig of B2B_SIGNALS) {
    if (lower.includes(sig.pattern.toLowerCase())) {
      b2bScore += sig.weight;
      if (!b2bSignals.includes(sig.label)) b2bSignals.push(sig.label);
    }
  }

  // ── Score B2C signals ──
  let b2cScore = 0;
  const b2cSignals: string[] = [];
  for (const sig of B2C_SIGNALS) {
    if (lower.includes(sig.pattern.toLowerCase())) {
      b2cScore += sig.weight;
      if (!b2cSignals.includes(sig.label)) b2cSignals.push(sig.label);
    }
  }

  // ── Detect quantity patterns (e.g. "500 units", "1000 pcs") → B2B signal ──
  const quantityMatch = lower.match(/\b(\d{3,})\s*(units?|pcs?|pieces?|kg|tons?|boxes?|cartons?|pallets?)\b/i);
  if (quantityMatch) {
    const qty = parseInt(quantityMatch[1]);
    if (qty >= 100) {
      b2bScore += Math.min(10, Math.floor(qty / 100));
      if (!b2bSignals.includes('Large Quantity')) b2bSignals.push('Large Quantity');
    }
  }

  // ── Determine buyer intent ──
  let buyerIntent: BuyerIntent = 'neutral';
  const scoreDiff = b2bScore - b2cScore;
  if (b2bScore === 0 && b2cScore === 0) {
    buyerIntent = 'neutral';
  } else if (scoreDiff >= 6) {
    buyerIntent = 'b2b';
  } else if (scoreDiff <= -6) {
    buyerIntent = 'b2c';
  } else if (b2bScore > b2cScore) {
    buyerIntent = 'b2b';
  } else if (b2cScore > b2bScore) {
    buyerIntent = 'b2c';
  }

  // ── Determine search intent (product type routing) ──
  const hasFinished = FINISHED_PRODUCT_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()));
  const hasRaw = RAW_MATERIAL_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()));
  let searchIntent: SearchIntent = 'neutral';
  if (hasFinished && !hasRaw) searchIntent = 'finished_product';
  else if (hasRaw && !hasFinished) searchIntent = 'raw_material';

  // ── Confidence level ──
  const maxScore = Math.max(b2bScore, b2cScore);
  let confidence: 'high' | 'medium' | 'low' = 'low';
  if (maxScore >= 15) confidence = 'high';
  else if (maxScore >= 7) confidence = 'medium';

  const signals = buyerIntent === 'b2b' ? b2bSignals : buyerIntent === 'b2c' ? b2cSignals : [];

  return { searchIntent, buyerIntent, b2bScore, b2cScore, confidence, signals };
}

// Legacy wrapper for backward compat
function analyzeSearchIntent(query: string): SearchIntent {
  return analyzeSearchIntentFull(query).searchIntent;
}

// ─── Intent Banner ────────────────────────────────────────────────────────────
const IntentBanner: React.FC<{
  intentScore: IntentScore;
  query: string;
  onDismiss: () => void;
  onSwitchMode: (mode: 'b2b' | 'b2c') => void;
  onSwitchTab: (tab: 'products' | 'factories') => void;
  currentBuyerMode: 'b2c' | 'b2b';
  currentTab: 'products' | 'factories';
}> = ({ intentScore, query, onDismiss, onSwitchMode, onSwitchTab, currentBuyerMode, currentTab }) => {
  const { searchIntent, buyerIntent, confidence, signals } = intentScore;

  // Only show if there's a meaningful signal
  if (buyerIntent === 'neutral' && searchIntent === 'neutral') return null;
  if (confidence === 'low' && buyerIntent === 'neutral') return null;

  const isB2B = buyerIntent === 'b2b';
  const isB2C = buyerIntent === 'b2c';
  const isFinished = searchIntent === 'finished_product';
  const isRaw = searchIntent === 'raw_material';

  // Determine banner theme
  let theme = {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    icon: '🏭',
    titleColor: 'text-blue-800',
    textColor: 'text-blue-700',
    badgeBg: 'bg-blue-100',
    badgeText: 'text-blue-700',
    btnBg: 'bg-blue-600 hover:bg-blue-700',
    title: '',
    description: '',
  };

  if (isB2B) {
    theme = {
      ...theme,
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      icon: '🏢',
      titleColor: 'text-amber-800',
      textColor: 'text-amber-700',
      badgeBg: 'bg-amber-100',
      badgeText: 'text-amber-700',
      btnBg: 'bg-amber-600 hover:bg-amber-700',
      title: 'B2B Intent Detected',
      description: `Your search "${query}" looks like a business procurement query. Switch to B2B mode for bulk pricing, MOQ details, and RFQ tools.`,
    };
  } else if (isB2C) {
    theme = {
      ...theme,
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      icon: '🛍️',
      titleColor: 'text-emerald-800',
      textColor: 'text-emerald-700',
      badgeBg: 'bg-emerald-100',
      badgeText: 'text-emerald-700',
      btnBg: 'bg-emerald-600 hover:bg-emerald-700',
      title: 'Retail / Consumer Search Detected',
      description: `Your search "${query}" looks like a retail purchase. B2C mode shows direct product listings with WhatsApp sharing.`,
    };
  } else if (isFinished) {
    theme = {
      ...theme,
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      icon: '🏭',
      titleColor: 'text-blue-800',
      textColor: 'text-blue-700',
      badgeBg: 'bg-blue-100',
      badgeText: 'text-blue-700',
      btnBg: 'bg-blue-600 hover:bg-blue-700',
      title: 'Finished Product Search Detected',
      description: `Showing factories and manufacturers that produce finished goods matching "${query}".`,
    };
  } else if (isRaw) {
    theme = {
      ...theme,
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      icon: '⚙️',
      titleColor: 'text-emerald-800',
      textColor: 'text-emerald-700',
      badgeBg: 'bg-emerald-100',
      badgeText: 'text-emerald-700',
      btnBg: 'bg-emerald-600 hover:bg-emerald-700',
      title: 'Raw Material Search Detected',
      description: `Showing raw material suppliers and related factories for "${query}".`,
    };
  }

  return (
    <div className={`mb-4 rounded-xl border ${theme.bg} ${theme.border} overflow-hidden`}>
      <div className="flex items-start gap-3 px-4 py-3">
        <span className="text-xl shrink-0 mt-0.5">{theme.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <p className={`text-xs font-bold ${theme.titleColor}`}>{theme.title}</p>
            {confidence !== 'low' && (
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${theme.badgeBg} ${theme.badgeText} uppercase tracking-wide`}>
                {confidence} confidence
              </span>
            )}
          </div>
          <p className={`text-xs ${theme.textColor} mb-2`}>{theme.description}</p>

          {/* Detected signals */}
          {signals.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {signals.slice(0, 5).map((sig) => (
                <span key={sig} className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${theme.badgeBg} ${theme.badgeText}`}>
                  {sig}
                </span>
              ))}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {isB2B && currentBuyerMode !== 'b2b' && (
              <button
                onClick={() => onSwitchMode('b2b')}
                className={`text-[10px] font-bold px-3 py-1.5 ${theme.btnBg} text-white rounded-lg transition-colors`}
              >
                Switch to B2B Mode
              </button>
            )}
            {isB2C && currentBuyerMode !== 'b2c' && (
              <button
                onClick={() => onSwitchMode('b2c')}
                className={`text-[10px] font-bold px-3 py-1.5 ${theme.btnBg} text-white rounded-lg transition-colors`}
              >
                Switch to B2C Mode
              </button>
            )}
            {(isFinished || isRaw) && currentTab !== 'factories' && (
              <button
                onClick={() => onSwitchTab('factories')}
                className={`text-[10px] font-bold px-3 py-1.5 ${theme.btnBg} text-white rounded-lg transition-colors`}
              >
                Browse Factories
              </button>
            )}
            {isB2B && (
              <Link
                href="/rfq/create"
                className="text-[10px] font-bold px-3 py-1.5 bg-foreground text-primary-foreground rounded-lg hover:bg-foreground/90 transition-colors"
              >
                Post RFQ
              </Link>
            )}
          </div>
        </div>
        <button
          onClick={onDismiss}
          className={`shrink-0 w-6 h-6 flex items-center justify-center rounded-full transition-colors ${theme.textColor} hover:opacity-60`}
          aria-label="Dismiss"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* Progress bar showing B2B vs B2C score balance */}
      {(intentScore.b2bScore > 0 || intentScore.b2cScore > 0) && (
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-bold text-muted-foreground w-6 text-right">B2C</span>
            <div className="flex-1 h-1.5 bg-black/10 rounded-full overflow-hidden flex">
              {(() => {
                const total = intentScore.b2bScore + intentScore.b2cScore;
                const b2bPct = total > 0 ? Math.round((intentScore.b2bScore / total) * 100) : 50;
                const b2cPct = 100 - b2bPct;
                return (
                  <>
                    <div className="bg-emerald-500 h-full transition-all duration-500" style={{ width: `${b2cPct}%` }} />
                    <div className="bg-amber-500 h-full transition-all duration-500" style={{ width: `${b2bPct}%` }} />
                  </>
                );
              })()}
            </div>
            <span className="text-[9px] font-bold text-muted-foreground w-6">B2B</span>
          </div>
        </div>
      )}
    </div>
  );
};

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

// ─── Product Card ─────────────────────────────────────────────────────────────
const ProductCard: React.FC<{ product: SearchProduct; view: 'grid' | 'list'; inStockLabel: string; buyerMode: 'b2c' | 'b2b' }> = ({ product, view, inStockLabel, buyerMode }) => {
  const imageUrl = product.image_url || 'https://img.rocket.new/generatedImages/rocket_gen_img_1e59a0c95-1772134956918.png';
  const companyName = product.user_profiles?.company_name || product.user_profiles?.full_name || 'Verified Supplier';
  const rating = product.rating || 4.2;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://direct-hub.net';
  const productUrl = `${siteUrl}/product/${product.id}`;
  const arMsg = `اكتشف هذا المنتج الحصري وأفضل عروض المصانع العالمية في دايركت هب:\n${productUrl}`;
  const enMsg = `Check out this exclusive product and top global factory offers on DirectHub:\n${productUrl}`;
  const waShareUrl = `https://wa.me/?text=${encodeURIComponent(enMsg)}`;
  const waShareUrlAr = `https://wa.me/?text=${encodeURIComponent(arMsg)}`;

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
                <h3 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors line-clamp-1">{product.name}</h3>
              </Link>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{companyName} · {product.origin_country}</p>
            </div>
            <span className="text-[10px] font-semibold px-2 py-0.5 bg-muted text-muted-foreground rounded-full shrink-0 capitalize whitespace-nowrap hidden sm:inline-flex">
              {product.category?.replace('_', ' ')}
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
          {/* B2B MOQ badge */}
          {buyerMode === 'b2b' && (
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-[9px] font-bold px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full flex items-center gap-1">
                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                MOQ: {product.minimum_order_qty.toLocaleString()} {product.unit}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between flex-wrap gap-1">
            <div className="flex items-end gap-2 sm:gap-3 flex-wrap">
              <div>
                <span className="text-base sm:text-lg font-bold text-foreground">${Number(product.unit_price || 0).toLocaleString()}</span>
                <span className="text-xs text-muted-foreground ml-1">/{product.unit}</span>
              </div>
              {buyerMode === 'b2c' && (
                <div className="text-xs text-muted-foreground">
                  MOQ: <span className="font-semibold text-foreground">{product.minimum_order_qty.toLocaleString()} {product.unit}</span>
                </div>
              )}
              {product.delivery_time_days && (
                <div className="text-xs text-muted-foreground hidden sm:block">
                  <span className="font-semibold text-foreground">{product.delivery_time_days}d</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <StarRating rating={rating} />
                <span className="text-xs font-semibold text-foreground">{rating.toFixed(1)}</span>
              </div>
              {/* B2B: RFQ button | B2C: WhatsApp share */}
              {buyerMode === 'b2b' ? (
                <Link
                  href={`/rfq/${product.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1 px-2 py-1 bg-foreground/10 text-foreground text-[10px] font-bold rounded-lg border border-border hover:bg-foreground/20 transition-colors shrink-0"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  <span className="hidden sm:inline">RFQ</span>
                </Link>
              ) : (
                <a
                  href={waShareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1 px-2 py-1 bg-[#25D366]/10 text-[#128C7E] text-[10px] font-bold rounded-lg border border-[#25D366]/30 hover:bg-[#25D366]/20 transition-colors shrink-0"
                  title="Share on WhatsApp"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  <span className="hidden sm:inline">Share</span>
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Grid View: Alibaba/1688-style card ──
  const isVerified = true;
  const isReadyToShip = product.inventory_status === 'in_stock';
  const b2bPriceMin = (Number(product.unit_price || 0) * 0.85).toFixed(2);
  const b2bPriceMax = Number(product.unit_price || 0).toFixed(2);
  const b2cPrice = (Number(product.unit_price || 0) * 1.15).toFixed(2);
  const txVolume = Math.floor((product.id?.charCodeAt(0) || 5) * 7 + 50);

  return (
    <div className="group bg-card border border-border rounded-xl overflow-hidden hover:border-primary/40 hover:shadow-lg transition-all duration-200 flex flex-col">
      {/* Image Area */}
      <Link href={`/product/${product.id}`} className="block relative aspect-square bg-muted overflow-hidden shrink-0">
        <AppImage
          src={imageUrl}
          alt={product.name}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-300"
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
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
        {product.category && (
          <div className="absolute top-2 right-2">
            <span className="px-2 py-0.5 bg-black/50 backdrop-blur-sm text-white text-[9px] font-semibold rounded-full capitalize">
              {product.category.replace(/_/g, ' ')}
            </span>
          </div>
        )}
        {buyerMode === 'b2b' && product.minimum_order_qty >= 10 && (
          <div className="absolute bottom-2 left-2">
            <span className="px-2 py-0.5 bg-amber-500 text-white text-[9px] font-bold rounded-full">شراء بالجملة</span>
          </div>
        )}
      </Link>

      {/* Content */}
      <div className="p-2.5 flex flex-col flex-1 gap-1.5">
        {/* Title */}
        <Link href={`/product/${product.id}`} className="block">
          <h3 className="text-xs font-bold text-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors" dir="rtl">
            {product.name_ar || product.name}
          </h3>
          {product.name_ar && (
            <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">{product.name}</p>
          )}
        </Link>

        {/* Dual Pricing */}
        <div className="bg-muted/40 rounded-lg px-2 py-1.5">
          {buyerMode === 'b2b' ? (
            <>
              <div className="flex items-baseline gap-1">
                <span className="text-sm font-extrabold text-primary">${b2bPriceMin}</span>
                <span className="text-xs text-muted-foreground">-</span>
                <span className="text-sm font-extrabold text-primary">${b2bPriceMax}</span>
              </div>
              <div className="flex items-center gap-1 mt-0.5" dir="rtl">
                <svg className="w-2.5 h-2.5 text-amber-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
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

        {/* Supplier Info */}
        <div className="flex items-center gap-1.5" dir="rtl">
          <div className="w-4 h-4 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <svg className="w-2.5 h-2.5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <span className="text-[10px] text-muted-foreground font-medium truncate">{companyName}</span>
          <svg className="w-3 h-3 text-blue-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        </div>

        {/* Ratings & Metrics */}
        <div className="flex items-center gap-1.5" dir="rtl">
          <StarRating rating={rating} />
          <span className="text-[10px] font-bold text-foreground">{rating.toFixed(1)}</span>
          <span className="text-[10px] text-muted-foreground ml-auto">{txVolume}+ صفقة</span>
        </div>

        {/* Action Footer */}
        <div className="flex gap-1 mt-auto pt-0.5">
          {buyerMode === 'b2b' ? (
            <>
              <Link
                href={`/messaging?productId=${encodeURIComponent(product.id)}`}
                onClick={(e) => e.stopPropagation()}
                className="flex-1 flex items-center justify-center gap-0.5 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-bold rounded-lg hover:bg-emerald-100 transition-colors"
                dir="rtl"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 shrink-0">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                دردشة
              </Link>
              <Link
                href={`/rfq/${product.id}`}
                onClick={(e) => e.stopPropagation()}
                className="flex-1 flex items-center justify-center gap-0.5 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 text-[9px] font-bold rounded-lg hover:bg-amber-100 transition-colors"
                dir="rtl"
              >
                <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                عرض سعر
              </Link>
              <Link
                href={`/product/${product.id}`}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center justify-center px-2.5 py-1.5 bg-primary text-primary-foreground text-[9px] font-bold rounded-lg hover:opacity-90 transition-opacity"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/cart"
                onClick={(e) => e.stopPropagation()}
                className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-primary text-primary-foreground text-[9px] font-bold rounded-lg hover:opacity-90 transition-opacity"
                dir="rtl"
              >
                <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                أضف للسلة
              </Link>
              <a
                href={waShareUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center justify-center px-2.5 py-1.5 bg-[#25D366]/10 text-[#128C7E] border border-[#25D366]/30 text-[9px] font-bold rounded-lg hover:bg-[#25D366]/20 transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
              </a>
            </>
          )}
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
          {factory.country || 'Unknown'}
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
      {(factory.avg_rating || 0) > 0 && (
        <div className="flex items-center gap-1.5">
          <StarRating rating={factory.avg_rating || 0} size={11} />
          <span className="text-xs font-semibold text-foreground">{(factory.avg_rating || 0).toFixed(1)}</span>
        </div>
      )}
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
  const rat = t.search.rating;
  const avail = t.search.availability;
  const del = t.search.delivery;

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

  const RATING_OPTIONS = [
    { value: '', label: rat.any },
    { value: '4', label: rat['4'] },
    { value: '3', label: rat['3'] },
    { value: '2', label: rat['2'] },
  ];

  const DELIVERY_OPTIONS = [
    { value: 'all', label: del.all },
    { value: '7', label: del['7'] },
    { value: '14', label: del['14'] },
    { value: '30', label: del['30'] },
    { value: '60', label: del['60'] },
  ];

  const AVAILABILITY_OPTIONS = [
    { value: 'all', label: avail.all },
    { value: 'in_stock', label: avail.in_stock },
    { value: 'low_stock', label: avail.low_stock },
    { value: 'out_of_stock', label: avail.out_of_stock },
  ];

  return (
    <aside className="w-full space-y-4">
      {/* Header */}
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

      {/* Supplier Type */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-2.5">
        <p className="text-xs font-bold text-foreground uppercase tracking-wide">{fl.supplierType}</p>
        <div className="space-y-1.5">
          {SUPPLIER_TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onChange('supplierType', opt.value)}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-between ${
                filters.supplierType === opt.value
                  ? 'bg-primary/10 text-primary border border-primary/30' :'text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent'
              }`}
            >
              <span>{opt.label}</span>
              {filters.supplierType === opt.value && <Icon name="CheckIcon" size={12} className="text-primary" />}
            </button>
          ))}
        </div>
      </div>

      {/* ── B2B / B2C Sales Model Filter (products only) ── */}
      {activeTab === 'products' && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-2.5">
          <p className="text-xs font-bold text-foreground uppercase tracking-wide">نوع البيع</p>
          <div className="space-y-1.5">
            {[
              { value: 'all', label: 'الكل', icon: '🌐' },
              { value: 'B2B', label: 'B2B — طلبات الجملة والمصانع', icon: '🏭' },
              { value: 'B2C', label: 'B2C — منتجات جاهزة للشحن', icon: '🛍️' },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => onChange('salesModel', opt.value)}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-between gap-2 ${
                  (filters.salesModel === opt.value || (opt.value === 'all' && !filters.salesModel))
                    ? 'bg-primary/10 text-primary border border-primary/30' :'text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <span>{opt.icon}</span>
                  <span>{opt.label}</span>
                </span>
                {(filters.salesModel === opt.value || (opt.value === 'all' && !filters.salesModel)) && (
                  <svg className="w-3 h-3 text-primary shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Category — products only */}
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

      {/* Industry Sector — factories only (reads industry_sectors / sector_products) */}
      {activeTab === 'factories' && sectors.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-2.5">
          <p className="text-xs font-bold text-foreground uppercase tracking-wide">
            {isRTL ? 'القطاع الصناعي' : 'Industry Sector'}
          </p>
          <select
            value={filters.sectorId || 'all'}
            onChange={(e) => {
              onChange('sectorId', e.target.value);
              onChange('sectorProduct', 'all');
            }}
            className="w-full h-9 px-3 rounded-lg border border-border bg-background text-foreground text-xs font-medium focus:outline-none focus:border-primary"
          >
            <option value="all">{isRTL ? 'جميع القطاعات' : 'All sectors'}</option>
            {sectors.map((s) => (
              <option key={s.id} value={s.id}>
                {isRTL ? s.name_ar : (s.name_en || s.name_ar)}
              </option>
            ))}
          </select>
          {filters.sectorId && filters.sectorId !== 'all' && sectorProducts.length > 0 && (
            <select
              value={filters.sectorProduct || 'all'}
              onChange={(e) => onChange('sectorProduct', e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-border bg-background text-foreground text-xs font-medium focus:outline-none focus:border-primary"
            >
              <option value="all">{isRTL ? 'جميع المنتجات' : 'All products'}</option>
              {sectorProducts.map((sp) => (
                <option key={sp.id} value={isRTL ? sp.name_ar : (sp.name_en || sp.name_ar)}>
                  {isRTL ? sp.name_ar : (sp.name_en || sp.name_ar)}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Supplier Location */}
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

      {/* Minimum Rating */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-2.5">
        <p className="text-xs font-bold text-foreground uppercase tracking-wide">{fl.minimumRating}</p>
        <div className="space-y-1.5">
          {RATING_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onChange('minRating', opt.value)}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-between ${
                filters.minRating === opt.value
                  ? 'bg-primary/10 text-primary border border-primary/30' :'text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent'
              }`}
            >
              <span>{opt.label}</span>
              {filters.minRating === opt.value && <Icon name="CheckIcon" size={12} className="text-primary" />}
            </button>
          ))}
        </div>
      </div>

      {/* Products-only filters */}
      {activeTab === 'products' && (
        <>
          {/* Specs Keyword */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-2.5">
            <p className="text-xs font-bold text-foreground uppercase tracking-wide">{fl.specifications}</p>
            <input
              type="text"
              placeholder={fl.specsPlaceholder}
              value={filters.specsKeyword}
              onChange={(e) => onChange('specsKeyword', e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-border bg-background text-foreground text-xs focus:outline-none focus:border-primary placeholder:text-muted-foreground"
            />
            <p className="text-[10px] text-muted-foreground">{fl.specsHint}</p>
          </div>

          {/* Price Range */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-2.5">
            <p className="text-xs font-bold text-foreground uppercase tracking-wide">{fl.priceRange}</p>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <label className="text-[10px] text-muted-foreground mb-1 block">{fl.min}</label>
                <input
                  type="number"
                  placeholder="0"
                  value={filters.priceMin}
                  onChange={(e) => onChange('priceMin', e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-border bg-background text-foreground text-xs focus:outline-none focus:border-primary"
                  min="0"
                />
              </div>
              <div className="text-muted-foreground text-xs mt-4">—</div>
              <div className="flex-1">
                <label className="text-[10px] text-muted-foreground mb-1 block">{fl.max}</label>
                <input
                  type="number"
                  placeholder={fl.any}
                  value={filters.priceMax}
                  onChange={(e) => onChange('priceMax', e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-border bg-background text-foreground text-xs focus:outline-none focus:border-primary"
                  min="0"
                />
              </div>
            </div>
          </div>

          {/* MOQ Range */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-2.5">
            <p className="text-xs font-bold text-foreground uppercase tracking-wide">{fl.moqRange}</p>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <label className="text-[10px] text-muted-foreground mb-1 block">{fl.min}</label>
                <input
                  type="number"
                  placeholder="0"
                  value={filters.moqMin}
                  onChange={(e) => onChange('moqMin', e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-border bg-background text-foreground text-xs focus:outline-none focus:border-primary"
                  min="0"
                />
              </div>
              <div className="text-muted-foreground text-xs mt-4">—</div>
              <div className="flex-1">
                <label className="text-[10px] text-muted-foreground mb-1 block">{fl.max}</label>
                <input
                  type="number"
                  placeholder={fl.any}
                  value={filters.moqMax}
                  onChange={(e) => onChange('moqMax', e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-border bg-background text-foreground text-xs focus:outline-none focus:border-primary"
                  min="0"
                />
              </div>
            </div>
          </div>

          {/* Certifications */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-2.5">
            <p className="text-xs font-bold text-foreground uppercase tracking-wide">{fl.certifications}</p>
            <div className="space-y-1.5">
              {CERTIFICATION_OPTIONS.map((cert) => {
                const checked = filters.certifications.includes(cert);
                return (
                  <label key={cert} className="flex items-center gap-2.5 cursor-pointer group">
                    <div
                      onClick={() => {
                        const next = checked
                          ? filters.certifications.filter((c) => c !== cert)
                          : [...filters.certifications, cert];
                        onChange('certifications', next);
                      }}
                      className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                        checked ? 'bg-primary border-primary' : 'border-border group-hover:border-primary/50'
                      }`}
                    >
                      {checked && (
                        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                          <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                    <span
                      onClick={() => {
                        const next = checked
                          ? filters.certifications.filter((c) => c !== cert)
                          : [...filters.certifications, cert];
                        onChange('certifications', next);
                      }}
                      className="text-xs text-muted-foreground group-hover:text-foreground transition-colors cursor-pointer"
                    >
                      {cert}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Delivery Time */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-2.5">
            <p className="text-xs font-bold text-foreground uppercase tracking-wide">{fl.deliveryTime}</p>
            <div className="space-y-1.5">
              {DELIVERY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => onChange('deliveryTime', opt.value)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-between ${
                    filters.deliveryTime === opt.value
                      ? 'bg-primary/10 text-primary border border-primary/30' :'text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent'
                  }`}
                >
                  <span>{opt.label}</span>
                  {filters.deliveryTime === opt.value && <Icon name="CheckIcon" size={12} className="text-primary" />}
                </button>
              ))}
            </div>
          </div>

          {/* Availability */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-2.5">
            <p className="text-xs font-bold text-foreground uppercase tracking-wide">{fl.availability}</p>
            <div className="space-y-1.5">
              {AVAILABILITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => onChange('inventoryStatus', opt.value)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-between ${
                    filters.inventoryStatus === opt.value
                      ? 'bg-primary/10 text-primary border border-primary/30' :'text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent'
                  }`}
                >
                  <span>{opt.label}</span>
                  {filters.inventoryStatus === opt.value && <Icon name="CheckIcon" size={12} className="text-primary" />}
                </button>
              ))}
            </div>
          </div>

          {/* Sample & Warranty */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <p className="text-xs font-bold text-foreground uppercase tracking-wide">{fl.productDetails}</p>
            <label className="flex items-center gap-2.5 cursor-pointer group">
              <div
                onClick={() => onChange('sampleAvailable', !filters.sampleAvailable)}
                className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                  filters.sampleAvailable ? 'bg-primary border-primary' : 'border-border group-hover:border-primary/50'
                }`}
              >
                {filters.sampleAvailable && (
                  <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                    <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <span
                onClick={() => onChange('sampleAvailable', !filters.sampleAvailable)}
                className="text-xs text-muted-foreground group-hover:text-foreground transition-colors cursor-pointer"
              >
                {fl.sampleAvailable}
              </span>
            </label>
            <div>
              <label className="text-[10px] text-muted-foreground mb-1 block">{fl.minWarranty}</label>
              <input
                type="number"
                placeholder="e.g. 12"
                value={filters.warrantyMin}
                onChange={(e) => onChange('warrantyMin', e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-border bg-background text-foreground text-xs focus:outline-none focus:border-primary"
                min="0"
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground mb-1 block">{fl.maxWeight}</label>
              <input
                type="number"
                placeholder="e.g. 100"
                value={filters.weightMax}
                onChange={(e) => onChange('weightMax', e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-border bg-background text-foreground text-xs focus:outline-none focus:border-primary"
                min="0"
              />
            </div>
          </div>

        </>
      )}
    </aside>
  );
};

// ─── Active Filter Tags ───────────────────────────────────────────────────────
const ActiveFilterTags: React.FC<{
  filters: FilterState;
  onChange: (key: keyof FilterState, value: any) => void;
  t: any;
}> = ({ filters, onChange, t }) => {
  const tags: { label: string; onRemove: () => void }[] = [];
  const st = t.search.supplierType;
  const cats = t.search.categories;
  const del = t.search.delivery;

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

  const DELIVERY_OPTIONS = [
    { value: 'all', label: del.all },
    { value: '7', label: del['7'] },
    { value: '14', label: del['14'] },
    { value: '30', label: del['30'] },
    { value: '60', label: del['60'] },
  ];

  if (filters.supplierType !== 'all') {
    const s = SUPPLIER_TYPE_OPTIONS.find((x) => x.value === filters.supplierType);
    tags.push({ label: s?.label || filters.supplierType, onRemove: () => onChange('supplierType', 'all') });
  }
  if (filters.category !== 'all') {
    const cat = CATEGORY_OPTIONS.find((c) => c.value === filters.category);
    tags.push({ label: cat?.label || filters.category, onRemove: () => onChange('category', 'all') });
  }
  if (filters.country !== 'all') {
    tags.push({ label: `📍 ${filters.country}`, onRemove: () => onChange('country', 'all') });
  }
  if (filters.minRating) {
    tags.push({ label: `⭐ ${filters.minRating}+`, onRemove: () => onChange('minRating', '') });
  }
  if (filters.specsKeyword) {
    tags.push({ label: `🔧 "${filters.specsKeyword}"`, onRemove: () => onChange('specsKeyword', '') });
  }
  if (filters.priceMin) {
    tags.push({ label: `Min $${filters.priceMin}`, onRemove: () => onChange('priceMin', '') });
  }
  if (filters.priceMax) {
    tags.push({ label: `Max $${filters.priceMax}`, onRemove: () => onChange('priceMax', '') });
  }
  if (filters.moqMin) {
    tags.push({ label: `MOQ ≥ ${filters.moqMin}`, onRemove: () => onChange('moqMin', '') });
  }
  if (filters.moqMax) {
    tags.push({ label: `MOQ ≤ ${filters.moqMax}`, onRemove: () => onChange('moqMax', '') });
  }
  filters.certifications.forEach((cert) => {
    tags.push({ label: cert, onRemove: () => onChange('certifications', filters.certifications.filter((c) => c !== cert)) });
  });
  if (filters.deliveryTime !== 'all') {
    const d = DELIVERY_OPTIONS.find((x) => x.value === filters.deliveryTime);
    tags.push({ label: `🚚 ${d?.label}`, onRemove: () => onChange('deliveryTime', 'all') });
  }
  if (filters.inventoryStatus !== 'all') {
    tags.push({ label: `📦 ${filters.inventoryStatus.replace('_', ' ')}`, onRemove: () => onChange('inventoryStatus', 'all') });
  }
  if (filters.sampleAvailable) {
    tags.push({ label: `🧪 ${t.search.filterLabels.sampleAvailable}`, onRemove: () => onChange('sampleAvailable', false) });
  }
  if (filters.warrantyMin) {
    tags.push({ label: `🛡️ ≥ ${filters.warrantyMin}mo`, onRemove: () => onChange('warrantyMin', '') });
  }
  if (filters.weightMax) {
    tags.push({ label: `⚖️ ≤ ${filters.weightMax}kg`, onRemove: () => onChange('weightMax', '') });
  }
  if (filters.salesModel && filters.salesModel !== 'all') {
    tags.push({ label: filters.salesModel === 'B2B' ? '🏭 B2B' : '🛍️ B2C', onRemove: () => onChange('salesModel', 'all') });
  }

  if (tags.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {tags.map((tag, i) => (
        <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 text-primary text-xs font-semibold rounded-full border border-primary/20">
          {tag.label}
          <button onClick={tag.onRemove} className="hover:text-primary/60 transition-colors">
            <Icon name="XMarkIcon" size={12} />
          </button>
        </span>
      ))}
    </div>
  );
};

// ─── Bilingual keyword map (Arabic → English synonyms) ───────────────────────
const BILINGUAL_KEYWORD_MAP: Record<string, string[]> = {
  'عسل': ['honey', 'sidr', 'yemeni honey'],
  'زيت': ['oil', 'cooking oil', 'vegetable oil'],
  'طعام': ['food', 'cooking', 'ingredient'],
  'مضخة': ['pump', 'water pump', 'industrial pump'],
  'مياه': ['water', 'pump'],
  'قهوة': ['coffee', 'arabica', 'mocha'],
  'شاي': ['tea'],
  'تمر': ['dates', 'palm dates'],
  'أرز': ['rice'],
  'سكر': ['sugar'],
  'ملح': ['salt'],
  'دقيق': ['flour', 'wheat flour'],
  'بن': ['coffee', 'arabica'],
  'حديد': ['steel', 'iron', 'metal'],
  'نسيج': ['textile', 'fabric', 'cloth'],
  'ملابس': ['clothing', 'garment', 'apparel'],
  'أثاث': ['furniture'],
  'إلكترونيات': ['electronics'],
  'آلات': ['machinery', 'machine', 'equipment'],
  'كيماويات': ['chemicals', 'chemical'],
  'بناء': ['construction', 'building'],
  'طاقة': ['energy', 'solar', 'power'],
  'طبي': ['medical', 'pharmaceutical'],
  'تغليف': ['packaging', 'packing'],
  'سيارات': ['automotive', 'auto', 'vehicle'],
};

/** Returns true if the query contains Arabic characters */
function isArabicQuery(q: string): boolean {
  return /[\u0600-\u06FF]/.test(q);
}

/** Given an Arabic (or mixed) query, returns all English synonym terms */
function getEnglishSynonyms(q: string): string[] {
  const lower = q.toLowerCase().trim();
  const synonyms: string[] = [];
  for (const [arabicWord, englishTerms] of Object.entries(BILINGUAL_KEYWORD_MAP)) {
    if (lower.includes(arabicWord)) {
      synonyms.push(...englishTerms);
    }
  }
  return synonyms;
}

/** Client-side bilingual product match */
function productMatchesQuery(product: SearchProduct & { description_ar?: string; tags?: any }, query: string): boolean {
  if (!query.trim()) return true;
  const lower = query.toLowerCase().trim();
  const synonyms = getEnglishSynonyms(query);
  const allTerms = [lower, ...synonyms];

  const searchableText = [
    product.name,
    product.name_ar,
    product.description,
    (product as any).description_ar,
    product.category,
    Array.isArray((product as any).tags)
      ? (product as any).tags.join(' ')
      : typeof (product as any).tags === 'string'
      ? (product as any).tags
      : '',
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return allTerms.some((term) => searchableText.includes(term));
}

// ─── Main Search Results ──────────────────────────────────────────────────────
function SearchResults() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { t } = useLanguage();

  const queryParam = searchParams.get('q') || '';
  const categoryParam = searchParams.get('category') || 'all';
  const tabParam = (searchParams.get('tab') as 'products' | 'factories') || 'products';
  const scopeParam = searchParams.get('scope') || 'all';

  const LOCAL_COUNTRY_IDS = ['SA', 'Saudi Arabia', 'المملكة العربية السعودية', 'KSA', 'saudi arabia'];

  const [inputValue, setInputValue] = useState(queryParam);
  const [query, setQuery] = useState(queryParam);
  const [activeTab, setActiveTab] = useState<'products' | 'factories'>(tabParam);
  const [scopeFilter, setScopeFilter] = useState<'all' | 'local' | 'global'>(
    scopeParam as 'all' | 'local' | 'global'
  );
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
  const [buyerMode, setBuyerMode] = useState<'b2c' | 'b2b'>('b2c');
  const [intentBannerDismissed, setIntentBannerDismissed] = useState(false);
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
    setScopeFilter(scopeParam as 'all' | 'local' | 'global');
  }, [scopeParam]);

  useEffect(() => {
    setActiveTab(tabParam);
  }, [tabParam]);

  // ─── Dual-mode B2B/B2C intent detection ──────────────────────────────────
  const intentScore = useMemo(() => analyzeSearchIntentFull(query), [query]);
  let searchIntent = intentScore.searchIntent;

  // Auto-route based on detected intent
  useEffect(() => {
    if (!query.trim()) return;
    setIntentBannerDismissed(false);

    // Auto-set buyer mode based on detected buyer intent (only if high/medium confidence)
    if (intentScore.confidence !== 'low') {
      if (intentScore.buyerIntent === 'b2b') {
        setBuyerMode('b2b');
      } else if (intentScore.buyerIntent === 'b2c') {
        setBuyerMode('b2c');
      }
    }

    // Auto-route tab based on search intent (product type)
    if (searchIntent === 'finished_product') {
      setActiveTab('factories');
      setFilters((prev) => ({ ...prev, supplierType: 'all' }));
    } else if (searchIntent === 'raw_material') {
      setActiveTab('factories');
      setFilters((prev) => ({ ...prev, supplierType: 'local_supplier' }));
    }
  }, [intentScore, query, searchIntent]);

  const fetchProducts = useCallback(async () => {
    setDbLoading(true);
    try {
      const trimmedQuery = query.trim();
      const arabic = isArabicQuery(trimmedQuery);
      const synonyms = arabic ? getEnglishSynonyms(trimmedQuery) : [];

      let q = supabase
        .from('manufacturer_products')
        .select('id, name, name_ar, image_url, unit_price, minimum_order_qty, unit, origin_country, category, is_active, seller_badge, description, description_ar, inventory_status, created_at, manufacturer_id, tags, sales_model, user_profiles!manufacturer_products_manufacturer_id_fkey(full_name, company_name, seller_category)')
        .eq('is_active', true);

      if (trimmedQuery) {
        if (arabic) {
          const orParts: string[] = [
            `name_ar.ilike.%${trimmedQuery}%`,
            `description_ar.ilike.%${trimmedQuery}%`,
          ];
          synonyms.forEach((syn) => {
            orParts.push(`name.ilike.%${syn}%`);
            orParts.push(`description.ilike.%${syn}%`);
          });
          q = q.or(orParts.join(','));
        } else {
          q = q.or(`name.ilike.%${trimmedQuery}%,name_ar.ilike.%${trimmedQuery}%,description.ilike.%${trimmedQuery}%`);
        }
      }

      if (filters.category !== 'all') q = q.eq('category', filters.category);
      if (filters.country !== 'all') q = q.eq('origin_country', filters.country);
      if (filters.priceMin) q = q.gte('unit_price', parseFloat(filters.priceMin));
      if (filters.priceMax) q = q.lte('unit_price', parseFloat(filters.priceMax));
      if (filters.moqMin) q = q.gte('minimum_order_qty', parseInt(filters.moqMin));
      if (filters.moqMax) q = q.lte('minimum_order_qty', parseInt(filters.moqMax));

      if (scopeFilter === 'local') {
        q = q.in('origin_country', LOCAL_COUNTRY_IDS);
      } else if (scopeFilter === 'global') {
        q = q.not('origin_country', 'in', `(${LOCAL_COUNTRY_IDS.join(',')})`);
      }

      const { data, error } = await q.limit(80);
      if (!error && data) {
        const finalData = trimmedQuery
          ? data.filter((p: any) => productMatchesQuery(p, trimmedQuery))
          : data;
        setDbProducts(finalData);
        const uniqueCountries = [...new Set(finalData.map((p: any) => p.origin_country).filter(Boolean))];
        setCountries(uniqueCountries);
      }
    } catch {
      // keep fallback
    } finally {
      setDbLoading(false);
    }
  }, [query, filters.category, filters.country, filters.priceMin, filters.priceMax, filters.moqMin, filters.moqMax, scopeFilter]);

  const fetchFactories = useCallback(async () => {
    setDbLoading(true);
    try {
      let q = supabase
        .from('user_profiles')
        .select('id, full_name, company_name, country, seller_category, avatar_url, created_at')
        .in('role', ['manufacturer', 'supplier', 'factory']);

      if (query.trim()) {
        q = q.or(`full_name.ilike.%${query.trim()}%,company_name.ilike.%${query.trim()}%,country.ilike.%${query.trim()}%`);
      }
      if (filters.country !== 'all') q = q.eq('country', filters.country);
      if (filters.supplierType !== 'all') q = q.eq('seller_category', filters.supplierType);

      // Sector / sector-product filter: resolve matching factory owners via factory_registrations
      if (filters.sectorId && filters.sectorId !== 'all') {
        let regQ = supabase
          .from('factory_registrations')
          .select('user_id')
          .eq('sector_id', filters.sectorId);
        if (filters.sectorProduct && filters.sectorProduct !== 'all') {
          regQ = regQ.contains('main_products', [filters.sectorProduct]);
        }
        const { data: regRows } = await regQ.limit(500);
        const ownerIds = (regRows || []).map((r: any) => r.user_id).filter(Boolean);
        if (ownerIds.length === 0) {
          setDbFactories([]);
          setDbLoading(false);
          return;
        }
        q = q.in('id', ownerIds);
      }

      const { data, error } = await q.limit(50);
      if (!error && data && data.length > 0) {
        const factoryIds = data.map((f: any) => f.id);
        const { data: productsData } = await supabase
          .from('manufacturer_products')
          .select('manufacturer_id')
          .in('manufacturer_id', factoryIds)
          .eq('is_active', true);

        const countMap: Record<string, number> = {};
        (productsData || []).forEach((p: any) => {
          countMap[p.manufacturer_id] = (countMap[p.manufacturer_id] || 0) + 1;
        });

        const enriched = data.map((factory: any) => ({
          ...factory,
          product_count: countMap[factory.id] || 0,
        }));
        setDbFactories(enriched);
      } else if (!error && filters.sectorId && filters.sectorId !== 'all') {
        setDbFactories([]);
      }
    } catch {
      // keep fallback
    } finally {
      setDbLoading(false);
    }
  }, [query, filters.country, filters.supplierType, filters.sectorId, filters.sectorProduct]);

  useEffect(() => {
    if (activeTab === 'products') {
      fetchProducts();
    } else {
      fetchFactories();
    }
  }, [activeTab, fetchProducts, fetchFactories]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputValue.trim();
    setQuery(trimmed);
    const params = new URLSearchParams();
    if (trimmed) params.set('q', trimmed);
    if (filters.category !== 'all') params.set('category', filters.category);
    params.set('tab', activeTab);
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

  const handleTabChange = (tab: 'products' | 'factories') => {
    setActiveTab(tab);
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    params.set('tab', tab);
    router.push(`/search?${params.toString()}`);
  };

  const productResults = useMemo(() => {
    let filtered = [...dbProducts];

    if (filters.priceMin) filtered = filtered.filter((p) => Number(p.unit_price || 0) >= parseFloat(filters.priceMin));
    if (filters.priceMax) filtered = filtered.filter((p) => Number(p.unit_price || 0) <= parseFloat(filters.priceMax));
    if (filters.moqMin) filtered = filtered.filter((p) => Number(p.minimum_order_qty || 0) >= parseInt(filters.moqMin));
    if (filters.moqMax) filtered = filtered.filter((p) => Number(p.minimum_order_qty || 0) <= parseInt(filters.moqMax));
    if (filters.certifications.length > 0) {
      filtered = filtered.filter((p) =>
        filters.certifications.every((cert) => p.certifications?.includes(cert))
      );
    }
    if (filters.deliveryTime !== 'all') {
      const maxDays = parseInt(filters.deliveryTime);
      filtered = filtered.filter((p) => !p.delivery_time_days || p.delivery_time_days <= maxDays);
    }
    if (filters.minRating) {
      const minR = parseFloat(filters.minRating);
      filtered = filtered.filter((p) => (p.rating || 0) >= minR);
    }
    if (filters.specsKeyword.trim()) {
      const kw = filters.specsKeyword.trim().toLowerCase();
      filtered = filtered.filter((p) =>
        p.specifications_en?.toLowerCase().includes(kw) ||
        p.description?.toLowerCase().includes(kw) ||
        p.name?.toLowerCase().includes(kw)
      );
    }
    if (filters.supplierType !== 'all') {
      filtered = filtered.filter((p) => {
        const sellerCat = p.user_profiles?.seller_category;
        if (!sellerCat) return true;
        return sellerCat === filters.supplierType;
      });
    }
    if (filters.inventoryStatus !== 'all') {
      filtered = filtered.filter((p) => p.inventory_status === filters.inventoryStatus);
    }
    if (filters.sampleAvailable) {
      filtered = filtered.filter((p) => (p as any).sample_available === true);
    }
    if (filters.warrantyMin) {
      const minW = parseInt(filters.warrantyMin);
      filtered = filtered.filter((p) => ((p as any).warranty_months || 0) >= minW);
    }
    if (filters.weightMax) {
      const maxW = parseFloat(filters.weightMax);
      filtered = filtered.filter((p) => !((p as any).weight_kg) || (p as any).weight_kg <= maxW);
    }
    // Sales model filter (B2B / B2C)
    if (filters.salesModel && filters.salesModel !== 'all') {
      filtered = filtered.filter((p) => {
        const model = (p.sales_model || 'B2B').toUpperCase();
        return model === filters.salesModel!.toUpperCase();
      });
    }

    // B2B mode: sort by MOQ descending (bulk-friendly first)
    if (buyerMode === 'b2b' && filters.sortBy === 'relevance') {
      filtered = filtered.sort((a, b) => b.minimum_order_qty - a.minimum_order_qty);
    }

    switch (filters.sortBy) {
      case 'price_asc': return filtered.sort((a, b) => Number(a.unit_price || 0) - Number(b.unit_price || 0));
      case 'price_desc': return filtered.sort((a, b) => Number(b.unit_price || 0) - Number(a.unit_price || 0));
      case 'moq_asc': return filtered.sort((a, b) => a.minimum_order_qty - b.minimum_order_qty);
      case 'moq_desc': return filtered.sort((a, b) => b.minimum_order_qty - a.minimum_order_qty);
      case 'rating_desc': return filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));
      case 'newest': return filtered.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
      default: return filtered;
    }
  }, [dbProducts, filters, buyerMode]);

  const factoryResults = useMemo(() => {
    let filtered = [...dbFactories];
    if (filters.minRating) {
      const minR = parseFloat(filters.minRating);
      filtered = filtered.filter((f) => (f.avg_rating || 0) >= minR);
    }
    // Origin scope filter for factories
    if (scopeFilter === 'local') {
      filtered = filtered.filter((f) =>
        f.seller_category === 'local_factory' || f.seller_category === 'local_supplier'
      );
    } else if (scopeFilter === 'global') {
      filtered = filtered.filter((f) => f.seller_category === 'international_factory');
    }
    // Intent-based sorting: boost relevant factory types to the top
    if (searchIntent === 'finished_product') {
      filtered.sort((a, b) => {
        const aScore = (a.seller_category === 'local_factory' || a.seller_category === 'international_factory') ? 0 : 1;
        const bScore = (b.seller_category === 'local_factory' || b.seller_category === 'international_factory') ? 0 : 1;
        return aScore - bScore;
      });
    } else if (searchIntent === 'raw_material') {
      filtered.sort((a, b) => {
        const aScore = a.seller_category === 'local_supplier' ? 0 : 1;
        const bScore = b.seller_category === 'local_supplier' ? 0 : 1;
        return aScore - bScore;
      });
    }
    return filtered;
  }, [dbFactories, filters.minRating, searchIntent, scopeFilter]);

  const activeFilterCount = [
    filters.supplierType !== 'all',
    !!filters.sectorId && filters.sectorId !== 'all',
    filters.category !== 'all',
    !!filters.priceMin,
    !!filters.priceMax,
    !!filters.moqMin,
    !!filters.moqMax,
    filters.certifications.length > 0,
    filters.deliveryTime !== 'all',
    !!filters.minRating,
    !!filters.specsKeyword,
    filters.inventoryStatus !== 'all',
    filters.sampleAvailable,
    !!filters.warrantyMin,
    !!filters.weightMax,
    !!(filters.salesModel && filters.salesModel !== 'all'),
  ].filter(Boolean).length;

  const currentResults = activeTab === 'products' ? productResults : factoryResults;

  // ─── Origin filter counters (computed from loaded data, no extra fetch) ──────
  const originCounts = useMemo(() => {
    if (activeTab === 'products') {
      const all = dbProducts.length;
      const local = dbProducts.filter((p) =>
        LOCAL_COUNTRY_IDS.some((id) => (p.origin_country || '').toLowerCase() === id.toLowerCase())
      ).length;
      const international = dbProducts.filter((p) =>
        !LOCAL_COUNTRY_IDS.some((id) => (p.origin_country || '').toLowerCase() === id.toLowerCase())
      ).length;
      return { all, local, international };
    } else {
      const all = dbFactories.length;
      const local = dbFactories.filter((f) =>
        f.seller_category === 'local_factory' || f.seller_category === 'local_supplier'
      ).length;
      const international = dbFactories.filter((f) =>
        f.seller_category === 'international_factory'
      ).length;
      return { all, local, international };
    }
  }, [activeTab, dbProducts, dbFactories, LOCAL_COUNTRY_IDS]);

  // Translated options for tabs and sort
  const TABS = [
    { key: 'products', label: t.search.tabs.products, icon: 'CubeIcon' },
    { key: 'factories', label: t.search.tabs.factories, icon: 'BuildingOffice2Icon' },
  ];

  const SORT_OPTIONS = [
    { value: 'relevance', label: t.search.sort.relevance },
    { value: 'price_asc', label: t.search.sort.price_asc },
    { value: 'price_desc', label: t.search.sort.price_desc },
    { value: 'moq_asc', label: t.search.sort.moq_asc },
    { value: 'moq_desc', label: t.search.sort.moq_desc },
    { value: 'rating_desc', label: t.search.sort.rating_desc },
    { value: 'newest', label: t.search.sort.newest },
  ];

  const CATEGORY_OPTIONS_TRANSLATED = [
    { value: 'all', label: t.search.categories.all },
    { value: 'electronics', label: t.search.categories.electronics },
    { value: 'machinery', label: t.search.categories.machinery },
    { value: 'textiles', label: t.search.categories.textiles },
    { value: 'building', label: t.search.categories.building },
    { value: 'food', label: t.search.categories.food },
    { value: 'chemicals', label: t.search.categories.chemicals },
    { value: 'auto', label: t.search.categories.auto },
    { value: 'packaging', label: t.search.categories.packaging },
    { value: 'energy', label: t.search.categories.energy },
    { value: 'medical', label: t.search.categories.medical },
    { value: 'furniture', label: t.search.categories.furniture },
    { value: 'raw_materials', label: t.search.categories.raw_materials },
  ];

  const factoryCardLabels = {
    localFactory: t.search.factoryCard.localFactory,
    internationalFactory: t.search.factoryCard.internationalFactory,
    localSupplier: t.search.factoryCard.localSupplier,
    since: t.search.factoryCard.since,
    products: t.search.factoryCard.products,
  };

  // Results bar text
  const getResultsLabel = () => {
    if (query) {
      return (
        <p className="text-sm text-foreground">
          <span className="font-bold">{currentResults.length}</span> {t.search.resultsBar.resultsFor.replace('{count}', '')}
          {' '}<span className="font-bold text-primary">"{query}"</span>
        </p>
      );
    }
    if (activeTab === 'products') {
      if (filters.category !== 'all') {
        const catLabel = CATEGORY_OPTIONS_TRANSLATED.find((c) => c.value === filters.category)?.label || filters.category;
        return (
          <p className="text-sm font-bold text-foreground">
            {t.search.resultsBar.categoryProducts.replace('{category}', catLabel).replace('{count}', String(currentResults.length))}
          </p>
        );
      }
      return (
        <p className="text-sm font-bold text-foreground">
          {t.search.resultsBar.allProducts.replace('{count}', String(currentResults.length))}
        </p>
      );
    }
    return (
      <p className="text-sm font-bold text-foreground">
        {t.search.resultsBar.factoriesFound.replace('{count}', String(currentResults.length))}
      </p>
    );
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
              placeholder={t.search.placeholder}
              className="flex-1 px-4 text-sm bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none"
              aria-label={t.search.searchButton}
            />
            <button
              type="submit"
              className="shrink-0 px-5 bg-primary text-primary-foreground text-sm font-bold flex items-center gap-2 active:opacity-80 transition-opacity"
            >
              <Icon name="MagnifyingGlassIcon" size={16} />
              <span className="hidden sm:inline">{t.search.searchButton}</span>
            </button>
          </div>
        </form>

        {/* Tabs: Products / Factories */}
        <div className="flex gap-1 bg-muted p-1 rounded-xl mb-4 w-fit">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key as 'products' | 'factories')}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon name={tab.icon as any} size={14} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Category quick pills — products only */}
        {activeTab === 'products' && (
          <div className="flex gap-2 overflow-x-auto hide-scrollbar mb-5 pb-1">
            {CATEGORY_OPTIONS_TRANSLATED.slice(0, 9).map((cat) => (
              <button
                key={cat.value}
                onClick={() => handleFilterChange('category', cat.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors shrink-0 ${
                  filters.category === cat.value
                    ? 'bg-foreground text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        )}

        {/* ── Origin Filter Tabs: All / Local / International ── */}
        <div className="flex items-center gap-2 mb-5 overflow-x-auto hide-scrollbar pb-1">
          {([
            {
              key: 'all' as const,
              label: activeTab === 'products' ? 'All Products' : 'All Suppliers',
              labelAr: activeTab === 'products' ? 'جميع المنتجات' : 'جميع الموردين',
              icon: '🌐',
              count: originCounts.all,
              activeClass: 'bg-foreground text-primary-foreground shadow-sm',
              inactiveClass: 'bg-card border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30',
            },
            {
              key: 'local' as const,
              label: activeTab === 'products' ? 'Local Products' : 'Local Suppliers',
              labelAr: activeTab === 'products' ? 'منتجات محلية' : 'موردون محليون',
              icon: '🇸🇦',
              count: originCounts.local,
              activeClass: 'bg-emerald-600 text-white shadow-sm',
              inactiveClass: 'bg-card border border-border text-muted-foreground hover:text-foreground hover:border-emerald-300',
            },
            {
              key: 'global' as const,
              label: activeTab === 'products' ? 'International' : 'International',
              labelAr: activeTab === 'products' ? 'منتجات دولية' : 'موردون دوليون',
              icon: '✈️',
              count: originCounts.international,
              activeClass: 'bg-blue-600 text-white shadow-sm',
              inactiveClass: 'bg-card border border-border text-muted-foreground hover:text-foreground hover:border-blue-300',
            },
          ] as const).map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setScopeFilter(tab.key);
                const params = new URLSearchParams();
                if (query) params.set('q', query);
                params.set('tab', activeTab);
                params.set('scope', tab.key);
                router.push(`/search?${params.toString()}`);
              }}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 ${
                scopeFilter === tab.key ? tab.activeClass : tab.inactiveClass
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              {!dbLoading && (
                <span
                  className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-extrabold ${
                    scopeFilter === tab.key
                      ? 'bg-white/20 text-white' :'bg-muted text-muted-foreground'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Layout: sidebar + results */}
        <div className="flex gap-6 items-start">

          {/* ── Desktop Sidebar ── */}
          <div className="hidden lg:block w-60 xl:w-64 shrink-0 sticky top-20">
            <FilterSidebar
              filters={filters}
              onChange={handleFilterChange}
              onReset={handleReset}
              countries={countries}
              activeCount={activeFilterCount}
              activeTab={activeTab}
              sectors={sectors}
              sectorProducts={sectorProducts}
              t={t}
            />
          </div>

          {/* ── Results Column ── */}
          <div className="flex-1 min-w-0">

            {/* Results toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                {/* Mobile filter toggle */}
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="lg:hidden flex items-center gap-1.5 h-9 px-3 border border-border rounded-lg text-xs font-semibold text-foreground bg-card hover:bg-muted transition-colors"
                >
                  <Icon name="AdjustmentsHorizontalIcon" size={14} />
                  {t.search.resultsBar.filtersButton}
                  {activeFilterCount > 0 && (
                    <span className="w-4 h-4 bg-primary text-primary-foreground text-[9px] font-bold rounded-full flex items-center justify-center">
                      {activeFilterCount}
                    </span>
                  )}
                </button>

                <div>
                  {getResultsLabel()}
                  <p className="text-xs text-muted-foreground">
                    {dbLoading ? t.search.resultsBar.loading : t.search.resultsBar.marketplace}
                  </p>
                </div>
              </div>

              {activeTab === 'products' && (
                <div className="flex items-center gap-2">
                  {/* B2B / B2C mode toggle */}
                  <div className="flex items-center border border-border rounded-lg overflow-hidden">
                    <button
                      onClick={() => setBuyerMode('b2c')}
                      className={`h-9 px-3 text-xs font-bold transition-colors ${buyerMode === 'b2c' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
                      title="Individual / Retail buyer"
                    >
                      B2C
                    </button>
                    <button
                      onClick={() => setBuyerMode('b2b')}
                      className={`h-9 px-3 text-xs font-bold transition-colors ${buyerMode === 'b2b' ? 'bg-foreground text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
                      title="Business / Bulk buyer"
                    >
                      B2B
                    </button>
                  </div>
                  {/* Sort */}
                  <select
                    value={filters.sortBy}
                    onChange={(e) => handleFilterChange('sortBy', e.target.value)}
                    className="h-9 px-3 rounded-lg border border-border bg-card text-foreground text-xs font-semibold focus:outline-none focus:border-primary"
                  >
                    {SORT_OPTIONS.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                  {/* View toggle */}
                  <div className="flex items-center border border-border rounded-lg overflow-hidden">
                    {(['grid', 'list'] as const).map((v) => (
                      <button
                        key={v}
                        onClick={() => setViewMode(v)}
                        className={`w-9 h-9 flex items-center justify-center transition-colors ${
                          viewMode === v ? 'bg-foreground text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
                        }`}
                        aria-label={v === 'grid' ? t.search.gridView : t.search.listView}
                      >
                        <Icon name={v === 'grid' ? 'Squares2X2Icon' : 'ListBulletIcon'} size={16} />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Active filter tags */}
            <ActiveFilterTags filters={filters} onChange={handleFilterChange} t={t} />

            {/* Dual-mode B2B/B2C Intent Banner */}
            {!intentBannerDismissed && (
              <IntentBanner
                intentScore={intentScore}
                query={query}
                onDismiss={() => setIntentBannerDismissed(true)}
                onSwitchMode={(mode) => { setBuyerMode(mode); setIntentBannerDismissed(true); }}
                onSwitchTab={(tab) => { handleTabChange(tab); setIntentBannerDismissed(true); }}
                currentBuyerMode={buyerMode}
                currentTab={activeTab}
              />
            )}

            {/* B2B mode info banner */}
            {buyerMode === 'b2b' && activeTab === 'products' && (
              <div className="mb-4 flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
                <svg className="w-4 h-4 text-amber-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                <p className="text-xs text-amber-800 font-medium flex-1">
                  <span className="font-bold">B2B Mode:</span> MOQ and bulk pricing are highlighted. Use the RFQ button to request custom quotes for large orders.
                </p>
                <Link href="/rfq/create" className="shrink-0 text-[10px] font-bold px-3 py-1.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors">
                  Post RFQ
                </Link>
              </div>
            )}

            {/* Results */}
            {dbLoading ? (
              activeTab === 'products' ? (
                <div className={viewMode === 'grid' ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4' : 'space-y-3'}>
                  {Array.from({ length: 10 }).map((_, i) => (
                    <SkeletonCard key={i} view={viewMode} />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="bg-card border border-border rounded-xl p-4 animate-pulse space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-muted shrink-0" />
                        <div className="flex-1 space-y-2">
                          <div className="h-4 bg-muted rounded w-3/4" />
                          <div className="h-3 bg-muted rounded w-1/2" />
                        </div>
                      </div>
                      <div className="h-3 bg-muted rounded w-full" />
                      <div className="h-3 bg-muted rounded w-2/3" />
                    </div>
                  ))}
                </div>
              )
            ) : currentResults.length === 0 ? (
              <EmptyState
                query={query}
                activeTab={activeTab}
                onClear={() => { setQuery(''); setInputValue(''); handleReset(); }}
                t={t}
              />
            ) : activeTab === 'products' ? (
              <div className={viewMode === 'grid' ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4' : 'space-y-3'}>
                {(productResults as SearchProduct[]).map((product) => (
                  <ProductCard key={product.id} product={product} view={viewMode} inStockLabel={t.search.inStock} buyerMode={buyerMode} />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4">
                {(factoryResults as SearchFactory[]).map((factory) => (
                  <FactoryCard key={factory.id} factory={factory} labels={factoryCardLabels} />
                ))}
              </div>
            )}

            {/* Browse categories CTA */}
            {currentResults.length > 0 && (
              <div className="mt-10 bg-muted/40 border border-border rounded-2xl p-6 text-center">
                <p className="text-sm font-semibold text-foreground mb-1">{t.search.cta.cantFind}</p>
                <p className="text-xs text-muted-foreground mb-4">{t.search.cta.submitRFQ}</p>
                <div className="flex items-center justify-center gap-3 flex-wrap">
                  <Link href="/categories" className="inline-flex items-center gap-2 px-5 py-2.5 bg-foreground text-primary-foreground text-sm font-bold rounded-xl">
                    <Icon name="Squares2X2Icon" size={15} />
                    {t.search.cta.browseCategories}
                  </Link>
                  <Link href="/rfq-board" className="inline-flex items-center gap-2 px-5 py-2.5 border border-border text-foreground text-sm font-semibold rounded-xl hover:bg-muted transition-colors">
                    <Icon name="DocumentTextIcon" size={15} />
                    {t.search.cta.postRFQ}
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ── Mobile Filter Drawer ── */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="absolute right-0 top-0 bottom-0 w-80 max-w-[90vw] bg-background overflow-y-auto p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <span className="font-bold text-base text-foreground">{t.search.filterLabels.advancedFilters}</span>
              <button onClick={() => setSidebarOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors">
                <Icon name="XMarkIcon" size={18} />
              </button>
            </div>
            <FilterSidebar
              filters={filters}
              onChange={handleFilterChange}
              onReset={handleReset}
              countries={countries}
              activeCount={activeFilterCount}
              activeTab={activeTab}
              sectors={sectors}
              sectorProducts={sectorProducts}
              t={t}
            />
            <div className="mt-6 pt-4 border-t border-border">
              <button
                onClick={() => setSidebarOpen(false)}
                className="w-full h-11 bg-primary text-primary-foreground font-bold text-sm rounded-xl"
              >
                {t.search.filterLabels.showResults.replace('{count}', String(currentResults.length))}
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}

// ─── Skeleton Card ────────────────────────────────────────────────────────────
const SkeletonCard: React.FC<{ view: 'grid' | 'list' }> = ({ view }) => {
  if (view === 'list') {
    return (
      <div className="flex gap-3 sm:gap-4 bg-card border border-border rounded-xl p-3 sm:p-4 animate-pulse">
        <div className="w-20 h-20 sm:w-28 sm:h-28 shrink-0 rounded-xl bg-muted" />
        <div className="flex-1 min-w-0 space-y-2">
          <div className="h-4 bg-muted rounded w-3/4" />
          <div className="h-3 bg-muted rounded w-1/2" />
          <div className="h-3 bg-muted rounded w-full" />
          <div className="h-3 bg-muted rounded w-2/3" />
          <div className="flex gap-2 mt-2">
            <div className="h-7 bg-muted rounded-lg w-20" />
            <div className="h-7 bg-muted rounded-lg w-20" />
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden animate-pulse flex flex-col">
      <div className="aspect-square bg-muted" />
      <div className="p-2.5 space-y-2">
        <div className="h-3 bg-muted rounded w-full" />
        <div className="h-3 bg-muted rounded w-3/4" />
        <div className="h-8 bg-muted rounded-lg" />
        <div className="h-3 bg-muted rounded w-1/2" />
        <div className="flex gap-1 mt-1">
          <div className="h-7 bg-muted rounded-lg flex-1" />
          <div className="h-7 bg-muted rounded-lg flex-1" />
        </div>
      </div>
    </div>
  );
};

// ─── Professional Empty State ─────────────────────────────────────────────────
const EmptyState: React.FC<{
  query: string;
  activeTab: 'products' | 'factories';
  onClear: () => void;
  t: any;
}> = ({ query, activeTab, onClear, t }) => (
  <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
    {/* Icon */}
    <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 flex items-center justify-center mx-auto mb-6 shadow-sm">
      <svg className="w-12 h-12 text-primary/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    </div>

    {/* Heading */}
    <h3 className="text-xl font-bold text-foreground mb-2">
      {activeTab === 'products' ? t.search.emptyState.noProducts : t.search.emptyState.noFactories}
    </h3>

    {/* Subtext */}
    {query ? (
      <p className="text-sm text-muted-foreground mb-2 max-w-sm">
        لم نعثر على نتائج لـ <span className="font-semibold text-foreground">"{query}"</span>. جرّب كلمات مختلفة أو تصفح الفئات.
      </p>
    ) : (
      <p className="text-sm text-muted-foreground mb-2 max-w-sm">
        {t.search.emptyState.tryAdjusting}
      </p>
    )}

    {/* Suggestion chips */}
    <div className="flex flex-wrap justify-center gap-2 mb-8 mt-2">
      {['إلكترونيات', 'مواد خام', 'نسيج', 'آلات', 'أثاث'].map((chip) => (
        <span key={chip} className="px-3 py-1 bg-muted text-muted-foreground text-xs font-medium rounded-full border border-border">
          {chip}
        </span>
      ))}
    </div>

    {/* Action buttons */}
    <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-sm">
      {/* Primary: Browse products */}
      <Link
        href="/search"
        className="w-full sm:flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 bg-primary text-primary-foreground text-sm font-bold rounded-xl hover:opacity-90 transition-opacity"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
        </svg>
        تصفح المنتجات
      </Link>

      {/* Secondary: Create RFQ */}
      <Link
        href="/rfq/create"
        className="w-full sm:flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 bg-amber-500 text-white text-sm font-bold rounded-xl hover:bg-amber-600 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        طلب عرض سعر مخصص
      </Link>
    </div>

    {/* RFQ hint */}
    <p className="text-xs text-muted-foreground mt-4 max-w-xs">
      لم تجد ما تبحث عنه؟ أرسل طلب عرض سعر وسيتواصل معك الموردون المناسبون مباشرةً.
    </p>

    {/* Clear filters button */}
    <button
      onClick={onClear}
      className="mt-4 text-xs text-primary underline underline-offset-2 hover:no-underline transition-all"
    >
      {t.search.emptyState.clearAll}
    </button>
  </div>
);

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
