'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import Icon from '@/components/ui/AppIcon';
import { useLanguage } from '@/contexts/LanguageContext';
import { createNotification } from '@/lib/notificationEngine';

type FactoryType = 'local' | 'international' | 'local_supplier';

interface RegistrationForm {
  company_name: string;
  factory_type: FactoryType;
  commercial_registration_number: string;
  vat_number: string;
  city: string;
  region: string;
  country: string;
  address: string;
  contact_person: string;
  contact_phone: string;
  contact_email: string;
  website: string;
  established_year: string;
  employee_count: string;
  annual_capacity: string;
  main_products: string;
  certifications: string[];
  industry_sector: string;
  sector_id: string;
}

interface SectorRow {
  id: string;
  name_ar: string;
  name_en: string | null;
  slug: string | null;
}

interface SectorProductRow {
  id: string;
  name_ar: string;
  name_en: string | null;
}

// Yemeni governorates for local factory and local supplier
const YEMENI_GOVERNORATES = [
  'صنعاء', 'عدن', 'تعز', 'الحديدة', 'إب', 'حضرموت', 'مأرب', 'شبوة',
  'أبين', 'لحج', 'الضالع', 'ذمار', 'حجة', 'عمران', 'صعدة', 'البيضاء',
  'الجوف', 'المحويت', 'المهرة', 'ريمة', 'سقطرى', 'أمانة العاصمة',
];

// Cascading industrial zones per Yemeni governorate
const YEMEN_INDUSTRIAL_ZONES: Record<string, string[]> = {
  'صنعاء': ['ذهبان وبني الحارث', 'منطقة الحصبة الصناعية', 'منطقة الحثيلي الصناعية', 'منطقة السبعين', 'عصر / مذبح', 'أخرى / مربع عام'],
  'عدن': ['المنطقة الصناعية - المنصورة', 'المنطقة الحرة الصناعية', 'المعلا', 'بئر فضل'],
  'تعز': ['منطقة الحوبان الصناعية', 'البرح', 'وسط المدينة'],
  'الحديدة': ['المنطقة الصناعية كيلو 7', 'المنطقة الصناعية كيلو 16', 'ميناء الحديدة والصليف'],
  'حضرموت': ['منطقة الريان الصناعية', 'المكلا', 'سيئون'],
};
const YEMEN_DEFAULT_ZONES = ['المنطقة الصناعية الرئيسية', 'وسط المحافظة', 'أخرى'];

function getYemenZones(governorate: string): string[] {
  return YEMEN_INDUSTRIAL_ZONES[governorate] ?? YEMEN_DEFAULT_ZONES;
}

// International hubs per country (others fall back to free text)
const SAUDI_COUNTRY = 'المملكة العربية السعودية';
const CHINA_COUNTRY = 'الصين';
const INTERNATIONAL_HUBS: Record<string, string[]> = {
  [SAUDI_COUNTRY]: ['المدينة الصناعية الثانية بالرياض', 'سدير للصناعة', 'الجبيل الصناعية', 'المدينة الصناعية بجدة', 'الدمام الصناعية', 'أخرى'],
  [CHINA_COUNTRY]: ['Guangdong – Foshan Industrial Park', 'Zhejiang – Yiwu Trade Zone', 'Shenzhen', 'Guangzhou', 'Other Hub'],
};

// World countries in Arabic for international factory
const INTERNATIONAL_COUNTRIES_AR = [
  // السعودية ودول الخليج (GCC) والدول العربية الرئيسية
  'المملكة العربية السعودية', 'الإمارات العربية المتحدة', 'قطر', 'الكويت', 'البحرين', 'عُمان',
  'مصر', 'الأردن',
  // الدول الآسيوية الرئيسية
  'الصين', 'تركيا', 'الهند', 'باكستان',
  // بقية الدول العربية
  'اليمن', 'العراق', 'سوريا', 'لبنان', 'فلسطين', 'ليبيا',
  'تونس', 'الجزائر', 'المغرب', 'السودان', 'الصومال', 'موريتانيا',
  'جيبوتي', 'جزر القمر',
  // آسيا
  'بنغلاديش', 'إندونيسيا', 'ماليزيا',
  'الفلبين', 'فيتنام', 'تايلاند', 'سنغافورة', 'اليابان', 'كوريا الجنوبية',
  'كوريا الشمالية', 'تايوان', 'هونغ كونغ', 'إيران', 'أفغانستان', 'نيبال',
  'سريلانكا', 'ميانمار', 'كمبوديا', 'لاوس', 'منغوليا', 'كازاخستان',
  'أوزبكستان', 'تركمانستان', 'طاجيكستان', 'قيرغيزستان', 'أذربيجان',
  'أرمينيا', 'جورجيا', 'قبرص', 'إسرائيل', 'تيمور الشرقية', 'بروناي',
  'المالديف', 'بوتان',
  // أوروبا
  'ألمانيا', 'فرنسا', 'المملكة المتحدة', 'إيطاليا', 'إسبانيا', 'روسيا',
  'هولندا', 'بلجيكا', 'السويد', 'النرويج', 'الدنمارك', 'فنلندا',
  'سويسرا', 'النمسا', 'بولندا', 'أوكرانيا', 'رومانيا', 'البرتغال',
  'اليونان', 'التشيك', 'المجر', 'سلوفاكيا', 'سلوفينيا', 'كرواتيا',
  'صربيا', 'البوسنة والهرسك', 'الجبل الأسود', 'مقدونيا الشمالية',
  'ألبانيا', 'بلغاريا', 'مولدوفا', 'بيلاروسيا', 'إستونيا', 'لاتفيا',
  'ليتوانيا', 'لوكسمبورغ', 'مالطا', 'أيسلندا', 'أيرلندا', 'كوسوفو',
  'أندورا', 'موناكو', 'سان مارينو', 'ليختنشتاين', 'الفاتيكان',
  // أفريقيا
  'نيجيريا', 'إثيوبيا', 'جنوب أفريقيا', 'كينيا', 'غانا', 'تنزانيا',
  'أوغندا', 'رواندا', 'زيمبابوي', 'زامبيا', 'موزمبيق', 'مدغشقر',
  'أنغولا', 'الكاميرون', 'ساحل العاج', 'السنغال', 'مالي', 'بوركينا فاسو',
  'النيجر', 'تشاد', 'إريتريا', 'ليبيريا', 'سيراليون', 'غينيا',
  'غينيا بيساو', 'غينيا الاستوائية', 'الغابون', 'الكونغو', 'الكونغو الديمقراطية',
  'جمهورية أفريقيا الوسطى', 'بوروندي', 'ملاوي', 'ناميبيا', 'بوتسوانا',
  'ليسوتو', 'إسواتيني', 'جنوب السودان', 'الرأس الأخضر', 'سيشيل',
  'جزر القمر', 'ساو تومي وبرينسيبي', 'بنين', 'توغو', 'غامبيا',
  // الأمريكتان
  'الولايات المتحدة الأمريكية', 'كندا', 'المكسيك', 'البرازيل', 'الأرجنتين',
  'كولومبيا', 'تشيلي', 'بيرو', 'فنزويلا', 'الإكوادور', 'بوليفيا',
  'باراغواي', 'أوروغواي', 'غيانا', 'سورينام', 'كوبا', 'هايتي',
  'جمهورية الدومينيكان', 'جامايكا', 'ترينيداد وتوباغو', 'بنما',
  'كوستاريكا', 'غواتيمالا', 'هندوراس', 'السلفادور', 'نيكاراغوا', 'بليز',
  'بربادوس', 'باهاماس', 'غرينادا', 'سانت لوسيا', 'سانت كيتس ونيفيس',
  'سانت فنسنت وجزر غرينادين', 'أنتيغوا وبربودا', 'دومينيكا',
  // أوقيانوسيا
  'أستراليا', 'نيوزيلندا', 'بابوا غينيا الجديدة', 'فيجي', 'جزر سليمان',
  'فانواتو', 'ساموا', 'تونغا', 'كيريباتي', 'ميكرونيزيا', 'جزر مارشال',
  'بالاو', 'ناورو', 'توفالو',
];

