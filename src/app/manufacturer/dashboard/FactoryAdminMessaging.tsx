'use client';

import React, { useEffect } from 'react';
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

// ─── Factory ↔ Admin Messaging Component (factory side) ──────────────────────
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

  // Scroll to bottom on new messages
  React.useEffect(() => {
    adminMsgsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [adminMessages, adminMsgsEndRef]);

  // Realtime subscription
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminConv?.id, user]);

  const MSG_TYPE_LABELS: Record<string, string> = {
    text: md.typeMessage,
    order: md.typeOrder,
    instruction: md.typeDirective,
    file: md.typeFile,
    system: md.typeSystem,
  };

  const PRIORITY_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
    normal: { label: md.priorityNormal, color: 'text-gray-500', dot: 'bg-gray-400' },
    high: { label: md.priorityImportant, color: 'text-amber-600', dot: 'bg-amber-500' },
    urgent: { label: md.priorityUrgent, color: 'text-red-600', dot: 'bg-red-500' },
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl p-5 text-white">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
            <Icon name="ChatBubbleLeftRightIcon" size={24} className="text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold">{md.adminMessagingHeading}</h2>
            <p className="text-sm text-white/80">{md.adminDirectChatHint}</p>
          </div>
          <div className="shrink-0 flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-semibold text-white/90">{md.officialChannel}</span>
          </div>
        </div>
      </div>

      {adminConvLoading ? (
        <div className="flex items-center justify-center py-20">
          <Icon name="ArrowPathIcon" size={28} className="animate-spin text-primary" />
        </div>
      ) : !adminConv ? (
        /* No conversation yet — prompt factory to initiate */
        <div className="bg-card border border-border rounded-2xl p-10 text-center">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center mx-auto mb-4">
            <Icon name="ChatBubbleLeftRightIcon" size={36} className="text-slate-500" />
          </div>
          <p className="text-base font-bold text-foreground mb-2">{md.noConversationYet2}</p>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-6">
            {md.adminChatEmptyHint}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-md mx-auto">
            {[
              { icon: 'ClipboardDocumentListIcon', label: md.recvProductionOrders, color: 'text-red-600 bg-red-50 border-red-200' },
              { icon: 'InformationCircleIcon', label: md.officialDirectives, color: 'text-blue-600 bg-blue-50 border-blue-200' },
              { icon: 'ChatBubbleLeftIcon', label: md.directContact, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
            ].map(item => (
              <div key={item.label} className={`flex items-center gap-2 p-3 rounded-xl border text-xs font-semibold ${item.color}`}>
                <Icon name={item.icon as any} size={16} />
                {item.label}
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-6">
            {md.contactAdminHint}
          </p>
        </div>
      ) : (
        /* Conversation exists */
        <div className="bg-card border border-border rounded-2xl overflow-hidden flex flex-col" style={{ minHeight: '560px' }}>
          {/* Chat Header */}
          <div className="px-4 py-3 border-b border-border bg-muted/20 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shrink-0">
                <Icon name="BuildingOfficeIcon" size={18} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground">{md.directHubAdmin}</p>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <p className="text-[10px] text-muted-foreground">{md.privateAdminOnly}</p>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                {md.officialChannel}
              </span>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {adminMsgsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Icon name="ArrowPathIcon" size={22} className="animate-spin text-primary" />
              </div>
            ) : adminMessages.length === 0 ? (
              <div className="text-center py-10">
                <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
                  <Icon name="ChatBubbleLeftRightIcon" size={24} className="text-muted-foreground" />
                </div>
                <p className="text-sm font-semibold text-foreground mb-1">{md.noMessagesYet2}</p>
                <p className="text-xs text-muted-foreground">{md.adminMessagesWillAppear}</p>
              </div>
            ) : adminMessages.map((msg: any) => {
              const isAdmin = msg.sender_role === 'admin';
              const prioConf = PRIORITY_CONFIG[msg.priority] || PRIORITY_CONFIG.normal;
              return (
                <div key={msg.id} className={`flex ${isAdmin ? 'justify-start' : 'justify-end'}`}>
                  <div className="max-w-[78%]">
                    {/* Sender label + badges */}
                    <div className={`flex items-center gap-1.5 mb-1 ${isAdmin ? 'justify-start' : 'justify-end'}`}>
                      {isAdmin && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                          {md.adminLabel}
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
                    {/* Bubble */}
                    <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                      isAdmin
                        ? 'bg-muted text-foreground rounded-tl-sm'
                        : 'bg-primary text-primary-foreground rounded-tr-sm'
                    }`}>
                      {msg.attachment_url && (
                        <ChatAttachmentView
                          url={msg.attachment_url}
                          name={msg.attachment_name || md.attachment}
                          tone="dark"
                        />
                      )}
                      <p className="whitespace-pre-wrap text-xs">{msg.message}</p>
                    </div>
                    {/* Read status for factory messages */}
                    {!isAdmin && (
                      <div className="flex justify-end mt-0.5">
                        <span className={`text-[9px] ${msg.is_read_by_admin ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                          {msg.is_read_by_admin ? md.adminRead : md.msgSent}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={adminMsgsEndRef} />
          </div>

          {/* Input Area */}
          <div className="px-4 py-3 border-t border-border bg-card shrink-0">
            <div className="flex items-end gap-2">
              <textarea
                value={adminMsgInput}
                onChange={e => setAdminMsgInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendAdminMessage();
                  }
                }}
                placeholder={md.adminReplyPh}
                rows={2}
                dir={dir}
                className="flex-1 px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary resize-none"
              />
              <div className="flex flex-col gap-1.5 shrink-0">
                <ChatImageAttachment
                  attachment={adminMsgAttachment}
                  onAttach={setAdminMsgAttachment}
                  onRemove={() => setAdminMsgAttachment(null)}
                  disabled={adminMsgSending}
                />
                <button
                  onClick={sendAdminMessage}
                  disabled={adminMsgSending || (!adminMsgInput.trim() && !adminMsgAttachment)}
                  className="h-10 w-10 bg-primary text-primary-foreground rounded-xl flex items-center justify-center hover:opacity-90 transition-opacity disabled:opacity-40"
                >
                  {adminMsgSending
                    ? <Icon name="ArrowPathIcon" size={16} className="animate-spin" />
                    : <Icon name="PaperAirplaneIcon" size={16} />
                  }
                </button>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1.5 text-right">
              {md.privateChatFooter}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
