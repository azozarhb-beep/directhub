'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';
import AppLogo from '@/components/ui/AppLogo';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import TrustScoreBadge from '@/components/TrustScoreBadge';
import { BRAND_PLACEHOLDER_IMAGE, formatYer, translateUnitAr } from '@/lib/catalogDisplay';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FactoryProfile {
  id: string;
  company_name: string;
  country: string;
  city: string;
  main_products: string;
  annual_capacity: string;
  certifications: string;
  trust_percentage: number;
  verified_tier: 'unverified' | 'partial' | 'verified';
  registration_status: string;
  established_year: number;
  user_id: string;
}

interface Product {
  id: string;
  name: string;
  name_ar: string;
  category: string;
  unit: string;
  unit_price: number;
  minimum_order_qty: number;
  stock_quantity: number;
  inventory_status: string;
  origin_country: string;
  is_active: boolean;
  /** Retail / quick-buy unit price (B2C) */
  price: number | null;
  /** Minimum order quantity for industrial / B2B orders */
  moq: number | null;
  /** Whether the product is ready to ship immediately */
  is_ready_to_ship: boolean | null;
  /** Domestic delivery term: EX_FACTORY | DELIVERY_INCLUDED | CALCULATED_SHIPPING */
  shipping_terms?: string | null;
  image_url?: string | null;
}

type SalesMode = 'b2b' | 'b2c';

