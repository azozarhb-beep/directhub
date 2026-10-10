'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';
import { useLanguage } from '@/contexts/LanguageContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChangelogEntry {
  id: string;
  version: string;
  date: string;
  titleAr: string;
  titleEn: string;
  category: 'feature' | 'improvement' | 'infrastructure' | 'security';
  icon: string;
  color: string;
  details: string[];
  technicalNote?: string;
}

interface LiveUpdateEntry {
  id: string;
  title: string;
  title_ar: string;
  body: string;
  body_ar: string;
  icon: string;
  color: string;
  update_type: string;
  status: string;
  created_at: string;
}

// ─── Changelog Data (fallback) ────────────────────────────────────────────────

const CHANGELOG_ENTRIES: ChangelogEntry[] = [
  {
    id: 'v3-whatsapp-rfq',
    version: 'v3.1',
    date: '2026-08-30',
    titleAr: 'تفعيل نظام إشعارات WhatsApp الفورية لطلبات عروض الأسعار (RFQs)',
    titleEn: 'WhatsApp RFQ Instant Notifications',
    category: 'feature',
    icon: 'ChatBubbleLeftEllipsisIcon',
    color: 'emerald',
    details: [
      'الربط التقني: تم دمج وتفعيل نقطة النهاية (api/whatsapp/send/) مع محرك توجيه طلبات عروض الأسعار (api/ai/rfq-routing/).',
      'آلية العمل: بمجرد إرسال المشتري لطلب توريد أو عرض سعر جديد، يقوم النظام تلقائياً بإرسال رسالة تنبيه فورية عبر الواتساب لهاتف المصنع/المورد.',
      'تحتوي الرسالة على تفاصيل الطلب ورابط مباشر للوحة التحكم (manufacturer/dashboard/) لضمان سرعة الاستجابة واقتناص الصفقات.',
    ],
    technicalNote: 'api/whatsapp/send/ ↔ api/ai/rfq-routing/',
  },
  {
    id: 'v3-unified-ux',
    version: 'v3.2',
    date: '2026-08-30',
    titleAr: 'هندسة تجربة المستخدم الموحدة (Unified B2B & B2C Experience)',
    titleEn: 'Unified B2B & B2C UX with Smart Backend Routing',
    category: 'improvement',
    icon: 'ArrowsRightLeftIcon',
    color: 'blue',
    details: [
      'الواجهة الأمامية: الاعتماد على واجهة مستخدم واحدة ومبسطة بالكامل لتجنب أي تشتت أو تعقيد للمشتري أو المصنع عند الدخول للمنصة.',
      'التوجيه الخلفي الذكي (Smart Backend Routing): الطلبات الفردية أو الاستهلاكية يتم توجيهها تلقائياً عبر مسار B2C.',
      'الطلبات الصناعية والكميات الكبرى يتم توجيهها تلقائياً عبر مسار B2B.',
    ],
  },
];

