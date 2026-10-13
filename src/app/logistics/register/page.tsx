'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import Icon from '@/components/ui/AppIcon';
import { useLanguage } from '@/contexts/LanguageContext';
import toast from 'react-hot-toast';

type PartnerType =
  | 'international_shipping_office' |'local_shipping_distribution' |'customs_broker' |'freight_forwarder' |'logistics_company';

type ServiceScope = 'full_service' | 'specialized';
type SpecializedRole = 'sourcing_pickup_china' | 'international_shipping' | 'customs_clearance' | 'local_delivery';

interface RegistrationForm {
  company_name: string;
  partner_type: PartnerType;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  country: string;
  city: string;
  address: string;
  postal_code: string;
  website: string;
  operating_hub: string;
  local_coverage_country: string;
  origin_countries: string[];
  destination_countries: string[];
  covered_ports: string[];
  operational_ports: string[];
  services_offered: string[];
  incoterms_supported: string[];
  base_rate_usd: string;
  rate_description: string;
  service_scope: ServiceScope;
  specialized_role: SpecializedRole | '';
}

// ── 3 Main Categories ─────────────────────────────────────────────────────────
const MAIN_CATEGORIES: {
  value: PartnerType;
  labelAr: string;
  labelEn: string;
  icon: string;
  color: string;
  bgColor: string;
  desc: string;
  details: string;
}[] = [
  {
    value: 'international_shipping_office',
    labelAr: 'مكتب الشحن الدولي',
    labelEn: 'International Shipping Office',
    icon: 'GlobeAltIcon',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 border-blue-200',
    desc: 'خطوط الشحن البحري/الجوي من مراكز التصنيع إلى العالم',
    details: 'مكاتب تعمل من المراكز الصناعية (الصين، تركيا، الهند...) وتتولى الشحن الدولي من المصنع حتى ميناء الوصول',
  },
  {
    value: 'local_shipping_distribution',
    labelAr: 'شركة الشحن والتوزيع المحلي',
    labelEn: 'Local Shipping & Distribution',
    icon: 'TruckIcon',
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50 border-emerald-200',
    desc: 'نقل وتوصيل البضائع داخل دولة الوصول',
    details: 'شركات تعمل داخل دولة واحدة لنقل البضائع من الموانئ إلى مستودع أو باب المشتري',
  },
  {
    value: 'customs_broker',
    labelAr: 'مخلص جمركي',
    labelEn: 'Customs Broker',
    icon: 'DocumentCheckIcon',
    color: 'text-violet-600',
    bgColor: 'bg-violet-50 border-violet-200',
    desc: 'تخليص جمركي لكل منفذ ودولة',
    details: 'وكلاء متخصصون في إجراءات الاستيراد والتصدير والتخليص الجمركي في منافذ محددة',
  },
];

// ── Service Scope Options ──────────────────────────────────────────────────────
const SPECIALIZED_ROLES: { value: SpecializedRole; labelAr: string; labelEn: string; icon: string; color: string; desc: string }[] = [
  {
    value: 'sourcing_pickup_china',
    labelAr: 'مكتب المصادر / الاستلام في الصين',
    labelEn: 'Sourcing / Pickup Office in China',
    icon: 'MapPinIcon',
    color: 'text-orange-600',
    desc: 'استلام البضائع من المصانع في الصين وتجهيزها للشحن',
  },
  {
    value: 'international_shipping',
    labelAr: 'شركة الشحن الدولي',
    labelEn: 'International Freight Company',
    icon: 'GlobeAltIcon',
    color: 'text-blue-600',
    desc: 'نقل البضائع من ميناء الشحن إلى ميناء الوصول دولياً',
  },
  {
    value: 'customs_clearance',
    labelAr: 'مخلص جمركي',
    labelEn: 'Customs Clearance Agent',
    icon: 'DocumentCheckIcon',
    color: 'text-violet-600',
    desc: 'تخليص جمركي في منافذ الاستيراد والتصدير',
  },
  {
    value: 'local_delivery',
    labelAr: 'مكتب التوصيل المحلي',
    labelEn: 'Local Delivery Office',
    icon: 'TruckIcon',
    color: 'text-emerald-600',
    desc: 'توصيل البضائع من الميناء إلى مستودع أو باب المشتري',
  },
];

const COUNTRIES = [
  'Yemen', 'Saudi Arabia', 'UAE', 'Kuwait', 'Qatar', 'Bahrain', 'Oman', 'Egypt', 'Jordan', 'Iraq',
  'China', 'India', 'Turkey', 'Germany', 'USA', 'UK', 'France', 'Italy', 'Spain',
  'South Korea', 'Japan', 'Malaysia', 'Indonesia', 'Vietnam', 'Thailand', 'Pakistan',
  'Bangladesh', 'Morocco', 'Tunisia', 'Algeria', 'Libya', 'Sudan', 'Ethiopia',
  'Kenya', 'Nigeria', 'South Africa', 'Brazil', 'Mexico', 'Canada', 'Australia',
];

