'use client';

import { useLanguage } from '@/contexts/LanguageContext';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';

interface AgentFactory {
  id: string;
  company_name: string;
  factory_type: string;
  city: string;
  country: string;
}

interface Conversation {
  id: string;
  agent_id: string;
  factory_reg_id: string;
  factory_name: string;
  factory_type: string;
  last_message: string;
  last_message_at: string;
  unread_by_agent: number;
  is_active: boolean;
  created_at: string;
}

interface Message {
  id: string;
  conversation_id: string;
  agent_id: string;
  sender_role: 'agent' | 'factory' | 'system';
  message: string;
  msg_type: string;
  attachment_url: string;
  attachment_name: string;
  attachment_type: string;
  is_read: boolean;
  created_at: string;
}

const FACTORY_TYPE_KEYS: Record<string, string> = {
  local_factory: 'localFactory',
  international_factory: 'intlFactory',
  local_supplier: 'localSupplier',
};

const MSG_TYPE_CONFIG: Record<string, { labelKey: string; color: string }> = {
  text: { labelKey: 'typeMessageLabel', color: 'text-foreground' },
  note: { labelKey: 'typeNote', color: 'text-blue-600' },
  requirement: { labelKey: 'typeRequirement', color: 'text-amber-600' },
  update: { labelKey: 'typeUpdate', color: 'text-emerald-600' },
  document: { labelKey: 'typeDocument', color: 'text-purple-600' },
  image: { labelKey: 'typeImage', color: 'text-pink-600' },
};

const ALLOWED_ATTACH_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
const MAX_ATTACH_SIZE = 25 * 1024 * 1024;

interface AgentMessagingHubProps {
  userId: string;
  factories: AgentFactory[];
}

