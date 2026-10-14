'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';
import toast from 'react-hot-toast';
import {
  uploadLogisticsFile,
  LOGISTICS_MAX_FILE_BYTES,
  LOGISTICS_UPLOAD_BUCKET,
} from '@/lib/logisticsUpload';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LogisticsDocument {
  id: string;
  partner_id: string;
  shipment_id: string | null;
  document_type: string;
  file_name: string;
  file_url: string;
  file_size: number;
  tracking_number: string | null;
  status: 'pending_review' | 'approved' | 'rejected';
  created_at: string;
}

const DOCUMENT_TYPE_OPTIONS = [
  { value: 'bill_of_lading',        label: 'بوليصة الشحن (Bill of Lading / AWB)' },
  { value: 'commercial_invoice',    label: 'الفاتورة التجارية (Commercial Invoice)' },
  { value: 'packing_list',          label: 'قائمة التعبئة (Packing List)' },
  { value: 'certificate_of_origin', label: 'شهادة المنشأ (Certificate of Origin)' },
  { value: 'inspection_cert',       label: 'شهادة المطابقة / التفتيش (SASO / CoC)' },
  { value: 'customs_declaration',   label: 'البيان الجمركي (Customs Declaration)' },
];

const DOC_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  DOCUMENT_TYPE_OPTIONS.map(o => [o.value, o.label])
);

const STATUS_META: Record<string, { label: string; color: string; icon: string }> = {
  pending_review: { label: 'قيد المراجعة', color: 'bg-amber-50 text-amber-700 border-amber-200',   icon: 'ClockIcon' },
  approved:       { label: 'معتمد',         color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: 'CheckBadgeIcon' },
  rejected:       { label: 'مرفوض',         color: 'bg-red-50 text-red-700 border-red-200',         icon: 'XCircleIcon' },
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ar-YE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString('ar-YE', { year: 'numeric', month: 'short', day: 'numeric' })} • ${d.toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' })}`;
}

function isImageDoc(doc: { file_url: string; file_name: string }): boolean {
  const target = `${doc.file_name || ''} ${doc.file_url || ''}`;
  return /\.(jpe?g|png|webp|gif|bmp|svg|avif|heic|heif)(\s|\?|$)/i.test(target);
}

// ─── Upload Modal ─────────────────────────────────────────────────────────────

