'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getChatCompletion } from '@/lib/ai/chatCompletion';
import Icon from '@/components/ui/AppIcon';
import { useLanguage } from '@/contexts/LanguageContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CustomsValidation {
  id: string;
  order_id: string;
  user_id: string;
  document_type: string;
  document_url: string;
  document_filename: string | null;
  qr_code_detected: boolean;
  format_check_passed: boolean;
  order_match_passed: boolean;
  ai_validation_notes: string | null;
  ai_confidence_score: number | null;
  discrepancies: any;
  overall_status: string;
  funds_release_blocked: boolean;
  created_at: string;
  user_profiles?: { full_name: string; email: string };
}

const DOC_TYPE_LABELS: Record<string, string> = {
  customs_declaration: 'البيان الجمركي',
  bill_of_lading: 'بوليصة الشحن',
  commercial_invoice: 'الفاتورة التجارية',
  packing_list: 'قائمة التعبئة',
  certificate_of_origin: 'شهادة المنشأ',
  other: 'وثيقة أخرى',
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  pending: { label: 'قيد الانتظار', color: 'text-amber-700 bg-amber-50 border-amber-200', icon: 'ClockIcon' },
  processing: { label: 'جارٍ التحقق', color: 'text-blue-700 bg-blue-50 border-blue-200', icon: 'ArrowPathIcon' },
  passed: { label: 'اجتاز التحقق ✓', color: 'text-emerald-700 bg-emerald-50 border-emerald-200', icon: 'CheckCircleIcon' },
  failed: { label: 'فشل التحقق', color: 'text-red-700 bg-red-50 border-red-200', icon: 'XCircleIcon' },
  needs_review: { label: 'يحتاج مراجعة', color: 'text-orange-700 bg-orange-50 border-orange-200', icon: 'ExclamationTriangleIcon' },
};

// ─── AI Customs Validator ─────────────────────────────────────────────────────

async function validateCustomsDocumentWithAI(
  documentUrl: string,
  documentType: string,
  orderData: any
): Promise<{
  formatPassed: boolean;
  orderMatchPassed: boolean;
  qrDetected: boolean;
  notes: string;
  confidence: number;
  discrepancies: string[];
  status: string;
}> {
  const response = await getChatCompletion(
    'GEMINI',
    'gemini/gemini-3.6-flash',
    [
      {
        role: 'system',
        content: `أنت مدقق جمركي ذكي متخصص في التحقق من وثائق الشحن والجمارك. مهمتك:
1. التحقق من صحة صيغة الوثيقة
2. البحث عن رموز QR أو باركود
3. مطابقة بيانات الوثيقة مع بيانات الطلب الأصلي
4. تحديد أي تناقضات أو مخاوف
أجب بصيغة JSON صحيحة.`,
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `تحقق من هذه الوثيقة من نوع "${DOC_TYPE_LABELS[documentType] || documentType}".
بيانات الطلب الأصلي: ${JSON.stringify(orderData || {})}

أجب بـ JSON:
{
  "format_passed": true/false,
  "order_match_passed": true/false,
  "qr_detected": true/false,
  "notes": "ملاحظات التحقق",
  "confidence": 85,
  "discrepancies": ["أي تناقضات"],
  "recommendation": "passed أو failed أو needs_review"
}`,
          },
          {
            type: 'image_url',
            image_url: { url: documentUrl },
          },
        ] as any,
      },
    ],
    { temperature: 0.1, max_tokens: 600 }
  );

  try {
    const content = response.choices[0].message.content;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        formatPassed: parsed.format_passed ?? true,
        orderMatchPassed: parsed.order_match_passed ?? false,
        qrDetected: parsed.qr_detected ?? false,
        notes: parsed.notes || 'تم التحقق من الوثيقة',
        confidence: parsed.confidence || 70,
        discrepancies: parsed.discrepancies || [],
        status: parsed.recommendation || 'needs_review',
      };
    }
  } catch {}
  return { formatPassed: false, orderMatchPassed: false, qrDetected: false, notes: 'فشل التحليل', confidence: 0, discrepancies: [], status: 'needs_review' };
}

