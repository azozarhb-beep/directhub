'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { isImageAttachment } from '@/components/ChatImageAttachment';
import { SignedChatImage, SignedChatLink } from '@/components/SignedChatMedia';

interface SupportConversation {
  id: string;
  participant_id: string;
  participant_role: string;
  participant_name: string | null;
  participant_company: string | null;
  subject: string | null;
  last_message: string | null;
  last_message_at: string | null;
  unread_by_admin: number | null;
  created_at: string;
}

interface SupportMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_role: string;
  message: string;
  msg_type?: string | null;
  attachment_url?: string | null;
  attachment_name?: string | null;
  attachment_type?: string | null;
  created_at: string;
}

const SUPPORT_ROLE_LABELS: Record<string, string> = {
  manufacturer: 'مصنع',
  supplier: 'مورد',
  logistics_partner: 'شريك لوجستي',
  agent: 'مندوب',
  buyer: 'مشتري',
};

interface ChatConversation {
  id: string;
  buyer_id?: string;
  seller_id?: string;
  product_id?: string;
  buyer_name?: string;
  seller_name?: string;
  buyer_company?: string;
  seller_company?: string;
  product_name?: string;
  last_message?: string;
  last_message_at?: string;
  message_count?: number;
  created_at: string;
  status?: string;
  has_deal?: boolean;
}

interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_name?: string;
  message: string;
  created_at: string;
  msg_type?: string;
  attachment_url?: string;
}