// Country dial codes with placeholder mask and max digit length (local part only)
const COUNTRY_DIAL_INFO: Record<string, { dial: string; placeholder: string; maxLen: number }> = {
  'Yemen':         { dial: '+967', placeholder: '7XX XXX XXX',  maxLen: 9 },
  'Saudi Arabia':  { dial: '+966', placeholder: '5X XXX XXXX',  maxLen: 9 },
  'UAE':           { dial: '+971', placeholder: '5X XXX XXXX',  maxLen: 9 },
  'Kuwait':        { dial: '+965', placeholder: 'XXXX XXXX',    maxLen: 8 },
  'Qatar':         { dial: '+974', placeholder: 'XXXX XXXX',    maxLen: 8 },
  'Bahrain':       { dial: '+973', placeholder: 'XXXX XXXX',    maxLen: 8 },
  'Oman':          { dial: '+968', placeholder: 'XXXX XXXX',    maxLen: 8 },
  'Egypt':         { dial: '+20',  placeholder: '1X XXXX XXXX', maxLen: 10 },
  'Jordan':        { dial: '+962', placeholder: '7X XXX XXXX',  maxLen: 9 },
  'Iraq':          { dial: '+964', placeholder: '7XX XXX XXXX', maxLen: 10 },
  'China':         { dial: '+86',  placeholder: '1XX XXXX XXXX',maxLen: 11 },
  'India':         { dial: '+91',  placeholder: 'XXXXX XXXXX',  maxLen: 10 },
  'Turkey':        { dial: '+90',  placeholder: '5XX XXX XXXX', maxLen: 10 },
  'Germany':       { dial: '+49',  placeholder: '1XX XXXXXXXX', maxLen: 11 },
  'USA':           { dial: '+1',   placeholder: 'XXX XXX XXXX', maxLen: 10 },
  'UK':            { dial: '+44',  placeholder: '7XXX XXXXXX',  maxLen: 10 },
  'France':        { dial: '+33',  placeholder: '6 XX XX XX XX',maxLen: 9 },
  'Italy':         { dial: '+39',  placeholder: '3XX XXX XXXX', maxLen: 10 },
  'Spain':         { dial: '+34',  placeholder: '6XX XXX XXX',  maxLen: 9 },
  'South Korea':   { dial: '+82',  placeholder: '10 XXXX XXXX', maxLen: 10 },
  'Japan':         { dial: '+81',  placeholder: '90 XXXX XXXX', maxLen: 10 },
  'Malaysia':      { dial: '+60',  placeholder: '1X XXXX XXXX', maxLen: 10 },
  'Indonesia':     { dial: '+62',  placeholder: '8XX XXXX XXXX',maxLen: 11 },
  'Vietnam':       { dial: '+84',  placeholder: '9XX XXX XXXX', maxLen: 9 },
  'Thailand':      { dial: '+66',  placeholder: '8X XXX XXXX',  maxLen: 9 },
  'Pakistan':      { dial: '+92',  placeholder: '3XX XXX XXXX', maxLen: 10 },
  'Bangladesh':    { dial: '+880', placeholder: '1XXX XXX XXX', maxLen: 10 },
  'Morocco':       { dial: '+212', placeholder: '6XX XXX XXX',  maxLen: 9 },
  'Tunisia':       { dial: '+216', placeholder: 'XX XXX XXX',   maxLen: 8 },
  'Algeria':       { dial: '+213', placeholder: '5XX XXX XXX',  maxLen: 9 },
  'Libya':         { dial: '+218', placeholder: '9X XXX XXXX',  maxLen: 9 },
  'Sudan':         { dial: '+249', placeholder: '9X XXX XXXX',  maxLen: 9 },
  'Ethiopia':      { dial: '+251', placeholder: '9X XXX XXXX',  maxLen: 9 },
  'Kenya':         { dial: '+254', placeholder: '7XX XXX XXX',  maxLen: 9 },
  'Nigeria':       { dial: '+234', placeholder: '8XX XXX XXXX', maxLen: 10 },
  'South Africa':  { dial: '+27',  placeholder: '7X XXX XXXX',  maxLen: 9 },
  'Brazil':        { dial: '+55',  placeholder: '9X XXXX XXXX', maxLen: 11 },
  'Mexico':        { dial: '+52',  placeholder: '1 XXX XXX XXXX',maxLen: 10 },
  'Canada':        { dial: '+1',   placeholder: 'XXX XXX XXXX', maxLen: 10 },
  'Australia':     { dial: '+61',  placeholder: '4XX XXX XXX',  maxLen: 9 },
};

function getDialInfo(country: string) {
  return COUNTRY_DIAL_INFO[country] ?? { dial: '+', placeholder: 'XXXXXXXXXX', maxLen: 15 };
}

const INDUSTRIAL_HUBS = [
  'Guangzhou, China', 'Shenzhen, China', 'Yiwu, China', 'Shanghai, China',
  'Ningbo, China', 'Qingdao, China', 'Tianjin, China', 'Foshan, China',
  'Istanbul, Turkey', 'Mumbai, India', 'Delhi, India', 'Dhaka, Bangladesh',
  'Ho Chi Minh City, Vietnam', 'Jakarta, Indonesia', 'Kuala Lumpur, Malaysia',
  'Seoul, South Korea', 'Osaka, Japan', 'Dubai, UAE', 'Other',
];

