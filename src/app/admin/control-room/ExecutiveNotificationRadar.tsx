'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';
import { useLanguage } from '@/contexts/LanguageContext';

// ─── Types ────────────────────────────────────────────────────────────────────
interface ExecutiveAlert {
  id: string;
  type: 'registration_failure' | 'product_upload_error' | 'escrow_delay' | 'missing_data' | 'expansion_opportunity' | 'critical_system' | 'supplier_escalation';
  severity: 'critical' | 'warning' | 'info' | 'opportunity';
  title: string;
  body: string;
  source: string;
  reference_id?: string;
  created_at: string;
  is_read: boolean;
  is_acknowledged?: boolean;
  action_taken?: string;
}

const TYPE_ICONS: Record<string, string> = {
  registration_failure: 'UserMinusIcon',
  product_upload_error: 'ExclamationTriangleIcon',
  escrow_delay: 'ClockIcon',
  missing_data: 'DocumentMagnifyingGlassIcon',
  expansion_opportunity: 'ArrowTrendingUpIcon',
  critical_system: 'ShieldExclamationIcon',
  supplier_escalation: 'ArrowUpCircleIcon',
};

const TYPE_LABELS: Record<string, string> = {
  registration_failure: 'تعثر تسجيل',
  product_upload_error: 'خطأ رفع منتج',
  escrow_delay: 'تأخير Escrow',
  missing_data: 'رادار النواقص',
  expansion_opportunity: 'فرصة توسع',
  critical_system: 'نظام حرج',
  supplier_escalation: 'تصعيد مورد',
};

// Admin WhatsApp number (primary manager)
const ADMIN_WHATSAPP = '771577632';

