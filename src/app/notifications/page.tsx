'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';

interface Notification {
  id: string;
  user_id: string;
  type: string; // Dynamic — supports all NotificationType values from notificationEngine
  title: string;
  body: string;
  link: string;
  is_read: boolean;
  metadata: Record<string, any>;
  created_at: string;
}

// ── Tactical Notification Type Config — auto-expandable ──────────────────────
const TYPE_CONFIG: Record<string, { icon: string; color: string; bg: string; labelKey: string }> = {
  rfq_submitted:    { icon: 'DocumentTextIcon',         color: 'text-blue-600',    bg: 'bg-blue-50',    labelKey: 'rfq_submitted' },
  rfq_responded:    { icon: 'ChatBubbleLeftRightIcon',  color: 'text-purple-600',  bg: 'bg-purple-50',  labelKey: 'rfq_responded' },
  rfq_accepted:     { icon: 'CheckCircleIcon',          color: 'text-green-600',   bg: 'bg-green-50',   labelKey: 'rfq_accepted' },
  rfq_rejected:     { icon: 'XCircleIcon',              color: 'text-red-600',     bg: 'bg-red-50',     labelKey: 'rfq_rejected' },
  order_placed:     { icon: 'ShoppingBagIcon',          color: 'text-blue-600',    bg: 'bg-blue-50',    labelKey: 'order_placed' },
  order_confirmed:  { icon: 'CheckCircleIcon',          color: 'text-green-600',   bg: 'bg-green-50',   labelKey: 'order_confirmed' },
  order_shipped:    { icon: 'TruckIcon',                color: 'text-amber-600',   bg: 'bg-amber-50',   labelKey: 'order_shipped' },
  order_delivered:  { icon: 'CheckBadgeIcon',           color: 'text-emerald-600', bg: 'bg-emerald-50', labelKey: 'order_delivered' },
  order_cancelled:  { icon: 'XCircleIcon',              color: 'text-red-600',     bg: 'bg-red-50',     labelKey: 'order_cancelled' },
  order_update:     { icon: 'TruckIcon',                color: 'text-amber-600',   bg: 'bg-amber-50',   labelKey: 'order_update' },
  new_message:      { icon: 'ChatBubbleOvalLeftIcon',   color: 'text-indigo-600',  bg: 'bg-indigo-50',  labelKey: 'new_message' },
  translation_ready:{ icon: 'LanguageIcon',             color: 'text-violet-600',  bg: 'bg-violet-50',  labelKey: 'translation_ready' },
  escrow_funded:    { icon: 'BanknotesIcon',            color: 'text-emerald-600', bg: 'bg-emerald-50', labelKey: 'escrow_funded' },
  escrow_green_light:{ icon: 'ShieldCheckIcon',         color: 'text-green-600',   bg: 'bg-green-50',   labelKey: 'escrow_green_light' },
  escrow_mark_ready:{ icon: 'CubeIcon',                 color: 'text-orange-600',  bg: 'bg-orange-50',  labelKey: 'escrow_mark_ready' },
  escrow_release_code:{ icon: 'KeyIcon',                color: 'text-amber-600',   bg: 'bg-amber-50',   labelKey: 'escrow_release_code' },
  escrow_released:  { icon: 'BanknotesIcon',            color: 'text-emerald-600', bg: 'bg-emerald-50', labelKey: 'escrow_released' },
  escrow_dispute:   { icon: 'ScaleIcon',                color: 'text-red-600',     bg: 'bg-red-50',     labelKey: 'escrow_dispute' },
  payment_submitted:{ icon: 'DocumentArrowUpIcon',      color: 'text-blue-600',    bg: 'bg-blue-50',    labelKey: 'payment_submitted' },
  payment_confirmed:{ icon: 'CheckCircleIcon',          color: 'text-green-600',   bg: 'bg-green-50',   labelKey: 'payment_confirmed' },
  payment:          { icon: 'BanknotesIcon',            color: 'text-emerald-600', bg: 'bg-emerald-50', labelKey: 'payment' },
  kyc_submitted:    { icon: 'IdentificationIcon',       color: 'text-blue-600',    bg: 'bg-blue-50',    labelKey: 'kyc_submitted' },
  kyc_approved:     { icon: 'ShieldCheckIcon',          color: 'text-green-600',   bg: 'bg-green-50',   labelKey: 'kyc_approved' },
  kyc_rejected:     { icon: 'XCircleIcon',              color: 'text-red-600',     bg: 'bg-red-50',     labelKey: 'kyc_rejected' },
  factory_registered:{ icon: 'BuildingOffice2Icon',     color: 'text-orange-600',  bg: 'bg-orange-50',  labelKey: 'factory_registered' },
  factory_approved: { icon: 'CheckBadgeIcon',           color: 'text-green-600',   bg: 'bg-green-50',   labelKey: 'factory_approved' },
  b2s_registered:   { icon: 'BuildingStorefrontIcon',   color: 'text-teal-600',    bg: 'bg-teal-50',    labelKey: 'b2s_registered' },
  b2s_approved:     { icon: 'CheckBadgeIcon',           color: 'text-teal-600',    bg: 'bg-teal-50',    labelKey: 'b2s_approved' },
  buyer_registered: { icon: 'UserCircleIcon',           color: 'text-blue-600',    bg: 'bg-blue-50',    labelKey: 'buyer_registered' },
  quote_sent:       { icon: 'PaperAirplaneIcon',        color: 'text-blue-600',    bg: 'bg-blue-50',    labelKey: 'quote_sent' },
  quote_accepted:   { icon: 'CheckCircleIcon',          color: 'text-green-600',   bg: 'bg-green-50',   labelKey: 'quote_accepted' },
  invoice_generated:{ icon: 'DocumentDuplicateIcon',    color: 'text-indigo-600',  bg: 'bg-indigo-50',  labelKey: 'invoice_generated' },
  dispute_opened:   { icon: 'ScaleIcon',                color: 'text-red-600',     bg: 'bg-red-50',     labelKey: 'dispute_opened' },
  dispute_resolved: { icon: 'CheckCircleIcon',          color: 'text-green-600',   bg: 'bg-green-50',   labelKey: 'dispute_resolved' },
  whatsapp_sent:    { icon: 'DevicePhoneMobileIcon',    color: 'text-green-600',   bg: 'bg-green-50',   labelKey: 'whatsapp_sent' },
  diagnostic_alert: { icon: 'ExclamationTriangleIcon',  color: 'text-amber-600',   bg: 'bg-amber-50',   labelKey: 'diagnostic_alert' },
  simulation_complete:{ icon: 'BeakerIcon',             color: 'text-violet-600',  bg: 'bg-violet-50',  labelKey: 'simulation_complete' },
  review:           { icon: 'StarIcon',                 color: 'text-yellow-600',  bg: 'bg-yellow-50',  labelKey: 'review' },
  system:           { icon: 'BellIcon',                 color: 'text-gray-600',    bg: 'bg-gray-100',   labelKey: 'system' },
};