// ─── Upload Form ──────────────────────────────────────────────────────────────

export function CustomsDocumentUploader({
  orderId, userId, onUploaded }: { orderId: string; userId: string; onUploaded: () => void }) {
  const { t, dir, language, isRTL } = useLanguage();
  const ui = t.admin.customs;
  const statusLabels: Record<string, string> = {
    pending: ui.pending,
    processing: ui.verifying,
    passed: ui.passed,
    failed: ui.failed,
    needs_review: ui.needsReview,
  };
  const supabase = createClient();
  const [docType, setDocType] = useState('customs_declaration');
  const [docUrl, setDocUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!docUrl.trim()) { setError('يرجى إدخال رابط الوثيقة'); return; }
    setLoading(true);
    setError('');
    try {
      await supabase.from('customs_validations').insert({
        order_id: orderId,
        user_id: userId,
        document_type: docType,
        document_url: docUrl,
        overall_status: 'pending',
        funds_release_blocked: true,
      });
      setDocUrl('');
      onUploaded();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3" dir={dir}>
      <h4 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
        <Icon name="DocumentArrowUpIcon" size={16} className="text-primary" />
        رفع وثيقة جمركية
      </h4>
      <select
        value={docType}
        onChange={e => setDocType(e.target.value)}
        className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-primary"
      >
        {Object.entries(DOC_TYPE_LABELS).map(([k, v]) => (
          <option key={k} value={k}>{v}</option>
        ))}
      </select>
      <input
        value={docUrl}
        onChange={e => setDocUrl(e.target.value)}
        placeholder={ui.docUrlPlaceholder}
        className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-primary"
        dir="ltr"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        onClick={submit}
        disabled={loading}
        className="w-full h-10 bg-primary text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Icon name="ArrowUpTrayIcon" size={15} />}
        رفع للتحقق
      </button>
    </div>
  );
}

// ─── Main Panel (live: logistics_documents) ───────────────────────────────────

interface LogisticsDoc {
  id: string;
  partner_id: string | null;
  document_type: string;
  shipment_id: string | null;
  file_name: string | null;
  file_url: string;
  status: string;
  tracking_number: string | null;
  created_at: string;
  partner_name?: string;
}

type DocTab = 'pending' | 'approved' | 'rejected' | 'all';

const LOGISTICS_DOC_TYPE_LABELS: Record<string, string> = {
  bill_of_lading: 'بوليصة الشحن',
  commercial_invoice: 'الفاتورة التجارية',
  packing_list: 'قائمة التعبئة',
  certificate_of_origin: 'شهادة المنشأ',
  customs_declaration: 'البيان الجمركي',
  inspection_cert: 'شهادة المطابقة / التفتيش',
};

function isPendingStatus(s: string): boolean {
  return s === 'pending_review' || s === 'pending' || s === 'قيد المراجعة';
}
function isApprovedStatus(s: string): boolean {
  return s === 'approved';
}
function isRejectedStatus(s: string): boolean {
  return s === 'rejected';
}
function isImageFileUrl(url: string, name?: string | null): boolean {
  const target = name || url || '';
  return /\.(jpg|jpeg|png|webp|gif|bmp|svg|avif|heic|heif)(\?|$)/i.test(target) || /\.(jpg|jpeg|png|webp|gif|bmp|svg|avif|heic|heif)(\?|$)/i.test(url || '');
}