const MAJOR_PORTS = [
  'Jeddah Islamic Port', 'King Abdulaziz Port (Dammam)', 'Yanbu Commercial Port',
  'Port of Dubai (Jebel Ali)', 'Port of Abu Dhabi', 'Port of Salalah', 'Port of Muscat',
  'Port of Shanghai', 'Port of Shenzhen', 'Port of Guangzhou', 'Port of Ningbo',
  'Port of Tianjin', 'Port of Qingdao', 'Port of Hong Kong',
  'Port of Singapore', 'Port of Busan', 'Port of Rotterdam', 'Port of Hamburg',
  'Port of Antwerp', 'Port of Felixstowe', 'Port of Los Angeles', 'Port of New York',
  'Port of Mumbai', 'Port of Chennai', 'Port of Colombo', 'Port of Karachi',
  'Port of Istanbul', 'Port of Alexandria', 'Port of Aqaba', 'Port of Beirut',
];

const SERVICES_BY_TYPE: Record<string, string[]> = {
  international_shipping_office: [
    'Sea Freight (FCL)', 'Sea Freight (LCL)', 'Air Freight', 'Express Air Freight',
    'Port Handling', 'Document Preparation', 'Cargo Insurance', 'Packaging & Labeling',
    'Inspection Services', 'Consolidation (LCL)', 'Dangerous Goods Handling',
  ],
  local_shipping_distribution: [
    'Port Pickup', 'Warehouse Storage', 'Door-to-Door Delivery', 'Last-Mile Delivery',
    'Cold Chain Logistics', 'Heavy Cargo Transport', 'Express Delivery',
    'Distribution Network', 'Return Logistics', 'Tracking & Reporting',
  ],
  customs_broker: [
    'Import Clearance', 'Export Clearance', 'Tariff Classification', 'Duty Calculation',
    'Document Preparation', 'Inspection Coordination', 'Compliance Consulting',
    'Bond Management', 'Duty Drawback', 'Free Zone Services',
  ],
};

const DEFAULT_SERVICES = [
  'Sea Freight (FCL)', 'Sea Freight (LCL)', 'Air Freight', 'Land Transport',
  'Customs Clearance', 'Warehousing', 'Door-to-Door Delivery', 'Port Handling',
  'Insurance', 'Document Preparation', 'Inspection Services', 'Packaging',
];

