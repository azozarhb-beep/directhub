'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';
import { useLanguage } from '@/contexts/LanguageContext';

interface FactoryDocument {
  id: string;
  factory_id: string;
  doc_type: string;
  file_url: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  description: string;
  created_at: string;
  cert_sub_type?: string | null;
  cert_number?: string | null;
  cert_expiry?: string | null;
  issuing_body?: string | null;
  verification_status?: string | null;
}

const DOC_TYPE_CONFIG: Record<string, { labelKey: string; icon: string; color: string }> = {
  trade_license: { labelKey: 'typeTradeLicense', icon: 'DocumentCheckIcon', color: 'text-emerald-600' },
  manufacturing_license: { labelKey: 'typeManufacturingLicense', icon: 'ClipboardDocumentListIcon', color: 'text-blue-600' },
  product_catalog: { labelKey: 'typeCatalog', icon: 'BookOpenIcon', color: 'text-purple-600' },
  company_profile: { labelKey: 'typeCompanyProfile', icon: 'BuildingOffice2Icon', color: 'text-indigo-600' },
  certificate: { labelKey: 'typeCertificate', icon: 'AcademicCapIcon', color: 'text-amber-600' },
  price_sheet: { labelKey: 'typePriceSheet', icon: 'CurrencyDollarIcon', color: 'text-emerald-600' },
  other: { labelKey: 'typeOther', icon: 'DocumentIcon', color: 'text-gray-600' },
};

const UPLOAD_DOC_TYPES = [
  'trade_license',
  'manufacturing_license',
  'product_catalog',
  'company_profile',
  'certificate',
  'price_sheet',
] as const;

const MAX_FILE_SIZE = 50 * 1024 * 1024;

const CERT_SUB_TYPES: { value: string; label: string }[] = [
  { value: 'iso_9001', label: 'ISO 9001 (إدارة الجودة)' },
  { value: 'saso_saber', label: 'SASO / سابر (المطابقة الخليجية والسعودية)' },
  { value: 'ce_mark', label: 'CE Mark (المطابقة الأوروبية للمعدات)' },
  { value: 'ysmo', label: 'شهادة الهيئة اليمنية للمواصفات والمقاييس (YSMO)' },
  { value: 'other', label: 'شهادة جودة / مطابقة أخرى (تحديد يدوي)' },
];