const CATEGORY_CONFIG: Record<string, { color: string; bg: string; border: string; dot: string }> = {
  feature: { color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  improvement: { color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', dot: 'bg-blue-500' },
  infrastructure: { color: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-200', dot: 'bg-violet-500' },
  security: { color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', dot: 'bg-red-500' },
};

const COLOR_ICON: Record<string, string> = {
  emerald: 'text-emerald-600 bg-emerald-100',
  blue: 'text-blue-600 bg-blue-100',
  violet: 'text-violet-600 bg-violet-100',
  amber: 'text-amber-600 bg-amber-100',
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ChangelogNotificationPanel() {
  const { t, dir, language, isRTL } = useLanguage();
  const ui = t.admin.changelog;
  const catLabels: Record<string, string> = {
    feature: ui.feature,
    improvement: ui.improvement,
    infrastructure: ui.infrastructure,
    security: ui.security,
  };

  const supabase = createClient();
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastDone, setBroadcastDone] = useState(false);
  const [broadcastError, setBroadcastError] = useState('');
  const [expandedEntry, setExpandedEntry] = useState<string | null>('v3-whatsapp-rfq');
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set(CHANGELOG_ENTRIES.map(e => e.id)));
  const [updateNote, setUpdateNote] = useState('');
  const [installedEntries, setInstalledEntries] = useState<Set<string>>(new Set());
  const [installing, setInstalling] = useState(false);
  const [installDone, setInstallDone] = useState(false);

  // ── Live updates from DB ──────────────────────────────────────────────────
  const [liveUpdates, setLiveUpdates] = useState<LiveUpdateEntry[]>([]);
  const [loadingLive, setLoadingLive] = useState(true);

  // ── Add new entry form ────────────────────────────────────────────────────
  const [showAddForm, setShowAddForm] = useState(false);
  const [newVersion, setNewVersion] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newTitleAr, setNewTitleAr] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newChanges, setNewChanges] = useState<string[]>(['']);
  const [savingEntry, setSavingEntry] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveDone, setSaveDone] = useState(false);

  // ── Fetch live updates from DB ────────────────────────────────────────────
  const fetchLiveUpdates = useCallback(async () => {
    setLoadingLive(true);
    try {
      const { data } = await supabase
        .from('platform_live_updates')
        .select('id, title, title_ar, body, body_ar, icon, color, update_type, status, created_at')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(50);
      setLiveUpdates(data || []);
    } catch {
      setLiveUpdates([]);
    } finally {
      setLoadingLive(false);
    }
  }, [supabase]);

  // ── Auto-install all changelog entries on mount ───────────────────────────
  useEffect(() => {
    const installChangelogs = async () => {
      setInstalling(true);
      try {
        const installed = new Set<string>();
        for (const entry of CHANGELOG_ENTRIES) {
          const { error } = await supabase.from('platform_live_updates').upsert(
            {
              update_type: 'platform_news',
              title: entry.titleEn,
              title_ar: entry.titleAr,
              body: entry.details.join(' | '),
              body_ar: entry.details.join(' | '),
              icon: entry.icon,
              color: entry.color,
              is_auto: false,
              status: 'active',
              display_order: 0,
            },
            { onConflict: 'title' }
          );
          if (!error) installed.add(entry.id);
        }
        setInstalledEntries(installed);
        setInstallDone(true);
      } catch {
        // silent
      } finally {
        setInstalling(false);
      }
    };
    installChangelogs();
    fetchLiveUpdates();
  }, [fetchLiveUpdates]);

  const toggleEntry = (id: string) => {
    setSelectedEntries(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ── Fix 1: Fan-out broadcast to all active users via notifications table ──
  const broadcastUpdates = useCallback(async () => {
    if (selectedEntries.size === 0) return;
    setBroadcasting(true);
    setBroadcastError('');
    setBroadcastDone(false);

    try {
      const selected = CHANGELOG_ENTRIES.filter(e => selectedEntries.has(e.id));

      // 1. Insert platform_live_updates for each selected entry
      for (const entry of selected) {
        await supabase.from('platform_live_updates').insert({
          update_type: 'platform_news',
          title: entry.titleEn,
          title_ar: entry.titleAr,
          body: updateNote ? `${updateNote}\n\n${entry.details.join(' | ')}` : entry.details.join(' | '),
          body_ar: updateNote ? `${updateNote}\n\n${entry.details.join(' | ')}` : entry.details.join(' | '),
          icon: entry.icon,
          color: entry.color,
          is_auto: false,
          status: 'active',
          display_order: 0,
        });
      }

      // 2. Fan-out to all active users via the correct notifications table
      const broadcastTitle = `تحديثات منصة دايركت هب — الإصدار ${selected.map(e => e.version).join('، ')}`;
      const broadcastBody = [
        updateNote ? `📝 ملاحظة المهندس: ${updateNote}` : '',
        selected.map(e => `• ${e.titleAr}`).join('\n'),
      ].filter(Boolean).join('\n\n');

      const { data: users } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('is_active', true);

      const rows = (users || []).map((u: { id: string }) => ({
        user_id: u.id,
        type: 'system',
        title: broadcastTitle,
        body: broadcastBody,
        is_read: false,
      }));

      for (let i = 0; i < rows.length; i += 100) {
        await supabase.from('notifications').insert(rows.slice(i, i + 100));
      }

      setBroadcastDone(true);
      setTimeout(() => setBroadcastDone(false), 5000);
    } catch (err: any) {
      setBroadcastError(err?.message || 'حدث خطأ أثناء النشر');
    } finally {
      setBroadcasting(false);
    }
  }, [supabase, selectedEntries, updateNote]);

  // ── Fix 4: Save new changelog entry to platform_live_updates ─────────────
  const handleSaveNewEntry = async () => {
    if (!newVersion.trim() || !newTitle.trim()) {
      setSaveError('يرجى ملء رقم الإصدار والعنوان على الأقل');
      return;
    }
    setSavingEntry(true);
    setSaveError('');
    setSaveDone(false);

    try {
      const validChanges = newChanges.filter(c => c.trim().length > 0);
      const bodyText = [
        newDescription.trim(),
        ...validChanges.map(c => `• ${c}`),
      ].filter(Boolean).join('\n');

      const { error } = await supabase.from('platform_live_updates').insert({
        update_type: 'platform_news',
        title: `[${newVersion}] ${newTitle}`,
        title_ar: newTitleAr.trim() || `[${newVersion}] ${newTitle}`,
        body: bodyText,
        body_ar: bodyText,
        icon: 'MegaphoneIcon',
        color: 'emerald',
        is_auto: false,
        status: 'active',
        display_order: 0,
      });

      if (error) throw error;

      setSaveDone(true);
      setNewVersion('');
      setNewTitle('');
      setNewTitleAr('');
      setNewDescription('');
      setNewChanges(['']);
      setShowAddForm(false);
      fetchLiveUpdates();
      setTimeout(() => setSaveDone(false), 3000);
    } catch (err: any) {
      setSaveError(err?.message || 'حدث خطأ أثناء الحفظ');
    } finally {
      setSavingEntry(false);
    }
  };

  const addChangeRow = () => setNewChanges(prev => [...prev, '']);
  const removeChangeRow = (idx: number) => setNewChanges(prev => prev.filter((_, i) => i !== idx));
  const updateChangeRow = (idx: number, val: string) =>
    setNewChanges(prev => prev.map((c, i) => (i === idx ? val : c)));

  return (
    <div className="space-y-6" dir={dir}>
      {/* ── Header Banner ─────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-64 h-64 rounded-full bg-white blur-3xl -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-48 h-48 rounded-full bg-orange-400 blur-3xl translate-x-1/4 translate-y-1/4" />
        </div>
        <div className="relative flex items-start gap-5">
          <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center shrink-0 border border-white/20">
            <Icon name="MegaphoneIcon" size={28} className="text-white" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold tracking-widest text-white/50 uppercase">Changelog</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/30 text-orange-300 font-bold border border-orange-500/30">
                {liveUpdates.length} تحديثات في قاعدة البيانات
              </span>
              {installDone && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/30 text-emerald-300 font-bold border border-emerald-500/30 flex items-center gap-1">
                  <Icon name="CheckCircleIcon" size={10} />
                  مثبّتة
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold mb-1">{ui.title}</h2>
            <p className="text-sm text-white/60">{ui.subtitle}</p>
          </div>
          <button
            onClick={() => setShowAddForm(v => !v)}
            className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/30 text-emerald-300 text-sm font-bold transition-colors"
          >
            <Icon name="PlusCircleIcon" size={16} />
            إضافة تحديث جديد
          </button>
        </div>
      </div>

      {/* ── Add New Entry Form (Fix 4) ─────────────────────────────────────── */}
      {showAddForm && (
        <div className="bg-card border border-emerald-300/40 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center">
              <Icon name="PlusCircleIcon" size={18} className="text-emerald-600" />
            </div>
            <h3 className="font-bold text-foreground text-sm">إضافة تحديث جديد للمنصة</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">رقم الإصدار *</label>
              <input
                value={newVersion}
                onChange={e => setNewVersion(e.target.value)}
                placeholder="مثال: v4.0"
                className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">العنوان (إنجليزي) *</label>
              <input
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                placeholder="Feature title in English"
                className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400"
                dir="ltr"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">العنوان (عربي)</label>
            <input
              value={newTitleAr}
              onChange={e => setNewTitleAr(e.target.value)}
              placeholder="عنوان التحديث بالعربية"
              className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">الوصف العام</label>
            <textarea
              value={newDescription}
              onChange={e => setNewDescription(e.target.value)}
              placeholder="وصف مختصر للتحديث..."
              rows={2}
              className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-foreground">قائمة التغييرات</label>
              <button
                onClick={addChangeRow}
                className="text-xs text-emerald-600 font-semibold hover:underline flex items-center gap-1"
              >
                <Icon name="PlusIcon" size={12} />
                إضافة سطر
              </button>
            </div>
            <div className="space-y-2">
              {newChanges.map((change, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-muted-foreground text-xs shrink-0">•</span>
                  <input
                    value={change}
                    onChange={e => updateChangeRow(idx, e.target.value)}
                    placeholder={`تغيير ${idx + 1}...`}
                    className="flex-1 px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400"
                  />
                  {newChanges.length > 1 && (
                    <button
                      onClick={() => removeChangeRow(idx)}
                      className="w-7 h-7 rounded-lg hover:bg-red-50 flex items-center justify-center text-red-400 hover:text-red-600 transition-colors"
                    >
                      <Icon name="XMarkIcon" size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {saveError && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl">
              <Icon name="ExclamationCircleIcon" size={16} className="text-red-600 shrink-0" />
              <p className="text-xs text-red-700">{saveError}</p>
            </div>
          )}

          {saveDone && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl">
              <Icon name="CheckCircleIcon" size={16} className="text-emerald-600 shrink-0" />
              <p className="text-xs text-emerald-700 font-medium">تم حفظ التحديث بنجاح في قاعدة البيانات!</p>
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleSaveNewEntry}
              disabled={savingEntry}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold transition-colors disabled:opacity-60"
            >
              {savingEntry ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Icon name="CheckIcon" size={16} />
              )}
              حفظ التحديث
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="px-5 py-2.5 rounded-xl border border-border text-muted-foreground text-sm font-semibold hover:bg-muted transition-colors"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}

      {/* ── Install Status Banner ──────────────────────────────────────────── */}
      {installDone && (
        <div className="flex items-center gap-3 px-5 py-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl">
          <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
            <Icon name="CheckBadgeIcon" size={18} className="text-emerald-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-emerald-800">{ui.allInstalled}</p>
            <p className="text-xs text-emerald-600 mt-0.5">
              التحديثات الأساسية محفوظة في قاعدة البيانات
            </p>
          </div>
          <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full border border-emerald-200">
            {installedEntries.size}/{CHANGELOG_ENTRIES.length} مثبّت
          </span>
        </div>
      )}

      {/* ── Broadcast Action Card ──────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
              <Icon name="BellAlertIcon" size={20} className="text-orange-600" />
            </div>
            <div>
              <h3 className="font-bold text-foreground text-sm">{ui.publishToUsers}</h3>
              <p className="text-xs text-muted-foreground">
                {selectedEntries.size} من {CHANGELOG_ENTRIES.length} تحديثات محددة للنشر — يُرسل لجميع المستخدمين النشطين
              </p>
            </div>
          </div>
          <button
            onClick={broadcastUpdates}
            disabled={broadcasting || selectedEntries.size === 0}
            className={`flex items-center gap-2.5 px-6 py-3 rounded-xl font-bold text-sm transition-all shadow-sm ${
              broadcastDone
                ? 'bg-emerald-500 text-white'
                : broadcasting
                ? 'bg-orange-400 text-white cursor-not-allowed'
                : selectedEntries.size === 0
                ? 'bg-muted text-muted-foreground cursor-not-allowed'
                : 'bg-orange-500 hover:bg-orange-600 text-white active:scale-95'
            }`}
          >
            {broadcasting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                جارٍ النشر...
              </>
            ) : broadcastDone ? (
              <>
                <Icon name="CheckCircleIcon" size={18} />
                تم النشر بنجاح!
              </>
            ) : (
              <>
                <Icon name="MegaphoneIcon" size={18} />
                بث التحديث
              </>
            )}
          </button>
        </div>

        {/* ── Free-text note field ─────────────────────────────────────── */}
        <div className="mt-4">
          <label className="block text-xs font-semibold text-foreground mb-1.5 flex items-center gap-1.5">
            <Icon name="PencilSquareIcon" size={14} className="text-muted-foreground" />
            وصف وتفاصيل تحديثات المهندس
            <span className="text-muted-foreground font-normal">(اختياري)</span>
          </label>
          <textarea
            value={updateNote}
            onChange={(e) => setUpdateNote(e.target.value)}
            placeholder={ui.broadcastPlaceholder}
            rows={3}
            className="w-full px-4 py-3 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-orange-400/40 focus:border-orange-400 transition-colors leading-relaxed"
            dir={dir}
          />
          {updateNote.length > 0 && (
            <div className="flex items-center justify-between mt-1.5">
              <p className="text-[11px] text-muted-foreground">{ui.broadcastHint}</p>
              <button
                onClick={() => setUpdateNote('')}
                className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                مسح
              </button>
            </div>
          )}
        </div>

        {broadcastError && (
          <div className="mt-3 flex items-center gap-2 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl">
            <Icon name="ExclamationCircleIcon" size={16} className="text-red-600 shrink-0" />
            <p className="text-xs text-red-700">{broadcastError}</p>
          </div>
        )}

        {broadcastDone && (
          <div className="mt-3 flex items-center gap-2 px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl">
            <Icon name="CheckCircleIcon" size={16} className="text-emerald-600 shrink-0" />
            <p className="text-xs text-emerald-700 font-medium">
              تم نشر التحديثات بنجاح وإرسالها لجميع المستخدمين النشطين عبر جدول الإشعارات.
            </p>
          </div>
        )}
      </div>

      {/* ── Live Updates from DB (Fix 4) ──────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
            <Icon name="ClipboardDocumentListIcon" size={16} className="text-muted-foreground" />
            التحديثات المحفوظة في قاعدة البيانات
            {liveUpdates.length > 0 && (
              <span className="text-xs font-normal text-muted-foreground">({liveUpdates.length})</span>
            )}
          </h3>
          <button
            onClick={fetchLiveUpdates}
            className="text-xs text-primary font-semibold hover:underline flex items-center gap-1"
          >
            <Icon name="ArrowPathIcon" size={12} />
            تحديث
          </button>
        </div>

        {loadingLive ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : liveUpdates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2 bg-muted/30 rounded-2xl border border-border">
            <Icon name="InboxIcon" size={32} className="text-muted-foreground" />
            <p className="text-sm text-muted-foreground">لا توجد تحديثات محفوظة بعد</p>
            <button
              onClick={() => setShowAddForm(true)}
              className="text-xs text-primary font-semibold hover:underline"
            >
              أضف أول تحديث
            </button>
          </div>
        ) : (
          liveUpdates.map((entry) => {
            const iconColor = COLOR_ICON[entry.color] || COLOR_ICON.blue;
            return (
              <div
                key={entry.id}
                className="bg-card border border-border rounded-2xl overflow-hidden"
              >
                <div className="flex items-start gap-4 p-5">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconColor}`}>
                    <Icon name={(entry.icon as any) || 'BellIcon'} size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${CATEGORY_CONFIG.feature.bg} ${CATEGORY_CONFIG.feature.color} ${CATEGORY_CONFIG.feature.border}`}>
                        {entry.update_type}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {entry.created_at ? new Date(entry.created_at).toLocaleDateString('ar-SA') : ''}
                      </span>
                    </div>
                    <h4 className="font-bold text-foreground text-sm leading-snug">{entry.title_ar || entry.title}</h4>
                    {entry.title !== entry.title_ar && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">{entry.title}</p>
                    )}
                    {entry.body_ar && (
                      <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed line-clamp-2">{entry.body_ar}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── Hardcoded Entries (fallback selection) ────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
            <Icon name="ArchiveBoxIcon" size={16} className="text-muted-foreground" />
            تحديثات الإصدارات الأساسية (للبث)
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedEntries(new Set(CHANGELOG_ENTRIES.map(e => e.id)))}
              className="text-xs text-primary font-semibold hover:underline"
            >
              تحديد الكل
            </button>
            <span className="text-muted-foreground text-xs">·</span>
            <button
              onClick={() => setSelectedEntries(new Set())}
              className="text-xs text-muted-foreground hover:underline"
            >
              إلغاء الكل
            </button>
          </div>
        </div>

        {CHANGELOG_ENTRIES.map((entry) => {
          const cat = CATEGORY_CONFIG[entry.category];
          const iconColor = COLOR_ICON[entry.color] || COLOR_ICON.blue;
          const isExpanded = expandedEntry === entry.id;
          const isSelected = selectedEntries.has(entry.id);
          const isInstalled = installedEntries.has(entry.id);

          return (
            <div
              key={entry.id}
              className={`bg-card border rounded-2xl overflow-hidden transition-all ${
                isSelected ? 'border-primary/40 shadow-sm' : 'border-border'
              }`}
            >
              <div className="flex items-start gap-4 p-5">
                <button
                  onClick={() => toggleEntry(entry.id)}
                  className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                    isSelected
                      ? 'bg-primary border-primary' : 'border-border bg-background hover:border-primary/50'
                  }`}
                >
                  {isSelected && <Icon name="CheckIcon" size={12} className="text-primary-foreground" />}
                </button>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconColor}`}>
                  <Icon name={entry.icon as any} size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-xs font-bold text-muted-foreground font-mono">{entry.version}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cat.bg} ${cat.color} ${cat.border}`}>
                      {catLabels[entry.category] || entry.category}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{entry.date}</span>
                    {isInstalled && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200 flex items-center gap-1">
                        <Icon name="CheckCircleIcon" size={10} />
                        مثبّت
                      </span>
                    )}
                  </div>
                  <h4 className="font-bold text-foreground text-sm leading-snug">{entry.titleAr}</h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{entry.titleEn}</p>
                </div>
                <button
                  onClick={() => setExpandedEntry(isExpanded ? null : entry.id)}
                  className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center shrink-0 transition-colors"
                >
                  <Icon
                    name={isExpanded ? 'ChevronUpIcon' : 'ChevronDownIcon'}
                    size={16}
                    className="text-muted-foreground"
                  />
                </button>
              </div>

              {isExpanded && (
                <div className="px-5 pb-5 border-t border-border/50 pt-4 space-y-3">
                  <ul className="space-y-2.5">
                    {entry.details.map((detail, idx) => (
                      <li key={idx} className="flex items-start gap-2.5">
                        <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${cat.dot}`} />
                        <p className="text-sm text-foreground/80 leading-relaxed">{detail}</p>
                      </li>
                    ))}
                  </ul>
                  {entry.technicalNote && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg border border-border">
                      <Icon name="CodeBracketIcon" size={14} className="text-muted-foreground shrink-0" />
                      <code className="text-[11px] text-muted-foreground font-mono">{entry.technicalNote}</code>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Summary Stats ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: ui.newFeatures, count: CHANGELOG_ENTRIES.filter(e => e.category === 'feature').length, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
          { label: ui.improvements, count: CHANGELOG_ENTRIES.filter(e => e.category === 'improvement').length, color: 'text-blue-600 bg-blue-50 border-blue-200' },
          { label: ui.infrastructure, count: CHANGELOG_ENTRIES.filter(e => e.category === 'infrastructure').length, color: 'text-violet-600 bg-violet-50 border-violet-200' },
        ].map(stat => (
          <div key={stat.label} className={`flex flex-col items-center justify-center p-4 rounded-xl border ${stat.color}`}>
            <span className="text-2xl font-bold">{stat.count}</span>
            <span className="text-xs font-medium mt-0.5">{stat.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
