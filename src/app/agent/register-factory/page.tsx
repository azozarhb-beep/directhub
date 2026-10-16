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

// Yemeni governorates for local factory and local supplier
const YEMENI_GOVERNORATES = [
  'صنعاء', 'عدن', 'تعز', 'الحديدة', 'إب', 'حضرموت', 'مأرب', 'شبوة',
  'أبين', 'لحج', 'الضالع', 'ذمار', 'حجة', 'عمران', 'صعدة', 'البيضاء',
  'الجوف', 'المحويت', 'المهرة', 'ريمة', 'سقطرى', 'أمانة العاصمة',
];

// World countries in Arabic for international factory
const INTERNATIONAL_COUNTRIES_AR = [
  'اليمن', 'المملكة العربية السعودية', 'الإمارات العربية المتحدة', 'الكويت', 'قطر', 'البحرين', 'عُمان',
  'مصر', 'الأردن', 'العراق', 'سوريا', 'لبنان', 'فلسطين', 'ليبيا',
  'تونس', 'الجزائر', 'المغرب', 'السودان', 'الصومال', 'موريتانيا',
  'الصين', 'تركيا', 'الهند', 'باكستان', 'بنغلاديش', 'إندونيسيا', 'ماليزيا',
  'الفلبين', 'فيتنام', 'تايلاند', 'سنغافورة', 'اليابان', 'كوريا الجنوبية',
  'إيران', 'أفغانستان', 'كازاخستان', 'أوزبكستان', 'إسرائيل',
  'ألمانيا', 'فرنسا', 'المملكة المتحدة', 'إيطاليا', 'إسبانيا', 'روسيا',
  'هولندا', 'بلجيكا', 'السويد', 'النرويج', 'الدنمارك', 'فنلندا',
  'سويسرا', 'النمسا', 'بولندا', 'أوكرانيا', 'رومانيا', 'البرتغال',
  'اليونان', 'التشيك', 'المجر', 'صربيا', 'كرواتيا', 'بلغاريا',
  'الولايات المتحدة الأمريكية', 'كندا', 'المكسيك', 'البرازيل', 'الأرجنتين',
  'كولومبيا', 'تشيلي', 'بيرو', 'فنزويلا', 'الإكوادور',
  'نيجيريا', 'إثيوبيا', 'جنوب أفريقيا', 'كينيا', 'غانا', 'تنزانيا',
  'أستراليا', 'نيوزيلندا',
];

const FACTORY_TYPES = [
  { value: 'local_factory', key: 'localFactory' as const, fallback: 'مصنع محلي' },
  { value: 'international_factory', key: 'intlFactory' as const, fallback: 'مصنع دولي' },
  { value: 'local_supplier', key: 'localSupplier' as const, fallback: 'مورد محلي' },
];

const CONTACT_STATUSES = [
  { value: 'contacting', labelKey: 'statusContacting' as const },
  { value: 'awaiting_license_approval', labelKey: 'statusAwaitingLicense' as const },
  { value: 'documents_submitted', labelKey: 'statusDocsSubmitted' as const },
  { value: 'approved', labelKey: 'statusApproved' as const },
];

interface RegistrationForm {
  company_name: string;
  factory_type: string;
  country: string;
  city: string;
  region: string;
  address: string;
  contact_person: string;
  contact_phone: string;
  contact_email: string;
  website: string;
  industry: string;
  employee_count: string;
  annual_capacity: string;
  contact_status: string;
  agent_notes: string;
}

