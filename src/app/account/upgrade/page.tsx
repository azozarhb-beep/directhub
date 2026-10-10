'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import Icon from '@/components/ui/AppIcon';
import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';

type UpgradeType = 'factory' | 'local_supplier';

interface UpgradeForm {
  requested_type: UpgradeType;
  company_name: string;
  commercial_registration: string;
  vat_number: string;
  city: string;
  country: string;
  contact_phone: string;
  industry_sector: string;
}

export default function AccountUpgradePage() {
  const { t, dir } = useLanguage();
  const u = t.accountUpgrade;

  const router = useRouter();
  const { user, loading } = useAuth();
  const supabase = createClient();

  const upgradeOptions = [
    {
      value: 'factory' as UpgradeType,
      title: u.factory.title,
      desc: u.factory.desc,
      icon: 'BuildingOffice2Icon',
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
      borderColor: 'border-emerald-300',
      badge: u.factory.badge,
      badgeColor: 'bg-emerald-100 text-emerald-700',
      features: u.factory.features,
    },
    {
      value: 'local_supplier' as UpgradeType,
      title: u.localSupplier.title,
      desc: u.localSupplier.desc,
      icon: 'TruckIcon',
      color: 'text-violet-600',
      bgColor: 'bg-violet-50',
      borderColor: 'border-violet-300',
      badge: u.localSupplier.badge,
      badgeColor: 'bg-violet-100 text-violet-700',
      features: u.localSupplier.features,
    },
  ];

  const [selectedType, setSelectedType] = useState<UpgradeType | null>(null);
  const [form, setForm] = useState<UpgradeForm>({
    requested_type: 'factory',
    company_name: '',
    commercial_registration: '',
    vat_number: '',
    city: '',
    country: 'Saudi Arabia',
    contact_phone: '',
    industry_sector: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [existingRequest, setExistingRequest] = useState<any>(null);
  const [checkingRequest, setCheckingRequest] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login?redirect=/account/upgrade');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    const checkExisting = async () => {
      const { data } = await supabase
        .from('account_upgrade_requests')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setExistingRequest(data);
      setCheckingRequest(false);
    };
    checkExisting();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedType || !user) return;
    if (!form.company_name.trim()) {
      setError(u.errCompany);
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const { error: insertError } = await supabase
        .from('account_upgrade_requests')
        .insert({
          user_id: user.id,
          requested_type: selectedType,
          company_name: form.company_name,
          commercial_registration: form.commercial_registration,
          vat_number: form.vat_number,
          city: form.city,
          country: form.country,
          contact_phone: form.contact_phone,
          industry_sector: form.industry_sector,
          documents_submitted: false,
          status: 'pending',
        });
      if (insertError) throw insertError;
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || u.errGeneric);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || checkingRequest) {
    return (
      <div className="min-h-screen bg-background" dir={dir}>
        <Header />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" dir={dir}>
      <Header />
      <main className="max-w-2xl mx-auto px-4 py-8 mobile-safe-bottom">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-6">
          <Link href="/my-account" className="hover:text-foreground">{u.breadcrumbAccount}</Link>
          <Icon name="ChevronLeftIcon" size={12} />
          <span className="text-foreground font-medium">{u.breadcrumbCurrent}</span>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground mb-2">{u.title}</h1>
          <p className="text-sm text-muted-foreground">{u.subtitle}</p>
        </div>

        {existingRequest && !submitted && (
          <div className={`rounded-2xl border-2 p-5 mb-6 ${
            existingRequest.status === 'pending' ? 'bg-amber-50 border-amber-200' :
            existingRequest.status === 'approved' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-start gap-3">
              <Icon
                name={existingRequest.status === 'approved' ? 'CheckCircleIcon' : existingRequest.status === 'pending' ? 'ClockIcon' : 'XCircleIcon'}
                size={20}
                className={existingRequest.status === 'approved' ? 'text-green-600' : existingRequest.status === 'pending' ? 'text-amber-600' : 'text-red-600'}
              />
              <div>
                <p className="font-bold text-sm text-foreground mb-1">
                  {existingRequest.status === 'pending' && u.pendingTitle}
                  {existingRequest.status === 'approved' && u.approvedTitle}
                  {existingRequest.status === 'rejected' && u.rejectedTitle}
                </p>
                <p className="text-xs text-muted-foreground">
                  {existingRequest.status === 'pending' && u.pendingBody}
                  {existingRequest.status === 'approved' && u.approvedBody}
                  {existingRequest.status === 'rejected' && (existingRequest.admin_notes || u.rejectedBody)}
                </p>
                {existingRequest.status === 'approved' && (
                  <Link
                    href="/manufacturer/dashboard"
                    className="inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 bg-green-600 text-white text-xs font-bold rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <Icon name="ArrowRightIcon" size={12} />
                    {u.goDashboard}
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}

        {submitted && (
          <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-6 text-center">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Icon name="CheckCircleIcon" size={28} className="text-green-600" />
            </div>
            <h2 className="text-lg font-bold text-green-800 mb-2">{u.successTitle}</h2>
            <p className="text-sm text-green-700 mb-4">{u.successBody}</p>
            <Link
              href="/my-account"
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-bold rounded-xl hover:bg-green-700 transition-colors"
            >
              <Icon name="ArrowRightIcon" size={14} />
              {u.backAccount}
            </Link>
          </div>
        )}

        {!submitted && !existingRequest && (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <h2 className="text-base font-bold text-foreground mb-3">{u.chooseType}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {upgradeOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSelectedType(opt.value)}
                    className={`relative text-start p-4 rounded-2xl border-2 transition-all duration-200 ${
                      selectedType === opt.value
                        ? `${opt.bgColor} ${opt.borderColor} shadow-md`
                        : 'bg-white border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {selectedType === opt.value && (
                      <div className="absolute top-3 end-3">
                        <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                          <Icon name="CheckIcon" size={12} className="text-white" />
                        </div>
                      </div>
                    )}
                    <div className={`w-10 h-10 rounded-xl ${opt.bgColor} flex items-center justify-center mb-2`}>
                      <Icon name={opt.icon as any} size={20} className={opt.color} />
                    </div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-gray-900 text-sm">{opt.title}</h3>
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${opt.badgeColor}`}>
                        {opt.badge}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mb-2 leading-relaxed">{opt.desc}</p>
                    <ul className="space-y-1">
                      {opt.features.map((f) => (
                        <li key={f} className="flex items-center gap-1 text-[11px] text-gray-600">
                          <Icon name="CheckCircleIcon" size={11} className={opt.color} />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </button>
                ))}
              </div>
            </div>

            {selectedType && (
              <div className="bg-white border border-border rounded-2xl p-5 space-y-4">
                <h2 className="text-base font-bold text-foreground">{u.companyDetails}</h2>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    {u.companyName} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.company_name}
                    onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                    placeholder={u.companyPlaceholder}
                    className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1.5">{u.crNumber}</label>
                    <input
                      type="text"
                      value={form.commercial_registration}
                      onChange={(e) => setForm({ ...form, commercial_registration: e.target.value })}
                      placeholder="1010XXXXXX"
                      className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1.5">{u.vatNumber}</label>
                    <input
                      type="text"
                      value={form.vat_number}
                      onChange={(e) => setForm({ ...form, vat_number: e.target.value })}
                      placeholder="3XXXXXXXXXXXXXXXX3"
                      className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1.5">{u.city}</label>
                    <select
                      value={form.city}
                      onChange={(e) => setForm({ ...form, city: e.target.value })}
                      className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    >
                      <option value="">{u.selectCity}</option>
                      {u.cities.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1.5">{u.phone}</label>
                    <input
                      type="tel"
                      value={form.contact_phone}
                      onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
                      placeholder="05XXXXXXXX"
                      className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">{u.industry}</label>
                  <input
                    type="text"
                    value={form.industry_sector}
                    onChange={(e) => setForm({ ...form, industry_sector: e.target.value })}
                    placeholder={u.industryPlaceholder}
                    className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <div className="flex items-start gap-2">
                    <Icon name="ShieldCheckIcon" size={14} className="text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700 leading-relaxed">
                      <strong>{u.policyLabel}</strong> {u.policyBody}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm flex items-center gap-2">
                <Icon name="ExclamationCircleIcon" size={16} />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={!selectedType || submitting}
              className="w-full h-12 bg-primary text-white rounded-xl font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {u.submitting}
                </>
              ) : (
                <>
                  <Icon name="PaperAirplaneIcon" size={16} />
                  {u.submit}
                </>
              )}
            </button>
          </form>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
