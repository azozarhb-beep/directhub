'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import Icon from '@/components/ui/AppIcon';

type TabKey = 'infra' | 'gateways' | 'errors' | 'audit' | 'devops';
type GatewayKey = 'whatsapp' | 'sms' | 'mailer' | 'push' | 'maps';
type GatewayState = { status: 'unknown' | 'ok' | 'fail' | 'checking'; ms: number; detail: string; at: string };

interface Incident {
  id: string;
  severity: string;
  category: string;
  source: string;
  message: string;
  details: Record<string, any> | null;
  resolved: boolean;
  createdAt: string;
}

interface AuditRow {
  id: string;
  eventType: string;
  actor: string;
  role: string;
  description: string;
  ip: string;
  geo: string;
  createdAt: string;
}

interface BucketHealth {
  name: string;
  label: string;
  ok: boolean;
  isPublic: boolean | null;
  detail: string;
}

const BUCKETS: { name: string; label: string }[] = [
  { name: 'product-images', label: 'صور المنتجات' },
  { name: 'chat-media', label: 'مرفقات المحادثات والفحص' },
  { name: 'logistics-documents', label: 'مستندات بوالص الشحن' },
];

const GATEWAYS: { key: GatewayKey; label: string; desc: string }[] = [
  { key: 'whatsapp', label: 'WhatsApp Business Cloud API', desc: 'معدل تسليم الـ Webhook وصلاحية الرمز' },
  { key: 'sms', label: 'بوابة SMS و OTP', desc: 'رسائل التحقق عبر قالب OTP' },
  { key: 'push', label: 'الإشعارات الفورية (Push)', desc: 'مفاتيح VAPID لإشعارات المتصفح' },
  { key: 'mailer', label: 'خدمة البريد (Transactional Email)', desc: 'رسائل البريد الإلكتروني المعاملاتية' },
  { key: 'maps', label: 'الخرائط والترميز الجغرافي', desc: 'تتبع مسارات الشحن واللوجستيات' },
];

const SETTING_KEYS = {
  maintenance: 'system_maintenance_mode',
  message: 'system_maintenance_message',
  minVersion: 'system_min_app_version',
  cachePurge: 'system_cache_purged_at',
};

const inputCls = 'w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-indigo-500';

const fmtDate = (iso: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toISOString().replace('T', ' ').slice(0, 19);
};

const sevStyle = (s: string) => {
  const v = (s || '').toLowerCase();
  if (v === 'critical' || v === 'error') return 'border-red-700/60 text-red-300 bg-red-950/30';
  if (v === 'warning') return 'border-amber-700/60 text-amber-300 bg-amber-950/20';
  return 'border-slate-700 text-slate-300 bg-slate-900';
};

const isCritical = (s: string) => ['critical', 'error'].includes((s || '').toLowerCase());

