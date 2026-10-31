'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { maskContactInfo } from '@/lib/privacyShield';
import { useLanguage } from '@/contexts/LanguageContext';


interface SupplierProfile {
  id: string;
  user_id: string;
  company_name: string;
  description: string;
  country: string;
  city: string;
  established_year: number | null;
  employee_count: string;
  main_categories: string[];
  certifications: string[];
  logo_url: string;
  tier: 'standard' | 'verified' | 'premium';
  is_verified: boolean;
  origin_type: 'local' | 'international';
  response_rate: number;
  avg_response_time: string;
  total_rfqs_received: number;
  rating: number;
  review_count: number;
}

const PAGE_SIZE = 24;

type ScopeFilter = 'all' | 'local' | 'international';

const CATEGORY_KEYS = [
  { id: 'All', labelKey: 'catAll' },
  { id: 'Raw Materials', labelKey: 'catRawMaterials' },
  { id: 'Metals', labelKey: 'catMetals' },
  { id: 'Chemicals', labelKey: 'catChemicals' },
  { id: 'Textiles', labelKey: 'catTextiles' },
  { id: 'Electronics', labelKey: 'catElectronics' },
  { id: 'Machinery Parts', labelKey: 'catMachineryParts' },
  { id: 'Food Ingredients', labelKey: 'catFoodIngredients' },
  { id: 'Packaging', labelKey: 'catPackaging' },
  { id: 'Plastics', labelKey: 'catPlastics' },
] as const;

const COUNTRY_IDS = ['China', 'Turkey', 'India', 'Egypt', 'UAE', 'Saudi Arabia', 'Germany', 'South Korea'];

const TIER_COLORS = {
  premium: 'bg-amber-100 text-amber-700 border-amber-200',
  verified: 'bg-blue-100 text-blue-700 border-blue-200',
  standard: 'bg-gray-100 text-gray-600 border-gray-200',
} as const;

function normalizeSupplier(row: Record<string, unknown>): SupplierProfile {
  const tierRaw = String(row.tier || 'standard');
  const tier = (tierRaw === 'premium' || tierRaw === 'verified' || tierRaw === 'standard'
    ? tierRaw
    : 'standard') as SupplierProfile['tier'];

  const mainCategories = Array.isArray(row.main_categories)
    ? row.main_categories.filter((c): c is string => typeof c === 'string')
    : [];
  const certifications = Array.isArray(row.certifications)
    ? row.certifications.filter((c): c is string => typeof c === 'string')
    : [];

  return {
    id: String(row.id || ''),
    user_id: String(row.user_id || ''),
    company_name: String(row.company_name || 'Supplier'),
    description: String(row.description || ''),
    country: String(row.country || ''),
    city: String(row.city || ''),
    established_year: typeof row.established_year === 'number' ? row.established_year : null,
    employee_count: String(row.employee_count || ''),
    main_categories: mainCategories,
    certifications,
    logo_url: String(row.logo_url || ''),
    tier,
    is_verified: Boolean(row.is_verified),
    origin_type: String(row.origin_type || 'local') === 'international' ? 'international' : 'local',
    response_rate: Number(row.response_rate) || 0,
    avg_response_time: String(row.avg_response_time || '—'),
    total_rfqs_received: Number(row.total_rfqs_received) || 0,
    rating: Number(row.rating) || 0,
    review_count: Number(row.review_count) || 0,
  };
}

