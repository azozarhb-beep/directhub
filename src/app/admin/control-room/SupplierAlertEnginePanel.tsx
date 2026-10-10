'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';
import { useLanguage } from '@/contexts/LanguageContext';

// ─── Types ────────────────────────────────────────────────────────────────────
interface SupplierAlert {
  id: string;
  product_id: string;
  manufacturer_id: string;
  missing_fields: string[];
  status: 'open' | 'notified' | 'resolved' | 'escalated' | 'dismissed';
  notified_at: string | null;
  deadline_at: string | null;
  resolved_at: string | null;
  escalated_at: string | null;
  dismissed_at: string | null;
  admin_note: string | null;
  whatsapp_sent: boolean;
  product_name: string | null;
  manufacturer_name: string | null;
  manufacturer_phone: string | null;
  created_at: string;
  updated_at: string;
}

const FIELD_LABELS: Record<string, string> = {
  price: 'السعر',
  image: 'الصورة',
  quantity: 'الكمية',
  name: 'الاسم',
  description: 'الوصف',
  category: 'الفئة',
  sku: 'كود المنتج',
  origin_country: 'بلد المنشأ',
};

const STATUS_META: Record<string, { color: string; bg: string; icon: string }> = {
  open: { color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', icon: 'ExclamationTriangleIcon' },
  notified: { color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', icon: 'BellAlertIcon' },
  resolved: { color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', icon: 'CheckCircleIcon' },
  escalated: { color: 'text-red-700', bg: 'bg-red-50 border-red-200', icon: 'ArrowUpCircleIcon' },
  dismissed: { color: 'text-gray-500', bg: 'bg-gray-50 border-gray-200', icon: 'XCircleIcon' },
};

function formatTimeLeft(deadlineAt: string | null): { text: string; urgent: boolean } {
  if (!deadlineAt) return { text: '—', urgent: false };
  const diff = new Date(deadlineAt).getTime() - Date.now();
  if (diff <= 0) return { text: 'انتهت المهلة', urgent: true };
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const urgent = hours < 6;
  if (hours >= 24) return { text: `${Math.floor(hours / 24)} يوم`, urgent: false };
  return { text: `${hours}س ${mins}د`, urgent };
}

function formatDate(d: string | null): string {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '—';
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  const h = String(dt.getHours()).padStart(2, '0');
  const min = String(dt.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} ${h}:${min}`;
}

// ─── Main Panel ───────────────────────────────────────────────────────────────
export default function SupplierAlertEnginePanel() {
  const { t, dir, language, isRTL } = useLanguage();
  const ui = t.admin.supplierAlerts;
  const statusLabels: Record<string, string> = {
    open: ui.statusOpen,
    notified: ui.statusNotified,
    resolved: ui.statusResolved,
    escalated: ui.statusEscalated,
    dismissed: ui.statusDismissed,
  };

  const supabase = createClient();
  const [alerts, setAlerts] = useState<SupplierAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [filter, setFilter] = useState<'all' | 'open' | 'notified' | 'escalated' | 'resolved' | 'dismissed'>('all');
  const [selectedAlert, setSelectedAlert] = useState<SupplierAlert | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<{ scanned: number; alertsCreated: number; alertsResolved: number; escalated: number } | null>(null);
  const [lastScan, setLastScan] = useState<string | null>(null);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/supplier-alerts?status=all');
      const data = await res.json();
      setAlerts(data.alerts || []);
    } catch {
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
    // Auto-escalate overdue on load
    fetch('/api/supplier-alerts?action=escalate').catch(() => {});
  }, [fetchAlerts]);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('supplier_alerts_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'supplier_alerts' }, () => {
        fetchAlerts();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase, fetchAlerts]);

  const handleScanAll = async () => {
    setScanning(true);
    setScanResult(null);
    try {
      const res = await fetch('/api/supplier-alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'scan_all' }),
      });
      const data = await res.json();
      setScanResult(data);
      setLastScan(new Date().toISOString());
      await fetchAlerts();
    } catch {
      // ignore
    } finally {
      setScanning(false);
    }
  };

  const handleAction = async (action: 'dismiss' | 'resolve' | 'renotify', alert: SupplierAlert) => {
    setActionLoading(alert.id + action);
    try {
      await fetch('/api/supplier-alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, alertId: alert.id, adminNote }),
      });
      setSelectedAlert(null);
      setAdminNote('');
      await fetchAlerts();
    } finally {
      setActionLoading(null);
    }
  };

  const filtered = alerts.filter((a) => filter === 'all' || a.status === filter);

  const stats = {
    all: alerts.length,
    open: alerts.filter((a) => a.status === 'open').length,
    notified: alerts.filter((a) => a.status === 'notified').length,
    escalated: alerts.filter((a) => a.status === 'escalated').length,
    resolved: alerts.filter((a) => a.status === 'resolved').length,
    dismissed: alerts.filter((a) => a.status === 'dismissed').length,
  };

  return (
    <div className="space-y-5" dir={dir}>
      {/* ── Header ── */}
      <div className="bg-gradient-to-r from-red-600 to-orange-600 rounded-2xl p-5 text-white">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
            <Icon name="BellAlertIcon" size={28} className="text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold">{ui.title}</h2>
            <p className="text-sm text-white/80">{ui.subtitle}</p>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-semibold text-white/90">{ui.live}</span>
            </div>
            {stats.escalated > 0 && (
              <span className="px-2 py-0.5 bg-white text-red-600 text-xs font-bold rounded-full animate-pulse">
                {ui.escalatedCount.replace('{count}', String(stats.escalated))} 🔴
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── How it works ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { step: '1', icon: 'MagnifyingGlassIcon', label: ui.stepScan, desc: ui.stepScanDesc, color: 'bg-blue-50 border-blue-200 text-blue-700' },
          { step: '2', icon: 'BellAlertIcon', label: ui.stepNotify, desc: ui.stepNotifyDesc, color: 'bg-amber-50 border-amber-200 text-amber-700' },
          { step: '3', icon: 'ClockIcon', label: ui.stepDeadline, desc: ui.stepDeadlineDesc, color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
          { step: '4', icon: 'ArrowUpCircleIcon', label: ui.stepEscalate, desc: ui.stepEscalateDesc, color: 'bg-red-50 border-red-200 text-red-700' },
        ].map((s) => (
          <div key={s.step} className={`flex flex-col gap-2 p-3 rounded-xl border ${s.color}`}>
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-current/20 flex items-center justify-center text-[10px] font-bold">{s.step}</span>
              <Icon name={s.icon as any} size={14} />
              <span className="text-xs font-bold">{s.label}</span>
            </div>
            <p className="text-[10px] leading-relaxed opacity-80">{s.desc}</p>
          </div>
        ))}
      </div>

      {/* ── Scan Controls ── */}
      <div className="flex flex-wrap items-center gap-3 p-4 bg-card border border-border rounded-xl">
        <button
          onClick={handleScanAll}
          disabled={scanning}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground text-sm font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-60"
        >
          {scanning ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Icon name="MagnifyingGlassIcon" size={16} />
          )}
          {scanning ? ui.scanning : ui.scanAll}
        </button>
        <button
          onClick={fetchAlerts}
          className="flex items-center gap-2 px-3 py-2.5 border border-border text-sm font-semibold rounded-xl hover:bg-muted transition-colors"
        >
          <Icon name="ArrowPathIcon" size={15} />
          {ui.refresh}
        </button>
        {lastScan && (
          <span className="text-xs text-muted-foreground">{ui.lastScan}: {formatDate(lastScan)}</span>
        )}
        {scanResult && (
          <div className="flex items-center gap-3 text-xs font-semibold">
            <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-lg border border-blue-200">
              فُحص: {scanResult.scanned}
            </span>
            <span className="px-2 py-1 bg-amber-50 text-amber-700 rounded-lg border border-amber-200">
              تنبيهات جديدة: {scanResult.alertsCreated}
            </span>
            <span className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-200">
              حُلَّت: {scanResult.alertsResolved}
            </span>
            {scanResult.escalated > 0 && (
              <span className="px-2 py-1 bg-red-50 text-red-700 rounded-lg border border-red-200">
                صُعِّدت: {scanResult.escalated}
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Stats Tabs ── */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {([
          { key: 'all', label: ui.filterAll, value: stats.all, color: 'text-foreground bg-muted' },
          { key: 'open', label: 'مفتوح', value: stats.open, color: 'text-amber-700 bg-amber-50 border-amber-200' },
          { key: 'notified', label: 'تم الإشعار', value: stats.notified, color: 'text-blue-700 bg-blue-50 border-blue-200' },
          { key: 'escalated', label: 'مُصعَّد 🔴', value: stats.escalated, color: 'text-red-700 bg-red-50 border-red-200' },
          { key: 'resolved', label: 'محلول ✅', value: stats.resolved, color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
          { key: 'dismissed', label: 'مُغلق', value: stats.dismissed, color: 'text-gray-500 bg-gray-50 border-gray-200' },
        ] as const).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${
              filter === tab.key ? `${tab.color} border-current shadow-sm` : 'bg-card border-border hover:border-muted-foreground/30'
            }`}
          >
            <span className="text-xl font-bold">{tab.value}</span>
            <span className="text-[10px] font-semibold leading-tight text-center">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ── Alerts Table ── */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Icon name="TableCellsIcon" size={16} className="text-red-600" />
            <h3 className="font-semibold text-foreground">قائمة التنبيهات</h3>
            <span className="text-xs text-muted-foreground">({filtered.length} تنبيه)</span>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Icon name="CheckCircleIcon" size={40} className="text-emerald-400" />
            <p className="text-sm font-semibold text-muted-foreground">
              {filter === 'all' ? '{ui.empty} — جميع المنتجات مكتملة ✅' : '{ui.empty} في هذه الفئة'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-6 px-6 sm:mx-0 sm:px-0">
            <table className="w-full text-sm min-w-[500px]" dir={dir}>
              <thead className="bg-muted/40 border-b border-border">
                <tr>
                  <th className="text-right px-4 py-3 text-xs font-bold text-muted-foreground">المنتج</th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-muted-foreground">المورد</th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-muted-foreground">الحقول الناقصة</th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-muted-foreground">الحالة</th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-muted-foreground">المهلة المتبقية</th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-muted-foreground">واتساب</th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-muted-foreground">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((alert) => {
                  const sc = STATUS_META[alert.status] || STATUS_META.open;
                  const timeLeft = formatTimeLeft(alert.deadline_at);
                  return (
                    <tr
                      key={alert.id}
                      className={`hover:bg-muted/20 transition-colors ${alert.status === 'escalated' ? 'bg-red-50/30' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <p className="font-semibold text-foreground text-sm truncate max-w-[160px]">
                          {alert.product_name || '—'}
                        </p>
                        <p className="text-[10px] text-muted-foreground">{formatDate(alert.created_at)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground text-xs">{alert.manufacturer_name || '—'}</p>
                        {alert.manufacturer_phone && (
                          <p className="text-[10px] text-muted-foreground">{alert.manufacturer_phone}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(alert.missing_fields || []).map((f) => (
                            <span key={f} className="px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-semibold rounded">
                              {FIELD_LABELS[f] || f}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold border ${sc.bg} ${sc.color}`}>
                          <Icon name={sc.icon as any} size={10} />
                          {statusLabels[alert.status] || alert.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {alert.status === 'notified' || alert.status === 'open' ? (
                          <span className={`text-xs font-bold ${timeLeft.urgent ? 'text-red-600 animate-pulse' : 'text-muted-foreground'}`}>
                            {timeLeft.text}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {alert.whatsapp_sent ? (
                          <span className="flex items-center gap-1 text-emerald-600 text-[10px] font-semibold">
                            <Icon name="CheckCircleIcon" size={12} />
                            أُرسل
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => { setSelectedAlert(alert); setAdminNote(alert.admin_note || ''); }}
                          className="px-2.5 py-1 bg-primary/10 text-primary text-xs font-semibold rounded-lg hover:bg-primary/20 transition-colors border border-primary/20"
                        >
                          إجراء
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Alert Detail Modal ── */}
      {selectedAlert && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setSelectedAlert(null)}
        >
          <div
            className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg"
            onClick={(e) => e.stopPropagation()}
            dir={dir}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Icon name="BellAlertIcon" size={18} className="text-red-600" />
                <h3 className="font-bold text-foreground">تفاصيل التنبيه</h3>
              </div>
              <button
                onClick={() => setSelectedAlert(null)}
                className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center"
              >
                <Icon name="XMarkIcon" size={16} className="text-muted-foreground" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Product & Supplier */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-muted/40 rounded-xl">
                  <p className="text-[10px] text-muted-foreground mb-1">المنتج</p>
                  <p className="text-sm font-bold text-foreground">{selectedAlert.product_name || '—'}</p>
                </div>
                <div className="p-3 bg-muted/40 rounded-xl">
                  <p className="text-[10px] text-muted-foreground mb-1">المورد</p>
                  <p className="text-sm font-bold text-foreground">{selectedAlert.manufacturer_name || '—'}</p>
                  {selectedAlert.manufacturer_phone && (
                    <p className="text-[10px] text-muted-foreground">{selectedAlert.manufacturer_phone}</p>
                  )}
                </div>
              </div>

              {/* Missing Fields */}
              <div>
                <p className="text-xs font-bold text-muted-foreground mb-2">الحقول الناقصة</p>
                <div className="flex flex-wrap gap-2">
                  {(selectedAlert.missing_fields || []).map((f) => (
                    <span key={f} className="px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold rounded-lg">
                      ⚠️ {FIELD_LABELS[f] || f}
                    </span>
                  ))}
                </div>
              </div>

              {/* Timeline */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-muted-foreground">الجدول الزمني</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 bg-muted/30 rounded-lg">
                    <p className="text-[10px] text-muted-foreground">تاريخ الاكتشاف</p>
                    <p className="font-semibold">{formatDate(selectedAlert.created_at)}</p>
                  </div>
                  <div className="p-2 bg-muted/30 rounded-lg">
                    <p className="text-[10px] text-muted-foreground">الموعد النهائي</p>
                    <p className={`font-semibold ${formatTimeLeft(selectedAlert.deadline_at).urgent ? 'text-red-600' : ''}`}>
                      {formatDate(selectedAlert.deadline_at)}
                    </p>
                  </div>
                  {selectedAlert.notified_at && (
                    <div className="p-2 bg-blue-50 rounded-lg">
                      <p className="text-[10px] text-blue-600">تاريخ الإشعار</p>
                      <p className="font-semibold text-blue-700">{formatDate(selectedAlert.notified_at)}</p>
                    </div>
                  )}
                  {selectedAlert.escalated_at && (
                    <div className="p-2 bg-red-50 rounded-lg">
                      <p className="text-[10px] text-red-600">تاريخ التصعيد</p>
                      <p className="font-semibold text-red-700">{formatDate(selectedAlert.escalated_at)}</p>
                    </div>
                  )}
                  {selectedAlert.resolved_at && (
                    <div className="p-2 bg-emerald-50 rounded-lg">
                      <p className="text-[10px] text-emerald-600">تاريخ الحل</p>
                      <p className="font-semibold text-emerald-700">{formatDate(selectedAlert.resolved_at)}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* WhatsApp Status */}
              <div className={`flex items-center gap-2 p-3 rounded-xl border ${selectedAlert.whatsapp_sent ? 'bg-emerald-50 border-emerald-200' : 'bg-muted/30 border-border'}`}>
                <Icon name={selectedAlert.whatsapp_sent ? 'CheckCircleIcon' : 'XCircleIcon'} size={16} className={selectedAlert.whatsapp_sent ? 'text-emerald-600' : 'text-muted-foreground'} />
                <span className={`text-xs font-semibold ${selectedAlert.whatsapp_sent ? 'text-emerald-700' : 'text-muted-foreground'}`}>
                  {selectedAlert.whatsapp_sent ? 'تم إرسال إشعار واتساب للمورد' : 'لم يُرسل إشعار واتساب'}
                </span>
              </div>

              {/* Admin Note */}
              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1.5">ملاحظة الأدمن (اختياري)</label>
                <textarea
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  placeholder="أضف ملاحظة..."
                  rows={2}
                  className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none focus:border-primary resize-none"
                />
              </div>

              {/* Action Buttons */}
              {!['resolved', 'dismissed'].includes(selectedAlert.status) && (
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    onClick={() => handleAction('renotify', selectedAlert)}
                    disabled={actionLoading === selectedAlert.id + 'renotify'}
                    className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-60"
                  >
                    <Icon name="BellAlertIcon" size={13} />
                    إعادة الإشعار + تمديد المهلة
                  </button>
                  <button
                    onClick={() => handleAction('resolve', selectedAlert)}
                    disabled={actionLoading === selectedAlert.id + 'resolve'}
                    className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-60"
                  >
                    <Icon name="CheckCircleIcon" size={13} />
                    تعليم كمحلول
                  </button>
                  <button
                    onClick={() => handleAction('dismiss', selectedAlert)}
                    disabled={actionLoading === selectedAlert.id + 'dismiss'}
                    className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-700 text-xs font-bold rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-60 border border-gray-200"
                  >
                    <Icon name="XMarkIcon" size={13} />
                    إغلاق
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
