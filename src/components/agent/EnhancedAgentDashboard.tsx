'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FactoryRegistration {
  id: string;
  company_name: string;
  factory_type: 'local_factory' | 'international_factory';
  country: string;
  city: string;
  region?: string;
  contact_person: string;
  contact_phone: string;
  contact_email?: string;
  industry?: string;
  employee_count?: string;
  annual_capacity?: string;
  registration_status: string;
  contact_status: string;
  created_at: string;
  trade_license_url?: string;
}

interface CommissionEntry {
  id: string;
  order_id: string;
  commission_amount: number;
  currency: string;
  status: 'pending' | 'paid';
  created_at: string;
  factory_name: string;
}

interface Props {
  userId: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const YEMENI_GOVERNORATES = [
  'صنعاء', 'عدن', 'تعز', 'الحديدة', 'إب', 'حضرموت', 'مأرب', 'شبوة',
  'أبين', 'لحج', 'الضالع', 'ذمار', 'حجة', 'عمران', 'صعدة', 'البيضاء',
  'الجوف', 'المحويت', 'المهرة', 'ريمة', 'سقطرى', 'أمانة العاصمة',
];

const INTERNATIONAL_COUNTRIES = [
  'المملكة العربية السعودية', 'الإمارات العربية المتحدة', 'الكويت', 'قطر', 'البحرين', 'عُمان',
  'مصر', 'الأردن', 'العراق', 'سوريا', 'لبنان', 'ليبيا', 'تونس', 'الجزائر', 'المغرب',
  'الصين', 'تركيا', 'الهند', 'باكستان', 'بنغلاديش', 'إندونيسيا', 'ماليزيا',
  'فيتنام', 'تايلاند', 'سنغافورة', 'اليابان', 'كوريا الجنوبية',
  'ألمانيا', 'فرنسا', 'المملكة المتحدة', 'إيطاليا', 'إسبانيا', 'روسيا',
  'هولندا', 'بلجيكا', 'السويد', 'سويسرا', 'النمسا', 'بولندا',
  'الولايات المتحدة الأمريكية', 'كندا', 'البرازيل', 'الأرجنتين',
  'نيجيريا', 'جنوب أفريقيا', 'كينيا', 'أستراليا', 'نيوزيلندا',
];

const INDUSTRIES = [
  'الغذاء والمشروبات', 'النسيج والملابس', 'الأثاث والديكور', 'الإلكترونيات',
  'المعادن والصلب', 'البلاستيك والمطاط', 'الكيماويات', 'مواد البناء',
  'الآلات والمعدات', 'السيارات وقطع الغيار', 'الأدوية والمستلزمات الطبية',
  'الزراعة والمنتجات الزراعية', 'الطاقة والبترول', 'التعبئة والتغليف', 'أخرى',
];

const EMPLOYEE_RANGES = ['1-10', '11-50', '51-200', '201-500', '500+'];

const KYC_STATUS_META: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  pending: { label: 'قيد الانتظار', color: '#92400e', bg: '#fef3c7', icon: 'ClockIcon' },
  under_review: { label: 'تحت المراجعة', color: '#1e40af', bg: '#dbeafe', icon: 'MagnifyingGlassIcon' },
  approved: { label: 'معتمد ✓', color: '#065f46', bg: '#d1fae5', icon: 'CheckBadgeIcon' },
  rejected: { label: 'مرفوض', color: '#991b1b', bg: '#fee2e2', icon: 'XCircleIcon' },
  documents_submitted: { label: 'وثائق مقدمة', color: '#5b21b6', bg: '#ede9fe', icon: 'DocumentCheckIcon' },
};

const COMMISSION_STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'معلق', color: '#92400e', bg: '#fef3c7' },
  approved: { label: 'معتمد', color: '#1e40af', bg: '#dbeafe' },
  paid: { label: 'مدفوع ✓', color: '#065f46', bg: '#d1fae5' },
};

const EMPTY_LOCAL_FORM = {
  company_name: '',
  city: '',
  region: '',
  contact_person: '',
  contact_phone: '',
  contact_email: '',
  industry: '',
  employee_count: '',
  annual_capacity: '',
  agent_notes: '',
};

