'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';
import { useLanguage } from '@/contexts/LanguageContext';

// ─── IBAN Math Validation ─────────────────────────────────────────────────────

function validateIBAN(iban: string): { valid: boolean; country: string; bankCode: string; checkDigits: string; error?: string; structuralFailure?: boolean } {
  const cleaned = iban.replace(/\s/g, '').toUpperCase();

  // Structural failures: empty or severely short
  if (!cleaned || cleaned.length < 10) {
    return { valid: false, country: '', bankCode: '', checkDigits: '', error: 'IBAN فارغ أو قصير جداً — رفض هيكلي', structuralFailure: true };
  }
  if (cleaned.length < 15 || cleaned.length > 34) {
    return { valid: false, country: '', bankCode: '', checkDigits: '', error: 'طول IBAN غير صحيح', structuralFailure: false };
  }
  const country = cleaned.slice(0, 2);
  const checkDigits = cleaned.slice(2, 4);
  const bankCode = cleaned.slice(4, 8);

  const rearranged = cleaned.slice(4) + cleaned.slice(0, 4);
  const numeric = rearranged.split('').map(c => {
    const code = c.charCodeAt(0);
    return code >= 65 && code <= 90 ? (code - 55).toString() : c;
  }).join('');

  let remainder = 0;
  for (let i = 0; i < numeric.length; i++) {
    remainder = (remainder * 10 + parseInt(numeric[i])) % 97;
  }

  if (remainder !== 1) {
    return { valid: false, country, bankCode, checkDigits, error: 'فشل التحقق الرياضي (mod 97) — IBAN غير صحيح', structuralFailure: false };
  }
  return { valid: true, country, bankCode, checkDigits };
}

// ─── Trust Score for IBAN ─────────────────────────────────────────────────────