export default function AgentMessagingHub({ userId, factories }: AgentMessagingHubProps) {
  const { t, dir } = useLanguage();
  const ui = t.agentDashboard.messagingHub;
  const supabase = createClient();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [msgType, setMsgType] = useState<string>('text');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [creatingConv, setCreatingConv] = useState(false);
  const [selectedFactoryId, setSelectedFactoryId] = useState('');
  const [showNewConv, setShowNewConv] = useState(false);
  const [error, setError] = useState('');
  const [pendingAttachment, setPendingAttachment] = useState<{ file: File; previewUrl?: string } | null>(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchConversations = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('agent_conversations')
      .select('*')
      .eq('agent_id', userId)
      .order('last_message_at', { ascending: false });
    if (data) setConversations(data);
    if (err) setError(err.message);
    setLoading(false);
  }, [userId, supabase]);

  const fetchMessages = useCallback(async (convId: string) => {
    const { data } = await supabase
      .from('agent_messages')
      .select('*')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true });
    if (data) setMessages(data);
    // Mark as read
    await supabase
      .from('agent_conversations')
      .update({ unread_by_agent: 0 })
      .eq('id', convId)
      .eq('agent_id', userId);
    setConversations(prev =>
      prev.map(c => (c.id === convId ? { ...c, unread_by_agent: 0 } : c))
    );
  }, [userId, supabase]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Realtime subscription: update unread badges when new agent_messages arrive
  useEffect(() => {
    const channel = supabase
      .channel(`agent-messaging-unread-${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'agent_messages',
      }, (payload) => {
        const msg = payload.new as { conversation_id: string; sender_role: string; agent_id: string };
        // Only increment unread if the message is NOT from this agent
        if (msg.agent_id !== userId || msg.sender_role !== 'agent') {
          setConversations(prev =>
            prev.map(c =>
              c.id === msg.conversation_id
                ? { ...c, unread_by_agent: (c.unread_by_agent || 0) + 1 }
                : c
            )
          );
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'agent_conversations',
        filter: `agent_id=eq.${userId}`,
      }, (payload) => {
        const updated = payload.new as Conversation;
        setConversations(prev =>
          prev.map(c => c.id === updated.id ? { ...c, ...updated } : c)
        );
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId, supabase]);

  useEffect(() => {
    if (activeConv) {
      fetchMessages(activeConv.id);
    }
  }, [activeConv, fetchMessages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSelectConversation = (conv: Conversation) => {
    setActiveConv(conv);
  };

  const handleCreateConversation = async () => {
    if (!selectedFactoryId) return;
    const factory = factories.find(f => f.id === selectedFactoryId);
    if (!factory) return;

    // Check if conversation already exists
    const existing = conversations.find(c => c.factory_reg_id === selectedFactoryId);
    if (existing) {
      setActiveConv(existing);
      setShowNewConv(false);
      return;
    }

    setCreatingConv(true);
    const { data, error: err } = await supabase
      .from('agent_conversations')
      .insert({
        agent_id: userId,
        factory_reg_id: selectedFactoryId,
        factory_name: factory.company_name,
        factory_type: factory.factory_type,
        last_message: '',
        last_message_at: new Date().toISOString(),
        unread_by_agent: 0,
        is_active: true,
      })
      .select()
      .single();

    if (data) {
      setConversations(prev => [data, ...prev]);
      setActiveConv(data);
      setShowNewConv(false);
      setSelectedFactoryId('');
    }
    if (err) setError(err.message);
    setCreatingConv(false);
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() && !pendingAttachment) return;
    if (!activeConv) return;
    setSending(true);
    setUploadingAttachment(!!pendingAttachment);

    let attachmentUrl = '';
    let attachmentName = '';
    let attachmentType = '';

    if (pendingAttachment) {
      const ext = pendingAttachment.file.name.split('.').pop() || 'bin';
      const filePath = `agent-chat/${userId}/${Date.now()}.${ext}`;
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
        attachmentType = pendingAttachment.file.type;
      }
      clearAttachment();
      setUploadingAttachment(false);
    }

    const { error: err } = await supabase.from('agent_messages').insert({
      conversation_id: activeConv.id,
      agent_id: userId,
      sender_role: 'agent',
      message: newMessage.trim() || (attachmentName ? `[مرفق: ${attachmentName}]` : ''),
      msg_type: attachmentType ? 'image' : msgType,
      attachment_url: attachmentUrl || null,
      attachment_name: attachmentName || null,
      attachment_type: attachmentType || null,
      is_read: false,
    });
    if (!err) {
      setNewMessage('');
      setMsgType('text');
      await fetchMessages(activeConv.id);
      await fetchConversations();
    } else {
      setError(err.message);
    }
    setSending(false);
    setUploadingAttachment(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleAttachmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_ATTACH_TYPES.includes(file.type)) {
      setError('نوع الملف غير مدعوم. المسموح به: صور (JPG, PNG, WebP, GIF) وملفات PDF.');
      setTimeout(() => setError(''), 5000);
      return;
    }
    if (file.size > MAX_ATTACH_SIZE) {
      setError('حجم الملف كبير جداً. الحد الأقصى 25MB.');
      setTimeout(() => setError(''), 5000);
      return;
    }
    const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined;
    setPendingAttachment({ file, previewUrl });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const clearAttachment = useCallback(() => {
    if (pendingAttachment?.previewUrl) URL.revokeObjectURL(pendingAttachment.previewUrl);
    setPendingAttachment(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [pendingAttachment]);

  const totalUnread = conversations.reduce((sum, c) => sum + (c.unread_by_agent || 0), 0);

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden" dir={dir} style={{ height: '600px' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
            <Icon name="ChatBubbleLeftRightIcon" size={16} className="text-primary" />
          </div>
          <div>
            <h3 className="font-bold text-foreground text-sm">{ui.title}</h3>
            <p className="text-xs text-muted-foreground">
              {ui.conversations.replace('{count}', String(conversations.length))}
              {totalUnread > 0 && (
                <span className="mr-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {totalUnread}
                </span>
              )}
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowNewConv(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-primary/90 transition-colors"
        >
          <Icon name="PlusIcon" size={13} />
          {ui.newConversation}
        </button>
      </div>

      {error && (
        <div className="mx-4 mt-3 px-3 py-2 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs flex items-center gap-2">
          <Icon name="ExclamationCircleIcon" size={14} />
          {error}
          <button onClick={() => setError('')} className="mr-auto">
            <Icon name="XMarkIcon" size={12} />
          </button>
        </div>
      )}

      <div className="flex h-full" style={{ height: 'calc(100% - 57px)' }}>
        {/* Conversations List */}
        <div className="w-64 border-l border-border flex flex-col shrink-0 overflow-hidden">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
              <Icon name="ChatBubbleOvalLeftEllipsisIcon" size={32} className="text-muted-foreground mb-2" />
              <p className="text-xs text-muted-foreground">{ui.empty}</p>
              <p className="text-[11px] text-muted-foreground mt-1">{ui.emptyHint}</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {conversations.map(conv => (
                <button
                  key={conv.id}
                  onClick={() => handleSelectConversation(conv)}
                  className={`w-full text-right px-3 py-3 border-b border-border/50 hover:bg-muted/50 transition-colors ${
                    activeConv?.id === conv.id ? 'bg-primary/5 border-r-2 border-r-primary' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-1 mb-0.5">
                    <span className="font-semibold text-foreground text-xs truncate flex-1">
                      {conv.factory_name}
                    </span>
                    {conv.unread_by_agent > 0 && (
                      <span className="shrink-0 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                        {conv.unread_by_agent}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground mb-1">
                    {FACTORY_TYPE_KEYS[conv.factory_type] || conv.factory_type}
                  </p>
                  {conv.last_message && (
                    <p className="text-[11px] text-muted-foreground truncate">{conv.last_message}</p>
                  )}
                  {conv.last_message_at && (
                    <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                      {new Date(conv.last_message_at).toLocaleDateString('ar-YE')}
                    </p>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {!activeConv ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mb-3">
                <Icon name="ChatBubbleLeftRightIcon" size={28} className="text-muted-foreground" />
              </div>
              <p className="font-semibold text-foreground mb-1">{ui.selectConversation}</p>
              <p className="text-sm text-muted-foreground">{ui.selectHint}</p>
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <div className="px-4 py-3 border-b border-border bg-muted/20 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Icon name="BuildingOffice2Icon" size={15} className="text-primary" />
                  </div>
                  <div>
                    <p className="font-bold text-foreground text-sm">{activeConv.factory_name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {FACTORY_TYPE_KEYS[activeConv.factory_type] || activeConv.factory_type}
                    </p>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <Icon name="ChatBubbleOvalLeftEllipsisIcon" size={28} className="text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">{ui.startChatWith.replace('{name}', activeConv.factory_name)}</p>
                  </div>
                ) : (
                  messages.map(msg => {
                    const isAgent = msg.sender_role === 'agent';
                    const typeInfo = MSG_TYPE_CONFIG[msg.msg_type] || MSG_TYPE_CONFIG.text;
                    return (
                      <div
                        key={msg.id}
                        className={`flex ${isAgent ? 'justify-start' : 'justify-end'}`}
                      >
                        <div
                          className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 ${
                            isAgent
                              ? 'bg-primary text-white rounded-tr-sm' :'bg-muted text-foreground rounded-tl-sm'
                          }`}
                        >
                          {msg.msg_type !== 'text' && (
                            <span className={`text-[10px] font-bold block mb-1 ${isAgent ? 'text-white/70' : typeInfo.color}`}>
                              [{typeInfo.label}]
                            </span>
                          )}
                          {msg.attachment_url && msg.attachment_type?.startsWith('image/') && (
                            <div className="rounded-xl overflow-hidden mb-1.5 max-w-[200px]">
                              <img
                                src={msg.attachment_url}
                                alt={msg.attachment_name || 'صورة مرفقة'}
                                className="w-full h-auto object-cover max-h-40"
                              />
                            </div>
                          )}
                          {msg.attachment_url && !msg.attachment_type?.startsWith('image/') && (
                            <a
                              href={msg.attachment_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`flex items-center gap-1.5 text-xs mb-1.5 underline ${isAgent ? 'text-white/90' : 'text-primary'}`}
                            >
                              <Icon name="DocumentTextIcon" size={12} />
                              {msg.attachment_name || 'مرفق'}
                            </a>
                          )}
                          <p className="text-sm leading-relaxed">{msg.message}</p>
                          <p className={`text-[10px] mt-1 ${isAgent ? 'text-white/60' : 'text-muted-foreground'}`}>
                            {new Date(msg.created_at).toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <div className="px-4 py-3 border-t border-border bg-muted/10 shrink-0">
                {/* Type Selector */}
                <div className="flex gap-1.5 mb-2 overflow-x-auto pb-1">
                  {Object.entries(MSG_TYPE_CONFIG).map(([key, info]) => (
                    <button
                      key={key}
                      onClick={() => setMsgType(key)}
                      className={`shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
                        msgType === key
                          ? 'bg-primary text-white border-primary' :'bg-card border-border text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      {info.label}
                    </button>
                  ))}
                </div>

                {/* Attachment preview */}
                {pendingAttachment && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-primary/5 border border-primary/20 rounded-xl mb-2">
                    {pendingAttachment.previewUrl ? (
                      <img src={pendingAttachment.previewUrl} alt="Preview" className="w-9 h-9 rounded-lg object-cover shrink-0" />
                    ) : (
                      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Icon name="DocumentTextIcon" size={16} className="text-primary" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{pendingAttachment.file.name}</p>
                      <p className="text-[10px] text-muted-foreground">{(pendingAttachment.file.size / 1024 / 1024).toFixed(1)}MB</p>
                    </div>
                    <button onClick={clearAttachment} className="text-muted-foreground hover:text-foreground shrink-0">
                      <Icon name="XMarkIcon" size={14} />
                    </button>
                  </div>
                )}

                <div className="flex gap-2">
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
                    onClick={() => fileInputRef.current?.click()}
                    disabled={sending || uploadingAttachment}
                    title="إرفاق صورة أو ملف PDF"
                    className="w-9 h-9 flex items-center justify-center rounded-xl border border-border bg-background hover:bg-primary/5 hover:border-primary/40 text-muted-foreground hover:text-primary transition-colors disabled:opacity-40 shrink-0 self-end"
                  >
                    <Icon name="PaperClipIcon" size={16} />
                  </button>
                  <textarea
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={2}
                    placeholder={ui.typeMessage}
                    className="flex-1 px-3 py-2 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none"
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={sending || uploadingAttachment || (!newMessage.trim() && !pendingAttachment)}
                    className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1.5 self-end"
                  >
                    {sending || uploadingAttachment ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Icon name="PaperAirplaneIcon" size={15} />
                    )}
                    {ui.send}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* New Conversation Modal */}
      {showNewConv && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setShowNewConv(false)}>
          <div
            className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm p-5"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-foreground">{ui.newConversation}</h3>
              <button onClick={() => setShowNewConv(false)} className="w-7 h-7 rounded-lg hover:bg-muted flex items-center justify-center">
                <Icon name="XMarkIcon" size={15} className="text-muted-foreground" />
              </button>
            </div>
            <label className="block text-sm font-semibold text-foreground mb-2">{ui.selectFactory}</label>
            <select
              value={selectedFactoryId}
              onChange={e => setSelectedFactoryId(e.target.value)}
              className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:border-primary mb-4"
            >
              <option value="">{ui.select}</option>
              {factories.map(f => (
                <option key={f.id} value={f.id}>
                  {f.company_name} ({FACTORY_TYPE_KEYS[f.factory_type] || f.factory_type})
                </option>
              ))}
            </select>
            <div className="flex gap-3">
              <button
                onClick={() => setShowNewConv(false)}
                className="flex-1 px-4 py-2.5 border border-border rounded-xl text-sm font-semibold text-muted-foreground hover:bg-muted transition-colors"
              >
                {ui.cancel}
              </button>
              <button
                onClick={handleCreateConversation}
                disabled={!selectedFactoryId || creatingConv}
                className="flex-1 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {creatingConv ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Icon name="ChatBubbleLeftRightIcon" size={14} />
                )}
                {ui.startConversation}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
