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
import { BRAND_PLACEHOLDER_IMAGE, currencyForOrigin, formatPriceByOrigin, translateUnitAr } from '@/lib/catalogDisplay';

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
  role?: string;
  account_role?: string;
  is_verified?: boolean;
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
  origin_type?: 'local' | 'international' | null;
  is_active: boolean;
  price: number | null;
  moq: number | null;
  is_ready_to_ship: boolean | null;
  shipping_terms?: string | null;
  image_url?: string | null;
}

type SalesMode = 'b2b' | 'b2c';

function getEntityRoleLabel(role?: string, accountRole?: string): string {
  const r = (accountRole || role || '').toLowerCase();
  if (r.includes('commercial_supplier') || r.includes('supplier')) return 'مورّد ووكيل تجاري معتمد 🏢';
  if (r.includes('local_manufacturer') || r.includes('manufacturer') || r.includes('factory')) return 'مصنع محلي معتمد 🏭';
  if (r.includes('international_manufacturer')) return 'مصنع دولي معتمد 🌍';
  if (r.includes('logistics')) return 'مكتب شحن وتخليص جمركي 🚢';
  if (r.includes('agent')) return 'مندوب ميداني معتمد 👷';
  return 'منشأة تجارية ومشتري معتمد (B2B) 💼';
}