function RegisterFactoryPageInner() {
  const { t, dir } = useLanguage();
  const arf = t.agentRegisterFactory;

  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const supabase = createClient();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState<RegistrationForm>({
    company_name: '',
    factory_type: 'local_factory',
    country: 'اليمن',
    city: '',
    region: '',
    address: '',
    contact_person: '',
    contact_phone: '',
    contact_email: '',
    website: '',
    industry: '',
    employee_count: '',
    annual_capacity: '',
    contact_status: 'contacting',
    agent_notes: '',
  });

  // Auth guard
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
    if (!authLoading && user) {
      const role = user?.user_metadata?.role;
      if (role !== 'field_agent' && role !== 'admin') {
        router.push('/my-account');
      }
    }
  }, [user, authLoading, router]);

  const isLocalType = form.factory_type === 'local_factory' || form.factory_type === 'local_supplier';

  const update = (field: keyof RegistrationForm, value: string) => {
    setForm(prev => {
      const updated = { ...prev, [field]: value };
      // When switching factory type, reset country/region appropriately
      if (field === 'factory_type') {
        const isLocal = value === 'local_factory' || value === 'local_supplier';
        updated.country = isLocal ? 'اليمن' : 'الصين';
        updated.region = '';
      }
      return updated;
    });
    setError('');
  };

  const validateStep1 = () => {
    if (!form.company_name.trim()) { setError(arf.errorCompanyRequired); return false; }
    if (isLocalType && !form.region.trim()) { setError('يرجى اختيار المحافظة'); return false; }
    if (!form.city.trim()) { setError(isLocalType ? 'يرجى إدخال المديرية / المنطقة' : arf.errorCityRequired); return false; }
    if (!form.industry.trim()) { setError(arf.errorIndustryRequired); return false; }
    return true;
  };

  const validateStep2 = () => {
    if (!form.contact_person.trim()) { setError(arf.errorContactRequired); return false; }
    if (!form.contact_phone.trim()) { setError(arf.errorPhoneRequired); return false; }
    return true;
  };

  const handleNext = () => {
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;
    setStep(s => s + 1);
  };

  const handleSubmit = async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const { error: insertError } = await supabase
        .from('agent_factory_registrations')
        .insert({
          agent_id: user.id,
          company_name: form.company_name.trim(),
          factory_type: form.factory_type,
          country: form.country,
          city: form.city.trim(),
          region: form.region,
          address: form.address.trim(),
          contact_person: form.contact_person.trim(),
          contact_phone: form.contact_phone.trim(),
          contact_email: form.contact_email.trim(),
          website: form.website.trim(),
          industry: form.industry.trim(),
          employee_count: form.employee_count,
          annual_capacity: form.annual_capacity,
          contact_status: form.contact_status,
          agent_notes: form.agent_notes.trim(),
          registration_status: 'pending',
        });
      if (insertError) throw insertError;
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || arf.errorGeneric);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-background" dir={dir}>
        <Header />
        <main className="max-w-lg mx-auto px-4 py-16 text-center">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <Icon name="CheckCircleIcon" size={40} className="text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">{form.factory_type === 'local_supplier' ? arf.successTitleSupplier : arf.successTitle}</h2>
          <p className="text-muted-foreground mb-6">{form.factory_type === 'local_supplier' ? arf.successDescSupplier : arf.successDesc}</p>
          <div className="flex flex-col gap-3">
            <Link
              href="/agent/dashboard"
              className="flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-colors"
            >
              <Icon name="ArrowRightIcon" size={16} />
              {arf.back}
            </Link>
            <button
              onClick={() => {
                setSuccess(false);
                setStep(1);
                setForm({
                  company_name: '', factory_type: 'local_factory', country: 'اليمن',
                  city: '', region: '', address: '', contact_person: '', contact_phone: '',
                  contact_email: '', website: '', industry: '', employee_count: '',
                  annual_capacity: '', contact_status: 'contacting', agent_notes: '',
                });
              }}
              className="flex items-center justify-center gap-2 px-6 py-3 border border-border rounded-xl font-semibold text-muted-foreground hover:bg-muted transition-colors"
            >
              <Icon name="PlusIcon" size={16} />
              {arf.registerAnother}
            </button>
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

        {/* Page Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/agent/dashboard" className="w-9 h-9 rounded-xl border border-border flex items-center justify-center hover:bg-muted transition-colors">
            <Icon name="ArrowRightIcon" size={16} className="text-muted-foreground" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-foreground">{arf.pageTitle} — {arf.newSuffix}</h1>
            <p className="text-xs text-muted-foreground">{arf.stepOf.replace('{step}', String(step))}</p>
          </div>
        </div>

        {/* Progress */}
        <div className="flex gap-2 mb-6">
          {[1, 2, 3].map(s => (
            <div key={s} className={`flex-1 h-1.5 rounded-full transition-colors ${s <= step ? 'bg-primary' : 'bg-muted'}`} />
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
            <Icon name="ExclamationCircleIcon" size={16} />
            {error}
          </div>
        )}

        <div className="bg-card border border-border rounded-2xl p-5">

          {/* Step 1: Basic Info */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="font-bold text-foreground text-base mb-4 flex items-center gap-2">
                <Icon name="BuildingOffice2Icon" size={18} className="text-primary" />
                {arf.basicInfo}
              </h2>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">{arf.companyNameLabel} <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={form.company_name}
                  onChange={e => update('company_name', e.target.value)}
                  placeholder={arf.companyNamePh}
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">{arf.facilityTypeLabel}</label>
                <div className="grid grid-cols-3 gap-2">
                  {FACTORY_TYPES.map(ft => {
                    const translated = (arf as Record<string, any>)?.[ft.key];
                    const label = typeof translated === 'string' && translated.trim() ? translated : ft.fallback;
                    return (
                      <button
                        key={ft.value}
                        type="button"
                        onClick={() => update('factory_type', ft.value)}
                        className={`py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all ${
                          form.factory_type === ft.value
                            ? 'bg-primary text-white border-primary' :'bg-background border-border text-muted-foreground hover:border-primary/50'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {isLocalType ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">{arf.governorateLabel} <span className="text-red-500">*</span></label>
                    <select
                      value={form.region}
                      onChange={e => update('region', e.target.value)}
                      className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:border-primary"
                    >
                      <option value="">{arf.selectGovernorate}</option>
                      {YEMENI_GOVERNORATES.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">المديرية / المنطقة <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={form.city}
                      onChange={e => update('city', e.target.value)}
                      placeholder="مثال: مديرية الصافية، المنطقة الصناعية"
                      className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">الشارع وأقرب مَعلم</label>
                    <textarea
                      value={form.address}
                      onChange={e => update('address', e.target.value)}
                      rows={2}
                      placeholder="مثال: شارع الستين، بجوار جسر مذبح، مقابل محطة الشرعبي"
                      className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1.5">{arf.countryLabel}</label>
                      <select
                        value={form.country}
                        onChange={e => update('country', e.target.value)}
                        className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:border-primary"
                      >
                        {INTERNATIONAL_COUNTRIES_AR.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1.5">{arf.cityLabel} <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        value={form.city}
                        onChange={e => update('city', e.target.value)}
                        placeholder={arf.cityPhIntl}
                        className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">{arf.addressLabel}</label>
                    <textarea
                      value={form.address}
                      onChange={e => update('address', e.target.value)}
                      rows={2}
                      placeholder={arf.addressPh}
                      className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">{arf.industryLabel} <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={form.industry}
                  onChange={e => update('industry', e.target.value)}
                  placeholder={arf.industryPh}
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">{arf.employeesLabel}</label>
                  <select
                    value={form.employee_count}
                    onChange={e => update('employee_count', e.target.value)}
                    className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:border-primary"
                  >
                    <option value="">{arf.selectOption}</option>
                    {['1-10', '11-50', '51-200', '201-500', '500+'].map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">{arf.capacityLabel}</label>
                  <input
                    type="text"
                    value={form.annual_capacity}
                    onChange={e => update('annual_capacity', e.target.value)}
                    placeholder={arf.capacityPh}
                    className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Contact Info */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="font-bold text-foreground text-base mb-4 flex items-center gap-2">
                <Icon name="UserIcon" size={18} className="text-primary" />
                {arf.contactInfo}
              </h2>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">{arf.contactNameLabel} <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={form.contact_person}
                  onChange={e => update('contact_person', e.target.value)}
                  placeholder={arf.contactNamePh}
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">{arf.phoneLabel} <span className="text-red-500">*</span></label>
                <input
                  type="tel"
                  value={form.contact_phone}
                  onChange={e => update('contact_phone', e.target.value)}
                  placeholder="+967 7XX XXX XXX"
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">{arf.businessEmailLabel}</label>
                <input
                  type="email"
                  value={form.contact_email}
                  onChange={e => update('contact_email', e.target.value)}
                  placeholder="factory@example.com"
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                  dir="ltr"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {arf.officialEmail}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">{arf.websiteLabel}</label>
                <input
                  type="url"
                  value={form.website}
                  onChange={e => update('website', e.target.value)}
                  placeholder="https://www.factory.com"
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                  dir="ltr"
                />
              </div>
            </div>
          )}

          {/* Step 3: Status & Notes */}
          {step === 3 && (
            <div className="space-y-4">
              <h2 className="font-bold text-foreground text-base mb-4 flex items-center gap-2">
                <Icon name="ClipboardDocumentListIcon" size={18} className="text-primary" />
                {arf.contactStatusNotes}
              </h2>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">{arf.contactStatusLabel}</label>
                <div className="space-y-2">
                  {CONTACT_STATUSES.map(s => (
                    <button
                      key={s.value}
                      onClick={() => update('contact_status', s.value)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium transition-all text-right ${
                        form.contact_status === s.value
                          ? 'bg-primary/5 border-primary text-primary' :'bg-background border-border text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        form.contact_status === s.value ? 'border-primary' : 'border-muted-foreground'
                      }`}>
                        {form.contact_status === s.value && <div className="w-2 h-2 rounded-full bg-primary" />}
                      </div>
                      {arf[s.labelKey]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">{arf.agentNotesLabel}</label>
                <textarea
                  value={form.agent_notes}
                  onChange={e => update('agent_notes', e.target.value)}
                  rows={4}
                  placeholder={form.factory_type === 'local_supplier' ? arf.notesPlaceholderSupplier : arf.notesPlaceholder}
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none"
                />
              </div>

              {/* Summary */}
              <div className="bg-muted/50 rounded-xl p-4 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground mb-2">{arf.summaryTitle}</p>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{form.factory_type === 'local_supplier' ? arf.summarySupplierName : arf.summaryFactoryName}</span>
                  <span className="font-semibold text-foreground">{form.company_name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{arf.summaryLocation}</span>
                  <span className="font-semibold text-foreground text-left">
                    {isLocalType
                      ? [form.region, form.city, form.address.trim()].filter(Boolean).join('، ')
                      : [form.city, form.country].filter(Boolean).join('، ')}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{arf.summaryContact}</span>
                  <span className="font-semibold text-foreground">{form.contact_person}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{arf.summarySector}</span>
                  <span className="font-semibold text-foreground">{form.industry}</span>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex gap-3 mt-6 pt-4 border-t border-border">
            {step > 1 && (
              <button
                onClick={() => setStep(s => s - 1)}
                className="flex-1 px-4 py-3 border border-border rounded-xl text-sm font-semibold text-muted-foreground hover:bg-muted transition-colors"
              >
                {arf.prev}
              </button>
            )}
            {step < 3 ? (
              <button
                onClick={handleNext}
                className="flex-1 px-4 py-3 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors"
              >
                {arf.next}
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="flex-1 px-4 py-3 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    {arf.saving}
                  </>
                ) : (
                  <>
                    <Icon name="CheckIcon" size={16} />
                    {form.factory_type === 'local_supplier' ? arf.registerSupplierBtn : arf.registerFactoryBtn}
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  );
}

export default function RegisterFactoryPage() {
  return (
    <React.Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>}>
      <RegisterFactoryPageInner />
    </React.Suspense>
  );
}