const INCOTERMS = ['EXW', 'FCA', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP', 'FAS', 'FOB', 'CFR', 'CIF'];

const SLA_TEXT = `اتفاقية مستوى الخدمة (SLA) — شركاء اللوجستيات

بموجب هذه الاتفاقية، يلتزم الشريك اللوجستي المسجل بما يلي:

١. المسؤولية عن سلامة البضائع:
يتحمل الشريك اللوجستي المسؤولية الكاملة عن سلامة البضائع المستلمة من لحظة الاستلام حتى التسليم النهائي للمستلم. أي تلف أو فقدان أو تأخير غير مبرر يستوجب التعويض الكامل.

٢. الالتزام بالمواعيد:
يلتزم الشريك بالمواعيد المتفق عليها في كل شحنة. التأخير يستوجب إشعاراً فورياً وتقديم تفسير مقبول وخطة بديلة.

٣. الشفافية والتتبع:
يوفر الشريك تحديثات دورية عن حالة الشحنة ويتيح للمشتري تتبع البضاعة في الوقت الفعلي.

٤. الامتثال القانوني:
يلتزم الشريك بجميع اللوائح الجمركية والقوانين المحلية والدولية المتعلقة بالاستيراد والتصدير.

٥. نظام الضمان المالي:
تُحجز مدفوعات الخدمات اللوجستية في نظام الضمان المرحلي للمنصة ولا تُصرف إلا بعد تأكيد التسليم الناجح.

٦. حل النزاعات:
في حال النزاع، تُحكّم منصة Direct Hub وقرارها ملزم للطرفين.

٧. إخلاء مسؤولية المنصة:
منصة Direct Hub هي وسيط تقني فقط ولا تتحمل مسؤولية مباشرة عن عمليات الشحن، إلا في حدود ما تنص عليه سياسة حماية المشتري.`;

export default function LogisticsRegisterPage() {
  const { t, dir, language } = useLanguage();
  const lr = t.logisticsRegister;

  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const supabase = createClient();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [loading, setLoading] = useState(false);
  const [checkingExisting, setCheckingExisting] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [slaAgreed, setSlaAgreed] = useState(false);
  const [showSla, setShowSla] = useState(false);

  const [form, setForm] = useState<RegistrationForm>({
    company_name: '',
    partner_type: 'international_shipping_office',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    country: '',
    city: '',
    address: '',
    postal_code: '',
    website: '',
    operating_hub: '',
    local_coverage_country: '',
    origin_countries: [],
    destination_countries: [],
    covered_ports: [],
    operational_ports: [],
    services_offered: [],
    incoterms_supported: [],
    base_rate_usd: '',
    rate_description: '',
    service_scope: 'full_service',
    specialized_role: '',
  });

  const [licenseFile, setLicenseFile] = useState<File | null>(null);
  const [customsFile, setCustomsFile] = useState<File | null>(null);
  const [localPhone, setLocalPhone] = useState('');

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  // Check if user already has a logistics partner registration → redirect to dashboard
  useEffect(() => {
    if (authLoading || !user) return;
    const checkExisting = async () => {
      setCheckingExisting(true);
      const { data } = await supabase
        .from('logistics_partners')
        .select('id')
        .eq('user_id', user.id)
        .limit(1)
        .single();
      if (data) {
        router.replace('/logistics/dashboard');
        return;
      }
      setCheckingExisting(false);
    };
    checkExisting();
  }, [user, authLoading, router, supabase]);

  // Sync dial code when country changes
  useEffect(() => {
    if (!form.country) return;
    const info = getDialInfo(form.country);
    setForm(prev => ({ ...prev, contact_phone: localPhone ? `${info.dial} ${localPhone}` : info.dial }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.country]);

  const selectedCategory = MAIN_CATEGORIES.find(c => c.value === form.partner_type);
  const availableServices = SERVICES_BY_TYPE[form.partner_type] || DEFAULT_SERVICES;

  const toggleArrayItem = (field: keyof RegistrationForm, value: string) => {
    const arr = form[field] as string[];
    setForm(prev => ({
      ...prev,
      [field]: arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value],
    }));
  };

  const uploadFile = async (file: File, path: string): Promise<string | null> => {
    const { error: upErr } = await supabase.storage.from('logistics-documents').upload(path, file, { upsert: true });
    if (upErr) return null;
    const { data } = supabase.storage.from('logistics-documents').getPublicUrl(path);
    return data?.publicUrl || null;
  };

  const getCategoryGroup = (type: PartnerType): string => {
    if (type === 'international_shipping_office' || type === 'freight_forwarder') return 'international';
    if (type === 'local_shipping_distribution' || type === 'logistics_company') return 'local';
    if (type === 'customs_broker') return 'customs';
    return 'other';
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (!slaAgreed) { setError('يجب الموافقة على اتفاقية SLA للمتابعة'); return; }
    if (!form.company_name || !form.contact_name || !form.contact_email || !form.country || !form.city || !form.address) {
      setError(lr.errorFillRequired); return;
    }
    if (!form.service_scope) {
      setError(lr.errorServiceScope); return;
    }
    if (form.service_scope === 'specialized' && !form.specialized_role) {
      setError(lr.errorSelectRole); return;
    }
    if (form.partner_type === 'international_shipping_office' && !form.operating_hub) {
      setError(lr.errorIndustrialHub); return;
    }
    if (form.partner_type === 'local_shipping_distribution' && !form.local_coverage_country) {
      setError(lr.errorLocalDistCountry); return;
    }
    if (form.origin_countries.length === 0 && form.partner_type !== 'local_shipping_distribution') {
      setError(lr.errorOriginCountries); return;
    }
    if (form.destination_countries.length === 0 && form.partner_type !== 'customs_broker') {
      setError(lr.errorDestCountries); return;
    }

    setLoading(true);
    setError('');
    try {
      let licenseUrl = null, customsUrl = null;
      if (licenseFile) licenseUrl = await uploadFile(licenseFile, `${user.id}/trade-license.${licenseFile.name.split('.').pop()}`);
      if (customsFile) customsUrl = await uploadFile(customsFile, `${user.id}/customs-license.${customsFile.name.split('.').pop()}`);

      const { error: dbErr } = await supabase.from('logistics_partners').insert({
        user_id: user.id,
        partner_type: form.partner_type,
        partner_category_group: getCategoryGroup(form.partner_type),
        company_name: form.company_name,
        contact_name: form.contact_name,
        contact_email: form.contact_email,
        contact_phone: form.contact_phone,
        country: form.country,
        city: form.city,
        address: form.address,
        postal_code: form.postal_code || null,
        website: form.website || null,
        operating_hub: form.operating_hub || null,
        local_coverage_country: form.local_coverage_country || null,
        origin_countries: form.origin_countries,
        destination_countries: form.destination_countries,
        covered_ports: form.covered_ports,
        operational_ports: form.operational_ports,
        services_offered: form.services_offered,
        incoterms_supported: form.incoterms_supported,
        base_rate_usd: form.base_rate_usd ? parseFloat(form.base_rate_usd) : null,
        rate_description: form.rate_description || null,
        trade_license_url: licenseUrl,
        trade_license_filename: licenseFile?.name || null,
        customs_license_url: customsUrl,
        customs_license_filename: customsFile?.name || null,
        sla_agreed: true,
        sla_agreed_at: new Date().toISOString(),
        status: 'pending',
        service_scope: form.service_scope,
        specialized_role: form.service_scope === 'specialized' ? form.specialized_role || null : null,
      });

      if (dbErr) throw dbErr;
      setSuccess(true);
      // Redirect to dashboard after short delay so user sees success message
      setTimeout(() => router.replace('/logistics/dashboard'), 2000);
    } catch (err: any) {
      const msg = err?.message || 'حدث خطأ أثناء التسجيل. يرجى المحاولة مرة أخرى.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || checkingExisting) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Icon name="ArrowPathIcon" size={32} className="animate-spin text-primary" />
    </div>
  );

  if (success) return (
    <div className="min-h-screen bg-background" dir={dir}>
      <Header />
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-6">
          <Icon name="CheckCircleIcon" size={40} className="text-emerald-600" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-3">تم تقديم طلب التسجيل</h1>
        <p className="text-muted-foreground mb-2">سيتم مراجعة ملفك الشخصي والتحقق من تراخيصك من قبل فريق الإدارة.</p>
        <p className="text-sm text-muted-foreground mb-4">لن يظهر ملفك للعملاء إلا بعد اعتماده من المدير.</p>
        <p className="text-xs text-muted-foreground flex items-center justify-center gap-1.5">
          <Icon name="ArrowPathIcon" size={13} className="animate-spin text-primary" />
          جارٍ التوجيه إلى لوحة التحكم…
        </p>
      </div>
      <BottomNav />
    </div>
  );

  const stepTitles = [lr.stepPartnerCategory, lr.stepCompanyData, lr.stepCoverage, lr.stepDocs];

  return (
    <div className="min-h-screen bg-background" dir={dir}>
      <Header />
      <div className="max-w-2xl mx-auto px-4 py-8 mobile-safe-bottom">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Icon name="TruckIcon" size={20} className="text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">تسجيل شريك لوجستي</h1>
              <p className="text-xs text-muted-foreground">بوابة سوق اللوجستيات والتخليص الجمركي</p>
            </div>
          </div>
          {/* Step Progress */}
          <div className="flex items-center gap-1 mt-5">
            {stepTitles.map((title, i) => (
              <React.Fragment key={i}>
                <div className="flex flex-col items-center gap-1 flex-1">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                    step > i + 1 ? 'bg-emerald-500 text-white' : step === i + 1 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                  }`}>
                    {step > i + 1 ? <Icon name="CheckIcon" size={13} /> : i + 1}
                  </div>
                  <span className={`text-[10px] text-center leading-tight ${step === i + 1 ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>{title}</span>
                </div>
                {i < stepTitles.length - 1 && (
                  <div className={`h-0.5 flex-1 mb-4 transition-colors ${step > i + 1 ? 'bg-emerald-400' : 'bg-muted'}`} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* ── STEP 1: Partner Category ── */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-2">
              <div className="flex items-start gap-2">
                <Icon name="InformationCircleIcon" size={16} className="text-blue-600 mt-0.5 shrink-0" />
                <p className="text-xs text-blue-800 leading-relaxed">
                  {lr.categoryHint}
                </p>
              </div>
            </div>

            <h2 className="text-base font-bold text-foreground">{lr.choosePartnerCategory}</h2>

            <div className="space-y-3">
              {MAIN_CATEGORIES.map(cat => (
                <button
                  key={cat.value}
                  onClick={() => setForm(prev => ({ ...prev, partner_type: cat.value }))}
                  className={`w-full text-right p-4 rounded-2xl border-2 transition-all ${
                    form.partner_type === cat.value
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-border bg-card hover:border-primary/40'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${cat.bgColor}`}>
                      <Icon name={cat.icon as any} size={22} className={cat.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-foreground text-sm">{language === 'ar' ? cat.labelAr : cat.labelEn}</p>
                        {language === 'ar' && (
                        <span className="text-[10px] text-muted-foreground font-normal">{cat.labelEn}</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{cat.desc}</p>
                      <p className="text-[11px] text-muted-foreground/70 mt-1 leading-relaxed">{cat.details}</p>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-1 transition-colors ${
                      form.partner_type === cat.value ? 'border-primary bg-primary' : 'border-border'
                    }`}>
                      {form.partner_type === cat.value && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* ── Service Scope (Mandatory) ── */}
            <div className="mt-6">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center shrink-0">
                  <span className="text-white text-[10px] font-bold">!</span>
                </div>
                <h3 className="text-sm font-bold text-foreground">
                  تحديد نطاق الخدمة <span className="text-red-500">*</span>
                </h3>
              </div>
              <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                {lr.roleRoutingHint}
              </p>

              {/* Option A: Full Service */}
              <button
                type="button"
                onClick={() => setForm(prev => ({ ...prev, service_scope: 'full_service', specialized_role: '' }))}
                className={`w-full text-right p-4 rounded-2xl border-2 transition-all mb-3 ${
                  form.service_scope === 'full_service' ?'border-blue-500 bg-blue-50 shadow-sm' :'border-border bg-card hover:border-blue-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                    form.service_scope === 'full_service' ? 'bg-blue-100 border-blue-200' : 'bg-muted border-border'
                  }`}>
                    <Icon name="HomeModernIcon" size={20} className={form.service_scope === 'full_service' ? 'text-blue-600' : 'text-muted-foreground'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${form.service_scope === 'full_service' ? 'bg-blue-600 text-white' : 'bg-muted text-muted-foreground'}`}>
                        الخيار أ
                      </span>
                      <p className="font-bold text-foreground text-sm">مقدم خدمة شامل (من الباب للباب)</p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      تتولى الرحلة بأكملها: الاستلام من المصنع ← الشحن الدولي ← الجمارك ← التوصيل المحلي
                    </p>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-1 transition-colors ${
                    form.service_scope === 'full_service' ? 'border-blue-500 bg-blue-500' : 'border-border'
                  }`}>
                    {form.service_scope === 'full_service' && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                </div>
              </button>

              {/* Option B: Specialized */}
              <button
                type="button"
                onClick={() => setForm(prev => ({ ...prev, service_scope: 'specialized' }))}
                className={`w-full text-right p-4 rounded-2xl border-2 transition-all ${
                  form.service_scope === 'specialized' ?'border-amber-500 bg-amber-50 shadow-sm' :'border-border bg-card hover:border-amber-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                    form.service_scope === 'specialized' ? 'bg-amber-100 border-amber-200' : 'bg-muted border-border'
                  }`}>
                    <Icon name="PuzzlePieceIcon" size={20} className={form.service_scope === 'specialized' ? 'text-amber-600' : 'text-muted-foreground'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${form.service_scope === 'specialized' ? 'bg-amber-500 text-white' : 'bg-muted text-muted-foreground'}`}>
                        الخيار ب
                      </span>
                      <p className="font-bold text-foreground text-sm">مقدم خدمة متخصصة (مقسمة)</p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      تتعامل مع مرحلة محددة فقط من سلسلة الشحن — حدد دورك بدقة أدناه
                    </p>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-1 transition-colors ${
                    form.service_scope === 'specialized' ? 'border-amber-500 bg-amber-500' : 'border-border'
                  }`}>
                    {form.service_scope === 'specialized' && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                </div>
              </button>

              {/* Specialized Role Sub-selection */}
              {form.service_scope === 'specialized' && (
                <div className="mt-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-2">
                  <p className="text-xs font-bold text-amber-800 mb-3 flex items-center gap-1.5">
                    <Icon name="AdjustmentsHorizontalIcon" size={14} className="text-amber-600" />
                    حدد دورك المتخصص بدقة <span className="text-red-500">*</span>
                  </p>
                  {SPECIALIZED_ROLES.map(role => (
                    <button
                      key={role.value}
                      type="button"
                      onClick={() => setForm(prev => ({ ...prev, specialized_role: role.value }))}
                      className={`w-full text-right p-3 rounded-xl border-2 transition-all ${
                        form.specialized_role === role.value
                          ? 'border-amber-500 bg-white shadow-sm'
                          : 'border-amber-200 bg-white/60 hover:border-amber-400'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon name={role.icon as any} size={16} className={role.color} />
                        <div className="flex-1 min-w-0 text-right">
                          <p className="font-semibold text-foreground text-xs">{language === 'ar' ? role.labelAr : role.labelEn}</p>
                          <p className="text-[10px] text-muted-foreground">{role.desc}</p>
                        </div>
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                          form.specialized_role === role.value ? 'border-amber-500 bg-amber-500' : 'border-border'
                        }`}>
                          {form.specialized_role === role.value && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
                <Icon name="ExclamationCircleIcon" size={16} className="text-red-500 shrink-0" />
                <p className="text-xs text-red-700">{error}</p>
              </div>
            )}

            <button
              onClick={() => {
                if (form.service_scope === 'specialized' && !form.specialized_role) {
                  setError(lr.errorSelectRole);
                  return;
                }
                setError('');
                setStep(2);
              }}
              className="w-full h-12 bg-primary text-primary-foreground rounded-xl font-bold text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2 mt-4"
            >
              التالي
              <Icon name="ArrowLeftIcon" size={16} />
            </button>
          </div>
        )}

        {/* ── STEP 2: Company Details ── */}
        {step === 2 && (
          <div className="space-y-4">
            {selectedCategory && (
              <div className={`flex items-center gap-3 p-3 rounded-xl border ${selectedCategory.bgColor}`}>
                <Icon name={selectedCategory.icon as any} size={18} className={selectedCategory.color} />
                <div>
                  <p className="text-xs font-bold text-foreground">{language === 'ar' ? selectedCategory.labelAr : selectedCategory.labelEn}</p>
                  <p className="text-[10px] text-muted-foreground">{selectedCategory.desc}</p>
                </div>
              </div>
            )}

            <h2 className="text-base font-bold text-foreground">{lr.companyData}</h2>

            <div className="space-y-3">
              {[
                { label: 'اسم الشركة *', field: 'company_name', placeholder: 'الاسم الرسمي للشركة' },
                { label: 'اسم المسؤول *', field: 'contact_name', placeholder: 'الاسم الكامل' },
                { label: 'البريد الإلكتروني *', field: 'contact_email', placeholder: 'email@company.com', type: 'email' },
              ].map(f => (
                <div key={f.field}>
                  <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">{f.label}</label>
                  <input
                    type={f.type || 'text'}
                    value={(form as any)[f.field]}
                    onChange={e => setForm(prev => ({ ...prev, [f.field]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-full h-11 px-4 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary"
                  />
                </div>
              ))}

              {/* Phone input with auto dial code */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">رقم الهاتف *</label>
                {(() => {
                  const info = getDialInfo(form.country);
                  return (
                    <div className="flex h-11 rounded-xl border border-border bg-background focus-within:border-primary overflow-hidden">
                      <span className="flex items-center px-3 text-xs font-semibold text-primary bg-primary/5 border-r border-border whitespace-nowrap select-none">
                        {form.country ? info.dial : '+'}
                      </span>
                      <input
                        type="tel"
                        value={localPhone}
                        onChange={e => {
                          const digits = e.target.value.replace(/[^\d\s]/g, '');
                          setLocalPhone(digits);
                          setForm(prev => ({ ...prev, contact_phone: digits ? `${info.dial} ${digits}` : info.dial }));
                        }}
                        placeholder={form.country ? info.placeholder : lr.selectCountryFirst}
                        maxLength={info.maxLen + Math.floor(info.maxLen / 3)}
                        className="flex-1 min-w-0 px-3 bg-transparent text-foreground text-sm focus:outline-none"
                      />
                    </div>
                  );
                })()}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">الدولة *</label>
                  <select
                    value={form.country}
                    onChange={e => setForm(prev => ({ ...prev, country: e.target.value }))}
                    className="w-full h-11 px-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary"
                  >
                    <option value="">{lr.selectCountry}</option>
                    {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">المدينة *</label>
                  <input
                    value={form.city}
                    onChange={e => setForm(prev => ({ ...prev, city: e.target.value }))}
                    placeholder="المدينة"
                    className="w-full h-11 px-4 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">العنوان الفعلي التفصيلي *</label>
                <input
                  value={form.address}
                  onChange={e => setForm(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="الشارع، المبنى، الحي، الرمز البريدي"
                  className="w-full h-11 px-4 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary"
                />
              </div>

              {/* International Shipping Office: Operating Hub */}
              {form.partner_type === 'international_shipping_office' && (
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                    المركز الصناعي الذي تعمل منه *
                    <span className="text-[10px] font-normal text-muted-foreground/70 mr-1">(المدينة الصناعية الرئيسية)</span>
                  </label>
                  <select
                    value={form.operating_hub}
                    onChange={e => setForm(prev => ({ ...prev, operating_hub: e.target.value }))}
                    className="w-full h-11 px-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary"
                  >
                    <option value="">{lr.selectIndustrialHub}</option>
                    {INDUSTRIAL_HUBS.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              )}

              {/* Local Distribution: Coverage Country */}
              {form.partner_type === 'local_shipping_distribution' && (
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                    الدولة التي تغطيها خدمات التوزيع المحلي *
                    <span className="text-[10px] font-normal text-muted-foreground/70 mr-1">(دولة واحدة فقط)</span>
                  </label>
                  <select
                    value={form.local_coverage_country}
                    onChange={e => setForm(prev => ({ ...prev, local_coverage_country: e.target.value }))}
                    className="w-full h-11 px-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary"
                  >
                    <option value="">{lr.selectCountry}</option>
                    {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">الموقع الإلكتروني</label>
                <input
                  value={form.website}
                  onChange={e => setForm(prev => ({ ...prev, website: e.target.value }))}
                  placeholder="https://www.company.com"
                  className="w-full h-11 px-4 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setStep(1)} className="flex-1 h-11 border border-border rounded-xl text-sm font-semibold text-muted-foreground hover:bg-muted transition-colors">
                السابق
              </button>
              <button
                onClick={() => {
                  if (!form.company_name || !form.contact_name || !form.contact_email || !form.country || !form.city || !form.address) {
                    setError(lr.errorFillRequired);
                    return;
                  }
                  setError('');
                  setStep(3);
                }}
                className="flex-1 h-11 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
              >
                التالي
                <Icon name="ArrowLeftIcon" size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Coverage & Services ── */}
        {step === 3 && (
          <div className="space-y-5">
            <h2 className="text-base font-bold text-foreground">التغطية والمسارات والخدمات</h2>

            {/* Origin Countries — not for local distribution */}
            {form.partner_type !== 'local_shipping_distribution' && (
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-2 block">
                  دول المنشأ / التصدير *
                  <span className="text-[10px] font-normal mr-1">(الدول التي تشحن منها)</span>
                </label>
                <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-3 border border-border rounded-xl bg-background">
                  {COUNTRIES.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => toggleArrayItem('origin_countries', c)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                        form.origin_countries.includes(c)
                          ? 'bg-blue-600 text-white' :'bg-muted text-muted-foreground hover:bg-muted/80'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                {form.origin_countries.length > 0 && (
                  <p className="text-[10px] text-primary mt-1">{form.origin_countries.length} دولة محددة</p>
                )}
              </div>
            )}

            {/* Destination Countries — not for customs broker */}
            {form.partner_type !== 'customs_broker' && (
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-2 block">
                  دول الوجهة / الاستيراد *
                  <span className="text-[10px] font-normal mr-1">(الدول التي تشحن إليها)</span>
                </label>
                <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-3 border border-border rounded-xl bg-background">
                  {COUNTRIES.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => toggleArrayItem('destination_countries', c)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                        form.destination_countries.includes(c)
                          ? 'bg-emerald-600 text-white' :'bg-muted text-muted-foreground hover:bg-muted/80'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                {form.destination_countries.length > 0 && (
                  <p className="text-[10px] text-primary mt-1">{form.destination_countries.length} دولة محددة</p>
                )}
              </div>
            )}

            {/* Operational Ports */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-2 block">
                الموانئ والمطارات التشغيلية
                <span className="text-[10px] font-normal mr-1">(المنافذ التي تعمل فيها)</span>
              </label>
              <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-3 border border-border rounded-xl bg-background">
                {MAJOR_PORTS.map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => toggleArrayItem('operational_ports', p)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                      form.operational_ports.includes(p)
                        ? 'bg-violet-600 text-white'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Services */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-2 block">الخدمات المقدمة</label>
              <div className="flex flex-wrap gap-2 p-3 border border-border rounded-xl bg-background">
                {availableServices.map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleArrayItem('services_offered', s)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                      form.services_offered.includes(s)
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Incoterms — for international/freight */}
            {(form.partner_type === 'international_shipping_office' || form.partner_type === 'freight_forwarder') && (
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-2 block">Incoterms المدعومة</label>
                <div className="flex flex-wrap gap-2 p-3 border border-border rounded-xl bg-background">
                  {INCOTERMS.map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => toggleArrayItem('incoterms_supported', t)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                        form.incoterms_supported.includes(t)
                          ? 'bg-blue-600 text-white' :'bg-muted text-muted-foreground hover:bg-muted/80'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Pricing */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">السعر الأساسي (USD)</label>
                <input
                  type="number"
                  value={form.base_rate_usd}
                  onChange={e => setForm(prev => ({ ...prev, base_rate_usd: e.target.value }))}
                  placeholder="0.00"
                  className="w-full h-11 px-4 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">وصف التسعير</label>
                <input
                  value={form.rate_description}
                  onChange={e => setForm(prev => ({ ...prev, rate_description: e.target.value }))}
                  placeholder="مثال: لكل CBM"
                  className="w-full h-11 px-4 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setStep(2)} className="flex-1 h-11 border border-border rounded-xl text-sm font-semibold text-muted-foreground hover:bg-muted transition-colors">
                السابق
              </button>
              <button
                onClick={() => { setError(''); setStep(4); }}
                className="flex-1 h-11 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
              >
                التالي
                <Icon name="ArrowLeftIcon" size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 4: Documents & SLA ── */}
        {step === 4 && (
          <div className="space-y-5">
            <h2 className="text-base font-bold text-foreground">الوثائق واتفاقية SLA</h2>

            {/* Document Upload */}
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">رخصة التجارة / السجل التجاري</label>
                <label className="flex items-center gap-3 p-3 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 transition-colors">
                  <Icon name="DocumentArrowUpIcon" size={20} className="text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground">{licenseFile ? licenseFile.name : lr.selectPdfOrImage}</p>
                    <p className="text-[10px] text-muted-foreground">{lr.fileHint}</p>
                  </div>
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setLicenseFile(e.target.files?.[0] || null)} className="hidden" />
                </label>
              </div>

              {form.partner_type === 'customs_broker' && (
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">رخصة التخليص الجمركي *</label>
                  <label className="flex items-center gap-3 p-3 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 transition-colors">
                    <Icon name="DocumentCheckIcon" size={20} className="text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground">{customsFile ? customsFile.name : lr.selectPdfOrImage}</p>
                      <p className="text-[10px] text-muted-foreground">{lr.fileHint}</p>
                    </div>
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setCustomsFile(e.target.files?.[0] || null)} className="hidden" />
                  </label>
                </div>
              )}
            </div>

            {/* SLA Agreement */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <Icon name="DocumentTextIcon" size={18} className="text-primary" />
                  <p className="font-bold text-foreground text-sm">اتفاقية مستوى الخدمة (SLA)</p>
                </div>
                <button
                  onClick={() => setShowSla(!showSla)}
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  {showSla ? 'إخفاء' : 'قراءة الاتفاقية'}
                  <Icon name={showSla ? 'ChevronUpIcon' : 'ChevronDownIcon'} size={13} />
                </button>
              </div>
              {showSla && (
                <div className="p-4 bg-muted/20 max-h-48 overflow-y-auto">
                  <pre className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed font-sans">{SLA_TEXT}</pre>
                </div>
              )}
              <div className="p-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={slaAgreed}
                    onChange={e => setSlaAgreed(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded accent-primary"
                  />
                  <span className="text-xs text-foreground leading-relaxed">
                    أوافق على اتفاقية مستوى الخدمة (SLA) وأتحمل المسؤولية الكاملة عن سلامة البضائع المستلمة. أفهم أن مدفوعات الخدمات اللوجستية ستُحجز في نظام الضمان المرحلي ولن تُصرف إلا بعد تأكيد التسليم. <span className="text-red-500">*</span>
                  </span>
                </label>
              </div>
            </div>

            {/* Legal Links */}
            <div className="flex gap-3 flex-wrap">
              <Link href="/legal/buyer-protection" target="_blank" className="flex items-center gap-1.5 text-xs text-primary hover:underline">
                <Icon name="ShieldCheckIcon" size={13} />
                سياسة حماية المشتري
              </Link>
              <Link href="/legal/shipping-terms" target="_blank" className="flex items-center gap-1.5 text-xs text-primary hover:underline">
                <Icon name="DocumentTextIcon" size={13} />
                شروط الشحن والضمان
              </Link>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
                <Icon name="ExclamationCircleIcon" size={16} className="text-red-500 shrink-0" />
                <p className="text-xs text-red-700">{error}</p>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button onClick={() => setStep(3)} className="flex-1 h-11 border border-border rounded-xl text-sm font-semibold text-muted-foreground hover:bg-muted transition-colors">
                السابق
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading || !slaAgreed}
                className="flex-1 h-11 bg-primary text-primary-foreground rounded-xl text-sm font-bold disabled:opacity-50 hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
              >
                {loading ? <Icon name="ArrowPathIcon" size={16} className="animate-spin" /> : <Icon name="CheckCircleIcon" size={16} />}
                تقديم طلب التسجيل
              </button>
            </div>
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
