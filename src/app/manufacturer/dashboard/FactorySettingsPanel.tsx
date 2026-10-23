'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';

interface FactorySettingsPanelProps {
  userId?: string | null;
}

const YEMEN_GOVERNORATES = [
  'صنعاء',
  'عدن',
  'الحديدة',
  'تعز',
  'حضرموت',
  'إب',
  'ذمار',
  'لحج',
  'أبين',
  'شبوة',
  'مأرب',
  'الجوف',
  'عمران',
  'حجة',
  'صعدة',
  'المحويت',
  'ريمة',
  'البيضاء',
  'الضالع',
  'المهرة',
  'سقطرى',
  'أمانة العاصمة',
];

interface RegistrationInfo {
  trade_license_url?: string | null;
  manufacturing_license_url?: string | null;
  tax_id?: string | null;
}

const YEMEN_PHONE_REGEX = /^(?:\+?967|00967)?0?7[0137]\d{7}$/;

function normalizePhone(value: string): string {
  return (value ?? '').replace(/[\s-]/g, '');
}

export default function FactorySettingsPanel({ userId }: FactorySettingsPanelProps) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [taxId, setTaxId] = useState('');
  const [registration, setRegistration] = useState<RegistrationInfo | null>(null);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setLoadError('');
      try {
        const supabase = createClient();
        const [profileRes, regRes] = await Promise.all([
          supabase
            .from('user_profiles')
            .select('company_name, full_name, description, city, phone')
            .eq('id', userId)
            .maybeSingle(),
          supabase
            .from('factory_registrations')
            .select('trade_license_url, manufacturing_license_url, tax_id')
            .eq('user_id', userId)
            .maybeSingle(),
        ]);
        if (cancelled) return;

        let profile: Record<string, any> | null = (profileRes?.data as Record<string, any>) ?? null;
        if (profileRes?.error && !profile) {
          const fallback = await supabase
            .from('user_profiles')
            .select('company_name, full_name, phone')
            .eq('id', userId)
            .maybeSingle();
          profile = (fallback?.data as Record<string, any>) ?? null;
        }
        if (cancelled) return;

        setName(profile?.company_name || profile?.full_name || '');
        setDescription(profile?.description || '');
        setCity(profile?.city || '');
        setPhone(profile?.phone || '');

        const reg = (regRes?.data as RegistrationInfo) ?? null;
        setRegistration(reg);
        setTaxId(reg?.tax_id || '');
      } catch (err) {
        if (!cancelled) setLoadError('تعذر تحميل بيانات المصنع. حاول مرة أخرى.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const hasCommercial = !!registration?.trade_license_url;
  const hasIndustrial = !!registration?.manufacturing_license_url;
  const trustPct = (hasCommercial ? 50 : 0) + (hasIndustrial ? 50 : 0);
  const isVerified = trustPct === 100;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError('');
    setSaveSuccess('');
    if (!userId) {
      setSaveError('يرجى تسجيل الدخول أولاً.');
      return;
    }
    if (!name.trim()) {
      setSaveError('اسم المصنع (بالعربية) مطلوب.');
      return;
    }
    const cleanPhone = normalizePhone(phone);
    if (cleanPhone && !YEMEN_PHONE_REGEX.test(cleanPhone)) {
      setSaveError('رقم الهاتف غير صحيح. مثال: 771234567 أو +967771234567');
      return;
    }
    setSaving(true);
    try {
      const supabase = createClient();
      const payload: Record<string, unknown> = {
        company_name: name.trim(),
        description: description.trim() || null,
        city: city || null,
        phone: cleanPhone || null,
      };
      let current: Record<string, unknown> = { ...payload };
      let lastError: { message: string } | null = null;
      for (let i = 0; i < 5; i++) {
        const { error } = await supabase.from('user_profiles').update(current).eq('id', userId);
        lastError = error;
        if (!error) break;
        const missing = error.message?.match(/column (?:user_profiles\.)?"?(\w+)"? (?:of relation "user_profiles" )?does not exist/i)?.[1]
          ?? error.message?.match(/Could not find the '(\w+)' column/i)?.[1];
        if (!missing || !(missing in current)) break;
        const next = { ...current };
        delete next[missing];
        current = next;
      }
      if (lastError) throw lastError;

      if (registration) {
        await supabase
          .from('factory_registrations')
          .update({ tax_id: taxId.trim() })
          .eq('user_id', userId);
      }
      setSaveSuccess('تم حفظ التغييرات بنجاح.');
    } catch (err: any) {
      setSaveError(err?.message ? `تعذر حفظ التغييرات: ${err.message}` : 'تعذر حفظ التغييرات.');
    } finally {
      setSaving(false);
    }
  };

  if (!userId) {
    return (
      <div className="bg-card border border-border rounded-2xl p-6 text-center text-sm text-muted-foreground" dir="rtl">
        يرجى تسجيل الدخول لعرض إعدادات المصنع.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-5" dir="rtl">
        <div className="h-40 bg-muted/40 rounded-2xl animate-pulse" />
        <div className="h-96 bg-muted/40 rounded-2xl animate-pulse" />
      </div>
    );
  }

  const docRows = [
    { key: 'cr', label: 'السجل التجاري', done: hasCommercial },
    { key: 'il', label: 'الترخيص الصناعي', done: hasIndustrial },
  ];

  return (
    <div className="flex flex-col gap-5" dir="rtl">
      {loadError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl px-4 py-3">
          {loadError}
        </div>
      )}

      {/* Verification widget */}
      <div
        className={`rounded-2xl border p-5 ${
          isVerified ? 'bg-emerald-50 border-emerald-200' : 'bg-card border-border'
        }`}
      >
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <h3 className="text-sm font-extrabold text-foreground flex items-center gap-2">
            <span
              className={`w-7 h-7 rounded-full flex items-center justify-center ${
                isVerified ? 'bg-emerald-100' : 'bg-amber-100'
              }`}
            >
              <Icon
                name="ShieldCheckIcon"
                size={14}
                className={isVerified ? 'text-emerald-600' : 'text-amber-600'}
              />
            </span>
            حالة توثيق المصنع
          </h3>
          <span
            className={`inline-flex items-center text-[11px] font-bold px-2.5 py-1 rounded-full ${
              isVerified ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
            }`}
          >
            {isVerified ? '✅ مصنع موثق' : `${trustPct}% من التوثيق`}
          </span>
        </div>

        <div className="w-full h-2 bg-muted rounded-full overflow-hidden mb-4" aria-hidden="true">
          <div
            className={`h-full rounded-full transition-all ${isVerified ? 'bg-emerald-500' : 'bg-amber-500'}`}
            style={{ width: `${trustPct}%` }}
          />
        </div>

        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          {docRows.map((row) => (
            <li
              key={row.key}
              className={`flex items-center gap-3 p-3 border rounded-xl ${
                row.done ? 'bg-emerald-50 border-emerald-200' : 'bg-muted/40 border-border'
              }`}
            >
              <span
                className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                  row.done ? 'bg-emerald-100' : 'bg-card'
                }`}
              >
                <Icon
                  name={row.done ? 'CheckCircleIcon' : 'DocumentTextIcon'}
                  size={18}
                  className={row.done ? 'text-emerald-600' : 'text-muted-foreground'}
                />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-extrabold text-foreground">{row.label}</p>
                <p className="text-[11px] text-muted-foreground">
                  {row.done ? 'تم الرفع (50%)' : 'لم يتم الرفع بعد (50%)'}
                </p>
              </div>
            </li>
          ))}
        </ul>

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-[11px] text-muted-foreground leading-relaxed flex-1 min-w-[200px]">
            ارفع السجل التجاري والترخيص الصناعي للحصول على شارة «مصنع موثق» (100%).
          </p>
          {!isVerified && (
            <Link
              href="/manufacturer/products"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
            >
              <Icon name="ArrowUpTrayIcon" size={13} />
              رفع المستندات
            </Link>
          )}
        </div>
      </div>

      {/* Factory details form */}
      <form onSubmit={handleSave} className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4" noValidate>
        <h3 className="text-sm font-extrabold text-foreground flex items-center gap-2">
          <span className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center">
            <Icon name="BuildingOffice2Icon" size={14} className="text-blue-600" />
          </span>
          بيانات المصنع
        </h3>

        <div>
          <label htmlFor="factory-name" className="block text-xs font-bold text-foreground mb-1.5">
            اسم المصنع (بالعربية) <span className="text-red-500">*</span>
          </label>
          <input
            id="factory-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="مثال: مصنع الأمل للصناعات الغذائية"
            className="w-full h-11 px-3 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div>
          <label htmlFor="factory-description" className="block text-xs font-bold text-foreground mb-1.5">
            وصف المصنع / نبذة تعريفية
          </label>
          <textarea
            id="factory-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="اكتب نبذة مختصرة عن مصنعك ومنتجاتك وطاقتك الإنتاجية"
            className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-y"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="factory-city" className="block text-xs font-bold text-foreground mb-1.5">
              المحافظة / المدينة
            </label>
            <select
              id="factory-city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full h-11 px-3 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">اختر المحافظة</option>
              {city && !YEMEN_GOVERNORATES.includes(city) && <option value={city}>{city}</option>}
              {YEMEN_GOVERNORATES.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="factory-phone" className="block text-xs font-bold text-foreground mb-1.5">
              رقم الهاتف / واتساب
            </label>
            <input
              id="factory-phone"
              type="tel"
              inputMode="tel"
              dir="ltr"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+967 77X XXX XXX"
              className="w-full h-11 px-3 rounded-xl border border-border bg-background text-sm text-foreground text-left focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        <div>
          <label htmlFor="factory-tax" className="block text-xs font-bold text-foreground mb-1.5">
            الرقم الضريبي <span className="text-muted-foreground font-medium">(اختياري — للمعلومات فقط)</span>
          </label>
          <input
            id="factory-tax"
            type="text"
            dir="ltr"
            value={taxId}
            onChange={(e) => setTaxId(e.target.value)}
            disabled={!registration}
            placeholder={registration ? 'الرقم الضريبي' : 'متاح بعد تسجيل المصنع'}
            className="w-full h-11 px-3 rounded-xl border border-border bg-background text-sm text-foreground text-left focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60"
          />
          <p className="text-[11px] text-muted-foreground mt-1">
            لا يؤثر الرقم الضريبي على الحصول على شارة «مصنع موثق».
          </p>
        </div>

        {saveError && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl px-4 py-3">
            {saveError}
          </div>
        )}
        {saveSuccess && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold rounded-xl px-4 py-3">
            {saveSuccess}
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 h-11 px-6 rounded-xl bg-primary text-primary-foreground text-sm font-extrabold hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            {saving && <Icon name="ArrowPathIcon" size={14} className="animate-spin" />}
            حفظ التغييرات
          </button>
        </div>
      </form>
    </div>
  );
}