const CERT_STATUS_META: Record<string, { label: string; cls: string }> = {
  pending: { label: 'بانتظار الاعتماد', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  approved: { label: 'معتمدة', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  rejected: { label: 'مرفوضة / إعادة تصوير', cls: 'bg-red-50 text-red-700 border-red-200' },
};

const certSubTypeLabel = (doc: { cert_sub_type?: string | null }) => {
  const found = CERT_SUB_TYPES.find((c) => c.value === doc.cert_sub_type);
  return found ? found.label : doc.cert_sub_type || '';
};

interface FactoryDocumentUploadPanelProps {
  userId: string;
  onUploaded?: () => void;
}

export default function FactoryDocumentUploadPanel({ userId, onUploaded }: FactoryDocumentUploadPanelProps) {
  const { t, dir } = useLanguage();
  const ui = (t as any).factoryDocumentUpload as Record<string, string>;

  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [documents, setDocuments] = useState<FactoryDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState<string>('trade_license');
  const [description, setDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [filterType, setFilterType] = useState('');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [certSubType, setCertSubType] = useState('iso_9001');
  const [certCustomType, setCertCustomType] = useState('');
  const [certNumber, setCertNumber] = useState('');
  const [certExpiry, setCertExpiry] = useState('');
  const [issuingBody, setIssuingBody] = useState('');

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('factory_documents')
      .select('*')
      .eq('factory_id', userId)
      .order('created_at', { ascending: false });
    if (data) setDocuments(data as FactoryDocument[]);
    setLoading(false);
  }, [userId, supabase]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const acceptFile = (file: File | undefined | null) => {
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      setError(ui.fileHint);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setError('');
    setSelectedFile(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    acceptFile(e.target.files?.[0]);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    acceptFile(e.dataTransfer.files?.[0]);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError(ui.needFile);
      return;
    }

    const isCert = docType === 'certificate';
    if (isCert && certSubType === 'other' && !certCustomType.trim()) {
      setError('يرجى تحديد نوع الشهادة يدوياً');
      return;
    }
    if (isCert && !certNumber.trim()) {
      setError('يرجى إدخال رقم الشهادة');
      return;
    }

    setUploading(true);
    setError('');

    try {
      // factory_id is always the logged-in factory user's id (no manual factory selection)
      const fileExt = selectedFile.name.split('.').pop();
      const filePath = `factory-docs/${userId}/${docType}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('factory-documents')
        .upload(filePath, selectedFile, { upsert: false });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('factory-documents').getPublicUrl(filePath);
      const publicUrl = urlData.publicUrl;

      const { error: dbError } = await supabase.from('factory_documents').insert({
        factory_id: userId,
        doc_type: docType,
        file_url: publicUrl,
        file_name: selectedFile.name,
        file_size: selectedFile.size,
        mime_type: selectedFile.type,
        description: description.trim(),
        ...(isCert
          ? {
              cert_sub_type: certSubType === 'other' ? certCustomType.trim() : certSubType,
              cert_number: certNumber.trim(),
              cert_expiry: certExpiry || null,
              issuing_body: issuingBody.trim() || null,
              verification_status: 'pending',
            }
          : {}),
      });
      if (dbError) throw dbError;

      // Keep the existing license-approval gate in sync (factory_registrations)
      if (docType === 'trade_license' || docType === 'manufacturing_license') {
        const column = docType === 'trade_license' ? 'trade_license_url' : 'manufacturing_license_url';
        const { data: existing } = await supabase
          .from('factory_registrations')
          .select('id, trade_license_url, manufacturing_license_url')
          .eq('user_id', userId)
          .maybeSingle();

        if (existing) {
          const next = {
            trade_license_url: existing.trade_license_url,
            manufacturing_license_url: existing.manufacturing_license_url,
            [column]: publicUrl,
          } as { trade_license_url: string | null; manufacturing_license_url: string | null };
          const bothSubmitted = !!(next.trade_license_url && next.manufacturing_license_url);
          await supabase
            .from('factory_registrations')
            .update({
              [column]: publicUrl,
              ...(bothSubmitted
                ? {
                    documents_submitted_at: new Date().toISOString(),
                    registration_status: 'pending',
                    kyc_status: 'pending',
                  }
                : {}),
            })
            .eq('user_id', userId);
        } else {
          const { data: authData } = await supabase.auth.getUser();
          await supabase.from('factory_registrations').insert({
            user_id: userId,
            company_name: authData?.user?.user_metadata?.company_name || '',
            contact_email: authData?.user?.email || '',
            [column]: publicUrl,
          });
        }
      }

      setSuccess(ui.uploadSuccess);
      setTimeout(() => setSuccess(''), 4000);
      setSelectedFile(null);
      setDescription('');
      setCertNumber('');
      setCertExpiry('');
      setIssuingBody('');
      setCertCustomType('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      await fetchDocuments();
      onUploaded?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : ui.uploadError);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (doc: FactoryDocument) => {
    if (!confirm(ui.confirmDelete)) return;
    const { error: err } = await supabase
      .from('factory_documents')
      .delete()
      .eq('id', doc.id)
      .eq('factory_id', userId);
    if (!err) {
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
    }
  };

  const filteredDocs = documents.filter((d) => !filterType || d.doc_type === filterType);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-5" dir={dir}>
      {/* Upload Form */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center">
            <Icon name="ArrowUpTrayIcon" size={16} className="text-purple-600" />
          </div>
          <h3 className="font-bold text-foreground text-sm">{ui.title}</h3>
        </div>

        {success && (
          <div className="mb-3 px-3 py-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-xs flex items-center gap-2">
            <Icon name="CheckCircleIcon" size={14} />
            {success}
          </div>
        )}
        {error && (
          <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs flex items-center gap-2">
            <Icon name="ExclamationCircleIcon" size={14} />
            {error}
            <button type="button" onClick={() => setError('')} className="ms-auto">
              <Icon name="XMarkIcon" size={12} />
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Doc Type */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">{ui.fileType}</label>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:border-primary"
            >
              {UPLOAD_DOC_TYPES.map((key) => (
                <option key={key} value={key}>
                  {ui[DOC_TYPE_CONFIG[key].labelKey]}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">{ui.description}</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={ui.descriptionPlaceholder}
              className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
            />
          </div>

          {/* Certificate sub-type + metadata */}
          {docType === 'certificate' && (
            <div className="md:col-span-2 rounded-xl border border-amber-200 bg-amber-50/40 p-3 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">نوع الشهادة *</label>
                <div className="flex flex-wrap gap-2">
                  {CERT_SUB_TYPES.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setCertSubType(c.value)}
                      className={`px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-colors ${
                        certSubType === c.value
                          ? 'bg-amber-600 text-white border-amber-600' :'bg-background text-foreground border-border hover:border-amber-400'
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
                {certSubType === 'other' && (
                  <input
                    type="text"
                    value={certCustomType}
                    onChange={(e) => setCertCustomType(e.target.value)}
                    placeholder="اكتب اسم الشهادة يدوياً"
                    className="mt-2 w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                  />
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">رقم الشهادة *</label>
                  <input
                    type="text"
                    value={certNumber}
                    onChange={(e) => setCertNumber(e.target.value)}
                    dir="ltr"
                    className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">تاريخ الانتهاء</label>
                  <input
                    type="date"
                    value={certExpiry}
                    onChange={(e) => setCertExpiry(e.target.value)}
                    className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">الجهة المانحة</label>
                  <input
                    type="text"
                    value={issuingBody}
                    onChange={(e) => setIssuingBody(e.target.value)}
                    className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
            </div>
          )}

          {/* File Input (drag & drop) */}
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-foreground mb-1.5">{ui.fileRequired}</label>
            <div
              role="button"
              tabIndex={0}
              className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${
                dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary'
              }`}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              {selectedFile ? (
                <div className="flex items-center gap-2 justify-center">
                  <Icon name="DocumentIcon" size={16} className="text-primary" />
                  <span className="text-xs font-semibold text-foreground truncate max-w-[220px]">{selectedFile.name}</span>
                  <span className="text-xs text-muted-foreground">({formatFileSize(selectedFile.size)})</span>
                </div>
              ) : (
                <div>
                  <Icon name="CloudArrowUpIcon" size={22} className="text-muted-foreground mx-auto mb-1" />
                  <p className="text-xs text-muted-foreground">{ui.clickChoose}</p>
                  <p className="text-[10px] text-muted-foreground/70">{ui.fileHint}</p>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={handleUpload}
          disabled={uploading || !selectedFile}
          className="mt-4 flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {uploading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              {ui.uploading}
            </>
          ) : (
            <>
              <Icon name="ArrowUpTrayIcon" size={15} />
              {ui.uploadFile}
            </>
          )}
        </button>
      </div>

      {/* Documents List */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex flex-col gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
              <Icon name="FolderOpenIcon" size={16} className="text-blue-600" />
            </div>
            <h3 className="font-bold text-foreground text-sm">
              {ui.uploadedFiles.replace('{count}', String(filteredDocs.length))}
            </h3>
          </div>
          <div className="flex flex-wrap gap-2 w-full">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full sm:w-auto sm:min-w-[160px] max-w-full px-2.5 py-1.5 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none focus:border-primary"
            >
              <option value="">{ui.allTypes}</option>
              {UPLOAD_DOC_TYPES.map((key) => (
                <option key={key} value={key}>
                  {ui[DOC_TYPE_CONFIG[key].labelKey]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="text-center py-8">
            <Icon name="FolderIcon" size={32} className="text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">{ui.empty}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredDocs.map((doc) => {
              const cfg = DOC_TYPE_CONFIG[doc.doc_type] || DOC_TYPE_CONFIG.other;
              return (
                <div
                  key={doc.id}
                  className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl border border-border/50 hover:bg-muted/50 transition-colors"
                >
                  <div className="w-9 h-9 bg-card rounded-lg border border-border flex items-center justify-center shrink-0">
                    <Icon name={cfg.icon as any} size={16} className={cfg.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-foreground text-xs truncate">{doc.file_name}</p>
                      <span
                        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-muted border border-border ${cfg.color}`}
                      >
                        {ui[cfg.labelKey]}
                      </span>
                    </div>
                    {doc.doc_type === 'certificate' && (
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        {doc.cert_sub_type && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                            {certSubTypeLabel(doc)}
                          </span>
                        )}
                        {doc.cert_number && (
                          <span className="text-[10px] text-muted-foreground" dir="ltr">
                            #{doc.cert_number}
                          </span>
                        )}
                        {doc.cert_expiry && (
                          <span className="text-[10px] text-muted-foreground">ينتهي: {doc.cert_expiry}</span>
                        )}
                        {doc.issuing_body && (
                          <span className="text-[10px] text-muted-foreground">{doc.issuing_body}</span>
                        )}
                        {(() => {
                          const m = CERT_STATUS_META[doc.verification_status || 'pending'] || CERT_STATUS_META.pending;
                          return (
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${m.cls}`}>
                              {m.label}
                            </span>
                          );
                        })()}
                      </div>
                    )}
                    {doc.description && (
                      <p className="text-[11px] text-muted-foreground italic">{doc.description}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                      {formatFileSize(doc.file_size)} · {doc.created_at ? doc.created_at.slice(0, 10) : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <a
                      href={doc.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-7 h-7 rounded-lg bg-primary/10 hover:bg-primary/20 flex items-center justify-center transition-colors"
                      title={ui.view}
                    >
                      <Icon name="EyeIcon" size={13} className="text-primary" />
                    </a>
                    <button
                      type="button"
                      onClick={() => handleDelete(doc)}
                      className="w-7 h-7 rounded-lg bg-red-50 hover:bg-red-100 flex items-center justify-center transition-colors"
                      title={ui.delete}
                    >
                      <Icon name="TrashIcon" size={13} className="text-red-500" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
