'use client';

import React, { useState, useCallback, useEffect } from 'react';
import Icon from '@/components/ui/AppIcon';
import { useLanguage } from '@/contexts/LanguageContext';
import { PlatformSentinel, SystemHealthLog } from '@/lib/platformSentinel';
import { createClient } from '@/lib/supabase/client';

interface HealthCheck {
  id: string;
  name: string;
  nameAr: string;
  category: 'route' | 'api' | 'component' | 'database';
  url?: string;
  status: 'idle' | 'checking' | 'healthy' | 'error' | 'warning';
  latency?: number;
  message?: string;
}

const CORE_CHECKS: Omit<HealthCheck, 'status' | 'latency' | 'message'>[] = [
  // Core Routes
  { id: 'home', name: 'Homepage', nameAr: 'الصفحة الرئيسية', category: 'route', url: '/' },
  { id: 'categories', name: 'Categories', nameAr: 'الفئات', category: 'route', url: '/categories' },
  { id: 'suppliers', name: 'Suppliers', nameAr: 'الموردون', category: 'route', url: '/suppliers' },
  { id: 'rfq-board', name: 'RFQ Board', nameAr: 'لوحة طلبات الأسعار', category: 'route', url: '/rfq-board' },
  { id: 'search', name: 'Search', nameAr: 'البحث', category: 'route', url: '/search' },
  { id: 'logistics', name: 'Logistics', nameAr: 'اللوجستيات', category: 'route', url: '/logistics' },
  { id: 'login', name: 'Login', nameAr: 'تسجيل الدخول', category: 'route', url: '/login' },
  { id: 'factory-register', name: 'Factory Register', nameAr: 'تسجيل المصنع', category: 'route', url: '/factory/register' },
  { id: 'about', name: 'About', nameAr: 'عن المنصة', category: 'route', url: '/about' },
  { id: 'ai-features', name: 'AI Features', nameAr: 'ميزات الذكاء الاصطناعي', category: 'route', url: '/ai-features' },
  // API Routes
  { id: 'api-manifest', name: 'App Manifest API', nameAr: 'واجهة برمجة التطبيق', category: 'api', url: '/api/manifest' },
  { id: 'api-track-visit', name: 'Visit Tracker API', nameAr: 'متتبع الزيارات', category: 'api', url: '/api/track-visit' },
];

const CATEGORY_LABELS: Record<string, string> = {
  route: 'صفحات المنصة',
  api: 'واجهات برمجة التطبيقات',
  component: 'المكونات',
  database: 'قاعدة البيانات',
};

const CATEGORY_COLORS: Record<string, string> = {
  route: 'text-blue-600 bg-blue-50',
  api: 'text-purple-600 bg-purple-50',
  component: 'text-orange-600 bg-orange-50',
  database: 'text-emerald-600 bg-emerald-50',
};

