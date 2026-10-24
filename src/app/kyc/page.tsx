'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import Icon from '@/components/ui/AppIcon';
import { useLanguage } from '@/contexts/LanguageContext';
import { resolveFileType, extensionForType, fileWithResolvedType } from '@/lib/attachmentTypes';

interface KYCRecord {
  id: string;
  user_id: string;
  company_name: string;
  kyc_status: 'pending' | 'under_review' | 'approved' | 'rejected';
  registration_status: 'pending' | 'under_review' | 'approved' | 'rejected';
  admin_note: string | null;
  trade_license_url: string | null;
  tax_certificate_url: string | null;
  cr_document_url: string | null;
  factory_license_url: string | null;
  tax_id: string | null;
  submitted_at: string | null;
  documents_submitted_at: string | null;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  country: string;
  city: string;
  industry: string;
  seller_category: string | null;
}

const STATUS_META: Record<string, { color: string; icon: string }> = {
  pending: { color: 'bg-amber-50 text-amber-700 border-amber-200', icon: 'ClockIcon' },
  under_review: { color: 'bg-blue-50 text-blue-700 border-blue-200', icon: 'MagnifyingGlassIcon' },
  approved: { color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: 'CheckBadgeIcon' },
  rejected: { color: 'bg-red-50 text-red-700 border-red-200', icon: 'XCircleIcon' },
};

const STEP_META = [
  { key: 'submitted' as const, icon: 'DocumentTextIcon' },
  { key: 'documents' as const, icon: 'CloudArrowUpIcon' },
  { key: 'review' as const, icon: 'MagnifyingGlassIcon' },
  { key: 'approved' as const, icon: 'ShieldCheckIcon' },
];

