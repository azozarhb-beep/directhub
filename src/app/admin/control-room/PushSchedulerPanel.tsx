'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';

interface SchedulerJob {
  id: string;
  job_name: string;
  scheduled_time: string;
  is_active: boolean;
  last_run_at: string | null;
  last_run_status: string | null;
  last_sent_count: number;
  last_product_id: string | null;
  last_product_title: string | null;
  updated_at: string;
}

interface SchedulerLog {
  id: string;
  job_id: string;
  scheduled_time: string;
  product_title: string | null;
  product_image: string | null;
  destination_url: string | null;
  sent_count: number;
  failed_count: number;
  status: string;
  error_message: string | null;
  executed_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  success: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  failed: 'bg-red-100 text-red-700 border-red-200',
  no_content: 'bg-amber-100 text-amber-700 border-amber-200',
  no_subscribers: 'bg-slate-100 text-slate-600 border-slate-200',
  pending: 'bg-blue-100 text-blue-700 border-blue-200',
};

const STATUS_LABELS: Record<string, string> = {
  success: 'نجح الإرسال',
  failed: 'فشل الإرسال',
  no_content: 'لا توجد منتجات',
  no_subscribers: 'لا يوجد مشتركون',
  pending: 'قيد التنفيذ',
};

const TIME_ICONS: Record<string, string> = {
  '09:00': 'SunIcon',
  '13:00': 'ClockIcon',
  '18:00': 'MoonIcon',
};

const TIME_LABELS: Record<string, string> = {
  '09:00': '9:00 صباحاً',
  '13:00': '1:00 ظهراً',
  '18:00': '6:00 مساءً',
};

