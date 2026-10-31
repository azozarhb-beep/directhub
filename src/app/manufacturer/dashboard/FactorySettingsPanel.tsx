'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { resolvePlatformRole } from '@/lib/roomIsolation';

interface FactorySettingsPanelProps {
  userId?: string | null;
  onRoleResolved?: (isSupplier: boolean) => void;
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

export default function FactorySettingsPanel({ userId, onRoleResolved }: FactorySettingsPanelProps) {
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
  const [isSupplier, setIsSupplier] = useState(false);

  const [repId, setRepId] = useState<string | null>(null);
  const [repCode, setRepCode] = useState('');
  const [repLinking, setRepLinking] = useState(false);
  const [repError, setRepError] = useState('');
  const [repSuccess, setRepSuccess] = useState('');

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    let active = true;
    const loadRep = async () => {
      const { data } = await supabase.rpc('get_factory_rep_id');
      if (active) setRepId((data as string | null) ?? null);
    };
    loadRep();
    const channel = supabase
      .channel(`settings-rep-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'factory_registrations', filter: `user_id=eq.${userId}` },
        () => {
          loadRep();
        },
      )
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const handleLinkRep = async () => {
    setRepError('');
    setRepSuccess('');
    const code = repCode.trim();
    if (!code) {
      setRepError('أدخل كود المندوب الميداني أولاً.');
      return;
    }
    setRepLinking(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('link_factory_to_rep_code', { p_code: code });
      if (error) {
        const msg = error.message || '';
        if (msg.includes('already_assigned')) throw new Error('تم تعيين مندوب لمصنعك مسبقاً.');
        if (msg.includes('invalid_code')) throw new Error('كود المندوب غير صحيح.');
        throw error;
      }
      const row = (Array.isArray(data) ? data[0] : data) as { agent_id?: string; full_name?: string } | null;
      setRepId(row?.agent_id ?? 'linked');
      setRepCode('');
      setRepSuccess(`تم ربط مصنعك بالمندوب${row?.full_name ? `: ${row.full_name}` : ''}.`);
    } catch (err: any) {
      setRepError(err?.message || 'تعذر ربط المندوب.');
    } finally {
      setRepLinking(false);
    }
  };

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
        const [profileRes, regRes, authRes, roleRes] = await Promise.all([
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
          supabase.auth.getUser(),
          supabase
            .from('user_profiles')
            .select('role, account_type, seller_category')
            .eq('id', userId)
            .maybeSingle(),
        ]);
        if (cancelled) return;

        const meta = (authRes?.data?.user?.user_metadata ?? {}) as Record<string, any>;
        const roleRow = (roleRes?.data ?? null) as Record<string, any> | null;
        const SUPPLIER_VALUES = ['commercial_supplier', 'local_supplier'];
        const candidates = [
          meta.account_role,
          meta.user_role,
          meta.seller_category,
          roleRow?.seller_category,
          roleRow?.account_type,
        ].map((v) => String(v ?? '').toLowerCase().trim());
        const isAdminRole = String(roleRow?.role ?? '').toLowerCase().trim() === 'admin';
        const supplierResolved =
          !isAdminRole &&
          (candidates.some((v) => SUPPLIER_VALUES.includes(v)) ||
            resolvePlatformRole({
              role: roleRow?.role ?? null,
              account_type: roleRow?.account_type ?? meta.account_type ?? null,
              seller_category: roleRow?.seller_category ?? meta.seller_category ?? null,
              metadataRole: meta.account_role ?? meta.user_role ?? null,
            }) === 'commercial_supplier');
        setIsSupplier(supplierResolved);
        onRoleResolved?.(supplierResolved);

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
        if (!cancelled) setLoadError(isSupplier ? 'تعذر تحميل بيانات المنشأة. حاول مرة أخرى.' : 'تعذر تحميل بيانات المصنع. حاول مرة أخرى.');
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
  const trustPct = isSupplier
    ? hasCommercial
      ? 100
      : 0
    : (hasCommercial ? 50 : 0) + (hasIndustrial ? 50 : 0);
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
      setSaveError(isSupplier ? 'اسم المنشأة التجارية مطلوب.' : 'اسم المصنع (بالعربية) مطلوب.');
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
        {isSupplier ? 'يرجى تسجيل الدخول لعرض إعدادات المورد.' : 'يرجى تسجيل الدخول لعرض إعدادات المصنع.'}
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

  const docRows = isSupplier
    ? [{ key: 'cr', label: 'السجل التجاري', done: hasCommercial, pct: 100 }]
    : [
        { key: 'cr', label: 'السجل التجاري', done: hasCommercial, pct: 50 },
        { key: 'il', label: 'الترخيص الصناعي', done: hasIndustrial, pct: 50 },
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
            {isSupplier ? 'حالة توثيق المورد' : 'حالة توثيق المصنع'}
          </h3>
          <span
            className={`inline-flex items-center text-[11px] font-bold px-2.5 py-1 rounded-full ${
              isVerified ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
            }`}
          >
            {isVerified ? (isSupplier ? '✅ مورد موثق' : '✅ مصنع موثق') : `${trustPct}% من التوثيق`}
          </span>
        </div>

        <div className="w-full h-2 bg-muted rounded-full overflow-hidden mb-4" aria-hidden="true">
          <div
            className={`h-full rounded-full transition-all ${isVerified ? 'bg-emerald-500' : 'bg-amber-500'}`}
            style={{ width: `${trustPct}%` }}
          />
        </div>

        <ul className={`grid grid-cols-1 ${isSupplier ? '' : 'sm:grid-cols-2'} gap-3 mb-4`}>
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
                  {row.done ? `تم الرفع (${row.pct}%)` : `لم يتم الرفع بعد (${row.pct}%)`}
                </p>
              </div>
            </li>
          ))}
        </ul>

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-[11px] text-muted-foreground leading-relaxed flex-1 min-w-[200px]">
            {isSupplier
              ? 'ارفع السجل التجاري للحصول على شارة «مورد موثق» (100%).'
              : 'ارفع السجل التجاري والترخيص الصناعي للحصول على شارة «مصنع موثق» (100%).'}
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
          {isSupplier ? 'بيانات المنشأة التجارية' : 'بيانات المصنع'}
        </h3>

        <div>
          <label htmlFor="factory-name" className="block text-xs font-bold text-foreground mb-1.5">
            {isSupplier ? 'اسم المنشأة التجارية' : 'اسم المصنع (بالعربية)'} <span className="text-red-500">*</span>
          </label>
          <input
            id="factory-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={isSupplier ? 'مثال: مؤسسة الأمل للتجارة والتوريدات' : 'مثال: مصنع الأمل للصناعات الغذائية'}
            className="w-full h-11 px-3 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div>
          <label htmlFor="factory-description" className="block text-xs font-bold text-foreground mb-1.5">
            {isSupplier ? 'وصف المنشأة / نبذة تعريفية' : 'وصف المصنع / نبذة تعريفية'}
          </label>
          <textarea
            id="factory-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder={isSupplier ? 'اكتب نبذة مختصرة عن منشأتك ومنتجاتك التي تورّدها' : 'اكتب نبذة مختصرة عن مصنعك ومنتجاتك وطاقتك الإنتاجية'}
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
            placeholder={registration ? 'الرقم الضريبي' : isSupplier ? 'متاح بعد رفع السجل التجاري' : 'متاح بعد تسجيل المصنع'}
            className="w-full h-11 px-3 rounded-xl border border-border bg-background text-sm text-foreground text-left focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60"
          />
          <p className="text-[11px] text-muted-foreground mt-1">
            {isSupplier
              ? 'لا يؤثر الرقم الضريبي (البطاقة الضريبية) على الحصول على شارة «مورد موثق».'
              : 'لا يؤثر الرقم الضريبي على الحصول على شارة «مصنع موثق».'}
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

      {/* Field rep self-link (only while awaiting assignment) */}
      {!repId && (
        <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-3">
          <h3 className="text-sm font-extrabold text-foreground flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center">
              <Icon name="UserCircleIcon" size={14} className="text-amber-600" />
            </span>
            المندوب الميداني
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
              بانتظار التعيين
            </span>
          </h3>
          <div>
            <label htmlFor="factory-rep-code" className="block text-xs font-bold text-foreground mb-1.5">
              كود المندوب الميداني (إن وجد)
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                id="factory-rep-code"
                type="text"
                dir="ltr"
                value={repCode}
                onChange={(e) => setRepCode(e.target.value)}
                placeholder="AGT-XXXXXXXX"
                className="flex-1 h-11 px-3 rounded-xl border border-border bg-background text-sm text-foreground text-left focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                type="button"
                onClick={handleLinkRep}
                disabled={repLinking || !repCode.trim()}
                className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-extrabold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {repLinking && <Icon name="ArrowPathIcon" size={14} className="animate-spin" />}
                حفظ وربط
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              حقل اختياري — إن لم يكن لديك كود، ستقوم الإدارة بتعيين مندوب {isSupplier ? 'لمنشأتك' : 'لمصنعك'}.
            </p>
          </div>
          {repError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl px-4 py-3">{repError}</div>
          )}
        </div>
      )}
      {repId && repSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold rounded-xl px-4 py-3">
          {repSuccess}
        </div>
      )}
    </div>
  );
}