export default function FactoryStorePage() {
  const params = useParams();
  const router = useRouter();
  const { t, dir, language } = useLanguage();
  const { user } = useAuth();
  const { addItem } = useCart();
  const factoryId = (params?.factoryId || params?.id) as string;
  const supabase = createClient();

  const [profile, setProfile] = useState<FactoryProfile | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [salesMode, setSalesMode] = useState<SalesMode>('b2b');
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
    setNotFound(false);
    try {
      let regData: any = null;
      let targetUserId = factoryId;

      // 1. فحص جدول تسجيل المصانع أولاً
      const { data: byUserId } = await supabase
        .from('factory_registrations')
        .select('id, user_id, company_name, registration_status, kyc_status, established_year, main_products, annual_capacity, certifications, trust_percentage, verified_tier')
        .eq('user_id', factoryId)
        .maybeSingle();

      if (byUserId) {
        regData = byUserId;
        targetUserId = byUserId.user_id;
      } else {
        const { data: byId } = await supabase
          .from('factory_registrations')
          .select('id, user_id, company_name, registration_status, kyc_status, established_year, main_products, annual_capacity, certifications, trust_percentage, verified_tier')
          .eq('id', factoryId)
          .maybeSingle();
        if (byId) {
          regData = byId;
          targetUserId = byId.user_id;
        }
      }

      // 2. جلب الملف التعريفي التجاري من user_profiles (لتغطية المشترين والموردين والمصانع)
      const { data: profileData } = await supabase
        .from('user_profiles')
        .select('id, full_name, company_name, country, city, is_verified, role, account_role, account_type, created_at, avatar_url')
        .eq('id', targetUserId)
        .maybeSingle();

      // إذا لم يكن مسجلاً في أي جدول، حينها فقط يظهر خطأ عدم الوجود
      if (!regData && !profileData) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const companyName =
        regData?.company_name ||
        profileData?.company_name ||
        profileData?.full_name ||
        'منشأة تجارية معتمدة';

      const estYear = regData?.established_year
        ? Number(regData.established_year)
        : profileData?.created_at
        ? new Date(profileData.created_at).getFullYear()
        : 0;

      setProfile({
        id: regData?.id || profileData?.id || factoryId,
        company_name: companyName,
        country: profileData?.country || 'اليمن',
        city: profileData?.city || '',
        main_products: regData?.main_products || '',
        annual_capacity: regData?.annual_capacity || '',
        certifications: regData?.certifications || '',
        trust_percentage: regData?.trust_percentage || (profileData?.is_verified ? 95 : 80),
        verified_tier: regData?.verified_tier || (profileData?.is_verified ? 'verified' : 'unverified'),
        registration_status: regData?.registration_status || 'approved',
        established_year: estYear >= 1900 && estYear <= new Date().getFullYear() ? estYear : 0,
        user_id: targetUserId,
        role: profileData?.role || '',
        account_role: profileData?.account_role || profileData?.account_type || '',
        is_verified: !!profileData?.is_verified,
      });

      // 3. جلب المنتجات من جدولي المصانع والموردين معاً
      const [mfgRes, suppRes] = await Promise.all([
        supabase
          .from('manufacturer_products')
          .select('id, name, name_ar, category, unit, unit_price, minimum_order_qty, stock_quantity, inventory_status, origin_country, origin_type, is_active, shipping_terms, image_url')
          .eq('manufacturer_id', targetUserId)
          .eq('is_active', true)
          .order('created_at', { ascending: false }),
        supabase
          .from('supplier_products')
          .select('id, name, name_ar, category, unit, wholesale_price, retail_price, min_order_qty, stock_quantity, image_url, status, delivery_terms')
          .eq('supplier_id', targetUserId)
          .neq('status', 'archived')
          .order('created_at', { ascending: false }),
      ]);

      const mfgProducts = (mfgRes.data || []).map((p: any) => ({
        ...p,
        price: null,
        moq: null,
        is_ready_to_ship: null,
      }));

      const suppProducts = (suppRes.data || []).map((sp: any) => ({
        id: sp.id,
        name: sp.name || sp.name_ar || 'منتج تجاري',
        name_ar: sp.name_ar || sp.name || 'منتج تجاري',
        category: sp.category || 'عام',
        unit: sp.unit || 'كرتون',
        unit_price: sp.wholesale_price || 0,
        minimum_order_qty: sp.min_order_qty || 1,
        stock_quantity: sp.stock_quantity || 0,
        inventory_status: (sp.stock_quantity ?? 0) > 0 ? 'in_stock' : 'out_of_stock',
        origin_country: 'اليمن',
        origin_type: 'local' as const,
        is_active: sp.status === 'active',
        price: sp.retail_price || null,
        moq: sp.min_order_qty || 1,
        is_ready_to_ship: true,
        shipping_terms: sp.delivery_terms || null,
        image_url: sp.image_url || null,
      }));

      setProducts([...mfgProducts, ...suppProducts]);

      if (regData) {
        try {
          const { data: certOk } = await supabase.rpc('factory_has_verified_certificate', {
            p_factory_ref: regData.id,
            p_company_name: regData.company_name || null,
          });
          setHasVerifiedCert(certOk === true);
        } catch {
          setHasVerifiedCert(false);
        }
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
      currency: currencyForOrigin(product.origin_type),
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
        <h2 className="text-xl font-bold text-slate-700">الجهة غير موجودة</h2>
        <p className="text-slate-500 text-sm">لم يتم العثور على سجل لهذه المنشأة التجارية.</p>
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
            <Link href="/messaging" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-sm text-slate-700 transition-colors font-medium">
              <span>💬</span>
              <span>المحادثات</span>
            </Link>
            <Link href="/cart" className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-sm text-slate-600 transition-colors">
              <Icon name="ShoppingCart" size={16} />
              <span className="hidden sm:inline">السلة</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Banner */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white">
        <div className="max-w-screen-xl mx-auto px-4 py-8">
          <div className="flex flex-col sm:flex-row sm:items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center flex-shrink-0 text-3xl font-black text-indigo-300">
              {profile.company_name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="text-xl sm:text-2xl font-bold">{profile.company_name}</h1>
                <TrustScoreBadge score={profile.trust_percentage} tier={profile.verified_tier} size="sm" />
                {hasVerifiedCert && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[11px] font-bold">
                    <Icon name="BadgeCheck" size={12} />
                    شهادة جودة معتمدة
                  </span>
                )}
              </div>
              <p className="text-slate-300 text-xs sm:text-sm">
                <span>{getEntityRoleLabel(profile.role, profile.account_role)}</span>
                <span> · {profile.country}{profile.city ? ` · ${profile.city}` : ''}</span>
                {profile.established_year ? <span> · عضو منذ {profile.established_year}</span> : null}
              </p>
              {profile.main_products && <p className="text-slate-400 text-xs mt-1">النشاط التجاري: {profile.main_products}</p>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link
                href={`/messaging?partnerId=${profile.user_id}&title=${encodeURIComponent(profile.company_name)}`}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-sm active:scale-95"
              >
                <span>💬</span>
                <span>تواصل وتفاوض مباشر</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* في حال كانت المنشأة لا تملك منتجات تجزئة معروضة (مشتري أو مصنع شريك للتوريد المباشر) */}
      {products.length === 0 ? (
        <div className="max-w-4xl mx-auto px-4 py-10">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 text-center space-y-4 shadow-sm">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mx-auto text-indigo-600">
              <Icon name="Building2" size={32} />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-slate-900">{profile.company_name}</h2>
              <p className="text-sm text-slate-600 font-medium">
                {getEntityRoleLabel(profile.role, profile.account_role)}
              </p>
            </div>

            <div className="max-w-lg mx-auto bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs text-slate-600 leading-relaxed text-right space-y-2">
              <p className="flex items-center gap-2 font-bold text-slate-800">
                <Icon name="BadgeCheck" size={16} className="text-blue-600 shrink-0" />
                <span>منشأة تجارية معتمدة لإبرام الصفقات وعقود التوريد</span>
              </p>
              <p className="text-slate-500">
                هذا الحساب موثق في منصة دايركت هب لإبرام عقود التوريد بالجملة، التفاوض المباشر، وطلب عروض الأسعار (RFQ) وتنسيق الشحنات مع تغطية كاملة بنظام الضمان المالي المباشر (Escrow).
              </p>
            </div>

            <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
              <Link
                href={`/messaging?partnerId=${profile.user_id}&title=${encodeURIComponent(profile.company_name)}`}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition-colors"
              >
                <span>💬</span>
                <span>بدء محادثة وتفاوض مباشر</span>
              </Link>
              <Link
                href="/"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
              >
                <span>العودة للمتجر الرئيسي</span>
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* شريط الفلاتر للمنتجات المعروضة */}
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
            {salesMode === 'b2b' && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex flex-wrap items-start gap-3">
                <Icon name="Info" size={18} className="text-indigo-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-indigo-800 font-medium text-sm">وضع الجملة (B2B) — للشركات والموزعين</p>
                  <p className="text-indigo-600 text-xs mt-0.5">يمكنك إرسال طلب عرض سعر (RFQ) للحصول على أسعار الجملة، وإتمام الصفقة عبر نظام الضمان المالي المرحلي.</p>
                </div>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredProducts.map(product => {
                const b2bPrice = product.unit_price;
                const b2cPrice = product.price || Math.round(product.unit_price * 1.35 * 100) / 100;
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
                          <p className={`font-bold text-lg ${salesMode === 'b2b' ? 'text-indigo-700' : 'text-rose-700'}`}>{formatPriceByOrigin(displayPrice, product.origin_type)}</p>
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
          </div>
        </>
      )}

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