export default function AdminSystemPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { user, loading: authLoading } = useAuth();

  const role = (user?.user_metadata?.role || user?.app_metadata?.role || '') as string;
  const staffRole = (user?.user_metadata?.staff_role || user?.app_metadata?.staff_role || '') as string;
  const isMasterAdmin = role === 'admin';
  const isEngineer = staffRole === 'SYSTEM_ENGINEER';
  const canAccess = isMasterAdmin || isEngineer;

  const [tab, setTab] = useState<TabKey>('infra');
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('tab') as TabKey | null;
    if (q && ['infra', 'gateways', 'errors', 'audit', 'devops'].includes(q)) setTab(q);
  }, []);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [buckets, setBuckets] = useState<BucketHealth[]>([]);
  const [dbLatency, setDbLatency] = useState<number | null>(null);
  const [benchmark, setBenchmark] = useState<{ label: string; ms: number; ok: boolean }[]>([]);
  const [gateways, setGateways] = useState<Record<GatewayKey, GatewayState>>({
    whatsapp: { status: 'unknown', ms: 0, detail: '', at: '' },
    sms: { status: 'unknown', ms: 0, detail: '', at: '' },
    push: { status: 'unknown', ms: 0, detail: '', at: '' },
    mailer: { status: 'unknown', ms: 0, detail: '', at: '' },
    maps: { status: 'unknown', ms: 0, detail: '', at: '' },
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(false);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [loadedAt, setLoadedAt] = useState('');

  const [maintenance, setMaintenance] = useState(false);
  const [maintenanceMsg, setMaintenanceMsg] = useState('المنصة تحت الصيانة حالياً، سنعود قريباً. شكراً لصبركم.');
  const [minVersion, setMinVersion] = useState('1.0.0');
  const [lastPurge, setLastPurge] = useState('');

  const [staffOpen, setStaffOpen] = useState(false);
  const [staffForm, setStaffForm] = useState({ fullName: '', email: '', specialization: 'DevOps' });
  const [staffBusy, setStaffBusy] = useState(false);
  const [staffErr, setStaffErr] = useState('');
  const [staffResult, setStaffResult] = useState<{ email: string; tempPassword: string } | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/login'); return; }
    if (!canAccess) router.push('/');
  }, [user, authLoading, canAccess, router]);

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3500); };

  const writeAudit = useCallback(async (eventType: string, description: string) => {
    try {
      await supabase.from('security_audit_logs').insert({
        event_type: eventType,
        actor_id: user?.id || null,
        actor_email: user?.email || null,
        actor_role: isMasterAdmin ? 'MASTER_ADMIN' : 'SYSTEM_ENGINEER',
        description,
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      });
    } catch {
      /* audit write must never break the action */
    }
  }, [supabase, user, isMasterAdmin]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const t0 = performance.now();
      const [logsRes, auditRes, settingsRes] = await Promise.all([
        supabase
          .from('system_health_logs')
          .select('id, severity, category, source, message, details, resolved, created_at')
          .order('created_at', { ascending: false })
          .limit(200),
        supabase
          .from('security_audit_logs')
          .select('id, event_type, actor_email, actor_role, description, ip_address, geo_hint, created_at')
          .order('created_at', { ascending: false })
          .limit(200),
        supabase
          .from('platform_settings')
          .select('setting_key, setting_value, updated_at')
          .like('setting_key', 'system\\_%'),
      ]);
      setDbLatency(Math.round(performance.now() - t0));

      if (logsRes.error) throw logsRes.error;
      setIncidents(
        ((logsRes.data || []) as any[]).map((r) => ({
          id: r.id,
          severity: r.severity,
          category: r.category,
          source: r.source,
          message: r.message,
          details: r.details,
          resolved: !!r.resolved,
          createdAt: r.created_at,
        }))
      );

      setAudit(
        ((auditRes.data || []) as any[]).map((r) => ({
          id: r.id,
          eventType: r.event_type,
          actor: r.actor_email || '—',
          role: r.actor_role || '—',
          description: r.description,
          ip: r.ip_address || '—',
          geo: r.geo_hint || '—',
          createdAt: r.created_at,
        }))
      );

      const settings = new Map<string, any>();
      ((settingsRes.data || []) as any[]).forEach((s) => settings.set(s.setting_key, s));
      if (settings.has(SETTING_KEYS.maintenance)) setMaintenance(settings.get(SETTING_KEYS.maintenance).setting_value === 'true');
      if (settings.has(SETTING_KEYS.message) && settings.get(SETTING_KEYS.message).setting_value) {
        setMaintenanceMsg(settings.get(SETTING_KEYS.message).setting_value);
      }
      if (settings.has(SETTING_KEYS.minVersion) && settings.get(SETTING_KEYS.minVersion).setting_value) {
        setMinVersion(settings.get(SETTING_KEYS.minVersion).setting_value);
      }
      if (settings.has(SETTING_KEYS.cachePurge)) setLastPurge(settings.get(SETTING_KEYS.cachePurge).setting_value);

      const bucketResults = await Promise.all(
        BUCKETS.map(async (b): Promise<BucketHealth> => {
          const { data, error: bErr } = await supabase.storage.from(b.name).list('', { limit: 1 });
          if (bErr) return { ...b, ok: false, isPublic: null, detail: bErr.message };
          return { ...b, ok: true, isPublic: null, detail: `متاح — ${data?.length ?? 0} عنصر في الجذر (عينة)` };
        })
      );
      setBuckets(bucketResults);
      setLoadedAt(new Date().toISOString());
    } catch (e: any) {
      setError(e?.message || 'تعذر تحميل بيانات النظام');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    if (authLoading || !user || !canAccess) return;
    load();
  }, [authLoading, user, canAccess, load]);

  const pingGateway = useCallback(async (key: GatewayKey) => {
    setGateways((g) => ({ ...g, [key]: { ...g[key], status: 'checking' } }));
    try {
      const res = await fetch('/api/admin/system/ping-gateway', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gateway: key }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'فشل الفحص');
      setGateways((g) => ({
        ...g,
        [key]: { status: json.ok ? 'ok' : 'fail', ms: json.ms, detail: json.detail, at: new Date().toISOString() },
      }));
    } catch (e: any) {
      setGateways((g) => ({
        ...g,
        [key]: { status: 'fail', ms: 0, detail: e?.message || 'فشل الفحص', at: new Date().toISOString() },
      }));
    }
  }, []);

  const pingAll = async () => {
    setBusy('ping-all');
    await Promise.all(GATEWAYS.map((g) => pingGateway(g.key)));
    setBusy(null);
    showToast('اكتمل فحص جميع البوابات');
  };

  const runBenchmark = async () => {
    setBusy('benchmark');
    const probes: { label: string; run: () => PromiseLike<{ error: any }> }[] = [
      { label: 'قراءة user_profiles (1 صف)', run: () => supabase.from('user_profiles').select('id').limit(1) },
      { label: 'قراءة system_health_logs (20 صف)', run: () => supabase.from('system_health_logs').select('id').limit(20) },
      { label: 'قراءة platform_settings', run: () => supabase.from('platform_settings').select('setting_key').limit(20) },
    ];
    const out: { label: string; ms: number; ok: boolean }[] = [];
    for (const p of probes) {
      const s = performance.now();
      const { error: pErr } = await p.run();
      out.push({ label: p.label, ms: Math.round(performance.now() - s), ok: !pErr });
    }
    setBenchmark(out);
    const avg = Math.round(out.reduce((a, b) => a + b.ms, 0) / out.length);
    setDbLatency(avg);
    setBusy(null);
    showToast(`اختبار الاتصال: متوسط ${avg}ms`);
  };

  const quickDiagnostics = async () => {
    setBusy('diag');
    await Promise.all([runBenchmark(), pingAll()]);
    await writeAudit('diagnostics_run', 'تشغيل فحص تشخيصي سريع للنظام');
    setBusy(null);
  };

  const resolveIncident = async (inc: Incident) => {
    setBusy(`inc-${inc.id}`);
    const { error: uErr } = await supabase.from('system_health_logs').update({ resolved: true }).eq('id', inc.id);
    if (uErr) showToast(`فشل التحديث: ${uErr.message}`);
    else {
      setIncidents((arr) => arr.map((i) => (i.id === inc.id ? { ...i, resolved: true } : i)));
      await writeAudit('incident_resolved', `تعليم الحادث كمحلول: ${inc.source}`);
      showToast('تم تعليم الحادث كمحلول');
    }
    setBusy(null);
  };

  const saveSetting = async (key: string, value: string, description: string) => {
    const { data: existing, error: sErr } = await supabase.from('platform_settings').select('id').eq('setting_key', key).maybeSingle();
    if (sErr) throw sErr;
    const payload = { setting_key: key, setting_value: value, description, updated_at: new Date().toISOString() };
    const { error: wErr } = existing?.id
      ? await supabase.from('platform_settings').update(payload).eq('setting_key', key)
      : await supabase.from('platform_settings').insert(payload);
    if (wErr) throw wErr;
  };

  const toggleMaintenance = async (next: boolean) => {
    setBusy('maintenance');
    try {
      await saveSetting(SETTING_KEYS.maintenance, String(next), 'Maintenance mode flag');
      await saveSetting(SETTING_KEYS.message, maintenanceMsg, 'Maintenance announcement (Arabic)');
      setMaintenance(next);
      await writeAudit('maintenance_toggle', next ? 'تفعيل وضع الصيانة' : 'إيقاف وضع الصيانة');
      showToast(next ? 'تم تفعيل وضع الصيانة' : 'تم إيقاف وضع الصيانة');
    } catch (e: any) {
      showToast(`فشل الحفظ: ${e?.message || ''}`);
    }
    setBusy(null);
  };

  const saveMaintenanceMessage = async () => {
    setBusy('maintenance-msg');
    try {
      await saveSetting(SETTING_KEYS.message, maintenanceMsg, 'Maintenance announcement (Arabic)');
      await writeAudit('maintenance_message', 'تحديث رسالة الصيانة');
      showToast('تم حفظ رسالة الصيانة');
    } catch (e: any) {
      showToast(`فشل الحفظ: ${e?.message || ''}`);
    }
    setBusy(null);
  };

  const saveMinVersion = async () => {
    if (!/^\d+\.\d+\.\d+$/.test(minVersion.trim())) { showToast('صيغة الإصدار غير صحيحة (مثال: 1.4.0)'); return; }
    setBusy('min-version');
    try {
      await saveSetting(SETTING_KEYS.minVersion, minVersion.trim(), 'Minimum required mobile app version');
      await writeAudit('min_version_update', `تحديث الحد الأدنى لإصدار التطبيق إلى ${minVersion.trim()}`);
      showToast('تم حفظ الحد الأدنى للإصدار');
    } catch (e: any) {
      showToast(`فشل الحفظ: ${e?.message || ''}`);
    }
    setBusy(null);
  };

  const purgeCache = async () => {
    setBusy('purge');
    try {
      const stamp = new Date().toISOString();
      await saveSetting(SETTING_KEYS.cachePurge, stamp, 'Last cache invalidation / CDN purge request');
      setLastPurge(stamp);
      if (typeof caches !== 'undefined') {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      await writeAudit('cache_purge', 'طلب إبطال الكاش وتفريغ الـ CDN');
      showToast('تم تسجيل طلب إبطال الكاش وتفريغ كاش المتصفح');
    } catch (e: any) {
      showToast(`فشل العملية: ${e?.message || ''}`);
    }
    setBusy(null);
  };

  const submitStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setStaffBusy(true);
    setStaffErr('');
    try {
      const res = await fetch('/api/admin/system-staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(staffForm),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'فشل إنشاء الحساب');
      setStaffResult({ email: json.email, tempPassword: json.tempPassword });
    } catch (err: any) {
      setStaffErr(err?.message || 'فشل إنشاء الحساب');
    } finally {
      setStaffBusy(false);
    }
  };

  const closeStaff = () => {
    setStaffOpen(false);
    setStaffResult(null);
    setStaffErr('');
    setStaffForm({ fullName: '', email: '', specialization: 'DevOps' });
  };

  const stats = useMemo(() => {
    const unresolvedCritical = incidents.filter((i) => !i.resolved && isCritical(i.severity)).length;
    const last24 = incidents.filter((i) => Date.now() - new Date(i.createdAt).getTime() < 86400000);
    const failing24 = last24.filter((i) => isCritical(i.severity)).length;
    const uptime = Math.max(90, 100 - failing24 * 0.02);
    const gwStates = Object.values(gateways);
    const checked = gwStates.filter((g) => g.status === 'ok' || g.status === 'fail');
    const okCount = checked.filter((g) => g.status === 'ok').length;
    const bucketsOk = buckets.filter((b) => b.ok).length;
    return { unresolvedCritical, uptime, checked: checked.length, okCount, bucketsOk };
  }, [incidents, gateways, buckets]);

  if (authLoading || !user || !canAccess) {
    return (
      <div className="fixed inset-0 w-full h-[100dvh] bg-slate-950 text-white flex items-center justify-center z-50">
        <div className="w-10 h-10 border-4 border-slate-700 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'infra', label: 'رادار البنية التحتية والخوادم — Cloud Infrastructure & DB Health' },
    { key: 'gateways', label: 'بوابات الربط والتكاملات — API Gateways & External Integrations' },
    { key: 'errors', label: 'سجل الأخطاء والانهيارات الحية — Runtime Error & Crash Telemetry' },
    { key: 'audit', label: 'سجل التدقيق الأمني والنشاطات — Security Audit & Access Logs' },
    { key: 'devops', label: 'مفاتيح السيطرة الفنية والصيانة — DevOps & Maintenance Switches' },
  ];

  const gwSummary = stats.checked === 0
    ? 'لم يتم الفحص بعد'
    : stats.okCount === stats.checked
      ? `جميع البوابات تعمل (${stats.okCount}/${stats.checked})`
      : `${stats.checked - stats.okCount} بوابة متعطلة من ${stats.checked}`;

  const tickerCards: { label: string; value: string; sub: string; tone: string }[] = [
    {
      label: 'مؤشر استقرار وتشغيل النظام',
      value: `${stats.uptime.toFixed(2)}%`,
      sub: 'تقدير مبني على أخطاء آخر 24 ساعة',
      tone: 'border-emerald-700/50',
    },
    {
      label: 'زمن استجابة الخادم وقاعدة البيانات',
      value: dbLatency === null ? '—' : `${dbLatency} ms`,
      sub: 'قياس زمن جلب بيانات اللوحة',
      tone: 'border-cyan-700/50',
    },
    {
      label: 'أخطاء واستثناءات برمجية غير محلولة',
      value: String(stats.unresolvedCritical),
      sub: 'حوادث حرجة مفتوحة',
      tone: stats.unresolvedCritical > 0 ? 'border-red-700/60' : 'border-slate-700',
    },
    {
      label: 'استهلاك التخزين السحابي للوسائط',
      value: `${stats.bucketsOk}/${BUCKETS.length}`,
      sub: 'حاويات التخزين المتاحة',
      tone: 'border-indigo-700/50',
    },
    {
      label: 'جاهزية بوابات التكامل الخارجية',
      value: stats.checked === 0 ? '—' : `${stats.okCount}/${stats.checked}`,
      sub: gwSummary,
      tone: stats.checked > 0 && stats.okCount < stats.checked ? 'border-red-700/60' : 'border-amber-700/50',
    },
  ];

  const visibleIncidents = incidents.filter((i) => !dismissed.includes(i.id) && (showResolved || !i.resolved));

  return (
    <div dir="rtl" className="fixed inset-0 w-full h-[100dvh] bg-slate-950 text-white flex flex-col z-50 overflow-hidden">
      <header className="sticky top-0 z-20 shrink-0 bg-slate-900 border-b border-slate-800 px-4 py-3 flex flex-wrap items-center gap-3">
        {isMasterAdmin && (
          <Link
            href="/admin"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold"
          >
            <span aria-hidden>←</span>
            العودة للوحة الإدارة العامة
          </Link>
        )}
        <nav className="text-xs sm:text-sm text-slate-300 font-semibold flex-1 min-w-[200px]">
          لوحة الإدارة / بوابة الهندسة والنظام والبنية التحتية
        </nav>
        {isMasterAdmin && (
          <button
            type="button"
            onClick={() => setStaffOpen(true)}
            className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold"
          >
            + تعيين مهندس برمجيات ونظام
          </button>
        )}
        <button
          type="button"
          onClick={quickDiagnostics}
          disabled={busy === 'diag'}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-xs font-bold disabled:opacity-50"
        >
          <Icon name="BoltIcon" size={14} className={busy === 'diag' ? 'animate-pulse' : ''} />
          فحص تشخيصي سريع
        </button>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold disabled:opacity-50"
        >
          <Icon name="ArrowPathIcon" size={14} className={loading ? 'animate-spin' : ''} />
          تحديث
        </button>
      </header>

      <section className="shrink-0 px-4 py-3 grid grid-cols-2 lg:grid-cols-5 gap-3 border-b border-slate-800 bg-slate-950">
        {tickerCards.map((c) => (
          <div key={c.label} className={`rounded-2xl border ${c.tone} bg-slate-900 p-3`}>
            <p className="text-[11px] text-slate-400 font-semibold mb-1 leading-snug min-h-[30px]">{c.label}</p>
            <p className="text-xl font-extrabold tabular-nums" dir="ltr">{c.value}</p>
            <p className="text-[10px] text-slate-500 mt-1 leading-snug">{c.sub}</p>
          </div>
        ))}
      </section>

      <div className="shrink-0 px-4 pt-3 flex gap-2 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`whitespace-nowrap px-4 py-2 rounded-xl text-xs font-bold border transition-colors ${
              tab === t.key ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <main className="flex-1 min-h-0 overflow-auto px-4 py-4">
        {error && (
          <div className="mb-3 p-3 rounded-xl bg-red-950/50 border border-red-800 text-xs text-red-200">{error}</div>
        )}
        {loading && incidents.length === 0 && buckets.length === 0 ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-slate-700 border-t-indigo-500 rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {tab === 'infra' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 space-y-3">
                    <h3 className="text-sm font-bold">مجمع اتصالات Supabase وزمن الاستعلام</h3>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="rounded-xl bg-slate-950 border border-slate-800 p-3">
                        <p className="text-slate-400 mb-1">زمن الاستعلام الحالي</p>
                        <p className="text-lg font-bold tabular-nums" dir="ltr">{dbLatency === null ? '—' : `${dbLatency} ms`}</p>
                      </div>
                      <div className="rounded-xl bg-slate-950 border border-slate-800 p-3">
                        <p className="text-slate-400 mb-1">حالة الاتصال</p>
                        <p className={`text-lg font-bold ${error ? 'text-red-300' : 'text-emerald-300'}`}>{error ? 'متعثر' : 'متصل'}</p>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      لا تتوفر قياسات تشبّع مجمع الاتصالات (connection pool) من جهة المتصفح؛ تُعرض هنا أزمنة الاستعلام الفعلية فقط.
                      {loadedAt ? ` آخر تحديث: ${fmtDate(loadedAt)} UTC` : ''}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-bold">مختبر الاتصال وقياس الاستجابة</h3>
                      <button
                        type="button"
                        onClick={runBenchmark}
                        disabled={busy === 'benchmark'}
                        className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-xs font-bold"
                      >
                        {busy === 'benchmark' ? 'جارٍ القياس…' : 'تشغيل اختبار الاتصال'}
                      </button>
                    </div>
                    {benchmark.length === 0 ? (
                      <p className="text-xs text-slate-500">لم يتم تشغيل الاختبار بعد.</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {benchmark.map((b) => (
                          <li key={b.label} className="flex items-center justify-between rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-xs">
                            <span>{b.label}</span>
                            <span className={`font-bold tabular-nums ${b.ok ? 'text-emerald-300' : 'text-red-300'}`} dir="ltr">
                              {b.ok ? `${b.ms} ms` : 'فشل'}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                  <h3 className="text-sm font-bold mb-3">صحة حاويات التخزين (Storage Buckets)</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {buckets.map((b) => (
                      <div key={b.name} className={`rounded-xl border p-3 ${b.ok ? 'border-emerald-800/50 bg-emerald-950/10' : 'border-red-800/50 bg-red-950/20'}`}>
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs font-bold">{b.label}</p>
                          <span className={`text-[10px] font-bold ${b.ok ? 'text-emerald-300' : 'text-red-300'}`}>{b.ok ? 'سليم' : 'مشكلة'}</span>
                        </div>
                        <p className="text-[11px] text-slate-400" dir="ltr">{b.name}</p>
                        <p className="text-[11px] text-slate-500 mt-1 leading-snug">{b.detail}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {tab === 'gateways' && (
              <div className="space-y-3">
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={pingAll}
                    disabled={busy === 'ping-all'}
                    className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-xs font-bold"
                  >
                    {busy === 'ping-all' ? 'جارٍ الفحص…' : 'فحص كل البوابات'}
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {GATEWAYS.map((g) => {
                    const st = gateways[g.key];
                    const tone =
                      st.status === 'ok' ? 'border-emerald-800/60' : st.status === 'fail' ? 'border-red-800/60' : 'border-slate-800';
                    return (
                      <div key={g.key} className={`rounded-2xl border ${tone} bg-slate-900 p-4 space-y-2`}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-bold" dir="ltr">{g.label}</p>
                            <p className="text-[11px] text-slate-400 mt-0.5">{g.desc}</p>
                          </div>
                          <span
                            className={`shrink-0 px-2 py-1 rounded-lg text-[10px] font-bold ${
                              st.status === 'ok' ?'bg-emerald-900/50 text-emerald-300'
                                : st.status === 'fail' ?'bg-red-900/50 text-red-300'
                                  : st.status === 'checking' ?'bg-amber-900/40 text-amber-300' :'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {st.status === 'ok' ? 'يعمل' : st.status === 'fail' ? 'متعطل' : st.status === 'checking' ? 'جارٍ الفحص' : 'لم يُفحص'}
                          </span>
                        </div>
                        {st.at && (
                          <p className="text-[11px] text-slate-400 leading-snug">
                            {st.detail} {st.status === 'ok' ? `— ${st.ms}ms` : ''} <span className="text-slate-600" dir="ltr">({fmtDate(st.at)})</span>
                          </p>
                        )}
                        <button
                          type="button"
                          onClick={() => pingGateway(g.key)}
                          disabled={st.status === 'checking'}
                          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-xs font-semibold"
                        >
                          فحص الاتصال اللحظي (Ping Gateway)
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {tab === 'errors' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <p className="text-xs text-slate-400">{visibleIncidents.length} حادث معروض</p>
                  <label className="inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input type="checkbox" className="accent-indigo-500" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} />
                    إظهار الحوادث المحلولة
                  </label>
                </div>
                {visibleIncidents.length === 0 ? (
                  <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center text-xs text-slate-400">
                    لا توجد حوادث مفتوحة حالياً.
                  </div>
                ) : (
                  visibleIncidents.map((inc) => {
                    const d = inc.details || {};
                    const status = d.status || d.http_status || d.statusCode;
                    const route = d.route || d.url || d.endpoint || d.path || inc.source;
                    const ua = d.userAgent || d.user_agent || d.device || '—';
                    const stack = d.stack || d.stack_trace || '';
                    const cause = d.rootCause || d.root_cause || d.cause || '';
                    return (
                      <article key={inc.id} className={`rounded-2xl border p-4 space-y-2 ${sevStyle(inc.severity)} ${inc.resolved ? 'opacity-60' : ''}`}>
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div>
                            <p className="text-sm font-bold" dir="ltr">
                              {d.name || inc.category}
                              {status ? ` · HTTP ${status}` : ''}
                            </p>
                            <p className="text-xs text-slate-200 mt-1 leading-relaxed">{inc.message}</p>
                          </div>
                          <span className="px-2 py-1 rounded-lg bg-black/30 text-[10px] font-bold uppercase" dir="ltr">{inc.severity}</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-slate-300" dir="ltr">
                          <p><span className="text-slate-500">Route:</span> {String(route)}</p>
                          <p><span className="text-slate-500">Time:</span> {fmtDate(inc.createdAt)} UTC</p>
                          <p className="truncate"><span className="text-slate-500">Device:</span> {String(ua)}</p>
                        </div>
                        {stack && (
                          <pre className="text-[10px] bg-black/40 rounded-lg p-2 overflow-auto max-h-28 text-slate-300" dir="ltr">
                            {String(stack).split('\n').slice(0, 6).join('\n')}
                          </pre>
                        )}
                        {cause && <p className="text-[11px] text-slate-300">السبب الجذري: {String(cause)}</p>}
                        {!inc.resolved && (
                          <div className="flex gap-2 pt-1">
                            <button
                              type="button"
                              disabled={busy === `inc-${inc.id}`}
                              onClick={() => resolveIncident(inc)}
                              className="px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-xs font-bold"
                            >
                              تعليم كمحلول (Mark as Resolved)
                            </button>
                            <button
                              type="button"
                              onClick={() => setDismissed((a) => [...a, inc.id])}
                              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold"
                            >
                              تجاهل
                            </button>
                          </div>
                        )}
                      </article>
                    );
                  })
                )}
              </div>
            )}

            {tab === 'audit' && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-auto">
                <div className="px-4 py-3 border-b border-slate-800 text-[11px] text-slate-400">
                  سجل غير قابل للتعديل أو الحذف — يتم تسجيل الأحداث الحرجة تلقائياً.
                </div>
                {audit.length === 0 ? (
                  <p className="p-8 text-center text-xs text-slate-400">لا توجد أحداث مسجلة بعد.</p>
                ) : (
                  <table className="w-full text-xs">
                    <thead className="text-slate-400 bg-slate-950">
                      <tr>
                        <th className="p-2 text-right">الوقت (UTC)</th>
                        <th className="p-2 text-right">الحدث</th>
                        <th className="p-2 text-right">المنفّذ</th>
                        <th className="p-2 text-right">الوصف</th>
                        <th className="p-2 text-right">IP</th>
                        <th className="p-2 text-right">الموقع</th>
                      </tr>
                    </thead>
                    <tbody>
                      {audit.map((a) => {
                        const alert = /fail|brute|denied/i.test(a.eventType);
                        return (
                          <tr key={a.id} className={`border-t border-slate-800 ${alert ? 'bg-red-950/30' : ''}`}>
                            <td className="p-2 whitespace-nowrap tabular-nums" dir="ltr">{fmtDate(a.createdAt)}</td>
                            <td className="p-2">
                              <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${alert ? 'bg-red-900/60 text-red-200' : 'bg-slate-800 text-slate-200'}`} dir="ltr">
                                {a.eventType}
                              </span>
                            </td>
                            <td className="p-2" dir="ltr">{a.actor} <span className="text-slate-500">({a.role})</span></td>
                            <td className="p-2">{a.description}</td>
                            <td className="p-2" dir="ltr">{a.ip}</td>
                            <td className="p-2">{a.geo}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {tab === 'devops' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className={`rounded-2xl border p-4 space-y-3 ${maintenance ? 'border-red-700/60 bg-red-950/20' : 'border-slate-800 bg-slate-900'}`}>
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-bold">وضع الصيانة الشامل (Master Maintenance Mode)</h3>
                    <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-semibold">
                      <input
                        type="checkbox"
                        className="accent-red-500 w-4 h-4"
                        checked={maintenance}
                        disabled={busy === 'maintenance'}
                        onChange={(e) => toggleMaintenance(e.target.checked)}
                      />
                      {maintenance ? 'مفعّل' : 'متوقف'}
                    </label>
                  </div>
                  <textarea
                    className={`${inputCls} min-h-[90px]`}
                    value={maintenanceMsg}
                    onChange={(e) => setMaintenanceMsg(e.target.value)}
                    placeholder="رسالة الإعلان بالعربية"
                  />
                  <button
                    type="button"
                    onClick={saveMaintenanceMessage}
                    disabled={busy === 'maintenance-msg'}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-xs font-semibold"
                  >
                    حفظ رسالة الإعلان
                  </button>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    يُحفظ المفتاح في إعدادات المنصة. يحتاج السوق العام إلى قراءة المفتاح <span dir="ltr">system_maintenance_mode</span> لعرض اللافتة وتجاوز المدراء المعتمدين.
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 space-y-3">
                  <h3 className="text-sm font-bold">إبطال الكاش وتفريغ الـ CDN</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    يسجّل طلب الإبطال ويفرّغ كاش المتصفح الحالي. آخر طلب: <span dir="ltr">{lastPurge ? fmtDate(lastPurge) : '—'}</span>
                  </p>
                  <button
                    type="button"
                    onClick={purgeCache}
                    disabled={busy === 'purge'}
                    className="px-3 py-2 rounded-xl bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-xs font-bold"
                  >
                    {busy === 'purge' ? 'جارٍ التنفيذ…' : 'إبطال الكاش وتفريغ الـ CDN'}
                  </button>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 space-y-3 lg:col-span-2">
                  <h3 className="text-sm font-bold">الحد الأدنى المطلوب لإصدار التطبيق</h3>
                  <p className="text-xs text-slate-400">يُجبر عملاء الجوال ذوو الإصدار الأقل على التحديث.</p>
                  <div className="flex gap-2 max-w-sm">
                    <input dir="ltr" className={inputCls} value={minVersion} onChange={(e) => setMinVersion(e.target.value)} placeholder="1.0.0" />
                    <button
                      type="button"
                      onClick={saveMinVersion}
                      disabled={busy === 'min-version'}
                      className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-xs font-bold whitespace-nowrap"
                    >
                      حفظ
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {staffOpen && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-5">
            <h3 className="font-bold text-sm mb-3">+ تعيين مهندس برمجيات ونظام</h3>
            {staffResult ? (
              <div className="space-y-3 text-xs">
                <p className="text-emerald-300 font-semibold">تم إنشاء الحساب بنجاح. سلّم بيانات الدخول المؤقتة للمهندس:</p>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1" dir="ltr">
                  <p>Email: <span className="font-bold">{staffResult.email}</span></p>
                  <p>Temp password: <span className="font-bold">{staffResult.tempPassword}</span></p>
                </div>
                <div className="flex justify-end">
                  <button type="button" onClick={closeStaff} className="px-3 py-2 rounded-xl bg-slate-800 text-xs font-semibold">إغلاق</button>
                </div>
              </div>
            ) : (
              <form onSubmit={submitStaff} className="space-y-3">
                <input required className={inputCls} placeholder="الاسم الكامل" value={staffForm.fullName} onChange={(e) => setStaffForm({ ...staffForm, fullName: e.target.value })} />
                <input required type="email" dir="ltr" className={inputCls} placeholder="Engineer Email" value={staffForm.email} onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })} />
                <select className={inputCls} value={staffForm.specialization} onChange={(e) => setStaffForm({ ...staffForm, specialization: e.target.value })}>
                  <option value="DevOps">DevOps</option>
                  <option value="Frontend">Frontend</option>
                  <option value="Backend">Backend</option>
                </select>
                <input disabled className={`${inputCls} opacity-60`} value="SYSTEM_ENGINEER" readOnly />
                {staffErr && <p className="text-xs text-red-300">{staffErr}</p>}
                <div className="flex gap-2 justify-end">
                  <button type="button" onClick={closeStaff} className="px-3 py-2 rounded-xl bg-slate-800 text-xs font-semibold">إلغاء</button>
                  <button type="submit" disabled={staffBusy} className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-xs font-bold">
                    {staffBusy ? 'جارٍ الإنشاء…' : 'إنشاء الحساب'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[70] px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs font-semibold shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