function SupplierCard({ supplier }: { supplier: SupplierProfile }) {
  const { t } = useLanguage();
  const sp = t.suppliers as Record<string, string>;
  const tierLabel =
    supplier.tier === 'premium' ? sp.premium :
    supplier.tier === 'verified' ? sp.verifiedTier :
    sp.standard;
  const tierColor = TIER_COLORS[supplier.tier] || TIER_COLORS.standard;
  const nameParts = (supplier.company_name || 'S').trim().split(/\s+/).filter(Boolean);
  const initials = nameParts.slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || 'S';
  const categories = supplier.main_categories || [];
  const certifications = supplier.certifications || [];
  const location = [supplier.city, supplier.country].filter(Boolean).join(', ');
  const rating = Number.isFinite(supplier.rating) ? supplier.rating : 0;
  const reviewCount = Number.isFinite(supplier.review_count) ? supplier.review_count : 0;
  const responseRate = Number.isFinite(supplier.response_rate) ? supplier.response_rate : 0;
  const profileHref = supplier.user_id
    ? `/suppliers/${supplier.id}`
    : `/suppliers/${supplier.id}`;
  const rfqHref = supplier.user_id
    ? `/rfq/new?supplier=${supplier.user_id}`
    : `/rfq/new`;
  const chatHref = '/messaging';

  return (
    <div className="bg-card border border-border rounded-2xl p-5 hover:shadow-md hover:border-primary/30 transition-all duration-200 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-lg shrink-0">
          {supplier.logo_url ? (
            <img src={supplier.logo_url} alt={supplier.company_name} className="w-full h-full object-cover rounded-xl" />
          ) : initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-foreground text-sm truncate">{supplier.company_name}</h3>
            {supplier.is_verified && (
              <Icon name="CheckBadgeIcon" size={16} className="text-blue-500 shrink-0" />
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${tierColor}`}>{tierLabel}</span>
            {location && (
              <span className="text-xs text-muted-foreground">{location}</span>
            )}
          </div>
        </div>
      </div>

      {/* Description — contact info masked */}
      {supplier.description && (
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
          {maskContactInfo(supplier.description)}
        </p>
      )}

      {/* Categories */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {categories.slice(0, 3).map(cat => (
            <span key={cat} className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-md">{cat}</span>
          ))}
          {categories.length > 3 && (
            <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-md">+{categories.length - 3}</span>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border">
        <div className="text-center">
          <div className="flex items-center justify-center gap-0.5">
            <Icon name="StarIcon" size={12} className="text-amber-400" />
            <span className="text-sm font-semibold text-foreground">{rating.toFixed(1)}</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {reviewCount} {sp.reviews}
          </p>
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-foreground">{responseRate}%</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{sp.response}</p>
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-foreground">{supplier.avg_response_time || '—'}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{sp.avgReply}</p>
        </div>
      </div>

      {/* Certifications */}
      {certifications.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {certifications.slice(0, 2).map(cert => (
            <span key={cert} className="text-[10px] bg-green-50 text-green-700 border border-green-200 px-1.5 py-0.5 rounded">{cert}</span>
          ))}
          {certifications.length > 2 && (
            <span className="text-[10px] bg-green-50 text-green-700 border border-green-200 px-1.5 py-0.5 rounded">+{certifications.length - 2}</span>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <Link
          href={rfqHref}
          className="flex-1 text-center py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:opacity-90 transition-opacity"
        >
          {sp.sendRfq}
        </Link>
        <Link
          href={chatHref}
          className="flex-1 text-center py-2 border border-border text-foreground text-xs font-semibold rounded-lg hover:bg-muted transition-colors"
        >
          {sp.message}
        </Link>
        <Link
          href={profileHref}
          className="px-3 py-2 border border-border text-foreground text-xs font-semibold rounded-lg hover:bg-muted transition-colors"
          title={sp.viewReviews}
        >
          <Icon name="StarIcon" size={14} className="text-amber-400" />
        </Link>
      </div>
    </div>
  );
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<SupplierProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedCountry, setSelectedCountry] = useState('__all__');
  const [selectedTier, setSelectedTier] = useState('all');
  const [scope, setScope] = useState<ScopeFilter>('all');
  const [sortBy, setSortBy] = useState<'rating' | 'response_rate' | 'total_rfqs_received'>('rating');
  const { t, isRTL } = useLanguage();
  const sp = t.suppliers as Record<string, string>;

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  const fetchSuppliers = useCallback(async (offset: number, append: boolean) => {
    if (append) setLoadingMore(true); else setLoading(true);
    try {
      const fullSelect =
        'id, user_id, company_name, description, country, city, tier, rating, response_rate, avg_response_time, total_rfqs_received, main_categories, certifications, is_verified, origin_type, logo_url, review_count, is_active, created_at';

      const safeTerm = debouncedSearch.replace(/[%,()]/g, ' ').trim();

      let q = supabase
        .from('supplier_profiles')
        .select(fullSelect, { count: 'exact' })
        .eq('is_active', true);

      if (safeTerm) {
        q = q.or(`company_name.ilike.%${safeTerm}%,description.ilike.%${safeTerm}%,country.ilike.%${safeTerm}%,city.ilike.%${safeTerm}%`);
      }
      if (selectedCategory !== 'All') q = q.contains('main_categories', [selectedCategory]);
      if (selectedCountry !== '__all__') q = q.eq('country', selectedCountry);
      if (selectedTier !== 'all') q = q.eq('tier', selectedTier);
      if (scope !== 'all') q = q.eq('origin_type', scope);

      // Verified-first ranking, then local before international (when showing all), then chosen metric
      q = q
        .order('is_verified', { ascending: false })
        .order('origin_type', { ascending: true })
        .order(sortBy, { ascending: false })
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      const { data, error, count } = await q;
      if (error) throw error;

      const mapped = ((data || []) as Record<string, unknown>[]).map(normalizeSupplier);
      setSuppliers(prev => (append ? [...prev, ...mapped] : mapped));
      setTotalCount(typeof count === 'number' ? count : null);
      setHasMore(mapped.length === PAGE_SIZE && (typeof count !== 'number' || offset + mapped.length < count));
    } catch {
      if (!append) {
        setSuppliers([]);
        setTotalCount(0);
      }
      setHasMore(false);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [supabase, debouncedSearch, selectedCategory, selectedCountry, selectedTier, scope, sortBy]);

  useEffect(() => {
    fetchSuppliers(0, false);
  }, [fetchSuppliers]);

  const filtered = suppliers;

  return (
    <div className="min-h-screen bg-background flex flex-col" dir={isRTL ? 'rtl' : 'ltr'}>
      <Header />
      <main className="flex-1">
        {/* Hero */}
        <div className="bg-gradient-to-br from-primary/8 via-background to-background border-b border-border">
          <div className="max-w-7xl mx-auto px-4 md:px-6 py-10 md:py-14">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
                <Icon name="BuildingOffice2Icon" size={14} />
                {sp.directory}
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
                {t.suppliers.title}
              </h1>
              <p className="text-muted-foreground text-sm md:text-base">
                {t.suppliers.subtitle}
              </p>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
          {/* Filters */}
          <div className="bg-card border border-border rounded-2xl p-4 mb-6 flex flex-col gap-3">
            {/* Search */}
            <div className="relative">
              <Icon name="MagnifyingGlassIcon" size={16} className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-muted-foreground`} />
              <input
                type="text"
                placeholder={t.suppliers.searchPlaceholder}
                value={search}
                onChange={e => setSearch(e.target.value)}
                className={`w-full ${isRTL ? 'pr-9 pl-4' : 'pl-9 pr-4'} py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30`}
              />
            </div>

            {/* Filter row */}
            <div className="flex flex-wrap gap-2 items-center">
              {/* Category pills */}
              <div className="flex gap-1.5 overflow-x-auto hide-scrollbar flex-1">
                {CATEGORY_KEYS.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                      selectedCategory === cat.id
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {sp[cat.labelKey] || cat.id}
                  </button>
                ))}
              </div>

              {/* Scope: local vs international */}
              <div className="flex rounded-lg border border-border overflow-hidden text-xs font-medium">
                {([
                  { id: 'all', label: sp.scopeAll || 'All' },
                  { id: 'local', label: sp.scopeLocal || 'Local' },
                  { id: 'international', label: sp.scopeInternational || 'International' },
                ] as { id: ScopeFilter; label: string }[]).map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setScope(opt.id)}
                    className={`px-3 py-1.5 transition-colors ${
                      scope === opt.id
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-background text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Country select */}
              <select
                value={selectedCountry}
                onChange={e => setSelectedCountry(e.target.value)}
                className="px-3 py-1.5 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none focus:border-primary"
              >
                <option value="__all__">{sp.allCountries}</option>
                {COUNTRY_IDS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>

              {/* Tier select */}
              <select
                value={selectedTier}
                onChange={e => setSelectedTier(e.target.value)}
                className="px-3 py-1.5 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none focus:border-primary"
              >
                <option value="all">{sp.allTiers}</option>
                <option value="premium">{sp.premium}</option>
                <option value="verified">{sp.verifiedTier}</option>
                <option value="standard">{sp.standard}</option>
              </select>

              {/* Sort */}
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as typeof sortBy)}
                className="px-3 py-1.5 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none focus:border-primary"
              >
                <option value="rating">{sp.topRated}</option>
                <option value="response_rate">{sp.bestResponse}</option>
                <option value="total_rfqs_received">{sp.mostActive}</option>
              </select>
            </div>
          </div>

          {/* Results count */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{totalCount ?? filtered.length}</span>{' '}
              {sp.suppliersFound}
            </p>
          </div>

          {/* Grid */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-card border border-border rounded-2xl p-5 animate-pulse">
                  <div className="flex gap-3 mb-4">
                    <div className="w-14 h-14 bg-muted rounded-xl" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-muted rounded w-3/4" />
                      <div className="h-3 bg-muted rounded w-1/2" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="h-3 bg-muted rounded" />
                    <div className="h-3 bg-muted rounded w-5/6" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Icon name="BuildingOffice2Icon" size={28} className="text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">
                {sp.noSuppliers}
              </h3>
              <p className="text-sm text-muted-foreground">
                {sp.noSuppliersDesc}
              </p>
              <button
                onClick={() => { setSearch(''); setSelectedCategory('All'); setSelectedCountry('__all__'); setSelectedTier('all'); setScope('all'); }}
                className="mt-4 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg"
              >
                {sp.clearFilters}
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map(supplier => (
                  <SupplierCard key={supplier.id} supplier={supplier} />
                ))}
              </div>
              {hasMore && (
                <div className="flex justify-center mt-6">
                  <button
                    type="button"
                    disabled={loadingMore}
                    onClick={() => fetchSuppliers(suppliers.length, true)}
                    className="px-6 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-lg disabled:opacity-50"
                  >
                    {loadingMore ? '...' : (sp.loadMore || 'Load more')}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
