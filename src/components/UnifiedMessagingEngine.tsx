'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';
import type { ChatLanguage } from '@/app/agent/dashboard/AgentLanguageSelector';
import ChatImageAttachment, { uploadChatImage, isImageAttachment, type AttachmentState } from '@/components/ChatImageAttachment';
import { SignedChatImage, SignedChatLink } from '@/components/SignedChatMedia';
import LiveTranslationChatInput from '@/components/LiveTranslationChatInput';
import { needsChatTranslation } from '@/lib/chatTranslationGate';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ContactType = 'factory' | 'supplier' | 'agent' | 'admin';

export interface UnifiedContact {
  id: string;
  name: string;
  type: ContactType;
  subtype?: string;
  country?: string;
  city?: string;
  meta?: Record<string, string>;
}

export interface UnifiedConversation {
  id: string;
  contactId: string;
  contactName: string;
  contactType: ContactType;
  /** seller_category / factory_type when known (translation gating) */
  subtype?: string;
  country?: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  isActive?: boolean;
}

export interface UnifiedMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderRole: string;
  message: string;
  msgType: string;
  priority?: string;
  attachmentUrl?: string;
  attachmentName?: string;
  isReadByMe?: boolean;
  createdAt: string;
}

export type MessagingMode =
  | 'admin_factory'   // Admin ↔ Factory direct messaging (admin_factory_conversations / admin_factory_messages)
  | 'agent_factory'   // Agent ↔ Factory messaging (agent_conversations / agent_messages)
  | 'agent_admin';    // Agent ↔ Admin messaging (agent_admin_messages)

export interface UnifiedMessagingEngineProps {
  /** Current user id */
  userId: string;
  /** Which messaging mode to operate in */
  mode: MessagingMode;
  /** Available contacts to start new conversations with */
  contacts?: UnifiedContact[];
  /** Title shown in the header */
  title?: string;
  /** Subtitle shown in the header */
  subtitle?: string;
  /** Whether to show the category filter bar */
  showFilters?: boolean;
  /** Fixed height (default 640px) */
  height?: number;
  /**
   * Active chat language — controls textarea direction, placeholder text,
   * and quick-reply options. Passed from the parent language selector.
   */
  chatLanguage?: ChatLanguage;
  /**
   * Deep-link: id of a contact whose thread should be opened automatically.
   * If no thread exists yet, a new one is created (agent_factory mode).
   */
  openContactId?: string;
  /** Fallback display name used when creating a thread for openContactId */
  openContactName?: string;
}

// ─── Category filter config ───────────────────────────────────────────────────

const CATEGORY_FILTERS: { key: ContactType | 'all'; label: string; icon: string }[] = [
  { key: 'all', label: 'الكل', icon: 'Squares2X2Icon' },
  { key: 'factory', label: 'المصانع', icon: 'BuildingOffice2Icon' },
  { key: 'supplier', label: 'الموردون', icon: 'TruckIcon' },
  { key: 'agent', label: 'المندوبون', icon: 'UserGroupIcon' },
  { key: 'admin', label: 'الإدارة', icon: 'ShieldCheckIcon' },
];

const MSG_TYPE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  text: { label: 'رسالة', color: 'text-slate-300', bg: 'bg-[#0A192F]/40 border-[#D4AF37]/15' },
  order: { label: 'أمر', color: 'text-red-400', bg: 'bg-red-900/20 border-red-500/20' },
  instruction: { label: 'توجيه', color: 'text-blue-400', bg: 'bg-blue-900/20 border-blue-500/20' },
  note: { label: 'ملاحظة', color: 'text-blue-400', bg: 'bg-blue-900/20 border-blue-500/20' },
  update: { label: 'تحديث', color: 'text-emerald-400', bg: 'bg-emerald-900/20 border-emerald-500/20' },
  document: { label: 'مستند', color: 'text-purple-400', bg: 'bg-purple-900/20 border-purple-500/20' },
  alert: { label: 'تنبيه', color: 'text-red-400', bg: 'bg-red-900/20 border-red-500/20' },
  requirement: { label: 'متطلب', color: 'text-amber-400', bg: 'bg-amber-900/20 border-amber-500/20' },
};

const PRIORITY_CONFIG: Record<string, { label: string; dot: string }> = {
  normal: { label: 'عادي', dot: 'bg-gray-400' },
  high: { label: 'مهم', dot: 'bg-amber-500' },
  urgent: { label: 'عاجل', dot: 'bg-red-500' },
};

