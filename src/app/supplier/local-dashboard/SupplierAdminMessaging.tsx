'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';
import { uploadChatImage } from '@/components/ChatImageAttachment';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AdminConversation {
  id: string;
  admin_id: string;
  participant_id: string;
  participant_role: string;
  participant_category?: string | null;
  participant_name: string;
  participant_company: string;
  subject: string;
  last_message: string;
  last_message_at: string;
  unread_by_admin: number;
  unread_by_participant: number;
  is_active: boolean;
  created_at: string;
}

interface AdminMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_role: string;
  message: string;
  msg_type: string;
  attachment_url?: string;
  attachment_name?: string;
  attachment_type?: string;
  is_read_by_admin: boolean;
  is_read_by_participant: boolean;
  created_at: string;
}

interface SupplierAdminMessagingProps {
  userId: string;
  companyName?: string;
  fullName?: string;
}

function formatMsgTime(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatMsgDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SupplierAdminMessaging({ userId, companyName, fullName }: SupplierAdminMessagingProps) {
  const supabase = createClient();

  const [conversations, setConversations] = useState<AdminConversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AdminMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [msgsLoading, setMsgsLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [showNewConv, setShowNewConv] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [creatingConv, setCreatingConv] = useState(false);
  const [attachment, setAttachment] = useState<{ file: File; name: string; previewUrl?: string } | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // ── Fetch conversations for this supplier ──────────────────────────────────

  const fetchConversations = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('admin_conversations')
        .select('*')
        .eq('participant_id', userId)
        .order('last_message_at', { ascending: false, nullsFirst: false });
      setConversations((data || []) as AdminConversation[]);
    } catch {
      setConversations([]);
    } finally {
      setLoading(false);
    }
  }, [supabase, userId]);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  // ── Fetch messages ─────────────────────────────────────────────────────────

  const fetchMessages = useCallback(async (convId: string) => {
    setMsgsLoading(true);
    try {
      const { data } = await supabase
        .from('admin_messages')
        .select('*')
        .eq('conversation_id', convId)
        .order('created_at', { ascending: true });
      setMessages((data || []) as AdminMessage[]);
      // Mark messages as read by participant
      await supabase
        .from('admin_messages')
        .update({ is_read_by_participant: true })
        .eq('conversation_id', convId)
        .eq('sender_role', 'admin');
      await supabase
        .from('admin_conversations')
        .update({ unread_by_participant: 0 })
        .eq('id', convId);
    } catch {
      setMessages([]);
    } finally {
      setMsgsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    if (activeConvId) fetchMessages(activeConvId);
  }, [activeConvId, fetchMessages]);

  useEffect(() => { scrollToBottom(); }, [messages]);

  // ── Real-time subscription ─────────────────────────────────────────────────

  useEffect(() => {
    if (!activeConvId) return;
    const channel = supabase
      .channel(`supplier-msgs-${activeConvId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'admin_messages',
        filter: `conversation_id=eq.${activeConvId}`,
      }, (payload) => {
        setMessages(prev => {
          const exists = prev.some(m => m.id === payload.new.id);
          if (exists) return prev;
          return [...prev, payload.new as AdminMessage];
        });
        scrollToBottom();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeConvId, supabase]);

  // ── Create new conversation with admin ────────────────────────────────────

  const handleCreateConversation = async () => {
    if (!newSubject.trim()) return;
    setCreatingConv(true);
    setError('');
    try {
      // Find admin user
      const { data: adminData } = await supabase
        .from('user_profiles')
        .select('id, full_name, company_name')
        .eq('role', 'admin')
        .limit(1)
        .single();

      if (!adminData) {
        setError('تعذّر الاتصال بالإدارة. يرجى المحاولة لاحقاً.');
        return;
      }

      const { data: conv, error: convErr } = await supabase
        .from('admin_conversations')
        .insert({
          admin_id: adminData.id,
          participant_id: userId,
          participant_role: 'supplier',
          participant_category: 'local_supplier',
          participant_name: fullName || companyName || 'مورد محلي',
          participant_company: companyName || '',
          subject: newSubject.trim(),
          last_message_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (convErr || !conv) {
        setError('فشل إنشاء المحادثة. يرجى المحاولة مجدداً.');
        return;
      }

      setConversations(prev => [conv as AdminConversation, ...prev]);
      setActiveConvId(conv.id);
      setShowNewConv(false);
      setNewSubject('');
      setShowMobileSidebar(false);
    } catch {
      setError('حدث خطأ غير متوقع.');
    } finally {
      setCreatingConv(false);
    }
  };

  // ── Send message ───────────────────────────────────────────────────────────

  const handleSend = async () => {
    const text = input.trim();
    if (!text && !attachment) return;
    if (!activeConvId) return;
    setSending(true);
    setError('');
    try {
      let attachmentUrl: string | null = null;
      let attachmentName: string | null = null;
      let attachmentType: string | null = null;

      if (attachment) {
        setUploadingFile(true);
        const result = await uploadChatImage(attachment.file, userId, 'admin-messaging');
        setUploadingFile(false);
        if (result) {
          attachmentUrl = result.publicUrl;
          attachmentName = result.fileName;
          attachmentType = attachment.file.type;
        }
      }

      const msgType = attachmentUrl
        ? (attachment?.file.type.startsWith('image/') ? 'image' : 'document')
        : 'text';

      const { data: msg, error: msgErr } = await supabase
        .from('admin_messages')
        .insert({
          conversation_id: activeConvId,
          sender_id: userId,
          sender_role: 'participant',
          message: text || (attachmentName || 'مرفق'),
          msg_type: msgType,
          attachment_url: attachmentUrl,
          attachment_name: attachmentName,
          attachment_type: attachmentType,
          is_read_by_admin: false,
          is_read_by_participant: true,
        })
        .select()
        .single();

      if (!msgErr && msg) {
        setMessages(prev => {
          const exists = prev.some(m => m.id === msg.id);
          return exists ? prev : [...prev, msg as AdminMessage];
        });
        setInput('');
        setAttachment(null);
        scrollToBottom();
        setConversations(prev => prev.map(c =>
          c.id === activeConvId
            ? { ...c, last_message: text || (attachmentName || 'مرفق'), last_message_at: msg.created_at }
            : c
        ));
      } else {
        setError('فشل إرسال الرسالة.');
      }
    } catch {
      setError('حدث خطأ أثناء الإرسال.');
    } finally {
      setSending(false);
      setUploadingFile(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined;
    setAttachment({ file, name: file.name, previewUrl });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const activeConv = conversations.find(c => c.id === activeConvId);
  const totalUnread = conversations.reduce((sum, c) => sum + (c.unread_by_participant || 0), 0);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-800 to-emerald-900 rounded-2xl p-5 border border-emerald-600/30">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center shrink-0">
            <Icon name="MessageSquare" size={24} className="text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-white">التواصل مع الإدارة</h2>
            <p className="text-sm text-emerald-200">تواصل مباشر مع فريق إدارة المنصة — استفسارات، دعم، ومتابعة</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {totalUnread > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 border border-red-500/30 rounded-xl">
                <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                <span className="text-sm font-bold text-red-300">{totalUnread} جديد</span>
              </div>
            )}
            <button
              onClick={() => setShowNewConv(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-white text-emerald-800 hover:bg-emerald-50 transition-colors"
            >
              <Icon name="Plus" size={16} />
              محادثة جديدة
            </button>
          </div>
        </div>
      </div>

      {/* New Conversation Modal */}
      {showNewConv && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-800">محادثة جديدة مع الإدارة</h3>
              <button onClick={() => { setShowNewConv(false); setNewSubject(''); setError(''); }}
                className="text-gray-400 hover:text-gray-600">
                <Icon name="X" size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">موضوع الرسالة</label>
                <input
                  type="text"
                  value={newSubject}
                  onChange={e => setNewSubject(e.target.value)}
                  placeholder="مثال: استفسار عن طلب، مشكلة في المنتج..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  dir="rtl"
                />
              </div>
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <div className="flex gap-3">
                <button
                  onClick={handleCreateConversation}
                  disabled={creatingConv || !newSubject.trim()}
                  className="flex-1 bg-emerald-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                >
                  {creatingConv ? 'جارٍ الإنشاء...' : 'بدء المحادثة'}
                </button>
                <button
                  onClick={() => { setShowNewConv(false); setNewSubject(''); setError(''); }}
                  className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Messaging Layout */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden" style={{ height: '600px' }}>
        <div className="flex h-full">

          {/* ── Conversations Sidebar ── */}
          <div className={`${activeConvId && !showMobileSidebar ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-72 border-l border-gray-100 bg-gray-50 shrink-0`}>
            <div className="p-3 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">المحادثات</p>
            </div>
            {loading ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : conversations.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                <Icon name="MessageSquare" size={32} className="text-gray-300 mb-3" />
                <p className="text-gray-500 text-sm">لا توجد محادثات بعد</p>
                <button
                  onClick={() => setShowNewConv(true)}
                  className="mt-3 text-emerald-600 text-sm font-medium hover:underline"
                >
                  ابدأ محادثة مع الإدارة
                </button>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto">
                {conversations.map(conv => (
                  <button
                    key={conv.id}
                    onClick={() => { setActiveConvId(conv.id); setShowMobileSidebar(false); }}
                    className={`w-full text-right px-4 py-3 border-b border-gray-100 transition-colors hover:bg-white ${
                      activeConvId === conv.id ? 'bg-white border-r-2 border-r-emerald-500' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-medium">إدارة</span>
                          {conv.unread_by_participant > 0 && (
                            <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                          )}
                        </div>
                        <p className="text-sm font-medium text-gray-800 truncate">{conv.subject}</p>
                        {conv.last_message && (
                          <p className="text-xs text-gray-400 truncate mt-0.5">{conv.last_message}</p>
                        )}
                      </div>
                      <span className="text-xs text-gray-400 shrink-0 mt-1">
                        {conv.last_message_at ? formatMsgTime(conv.last_message_at) : ''}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Message Area ── */}
          <div className={`${activeConvId && !showMobileSidebar ? 'flex' : 'hidden md:flex'} flex-1 flex-col min-w-0`}>
            {!activeConvId ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mb-4">
                  <Icon name="MessageSquare" size={28} className="text-emerald-500" />
                </div>
                <p className="text-gray-600 font-medium mb-1">اختر محادثة أو ابدأ محادثة جديدة</p>
                <p className="text-gray-400 text-sm">تواصل مباشرة مع فريق إدارة المنصة</p>
                <button
                  onClick={() => setShowNewConv(true)}
                  className="mt-4 flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors"
                >
                  <Icon name="Plus" size={15} />
                  محادثة جديدة
                </button>
              </div>
            ) : (
              <>
                {/* Conversation Header */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white shrink-0">
                  <button
                    onClick={() => setShowMobileSidebar(true)}
                    className="md:hidden text-gray-400 hover:text-gray-600"
                  >
                    <Icon name="ArrowRight" size={18} />
                  </button>
                  <div className="w-9 h-9 bg-emerald-100 rounded-xl flex items-center justify-center shrink-0">
                    <Icon name="Shield" size={16} className="text-emerald-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 text-sm truncate">{activeConv?.subject}</p>
                    <p className="text-xs text-gray-400">إدارة المنصة — DirectHub</p>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
                  {msgsLoading ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                      <Icon name="MessageSquare" size={28} className="text-gray-300 mb-2" />
                      <p className="text-gray-400 text-sm">لا توجد رسائل بعد. ابدأ المحادثة!</p>
                    </div>
                  ) : (
                    <>
                      {messages.map((msg, idx) => {
                        const isSupplier = msg.sender_id === userId;
                        const showDate = idx === 0 || formatMsgDate(messages[idx - 1].created_at) !== formatMsgDate(msg.created_at);
                        return (
                          <React.Fragment key={msg.id}>
                            {showDate && (
                              <div className="flex items-center gap-2 my-2">
                                <div className="flex-1 h-px bg-gray-200" />
                                <span className="text-xs text-gray-400 px-2">{formatMsgDate(msg.created_at)}</span>
                                <div className="flex-1 h-px bg-gray-200" />
                              </div>
                            )}
                            <div className={`flex ${isSupplier ? 'justify-start' : 'justify-end'}`}>
                              <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                                isSupplier
                                  ? 'bg-white border border-gray-100 text-gray-800 rounded-tr-sm' :'bg-emerald-600 text-white rounded-tl-sm'
                              }`}>
                                {msg.msg_type === 'image' && msg.attachment_url ? (
                                  <a href={msg.attachment_url} target="_blank" rel="noopener noreferrer">
                                    <img src={msg.attachment_url} alt={msg.attachment_name || 'صورة'} className="max-w-full rounded-lg mb-1" style={{ maxHeight: 200 }} />
                                  </a>
                                ) : msg.msg_type === 'document' && msg.attachment_url ? (
                                  <a href={msg.attachment_url} target="_blank" rel="noopener noreferrer"
                                    className={`flex items-center gap-2 text-sm underline ${isSupplier ? 'text-emerald-600' : 'text-white'}`}>
                                    <Icon name="Paperclip" size={14} />
                                    {msg.attachment_name || 'مرفق'}
                                  </a>
                                ) : null}
                                {msg.message && (
                                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                                )}
                                <div className={`flex items-center gap-1 mt-1 ${isSupplier ? 'justify-start' : 'justify-end'}`}>
                                  <span className={`text-xs ${isSupplier ? 'text-gray-400' : 'text-emerald-100'}`}>
                                    {formatMsgTime(msg.created_at)}
                                  </span>
                                  {!isSupplier && (
                                    <Icon name={msg.is_read_by_participant ? 'CheckCheck' : 'Check'} size={12}
                                      className={msg.is_read_by_participant ? 'text-emerald-200' : 'text-emerald-300'} />
                                  )}
                                </div>
                              </div>
                            </div>
                          </React.Fragment>
                        );
                      })}
                      <div ref={messagesEndRef} />
                    </>
                  )}
                </div>

                {/* Attachment Preview */}
                {attachment && (
                  <div className="px-4 py-2 bg-white border-t border-gray-100 flex items-center gap-3">
                    {attachment.previewUrl ? (
                      <img src={attachment.previewUrl} alt="معاينة" className="w-12 h-12 object-cover rounded-lg" />
                    ) : (
                      <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                        <Icon name="Paperclip" size={18} className="text-gray-500" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700 truncate">{attachment.name}</p>
                      <p className="text-xs text-gray-400">{uploadingFile ? 'جارٍ الرفع...' : 'جاهز للإرسال'}</p>
                    </div>
                    <button onClick={() => setAttachment(null)} className="text-gray-400 hover:text-red-500">
                      <Icon name="X" size={16} />
                    </button>
                  </div>
                )}

                {/* Input Area */}
                <div className="px-4 py-3 bg-white border-t border-gray-100 shrink-0">
                  {error && <p className="text-red-500 text-xs mb-2">{error}</p>}
                  <div className="flex items-end gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,application/pdf,.doc,.docx"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2 text-gray-400 hover:text-emerald-600 transition-colors shrink-0"
                      title="إرفاق ملف"
                    >
                      <Icon name="Paperclip" size={18} />
                    </button>
                    <textarea
                      ref={textareaRef}
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="اكتب رسالتك للإدارة..."
                      rows={1}
                      dir="rtl"
                      className="flex-1 resize-none border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 max-h-32"
                      style={{ minHeight: 40 }}
                    />
                    <button
                      onClick={handleSend}
                      disabled={sending || uploadingFile || (!input.trim() && !attachment)}
                      className="p-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-colors shrink-0"
                    >
                      <Icon name="Send" size={16} />
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-1.5 text-center">Enter للإرسال • Shift+Enter لسطر جديد</p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