function UploadModal({
  userId,
  onClose,
  onUploaded,
}: {
  userId: string;
  onClose: () => void;
  onUploaded: (doc: LogisticsDocument) => void | Promise<void>;
}) {
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [docType, setDocType] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const isImageFile = (f: File | null) =>
    !!f && (f.type.startsWith('image/') || /\.(jpe?g|png|webp|gif)$/i.test(f.name));

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const input = e.target;
    const f = input.files?.[0];
    if (!f) return;
    if (f.size > LOGISTICS_MAX_FILE_BYTES) {
      setError('حجم الملف يتجاوز الحد المسموح (25 MB)');
      return;
    }
    setFile(f);
    setPreviewUrl(isImageFile(f) ? URL.createObjectURL(f) : null);
    setError(null);
    // Reset AFTER the File reference has been stored in state
    try {
      input.value = '';
    } catch {
      /* ignore */
    }
  };

  const clearFile = () => {
    setFile(null);
    setPreviewUrl(null);
  };

  const handleUpload = async () => {
    if (uploading) return;
    if (!file) {
      setError('يرجى تحديد ملف أو صورة أولاً');
      toast.error('يرجى تحديد ملف أو صورة أولاً');
      return;
    }
    if (!docType) {
      setError('يرجى اختيار نوع المستند');
      toast.error('يرجى اختيار نوع المستند');
      return;
    }

    setUploading(true);
    setError(null);
    setProgress(10);

    try {
      setProgress(30);

      // Same upload flow as the chat: resolve MIME, upload to chat-media, get public URL
      const uploaded = await uploadLogisticsFile(file, userId, 'logistics-docs');

      setProgress(85);

      // Insert record into logistics_documents
      const { data: docData, error: insertError } = await supabase
        .from('logistics_documents')
        .insert({
          partner_id: userId,
          document_type: docType,
          file_name: uploaded.fileName,
          file_url: uploaded.publicUrl,
          storage_path: uploaded.storagePath,
          file_size: uploaded.fileSize,
          tracking_number: trackingNumber.trim() || null,
          status: 'pending_review',
        })
        .select()
        .single();

      // Keep the modal OPEN on any failure and show the exact error
      if (insertError || !docData) {
        const msg = `فشل حفظ بيانات المستند: ${insertError?.message || 'لم يتم إرجاع سجل من قاعدة البيانات'}`;
        setError(msg);
        toast.error(msg, { duration: 8000 });
        return;
      }

      setProgress(100);
      toast.success('تم رفع المستند بنجاح');
      // Only now (insert confirmed) update the list and close
      await onUploaded(docData as LogisticsDocument);
      onClose();
    } catch (err: any) {
      const msg = err?.message || 'حدث خطأ غير متوقع أثناء الرفع';
      setError(msg);
      toast.error(msg, { duration: 8000 });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={(e) => e.stopPropagation()}
      onSubmit={(e) => e.preventDefault()}
    >
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl max-h-[95vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-cyan-500/20 rounded-lg flex items-center justify-center">
              <Icon name="ArrowUpTrayIcon" size={16} className="text-cyan-400" />
            </div>
            <h3 className="text-base font-bold text-white">رفع مستند جمركي</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            <Icon name="XMarkIcon" size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Document Type */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              نوع المستند <span className="text-red-400">*</span>
            </label>
            <select
              value={docType}
              onChange={e => setDocType(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-800 border border-slate-600 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="">-- اختر نوع المستند --</option>
              {DOCUMENT_TYPE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Tracking Number (optional) */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              رقم الشحنة أو الحاوية المرتبطة (اختياري)
            </label>
            <input
              type="text"
              value={trackingNumber}
              onChange={e => setTrackingNumber(e.target.value)}
              placeholder="مثال: CONT-2024-001234 أو TRK-2024-001"
              className="w-full px-3 py-2.5 bg-slate-800 border border-slate-600 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          {/* File Upload — same paperclip button + input pattern as the admin support chat */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              الملف <span className="text-red-400">*</span>
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              onChange={handleFileChange}
              className="hidden"
            />
            <div
              className={`w-full border-2 border-dashed rounded-xl p-3 transition-colors ${
                file ? 'border-cyan-500 bg-cyan-500/10' : 'border-slate-600 bg-slate-800/50'
              }`}
            >
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  title="إرفاق ملف"
                  aria-label="إرفاق ملف"
                  className="w-10 h-10 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl disabled:opacity-50 transition-colors flex items-center justify-center shrink-0"
                >
                  <Icon name="PaperClipIcon" size={16} />
                </button>

                {file ? (
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {previewUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={previewUrl}
                        alt={`معاينة الملف المحدد ${file.name}`}
                        className="w-10 h-10 rounded-lg object-cover border border-slate-700 shrink-0"
                      />
                    )}
                    <div className="min-w-0 flex-1 text-right">
                      <p className="text-sm font-semibold text-cyan-300 truncate" title={file.name}>{file.name}</p>
                      <p className="text-xs text-slate-400">{formatFileSize(file.size)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={clearFile}
                      disabled={uploading}
                      title="إزالة الملف"
                      aria-label="إزالة الملف"
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-700 transition-colors shrink-0 disabled:opacity-50"
                    >
                      <Icon name="XMarkIcon" size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="flex-1 text-right min-w-0">
                    <p className="text-sm text-slate-300">اضغط على 📎 لاختيار صورة أو ملف PDF</p>
                    <p className="text-xs text-slate-500 mt-0.5">PDF, JPG, PNG, WEBP — حتى 25 MB</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Progress */}
          {uploading && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-slate-400">
                <span>جاري الرفع…</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2">
                <div
                  className="bg-cyan-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
              <Icon name="ExclamationCircleIcon" size={16} className="text-red-400 mt-0.5 shrink-0" />
              <p className="text-xs text-red-300">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 p-5 border-t border-slate-700">
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={handleUpload}
            disabled={uploading || !file}
            title={!file ? 'يرجى تحديد ملف أو صورة أولاً' : undefined}
            className="flex-1 px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {uploading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                جاري الرفع…
              </>
            ) : (
              <>
                <Icon name="ArrowUpTrayIcon" size={15} />
                رفع المستند
              </>
            )}
          </button>
        </div>
        {!file && !uploading && (
          <p className="px-5 pb-4 -mt-2 text-xs text-amber-400 text-center">يرجى تحديد ملف أو صورة أولاً</p>
        )}
      </div>
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export default function LogisticsDocumentsPanel({ userId }: { userId?: string }) {
  const supabase = createClient();
  const [documents, setDocuments] = useState<LogisticsDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  const fetchDocuments = useCallback(async (silent = false) => {
    if (!userId) return;
    if (!silent) setLoading(true);
    setError(null);

    const { data, error: fetchErr } = await supabase
      .from('logistics_documents')
      .select('*')
      .eq('partner_id', userId)
      .order('created_at', { ascending: false });

    if (fetchErr) {
      setError(`فشل تحميل المستندات: ${fetchErr.message}`);
    } else {
      setDocuments((data as LogisticsDocument[]) || []);
    }
    setLoading(false);
  }, [userId, supabase]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleUploaded = async (doc: LogisticsDocument) => {
    // Show the new document immediately, then re-sync with the database
    setDocuments(prev => [doc, ...prev.filter(d => d.id !== doc.id)]);
    setLoading(false);
    await fetchDocuments(true);
  };

  const handleDelete = async (doc: LogisticsDocument) => {
    if (!confirm(`هل تريد حذف المستند "${doc.file_name}"؟`)) return;

    // Extract storage path from file_url (chat-media public URL or legacy private bucket)
    let storagePath = doc.file_url;
    let bucket = LOGISTICS_UPLOAD_BUCKET;
    if (doc.file_url.startsWith('http')) {
      const chatMatch = doc.file_url.match(/\/chat-media\/([^?]+)/);
      const legacyMatch = doc.file_url.match(/logistics-documents\/([^?]+)/);
      if (chatMatch) {
        storagePath = decodeURIComponent(chatMatch[1]);
      } else if (legacyMatch) {
        bucket = 'logistics-documents';
        storagePath = decodeURIComponent(legacyMatch[1]);
      }
    }

    // Delete from storage (best effort)
    await supabase.storage.from(bucket).remove([storagePath]);

    // Delete from database
    const { error: deleteErr } = await supabase
      .from('logistics_documents')
      .delete()
      .eq('id', doc.id);

    if (!deleteErr) {
      setDocuments(prev => prev.filter(d => d.id !== doc.id));
    }
  };

  const getSignedUrl = async (doc: LogisticsDocument) => {
    // If already have a signed URL, use it
    if (signedUrls[doc.id]) {
      window.open(signedUrls[doc.id], '_blank');
      return;
    }

    // Extract storage path from file_url or use file_name fallback
    // The stored URL is a signed URL — open directly
    if (doc.file_url.startsWith('http')) {
      window.open(doc.file_url, '_blank');
      return;
    }

    // Fallback: generate new signed URL from path
    const { data } = await supabase.storage
      .from('logistics-documents')
      .createSignedUrl(doc.file_url, 3600);

    if (data?.signedUrl) {
      setSignedUrls(prev => ({ ...prev, [doc.id]: data.signedUrl }));
      window.open(data.signedUrl, '_blank');
    }
  };

  if (!userId) {
    return (
      <div className="text-center py-12 text-slate-400 text-sm">
        يرجى تسجيل الدخول لعرض المستندات
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Icon name="FolderOpenIcon" size={20} className="text-cyan-400" />
            المستندات الجمركية واللوجستية
          </h2>
          <p className="text-slate-400 text-sm mt-0.5">
            رفع وإدارة وثائق التخليص الجمركي والشحن
          </p>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-sm font-semibold transition-colors"
        >
          <Icon name="PlusIcon" size={16} />
          + رفع مستند جديد
        </button>
      </div>

      {/* Stats Row */}
      {documents.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'إجمالي المستندات', value: documents.length, color: 'text-white', bg: 'bg-slate-800 border-slate-700' },
            { label: 'قيد المراجعة', value: documents.filter(d => d.status === 'pending_review').length, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30' },
            { label: 'معتمدة', value: documents.filter(d => d.status === 'approved').length, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' },
          ].map(stat => (
            <div key={stat.label} className={`rounded-xl border p-3 text-center ${stat.bg}`}>
              <p className={`text-2xl font-black ${stat.color}`}>{stat.value}</p>
              <p className="text-xs text-slate-400 mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
          <Icon name="ExclamationCircleIcon" size={16} className="text-red-400 mt-0.5 shrink-0" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-3">
            <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-slate-400">جاري تحميل المستندات…</p>
          </div>
        </div>
      ) : documents.length === 0 ? (
        /* Empty State */
        <div className="text-center py-16 border-2 border-dashed border-slate-700 rounded-2xl">
          <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Icon name="DocumentArrowUpIcon" size={32} className="text-slate-500" />
          </div>
          <h3 className="text-base font-semibold text-white mb-2">لا توجد وثائق جمركية مرفوعة حالياً</h3>
          <p className="text-sm text-slate-400 mb-6 max-w-sm mx-auto leading-relaxed">
            اضغط أدناه لرفع مستندات الشحنة والتخليص الجمركي
          </p>
          <button
            onClick={() => setShowUpload(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-sm font-semibold transition-colors"
          >
            <Icon name="PlusIcon" size={16} />
            + رفع مستند جديد
          </button>
        </div>
      ) : (
        /* Documents Cards — same visual style as the admin chat media */
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {documents.map(doc => {
            const statusMeta = STATUS_META[doc.status] || STATUS_META.pending_review;
            const docTypeLabel = DOC_TYPE_LABELS[doc.document_type] || doc.document_type;
            const isImage = isImageDoc(doc);
            const linkedId = doc.tracking_number || doc.shipment_id;

            return (
              <div
                key={doc.id}
                className="bg-slate-800/60 border border-slate-700 rounded-2xl overflow-hidden flex flex-col hover:border-cyan-500/40 transition-colors"
              >
                {/* Thumbnail / PDF preview container */}
                <button
                  type="button"
                  onClick={() => getSignedUrl(doc)}
                  className="block w-full bg-slate-900/60 border-b border-slate-700"
                  title="معاينة / فتح"
                >
                  {isImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={doc.file_url}
                      alt={`${docTypeLabel} - ${doc.file_name}`}
                      className="w-full h-44 object-cover"
                    />
                  ) : (
                    <div className="w-full h-44 flex flex-col items-center justify-center gap-2">
                      <div className="w-16 h-16 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-center justify-center">
                        <Icon name="DocumentTextIcon" size={32} className="text-red-400" />
                      </div>
                      <span className="text-xs font-bold text-slate-300 tracking-wide">PDF</span>
                    </div>
                  )}
                </button>

                {/* Details */}
                <div className="p-4 flex-1 flex flex-col gap-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white leading-snug">{docTypeLabel}</p>
                      <p className="text-xs text-slate-400 truncate mt-0.5" title={doc.file_name}>
                        {doc.file_name} • {formatFileSize(doc.file_size || 0)}
                      </p>
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold border shrink-0 ${statusMeta.color}`}>
                      <Icon name={statusMeta.icon as any} size={11} />
                      {statusMeta.label}
                    </span>
                  </div>

                  {linkedId && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-300">
                      <Icon name="TruckIcon" size={13} className="text-cyan-400 shrink-0" />
                      <span className="text-slate-500">الشحنة / الحاوية:</span>
                      <span className="font-mono truncate" title={linkedId}>{linkedId}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                    <Icon name="ClockIcon" size={12} className="shrink-0" />
                    {formatDateTime(doc.created_at)}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-auto pt-2">
                    <button
                      type="button"
                      onClick={() => getSignedUrl(doc)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-semibold transition-colors"
                    >
                      <Icon name="EyeIcon" size={14} />
                      معاينة / فتح
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(doc)}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-700 hover:bg-red-600 text-slate-200 hover:text-white rounded-xl text-xs font-semibold transition-colors"
                    >
                      <Icon name="TrashIcon" size={14} />
                      حذف
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Upload Modal */}
      {showUpload && (
        <UploadModal
          userId={userId}
          onClose={() => setShowUpload(false)}
          onUploaded={handleUploaded}
        />
      )}
    </div>
  );
}
