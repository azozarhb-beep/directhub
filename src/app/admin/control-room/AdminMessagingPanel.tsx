'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';
import { uploadChatImage, isImageAttachment } from '@/components/ChatImageAttachment';

// ─── Types ────────────────────────────────────────────────────────────────────

type RoleTabKey = 'all' | 'international_factory' | 'local_factory' | 'agent' | 'logistics_partner' | 'supplier';

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

interface PlatformUser {
  id: string;
  full_name: string;
  company_name: string;
  email: string;
  role: string;
  phone?: string;
  seller_category?: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Role Tab Config ──────────────────────────────────────────────────────────

const ROLE_TABS: { key: RoleTabKey; label: string; icon: string; color: string }[] = [
  { key: 'all',                  label: 'الكل',              icon: 'Squares2X2Icon',       color: 'text-amber-500' },
  { key: 'international_factory', label: 'المصانع الدولية',   icon: 'GlobeAltIcon',         color: 'text-blue-500' },
  { key: 'local_factory',         label: 'المصانع المحلية',   icon: 'BuildingOffice2Icon',  color: 'text-orange-500' },
  { key: 'agent',                 label: 'المندوبون',         icon: 'UserGroupIcon',        color: 'text-purple-500' },
  { key: 'logistics_partner',     label: 'اللوجستيات',        icon: 'TruckIcon',            color: 'text-teal-500' },
  { key: 'supplier',              label: 'الموردون',          icon: 'ShoppingBagIcon',      color: 'text-green-500' },
];

// Maps a conversation to its effective tab key
function getConvTabKey(conv: AdminConversation): RoleTabKey {
  if (conv.participant_role === 'manufacturer') {
    if (conv.participant_category === 'international_factory') return 'international_factory';
    if (conv.participant_category === 'local_factory') return 'local_factory';
    // Default unclassified manufacturers to local_factory
    return 'local_factory';
  }
  if (conv.participant_role === 'supplier') return 'supplier';
  if (conv.participant_role === 'logistics_partner') return 'logistics_partner';
  if (conv.participant_role === 'agent') return 'agent';
  return 'local_factory';
}

// Maps a tab key to DB query filters
function getTabDbFilter(tab: RoleTabKey): { role: string | null; category: string | null } {
  switch (tab) {
    case 'international_factory': return { role: 'manufacturer', category: 'international_factory' };
    case 'local_factory':         return { role: 'manufacturer', category: 'local_factory' };
    case 'agent':                 return { role: 'agent', category: null };
    case 'logistics_partner':     return { role: 'logistics_partner', category: null };
    case 'supplier':              return { role: 'supplier', category: null };
    default:                      return { role: null, category: null };
  }
}

// Maps a tab key to user_profiles roles for the "New Conversation" user list
function getTabUserRoles(tab: RoleTabKey): string[] {
  switch (tab) {
    case 'international_factory': return ['manufacturer'];
    case 'local_factory':         return ['manufacturer'];
    case 'agent':                 return ['agent'];
    case 'logistics_partner':     return ['logistics_partner'];
    case 'supplier':              return ['supplier'];
    default:                      return ['manufacturer', 'supplier', 'logistics_partner', 'agent'];
  }
}

const ROLE_LABELS: Record<string, string> = {
  manufacturer:      'مصنع',
  supplier:          'مورد',
  logistics_partner: 'شريك لوجستي',
  agent:             'مندوب',
  admin:             'إدارة',
};

const CATEGORY_LABELS: Record<string, string> = {
  international_factory: 'مصنع دولي',
  local_factory:         'مصنع محلي',
  local_supplier:        'مورد محلي',
};

const ROLE_COLORS: Record<string, string> = {
  manufacturer:      'bg-orange-100 text-orange-700 border-orange-200',
  supplier:          'bg-green-100 text-green-700 border-green-200',
  logistics_partner: 'bg-teal-100 text-teal-700 border-teal-200',
  agent:             'bg-purple-100 text-purple-700 border-purple-200',
  admin:             'bg-red-100 text-red-700 border-red-200',
  international_factory: 'bg-blue-100 text-blue-700 border-blue-200',
  local_factory:         'bg-orange-100 text-orange-700 border-orange-200',
};

// ─── Main Component ───────────────────────────────────────────────────────────

interface AdminMessagingPanelProps {
  userId: string;
}

export default function AdminMessagingPanel({ userId }: AdminMessagingPanelProps) {
  const supabase = createClient();

  // ── State ──────────────────────────────────────────────────────────────────
  const [conversations, setConversations] = useState<AdminConversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AdminMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [msgsLoading, setMsgsLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<RoleTabKey>('all');
  const [showNewConv, setShowNewConv] = useState(false);
  const [platformUsers, setPlatformUsers] = useState<PlatformUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<PlatformUser | null>(null);
  const [newSubject, setNewSubject] = useState('');
  const [creatingConv, setCreatingConv] = useState(false);
  const [error, setError] = useState('');
  const [attachment, setAttachment] = useState<{ file: File; name: string; previewUrl?: string } | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(true);
  const [visionAnalysis, setVisionAnalysis] = useState<string | null>(null);
  const [analyzingVision, setAnalyzingVision] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // ── Fetch conversations ────────────────────────────────────────────────────

  const fetchConversations = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error: err } = await supabase
        .from('admin_conversations')
        .select('*')
        .order('last_message_at', { ascending: false, nullsFirst: false });

      if (!err && data) {
        setConversations(data as AdminConversation[]);
      } else {
        setConversations([]);
      }
    } catch {
      setConversations([]);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

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
      await supabase
        .from('admin_messages')
        .update({ is_read_by_admin: true })
        .eq('conversation_id', convId)
        .eq('sender_role', 'participant');
      await supabase
        .from('admin_conversations')
        .update({ unread_by_admin: 0 })
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
      .channel(`admin-msgs-${activeConvId}`)
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

  // ── Fetch platform users for new conversation ──────────────────────────────

  const fetchPlatformUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const roles = getTabUserRoles(activeTab);
      let query = supabase
        .from('user_profiles')
        .select('id, full_name, company_name, email, role, phone, seller_category')
        .neq('role', 'admin')
        .neq('role', 'buyer')
        .order('full_name', { ascending: true });

      // When a specific tab is active (not 'all'), filter by role
      if (activeTab !== 'all') {
        query = query.in('role', roles);
      }

      const { data } = await query;
      let users = (data || []) as PlatformUser[];

      // For factory tabs, further filter by seller_category
      if (activeTab === 'international_factory') {
        users = users.filter(u => u.seller_category === 'international_factory');
      } else if (activeTab === 'local_factory') {
        users = users.filter(u =>
          u.seller_category === 'local_factory' ||
          (u.role === 'manufacturer' && !u.seller_category)
        );
      }

      setPlatformUsers(users);
    } catch {
      setPlatformUsers([]);
    } finally {
      setUsersLoading(false);
    }
  }, [supabase, activeTab]);

  useEffect(() => {
    if (showNewConv) fetchPlatformUsers();
  }, [showNewConv, fetchPlatformUsers]);

  // ── Create new conversation ────────────────────────────────────────────────

  const handleCreateConversation = async () => {
    if (!selectedUser) return;
    setCreatingConv(true);
    setError('');
    try {
      const { data: existing } = await supabase
        .from('admin_conversations')
        .select('id')
        .eq('admin_id', userId)
        .eq('participant_id', selectedUser.id)
        .limit(1);

      if (existing && existing.length > 0) {
        setActiveConvId(existing[0].id);
        setShowNewConv(false);
        setSelectedUser(null);
        setNewSubject('');
        setShowMobileSidebar(false);
        return;
      }

      // Determine participant_role and participant_category
      const participantRole = (
        selectedUser.role === 'manufacturer' ? 'manufacturer' :
        selectedUser.role === 'supplier' ? 'supplier' :
        selectedUser.role === 'logistics_partner' ? 'logistics_partner' : 'agent'
      );

      // Determine category: use seller_category from user profile, or infer from active tab
      let participantCategory: string | null = selectedUser.seller_category || null;
      if (!participantCategory && selectedUser.role === 'manufacturer') {
        if (activeTab === 'international_factory') participantCategory = 'international_factory';
        else participantCategory = 'local_factory';
      }

      const { data: conv, error: convErr } = await supabase
        .from('admin_conversations')
        .insert({
          admin_id: userId,
          participant_id: selectedUser.id,
          participant_role: participantRole,
          participant_category: participantCategory,
          participant_name: selectedUser.full_name || selectedUser.email,
          participant_company: selectedUser.company_name || '',
          subject: newSubject || `محادثة مع ${selectedUser.full_name || selectedUser.email}`,
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
      setSelectedUser(null);
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
          sender_role: 'admin',
          message: text || (attachmentName || 'مرفق'),
          msg_type: msgType,
          attachment_url: attachmentUrl,
          attachment_name: attachmentName,
          attachment_type: attachmentType,
          is_read_by_admin: true,
          is_read_by_participant: false,
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
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const analyzeImageWithVision = async (file: File) => {
    setAnalyzingVision(true);
    setVisionAnalysis(null);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = () => reject(new Error('read failed'));
        reader.readAsDataURL(file);
      });
      const res = await fetch('/api/ai/vision-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType: file.type }),
      });
      const data = await res.json();
      setVisionAnalysis(res.ok ? data.analysis : data.error || 'تعذّر تحليل الصورة. يرجى المحاولة مرة أخرى.');
    } catch {
      setVisionAnalysis('خطأ في الاتصال بنموذج الذكاء الاصطناعي.');
    } finally {
      setAnalyzingVision(false);
    }
  };

  // ── Derived data ───────────────────────────────────────────────────────────

  const filteredConversations = conversations.filter(c => {
    // Tab filter: match by effective tab key
    const convTabKey = getConvTabKey(c);
    const matchesTab = activeTab === 'all' || convTabKey === activeTab;

    // Search filter
    const q = search.toLowerCase();
    const matchesSearch = !q ||
      (c.participant_name || '').toLowerCase().includes(q) ||
      (c.participant_company || '').toLowerCase().includes(q) ||
      (c.subject || '').toLowerCase().includes(q) ||
      (c.last_message || '').toLowerCase().includes(q);

    return matchesTab && matchesSearch;
  });

  const activeConv = conversations.find(c => c.id === activeConvId);

  // Count per tab
  const tabCounts: Record<RoleTabKey, number> = {
    all: conversations.length,
    international_factory: conversations.filter(c => getConvTabKey(c) === 'international_factory').length,
    local_factory: conversations.filter(c => getConvTabKey(c) === 'local_factory').length,
    agent: conversations.filter(c => getConvTabKey(c) === 'agent').length,
    logistics_partner: conversations.filter(c => getConvTabKey(c) === 'logistics_partner').length,
    supplier: conversations.filter(c => getConvTabKey(c) === 'supplier').length,
  };

  const filteredUsers = platformUsers.filter(u => {
    const q = userSearch.toLowerCase();
    return !q ||
      (u.full_name || '').toLowerCase().includes(q) ||
      (u.company_name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q);
  });

  const totalUnread = conversations.reduce((sum, c) => sum + (c.unread_by_admin || 0), 0);

  // Get display label for a conversation's category
  function getConvDisplayRole(conv: AdminConversation): string {
    if (conv.participant_role === 'manufacturer') {
      if (conv.participant_category === 'international_factory') return 'مصنع دولي';
      if (conv.participant_category === 'local_factory') return 'مصنع محلي';
      return 'مصنع';
    }
    return ROLE_LABELS[conv.participant_role] || conv.participant_role;
  }

  function getConvColorKey(conv: AdminConversation): string {
    if (conv.participant_role === 'manufacturer') {
      return conv.participant_category === 'international_factory' ? 'international_factory' : 'local_factory';
    }
    return conv.participant_role;
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#0A192F] to-[#1a2f4a] rounded-2xl p-5 border border-[#D4AF37]/20">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#D4AF37]/20 flex items-center justify-center shrink-0">
            <Icon name="ChatBubbleLeftRightIcon" size={24} className="text-[#D4AF37]" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-white">نظام المراسلة المتكاملة</h2>
            <p className="text-sm text-white/70">تواصل مباشر مع جميع أدوار المنصة — مصانع دولية، مصانع محلية، مندوبون، لوجستيات، موردون</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {totalUnread > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 border border-red-500/30 rounded-xl">
                <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                <span className="text-sm font-bold text-red-300">{totalUnread} غير مقروء</span>
              </div>
            )}
            <button
              onClick={() => { setShowNewConv(true); setShowMobileSidebar(true); }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-colors"
              style={{ backgroundColor: '#D4AF37', color: '#0A192F' }}
            >
              <Icon name="PlusIcon" size={16} />
              محادثة جديدة
            </button>
          </div>
        </div>
      </div>

      {/* Role Tab Bar — 5 independent tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        {ROLE_TABS.map(tab => {
          const count = tabCounts[tab.key];
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key);
                // Clear active conversation when switching tabs so the list refreshes cleanly
                setActiveConvId(null);
                setMessages([]);
                setShowMobileSidebar(true);
              }}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
                isActive
                  ? 'bg-[#D4AF37] text-[#0A192F] border-[#D4AF37]'
                  : 'bg-card text-muted-foreground border-border hover:border-[#D4AF37]/50'
              }`}
            >
              <Icon name={tab.icon as any} size={14} className={isActive ? 'text-[#0A192F]' : tab.color} />
              {tab.label}
              {count > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  isActive ? 'bg-[#0A192F]/20 text-[#0A192F]' : 'bg-muted text-muted-foreground'
                }`}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Main Chat Layout */}
      <div className="flex gap-4 rounded-2xl overflow-hidden border border-border bg-card" style={{ height: '620px' }}>

        {/* ── Sidebar: Conversations List ── */}
        <div className={`w-80 shrink-0 flex flex-col border-r border-border bg-muted/20 ${!showMobileSidebar && activeConvId ? 'hidden md:flex' : 'flex'}`}>
          {/* Search */}
          <div className="px-3 py-3 border-b border-border">
            <div className="relative">
              <Icon name="MagnifyingGlassIcon" size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={`بحث في ${ROLE_TABS.find(t => t.key === activeTab)?.label || 'المحادثات'}...`}
                className="w-full h-9 pr-9 pl-3 rounded-xl border border-border bg-background text-foreground text-xs focus:outline-none focus:border-[#D4AF37]/50"
                dir="rtl"
              />
            </div>
          </div>

          {/* Tab label indicator */}
          {activeTab !== 'all' && (
            <div className="px-3 py-2 border-b border-border bg-[#D4AF37]/5">
              <div className="flex items-center gap-1.5">
                <Icon name={ROLE_TABS.find(t => t.key === activeTab)?.icon as any} size={12} className={ROLE_TABS.find(t => t.key === activeTab)?.color} />
                <span className="text-[10px] font-bold text-muted-foreground">
                  عرض: {ROLE_TABS.find(t => t.key === activeTab)?.label} فقط
                </span>
              </div>
            </div>
          )}

          {/* Conversations */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Icon name="ArrowPathIcon" size={20} className="animate-spin text-[#D4AF37]" />
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
                  <Icon name="ChatBubbleLeftRightIcon" size={24} className="text-muted-foreground" />
                </div>
                <p className="text-sm font-semibold text-foreground mb-1">
                  {activeTab === 'all' ? 'لا توجد محادثات' : `لا توجد محادثات مع ${ROLE_TABS.find(t => t.key === activeTab)?.label}`}
                </p>
                <p className="text-xs text-muted-foreground mb-3">ابدأ محادثة جديدة</p>
                <button
                  onClick={() => setShowNewConv(true)}
                  className="text-xs font-bold text-[#D4AF37] hover:underline"
                >
                  + محادثة جديدة
                </button>
              </div>
            ) : filteredConversations.map(conv => (
              <button
                key={conv.id}
                onClick={() => {
                  setActiveConvId(conv.id);
                  setShowMobileSidebar(false);
                }}
                className={`w-full text-right px-3 py-3 border-b border-border/50 transition-colors ${
                  activeConvId === conv.id
                    ? 'bg-[#D4AF37]/10 border-r-2 border-r-[#D4AF37]'
                    : 'hover:bg-muted/50'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold border ${ROLE_COLORS[getConvColorKey(conv)] || 'bg-muted text-muted-foreground border-border'}`}>
                    {(conv.participant_name || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <p className="text-xs font-bold text-foreground truncate">{conv.participant_name || 'مستخدم'}</p>
                      {conv.unread_by_admin > 0 && (
                        <span className="w-5 h-5 rounded-full bg-[#D4AF37] text-[#0A192F] text-[10px] font-bold flex items-center justify-center shrink-0">
                          {conv.unread_by_admin}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${ROLE_COLORS[getConvColorKey(conv)] || 'bg-muted text-muted-foreground border-border'}`}>
                        {getConvDisplayRole(conv)}
                      </span>
                      {conv.participant_company && (
                        <span className="text-[10px] text-muted-foreground truncate">{conv.participant_company}</span>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate">{conv.last_message || conv.subject || '—'}</p>
                    <p className="text-[9px] text-muted-foreground/60 mt-0.5">
                      {conv.last_message_at ? formatMsgDate(conv.last_message_at) : '—'}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ── Main Chat Area ── */}
        <div className={`flex-1 flex flex-col min-w-0 ${showMobileSidebar && !activeConvId ? 'hidden md:flex' : 'flex'}`}>
          {!activeConvId ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <div className="w-20 h-20 rounded-3xl bg-[#D4AF37]/10 border border-[#D4AF37]/20 flex items-center justify-center mx-auto mb-4">
                <Icon name="ChatBubbleLeftRightIcon" size={36} className="text-[#D4AF37]" />
              </div>
              <p className="text-base font-bold text-foreground mb-2">
                {activeTab === 'all' ?'اختر محادثة للبدء'
                  : `محادثات ${ROLE_TABS.find(t => t.key === activeTab)?.label}`}
              </p>
              <p className="text-sm text-muted-foreground max-w-xs mb-4">
                {activeTab === 'all' ?'اختر محادثة من القائمة أو ابدأ محادثة جديدة مع أي مستخدم في المنصة'
                  : `اختر محادثة من القائمة أو ابدأ محادثة جديدة مع ${ROLE_TABS.find(t => t.key === activeTab)?.label}`}
              </p>
              <button
                onClick={() => setShowNewConv(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-colors"
                style={{ backgroundColor: '#D4AF37', color: '#0A192F' }}
              >
                <Icon name="PlusIcon" size={16} />
                بدء محادثة جديدة
              </button>
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <div className="px-4 py-3 border-b border-border bg-muted/10 shrink-0">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowMobileSidebar(true)}
                    className="md:hidden w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center"
                  >
                    <Icon name="ChevronRightIcon" size={16} className="text-muted-foreground" />
                  </button>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold border ${ROLE_COLORS[getConvColorKey(activeConv!)] || 'bg-muted text-muted-foreground border-border'}`}>
                    {(activeConv?.participant_name || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-foreground">{activeConv?.participant_name || 'مستخدم'}</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${ROLE_COLORS[getConvColorKey(activeConv!)] || 'bg-muted text-muted-foreground border-border'}`}>
                        {activeConv ? getConvDisplayRole(activeConv) : ''}
                      </span>
                    </div>
                    {activeConv?.participant_company && (
                      <p className="text-xs text-muted-foreground">{activeConv.participant_company}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => fetchMessages(activeConvId)}
                      className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center"
                      title="تحديث"
                    >
                      <Icon name="ArrowPathIcon" size={15} className="text-muted-foreground" />
                    </button>
                  </div>
                </div>
                {activeConv?.subject && (
                  <p className="text-xs text-muted-foreground mt-1 pr-13">{activeConv.subject}</p>
                )}
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {msgsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Icon name="ArrowPathIcon" size={20} className="animate-spin text-[#D4AF37]" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Icon name="ChatBubbleLeftEllipsisIcon" size={32} className="text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">لا توجد رسائل بعد. ابدأ المحادثة!</p>
                  </div>
                ) : (
                  <>
                    {messages.map((msg, idx) => {
                      const isAdmin = msg.sender_role === 'admin';
                      const prevMsg = idx > 0 ? messages[idx - 1] : null;
                      const showDate = !prevMsg || formatMsgDate(prevMsg.created_at) !== formatMsgDate(msg.created_at);

                      return (
                        <React.Fragment key={msg.id}>
                          {showDate && (
                            <div className="flex items-center gap-3 my-2">
                              <div className="flex-1 h-px bg-border" />
                              <span className="text-[10px] text-muted-foreground px-2">{formatMsgDate(msg.created_at)}</span>
                              <div className="flex-1 h-px bg-border" />
                            </div>
                          )}
                          <div className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[75%] ${isAdmin ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                              <span className="text-[10px] text-muted-foreground px-1">
                                {isAdmin ? 'الإدارة' : (activeConv?.participant_name || 'المستخدم')}
                              </span>
                              <div className={`rounded-2xl px-4 py-2.5 ${
                                isAdmin
                                  ? 'bg-[#D4AF37] text-[#0A192F] rounded-tr-sm'
                                  : 'bg-muted text-foreground rounded-tl-sm border border-border'
                              }`}>
                                {msg.attachment_url && (
                                  <div className="mb-2">
                                    {isImageAttachment(msg.attachment_url, msg.attachment_name) ? (
                                      <a href={msg.attachment_url} target="_blank" rel="noopener noreferrer">
                                        <img
                                          src={msg.attachment_url}
                                          alt={msg.attachment_name || 'صورة مرفقة'}
                                          className="max-w-full rounded-xl max-h-48 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                        />
                                      </a>
                                    ) : (
                                      <a
                                        href={msg.attachment_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition-colors ${
                                          isAdmin
                                            ? 'bg-[#0A192F]/20 border-[#0A192F]/30 text-[#0A192F] hover:bg-[#0A192F]/30'
                                            : 'bg-background border-border text-foreground hover:bg-muted'
                                        }`}
                                      >
                                        <Icon name="DocumentArrowDownIcon" size={16} />
                                        <span className="truncate max-w-[160px]">{msg.attachment_name || 'تحميل المرفق'}</span>
                                      </a>
                                    )}
                                  </div>
                                )}
                                {msg.message && !(msg.msg_type !== 'text' && !msg.attachment_url && msg.message === (msg.attachment_name || 'مرفق')) && (
                                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                                )}
                              </div>
                              <span className="text-[10px] text-muted-foreground px-1">{formatMsgTime(msg.created_at)}</span>
                            </div>
                          </div>
                        </React.Fragment>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              {/* Error */}
              {error && (
                <div className="mx-4 mb-2 px-3 py-2 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                  {error}
                </div>
              )}

              {/* Attachment Preview */}
              {attachment && (
                <div className="mx-4 mb-2 flex items-center gap-2 px-3 py-2 bg-muted/50 border border-border rounded-xl">
                  {attachment.previewUrl ? (
                    <img src={attachment.previewUrl} alt={attachment.name} className="w-10 h-10 rounded-lg object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                      <Icon name="DocumentIcon" size={18} className="text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">{attachment.name}</p>
                    <p className="text-[10px] text-muted-foreground">{(attachment.file.size / 1024).toFixed(1)} KB</p>
                  </div>
                  {attachment.file.type.startsWith('image/') && (
                    <button
                      onClick={() => void analyzeImageWithVision(attachment.file)}
                      disabled={analyzingVision}
                      title="تحليل الصورة بالذكاء الاصطناعي"
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold text-[#D4AF37] border border-[#D4AF37]/30 hover:bg-[#D4AF37]/10 disabled:opacity-40 transition-colors shrink-0"
                    >
                      <span>🔍</span>
                      <span className="hidden sm:inline">تحليل</span>
                    </button>
                  )}
                  <button
                    onClick={() => {
                      if (attachment.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
                      setAttachment(null);
                      setVisionAnalysis(null);
                      setAnalyzingVision(false);
                    }}
                    className="w-6 h-6 rounded-full bg-muted hover:bg-red-100 flex items-center justify-center transition-colors"
                  >
                    <Icon name="XMarkIcon" size={12} className="text-muted-foreground hover:text-red-600" />
                  </button>
                </div>
              )}

              {/* Input Area */}
              <div className="px-4 py-3 border-t border-border bg-muted/10 shrink-0">
                {/* Vision Analysis Result */}
                {(analyzingVision || visionAnalysis) && (
                  <div className="mb-3 rounded-xl border border-[#D4AF37]/30 bg-[#D4AF37]/5 overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-[#D4AF37]/20 bg-[#D4AF37]/10">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">🔍</span>
                        <span className="text-xs font-bold text-[#D4AF37]">تحليل الذكاء الاصطناعي (Gemini Vision)</span>
                      </div>
                      {!analyzingVision && (
                        <button
                          onClick={() => setVisionAnalysis(null)}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Icon name="XMarkIcon" size={13} />
                        </button>
                      )}
                    </div>
                    <div className="px-3 py-2.5 max-h-48 overflow-y-auto">
                      {analyzingVision ? (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <div className="w-3.5 h-3.5 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin shrink-0" />
                          <span>جارٍ تحليل الصورة بالذكاء الاصطناعي...</span>
                        </div>
                      ) : (
                        <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap" dir="rtl">{visionAnalysis}</p>
                      )}
                    </div>
                    {!analyzingVision && visionAnalysis && (
                      <div className="px-3 py-2 border-t border-[#D4AF37]/20">
                        <button
                          onClick={() => setInput(prev => prev ? `${prev}\n\n${visionAnalysis}` : visionAnalysis || '')}
                          className="text-[10px] font-bold text-[#D4AF37] hover:text-[#D4AF37]/80 transition-colors flex items-center gap-1"
                        >
                          <Icon name="ArrowDownTrayIcon" size={11} />
                          <span>إدراج التحليل في الرسالة</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-end gap-2">
                  {/* File attachment button */}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={sending || uploadingFile}
                    className="w-9 h-9 rounded-xl border border-border bg-background hover:bg-muted flex items-center justify-center transition-colors shrink-0 mb-0.5"
                    title="إرفاق ملف أو صورة"
                  >
                    <Icon name="PaperClipIcon" size={16} className="text-muted-foreground" />
                  </button>
                  {/* Camera capture button (mobile) */}
                  <button
                    onClick={() => cameraInputRef.current?.click()}
                    disabled={sending || uploadingFile}
                    className="w-9 h-9 rounded-xl border border-[#D4AF37]/40 bg-[#D4AF37]/5 hover:bg-[#D4AF37]/15 flex items-center justify-center transition-colors shrink-0 mb-0.5"
                    title="التقاط صورة من الكاميرا وتحليلها بالذكاء الاصطناعي"
                  >
                    <Icon name="CameraIcon" size={16} className="text-[#D4AF37]" />
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp,image/gif,image/heic,image/heif,application/pdf"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  {/* Camera input with capture="environment" for mobile rear camera */}
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif"
                    capture="environment"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="اكتب رسالتك هنا... (Enter للإرسال، Shift+Enter لسطر جديد)"
                    rows={1}
                    dir="rtl"
                    className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-[#D4AF37]/50 resize-none min-h-[40px] max-h-32"
                    style={{ lineHeight: '1.5' }}
                  />
                  <button
                    onClick={handleSend}
                    disabled={sending || uploadingFile || (!input.trim() && !attachment)}
                    className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors shrink-0 mb-0.5 disabled:opacity-50"
                    style={{ backgroundColor: '#D4AF37', color: '#0A192F' }}
                    title="إرسال"
                  >
                    {sending || uploadingFile ? (
                      <Icon name="ArrowPathIcon" size={16} className="animate-spin" />
                    ) : (
                      <Icon name="PaperAirplaneIcon" size={16} />
                    )}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── New Conversation Modal ── */}
      {showNewConv && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-card rounded-2xl border border-border shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/30">
              <div>
                <h3 className="font-bold text-foreground">بدء محادثة جديدة</h3>
                {activeTab !== 'all' && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    الفئة المحددة: <span className="font-semibold text-[#D4AF37]">{ROLE_TABS.find(t => t.key === activeTab)?.label}</span>
                  </p>
                )}
              </div>
              <button
                onClick={() => { setShowNewConv(false); setSelectedUser(null); setUserSearch(''); setNewSubject(''); }}
                className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center"
              >
                <Icon name="XMarkIcon" size={16} className="text-muted-foreground" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-2">
                  اختر المستخدم
                  {activeTab !== 'all' && (
                    <span className="mr-1 text-muted-foreground font-normal">
                      (يعرض {ROLE_TABS.find(t => t.key === activeTab)?.label} فقط)
                    </span>
                  )}
                </label>
                <div className="relative mb-2">
                  <Icon name="MagnifyingGlassIcon" size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={userSearch}
                    onChange={e => setUserSearch(e.target.value)}
                    placeholder="ابحث بالاسم أو الشركة أو البريد..."
                    className="w-full h-9 pr-9 pl-3 rounded-xl border border-border bg-background text-foreground text-xs focus:outline-none focus:border-[#D4AF37]/50"
                    dir="rtl"
                  />
                </div>

                {selectedUser && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-xl mb-2">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold border ${ROLE_COLORS[selectedUser.seller_category || selectedUser.role] || 'bg-muted text-muted-foreground border-border'}`}>
                      {(selectedUser.full_name || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-foreground">{selectedUser.full_name}</p>
                      <p className="text-[10px] text-muted-foreground">{selectedUser.company_name || selectedUser.email}</p>
                    </div>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${ROLE_COLORS[selectedUser.seller_category || selectedUser.role] || 'bg-muted text-muted-foreground border-border'}`}>
                      {CATEGORY_LABELS[selectedUser.seller_category || ''] || ROLE_LABELS[selectedUser.role] || selectedUser.role}
                    </span>
                    <button onClick={() => setSelectedUser(null)} className="w-5 h-5 rounded-full hover:bg-muted flex items-center justify-center">
                      <Icon name="XMarkIcon" size={10} className="text-muted-foreground" />
                    </button>
                  </div>
                )}

                {!selectedUser && (
                  <div className="border border-border rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                    {usersLoading ? (
                      <div className="flex items-center justify-center py-6">
                        <Icon name="ArrowPathIcon" size={18} className="animate-spin text-[#D4AF37]" />
                      </div>
                    ) : filteredUsers.length === 0 ? (
                      <div className="text-center py-6 text-xs text-muted-foreground">
                        {activeTab !== 'all'
                          ? `لا يوجد مستخدمون في فئة "${ROLE_TABS.find(t => t.key === activeTab)?.label}"`
                          : 'لا توجد نتائج'}
                      </div>
                    ) : filteredUsers.slice(0, 30).map(u => (
                      <button
                        key={u.id}
                        onClick={() => setSelectedUser(u)}
                        className="w-full text-right flex items-center gap-2.5 px-3 py-2.5 border-b border-border/50 hover:bg-muted/50 transition-colors last:border-b-0"
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold border shrink-0 ${ROLE_COLORS[u.seller_category || u.role] || 'bg-muted text-muted-foreground border-border'}`}>
                          {(u.full_name || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-foreground truncate">{u.full_name || u.email}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{u.company_name || u.email}</p>
                        </div>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border shrink-0 ${ROLE_COLORS[u.seller_category || u.role] || 'bg-muted text-muted-foreground border-border'}`}>
                          {CATEGORY_LABELS[u.seller_category || ''] || ROLE_LABELS[u.role] || u.role}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-2">موضوع المحادثة (اختياري)</label>
                <input
                  type="text"
                  value={newSubject}
                  onChange={e => setNewSubject(e.target.value)}
                  placeholder="مثال: متابعة طلب شحن، مراجعة وثائق..."
                  className="w-full h-9 px-3 rounded-xl border border-border bg-background text-foreground text-xs focus:outline-none focus:border-[#D4AF37]/50"
                  dir="rtl"
                />
              </div>

              {error && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => { setShowNewConv(false); setSelectedUser(null); setUserSearch(''); setNewSubject(''); setError(''); }}
                  className="flex-1 h-10 rounded-xl border border-border text-sm font-semibold text-muted-foreground hover:bg-muted transition-colors"
                >
                  إلغاء
                </button>
                <button
                  onClick={handleCreateConversation}
                  disabled={!selectedUser || creatingConv}
                  className="flex-1 h-10 rounded-xl text-sm font-bold transition-colors disabled:opacity-50"
                  style={{ backgroundColor: '#D4AF37', color: '#0A192F' }}
                >
                  {creatingConv ? (
                    <span className="flex items-center justify-center gap-2">
                      <Icon name="ArrowPathIcon" size={14} className="animate-spin" />
                      جارٍ الإنشاء...
                    </span>
                  ) : 'بدء المحادثة'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