function computeIBANTrust(verif: IBANVerification): {
  trustLevel: 'high' | 'medium' | 'low';
  trustScore: number;
  reviewReason?: string;
} {
  // Structural failure: severely short IBAN or math failed on clearly broken input
  const ibanCleaned = (verif.iban || '').replace(/\s/g, '');
  if (ibanCleaned.length < 10) {
    return { trustLevel: 'low', trustScore: 0, reviewReason: 'IBAN فارغ أو قصير جداً — رفض هيكلي' };
  }

  // Math validation failed → not structural but low confidence
  if (!verif.math_validation_passed) {
    return { trustLevel: 'low', trustScore: 10, reviewReason: 'فشل التحقق الرياضي (mod 97)' };
  }

  // Build score
  let score = 50; // base: math passed
  const reasons: string[] = [];

  // Name match score contributes up to 40 points
  const nameScore = verif.ai_name_match_score || 0;
  score += Math.round((nameScore / 100) * 40);
  if (!verif.ai_name_match_passed) {
    reasons.push(`تطابق الاسم ضعيف (${nameScore}%)`);
  }

  // Bank cert adds 10 points
  if (verif.bank_cert_url) score += 5;
  if (verif.bank_cert_ai_verified) score += 5;
  if (!verif.bank_cert_url) reasons.push('شهادة بنكية غير مرفوعة');

  score = Math.min(100, Math.max(0, score));

  if (score >= 75 && verif.ai_name_match_passed) {
    return { trustLevel: 'high', trustScore: score };
  } else if (score >= 35) {
    return {
      trustLevel: 'medium',
      trustScore: score,
      reviewReason: reasons.length > 0 ? reasons.join(' — ') : 'درجة ثقة متوسطة — تحتاج مراجعة بشرية',
    };
  } else {
    return { trustLevel: 'low', trustScore: score, reviewReason: reasons.join(' — ') || 'درجة ثقة منخفضة' };
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface IBANVerification {
  id: string;
  bank_account_id: string;
  user_id: string;
  iban: string;
  iban_country: string;
  math_validation_passed: boolean;
  format_validation_passed: boolean;
  ai_name_match_score: number;
  ai_name_match_passed: boolean;
  ai_name_match_details: string;
  bank_cert_url: string | null;
  bank_cert_filename: string | null;
  bank_cert_ai_verified: boolean;
  bank_cert_ai_notes: string | null;
  overall_status: string;
  trust_level?: string;
  review_reason?: string;
  admin_note: string | null;
  created_at: string;
  user_profiles?: { full_name: string; email: string; company_name: string };
}

const STATUS_META: Record<string, { color: string; icon: string }> = {
  pending: { color: 'text-amber-700 bg-amber-50 border-amber-200', icon: 'ClockIcon' },
  math_failed: { color: 'text-red-700 bg-red-50 border-red-200', icon: 'XCircleIcon' },
  name_mismatch: { color: 'text-orange-700 bg-orange-50 border-orange-200', icon: 'ExclamationTriangleIcon' },
  cert_required: { color: 'text-violet-700 bg-violet-50 border-violet-200', icon: 'DocumentArrowUpIcon' },
  cert_pending_review: { color: 'text-blue-700 bg-blue-50 border-blue-200', icon: 'DocumentTextIcon' },
  manual_review: { color: 'text-yellow-700 bg-yellow-50 border-yellow-300', icon: 'UserIcon' },
  verified: { color: 'text-emerald-700 bg-emerald-50 border-emerald-200', icon: 'ShieldCheckIcon' },
  rejected: { color: 'text-red-700 bg-red-50 border-red-200', icon: 'XMarkIcon' },
};

const TRUST_META: Record<string, { color: string }> = {
  high:    { color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  medium:  { color: 'text-yellow-700 bg-yellow-50 border-yellow-300' },
  low:     { color: 'text-red-700 bg-red-50 border-red-200' },
  unknown: { color: 'text-gray-500 bg-gray-50 border-gray-200' },
};

// ─── IBAN Checker Widget ──────────────────────────────────────────────────────

export function IBANCheckerWidget() {
  const { t, dir, language, isRTL } = useLanguage();
  const ui = t.admin.iban;
  const statusLabels: Record<string, string> = {
    pending: ui.pendingReview,
    math_failed: ui.mathFail,
    name_mismatch: ui.nameMismatch,
    cert_required: ui.certRequired,
    cert_pending_review: ui.certPending,
    manual_review: ui.manualReview,
    verified: ui.verified,
    rejected: ui.rejected,
  };
  const trustLabels: Record<string, string> = {
    high: ui.trustHigh,
    medium: ui.trustMedium,
    low: ui.trustLow,
    unknown: ui.trustUnknown,
  };

  const [iban, setIban] = useState('');
  const [result, setResult] = useState<ReturnType<typeof validateIBAN> | null>(null);

  const check = () => {
    if (!iban.trim()) return;
    setResult(validateIBAN(iban));
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4" dir={dir}>
      <h4 className="font-semibold text-gray-900 text-sm mb-3 flex items-center gap-2">
        <Icon name="CalculatorIcon" size={16} className="text-primary" />
        فاحص IBAN الفوري
      </h4>
      <div className="flex gap-2">
        <input
          value={iban}
          onChange={e => setIban(e.target.value.toUpperCase())}
          placeholder="SA0380000000608010167519"
          className="flex-1 h-10 px-3 rounded-lg border border-gray-300 text-sm font-mono focus:outline-none focus:border-primary"
          dir="ltr"
        />
        <button
          onClick={check}
          className="h-10 px-4 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90"
        >
          فحص
        </button>
      </div>
      {result && (
        <div className={`mt-3 rounded-lg px-3 py-2.5 border text-sm ${result.valid ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : result.structuralFailure ? 'bg-red-50 border-red-300 text-red-800' : 'bg-orange-50 border-orange-200 text-orange-700'}`}>
          <div className="flex items-center gap-2 font-semibold mb-1">
            <Icon name={result.valid ? 'CheckCircleIcon' : 'XCircleIcon'} size={15} />
            {result.valid ? ui.validMath : result.structuralFailure ? ui.structuralFail : ui.invalidNeedsReview}
          </div>
          {result.error && <p className="text-xs">{result.error}</p>}
          {result.valid && (
            <div className="grid grid-cols-3 gap-2 mt-1.5 text-xs">
              <div><span className="text-gray-500">الدولة: </span>{result.country}</div>
              <div><span className="text-gray-500">رمز البنك: </span>{result.bankCode}</div>
              <div><span className="text-gray-500">أرقام التحقق: </span>{result.checkDigits}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export default function IBANVerificationPanel() {
  const { t, dir, language, isRTL } = useLanguage();
  const ui = t.admin.iban;
  const statusLabels: Record<string, string> = {
    pending: ui.pendingReview,
    math_failed: ui.mathFail,
    name_mismatch: ui.nameMismatch,
    cert_required: ui.certRequired,
    cert_pending_review: ui.certPending,
    manual_review: ui.manualReview,
    verified: ui.verified,
    rejected: ui.rejected,
  };
  const trustLabels: Record<string, string> = {
    high: ui.trustHigh,
    medium: ui.trustMedium,
    low: ui.trustLow,
    unknown: ui.trustUnknown,
  };

  const supabase = createClient();
  const [verifications, setVerifications] = useState<IBANVerification[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [selectedVerif, setSelectedVerif] = useState<IBANVerification | null>(null);
  const [adminNote, setAdminNote] = useState('');

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3500);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from('iban_verifications')
      .select('*, user_profiles(full_name, email, company_name)')
      .order('created_at', { ascending: false });
    if (filterStatus) q = q.eq('overall_status', filterStatus);
    const { data } = await q;
    setVerifications(data || []);
    setLoading(false);
  }, [supabase, filterStatus]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-compute trust and route to manual review queue for pending items
  const evaluateAndRoute = async (verif: IBANVerification) => {
    const { trustLevel, trustScore, reviewReason } = computeIBANTrust(verif);

    let newStatus = verif.overall_status;

    // Only update status if still in an undecided state
    if (['pending', 'cert_pending_review', 'name_mismatch', 'cert_required'].includes(verif.overall_status)) {
      if (trustLevel === 'low' && trustScore < 15) {
        // Structural failure only
        newStatus = 'rejected';
      } else if (trustLevel === 'medium') {
        newStatus = 'manual_review';
      }
      // high trust: keep current status (let admin verify)
    }

    // Update trust_level in DB
    await supabase.from('iban_verifications').update({
      trust_level: trustLevel,
      review_reason: reviewReason || null,
      overall_status: newStatus,
    }).eq('id', verif.id);

    // Route medium to manual review queue
    if (trustLevel === 'medium') {
      const { data: existing } = await supabase
        .from('manual_review_queue')
        .select('id')
        .eq('source_type', 'iban_verification')
        .eq('source_id', verif.id)
        .eq('status', 'pending')
        .maybeSingle();

      if (!existing) {
        await supabase.from('manual_review_queue').insert({
          source_type: 'iban_verification',
          source_id: verif.id,
          user_id: verif.user_id,
          company_name: verif.user_profiles?.company_name || verif.user_profiles?.full_name || 'غير محدد',
          trust_score: trustScore,
          trust_level: trustLevel,
          review_reason: reviewReason || 'درجة ثقة متوسطة',
          status: 'pending',
        });
      }
    }

    await fetchData();
    if (trustLevel === 'medium') {
      showSuccess(`🟡 تم إحالة IBAN إلى قائمة المراجعة اليدوية (درجة الثقة: ${trustScore}%)`);
    } else if (trustLevel === 'low' && trustScore < 15) {
      showSuccess(`❌ رفض هيكلي تلقائي — ${reviewReason}`);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    setActionLoading(id + status);
    await supabase.from('iban_verifications').update({
      overall_status: status,
      admin_note: adminNote || null,
      admin_reviewed_at: new Date().toISOString(),
    }).eq('id', id);

    // If verified, unblock payments on bank account
    if (status === 'verified') {
      const verif = verifications.find(v => v.id === id);
      if (verif?.bank_account_id) {
        await supabase.from('factory_bank_accounts').update({
          iban_verified: true,
          iban_verified_at: new Date().toISOString(),
          payment_blocked: false,
          status: 'approved',
        }).eq('id', verif.bank_account_id);
      }
    }

    // Update manual review queue item
    await supabase.from('manual_review_queue')
      .update({ status: status === 'verified' ? 'approved' : 'rejected', reviewed_at: new Date().toISOString() })
      .eq('source_type', 'iban_verification')
      .eq('source_id', id)
      .eq('status', 'pending');

    await fetchData();
    setSelectedVerif(null);
    setAdminNote('');
    showSuccess(status === 'verified' ? '✅ تم توثيق الحساب البنكي وإلغاء حظر المدفوعات' : 'تم تحديث الحالة');
    setActionLoading('');
  };

  const pendingCount = verifications.filter(v => v.overall_status === 'pending' || v.overall_status === 'cert_pending_review').length;
  const manualReviewCount = verifications.filter(v => v.overall_status === 'manual_review').length;
  const verifiedCount = verifications.filter(v => v.overall_status === 'verified').length;
  const blockedCount = verifications.filter(v => !['verified', 'rejected'].includes(v.overall_status)).length;

  return (
    <div className="space-y-5" dir={dir}>
      {/* Trust Score Legend */}
      <div className="bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200 rounded-xl px-4 py-3">
        <div className="flex items-center gap-2 mb-2">
          <Icon name="InformationCircleIcon" size={16} className="text-yellow-600" />
          <span className="text-sm font-semibold text-yellow-800">{ui.trustSystemTitle}</span>
        </div>
        <div className="flex flex-wrap gap-3 text-xs">
          <span className="flex items-center gap-1.5 text-emerald-700"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> ثقة عالية (75%+): توثيق تلقائي جاهز</span>
          <span className="flex items-center gap-1.5 text-yellow-700"><span className="w-2.5 h-2.5 rounded-full bg-yellow-400 inline-block" /> ثقة متوسطة (35–74%): إحالة للمراجعة اليدوية</span>
          <span className="flex items-center gap-1.5 text-red-700"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" /> ثقة منخفضة (&lt;35%): رفض تلقائي للفشل الهيكلي فقط</span>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: ui.pendingReview, value: pendingCount, color: 'text-amber-600 bg-amber-50', icon: 'ClockIcon' },
          { label: ui.manualReview, value: manualReviewCount, color: 'text-yellow-600 bg-yellow-50', icon: 'UserIcon' },
          { label: ui.verified, value: verifiedCount, color: 'text-emerald-600 bg-emerald-50', icon: 'ShieldCheckIcon' },
          { label: ui.paymentsBlocked, value: blockedCount, color: 'text-red-600 bg-red-50', icon: 'LockClosedIcon' },
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

      {/* IBAN Checker */}
      <IBANCheckerWidget />

      {/* Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        {['', 'pending', 'manual_review', 'cert_pending_review', 'verified', 'rejected', 'math_failed', 'name_mismatch'].map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${filterStatus === s ? 'bg-primary text-white border-primary' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}
          >
            {s === '' ? ui.filterAll : statusLabels[s] || s}
          </button>
        ))}
      </div>

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl px-4 py-3 text-sm flex items-center gap-2">
          <Icon name="CheckCircleIcon" size={16} />
          {successMsg}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : verifications.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Icon name="BanknotesIcon" size={40} className="mx-auto mb-3 opacity-30" />
          <p>{ui.emptyQueue}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {verifications.map(v => {
            const statusCfg = STATUS_META[v.overall_status] || STATUS_META.pending;
            const { trustLevel, trustScore } = computeIBANTrust(v);
            const trustBadge = TRUST_META[v.trust_level || trustLevel];
            const isManualReview = v.overall_status === 'manual_review';
            return (
              <div key={v.id} className={`bg-white border rounded-xl p-4 ${isManualReview ? 'border-yellow-300' : 'border-gray-200'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-semibold text-gray-900 text-sm">{v.user_profiles?.company_name || v.user_profiles?.full_name || 'غير محدد'}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${statusCfg.color}`}>
                        <Icon name={statusCfg.icon as any} size={11} className="inline mr-0.5" />
                        {statusLabels[v.overall_status] || v.overall_status}
                      </span>
                      {trustBadge && (
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${trustBadge.color}`}>
                          {trustLabels[v.trust_level || trustLevel] || (v.trust_level || trustLevel)} ({trustScore}%)
                        </span>
                      )}
                    </div>
                    <div className="font-mono text-sm text-gray-700 bg-gray-50 rounded px-2 py-1 mb-2 inline-block" dir="ltr">{v.iban}</div>

                    {/* Manual Review Notice */}
                    {isManualReview && v.review_reason && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 mb-2 flex items-start gap-2">
                        <Icon name="ExclamationTriangleIcon" size={13} className="text-yellow-600 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-yellow-800">{v.review_reason}</p>
                      </div>
                    )}

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                      <div className={`flex items-center gap-1 ${v.math_validation_passed ? 'text-emerald-600' : 'text-red-600'}`}>
                        <Icon name={v.math_validation_passed ? 'CheckCircleIcon' : 'XCircleIcon'} size={13} />
                        التحقق الرياضي
                      </div>
                      <div className={`flex items-center gap-1 ${v.ai_name_match_passed ? 'text-emerald-600' : 'text-orange-600'}`}>
                        <Icon name={v.ai_name_match_passed ? 'CheckCircleIcon' : 'ExclamationTriangleIcon'} size={13} />
                        مطابقة الاسم ({v.ai_name_match_score || 0}%)
                      </div>
                      <div className={`flex items-center gap-1 ${v.bank_cert_url ? 'text-emerald-600' : 'text-amber-600'}`}>
                        <Icon name={v.bank_cert_url ? 'DocumentCheckIcon' : 'DocumentArrowUpIcon'} size={13} />
                        {v.bank_cert_url ? 'شهادة مرفوعة' : 'شهادة مطلوبة'}
                      </div>
                      <div className={`flex items-center gap-1 ${v.bank_cert_ai_verified ? 'text-emerald-600' : 'text-gray-400'}`}>
                        <Icon name="SparklesIcon" size={13} />
                        {v.bank_cert_ai_verified ? 'AI: موثّق' : 'AI: لم يُفحص'}
                      </div>
                    </div>
                    {v.ai_name_match_details && (
                      <p className="text-xs text-gray-500 mt-1.5 bg-gray-50 rounded px-2 py-1">{v.ai_name_match_details}</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {v.bank_cert_url && (
                      <a href={v.bank_cert_url} target="_blank" rel="noopener noreferrer"
                        className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1.5 rounded-lg hover:bg-blue-100 flex items-center gap-1">
                        <Icon name="DocumentTextIcon" size={12} />
                        الشهادة
                      </a>
                    )}
                    {/* Evaluate trust button for pending items */}
                    {['pending', 'cert_pending_review', 'name_mismatch'].includes(v.overall_status) && (
                      <button
                        onClick={() => evaluateAndRoute(v)}
                        disabled={!!actionLoading}
                        className="text-xs bg-yellow-500 text-white px-2.5 py-1.5 rounded-lg hover:bg-yellow-600 disabled:opacity-50 flex items-center gap-1"
                      >
                        <Icon name="ScaleIcon" size={12} />
                        تقييم الثقة
                      </button>
                    )}
                    {v.overall_status !== 'verified' && v.overall_status !== 'rejected' && (
                      <button
                        onClick={() => setSelectedVerif(v)}
                        className="text-xs bg-primary text-white px-2.5 py-1.5 rounded-lg hover:bg-primary/90 flex items-center gap-1"
                      >
                        <Icon name="PencilSquareIcon" size={12} />
                        مراجعة
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Review Modal */}
      {selectedVerif && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0">
            <h3 className="font-bold text-gray-900">{language === "ar" ? "مراجعة توثيق IBAN" : "Review IBAN verification"}</h3>
            <button onClick={() => setSelectedVerif(null)} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center">
              <Icon name="XMarkIcon" size={16} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <div className="bg-gray-50 rounded-xl p-3 font-mono text-sm" dir="ltr">{selectedVerif.iban}</div>
            {selectedVerif.overall_status === 'manual_review' && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-sm text-yellow-800">
                <Icon name="ExclamationTriangleIcon" size={14} className="inline mr-1 text-yellow-600" />
                هذا الطلب في قائمة المراجعة اليدوية. يمكنك الموافقة بضغطة زر واحدة.
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">ملاحظة المدير (اختياري)</label>
              <textarea
                value={adminNote}
                onChange={e => setAdminNote(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-primary resize-none"
                placeholder="أضف ملاحظة..."
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => updateStatus(selectedVerif.id, 'verified')}
                disabled={!!actionLoading}
                className="h-11 bg-emerald-600 text-white rounded-xl font-semibold text-sm hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Icon name="ShieldCheckIcon" size={16} />
                توثيق وإلغاء الحظر ✓
              </button>
              <button
                onClick={() => updateStatus(selectedVerif.id, 'rejected')}
                disabled={!!actionLoading}
                className="h-11 bg-red-600 text-white rounded-xl font-semibold text-sm hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Icon name="XMarkIcon" size={16} />
                رفض
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
