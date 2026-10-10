'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { sanitizeChatMessage } from '@/lib/privacyShield';
import { useLanguage } from '@/contexts/LanguageContext';
import { needsChatTranslation } from '@/lib/chatTranslationGate';
import { resolveFileType, extensionForType, fileWithResolvedType } from '@/lib/attachmentTypes';
import LiveTranslationChatInput from '@/components/LiveTranslationChatInput';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Conversation {
  id: string;
  buyer_id: string;
  manufacturer_id: string | null;
  product_id: string;
  product_name?: string | null;
  supplier_name?: string | null;
  supplier_country?: string | null;
  supplier_flag?: string | null;
  supplier_avatar?: string | null;
  last_message?: string | null;
  last_message_at?: string | null;
  is_active?: boolean;
  created_at?: string;
  unread_count?: number;
  thread_type?: 'negotiation' | 'rfq' | 'order';
  /** Counterpart seller_category for translation gating (loaded from user_profiles) */
  seller_category?: string | null;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_role: string;
  message: string;
  attachment_url?: string;
  attachment_type?: string;
  attachment_name?: string;
  is_read: boolean;
  created_at: string;
}

// ─── Translation Types ────────────────────────────────────────────────────────
type SupportedLang = 'ar' | 'en' | 'zh' | 'tr';

interface TranslationCache {
  [msgId: string]: {
    translated: string;
    targetLang: SupportedLang;
  };
}

// ─── Constants ────────────────────────────────────────────────────────────────
// iOS sends image/heic and some Android browsers send image/jpg, so both must
// be accepted here and in the chat-media bucket's allowed_mime_types.
const ALLOWED_TYPES = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
  'image/heic', 'image/heif',
  'video/mp4', 'video/quicktime', 'video/webm',
  'application/pdf',
];
const ACCEPT_ATTR = ALLOWED_TYPES.join(',');
const ACCEPT_IMAGES = ALLOWED_TYPES.filter((t) => t.startsWith('image/')).join(',');
const MAX_SIZE = 25 * 1024 * 1024;

const THREAD_COLORS: Record<string, string> = {
  negotiation: 'bg-blue-100 text-blue-700 border-blue-200',
  rfq: 'bg-amber-100 text-amber-700 border-amber-200',
  order: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

const QUICK_REPLIES = [
  'What is the MOQ?',
  'Can I get a sample?',
  'What are the payment terms?',
  'Lead time?',
  'Do you offer customization?',
];

const LANG_OPTIONS: { value: SupportedLang; label: string; flag: string; nativeName: string }[] = [
  { value: 'ar', label: 'Arabic', flag: '🇸🇦', nativeName: 'العربية' },
  { value: 'en', label: 'English', flag: '🇬🇧', nativeName: 'English' },
  { value: 'zh', label: 'Chinese', flag: '🇨🇳', nativeName: '中文' },
  { value: 'tr', label: 'Turkish', flag: '🇹🇷', nativeName: 'Türkçe' },
];

function getAttachmentIcon(type?: string) {
  if (!type) return 'PaperClipIcon';
  if (type.startsWith('image/')) return 'PhotoIcon';
  if (type.startsWith('video/')) return 'VideoCameraIcon';
  if (type === 'application/pdf') return 'DocumentTextIcon';
  return 'PaperClipIcon';
}

function getAttachmentLabel(type?: string) {
  if (!type) return 'File';
  if (type.startsWith('image/')) return 'Image';
  if (type.startsWith('video/')) return 'Video';
  if (type === 'application/pdf') return 'PDF';
  return 'File';
}

function formatTime(iso?: string | null) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (diffDays === 0) return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return d.toLocaleDateString('en-US', { weekday: 'short' });
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch { return ''; }
}

function formatFullTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

function inferThreadType(conv: Conversation): 'negotiation' | 'rfq' | 'order' {
  const name = (conv.product_name || '').toLowerCase();
  if (name.includes('rfq') || name.includes('quote')) return 'rfq';
  if (name.includes('order') || name.includes('ord-')) return 'order';
  return 'negotiation';
}

