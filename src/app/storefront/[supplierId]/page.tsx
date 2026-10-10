'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';
import AppLogo from '@/components/ui/AppLogo';
import { useLanguage } from '@/contexts/LanguageContext';
import { fetchUserProfileRow } from '@/lib/fetchUserProfile';
import TrustScoreBadge from '@/components/TrustScoreBadge';

interface SupplierProfile {
  id: string;
  full_name: string;
  company_name: string;
  bio: string;
  avatar_url: string;
  country: string;
  city: string;
  established_year: number;
  registration_status: string;
  kyc_status: string;
  trade_license_url: string;
  main_products?: string;
  annual_capacity?: string;
  certifications?: string;
  trust_percentage?: number;
  verified_tier?: 'unverified' | 'partial' | 'verified';
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
}

export default function PublicStorefrontPage() {
  const { t, dir, language } = useLanguage();
  const sf = t.storefront;

  const params = useParams();
  const router = useRouter();
  const supplierId = params?.supplierId as string;
  const supabase = createClient();

  const [profile, setProfile] = useState<SupplierProfile | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [showRFQModal, setShowRFQModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [rfqForm, setRfqForm] = useState({ quantity: '', notes: '', budget: '' });
  const [rfqSubmitting, setRfqSubmitting] = useState(false);
  const [rfqSuccess, setRfqSuccess] = useState(false);
  const [rfqError, setRfqError] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    if (!supplierId) return;
    fetchStorefront();
    fetchCurrentUser();
  }, [supplierId]);

  const fetchCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUser(user);
  };

  const fetchStorefront = async () => {
    setLoading(true);
    try {
      // Try lookup by user_id first (supplier/factory owner)
      let regData: any = null;
      const { data: byUserId } = await supabase
        .from('factory_registrations')
        .select('user_id, company_name, registration_status, kyc_status, trade_license_url, established_year, main_products, annual_capacity, certifications, trust_percentage, verified_tier')
        .eq('user_id', supplierId)
        .maybeSingle();

      if (byUserId) {
        regData = byUserId;
      } else {
        // Fallback: lookup by registration id directly
        const { data: byId } = await supabase
          .from('factory_registrations')
          .select('user_id, company_name, registration_status, kyc_status, trade_license_url, established_year, main_products, annual_capacity, certifications, trust_percentage, verified_tier')
          .eq('id', supplierId)
          .maybeSingle();
        regData = byId;
      }

      if (!regData) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const resolvedUserId = regData.user_id || supplierId;

      const { data: profileData } = await fetchUserProfileRow(
        supabase,
        resolvedUserId,
        'id, full_name, company_name, bio, avatar_url, country, city'
      );

      setProfile({
        id: resolvedUserId,
        full_name: profileData?.full_name || regData.company_name || sf.supplierFallback,
        company_name: regData.company_name || profileData?.company_name || '',
        bio: profileData?.bio || '',
        avatar_url: profileData?.avatar_url || '',
        country: profileData?.country || '',
        city: profileData?.city || '',
        established_year: regData.established_year || 0,
        registration_status: regData.registration_status || '',
        kyc_status: regData.kyc_status || '',
        trade_license_url: regData.trade_license_url || '',
        main_products: regData.main_products || '',
        annual_capacity: regData.annual_capacity || '',
        certifications: regData.certifications || '',
        trust_percentage: typeof regData.trust_percentage === 'number' ? regData.trust_percentage : 0,
        verified_tier: (regData.verified_tier as 'unverified' | 'partial' | 'verified') || 'unverified',
      });

      const { data: productsData } = await supabase
        .from('manufacturer_products')
        .select('id, name, name_ar, category, unit, unit_price, minimum_order_qty, stock_quantity, inventory_status, origin_country, is_active')
        .eq('manufacturer_id', resolvedUserId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      setProducts(productsData || []);
    } catch (err) {
      console.error('fetchStorefront error:', err);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSendRFQ = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      router.push('/login');
      return;
    }
    if (!rfqForm.quantity.trim()) {
      setRfqError(sf.qtyRequiredError);
      return;
    }
    setRfqSubmitting(true);
    setRfqError('');
    try {
      const rfqNumber = `RFQ-${Date.now().toString(36).toUpperCase()}`;
      const { error } = await supabase.from('rfq_requests').insert({
        rfq_number: rfqNumber,
        buyer_id: currentUser.id,
        factory_id: profile?.id,
        product_id: selectedProduct?.id || null,
        product_name: selectedProduct?.name || sf.generalInquiry,
        quantity: parseInt(rfqForm.quantity) || 1,
        budget: rfqForm.budget ? parseFloat(rfqForm.budget) : null,
        notes: rfqForm.notes.trim() || null,
        status: 'pending',
        source: 'storefront',
      });
      if (error) throw error;
      setRfqSuccess(true);
      setRfqForm({ quantity: '', notes: '', budget: '' });
      setTimeout(() => {
        setShowRFQModal(false);
        setRfqSuccess(false);
        setSelectedProduct(null);
      }, 3000);
    } catch (err: any) {
      setRfqError(err.message || sf.sendFailedRetry);
    } finally {
      setRfqSubmitting(false);
    }
  };

  const categories = [...new Set(products.map(p => p.category))];

  const filteredProducts = products.filter(p => {
    const matchSearch = !searchQuery ||
      p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.name_ar?.includes(searchQuery);
    const matchCat = filterCategory === 'all' || p.category === filterCategory;
    return matchSearch && matchCat;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Icon name="ArrowPathIcon" size={28} className="animate-spin text-primary" />
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 p-6">
        <div className="w-20 h-20 rounded-3xl bg-muted flex items-center justify-center">
          <Icon name="BuildingStorefrontIcon" size={36} className="text-muted-foreground" />
        </div>
        <h1 className="text-xl font-bold text-foreground">{sf.galleryNotFound}</h1>
        <p className="text-sm text-muted-foreground text-center max-w-sm">{sf.notFoundDescLong}</p>
        <Link href="/" className="px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity">
          {sf.backHome}
        </Link>
      </div>
    );
  }

  const isVerified = profile.kyc_status === 'approved' || profile.registration_status === 'approved';
  const initials = (profile.company_name || profile.full_name || 'M').charAt(0).toUpperCase();
  const hasProducts = products.length > 0;

  // WhatsApp direct contact (admin-mediated — uses platform WhatsApp number)
  const whatsappAdminNumber = process.env.NEXT_PUBLIC_SITE_URL ? '967771577632' : '967771577632';
  const whatsappMessage = encodeURIComponent(
    (sf.whatsappInterest || "").replace("{name}", profile.company_name || profile.full_name || "")
  );
  const whatsappUrl = `https://api.whatsapp.com/send?phone=${whatsappAdminNumber}&text=${whatsappMessage}`;

  // Source countries derived from products
  const sourceCountries = [...new Set(products.map(p => p.origin_country).filter(Boolean))];

  return (
    <div className="min-h-screen bg-background" dir={dir}>
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card border-b border-border">
        <div className="max-w-6xl mx-auto px-4 md:px-6 flex items-center gap-3 h-14">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <AppLogo size={26} />
            <span className="font-bold text-sm text-foreground tracking-tight hidden sm:block" translate="no">Direct Hub</span>
          </Link>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            {currentUser ? (
              <Link href="/messaging" className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity">
                <Icon name="ChatBubbleLeftRightIcon" size={15} />
                {sf.messageSupplier}
              </Link>
            ) : (
              <Link href="/login" className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity">
                <Icon name="ArrowRightOnRectangleIcon" size={15} />
                {sf.loginToContact}
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 md:px-6 py-8">
        {/* Supplier Profile Card */}
        <div className="bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 rounded-3xl p-6 md:p-8 mb-8">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
            {/* Avatar */}
            <div className="w-20 h-20 md:w-24 md:h-24 rounded-3xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-white text-3xl font-bold shrink-0 shadow-lg">
              {initials}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap mb-2">
                <h1 className="text-2xl font-bold text-foreground">{profile.company_name || profile.full_name}</h1>
                {isVerified && (
                  <span className="flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                    <Icon name="CheckBadgeIcon" size={13} /> {sf.officiallyVerified}
                  </span>
                )}
                {/* ── Trust Score Badge ── */}
                {(profile.trust_percentage ?? 0) > 0 && (
                  <TrustScoreBadge
                    percentage={profile.trust_percentage ?? 0}
                    tier={profile.verified_tier ?? 'unverified'}
                    size="sm"
                  />
                )}
                {/* ✅ DirectFactory Badge */}
                <span className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                  <Icon name="BuildingOffice2Icon" size={13} />
                  {sf.directFactory}
                </span>
              </div>

              <div className="flex items-center gap-4 flex-wrap text-sm text-muted-foreground mb-3">
                {profile.country && (
                  <span className="flex items-center gap-1">
                    <Icon name="MapPinIcon" size={14} />
                    {profile.city ? `${profile.city}, ` : ''}{profile.country}
                  </span>
                )}
                {profile.established_year > 0 && (
                  <span className="flex items-center gap-1">
                    <Icon name="CalendarIcon" size={14} />
                    {sf.established} {profile.established_year}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Icon name="CubeIcon" size={14} />
                  {products.length}
                </span>
              </div>

              {profile.main_products && (
                <p className="text-xs text-muted-foreground mb-2">
                  <span className="font-semibold text-foreground">{sf.mainProducts}: </span>{profile.main_products}
                </p>
              )}

              {profile.bio && (
                <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">{profile.bio}</p>
              )}

              {/* Meta badges */}
              <div className="flex flex-wrap gap-2 mt-3">
                {profile.annual_capacity && (
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-lg">
                    {sf.capacityLabel} {profile.annual_capacity}
                  </span>
                )}
                {profile.certifications && (
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-lg">
                    {profile.certifications}
                  </span>
                )}
              </div>
            </div>

            {/* CTA */}
            <div className="flex flex-col gap-2 shrink-0 w-full md:w-auto">
              <button
                onClick={() => {
                  if (!currentUser) { router.push('/login'); return; }
                  setSelectedProduct(null);
                  setShowRFQModal(true);
                }}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground text-sm font-bold rounded-2xl hover:opacity-90 transition-opacity shadow-md"
              >
                <Icon name="ClipboardDocumentListIcon" size={16} />
                {sf.sendRfq}
              </button>
              <Link
                href={currentUser ? '/messaging' : '/login'}
                className="flex items-center justify-center gap-2 px-6 py-3 border-2 border-primary text-primary text-sm font-bold rounded-2xl hover:bg-primary/5 transition-colors"
              >
                <Icon name="ChatBubbleLeftRightIcon" size={16} />
                {sf.messageViaPlatform}
              </Link>
              {/* ✅ WhatsApp Direct Contact Button */}
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-6 py-3 bg-[#25D366] text-white text-sm font-bold rounded-2xl hover:bg-[#20b858] transition-colors shadow-md"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                {sf.directContactFactory}
              </a>
            </div>
          </div>
        </div>

        {/* Privacy Notice Banner */}
        <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-2xl px-5 py-4 mb-8">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
            <Icon name="ShieldCheckIcon" size={20} className="text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-blue-900 mb-1">{sf.buySecure}</p>
            <p className="text-xs text-blue-700 leading-relaxed">{sf.secureMessagingNotice}</p>
          </div>
        </div>

        {/* ✅ Source Map — {sf.liveSourcingMap} */}
        {(sourceCountries.length > 0 || profile.country) && (
          <div className="bg-card border border-border rounded-2xl p-5 mb-8">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                <Icon name="GlobeAltIcon" size={16} className="text-emerald-600" />
              </div>
              <h3 className="font-bold text-foreground text-sm">{sf.liveSourcingMap}</h3>
              <span className="text-xs text-muted-foreground">{sf.originCountries}</span>
            </div>
            <div className="flex flex-wrap gap-3">
              {/* Factory country */}
              {profile.country && (
                <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-xl px-4 py-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
                  <div>
                    <p className="text-xs font-bold text-foreground">{profile.country}</p>
                    <p className="text-[10px] text-muted-foreground">{sf.factoryLocation}</p>
                  </div>
                </div>
              )}
              {/* Product origin countries */}
              {sourceCountries.filter(c => c !== profile.country).map(country => (
                <div key={country} className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <div>
                    <p className="text-xs font-bold text-foreground">{country}</p>
                    <p className="text-[10px] text-muted-foreground">{sf.materialSource}</p>
                  </div>
                </div>
              ))}
              {/* Escrow protection badge */}
              <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-2.5">
                <Icon name="ShieldCheckIcon" size={14} className="text-indigo-600" />
                <div>
                  <p className="text-xs font-bold text-indigo-700">{sf.escrowProtectedBadge}</p>
                  <p className="text-[10px] text-muted-foreground">{sf.fullEscrow}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Products Section */}
        <div>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-foreground">{sf.productsAndMaterials}</h2>
            {hasProducts && (
              <span className="text-sm text-muted-foreground">{filteredProducts.length}</span>
            )}
          </div>

          {/* Search & Filter — only shown when products exist */}
          {hasProducts && (
            <div className="flex flex-wrap gap-3 mb-5">
              <div className="flex-1 min-w-[200px] relative">
                <Icon name="MagnifyingGlassIcon" size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder={sf.searchProducts}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full h-10 pr-9 pl-4 rounded-xl border border-border bg-card text-foreground text-sm focus:outline-none focus:border-primary transition-colors"
                />
              </div>
              {categories.length > 1 && (
                <select
                  value={filterCategory}
                  onChange={e => setFilterCategory(e.target.value)}
                  className="h-10 px-3 rounded-xl border border-border bg-card text-foreground text-sm focus:outline-none focus:border-primary transition-colors"
                >
                  <option value="all">{sf.allCategoriesAlt}</option>
                  {categories.map(c => (
                    <option key={c} value={c}>{c.replace('_', ' ')}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* ── EMPTY STATE ── shown when factory has no products yet */}
          {!hasProducts ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 bg-card border border-dashed border-border rounded-3xl text-center">
              {/* Illustration */}
              <div className="relative mb-6">
                <div className="w-24 h-24 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto">
                  <Icon name="BuildingStorefrontIcon" size={44} className="text-primary/60" />
                </div>
                <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-2xl bg-amber-100 border-2 border-white flex items-center justify-center shadow-sm">
                  <Icon name="ClockIcon" size={20} className="text-amber-500" />
                </div>
              </div>

              <h3 className="text-xl font-bold text-foreground mb-2">
                {sf.noProductsYet}
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm leading-relaxed mb-2">{sf.noProductsDescLong}</p>
              <p className="text-xs text-muted-foreground mb-8">
                <Icon name="InformationCircleIcon" size={13} className="inline ml-1 text-primary" />{sf.followSupplierNote}</p>

              {/* Action buttons */}
              <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
                <button
                  onClick={() => {
                    if (!currentUser) { router.push('/login'); return; }
                    setSelectedProduct(null);
                    setRfqForm({ quantity: '1', notes: '', budget: '' });
                    setRfqError('');
                    setRfqSuccess(false);
                    setShowRFQModal(true);
                  }}
                  className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-primary text-primary-foreground text-sm font-bold rounded-2xl hover:opacity-90 transition-opacity shadow-md"
                >
                  <Icon name="ClipboardDocumentListIcon" size={16} />
                  {sf.sendInquiry} (RFQ)
                </button>
                <Link
                  href={currentUser ? '/messaging' : '/login'}
                  className="flex-1 flex items-center justify-center gap-2 px-5 py-3 border-2 border-primary text-primary text-sm font-bold rounded-2xl hover:bg-primary/5 transition-colors"
                >
                  <Icon name="ChatBubbleLeftRightIcon" size={16} />
                  {sf.messageSupplier}
                </Link>
              </div>

              {/* Supplier info hint */}
              <div className="mt-8 flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-xl px-4 py-2.5">
                <Icon name="BuildingOffice2Icon" size={14} className="text-primary shrink-0" />
                <span>
                  {profile.company_name} — {isVerified ? '{sf.verifiedOnPlatform}' : '{sf.registeredOnPlatform}'}
                </span>
              </div>
            </div>
          ) : filteredProducts.length === 0 ? (
            /* Search returned no results */
            <div className="bg-card border border-border rounded-2xl p-12 text-center">
              <Icon name="MagnifyingGlassIcon" size={32} className="text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-semibold text-foreground mb-1">{sf.noMatchingResults}</p>
              <p className="text-xs text-muted-foreground mb-4">{sf.tryDifferentSearch}</p>
              <button
                onClick={() => { setSearchQuery(''); setFilterCategory('all'); }}
                className="px-4 py-2 bg-muted text-foreground text-xs font-semibold rounded-xl hover:bg-muted/80 transition-colors"
              >
                {sf.clearFilters}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProducts.map(product => (
                <div key={product.id} className="bg-card border border-border rounded-2xl overflow-hidden hover:shadow-md transition-shadow group">
                  {/* Product Header */}
                  <div className="bg-gradient-to-br from-muted/60 to-muted/30 px-4 py-5 flex items-center justify-center min-h-[100px]">
                    <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                      <Icon name="CubeIcon" size={28} className="text-primary" />
                    </div>
                  </div>

                  {/* Product Info */}
                  <div className="p-4">
                    <h3 className="font-bold text-foreground text-sm mb-0.5 line-clamp-1">{product.name}</h3>
                    {product.name_ar && <p className="text-xs text-muted-foreground mb-2 line-clamp-1">{product.name_ar}</p>}

                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <span className="text-lg font-bold text-primary">${product.unit_price.toFixed(2)}</span>
                        <span className="text-xs text-muted-foreground">/{product.unit}</span>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        product.inventory_status === 'in_stock' ? 'bg-green-100 text-green-700' :
                        product.inventory_status === 'low_stock'? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {product.inventory_status === 'in_stock' ? '{sf.inStock}' :
                         product.inventory_status === 'low_stock' ? sf.limitedQty : sf.outOfStock}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-muted-foreground mb-4">
                      <span>{sf.moqLabel} {product.minimum_order_qty} {product.unit}</span>
                      {product.origin_country && <span>{sf.originLabel} {product.origin_country}</span>}
                    </div>

                    <button
                      onClick={() => {
                        if (!currentUser) { router.push('/login'); return; }
                        setSelectedProduct(product);
                        setRfqForm({ quantity: String(product.minimum_order_qty), notes: '', budget: '' });
                        setRfqError('');
                        setRfqSuccess(false);
                        setShowRFQModal(true);
                      }}
                      className="w-full h-9 bg-primary text-primary-foreground text-xs font-bold rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5"
                    >
                      <Icon name="ClipboardDocumentListIcon" size={13} />
                      {sf.requestPriceRfq}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Platform CTA — only shown when products exist */}
        {hasProducts && (
          <div className="mt-10 bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-3xl p-6 md:p-8 text-center">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Icon name="ShieldCheckIcon" size={28} className="text-primary" />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-2">{sf.tradeSafely}</h3>
            <p className="text-sm text-muted-foreground max-w-lg mx-auto mb-5 leading-relaxed">{sf.escrowProtected}</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => {
                  if (!currentUser) { router.push('/login'); return; }
                  setSelectedProduct(null);
                  setShowRFQModal(true);
                }}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground text-sm font-bold rounded-2xl hover:opacity-90 transition-opacity"
              >
                <Icon name="ClipboardDocumentListIcon" size={16} />
                {sf.sendQuoteNow}
              </button>
              <Link
                href={currentUser ? '/messaging' : '/login'}
                className="flex items-center justify-center gap-2 px-6 py-3 border-2 border-primary text-primary text-sm font-bold rounded-2xl hover:bg-primary/5 transition-colors"
              >
                <Icon name="ChatBubbleLeftRightIcon" size={16} />
                {sf.openSecureChat}
              </Link>
            </div>
          </div>
        )}
      </main>

      {/* RFQ Modal */}
      {showRFQModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => { setShowRFQModal(false); setRfqSuccess(false); }}>
          <div className="bg-card border border-border rounded-3xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Icon name="ClipboardDocumentListIcon" size={18} className="text-primary" />
                <h3 className="font-bold text-foreground">{sf.sendRfq}</h3>
              </div>
              <button onClick={() => { setShowRFQModal(false); setRfqSuccess(false); }} className="w-8 h-8 rounded-xl hover:bg-muted flex items-center justify-center">
                <Icon name="XMarkIcon" size={16} className="text-muted-foreground" />
              </button>
            </div>

            <div className="p-6">
              {rfqSuccess ? (
                <div className="text-center py-6">
                  <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                    <Icon name="CheckCircleIcon" size={32} className="text-emerald-600" />
                  </div>
                  <h4 className="text-base font-bold text-foreground mb-2">{sf.requestSent}</h4>
                  <p className="text-sm text-muted-foreground">{sf.supplierWillReply}</p>
                </div>
              ) : (
                <form onSubmit={handleSendRFQ} className="space-y-4" dir={dir}>
                  {selectedProduct && (
                    <div className="bg-muted/40 rounded-xl px-4 py-3 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <Icon name="CubeIcon" size={18} className="text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-foreground">{selectedProduct.name}</p>
                        <p className="text-xs text-muted-foreground">{sf.unitPriceLabel || 'Unit price'}: ${selectedProduct.unit_price.toFixed(2)}/{selectedProduct.unit}</p>
                      </div>
                    </div>
                  )}

                  {!selectedProduct && (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-700">
                      <Icon name="InformationCircleIcon" size={14} className="inline ml-1" />
                      {sf.generalInquiryHint || 'You can send a general inquiry or request a price for any product from this supplier'}
                    </div>
                  )}

                  {rfqError && (
                    <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm flex items-center gap-2">
                      <Icon name="ExclamationCircleIcon" size={15} /> {rfqError}
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1.5">{sf.qtyRequired} <span className="text-red-500">*</span></label>
                    <input
                      type="number"
                      min="1"
                      value={rfqForm.quantity}
                      onChange={e => setRfqForm({ ...rfqForm, quantity: e.target.value })}
                      placeholder={`{sf.moqLabel} ${selectedProduct?.minimum_order_qty || 1} ${selectedProduct?.unit || ''}`}
                      required
                      className="w-full h-10 px-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1.5">{sf.budgetOptional}</label>
                    <input
                      type="number"
                      min="0"
                      value={rfqForm.budget}
                      onChange={e => setRfqForm({ ...rfqForm, budget: e.target.value })}
                      placeholder={sf.budgetPlaceholder || 'Enter your approximate budget'}
                      className="w-full h-10 px-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1.5">{sf.extraNotesOptional}</label>
                    <textarea
                      value={rfqForm.notes}
                      onChange={e => setRfqForm({ ...rfqForm, notes: e.target.value })}
                      placeholder={sf.specialReqsPlaceholder || 'Any special requirements, specs, or questions...'}
                      rows={3}
                      className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 resize-none"
                    />
                  </div>

                  {/* Security Note */}
                  <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5">
                    <Icon name="LockClosedIcon" size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-emerald-700">{sf.rfqSecureLong}</p>
                  </div>

                  <div className="flex gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowRFQModal(false)}
                      className="flex-1 h-11 rounded-2xl border border-border text-sm font-semibold text-foreground hover:bg-muted transition-colors"
                    >
                      {sf.cancel}
                    </button>
                    <button
                      type="submit"
                      disabled={rfqSubmitting}
                      className="flex-1 h-11 bg-primary text-primary-foreground rounded-2xl text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                    >
                      {rfqSubmitting ? (
                        <><Icon name="ArrowPathIcon" size={15} className="animate-spin" /> {sf.submitting}</>
                      ) : (
                        <><Icon name="PaperAirplaneIcon" size={15} /> {sf.sendRequest}</>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-border mt-16 py-8">
        <div className="max-w-6xl mx-auto px-4 md:px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <AppLogo size={22} />
            <span className="text-sm font-bold text-foreground" translate="no">Direct Hub</span>
            <span className="text-xs text-muted-foreground">{sf.secureIndustrial}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Icon name="LockClosedIcon" size={13} className="text-emerald-500" />{sf.allTxEscrow}</div>
        </div>
      </footer>
    </div>
  );
}
