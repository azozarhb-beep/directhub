'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import Icon from '@/components/ui/AppIcon';
import { useLanguage } from '@/contexts/LanguageContext';

interface AgentFactory {
  id: string;
  company_name: string;
  city: string;
  country: string;
}

interface PriceTierRow {
  min_qty: string;
  max_qty: string;
  price: string;
}

const INITIAL_FORM = {
  name_ar: '',
  name_en: '',
  description_ar: '',
  description_en: '',
  category: '',
  is_b2b_only: true,
  wholesale_price: '',
  retail_price: '',
  currency: 'SAR',
  moq: '1',
  unit: 'piece',
  specifications: '',
};

function AddProductPageInner() {
  const { t, dir } = useLanguage();
  const ap = t.agentAddProduct;

  const router = useRouter();
  const searchParams = useSearchParams();
  const factoryId = searchParams?.get('factoryId') || '';
  const { user, loading: authLoading } = useAuth();
  const supabase = createClient();

  const [factory, setFactory] = useState<AgentFactory | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchingFactory, setFetchingFactory] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState(INITIAL_FORM);
  const [tiers, setTiers] = useState<PriceTierRow[]>([]);

  // Auth guard
  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
    if (!authLoading && user) {
      const role = user?.user_metadata?.role;
      if (role !== 'field_agent' && role !== 'admin') router.push('/my-account');
    }
  }, [user, authLoading, router]);

  // Fetch factory
  useEffect(() => {
    if (!user || !factoryId) { setFetchingFactory(false); return; }
    supabase
      .from('agent_factory_registrations')
      .select('id, company_name, city, country')
      .eq('id', factoryId)
      .eq('agent_id', user.id)
      .single()
      .then(({ data, error }) => {
        if (data) setFactory(data);
        setFetchingFactory(false);
      });
  }, [user, factoryId, supabase]);

  const update = (field: string, value: string | boolean) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  const addTier = () => setTiers(prev => [...prev, { min_qty: '', max_qty: '', price: '' }]);
  const removeTier = (idx: number) => setTiers(prev => prev.filter((_, i) => i !== idx));
  const updateTier = (idx: number, field: keyof PriceTierRow, value: string) => {
    setTiers(prev => prev.map((row, i) => (i === idx ? { ...row, [field]: value } : row)));
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !factory) return;
    if (!form.name_ar.trim()) { setError(ap.errorNameRequired); return; }
    if (!form.wholesale_price || isNaN(Number(form.wholesale_price)) || Number(form.wholesale_price) <= 0) { setError(ap.errorWholesale); return; }
    if (!form.is_b2b_only && (!form.retail_price || isNaN(Number(form.retail_price)) || Number(form.retail_price) <= 0)) { setError(ap.errorRetail); return; }
    if (!form.moq || isNaN(Number(form.moq))) { setError(ap.errorMoq); return; }

    const cleanedTiers = tiers
      .filter(r => r.min_qty || r.max_qty || r.price)
      .map(r => ({
        min_qty: Number(r.min_qty),
        max_qty: r.max_qty ? Number(r.max_qty) : null,
        price: Number(r.price),
      }));
    const tiersInvalid = cleanedTiers.some(
      r => !Number.isFinite(r.min_qty) || r.min_qty <= 0 || !Number.isFinite(r.price) || r.price <= 0 ||
        (r.max_qty !== null && (!Number.isFinite(r.max_qty) || r.max_qty < r.min_qty))
    );
    if (tiersInvalid) { setError(ap.errorTier); return; }

    setLoading(true);
    setError('');
    try {
      let specs: Record<string, string> = {};
      if (form.specifications.trim()) {
        form.specifications.split('\n').forEach(line => {
          const parts = line.split(':');
          const key = parts[0];
          const rest = parts.slice(1);
          if (key && rest.length) specs[key.trim()] = rest.join(':').trim();
        });
      }

      const { error: insertError } = await supabase
        .from('agent_products')
        .insert({
          agent_id: user.id,
          factory_id: factory.id,
          name_ar: form.name_ar.trim(),
          name_en: form.name_en.trim(),
          description_ar: form.description_ar.trim(),
          description_en: form.description_en.trim(),
          category: form.category.trim(),
          price: Number(form.wholesale_price),
          wholesale_price: Number(form.wholesale_price),
          retail_price: form.is_b2b_only ? null : Number(form.retail_price),
          is_b2b_only: form.is_b2b_only,
          price_tiers: cleanedTiers,
          currency: form.currency,
          moq: Number(form.moq),
          unit: form.unit,
          specifications: specs,
          is_active: true,
        });
      if (insertError) throw insertError;
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || ap.errorGeneric);
    } finally {
      setLoading(false);
    }
  };

  if (fetchingFactory) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!factoryId || !factory) {
    return (
      <div className="min-h-screen bg-background" dir={dir}>
        <Header />
        <main className="max-w-lg mx-auto px-4 py-16 text-center">
          <Icon name="ExclamationCircleIcon" size={48} className="text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-foreground mb-2">{ap.factoryNotFound}</h2>
          <p className="text-muted-foreground mb-5">{ap.factoryNotFoundDesc}</p>
          <Link href="/agent/dashboard" className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl font-semibold">
            <Icon name="ArrowRightIcon" size={15} />
            {ap.backToDashboard}
          </Link>
        </main>
        <BottomNav />
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-background" dir={dir}>
        <Header />
        <main className="max-w-lg mx-auto px-4 py-16 text-center">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <Icon name="CheckCircleIcon" size={40} className="text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">{ap.successTitle}</h2>
          <p className="text-muted-foreground mb-6">{ap.successDesc.replace('{name}', factory.company_name)}</p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => { setSuccess(false); setForm(INITIAL_FORM); setTiers([]); }}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-colors"
            >
              <Icon name="PlusIcon" size={16} />
              {ap.addAnother}
            </button>
            <Link href="/agent/dashboard" className="flex items-center justify-center gap-2 px-6 py-3 border border-border rounded-xl font-semibold text-muted-foreground hover:bg-muted transition-colors">
              <Icon name="ArrowRightIcon" size={16} />
              {ap.backToDashboard}
            </Link>
          </div>
        </main>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" dir={dir}>
      <Header />
      <main className="max-w-2xl mx-auto px-4 py-6 mobile-safe-bottom">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/agent/dashboard" className="w-9 h-9 rounded-xl border border-border flex items-center justify-center hover:bg-muted transition-colors">
            <Icon name="ArrowRightIcon" size={16} className="text-muted-foreground" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-foreground">{ap.title}</h1>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Icon name="BuildingOffice2Icon" size={11} />
              {factory.company_name} · {factory.city}
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
            <Icon name="ExclamationCircleIcon" size={16} />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-card border border-border rounded-2xl p-5 space-y-4">

          {/* Names */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">{ap.nameAr} <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={form.name_ar}
              onChange={e => update('name_ar', e.target.value)}
              placeholder={ap.nameArPlaceholder}
              className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">{ap.nameEn}</label>
            <input
              type="text"
              value={form.name_en}
              onChange={e => update('name_en', e.target.value)}
              placeholder="e.g. Plastic Garden Chair"
              className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
              dir="ltr"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">{ap.category}</label>
            <input
              type="text"
              value={form.category}
              onChange={e => update('category', e.target.value)}
              placeholder={ap.categoryPlaceholder}
              className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
            />
          </div>

          {/* B2B / B2C Pricing */}
          <div className="space-y-3 p-4 bg-muted/40 border border-border rounded-xl">
            <label className="block text-sm font-medium text-foreground">{ap.pricingModel}</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => update('is_b2b_only', true)}
                className={`text-start px-3 py-2.5 rounded-xl border text-sm transition-colors ${
                  form.is_b2b_only ? 'border-primary bg-primary/10 text-foreground' : 'border-border bg-background text-muted-foreground'
                }`}
              >
                <span className="block font-semibold">{ap.b2bOnly}</span>
                <span className="block text-xs mt-0.5">{ap.b2bOnlyHint}</span>
              </button>
              <button
                type="button"
                onClick={() => update('is_b2b_only', false)}
                className={`text-start px-3 py-2.5 rounded-xl border text-sm transition-colors ${
                  !form.is_b2b_only ? 'border-primary bg-primary/10 text-foreground' : 'border-border bg-background text-muted-foreground'
                }`}
              >
                <span className="block font-semibold">{ap.b2bAndB2c}</span>
                <span className="block text-xs mt-0.5">{ap.b2bAndB2cHint}</span>
              </button>
            </div>

            <div className={`grid gap-3 ${form.is_b2b_only ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">{ap.wholesalePrice} <span className="text-red-500">*</span></label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={form.wholesale_price}
                    onChange={e => update('wholesale_price', e.target.value)}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    className="flex-1 min-w-0 px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                    dir="ltr"
                  />
                  <select
                    value={form.currency}
                    onChange={e => update('currency', e.target.value)}
                    className="w-20 px-2 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:border-primary"
                  >
                    {['SAR', 'USD', 'EUR', 'AED', 'CNY', 'YER'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              {!form.is_b2b_only && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">{ap.retailPrice} <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    value={form.retail_price}
                    onChange={e => update('retail_price', e.target.value)}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                    dir="ltr"
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">{ap.moq} <span className="text-red-500">*</span></label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={form.moq}
                  onChange={e => update('moq', e.target.value)}
                  placeholder="1"
                  min="1"
                  className="flex-1 min-w-0 px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                  dir="ltr"
                />
                <select
                  value={form.unit}
                  onChange={e => update('unit', e.target.value)}
                  className="w-24 px-2 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:border-primary"
                >
                  {['piece', 'kg', 'ton', 'box', 'pallet', 'set', 'meter', 'liter'].map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-foreground">{ap.priceTiers}</label>
                <button
                  type="button"
                  onClick={addTier}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                >
                  <Icon name="PlusIcon" size={12} />
                  {ap.addTier}
                </button>
              </div>
              <p className="text-xs text-muted-foreground mb-2">{ap.priceTiersHint}</p>
              <div className="space-y-2">
                {tiers.map((row, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end">
                    <div>
                      <span className="block text-[11px] text-muted-foreground mb-1">{ap.tierMinQty}</span>
                      <input
                        type="number"
                        min="1"
                        value={row.min_qty}
                        onChange={e => updateTier(idx, 'min_qty', e.target.value)}
                        className="w-full px-2 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-primary"
                        dir="ltr"
                      />
                    </div>
                    <div>
                      <span className="block text-[11px] text-muted-foreground mb-1">{ap.tierMaxQty}</span>
                      <input
                        type="number"
                        min="1"
                        value={row.max_qty}
                        placeholder={ap.tierMaxOpen}
                        onChange={e => updateTier(idx, 'max_qty', e.target.value)}
                        className="w-full px-2 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                        dir="ltr"
                      />
                    </div>
                    <div>
                      <span className="block text-[11px] text-muted-foreground mb-1">{ap.tierPrice}</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={row.price}
                        onChange={e => updateTier(idx, 'price', e.target.value)}
                        className="w-full px-2 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-primary"
                        dir="ltr"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeTier(idx)}
                      aria-label={ap.removeTier}
                      className="w-9 h-9 flex items-center justify-center rounded-lg border border-border text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <Icon name="TrashIcon" size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Descriptions */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">{ap.descAr}</label>
            <textarea
              value={form.description_ar}
              onChange={e => update('description_ar', e.target.value)}
              rows={3}
              placeholder={ap.descArPlaceholder}
              className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">{ap.descEn}</label>
            <textarea
              value={form.description_en}
              onChange={e => update('description_en', e.target.value)}
              rows={2}
              placeholder="Product description in English..."
              className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none"
              dir="ltr"
            />
          </div>

          {/* Specifications */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">{ap.specs}</label>
            <p className="text-xs text-muted-foreground mb-2">{ap.specsHint}</p>
            <textarea
              value={form.specifications}
              onChange={e => update('specifications', e.target.value)}
              rows={4}
              placeholder={ap.specsPlaceholder}
              className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none font-mono"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-3 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {ap.saving}
              </>
            ) : (
              <>
                <Icon name="CheckIcon" size={16} />
                {ap.submit}
              </>
            )}
          </button>
        </form>
      </main>
      <BottomNav />
    </div>
  );
}

export default function AddProductPage() {
  return (
    <React.Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>}>
      <AddProductPageInner />
    </React.Suspense>
  );
}
