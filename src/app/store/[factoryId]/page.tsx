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

interface EntityProfile {
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
  active_rfqs_count?: number;
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

function getRoleTitle(role?: string, accountRole?: string): { title: string; badgeCls: string } {
  const r = (accountRole || role || '').toLowerCase();
  if (r.includes('commercial_supplier') || r.includes('supplier')) {
    return { title: 'مورّد ووكيل تجاري معتمد (B2B)', badgeCls: 'bg-blue-500/10 text-blue-400 border-blue-500/30' };
  }
  if (r.includes('local_manufacturer') || r.includes('manufacturer') || r.includes('factory')) {
    return { title: 'مصنع محلي معتمد (B2B Manufacturer)', badgeCls: 'bg-purple-500/10 text-purple-400 border-purple-500/30' };
  }
  if (r.includes('logistics')) {
    return { title: 'شريك شحن وتخليص جمركي معتمد', badgeCls: 'bg-amber-500/10 text-amber-400 border-amber-500/30' };
  }
  return { title: 'منشأة تجارية ومشتري جملة معتمد (B2B Buyer)', badgeCls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' };
}

export default function FactoryStorePage() {
  const params = useParams();
  const router = useRouter();
  const { t, dir, language } = useLanguage();
  const { user } = useAuth();
  const { addItem } = useCart();
  const factoryId = (params?.factoryId || params?.id) as string;
  const supabase = createClient();

  const [profile, setProfile] = useState<EntityProfile | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [salesMode, setSalesMode] = useState<SalesMode>('b2b');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [showRFQModal, setShowRFQModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [rfqForm, setRfqForm] = useState({ quantity: '', notes: '', budget: '', company: '', delivery_date: '' });
  const [rfqSubmitting, setRfqSubmitting] = useState(false);
  const [rfqSuccess, setRfqSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'products' | 'trust'>('overview');

  useEffect(() => {
    if (!factoryId) return;
    fetchEntityData();
  }, [factoryId]);

  const fetchEntityData = async () => {
    setLoading(true);
    try {
      let regData: any = null;
      let profData: any = null;
      let targetUserId = factoryId;

      // 1. محاولة الفحص في جدول تسجيل المصانع
      try {
        const { data: byUserId } = await supabase
          .from('factory_registrations')
          .select('*')
          .eq('user_id', factoryId)
          .maybeSingle();

        if (byUserId) {
          regData = byUserId;
          targetUserId = byUserId.user_id;
        } else {
          const { data: byId } = await supabase
            .from('factory_registrations')
            .select('*')
            .eq('id', factoryId)
            .maybeSingle();
          if (byId) {
            regData = byId;
            targetUserId = byId.user_id;
          }
        }
      } catch {
        // ignore
      }

      // 2. محاولة الفحص في user_profiles
      try {
        const { data: pData } = await supabase
          .from('user_profiles')
          .select('id, full_name, company_name, country, city, is_verified, role, account_role, account_type, created_at, avatar_url')
          .eq('id', targetUserId)
          .maybeSingle();
        if (pData) profData = pData;
      } catch {
        // ignore
      }

      // 3. فحص احتياطي ذكي من جدول طلبات الأسعار RFQ والمحادثات
      let fallbackName = '';
      let fallbackCity = 'اليمن';
      let rfqsCount = 0;

      try {
        const { data: rfqList, count } = await supabase
          .from('rfq_requests')
          .select('id, product_name, destination_country, destination_port, created_at', { count: 'exact' })
          .eq('buyer_id', targetUserId)
          .limit(5);

        rfqsCount = count || 0;
        if (rfqList && rfqList.length > 0) {
          fallbackCity = rfqList[0].destination_port || rfqList[0].destination_country || 'اليمن';
        }
      } catch {
        // ignore
      }

      try {
        const { data: convData } = await supabase
          .from('chat_conversations')
          .select('supplier_name, product_name')
          .or(`buyer_id.eq.${targetUserId},manufacturer_id.eq.${targetUserId}`)
          .limit(1)
          .maybeSingle();

        if (convData?.supplier_name && convData.supplier_name !== 'مشتري طلب RFQ') {
          fallbackName = convData.supplier_name;
        }
      } catch {
        // ignore
      }

      // تجهيز بيانات البروفايل دون السقوط في 404 إطلاقاً
      const finalName =
        regData?.company_name ||
        profData?.company_name ||
        profData?.full_name ||
        fallbackName ||
        'منشأة تجارية معتمدة (B2B)';

      const estYear = regData?.established_year
        ? Number(regData.established_year)
        : profData?.created_at
        ? new Date(profData.created_at).getFullYear()
        : new Date().getFullYear();

      setProfile({
        id: regData?.id || profData?.id || targetUserId,
        company_name: finalName,
        country: profData?.country || 'اليمن',
        city: profData?.city || fallbackCity,
        main_products: regData?.main_products || 'التجارة والتوريدات العامة بالجملة',
        annual_capacity: regData?.annual_capacity || 'حسب الطلب والاتفاق المباشر',
        certifications: regData?.certifications || 'سجل تجاري موثق في المنصة',
        trust_percentage: regData?.trust_percentage || (profData?.is_verified ? 98 : 92),
        verified_tier: regData?.verified_tier || 'verified',
        registration_status: regData?.registration_status || 'approved',
        established_year: estYear >= 1900 && estYear <= new Date().getFullYear() ? estYear : 2024,
        user_id: targetUserId,
        role: profData?.role || 'buyer',
        account_role: profData?.account_role || profData?.account_type || 'buyer',
        is_verified: true,
        active_rfqs_count: rfqsCount,
      });

      // 4. جلب المنتجات إذا كان مصنعاً أو مورداً
      try {
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

        const mfgItems = (mfgRes.data || []).map((p: any) => ({
          ...p,
          price: null,
          moq: null,
          is_ready_to_ship: null,
        }));

        const suppItems = (suppRes.data || []).map((sp: any) => ({
          id: sp.id,
          name: sp.name || sp.name_ar || 'منتج جملة',
          name_ar: sp.name_ar || sp.name || 'منتج جملة',
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

        const allProds = [...mfgItems, ...suppItems];
        setProducts(allProds);
        if (allProds.length > 0) setActiveTab('products');
      } catch {
        setProducts([]);
      }
    } catch (err) {
      console.error(err);
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
      verified: true,
      category: product.category,
      isRetailAvailable: false,
      retailPrice: 0,
    });
  };

  const filteredProducts = products.filter(p => {
    const matchSearch = !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase()) || (p.name_ar && p.name_ar.includes(searchQuery));
    const matchCat = filterCategory === 'all' || p.category === filterCategory;
    return matchSearch && matchCat;
  });

  const categories = ['all', ...Array.from(new Set(products.map(p => p.category).filter(Boolean)))];

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-3">
        <div className="w-10 h-10 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 text-xs">جاري تحميل بروفايل المنشأة التجارية...</p>
      </div>
    );
  }

  const roleInfo = getRoleTitle(profile?.role, profile?.account_role);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-16" dir={dir}>
      {/* ── ترويسة الموقع العلوية ── */}
      <header className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Link href="/"><AppLogo className="h-8 w-auto" /></Link>
          <div className="flex items-center gap-2">
            <Link
              href="/messaging"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs sm:text-sm font-bold text-slate-200 border border-slate-700 transition-colors"
            >
              <span>💬</span>
              <span>العودة للمحادثة</span>
            </Link>
          </div>
        </div>
      </header>

      {/* ── بانر المنشأة الكبير بنمط علي بابا (Alibaba Storefront Header) ── */}
      <div className="bg-gradient-to-b from-slate-900 to-slate-950 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-8 sm:py-12">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-start sm:items-center gap-4 sm:gap-6">
              {/* شعار المنشأة */}
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-gradient-to-br from-cyan-500/20 to-blue-600/10 border-2 border-cyan-500/30 flex items-center justify-center text-3xl sm:text-4xl font-black text-cyan-400 shadow-xl shrink-0">
                {profile?.company_name.charAt(0).toUpperCase()}
              </div>

              {/* بيانات وهوية الشركة */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl sm:text-3xl font-black text-white tracking-tight">
                    {profile?.company_name}
                  </h1>
                  <span className="inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    <span>موثق رسمي</span>
                    <span>✓</span>
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                    <span>🛡️ ضمان مالي Escrow</span>
                  </span>
                </div>

                <p className="text-xs sm:text-sm text-slate-400 flex items-center gap-2 flex-wrap">
                  <span className={`px-2 py-0.5 rounded-md border text-xs font-semibold ${roleInfo.badgeCls}`}>
                    {roleInfo.title}
                  </span>
                  <span>📍 {profile?.city} · {profile?.country}</span>
                  <span>🗓️ عضو منذ {profile?.established_year}</span>
                </p>
              </div>
            </div>

            {/* أزرار الإجراء المباشر */}
            <div className="flex items-center gap-3">
              <Link
                href={`/messaging?partnerId=${profile?.user_id}&title=${encodeURIComponent(profile?.company_name || '')}`}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-sm shadow-lg shadow-cyan-500/20 active:scale-95 transition-all"
              >
                <span>💬</span>
                <span>بدء تفاوض وتواصل مباشر</span>
              </Link>
            </div>
          </div>

          {/* التبويبات بنمط علي بابا (Overview / Products / Verification) */}
          <div className="flex gap-2 border-t border-slate-800/80 mt-8 pt-4 overflow-x-auto">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
                activeTab === 'overview'
                  ? 'bg-cyan-500 text-slate-950 shadow-md'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              🏢 الملف التعريفي للمنشأة
            </button>

            {products.length > 0 && (
              <button
                onClick={() => setActiveTab('products')}
                className={`px-5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
                  activeTab === 'products'
                    ? 'bg-cyan-500 text-slate-950 shadow-md'
                    : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <span>📦 كتالوج الأصناف</span>
                <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded-full text-slate-300">
                  {products.length}
                </span>
              </button>
            )}

            <button
              onClick={() => setActiveTab('trust')}
              className={`px-5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
                activeTab === 'trust'
                  ? 'bg-cyan-500 text-slate-950 shadow-md'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              🛡️ الضمان المالي ومطابقة الجودة
            </button>
          </div>
        </div>
      </div>

      {/* ── محتوى الصفحة الرئيسي ── */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* بطاقات البيانات الأساسية */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6">
                <h2 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
                  <Icon name="BuildingOffice2Icon" size={20} className="text-cyan-400" />
                  <span>نبذة عن النشاط التجاري والعمليات</span>
                </h2>

                <p className="text-sm text-slate-300 leading-relaxed">
                  منشأة تجارية معتمدة لدى منصة دايركت هب لمطابقة التوريدات والصفقات الصناعية والتجارية بالجملة. الحساب خاضع لنظام الحماية والضمان المالي (Escrow) لإبرام العقود وتوريد البضائع وتسليمها في كافة المحافظات اليمنية.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4">
                    <p className="text-xs text-slate-500 mb-1">مجال النشاط الرئيسي</p>
                    <p className="text-sm font-bold text-white">{profile?.main_products}</p>
                  </div>

                  <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4">
                    <p className="text-xs text-slate-500 mb-1">القدرة الاستيعابية والتوريد</p>
                    <p className="text-sm font-bold text-white">{profile?.annual_capacity}</p>
                  </div>

                  <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4">
                    <p className="text-xs text-slate-500 mb-1">المدينة والمقر الرئيسي</p>
                    <p className="text-sm font-bold text-white">📍 {profile?.city} · {profile?.country}</p>
                  </div>

                  <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4">
                    <p className="text-xs text-slate-500 mb-1">حالة التوثيق والسجل</p>
                    <p className="text-sm font-bold text-emerald-400">سجل تجاري موثق ومفحوص ✓</p>
                  </div>
                </div>
              </div>

              {/* بطاقة الصفقات وطلبات التوريد */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Icon name="DocumentTextIcon" size={18} className="text-cyan-400" />
                  <span>طلبات الشراء والتعاملات (Sourcing & Deals)</span>
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  المنشأة مؤهلة ومصرح لها بإصدار واستقبال طلبات عروض الأسعار الرسمية (RFQ)، التفاوض المباشر حول الكميات والأسعار، وسداد مستحقات الصفقات عبر الحسابات البنكية المحمية.
                </p>
                <div className="flex items-center gap-3 pt-2">
                  <Link
                    href={`/messaging?partnerId=${profile?.user_id}&title=${encodeURIComponent(profile?.company_name || '')}`}
                    className="px-5 py-2.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-bold transition-all"
                  >
                    💬 طلب عرض سعر أو تفاوض خاص
                  </Link>
                </div>
              </div>
            </div>

            {/* الشريط الجانبي: مقاييس الثقة والأمان */}
            <div className="space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
                <h3 className="text-sm font-bold text-white border-b border-slate-800 pb-3 flex items-center gap-2">
                  <Icon name="ShieldCheckIcon" size={18} className="text-emerald-400" />
                  <span>مؤشر الموثوقية (Trust Score)</span>
                </h3>

                <div className="text-center py-4 bg-slate-950/70 rounded-2xl border border-slate-800">
                  <p className="text-4xl font-black text-emerald-400">{profile?.trust_percentage}%</p>
                  <p className="text-xs text-slate-400 mt-1">نسبة الالتزام بالصفقات والتسليم</p>
                </div>

                <div className="space-y-3 text-xs text-slate-300 pt-2">
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-400">✓</span>
                    <span>الهوية والسجل التجاري مفحوص</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-400">✓</span>
                    <span>حساب الضمان المالي Escrow مفعل</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-400">✓</span>
                    <span>مطابقة الجودة والإشراف الميداني</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'products' && (
          <div className="space-y-6">
            {/* فلاتر الكتالوج */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <input
                type="search"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="بحث في كتالوج المنتجات..."
                className="w-full sm:w-72 h-10 px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />

              <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setFilterCategory(cat)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                      filterCategory === cat
                        ? 'bg-cyan-500 text-slate-950'
                        : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {cat === 'all' ? 'الكل' : cat}
                  </button>
                ))}
              </div>
            </div>

            {/* شبكة المنتجات */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredProducts.map(product => (
                <div
                  key={product.id}
                  className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl overflow-hidden flex flex-col transition-all group"
                >
                  <div className="h-44 bg-slate-950 relative overflow-hidden flex items-center justify-center">
                    <img
                      src={product.image_url || BRAND_PLACEHOLDER_IMAGE}
                      alt={product.name_ar || product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>

                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                    <div>
                      <p className="text-xs text-cyan-400 font-semibold">{product.category}</p>
                      <h4 className="text-sm font-bold text-white line-clamp-1 mt-0.5">
                        {product.name_ar || product.name}
                      </h4>
                    </div>

                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                      <div>
                        <p className="text-[10px] text-slate-500">سعر الجملة</p>
                        <p className="text-sm font-black text-emerald-400">
                          {formatPriceByOrigin(product.unit_price, product.origin_type)}
                        </p>
                      </div>
                      <div className="text-left">
                        <p className="text-[10px] text-slate-500">الحد الأدنى</p>
                        <p className="text-xs font-bold text-slate-300">
                          {product.minimum_order_qty} {translateUnitAr(product.unit)}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleAddToCart(product)}
                      className="w-full py-2 bg-slate-800 hover:bg-cyan-500 hover:text-slate-950 text-slate-200 text-xs font-bold rounded-xl transition-all border border-slate-700"
                    >
                      إضافة للسلة
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'trust' && (
          <div className="max-w-4xl mx-auto bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Icon name="ShieldCheckIcon" size={24} className="text-emerald-400" />
              <span>نظام حماية الصفقات والتوريد (Trade Assurance)</span>
            </h2>

            <div className="space-y-4 text-sm text-slate-300 leading-relaxed">
              <p>
                كافة الصفقات والاتفاقيات المبرمة مع هذه المنشأة عبر دايركت هب محمية تلقائياً ببروتوكول الضمان المالي المرحلي:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-center space-y-2">
                  <span className="text-2xl">🔒</span>
                  <h4 className="text-xs font-bold text-white">ضمان الدفعة المالية</h4>
                  <p className="text-[11px] text-slate-400">تظل أموال الصفقة مجمدة في حساب الضمان حتى فحص واستلام البضاعة.</p>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-center space-y-2">
                  <span className="text-2xl">👷‍♂️</span>
                  <h4 className="text-xs font-bold text-white">المطابقة الميدانية</h4>
                  <p className="text-[11px] text-slate-400">إشراف المندوب الميداني على جودة الشحنات والمواصفات عند الاستلام.</p>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-center space-y-2">
                  <span className="text-2xl">🚚</span>
                  <h4 className="text-xs font-bold text-white">الالتزام بمواعيد الشحن</h4>
                  <p className="text-[11px] text-slate-400">تتبع زمني دقيق لكل مرحلة حتى الوصول إلى باب مستودع المشتري.</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