const FILTER_KEYS = [
  { key: 'all', labelKey: 'filterAll' },
  { key: 'unread', labelKey: 'filterUnread' },
  { key: 'order_update', labelKey: 'filterOrders' },
  { key: 'new_message', labelKey: 'filterMessages' },
  { key: 'rfq_submitted', labelKey: 'filterRFQ' },
  { key: 'payment', labelKey: 'filterPayments' },
  { key: 'escrow_funded', labelKey: 'filterEscrow' },
  { key: 'dispute_opened', labelKey: 'filterDisputes' },
  { key: 'system', labelKey: 'filterSystem' },
] as const;

// ── Common DB Notification Text Localizer ──────────────────────────────────
function localizeNotificationText(text: string, lang: string): string {
  if (!text) return '';
  if (lang === 'ar') return text;

  const clean = text.trim();

  // Dictionary of exact matches (including emojis)
  const dictionary: Record<string, { zh: string; tr: string; en: string }> = {
    'رسالة جديدة': {
      zh: '新消息',
      tr: 'Yeni Mesaj',
      en: 'New Message',
    },
    'لديك رسالة جديدة في صندوق الوارد': {
      zh: '您的收件箱收到了一条新消息',
      tr: 'Gelen kutunuzda yeni bir mesajınız var',
      en: 'You have a new message in your inbox',
    },
    'تم قبول تسجيل المصنع ✅': {
      zh: '工厂入驻审核已通过 ✅',
      tr: 'Fabrika kaydı onaylandı ✅',
      en: 'Factory registration approved ✅',
    },
    'تم قبول تسجيل المصنع': {
      zh: '工厂入驻审核已通过',
      tr: 'Fabrika kaydı onaylandı',
      en: 'Factory registration approved',
    },
    'تهانينا! تم قبول تسجيل مصنعك. يمكنك الآن البدء في البيع': {
      zh: '恭喜！您的工厂注册已获批准，现在可以开始入驻并销售产品。',
      tr: 'Tebrikler! Fabrika kaydınız onaylandı. Artık satışa başlayabilirsiniz.',
      en: 'Congratulations! Your factory registration has been approved. You can now start selling.',
    },
    'تم التحقق من هويتك ✅': {
      zh: '身份实名认证已通过 ✅',
      tr: 'Kimlik doğrulandı ✅',
      en: 'Identity verified ✅',
    },
    'تم التحقق من هويتك': {
      zh: '身份实名认证已通过',
      tr: 'Kimlik doğrulandı',
      en: 'Identity verified',
    },
    'تم التحقق من هويتك بنجاح. حسابك مفعل بالكامل': {
      zh: '您的身份认证已成功通过，账户现已完全激活。',
      tr: 'Kimliğiniz başarıyla doğrulandı. Hesabınız tamamen aktiftir.',
      en: 'Your identity has been successfully verified. Your account is fully active.',
    },
    'تم استلام طلب جديد': {
      zh: '收到新订单',
      tr: 'Yeni sipariş alındı',
      en: 'New order received',
    },
    'تم تحديث حالة الطلب': {
      zh: '订单状态已更新',
      tr: 'Sipariş durumu güncellendi',
      en: 'Order status updated',
    },
    'تم تأكيد الدفع بنجاح': {
      zh: '付款已确认成功',
      tr: 'Ödeme başarıyla onaylandı',
      en: 'Payment successfully confirmed',
    },
    'طلب عرض أسعار جديد': {
      zh: '新的 RFQ 询价申请',
      tr: 'Yeni RFQ Fiyat Teklifi Talebi',
      en: 'New RFQ quote request',
    },
  };

  if (dictionary[clean]) {
    return dictionary[clean][lang as 'zh' | 'tr' | 'en'] || clean;
  }

  // Fallback pattern matches
  if (clean.includes('قبول تسجيل المصنع') || clean.includes('تسجيل مصنعك')) {
    if (lang === 'zh') return clean.includes('تهانينا') ? '恭喜！您的工厂注册已获批准，现在可以开始入驻并销售产品。' : '工厂入驻审核已通过 ✅';
    if (lang === 'tr') return clean.includes('تهانينا') ? 'Tebrikler! Fabrika kaydınız onaylandı. Artık satışa başlayabilirsiniz.' : 'Fabrika kaydı onaylandı ✅';
    if (lang === 'en') return clean.includes('تهانينا') ? 'Congratulations! Your factory registration has been approved. You can now start selling.' : 'Factory registration approved ✅';
  }

  if (clean.includes('التحقق من هويتك')) {
    if (lang === 'zh') return clean.includes('بنجاح') ? '您的身份认证已成功通过，账户现已完全激活。' : '身份实名认证已通过 ✅';
    if (lang === 'tr') return clean.includes('بنجاح') ? 'Kimliğiniz başarıyla doğrulandı. Hesabınız tamamen aktiftir.' : 'Kimlik doğrulandı ✅';
    if (lang === 'en') return clean.includes('بنجاح') ? 'Your identity has been successfully verified. Your account is fully active.' : 'Identity verified ✅';
  }

  if (clean.includes('لديك رسالة جديدة')) {
    if (lang === 'zh') return '您的收件箱收到了一条新消息';
    if (lang === 'tr') return 'Gelen kutunuzda yeni bir mesajınız var';
    if (lang === 'en') return 'You have a new message in your inbox';
  }
  if (clean.includes('رسالة جديدة')) {
    if (lang === 'zh') return '新消息';
    if (lang === 'tr') return 'Yeni Mesaj';
    if (lang === 'en') return 'New Message';
  }

  return text;
}