const TIME_GRADIENTS: Record<string, string> = {
  '09:00': 'from-amber-400 to-orange-500',
  '13:00': 'from-sky-400 to-blue-500',
  '18:00': 'from-indigo-500 to-purple-600',
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

export default function PushSchedulerPanel() {
  const supabase = createClient();
  const [jobs, setJobs] = useState<SchedulerJob[]>([]);
  const [logs, setLogs] = useState<SchedulerLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggerLoading, setTriggerLoading] = useState<string | null>(null);
  const [toggleLoading, setToggleLoading] = useState<string | null>(null);
  const [result, setResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'jobs' | 'logs'>('jobs');
  const [subscriberCount, setSubscriberCount] = useState<number | null>(null);
  const [productCount, setProductCount] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [jobsRes, logsRes, subRes, prodRes] = await Promise.all([
        supabase.from('push_scheduler_jobs').select('*').order('scheduled_time'),
        supabase.from('push_scheduler_log').select('*').order('executed_at', { ascending: false }).limit(50),
        supabase.from('push_subscriptions').select('id', { count: 'exact', head: true }),
        supabase.from('manufacturer_products').select('id', { count: 'exact', head: true }).eq('is_active', true),
      ]);

      if (jobsRes.data) setJobs(jobsRes.data);
      if (logsRes.data) setLogs(logsRes.data);
      setSubscriberCount(subRes.count ?? 0);
      setProductCount(prodRes.count ?? 0);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleToggleJob(job: SchedulerJob) {
    setToggleLoading(job.id);
    try {
      const { error } = await supabase
        .from('push_scheduler_jobs')
        .update({ is_active: !job.is_active, updated_at: new Date().toISOString() })
        .eq('id', job.id);

      if (error) throw error;
      setJobs((prev) => prev.map((j) => j.id === job.id ? { ...j, is_active: !j.is_active } : j));
      setResult({ type: 'success', message: `تم ${!job.is_active ? 'تفعيل' : 'إيقاف'} إشعار ${TIME_LABELS[job.scheduled_time]}` });
    } catch (err: any) {
      setResult({ type: 'error', message: err.message || 'فشل تحديث الجدول' });
    } finally {
      setToggleLoading(null);
      setTimeout(() => setResult(null), 4000);
    }
  }

  async function handleManualTrigger(timeSlot: string) {
    setTriggerLoading(timeSlot);
    setResult(null);
    try {
      const res = await fetch('/api/push/scheduler', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeSlot }),
      });
      const data = await res.json();

      if (data.success) {
        setResult({
          type: 'success',
          message: `✅ تم الإرسال بنجاح! المنتج: "${data.product}" — أُرسل إلى ${data.sent} مشترك`,
        });
        fetchData();
      } else {
        setResult({
          type: 'error',
          message: `⚠️ ${data.message || data.error || 'فشل الإرسال'}`,
        });
      }
    } catch (err: any) {
      setResult({ type: 'error', message: err.message || 'خطأ في الاتصال' });
    } finally {
      setTriggerLoading(null);
      setTimeout(() => setResult(null), 6000);
    }
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://direct-hub.net';

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-md">
            <Icon name="BellAlertIcon" size={20} className="text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">جدولة الإشعارات الفورية</h2>
            <p className="text-xs text-slate-500">3 إشعارات يومية تلقائية مع سحب المنتجات من قاعدة البيانات</p>
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

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-violet-600">{subscriberCount ?? '—'}</div>
          <div className="text-xs text-slate-500 mt-1">مشترك في الإشعارات</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-emerald-600">{productCount ?? '—'}</div>
          <div className="text-xs text-slate-500 mt-1">منتج نشط في المتجر</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">3</div>
          <div className="text-xs text-slate-500 mt-1">إشعارات يومية مجدولة</div>
        </div>
      </div>

      {/* Result Banner */}
      {result && (
        <div className={`p-3 rounded-xl border text-sm font-medium ${result.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
          {result.message}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        {[
          { key: 'jobs', label: 'الجدول اليومي', icon: 'CalendarDaysIcon' },
          { key: 'logs', label: 'سجل التنفيذ', icon: 'ClipboardDocumentListIcon' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as 'jobs' | 'logs')}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-violet-500 text-violet-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon name={tab.icon} size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Jobs Tab */}
      {activeTab === 'jobs' && (
        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : jobs.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Icon name="BellSlashIcon" size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">لا توجد وظائف مجدولة. تأكد من تطبيق migration قاعدة البيانات.</p>
            </div>
          ) : (
            jobs.map((job) => (
              <div
                key={job.id}
                className={`bg-white border rounded-2xl overflow-hidden shadow-sm transition-all ${
                  job.is_active ? 'border-slate-200' : 'border-slate-100 opacity-60'
                }`}
              >
                {/* Job Header */}
                <div className={`bg-gradient-to-l ${TIME_GRADIENTS[job.scheduled_time] || 'from-slate-400 to-slate-500'} p-4 flex items-center justify-between`}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                      <Icon name={TIME_ICONS[job.scheduled_time] || 'BellIcon'} size={20} className="text-white" />
                    </div>
                    <div>
                      <div className="text-white font-bold text-base">{job.job_name}</div>
                      <div className="text-white/80 text-sm">{TIME_LABELS[job.scheduled_time] || job.scheduled_time}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Active Toggle */}
                    <button
                      onClick={() => handleToggleJob(job)}
                      disabled={toggleLoading === job.id}
                      className={`relative w-12 h-6 rounded-full transition-colors ${
                        job.is_active ? 'bg-white/30' : 'bg-black/20'
                      }`}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                        job.is_active ? 'translate-x-1' : 'translate-x-7'
                      }`} />
                    </button>
                    <span className="text-white/80 text-xs">{job.is_active ? 'مفعّل' : 'موقوف'}</span>
                  </div>
                </div>

                {/* Job Body */}
                <div className="p-4 space-y-3">
                  {/* Last Run Info */}
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>آخر تشغيل: {formatDateTime(job.last_run_at)}</span>
                    {job.last_run_status && (
                      <span className={`px-2 py-0.5 rounded-full border text-xs font-medium ${STATUS_COLORS[job.last_run_status] || 'bg-slate-100 text-slate-600'}`}>
                        {STATUS_LABELS[job.last_run_status] || job.last_run_status}
                      </span>
                    )}
                  </div>

                  {job.last_product_title && (
                    <div className="text-xs text-slate-600 bg-slate-50 rounded-lg px-3 py-2">
                      <span className="text-slate-400">آخر منتج: </span>
                      <span className="font-medium">{job.last_product_title}</span>
                      {job.last_sent_count > 0 && (
                        <span className="text-emerald-600 mr-2">← {job.last_sent_count} مشترك</span>
                      )}
                    </div>
                  )}

                  {/* Manual Trigger Button */}
                  <button
                    onClick={() => handleManualTrigger(job.scheduled_time)}
                    disabled={triggerLoading === job.scheduled_time || !job.is_active}
                    className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                      job.is_active
                        ? 'bg-gradient-to-l from-violet-500 to-purple-600 text-white hover:from-violet-600 hover:to-purple-700 shadow-sm'
                        : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    {triggerLoading === job.scheduled_time ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        جارٍ الإرسال...
                      </>
                    ) : (
                      <>
                        <Icon name="PaperAirplaneIcon" size={15} />
                        إرسال الآن (يدوي)
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))
          )}

          {/* Automated Vercel Cron Status */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-emerald-800 font-semibold text-sm">
              <Icon name="CheckCircleIcon" size={16} />
              ✅ يعمل تلقائياً بالكامل — لا حاجة لأي موقع خارجي
            </div>
            <p className="text-xs text-emerald-700">
              الجدولة مُهيأة عبر <strong>Vercel Cron</strong> داخل ملف{' '}
              <code className="bg-emerald-100 px-1 rounded">vercel.json</code> في المشروع مباشرة.
            </p>
            <div className="space-y-1.5">
              {[
                { time: '09:00', cron: '0 6 * * *', label: 'الإشعار الصباحي', note: '9:00 صباحاً (توقيت اليمن)' },
                { time: '13:00', cron: '0 10 * * *', label: 'إشعار الظهيرة', note: '1:00 ظهراً (توقيت اليمن)' },
                { time: '18:00', cron: '0 15 * * *', label: 'الإشعار المسائي', note: '6:00 مساءً (توقيت اليمن)' },
              ].map((item) => (
                <div key={item.time} className="bg-white rounded-lg p-2.5 border border-emerald-100 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-emerald-800">{item.label}</span>
                    <span className="text-xs text-slate-500 mr-2">{item.note}</span>
                  </div>
                  <code className="text-xs bg-emerald-100 px-2 py-0.5 rounded text-emerald-700 font-mono">{item.cron}</code>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-100 rounded-lg px-3 py-2">
              <Icon name="ShieldCheckIcon" size={13} className="shrink-0" />
              <span>الحماية: Vercel يُرسل Authorization Header تلقائياً — لا يحتاج إعداداً إضافياً</span>
            </div>
          </div>
        </div>
      )}

      {/* Logs Tab */}
      {activeTab === 'logs' && (
        <div className="space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Icon name="ClipboardDocumentListIcon" size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">لا يوجد سجل تنفيذ بعد. سيظهر هنا بعد أول إرسال.</p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-right px-3 py-2.5 font-semibold text-slate-600">الوقت</th>
                    <th className="text-right px-3 py-2.5 font-semibold text-slate-600">المنتج</th>
                    <th className="text-right px-3 py-2.5 font-semibold text-slate-600">الإرسال</th>
                    <th className="text-right px-3 py-2.5 font-semibold text-slate-600">الحالة</th>
                    <th className="text-right px-3 py-2.5 font-semibold text-slate-600">التاريخ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-3 py-2.5">
                        <span className="font-mono font-bold text-slate-700">{TIME_LABELS[log.scheduled_time] || log.scheduled_time}</span>
                      </td>
                      <td className="px-3 py-2.5 max-w-[180px]">
                        <span className="truncate block text-slate-600">{log.product_title || '—'}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="text-emerald-600 font-semibold">{log.sent_count}</span>
                        {log.failed_count > 0 && (
                          <span className="text-red-500 mr-1">/ {log.failed_count} فشل</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`px-2 py-0.5 rounded-full border text-xs font-medium ${STATUS_COLORS[log.status] || 'bg-slate-100 text-slate-600'}`}>
                          {STATUS_LABELS[log.status] || log.status}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-slate-400">{formatDateTime(log.executed_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
