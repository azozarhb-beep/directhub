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

// ─── Main Panel ───────────────────────────────────────────────────────────────

export default function CustomsValidatorPanel() {
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
  const [validations, setValidations] = useState<CustomsValidation[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState('');
  const [actionLoading, setActionLoading] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from('customs_validations')
      .select('*, user_profiles(full_name, email)')
      .order('created_at', { ascending: false });
    if (filterStatus) q = q.eq('overall_status', filterStatus);
    const { data } = await q;
    setValidations(data || []);
    setLoading(false);
  }, [supabase, filterStatus]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const runAIValidation = async (v: CustomsValidation) => {
    setAiLoading(v.id);
    try {
      // Get order data for matching
      const { data: orderData } = await supabase.from('orders').select('*').eq('id', v.order_id).single();
      const result = await validateCustomsDocumentWithAI(v.document_url, v.document_type, orderData);

      await supabase.from('customs_validations').update({
        format_check_passed: result.formatPassed,
        order_match_passed: result.orderMatchPassed,
        qr_code_detected: result.qrDetected,
        ai_validation_notes: result.notes,
        ai_confidence_score: result.confidence,
        discrepancies: result.discrepancies,
        overall_status: result.status,
        funds_release_blocked: result.status !== 'passed',
      }).eq('id', v.id);

      await fetchData();
      showSuccess('تم التحقق من الوثيقة بالذكاء الاصطناعي');
    } catch (err: any) {
      showSuccess('فشل التحقق: ' + err.message);
    } finally {
      setAiLoading('');
    }
  };

  const adminOverride = async (id: string, pass: boolean) => {
    setActionLoading(id);
    await supabase.from('customs_validations').update({
      overall_status: pass ? 'passed' : 'failed',
      funds_release_blocked: !pass,
      admin_override_at: new Date().toISOString(),
    }).eq('id', id);
    await fetchData();
    showSuccess(pass ? 'تم تجاوز التحقق والموافقة على الإفراج' : 'تم رفض الوثيقة وحظر الإفراج');
    setActionLoading('');
  };

  const blockedCount = validations.filter(v => v.funds_release_blocked).length;
  const passedCount = validations.filter(v => v.overall_status === 'passed').length;
  const pendingCount = validations.filter(v => v.overall_status === 'pending').length;

  return (
    <div className="space-y-5" dir={dir}>
      <div className="bg-gradient-to-r from-teal-600 to-teal-800 rounded-2xl p-5 text-white">
        <h2 className="text-lg font-bold">{ui.title}</h2>
        <p className="text-sm text-white/80 mt-1">{ui.subtitle}</p>
      </div>
      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: ui.releaseBlocked, value: blockedCount, color: 'text-red-600 bg-red-50', icon: 'LockClosedIcon' },
          { label: ui.passed, value: passedCount, color: 'text-emerald-600 bg-emerald-50', icon: 'CheckCircleIcon' },
          { label: ui.pending, value: pendingCount, color: 'text-amber-600 bg-amber-50', icon: 'ClockIcon' },
          { label: ui.totalDocs, value: validations.length, color: 'text-blue-600 bg-blue-50', icon: 'DocumentTextIcon' },
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

      {/* Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        {['', 'pending', 'passed', 'failed', 'needs_review'].map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${filterStatus === s ? 'bg-primary text-white border-primary' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}
          >
            {s === '' ? t.admin.all : (s === 'pending' ? ui.pending : s === 'passed' ? ui.passed : s === 'failed' ? ui.failed : s === 'needs_review' ? ui.needsReview : STATUS_CONFIG[s]?.label || s)}
          </button>
        ))}
      </div>

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl px-4 py-3 text-sm flex items-center gap-2">
          <Icon name="CheckCircleIcon" size={16} />
          {successMsg}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : validations.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Icon name="DocumentCheckIcon" size={40} className="mx-auto mb-3 opacity-30" />
          <p>{ui.emptyReview}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {validations.map(v => {
            const statusCfg = STATUS_CONFIG[v.overall_status] || STATUS_CONFIG.pending;
            return (
              <div key={v.id} className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-semibold text-gray-900 text-sm">{DOC_TYPE_LABELS[v.document_type] || v.document_type}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${statusCfg.color}`}>
                        {statusLabels[v.overall_status] || statusCfg.label}
                      </span>
                      {v.funds_release_blocked && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200 flex items-center gap-1">
                          <Icon name="LockClosedIcon" size={11} />
                          {ui.blockedBadge}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2 mb-2">
                      <div className={`flex items-center gap-1 text-xs ${v.format_check_passed ? 'text-emerald-600' : 'text-gray-400'}`}>
                        <Icon name={v.format_check_passed ? 'CheckCircleIcon' : 'MinusCircleIcon'} size={13} />
                        {ui.formatCheck}
                      </div>
                      <div className={`flex items-center gap-1 text-xs ${v.qr_code_detected ? 'text-emerald-600' : 'text-gray-400'}`}>
                        <Icon name={v.qr_code_detected ? 'CheckCircleIcon' : 'MinusCircleIcon'} size={13} />
                        {ui.qrCode}
                      </div>
                      <div className={`flex items-center gap-1 text-xs ${v.order_match_passed ? 'text-emerald-600' : 'text-gray-400'}`}>
                        <Icon name={v.order_match_passed ? 'CheckCircleIcon' : 'MinusCircleIcon'} size={13} />
                        مطابقة الطلب
                      </div>
                    </div>
                    {v.ai_validation_notes && (
                      <p className="text-xs text-gray-600 bg-gray-50 rounded px-2 py-1.5 mb-2">{v.ai_validation_notes}</p>
                    )}
                    {v.discrepancies && Array.isArray(v.discrepancies) && v.discrepancies.length > 0 && (
                      <div className="space-y-1 mb-2">
                        {v.discrepancies.map((d: string, i: number) => (
                          <div key={i} className="flex items-center gap-1.5 text-xs text-orange-700 bg-orange-50 rounded px-2 py-1">
                            <Icon name="ExclamationTriangleIcon" size={12} />
                            {d}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <a href={v.document_url} target="_blank" rel="noopener noreferrer"
                      className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1.5 rounded-lg hover:bg-blue-100 flex items-center gap-1">
                      <Icon name="EyeIcon" size={12} />
                      عرض
                    </a>
                    {v.overall_status === 'pending' && (
                      <button
                        onClick={() => runAIValidation(v)}
                        disabled={aiLoading === v.id}
                        className="text-xs bg-teal-600 text-white px-2.5 py-1.5 rounded-lg hover:bg-teal-700 disabled:opacity-50 flex items-center gap-1"
                      >
                        {aiLoading === v.id ? <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" /> : <Icon name="SparklesIcon" size={12} />}
                        تحقق AI
                      </button>
                    )}
                    {v.overall_status !== 'passed' && (
                      <button
                        onClick={() => adminOverride(v.id, true)}
                        disabled={!!actionLoading}
                        className="text-xs bg-emerald-600 text-white px-2.5 py-1.5 rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1"
                      >
                        <Icon name="CheckIcon" size={12} />
                        تجاوز وموافقة
                      </button>
                    )}
                    {v.overall_status === 'passed' && (
                      <button
                        onClick={() => adminOverride(v.id, false)}
                        disabled={!!actionLoading}
                        className="text-xs bg-red-600 text-white px-2.5 py-1.5 rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-1"
                      >
                        <Icon name="LockClosedIcon" size={12} />
                        حظر الإفراج
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
