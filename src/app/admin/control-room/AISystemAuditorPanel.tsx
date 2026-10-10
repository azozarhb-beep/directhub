'use client';

import React, { useState, useCallback } from 'react';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { getChatCompletion } from '@/lib/ai/chatCompletion';
import { useLanguage } from '@/contexts/LanguageContext';

// ─── Types ────────────────────────────────────────────────────────────────────

type SeverityLevel = 'critical' | 'high' | 'medium' | 'low';
type IssueCategory = 'dead_button' | 'missing_subsystem' | 'broken_api' | 'incomplete_workflow' | 'db_error' | 'unhandled_exception';

interface AuditIssue {
  id: string;
  category: IssueCategory;
  severity: SeverityLevel;
  title: string;
  description: string;
  location: string;
  evidence: string;
  rocketPrompt: string;
  copied?: boolean;
}

interface AuditScanResult {
  totalIssues: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  issues: AuditIssue[];
  scanDuration: number;
  scannedAt: string;
}

// ─── Static platform manifest (what we know about the app) ───────────────────

const PLATFORM_MANIFEST = {
  pages: [
    { path: '/', name: 'الصفحة الرئيسية', components: ['HeroSection', 'FeaturedProducts', 'CategoriesSection', 'RecommendationsSection'] },
    { path: '/buyer-dashboard', name: 'لوحة المشتري', components: ['BuyerDashboard'] },
    { path: '/rfq-board', name: 'لوحة طلبات العروض', components: ['RFQBoard'] },
    { path: '/rfq/create', name: 'إنشاء طلب عرض', components: ['CreateRFQ'] },
    { path: '/cart', name: 'سلة التسوق', components: ['Cart', 'PaymentGatewaySelector'] },
    { path: '/checkout', name: 'الدفع', components: ['Checkout'] },
    { path: '/orders', name: 'الطلبات', components: ['Orders'] },
    { path: '/messaging', name: 'المراسلة', components: ['Chat'] },
    { path: '/manufacturer/dashboard', name: 'لوحة المصنّع', components: ['ManufacturerDashboard'] },
    { path: '/manufacturer/erp', name: 'نظام ERP', components: ['ERP'] },
    { path: '/factory/register', name: 'تسجيل المصنع', components: ['FactoryRegister'] },
    { path: '/kyc', name: 'التحقق من الهوية', components: ['KYC'] },
    { path: '/disputes', name: 'النزاعات', components: ['Disputes'] },
    { path: '/analytics', name: 'التحليلات', components: ['Analytics'] },
    { path: '/financial-accounts', name: 'الحسابات المالية', components: ['FinancialAccounts'] },
    { path: '/logistics', name: 'الخدمات اللوجستية', components: ['Logistics'] },
    { path: '/admin/control-room', name: 'غرفة التحكم', components: ['AdminControlRoom'] },
  ],
  apiRoutes: [
    '/api/ai/chat-completion',
    '/api/ai/factory-assistant',
    '/api/ai/admin-analysis',
    '/api/ai/rfq-routing',
    '/api/ai/partner-verify',
    '/api/ai/translate',
    '/api/quotes/accept',
    '/api/quotes/send',
    '/api/payment/submit',
    '/api/invoices/generate-from-order',
    '/api/whatsapp/send',
    '/api/escrow/otp',
    '/api/escrow/billing-engine',
    '/api/escrow/release-by-code',
    '/api/escrow/admin-payout',
    '/api/escrow/pin',
    '/api/escrow/dispute',
    '/api/escrow/green-light',
    '/api/escrow/delivery-pin',
    '/api/escrow/mark-ready',
    '/api/track-visit',
  ],
  dbTables: [
    'user_profiles', 'factory_registrations', 'products', 'orders', 'order_items',
    'rfq_requests', 'rfq_responses', 'rfq_routing_results', 'supplier_specializations',
    'chat_conversations', 'chat_messages', 'escrow_transactions', 'bank_accounts',
    'disputes', 'notifications', 'reviews', 'cart_items', 'wishlist_items',
    'invoices', 'logistics_partners', 'field_agents', 'visitor_analytics',
    'admin_notifications', 'kyc_documents', 'payment_receipts',
  ],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CATEGORY_META: Record<IssueCategory, { icon: string; color: string }> = {
  dead_button:        { icon: 'CursorArrowRaysIcon',    color: 'text-red-600' },
  missing_subsystem:  { icon: 'PuzzlePieceIcon',        color: 'text-orange-600' },
  broken_api:         { icon: 'ServerStackIcon',        color: 'text-rose-600' },
  incomplete_workflow:{ icon: 'ArrowPathIcon',          color: 'text-amber-600' },
  db_error:           { icon: 'CircleStackIcon',        color: 'text-purple-600' },
  unhandled_exception:{ icon: 'ExclamationTriangleIcon', color: 'text-yellow-600' },
};

const SEVERITY_META: Record<SeverityLevel, { badge: string; dot: string }> = {
  critical: { badge: 'bg-red-100 text-red-700 border border-red-200',     dot: 'bg-red-500' },
  high:     { badge: 'bg-orange-100 text-orange-700 border border-orange-200', dot: 'bg-orange-500' },
  medium:   { badge: 'bg-amber-100 text-amber-700 border border-amber-200',  dot: 'bg-amber-400' },
  low:      { badge: 'bg-slate-100 text-slate-600 border border-slate-200',  dot: 'bg-slate-400' },
};

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AISystemAuditorPanel() {
  const { t, dir, language } = useLanguage();
  const ui = t.admin.aiAuditor;

  const supabase = createClient();

  const [scanState, setScanState] = useState<'idle' | 'scanning' | 'done'>('idle');
  const [scanProgress, setScanProgress] = useState(0);
  const [scanPhase, setScanPhase] = useState('');
  const [result, setResult] = useState<AuditScanResult | null>(null);
  const [filter, setFilter] = useState<'all' | SeverityLevel | IssueCategory>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [dbStats, setDbStats] = useState<Record<string, number>>({});

  // ── Step 1: Probe DB tables ──────────────────────────────────────────────
  const probeDatabase = useCallback(async (): Promise<{ stats: Record<string, number>; errors: string[] }> => {
    const stats: Record<string, number> = {};
    const errors: string[] = [];

    await Promise.all(
      PLATFORM_MANIFEST.dbTables.map(async (table) => {
        try {
          const { count, error } = await supabase
            .from(table)
            .select('*', { count: 'exact', head: true });
          if (error) {
            errors.push(`Table "${table}": ${error.message}`);
            stats[table] = -1;
          } else {
            stats[table] = count ?? 0;
          }
        } catch (e: any) {
          errors.push(`Table "${table}": ${e?.message ?? 'unknown error'}`);
          stats[table] = -1;
        }
      })
    );

    return { stats, errors };
  }, [supabase]);

  // ── Step 2: Probe API routes ─────────────────────────────────────────────
  const probeAPIRoutes = useCallback(async (): Promise<{ reachable: string[]; broken: string[] }> => {
    const reachable: string[] = [];
    const broken: string[] = [];

    await Promise.all(
      PLATFORM_MANIFEST.apiRoutes.map(async (route) => {
        try {
          const res = await fetch(route, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ _probe: true }),
            signal: AbortSignal.timeout(5000),
          });
          // 400/422 = route exists but bad payload (expected), 404/500 = broken
          if (res.status === 404 || res.status === 500) {
            broken.push(`${route} → HTTP ${res.status}`);
          } else {
            reachable.push(route);
          }
        } catch (e: any) {
          if (e?.name === 'TimeoutError') {
            broken.push(`${route} → Timeout`);
          } else {
            broken.push(`${route} → ${e?.message ?? 'fetch failed'}`);
          }
        }
      })
    );

    return { reachable, broken };
  }, []);

  // ── Step 3: Ask Gemini to audit the platform ─────────────────────────────
  const runAIAudit = useCallback(async (
    dbErrors: string[],
    brokenAPIs: string[],
    dbStats: Record<string, number>
  ): Promise<AuditIssue[]> => {
    const emptyTables = Object.entries(dbStats)
      .filter(([, v]) => v === 0)
      .map(([k]) => k);

    const systemPrompt = `You are an expert platform auditor for DirectHub — a B2B manufacturing marketplace built with Next.js 15, TypeScript, Supabase, and Gemini AI.

Your job: perform a comprehensive audit of the entire platform and return a JSON array of issues found.

Platform pages: ${PLATFORM_MANIFEST.pages.map(p => `${p.path} (${p.name})`).join(', ')}

Known DB errors: ${dbErrors.length > 0 ? dbErrors.join('; ') : 'none'}
Broken API routes: ${brokenAPIs.length > 0 ? brokenAPIs.join('; ') : 'none'}
Empty DB tables (0 rows): ${emptyTables.length > 0 ? emptyTables.join(', ') : 'none'}

Analyze and return ONLY a valid JSON array (no markdown, no explanation) of issues. Each issue must have:
{
  "id": "<unique string>",
  "category": "<dead_button|missing_subsystem|broken_api|incomplete_workflow|db_error|unhandled_exception>",
  "severity": "<critical|high|medium|low>",
  "title": "<short Arabic title>",
  "description": "<detailed Arabic description of the issue>",
  "location": "<file path or page URL>",
  "evidence": "<what specifically indicates this is broken or missing>",
  "rocketPrompt": "<a precise, ready-to-use English technical prompt the admin can paste into Rocket to fix this issue — be very specific about what to build/fix, which file, what logic>"
}

Focus on:
1. Dead/unresponsive buttons (buttons that exist in UI but have no handler or navigate nowhere)
2. Missing subsystems (features referenced but not fully built — e.g., analytics page with no real data, ERP with stub content)
3. Broken API routes (from the broken list above)
4. Incomplete workflows (e.g., checkout flow missing steps, KYC without document upload confirmation)
5. Database errors (from the error list above, or empty tables that should have data)
6. Unhandled exceptions (missing error boundaries, no loading states, no empty states)

Return 8-15 issues. Prioritize real, actionable issues over hypothetical ones. Make rocketPrompt extremely specific and copy-paste ready.`;

    const response = await getChatCompletion(
      'GEMINI',
      'gemini/gemini-3.6-flash',
      [{ role: 'user', content: systemPrompt }],
      { temperature: 0.3, max_tokens: 4000 }
    );

    const raw = response.choices[0]?.message?.content ?? '[]';
    // Strip markdown code fences if present
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed: AuditIssue[] = JSON.parse(cleaned);
    return parsed.map(issue => ({ ...issue, id: issue.id || generateId() }));
  }, []);

  // ── Main scan orchestrator ───────────────────────────────────────────────
  const startScan = useCallback(async () => {
    setScanState('scanning');
    setScanProgress(0);
    setResult(null);
    const startTime = Date.now();

    try {
      // Phase 1: DB probe
      setScanPhase('🔍 فحص قاعدة البيانات وجداول Supabase...');
      setScanProgress(10);
      const { stats, errors: dbErrors } = await probeDatabase();
      setDbStats(stats);
      setScanProgress(35);

      // Phase 2: API probe
      setScanPhase('🌐 اختبار مسارات API والنقاط الطرفية...');
      setScanProgress(40);
      const { broken: brokenAPIs } = await probeAPIRoutes();
      setScanProgress(65);

      // Phase 3: AI analysis
      setScanPhase('🤖 تحليل المنصة بالذكاء الاصطناعي Gemini...');
      setScanProgress(70);
      const issues = await runAIAudit(dbErrors, brokenAPIs, stats);
      setScanProgress(95);

      // Phase 4: Compile results
      setScanPhase('📊 تجميع نتائج التدقيق...');
      const scanDuration = Math.round((Date.now() - startTime) / 1000);

      const auditResult: AuditScanResult = {
        totalIssues: issues.length,
        criticalCount: issues.filter(i => i.severity === 'critical').length,
        highCount: issues.filter(i => i.severity === 'high').length,
        mediumCount: issues.filter(i => i.severity === 'medium').length,
        lowCount: issues.filter(i => i.severity === 'low').length,
        issues,
        scanDuration,
        scannedAt: new Date().toISOString(),
      };

      setScanProgress(100);
      setResult(auditResult);
      setScanState('done');
    } catch (err: any) {
      console.error('Audit scan failed:', err);
      setScanState('idle');
      setScanPhase('');
    }
  }, [probeDatabase, probeAPIRoutes, runAIAudit]);

  const copyPrompt = (issue: AuditIssue) => {
    navigator.clipboard.writeText(issue.rocketPrompt).then(() => {
      setCopiedId(issue.id);
      setTimeout(() => setCopiedId(null), 2500);
    });
  };

  const filteredIssues = result?.issues.filter(issue => {
    if (filter === 'all') return true;
    if (['critical', 'high', 'medium', 'low'].includes(filter)) return issue.severity === filter;
    return issue.category === filter;
  }) ?? [];

  // ─── Render ───────────────────────────────────────────────────────────────

  const severityLabels = {
    critical: ui.severityCritical,
    high: ui.severityHigh,
    medium: ui.severityMedium,
    low: ui.severityLow,
  };
  const categoryLabels = {
    dead_button: ui.catDeadButton,
    missing_subsystem: ui.catMissingSubsystem,
    broken_api: ui.catBrokenApi,
    incomplete_workflow: ui.catIncompleteWorkflow,
    db_error: ui.catDbError,
    unhandled_exception: ui.catUnhandledException,
  };

  return (
    <div className="space-y-6" dir={dir}>

      {/* ── Header Banner ─────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-6 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, #6366f1 0%, transparent 50%), radial-gradient(circle at 80% 20%, #ec4899 0%, transparent 40%)' }} />
        <div className="relative flex items-start gap-5">
          <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
            <Icon name="ShieldCheckIcon" size={32} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-xl font-bold">{ui.title}</h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/20 border border-white/30 uppercase tracking-wide">{ui.badge}</span>
            </div>
            <p className="text-sm text-white/70 leading-relaxed">{ui.subtitle}</p>
            <div className="flex flex-wrap gap-3 mt-4">
              {[
                { icon: 'CursorArrowRaysIcon', label: ui.deadButtons },
                { icon: 'PuzzlePieceIcon', label: ui.missingSystems },
                { icon: 'ServerStackIcon', label: ui.apiErrors },
                { icon: 'CircleStackIcon', label: ui.dbErrors },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-1.5 text-xs text-white/60 bg-white/10 px-2.5 py-1 rounded-lg">
                  <Icon name={item.icon as any} size={12} className="text-white/80" />
                  {item.label}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Scan Trigger / Progress ────────────────────────────────────────── */}
      {scanState === 'idle' && (
        <div className="bg-card border border-border rounded-2xl p-8 text-center">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Icon name="MagnifyingGlassIcon" size={36} className="text-primary" />
          </div>
          <h3 className="text-lg font-bold text-foreground mb-2">{ui.startTitle}</h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
            {ui.startDesc}
          </p>
          <button
            onClick={startScan}
            className="inline-flex items-center gap-2.5 px-8 py-3.5 bg-primary text-primary-foreground rounded-xl font-bold text-sm hover:opacity-90 transition-opacity"
          >
            <Icon name="PlayIcon" size={18} />
            {ui.startBtn}
          </button>
          {result && (
            <p className="text-xs text-muted-foreground mt-4">
              {ui.lastScan}: {new Date(result.scannedAt).toLocaleString(language === 'ar' ? 'ar' : 'en')} · {ui.issuesCount.replace('{count}', String(result.totalIssues))}
            </p>
          )}
        </div>
      )}

      {scanState === 'scanning' && (
        <div className="bg-card border border-border rounded-2xl p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Icon name="ArrowPathIcon" size={20} className="text-primary animate-spin" />
            </div>
            <div>
              <h3 className="font-bold text-foreground">{ui.scanning}</h3>
              <p className="text-xs text-muted-foreground">{scanPhase}</p>
            </div>
          </div>
          {/* Progress bar */}
          <div className="w-full bg-muted rounded-full h-2.5 mb-3">
            <div
              className="h-2.5 rounded-full bg-primary transition-all duration-500"
              style={{ width: `${scanProgress}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>التقدم</span>
            <span>{scanProgress}%</span>
          </div>
          {/* Phase steps */}
          <div className="mt-6 space-y-2">
            {[
              { label: 'فحص جداول قاعدة البيانات', done: scanProgress >= 35 },
              { label: 'اختبار مسارات API', done: scanProgress >= 65 },
              { label: 'تحليل الذكاء الاصطناعي', done: scanProgress >= 95 },
              { label: 'تجميع النتائج', done: scanProgress >= 100 },
            ].map(step => (
              <div key={step.label} className="flex items-center gap-2.5 text-sm">
                {step.done
                  ? <Icon name="CheckCircleIcon" size={16} className="text-emerald-500 shrink-0" />
                  : <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30 shrink-0" />
                }
                <span className={step.done ? 'text-foreground font-medium' : 'text-muted-foreground'}>{step.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Results ────────────────────────────────────────────────────────── */}
      {scanState === 'done' && result && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: ui.issuesCount.replace('{count}', '').trim() || 'Issues', value: result.totalIssues, color: 'bg-slate-50 border-slate-200 text-slate-700', dot: 'bg-slate-500' },
              { label: ui.severityCritical, value: result.criticalCount, color: 'bg-red-50 border-red-200 text-red-700', dot: 'bg-red-500' },
              { label: ui.severityHigh, value: result.highCount, color: 'bg-orange-50 border-orange-200 text-orange-700', dot: 'bg-orange-500' },
              { label: `${ui.severityMedium} / ${ui.severityLow}`, value: result.mediumCount + result.lowCount, color: 'bg-amber-50 border-amber-200 text-amber-700', dot: 'bg-amber-400' },
            ].map(card => (
              <div key={card.label} className={`rounded-xl border p-4 ${card.color}`}>
                <div className="flex items-center gap-1.5 mb-1">
                  <div className={`w-2 h-2 rounded-full ${card.dot}`} />
                  <span className="text-xs font-medium opacity-80">{card.label}</span>
                </div>
                <p className="text-2xl font-bold">{card.value}</p>
              </div>
            ))}
          </div>

          {/* Scan meta */}
          <div className="flex items-center justify-between bg-card border border-border rounded-xl px-4 py-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Icon name="ClockIcon" size={14} />
              <span>مدة الفحص: {result.scanDuration}ث</span>
              <span className="mx-1">·</span>
              <Icon name="CircleStackIcon" size={14} />
              <span>{PLATFORM_MANIFEST.dbTables.length} جدول</span>
              <span className="mx-1">·</span>
              <Icon name="ServerStackIcon" size={14} />
              <span>{PLATFORM_MANIFEST.apiRoutes.length} مسار API</span>
            </div>
            <button
              onClick={() => { setScanState('idle'); }}
              className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:opacity-80 transition-opacity"
            >
              <Icon name="ArrowPathIcon" size={13} />
              {ui.runAudit}
            </button>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-wrap gap-2">
            {[
              { key: 'all', label: ui.filterAll },
              { key: 'critical', label: ui.severityCritical },
              { key: 'high', label: ui.severityHigh },
              { key: 'medium', label: ui.severityMedium },
              { key: 'low', label: ui.severityLow },
              { key: 'dead_button', label: ui.deadButtons },
              { key: 'missing_subsystem', label: ui.missingSystems },
              { key: 'broken_api', label: ui.catBrokenApi },
              { key: 'incomplete_workflow', label: ui.catIncompleteWorkflow },
              { key: 'db_error', label: ui.dbErrors },
            ].map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  filter === f.key
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Issues List */}
          <div className="space-y-3">
            {filteredIssues.length === 0 && (
              <div className="bg-card border border-border rounded-xl p-8 text-center">
                <Icon name="CheckCircleIcon" size={32} className="text-emerald-500 mx-auto mb-3" />
                <p className="text-sm font-semibold text-foreground">{ui.noIssues}</p>
              </div>
            )}
            {filteredIssues.map(issue => {
              const catMeta = CATEGORY_META[issue.category];
              const sevMeta = SEVERITY_META[issue.severity];
              const isExpanded = expandedId === issue.id;
              const isCopied = copiedId === issue.id;

              return (
                <div
                  key={issue.id}
                  className="bg-card border border-border rounded-xl overflow-hidden transition-shadow hover:shadow-md"
                >
                  {/* Issue Header */}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : issue.id)}
                    className="w-full flex items-start gap-3 p-4 text-right"
                  >
                    <div className={`w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5`}>
                      <Icon name={catMeta.icon as any} size={18} className={catMeta.color} />
                    </div>
                    <div className="flex-1 min-w-0 text-right">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-bold text-sm text-foreground">{issue.title}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sevMeta.badge}`}>
                          {severityLabels[issue.severity]}
                        </span>
                        <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                          {categoryLabels[issue.category]}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{issue.location}</p>
                    </div>
                    <Icon
                      name={isExpanded ? 'ChevronUpIcon' : 'ChevronDownIcon'}
                      size={16}
                      className="text-muted-foreground shrink-0 mt-1"
                    />
                  </button>

                  {/* Expanded Detail */}
                  {isExpanded && (
                    <div className="border-t border-border px-4 pb-4 pt-3 space-y-4">
                      {/* Description */}
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-1">الوصف</p>
                        <p className="text-sm text-foreground leading-relaxed">{issue.description}</p>
                      </div>

                      {/* Evidence */}
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-1">الدليل / المؤشر</p>
                        <div className="bg-muted rounded-lg px-3 py-2">
                          <p className="text-xs text-foreground font-mono leading-relaxed">{issue.evidence}</p>
                        </div>
                      </div>

                      {/* Rocket Prompt */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-semibold text-muted-foreground">{ui.copyCommand}</p>
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            <span className="text-[10px] text-emerald-600 font-semibold">{ui.readyToCopy}</span>
                          </div>
                        </div>
                        <div className="bg-slate-900 rounded-xl p-4 relative group">
                          <p className="text-xs text-slate-200 font-mono leading-relaxed whitespace-pre-wrap pr-8">
                            {issue.rocketPrompt}
                          </p>
                          <button
                            onClick={() => copyPrompt(issue)}
                            className="absolute top-3 left-3 w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                            title={ui.copyCommand}
                          >
                            {isCopied
                              ? <Icon name="CheckIcon" size={14} className="text-emerald-400" />
                              : <Icon name="ClipboardDocumentIcon" size={14} className="text-slate-300" />
                            }
                          </button>
                        </div>
                        <button
                          onClick={() => copyPrompt(issue)}
                          className={`mt-2 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${
                            isCopied
                              ? 'bg-emerald-500 text-white' :'bg-primary text-primary-foreground hover:opacity-90'
                          }`}
                        >
                          {isCopied
                            ? <><Icon name="CheckIcon" size={16} /> {ui.copied}</>
                            : <><Icon name="ClipboardDocumentIcon" size={16} /> {ui.copyToRocket}</>
                          }
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* DB Stats Summary */}
          {Object.keys(dbStats).length > 0 && (
            <div className="bg-card border border-border rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Icon name="CircleStackIcon" size={18} className="text-primary" />
                <h3 className="font-bold text-foreground text-sm">{ui.dbStats}</h3>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {Object.entries(dbStats).map(([table, count]) => (
                  <div
                    key={table}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs ${
                      count === -1
                        ? 'bg-red-50 border border-red-200'
                        : count === 0
                        ? 'bg-amber-50 border border-amber-200' :'bg-muted'
                    }`}
                  >
                    <span className={`font-mono truncate ${count === -1 ? 'text-red-700' : count === 0 ? 'text-amber-700' : 'text-muted-foreground'}`}>
                      {table}
                    </span>
                    <span className={`font-bold ml-2 shrink-0 ${count === -1 ? 'text-red-600' : count === 0 ? 'text-amber-600' : 'text-foreground'}`}>
                      {count === -1 ? '✗' : count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