export default function BuyerSellerChatMonitorPanel() {
  const { t, dir, language, isRTL } = useLanguage();
  const ui = t.admin.buyerSellerChat;

  const supabase = createClient();
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedConv, setSelectedConv] = useState<ChatConversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'deal' | 'inactive'>('all');
  const [isLive, setIsLive] = useState(false);
  const [newMessageCount, setNewMessageCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── Admin support chat (admin_conversations / admin_messages) ───────────────
  const [source, setSource] = useState<'buyer_seller' | 'support'>('support');
  const [supportConvs, setSupportConvs] = useState<SupportConversation[]>([]);
  const [supportLoading, setSupportLoading] = useState(true);
  const [selectedSupport, setSelectedSupport] = useState<SupportConversation | null>(null);
  const [supportMessages, setSupportMessages] = useState<SupportMessage[]>([]);
  const [supportMsgsLoading, setSupportMsgsLoading] = useState(false);
  const selectedSupportRef = useRef<string | null>(null);
  const supportEndRef = useRef<HTMLDivElement>(null);

  const fetchSupportConvs = useCallback(async () => {
    const { data } = await supabase
      .from('admin_conversations')
      .select('id, participant_id, participant_role, participant_name, participant_company, subject, last_message, last_message_at, unread_by_admin, created_at')
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .limit(200);
    setSupportConvs((data || []) as SupportConversation[]);
    setSupportLoading(false);
  }, [supabase]);

  const fetchSupportMessages = useCallback(async (convId: string) => {
    setSupportMsgsLoading(true);
    const { data } = await supabase
      .from('admin_messages')
      .select('id, conversation_id, sender_id, sender_role, message, msg_type, attachment_url, attachment_name, attachment_type, created_at')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true })
      .limit(500);
    setSupportMessages((data || []) as SupportMessage[]);
    setSupportMsgsLoading(false);
  }, [supabase]);

  useEffect(() => { fetchSupportConvs(); }, [fetchSupportConvs]);

  useEffect(() => {
    const channel = supabase
      .channel('admin-support-monitor')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_conversations' }, () => {
        fetchSupportConvs();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'admin_messages' }, (payload: any) => {
        const m = payload.new as SupportMessage;
        if (selectedSupportRef.current && m.conversation_id === selectedSupportRef.current) {
          setSupportMessages(prev => (prev.some(x => x.id === m.id) ? prev : [...prev, m]));
        }
        fetchSupportConvs();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase, fetchSupportConvs]);

  useEffect(() => {
    supportEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [supportMessages]);

  const handleSelectSupport = (c: SupportConversation) => {
    setSelectedSupport(c);
    selectedSupportRef.current = c.id;
    fetchSupportMessages(c.id);
  };

  const closeSupport = () => {
    setSelectedSupport(null);
    selectedSupportRef.current = null;
  };

  const fetchConversations = useCallback(async () => {
    setLoading(true);
    try {
      // Try to fetch from chat_conversations with buyer/seller profiles
      const { data, error } = await supabase
        .from('chat_conversations')
        .select(`
          *,
          buyer:user_profiles!chat_conversations_buyer_id_fkey(full_name, company_name, email),
          seller:user_profiles!chat_conversations_seller_id_fkey(full_name, company_name, email),
          product:products(name, name_ar)
        `)
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .limit(200);

      if (error) {
        // Fallback: try without joins
        const { data: fallback } = await supabase
          .from('chat_conversations')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(200);

        if (fallback) {
          setConversations(fallback.map((c: any) => ({
            ...c,
            buyer_name: c.buyer_name || 'مشتري',
            seller_name: c.seller_name || 'مورد',
          })));
        } else {
          setConversations([]);
        }
      } else {
        setConversations((data || []).map((c: any) => ({
          ...c,
          buyer_name: c.buyer?.full_name || 'مشتري',
          buyer_company: c.buyer?.company_name || '',
          seller_name: c.seller?.full_name || 'مورد',
          seller_company: c.seller?.company_name || '',
          product_name: c.product?.name_ar || c.product?.name || '',
        })));
      }
    } catch {
      setConversations([]);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  const fetchMessages = useCallback(async (convId: string) => {
    setLoadingMessages(true);
    try {
      const { data } = await supabase
        .from('chat_messages')
        .select(`
          id,
          conversation_id,
          sender_id,
          sender_role,
          message,
          is_read,
          created_at,
          attachment_url,
          attachment_type,
          attachment_name,
          msg_type,
          sender:user_profiles!chat_messages_sender_id_fkey(full_name, company_name)
        `)
        .eq('conversation_id', convId)
        .order('created_at', { ascending: true })
        .limit(200);

      setMessages((data || []).map((m: any) => ({
        ...m,
        sender_name: m.sender?.full_name || m.sender?.company_name || 'مستخدم',
      })));
    } catch {
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  }, [supabase]);

  // ── Initial load ─────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // ── Supabase Realtime — live chat monitoring ──────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel('admin-chat-monitor')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_conversations' },
        () => {
          fetchConversations();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'chat_conversations' },
        (payload: any) => {
          // Update the specific conversation in state without full refetch
          setConversations(prev =>
            prev.map(c => (c.id === payload.new.id ? { ...c, ...payload.new } : c))
          );
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        (payload: any) => {
          const newMsg = payload.new as any;
          // If we're watching this conversation, append the message live
          setSelectedConv(prev => {
            if (prev && prev.id === newMsg.conversation_id) {
              setMessages(msgs => {
                // Avoid duplicates
                if (msgs.some(m => m.id === newMsg.id)) return msgs;
                setNewMessageCount(n => n + 1);
                return [...msgs, {
                  ...newMsg,
                  sender_name: 'مستخدم',
                }];
              });
            }
            return prev;
          });
          // Refresh conversation list to update last_message / message_count
          fetchConversations();
        }
      )
      .subscribe((status) => {
        setIsLive(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
      setIsLive(false);
    };
  }, [supabase, fetchConversations]);

  // ── Auto-scroll messages ──────────────────────────────────────────────────────
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSelectConv = (conv: ChatConversation) => {
    setSelectedConv(conv);
    setNewMessageCount(0);
    fetchMessages(conv.id);
  };

  const filtered = conversations.filter(conv => {
    const matchesSearch = !searchQuery ||
      (conv.buyer_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (conv.seller_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (conv.buyer_company || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (conv.seller_company || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (conv.product_name || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      filterStatus === 'all' ||
      (filterStatus === 'deal' && conv.has_deal) ||
      (filterStatus === 'active' && !conv.has_deal && conv.message_count && conv.message_count > 0) ||
      (filterStatus === 'inactive' && (!conv.message_count || conv.message_count === 0));
    return matchesSearch && matchesStatus;
  });

  const totalMessages = conversations.reduce((sum, c) => sum + (c.message_count || 0), 0);
  const dealsCount = conversations.filter(c => c.has_deal).length;

  return (
    <div className="space-y-5" dir={dir}>
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 rounded-2xl p-5 text-white">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
            <Icon name="ChatBubbleLeftRightIcon" size={28} className="text-white" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold">{ui.title}</h2>
              {/* Live indicator */}
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                isLive ? 'bg-emerald-500/30 text-emerald-200 border border-emerald-400/40' : 'bg-white/10 text-white/60 border border-white/20'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-emerald-400 animate-pulse' : 'bg-white/40'}`} />
                {isLive ? (language === 'ar' ? 'مباشر' : 'Live') : (language === 'ar' ? 'جارٍ الاتصال...' : 'Connecting...')}
              </span>
            </div>
            <p className="text-sm text-white/80">{ui.subtitle}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-2xl font-bold">{conversations.length}</p>
            <p className="text-xs text-white/70">{ui.totalMessages.replace('{count}', String(totalMessages))}</p>
          </div>
        </div>
      </div>

      {/* Source toggle */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setSource('support')}
          className={`text-sm px-4 py-2 rounded-xl border font-semibold transition-colors ${source === 'support' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}
        >
          مراسلات الإدارة والدعم ({supportConvs.length})
        </button>
        <button
          onClick={() => setSource('buyer_seller')}
          className={`text-sm px-4 py-2 rounded-xl border font-semibold transition-colors ${source === 'buyer_seller' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}
        >
          محادثات المشترين والموردين ({conversations.length})
        </button>
      </div>

      {source === 'support' && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/30">
            <div className="flex items-center gap-2">
              <Icon name="QueueListIcon" size={16} className="text-indigo-600" />
              <h3 className="font-semibold text-foreground text-sm">مراسلة الإدارة العامة / الدعم التشغيلي</h3>
              <span className="text-xs text-muted-foreground">({supportConvs.length})</span>
            </div>
            <button onClick={fetchSupportConvs} className="text-xs text-indigo-700 flex items-center gap-1">
              <Icon name="ArrowPathIcon" size={13} />
              تحديث
            </button>
          </div>
          {supportLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : supportConvs.length === 0 ? (
            <div className="text-center py-16 text-sm text-muted-foreground">لا توجد مراسلات دعم بعد</div>
          ) : (
            <div className="divide-y divide-border">
              {supportConvs.map(c => (
                <div
                  key={c.id}
                  className="flex items-start gap-3 px-5 py-4 hover:bg-muted/20 transition-colors cursor-pointer"
                  onClick={() => handleSelectSupport(c)}
                >
                  <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                    <Icon name="ChatBubbleLeftRightIcon" size={18} className="text-indigo-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="text-sm font-bold text-foreground">{c.participant_name || 'مستخدم'}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200 font-semibold">
                        {SUPPORT_ROLE_LABELS[c.participant_role] || c.participant_role}
                      </span>
                      {(c.unread_by_admin || 0) > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500 text-white font-bold">{c.unread_by_admin}</span>
                      )}
                    </div>
                    {c.participant_company && <p className="text-xs text-muted-foreground truncate">{c.participant_company}</p>}
                    {c.last_message && <p className="text-xs text-muted-foreground truncate mt-0.5">{c.last_message}</p>}
                  </div>
                  <p className="text-xs text-muted-foreground shrink-0">
                    {(c.last_message_at || c.created_at) ? new Date(c.last_message_at || c.created_at).toISOString().slice(0, 10) : '—'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {selectedSupport && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={closeSupport}>
          <div
            className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col"
            onClick={e => e.stopPropagation()}
            dir={dir}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <p className="font-bold text-sm text-foreground">{selectedSupport.participant_name || 'مستخدم'}</p>
                <p className="text-xs text-muted-foreground">
                  {SUPPORT_ROLE_LABELS[selectedSupport.participant_role] || selectedSupport.participant_role}
                  {selectedSupport.participant_company ? ` · ${selectedSupport.participant_company}` : ''}
                </p>
              </div>
              <button onClick={closeSupport} className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center">
                <Icon name="XMarkIcon" size={16} className="text-muted-foreground" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {supportMsgsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : supportMessages.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">لا توجد رسائل في هذه المحادثة</p>
              ) : (
                supportMessages.map(m => {
                  const fromAdmin = m.sender_role === 'admin';
                  const isImg = !!m.attachment_url && (
                    m.msg_type === 'image' || (m.attachment_type ||'').startsWith('image/') ||
                    isImageAttachment(m.attachment_url, m.attachment_name || undefined)
                  );
                  return (
                    <div key={m.id} className={`flex ${fromAdmin ? 'justify-end' : 'justify-start'}`}>
                      <div className="max-w-[80%] flex flex-col gap-0.5">
                        <span className="text-[10px] text-muted-foreground px-1">
                          {fromAdmin ? 'الإدارة' : (selectedSupport.participant_name || 'الشريك')} · {m.created_at ? new Date(m.created_at).toISOString().slice(11, 16) : ''}
                        </span>
                        <div className={`px-3 py-2 rounded-xl text-sm ${fromAdmin ? 'bg-[#D4AF37] text-[#0A192F] rounded-tr-sm' : 'bg-muted text-foreground rounded-tl-sm border border-border'}`}>
                          {m.attachment_url && (
                            <div className="mb-2">
                              {isImg ? (
                                <SignedChatLink href={m.attachment_url} className="block">
                                  <SignedChatImage
                                    src={m.attachment_url}
                                    alt={m.attachment_name || 'صورة مرفقة'}
                                    className="max-w-full rounded-xl max-h-48 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                  />
                                </SignedChatLink>
                              ) : (
                                <SignedChatLink
                                  href={m.attachment_url}
                                  className="flex items-center gap-2 text-xs underline"
                                >
                                  <Icon name="PaperClipIcon" size={14} />
                                  {m.attachment_name || 'مرفق'}
                                </SignedChatLink>
                              )}
                            </div>
                          )}
                          {(!m.attachment_url || (m.message && m.message !== m.attachment_name)) && m.message}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={supportEndRef} />
            </div>
            <div className="px-5 py-3 border-t border-border bg-muted/30">
              <p className="text-xs text-center text-muted-foreground">🔒 وضع المراقبة — للرد افتح تبويب «مراسلة الإدارة»</p>
            </div>
          </div>
        </div>
      )}

      {source === 'buyer_seller' && (<>
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: ui.totalConversations, value: conversations.length, color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
          { label: ui.totalMsgs, value: totalMessages, color: 'text-blue-600 bg-blue-50 border-blue-200' },
          { label: ui.completedDeals, value: dealsCount, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
          { label: ui.activeChats, value: conversations.filter(c => c.message_count && c.message_count > 0).length, color: 'text-orange-600 bg-orange-50 border-orange-200' },
        ].map(stat => (
          <div key={stat.label} className={`rounded-xl border p-4 ${stat.color}`}>
            <p className="text-2xl font-bold">{stat.value}</p>
            <p className="text-xs font-medium mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Icon name="MagnifyingGlassIcon" size={16} className="absolute top-1/2 -translate-y-1/2 right-3 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={ui.searchPlaceholder}
            className="w-full pr-9 pl-4 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:border-primary"
          />
        </div>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value as any)}
          className="h-10 px-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:border-primary"
        >
          <option value="all">{ui.allChats}</option>
          <option value="active">{ui.active}</option>
          <option value="deal">{ui.completedDeals}</option>
          <option value="inactive">{ui.inactive}</option>
        </select>
        <button
          onClick={fetchConversations}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-xl text-sm font-semibold hover:bg-indigo-100 transition-colors"
        >
          <Icon name="ArrowPathIcon" size={15} />
          تحديث
        </button>
      </div>

      {/* Conversations List */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2">
            <Icon name="QueueListIcon" size={16} className="text-indigo-600" />
            <h3 className="font-semibold text-foreground text-sm">{ui.threads}</h3>
            <span className="text-xs text-muted-foreground">({filtered.length})</span>
          </div>
          {isLive && (
            <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {language === 'ar' ? 'تحديث فوري مفعّل' : 'Real-time active'}
            </span>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center">
              <Icon name="ChatBubbleLeftRightIcon" size={32} className="text-indigo-300" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-foreground">{ui.noConversations}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {conversations.length === 0
                  ? 'ستظهر محادثات المشترين والموردين هنا تلقائياً' : 'لا توجد نتائج تطابق بحثك'}
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map(conv => (
              <div
                key={conv.id}
                className="flex items-start gap-3 px-5 py-4 hover:bg-muted/20 transition-colors cursor-pointer"
                onClick={() => handleSelectConv(conv)}
              >
                {/* Icon */}
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                  <Icon name="ChatBubbleLeftRightIcon" size={18} className="text-indigo-500" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                      👤 {conv.buyer_name || 'مشتري'}
                    </span>
                    <Icon name="ArrowsRightLeftIcon" size={12} className="text-muted-foreground" />
                    <span className="text-xs font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                      🏭 {conv.seller_name || 'مورد'}
                    </span>
                    {conv.has_deal && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200 font-semibold">
                        ✅ صفقة
                      </span>
                    )}
                  </div>
                  {conv.product_name && (
                    <p className="text-xs text-muted-foreground truncate">📦 {conv.product_name}</p>
                  )}
                  {conv.last_message && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{conv.last_message}</p>
                  )}
                </div>

                {/* Meta */}
                <div className="text-right shrink-0">
                  <p className="text-xs text-muted-foreground">
                    {(conv.last_message_at || conv.created_at)
                      ? new Date(conv.last_message_at || conv.created_at).toLocaleDateString('ar-SA')
                      : '—'}
                  </p>
                  {(conv.message_count || 0) > 0 && (
                    <span className="text-[10px] px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-200 font-semibold">
                      {conv.message_count} رسالة
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Message Thread Modal */}
      {selectedConv && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setSelectedConv(null)}>
          <div
            className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col"
            onClick={e => e.stopPropagation()}
            dir={dir}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                    👤 {selectedConv.buyer_name}
                  </span>
                  <Icon name="ArrowsRightLeftIcon" size={12} className="text-muted-foreground" />
                  <span className="text-xs font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                    🏭 {selectedConv.seller_name}
                  </span>
                  {/* Live badge in modal */}
                  {isLive && (
                    <span className="text-[10px] px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200 font-semibold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      مباشر
                    </span>
                  )}
                </div>
                {selectedConv.product_name && (
                  <p className="text-xs text-muted-foreground mt-1">📦 {selectedConv.product_name}</p>
                )}
              </div>
              <button onClick={() => setSelectedConv(null)} className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center">
                <Icon name="XMarkIcon" size={16} className="text-muted-foreground" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loadingMessages ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-8">
                  <Icon name="ChatBubbleLeftRightIcon" size={32} className="text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">{ui.noMessagesInChat}</p>
                </div>
              ) : (
                messages.map((msg, idx) => {
                  const isBuyer = msg.sender_id === selectedConv.buyer_id;
                  return (
                    <div key={idx} className={`flex gap-2 ${isBuyer ? 'justify-end' : 'justify-start'}`}>
                      {!isBuyer && (
                        <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center shrink-0 mt-0.5">
                          <span className="text-xs">🏭</span>
                        </div>
                      )}
                      <div className={`max-w-[80%] ${isBuyer ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
                        <span className="text-[10px] text-muted-foreground px-1">
                          {msg.sender_name} · {msg.created_at ? new Date(msg.created_at).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                        <div className={`px-3 py-2 rounded-xl text-sm ${
                          isBuyer
                            ? 'bg-blue-500 text-white rounded-tr-none' : 'bg-muted text-foreground rounded-tl-none'
                        }`}>
                          {msg.message}
                          {msg.attachment_url && isImageAttachment(msg.attachment_url) ? (
                            <SignedChatLink href={msg.attachment_url} className="block mt-1">
                              <SignedChatImage src={msg.attachment_url} alt="صورة مرفقة" className="max-w-full rounded-lg max-h-48 object-cover" />
                            </SignedChatLink>
                          ) : msg.attachment_url ? (
                            <SignedChatLink href={msg.attachment_url} className="block mt-1 text-xs underline opacity-80">
                              📎 مرفق
                            </SignedChatLink>
                          ) : null}
                        </div>
                      </div>
                      {isBuyer && (
                        <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mt-0.5">
                          <span className="text-xs">👤</span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
              {/* Auto-scroll anchor */}
              <div ref={messagesEndRef} />
            </div>

            {/* Read-only notice */}
            <div className="px-5 py-3 border-t border-border bg-muted/30">
              <p className="text-xs text-center text-muted-foreground">
                🔒 وضع المراقبة فقط — لا يمكن إرسال رسائل من هنا
              </p>
            </div>
          </div>
        </div>
      )}
      </>)}
    </div>
  );
}