// Country dial codes
const COUNTRY_DIAL_INFO: Record<string, { dial: string; placeholder: string; maxLen: number }> = {
  'اليمن':                      { dial: '+967', placeholder: '7XX XXX XXX', maxLen: 9 },
  'المملكة العربية السعودية':   { dial: '+966', placeholder: '5X XXX XXXX', maxLen: 9 },
  'الإمارات العربية المتحدة':   { dial: '+971', placeholder: '5X XXX XXXX', maxLen: 9 },
  'الكويت':                     { dial: '+965', placeholder: 'XXXX XXXX',   maxLen: 8 },
  'قطر':                        { dial: '+974', placeholder: 'XXXX XXXX',   maxLen: 8 },
  'البحرين':                    { dial: '+973', placeholder: 'XXXX XXXX',   maxLen: 8 },
  'عُمان':                      { dial: '+968', placeholder: 'XXXX XXXX',   maxLen: 8 },
  'مصر':                        { dial: '+20',  placeholder: '1X XXXX XXXX',maxLen: 10 },
  'الأردن':                     { dial: '+962', placeholder: '7X XXX XXXX', maxLen: 9 },
  'العراق':                     { dial: '+964', placeholder: '7XX XXX XXXX',maxLen: 10 },
  'سوريا':                      { dial: '+963', placeholder: '9XX XXX XXX', maxLen: 9 },
  'لبنان':                      { dial: '+961', placeholder: 'XX XXX XXX',  maxLen: 8 },
  'فلسطين':                     { dial: '+970', placeholder: '5X XXX XXXX', maxLen: 9 },
  'ليبيا':                      { dial: '+218', placeholder: '9X XXX XXXX', maxLen: 9 },
  'تونس':                       { dial: '+216', placeholder: 'XX XXX XXX',  maxLen: 8 },
  'الجزائر':                    { dial: '+213', placeholder: '5XX XXX XXX', maxLen: 9 },
  'المغرب':                     { dial: '+212', placeholder: '6XX XXX XXX', maxLen: 9 },
  'السودان':                    { dial: '+249', placeholder: '9X XXX XXXX', maxLen: 9 },
  'الصومال':                    { dial: '+252', placeholder: '6X XXX XXX',  maxLen: 8 },
  'الصين':                      { dial: '+86',  placeholder: '1XX XXXX XXXX',maxLen: 11 },
  'الهند':                      { dial: '+91',  placeholder: 'XXXXX XXXXX', maxLen: 10 },
  'تركيا':                      { dial: '+90',  placeholder: '5XX XXX XXXX',maxLen: 10 },
  'باكستان':                    { dial: '+92',  placeholder: '3XX XXX XXXX',maxLen: 10 },
  'بنغلاديش':                   { dial: '+880', placeholder: '1XXX XXX XXX',maxLen: 10 },
  'إندونيسيا':                  { dial: '+62',  placeholder: '8XX XXXX XXXX',maxLen: 11 },
  'ماليزيا':                    { dial: '+60',  placeholder: '1X XXXX XXXX',maxLen: 10 },
  'الفلبين':                    { dial: '+63',  placeholder: '9XX XXX XXXX',maxLen: 10 },
  'فيتنام':                     { dial: '+84',  placeholder: '9XX XXX XXXX',maxLen: 9 },
  'تايلاند':                    { dial: '+66',  placeholder: '8X XXX XXXX', maxLen: 9 },
  'سنغافورة':                   { dial: '+65',  placeholder: 'XXXX XXXX',   maxLen: 8 },
  'اليابان':                    { dial: '+81',  placeholder: '90 XXXX XXXX',maxLen: 10 },
  'كوريا الجنوبية':             { dial: '+82',  placeholder: '10 XXXX XXXX',maxLen: 10 },
  'ألمانيا':                    { dial: '+49',  placeholder: '1XX XXXXXXXX',maxLen: 11 },
  'فرنسا':                      { dial: '+33',  placeholder: '6 XX XX XX XX',maxLen: 9 },
  'المملكة المتحدة':            { dial: '+44',  placeholder: '7XXX XXXXXX', maxLen: 10 },
  'إيطاليا':                    { dial: '+39',  placeholder: '3XX XXX XXXX',maxLen: 10 },
  'إسبانيا':                    { dial: '+34',  placeholder: '6XX XXX XXX', maxLen: 9 },
  'روسيا':                      { dial: '+7',   placeholder: '9XX XXX XXXX',maxLen: 10 },
  'الولايات المتحدة الأمريكية': { dial: '+1',   placeholder: 'XXX XXX XXXX',maxLen: 10 },
  'كندا':                       { dial: '+1',   placeholder: 'XXX XXX XXXX',maxLen: 10 },
  'البرازيل':                   { dial: '+55',  placeholder: '9X XXXX XXXX',maxLen: 11 },
  'أستراليا':                   { dial: '+61',  placeholder: '4XX XXX XXX', maxLen: 9 },
  'نيجيريا':                    { dial: '+234', placeholder: '8XX XXX XXXX',maxLen: 10 },
  'جنوب أفريقيا':               { dial: '+27',  placeholder: '7X XXX XXXX', maxLen: 9 },
  'كينيا':                      { dial: '+254', placeholder: '7XX XXX XXX', maxLen: 9 },
  'إثيوبيا':                    { dial: '+251', placeholder: '9X XXX XXXX', maxLen: 9 },
  'غانا':                       { dial: '+233', placeholder: '2X XXX XXXX', maxLen: 9 },
  'إيران':                      { dial: '+98',  placeholder: '9XX XXX XXXX',maxLen: 10 },
  'إسرائيل':                    { dial: '+972', placeholder: '5X XXX XXXX', maxLen: 9 },
  'هولندا':                     { dial: '+31',  placeholder: '6 XXXX XXXX', maxLen: 9 },
  'بلجيكا':                     { dial: '+32',  placeholder: '4XX XX XX XX',maxLen: 9 },
  'السويد':                     { dial: '+46',  placeholder: '7X XXX XXXX', maxLen: 9 },
  'النرويج':                    { dial: '+47',  placeholder: 'XXX XX XXX',  maxLen: 8 },
  'الدنمارك':                   { dial: '+45',  placeholder: 'XX XX XX XX', maxLen: 8 },
  'بولندا':                     { dial: '+48',  placeholder: '5XX XXX XXX', maxLen: 9 },
  'أوكرانيا':                   { dial: '+380', placeholder: '5X XXX XXXX', maxLen: 9 },
  'المكسيك':                    { dial: '+52',  placeholder: '1 XXX XXX XXXX',maxLen: 10 },
  'الأرجنتين':                  { dial: '+54',  placeholder: '9 11 XXXX XXXX',maxLen: 10 },
};