function formatDate(d: string): string {
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '—';
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  const h = String(dt.getHours()).padStart(2, '0');
  const min = String(dt.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} ${h}:${min}`;
}

// ─── Main Panel ──────────────────────────────────────────────────────────────
export default function ExecutiveNotificationRadar() {
  const { t, dir, language, isRTL } = useLanguage();
  const ui = t?.admin?.executiveRadar ?? {
    title: 'Executive Notification Radar',
    subtitle: 'Real-time executive alerts across the platform',
    empty: 'No radar alerts',
    critical: 'Critical',
    warning: 'Warning',
    info: 'Info',
    opportunity: 'Opportunity',
    live: 'Live',
    primaryWaAdmin: 'Primary WhatsApp notification admin',
    phoneReceives: 'Fixed mobile number: {phone} — receives all critical alerts and events instantly',
    alertCount: '{count} alert(s)',
    noAlertsTitle: 'No executive alerts',
    noAlertsHint: 'The platform is running efficiently',
    filterAll: 'All',
  };

  const SEVERITY_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; dot: string }> = {
    critical: { label: ui.critical, color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', dot: 'bg-red-500' },
    warning: { label: ui.warning, color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', dot: 'bg-amber-500' },
    info: { label: ui.info, color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', dot: 'bg-blue-500' },
    opportunity: { label: ui.opportunity, color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  };

  const supabase = createClient();
  const [alerts, setAlerts] = useState<ExecutiveAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'critical' | 'warning' | 'info' | 'opportunity'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [sendingWhatsApp, setSendingWhatsApp] = useState<string | null>(null);
  const [whatsAppStatus, setWhatsAppStatus] = useState<Record<string, boolean>>({});
  const [adminPhone] = useState(ADMIN_WHATSAPP);
  const [refreshing, setRefreshing] = useState(false);
  const [acknowledging, setAcknowledging] = useState<string | null>(null);

  // ── Load from executive_alerts DB table first, then rebuild if empty ──────
  const loadFromDB = useCallback(async (): Promise<ExecutiveAlert[]> => {
    try {
      const { data } = await supabase
        .from('executive_alerts')
        .select('alert_key, type, title, body, severity, is_acknowledged, generated_at')
        .order('generated_at', { ascending: false })
        .limit(50);

      if (data && data.length > 0) {
        return data.map((row: any) => ({
          id: row.alert_key,
          type: row.type,
          severity: row.severity,
          title: row.title,
          body: row.body,
          source: '—',
          created_at: row.generated_at,
          is_read: row.is_acknowledged,
          is_acknowledged: row.is_acknowledged,
        }));
      }
    } catch {
      // Table may not exist yet — fall through to rebuild
    }
    return [];
  }, [supabase]);

  const buildExecutiveAlerts = useCallback(async () => {
    setLoading(true);
    const collected: ExecutiveAlert[] = [];
    const now = new Date();

    try {
      // 1. Registration failures — pending factories > 72h
      const { data: pendingFactories } = await supabase
        .from('factory_registrations')
        .select('id, company_name, contact_email, submitted_at, registration_status')
        .eq('registration_status', 'pending')
        .lt('submitted_at', new Date(now.getTime() - 72 * 60 * 60 * 1000).toISOString())
        .limit(10);

      (pendingFactories || []).forEach((f: any) => {
        collected.push({
          id: `reg_${f.id}`,
          type: 'registration_failure',
          severity: 'warning',
          title: `تعثر تسجيل: ${f.company_name || 'مصنع'}`,
          body: `طلب التسجيل معلق منذ أكثر من 72 ساعة دون مراجعة. البريد: ${f.contact_email || '—'}`,
          source: 'نظام التسجيل',
          reference_id: f.id,
          created_at: f.submitted_at || now.toISOString(),
          is_read: false,
          is_acknowledged: false,
        });
      });

      // 2. Escalated supplier alerts
      const { data: escalated } = await supabase
        .from('supplier_alerts')
        .select('id, product_name, manufacturer_name, missing_fields, escalated_at')
        .eq('status', 'escalated')
        .order('escalated_at', { ascending: false })
        .limit(10);

      (escalated || []).forEach((a: any) => {
        const fields = (a.missing_fields as string[] || []).join('، ');
        collected.push({
          id: `esc_${a.id}`,
          type: 'supplier_escalation',
          severity: 'critical',
          title: `🔴 تصعيد: ${a.product_name || 'منتج'}`,
          body: `المورد "${a.manufacturer_name || '—'}" لم يستجب. الحقول الناقصة: ${fields}. يتطلب تدخلاً فورياً.`,
          source: 'محرك تنبيهات الموردين',
          reference_id: a.id,
          created_at: a.escalated_at || now.toISOString(),
          is_read: false,
          is_acknowledged: false,
        });
      });

      // 3. Escrow delays — orders in escrow > 7 days
      const { data: escrowOrders } = await supabase
        .from('orders')
        .select('id, order_number, total_amount, currency, created_at, escrow_status')
        .eq('escrow_status', 'held')
        .lt('created_at', new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .limit(10);

      (escrowOrders || []).forEach((o: any) => {
        collected.push({
          id: `escrow_${o.id}`,
          type: 'escrow_delay',
          severity: 'warning',
          title: `تأخير Escrow: طلب #${o.order_number || o.id.slice(0, 8)}`,
          body: `الأموال محتجزة منذ أكثر من 7 أيام. المبلغ: ${o.currency || 'USD'} ${Number(o.total_amount || 0).toLocaleString('en-US')}`,
          source: 'نظام الضمان المالي',
          reference_id: o.id,
          created_at: o.created_at,
          is_read: false,
          is_acknowledged: false,
        });
      });

      // 4. Products with missing data (open alerts)
      const { data: openAlerts } = await supabase
        .from('supplier_alerts')
        .select('id, product_name, manufacturer_name, missing_fields, created_at')
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(5);

      if ((openAlerts || []).length > 0) {
        collected.push({
          id: `missing_data_summary`,
          type: 'missing_data',
          severity: 'info',
          title: `رادار النواقص: ${openAlerts!.length} منتج يحتاج تحديثاً`,
          body: `منتجات تحتاج إلى بيانات ناقصة: ${openAlerts!.map((a: any) => a.product_name || '—').slice(0, 3).join('، ')}${openAlerts!.length > 3 ? ` و${openAlerts!.length - 3} آخرين` : ''}`,
          source: 'الماسح الشامل',
          created_at: now.toISOString(),
          is_read: false,
          is_acknowledged: false,
        });
      }

      // 5. Expansion opportunity — new manufacturers this week
      const { data: newManufacturers } = await supabase
        .from('user_profiles')
        .select('id, full_name, company_name, created_at')
        .eq('role', 'manufacturer')
        .gte('created_at', new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .limit(20);

      if ((newManufacturers || []).length >= 3) {
        collected.push({
          id: `expansion_${now.getTime()}`,
          type: 'expansion_opportunity',
          severity: 'opportunity',
          title: `فرصة توسع: ${newManufacturers!.length} مورد جديد هذا الأسبوع`,
          body: `انضم ${newManufacturers!.length} مورد جديد خلال 7 أيام. فرصة لتفعيل حملة ترحيب وتسريع الإعداد.`,
          source: 'رادار النمو',
          created_at: now.toISOString(),
          is_read: false,
          is_acknowledged: false,
        });
      }

      // Sort by severity then date
      const severityOrder = { critical: 0, warning: 1, info: 2, opportunity: 3 };
      collected.sort((a, b) => {
        const sA = severityOrder[a.severity] ?? 4;
        const sB = severityOrder[b.severity] ?? 4;
        if (sA !== sB) return sA - sB;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      // ── Upsert into executive_alerts table (Fix 5) ──────────────────────
      if (collected.length > 0) {
        try {
          await supabase.from('executive_alerts').upsert(
            collected.map(a => ({
              alert_key: a.id,
              type: a.type,
              title: a.title,
              body: a.body,
              severity: a.severity,
              is_acknowledged: false,
              generated_at: a.created_at,
            })),
            { onConflict: 'alert_key', ignoreDuplicates: true }
          );
        } catch {
          // Table may not exist yet — silently ignore
        }
      }

      // ── Now load from DB to get persisted acknowledgement state ──────────
      const fromDB = await loadFromDB();
      if (fromDB.length > 0) {
        // Merge: use DB acknowledgement state for matching alerts
        const dbMap = new Map(fromDB.map(a => [a.id, a]));
        const merged = collected.map(a => ({
          ...a,
          is_acknowledged: dbMap.get(a.id)?.is_acknowledged ?? false,
        }));
        setAlerts(merged);
      } else {
        setAlerts(collected);
      }
    } catch (e) {
      console.error('Executive radar error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [supabase, loadFromDB]);

  useEffect(() => {
    buildExecutiveAlerts();
  }, [buildExecutiveAlerts]);

  const handleRefresh = () => {
    setRefreshing(true);
    buildExecutiveAlerts();
  };

  // ── Fix 5: Acknowledge alert ──────────────────────────────────────────────
  const handleAcknowledge = async (alertId: string) => {
    setAcknowledging(alertId);
    try {
      await supabase
        .from('executive_alerts')
        .update({ is_acknowledged: true })
        .eq('alert_key', alertId);

      setAlerts(prev =>
        prev.map(a => a.id === alertId ? { ...a, is_acknowledged: true } : a)
      );
    } catch {
      // silent
    } finally {
      setAcknowledging(null);
    }
  };

  const handleSendWhatsApp = async (alert: ExecutiveAlert) => {
    setSendingWhatsApp(alert.id);
    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: adminPhone,
          type: 'executive_alert',
          title: alert.title,
          body: alert.body,
          severity: alert.severity,
        }),
      });
      const data = await res.json();
      setWhatsAppStatus((prev) => ({ ...prev, [alert.id]: data.success || false }));
    } catch {
      setWhatsAppStatus((prev) => ({ ...prev, [alert.id]: false }));
    } finally {
      setSendingWhatsApp(null);
    }
  };

  const filtered = alerts.filter((a) => {
    const matchSeverity = filter === 'all' || a.severity === filter;
    const matchType = typeFilter === 'all' || a.type === typeFilter;
    return matchSeverity && matchType;
  });

  const stats = {
    critical: alerts.filter((a) => a.severity === 'critical').length,
    warning: alerts.filter((a) => a.severity === 'warning').length,
    info: alerts.filter((a) => a.severity === 'info').length,
    opportunity: alerts.filter((a) => a.severity === 'opportunity').length,
  };

  const acknowledgedCount = alerts.filter(a => a.is_acknowledged).length;

  return (
    <div className="space-y-5" dir={dir}>
      {/* ── Header ── */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl p-5 text-white">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center shrink-0">
            <Icon name="SignalIcon" size={28} className="text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold">{ui.title}</h2>
            <p className="text-sm text-white/70">{ui.subtitle}</p>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-semibold text-white/90">{ui.live}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white/10 rounded-lg px-2 py-1">
              <Icon name="PhoneIcon" size={12} className="text-emerald-400" />
              <span className="text-xs font-mono text-white/90">{adminPhone}</span>
            </div>
            {acknowledgedCount > 0 && (
              <div className="flex items-center gap-1.5 bg-emerald-500/20 rounded-lg px-2 py-1">
                <Icon name="CheckCircleIcon" size={12} className="text-emerald-400" />
                <span className="text-xs text-emerald-300">{acknowledgedCount} مؤكد</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Admin WhatsApp Config Banner ── */}
      <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
        <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
          <Icon name="ChatBubbleLeftRightIcon" size={20} className="text-emerald-700" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-emerald-800">{ui.primaryWaAdmin}</p>
          <p className="text-xs text-emerald-600">
            {ui.phoneReceives.replace('{phone}', adminPhone)}
          </p>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg">
          <Icon name="CheckCircleIcon" size={14} />
          مُفعَّل
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { key: 'critical', label: ui.critical, icon: 'ShieldExclamationIcon', color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
          { key: 'warning', label: ui.warning, icon: 'ExclamationTriangleIcon', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
          { key: 'info', label: ui.info, icon: 'InformationCircleIcon', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
          { key: 'opportunity', label: ui.opportunity, icon: 'ArrowTrendingUpIcon', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
        ].map((s) => (
          <button
            key={s.key}
            onClick={() => setFilter(s.key as any)}
            className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
              filter === s.key ? `${s.bg} border-current` : 'bg-card border-border hover:border-current'
            }`}
          >
            <Icon name={s.icon as any} size={20} className={s.color} />
            <div className="text-start">
              <p className={`text-xl font-bold ${s.color}`}>{stats[s.key as keyof typeof stats]}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          </button>
        ))}
      </div>

      {/* ── Type Filter ── */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setTypeFilter('all')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${typeFilter === 'all' ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border hover:bg-muted'}`}
        >
          الكل
        </button>
        {Object.entries(TYPE_LABELS).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTypeFilter(key)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${typeFilter === key ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border hover:bg-muted'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Controls ── */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleRefresh}
          disabled={refreshing || loading}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 text-white text-sm font-bold rounded-xl hover:bg-slate-700 transition-colors disabled:opacity-60"
        >
          {refreshing ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Icon name="ArrowPathIcon" size={16} />
          )}
          تحديث الرادار
        </button>
        <span className="text-xs text-muted-foreground">{ui.alertCount.replace('{count}', String(filtered.length))}</span>
      </div>

      {/* ── Alert Feed ── */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-slate-800 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Icon name="CheckCircleIcon" size={48} className="text-emerald-400" />
          <p className="text-base font-bold text-foreground">{ui.noAlertsTitle}</p>
          <p className="text-sm text-muted-foreground">{ui.noAlertsHint}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((alert) => {
            const cfg = SEVERITY_CONFIG[alert.severity];
            const iconName = TYPE_ICONS[alert.type] || 'BellAlertIcon';
            const waStatus = whatsAppStatus[alert.id];
            const isAcknowledged = alert.is_acknowledged;
            return (
              <div
                key={alert.id}
                className={`flex gap-4 p-4 rounded-xl border transition-all ${
                  isAcknowledged
                    ? 'bg-slate-50 border-slate-200 opacity-70'
                    : `${cfg.bg} ${cfg.border}`
                }`}
              >
                {/* Severity dot + icon */}
                <div className="flex flex-col items-center gap-2 shrink-0 pt-0.5">
                  <div className={`w-2.5 h-2.5 rounded-full ${isAcknowledged ? 'bg-slate-400' : `${cfg.dot} animate-pulse`}`} />
                  <Icon name={iconName as any} size={18} className={isAcknowledged ? 'text-slate-400' : cfg.color} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className={`text-sm font-bold leading-snug ${isAcknowledged ? 'text-slate-500 line-through' : cfg.color}`}>
                      {alert.title}
                    </p>
                    <div className="flex items-center gap-2 shrink-0">
                      {isAcknowledged ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-slate-100 border-slate-300 text-slate-500 flex items-center gap-1">
                          <Icon name="CheckCircleIcon" size={10} />
                          مؤكد
                        </span>
                      ) : (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.border} ${cfg.color}`}>
                          {cfg.label}
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-2">{alert.body}</p>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Icon name="TagIcon" size={10} />
                        {TYPE_LABELS[alert.type] || alert.type}
                      </span>
                      <span>{formatDate(alert.created_at)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Acknowledge button (Fix 5) */}
                      {!isAcknowledged && (
                        <button
                          onClick={() => handleAcknowledge(alert.id)}
                          disabled={acknowledging === alert.id}
                          className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold rounded-lg border transition-colors bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                        >
                          {acknowledging === alert.id ? (
                            <div className="w-3 h-3 border border-slate-600 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Icon name="CheckIcon" size={11} />
                          )}
                          تأكيد الاستلام
                        </button>
                      )}
                      {/* WhatsApp send button */}
                      <button
                        onClick={() => handleSendWhatsApp(alert)}
                        disabled={sendingWhatsApp === alert.id || waStatus === true}
                        className={`flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold rounded-lg border transition-colors ${
                          waStatus === true
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 cursor-default' :'bg-white text-emerald-700 border-emerald-300 hover:bg-emerald-50'
                        }`}
                      >
                        {sendingWhatsApp === alert.id ? (
                          <div className="w-3 h-3 border border-emerald-600 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Icon name="ChatBubbleLeftRightIcon" size={11} />
                        )}
                        {waStatus === true ? 'أُرسل ✓' : 'إرسال واتساب'}
                      </button>
                    </div>
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
