'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';
import { useLanguage } from '@/contexts/LanguageContext';
import AgentLanguageSelector, { CHAT_LANGUAGES, ChatLanguage } from './AgentLanguageSelector';

interface AdminMessage {
  id: string;
  agent_id: string;
  sender_role: 'agent' | 'admin' | 'system';
  message: string;
  msg_type: string;
  attachment_url: string;
  attachment_name: string;
  attachment_type?: string;
  is_read_by_agent: boolean;
  is_read_by_admin: boolean;
  created_at: string;
}

const MSG_TYPE_OPTIONS = ['text', 'note', 'update', 'alert', 'document'];

const ALLOWED_ATTACH_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
const MAX_ATTACH_SIZE = 25 * 1024 * 1024;

interface Props {
  userId: string;
}

export default function AgentAdminMessaging({ userId }: Props) {
  const { t, dir } = useLanguage();
  const ui = t.agentDashboard.adminMessaging;
  const supabase = createClient();

  const [messages, setMessages] = useState<AdminMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [msgType, setMsgType] = useState('text');
  const [error, setError] = useState('');
  const [chatLang, setChatLang] = useState<ChatLanguage>(
    () => CHAT_LANGUAGES.find(l => l.code === 'ar') || CHAT_LANGUAGES[0]
  );
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<{ file: File; previewUrl?: string } | null>(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('agent_admin_messages')
      .select('*')
      .eq('agent_id', userId)
      .order('created_at', { ascending: true });
    if (data) setMessages(data);
    if (err) setError(err.message);
    setLoading(false);

    // Mark agent messages as read
    await supabase
      .from('agent_admin_messages')
      .update({ is_read_by_agent: true })
      .eq('agent_id', userId)
      .eq('sender_role', 'admin')
      .eq('is_read_by_agent', false);
  }, [userId, supabase]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`agent-admin-msg-${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'agent_admin_messages',
        filter: `agent_id=eq.${userId}`,
      }, (payload) => {
        const msg = payload.new as AdminMessage;
        setMessages(prev => [...prev, msg]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, supabase]);

  const handleSend = async (text?: string) => {
    const content = (text || newMessage).trim();
    if (!content && !pendingAttachment) return;
    setSending(true);
    setUploadingAttachment(!!pendingAttachment);

    let attachmentUrl = '';
    let attachmentName = '';

    if (pendingAttachment) {
      const ext = pendingAttachment.file.name.split('.').pop() || 'bin';
      const filePath = `agent-admin-chat/${userId}/${Date.now()}.${ext}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('chat-media')
        .upload(filePath, pendingAttachment.file, { contentType: pendingAttachment.file.type, upsert: false });
      if (uploadError) {
        setError(uploadError.message || 'فشل رفع المرفق. حاول مرة أخرى.');
        setSending(false);
        setUploadingAttachment(false);
        return;
      }
      if (uploadData) {
        const { data: urlData } = supabase.storage.from('chat-media').getPublicUrl(filePath);
        attachmentUrl = urlData?.publicUrl || '';
        attachmentName = pendingAttachment.file.name;
      }
      clearAttachment();
      setUploadingAttachment(false);
    }

    const { error: err } = await supabase.from('agent_admin_messages').insert({
      agent_id: userId,
      sender_role: 'agent',
      message: content || (attachmentName ? `[مرفق: ${attachmentName}]` : ''),
      msg_type: msgType,
      attachment_url: attachmentUrl || null,
      attachment_name: attachmentName || null,
      is_read_by_agent: true,
      is_read_by_admin: false,
    });
    if (!err) {
      if (!text) setNewMessage('');
      setMsgType('text');
      setShowQuickReplies(false);
    } else {
      setError(err.message);
    }
    setSending(false);
    setUploadingAttachment(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const unreadFromAdmin = messages.filter(m => m.sender_role === 'admin' && !m.is_read_by_agent).length;

  const MSG_TYPE_COLORS: Record<string, string> = {
    text: 'text-foreground',
    note: 'text-blue-600',
    update: 'text-emerald-600',
    alert: 'text-red-600',
    document: 'text-purple-600',
  };

  // Determine input direction based on selected chat language
  const inputDir = chatLang.dir;

  const handleAttachmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const restoreScroll = () => {
      requestAnimationFrame(() => window.scrollTo(scrollX, scrollY));
    };
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_ATTACH_TYPES.includes(file.type)) {
      setError('نوع الملف غير مدعوم. المسموح به: صور وملفات PDF.');
      setTimeout(() => setError(''), 5000);
      restoreScroll();
      return;
    }
    if (file.size > MAX_ATTACH_SIZE) {
      setError('حجم الملف كبير جداً. الحد الأقصى 25MB.');
      setTimeout(() => setError(''), 5000);
      restoreScroll();
      return;
    }
    const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined;
    setPendingAttachment({ file, previewUrl });
    if (fileInputRef.current) fileInputRef.current.value = '';
    restoreScroll();
  };

  const clearAttachment = useCallback(() => {
    if (pendingAttachment?.previewUrl) URL.revokeObjectURL(pendingAttachment.previewUrl);
    setPendingAttachment(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [pendingAttachment]);

  return (
    <div dir={dir} className="bg-[#1E1E1E] border border-[#D4AF37]/20 rounded-2xl overflow-hidden" style={{ height: '620px' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#D4AF37]/15 bg-[#0A192F]/40">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-[#D4AF37]/15 rounded-lg flex items-center justify-center">
            <Icon name="ShieldCheckIcon" size={16} className="text-[#D4AF37]" />
          </div>
          <div>
            <h3 className="font-bold text-white text-sm">{ui.title}</h3>
            <p className="text-xs text-gray-400">{ui.subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {unreadFromAdmin > 0 && (
            <span className="min-w-[20px] h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1.5">
              {unreadFromAdmin}
            </span>
          )}
          {/* Language Selector */}
          <AgentLanguageSelector
            selectedLang={chatLang}
            onSelect={lang => {
              setChatLang(lang);
              setShowQuickReplies(false);
            }}
            compact
          />
        </div>
      </div>

      {/* Language indicator bar */}
      <div className="flex items-center gap-2 px-4 py-2 bg-[#0A192F]/20 border-b border-[#D4AF37]/10">
        <span className="text-base leading-none">{chatLang.flag}</span>
        <span className="text-xs text-[#D4AF37]/80 font-medium">{chatLang.nativeLabel}</span>
        <span className="text-[10px] text-gray-500">·</span>
        <span className="text-[10px] text-gray-500">{chatLang.script} script</span>
        {chatLang.dir === 'rtl' && (
          <span className="text-[10px] bg-[#D4AF37]/10 text-[#D4AF37] px-1.5 py-0.5 rounded font-medium">RTL</span>
        )}
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => setShowQuickReplies(q => !q)}
          className="flex items-center gap-1 text-[10px] text-[#D4AF37]/70 hover:text-[#D4AF37] transition-colors"
        >
          <Icon name="BoltIcon" size={11} />
          <span>{ui.quickRepliesLabel || 'Quick Replies'}</span>
        </button>
      </div>

      {/* Quick Replies Panel */}
      {showQuickReplies && (
        <div className="px-4 py-2.5 bg-[#0A192F]/30 border-b border-[#D4AF37]/10 flex flex-wrap gap-1.5">
          {chatLang.quickReplies.map((reply, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSend(reply)}
              disabled={sending}
              dir={chatLang.dir}
              className="text-xs px-3 py-1.5 rounded-full border border-[#D4AF37]/25 text-[#D4AF37]/80 hover:bg-[#D4AF37]/10 hover:border-[#D4AF37]/50 hover:text-[#D4AF37] transition-all disabled:opacity-50 font-medium"
            >
              {reply}
            </button>
          ))}
        </div>
      )}

      {/* Messages */}
      <div
        className="overflow-y-auto px-4 py-3 space-y-3"
        style={{ height: showQuickReplies ? 'calc(620px - 220px)' : 'calc(620px - 160px)' }}
      >
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-7 h-7 border-4 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-12 h-12 bg-[#D4AF37]/10 rounded-2xl flex items-center justify-center mb-3">
              <Icon name="ChatBubbleBottomCenterTextIcon" size={22} className="text-[#D4AF37]/60" />
            </div>
            <p className="font-semibold text-white text-sm mb-1">{ui.emptyTitle}</p>
            <p className="text-xs text-gray-500">{ui.emptyHint}</p>
          </div>
        ) : (
          messages.map(msg => {
            const isAgent = msg.sender_role === 'agent';
            const isSystem = msg.sender_role === 'system';
            if (isSystem) {
              return (
                <div key={msg.id} className="flex justify-center">
                  <span className="text-xs text-gray-500 bg-[#0A192F]/40 px-3 py-1 rounded-full">
                    {msg.message}
                  </span>
                </div>
              );
            }
            return (
              <div key={msg.id} className={`flex ${isAgent ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] ${isAgent ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                  {!isAgent && (
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <div className="w-5 h-5 bg-[#D4AF37] rounded-full flex items-center justify-center">
                        <Icon name="ShieldCheckIcon" size={11} className="text-[#0A192F]" />
                      </div>
                      <span className="text-[10px] font-semibold text-gray-400">{ui.adminLabel}</span>
                    </div>
                  )}
                  {/* Image attachment preview */}
                  {msg.attachment_url && msg.attachment_type?.startsWith('image/') && (
                    <div className="rounded-xl overflow-hidden max-w-[200px] border border-[#D4AF37]/20">
                      <img
                        src={msg.attachment_url}
                        alt={msg.attachment_name || 'صورة مرفقة'}
                        className="w-full h-auto object-cover max-h-40"
                      />
                    </div>
                  )}
                  {/* PDF / other attachment */}
                  {msg.attachment_url && !msg.attachment_type?.startsWith('image/') && (
                    <a
                      href={msg.attachment_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-colors ${
                        isAgent
                          ? 'bg-[#D4AF37]/20 border-[#D4AF37]/40 text-[#0A192F]'
                          : 'bg-[#0A192F]/40 border-[#D4AF37]/20 text-[#D4AF37] hover:bg-[#D4AF37]/10'
                      }`}
                    >
                      <Icon name="DocumentTextIcon" size={13} className="shrink-0" />
                      <span className="truncate max-w-[140px]">{msg.attachment_name || 'مرفق'}</span>
                      <Icon name="ArrowTopRightOnSquareIcon" size={11} className="shrink-0 ml-auto" />
                    </a>
                  )}
                  <div
                    className={`px-3.5 py-2.5 rounded-2xl text-sm ${
                      isAgent
                        ? 'bg-[#D4AF37] text-[#0A192F] rounded-br-sm font-medium'
                        : 'bg-[#0A192F]/60 text-white rounded-bl-sm border border-[#D4AF37]/15'
                    }`}
                  >
                    {msg.msg_type !== 'text' && (
                      <span className={`text-[10px] font-bold uppercase block mb-1 ${isAgent ? 'text-[#0A192F]/60' : MSG_TYPE_COLORS[msg.msg_type]}`}>
                        {t.agentDashboard.adminMessaging[`msgType_${msg.msg_type}` as keyof typeof ui] as string || msg.msg_type}
                      </span>
                    )}
                    <p className="leading-relaxed">{msg.message}</p>
                  </div>
                  <span className="text-[10px] text-gray-600 px-1">
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {isAgent && (
                      <span className="ml-1">
                        {msg.is_read_by_admin ? ' ✓✓' : ' ✓'}
                      </span>
                    )}
                  </span>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-[#D4AF37]/15 px-4 py-3 bg-[#0A192F]/20">
        {error && (
          <p className="text-xs text-red-400 mb-2">{error}</p>
        )}

        {/* Attachment preview */}
        {pendingAttachment && (
          <div className="flex items-center gap-2 px-3 py-2 bg-[#D4AF37]/10 border border-[#D4AF37]/25 rounded-xl mb-2">
            {pendingAttachment.previewUrl ? (
              <img src={pendingAttachment.previewUrl} alt="Preview" className="w-9 h-9 rounded-lg object-cover shrink-0" />
            ) : (
              <div className="w-9 h-9 rounded-lg bg-[#D4AF37]/15 flex items-center justify-center shrink-0">
                <Icon name="DocumentTextIcon" size={16} className="text-[#D4AF37]" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">{pendingAttachment.file.name}</p>
              <p className="text-[10px] text-gray-500">{(pendingAttachment.file.size / 1024 / 1024).toFixed(1)}MB</p>
            </div>
            <button onClick={clearAttachment} className="text-gray-500 hover:text-red-400 transition-colors shrink-0">
              <Icon name="XMarkIcon" size={14} />
            </button>
          </div>
        )}

        <div className="flex items-end gap-2">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp,image/gif,image/heic,image/heif,application/pdf"
            onChange={handleAttachmentChange}
            className="hidden"
          />
          {/* Attachment button */}
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); fileInputRef.current?.click(); }}
            disabled={sending || uploadingAttachment}
            title="إرفاق صورة أو ملف PDF"
            className="w-10 h-10 flex items-center justify-center rounded-xl border border-[#D4AF37]/25 bg-[#0A192F]/50 hover:bg-[#D4AF37]/10 hover:border-[#D4AF37]/50 text-gray-500 hover:text-[#D4AF37] transition-colors disabled:opacity-40 shrink-0"
          >
            <Icon name="PaperClipIcon" size={16} />
          </button>
          <div className="flex-1 bg-[#0A192F]/50 border border-[#D4AF37]/20 rounded-xl px-3 py-2 focus-within:border-[#D4AF37]/50 transition-colors">
            <div className="flex items-center gap-2 mb-1.5">
              <select
                value={msgType}
                onChange={e => setMsgType(e.target.value)}
                className="text-[10px] font-semibold bg-transparent text-[#D4AF37]/70 focus:outline-none cursor-pointer"
              >
                {MSG_TYPE_OPTIONS.map(tp => (
                  <option key={tp} value={tp} style={{ background: '#1E1E1E', color: '#D4AF37' }}>
                    {ui[`msgType_${tp}` as keyof typeof ui] as string || tp}
                  </option>
                ))}
              </select>
              <span className="text-[10px] text-gray-600">·</span>
              <span className="text-[10px] text-gray-500">{chatLang.flag} {chatLang.nativeLabel}</span>
            </div>
            <textarea
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={2}
              dir={inputDir}
              placeholder={chatLang.placeholder}
              className="w-full bg-transparent text-sm text-white placeholder:text-gray-600 focus:outline-none resize-none"
              style={{ unicodeBidi: 'plaintext' }}
            />
          </div>
          <button
            onClick={() => handleSend()}
            disabled={sending || uploadingAttachment || (!newMessage.trim() && !pendingAttachment)}
            className="w-10 h-10 bg-[#D4AF37] text-[#0A192F] rounded-xl flex items-center justify-center hover:bg-[#D4AF37]/90 transition-colors disabled:opacity-40 shrink-0 font-bold"
          >
            {sending || uploadingAttachment ? (
              <div className="w-4 h-4 border-2 border-[#0A192F] border-t-transparent rounded-full animate-spin" />
            ) : (
              <Icon name="PaperAirplaneIcon" size={16} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
