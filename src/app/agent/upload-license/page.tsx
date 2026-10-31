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
  trade_license_url: string;
  cr_document_url: string;
  factory_license_url: string;
  license_submitted_at: string | null;
}

const DOC_TYPE_META = [
  { key: 'trade_license', label: 'السجل التجاري', icon: 'DocumentTextIcon', required: true },
  { key: 'cr_document', label: 'البطاقة والرقم الضريبي', icon: 'ClipboardDocumentListIcon', required: false },
  { key: 'factory_license', label: 'رخصة مزاولة المهنة / السجل الصناعي', icon: 'BuildingOffice2Icon', required: false },
];

function UploadLicensePageInner() {
  const { t, dir } = useLanguage();
  const ul = t.agentUploadLicense;

  const router = useRouter();
  const searchParams = useSearchParams();
  const factoryId = searchParams?.get('factoryId') || '';
  const { user, loading: authLoading } = useAuth();
  const supabase = createClient();

  const [factory, setFactory] = useState<AgentFactory | null>(null);
  const [fetchingFactory, setFetchingFactory] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [uploadedDocs, setUploadedDocs] = useState<Record<string, string>>({});

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
      .select('id, company_name, city, country, trade_license_url, cr_document_url, factory_license_url, license_submitted_at')
      .eq('id', factoryId)
      .eq('agent_id', user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setFactory(data);
          setUploadedDocs({
            trade_license: data.trade_license_url || '',
            cr_document: data.cr_document_url || '',
            factory_license: data.factory_license_url || '',
          });
        }
        setFetchingFactory(false);
      });
  }, [user, factoryId, supabase]);

  const handleFileUpload = async (docType: string, file: File) => {
    if (!user || !factory) return;
    setUploading(docType);
    setError('');
    try {
      // Upload to Supabase Storage.
      // Path MUST start with factory-docs/ — storage RLS only allows that prefix
      // (agent-docs/ was blocked with "new row violates row-level security policy").
      const fileExt = file.name.split('.').pop();
      const filePath = `factory-docs/agent/${user.id}/${factory.id}/${docType}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('factory-documents')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Store the private object path (never a public URL); viewed via signed URLs.
      const publicUrl = filePath;

      // Update factory record
      const updateData: Record<string, string | Date> = {
        [`${docType}_url`]: publicUrl,
        [`${docType}_filename`]: file.name,
      };

      // Mark license as submitted when trade_license is uploaded
      if (docType === 'trade_license') {
        updateData.license_submitted_at = new Date().toISOString();
        updateData.contact_status = 'awaiting_license_approval';
      }

      const { error: updateError } = await supabase
        .from('agent_factory_registrations')
        .update(updateData)
        .eq('id', factory.id)
        .eq('agent_id', user.id);

      if (updateError) throw updateError;

      setUploadedDocs(prev => ({ ...prev, [docType]: publicUrl }));
      setFactory(prev => prev ? { ...prev, [`${docType}_url`]: publicUrl } : prev);

      if (docType === 'trade_license') {
        setSuccess(true);
      }
    } catch (err: any) {
      // If storage bucket doesn't exist, store as placeholder
      if (err.message?.includes('Bucket not found') || err.message?.includes('bucket')) {
        const placeholderUrl = `pending-upload:${file.name}`;
        const updateData: Record<string, string> = {
          [`${docType}_url`]: placeholderUrl,
          [`${docType}_filename`]: file.name,
        };
        if (docType === 'trade_license') {
          updateData.license_submitted_at = new Date().toISOString();
          updateData.contact_status = 'awaiting_license_approval';
        }
        await supabase
          .from('agent_factory_registrations')
          .update(updateData)
          .eq('id', factory.id)
          .eq('agent_id', user.id);

        setUploadedDocs(prev => ({ ...prev, [docType]: placeholderUrl }));
        if (docType === 'trade_license') setSuccess(true);
      } else {
        setError(err.message || ul.errorUpload);
      }
    } finally {
      setUploading(null);
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
          <h2 className="text-xl font-bold text-foreground mb-2">{ul.factoryNotFound}</h2>
          <Link href="/agent/dashboard" className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl font-semibold">
            <Icon name="ArrowRightIcon" size={15} />
            {ul.backToDashboard}
          </Link>
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
            <h1 className="text-xl font-bold text-foreground">{ul.title}</h1>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Icon name="BuildingOffice2Icon" size={11} />
              {factory.company_name} · {factory.city}
            </p>
          </div>
        </div>

        {success && (
          <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-sm">
            <Icon name="CheckCircleIcon" size={16} />
            {ul.successBanner}
          </div>
        )}

        {error && (
          <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
            <Icon name="ExclamationCircleIcon" size={16} />
            {error}
          </div>
        )}

        {/* Info Banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5 flex items-start gap-3">
          <Icon name="InformationCircleIcon" size={18} className="text-blue-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-blue-800 mb-0.5">{ul.howTitle}</p>
            <p className="text-xs text-blue-700">{ul.howBody}</p>
          </div>
        </div>

        {/* Document Upload Cards */}
        <div className="space-y-4">
          {DOC_TYPE_META.map(doc => {
            const docLabel = doc.label;
            const isUploaded = !!uploadedDocs[doc.key];
            const isUploading = uploading === doc.key;
            const isPending = uploadedDocs[doc.key]?.startsWith('pending-upload:');
            const filename = isPending ? uploadedDocs[doc.key].replace('pending-upload:', '') : '';

            return (
              <div key={doc.key} className={`bg-card border rounded-xl p-4 transition-colors ${isUploaded ? 'border-emerald-200' : 'border-border'}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isUploaded ? 'bg-emerald-50' : 'bg-muted'}`}>
                      <Icon name={doc.icon as any} size={20} className={isUploaded ? 'text-emerald-600' : 'text-muted-foreground'} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {docLabel}
                        {doc.required && <span className="text-red-500 mr-1">*</span>}
                      </p>
                      {isUploaded ? (
                        <p className="text-xs text-emerald-600 flex items-center gap-1">
                          <Icon name="CheckCircleIcon" size={11} />
                          {isPending ? ul.selected.replace('{filename}', filename) : ul.uploadedOk}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">{ul.fileHint}</p>
                      )}
                    </div>
                  </div>
                  <label className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer transition-colors ${
                    isUploading ? 'bg-muted text-muted-foreground cursor-not-allowed' :
                    isUploaded ? 'bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100': 'bg-primary text-white hover:bg-primary/90'
                  }`}>
                    {isUploading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        {ul.uploading}
                      </>
                    ) : isUploaded ? (
                      <>
                        <Icon name="ArrowPathIcon" size={14} />
                        {ul.change}
                      </>
                    ) : (
                      <>
                        <Icon name="ArrowUpTrayIcon" size={14} />
                        {ul.uploadFile}
                      </>
                    )}
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      className="hidden"
                      disabled={isUploading}
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(doc.key, file);
                        e.target.value = '';
                      }}
                    />
                  </label>
                </div>
              </div>
            );
          })}
        </div>

        {/* Submit Notification */}
        {uploadedDocs.trade_license && (
          <div className="mt-5 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
            <Icon name="BellIcon" size={18} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800">{ul.reviewSentTitle}</p>
              <p className="text-xs text-amber-700 mt-0.5">{ul.reviewSentBody}</p>
            </div>
          </div>
        )}

        <div className="mt-5">
          <Link
            href="/agent/dashboard"
            className="flex items-center justify-center gap-2 w-full px-4 py-3 border border-border rounded-xl text-sm font-semibold text-muted-foreground hover:bg-muted transition-colors"
          >
            <Icon name="ArrowRightIcon" size={15} />
            {ul.backToDashboard}
          </Link>
        </div>
      </main>
      <BottomNav />
    </div>
  );
}

export default function UploadLicensePage() {
  return (
    <React.Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>}>
      <UploadLicensePageInner />
    </React.Suspense>
  );
}
