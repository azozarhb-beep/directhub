'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';

interface SupplierSettingsPanelProps {
  userId?: string | null;
}

const YEMEN_GOVERNORATES = [
  'صنعاء', 'عدن', 'الحديدة', 'تعز', 'حضرموت', 'إب', 'ذمار', 'لحج', 'أبين', 'شبوة', 'مأرب',
  'الجوف', 'عمران', 'حجة', 'صعدة', 'المحويت', 'ريمة', 'البيضاء', 'الضالع', 'المهرة', 'سقطرى', 'أمانة العاصمة',
];

interface SupplierDocumentsRow {
  commercial_register_number: string | null;
  commercial_register_url: string | null;
  agency_authorization_url: string | null;
  agency_authorization_note: string | null;
  trade_name: string | null;
  tax_id: string | null;
  field_agent_code: string | null;
  verification_status: string | null;
  reject_reason?: string | null;
}

const YEMEN_PHONE_REGEX = /^(?:\+?967|00967)?0?7[0137]\d{7}$/;
const MAX_FILE_SIZE = 25 * 1024 * 1024;
const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

function normalizePhone(value: string): string {
  return (value ?? '').replace(/[\s-]/g, '');
}

const INPUT =
  'w-full h-11 px-3 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary';

interface ArabicFilePickerProps {
  id: string;
  file: File | null;
  onChange: (file: File | null) => void;
}

function ArabicFilePicker({ id, file, onChange }: ArabicFilePickerProps) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <input
        id={id}
        type="file"
        accept=".pdf,image/*"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
        className="sr-only"
      />
      <label
        htmlFor={id}
        className="inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-extrabold cursor-pointer hover:opacity-90 transition-opacity focus-within:ring-2 focus-within:ring-primary"
      >
        <span aria-hidden="true">📁</span>
        <span>استعراض الملف</span>
      </label>
      <span className="text-[11px] text-muted-foreground min-w-0 truncate max-w-[14rem]" dir="auto">
        {file ? file.name : 'لم يتم اختيار ملف بعد'}
      </span>
    </div>
  );
}