export default function KYCPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const supabase = createClient();
  const { t, dir } = useLanguage();
  const k = t.kyc;

  const [kycRecord, setKycRecord] = useState<KYCRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) router.push('/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) fetchKYC();
  }, [user]);

  const fetchKYC = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('factory_registrations')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle();
      if (data) {
        setKycRecord(data);
      } else {
        // Existing factory account without a KYC row: create a minimal one so the
        // document upload view opens directly (never route to the signup wizard).
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('company_name, full_name, country, city')
          .eq('id', user!.id)
          .maybeSingle();
        const { data: created } = await supabase
          .from('factory_registrations')
          .insert({
            user_id: user!.id,
            company_name: profile?.company_name || profile?.full_name || '',
            contact_email: user!.email || '',
            ...(profile?.country ? { country: profile.country } : {}),
            ...(profile?.city ? { city: profile.city } : {}),
          })
          .select('*')
          .maybeSingle();
        setKycRecord(created ?? null);
      }
    } catch (err) {
      console.error('KYC fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleDocUpload = async (docType: string, file: File) => {
    if (!kycRecord) return;

    const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
    const MAX_SIZE_MB = 10;
    const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

    const resolvedType = resolveFileType(file, ALLOWED_TYPES);
    if (!resolvedType) {
      showToast(k.fileTypeError, 'error');
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      showToast(
        k.fileTooLarge
          .replace('{size}', (file.size / 1024 / 1024).toFixed(1))
          .replace('{max}', String(MAX_SIZE_MB)),
        'error'
      );
      return;
    }
    if (file.size === 0) {
      showToast(k.fileEmpty, 'error');
      return;
    }

    setUploading(docType);
    try {
      const ext = extensionForType(resolvedType);
      const path = `${user!.id}/${docType}_${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from('factory-documents')
        .upload(path, fileWithResolvedType(file, resolvedType), { contentType: resolvedType, upsert: true });
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage.from('factory-documents').getPublicUrl(path);
      const publicUrl = urlData.publicUrl;

      const fieldMap: Record<string, string> = {
        trade_license: 'trade_license_url',
        tax_certificate: 'tax_certificate_url',
        cr_document: 'cr_document_url',
        factory_license: 'factory_license_url',
      };

      const updateField = fieldMap[docType];
      if (!updateField) return;

      const { error: updateErr } = await supabase
        .from('factory_registrations')
        .update({
          [updateField]: publicUrl,
          documents_submitted_at: new Date().toISOString(),
          kyc_status: 'under_review',
        })
        .eq('id', kycRecord.id);

      if (updateErr) throw updateErr;
      await fetchKYC();
      showToast(k.uploadSuccess);
    } catch (err: any) {
      showToast(err.message || k.uploadFailed, 'error');
    } finally {
      setUploading(null);
    }
  };

  const getStepStatus = (stepKey: string): 'done' | 'active' | 'pending' => {
    if (!kycRecord) return 'pending';
    const status = kycRecord.kyc_status;
    if (stepKey === 'submitted') return kycRecord.submitted_at ? 'done' : 'active';
    if (stepKey === 'documents') {
      const hasDocs = !!(kycRecord.trade_license_url || kycRecord.cr_document_url);
      if (hasDocs) return 'done';
      if (kycRecord.submitted_at) return 'active';
      return 'pending';
    }
    if (stepKey === 'review') {
      if (status === 'approved' || status === 'rejected') return 'done';
      if (status === 'under_review') return 'active';
      return 'pending';
    }
    if (stepKey === 'approved') {
      if (status === 'approved') return 'done';
      return 'pending';
    }
    return 'pending';
  };

  const docItems = [
    {
      key: 'trade_license',
      label: k.docs.trade_license.label,
      desc: k.docs.trade_license.desc,
      url: kycRecord?.trade_license_url,
      required: true,
    },
    {
      key: 'cr_document',
      label: k.docs.cr_document.label,
      desc: k.docs.cr_document.desc,
      url: kycRecord?.cr_document_url,
      required: true,
    },
    {
      key: 'factory_license',
      label: k.docs.factory_license.label,
      desc: k.docs.factory_license.desc,
      url: kycRecord?.factory_license_url,
      required: false,
    },
  ];

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" dir={dir}>
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!kycRecord) {
    return (
      <div className="min-h-screen bg-background" dir={dir}>
        <Header />
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <div className="w-20 h-20 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Icon name="ShieldExclamationIcon" size={40} className="text-amber-500" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-3">{k.notRegisteredTitle}</h1>
          <p className="text-muted-foreground mb-8">{k.notRegisteredBody}</p>
          <a
            href="/manufacturer/settings"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-semibold"
          >
            <Icon name="ArrowRightIcon" size={18} />
            العودة إلى إعدادات المصنع
          </a>
        </div>
        <BottomNav />
      </div>
    );
  }

  const kycStatus = kycRecord.kyc_status || 'pending';
  const statusCfg = STATUS_META[kycStatus] || STATUS_META.pending;
  const statusText = (k.status as Record<string, string>)[kycStatus] || kycStatus;

  return (
    <div className="min-h-screen bg-background" dir={dir}>
      <Header />

      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 ${toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
          <Icon name={toast.type === 'success' ? 'CheckCircleIcon' : 'ExclamationCircleIcon'} size={16} />
          {toast.msg}
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 py-8 mobile-safe-bottom">
        <div className="mb-4">
          <a
            href="/manufacturer/settings"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
          >
            <Icon name="ArrowRightIcon" size={14} />
            العودة إلى إعدادات وتوثيق المصنع
          </a>
        </div>
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <Icon name="ShieldCheckIcon" size={22} className="text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">{k.title}</h1>
              <p className="text-sm text-muted-foreground">{k.subtitle}</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-2">{k.intro}</p>
        </div>

        <div className={`rounded-2xl border p-5 mb-8 ${statusCfg.color}`}>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <Icon name={statusCfg.icon as any} size={24} />
              <div>
                <p className="font-bold text-base">{kycRecord.company_name}</p>
                <p className="text-sm opacity-80">{k.verificationStatus.replace('{status}', statusText)}</p>
              </div>
            </div>
            <span className={`px-3 py-1.5 rounded-full text-xs font-bold border ${statusCfg.color}`}>
              {statusText}
            </span>
          </div>
          {kycRecord.admin_note && (
            <div className="mt-4 pt-4 border-t border-current/20">
              <p className="text-sm font-semibold mb-1">{k.adminNote}</p>
              <p className="text-sm opacity-90">{kycRecord.admin_note}</p>
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 mb-8">
          <h2 className="font-bold text-foreground mb-6">{k.progressTitle}</h2>
          <div className="flex items-start gap-0">
            {STEP_META.map((step, idx) => {
              const stepStatus = getStepStatus(step.key);
              return (
                <div key={step.key} className="flex-1 flex flex-col items-center relative">
                  {idx < STEP_META.length - 1 && (
                    <div className={`absolute top-5 left-1/2 w-full h-0.5 ${stepStatus === 'done' ? 'bg-emerald-400' : 'bg-border'}`} style={{ left: '50%' }} />
                  )}
                  <div className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                    stepStatus === 'done' ? 'bg-emerald-500 border-emerald-500 text-white' :
                    stepStatus === 'active' ? 'bg-primary border-primary text-primary-foreground' :
                    'bg-background border-border text-muted-foreground'
                  }`}>
                    {stepStatus === 'done' ? (
                      <Icon name="CheckIcon" size={16} />
                    ) : (
                      <Icon name={step.icon as any} size={16} />
                    )}
                  </div>
                  <p className={`text-xs font-medium mt-2 text-center px-1 ${stepStatus === 'done' ? 'text-emerald-600' : stepStatus === 'active' ? 'text-primary' : 'text-muted-foreground'}`}>
                    {k.steps[step.key]}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 mb-8">
          <h2 className="font-bold text-foreground mb-4 flex items-center gap-2">
            <Icon name="BuildingOffice2Icon" size={18} className="text-primary" />
            {k.companyInfo}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { label: k.companyName, value: kycRecord.company_name },
              { label: k.country, value: kycRecord.country },
              { label: k.city, value: kycRecord.city },
              { label: k.industry, value: kycRecord.industry },
              { label: k.contact, value: kycRecord.contact_name },
              { label: k.taxId, value: kycRecord.tax_id || '—' },
            ].map((item) => (
              <div key={item.label} className="bg-muted/40 rounded-xl p-3">
                <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
                <p className="text-sm font-semibold text-foreground truncate">{item.value || '—'}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 mb-8">
          <h2 className="font-bold text-foreground mb-2 flex items-center gap-2">
            <Icon name="DocumentDuplicateIcon" size={18} className="text-primary" />
            {k.documentsTitle}
          </h2>
          <p className="text-sm text-muted-foreground mb-6">{k.documentsHint}</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {docItems.map((doc) => (
              <div key={doc.key} className={`border rounded-xl p-4 transition-all ${doc.url ? 'border-emerald-200 bg-emerald-50/50' : 'border-border bg-background'}`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">{doc.label}</p>
                      {doc.required && <span className="text-xs text-red-500 font-medium">{k.required}</span>}
                    </div>
                  </div>
                  {doc.url ? (
                    <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                      <Icon name="CheckCircleIcon" size={18} className="text-emerald-600" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center">
                      <Icon name="ExclamationCircleIcon" size={18} className="text-amber-500" />
                    </div>
                  )}
                </div>

                <p className="text-xs text-muted-foreground mb-3">{doc.desc}</p>

                {doc.url ? (
                  <div className="flex items-center gap-2">
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-emerald-700 bg-emerald-100 rounded-lg hover:bg-emerald-200 transition-colors"
                    >
                      <Icon name="EyeIcon" size={14} />
                      {k.viewDoc}
                    </a>
                    {kycStatus !== 'approved' && (
                      <label className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-muted-foreground bg-muted rounded-lg hover:bg-muted/80 cursor-pointer transition-colors">
                        <Icon name="ArrowPathIcon" size={14} />
                        {k.update}
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          className="hidden"
                          onChange={(e) => e.target.files?.[0] && handleDocUpload(doc.key, e.target.files[0])}
                          disabled={uploading === doc.key}
                        />
                      </label>
                    )}
                  </div>
                ) : (
                  <label className={`flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-xl cursor-pointer transition-colors border-2 border-dashed ${
                    uploading === doc.key
                      ? 'border-primary/40 bg-primary/5 text-primary cursor-wait' :'border-border hover:border-primary hover:bg-primary/5 text-muted-foreground hover:text-primary'
                  }`}>
                    {uploading === doc.key ? (
                      <>
                        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        {k.uploading}
                      </>
                    ) : (
                      <>
                        <Icon name="CloudArrowUpIcon" size={16} />
                        {k.uploadDoc}
                      </>
                    )}
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && handleDocUpload(doc.key, e.target.files[0])}
                      disabled={!!uploading}
                    />
                  </label>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <Icon name="InformationCircleIcon" size={20} className="text-blue-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-blue-800 mb-2">{k.whyTitle}</p>
              <ul className="text-xs text-blue-700 space-y-1.5">
                <li className="flex items-start gap-1.5"><Icon name="CheckIcon" size={12} className="shrink-0 mt-0.5" /> {k.why1}</li>
                <li className="flex items-start gap-1.5"><Icon name="CheckIcon" size={12} className="shrink-0 mt-0.5" /> {k.why2}</li>
                <li className="flex items-start gap-1.5"><Icon name="CheckIcon" size={12} className="shrink-0 mt-0.5" /> {k.why3}</li>
                <li className="flex items-start gap-1.5"><Icon name="CheckIcon" size={12} className="shrink-0 mt-0.5" /> {k.why4}</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
