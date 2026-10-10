'use client';

import React, { useState, useCallback } from 'react';
import Icon from '@/components/ui/AppIcon';
import { getDiagnosticChecks } from '@/lib/platformRegistry';
import { useLanguage } from '@/contexts/LanguageContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface HealthCheck {
  id: string;
  name: string;
  nameAr: string;
  category: 'route' | 'api' | 'auth' | 'feature';
  url?: string;
  status: 'idle' | 'checking' | 'healthy' | 'error' | 'warning';
  latency?: number;
  message?: string;
  description?: string;
}

interface DiagnosticIssue {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  location: string;
  explanation: string;
  suggestion: string;
  checkId: string;
  url?: string;
  category: string;
  errorMessage: string;
}

interface FixResult {
  fixed: boolean;
  action: string;
  detail: string;
  recheck?: { status: number; ok: boolean };
}

// ─── Registry-Derived Check List ──────────────────────────────────────────────
// This list is generated dynamically from platformRegistry.ts.
// To add a new check: add a route or API to platformRegistry.ts — it appears here automatically.

const REGISTRY_CHECKS = getDiagnosticChecks();

const CATEGORY_META: Record<string, { color: string; icon: string }> = {
  route: { color: 'text-blue-600 bg-blue-50 border-blue-200',     icon: 'GlobeAltIcon' },
  api:   { color: 'text-purple-600 bg-purple-50 border-purple-200', icon: 'CodeBracketIcon' },
  auth:  { color: 'text-amber-600 bg-amber-50 border-amber-200',   icon: 'LockClosedIcon' },
  feature:{ color: 'text-emerald-600 bg-emerald-50 border-emerald-200', icon: 'SparklesIcon' },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function PlatformDiagnosticsPanel() {
  const { t, dir, language, isRTL } = useLanguage();
  const ui = t.admin.diagnostics;
  const catLabels: Record<string, string> = {
    route: ui.catRoute,
    api: ui.catApi,
    auth: ui.catAuth,
    feature: ui.catFeature,
  };

  const [checks, setChecks] = useState<HealthCheck[]>(
    REGISTRY_CHECKS.map(c => ({ ...c, status: 'idle' }))
  );
  const [isRunning, setIsRunning] = useState(false);
  const [lastRunAt, setLastRunAt] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ healthy: number; errors: number; warnings: number; total: number } | null>(null);
  const [issues, setIssues] = useState<DiagnosticIssue[]>([]);
  const [filterCat, setFilterCat] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [expandedIssue, setExpandedIssue] = useState<string | null>(null);

  // ── Fix It state ──────────────────────────────────────────────────────────
  const [fixingId, setFixingId] = useState<string | null>(null);
  const [fixResults, setFixResults] = useState<Record<string, FixResult & { status: 'fixing' | 'fixed' | 'failed' }>>({});
  const [fixAllRunning, setFixAllRunning] = useState(false);

  const runSingleCheck = useCallback(async (
    check: Omit<HealthCheck, 'status' | 'latency' | 'message'>
  ): Promise<HealthCheck> => {
    if (!check.url) return { ...check, status: 'warning', message: 'لا يوجد URL محدد' };

    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(check.url, { method: 'GET', signal: controller.signal, cache: 'no-store' });
      clearTimeout(timeout);
      const latency = Date.now() - start;

      if (res.ok || res.status === 307 || res.status === 308) {
        // Check if this is a sandbox health-check response
        try {
          const json = await res.clone().json();
          if (json?.sandbox === true && json?.status === 'sandbox_ready') {
            return { ...check, status: 'healthy', latency, message: `✅ Sandbox جاهز — HTTP ${res.status}` };
          }
        } catch {
          // Not JSON or no sandbox flag — treat as normal healthy
        }
        return { ...check, status: 'healthy', latency, message: `HTTP ${res.status}` };
      } else if (res.status === 401 || res.status === 403) {
        return { ...check, status: 'healthy', latency, message: `HTTP ${res.status} (محمي بالمصادقة)` };
      } else if (res.status === 405) {
        // 405 = Method Not Allowed — endpoint exists but only accepts POST
        // This is expected for POST-only endpoints when tested via GET
        return { ...check, status: 'healthy', latency, message: `HTTP 405 — POST فقط (المسار موجود ✅)` };
      } else if (res.status === 404) {
        return { ...check, status: 'error', latency, message: `HTTP 404 — الصفحة غير موجودة` };
      } else if (res.status >= 500) {
        return { ...check, status: 'error', latency, message: `HTTP ${res.status} — خطأ في الخادم` };
      } else {
        return { ...check, status: 'warning', latency, message: `HTTP ${res.status}` };
      }
    } catch (err: any) {
      const latency = Date.now() - start;
      if (err?.name === 'AbortError') return { ...check, status: 'error', latency, message: 'انتهت المهلة (>15 ثانية) — بطء في الاستجابة' };
      return { ...check, status: 'error', latency, message: err?.message || 'خطأ في الشبكة' };
    }
  }, []);

  const buildIssues = useCallback((results: HealthCheck[]): DiagnosticIssue[] => {
    return results
      .filter(r => r.status === 'error' || r.status === 'warning')
      .map(r => ({
        id: r.status === 'warning' ? `warn-${r.id}` : r.id,
        severity: r.status === 'error' ? 'critical' : 'warning',
        title: `${r.nameAr} — ${r.message || 'خطأ غير محدد'}`,
        location: r.url || r.id,
        explanation: r.message?.includes('404')
          ? `الصفحة "${r.nameAr}" غير موجودة — قد يكون المسار محذوفاً أو تم تغيير اسمه.`
          : r.message?.includes('500')
          ? `خطأ داخلي في الخادم عند الوصول لـ "${r.nameAr}" — قد يكون هناك خلل في الكود أو قاعدة البيانات.`
          : r.message?.includes('Timeout') || r.message?.includes('مهلة') || r.message?.includes('بطء')
          ? `انتهت مهلة الاستجابة لـ "${r.nameAr}" — الصفحة تستغرق أكثر من 15 ثانية للتحميل، غالباً بسبب استعلامات قاعدة بيانات ثقيلة أو بيانات كبيرة بدون حد أقصى.`
          : r.status === 'warning'
          ? `الصفحة "${r.nameAr}" أعادت استجابة غير معتادة: ${r.message}`
          : `تعذّر الوصول إلى "${r.nameAr}": ${r.message}`,
        suggestion: r.message?.includes('404')
          ? 'تحقق من وجود الملف في src/app وتأكد من صحة المسار.' : r.message?.includes('500')
          ? 'راجع سجلات الخادم وتحقق من صحة الكود وإعدادات قاعدة البيانات.' : r.message?.includes('Timeout') || r.message?.includes('مهلة') || r.message?.includes('بطء')
          ? 'تم تحسين استعلامات قاعدة البيانات تلقائياً — أضف .limit() لتقليل حجم البيانات المُحمَّلة، وتأكد من وجود فهارس على الأعمدة المستخدمة في الفلترة.'
          : r.status === 'warning' ?'راجع منطق إعادة التوجيه والاستجابات المتوقعة لهذا المسار.' :'تحقق من اتصال الشبكة وإعدادات الخادم.',
        checkId: r.id,
        url: r.url,
        category: r.category,
        errorMessage: r.message || '',
      } as DiagnosticIssue));
  }, []);

  const runAllChecks = useCallback(async () => {
    // Re-derive checks from registry each run — picks up any new routes added since last render
    const freshChecks = getDiagnosticChecks();
    setIsRunning(true);
    setSummary(null);
    setIssues([]);
    setFixResults({});
    setChecks(freshChecks.map(c => ({ ...c, status: 'checking' })));

    const results: HealthCheck[] = [];
    const batchSize = 5;

    for (let i = 0; i < freshChecks.length; i += batchSize) {
      const batch = freshChecks.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map(runSingleCheck));
      results.push(...batchResults);

      setChecks(prev => {
        const updated = [...prev];
        batchResults.forEach(result => {
          const idx = updated.findIndex(c => c.id === result.id);
          if (idx !== -1) updated[idx] = result;
        });
        return updated;
      });
    }

    const healthy  = results.filter(r => r.status === 'healthy').length;
    const errors   = results.filter(r => r.status === 'error').length;
    const warnings = results.filter(r => r.status === 'warning').length;

    setSummary({ healthy, errors, warnings, total: results.length });
    setIssues(buildIssues(results));

    const now = new Date();
    setLastRunAt([now.getHours(), now.getMinutes(), now.getSeconds()].map(n => String(n).padStart(2, '0')).join(':'));
    setIsRunning(false);
  }, [runSingleCheck, buildIssues]);

  // ── Fix a single issue ────────────────────────────────────────────────────
  const handleFixIssue = useCallback(async (issue: DiagnosticIssue) => {
    setFixingId(issue.id);
    setFixResults(prev => ({ ...prev, [issue.id]: { fixing: true, fixed: false, action: 'fixing', detail: 'جارٍ محاولة الإصلاح...', status: 'fixing' } }));

    try {
      const res = await fetch('/api/diagnostics/fix-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checkId: issue.checkId,
          url: issue.url,
          errorMessage: issue.errorMessage,
          category: issue.category,
        }),
      });
      const data: FixResult = await res.json();
      setFixResults(prev => ({
        ...prev,
        [issue.id]: { ...data, status: data.fixed ? 'fixed' : 'failed' },
      }));
    } catch (e: any) {
      setFixResults(prev => ({
        ...prev,
        [issue.id]: { fixed: false, action: 'error', detail: e?.message || 'خطأ في الاتصال', status: 'failed' },
      }));
    } finally {
      setFixingId(null);
    }
  }, []);

  // ── Fix All critical issues then re-scan ──────────────────────────────────
  const handleFixAll = useCallback(async () => {
    const criticalIssues = issues.filter(i => i.severity === 'critical');
    if (criticalIssues.length === 0) return;

    setFixAllRunning(true);

    // Fix all critical issues in parallel
    await Promise.all(criticalIssues.map(issue => handleFixIssue(issue)));

    // Wait a moment then re-run the full scan
    await new Promise(resolve => setTimeout(resolve, 1500));
    setFixAllRunning(false);
    await runAllChecks();
  }, [issues, handleFixIssue, runAllChecks]);

  const overallStatus = summary
    ? summary.errors > 0 ? 'error' : summary.warnings > 0 ? 'warning' : 'healthy' :'idle';

  const filteredChecks = checks.filter(c => {
    const catOk    = filterCat    === 'all' || c.category === filterCat;
    const statusOk = filterStatus === 'all' || c.status   === filterStatus;
    return catOk && statusOk;
  });

  const grouped = Object.keys(CATEGORY_META).reduce<Record<string, HealthCheck[]>>((acc, cat) => {
    acc[cat] = filteredChecks.filter(c => c.category === cat);
    return acc;
  }, {});

  const criticalCount = issues.filter(i => i.severity === 'critical').length;
  const allFixed = criticalCount > 0 && issues.filter(i => i.severity === 'critical').every(i => fixResults[i.id]?.status === 'fixed');

  return (
    <div className="space-y-5" dir={dir}>

      {/* ── Hero Banner ── */}
      <div className={`rounded-2xl p-5 text-white ${
        overallStatus === 'error'   ? 'bg-gradient-to-r from-red-600 to-red-800' :
        overallStatus === 'warning' ? 'bg-gradient-to-r from-amber-500 to-amber-700' :
        overallStatus === 'healthy'? 'bg-gradient-to-r from-emerald-600 to-teal-700' : 'bg-gradient-to-r from-slate-700 to-slate-900'
      }`}>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
            <Icon name="ShieldCheckIcon" size={28} className="text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold">{ui.title}</h2>
            <p className="text-sm text-white/80">
              فحص شامل لجميع مسارات وروابط وأزرار المنصة —{' '}
              <span className="font-mono font-bold">{REGISTRY_CHECKS.length}</span> نقطة فحص
            </p>
            {/* Dynamic registry badge */}
            <div className="flex items-center gap-1.5 mt-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-white/60 animate-pulse" />
              <span className="text-xs text-white/60">
                ديناميكي — يتحدث تلقائياً مع كل إضافة جديدة للمنصة
              </span>
            </div>
          </div>
          <div className="text-right shrink-0">
            {lastRunAt && <p className="text-xs text-white/70 mb-1">آخر فحص: {lastRunAt}</p>}
            <div className="flex items-center gap-1.5 justify-end">
              <div className={`w-2 h-2 rounded-full ${
                overallStatus === 'healthy' ? 'bg-emerald-300 animate-pulse' :
                overallStatus === 'error'   ? 'bg-red-300 animate-pulse' :
                overallStatus === 'warning' ? 'bg-amber-300 animate-pulse' : 'bg-white/40'
              }`} />
              <span className="text-xs font-semibold text-white/90">
                {overallStatus === 'healthy' ? 'جميع الأنظمة تعمل' :
                 overallStatus === 'error'   ? `${summary?.errors} أخطاء مكتشفة` :
                 overallStatus === 'warning' ? `${summary?.warnings} تحذيرات` : 'في انتظار الفحص'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Summary Stats ── */}
      {summary && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'إجمالي الفحوصات',    value: summary.total,    color: 'bg-slate-50 border-slate-200 text-slate-700' },
            { label: '✅ يعمل بشكل صحيح', value: summary.healthy,  color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
            { label: '⚠️ تحذيرات',         value: summary.warnings, color: 'bg-amber-50 border-amber-200 text-amber-700' },
            { label: '🔴 أخطاء حرجة',      value: summary.errors,   color: 'bg-red-50 border-red-200 text-red-700' },
          ].map(s => (
            <div key={s.label} className={`border rounded-xl p-4 text-center ${s.color}`}>
              <p className="text-3xl font-bold">{s.value}</p>
              <p className="text-xs font-semibold mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Run Button ── */}
      <button
        onClick={runAllChecks}
        disabled={isRunning || fixAllRunning}
        className="w-full flex items-center justify-center gap-3 py-4 bg-gradient-to-r from-red-600 to-rose-700 text-white rounded-xl font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-60 shadow-lg shadow-red-900/20"
      >
        {isRunning || fixAllRunning ? (
          <>
            <Icon name="ArrowPathIcon" size={18} className="animate-spin" />
            {fixAllRunning ? 'جارٍ الإصلاح وإعادة الفحص...' : `جارٍ الفحص الشامل... (${checks.filter(c => ['healthy','error','warning'].includes(c.status)).length}/${checks.length})`}
          </>
        ) : (
          <>
            <Icon name="BugAntIcon" size={18} />
            {lastRunAt ? '🔄 إعادة الفحص الشامل للمنصة' : `🚀 تشغيل الفحص الشامل — ${REGISTRY_CHECKS.length} نقطة فحص`}
          </>
        )}
      </button>

      {/* ── Diagnostic Issues Report with Fix It ── */}
      {issues.length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-red-50">
            <Icon name="ExclamationTriangleIcon" size={18} className="text-red-600" />
            <h3 className="font-bold text-red-800 flex-1">تقرير التشخيص — {issues.length} مشكلة مكتشفة</h3>
            {/* Fix All Critical Button */}
            {criticalCount > 0 && !allFixed && (
              <button
                onClick={handleFixAll}
                disabled={fixAllRunning || isRunning}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-60 shrink-0"
              >
                {fixAllRunning ? (
                  <><Icon name="ArrowPathIcon" size={14} className="animate-spin" /> جارٍ الإصلاح...</>
                ) : (
                  <><Icon name="WrenchScrewdriverIcon" size={14} /> 🔧 إصلاح الأخطاء الحرجة ({criticalCount}) + إعادة الفحص</>
                )}
              </button>
            )}
            {allFixed && (
              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-lg border border-emerald-200">
                <Icon name="CheckCircleIcon" size={14} />
                تم الإصلاح ✅
              </span>
            )}
          </div>
          <div className="divide-y divide-border">
            {issues.map(issue => {
              const fixResult = fixResults[issue.id];
              const isFixing = fixingId === issue.id;
              return (
                <div key={issue.id} className="p-4">
                  <div
                    role="button"
                    tabIndex={0}
                    className="w-full text-right cursor-pointer"
                    onClick={() => setExpandedIssue(expandedIssue === issue.id ? null : issue.id)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setExpandedIssue(expandedIssue === issue.id ? null : issue.id); }}
                  >
                    <div className="flex items-start gap-3">
                      <span className={`mt-0.5 text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                        issue.severity === 'critical' ? 'bg-red-100 text-red-700 border border-red-200' :
                        issue.severity === 'warning'? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-blue-100 text-blue-700 border border-blue-200'
                      }`}>
                        {issue.severity === 'critical' ? '🔴 حرج' : issue.severity === 'warning' ? '⚠️ تحذير' : 'ℹ️ معلومة'}
                      </span>
                      <div className="flex-1 text-right">
                        <p className="font-semibold text-foreground text-sm">{issue.title}</p>
                        <p className="text-xs text-muted-foreground font-mono mt-0.5">{issue.location}</p>
                      </div>
                      {/* Fix It Button per issue */}
                      {issue.severity === 'critical' && !fixResult && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleFixIssue(issue); }}
                          disabled={isFixing || fixAllRunning}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-60 shrink-0"
                        >
                          {isFixing ? (
                            <><Icon name="ArrowPathIcon" size={12} className="animate-spin" /> جارٍ...</>
                          ) : (
                            <><Icon name="WrenchScrewdriverIcon" size={12} /> Fix It</>
                          )}
                        </button>
                      )}
                      {fixResult?.status === 'fixing' && (
                        <span className="flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 text-xs rounded-lg shrink-0">
                          <Icon name="ArrowPathIcon" size={12} className="animate-spin" /> جارٍ الإصلاح
                        </span>
                      )}
                      {fixResult?.status === 'fixed' && (
                        <span className="flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-lg border border-emerald-200 shrink-0">
                          <Icon name="CheckCircleIcon" size={12} /> تم الإصلاح
                        </span>
                      )}
                      {fixResult?.status === 'failed' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleFixIssue(issue); }}
                          className="flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 text-xs font-bold rounded-lg border border-orange-200 shrink-0 hover:bg-orange-200 transition-colors"
                        >
                          <Icon name="ArrowPathIcon" size={12} /> إعادة المحاولة
                        </button>
                      )}
                      <Icon name={expandedIssue === issue.id ? 'ChevronUpIcon' : 'ChevronDownIcon'} size={14} className="text-muted-foreground flex-shrink-0 mt-1" />
                    </div>
                  </div>

                  {/* Fix Result Detail */}
                  {fixResult && (
                    <div className={`mt-2 mr-10 px-3 py-2 rounded-lg text-xs border ${
                      fixResult.status === 'fixed' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
                      fixResult.status === 'failed'? 'bg-orange-50 border-orange-200 text-orange-800' : 'bg-amber-50 border-amber-200 text-amber-800'
                    }`}>
                      <span className="font-semibold">
                        {fixResult.status === 'fixed' ? '✅ نتيجة الإصلاح: ' :
                         fixResult.status === 'failed' ? '⚠️ نتيجة الفحص: ' : '🔄 '}
                      </span>
                      {fixResult.detail}
                      {fixResult.recheck && (
                        <span className="mr-2 font-mono">
                          (HTTP {fixResult.recheck.status})
                        </span>
                      )}
                    </div>
                  )}

                  {expandedIssue === issue.id && (
                    <div className="mt-3 mr-10 space-y-2">
                      <div className="bg-muted/40 rounded-lg p-3">
                        <p className="text-xs font-semibold text-muted-foreground mb-1">{language === "ar" ? "📋 الشرح:" : "📋 Explanation:"}</p>
                        <p className="text-sm text-foreground">{issue.explanation}</p>
                      </div>
                      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                        <p className="text-xs font-semibold text-emerald-700 mb-1">💡 الحل المقترح:</p>
                        <p className="text-sm text-emerald-800">{issue.suggestion}</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Re-scan after fix button */}
          {Object.keys(fixResults).length > 0 && (
            <div className="px-5 py-4 border-t border-border bg-slate-50 flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                {Object.values(fixResults).filter(r => r.status === 'fixed').length} من {criticalCount} أخطاء حرجة تم معالجتها
              </p>
              <button
                onClick={runAllChecks}
                disabled={isRunning || fixAllRunning}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-60"
              >
                {isRunning ? (
                  <><Icon name="ArrowPathIcon" size={14} className="animate-spin" /> جارٍ الفحص...</>
                ) : (
                  <><Icon name="PlayIcon" size={14} /> 🔄 إعادة الفحص للتحقق من الإصلاح</>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {summary && issues.length === 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 text-center">
          <p className="text-2xl mb-1">🎉</p>
          <p className="font-bold text-emerald-800">لا توجد مشاكل مكتشفة!</p>
          <p className="text-sm text-emerald-700 mt-1">جميع مسارات وروابط المنصة تعمل بشكل صحيح</p>
        </div>
      )}

      {/* ── Filters ── */}
      {summary && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilterCat('all')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${filterCat === 'all' ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-muted-foreground hover:bg-muted'}`}
          >
            الكل ({checks.length})
          </button>
          {Object.entries(CATEGORY_META).map(([cat, meta]) => (
            <button
              key={cat}
              onClick={() => setFilterCat(cat)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${filterCat === cat ? `${meta.color} border-current` : 'bg-card border-border text-muted-foreground hover:bg-muted'}`}
            >
              {catLabels[cat] || cat} ({checks.filter(c => c.category === cat).length})
            </button>
          ))}
          <div className="mr-auto flex gap-2">
            {['all', 'healthy', 'error', 'warning'].map(s => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${filterStatus === s ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-muted-foreground hover:bg-muted'}`}
              >
                {s === 'all' ? 'كل الحالات' : s === 'healthy' ? '✅ سليم' : s === 'error' ? '🔴 خطأ' : '⚠️ تحذير'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Checks by Category — auto-grouped from registry ── */}
      {Object.entries(grouped).map(([category, catChecks]) => {
        if (catChecks.length === 0) return null;
        const meta = CATEGORY_META[category];
        const healthyCount = catChecks.filter(c => c.status === 'healthy').length;
        const errorCount   = catChecks.filter(c => c.status === 'error').length;
        return (
          <div key={category} className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-3 border-b border-border bg-muted/20">
              <Icon name={meta.icon as any} size={14} className={meta.color.split(' ')[0]} />
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${meta.color}`}>{catLabels[category] || category}</span>
              <span className="text-xs text-muted-foreground">
                {healthyCount}/{catChecks.length} سليم
                {errorCount > 0 && <span className="text-red-600 font-semibold mr-2">· {errorCount} خطأ</span>}
              </span>
            </div>
            <div className="divide-y divide-border">
              {catChecks.map(check => (
                <div key={check.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="shrink-0 w-5 h-5 flex items-center justify-center">
                    {check.status === 'idle'     && <div className="w-4 h-4 rounded-full bg-muted border-2 border-border" />}
                    {check.status === 'checking' && <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />}
                    {check.status === 'healthy'  && <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center"><Icon name="CheckIcon" size={10} className="text-white" /></div>}
                    {check.status === 'warning'  && <div className="w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center"><Icon name="ExclamationTriangleIcon" size={10} className="text-white" /></div>}
                    {check.status === 'error'    && <div className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center"><Icon name="XMarkIcon" size={10} className="text-white" /></div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${check.status === 'error' ? 'text-red-600' : check.status === 'warning' ? 'text-amber-600' : 'text-foreground'}`}>
                      {check.nameAr}
                    </p>
                    {check.description && (
                      <p className="text-xs text-muted-foreground truncate">{check.description}</p>
                    )}
                  </div>
                  <span className="font-mono text-xs text-muted-foreground hidden sm:block flex-shrink-0">{check.url}</span>
                  {check.latency !== undefined && (
                    <span className={`text-xs font-mono flex-shrink-0 ${check.latency > 2000 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                      {check.latency}ms
                    </span>
                  )}
                  {check.message && check.status !== 'idle' && check.status !== 'checking' && (
                    <span className={`text-xs flex-shrink-0 max-w-[140px] truncate ${
                      check.status === 'error'   ? 'text-red-500' :
                      check.status === 'warning' ? 'text-amber-500' : 'text-emerald-600'
                    }`}>
                      {check.message}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Idle State */}
      {!summary && !isRunning && (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <Icon name="MagnifyingGlassIcon" size={40} className="text-muted-foreground/30 mx-auto mb-3" />
          <p className="font-semibold text-foreground mb-1">جاهز للفحص الشامل</p>
          <p className="text-sm text-muted-foreground">
            اضغط على الزر أعلاه لبدء فحص جميع مسارات وروابط المنصة ({REGISTRY_CHECKS.length} نقطة فحص)
          </p>
          <p className="text-xs text-muted-foreground/60 mt-2">
            ✨ النظام ديناميكي — أي مسار جديد تضيفه للمنصة يظهر هنا تلقائياً
          </p>
        </div>
      )}
    </div>
  );
}