function formatMsgTime(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function formatMsgDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function UnifiedMessagingEngine({
  userId,
  mode,
  contacts = [],
  title = 'صندوق الرسائل الموحد',
  subtitle = 'جميع المحادثات في مكان واحد',
  showFilters = true,
  height = 640,
  chatLanguage,
  openContactId,
  openContactName,
}: UnifiedMessagingEngineProps) {
  const supabase = createClient();

  // Derive active language config — fall back to Arabic defaults when no prop
  const activeLang: ChatLanguage = chatLanguage ?? {
    code: 'ar',
    label: 'Arabic',
    nativeLabel: 'العربية',
    dir: 'rtl',
    flag: '🇸🇦',
    script: 'Arabic',
    placeholder: 'اكتب رسالتك هنا...',
    quickReplies: [
      'تم الاستلام، شكراً',
      'سيتم المتابعة قريباً',
      'يرجى إرسال المزيد من التفاصيل',
      'تم الاعتماد بنجاح',
      'نحتاج مراجعة إضافية',
    ],
  };

  // ── State ──────────────────────────────────────────────────────────────────
  const [conversations, setConversations] = useState<UnifiedConversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<UnifiedMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [msgsLoading, setMsgsLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState('');
  const [msgType, setMsgType] = useState('text');
  const [priority, setPriority] = useState('normal');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<ContactType | 'all'>('all');
  const [showNewConv, setShowNewConv] = useState(false);
  const [newConvContactId, setNewConvContactId] = useState('');
  const [creatingConv, setCreatingConv] = useState(false);
  const [error, setError] = useState('');
  const [showMobileSidebar, setShowMobileSidebar] = useState(true);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [attachment, setAttachment] = useState<AttachmentState | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    const el = messagesEndRef.current;
    const container = el?.parentElement;
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    }
  };

  // ── Data fetching helpers ──────────────────────────────────────────────────

  const mapAdminFactoryConvs = (data: any[]): UnifiedConversation[] =>
    data.map(c => ({
      id: c.id,
      contactId: c.factory_id,
      contactName: c.factory_name || 'مصنع',
      contactType: 'factory' as ContactType,
      lastMessage: c.last_message || '',
      lastMessageAt: c.last_message_at || c.created_at || '',
      unreadCount: c.unread_by_admin || 0,
    }));

  const mapAgentFactoryConvs = (data: any[]): UnifiedConversation[] =>
    data.map(c => ({
      id: c.id,
      contactId: c.factory_reg_id,
      contactName: c.factory_name || 'مصنع',
      contactType: (c.factory_type === 'local_supplier' ? 'supplier' : 'factory') as ContactType,
      subtype: c.factory_type || undefined,
      lastMessage: c.last_message || '',
      lastMessageAt: c.last_message_at || c.created_at || '',
      unreadCount: c.unread_by_agent || 0,
    }));

  const mapAgentAdminMessages = (data: any[]): UnifiedConversation[] => {
    if (!data || data.length === 0) return [];
    return [{
      id: `agent-admin-${userId}`,
      contactId: 'admin',
      contactName: 'الإدارة',
      contactType: 'admin' as ContactType,
      lastMessage: data[data.length - 1]?.message || '',
      lastMessageAt: data[data.length - 1]?.created_at || '',
      unreadCount: data.filter((m: any) => m.sender_role === 'admin' && !m.is_read_by_agent).length,
    }];
  };

  const mapAdminFactoryMessages = (data: any[]): UnifiedMessage[] =>
    data.map(m => ({
      id: m.id,
      conversationId: m.conversation_id,
      senderId: m.sender_id,
      senderRole: m.sender_role,
      message: m.message,
      msgType: m.msg_type || 'text',
      priority: m.priority || 'normal',
      attachmentUrl: m.attachment_url,
      attachmentName: m.attachment_name,
      isReadByMe: m.sender_role === 'admin' ? true : m.is_read_by_admin,
      createdAt: m.created_at,
    }));

  const mapAgentFactoryMessages = (data: any[]): UnifiedMessage[] =>
    data.map(m => ({
      id: m.id,
      conversationId: m.conversation_id,
      senderId: m.agent_id,
      senderRole: m.sender_role,
      message: m.message,
      msgType: m.msg_type || 'text',
      attachmentUrl: m.attachment_url,
      attachmentName: m.attachment_name,
      isReadByMe: m.is_read,
      createdAt: m.created_at,
    }));

  const mapAgentAdminMsgs = (data: any[]): UnifiedMessage[] =>
    data.map(m => ({
      id: m.id,
      conversationId: `agent-admin-${userId}`,
      senderId: m.agent_id,
      senderRole: m.sender_role,
      message: m.message,
      msgType: m.msg_type || 'text',
      attachmentUrl: m.attachment_url,
      attachmentName: m.attachment_name,
      isReadByMe: m.sender_role === 'agent' ? true : m.is_read_by_agent,
      createdAt: m.created_at,
    }));

  // ── Fetch conversations ────────────────────────────────────────────────────

  const fetchConversations = useCallback(async () => {
    setLoading(true);
    try {
      if (mode === 'admin_factory') {
        const { data } = await supabase
          .from('admin_factory_conversations')
          .select('*')
          .order('last_message_at', { ascending: false });
        setConversations(mapAdminFactoryConvs(data || []));
      } else if (mode === 'agent_factory') {
        const { data } = await supabase
          .from('agent_conversations')
          .select('*')
          .eq('agent_id', userId)
          .order('last_message_at', { ascending: false });
        setConversations(mapAgentFactoryConvs(data || []));
      } else if (mode === 'agent_admin') {
        const { data } = await supabase
          .from('agent_admin_messages')
          .select('*')
          .eq('agent_id', userId)
          .order('created_at', { ascending: true });
        setConversations(mapAgentAdminMessages(data || []));
      }
    } catch (err) {
      console.error('fetchConversations error:', err);
    } finally {
      setLoading(false);
    }
  }, [userId, mode, supabase]);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  // ── Deep-link: open (or create) thread for a specific contact ──────────────
  const deepLinkHandledRef = useRef<string | null>(null);
  useEffect(() => {
    if (!openContactId || loading) return;
    if (mode !== 'agent_factory') return;
    if (deepLinkHandledRef.current === openContactId) return;
    deepLinkHandledRef.current = openContactId;

    const existing = conversations.find(c => c.contactId === openContactId);
    if (existing) {
      setActiveConvId(existing.id);
      setShowMobileSidebar(false);
      return;
    }

    const contact = contacts.find(c => c.id === openContactId);
    const factoryName = contact?.name || openContactName || 'مصنع';
    (async () => {
      try {
        const { data, error: err } = await supabase
          .from('agent_conversations')
          .insert({
            agent_id: userId,
            factory_reg_id: openContactId,
            factory_name: factoryName,
            factory_type: contact?.subtype || 'local_factory',
            last_message: '',
            last_message_at: new Date().toISOString(),
            unread_by_agent: 0,
            is_active: true,
          })
          .select()
          .single();
        if (!err && data) {
          const conv = mapAgentFactoryConvs([data])[0];
          setConversations(prev => [conv, ...prev]);
          setActiveConvId(conv.id);
          setShowMobileSidebar(false);
        } else if (err) {
          setError(err.message);
        }
      } catch (e) {
        console.error('Deep-link create conv error:', e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openContactId, loading, conversations, mode, userId]);

  // ── Fetch messages ─────────────────────────────────────────────────────────

  const fetchMessages = useCallback(async (convId: string) => {
    setMsgsLoading(true);
    try {
      if (mode === 'admin_factory') {
        const { data } = await supabase
          .from('admin_factory_messages')
          .select('*')
          .eq('conversation_id', convId)
          .order('created_at', { ascending: true });
        setMessages(mapAdminFactoryMessages(data || []));
        await supabase
          .from('admin_factory_conversations')
          .update({ unread_by_admin: 0 })
          .eq('id', convId);
        setConversations(prev => prev.map(c => c.id === convId ? { ...c, unreadCount: 0 } : c));
      } else if (mode === 'agent_factory') {
        const { data } = await supabase
          .from('agent_messages')
          .select('*')
          .eq('conversation_id', convId)
          .order('created_at', { ascending: true });
        setMessages(mapAgentFactoryMessages(data || []));
        await supabase
          .from('agent_conversations')
          .update({ unread_by_agent: 0 })
          .eq('id', convId)
          .eq('agent_id', userId);
        setConversations(prev => prev.map(c => c.id === convId ? { ...c, unreadCount: 0 } : c));
      } else if (mode === 'agent_admin') {
        const { data } = await supabase
          .from('agent_admin_messages')
          .select('*')
          .eq('agent_id', userId)
          .order('created_at', { ascending: true });
        setMessages(mapAgentAdminMsgs(data || []));
        await supabase
          .from('agent_admin_messages')
          .update({ is_read_by_agent: true })
          .eq('agent_id', userId)
          .eq('sender_role', 'admin')
          .eq('is_read_by_agent', false);
        setConversations(prev => prev.map(c => c.id === convId ? { ...c, unreadCount: 0 } : c));
      }
    } catch (err) {
      console.error('fetchMessages error:', err);
    } finally {
      setMsgsLoading(false);
    }
  }, [userId, mode, supabase]);

  useEffect(() => {
    if (activeConvId) fetchMessages(activeConvId);
  }, [activeConvId, fetchMessages]);

  useEffect(() => { scrollToBottom(); }, [messages]);

  // ── Realtime subscriptions ─────────────────────────────────────────────────

  useEffect(() => {
    if (mode === 'admin_factory' && activeConvId) {
      const ch = supabase
        .channel(`unified-admin-factory-${activeConvId}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'admin_factory_messages',
          filter: `conversation_id=eq.${activeConvId}`,
        }, (payload: any) => {
          const msg = mapAdminFactoryMessages([payload.new])[0];
          setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
        })
        .subscribe();
      return () => { supabase.removeChannel(ch); };
    }
    if (mode === 'agent_factory' && activeConvId) {
      const ch = supabase
        .channel(`unified-agent-factory-${activeConvId}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'agent_messages',
          filter: `conversation_id=eq.${activeConvId}`,
        }, (payload: any) => {
          const msg = mapAgentFactoryMessages([payload.new])[0];
          setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
        })
        .subscribe();
      return () => { supabase.removeChannel(ch); };
    }
    if (mode === 'agent_admin') {
      const ch = supabase
        .channel(`unified-agent-admin-${userId}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'agent_admin_messages',
          filter: `agent_id=eq.${userId}`,
        }, (payload: any) => {
          const msg = mapAgentAdminMsgs([payload.new])[0];
          setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
        })
        .subscribe();
      return () => { supabase.removeChannel(ch); };
    }
  }, [mode, activeConvId, userId, supabase]);

  // ── Send message ───────────────────────────────────────────────────────────

  const handleSend = async (textOverride?: string) => {
    const text = (textOverride ?? input).trim();
    if ((!text && !attachment) || sending || !activeConvId) return;
    setSending(true);

    const optimisticId = `opt-${Date.now()}`;
    const optimistic: UnifiedMessage = {
      id: optimisticId,
      conversationId: activeConvId,
      senderId: userId,
      senderRole: mode === 'agent_admin' ? 'agent' : mode === 'admin_factory' ? 'admin' : 'agent',
      message: text || (attachment ? `📎 ${attachment.name}` : ''),
      msgType,
      priority,
      createdAt: new Date().toISOString(),
      isReadByMe: true,
      attachmentUrl: attachment?.previewUrl,
      attachmentName: attachment?.name,
    };
    setMessages(prev => [...prev, optimistic]);
    setInput('');

    // Capture attachment before clearing state
    const currentAttachment = attachment;
    setAttachment(null);

    try {
      let attachmentUrl: string | undefined;
      let attachmentName: string | undefined;

      if (currentAttachment) {
        const result = await uploadChatImage(currentAttachment.file, userId, 'unified-chat');
        if (result) {
          attachmentUrl = result.publicUrl;
          attachmentName = result.fileName;
          // Update optimistic message with the real public URL
          setMessages(prev => prev.map(m =>
            m.id === optimisticId ? { ...m, attachmentUrl, attachmentName } : m
          ));
        } else {
          setError('فشل رفع المرفق، يرجى المحاولة مرة أخرى');
          setMessages(prev => prev.filter(m => m.id !== optimisticId));
          setSending(false);
          if (currentAttachment.previewUrl) {
            URL.revokeObjectURL(currentAttachment.previewUrl);
          }
          return;
        }
        // Revoke the local object URL to free memory
        if (currentAttachment.previewUrl) {
          URL.revokeObjectURL(currentAttachment.previewUrl);
        }
      }

      if (mode === 'admin_factory') {
        const { data: inserted, error: err } = await supabase
          .from('admin_factory_messages')
          .insert({
            conversation_id: activeConvId,
            sender_id: userId,
            sender_role: 'admin',
            message: text || (attachmentName ? `📎 ${attachmentName}` : ''),
            msg_type: msgType,
            priority,
            attachment_url: attachmentUrl,
            attachment_name: attachmentName,
            is_read_by_factory: false,
            is_read_by_admin: true,
          })
          .select()
          .single();
        if (!err && inserted) {
          setMessages(prev => prev.map(m => m.id === optimisticId ? mapAdminFactoryMessages([inserted])[0] : m));
          setConversations(prev => prev.map(c =>
            c.id === activeConvId ? { ...c, lastMessage: inserted.message, lastMessageAt: inserted.created_at } : c
          ));
        } else {
          setMessages(prev => prev.filter(m => m.id !== optimisticId));
          if (err) setError(err.message);
        }
      } else if (mode === 'agent_factory') {
        const { error: err } = await supabase.from('agent_messages').insert({
          conversation_id: activeConvId,
          agent_id: userId,
          sender_role: 'agent',
          message: text || (attachmentName ? `📎 ${attachmentName}` : ''),
          msg_type: msgType,
          attachment_url: attachmentUrl,
          attachment_name: attachmentName,
          attachment_type: currentAttachment?.file.type || null,
          is_read: false,
        });
        if (err) {
          setMessages(prev => prev.filter(m => m.id !== optimisticId));
          setError(err.message);
        } else {
          await fetchMessages(activeConvId);
          await fetchConversations();
        }
      } else if (mode === 'agent_admin') {
        const { error: err } = await supabase.from('agent_admin_messages').insert({
          agent_id: userId,
          sender_role: 'agent',
          message: text || (attachmentName ? `📎 ${attachmentName}` : ''),
          msg_type: msgType,
          attachment_url: attachmentUrl,
          attachment_name: attachmentName,
          is_read_by_agent: true,
          is_read_by_admin: false,
        });
        if (err) {
          setMessages(prev => prev.filter(m => m.id !== optimisticId));
          setError(err.message);
        }
      }
    } catch (err) {
      console.error('Send error:', err);
      setMessages(prev => prev.filter(m => m.id !== optimisticId));
    } finally {
      setSending(false);
    }
  };

  const handleQuickReplyClick = (reply: string) => {
    setInput(prev => prev ? `${prev} ${reply}` : reply);
    void handleSend();
  };

  // ── Create new conversation ────────────────────────────────────────────────

  const handleCreateConversation = async () => {
    if (!newConvContactId) return;
    const contact = contacts.find(c => c.id === newConvContactId);
    if (!contact) return;
    setCreatingConv(true);
    try {
      if (mode === 'admin_factory') {
        const existing = conversations.find(c => c.contactId === newConvContactId);
        if (existing) {
          setActiveConvId(existing.id);
          setShowMobileSidebar(false);
          setShowNewConv(false);
          return;
        }
        const { data, error: err } = await supabase
          .from('admin_factory_conversations')
          .insert({ admin_id: userId, factory_id: contact.id, factory_name: contact.name })
          .select()
          .single();
        if (!err && data) {
          const conv = mapAdminFactoryConvs([data])[0];
          setConversations(prev => [conv, ...prev]);
          setActiveConvId(conv.id);
          setShowMobileSidebar(false);
        }
      } else if (mode === 'agent_factory') {
        const existing = conversations.find(c => c.contactId === newConvContactId);
        if (existing) {
          setActiveConvId(existing.id);
          setShowMobileSidebar(false);
          setShowNewConv(false);
          return;
        }
        const { data, error: err } = await supabase
          .from('agent_conversations')
          .insert({
            agent_id: userId,
            factory_reg_id: contact.id,
            factory_name: contact.name,
            factory_type: contact.subtype || 'local_factory',
            last_message: '',
            last_message_at: new Date().toISOString(),
            unread_by_agent: 0,
            is_active: true,
          })
          .select()
          .single();
        if (!err && data) {
          const conv = mapAgentFactoryConvs([data])[0];
          setConversations(prev => [conv, ...prev]);
          setActiveConvId(conv.id);
          setShowMobileSidebar(false);
        }
      }
    } catch (err) {
      console.error('Create conv error:', err);
    } finally {
      setCreatingConv(false);
      setShowNewConv(false);
      setNewConvContactId('');
    }
  };

  // ── Derived state ──────────────────────────────────────────────────────────

  const activeConv = conversations.find(c => c.id === activeConvId) || null;
  const activeContact = activeConv
    ? contacts.find(c => c.id === activeConv.contactId)
    : undefined;
  const needsTranslation = needsChatTranslation({
    sellerCategory: activeContact?.subtype || activeConv?.subtype,
    factoryType: activeContact?.subtype || activeConv?.subtype,
    country: activeContact?.country || activeConv?.country,
  });

  const filteredConversations = conversations.filter(c => {
    const matchesSearch = !search || c.contactName.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || c.contactType === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

  const isMyMessage = (msg: UnifiedMessage) => {
    if (mode === 'admin_factory') return msg.senderRole === 'admin';
    if (mode === 'agent_factory') return msg.senderRole === 'agent';
    if (mode === 'agent_admin') return msg.senderRole === 'agent';
    return false;
  };

  const getContactIcon = (type: ContactType) => {
    switch (type) {
      case 'factory': return 'BuildingOffice2Icon';
      case 'supplier': return 'TruckIcon';
      case 'agent': return 'UserGroupIcon';
      case 'admin': return 'ShieldCheckIcon';
      default: return 'ChatBubbleLeftRightIcon';
    }
  };

  const getContactColor = (type: ContactType) => {
    switch (type) {
      case 'factory': return 'from-slate-600 to-slate-800';
      case 'supplier': return 'from-blue-700 to-blue-900';
      case 'agent': return 'from-teal-700 to-teal-900';
      case 'admin': return 'from-[#D4AF37]/60 to-[#0A192F]';
      default: return 'from-slate-600 to-slate-800';
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const sidebarVisible = showMobileSidebar || !activeConvId;
  const chatVisible = !showMobileSidebar || !!activeConvId;

  return (
    <div
      className="bg-[#1E1E1E] border border-[#D4AF37]/20 rounded-2xl overflow-hidden flex flex-col"
      style={{ height }}
      dir="rtl"
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#D4AF37]/15 bg-[#0A192F]/50 shrink-0">
        <div className="flex items-center gap-3">
          {activeConvId && (
            <button
              onClick={() => { setShowMobileSidebar(true); setActiveConvId(null); }}
              className="md:hidden w-8 h-8 rounded-lg bg-[#D4AF37]/10 flex items-center justify-center"
            >
              <Icon name="ChevronRightIcon" size={16} className="text-[#D4AF37]" />
            </button>
          )}
          <div className="w-9 h-9 bg-[#D4AF37]/15 rounded-xl flex items-center justify-center">
            <Icon name="InboxStackIcon" size={18} className="text-[#D4AF37]" />
          </div>
          <div>
            <h3 className="font-bold text-white text-sm">{title}</h3>
            <p className="text-xs text-gray-400">{subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {totalUnread > 0 && (
            <span className="min-w-[22px] h-[22px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1.5">
              {totalUnread}
            </span>
          )}
          {mode !== 'agent_admin' && (
            <button
              onClick={() => setShowNewConv(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#D4AF37] text-[#0A192F] rounded-lg text-xs font-bold hover:bg-[#D4AF37]/90 transition-colors"
            >
              <Icon name="PlusIcon" size={13} />
              <span className="hidden sm:inline">محادثة جديدة</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Category Filters ── */}
      {showFilters && (
        <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-[#D4AF37]/10 bg-[#0A192F]/20 overflow-x-auto shrink-0">
          {CATEGORY_FILTERS.filter(f => {
            if (mode === 'admin_factory') return f.key === 'all' || f.key === 'factory';
            if (mode === 'agent_factory') return f.key === 'all' || f.key === 'factory' || f.key === 'supplier';
            if (mode === 'agent_admin') return f.key === 'all' || f.key === 'admin';
            return true;
          }).map(f => (
            <button
              key={f.key}
              onClick={() => setCategoryFilter(f.key as ContactType | 'all')}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                categoryFilter === f.key
                  ? 'bg-[#D4AF37] text-[#0A192F]'
                  : 'bg-[#0A192F]/40 text-gray-400 hover:text-[#D4AF37] hover:bg-[#D4AF37]/10 border border-[#D4AF37]/15'
              }`}
            >
              <Icon name={f.icon as any} size={12} />
              {f.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Error Banner ── */}
      {error && (
        <div className="mx-4 mt-2 px-3 py-2 bg-red-900/30 border border-red-500/30 text-red-400 rounded-lg text-xs flex items-center gap-2 shrink-0">
          <Icon name="ExclamationCircleIcon" size={14} />
          {error}
          <button onClick={() => setError('')} className="mr-auto">
            <Icon name="XMarkIcon" size={12} />
          </button>
        </div>
      )}

      {/* ── Main Split View ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Sidebar ── */}
        <div
          className={`${
            sidebarVisible ? 'flex' : 'hidden'
          } md:flex w-full md:w-72 lg:w-80 shrink-0 border-l border-[#D4AF37]/15 flex-col overflow-hidden`}
        >
          {/* Search */}
          <div className="px-3 py-2.5 border-b border-[#D4AF37]/10 shrink-0">
            <div className="relative">
              <Icon name="MagnifyingGlassIcon" size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="بحث في المحادثات..."
                className="w-full h-9 pr-9 pl-3 rounded-lg bg-[#0A192F]/50 border border-[#D4AF37]/15 text-white text-xs placeholder:text-gray-500 focus:outline-none focus:border-[#D4AF37]/40"
              />
            </div>
          </div>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                <div className="w-12 h-12 rounded-2xl bg-[#D4AF37]/10 flex items-center justify-center mb-3">
                  <Icon name="ChatBubbleOvalLeftEllipsisIcon" size={22} className="text-[#D4AF37]/50" />
                </div>
                <p className="text-xs font-semibold text-white mb-1">لا توجد محادثات</p>
                <p className="text-[11px] text-gray-500 mb-3">
                  {mode === 'agent_admin' ? 'ابدأ محادثة مع الإدارة' : 'ابحث عن جهة اتصال لبدء محادثة'}
                </p>
                {mode === 'agent_admin' && (
                  <button
                    onClick={() => {
                      const adminConvId = `agent-admin-${userId}`;
                      setConversations([{
                        id: adminConvId,
                        contactId: 'admin',
                        contactName: 'الإدارة',
                        contactType: 'admin',
                        lastMessage: '',
                        lastMessageAt: '',
                        unreadCount: 0,
                      }]);
                      setActiveConvId(adminConvId);
                      setShowMobileSidebar(false);
                    }}
                    className="text-xs font-bold text-[#D4AF37] hover:underline"
                  >
                    + محادثة جديدة مع الإدارة
                  </button>
                )}
                {mode !== 'agent_admin' && (
                  <button
                    onClick={() => setShowNewConv(true)}
                    className="text-xs font-bold text-[#D4AF37] hover:underline"
                  >
                    + محادثة جديدة
                  </button>
                )}
              </div>
            ) : (
              filteredConversations.map(conv => (
                <button
                  key={conv.id}
                  onClick={() => {
                    setActiveConvId(conv.id);
                    setShowMobileSidebar(false);
                  }}
                  className={`w-full text-right px-3 py-3 border-b border-[#D4AF37]/10 transition-colors ${
                    activeConvId === conv.id
                      ? 'bg-[#D4AF37]/10 border-r-2 border-r-[#D4AF37]'
                      : 'hover:bg-[#0A192F]/40'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${getContactColor(conv.contactType)} flex items-center justify-center shrink-0`}>
                      <Icon name={getContactIcon(conv.contactType) as any} size={15} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <p className="text-xs font-bold text-white truncate">{conv.contactName}</p>
                        {conv.unreadCount > 0 && (
                          <span className="min-w-[18px] h-[18px] bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1 shrink-0">
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>
                      {conv.lastMessage && (
                        <p className="text-[11px] text-gray-500 truncate">{conv.lastMessage}</p>
                      )}
                      {conv.lastMessageAt && (
                        <p className="text-[10px] text-gray-600 mt-0.5">{formatMsgDate(conv.lastMessageAt)}</p>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* New Conversation Button (bottom) */}
          {mode !== 'agent_admin' && (
            <div className="p-3 border-t border-[#D4AF37]/10 shrink-0">
              <button
                onClick={() => setShowNewConv(true)}
                className="w-full flex items-center justify-center gap-2 h-9 bg-[#D4AF37] text-[#0A192F] text-xs font-bold rounded-xl hover:bg-[#D4AF37]/90 transition-colors"
              >
                <Icon name="PlusIcon" size={14} />
                محادثة جديدة
              </button>
            </div>
          )}
        </div>

        {/* ── Chat Area ── */}
        <div
          className={`${
            chatVisible ? 'flex' : 'hidden'
          } md:flex flex-1 flex-col overflow-hidden`}
        >
          {!activeConvId ? (
            /* Empty state */
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <div className="w-20 h-20 rounded-3xl bg-[#D4AF37]/10 flex items-center justify-center mb-4">
                <Icon name="ChatBubbleLeftRightIcon" size={36} className="text-[#D4AF37]/50" />
              </div>
              <p className="text-base font-bold text-white mb-2">اختر محادثة للبدء</p>
              <p className="text-sm text-gray-500 max-w-xs">
                ابحث عن جهة اتصال في الشريط الجانبي أو ابدأ محادثة جديدة
              </p>
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <div className="px-4 py-3 border-b border-[#D4AF37]/15 bg-[#0A192F]/30 shrink-0">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => { setShowMobileSidebar(true); setActiveConvId(null); }}
                    className="md:hidden w-8 h-8 rounded-lg bg-[#D4AF37]/10 flex items-center justify-center shrink-0"
                  >
                    <Icon name="ChevronRightIcon" size={15} className="text-[#D4AF37]" />
                  </button>
                  {activeConv && (
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${getContactColor(activeConv.contactType)} flex items-center justify-center shrink-0`}>
                      <Icon name={getContactIcon(activeConv.contactType) as any} size={18} className="text-white" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white">{activeConv?.contactName || '—'}</p>
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <p className="text-[10px] text-gray-400">قناة مراسلة رسمية</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                {msgsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-6 h-6 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center py-10">
                    <div className="w-14 h-14 rounded-2xl bg-[#D4AF37]/10 flex items-center justify-center mb-3">
                      <Icon name="ChatBubbleBottomCenterTextIcon" size={24} className="text-[#D4AF37]/50" />
                    </div>
                    <p className="text-sm font-semibold text-white mb-1">ابدأ المحادثة</p>
                    <p className="text-xs text-gray-500">أرسل أول رسالة لبدء التواصل</p>
                  </div>
                ) : (
                  messages.map(msg => {
                    const isMine = isMyMessage(msg);
                    const isSystem = msg.senderRole === 'system';
                    const typeConf = MSG_TYPE_CONFIG[msg.msgType] || MSG_TYPE_CONFIG.text;
                    const prioConf = PRIORITY_CONFIG[msg.priority || 'normal'] || PRIORITY_CONFIG.normal;

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
                      <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] flex flex-col gap-1 ${isMine ? 'items-end' : 'items-start'}`}>
                          {/* Badges */}
                          <div className={`flex items-center gap-1.5 ${isMine ? 'flex-row-reverse' : ''}`}>
                            {msg.msgType !== 'text' && (
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${typeConf.bg} ${typeConf.color}`}>
                                {typeConf.label}
                              </span>
                            )}
                            {msg.priority && msg.priority !== 'normal' && (
                              <span className={`flex items-center gap-1 text-[9px] font-bold text-gray-400`}>
                                <div className={`w-1.5 h-1.5 rounded-full ${prioConf.dot}`} />
                                {prioConf.label}
                              </span>
                            )}
                            <span className="text-[9px] text-gray-600">{formatMsgTime(msg.createdAt)}</span>
                          </div>
                          {/* Bubble */}
                          <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                            isMine
                              ? 'bg-[#D4AF37] text-[#0A192F] rounded-br-sm font-medium'
                              : 'bg-[#0A192F]/60 text-white rounded-bl-sm border border-[#D4AF37]/15'
                          }`}>
                            {msg.attachmentUrl && (
                              isImageAttachment(msg.attachmentUrl, msg.attachmentName) ? (
                                <div className="mb-1.5">
                                  <SignedChatImage
                                    src={msg.attachmentUrl}
                                    alt={msg.attachmentName || 'صورة مرفقة'}
                                    className="max-w-[220px] max-h-[200px] rounded-xl object-cover cursor-pointer"
                                    onClickOpen
                                  />
                                </div>
                              ) : (
                                <SignedChatLink
                                  href={msg.attachmentUrl}
                                  className={`flex items-center gap-1.5 text-xs underline mb-1.5 ${isMine ? 'text-[#0A192F]/80' : 'text-[#D4AF37]'}`}
                                >
                                  <Icon name="PaperClipIcon" size={12} />
                                  {msg.attachmentName || 'مرفق'}
                                </SignedChatLink>
                              )
                            )}
                            <p className="whitespace-pre-wrap text-xs">{msg.message}</p>
                          </div>
                          {/* Read status */}
                          {isMine && mode === 'admin_factory' && (
                            <span className={`text-[9px] ${msg.isReadByMe === false ? 'text-gray-600' : 'text-emerald-500'}`}>
                              {msg.isReadByMe === false ? '✓ مُرسَل' : '✓✓ تمت القراءة'}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="px-4 py-3 border-t border-[#D4AF37]/15 bg-[#0A192F]/20 shrink-0">
                {/* Quick Replies Panel */}
                {showQuickReplies && activeLang.quickReplies.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {activeLang.quickReplies.map((reply, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleQuickReplyClick(reply)}
                        disabled={sending || !activeConvId}
                        className="px-2.5 py-1 bg-[#D4AF37]/10 border border-[#D4AF37]/25 rounded-lg text-[11px] text-[#D4AF37] hover:bg-[#D4AF37]/20 transition-colors disabled:opacity-50"
                        dir={activeLang.dir}
                      >
                        {reply}
                      </button>
                    ))}
                  </div>
                )}
                {/* Type + Priority selectors */}
                <div className="flex items-center gap-2 mb-2 overflow-x-auto pb-1">
                  <div className="flex items-center gap-1 bg-[#0A192F]/50 rounded-lg p-0.5 shrink-0">
                    {(mode === 'admin_factory'
                      ? ['text', 'order', 'instruction']
                      : ['text', 'note', 'update', 'document']
                    ).map(type => (
                      <button
                        key={type}
                        onClick={() => setMsgType(type)}
                        className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-colors ${
                          msgType === type
                            ? 'bg-[#D4AF37] text-[#0A192F]'
                            : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        {MSG_TYPE_CONFIG[type]?.label || type}
                      </button>
                    ))}
                  </div>
                  {mode === 'admin_factory' && (
                    <div className="flex items-center gap-1 bg-[#0A192F]/50 rounded-lg p-0.5 shrink-0">
                      {(['normal', 'high', 'urgent'] as const).map(p => (
                        <button
                          key={p}
                          onClick={() => setPriority(p)}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold transition-colors ${
                            priority === p
                              ? 'bg-[#D4AF37] text-[#0A192F]'
                              : 'text-gray-400 hover:text-white'
                          }`}
                        >
                          <div className={`w-1.5 h-1.5 rounded-full ${PRIORITY_CONFIG[p].dot}`} />
                          {PRIORITY_CONFIG[p].label}
                        </button>
                      ))}
                    </div>
                  )}
                  {/* Quick Replies toggle */}
                  <button
                    onClick={() => setShowQuickReplies(v => !v)}
                    title="ردود سريعة"
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors shrink-0 ${
                      showQuickReplies
                        ? 'bg-[#D4AF37] text-[#0A192F]'
                        : 'bg-[#0A192F]/50 border border-[#D4AF37]/15 text-gray-400 hover:text-[#D4AF37]'
                    }`}
                  >
                    <Icon name="BoltIcon" size={11} />
                    <span className="hidden sm:inline">{activeLang.dir === 'rtl' ? 'ردود سريعة' : 'Quick'}</span>
                  </button>
                  {/* Unified image attachment component */}
                  <div className="mr-auto shrink-0">
                    <ChatImageAttachment
                      attachment={attachment}
                      onAttach={setAttachment}
                      onRemove={() => setAttachment(null)}
                      disabled={sending}
                      label="صورة"
                    />
                  </div>
                </div>

                {/* Text + Send — LiveTranslationChatInput gates chrome via translationEnabled */}
                <div className="flex items-end gap-2">
                  <div className="flex-1 min-w-0">
                    <LiveTranslationChatInput
                      key={activeConvId || 'no-conv'}
                      translationEnabled={needsTranslation}
                      showLanguageSelector={needsTranslation}
                      showPreview={needsTranslation}
                      disabled={sending}
                      placeholder={activeLang.placeholder}
                      defaultTargetLang={
                        activeLang.code === 'zh' || activeLang.code === 'tr' || activeLang.code === 'en' || activeLang.code === 'ar'
                          ? activeLang.code
                          : 'ar'
                      }
                      onSend={(original, translated) => {
                        const outbound =
                          needsTranslation && translated?.trim() && translated.trim() !== original.trim()
                            ? translated.trim()
                            : original.trim();
                        void handleSend(outbound);
                      }}
                    />
                  </div>
                  {attachment && (
                    <button
                      onClick={() => void handleSend()}
                      disabled={sending}
                      className="h-10 w-10 bg-[#D4AF37] text-[#0A192F] rounded-xl flex items-center justify-center hover:bg-[#D4AF37]/90 transition-colors disabled:opacity-40 shrink-0"
                      title="Send attachment"
                    >
                      {sending
                        ? <div className="w-4 h-4 border-2 border-[#0A192F] border-t-transparent rounded-full animate-spin" />
                        : <Icon name="PaperAirplaneIcon" size={16} />
                      }
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── New Conversation Modal ── */}
      {showNewConv && (
        <div
          className="fixed inset-0 z-[9999] bg-black/70 flex items-center justify-center p-4"
          onClick={() => setShowNewConv(false)}
        >
          <div
            className="bg-[#1E1E1E] border border-[#D4AF37]/25 rounded-2xl shadow-2xl w-full max-w-sm p-5"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-white">بدء محادثة جديدة</h3>
              <button
                onClick={() => setShowNewConv(false)}
                className="w-7 h-7 rounded-lg hover:bg-[#D4AF37]/10 flex items-center justify-center"
              >
                <Icon name="XMarkIcon" size={15} className="text-gray-400" />
              </button>
            </div>
            <label className="block text-xs font-semibold text-gray-400 mb-2">اختر جهة الاتصال</label>
            <select
              value={newConvContactId}
              onChange={e => setNewConvContactId(e.target.value)}
              className="w-full px-3 py-2.5 bg-[#0A192F]/60 border border-[#D4AF37]/20 rounded-xl text-sm text-white focus:outline-none focus:border-[#D4AF37]/50 mb-4"
            >
              <option value="">— اختر —</option>
              {contacts.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}{c.country ? ` — ${c.country}` : ''}
                </option>
              ))}
            </select>
            {contacts.length === 0 && (
              <p className="text-xs text-gray-500 mb-4">لا توجد جهات اتصال متاحة حالياً</p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setShowNewConv(false)}
                className="flex-1 px-4 py-2.5 border border-[#D4AF37]/20 rounded-xl text-sm font-semibold text-gray-400 hover:bg-[#D4AF37]/10 transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={handleCreateConversation}
                disabled={!newConvContactId || creatingConv}
                className="flex-1 px-4 py-2.5 bg-[#D4AF37] text-[#0A192F] rounded-xl text-sm font-bold disabled:opacity-50 hover:bg-[#D4AF37]/90 transition-colors flex items-center justify-center gap-2"
              >
                {creatingConv
                  ? <div className="w-4 h-4 border-2 border-[#0A192F] border-t-transparent rounded-full animate-spin" />
                  : <Icon name="ChatBubbleLeftRightIcon" size={14} />
                }
                بدء المحادثة
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
