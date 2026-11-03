'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';
import ChatImageAttachment from '@/components/ChatImageAttachment';
import ChatAttachmentView from '@/components/ChatAttachmentView';
import { useLanguage } from '@/contexts/LanguageContext';

export interface FactoryAdminMessagingProps {
  user: any;
  supabase: any;
  adminConv: any | null;
  adminConvLoading: boolean;
  adminMessages: any[];
  setAdminMessages: (v: any) => void;
  adminMsgsLoading: boolean;
  adminMsgInput: string;
  setAdminMsgInput: (v: string) => void;
  adminMsgSending: boolean;
  sendAdminMessage: () => void;
  fetchAdminConversation: () => void;
  adminMsgsEndRef: React.RefObject<HTMLDivElement>;
  md: any;
  adminMsgAttachment: any;
  setAdminMsgAttachment: (v: any) => void;
}

export default function FactoryAdminMessaging({
  user,
  supabase,
  adminConv,
  adminConvLoading,
  adminMessages,
  setAdminMessages,
  adminMsgsLoading,
  adminMsgInput,
  setAdminMsgInput,
  adminMsgSending,
  sendAdminMessage,
  adminMsgsEndRef,
  md,
  adminMsgAttachment,
  setAdminMsgAttachment,
}: FactoryAdminMessagingProps) {
  const { dir, isRTL } = useLanguage();
  const router = useRouter();

  // القناة النشطة حالياً
  const [selectedChannel, setSelectedChannel] = useState<'admin' | 'agent' | 'logistics'>('admin');

  // التمرير التلقائي لأسفل المحادثة
  React.useEffect(() => {
    adminMsgsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [adminMessages, adminMsgsEndRef]);

  // الاشتراك اللحظي في الرسائل (Realtime)
  React.useEffect(() => {
    if (!adminConv?.id || !user) return;
    const channel = supabase
      .channel(`factory-admin-msgs:${adminConv.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'admin_factory_messages',
        filter: `conversation_id=eq.${adminConv.id}`,
      }, (payload: any) => {
        const msg = payload.new;
        setAdminMessages((prev: any[]) => prev.some((m: any) => m.id === msg.id) ? prev : [...prev, msg]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [adminConv?.id, user, supabase, setAdminMessages]);

  const MSG_TYPE_LABELS: Record<string, string> = {
    text: md?.typeMessage || 'رسالة',
    order: md?.typeOrder || 'طلب إنتاج',
    instruction: md?.typeDirective || 'توجيه',
    file: md?.typeFile || 'ملف',
    system: md?.typeSystem || 'إشعار نظام',
  };

  const PRIORITY_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
    normal: { label: md?.priorityNormal || 'عادي', color: 'text-gray-500', dot: 'bg-gray-400' },
    high: { label: md?.priorityImportant || 'هام', color: 'text-amber-600', dot: 'bg-amber-500' },
    urgent: { label: md?.priorityUrgent || 'عاجل', color: 'text-red-600', dot: 'bg-red-500' },
  };

  return (
    <div className="space-y-4">
      {/* ── شريط تبديل قنوات المراسلة الثلاث ── */}
      <div className="grid grid-cols-3 gap-2 p-1.5 bg-muted/60 rounded-2xl border border-border">
        <button
          type="button"
          onClick={() => setSelectedChannel('admin')}
          className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
            selectedChannel === 'admin'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
          }`}
        >
          <Icon name="BuildingOfficeIcon" size={16} />
          <span>مراسلة الإدارة</span>
        </button>

        <button
          type="button"
          onClick={() => router.push('/agent/messages')}
          className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-background/50 transition-all"
        >
          <Icon name="UserGroupIcon" size={16} />
          <span>مندوب المبيعات</span>
        </button>

        <button
          type="button"
          onClick={() => router.push('/manufacturer/logistics')}
          className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-background/50 transition-all"
        >
          <Icon name="TruckIcon" size={16} />
          <span>الشحن واللوجستيات</span>
        </button>
      </div>

      {/* ── ترويسة القناة النشطة ── */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl p-4 text-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            <Icon name="ChatBubbleLeftRightIcon" size={20} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-bold truncate">{md?.adminMessagingHeading || 'مراسلات الإدارة المركزية'}</h2>
            <p className="text-[11px] text-white/80 truncate">{md?.adminDirectChatHint || 'قناة مشفرة ومباشرة للاتفاقيات وأوامر التوريد'}</p>
          </div>
          <div className="shrink-0 flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] font-semibold text-white/90">{md?.officialChannel || 'قناة رسمية'}</span>
          </div>
        </div>
      </div>

      {adminConvLoading ? (
        <div className="flex items-center justify-center py-20 bg-card border border-border rounded-2xl">
          <Icon name="ArrowPathIcon" size={28} className="animate-spin text-primary" />
        </div>
      ) : (
        /* صندوق المحادثة الموحد (يعمل دائماً حتى لو كانت أول رسالة) */
        <div className="bg-card border border-border rounded-2xl overflow-hidden flex flex-col shadow-sm" style={{ minHeight: '520px' }}>
          
          {/* Messages Body */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {adminMsgsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Icon name="ArrowPathIcon" size={22} className="animate-spin text-primary" />
              </div>
            ) : (!adminConv || adminMessages.length === 0) ? (
              /* حالة عدم وجود رسائل سابقة مع تشجيع على البدء */
              <div className="text-center py-12 px-4">
                <div className="w-16 h-16 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto mb-3">
                  <Icon name="ChatBubbleLeftRightIcon" size={28} className="text-muted-foreground" />
                </div>
                <p className="text-sm font-bold text-foreground mb-1">
                  {md?.noConversationYet2 || 'لا توجد رسائل سابقة مع الإدارة'}
                </p>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  {md?.adminChatEmptyHint || 'يمكنك كتابة رسالتك أو استفسارك في الأسفل وسيتم تسليمها لفريق العمل مباشرة.'}
                </p>
              </div>
            ) : (
              adminMessages.map((msg: any) => {
                const isAdmin = msg.sender_role === 'admin';
                const prioConf = PRIORITY_CONFIG[msg.priority] || PRIORITY_CONFIG.normal;
                return (
                  <div key={msg.id} className={`flex ${isAdmin ? 'justify-start' : 'justify-end'}`}>
                    <div className="max-w-[80%]">
                      <div className={`flex items-center gap-1.5 mb-1 ${isAdmin ? 'justify-start' : 'justify-end'}`}>
                        {isAdmin && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                            {md?.adminLabel || 'الإدارة'}
                          </span>
                        )}
                        {msg.msg_type && msg.msg_type !== 'text' && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                            {MSG_TYPE_LABELS[msg.msg_type] || msg.msg_type}
                          </span>
                        )}
                        {msg.priority && msg.priority !== 'normal' && (
                          <span className={`flex items-center gap-1 text-[9px] font-bold ${prioConf.color}`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${prioConf.dot}`} />
                            {prioConf.label}
                          </span>
                        )}
                        <span className="text-[9px] text-muted-foreground">
                          {new Date(msg.created_at).toLocaleTimeString(isRTL ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                        isAdmin
                          ? 'bg-muted text-foreground rounded-tl-sm'
                          : 'bg-primary text-primary-foreground rounded-tr-sm'
                      }`}>
                        {msg.attachment_url && (
                          <ChatAttachmentView
                            url={msg.attachment_url}
                            name={msg.attachment_name || md?.attachment || 'مرفق'}
                            tone="dark"
                          />
                        )}
                        <p className="whitespace-pre-wrap text-xs">{msg.message}</p>
                      </div>
                      {!isAdmin && (
                        <div className="flex justify-end mt-0.5">
                          <span className={`text-[9px] ${msg.is_read_by_admin ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                            {msg.is_read_by_admin ? (md?.adminRead || 'تمت القراءة') : (md?.msgSent || 'تم الإرسال')}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={adminMsgsEndRef} />
          </div>

          {/* ── Input Area: متاح دائماً للكتابة والإرسال ── */}
          <div className="px-4 py-3 border-t border-border bg-card shrink-0">
            <div className="flex items-end gap-2">
              <textarea
                value={adminMsgInput}
                onChange={e => setAdminMsgInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (!adminMsgSending && (adminMsgInput.trim() || adminMsgAttachment)) {
                      sendAdminMessage();
                    }
                  }
                }}
                placeholder={md?.adminReplyPh || 'اكتب استفسارك أو طلبك للإدارة هنا...'}
                rows={2}
                dir={dir}
                className="flex-1 px-3 py-2 rounded-xl border border-border bg-background text-foreground text-xs focus:outline-none focus:border-primary resize-none"
              />
              <div className="flex flex-col gap-1.5 shrink-0">
                <ChatImageAttachment
                  attachment={adminMsgAttachment}
                  onAttach={setAdminMsgAttachment}
                  onRemove={() => setAdminMsgAttachment(null)}
                  disabled={adminMsgSending}
                />
                <button
                  type="button"
                  onClick={sendAdminMessage}
                  disabled={adminMsgSending || (!adminMsgInput.trim() && !adminMsgAttachment)}
                  className="h-9 w-9 bg-primary text-primary-foreground rounded-xl flex items-center justify-center hover:opacity-90 transition-opacity disabled:opacity-40"
                >
                  {adminMsgSending
                    ? <Icon name="ArrowPathIcon" size={15} className="animate-spin" />
                    : <Icon name="PaperAirplaneIcon" size={15} />
                  }
                </button>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 text-right">
              {md?.privateChatFooter || 'قناة تواصل مشفرة ومباشرة مع إدارة المنصة'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
