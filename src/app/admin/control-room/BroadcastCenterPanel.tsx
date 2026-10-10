'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';

interface BroadcastRecord {
  id: string;
  title: string;
  body: string;
  target_roles: string[];
  channel: string;
  sent_count: number;
  created_at: string;
  created_by?: string;
}

const TARGET_ROLE_OPTIONS = [
  { value: 'buyer', label: 'المشترون', labelEn: 'Buyers', icon: 'ShoppingBagIcon', color: 'bg-sky-100 text-sky-700 border-sky-200' },
  { value: 'manufacturer', label: 'المصنّعون والموردون', labelEn: 'Manufacturers & Suppliers', icon: 'BuildingOffice2Icon', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'field_agent', label: 'المندوبون الميدانيون', labelEn: 'Field Agents', icon: 'UserGroupIcon', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { value: 'logistics_partner', label: 'شركاء اللوجستيات', labelEn: 'Logistics Partners', icon: 'TruckIcon', color: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
  { value: 'admin', label: 'المدراء', labelEn: 'Admins / Managers', icon: 'ShieldCheckIcon', color: 'bg-red-100 text-red-700 border-red-200' },
  { value: 'manufacturer_agent', label: 'وكلاء المصنّعين', labelEn: 'Manufacturer Agents', icon: 'BriefcaseIcon', color: 'bg-violet-100 text-violet-700 border-violet-200' },
];

const CHANNEL_OPTIONS = [
  { value: 'in_app', label: 'إشعار داخلي', icon: 'BellIcon', color: 'bg-indigo-100 text-indigo-700' },
  { value: 'whatsapp', label: 'واتساب', icon: 'ChatBubbleLeftRightIcon', color: 'bg-green-100 text-green-700' },
  { value: 'web_push', label: 'إشعار فوري (Push)', icon: 'DevicePhoneMobileIcon', color: 'bg-orange-100 text-orange-700' },
  { value: 'both', label: 'داخلي + واتساب', icon: 'MegaphoneIcon', color: 'bg-purple-100 text-purple-700' },
];

const BROADCAST_TYPE_OPTIONS = [
  {
    value: 'system',
    label: 'إشعار نظام / معاملة',
    labelEn: 'System / Transactional',
    description: 'تنبيهات مهمة تظهر في جرس الإشعارات 🔔 (صيانة، تحديثات، تنبيهات طلبات)',
    icon: 'BellAlertIcon',
    color: 'bg-indigo-50 border-indigo-300 text-indigo-700',
    activeColor: 'bg-indigo-100 border-indigo-500 text-indigo-800',
  },
  {
    value: 'marketing',
    label: 'إعلان تسويقي / صورة إعلانية',
    labelEn: 'Marketing / Image Ad',
    description: 'إعلانات ترويجية — تُرسل عبر واتساب أو إشعار فوري مع صورة على شاشة الجهاز',
    icon: 'PhotoIcon',
    color: 'bg-amber-50 border-amber-300 text-amber-700',
    activeColor: 'bg-amber-100 border-amber-500 text-amber-800',
  },
];

const BROADCAST_TEMPLATES = [
  { label: 'صيانة مجدولة', title: '🔧 صيانة مجدولة للمنصة', body: 'سيتوقف النظام مؤقتاً للصيانة يوم [التاريخ] من [الوقت] حتى [الوقت]. نعتذر عن أي إزعاج.' },
  { label: 'ميزة جديدة', title: '🚀 ميزة جديدة متاحة الآن', body: 'يسعدنا إعلانكم عن إطلاق [اسم الميزة]. استكشفوها الآن من لوحة التحكم.' },
  { label: 'تحديث سياسة', title: '📋 تحديث سياسة المنصة', body: 'تم تحديث سياسة [الاستخدام/الخصوصية/الشحن]. يرجى مراجعة التفاصيل من صفحة الشروط والأحكام.' },
  { label: 'عرض ترويجي', title: '🎉 عرض خاص لفترة محدودة', body: 'استمتعوا بـ [تفاصيل العرض] حتى تاريخ [التاريخ]. لا تفوّتوا الفرصة!' },
];

export default function BroadcastCenterPanel() {
  const supabase = createClient();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [notifUrl, setNotifUrl] = useState('/');
  // Default includes 'admin' so the logged-in admin always receives their own broadcast
  const [selectedRoles, setSelectedRoles] = useState<string[]>(['buyer', 'manufacturer', 'admin']);
  const [channel, setChannel] = useState('in_app');
  const [broadcastType, setBroadcastType] = useState<'system' | 'marketing'>('system');
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [history, setHistory] = useState<BroadcastRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [activeTab, setActiveTab] = useState<'compose' | 'history'>('compose');
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [whatsappPhoneCount, setWhatsappPhoneCount] = useState<number | null>(null);
  const [whatsappPhoneLoading, setWhatsappPhoneLoading] = useState(false);
  const [whatsappLinks, setWhatsappLinks] = useState<{ name: string; phone: string; link: string }[]>([]);
  const [showWhatsappLinks, setShowWhatsappLinks] = useState(false);
  const [pushSubCount, setPushSubCount] = useState<number | null>(null);
  const [pushSubLoading, setPushSubLoading] = useState(false);
  const [vapidConfigured, setVapidConfigured] = useState<boolean | null>(null);

  // ── Realtime Presence: live connected subscribers ─────────────────────────
  const [liveSubscribersCount, setLiveSubscribersCount] = useState<number>(0);
  const presenceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    fetchHistory();
    checkVapidConfig();
  }, []);

  // ── Setup Supabase Presence on mount ──────────────────────────────────────
  useEffect(() => {
    const supabaseClient = createClient();

    // Get current user id for presence key
    supabaseClient.auth.getUser().then(({ data }) => {
      const userId = data?.user?.id || 'anonymous-' + Math.random().toString(36).slice(2, 9);

      const channel = supabaseClient.channel('platform_live_updates', {
        config: { presence: { key: userId } },
      });

      channel
        .on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState();
          setLiveSubscribersCount(Object.keys(state).length);
        })
        .on('presence', { event: 'join' }, () => {
          const state = channel.presenceState();
          setLiveSubscribersCount(Object.keys(state).length);
        })
        .on('presence', { event: 'leave' }, () => {
          const state = channel.presenceState();
          setLiveSubscribersCount(Object.keys(state).length);
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await channel.track({ online_at: new Date().toISOString() });
            // Count is updated by the 'sync' presence event fired after track() confirms
          }
        });

      presenceChannelRef.current = channel;
    });

    return () => {
      if (presenceChannelRef.current) {
        supabaseClient.removeChannel(presenceChannelRef.current);
        presenceChannelRef.current = null;
      }
    };
  }, []);

  // Auto-preview count when roles change
  useEffect(() => {
    if (selectedRoles.length === 0) {
      setPreviewCount(null);
      setWhatsappPhoneCount(null);
      setPushSubCount(null);
      return;
    }
    const timer = setTimeout(() => {
      fetchPreviewCount();
      if (channel === 'whatsapp' || channel === 'both') {
        fetchWhatsappPhoneCount();
      }
      if (channel === 'web_push') {
        fetchPushSubCount();
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [selectedRoles]);

  // When broadcast type changes to marketing, force channel to whatsapp
  useEffect(() => {
    if (broadcastType === 'marketing' && channel === 'in_app') {
      setChannel('whatsapp');
    }
  }, [broadcastType]);

  // Fetch phone count when channel changes to whatsapp/both
  useEffect(() => {
    if ((channel === 'whatsapp' || channel === 'both') && selectedRoles.length > 0) {
      fetchWhatsappPhoneCount();
    } else {
      setWhatsappPhoneCount(null);
    }
    if (channel === 'web_push' && selectedRoles.length > 0) {
      fetchPushSubCount();
    } else if (channel !== 'web_push') {
      setPushSubCount(null);
    }
  }, [channel]);

  async function checkVapidConfig() {
    try {
      const res = await fetch('/api/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'test', message: 'test', targetRoles: [] }),
      });
      const data = await res.json();
      // If error is about VAPID keys, mark as not configured
      if (data?.error?.includes('VAPID')) {
        setVapidConfigured(false);
      } else {
        setVapidConfigured(true);
      }
    } catch {
      setVapidConfigured(null);
    }
  }

  async function fetchPreviewCount() {
    setPreviewLoading(true);
    try {
      const { count, error } = await supabase
        .from('user_profiles')
        .select('id', { count: 'exact', head: true })
        .in('role', selectedRoles)
        .eq('is_active', true);

      if (error) {
        // If RLS blocks the count, try without is_active filter
        const { count: count2 } = await supabase
          .from('user_profiles')
          .select('id', { count: 'exact', head: true })
          .in('role', selectedRoles);
        setPreviewCount(count2 ?? 0);
      } else {
        setPreviewCount(count ?? 0);
      }
    } catch {
      setPreviewCount(null);
    } finally {
      setPreviewLoading(false);
    }
  }

  async function fetchHistory() {
    setLoadingHistory(true);
    try {
      const { data } = await supabase
        .from('broadcast_logs')
        .select('id, title, body, target_roles, sent_count, channel, created_at')
        .order('created_at', { ascending: false })
        .limit(30);
      if (data) {
        setHistory(data.map((d: any) => ({
          id: d.id,
          title: d.title || '',
          body: d.body || '',
          target_roles: d.target_roles || [],
          channel: d.channel || 'in_app',
          sent_count: d.sent_count || 0,
          created_at: d.created_at,
        })));
      }
    } catch {
      setHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  }

  async function fetchWhatsappPhoneCount() {
    setWhatsappPhoneLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, phone, full_name, company_name')
        .in('role', selectedRoles)
        .not('phone', 'is', null)
        .neq('phone', '');

      if (!error && data) {
        setWhatsappPhoneCount(data.length);
      } else {
        setWhatsappPhoneCount(0);
      }
    } catch {
      setWhatsappPhoneCount(0);
    } finally {
      setWhatsappPhoneLoading(false);
    }
  }

  async function fetchPushSubCount() {
    setPushSubLoading(true);
    try {
      const res = await fetch('/api/push/count', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetRoles: selectedRoles }),
      });

      if (!res.ok) {
        setPushSubCount(0);
        return;
      }

      const data = await res.json();
      setPushSubCount(data.count ?? 0);
    } catch {
      setPushSubCount(0);
    } finally {
      setPushSubLoading(false);
    }
  }

  async function fetchWhatsappTargetUsers(): Promise<{ name: string; phone: string; link: string }[]> {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, phone, full_name, company_name, role')
      .in('role', selectedRoles)
      .not('phone', 'is', null)
      .neq('phone', '');

    if (error || !data) return [];

    return data
      .filter(p => p.phone && String(p.phone).trim().length >= 7)
      .map(p => {
        const rawPhone = String(p.phone).trim();
        const normalized = normalizePhoneForWa(rawPhone);
        const messageText = `${title.trim()}\n\n${body.trim()}`;
        return {
          name: p.full_name || p.company_name || 'مستخدم',
          phone: rawPhone,
          link: `https://api.whatsapp.com/send?phone=${normalized}&text=${encodeURIComponent(messageText)}`,
        };
      });
  }

  function normalizePhoneForWa(phone: string): string {
    let clean = String(phone).replace(/[\s\-\(\)]/g, '').replace(/^\+/, '');
    if (clean.length >= 11) return clean;
    if (/^7\d{8}$/.test(clean)) return `967${clean}`;
    if (clean.startsWith('0')) return `967${clean.slice(1)}`;
    if (clean.length === 9) return `967${clean}`;
    return clean;
  }

  function toggleRole(role: string) {
    setSelectedRoles(prev =>
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    );
  }

  function applyTemplate(tpl: typeof BROADCAST_TEMPLATES[0]) {
    setTitle(tpl.title);
    setBody(tpl.body);
  }

  async function handleSendWebPush(): Promise<{ sent: number; failed: number; error?: string }> {
    try {
      const res = await fetch('/api/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          message: body.trim(),
          image: imageUrl.trim() || undefined,
          url: notifUrl.trim() || '/',
          targetRoles: selectedRoles,
          tag: 'directhub-broadcast',
          requireInteraction: false,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { sent: 0, failed: 0, error: data?.error || `HTTP ${res.status}` };
      }
      return { sent: data.sent || 0, failed: data.failed || 0 };
    } catch (err: any) {
      return { sent: 0, failed: 0, error: err?.message || 'Network error' };
    }
  }

  async function handleSend() {
    if (!title.trim() || !body.trim()) {
      setSendResult({ type: 'error', message: 'يرجى ملء العنوان والمحتوى' });
      return;
    }
    if (selectedRoles.length === 0) {
      setSendResult({ type: 'error', message: 'يرجى اختيار دور واحد على الأقل' });
      return;
    }

    setSending(true);
    setSendResult(null);
    setShowWhatsappLinks(false);

    try {
      // ── Web Push channel ──────────────────────────────────────────────────
      if (channel === 'web_push') {
        const result = await handleSendWebPush();
        if (result.error) {
          setSendResult({ type: 'error', message: `فشل إرسال الإشعار الفوري: ${result.error}` });
        } else if (result.sent === 0 && (result as any).total === 0) {
          setSendResult({
            type: 'error',
            message: 'لا يوجد مستخدمون مشتركون في الإشعارات الفورية للأدوار المحددة. يجب على المستخدمين السماح بالإشعارات أولاً.',
          });
        } else if (result.sent === 0 && (result as any).total > 0) {
          setSendResult({
            type: 'error',
            message: `فشل إرسال الإشعار إلى ${(result as any).total} جهاز. قد تكون الاشتراكات منتهية الصلاحية أو غير صالحة.`,
          });
        } else {
          setSendResult({
            type: 'success',
            message: `✅ تم إرسال الإشعار الفوري إلى ${result.sent} جهاز${result.failed > 0 ? ` (${result.failed} فشل)` : ''}`,
          });
        }
        setSending(false);
        return;
      }

      // ── Fetch target user IDs ─────────────────────────────────────────────
      const { data: profiles, error: profilesError } = await supabase
        .from('user_profiles')
        .select('id, role, phone, full_name, company_name')
        .in('role', selectedRoles);

      if (profilesError) {
        setSendResult({
          type: 'error',
          message: `خطأ في استعلام المستخدمين: ${profilesError.message}`,
        });
        setSending(false);
        return;
      }

      const userIds = (profiles || []).map(p => p.id);

      if (userIds.length === 0) {
        setSendResult({
          type: 'error',
          message: 'لا يوجد مستخدمون في الأدوار المحددة. تأكد من وجود مستخدمين بهذه الأدوار في قاعدة البيانات.',
        });
        setSending(false);
        return;
      }

      // ── WhatsApp links ────────────────────────────────────────────────────
      if (channel === 'whatsapp' || channel === 'both') {
        const waUsers = await fetchWhatsappTargetUsers();
        if (waUsers.length > 0) {
          setWhatsappLinks(waUsers);
          setShowWhatsappLinks(true);
        }
      }

      // ── Marketing broadcast: WhatsApp only ───────────────────────────────
      if (broadcastType === 'marketing') {
        const waCount = whatsappLinks.length || (await fetchWhatsappTargetUsers()).length;
        if (waCount > 0) {
          setSendResult({
            type: 'success',
            message: `✅ تم تجهيز روابط واتساب لـ ${waCount} مستخدم. الإعلان التسويقي لن يظهر في جرس الإشعارات 🔔 — يُرسل عبر واتساب فقط.`,
          });
        } else {
          setSendResult({
            type: 'error',
            message: 'لا يوجد مستخدمون بأرقام هواتف مسجلة في الأدوار المحددة.',
          });
        }
      } else if (channel === 'in_app' || channel === 'both') {
        // System broadcast: insert into notifications table
        const batchSize = 100;
        let totalInserted = 0;
        let lastError: string | null = null;

        for (let i = 0; i < userIds.length; i += batchSize) {
          const batch = userIds.slice(i, i + batchSize);
          const rows = batch.map(uid => ({
            user_id: uid,
            type: 'system' as const,
            title: title.trim(),
            body: body.trim(),
            is_read: false,
          }));
          const { error: insertError } = await supabase.from('notifications').insert(rows);
          if (insertError) {
            lastError = insertError.message;
          } else {
            totalInserted += batch.length;
          }
        }

        if (totalInserted === 0 && lastError) {
          setSendResult({
            type: 'error',
            message: `فشل إدراج الإشعارات: ${lastError}`,
          });
        } else if (channel === 'both') {
          const waCount = whatsappLinks.length || (await fetchWhatsappTargetUsers()).length;
          setSendResult({
            type: 'success',
            message: `✅ تم إرسال الإشعار الداخلي إلى ${totalInserted} مستخدم${waCount > 0 ? ` • روابط واتساب جاهزة لـ ${waCount} مستخدم لديهم أرقام مسجلة` : ''}`,
          });
        } else {
          setSendResult({
            type: 'success',
            message: `✅ تم إرسال الإشعار بنجاح إلى ${totalInserted} مستخدم`,
          });
        }
      } else if (channel === 'whatsapp') {
        const waCount = whatsappLinks.length;
        if (waCount > 0) {
          setSendResult({
            type: 'success',
            message: `✅ تم تجهيز روابط واتساب لـ ${waCount} مستخدم لديهم أرقام هواتف مسجلة. افتح الروابط أدناه للإرسال.`,
          });
        } else {
          setSendResult({
            type: 'error',
            message: 'لا يوجد مستخدمون بأرقام هواتف مسجلة في الأدوار المحددة.',
          });
        }
      }

      if (channel !== 'whatsapp' && broadcastType !== 'marketing') {
        setTitle('');
        setBody('');
        fetchHistory();
      }

      // ── Fix 3: Log broadcast to broadcast_logs table ──────────────────────
      try {
        const { data: authData } = await supabase.auth.getUser();
        const creatorId = authData?.user?.id || null;
        const audienceCount = previewCount ?? userIds.length;
        await supabase.from('broadcast_logs').insert({
          title: title.trim(),
          body: body.trim(),
          target_roles: selectedRoles,
          sent_count: audienceCount,
          channel: channel,
          created_by: creatorId,
          created_at: new Date().toISOString(),
        });
      } catch {
        // silent — logging failure should not block the broadcast
      }
    } catch (err: any) {
      setSendResult({ type: 'error', message: err?.message || 'فشل إرسال الإشعار' });
    } finally {
      setSending(false);
    }
  }

  function formatDate(dateStr: string) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '—';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${day} ${h}:${min}`;
  }

  const isWebPushChannel = channel === 'web_push';
  const isWhatsAppChannel = channel === 'whatsapp' || channel === 'both' || broadcastType === 'marketing';

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl border border-purple-300/30 shadow-lg"
        style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' }}>
        <div className="absolute top-0 left-0 right-0 h-0.5"
          style={{ background: 'linear-gradient(90deg, transparent, #A855F7, #EC4899, #A855F7, transparent)' }} />
        <div className="px-6 py-5 flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-md shrink-0"
            style={{ background: 'linear-gradient(135deg, #A855F7, #7C3AED)' }}>
            <Icon name="MegaphoneIcon" size={28} className="text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-white">مركز البث والإعلانات</h2>
            <p className="text-sm text-white/60 mt-1">إرسال إشعارات وإعلانات لجميع أدوار المنصة أو أدوار محددة</p>
          </div>
          <div className="shrink-0 text-right">
            <div className="flex items-center gap-1.5 justify-end mb-1">
              <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
              <span className="text-xs font-semibold text-white/80">Broadcast Center</span>
            </div>
            {/* Live Presence Counter */}
            <div className="flex items-center gap-1.5 justify-end mt-1">
              <div className={`w-2 h-2 rounded-full ${liveSubscribersCount > 0 ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500'}`} />
              <span className="text-[11px] font-semibold text-white/70">
                {liveSubscribersCount > 0
                  ? `${liveSubscribersCount} متصل الآن`
                  : 'لا يوجد متصلون الآن'}
              </span>
            </div>
            <p className="text-[10px] text-white/40">{history.length} إعلان سابق</p>
          </div>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-2 bg-gray-100 p-1 rounded-xl w-fit">
        {[
          { key: 'compose', label: 'إنشاء إعلان', icon: 'PencilSquareIcon' },
          { key: 'history', label: 'السجل', icon: 'ClockIcon' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === tab.key
                ? 'bg-white text-purple-700 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon name={tab.icon as any} size={15} />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'compose' && (
        <div className="space-y-5">
          {/* Broadcast Type Selector */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <Icon name="AdjustmentsHorizontalIcon" size={16} className="text-purple-600" />
              نوع البث
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {BROADCAST_TYPE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setBroadcastType(opt.value as 'system' | 'marketing')}
                  className={`flex items-start gap-3 p-4 rounded-xl border-2 text-right transition-all ${
                    broadcastType === opt.value ? opt.activeColor : opt.color + ' opacity-70 hover:opacity-100'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                    broadcastType === opt.value ? 'bg-white/60' : 'bg-white/40'
                  }`}>
                    <Icon name={opt.icon as any} size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold">{opt.label}</p>
                      {broadcastType === opt.value && (
                        <Icon name="CheckCircleIcon" size={13} />
                      )}
                    </div>
                    <p className="text-[10px] mt-0.5 opacity-80 leading-relaxed">{opt.description}</p>
                  </div>
                </button>
              ))}
            </div>

            {/* Marketing type notice */}
            {broadcastType === 'marketing' && (
              <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-amber-800">
                <Icon name="ShieldExclamationIcon" size={15} className="shrink-0 mt-0.5" />
                <p className="text-xs leading-relaxed">
                  <span className="font-bold">الإعلانات التسويقية لا تُدرج في جدول الإشعارات الداخلية.</span>{' '}
                  يمكن إرسالها عبر واتساب أو إشعار فوري مع صورة مباشرة على شاشة الجهاز.
                </p>
              </div>
            )}
          </div>

          {/* Templates */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <Icon name="DocumentDuplicateIcon" size={16} className="text-purple-600" />
              قوالب جاهزة
            </h3>
            <div className="flex flex-wrap gap-2">
              {BROADCAST_TEMPLATES.map(tpl => (
                <button
                  key={tpl.label}
                  onClick={() => applyTemplate(tpl)}
                  className="px-3 py-1.5 bg-purple-50 border border-purple-200 text-purple-700 text-xs font-semibold rounded-lg hover:bg-purple-100 transition-colors"
                >
                  {tpl.label}
                </button>
              ))}
            </div>
          </div>

          {/* Compose Form */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <Icon name="PencilSquareIcon" size={16} className="text-purple-600" />
              محتوى الإعلان
            </h3>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">العنوان *</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="عنوان الإعلان..."
                maxLength={120}
                className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-purple-400 bg-gray-50"
              />
              <p className="text-[10px] text-gray-400 mt-1 text-left">{title.length}/120</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">المحتوى *</label>
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                placeholder="نص الإعلان..."
                rows={4}
                maxLength={500}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-purple-400 bg-gray-50 resize-none"
              />
              <p className="text-[10px] text-gray-400 mt-1 text-left">{body.length}/500</p>
            </div>

            {/* Image URL field — shown for web_push or marketing channels */}
            {(isWebPushChannel || broadcastType === 'marketing') && (
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 flex items-center gap-1.5">
                  <Icon name="PhotoIcon" size={13} className="text-orange-500" />
                  رابط الصورة الإعلانية
                  {isWebPushChannel && <span className="text-orange-500 font-bold">(اختياري — تظهر في الإشعار الفوري)</span>}
                </label>
                <input
                  type="url"
                  value={imageUrl}
                  onChange={e => setImageUrl(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  className="w-full h-10 px-3 rounded-lg border border-orange-200 text-sm focus:outline-none focus:border-orange-400 bg-orange-50/30"
                  dir="ltr"
                />
                {imageUrl && (
                  <div className="mt-2 rounded-lg overflow-hidden border border-orange-200 max-h-32">
                    <img
                      src={imageUrl}
                      alt="معاينة الصورة"
                      className="w-full h-32 object-cover"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  </div>
                )}
                <p className="text-[10px] text-gray-400 mt-1">
                  الصورة ستظهر كبانر كبير في الإشعار الفوري على شاشة الجهاز (مثل إشعارات Alibaba)
                </p>
              </div>
            )}

            {/* Target URL for web push */}
            {isWebPushChannel && (
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 flex items-center gap-1.5">
                  <Icon name="LinkIcon" size={13} className="text-orange-500" />
                  رابط الوجهة عند النقر على الإشعار
                </label>
                <input
                  type="text"
                  value={notifUrl}
                  onChange={e => setNotifUrl(e.target.value)}
                  placeholder="/buyer-dashboard"
                  className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-orange-400 bg-gray-50"
                  dir="ltr"
                />
              </div>
            )}
          </div>

          {/* Target Roles */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <Icon name="UsersIcon" size={16} className="text-purple-600" />
              الأدوار المستهدفة
            </h3>
            <div className="flex flex-wrap gap-2">
              {TARGET_ROLE_OPTIONS.map(role => (
                <button
                  key={role.value}
                  onClick={() => toggleRole(role.value)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                    selectedRoles.includes(role.value)
                      ? `${role.color} shadow-sm scale-[1.02]`
                      : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  <Icon name={role.icon as any} size={13} />
                  {role.label}
                  {selectedRoles.includes(role.value) && (
                    <Icon name="CheckIcon" size={11} />
                  )}
                </button>
              ))}
            </div>

            {/* Preview count */}
            {selectedRoles.length > 0 && (
              <div className="flex items-center gap-2 mt-2">
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border ${
                  previewCount !== null && previewCount > 0
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : previewCount === 0
                    ? 'bg-amber-50 border-amber-200 text-amber-700' :'bg-gray-50 border-gray-200 text-gray-500'
                }`}>
                  {previewLoading ? (
                    <>
                      <Icon name="ArrowPathIcon" size={12} className="animate-spin" />
                      <span>جارٍ حساب المستخدمين...</span>
                    </>
                  ) : previewCount !== null ? (
                    <>
                      <Icon name={previewCount > 0 ? 'UserGroupIcon' : 'ExclamationTriangleIcon'} size={12} />
                      <span>
                        {previewCount > 0
                          ? `سيصل الإشعار إلى ${previewCount} مستخدم`
                          : 'لا يوجد مستخدمون في الأدوار المحددة'}
                      </span>
                    </>
                  ) : (
                    <span>{selectedRoles.length} دور محدد</span>
                  )}
                </div>
                <button
                  onClick={fetchPreviewCount}
                  disabled={previewLoading}
                  className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors"
                  title="تحديث العدد"
                >
                  <Icon name="ArrowPathIcon" size={12} className={previewLoading ? 'animate-spin' : ''} />
                </button>
              </div>
            )}
          </div>

          {/* Channel — hidden/locked for marketing type */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <Icon name="SignalIcon" size={16} className="text-purple-600" />
              قناة الإرسال
            </h3>

            {broadcastType === 'marketing' ? (
              <div className="space-y-2">
                <p className="text-xs text-gray-500 mb-2">اختر قناة الإرسال للإعلان التسويقي:</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: 'whatsapp', label: 'واتساب', icon: 'ChatBubbleLeftRightIcon', color: 'bg-green-100 text-green-700' },
                    { value: 'web_push', label: 'إشعار فوري مع صورة', icon: 'DevicePhoneMobileIcon', color: 'bg-orange-100 text-orange-700' },
                  ].map(ch => (
                    <button
                      key={ch.value}
                      onClick={() => setChannel(ch.value)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${
                        channel === ch.value
                          ? `${ch.color} border-current shadow-sm`
                          : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      <Icon name={ch.icon as any} size={13} />
                      {ch.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {CHANNEL_OPTIONS.map(ch => (
                  <button
                    key={ch.value}
                    onClick={() => setChannel(ch.value)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${
                      channel === ch.value
                        ? `${ch.color} border-current shadow-sm`
                        : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    <Icon name={ch.icon as any} size={13} />
                    {ch.label}
                  </button>
                ))}
              </div>
            )}

            {/* Web Push info */}
            {isWebPushChannel && (
              <div className="space-y-2 mt-1">
                <div className="flex items-start gap-2.5 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2.5 text-orange-800">
                  <Icon name="DevicePhoneMobileIcon" size={15} className="shrink-0 mt-0.5" />
                  <div className="text-xs leading-relaxed">
                    <p className="font-bold mb-0.5">إشعار فوري مباشر على شاشة الجهاز</p>
                    <p className="opacity-80">يظهر الإشعار مع صورة كبانر على شاشة الجهاز مثل إشعارات Alibaba — يتطلب أن يكون المستخدم قد سمح بالإشعارات مسبقاً.</p>
                  </div>
                </div>

                {/* VAPID config warning */}
                {vapidConfigured === false && (
                  <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-red-800">
                    <Icon name="ExclamationTriangleIcon" size={15} className="shrink-0 mt-0.5" />
                    <div className="text-xs leading-relaxed">
                      <p className="font-bold mb-0.5">مفاتيح VAPID غير مُعدَّة</p>
                      <p className="opacity-80">
                        لتفعيل الإشعارات الفورية، أضف المتغيرات التالية في ملف .env:
                      </p>
                      <code className="block mt-1 bg-red-100 rounded px-2 py-1 text-[10px] font-mono dir-ltr text-left">
                        NEXT_PUBLIC_VAPID_PUBLIC_KEY=...<br />
                        VAPID_PRIVATE_KEY=...
                      </code>
                      <p className="mt-1 opacity-70 text-[10px]">يمكن توليدهما باستخدام: npx web-push generate-vapid-keys</p>
                    </div>
                  </div>
                )}

                {/* Push sub count */}
                {pushSubLoading ? (
                  <div className="flex items-center gap-2 text-xs text-gray-500 px-1">
                    <Icon name="ArrowPathIcon" size={12} className="animate-spin" />
                    <span>جارٍ حساب المشتركين في الإشعارات الفورية...</span>
                  </div>
                ) : pushSubCount !== null ? (
                  <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg border ${
                    pushSubCount > 0
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :'bg-amber-50 border-amber-200 text-amber-700'
                  }`}>
                    <Icon name={pushSubCount > 0 ? 'DevicePhoneMobileIcon' : 'ExclamationTriangleIcon'} size={13} />
                    <span>
                      {pushSubCount > 0
                        ? `${pushSubCount} جهاز مشترك في الإشعارات الفورية`
                        : 'لا يوجد أجهزة مشتركة في الإشعارات الفورية للأدوار المحددة'}
                    </span>
                  </div>
                ) : null}
              </div>
            )}

            {/* WhatsApp info */}
            {isWhatsAppChannel && !isWebPushChannel && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-blue-700">
                  <Icon name="InformationCircleIcon" size={14} />
                  <span>سيتم جلب أرقام الهواتف المسجلة تلقائياً من ملفات المستخدمين المستهدفين</span>
                </div>
                {whatsappPhoneLoading ? (
                  <div className="flex items-center gap-2 text-xs text-gray-500 px-1">
                    <Icon name="ArrowPathIcon" size={12} className="animate-spin" />
                    <span>جارٍ جلب أرقام الهواتف...</span>
                  </div>
                ) : whatsappPhoneCount !== null ? (
                  <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg border ${
                    whatsappPhoneCount > 0
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :'bg-amber-50 border-amber-200 text-amber-700'
                  }`}>
                    <Icon name={whatsappPhoneCount > 0 ? 'DevicePhoneMobileIcon' : 'ExclamationTriangleIcon'} size={13} />
                    <span>
                      {whatsappPhoneCount > 0
                        ? `${whatsappPhoneCount} مستخدم لديهم أرقام هواتف مسجلة — سيتم إنشاء روابط واتساب لهم`
                        : 'لا يوجد مستخدمون بأرقام هواتف مسجلة في الأدوار المحددة'}
                    </span>
                  </div>
                ) : null}
              </div>
            )}
          </div>

          {/* WhatsApp Links Panel */}
          {showWhatsappLinks && whatsappLinks.length > 0 && (
            <div className="bg-white border border-green-200 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                  <Icon name="ChatBubbleLeftRightIcon" size={16} className="text-green-600" />
                  روابط واتساب — {whatsappLinks.length} مستخدم
                </h3>
                <button
                  onClick={() => setShowWhatsappLinks(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <Icon name="XMarkIcon" size={16} />
                </button>
              </div>
              <p className="text-xs text-gray-500">انقر على كل رابط لفتح محادثة واتساب مع الرسالة المُعدّة مسبقاً</p>
              <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                {whatsappLinks.map((u, idx) => (
                  <a
                    key={idx}
                    href={u.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-3 py-2.5 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors group"
                  >
                    <div className="w-7 h-7 rounded-full bg-green-200 flex items-center justify-center shrink-0">
                      <Icon name="UserIcon" size={13} className="text-green-700" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800 truncate">{u.name}</p>
                      <p className="text-[10px] text-gray-500 dir-ltr text-left">{u.phone}</p>
                    </div>
                    <Icon name="ArrowTopRightOnSquareIcon" size={13} className="text-green-600 shrink-0 group-hover:scale-110 transition-transform" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Result Banner */}
          {sendResult && (
            <div className={`rounded-xl p-4 flex items-center gap-3 text-sm ${
              sendResult.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-red-50 border border-red-200 text-red-700'
            }`}>
              <Icon name={sendResult.type === 'success' ? 'CheckCircleIcon' : 'ExclamationCircleIcon'} size={18} />
              <span>{sendResult.message}</span>
              <button onClick={() => setSendResult(null)} className="mr-auto opacity-60 hover:opacity-100">
                <Icon name="XMarkIcon" size={15} />
              </button>
            </div>
          )}

          {/* Send Button */}
          <button
            onClick={handleSend}
            disabled={sending || !title.trim() || !body.trim() || selectedRoles.length === 0}
            className="w-full h-12 rounded-xl text-sm font-bold text-white transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg"
            style={{
              background: isWebPushChannel
                ? 'linear-gradient(135deg, #F97316, #EA580C)'
                : broadcastType === 'marketing' ?'linear-gradient(135deg, #F59E0B, #D97706)' :'linear-gradient(135deg, #A855F7, #7C3AED)',
            }}
          >
            {sending ? (
              <>
                <Icon name="ArrowPathIcon" size={16} className="animate-spin" />
                جارٍ الإرسال...
              </>
            ) : (
              <>
                <Icon name={isWebPushChannel ? 'DevicePhoneMobileIcon' : broadcastType === 'marketing' ? 'PhotoIcon' : 'PaperAirplaneIcon'} size={16} />
                {isWebPushChannel
                  ? 'إرسال إشعار فوري على الأجهزة'
                  : broadcastType === 'marketing' ?'إرسال الإعلان التسويقي عبر واتساب' :'إرسال الإعلان'}
                {isWebPushChannel && pushSubCount !== null && pushSubCount > 0 && (
                  <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">
                    {pushSubCount} جهاز
                  </span>
                )}
                {!isWebPushChannel && previewCount !== null && previewCount > 0 && (
                  <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">
                    {previewCount} مستخدم
                  </span>
                )}
              </>
            )}
          </button>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-800">سجل الإعلانات المُرسَلة</h3>
            <button
              onClick={fetchHistory}
              disabled={loadingHistory}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-medium rounded-lg transition-colors"
            >
              <Icon name="ArrowPathIcon" size={13} className={loadingHistory ? 'animate-spin' : ''} />
              تحديث
            </button>
          </div>

          {loadingHistory ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Icon name="MegaphoneIcon" size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">لا توجد إعلانات مُرسَلة بعد</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {history.map(rec => (
                <div key={rec.id} className="px-5 py-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center shrink-0 mt-0.5">
                      <Icon name="MegaphoneIcon" size={14} className="text-purple-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{rec.title || '—'}</p>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{rec.body || '—'}</p>
                    </div>
                    <span className="text-[10px] text-gray-400 shrink-0 mt-0.5">{formatDate(rec.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