// ─── Translation helper ───────────────────────────────────────────────────────
async function translateText(text: string, targetLanguage: SupportedLang): Promise<string> {
  try {
    const res = await fetch('/api/ai/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, targetLanguage }),
    });
    const data = await res.json();
    return data.translated || text;
  } catch {
    return text;
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ChatHubPage() {
  const { t, dir, isRTL, language } = useLanguage();
  const M = t.messaging;
  const threadLabel = (type: string) => ({ negotiation: M.negotiation, rfq: M.rfq, order: M.order } as Record<string, string>)[type] || type;
  const router = useRouter();
  const { user, loading: authLoading, requireAuth } = useAuth();
  const supabase = createClient();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [sending, setSending] = useState(false);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [privacyWarning, setPrivacyWarning] = useState<string | null>(null);
  const [pendingAttachment, setPendingAttachment] = useState<{ file: File; previewUrl?: string; type: string } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [filterType, setFilterType] = useState<'all' | 'negotiation' | 'rfq' | 'order'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [readReceiptMap, setReadReceiptMap] = useState<Record<string, boolean>>({});
  const [clearingChat, setClearingChat] = useState(false);
  const [visionAnalysis, setVisionAnalysis] = useState<string | null>(null);
  const [analyzingVision, setAnalyzingVision] = useState(false);

  // ── Translation state ───────────────────────────────────────────────────────
  const [myLang, setMyLang] = useState<SupportedLang>('ar');
  const [translationCache, setTranslationCache] = useState<TranslationCache>({});
  const [translatingIds, setTranslatingIds] = useState<Set<string>>(new Set());
  const [showOriginalIds, setShowOriginalIds] = useState<Set<string>>(new Set());
  const [autoTranslate, setAutoTranslate] = useState(true);
  const [showLangPicker, setShowLangPicker] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const langPickerRef = useRef<HTMLDivElement>(null);

  const activeConv = conversations.find((c) => c.id === activeConvId) || null;
  const needsTranslation = needsChatTranslation({
    sellerCategory: activeConv?.seller_category,
    country: activeConv?.supplier_country,
  });

  // ── Auth guard — login-on-demand ────────────────────────────────────────────
  useEffect(() => {
    if (authLoading) return;
    if (!user) requireAuth(undefined, M.authReasonFactories || M.signInReason);
  }, [user, authLoading]);

  // ── Fetch conversations ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!user || authLoading) return;
    const fetchConvs = async () => {
      setLoadingConvs(true);
      try {
        const { data } = await supabase
          .from('chat_conversations')
          .select('*')
          .or(`buyer_id.eq.${user.id},manufacturer_id.eq.${user.id}`)
          .order('last_message_at', { ascending: false });

        if (data) {
          // Batch-load seller_category for manufacturer counterparts (translation gating)
          const manufacturerIds = Array.from(
            new Set(data.map((c: Conversation) => c.manufacturer_id).filter(Boolean) as string[])
          );
          const categoryByManufacturer: Record<string, string | null> = {};
          if (manufacturerIds.length > 0) {
            try {
              const { data: profiles } = await supabase
                .from('user_profiles')
                .select('id, seller_category')
                .in('id', manufacturerIds);
              (profiles || []).forEach((p: { id: string; seller_category?: string | null }) => {
                categoryByManufacturer[p.id] = p.seller_category ?? null;
              });
            } catch {
              // Column may be missing on older DBs — country fallback still works
            }
          }
          const withUnread = await Promise.all(
            data.map(async (conv) => {
              const { count } = await supabase
                .from('chat_messages')
                .select('*', { count: 'exact', head: true })
                .eq('conversation_id', conv.id)
                .eq('is_read', false)
                .neq('sender_id', user.id);
              return {
                ...conv,
                unread_count: count || 0,
                thread_type: inferThreadType(conv),
                seller_category: conv.manufacturer_id
                  ? (categoryByManufacturer[conv.manufacturer_id] ?? null)
                  : null,
              };
            })
          );
          setConversations(withUnread);
          if (withUnread.length > 0 && !activeConvId) {
            setActiveConvId(withUnread[0].id);
          }
        }
      } catch (err) {
        console.warn('Fetch conversations error (showing demo data):', err);
        // Show demo conversations so the UI is not empty
        const demoConvs: Conversation[] = [
          {
            id: 'demo-1',
            buyer_id: user.id,
            manufacturer_id: null,
            product_id: 'p1',
            product_name: 'Industrial Steel Pipes',
            supplier_name: 'SteelPro Manufacturing',
            supplier_country: 'China',
            supplier_flag: '🇨🇳',
            supplier_avatar: '',
            last_message: 'What is the MOQ for 500 units?',
            last_message_at: new Date(Date.now() - 3600000).toISOString(),
            is_active: true,
            created_at: new Date(Date.now() - 86400000).toISOString(),
            unread_count: 2,
            thread_type: 'negotiation',
            seller_category: 'international_factory',
          },
          {
            id: 'demo-2',
            buyer_id: user.id,
            manufacturer_id: null,
            product_id: 'p2',
            product_name: 'LED Smart Lighting System',
            supplier_name: 'LightTech Co.',
            supplier_country: 'China',
            supplier_flag: '🇨🇳',
            supplier_avatar: '',
            last_message: 'We can offer a 10% discount for bulk orders.',
            last_message_at: new Date(Date.now() - 7200000).toISOString(),
            is_active: true,
            created_at: new Date(Date.now() - 172800000).toISOString(),
            unread_count: 0,
            thread_type: 'rfq',
            seller_category: 'international_factory',
          },
          {
            id: 'demo-local',
            buyer_id: user.id,
            manufacturer_id: null,
            product_id: 'p3',
            product_name: 'Yemen Cement Bags',
            supplier_name: 'Local Yemen Supplier',
            supplier_country: 'Yemen',
            supplier_flag: '🇾🇪',
            supplier_avatar: '',
            last_message: 'التوصيل متاح داخل صنعاء',
            last_message_at: new Date(Date.now() - 5400000).toISOString(),
            is_active: true,
            created_at: new Date(Date.now() - 200000000).toISOString(),
            unread_count: 0,
            thread_type: 'negotiation',
            seller_category: 'local_factory',
          },
        ];
        setConversations(demoConvs);
        if (!activeConvId) setActiveConvId('demo-1');
      } finally {
        setLoadingConvs(false);
      }
    };
    fetchConvs();
  }, [user, authLoading]);

  // ── Real-time: new conversations ────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('chat-hub-convs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_conversations' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const conv = payload.new as Conversation;
          if (conv.buyer_id === user.id || conv.manufacturer_id === user.id) {
            setConversations((prev) => [{ ...conv, unread_count: 0, thread_type: inferThreadType(conv) }, ...prev]);
          }
        } else if (payload.eventType === 'UPDATE') {
          setConversations((prev) =>
            prev.map((c) => c.id === payload.new.id ? { ...c, ...payload.new } : c)
          );
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // ── Fetch messages for active conversation ──────────────────────────────────
  useEffect(() => {
    if (!activeConvId || !user) return;
    const fetchMsgs = async () => {
      setLoadingMsgs(true);
      try {
        const { data } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('conversation_id', activeConvId)
          .order('created_at', { ascending: true });
        setMessages(data || []);

        await supabase
          .from('chat_messages')
          .update({ is_read: true })
          .eq('conversation_id', activeConvId)
          .neq('sender_id', user.id)
          .eq('is_read', false);

        setConversations((prev) =>
          prev.map((c) => c.id === activeConvId ? { ...c, unread_count: 0 } : c)
        );
      } catch (err) {
        console.error('Fetch messages error:', err);
      } finally {
        setLoadingMsgs(false);
      }
    };
    fetchMsgs();
  }, [activeConvId, user]);

  // ── Auto-translate incoming messages (international counterparts only) ──────
  useEffect(() => {
    if (!needsTranslation || !autoTranslate || messages.length === 0 || !user) return;
    const untranslated = messages.filter(
      (msg) => msg.sender_id !== user.id && msg.message && !translationCache[msg.id]
    );
    if (untranslated.length === 0) return;

    untranslated.forEach(async (msg) => {
      setTranslatingIds((prev) => new Set(prev).add(msg.id));
      const translated = await translateText(msg.message, myLang);
      setTranslationCache((prev) => ({ ...prev, [msg.id]: { translated, targetLang: myLang } }));
      setTranslatingIds((prev) => {
        const next = new Set(prev);
        next.delete(msg.id);
        return next;
      });
    });
  }, [messages, autoTranslate, myLang, user, needsTranslation]);

  // ── Re-translate when language changes ──────────────────────────────────────
  useEffect(() => {
    if (!user || messages.length === 0) return;
    setTranslationCache({});
  }, [myLang]);

  // ── Real-time: messages in active conversation ──────────────────────────────
  useEffect(() => {
    if (!activeConvId || !user) return;
    const channel = supabase
      .channel(`chat-hub-msgs:${activeConvId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `conversation_id=eq.${activeConvId}` },
        async (payload) => {
          const msg = payload.new as Message;
          setMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]);
          if (msg.sender_id !== user.id) {
            await supabase.from('chat_messages').update({ is_read: true }).eq('id', msg.id);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'chat_messages', filter: `conversation_id=eq.${activeConvId}` },
        (payload) => {
          const updated = payload.new as Message;
          setMessages((prev) => prev.map((m) => m.id === updated.id ? updated : m));
          if (updated.is_read && updated.sender_id === user.id) {
            setReadReceiptMap((prev) => ({ ...prev, [updated.id]: true }));
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeConvId, user]);

  // ── Scroll to bottom ────────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Close header lang picker on outside click ────────────────────────────────
  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (langPickerRef.current && !langPickerRef.current.contains(e.target as Node)) {
        setShowLangPicker(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // ── Attachment handler ──────────────────────────────────────────────────────
  const handleAttachmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const resolvedType = resolveFileType(file, ALLOWED_TYPES);
    if (!resolvedType) {
      setPrivacyWarning('Unsupported file type. Allowed: Images, Videos (MP4/MOV), PDF documents.');
      setTimeout(() => setPrivacyWarning(null), 5000);
      return;
    }
    if (file.size > MAX_SIZE) {
      setPrivacyWarning('File too large. Maximum size is 25MB.');
      setTimeout(() => setPrivacyWarning(null), 5000);
      return;
    }
    const previewUrl = resolvedType.startsWith('image/') ? URL.createObjectURL(file) : undefined;
    setPendingAttachment({ file, previewUrl, type: resolvedType });
    // Reset both inputs so re-picking the same file still fires onChange.
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    if (fileInputRef.current) fileInputRef.current.value = '';
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
      setVisionAnalysis(res.ok ? data.analysis : data.error || 'تعذّر تحليل الصورة.');
    } catch {
      setVisionAnalysis('خطأ في الاتصال بنموذج الذكاء الاصطناعي.');
    } finally {
      setAnalyzingVision(false);
    }
  };

  const clearAttachment = useCallback(() => {
    if (pendingAttachment?.previewUrl) URL.revokeObjectURL(pendingAttachment.previewUrl);
    setPendingAttachment(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setVisionAnalysis(null);
    setAnalyzingVision(false);
  }, [pendingAttachment]);

  // ── Toggle show original ─────────────────────────────────────────────────────
  const toggleShowOriginal = (msgId: string) => {
    setShowOriginalIds((prev) => {
      const next = new Set(prev);
      if (next.has(msgId)) next.delete(msgId);
      else next.add(msgId);
      return next;
    });
  };

  // ── Manual translate single message ─────────────────────────────────────────
  const translateMessage = async (msg: Message) => {
    if (translationCache[msg.id] || translatingIds.has(msg.id)) return;
    setTranslatingIds((prev) => new Set(prev).add(msg.id));
    const translated = await translateText(msg.message, myLang);
    setTranslationCache((prev) => ({ ...prev, [msg.id]: { translated, targetLang: myLang } }));
    setTranslatingIds((prev) => {
      const next = new Set(prev);
      next.delete(msg.id);
      return next;
    });
  };

  // ── Send message ────────────────────────────────────────────────────────────
  const sendMessage = async (text: string, attachment?: { file: File; previewUrl?: string; type: string }) => {
    if (!text.trim() && !attachment) return;
    if (sending || !activeConvId || !user) return;

    if (text.trim()) {
      const shield = sanitizeChatMessage(text.trim());
      if (shield.blocked) {
        setPrivacyWarning(shield.reason || 'Message blocked by privacy shield.');
        setTimeout(() => setPrivacyWarning(null), 6000);
        return;
      }
    }

    setSending(true);
    setUploadingAttachment(!!attachment);

    // Capture blob URL before clearing state so we can revoke it only AFTER
    // the optimistic message has been updated with the real public URL.
    const blobPreviewUrl = attachment?.previewUrl;

    const optimisticId = `opt-${Date.now()}`;
    const optimisticMsg: Message = {
      id: optimisticId,
      conversation_id: activeConvId,
      sender_id: user.id,
      sender_role: user.user_metadata?.role || 'buyer',
      message: text.trim() || (attachment ? `[${getAttachmentLabel(attachment.type)} attached]` : ''),
      attachment_url: attachment?.previewUrl,
      attachment_type: attachment?.file.type,
      attachment_name: attachment?.file.name,
      created_at: new Date().toISOString(),
      is_read: false,
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setInputText('');
    // Clear attachment state WITHOUT revoking blob URL — revocation happens after real URL is saved
    setPendingAttachment(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setVisionAnalysis(null);
    setAnalyzingVision(false);

    try {
      let attachmentUrl: string | undefined;
      let attachmentType: string | undefined;
      let attachmentName: string | undefined;

      if (attachment) {
        const ext = extensionForType(attachment.type);
        const filePath = `chat-attachments/${user.id}/${Date.now()}.${ext}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('chat-media')
          .upload(filePath, fileWithResolvedType(attachment.file, attachment.type), { contentType: attachment.type, upsert: false });
        if (!uploadError && uploadData) {
          const { data: urlData } = supabase.storage.from('chat-media').getPublicUrl(filePath);
          attachmentUrl = urlData?.publicUrl;
          attachmentType = attachment.type;
          attachmentName = attachment.file.name;
          // Update the optimistic message with the real public URL before revoking the blob
          setMessages((prev) => prev.map((m) =>
            m.id === optimisticId
              ? { ...m, attachment_url: attachmentUrl, attachment_type: attachmentType, attachment_name: attachmentName }
              : m
          ));
        } else {
          // Upload failed — remove optimistic message and notify user
          setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
          if (blobPreviewUrl) URL.revokeObjectURL(blobPreviewUrl);
          setPrivacyWarning(uploadError?.message || 'Failed to upload attachment. Please try again.');
          setTimeout(() => setPrivacyWarning(null), 5000);
          setSending(false);
          setUploadingAttachment(false);
          return;
        }
      }

      // Safe to revoke blob URL now — optimistic message has already been updated with real URL
      if (blobPreviewUrl) URL.revokeObjectURL(blobPreviewUrl);

      setUploadingAttachment(false);

      const { data: inserted, error } = await supabase
        .from('chat_messages')
        .insert({
          conversation_id: activeConvId,
          sender_id: user.id,
          sender_role: user.user_metadata?.role || 'buyer',
          message: text.trim() || (attachmentName ? `[${getAttachmentLabel(attachmentType)} attached]` : ''),
          attachment_url: attachmentUrl,
          attachment_type: attachmentType,
          attachment_name: attachmentName,
          is_read: false,
        })
        .select()
        .single();

      if (!error && inserted) {
        setMessages((prev) => prev.map((m) => m.id === optimisticId ? inserted : m));
      } else if (error) {
        console.error('Insert message error:', error);
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      }
    } catch (err) {
      console.error('Send message error:', err);
      if (blobPreviewUrl) URL.revokeObjectURL(blobPreviewUrl);
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
    } finally {
      setSending(false);
      setUploadingAttachment(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(inputText, pendingAttachment || undefined);
  };

  // ── Filtered conversations ──────────────────────────────────────────────────
  const filteredConvs = conversations.filter((c) => {
    const matchesType = filterType === 'all' || c.thread_type === filterType;
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q
      || (c.supplier_name || '').toLowerCase().includes(q)
      || (c.product_name || '').toLowerCase().includes(q);
    return matchesType && matchesSearch;
  });

  const totalUnread = conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);

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

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  const isUserMessage = (msg: Message) => msg.sender_id === user.id;

  // ── Clear chat history ──────────────────────────────────────────────────────
  const handleClearChat = async () => {
    if (!activeConvId || !user || clearingChat) return;
    if (!window.confirm('هل تريد مسح سجل المحادثة؟ لا يمكن التراجع عن هذا الإجراء.\nClear chat history? This cannot be undone.')) return;
    setClearingChat(true);
    try {
      await supabase
        .from('chat_messages')
        .delete()
        .eq('conversation_id', activeConvId)
        .eq('sender_id', user.id);
      setMessages([]);
      setTranslationCache({});
    } catch (err) {
      console.error('Clear chat error:', err);
    } finally {
      setClearingChat(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      {/* Page Header */}
      <div className="bg-card border-b border-border sticky top-[120px] z-30">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Icon name="ChatBubbleLeftRightIcon" size={18} className="text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-foreground leading-none">Negotiation Hub</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                {conversations.length} thread{conversations.length !== 1 ? 's' : ''}
                {totalUnread > 0 && <span className="ml-1.5 text-primary font-semibold">· {totalUnread} unread</span>}
              </p>
            </div>
          </div>
          <Link
            href="/rfq-board"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 border border-primary/20 rounded-lg text-xs font-bold text-primary shrink-0"
          >
            <Icon name="DocumentTextIcon" size={13} />
            <span className="hidden sm:inline">Post RFQ</span>
          </Link>
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Toggle thread list"
          >
            <Icon name="Bars3Icon" size={18} />
          </button>
        </div>
      </div>

      {/* Main Layout */}
      <div className="flex-1 max-w-7xl w-full mx-auto flex overflow-hidden" style={{ height: 'calc(100vh - 200px)' }}>

        {/* ── Sidebar: Conversation Threads ─────────────────────────────────── */}
        <aside
          className={`${
            sidebarOpen ? 'flex' : 'hidden'
          } md:flex flex-col w-full md:w-80 lg:w-96 border-r border-border bg-card shrink-0 overflow-hidden`}
        >
          {/* Search + Filter */}
          <div className="p-3 border-b border-border space-y-2">
            <div className="relative">
              <Icon name="MagnifyingGlassIcon" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
              />
            </div>
            <div className="flex gap-1.5 overflow-x-auto hide-scrollbar">
              {(['all', 'negotiation', 'rfq', 'order'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold border transition-colors ${
                    filterType === type
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-muted-foreground border-border hover:border-primary/40'
                  }`}
                >
                  {type === 'all' ? M.all : threadLabel(type)}
                </button>
              ))}
            </div>
          </div>

          {/* Thread List */}
          <div className="flex-1 overflow-y-auto">
            {loadingConvs ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filteredConvs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-3">
                  <Icon name="ChatBubbleLeftRightIcon" size={24} className="text-muted-foreground" />
                </div>
                <p className="text-sm font-semibold text-foreground mb-1">No conversations yet</p>
                <p className="text-xs text-muted-foreground mb-4">Start by sending an inquiry from a product page</p>
                <Link href="/search" className="px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-lg">
                  Browse Products
                </Link>
              </div>
            ) : (
              filteredConvs.map((conv) => {
                const isActive = conv.id === activeConvId;
                const threadType = conv.thread_type || 'negotiation';
                const threadColor = THREAD_COLORS[threadType];
                const threadLabelText = threadLabel(threadType);
                return (
                  <button
                    key={conv.id}
                    onClick={() => {
                      setActiveConvId(conv.id);
                      setSidebarOpen(false);
                    }}
                    className={`w-full text-left px-4 py-3.5 border-b border-border/60 transition-colors flex gap-3 items-start ${
                      isActive ? 'bg-primary/5 border-l-2 border-l-primary' : 'hover:bg-muted/50'
                    }`}
                  >
                    <div className="relative shrink-0">
                      <div className="w-10 h-10 rounded-full overflow-hidden border border-border bg-muted">
                        <AppImage
                          src={conv.supplier_avatar || 'https://img.rocket.new/generatedImages/rocket_gen_img_169fbb1d1-1774273435523.png'}
                          alt={conv.supplier_name || 'Supplier'}
                          width={40}
                          height={40}
                          className="object-cover w-full h-full"
                        />
                      </div>
                      {(conv.unread_count || 0) > 0 && (
                        <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-primary text-primary-foreground text-[9px] font-bold rounded-full flex items-center justify-center px-0.5">
                          {(conv.unread_count || 0) > 9 ? '9+' : conv.unread_count}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-xs font-bold text-foreground truncate flex-1">{conv.supplier_name || 'DirectHub Supplier'}</span>
                        <span className="text-[10px] text-muted-foreground shrink-0">{formatTime(conv.last_message_at)}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${threadColor}`}>
                          {threadLabelText}
                        </span>
                        <span className="text-[10px] text-muted-foreground truncate">{conv.supplier_flag} {conv.product_name}</span>
                      </div>
                      <p className={`text-xs truncate ${(conv.unread_count || 0) > 0 ? 'text-foreground font-semibold' : 'text-muted-foreground'}`}>
                        {conv.last_message || 'No messages yet'}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* ── Main Chat Area ─────────────────────────────────────────────────── */}
        <div className={`${sidebarOpen ? 'hidden' : 'flex'} md:flex flex-col flex-1 overflow-hidden`}>
          {!activeConv ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
              <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center mb-4">
                <Icon name="ChatBubbleLeftRightIcon" size={36} className="text-primary" />
              </div>
              <h2 className="text-lg font-bold text-foreground mb-2">Select a conversation</h2>
              <p className="text-sm text-muted-foreground max-w-xs">
                Choose a thread from the sidebar to start negotiating, discuss RFQs, or coordinate orders.
              </p>
            </div>
          ) : (
            <>
              {/* Conversation Header */}
              <div className="bg-card border-b border-border px-4 py-3 flex items-center gap-3 shrink-0">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
                  aria-label="Back to threads"
                >
                  <Icon name="ArrowLeftIcon" size={18} />
                </button>

                <div className="relative shrink-0">
                  <div className="w-10 h-10 rounded-full overflow-hidden border border-border bg-muted">
                    <AppImage
                      src={activeConv.supplier_avatar || 'https://img.rocket.new/generatedImages/rocket_gen_img_169fbb1d1-1774273435523.png'}
                      alt={activeConv.supplier_name || 'Supplier'}
                      width={40}
                      height={40}
                      className="object-cover w-full h-full"
                    />
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-foreground truncate">{activeConv.supplier_name || 'DirectHub Supplier'}</p>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border shrink-0 ${THREAD_COLORS[activeConv.thread_type || 'negotiation']}`}>
                      {threadLabel(activeConv.thread_type || 'negotiation')}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {activeConv.supplier_flag} {activeConv.supplier_country} · {activeConv.product_name}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Alibaba-style Language Picker — international chats only */}
                  {needsTranslation && (
                  <div className="relative" ref={langPickerRef}>
                    <button
                      onClick={() => setShowLangPicker((v) => !v)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-50 border border-blue-200 rounded-xl text-xs font-bold text-blue-700 hover:bg-blue-100 transition-colors"
                    >
                      <span className="text-sm">{LANG_OPTIONS.find(l => l.value === myLang)?.flag}</span>
                      <span>{LANG_OPTIONS.find(l => l.value === myLang)?.nativeName}</span>
                      <Icon name="ChevronDownIcon" size={11} className="text-blue-500" />
                    </button>
                    {showLangPicker && (
                      <div className="absolute right-0 top-full mt-1.5 bg-card border border-border rounded-2xl shadow-xl z-50 overflow-hidden min-w-[160px]">
                        <div className="px-3 py-2 border-b border-border bg-muted/40">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Translate to</p>
                        </div>
                        {LANG_OPTIONS.map((lang) => (
                          <button
                            key={lang.value}
                            onClick={() => { setMyLang(lang.value); setTranslationCache({}); setShowLangPicker(false); }}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-colors hover:bg-muted ${myLang === lang.value ? 'bg-primary/5 text-primary font-bold' : 'text-foreground'}`}
                          >
                            <span className="text-base">{lang.flag}</span>
                            <div className="text-left">
                              <p className="text-xs font-semibold leading-none">{lang.nativeName}</p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">{lang.label}</p>
                            </div>
                            {myLang === lang.value && <Icon name="CheckIcon" size={13} className="ml-auto text-primary" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  )}
                  {/* Auto-translate toggle */}
                  {needsTranslation && (
                  <button
                    onClick={() => setAutoTranslate((v) => !v)}
                    className={`flex items-center gap-1 px-2 py-1.5 rounded-xl border text-[10px] font-bold transition-colors ${
                      autoTranslate ? 'bg-blue-500 border-blue-500 text-white' : 'bg-muted border-border text-muted-foreground'
                    }`}
                    title={autoTranslate ? 'Auto-translate ON' : 'Auto-translate OFF'}
                  >
                    <span>🌐</span>
                    <span className="hidden sm:inline">{autoTranslate ? 'Auto' : 'Manual'}</span>
                  </button>
                  )}
                  <button
                    onClick={handleClearChat}
                    disabled={clearingChat || messages.length === 0}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-red-50 border border-red-200 rounded-lg text-[10px] font-bold text-red-600 hover:bg-red-100 transition-colors disabled:opacity-40"
                    title="Clear chat history"
                  >
                    {clearingChat ? (
                      <div className="w-3 h-3 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Icon name="TrashIcon" size={12} />
                    )}
                    <span className="hidden sm:inline">مسح</span>
                  </button>
                  <Link
                    href={`/rfq/${activeConv.product_id}`}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-[10px] font-bold text-amber-700 hover:bg-amber-100 transition-colors"
                    title="Create RFQ"
                  >
                    <Icon name="DocumentTextIcon" size={12} />
                    <span className="hidden sm:inline">RFQ</span>
                  </Link>
                  <Link
                    href={`/product/${activeConv.product_id}`}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-muted border border-border rounded-lg text-[10px] font-bold text-muted-foreground hover:text-foreground transition-colors"
                    title="View Product"
                  >
                    <Icon name="TagIcon" size={12} />
                    <span className="hidden sm:inline">Product</span>
                  </Link>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                {/* Security Banner — Direct Hub Protection */}
                <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                  <div className="w-8 h-8 rounded-full bg-green-100 border border-green-300 flex items-center justify-center shrink-0">
                    <Icon name="ShieldCheckIcon" size={16} className="text-green-600" />
                  </div>
                  <p className="text-xs text-green-800 leading-relaxed flex-1" dir={dir}>
                    {M.keepOnPlatform}
                  </p>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-300 shrink-0">
                    {M.privacyShieldActive}
                  </span>
                </div>

                {/* Privacy Shield notice */}
                <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2.5">
                  <Icon name="InformationCircleIcon" size={14} className="text-blue-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-700 leading-relaxed">
                    <span className="font-semibold">Privacy Shield Active — </span>
                    Contact info sharing is protected. Share product images, videos, and PDF catalogs via the attachment button.
                  </p>
                </div>

                {loadingMsgs ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mb-3">
                      <Icon name="ChatBubbleOvalLeftEllipsisIcon" size={22} className="text-muted-foreground" />
                    </div>
                    <p className="text-sm font-semibold text-foreground mb-1">Start the conversation</p>
                    <p className="text-xs text-muted-foreground">Send a message to begin negotiating</p>
                  </div>
                ) : (
                  messages.map((msg, idx) => {
                    const isUser = isUserMessage(msg);
                    const isRead = msg.is_read || readReceiptMap[msg.id];
                    const showDate =
                      idx === 0 ||
                      new Date(messages[idx - 1].created_at).toDateString() !== new Date(msg.created_at).toDateString();
                    const cached = translationCache[msg.id];
                    const isTranslating = translatingIds.has(msg.id);
                    const showOriginal = showOriginalIds.has(msg.id);
                    const hasTranslation = !!cached?.translated && cached.translated !== msg.message;
                    const currentLangOption = LANG_OPTIONS.find(l => l.value === myLang);

                    return (
                      <React.Fragment key={msg.id}>
                        {showDate && (
                          <div className="flex items-center gap-3 my-2">
                            <div className="flex-1 h-px bg-border" />
                            <span className="text-[10px] text-muted-foreground font-semibold px-2 shrink-0">
                              {new Date(msg.created_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                            </span>
                            <div className="flex-1 h-px bg-border" />
                          </div>
                        )}
                        <div className={`flex gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                          {/* Avatar */}
                          {!isUser && (
                            <div className="w-7 h-7 rounded-full overflow-hidden border border-border bg-muted shrink-0 mt-1">
                              <AppImage
                                src={activeConv.supplier_avatar || 'https://img.rocket.new/generatedImages/rocket_gen_img_169fbb1d1-1774273435523.png'}
                                alt={activeConv.supplier_name || 'Supplier'}
                                width={28}
                                height={28}
                                className="object-cover w-full h-full"
                              />
                            </div>
                          )}
                          {isUser && (
                            <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center shrink-0 mt-1">
                              <Icon name="UserCircleIcon" size={16} className="text-primary-foreground" />
                            </div>
                          )}

                          <div className={`max-w-[72%] space-y-1 flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                            {/* Image attachment */}
                            {msg.attachment_url && msg.attachment_type?.startsWith('image/') && (
                              <div className="rounded-xl overflow-hidden border border-border max-w-[220px]">
                                <img
                                  src={msg.attachment_url}
                                  alt={msg.attachment_name || 'Attachment'}
                                  className="w-full h-auto object-cover max-h-44"
                                />
                              </div>
                            )}
                            {/* Video attachment */}
                            {msg.attachment_url && msg.attachment_type?.startsWith('video/') && (
                              <div className="rounded-xl overflow-hidden border border-border max-w-[220px]">
                                <video src={msg.attachment_url} controls className="w-full max-h-44" preload="metadata" />
                              </div>
                            )}
                            {/* PDF attachment */}
                            {msg.attachment_url && msg.attachment_type === 'application/pdf' && (
                              <a
                                href={msg.attachment_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition-colors ${
                                  isUser
                                    ? 'bg-primary/20 border-primary/30 text-primary' : 'bg-muted border-border text-foreground hover:bg-muted/70'
                                }`}
                              >
                                <Icon name="DocumentTextIcon" size={14} className="shrink-0" />
                                <span className="truncate max-w-[140px]">{msg.attachment_name || 'Document.pdf'}</span>
                                <Icon name="ArrowTopRightOnSquareIcon" size={11} className="shrink-0 ml-auto" />
                              </a>
                            )}
                            {/* Pending attachment (no URL) */}
                            {msg.attachment_name && !msg.attachment_url && (
                              <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold ${
                                isUser ? 'bg-primary/20 border-primary/30 text-primary' : 'bg-muted border-border text-foreground'
                              }`}>
                                <Icon name={getAttachmentIcon(msg.attachment_type)} size={13} className="shrink-0" />
                                <span className="truncate max-w-[140px]">{msg.attachment_name}</span>
                              </div>
                            )}
                            {/* Text bubble */}
                            {msg.message && (
                              <div className="space-y-1 w-full">
                                {/* ── Alibaba-style: show translated bubble first for received msgs ── */}
                                {needsTranslation && !isUser && hasTranslation && !showOriginal ? (
                                  <>
                                    {/* Translated bubble (primary) */}
                                    <div className="relative group/bubble">
                                      <div className="px-4 py-2.5 rounded-2xl rounded-tl-sm text-sm leading-relaxed bg-card border border-border text-foreground">
                                        {cached.translated}
                                      </div>
                                      {/* Translated badge */}
                                      <div className="flex items-center gap-1.5 mt-1">
                                        <span className="flex items-center gap-1 text-[10px] text-blue-500 font-semibold">
                                          <span>{currentLangOption?.flag}</span>
                                          <span>{M.translate}</span>
                                          <span className="text-blue-400">·</span>
                                          <button
                                            onClick={() => toggleShowOriginal(msg.id)}
                                            className="text-[10px] text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
                                          >
                                            {M.showOriginal}
                                          </button>
                                        </span>
                                      </div>
                                    </div>
                                  </>
                                ) : needsTranslation && !isUser && hasTranslation && showOriginal ? (
                                  <>
                                    {/* Original bubble (shown when toggled) */}
                                    <div className="px-4 py-2.5 rounded-2xl rounded-tl-sm text-sm leading-relaxed bg-card border border-border text-foreground">
                                      {msg.message}
                                    </div>
                                    {/* Translated bubble below */}
                                    <div className="px-4 py-2.5 rounded-2xl rounded-tl-sm text-sm leading-relaxed bg-blue-50 border border-blue-200 text-blue-900">
                                      <div className="flex items-center gap-1 mb-1.5">
                                        <span className="text-[9px] font-bold text-blue-500 uppercase tracking-wide flex items-center gap-1">
                                          <span>{currentLangOption?.flag}</span>
                                          <span>{M.translateToLang.replace('{lang}', currentLangOption?.nativeName || '')}</span>
                                        </span>
                                        <button
                                          onClick={() => toggleShowOriginal(msg.id)}
                                          className="ml-auto text-[10px] text-blue-400 hover:text-blue-600 underline underline-offset-2 transition-colors"
                                        >
                                          {M.hideOriginal}
                                        </button>
                                      </div>
                                      {cached.translated}
                                    </div>
                                  </>
                                ) : (
                                  /* Default: original bubble */
                                  <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                                    isUser
                                      ? 'bg-primary text-primary-foreground rounded-tr-sm'
                                      : 'bg-card border border-border text-foreground rounded-tl-sm'
                                  }`}>
                                    {msg.message}
                                  </div>
                                )}

                                {/* ── Alibaba-style translate action row (received msgs only) ── */}
                                {!isUser && needsTranslation && (
                                  <div className="flex items-center gap-2 mt-0.5">
                                    {isTranslating ? (
                                      <span className="flex items-center gap-1.5 text-[10px] text-blue-500 font-medium">
                                        <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                                        <span>{M.translating}</span>
                                      </span>
                                    ) : !hasTranslation ? (
                                      <button
                                        onClick={() => translateMessage(msg)}
                                        className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 border border-blue-200 rounded-full text-[10px] font-bold text-blue-600 hover:bg-blue-100 hover:border-blue-300 transition-colors"
                                      >
                                        <span>🌐</span>
                                        <span>{M.translate}</span>
                                        <span className="text-blue-400">→ {currentLangOption?.nativeName}</span>
                                      </button>
                                    ) : null}
                                  </div>
                                )}
                              </div>
                            )}
                            {/* Timestamp + Read receipt */}
                            <div className={`flex items-center gap-1 px-1 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                              <span className="text-[10px] text-muted-foreground">{formatFullTime(msg.created_at)}</span>
                              {isUser && (
                                <span className={`text-[10px] font-semibold ${isRead ? 'text-primary' : 'text-muted-foreground'}`}>
                                  {isRead ? '✓✓' : '✓'}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="bg-card/95 backdrop-blur-md border-t border-border px-4 pt-2 pb-3 shrink-0">
                {/* Privacy warning */}
                {privacyWarning && (
                  <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-2">
                    <span className="text-red-500 text-sm shrink-0">🚫</span>
                    <p className="text-xs text-red-700 leading-relaxed font-medium flex-1">{privacyWarning}</p>
                    <button onClick={() => setPrivacyWarning(null)} className="text-red-400 hover:text-red-600 shrink-0">
                      <Icon name="XMarkIcon" size={13} />
                    </button>
                  </div>
                )}

                {/* Pending attachment preview */}
                {pendingAttachment && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-primary/5 border border-primary/20 rounded-xl mb-2">
                    {pendingAttachment.previewUrl ? (
                      <img src={pendingAttachment.previewUrl} alt="Preview" className="w-9 h-9 rounded-lg object-cover shrink-0" />
                    ) : (
                      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Icon name={getAttachmentIcon(pendingAttachment.type)} size={16} className="text-primary" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{pendingAttachment.file.name}</p>
                      <p className="text-[10px] text-muted-foreground">{getAttachmentLabel(pendingAttachment.type)} · {(pendingAttachment.file.size / 1024 / 1024).toFixed(1)}MB</p>
                    </div>
                    {pendingAttachment.type.startsWith('image/') && (
                      <button
                        onClick={() => void analyzeImageWithVision(pendingAttachment.file)}
                        disabled={analyzingVision}
                        title="تحليل الصورة بالذكاء الاصطناعي"
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold text-primary border border-primary/30 hover:bg-primary/10 disabled:opacity-40 transition-colors shrink-0"
                      >
                        <span>🔍</span>
                        <span className="hidden sm:inline">تحليل</span>
                      </button>
                    )}
                    <button onClick={clearAttachment} className="text-muted-foreground hover:text-foreground shrink-0">
                      <Icon name="XMarkIcon" size={15} />
                    </button>
                  </div>
                )}

                {/* Quick replies */}
                <div className="flex gap-1.5 overflow-x-auto hide-scrollbar pb-2">
                  {QUICK_REPLIES.map((qr) => (
                    <button
                      key={qr}
                      onClick={() => sendMessage(qr)}
                      className="shrink-0 px-2.5 py-1 bg-muted border border-border rounded-full text-[10px] font-semibold text-foreground hover:bg-muted/70 transition-colors whitespace-nowrap"
                    >
                      {qr}
                    </button>
                  ))}
                </div>

                {/* Vision Analysis Result Panel */}
                {(analyzingVision || visionAnalysis) && (
                  <div className="mb-2 rounded-xl border border-primary/30 bg-primary/5 overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-primary/20 bg-primary/10">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">🔍</span>
                        <span className="text-xs font-bold text-primary">تحليل Gemini Vision</span>
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
                    <div className="px-3 py-2.5 max-h-40 overflow-y-auto">
                      {analyzingVision ? (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
                          <span>جارٍ تحليل الصورة بالذكاء الاصطناعي...</span>
                        </div>
                      ) : (
                        <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap" dir="rtl">{visionAnalysis}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Translation toggle row — above input (international chats only) */}
                {needsTranslation && (
                <div className="flex items-center justify-between mb-2">
                  {/* Language selector */}
                  <div className="flex items-center gap-1 bg-muted border border-border rounded-xl p-0.5">
                    {LANG_OPTIONS.map((lang) => (
                      <button
                        key={lang.value}
                        onClick={() => { setMyLang(lang.value); setTranslationCache({}); }}
                        className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition-colors ${
                          myLang === lang.value
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <span>{lang.flag}</span>
                        <span>{lang.value.toUpperCase()}</span>
                      </button>
                    ))}
                  </div>
                  {/* Auto-translate toggle */}
                  <button
                    onClick={() => setAutoTranslate((v) => !v)}
                    className={`flex items-center gap-1.5 text-xs font-semibold transition-colors ${
                      autoTranslate ? 'text-blue-600' : 'text-muted-foreground'
                    }`}
                    dir={dir}
                  >
                    <span className="text-sm">🌐</span>
                    <span>{M.autoTranslate}</span>
                    <span className={`w-8 h-4 rounded-full transition-colors flex items-center px-0.5 ${autoTranslate ? 'bg-blue-500' : 'bg-muted-foreground/40'}`}>
                      <span className={`w-3 h-3 bg-white rounded-full shadow transition-transform ${autoTranslate ? 'translate-x-4' : 'translate-x-0'}`} />
                    </span>
                  </button>
                </div>
                )}

                {/* Message input — LiveTranslationChatInput respects needsTranslation */}
                <div className="flex items-end gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={ACCEPT_ATTR}
                    onChange={handleAttachmentChange}
                    className="hidden"
                  />
                  {/* Camera capture input — opens rear camera on mobile */}
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept={ACCEPT_IMAGES}
                    capture="environment"
                    onChange={handleAttachmentChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={sending || uploadingAttachment}
                    className="w-10 h-10 border border-border rounded-xl flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary transition-colors disabled:opacity-40 shrink-0"
                    aria-label="Attach file"
                    title="Attach image, video, or PDF"
                  >
                    <Icon name="PaperClipIcon" size={17} />
                  </button>
                  {/* Camera button — captures screenshot/photo from mobile camera */}
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    disabled={sending || uploadingAttachment}
                    className="w-10 h-10 border border-primary/30 rounded-xl flex items-center justify-center text-primary hover:bg-primary/10 hover:border-primary transition-colors disabled:opacity-40 shrink-0"
                    aria-label="Capture photo for AI analysis"
                    title="التقاط صورة وتحليلها بالذكاء الاصطناعي"
                  >
                    <Icon name="CameraIcon" size={17} />
                  </button>

                  <div className="flex-1 min-w-0">
                    <LiveTranslationChatInput
                      key={activeConvId || 'no-conv'}
                      translationEnabled={needsTranslation}
                      showLanguageSelector={needsTranslation}
                      showPreview={needsTranslation}
                      disabled={sending || uploadingAttachment || !user}
                      placeholder={M.typeToTranslate}
                      defaultTargetLang={myLang}
                      onSend={(original, translated) => {
                        const outbound =
                          needsTranslation && translated?.trim() && translated.trim() !== original.trim()
                            ? translated.trim()
                            : original.trim();
                        void sendMessage(outbound, pendingAttachment || undefined);
                        setInputText('');
                      }}
                    />
                  </div>

                  {pendingAttachment && (
                    <button
                      type="button"
                      onClick={() => void sendMessage('', pendingAttachment)}
                      disabled={sending || uploadingAttachment || !user}
                      className="w-10 h-10 bg-primary text-primary-foreground rounded-xl flex items-center justify-center active:opacity-80 transition-opacity disabled:opacity-40 shrink-0"
                      aria-label="Send attachment"
                    >
                      {sending || uploadingAttachment ? (
                        <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Icon name="PaperAirplaneIcon" size={17} />
                      )}
                    </button>
                  )}
                </div>

                <p className="text-[10px] text-muted-foreground text-center mt-1.5">
                  {M.chatFooterHints}
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
