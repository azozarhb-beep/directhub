'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getChatCompletion } from '@/lib/ai/chatCompletion';
import Icon from '@/components/ui/AppIcon';
import { useLanguage } from '@/contexts/LanguageContext';
import TrustScoreBadge from '@/components/TrustScoreBadge';

// ─── Types ────────────────────────────────────────────────────────────────────

interface OCRVerification {
  id: string;
  factory_registration_id: string;
  user_id: string;
  document_url: string;
  document_type: string;
  ocr_raw_text: string | null;
  ai_summary: string | null;
  ai_confidence_score: number | null;
  ai_flags: any;
  pre_approved_card: any;
  status: string;
  trust_level?: string;
  review_reason?: string;
  admin_note: string | null;
  created_at: string;
  user_profiles?: { full_name: string; email: string; company_name: string };
}

const STATUS_META: Record<string, { color: string; icon: string }> = {
  pending: { color: 'text-amber-700 bg-amber-50 border-amber-200', icon: 'ClockIcon' },
  processing: { color: 'text-blue-700 bg-blue-50 border-blue-200', icon: 'ArrowPathIcon' },
  pre_approved: { color: 'text-teal-700 bg-teal-50 border-teal-200', icon: 'SparklesIcon' },
  approved: { color: 'text-emerald-700 bg-emerald-50 border-emerald-200', icon: 'CheckBadgeIcon' },
  rejected: { color: 'text-red-700 bg-red-50 border-red-200', icon: 'XCircleIcon' },
  needs_review: { color: 'text-orange-700 bg-orange-50 border-orange-200', icon: 'ExclamationTriangleIcon' },
  manual_review: { color: 'text-yellow-700 bg-yellow-50 border-yellow-300', icon: 'UserIcon' },
};

const TRUST_META: Record<string, { color: string }> = {
  high:    { color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  medium:  { color: 'text-yellow-700 bg-yellow-50 border-yellow-300' },
  low:     { color: 'text-red-700 bg-red-50 border-red-200' },
  unknown: { color: 'text-gray-500 bg-gray-50 border-gray-200' },
};

// ─── Trust Score Classifier ───────────────────────────────────────────────────

function classifyTrust(confidence: number, flags: string[]): 'high' | 'medium' | 'low' {
  // Structural failures → always low
  if (confidence < 30) return 'low';
  // Medium zone: 30–74 or has flags but not catastrophic
  if (confidence < 75 || flags.length > 0) return 'medium';
  // High: 75+ with no flags
  return 'high';
}

// ─── AI OCR Analysis ──────────────────────────────────────────────────────────

async function analyzeDocumentWithAI(documentUrl: string, documentType: string): Promise<{
  summary: string;
  confidence: number;
  flags: string[];
  preApprovedCard: Record<string, string>;
  trustLevel: 'high' | 'medium' | 'low';
  reviewReason?: string;
  status: string;
}> {
  // Structural check: empty URL = hard reject
  if (!documentUrl || documentUrl.trim() === '') {
    return {
      summary: 'ملف فارغ أو رابط غير صالح — رفض هيكلي',
      confidence: 0,
      flags: ['ملف فارغ'],
      preApprovedCard: {},
      trustLevel: 'low',
      reviewReason: 'ملف فارغ تماماً',
      status: 'rejected',
    };
  }

  const response = await getChatCompletion(
    'GEMINI',
    'gemini/gemini-3.6-flash',
    [
      {
        role: 'system',
        content: `أنت نظام OCR ذكي متخصص في تحليل وثائق التسجيل التجاري. مهمتك:
1. استخراج المعلومات الرئيسية من الوثيقة
2. تحديد درجة الثقة (0-100) بدقة: 
   - 75-100: وثيقة واضحة وكاملة وقابلة للقراءة
   - 40-74: وثيقة جزئية أو بها غموض طفيف
   - 0-39: وثيقة تالفة أو غير مقروءة أو فارغة
3. تحديد أي مخاوف أو نقص طفيف
أجب دائماً بصيغة JSON صحيحة.`,
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `حلل هذه الوثيقة من نوع "${docTypeLabels[documentType] || documentType}". أجب بـ JSON:
{
  "summary": "ملخص الوثيقة",
  "confidence": 85,
  "flags": ["أي مخاوف أو ملاحظات — فارغ إذا لا توجد"],
  "preApprovedCard": {
    "company_name": "اسم الشركة",
    "license_number": "رقم الرخصة",
    "issue_date": "تاريخ الإصدار",
    "expiry_date": "تاريخ الانتهاء",
    "issuing_authority": "جهة الإصدار",
    "business_activity": "النشاط التجاري"
  },
  "review_reason": "سبب الإحالة للمراجعة اليدوية إن وجد"
}`,
          },
          {
            type: 'image_url',
            image_url: { url: documentUrl },
          },
        ] as any,
      },
    ],
    { temperature: 0.2, max_tokens: 1000 }
  );

  try {
    const content = response.choices[0].message.content;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const confidence: number = parsed.confidence || 50;
      const flags: string[] = parsed.flags || [];
      const trustLevel = classifyTrust(confidence, flags);

      // Determine status based on trust level
      let status: string;
      if (trustLevel === 'high') {
        status = 'pre_approved';
      } else if (trustLevel === 'medium') {
        // Yellow zone → manual review, NOT auto-reject
        status = 'manual_review';
      } else {
        // Only structurally broken docs get auto-rejected
        status = 'rejected';
      }

      return {
        summary: parsed.summary || 'تم تحليل الوثيقة',
        confidence,
        flags,
        preApprovedCard: parsed.preApprovedCard || {},
        trustLevel,
        reviewReason: parsed.review_reason || (trustLevel === 'medium' ? 'درجة ثقة متوسطة — تحتاج مراجعة بشرية' : undefined),
        status,
      };
    }
  } catch {}

  // Fallback: unreadable → medium (not auto-reject unless truly structural)
  return {
    summary: 'تعذّر تحليل الوثيقة بشكل كامل',
    confidence: 45,
    flags: ['تعذّر القراءة الكاملة'],
    preApprovedCard: {},
    trustLevel: 'medium',
    reviewReason: 'تعذّر تحليل الوثيقة — تحتاج مراجعة يدوية',
    status: 'manual_review',
  };
}