function timeAgo(dateStr: string, n: { justNow: string; minutesAgo: string; hoursAgo: string; daysAgo: string }, language: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const locale = language === 'ar' ? 'ar-SA' : language === 'zh' ? 'zh-CN' : language === 'tr' ? 'tr-TR' : 'en-US';
  if (mins < 1) return n.justNow;
  if (mins < 60) return n.minutesAgo.replace('{n}', String(mins));
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return n.hoursAgo.replace('{n}', String(hrs));
  const days = Math.floor(hrs / 24);
  if (days < 7) return n.daysAgo.replace('{n}', String(days));
  return new Date(dateStr).toLocaleDateString(locale, { month: 'short', day: 'numeric' });
}

function NotificationItem({
  notification,
  onMarkRead,
  onDelete,
  typeLabel,
  timeLabel,
  language,
}: {
  notification: Notification;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
  typeLabel: string;
  timeLabel: string;
  language: string;
}) {
  const cfg = TYPE_CONFIG[notification.type] || TYPE_CONFIG.system;
  const displayTitle = localizeNotificationText(notification.title, language);
  const displayBody = localizeNotificationText(notification.body, language);

  const content = (
    <div className={`group flex items-start gap-3 p-4 rounded-2xl border transition-all duration-200 ${
      notification.is_read
        ? 'bg-card border-border' : 'bg-primary/3 border-primary/20 shadow-sm'
    }`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${cfg.bg}`}>
        <Icon name={cfg.icon as any} size={20} className={cfg.color} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-foreground">
                {displayTitle}
              </p>
              {!notification.is_read && (
                <span className="inline-block w-2 h-2 bg-primary rounded-full shrink-0" />
              )}
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
                {typeLabel}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{displayBody}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-[10px] text-muted-foreground whitespace-nowrap">{timeLabel}</span>
            <button
              onClick={e => { e.preventDefault(); e.stopPropagation(); onDelete(notification.id); }}
              className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-muted transition-colors opacity-0 group-hover:opacity-100"
              aria-label="Delete notification"
            >
              <Icon name="XMarkIcon" size={12} className="text-muted-foreground" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div
      className="cursor-pointer"
      onClick={() => { if (!notification.is_read) onMarkRead(notification.id); }}
    >
      {notification.link ? (
        <Link href={notification.link} className="block">{content}</Link>
      ) : content}
    </div>
  );
}

export default function NotificationsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const supabase = createClient();
  const { t, dir, language } = useLanguage();
  const n = t.notifications;

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    if (authLoading) return;
    if (!user) router.push('/login?redirect=/notifications');
  }, [user, authLoading, router]);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setNotifications(data || []);
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchNotifications();

    const channel = supabase
      .channel('notifications-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        (payload) => {
          setNotifications(prev => [payload.new as Notification, ...prev]);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => fetchNotifications()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, fetchNotifications]);

  const markRead = async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
  };

  const markAllRead = async () => {
    if (!user) return;
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
  };

  const deleteNotification = async (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    await supabase.from('notifications').delete().eq('id', id);
  };

  const clearAll = async () => {
    if (!user || !window.confirm(n.clearConfirm)) return;
    setNotifications([]);
    await supabase.from('notifications').delete().eq('user_id', user.id);
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const filtered = (() => {
    if (filter === 'all') return notifications;
    if (filter === 'unread') return notifications.filter(n => !n.is_read);
    return notifications.filter(n => n.type === filter);
  })();

  // Group by date
  const grouped = filtered.reduce<Record<string, Notification[]>>((acc, item) => {
    const date = new Date(item.created_at);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    let key: string;
    if (date.toDateString() === today.toDateString()) key = n.today;
    else if (date.toDateString() === yesterday.toDateString()) key = n.yesterday;
    else {
      const locale = language === 'ar' ? 'ar-SA' : language === 'zh' ? 'zh-CN' : language === 'tr' ? 'tr-TR' : 'en-US';
      key = date.toLocaleDateString(locale, { month: 'long', day: 'numeric', year: 'numeric' });
    }

    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col" dir={dir}>
      <Header />
      <main className="flex-1">
        {/* Header */}
        <div className="bg-gradient-to-br from-primary/8 via-background to-background border-b border-border">
          <div className="max-w-3xl mx-auto px-4 md:px-6 py-8 md:py-10">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-xs font-semibold px-3 py-1.5 rounded-full mb-3">
                  <Icon name="BellIcon" size={14} />
                  {n.center}
                </div>
                <h1 className="text-2xl md:text-3xl font-bold text-foreground">{n.title}</h1>
                <p className="text-muted-foreground text-sm mt-1">
                  {unreadCount > 0
                    ? (unreadCount === 1 ? n.unreadOne : n.unreadMany).replace('{count}', String(unreadCount))
                    : n.allCaughtUp}
                </p>
              </div>
              <div className="flex gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="flex items-center gap-1.5 px-3 py-2 border border-border text-foreground text-xs font-medium rounded-xl hover:bg-muted transition-colors"
                  >
                    <Icon name="CheckIcon" size={14} />
                    {n.markAllRead}
                  </button>
                )}
                {notifications.length > 0 && (
                  <button
                    onClick={clearAll}
                    className="flex items-center gap-1.5 px-3 py-2 border border-border text-muted-foreground text-xs font-medium rounded-xl hover:bg-muted transition-colors"
                  >
                    <Icon name="TrashIcon" size={14} />
                    {n.clearAll}
                  </button>
                )}
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-4 gap-3 mt-6">
              {[
                { label: n.statTotal, count: notifications.length, icon: 'BellIcon', color: 'text-foreground' },
                { label: n.statUnread, count: unreadCount, icon: 'BellAlertIcon', color: 'text-primary' },
                { label: n.statOrders, count: notifications.filter(x => ['order_update','order_placed','order_confirmed','order_shipped','order_delivered'].includes(x.type)).length, icon: 'TruckIcon', color: 'text-amber-600' },
                { label: n.statEscrow, count: notifications.filter(x => x.type.startsWith('escrow')).length, icon: 'ShieldCheckIcon', color: 'text-emerald-600' },
              ].map((stat) => (
                <div key={stat.label} className="bg-card/60 border border-border rounded-xl p-3 text-center">
                  <Icon name={stat.icon as any} size={18} className={`${stat.color} mx-auto mb-1`} />
                  <p className="text-lg font-extrabold text-foreground">{stat.count}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 mobile-safe-bottom md:pb-10">
          {/* Filter tabs — scrollable on mobile */}
          <div className="flex gap-1 bg-muted p-1 rounded-xl mb-5 overflow-x-auto hide-scrollbar">
            {FILTER_KEYS.map(tab => {
              const count = tab.key === 'all'
                ? notifications.length
                : tab.key === 'unread'
                ? unreadCount
                : notifications.filter(n => n.type === tab.key).length;
              return (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                    filter === tab.key
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {(n as any)[tab.labelKey]}
                  {count > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                      filter === tab.key ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground'
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Notification list */}
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="bg-card border border-border rounded-2xl p-4 animate-pulse flex gap-3">
                  <div className="w-10 h-10 bg-muted rounded-xl shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded w-1/2" />
                    <div className="h-3 bg-muted rounded w-3/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 bg-card border border-border rounded-2xl">
              <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Icon name="BellSlashIcon" size={28} className="text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">
                {filter === 'unread' ? n.noUnread : n.noNotifications}
              </h3>
              <p className="text-sm text-muted-foreground">
                {filter === 'unread' ? n.noUnreadSubtitle : n.activitySubtitle}
              </p>
              {filter !== 'all' && (
                <button
                  onClick={() => setFilter('all')}
                  className="mt-4 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-xl"
                >
                  {n.viewAll}
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(grouped).map(([date, items]) => (
                <div key={date}>
                  <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{date}</h2>
                  <div className="space-y-2">
                    {items.map(n => (
                      <NotificationItem
                        key={n.id}
                        notification={n}
                        onMarkRead={markRead}
                        onDelete={deleteNotification}
                        typeLabel={(t.notifications.types as any)[(TYPE_CONFIG[n.type] || TYPE_CONFIG.system).labelKey] || TYPE_CONFIG.system.labelKey}
                        timeLabel={timeAgo(n.created_at, t.notifications, language)}
                        language={language}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
      <BottomNav />
    </div>
  );
}