const EMPTY_INTL_FORM = {
  company_name: '',
  country: '',
  city: '',
  contact_person: '',
  contact_phone: '',
  contact_email: '',
  website: '',
  industry: '',
  employee_count: '',
  annual_capacity: '',
  agent_notes: '',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ icon, title, subtitle }: { icon: string; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(212,175,55,0.15)' }}>
        <Icon name={icon as any} size={20} style={{ color: '#D4AF37' }} />
      </div>
      <div>
        <h2 className="font-bold text-base" style={{ color: '#D4AF37' }}>{title}</h2>
        {subtitle && <p className="text-xs mt-0.5" style={{ color: '#8899aa' }}>{subtitle}</p>}
      </div>
    </div>
  );
}

function FormField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold mb-1.5" style={{ color: '#ccc' }}>
        {label} {required && <span style={{ color: '#D4AF37' }}>*</span>}
      </label>
      {children}
    </div>
  );
}

const inputClass =
  'w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none transition-colors';
const inputStyle = { background: '#2a2a2a', border: '1px solid #3a3a3a', color: '#fff' };

// ─── Local Factory Registration Form ─────────────────────────────────────────

function LocalFactoryForm({ userId, onSuccess }: { userId: string; onSuccess: () => void }) {
  const [form, setForm] = useState({ ...EMPTY_LOCAL_FORM });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const supabase = createClient();

  const set = (key: string, val: string) => setForm(prev => ({ ...prev, [key]: val }));

  const handleSubmit = async () => {
    if (!form.company_name.trim()) { setError('يرجى إدخال اسم المصنع'); return; }
    if (!form.city.trim()) { setError('يرجى اختيار المحافظة'); return; }
    if (!form.contact_person.trim()) { setError('يرجى إدخال اسم المسؤول'); return; }
    if (!form.contact_phone.trim()) { setError('يرجى إدخال رقم الهاتف'); return; }

    setSaving(true);
    setError('');
    try {
      const { error: dbErr } = await supabase.from('agent_factory_registrations').insert({
        agent_id: userId,
        company_name: form.company_name.trim(),
        factory_type: 'local_factory',
        country: 'اليمن',
        city: form.city,
        region: form.region || null,
        contact_person: form.contact_person.trim(),
        contact_phone: form.contact_phone.trim(),
        contact_email: form.contact_email.trim() || null,
        industry: form.industry || null,
        employee_count: form.employee_count || null,
        annual_capacity: form.annual_capacity.trim() || null,
        agent_notes: form.agent_notes.trim() || null,
        contact_status: 'contacting',
        registration_status: 'pending',
      });
      if (dbErr) throw dbErr;
      setSuccess(true);
      setForm({ ...EMPTY_LOCAL_FORM });
      setTimeout(() => { setSuccess(false); onSuccess(); }, 1500);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'حدث خطأ أثناء الحفظ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {success && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold" style={{ background: '#d1fae5', color: '#065f46' }}>
          <Icon name="CheckCircleIcon" size={16} />
          تم تسجيل المصنع المحلي بنجاح!
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm" style={{ background: '#fee2e2', color: '#991b1b' }}>
          <Icon name="ExclamationCircleIcon" size={16} />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label="اسم المصنع / الشركة" required>
          <input value={form.company_name} onChange={e => set('company_name', e.target.value)}
            placeholder="مثال: مصنع الأمل للنسيج" className={inputClass} style={inputStyle} />
        </FormField>

        <FormField label="المحافظة" required>
          <select value={form.city} onChange={e => set('city', e.target.value)} className={inputClass} style={inputStyle}>
            <option value="">اختر المحافظة</option>
            {YEMENI_GOVERNORATES.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </FormField>

        <FormField label="المنطقة / الحي">
          <input value={form.region} onChange={e => set('region', e.target.value)}
            placeholder="مثال: المنطقة الصناعية" className={inputClass} style={inputStyle} />
        </FormField>

        <FormField label="القطاع الصناعي">
          <select value={form.industry} onChange={e => set('industry', e.target.value)} className={inputClass} style={inputStyle}>
            <option value="">اختر القطاع</option>
            {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
          </select>
        </FormField>

        <FormField label="اسم المسؤول / المدير" required>
          <input value={form.contact_person} onChange={e => set('contact_person', e.target.value)}
            placeholder="الاسم الكامل" className={inputClass} style={inputStyle} />
        </FormField>

        <FormField label="رقم الهاتف" required>
          <input value={form.contact_phone} onChange={e => set('contact_phone', e.target.value)}
            placeholder="مثال: 771234567" className={inputClass} style={inputStyle} dir="ltr" />
        </FormField>

        <FormField label="البريد الإلكتروني">
          <input value={form.contact_email} onChange={e => set('contact_email', e.target.value)}
            placeholder="example@factory.com" className={inputClass} style={inputStyle} dir="ltr" />
        </FormField>

        <FormField label="عدد الموظفين">
          <select value={form.employee_count} onChange={e => set('employee_count', e.target.value)} className={inputClass} style={inputStyle}>
            <option value="">اختر النطاق</option>
            {EMPLOYEE_RANGES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </FormField>

        <div className="md:col-span-2">
          <FormField label="الطاقة الإنتاجية السنوية">
            <input value={form.annual_capacity} onChange={e => set('annual_capacity', e.target.value)}
              placeholder="مثال: 50,000 وحدة / سنة" className={inputClass} style={inputStyle} />
          </FormField>
        </div>

        <div className="md:col-span-2">
          <FormField label="ملاحظات المندوب">
            <textarea value={form.agent_notes} onChange={e => set('agent_notes', e.target.value)}
              rows={3} placeholder="أي ملاحظات إضافية حول المصنع..."
              className={inputClass + ' resize-none'} style={inputStyle} />
          </FormField>
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={saving}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-opacity disabled:opacity-50"
        style={{ background: '#D4AF37', color: '#1E1E1E' }}
      >
        {saving ? (
          <><div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />جاري الحفظ...</>
        ) : (
          <><Icon name="PlusCircleIcon" size={16} />تسجيل المصنع المحلي</>
        )}
      </button>
    </div>
  );
}

// ─── International Factory Registration Form ──────────────────────────────────

function InternationalFactoryForm({ userId, onSuccess }: { userId: string; onSuccess: () => void }) {
  const [form, setForm] = useState({ ...EMPTY_INTL_FORM });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const supabase = createClient();

  const set = (key: string, val: string) => setForm(prev => ({ ...prev, [key]: val }));

  const handleSubmit = async () => {
    if (!form.company_name.trim()) { setError('يرجى إدخال اسم المصنع'); return; }
    if (!form.country.trim()) { setError('يرجى اختيار الدولة'); return; }
    if (!form.contact_person.trim()) { setError('يرجى إدخال اسم المسؤول'); return; }
    if (!form.contact_phone.trim()) { setError('يرجى إدخال رقم الهاتف'); return; }

    setSaving(true);
    setError('');
    try {
      const { error: dbErr } = await supabase.from('agent_factory_registrations').insert({
        agent_id: userId,
        company_name: form.company_name.trim(),
        factory_type: 'international_factory',
        country: form.country,
        city: form.city.trim() || form.country,
        contact_person: form.contact_person.trim(),
        contact_phone: form.contact_phone.trim(),
        contact_email: form.contact_email.trim() || null,
        website: form.website.trim() || null,
        industry: form.industry || null,
        employee_count: form.employee_count || null,
        annual_capacity: form.annual_capacity.trim() || null,
        agent_notes: form.agent_notes.trim() || null,
        contact_status: 'contacting',
        registration_status: 'pending',
      });
      if (dbErr) throw dbErr;
      setSuccess(true);
      setForm({ ...EMPTY_INTL_FORM });
      setTimeout(() => { setSuccess(false); onSuccess(); }, 1500);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'حدث خطأ أثناء الحفظ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {success && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold" style={{ background: '#d1fae5', color: '#065f46' }}>
          <Icon name="CheckCircleIcon" size={16} />
          تم تسجيل المصنع الدولي بنجاح!
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm" style={{ background: '#fee2e2', color: '#991b1b' }}>
          <Icon name="ExclamationCircleIcon" size={16} />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label="اسم المصنع / الشركة" required>
          <input value={form.company_name} onChange={e => set('company_name', e.target.value)}
            placeholder="Company / Factory Name" className={inputClass} style={inputStyle} />
        </FormField>

        <FormField label="الدولة" required>
          <select value={form.country} onChange={e => set('country', e.target.value)} className={inputClass} style={inputStyle}>
            <option value="">اختر الدولة</option>
            {INTERNATIONAL_COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </FormField>

        <FormField label="المدينة">
          <input value={form.city} onChange={e => set('city', e.target.value)}
            placeholder="City" className={inputClass} style={inputStyle} />
        </FormField>

        <FormField label="القطاع الصناعي">
          <select value={form.industry} onChange={e => set('industry', e.target.value)} className={inputClass} style={inputStyle}>
            <option value="">اختر القطاع</option>
            {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
          </select>
        </FormField>

        <FormField label="اسم المسؤول / المدير" required>
          <input value={form.contact_person} onChange={e => set('contact_person', e.target.value)}
            placeholder="Contact Person Name" className={inputClass} style={inputStyle} />
        </FormField>

        <FormField label="رقم الهاتف / واتساب" required>
          <input value={form.contact_phone} onChange={e => set('contact_phone', e.target.value)}
            placeholder="+86 138 0000 0000" className={inputClass} style={inputStyle} dir="ltr" />
        </FormField>

        <FormField label="البريد الإلكتروني">
          <input value={form.contact_email} onChange={e => set('contact_email', e.target.value)}
            placeholder="contact@factory.com" className={inputClass} style={inputStyle} dir="ltr" />
        </FormField>

        <FormField label="الموقع الإلكتروني">
          <input value={form.website} onChange={e => set('website', e.target.value)}
            placeholder="https://www.factory.com" className={inputClass} style={inputStyle} dir="ltr" />
        </FormField>

        <FormField label="عدد الموظفين">
          <select value={form.employee_count} onChange={e => set('employee_count', e.target.value)} className={inputClass} style={inputStyle}>
            <option value="">اختر النطاق</option>
            {EMPLOYEE_RANGES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </FormField>

        <FormField label="الطاقة الإنتاجية السنوية">
          <input value={form.annual_capacity} onChange={e => set('annual_capacity', e.target.value)}
            placeholder="e.g. 1,000,000 units/year" className={inputClass} style={inputStyle} />
        </FormField>

        <div className="md:col-span-2">
          <FormField label="ملاحظات المندوب">
            <textarea value={form.agent_notes} onChange={e => set('agent_notes', e.target.value)}
              rows={3} placeholder="أي ملاحظات إضافية حول المصنع الدولي..."
              className={inputClass + ' resize-none'} style={inputStyle} />
          </FormField>
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={saving}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-opacity disabled:opacity-50"
        style={{ background: 'linear-gradient(135deg, #1e40af, #3b82f6)', color: '#fff' }}
      >
        {saving ? (
          <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />جاري الحفظ...</>
        ) : (
          <><Icon name="GlobeAltIcon" size={16} />تسجيل المصنع الدولي</>
        )}
      </button>
    </div>
  );
}

// ─── KYC Status Table ─────────────────────────────────────────────────────────

function KYCStatusTable({ factories }: { factories: FactoryRegistration[] }) {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'local_factory' | 'international_factory'>('all');
  const [filterStatus, setFilterStatus] = useState('');

  const filtered = factories.filter(f => {
    const matchSearch = !search || f.company_name.toLowerCase().includes(search.toLowerCase()) ||
      f.contact_person.toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === 'all' || f.factory_type === filterType;
    const matchStatus = !filterStatus || f.registration_status === filterStatus;
    return matchSearch && matchType && matchStatus;
  });

  const stats = {
    total: factories.length,
    local: factories.filter(f => f.factory_type === 'local_factory').length,
    intl: factories.filter(f => f.factory_type === 'international_factory').length,
    approved: factories.filter(f => f.registration_status === 'approved').length,
    pending: factories.filter(f => f.registration_status === 'pending').length,
  };

  return (
    <div className="space-y-4">
      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'الإجمالي', value: stats.total, color: '#D4AF37' },
          { label: 'محلية', value: stats.local, color: '#10b981' },
          { label: 'دولية', value: stats.intl, color: '#3b82f6' },
          { label: 'معتمدة', value: stats.approved, color: '#065f46' },
          { label: 'قيد الانتظار', value: stats.pending, color: '#92400e' },
        ].map(s => (
          <div key={s.label} className="rounded-xl p-3 text-center" style={{ background: '#2a2a2a', border: '1px solid #3a3a3a' }}>
            <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs mt-0.5" style={{ color: '#8899aa' }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Icon name="MagnifyingGlassIcon" size={14} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: '#8899aa' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="بحث باسم المصنع أو المسؤول..."
            className="w-full pr-9 pl-3 py-2 rounded-xl text-sm focus:outline-none"
            style={{ background: '#2a2a2a', border: '1px solid #3a3a3a', color: '#fff' }}
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {[
            { val: 'all' as const, label: 'الكل' },
            { val: 'local_factory' as const, label: 'محلية' },
            { val: 'international_factory' as const, label: 'دولية' },
          ].map(b => (
            <button key={b.val} onClick={() => setFilterType(b.val)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all"
              style={{
                background: filterType === b.val ? '#D4AF37' : '#2a2a2a',
                borderColor: filterType === b.val ? '#D4AF37' : '#3a3a3a',
                color: filterType === b.val ? '#1E1E1E' : '#8899aa',
              }}>
              {b.label}
            </button>
          ))}
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold border focus:outline-none"
            style={{ background: '#2a2a2a', borderColor: '#3a3a3a', color: '#8899aa' }}>
            <option value="">كل الحالات</option>
            <option value="pending">قيد الانتظار</option>
            <option value="under_review">تحت المراجعة</option>
            <option value="documents_submitted">وثائق مقدمة</option>
            <option value="approved">معتمد</option>
            <option value="rejected">مرفوض</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 rounded-xl" style={{ background: '#2a2a2a', border: '1px solid #3a3a3a' }}>
          <Icon name="BuildingOffice2Icon" size={32} style={{ color: '#3a3a3a' }} className="mx-auto mb-3" />
          <p className="text-sm" style={{ color: '#8899aa' }}>لا توجد مصانع مطابقة للبحث</p>
        </div>
      ) : (
        <div className="overflow-x-auto -mx-6 px-6 sm:mx-0 sm:px-0 rounded-xl" style={{ border: '1px solid #3a3a3a' }}>
          <table className="w-full text-sm min-w-[500px]">
            <thead>
              <tr style={{ background: '#2a2a2a', borderBottom: '1px solid #3a3a3a' }}>
                {['المصنع', 'النوع', 'الدولة / المحافظة', 'المسؤول', 'حالة KYC', 'حالة التواصل', 'تاريخ التسجيل', 'الوثائق'].map(h => (
                  <th key={h} className="px-4 py-3 text-right text-xs font-bold" style={{ color: '#D4AF37' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((f, idx) => {
                const kycMeta = KYC_STATUS_META[f.registration_status] || KYC_STATUS_META.pending;
                const contactMeta = KYC_STATUS_META[f.contact_status] || KYC_STATUS_META.pending;
                return (
                  <tr key={f.id} style={{ background: idx % 2 === 0 ? '#1E1E1E' : '#222', borderBottom: '1px solid #2a2a2a' }}>
                    <td className="px-4 py-3">
                      <p className="font-semibold" style={{ color: '#fff' }}>{f.company_name}</p>
                      {f.industry && <p className="text-xs mt-0.5" style={{ color: '#8899aa' }}>{f.industry}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 rounded-lg text-xs font-semibold" style={{
                        background: f.factory_type === 'local_factory' ? 'rgba(16,185,129,0.15)' : 'rgba(59,130,246,0.15)',
                        color: f.factory_type === 'local_factory' ? '#10b981' : '#60a5fa',
                      }}>
                        {f.factory_type === 'local_factory' ? '🏭 محلي' : '🌐 دولي'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: '#ccc' }}>{f.city}, {f.country}</td>
                    <td className="px-4 py-3">
                      <p className="text-xs" style={{ color: '#ccc' }}>{f.contact_person}</p>
                      <p className="text-xs" style={{ color: '#8899aa' }} dir="ltr">{f.contact_phone}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-semibold w-fit" style={{ background: kycMeta.bg, color: kycMeta.color }}>
                        <Icon name={kycMeta.icon as any} size={12} />
                        {kycMeta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 rounded-lg text-xs font-semibold" style={{ background: contactMeta.bg, color: contactMeta.color }}>
                        {contactMeta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: '#8899aa' }}>
                      {new Date(f.created_at).toLocaleDateString('ar')}
                    </td>
                    <td className="px-4 py-3">
                      {f.trade_license_url ? (
                        <a href={f.trade_license_url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs font-semibold" style={{ color: '#D4AF37' }}>
                          <Icon name="DocumentCheckIcon" size={13} />
                          عرض
                        </a>
                      ) : (
                        <span className="text-xs" style={{ color: '#555' }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Commissions Panel ────────────────────────────────────────────────────────

function CommissionsPanel({ userId }: { userId: string }) {
  const [entries, setEntries] = useState<CommissionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const supabase = createClient();

  const fetchCommissions = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('platform_commissions')
        .select('id, order_id, commission_amount, currency, status, created_at, factory_name')
        .eq('agent_id', userId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setEntries(data as CommissionEntry[]);
      } else {
        setEntries([]);
      }
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [userId, supabase]);

  useEffect(() => { fetchCommissions(); }, [fetchCommissions]);

  const filtered = filterStatus ? entries.filter(e => e.status === filterStatus) : entries;

  const totals = entries.reduce(
    (acc, e) => ({
      yer: acc.yer + (e.currency === 'YER' ? (e.commission_amount || 0) : 0),
      usd: acc.usd + (e.currency === 'USD' ? (e.commission_amount || 0) : 0),
      paid_yer: acc.paid_yer + (e.status === 'paid' && e.currency === 'YER' ? (e.commission_amount || 0) : 0),
      paid_usd: acc.paid_usd + (e.status === 'paid' && e.currency === 'USD' ? (e.commission_amount || 0) : 0),
      pending_yer: acc.pending_yer + (e.status === 'pending' && e.currency === 'YER' ? (e.commission_amount || 0) : 0),
      pending_usd: acc.pending_usd + (e.status === 'pending' && e.currency === 'USD' ? (e.commission_amount || 0) : 0),
    }),
    { yer: 0, usd: 0, paid_yer: 0, paid_usd: 0, pending_yer: 0, pending_usd: 0 }
  );

  const fmtYER = (v: number) => v.toLocaleString('ar-YE') + ' ﷼';
  const fmtUSD = (v: number) => '$' + v.toFixed(2);

  return (
    <div className="space-y-5">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            label: 'إجمالي العمولات',
            yer: totals.yer,
            usd: totals.usd,
            icon: 'BanknotesIcon',
            color: '#D4AF37',
            bg: 'rgba(212,175,55,0.1)',
          },
          {
            label: 'عمولات مدفوعة',
            yer: totals.paid_yer,
            usd: totals.paid_usd,
            icon: 'CheckCircleIcon',
            color: '#10b981',
            bg: 'rgba(16,185,129,0.1)',
          },
          {
            label: 'عمولات معلقة',
            yer: totals.pending_yer,
            usd: totals.pending_usd,
            icon: 'ClockIcon',
            color: '#f59e0b',
            bg: 'rgba(245,158,11,0.1)',
          },
        ].map(card => (
          <div key={card.label} className="rounded-xl p-4" style={{ background: card.bg, border: `1px solid ${card.color}33` }}>
            <div className="flex items-center gap-2 mb-3">
              <Icon name={card.icon as any} size={18} style={{ color: card.color }} />
              <p className="text-sm font-semibold" style={{ color: card.color }}>{card.label}</p>
            </div>
            <p className="text-xl font-bold" style={{ color: '#fff' }}>{fmtYER(card.yer)}</p>
            <p className="text-sm mt-1" style={{ color: '#8899aa' }}>{fmtUSD(card.usd)}</p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {[
          { val: '', label: 'الكل' },
          { val: 'pending', label: 'معلق' },
          { val: 'approved', label: 'معتمد' },
          { val: 'paid', label: 'مدفوع' },
        ].map(b => (
          <button key={b.val} onClick={() => setFilterStatus(b.val)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all"
            style={{
              background: filterStatus === b.val ? '#D4AF37' : '#2a2a2a',
              borderColor: filterStatus === b.val ? '#D4AF37' : '#3a3a3a',
              color: filterStatus === b.val ? '#1E1E1E' : '#8899aa',
            }}>
            {b.label}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#D4AF37', borderTopColor: 'transparent' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-14 rounded-xl" style={{ background: '#2a2a2a', border: '1px solid #3a3a3a' }}>
          <Icon name="BanknotesIcon" size={36} style={{ color: '#3a3a3a' }} className="mx-auto mb-3" />
          <p className="font-semibold" style={{ color: '#8899aa' }}>لا توجد عمولات مسجلة بعد</p>
          <p className="text-xs mt-1" style={{ color: '#555' }}>ستظهر عمولاتك هنا بعد إتمام أول صفقة</p>
        </div>
      ) : (
        <div className="overflow-x-auto -mx-6 px-6 sm:mx-0 sm:px-0 rounded-xl" style={{ border: '1px solid #3a3a3a' }}>
          <table className="w-full text-sm min-w-[500px]">
            <thead>
              <tr style={{ background: '#2a2a2a', borderBottom: '1px solid #3a3a3a' }}>
                {['المصنع', 'رقم الطلب', 'قيمة الطلب (YER)', 'قيمة الطلب (USD)', 'نسبة العمولة', 'العمولة (YER)', 'العمولة (USD)', 'الحالة', 'التاريخ'].map(h => (
                  <th key={h} className="px-4 py-3 text-right text-xs font-bold" style={{ color: '#D4AF37' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((e, idx) => {
                const meta = COMMISSION_STATUS_META[e.status] || COMMISSION_STATUS_META.pending;
                return (
                  <tr key={e.id} style={{ background: idx % 2 === 0 ? '#1E1E1E' : '#222', borderBottom: '1px solid #2a2a2a' }}>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-xs" style={{ color: '#fff' }}>{e.factory_name || '—'}</p>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono" style={{ color: '#ccc' }} dir="ltr">{e.order_id?.slice(0, 8).toUpperCase() || '—'}</td>
                    <td className="px-4 py-3 text-xs font-bold" style={{ color: '#10b981' }}>{fmtYER(e.currency === 'YER' ? e.commission_amount : 0)}</td>
                    <td className="px-4 py-3 text-xs font-bold" style={{ color: '#60a5fa' }}>{fmtUSD(e.currency === 'USD' ? e.commission_amount : 0)}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 rounded-lg text-xs font-semibold" style={{ background: meta.bg, color: meta.color }}>
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: '#8899aa' }}>
                      {new Date(e.created_at).toLocaleDateString('ar')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

type MainTab = 'register' | 'kyc' | 'commissions';
type RegSubTab = 'local' | 'international';

export default function EnhancedAgentDashboard({ userId }: Props) {
  const [mainTab, setMainTab] = useState<MainTab>('register');
  const [regSubTab, setRegSubTab] = useState<RegSubTab>('local');
  const [factories, setFactories] = useState<FactoryRegistration[]>([]);
  const [loadingFactories, setLoadingFactories] = useState(true);
  const supabase = createClient();

  const fetchFactories = useCallback(async () => {
    setLoadingFactories(true);
    try {
      const { data } = await supabase
        .from('agent_factory_registrations')
        .select('id, company_name, factory_type, country, city, region, contact_person, contact_phone, contact_email, industry, employee_count, annual_capacity, registration_status, contact_status, created_at, trade_license_url')
        .eq('agent_id', userId)
        .order('created_at', { ascending: false });
      setFactories((data as FactoryRegistration[]) || []);
    } catch {
      setFactories([]);
    } finally {
      setLoadingFactories(false);
    }
  }, [userId, supabase]);

  useEffect(() => { fetchFactories(); }, [fetchFactories]);

  const MAIN_TABS: { key: MainTab; icon: string; label: string; badge?: number }[] = [
    { key: 'register', icon: 'PlusCircleIcon', label: 'تسجيل مصنع جديد' },
    { key: 'kyc', icon: 'ClipboardDocumentCheckIcon', label: 'متابعة حالة KYC', badge: factories.filter(f => f.registration_status === 'pending').length },
    { key: 'commissions', icon: 'CurrencyDollarIcon', label: 'العمولات والأرباح' },
  ];

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: '#1E1E1E', border: '1px solid #D4AF37' }} dir="rtl">
      {/* Header */}
      <div className="px-5 py-4 flex items-center gap-3" style={{ background: 'rgba(212,175,55,0.08)', borderBottom: '1px solid #D4AF37' }}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(212,175,55,0.2)' }}>
          <Icon name="BriefcaseIcon" size={22} style={{ color: '#D4AF37' }} />
        </div>
        <div>
          <h1 className="font-bold text-base" style={{ color: '#D4AF37' }}>غرفة تحكم المندوب الميداني</h1>
          <p className="text-xs mt-0.5" style={{ color: '#8899aa' }}>تسجيل المصانع · متابعة KYC · تتبع العمولات</p>
        </div>
        <div className="mr-auto flex items-center gap-2">
          <span className="px-3 py-1 rounded-full text-xs font-bold" style={{ background: 'rgba(212,175,55,0.15)', color: '#D4AF37', border: '1px solid #D4AF37' }}>
            {factories.length} مصنع مسجل
          </span>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="flex gap-1 p-3" style={{ background: '#161616', borderBottom: '1px solid #2a2a2a' }}>
        {MAIN_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setMainTab(tab.key)}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all relative"
            style={{
              background: mainTab === tab.key ? '#D4AF37' : 'transparent',
              color: mainTab === tab.key ? '#1E1E1E' : '#8899aa',
              border: mainTab === tab.key ? 'none' : '1px solid #2a2a2a',
            }}
          >
            <Icon name={tab.icon as any} size={15} />
            <span className="hidden sm:inline">{tab.label}</span>
            {tab.badge !== undefined && tab.badge > 0 && (
              <span className="absolute -top-1 -left-1 min-w-[18px] h-[18px] rounded-full text-[10px] font-bold flex items-center justify-center px-1"
                style={{ background: '#ef4444', color: '#fff' }}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-5">
        {/* ── Registration Tab ── */}
        {mainTab === 'register' && (
          <div>
            <SectionHeader
              icon="PlusCircleIcon"
              title="نموذج التسجيل المزدوج"
              subtitle="سجّل المصانع المحلية اليمنية أو المصانع الدولية"
            />

            {/* Sub-tabs */}
            <div className="flex gap-1 p-1 rounded-xl mb-5" style={{ background: '#161616' }}>
              <button
                onClick={() => setRegSubTab('local')}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all"
                style={{
                  background: regSubTab === 'local' ? 'rgba(16,185,129,0.2)' : 'transparent',
                  color: regSubTab === 'local' ? '#10b981' : '#8899aa',
                  border: regSubTab === 'local' ? '1px solid #10b981' : '1px solid transparent',
                }}
              >
                <Icon name="HomeModernIcon" size={16} />
                🏭 مصنع محلي (اليمن)
              </button>
              <button
                onClick={() => setRegSubTab('international')}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all"
                style={{
                  background: regSubTab === 'international' ? 'rgba(59,130,246,0.2)' : 'transparent',
                  color: regSubTab === 'international' ? '#60a5fa' : '#8899aa',
                  border: regSubTab === 'international' ? '1px solid #3b82f6' : '1px solid transparent',
                }}
              >
                <Icon name="GlobeAltIcon" size={16} />
                🌐 مصنع دولي
              </button>
            </div>

            {regSubTab === 'local' ? (
              <LocalFactoryForm userId={userId} onSuccess={fetchFactories} />
            ) : (
              <InternationalFactoryForm userId={userId} onSuccess={fetchFactories} />
            )}
          </div>
        )}

        {/* ── KYC Tab ── */}
        {mainTab === 'kyc' && (
          <div>
            <SectionHeader
              icon="ClipboardDocumentCheckIcon"
              title="جدول متابعة حالة الاعتماد KYC"
              subtitle="تتبع حالة التحقق والاعتماد لجميع المصانع المسجلة"
            />
            {loadingFactories ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#D4AF37', borderTopColor: 'transparent' }} />
              </div>
            ) : (
              <KYCStatusTable factories={factories} />
            )}
          </div>
        )}

        {/* ── Commissions Tab ── */}
        {mainTab === 'commissions' && (
          <div>
            <SectionHeader
              icon="CurrencyDollarIcon"
              title="لوحة تتبع العمولات والأرباح"
              subtitle="عمولاتك بالريال اليمني (YER) والدولار الأمريكي (USD)"
            />
            <CommissionsPanel userId={userId} />
          </div>
        )}
      </div>
    </div>
  );
}
