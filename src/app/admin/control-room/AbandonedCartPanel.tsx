'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';

interface AbandonedCartLog {
  id: string;
  user_id: string;
  notified_at: string;
  cart_item_count: number;
  product_names: string | null;
  sent_count: number;
  failed_count: number;
  status: string;
  created_at: string;
}

interface Stats {
  totalAbandonedUsers: number;
  totalNotificationsSent: number;
  activeCartUsers: number;
}

const STATUS_COLORS: Record<string, string> = {
  sent: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  failed: 'bg-red-100 text-red-700 border-red-200',
  no_subscription: 'bg-amber-100 text-amber-700 border-amber-200',
};

const STATUS_LABELS: Record<string, string> = {
  sent: 'أُرسل بنجاح',
  failed: 'فشل الإرسال',
  no_subscription: 'لا يوجد اشتراك',
};

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${mo}-${day} ${h}:${min}`;
}

export default function AbandonedCartPanel() {
  const supabase = createClient();
  const [logs, setLogs] = useState<AbandonedCartLog[]>([]);
  const [stats, setStats] = useState<Stats>({ totalAbandonedUsers: 0, totalNotificationsSent: 0, activeCartUsers: 0 });
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [result, setResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();

      const [logsRes, cartRes] = await Promise.all([
        supabase
          .from('abandoned_cart_notifications')
          .select('*')
          .order('notified_at', { ascending: false })
          .limit(50),
        supabase
          .from('cart_items')
          .select('user_id', { count: 'exact', head: false })
          .lt('created_at', fourHoursAgo),
      ]);

      if (logsRes.data) setLogs(logsRes.data);

      // Count unique users with abandoned carts
      const uniqueUsers = new Set((cartRes.data || []).map((r: any) => r.user_id));
      const totalSent = (logsRes.data || []).reduce((s: number, l: AbandonedCartLog) => s + l.sent_count, 0);

      setStats({
        totalAbandonedUsers: uniqueUsers.size,
        totalNotificationsSent: totalSent,
        activeCartUsers: cartRes.count || 0,
      });
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleManualTrigger() {
    setTriggering(true);
    setResult(null);
    try {
      const res = await fetch('/api/push/abandoned-cart', { method: 'POST' });
      const data = await res.json();

      if (data.success) {
        setResult({
          type: 'success',
          message: `✅ تم التنفيذ بنجاح! المستخدمون المؤهلون: ${data.usersEligible ?? 0} — أُرسل إلى: ${data.notified ?? 0} مشترك`,
        });
        fetchData();
      } else {
        setResult({
          type: 'error',
          message: `⚠️ ${data.message || data.error || 'فشل التنفيذ'}`,
        });
      }
    } catch (err: any) {
      setResult({ type: 'error', message: err.message || 'خطأ في الاتصال' });
    } finally {
      setTriggering(false);
      setTimeout(() => setResult(null), 6000);
    }
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://direct-hub.net';
  const cronUrl = `${siteUrl}/api/push/abandoned-cart`;

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shadow-md">
            <Icon name="ShoppingCartIcon" size={20} className="text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">إشعارات السلال المهملة</h2>
            <p className="text-xs text-slate-500">إشعار تلقائي كل 4 ساعات للمستخدمين الذين لم يكملوا طلباتهم</p>
          </div>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
        >
          <Icon name="ArrowPathIcon" size={13} className={loading ? 'animate-spin' : ''} />
          تحديث
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-orange-600">{stats.totalAbandonedUsers}</div>
          <div className="text-xs text-slate-500 mt-1">مستخدم بسلة مهملة (4+ ساعات)</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-emerald-600">{stats.totalNotificationsSent}</div>
          <div className="text-xs text-slate-500 mt-1">إشعار أُرسل بنجاح</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">{logs.length}</div>
          <div className="text-xs text-slate-500 mt-1">سجل إشعار في النظام</div>
        </div>
      </div>

      {/* How it works */}
      <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Icon name="InformationCircleIcon" size={18} className="text-orange-600 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-orange-800">كيف يعمل النظام؟</p>
            <ul className="text-xs text-orange-700 space-y-1 list-disc list-inside">
              <li>يفحص النظام السلال التي مضى عليها أكثر من 4 ساعات دون إتمام الطلب</li>
              <li>يتجاهل المستخدمين الذين تم إشعارهم خلال الـ 4 ساعات الماضية</li>
              <li>يرسل إشعاراً فورياً باسم الإدارة مع رابط مباشر للوحة المشتري</li>
              <li>الرابط المُضمَّن: <span className="font-mono bg-orange-100 px-1 rounded">https://direct-hub.net/buyer-dashboard</span></li>
            </ul>
          </div>
        </div>
      </div>

      {/* Manual Trigger */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">تشغيل يدوي فوري</h3>
            <p className="text-xs text-slate-500 mt-0.5">ابحث الآن عن السلال المهملة وأرسل الإشعارات</p>
          </div>
          <button
            onClick={handleManualTrigger}
            disabled={triggering}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-red-500 text-white text-sm font-semibold rounded-lg hover:from-orange-600 hover:to-red-600 transition-all disabled:opacity-60 shadow-sm"
          >
            {triggering ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                جارٍ الإرسال...
              </>
            ) : (
              <>
                <Icon name="BellAlertIcon" size={16} />
                إرسال الإشعارات الآن
              </>
            )}
          </button>
        </div>

        {result && (
          <div className={`p-3 rounded-lg border text-sm font-medium ${result.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
            {result.message}
          </div>
        )}
      </div>

      {/* Automated Vercel Cron Status */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center shrink-0">
            <Icon name="CheckCircleIcon" size={18} className="text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-emerald-800 mb-1">
              ✅ يعمل تلقائياً بالكامل — لا حاجة لأي موقع خارجي
            </h3>
            <p className="text-xs text-emerald-700 mb-3">
              النظام مُهيأ عبر <strong>Vercel Cron</strong> داخل ملف <code className="bg-emerald-100 px-1 rounded">vercel.json</code> ويعمل تلقائياً كل 4 ساعات.
            </p>
            <div className="bg-white border border-emerald-200 rounded-lg p-3 space-y-1.5">
              <div className="flex items-center gap-2 text-xs text-slate-700">
                <Icon name="ClockIcon" size={13} className="text-emerald-600 shrink-0" />
                <span>التكرار: <strong>كل 4 ساعات</strong> تلقائياً</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-700">
                <Icon name="LinkIcon" size={13} className="text-emerald-600 shrink-0" />
                <span>رابط الوجهة: <strong>https://direct-hub.net/buyer-dashboard</strong></span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-700">
                <Icon name="ShieldCheckIcon" size={13} className="text-emerald-600 shrink-0" />
                <span>الحماية: Vercel Authorization Header تلقائي</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Logs */}
      <div>
        <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
          <Icon name="ClipboardDocumentListIcon" size={15} className="text-slate-500" />
          سجل الإشعارات المُرسلة
        </h3>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-10 text-slate-400">
            <Icon name="BellSlashIcon" size={36} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">لا توجد سجلات بعد. شغّل النظام أو انتظر الجدولة التلقائية.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {logs.map((log) => (
              <div key={log.id} className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[log.status] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                        {STATUS_LABELS[log.status] || log.status}
                      </span>
                      <span className="text-xs text-slate-400">{formatDateTime(log.notified_at)}</span>
                    </div>
                    {log.product_names && (
                      <p className="text-xs text-slate-600 truncate">
                        <span className="font-medium">المنتجات:</span> {log.product_names}
                      </p>
                    )}
                    <p className="text-xs text-slate-500 mt-0.5">
                      عدد المنتجات في السلة: <strong>{log.cart_item_count}</strong>
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold text-emerald-600">{log.sent_count} ✓</div>
                    {log.failed_count > 0 && (
                      <div className="text-xs text-red-500">{log.failed_count} ✗</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