export default function SupplierSettingsPanel({ userId }: SupplierSettingsPanelProps) {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');

  const [docs, setDocs] = useState<SupplierDocumentsRow | null>(null);
  const [crNumber, setCrNumber] = useState('');
  const [tradeName, setTradeName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [agentCode, setAgentCode] = useState('');
  const [agencyNote, setAgencyNote] = useState('');
  const [crFile, setCrFile] = useState<File | null>(null);
  const [agencyFile, setAgencyFile] = useState<File | null>(null);

  const load = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError('');
    try {
      const [profileRes, docsRes] = await Promise.all([
        supabase.from('user_profiles').select('company_name, full_name, description, city, phone').eq('id', userId).maybeSingle(),
        supabase
          .from('supplier_documents')
          .select('commercial_register_number, commercial_register_url, agency_authorization_url, agency_authorization_note, trade_name, tax_id, field_agent_code, verification_status, reject_reason')
          .eq('supplier_id', userId)
          .maybeSingle(),
      ]);

      let profile: Record<string, any> | null = (profileRes.data as Record<string, any>) ?? null;
      if (profileRes.error && !profile) {
        const fallback = await supabase.from('user_profiles').select('company_name, full_name, phone').eq('id', userId).maybeSingle();
        profile = (fallback.data as Record<string, any>) ?? null;
      }
      setName(profile?.company_name || profile?.full_name || '');
      setDescription(profile?.description || '');
      setCity(profile?.city || '');
      setPhone(profile?.phone || '');

      if (docsRes.error) {
        setLoadError(docsRes.error.message);
      }
      const row = (docsRes.data as SupplierDocumentsRow) ?? null;
      setDocs(row);
      setCrNumber(row?.commercial_register_number || '');
      setTradeName(row?.trade_name || '');
      setTaxId(row?.tax_id || '');
      setAgentCode(row?.field_agent_code || '');
      setAgencyNote(row?.agency_authorization_note || '');
    } catch (err: any) {
      setLoadError(err?.message || 'تعذر تحميل بيانات المورد. حاول مرة أخرى.');
    } finally {
      setLoading(false);
    }
  }, [supabase, userId]);

  useEffect(() => {
    load();
  }, [load]);

  const hasCommercial = !!docs?.commercial_register_url;
  const hasAgency = !!docs?.agency_authorization_url;
  const trustPct = (hasCommercial ? 50 : 0) + (hasAgency ? 50 : 0);
  const verificationStatus = docs?.verification_status ?? 'pending';
  const isVerified = verificationStatus === 'approved';
  const isRejected = verificationStatus === 'rejected';
  const awaitingReview = !isVerified && !isRejected && trustPct === 100;

  const validateFile = (file: File | null): string | null => {
    if (!file) return null;
    if (file.size > MAX_FILE_SIZE) return 'حجم الملف يتجاوز 25 ميجابايت.';
    if (!ALLOWED_MIME.includes(file.type)) return 'صيغة الملف غير مدعومة. استخدم PDF أو صورة.';
    return null;
  };

  const uploadFile = async (file: File, kind: 'commercial-register' | 'agency-authorization'): Promise<string> => {
    const ext = file.name.includes('.') ? file.name.split('.').pop() : 'bin';
    const path = `factory-docs/supplier-${userId}/${kind}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('factory-documents').upload(path, file, { upsert: true, contentType: file.type });
    if (error) throw error;
    return supabase.storage.from('factory-documents').getPublicUrl(path).data.publicUrl;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError('');
    setSaveSuccess('');
    if (!userId) {
      setSaveError('يرجى تسجيل الدخول أولاً.');
      return;
    }
    if (!name.trim()) {
      setSaveError('اسم المورد / المؤسسة التجارية مطلوب.');
      return;
    }
    const cleanPhone = normalizePhone(phone);
    if (cleanPhone && !YEMEN_PHONE_REGEX.test(cleanPhone)) {
      setSaveError('رقم الهاتف غير صحيح. مثال: 771234567 أو +967771234567');
      return;
    }
    const fileErr = validateFile(crFile) || validateFile(agencyFile);
    if (fileErr) {
      setSaveError(fileErr);
      return;
    }

    setSaving(true);
    try {
      const profilePayload: Record<string, unknown> = {
        company_name: name.trim(),
        description: description.trim() || null,
        city: city || null,
        phone: cleanPhone || null,
      };
      let current: Record<string, unknown> = { ...profilePayload };
      let lastError: { message: string } | null = null;
      for (let i = 0; i < 5; i++) {
        const { error } = await supabase.from('user_profiles').update(current).eq('id', userId);
        lastError = error;
        if (!error) break;
        const missing =
          error.message?.match(/column (?:user_profiles\.)?"?(\w+)"? (?:of relation "user_profiles" )?does not exist/i)?.[1] ??
          error.message?.match(/Could not find the '(\w+)' column/i)?.[1];
        if (!missing || !(missing in current)) break;
        const next = { ...current };
        delete next[missing];
        current = next;
      }
      if (lastError) throw lastError;

      const crUrl = crFile ? await uploadFile(crFile, 'commercial-register') : docs?.commercial_register_url ?? null;
      const agencyUrl = agencyFile ? await uploadFile(agencyFile, 'agency-authorization') : docs?.agency_authorization_url ?? null;

      const { error: docsError } = await supabase.from('supplier_documents').upsert(
        {
          supplier_id: userId,
          commercial_register_number: crNumber.trim() || null,
          commercial_register_url: crUrl,
          agency_authorization_url: agencyUrl,
          agency_authorization_note: agencyNote.trim() || null,
          trade_name: tradeName.trim() || null,
          tax_id: taxId.trim() || null,
          field_agent_code: agentCode.trim() || null,
        },
        { onConflict: 'supplier_id' },
      );
      if (docsError) throw docsError;

      setCrFile(null);
      setAgencyFile(null);
      setSaveSuccess('تم حفظ التغييرات بنجاح.');
      await load();
    } catch (err: any) {
      setSaveError(err?.message ? `تعذر حفظ التغييرات: ${err.message}` : 'تعذر حفظ التغييرات.');
    } finally {
      setSaving(false);
    }
  };

  if (!userId) {
    return (
      <div className="bg-card border border-border rounded-2xl p-6 text-center text-sm text-muted-foreground" dir="rtl">
        يرجى تسجيل الدخول لعرض إعدادات المورد.
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
    { key: 'agency', label: 'عقود وشهادات الوكالة التجارية والتوزيع', done: hasAgency },
  ];

  return (
    <div className="flex flex-col gap-5" dir="rtl">
      {loadError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl px-4 py-3">{loadError}</div>
      )}

      <div className={`rounded-2xl border p-5 ${isVerified ? 'bg-emerald-50 border-emerald-200' : 'bg-card border-border'}`}>
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <h3 className="text-sm font-extrabold text-foreground flex items-center gap-2">
            <span className={`w-7 h-7 rounded-full flex items-center justify-center ${isVerified ? 'bg-emerald-100' : 'bg-amber-100'}`}>
              <Icon name="ShieldCheckIcon" size={14} className={isVerified ? 'text-emerald-600' : 'text-amber-600'} />
            </span>
            حالة توثيق المورد والوكيل التجاري
          </h3>
          <span className={`inline-flex items-center text-[11px] font-bold px-2.5 py-1 rounded-full ${isVerified ? 'bg-emerald-100 text-emerald-700' : isRejected ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
            {isVerified
              ? '✅ مورد ووكيل تجاري موثق (معتمد من الإدارة)'
              : isRejected
                ? `❌ تم رفض التوثيق${docs?.reject_reason ? `: ${docs.reject_reason}` : ''}`
                : awaitingReview
                  ? '⏳ بانتظار اعتماد الإدارة'
                  : `${trustPct}% من التوثيق`}
          </span>
        </div>
        <div className="w-full h-2 bg-muted rounded-full overflow-hidden mb-4" aria-hidden="true">
          <div className={`h-full rounded-full transition-all ${isVerified ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${trustPct}%` }} />
        </div>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {docRows.map((row) => (
            <li key={row.key} className={`flex items-center gap-3 p-3 border rounded-xl ${row.done ? 'bg-emerald-50 border-emerald-200' : 'bg-muted/40 border-border'}`}>
              <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${row.done ? 'bg-emerald-100' : 'bg-card'}`}>
                <Icon name={row.done ? 'CheckCircleIcon' : 'DocumentTextIcon'} size={18} className={row.done ? 'text-emerald-600' : 'text-muted-foreground'} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-extrabold text-foreground">{row.label}</p>
                <p className="text-[11px] text-muted-foreground">{row.done ? 'تم الرفع (50%)' : 'لم يتم الرفع بعد (50%)'}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <form onSubmit={handleSave} className="flex flex-col gap-5" noValidate>
        <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4">
          <h3 className="text-sm font-extrabold text-foreground flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center">
              <Icon name="BuildingOffice2Icon" size={14} className="text-blue-600" />
            </span>
            بيانات المورد
          </h3>
          <div>
            <label htmlFor="supplier-name" className="block text-xs font-bold text-foreground mb-1.5">
              اسم المورد / المؤسسة التجارية <span className="text-red-500">*</span>
            </label>
            <input id="supplier-name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: مؤسسة الأمل للتجارة والتوزيع" className={INPUT} />
          </div>
          <div>
            <label htmlFor="supplier-description" className="block text-xs font-bold text-foreground mb-1.5">وصف النشاط التجاري ومجالات التوريد</label>
            <textarea id="supplier-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-y" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="supplier-city" className="block text-xs font-bold text-foreground mb-1.5">المحافظة</label>
              <select id="supplier-city" value={city} onChange={(e) => setCity(e.target.value)} className={INPUT}>
                <option value="">اختر المحافظة</option>
                {city && !YEMEN_GOVERNORATES.includes(city) && <option value={city}>{city}</option>}
                {YEMEN_GOVERNORATES.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="supplier-phone" className="block text-xs font-bold text-foreground mb-1.5">رقم الهاتف / واتساب</label>
              <input id="supplier-phone" type="tel" inputMode="tel" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+967 77X XXX XXX" className={`${INPUT} text-left`} />
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4">
          <h3 className="text-sm font-extrabold text-foreground flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center">
              <Icon name="DocumentCheckIcon" size={14} className="text-emerald-600" />
            </span>
            مستندات التوثيق التجاري
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="supplier-trade-name" className="block text-xs font-bold text-foreground mb-1.5">الاسم التجاري المعتمد</label>
              <input id="supplier-trade-name" type="text" value={tradeName} onChange={(e) => setTradeName(e.target.value)} className={INPUT} />
            </div>
            <div>
              <label htmlFor="supplier-tax" className="block text-xs font-bold text-foreground mb-1.5">الرقم الضريبي</label>
              <input id="supplier-tax" type="text" dir="ltr" value={taxId} onChange={(e) => setTaxId(e.target.value)} className={`${INPUT} text-left`} />
            </div>
            <div>
              <label htmlFor="supplier-cr-number" className="block text-xs font-bold text-foreground mb-1.5">رقم السجل التجاري</label>
              <input id="supplier-cr-number" type="text" dir="ltr" value={crNumber} onChange={(e) => setCrNumber(e.target.value)} className={`${INPUT} text-left`} />
            </div>
            <div>
              <label htmlFor="supplier-agent-code" className="block text-xs font-bold text-foreground mb-1.5">كود المندوب الميداني (إن وجد)</label>
              <input id="supplier-agent-code" type="text" dir="ltr" value={agentCode} onChange={(e) => setAgentCode(e.target.value)} placeholder="AGT-XXXXXXXX" className={`${INPUT} text-left`} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="supplier-cr-file" className="block text-xs font-bold text-foreground mb-1.5">رفع السجل التجاري (PDF أو صورة)</label>
              <ArabicFilePicker id="supplier-cr-file" file={crFile} onChange={setCrFile} />
              {docs?.commercial_register_url && !crFile && (
                <a href={docs.commercial_register_url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-primary font-semibold hover:underline mt-1 inline-block">عرض الملف المرفوع</a>
              )}
            </div>
            <div>
              <label htmlFor="supplier-agency-file" className="block text-xs font-bold text-foreground mb-1.5">رفع عقد / شهادة الوكالة التجارية والتوزيع</label>
              <ArabicFilePicker id="supplier-agency-file" file={agencyFile} onChange={setAgencyFile} />
              {docs?.agency_authorization_url && !agencyFile && (
                <a href={docs.agency_authorization_url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-primary font-semibold hover:underline mt-1 inline-block">عرض الملف المرفوع</a>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="supplier-agency-note" className="block text-xs font-bold text-foreground mb-1.5">الجهات / العلامات التجارية التي تمثلها (اختياري)</label>
            <textarea id="supplier-agency-note" rows={2} value={agencyNote} onChange={(e) => setAgencyNote(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-y" />
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            يُمنح شارة «مورد ووكيل تجاري موثق» عند رفع السجل التجاري وعقود الوكالة التجارية والتوزيع.
          </p>
        </div>

        {saveError && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl px-4 py-3">{saveError}</div>
        )}
        {saveSuccess && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold rounded-xl px-4 py-3">{saveSuccess}</div>
        )}

        <div className="flex justify-end">
          <button type="submit" disabled={saving} className="inline-flex items-center justify-center gap-2 h-11 px-6 rounded-xl bg-primary text-primary-foreground text-sm font-extrabold hover:opacity-90 transition-opacity disabled:opacity-60">
            {saving && <Icon name="ArrowPathIcon" size={14} className="animate-spin" />}
            حفظ التغييرات
          </button>
        </div>
      </form>
    </div>
  );
}