// ─── Route to Manual Review Queue ────────────────────────────────────────────

async function routeToManualReview(
  supabase: ReturnType<typeof createClient>,
  verif: OCRVerification,
  trustScore: number,
  trustLevel: 'high' | 'medium' | 'low',
  reviewReason: string
) {
  // Check if already in queue
  const { data: existing } = await supabase
    .from('manual_review_queue')
    .select('id')
    .eq('source_type', 'ocr_verification')
    .eq('source_id', verif.id)
    .eq('status', 'pending')
    .maybeSingle();

  if (!existing) {
    await supabase.from('manual_review_queue').insert({
      source_type: 'ocr_verification',
      source_id: verif.id,
      user_id: verif.user_id,
      company_name: verif.user_profiles?.company_name || verif.user_profiles?.full_name || 'غير محدد',
      trust_score: trustScore,
      trust_level: trustLevel,
      review_reason: reviewReason,
      status: 'pending',
    });
  }
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export default function OCRVerificationPanel() {
  const { t, dir, language, isRTL } = useLanguage();
  const ui = t.admin.ocr;
  const docTypeLabels: Record<string, string> = {
    trade_license: ui.tradeLicense,
    tax_certificate: ui.taxCertificate,
    manufacturing_license: ui.manufacturingLicense,
    cr_document: ui.crDocument,
    other: ui.otherDoc,
  };
  const statusLabels: Record<string, string> = {
    pending: ui.pending,
    processing: ui.processing,
    pre_approved: ui.preApproved,
    approved: ui.approved,
    rejected: ui.rejected,
    needs_review: ui.needsReview,
    manual_review: ui.manualReview,
  };
  const trustLabels: Record<string, string> = {
    high: ui.trustHigh,
    medium: ui.trustMedium,
    low: ui.trustLow,
    unknown: ui.trustUnknown,
  };

  const supabase = createClient();
  const [verifications, setVerifications] = useState<OCRVerification[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState('');
  const [actionLoading, setActionLoading] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3500);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from('ocr_license_verifications')
      .select('*, user_profiles(full_name, email, company_name)')
      .order('created_at', { ascending: false });
    if (filterStatus) q = q.eq('status', filterStatus);
    const { data } = await q;
    setVerifications(data || []);
    setLoading(false);
  }, [supabase, filterStatus]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const runAIAnalysis = async (verif: OCRVerification) => {
    setAiLoading(verif.id);
    try {
      const result = await analyzeDocumentWithAI(verif.document_url, verif.document_type);

      await supabase.from('ocr_license_verifications').update({
        ai_summary: result.summary,
        ai_confidence_score: result.confidence,
        ai_flags: result.flags,
        pre_approved_card: result.preApprovedCard,
        trust_level: result.trustLevel,
        review_reason: result.reviewReason || null,
        status: result.status,
      }).eq('id', verif.id);

      // Route medium-confidence to manual review queue (yellow zone)
      if (result.trustLevel === 'medium') {
        await routeToManualReview(
          supabase,
          { ...verif, user_profiles: verif.user_profiles },
          result.confidence,
          result.trustLevel,
          result.reviewReason || 'درجة ثقة متوسطة'
        );
        showSuccess(`🟡 تم إحالة الوثيقة إلى قائمة المراجعة اليدوية (ثقة: ${result.confidence}%)`);
      } else if (result.trustLevel === 'high') {
        showSuccess(`✅ وثيقة عالية الثقة (${result.confidence}%) — موافقة مسبقة`);
      } else {
        showSuccess(`❌ وثيقة تالفة هيكلياً (${result.confidence}%) — رفض تلقائي`);
      }

      await fetchData();
    } catch (err: any) {
      showSuccess('فشل التحليل: ' + err.message);
    } finally {
      setAiLoading('');
    }
  };

  const approveWithOneClick = async (verif: OCRVerification) => {
    setActionLoading(verif.id + 'approve');
    await supabase.from('ocr_license_verifications').update({
      status: 'approved',
      admin_approved_at: new Date().toISOString(),
    }).eq('id', verif.id);
    // Mark any pending queue item as approved
    await supabase.from('manual_review_queue')
      .update({ status: 'approved', reviewed_at: new Date().toISOString() })
      .eq('source_type', 'ocr_verification')
      .eq('source_id', verif.id)
      .eq('status', 'pending');
    if (verif.factory_registration_id) {
      await supabase.from('factory_registrations').update({
        kyc_status: 'approved',
        registration_status: 'approved',
        is_approved: true,
      }).eq('id', verif.factory_registration_id);
    }
    // ── Trigger trust score recalculation via RPC ─────────────────────────
    try {
      await supabase.rpc('update_factory_trust_score', { factory_user_id: verif.user_id });
    } catch {}
    await fetchData();
    showSuccess('✅ تمت الموافقة على الوثيقة وتحديث حالة المصنع ودرجة التوثيق');
    setActionLoading('');
  };

  const rejectVerification = async (id: string) => {
    setActionLoading(id + 'reject');
    await supabase.from('ocr_license_verifications').update({ status: 'rejected' }).eq('id', id);
    await supabase.from('manual_review_queue')
      .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
      .eq('source_type', 'ocr_verification')
      .eq('source_id', id)
      .eq('status', 'pending');
    // ── Trigger trust score recalculation ────────────────────────────────
    const verif = verifications.find(v => v.id === id);
    if (verif?.user_id) {
      try {
        await supabase.rpc('update_factory_trust_score', { factory_user_id: verif.user_id });
      } catch {}
    }
    await fetchData();
    showSuccess('تم رفض الوثيقة وتحديث درجة التوثيق');
    setActionLoading('');
  };

  const pendingCount = verifications.filter(v => v.status === 'pending').length;
  const preApprovedCount = verifications.filter(v => v.status === 'pre_approved').length;
  const manualReviewCount = verifications.filter(v => v.status === 'manual_review').length;
  const approvedCount = verifications.filter(v => v.status === 'approved').length;

  return (
    <div className="space-y-5" dir={dir}>
      <div className="bg-gradient-to-r from-orange-600 to-amber-700 rounded-2xl p-5 text-white">
        <h2 className="text-lg font-bold">{ui.title}</h2>
        <p className="text-sm text-white/80 mt-1">{ui.subtitle}</p>
      </div>
      {/* Trust Score Legend */}
      <div className="bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200 rounded-xl px-4 py-3">
        <div className="flex items-center gap-2 mb-2">
          <Icon name="InformationCircleIcon" size={16} className="text-yellow-600" />
          <span className="text-sm font-semibold text-yellow-800">ui.trustLegendTitle</span>
        </div>
        <div className="flex flex-wrap gap-3 text-xs">
          <span className="flex items-center gap-1.5 text-emerald-700"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> ثقة عالية (75%+): موافقة مسبقة تلقائية</span>
          <span className="flex items-center gap-1.5 text-yellow-700"><span className="w-2.5 h-2.5 rounded-full bg-yellow-400 inline-block" /> ثقة متوسطة (30–74%): إحالة للمراجعة اليدوية</span>
          <span className="flex items-center gap-1.5 text-red-700"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" /> ثقة منخفضة (&lt;30%): رفض تلقائي للملفات التالفة فقط</span>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: ui.pending, value: pendingCount, color: 'text-amber-600 bg-amber-50', icon: 'ClockIcon' },
          { label: ui.manualReview, value: manualReviewCount, color: 'text-yellow-600 bg-yellow-50', icon: 'UserIcon' },
          { label: ui.preApproved, value: preApprovedCount, color: 'text-teal-600 bg-teal-50', icon: 'SparklesIcon' },
          { label: ui.approved, value: approvedCount, color: 'text-emerald-600 bg-emerald-50', icon: 'CheckBadgeIcon' },
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
        {['', 'pending', 'manual_review', 'pre_approved', 'approved', 'rejected', 'needs_review'].map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${filterStatus === s ? 'bg-primary text-white border-primary' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}
          >
            {s === '' ? t.admin.all : statusLabels[s] || s}
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
      ) : verifications.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Icon name="DocumentTextIcon" size={40} className="mx-auto mb-3 opacity-30" />
          <p>{ui.emptyDocs}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {verifications.map(v => {
            const statusCfg = STATUS_META[v.status] || STATUS_META.pending;
            const trustBadge = v.trust_level ? TRUST_META[v.trust_level] : null;
            const isExpanded = expandedId === v.id;
            // ── Derive trust percentage for this verification ──────────────
            const aiScore = v.ai_confidence_score ?? 0;
            // Only show trust percentage if document is approved; failed = 0
            const docTrustPct = v.status === 'approved' ? Math.min(aiScore, 100) : v.status === 'rejected' ? 0 : aiScore;
            const docTier: 'unverified' | 'partial' | 'verified' =
              v.status === 'approved' && aiScore >= 75 ? 'verified'
              : v.status === 'approved' ? 'partial'
              : v.status === 'rejected' ? 'unverified'
              : 'partial';
            return (
              <div key={v.id} className={`bg-white border rounded-xl overflow-hidden ${v.status === 'manual_review' ? 'border-yellow-300' : v.status === 'approved' ? 'border-emerald-200' : 'border-gray-200'}`}>
                <div
                  className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50"
                  onClick={() => setExpandedId(isExpanded ? null : v.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${v.status === 'manual_review' ? 'bg-yellow-50' : v.status === 'approved' ? 'bg-emerald-50' : 'bg-violet-50'}`}>
                      <Icon name={v.status === 'manual_review' ? 'UserIcon' : v.status === 'approved' ? 'CheckBadgeIcon' : 'DocumentTextIcon'} size={16} className={v.status === 'manual_review' ? 'text-yellow-600' : v.status === 'approved' ? 'text-emerald-600' : 'text-violet-600'} />
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900 text-sm">{v.user_profiles?.company_name || v.user_profiles?.full_name}</div>
                      <div className="text-xs text-gray-500">{docTypeLabels[v.document_type] || v.document_type}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    {/* ── Trust Percentage Badge ── */}
                    {v.ai_confidence_score !== null && v.ai_confidence_score !== undefined && (
                      <div className="flex items-center gap-1">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                          v.status === 'rejected' || v.ai_confidence_score === 0 ?'bg-gray-50 text-gray-400 border-gray-200'
                            : v.status === 'approved'&& v.ai_confidence_score >= 75 ?'bg-emerald-50 text-emerald-700 border-emerald-200' :'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          {v.status === 'rejected' ? '0%' : `${v.ai_confidence_score}%`}
                        </span>
                        {v.status === 'approved' && v.ai_confidence_score >= 75 && (
                          <Icon name="CheckBadgeIcon" size={14} className="text-emerald-600" />
                        )}
                      </div>
                    )}
                    {trustBadge && (
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${trustBadge.color}`}>
                        {trustLabels[v.trust_level] || v.trust_level}
                      </span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${statusCfg.color}`}>
                      {statusLabels[v.status] || v.status}
                    </span>
                    <Icon name={isExpanded ? 'ChevronUpIcon' : 'ChevronDownIcon'} size={14} className="text-gray-400" />
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-gray-100 px-5 py-4 space-y-4">
                    {/* ── Trust Score Summary ── */}
                    {v.ai_confidence_score !== null && v.ai_confidence_score !== undefined && (
                      <div className={`rounded-xl p-3 border ${
                        v.status === 'rejected' ?'bg-red-50 border-red-200'
                          : v.status === 'approved'&& v.ai_confidence_score >= 75 ?'bg-emerald-50 border-emerald-200' :'bg-amber-50 border-amber-200'
                      }`}>
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div>
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <Icon name="ShieldCheckIcon" size={14} className={v.status === 'rejected' ? 'text-red-500' : v.status === 'approved' ? 'text-emerald-600' : 'text-amber-600'} />
                              <span className="text-xs font-bold text-gray-800">درجة التوثيق لهذه الوثيقة</span>
                            </div>
                            <p className="text-[11px] text-gray-500">
                              {v.status === 'rejected' ?'❌ فشل الفحص — لا يُمنح أي مستوى توثيق لهذه الوثيقة'
                                : v.status === 'approved'&& v.ai_confidence_score >= 75 ?'✅ وثيقة معتمدة — تساهم في درجة التوثيق الكاملة' :'⚠️ وثيقة جزئية — تساهم جزئياً في درجة التوثيق'}
                            </p>
                          </div>
                          <TrustScoreBadge
                            percentage={v.status === 'rejected' ? 0 : v.ai_confidence_score}
                            tier={v.status === 'rejected' ? 'unverified' : v.status === 'approved' && v.ai_confidence_score >= 75 ? 'verified' : 'partial'}
                            size="sm"
                          />
                        </div>
                      </div>
                    )}

                    {/* Manual Review Notice */}
                    {v.status === 'manual_review' && (
                      <div className="bg-yellow-50 border border-yellow-300 rounded-xl p-3 flex items-start gap-2">
                        <Icon name="ExclamationTriangleIcon" size={16} className="text-yellow-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-yellow-800">{ui.manualReview}</p>
                          {v.review_reason && <p className="text-xs text-yellow-700 mt-0.5">{v.review_reason}</p>}
                          <p className="text-xs text-yellow-600 mt-1">يمكنك الموافقة بضغطة زر واحدة أو الرفض أدناه.</p>
                        </div>
                      </div>
                    )}

                    {/* AI Summary */}
                    {v.ai_summary && (
                      <div className="bg-teal-50 border border-teal-200 rounded-xl p-3">
                        <div className="flex items-center gap-2 mb-1.5">
                          <Icon name="SparklesIcon" size={14} className="text-teal-600" />
                          <span className="text-xs font-semibold text-teal-700">تحليل الذكاء الاصطناعي</span>
                        </div>
                        <p className="text-sm text-teal-800">{v.ai_summary}</p>
                        {v.ai_flags && Array.isArray(v.ai_flags) && v.ai_flags.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {v.ai_flags.map((flag: string, i: number) => (
                              <div key={i} className="flex items-center gap-1.5 text-xs text-orange-700">
                                <Icon name="ExclamationTriangleIcon" size={12} />
                                {flag}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Pre-approved Card */}
                    {v.pre_approved_card && Object.keys(v.pre_approved_card).length > 0 && (
                      <div className="bg-gray-50 rounded-xl p-3">
                        <div className="text-xs font-semibold text-gray-700 mb-2">بطاقة الملخص المعتمدة مسبقاً</div>
                        <div className="grid grid-cols-2 gap-2">
                          {Object.entries(v.pre_approved_card).map(([key, val]) => (
                            <div key={key}>
                              <span className="text-xs text-gray-500">{key}: </span>
                              <span className="text-xs font-medium text-gray-800">{String(val)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <a href={v.document_url} target="_blank" rel="noopener noreferrer"
                        className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-100 flex items-center gap-1">
                        <Icon name="EyeIcon" size={13} />
                        عرض الوثيقة
                      </a>
                      {!v.ai_summary && (
                        <button
                          onClick={() => runAIAnalysis(v)}
                          disabled={aiLoading === v.id}
                          className="text-xs bg-teal-600 text-white px-3 py-1.5 rounded-lg hover:bg-teal-700 disabled:opacity-50 flex items-center gap-1"
                        >
                          {aiLoading === v.id ? <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" /> : <Icon name="SparklesIcon" size={13} />}
                          تحليل بالذكاء الاصطناعي
                        </button>
                      )}
                      {(v.status === 'pre_approved' || v.status === 'manual_review' || v.status === 'needs_review' || v.status === 'pending') && (
                        <button
                          onClick={() => approveWithOneClick(v)}
                          disabled={!!actionLoading}
                          className="text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1"
                        >
                          <Icon name="CheckBadgeIcon" size={13} />
                          موافقة بضغطة زر ✓
                        </button>
                      )}
                      {v.status !== 'rejected' && v.status !== 'approved' && (
                        <button
                          onClick={() => rejectVerification(v.id)}
                          disabled={!!actionLoading}
                          className="text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-1"
                        >
                          <Icon name="XMarkIcon" size={13} />
                          رفض
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