export default function SystemHealthPanel() {
  const { t, dir, language, isRTL } = useLanguage();
  const ui = t.admin.systemHealth;

  const [checks, setChecks] = useState<HealthCheck[]>(
    CORE_CHECKS.map(c => ({ ...c, status: 'idle' }))
  );
  const [isRunning, setIsRunning] = useState(false);
  const [lastRunAt, setLastRunAt] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ healthy: number; errors: number; warnings: number } | null>(null);

  // ── Sentinel logs state ──────────────────────────────────────────────────
  const [sentinelLogs, setSentinelLogs] = useState<SystemHealthLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'checks' | 'logs'>('checks');

  const loadSentinelLogs = useCallback(async () => {
    setLogsLoading(true);
    const logs = await PlatformSentinel.fetchRecentLogs(50);
    setSentinelLogs(logs);
    setLogsLoading(false);
  }, []);

  // Load logs on mount and subscribe to realtime updates
  useEffect(() => {
    loadSentinelLogs();

    const supabase = createClient();
    const channel = supabase
      .channel('system-health-logs-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'system_health_logs' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setSentinelLogs(prev => [payload.new as SystemHealthLog, ...prev].slice(0, 50));
          } else if (payload.eventType === 'UPDATE') {
            setSentinelLogs(prev =>
              prev.map(l => l.id === (payload.new as SystemHealthLog).id ? payload.new as SystemHealthLog : l)
            );
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [loadSentinelLogs]);

  const handleResolveLog = useCallback(async (logId: string) => {
    await PlatformSentinel.resolveLog(logId);
    setSentinelLogs(prev => prev.map(l => l.id === logId ? { ...l, resolved: true } : l));
  }, []);

  const runCheck = useCallback(async (check: Omit<HealthCheck, 'status' | 'latency' | 'message'>): Promise<HealthCheck> => {
    if (!check.url) {
      return { ...check, status: 'warning', message: 'No URL configured' };
    }

    // Use PlatformSentinel.pulseCheck to log results to Supabase
    const pulse = await PlatformSentinel.pulseCheck(check.name, check.url, {
      category: check.category as 'route' | 'api',
    });

    const statusMap: Record<string, HealthCheck['status']> = {
      healthy: 'healthy',
      degraded: 'warning',
      down: 'error',
    };

    return {
      ...check,
      status: statusMap[pulse.status] ?? 'warning',
      latency: pulse.latency_ms,
      message: pulse.details,
    };
  }, []);

  const runAllChecks = useCallback(async () => {
    setIsRunning(true);
    setSummary(null);

    setChecks(CORE_CHECKS.map(c => ({ ...c, status: 'checking' })));

    const results: HealthCheck[] = [];
    const batchSize = 4;

    for (let i = 0; i < CORE_CHECKS.length; i += batchSize) {
      const batch = CORE_CHECKS.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map(runCheck));
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

    const healthy = results.filter(r => r.status === 'healthy').length;
    const errors = results.filter(r => r.status === 'error').length;
    const warnings = results.filter(r => r.status === 'warning').length;

    setSummary({ healthy, errors, warnings });
    setLastRunAt(new Date().toLocaleTimeString('ar-SA'));
    setIsRunning(false);

    // Report summary anomaly if errors found
    if (errors > 0) {
      await PlatformSentinel.reportAnomaly(
        'SystemHealthPanel',
        `فحص صحة النظام: ${errors} خطأ، ${warnings} تحذير من أصل ${results.length} فحص`,
        { severity: errors > 3 ? 'critical' : 'warning', category: 'system', details: { healthy, errors, warnings } }
      );
    }

    // Reload logs after run
    loadSentinelLogs();
  }, [runCheck, loadSentinelLogs]);

  const grouped = CORE_CHECKS.reduce<Record<string, HealthCheck[]>>((acc, check) => {
    const cat = check.category;
    if (!acc[cat]) acc[cat] = [];
    const found = checks.find(c => c.id === check.id);
    if (found) acc[cat].push(found);
    return acc;
  }, {});

  const overallStatus = summary
    ? summary.errors > 0 ? 'error' : summary.warnings > 0 ? 'warning' : 'healthy' : 'idle';

  const severityColor: Record<string, string> = {
    info: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
    warning: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    error: 'text-red-400 bg-red-500/10 border-red-500/30',
    critical: 'text-pink-400 bg-pink-500/10 border-pink-500/30',
  };

  const severityIcon: Record<string, string> = {
    info: 'InformationCircleIcon',
    warning: 'ExclamationTriangleIcon',
    error: 'XCircleIcon',
    critical: 'ShieldExclamationIcon',
  };

  return (
    <div className="space-y-5" dir={dir}>
      {/* Header */}
      <div className={`rounded-2xl p-5 text-white ${
        overallStatus === 'error' ? 'bg-gradient-to-r from-red-600 to-red-800' :
        overallStatus === 'warning' ? 'bg-gradient-to-r from-amber-500 to-amber-700' :
        overallStatus === 'healthy'? 'bg-gradient-to-r from-emerald-600 to-emerald-800' : 'bg-gradient-to-r from-slate-600 to-slate-800'
      }`}>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
            <Icon name="ServerStackIcon" size={28} className="text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold">{ui.title}</h2>
            <p className="text-sm text-white/80">{ui.subtitle}</p>
          </div>
          <div className="text-right shrink-0">
            {lastRunAt && (
              <p className="text-xs text-white/70 mb-1">{ui.lastCheck}: {lastRunAt}</p>
            )}
            <div className="flex items-center gap-1.5 justify-end">
              <div className={`w-2 h-2 rounded-full ${
                overallStatus === 'healthy' ? 'bg-emerald-300 animate-pulse' :
                overallStatus === 'error' ? 'bg-red-300 animate-pulse' :
                overallStatus === 'warning'? 'bg-amber-300 animate-pulse' : 'bg-white/40'
              }`} />
              <span className="text-xs font-semibold text-white/90">
                {overallStatus === 'healthy' ? ui.allHealthy :
                 overallStatus === 'error' ? ui.hasErrors :
                 overallStatus === 'warning' ? ui.hasWarnings : ui.awaitingCheck}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-emerald-400">{summary.healthy}</p>
            <p className="text-xs font-semibold text-emerald-400 mt-1">✅ {ui.workingOk}</p>
          </div>
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-amber-400">{summary.warnings}</p>
            <p className="text-xs font-semibold text-amber-400 mt-1">⚠️ {ui.warnings}</p>
          </div>
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-red-400">{summary.errors}</p>
            <p className="text-xs font-semibold text-red-400 mt-1">🔴 {ui.errors}</p>
          </div>
        </div>
      )}

      {/* Run Button */}
      <button
        onClick={runAllChecks}
        disabled={isRunning}
        className="w-full flex items-center justify-center gap-3 py-3.5 bg-primary text-white rounded-xl font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-60"
      >
        {isRunning ? (
          <>
            <Icon name="ArrowPathIcon" size={18} className="animate-spin" />
            {ui.checking} ({checks.filter(c => c.status === 'healthy' || c.status === 'error' || c.status === 'warning').length}/{checks.length})
          </>
        ) : (
          <>
            <Icon name="PlayIcon" size={18} />
            {lastRunAt ? ui.rerun : ui.runFull}
          </>
        )}
      </button>

      {/* Tab Switcher */}
      <div className="flex gap-2 bg-[#161b22] border border-[#30363d] rounded-xl p-1">
        <button
          onClick={() => setActiveTab('checks')}
          className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${
            activeTab === 'checks' ?'bg-primary text-white' :'text-[#8b949e] hover:text-[#e6edf3]'
          }`}
        >
          🔍 فحص المسارات
        </button>
        <button
          onClick={() => { setActiveTab('logs'); loadSentinelLogs(); }}
          className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 ${
            activeTab === 'logs' ?'bg-primary text-white' :'text-[#8b949e] hover:text-[#e6edf3]'
          }`}
        >
          🛡️ سجلات Sentinel
          {sentinelLogs.filter(l => !l.resolved && l.severity !== 'info').length > 0 && (
            <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {sentinelLogs.filter(l => !l.resolved && l.severity !== 'info').length}
            </span>
          )}
        </button>
      </div>

      {/* Tab: Route Checks */}
      {activeTab === 'checks' && (
        <>
          {Object.entries(grouped).map(([category, categoryChecks]) => (
            <div key={category} className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-3 border-b border-[#30363d] bg-[#1c2330]">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${CATEGORY_COLORS[category]}`}>
                  {CATEGORY_LABELS[category] || category}
                </span>
                <span className="text-xs text-[#8b949e]">
                  ({ui.healthyCount.replace('{ok}', String(categoryChecks.filter(c => c.status === 'healthy').length)).replace('{total}', String(categoryChecks.length))})
                </span>
              </div>
              <div className="divide-y divide-[#30363d]">
                {categoryChecks.map(check => (
                  <div key={check.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="shrink-0">
                      {check.status === 'idle' && (
                        <div className="w-5 h-5 rounded-full bg-[#21262d] border-2 border-[#30363d]" />
                      )}
                      {check.status === 'checking' && (
                        <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                      )}
                      {check.status === 'healthy' && (
                        <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                          <Icon name="CheckIcon" size={12} className="text-white" />
                        </div>
                      )}
                      {check.status === 'warning' && (
                        <div className="w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center">
                          <Icon name="ExclamationTriangleIcon" size={12} className="text-white" />
                        </div>
                      )}
                      {check.status === 'error' && (
                        <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
                          <Icon name="XMarkIcon" size={12} className="text-white" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#e6edf3]">{check.nameAr}</p>
                      <p className="text-xs text-[#8b949e]">{check.url}</p>
                    </div>
                    {check.latency !== undefined && (
                      <span className={`text-xs font-mono px-2 py-0.5 rounded-full ${
                        check.latency < 500 ? 'bg-emerald-500/15 text-emerald-400' :
                        check.latency < 2000 ? 'bg-amber-500/15 text-amber-400': 'bg-red-500/15 text-red-400'
                      }`}>
                        {check.latency}ms
                      </span>
                    )}
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                      check.status === 'healthy' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' :
                      check.status === 'error' ? 'bg-red-500/15 text-red-400 border-red-500/30' :
                      check.status === 'warning' ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' :
                      check.status === 'checking'? 'bg-blue-500/15 text-blue-400 border-blue-500/30' : 'bg-[#21262d] text-[#8b949e] border-[#30363d]'
                    }`}>
                      {check.status === 'healthy' ? 'سليم' :
                       check.status === 'error' ? 'خطأ' :
                       check.status === 'warning' ? 'تحذير' :
                       check.status === 'checking' ? 'جارٍ الفحص' : 'لم يُفحص'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Legend */}
          <div className="bg-[#1c2330] border border-[#30363d] rounded-xl p-4">
            <p className="text-xs font-bold text-[#8b949e] mb-3">{ui.legendTitle}</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              {[
                { color: 'bg-emerald-500', label: ui.legendHealthy },
                { color: 'bg-amber-500', label: ui.legendWarning },
                { color: 'bg-red-500', label: ui.legendError },
                { color: 'bg-[#21262d] border border-[#30363d]', label: ui.legendIdle },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full shrink-0 ${item.color}`} />
                  <span className="text-[#8b949e]">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Tab: Sentinel Logs */}
      {activeTab === 'logs' && (
        <div className="space-y-3">
          {/* Logs Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-[#8b949e]">مباشر 🟢 — يتحدث تلقائياً</span>
            </div>
            <button
              onClick={loadSentinelLogs}
              disabled={logsLoading}
              className="flex items-center gap-1.5 text-xs text-primary hover:opacity-80 transition-opacity"
            >
              <Icon name="ArrowPathIcon" size={13} className={logsLoading ? 'animate-spin' : ''} />
              تحديث
            </button>
          </div>

          {logsLoading && sentinelLogs.length === 0 ? (
            <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-8 text-center">
              <Icon name="ArrowPathIcon" size={24} className="text-[#8b949e] animate-spin mx-auto mb-2" />
              <p className="text-sm text-[#8b949e]">جارٍ تحميل السجلات...</p>
            </div>
          ) : sentinelLogs.length === 0 ? (
            <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-8 text-center">
              <Icon name="ShieldCheckIcon" size={32} className="text-emerald-400 mx-auto mb-3" />
              <p className="text-sm font-semibold text-[#e6edf3]">لا توجد سجلات بعد</p>
              <p className="text-xs text-[#8b949e] mt-1">قم بتشغيل فحص صحة النظام لبدء التسجيل التلقائي</p>
            </div>
          ) : (
            <div className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden">
              <div className="overflow-x-auto -mx-0">
                <table className="w-full text-xs text-[#8b949e] min-w-[500px]">
                  <thead>
                    <tr className="border-b border-[#30363d] bg-[#1c2330]">
                      <th className="px-4 py-2.5 text-right font-bold text-[#e6edf3]">الخطورة</th>
                      <th className="px-4 py-2.5 text-right font-bold text-[#e6edf3]">المصدر</th>
                      <th className="px-4 py-2.5 text-right font-bold text-[#e6edf3]">الرسالة</th>
                      <th className="px-4 py-2.5 text-right font-bold text-[#e6edf3]">الوقت</th>
                      <th className="px-4 py-2.5 text-right font-bold text-[#e6edf3]">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#30363d]">
                    {sentinelLogs.map(log => (
                      <tr key={log.id} className={`hover:bg-[#1c2330] transition-colors ${log.resolved ? 'opacity-50' : ''}`}>
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${severityColor[log.severity] ?? severityColor.info}`}>
                            <Icon name={severityIcon[log.severity] ?? 'InformationCircleIcon'} size={10} />
                            {log.severity === 'info' ? 'معلومة' :
                             log.severity === 'warning' ? 'تحذير' :
                             log.severity === 'error' ? 'خطأ' : 'حرج'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="font-mono text-[#e6edf3]">{log.source}</span>
                        </td>
                        <td className="px-4 py-2.5 max-w-[200px]">
                          <p className="truncate text-[#8b949e]" title={log.message}>{log.message}</p>
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          {log.created_at
                            ? new Date(log.created_at).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                            : '—'}
                        </td>
                        <td className="px-4 py-2.5">
                          {log.resolved ? (
                            <span className="text-emerald-400 text-[10px] font-bold">✅ محلول</span>
                          ) : (
                            <button
                              onClick={() => log.id && handleResolveLog(log.id)}
                              className="text-[10px] font-bold text-amber-400 hover:text-amber-300 transition-colors border border-amber-500/30 px-2 py-0.5 rounded-full"
                            >
                              حل
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