function getDialInfo(country: string) {
  return COUNTRY_DIAL_INFO[country] ?? { dial: '+967', placeholder: '7XX XXX XXX', maxLen: 9 };
}

// Country name (Arabic) -> ISO code used by the zones table
const COUNTRY_ISO: Record<string, string> = {
  'اليمن': 'YE',
  'الصين': 'CN',
  'تركيا': 'TR',
  'المملكة العربية السعودية': 'SA',
  'الإمارات العربية المتحدة': 'AE',
  'مصر': 'EG',
  'الهند': 'IN',
  'عُمان': 'OM',
};

interface ZoneOption {
  zone_id: string;
  country_code: string;
  province_city: string;
  zone_name: string;
  has_rep: boolean;
}

interface DuplicateInfo {
  status: 'ok' | 'assigned' | 'unassigned';
  matched_field: string | null;
  registration_id: string | null;
  company_name: string | null;
  rep_id: string | null;
  rep_name: string | null;
  is_own: boolean;
}

const CERTIFICATIONS_OPTIONS = [
  'ISO 9001', 'ISO 14001', 'ISO 45001', 'ISO 22000', 'HACCP',
  'CE Mark', 'FDA', 'SASO', 'SFDA', 'Halal', 'Kosher', 'GMP', 'Other',
];

const EMPLOYEE_OPTIONS = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'];

const EMPTY_FORM: RegistrationForm = {
  company_name: '',
  factory_type: 'local',
  commercial_registration_number: '',
  vat_number: '',
  city: '',
  region: '',
  country: 'اليمن',
  address: '',
  contact_person: '',
  contact_phone: '',
  contact_email: '',
  website: '',
  established_year: '',
  employee_count: '',
  annual_capacity: '',
  main_products: '',
  certifications: [],
  industry_sector: '',
  sector_id: '',
};

function FactoryRegisterPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const supabase = createClient();
  const { t, dir, isRTL } = useLanguage();
  const fr = t.factoryRegister;

  // Capture agent_id from URL query param (referral tracking)
  const agentIdFromUrl = searchParams.get('agent_id') || null;

  // Referral code (?ref=AGT-XXXXXXXX) — persisted so it survives navigation
  const [referralCode, setReferralCode] = useState('');
  const [resolvedAgentId, setResolvedAgentId] = useState<string | null>(agentIdFromUrl);

  useEffect(() => {
    let code = (searchParams.get('ref') || '').trim();
    try {
      if (code) {
        window.localStorage.setItem('dh_referral_code', code);
        window.localStorage.setItem(
          'dh_referral_code_expires_at',
          String(Date.now() + 180 * 24 * 60 * 60 * 1000)
        );
        document.cookie = `dh_referral_code=${encodeURIComponent(code)}; path=/; max-age=${60 * 60 * 24 * 180}; SameSite=Lax`;
      } else {
        const expiresAt = Number(window.localStorage.getItem('dh_referral_code_expires_at') || 0);
        if (expiresAt && Date.now() > expiresAt) {
          window.localStorage.removeItem('dh_referral_code');
        window.localStorage.removeItem('dh_referral_code_expires_at');
          window.localStorage.removeItem('dh_referral_code_expires_at');
        } else {
          code = window.localStorage.getItem('dh_referral_code') || '';
        }
      }
    } catch {
      // storage unavailable
    }
    if (!code) return;
    setReferralCode(code);
    let cancelled = false;
    fetch(`/api/referral/resolve?code=${encodeURIComponent(code)}`)
      .then((r) => r.json())
      .then((res) => {
        if (!cancelled && res?.agentId) setResolvedAgentId(res.agentId);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [searchParams]);

  const effectiveAgentId = agentIdFromUrl || resolvedAgentId;

  const [form, setForm] = useState<RegistrationForm>(EMPTY_FORM);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [existingReg, setExistingReg] = useState<any>(null);
  const [checkingExisting, setCheckingExisting] = useState(true);
  const [localPhone, setLocalPhone] = useState('');
  const [sectors, setSectors] = useState<SectorRow[]>([]);
  const [sectorProducts, setSectorProducts] = useState<SectorProductRow[]>([]);
  const [zoneOptions, setZoneOptions] = useState<ZoneOption[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState('');
  const [duplicate, setDuplicate] = useState<DuplicateInfo | null>(null);
  const [linkRequestSent, setLinkRequestSent] = useState(false);
  const [requestingLink, setRequestingLink] = useState(false);

  const countryIso = COUNTRY_ISO[form.country] || '';

  useEffect(() => {
    if (!countryIso) {
      setZoneOptions([]);
      setSelectedZoneId('');
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error: zonesErr } = await supabase.rpc('list_active_zones', { p_country_code: countryIso });
      if (cancelled) return;
      setZoneOptions(zonesErr ? [] : ((data as ZoneOption[]) ?? []));
      setSelectedZoneId('');
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countryIso]);

  const runDuplicateCheck = async (): Promise<DuplicateInfo | null> => {
    const { data, error: dupErr } = await supabase.rpc('check_registration_duplicate', {
      p_commercial_register: form.commercial_registration_number,
      p_phone: form.contact_phone,
    });
    if (dupErr) {
      console.error('[Duplicate check] failed:', dupErr.message);
      return null;
    }
    const row = (Array.isArray(data) ? data[0] : data) as DuplicateInfo | undefined;
    if (!row || row.status === 'ok' || row.is_own) {
      setDuplicate(null);
      return null;
    }
    setDuplicate(row);
    return row;
  };

  const requestRepSupervision = async () => {
    if (!duplicate?.registration_id) return;
    setRequestingLink(true);
    const { error: reqErr } = await supabase.rpc('request_rep_supervision', {
      p_registration_id: duplicate.registration_id,
    });
    setRequestingLink(false);
    if (reqErr) {
      setError(reqErr.message);
      return;
    }
    setLinkRequestSent(true);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error: sectorsErr } = await supabase
        .from('industry_sectors')
        .select('id, name_ar, name_en, slug')
        .order('sort_order', { ascending: true });
      if (!cancelled && !sectorsErr) setSectors((data as SectorRow[]) ?? []);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!form.sector_id) {
      setSectorProducts([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error: prodErr } = await supabase
        .from('sector_products')
        .select('id, name_ar, name_en')
        .eq('sector_id', form.sector_id)
        .order('created_at', { ascending: true });
      if (!cancelled && !prodErr) setSectorProducts((data as SectorProductRow[]) ?? []);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.sector_id]);

  // Sync dial code when country changes
  useEffect(() => {
    const info = getDialInfo(form.country);
    const currentDial = info.dial;
    const stripped = form.contact_phone.startsWith(currentDial)
      ? form.contact_phone.slice(currentDial.length).trim()
      : localPhone;
    setLocalPhone(stripped);
    setForm((f) => ({ ...f, contact_phone: stripped ? `${info.dial} ${stripped}` : info.dial }));
  }, [form.country]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      checkExistingRegistration();
    }
  }, [user]);

  const checkExistingRegistration = async () => {
    setCheckingExisting(true);
    try {
      const { data } = await supabase
        .from('factory_registrations')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle();
      setExistingReg(data);
      if (data) {
        const factoryType = (data.seller_category === 'local_supplier' ? 'local_supplier' : data.seller_category === 'international_factory' ? 'international' : 'local') as FactoryType;
        setForm({
          company_name: data.company_name || '',
          factory_type: factoryType,
          commercial_registration_number: data.commercial_registration_number || '',
          vat_number: data.vat_number || '',
          city: data.city || '',
          region: data.region || '',
          country: data.country || 'اليمن',
          address: data.address || '',
          contact_person: data.contact_person || '',
          contact_phone: data.contact_phone || '',
          contact_email: data.contact_email || '',
          website: data.website || '',
          established_year: data.established_year ? String(data.established_year) : '',
          employee_count: data.employee_count || '',
          annual_capacity: data.annual_capacity || '',
          main_products: Array.isArray(data.main_products) ? data.main_products.join(', ') : '',
          certifications: Array.isArray(data.certifications) ? data.certifications : [],
          industry_sector: data.industry_sector || '',
          sector_id: data.sector_id || '',
        });
      } else {
        setForm((f) => ({ ...f, contact_email: '' }));
      }
    } catch (err) {
      console.error('Check existing:', err);
    } finally {
      setCheckingExisting(false);
    }
  };

  const toggleCertification = (cert: string) => {
    setForm((f) => ({
      ...f,
      certifications: f.certifications.includes(cert)
        ? f.certifications.filter((c) => c !== cert)
        : [...f.certifications, cert],
    }));
  };

  const handleSubmit = async () => {
    setError('');
    if (!form.company_name.trim()) { setError(fr.errorCompanyName); return; }
    if (!form.contact_person.trim()) { setError(fr.errorContactPerson); return; }
    if (!form.contact_phone.trim()) { setError(fr.errorContactPhone); return; }
    if (form.factory_type === 'local' && !form.commercial_registration_number.trim()) {
      setError(fr.errorCRNumber);
      return;
    }

    setLoading(true);
    try {
      // ── Universal duplicate prevention (commercial register + phone) ──────
      const dup = await runDuplicateCheck();
      if (dup) {
        setStep(dup.matched_field === 'commercial_register' ? 2 : 3);
        setLoading(false);
        return;
      }

      const sellerCategory =
        form.factory_type === 'local' ? 'local_factory' :
        form.factory_type === 'international' ? 'international_factory' : 'local_supplier';

      // ── Determine registration status ──────────────────────────────────────
      let registrationStatus = 'pending';
      let isApproved = false;
      let approvalType: string | null = null;

      // If agent_id is present in URL → apply fast-track approval immediately
      if (effectiveAgentId) {
        registrationStatus = 'approved';
        isApproved = true;
        approvalType = 'fast_track_initial';
      } else {
        // ── Check platform settings for staged approval ──────────────────────
        try {
          const { data: settingsData } = await supabase
            .from('platform_settings')
            .select('setting_key, setting_value')
            .in('setting_key', ['initial_auto_launch_batch', 'require_supplier_approval']);
          const map: Record<string, string> = {};
          (settingsData || []).forEach((s: any) => { map[s.setting_key] = s.setting_value; });
          const autoLaunch = map['initial_auto_launch_batch'] !== 'false';
          if (autoLaunch) {
            registrationStatus = 'approved';
            isApproved = true;
          } else if (map['require_supplier_approval'] === 'true') {
            registrationStatus = 'pending_supplier_approval';
            isApproved = false;
          } else {
            registrationStatus = 'approved';
            isApproved = true;
          }
        } catch {
          registrationStatus = 'pending';
          isApproved = false;
        }
      }

      const payload: Record<string, any> = {
        user_id: user!.id,
        company_name: form.company_name.trim(),
        factory_type: form.factory_type === 'local_supplier' ? 'local' : form.factory_type,
        seller_category: sellerCategory,
        commercial_registration_number: form.commercial_registration_number.trim(),
        vat_number: form.vat_number.trim(),
        city: form.city.trim(),
        region: form.region,
        country: form.country,
        address: form.address.trim(),
        contact_person: form.contact_person.trim(),
        contact_phone: form.contact_phone.trim(),
        contact_email: form.contact_email.trim(),
        website: form.website.trim(),
        established_year: form.established_year ? parseInt(form.established_year) : null,
        employee_count: form.employee_count,
        annual_capacity: form.annual_capacity.trim(),
        main_products: form.main_products.split(',').map((p) => p.trim()).filter(Boolean),
        certifications: form.certifications,
        industry_sector: form.industry_sector || null,
        sector_id: form.sector_id || null,
        registration_status: registrationStatus,
        kyc_status: 'pending',
        is_approved: isApproved,
        product_listing_unlocked: isApproved,
        updated_at: new Date().toISOString(),
      };

      // Attach agent referral if present
      if (effectiveAgentId) {
        payload.referred_by_agent_id = effectiveAgentId;
        payload.approval_type = approvalType;
        payload.fast_track_approved_at = new Date().toISOString();
      }
      if (referralCode) {
        payload.referred_by_agent_code = referralCode.trim().toUpperCase();
      }

      let facilityId: string | null = existingReg?.id ?? null;
      if (existingReg) {
        const { error: updateErr } = await supabase
          .from('factory_registrations')
          .update(payload)
          .eq('id', existingReg.id);
        if (updateErr) throw updateErr;
      } else {
        const { data: inserted, error: insertErr } = await supabase
          .from('factory_registrations')
          .insert(payload)
          .select('id')
          .single();
        if (insertErr) throw insertErr;
        facilityId = inserted?.id ?? null;
      }

      // ── Bind facility → agent (agent_id, referred_by_agent_code, agent_referrals) ──
      if (facilityId && referralCode) {
        const { error: bindErr } = await supabase.rpc('bind_facility_referral', {
          p_facility_id: facilityId,
          p_code: referralCode.trim(),
        });
        if (bindErr) console.error('[Referral] bind failed:', bindErr.message);
      }

      // ── Territory routing: match zone -> field rep, or mark "بانتظار التعيين" ──
      if (facilityId && selectedZoneId) {
        const { error: zoneErr } = await supabase.rpc('bind_registration_to_zone', {
          p_zone_id: selectedZoneId,
        });
        if (zoneErr) console.error('[Territory] zone bind failed:', zoneErr.message);
      }

      // ── Notify user: factory registered ─────────────────────────────────
      const notifResult = await createNotification(supabase, 'factory_registered', user!.id, 'ar', {
        companyName: form.company_name.trim(),
      });
      if (!notifResult.success) console.error('[Notification] Failed:', notifResult.error);

      try {
        window.localStorage.removeItem('dh_referral_code');
        document.cookie = 'dh_referral_code=; path=/; max-age=0; SameSite=Lax';
      } catch {
        // ignore
      }

      // Keep the profile in sync so every later routing check agrees with the chosen type
      if (form.factory_type !== 'local_supplier') {
        try {
          await supabase
            .from('user_profiles')
            .update({ seller_category: sellerCategory, country: form.country })
            .eq('id', user!.id);
        } catch {
          // non-blocking
        }
      }

      // Strict routing by factory type: international → International Control Room, local → Local Dashboard
      router.push(
        form.factory_type === 'international' ?'/manufacturer/international-dashboard?registered=1' :'/manufacturer/dashboard?registered=1'
      );
    } catch (err: any) {
      const msg: string = err?.message || '';
      if (err?.code === '23505' && /uq_factory_regs_(commercial_register|phone)/.test(msg)) {
        setError('هذا المصنع/المورد مسجل مسبقاً. تواصل مع الدعم أو أرسل طلب ربط وإشراف ميداني.');
      } else {
        setError(msg || t.common.error);
      }
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || checkingExisting) {
    return (
    <div className="min-h-screen bg-background flex items-center justify-center" dir={dir}>
        <Icon name="ArrowPathIcon" size={28} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  const isLocal = form.factory_type === 'local' || form.factory_type === 'local_supplier';

  return (
    <div className="min-h-screen bg-background" dir={dir}>
      <Header />
      <main className="max-w-2xl mx-auto px-4 md:px-6 py-8 mobile-safe-bottom md:pb-12">

        {/* Page header */}
        <div className="mb-8">
          <div className={`flex items-center gap-2 text-sm text-muted-foreground mb-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <Link href="/" className="hover:text-foreground transition-colors">{fr.breadcrumbHome}</Link>
            <Icon name={isRTL ? 'ChevronLeftIcon' : 'ChevronRightIcon'} size={14} />
            <span className="text-foreground font-medium">{fr.breadcrumbCurrent}</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">{fr.pageTitle}</h1>
          <p className="text-sm text-muted-foreground mt-1">{fr.pageSubtitle}</p>
        </div>

        {/* Agent Referral Banner — shown only when agent_id is in URL */}
        {effectiveAgentId && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6 flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
              <Icon name="BoltIcon" size={16} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-emerald-800">⚡ تسجيل عبر رابط المندوب — قبول سريع</p>
              <p className="text-xs text-emerald-700 mt-0.5">
                تم التعرف على رابط الدعوة. سيتم تفعيل حسابك فور إتمام التسجيل بدون انتظار مراجعة يدوية.
              </p>
            </div>
          </div>
        )}

        {/* Priority banner */}
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-6 flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
            <Icon name="StarIcon" size={16} className="text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{fr.priorityBannerTitle}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{fr.priorityBannerDesc}</p>
          </div>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <React.Fragment key={s}>
              <div className={`flex items-center gap-2 ${step >= s ? 'text-primary' : 'text-muted-foreground'}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${step > s ? 'bg-primary border-primary text-primary-foreground' : step === s ? 'border-primary text-primary' : 'border-border text-muted-foreground'}`}>
                  {step > s ? <Icon name="CheckIcon" size={13} /> : s}
                </div>
                <span className="text-xs font-medium hidden sm:block">
                  {s === 1 ? fr.step1Label : s === 2 ? fr.step2Label : fr.step3Label}
                </span>
              </div>
              {s < 3 && <div className={`flex-1 h-0.5 ${step > s ? 'bg-primary' : 'bg-border'}`} />}
            </React.Fragment>
          ))}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm flex items-center gap-2 mb-5">
            <Icon name="ExclamationCircleIcon" size={16} />
            {error}
          </div>
        )}

        {/* Duplicate prevention banners */}
        {duplicate?.status === 'assigned' && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm flex items-start gap-2 mb-5">
            <Icon name="NoSymbolIcon" size={16} className="mt-0.5 shrink-0" />
            <span>{`هذا المصنع/المورد مسجل مسبقاً ومسند للمشرف الميداني (${duplicate.rep_name || '—'}).`}</span>
          </div>
        )}
        {duplicate?.status === 'unassigned' && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3 text-sm mb-5 space-y-3">
            <div className="flex items-start gap-2">
              <Icon name="ExclamationTriangleIcon" size={16} className="mt-0.5 shrink-0" />
              <span>المصنع مسجل مسبقاً بدون مشرف، هل تريد إرسال طلب ربط وإشراف ميداني؟</span>
            </div>
            {linkRequestSent ? (
              <p className="text-emerald-700 font-semibold text-xs">تم إرسال طلب الربط والإشراف الميداني إلى الإدارة.</p>
            ) : (
              <button
                type="button"
                onClick={requestRepSupervision}
                disabled={requestingLink}
                className="h-9 px-4 rounded-lg bg-amber-600 text-white text-xs font-semibold disabled:opacity-60"
              >
                {requestingLink ? '...' : 'نعم، إرسال طلب ربط وإشراف ميداني'}
              </button>
            )}
          </div>
        )}

        {/* STEP 1: Factory Type */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-base font-bold text-foreground mb-1">{fr.selectFactoryType}</h2>
              <p className="text-sm text-muted-foreground">{fr.selectFactoryTypeDesc}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Local Factory */}
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, factory_type: 'local', country: 'اليمن', region: '' }))}
                className={`relative p-5 rounded-2xl border-2 text-left transition-all ${form.factory_type === 'local' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40 bg-card'}`}
              >
                {form.factory_type === 'local' && (
                  <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                    <Icon name="CheckIcon" size={11} className="text-primary-foreground" />
                  </div>
                )}
                <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center mb-3">
                  <Icon name="BuildingOffice2Icon" size={20} className="text-green-700" />
                </div>
                <p className="font-bold text-foreground text-sm mb-1">{fr.localFactory}</p>
                <p className="text-xs text-muted-foreground">{fr.localFactoryDesc}</p>
                <div className="mt-3 inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                  <Icon name="StarIcon" size={10} /> {fr.priorityListing}
                </div>
              </button>

              {/* International Factory */}
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, factory_type: 'international', country: 'الصين', region: '' }))}
                className={`relative p-5 rounded-2xl border-2 text-left transition-all ${form.factory_type === 'international' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40 bg-card'}`}
              >
                {form.factory_type === 'international' && (
                  <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                    <Icon name="CheckIcon" size={11} className="text-primary-foreground" />
                  </div>
                )}
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center mb-3">
                  <Icon name="GlobeAltIcon" size={20} className="text-blue-700" />
                </div>
                <p className="font-bold text-foreground text-sm mb-1">{fr.internationalFactory}</p>
                <p className="text-xs text-muted-foreground">{fr.internationalFactoryDesc}</p>
                <div className="mt-3 inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                  <Icon name="GlobeAltIcon" size={10} /> {fr.globalReach}
                </div>
              </button>

              {/* Local Supplier */}
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, factory_type: 'local_supplier', country: 'اليمن', region: '' }))}
                className={`relative p-5 rounded-2xl border-2 text-left transition-all sm:col-span-2 ${form.factory_type === 'local_supplier' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40 bg-card'}`}
              >
                {form.factory_type === 'local_supplier' && (
                  <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                    <Icon name="CheckIcon" size={11} className="text-primary-foreground" />
                  </div>
                )}
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center mb-3">
                  <Icon name="TruckIcon" size={20} className="text-amber-700" />
                </div>
                <p className="font-bold text-foreground text-sm mb-1">{fr.localSupplierTitle}</p>
                <p className="text-xs text-muted-foreground">{fr.localSupplierDescBuyers || fr.localSupplierDesc}</p>
                <div className="mt-3 inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-semibold">
                  <Icon name="BuildingStorefrontIcon" size={10} /> {fr.localSupply}
                </div>
              </button>
            </div>

            {/* Pending approval notice */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
              <Icon name="ClockIcon" size={18} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800">{fr.manualApproval}</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  {fr.manualApprovalDesc}
                </p>
              </div>
            </div>

            <button
              onClick={() => setStep(2)}
              className="w-full h-11 bg-primary text-primary-foreground rounded-xl text-sm font-semibold flex items-center justify-center gap-2 active:opacity-80 transition-opacity"
            >
              {fr.continueBtn} <Icon name={isRTL ? 'ArrowLeftIcon' : 'ArrowRightIcon'} size={16} />
            </button>
          </div>
        )}

        {/* STEP 2: Company Info */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-bold text-foreground mb-1">{fr.companyInfoTitle}</h2>
              <p className="text-sm text-muted-foreground">{fr.companyInfoDesc}</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1">{fr.companyNameLabel}</label>
              <input
                type="text"
                value={form.company_name}
                onChange={(e) => setForm((f) => ({ ...f, company_name: e.target.value }))}
                placeholder={fr.companyNamePlaceholder}
                className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
              />
            </div>

            {/* Referral code (locked when provided via link) */}
            {referralCode && (
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  رمز الإحالة / كود المندوب
                </label>
                <input
                  type="text"
                  value={referralCode}
                  readOnly
                  disabled
                  dir="ltr"
                  className="w-full h-10 px-3 rounded-lg border border-border bg-muted text-foreground text-sm font-mono cursor-not-allowed"
                />
              </div>
            )}

            {/* Industry Sector */}
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                {fr.industrySmartRouting}
                <span className="text-red-500 ml-1">*</span>
              </label>
              <select
                value={form.sector_id}
                onChange={(e) => {
                  const picked = sectors.find((s) => s.id === e.target.value);
                  setForm((f) => ({
                    ...f,
                    sector_id: e.target.value,
                    industry_sector: picked?.slug ?? '',
                  }));
                }}
                className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary transition-colors"
              >
                <option value="">{fr.selectIndustry}</option>
                {sectors.map((s) => (
                  <option key={s.id} value={s.id}>
                    {isRTL ? s.name_ar : (s.name_en || s.name_ar)}
                  </option>
                ))}
              </select>
            </div>

            {isLocal && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">{fr.crNumberLabel}</label>
                  <input
                    type="text"
                    value={form.commercial_registration_number}
                    onChange={(e) => setForm((f) => ({ ...f, commercial_registration_number: e.target.value }))}
                    placeholder="مثال: 12345"
                    className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">{fr.vatNumberLabel}</label>
                  <input
                    type="text"
                    value={form.vat_number}
                    onChange={(e) => setForm((f) => ({ ...f, vat_number: e.target.value }))}
                    placeholder="مثال: 0012345"
                    className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
                  />
                </div>
              </div>
            )}

            {!isLocal && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">{fr.crNumberLabel}</label>
                  <input
                    type="text"
                    value={form.commercial_registration_number}
                    onChange={(e) => setForm((f) => ({ ...f, commercial_registration_number: e.target.value }))}
                    placeholder="e.g., CR-987654"
                    dir="ltr"
                    className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">{fr.vatNumberLabel}</label>
                  <input
                    type="text"
                    value={form.vat_number}
                    onChange={(e) => setForm((f) => ({ ...f, vat_number: e.target.value }))}
                    placeholder="e.g., VAT-123456"
                    dir="ltr"
                    className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
                  />
                </div>
              </div>
            )}

            {isLocal ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    المحافظة <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.region}
                    onChange={(e) => setForm((f) => ({ ...f, region: e.target.value, city: '' }))}
                    className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary transition-colors"
                  >
                    <option value="">{fr.selectGovernorate}</option>
                    {YEMENI_GOVERNORATES.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    المربع الصناعي / الميداني <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.city}
                    disabled={!form.region}
                    onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                    className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary transition-colors disabled:opacity-60"
                  >
                    <option value="">{form.region ? 'اختر المربع الصناعي' : 'اختر المحافظة أولاً'}</option>
                    {form.region && getYemenZones(form.region).map((z) => <option key={z} value={z}>{z}</option>)}
                  </select>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    {String(fr.countryLabel || '').replace(/\s*\*\s*$/, '')} <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.country}
                    onChange={(e) => setForm((f) => ({ ...f, country: e.target.value, city: '' }))}
                    className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary transition-colors"
                  >
                    {INTERNATIONAL_COUNTRIES_AR.map((c) => <option key={c} value={c}>{c}</option>)}
                    <option value="دول أخرى...">دول أخرى...</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    المدينة / المنطقة الصناعية <span className="text-red-500">*</span>
                  </label>
                  {INTERNATIONAL_HUBS[form.country] ? (
                    <select
                      value={form.city}
                      onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                      className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary transition-colors"
                    >
                      <option value="">اختر المنطقة الصناعية</option>
                      {INTERNATIONAL_HUBS[form.country].map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={form.city}
                      onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                      placeholder="أدخل المدينة والمنطقة الصناعية"
                      className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
                    />
                  )}
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-foreground mb-1">{fr.addressLabel}</label>
              <textarea
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                placeholder={fr.addressPlaceholder}
                rows={2}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors resize-none"
              />
            </div>

            {/* Industrial zone -> auto-routing to the territory field rep */}
            {zoneOptions.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  المربع الصناعي / الميداني
                </label>
                <select
                  value={selectedZoneId}
                  onChange={(e) => setSelectedZoneId(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary transition-colors"
                >
                  <option value="">اختر المربع الصناعي (اختياري)</option>
                  {zoneOptions.map((z) => (
                    <option key={z.zone_id} value={z.zone_id}>
                      {z.province_city} — {z.zone_name}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-muted-foreground mt-1">
                  سيتم ربط حسابك تلقائياً بالمشرف الميداني المسؤول عن هذا المربع.
                </p>
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setStep(1)}
                className="flex-1 h-11 border border-border rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                {fr.backBtn}
              </button>
              <button
                onClick={async () => {
                  if (!form.company_name.trim()) { setError(fr.errorCompanyName); return; }
                  if (isLocal && !form.commercial_registration_number.trim()) { setError(fr.errorCRNumberStep2); return; }
                  if (isLocal && !form.region) { setError('الرجاء اختيار المحافظة'); return; }
                  if (isLocal && !form.city) { setError('الرجاء اختيار المربع الصناعي / الميداني'); return; }
                  if (!isLocal && !form.city.trim()) { setError('الرجاء إدخال المدينة / المنطقة الصناعية'); return; }
                  setError('');
                  setLinkRequestSent(false);
                  const dup = await runDuplicateCheck();
                  if (dup && dup.matched_field === 'commercial_register') return;
                  setStep(3);
                }}
                className="flex-1 h-11 bg-primary text-primary-foreground rounded-xl text-sm font-semibold flex items-center justify-center gap-2 active:opacity-80 transition-opacity"
              >
                {fr.continueBtn} <Icon name={isRTL ? 'ArrowLeftIcon' : 'ArrowRightIcon'} size={16} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Contact & Details */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-bold text-foreground mb-1">{fr.contactDetailsTitle}</h2>
              <p className="text-sm text-muted-foreground">{fr.contactDetailsDesc}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">{fr.contactPersonLabel}</label>
                <input
                  type="text"
                  value={form.contact_person}
                  onChange={(e) => setForm((f) => ({ ...f, contact_person: e.target.value }))}
                  placeholder={fr.contactPersonPlaceholder}
                  className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">{fr.phoneLabel}</label>
                {(() => {
                  const info = getDialInfo(form.country);
                  return (
                    <div className="flex h-10 rounded-lg border border-border bg-background focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/30 transition-colors overflow-hidden">
                      <span className="flex items-center px-2 text-xs font-semibold text-primary bg-primary/5 border-r border-border whitespace-nowrap select-none">
                        {info.dial}
                      </span>
                      <input
                        type="tel"
                        value={localPhone}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/[^\d\s]/g, '');
                          setLocalPhone(digits);
                          setForm((f) => ({ ...f, contact_phone: digits ? `${info.dial} ${digits}` : info.dial }));
                        }}
                        placeholder={info.placeholder}
                        maxLength={info.maxLen + Math.floor(info.maxLen / 3)}
                        className="flex-1 min-w-0 px-2 bg-transparent text-foreground text-sm focus:outline-none"
                      />
                    </div>
                  );
                })()}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1">{fr.emailLabel}</label>
              <input
                type="email"
                value={form.contact_email}
                onChange={(e) => setForm((f) => ({ ...f, contact_email: e.target.value }))}
                placeholder={fr.emailPlaceholder}
                className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
                dir="ltr"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {isRTL
                  ? fr.officialBusinessEmail
                  : 'Official business contact email — separate from your login email'}
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1">{fr.websiteLabel}</label>
              <input
                type="url"
                value={form.website}
                onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
                placeholder={fr.websitePlaceholder}
                className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
                dir="ltr"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">{fr.establishedYearLabel}</label>
                <input
                  type="number"
                  value={form.established_year}
                  onChange={(e) => setForm((f) => ({ ...f, established_year: e.target.value }))}
                  placeholder="2010"
                  min="1900"
                  max={new Date().getFullYear()}
                  className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">{fr.employeeCountLabel}</label>
                <select
                  value={form.employee_count}
                  onChange={(e) => setForm((f) => ({ ...f, employee_count: e.target.value }))}
                  className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary transition-colors"
                >
                  <option value="">{fr.selectOption}</option>
                  {EMPLOYEE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1">{fr.annualCapacityLabel}</label>
              <input
                type="text"
                value={form.annual_capacity}
                onChange={(e) => setForm((f) => ({ ...f, annual_capacity: e.target.value }))}
                placeholder={fr.annualCapacityPlaceholder}
                className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-2">{fr.mainProductsLabel}</label>
              <textarea
                value={form.main_products}
                onChange={(e) => setForm((f) => ({ ...f, main_products: e.target.value }))}
                placeholder={fr.mainProductsPlaceholder}
                rows={2}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors resize-none"
              />
              {sectorProducts.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {sectorProducts.map((sp) => {
                    const label = isRTL ? sp.name_ar : (sp.name_en || sp.name_ar);
                    const current = form.main_products.split(',').map((p) => p.trim()).filter(Boolean);
                    const selected = current.includes(label);
                    return (
                      <button
                        key={sp.id}
                        type="button"
                        onClick={() =>
                          setForm((f) => {
                            const list = f.main_products.split(',').map((p) => p.trim()).filter(Boolean);
                            const next = list.includes(label) ? list.filter((p) => p !== label) : [...list, label];
                            return { ...f, main_products: next.join(', ') };
                          })
                        }
                        className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                          selected
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-background text-muted-foreground border-border hover:border-primary hover:text-foreground'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-2">{fr.certificationsLabel}</label>
              <div className="flex flex-wrap gap-2">
                {CERTIFICATIONS_OPTIONS.map((cert) => (
                  <button
                    key={cert}
                    type="button"
                    onClick={() => toggleCertification(cert)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      form.certifications.includes(cert)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background text-muted-foreground border-border hover:border-primary/50'
                    }`}
                  >
                    {cert}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setStep(2)}
                className="flex-1 h-11 border border-border rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                {fr.backBtn}
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="flex-1 h-11 bg-primary text-primary-foreground rounded-xl text-sm font-semibold flex items-center justify-center gap-2 active:opacity-80 transition-opacity disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Icon name="ArrowPathIcon" size={16} className="animate-spin" />
                    {fr.submittingBtn}
                  </>
                ) : (
                  <>
                    <Icon name="CheckIcon" size={16} />
                    {fr.submitBtn}
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
}

export default function FactoryRegisterPage() {
  return (
    <Suspense fallback={null}>
      <FactoryRegisterPageInner />
    </Suspense>
  );
}