export default function FactoryStorePage() {
  const params = useParams();
  const router = useRouter();
  const { t, dir, language } = useLanguage();
  const { user } = useAuth();
  const { addItem } = useCart();
  const factoryId = params?.factoryId as string;
  const supabase = createClient();

  const [profile, setProfile] = useState<FactoryProfile | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [salesMode, setSalesMode] = useState<SalesMode>('b2c');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [showRFQModal, setShowRFQModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [rfqForm, setRfqForm] = useState({ quantity: '', notes: '', budget: '', company: '', delivery_date: '' });
  const [rfqSubmitting, setRfqSubmitting] = useState(false);
  const [rfqSuccess, setRfqSuccess] = useState(false);
  const [addedToCart, setAddedToCart] = useState<string | null>(null);
  const [hasVerifiedCert, setHasVerifiedCert] = useState(false);

  useEffect(() => {
    if (!factoryId) return;
    fetchFactory();
  }, [factoryId]);

  const fetchFactory = async () => {
    setLoading(true);
    try {
      // Try by user_id first
      let regData: any = null;
      const { data: byUserId } = await supabase
        .from('factory_registrations')
        .select('id, user_id, company_name, registration_status, kyc_status, established_year, main_products, annual_capacity, certifications, trust_percentage, verified_tier')
        .eq('user_id', factoryId)
        .maybeSingle();

      if (byUserId) {
        regData = byUserId;
      } else {
        const { data: byId } = await supabase
          .from('factory_registrations')
          .select('id, user_id, company_name, registration_status, kyc_status, established_year, main_products, annual_capacity, certifications, trust_percentage, verified_tier')
          .eq('id', factoryId)
          .maybeSingle();
        regData = byId;
      }

      if (!regData) { setNotFound(true); setLoading(false); return; }

      const { data: profileData } = await supabase
        .from('user_profiles')
        .select('country, city')
        .eq('id', regData.user_id)
        .maybeSingle();

      setProfile({
        id: regData.id,
        company_name: regData.company_name || 'مصنع',
        country: profileData?.country || '',
        city: profileData?.city || '',
        main_products: regData.main_products || '',
        annual_capacity: regData.annual_capacity || '',
        certifications: regData.certifications || '',
        trust_percentage: regData.trust_percentage || 0,
        verified_tier: regData.verified_tier || 'unverified',
        registration_status: regData.registration_status || 'pending',
        established_year: regData.established_year || 0,
        user_id: regData.user_id,
      });

      const { data: productsData } = await supabase
        .from('manufacturer_products')
        .select('id, name, name_ar, category, unit, unit_price, minimum_order_qty, stock_quantity, inventory_status, origin_country, is_active, shipping_terms, image_url')
        .eq('manufacturer_id', regData.user_id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      setProducts(
        (productsData || []).map((p: any) => ({
          ...p,
          price: null,
          moq: null,
          is_ready_to_ship: null,
        }))
      );

      try {
        const { data: certOk } = await supabase.rpc('factory_has_verified_certificate', {
          p_factory_ref: regData.id,
          p_company_name: regData.company_name || null,
        });
        setHasVerifiedCert(certOk === true);
      } catch {
        setHasVerifiedCert(false);
      }
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = (product: Product) => {
    addItem({
      productId: product.id,
      name: language === 'ar' && product.name_ar ? product.name_ar : product.name,
      nameAr: product.name_ar,
      price: product.unit_price,
      currency: 'YER',
      quantity: 1,
      moq: `${product.minimum_order_qty ?? 1} ${translateUnitAr(product.unit)}`,
      moqNumber: Math.max(1, Number(product.minimum_order_qty) || 1),
      supplier: profile?.company_name || '',
      countryFlag: profile?.country || '',
      image: product.image_url || BRAND_PLACEHOLDER_IMAGE,
      alt: product.name,
      verified: false,
      category: product.category,
      isRetailAvailable: false,
      retailPrice: 0,
    });
    setAddedToCart(product.id);
    setTimeout(() => setAddedToCart(null), 2000);
  };

  const handleRFQSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    setRfqSubmitting(true);
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) { router.push('/login'); return; }
      await supabase.from('rfq_requests').insert({
        buyer_id: currentUser.id,
        product_id: selectedProduct.id,
        product_name: selectedProduct.name,
        supplier_name: profile?.company_name || '',
        quantity: parseInt(rfqForm.quantity) || selectedProduct.minimum_order_qty,
        unit: selectedProduct.unit,
        destination_country: '',
        additional_notes: rfqForm.notes,
        status: 'pending',
      });
      setRfqSuccess(true);
      setTimeout(() => { setShowRFQModal(false); setRfqSuccess(false); setRfqForm({ quantity: '', notes: '', budget: '', company: '', delivery_date: '' }); }, 2000);
    } catch {
      // silent
    } finally {
      setRfqSubmitting(false);
    }
  };

  const filteredProducts = products.filter(p => {
    const matchSearch = !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase()) || (p.name_ar && p.name_ar.includes(searchQuery));
    const matchCat = filterCategory === 'all' || p.category === filterCategory;
    return matchSearch && matchCat;
  });

  const categories = ['all', ...Array.from(new Set(products.map(p => p.category).filter(Boolean)))];

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4 p-4" dir={dir}>
        <Icon name="Store" size={48} className="text-slate-300" />
        <h2 className="text-xl font-bold text-slate-700">المتجر غير موجود</h2>
        <p className="text-slate-500 text-sm">لم يتم العثور على هذا المصنع أو المتجر.</p>
        <Link href="/" className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700 transition-colors">العودة للرئيسية</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-[calc(7rem+env(safe-area-inset-bottom))] md:pb-8" dir={dir}>
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-screen-xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Link href="/"><AppLogo className="h-8 w-auto" /></Link>
          <div className="flex items-center gap-2">
            <Link href="/cart" className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-sm text-slate-600 transition-colors">
              <Icon name="ShoppingCart" size={16} />
              <span className="hidden sm:inline">السلة</span>
            </Link>
            <Link href="/rfq-board" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-sm text-white transition-colors">
              <Icon name="FileText" size={14} />
              <span className="hidden sm:inline">طلب RFQ</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Factory Banner */}
      <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white">
        <div className="max-w-screen-xl mx-auto px-4 py-8">
          <div className="flex flex-col sm:flex-row sm:items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center flex-shrink-0">
              <Icon name="Factory" size={32} className="text-white" />
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="text-xl font-bold">{profile.company_name}</h1>
                <TrustScoreBadge score={profile.trust_percentage} tier={profile.verified_tier} size="sm" />
                {hasVerifiedCert && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[11px] font-bold">
                    <Icon name="BadgeCheck" size={12} />
                    شهادة جودة معتمدة ومفحوصة
                  </span>
                )}
              </div>
              <p className="text-slate-300 text-sm">{profile.country}{profile.city ? ` · ${profile.city}` : ''}{profile.established_year ? ` · تأسس ${profile.established_year}` : ''}</p>
              {profile.main_products && <p className="text-slate-400 text-xs mt-1">المنتجات الرئيسية: {profile.main_products}</p>}
              {profile.certifications && <p className="text-slate-400 text-xs mt-0.5">الشهادات: {profile.certifications}</p>}
            </div>
            <div className="flex flex-col gap-2">
              <Link href={`/storefront/${profile.user_id}`} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-sm text-white transition-colors text-center">
                <Icon name="ExternalLink" size={14} />
                الصفحة الكاملة
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Unified Sticky Filter Row: B2B/B2C toggle + category pills */}
      <div className="bg-white border-b border-slate-200 sticky top-[57px] z-30">
        <div className="max-w-screen-xl mx-auto px-4 py-2.5 flex items-center gap-2">
          <div className="flex gap-1 bg-slate-100 rounded-xl p-1 shrink-0">
            <button
              onClick={() => setSalesMode('b2b')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${salesMode === 'b2b' ? 'bg-indigo-600 text-white shadow' : 'text-slate-600 hover:text-slate-900'}`}
            >
              <Icon name="Building2" size={14} />
              جملة (B2B)
            </button>
            <button
              onClick={() => setSalesMode('b2c')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${salesMode === 'b2c' ? 'bg-rose-600 text-white shadow' : 'text-slate-600 hover:text-slate-900'}`}
            >
              <Icon name="ShoppingBag" size={14} />
              تجزئة (B2C)
            </button>
          </div>
          <span className="h-5 w-px bg-slate-200 shrink-0" aria-hidden="true" />
          <div className="flex-1 flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${filterCategory === cat ? (salesMode === 'b2b' ? 'bg-indigo-600 text-white' : 'bg-rose-600 text-white') : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              >
                {cat === 'all' ? 'الكل' : cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-screen-xl mx-auto px-4 py-6 space-y-5">
        {/* B2B Info Banner */}
        {salesMode === 'b2b' && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex flex-wrap items-start gap-3">
            <Icon name="Info" size={18} className="text-indigo-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-indigo-800 font-medium text-sm">وضع الجملة (B2B) — للشركات والموزعين</p>
              <p className="text-indigo-600 text-xs mt-0.5">يمكنك إرسال طلب عرض سعر (RFQ) للحصول على أسعار الجملة، وإتمام الصفقة عبر نظام الضمان المالي المرحلي.</p>
            </div>
            <Link href="/rfq-board" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 transition-colors whitespace-nowrap">
              <Icon name="FileQuestion" size={12} />
              إرسال RFQ
            </Link>
          </div>
        )}

        {/* B2C Info Banner */}
        {salesMode === 'b2c' && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex flex-wrap items-start gap-3">
            <Icon name="Zap" size={18} className="text-rose-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-rose-800 font-medium text-sm">وضع التجزئة (B2C) — للأفراد والمشتريات الصغيرة</p>
              <p className="text-rose-600 text-xs mt-0.5">أضف المنتجات إلى سلتك وأتمم الدفع مباشرة. خيارات شحن سريع متاحة لمعظم المنتجات.</p>
            </div>
            <Link href="/cart" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-medium hover:bg-rose-700 transition-colors whitespace-nowrap">
              <Icon name="ShoppingCart" size={12} />
              عرض السلة
            </Link>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Icon name="Search" size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="ابحث عن منتج..."
            className="w-full border border-slate-200 rounded-lg pr-9 pl-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          />
        </div>

        {/* Products Grid */}
        {filteredProducts.length === 0 ? (
          <div className="text-center py-16">
            <Icon name="Package" size={48} className="text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">لا توجد منتجات متاحة حالياً</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredProducts.map(product => {
              const b2bPrice = product.unit_price;
              const b2cPrice = Math.round(product.unit_price * 1.35 * 100) / 100;
              const displayPrice = salesMode === 'b2c' ? b2cPrice : b2bPrice;
              const isOutOfStock = product.inventory_status === 'out_of_stock';
              const effectiveMoq = product.moq ?? product.minimum_order_qty ?? 1;

              return (
                <Link
                  key={product.id}
                  href={`/product/${product.id}`}
                  className={`block bg-white border rounded-xl overflow-hidden hover:shadow-md transition-all ${salesMode === 'b2b' ? 'hover:border-indigo-300' : 'hover:border-rose-300'} ${isOutOfStock ? 'opacity-60' : ''}`}
                >
                  <div className="bg-slate-100 h-36 relative overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={product.image_url || BRAND_PLACEHOLDER_IMAGE}
                      alt={language === 'ar' && product.name_ar ? product.name_ar : product.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={(e) => {
                        const img = e.currentTarget;
                        if (!img.src.endsWith(BRAND_PLACEHOLDER_IMAGE)) img.src = BRAND_PLACEHOLDER_IMAGE;
                      }}
                    />
                  </div>
                  <div className="p-3" dir="rtl">
                    <p className="font-semibold text-slate-900 text-sm line-clamp-2">{language === 'ar' && product.name_ar ? product.name_ar : product.name}</p>
                    <div className="flex items-center justify-between mt-2">
                      <div>
                        <p className={`font-bold text-lg ${salesMode === 'b2b' ? 'text-indigo-700' : 'text-rose-700'}`}>{formatYer(displayPrice)}</p>
                        <p className="text-slate-400 text-xs">/ {translateUnitAr(product.unit)}</p>
                      </div>
                      <div className="text-left">
                        <p className="text-slate-500 text-xs">الحد الأدنى</p>
                        <p className="text-slate-700 text-xs font-medium">{effectiveMoq} {translateUnitAr(product.unit)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-slate-100">
                      <Icon name="Factory" size={12} className="text-slate-400 shrink-0" />
                      <span className="text-xs text-slate-600 truncate">{profile?.company_name}</span>
                      {profile?.verified_tier === 'verified' && (
                        <Icon name="BadgeCheck" size={13} className="text-blue-500 shrink-0" />
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* RFQ Modal */}
      {showRFQModal && selectedProduct && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900">طلب عرض سعر (RFQ)</h3>
              <button onClick={() => setShowRFQModal(false)} className="text-slate-400 hover:text-slate-600"><Icon name="X" size={20} /></button>
            </div>
            {rfqSuccess ? (
              <div className="text-center py-6">
                <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
                  <Icon name="Check" size={24} className="text-emerald-600" />
                </div>
                <p className="font-semibold text-slate-900">تم إرسال طلبك بنجاح!</p>
                <p className="text-slate-500 text-sm mt-1">سيتواصل معك المصنع قريباً</p>
              </div>
            ) : (
              <form onSubmit={handleRFQSubmit} className="space-y-3">
                <div className="bg-slate-50 rounded-lg p-3 text-sm">
                  <p className="text-slate-500">المنتج: <span className="text-slate-900 font-medium">{selectedProduct.name}</span></p>
                  <p className="text-slate-500 mt-1">الحد الأدنى: <span className="text-slate-900 font-medium">{selectedProduct.minimum_order_qty} {translateUnitAr(selectedProduct.unit)}</span></p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">الكمية المطلوبة *</label>
                  <input type="number" value={rfqForm.quantity} onChange={e => setRfqForm(f => ({ ...f, quantity: e.target.value }))} placeholder={`الحد الأدنى: ${selectedProduct.minimum_order_qty}`} required className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">اسم الشركة</label>
                  <input type="text" value={rfqForm.company} onChange={e => setRfqForm(f => ({ ...f, company: e.target.value }))} placeholder="اسم شركتك" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">ملاحظات إضافية</label>
                  <textarea value={rfqForm.notes} onChange={e => setRfqForm(f => ({ ...f, notes: e.target.value }))} rows={3} placeholder="مواصفات خاصة، شروط التسليم، الشهادات المطلوبة..." className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
                </div>
                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={() => setShowRFQModal(false)} className="flex-1 px-4 py-2 rounded-lg border border-slate-300 text-slate-600 text-sm hover:bg-slate-50 transition-colors">إلغاء</button>
                  <button type="submit" disabled={rfqSubmitting} className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50">
                    {rfqSubmitting ? 'جاري الإرسال...' : 'إرسال الطلب'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