export default function CustomsValidatorPanel() {
  const { dir } = useLanguage();
  const supabase = createClient();
  const [docs, setDocs] = useState<LogisticsDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionLoading, setActionLoading] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [tab, setTab] = useState<DocTab>('pending');

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setLoadError('');
    const { data, error } = await supabase
      .from('logistics_documents')
      .select('id, partner_id, document_type, shipment_id, file_name, file_url, status, tracking_number, created_at')
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) {
      setLoadError(`فشل تحميل المستندات: ${error.message}`);
      setDocs([]);
      setLoading(false);
      return;
    }

    const rows = (data || []) as LogisticsDoc[];
    const partnerIds = Array.from(new Set(rows.map(r => r.partner_id).filter(Boolean))) as string[];
    let nameMap = new Map<string, string>();
    if (partnerIds.length > 0) {
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, full_name, company_name')
        .in('id', partnerIds);
      nameMap = new Map((profiles || []).map((p: any) => [p.id, p.company_name || p.full_name || '']));
    }
    setDocs(rows.map(r => ({ ...r, partner_name: r.partner_id ? nameMap.get(r.partner_id) || '' : '' })));
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Live updates when a partner uploads / status changes
  useEffect(() => {
    const channel = supabase
      .channel('admin-logistics-documents-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'logistics_documents' }, () => {
        fetchData(true);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase, fetchData]);

  const updateStatus = async (id: string, status: 'approved' | 'rejected') => {
    setActionLoading(id);
    const { error } = await supabase.from('logistics_documents').update({ status }).eq('id', id);
    if (error) {
      showSuccess('فشل تحديث الحالة: ' + error.message);
    } else {
      setDocs(prev => prev.map(d => (d.id === id ? { ...d, status } : d)));
      showSuccess(status === 'approved' ? 'تم اعتماد المستند' : 'تم رفض المستند');
    }
    setActionLoading('');
  };

  const pendingCount = docs.filter(d => isPendingStatus(d.status)).length;
  const approvedCount = docs.filter(d => isApprovedStatus(d.status)).length;
  const rejectedCount = docs.filter(d => isRejectedStatus(d.status)).length;

  const visibleDocs = docs.filter(d => {
    if (tab === 'pending') return isPendingStatus(d.status);
    if (tab === 'approved') return isApprovedStatus(d.status);
    if (tab === 'rejected') return isRejectedStatus(d.status);
    return true;
  });

  const tabs: { key: DocTab; label: string; count: number }[] = [
    { key: 'pending', label: 'قيد الانتظار', count: pendingCount },
    { key: 'approved', label: 'معتمد', count: approvedCount },
    { key: 'rejected', label: 'مرفوض', count: rejectedCount },
    { key: 'all', label: 'الكل', count: docs.length },
  ];

  return (
    <div className="space-y-5" dir={dir}>
      <div className="bg-gradient-to-r from-teal-600 to-teal-800 rounded-2xl p-5 text-white">
        <h2 className="text-lg font-bold">مدقق الجمارك الذكي</h2>
        <p className="text-sm text-white/80 mt-1">مراجعة المستندات الجمركية واللوجستية المرفوعة من الشركاء مباشرةً</p>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'قيد الانتظار', value: pendingCount, color: 'text-amber-600 bg-amber-50', icon: 'ClockIcon' },
          { label: 'معتمد', value: approvedCount, color: 'text-emerald-600 bg-emerald-50', icon: 'CheckCircleIcon' },
          { label: 'مرفوض', value: rejectedCount, color: 'text-red-600 bg-red-50', icon: 'XCircleIcon' },
          { label: 'إجمالي الوثائق', value: docs.length, color: 'text-blue-600 bg-blue-50', icon: 'DocumentTextIcon' },
        ].map((kpi, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-xl p-4">
            <div className={`w-9 h-9 rounded-lg ${kpi.color} flex items-center justify-center mb-2`}>
              <Icon name={kpi.icon as any} size={18} className={kpi.color.split(' ')[0]} />
            </div>
            <div className="text-xl font-bold text-gray-900">{kpi.value}</div>
            <div className="text-xs text-gray-500">{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors flex items-center gap-1.5 ${tab === t.key ? 'bg-primary text-white border-primary' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}
          >
            {t.label}
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${tab === t.key ? 'bg-white/25 text-white' : 'bg-gray-100 text-gray-600'}`}>{t.count}</span>
          </button>
        ))}
        <button
          onClick={() => fetchData()}
          className="text-xs px-3 py-1.5 rounded-full border bg-white text-gray-600 border-gray-200 hover:border-gray-300 flex items-center gap-1"
        >
          <Icon name="ArrowPathIcon" size={12} />
          تحديث
        </button>
      </div>

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl px-4 py-3 text-sm flex items-center gap-2">
          <Icon name="CheckCircleIcon" size={16} />
          {successMsg}
        </div>
      )}

      {loadError && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{loadError}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : visibleDocs.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Icon name="DocumentCheckIcon" size={40} className="mx-auto mb-3 opacity-30" />
          <p>{tab === 'pending' ? 'لا توجد مستندات قيد الانتظار' : 'لا توجد مستندات في هذا القسم'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {visibleDocs.map(d => {
            const isImg = isImageFileUrl(d.file_url, d.file_name);
            const pending = isPendingStatus(d.status);
            const approved = isApprovedStatus(d.status);
            const statusLabel = approved ? 'معتمد' : isRejectedStatus(d.status) ? 'مرفوض' : 'قيد الانتظار';
            const statusColor = approved
              ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
              : isRejectedStatus(d.status)
                ? 'text-red-700 bg-red-50 border-red-200' :'text-amber-700 bg-amber-50 border-amber-200';
            return (
              <div key={d.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col">
                <a
                  href={d.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block h-44 bg-gray-50 flex items-center justify-center overflow-hidden"
                >
                  {isImg ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={d.file_url}
                      alt={d.file_name || LOGISTICS_DOC_TYPE_LABELS[d.document_type] || 'مستند'}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-gray-400">
                      <Icon name="DocumentTextIcon" size={44} />
                      <span className="text-xs">ملف PDF / مستند</span>
                    </div>
                  )}
                </a>
                <div className="p-4 flex-1 flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-gray-900 text-sm">
                      {LOGISTICS_DOC_TYPE_LABELS[d.document_type] || d.document_type}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${statusColor}`}>{statusLabel}</span>
                  </div>
                  {d.partner_name && <p className="text-xs text-gray-600">🚚 {d.partner_name}</p>}
                  {(d.tracking_number || d.shipment_id) && (
                    <p className="text-xs text-gray-500" dir="ltr">
                      Shipment: {d.tracking_number || d.shipment_id}
                    </p>
                  )}
                  {d.file_name && <p className="text-xs text-gray-400 truncate" dir="ltr">{d.file_name}</p>}
                  <p className="text-[11px] text-gray-400">
                    {d.created_at ? new Date(d.created_at).toISOString().slice(0, 16).replace('T', ' ') : ''}
                  </p>
                  <div className="flex items-center gap-2 mt-auto pt-2">
                    <a
                      href={d.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1.5 rounded-lg hover:bg-blue-100 flex items-center gap-1"
                    >
                      <Icon name="EyeIcon" size={12} />
                      معاينة
                    </a>
                    {!approved && (
                      <button
                        onClick={() => updateStatus(d.id, 'approved')}
                        disabled={actionLoading === d.id}
                        className="text-xs bg-emerald-600 text-white px-2.5 py-1.5 rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1"
                      >
                        <Icon name="CheckIcon" size={12} />
                        اعتماد
                      </button>
                    )}
                    {(pending || approved) && (
                      <button
                        onClick={() => updateStatus(d.id, 'rejected')}
                        disabled={actionLoading === d.id}
                        className="text-xs bg-red-600 text-white px-2.5 py-1.5 rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-1"
                      >
                        <Icon name="XMarkIcon" size={12} />
                        رفض
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
