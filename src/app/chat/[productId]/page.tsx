'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';
import { SignedChatImage, SignedChatVideo, SignedChatLink } from '@/components/SignedChatMedia';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { sanitizeChatMessage } from '@/lib/privacyShield';
import { useLanguage } from '@/contexts/LanguageContext';
import { needsChatTranslation } from '@/lib/chatTranslationGate';

interface Message {
  id: string;
  sender_id: string;
  sender_role: string;
  message: string;
  attachment_url?: string;
  attachment_type?: string;
  attachment_name?: string;
  created_at: string;
  is_read: boolean;
}

interface Conversation {
  id: string;
  buyer_id: string;
  product_id: string;
  product_name: string;
  supplier_name: string;
  supplier_country: string;
  supplier_flag: string;
  supplier_avatar: string;
}

interface SupplierInquiryProduct {
  id: string;
  supplier_id: string;
  name: string;
  name_ar: string | null;
  sku: string | null;
  unit: string;
  wholesale_price: number;
  currency: string;
  image_url: string | null;
  supplier_name: string;
}

const SUPPLIER_UNIT_AR: Record<string, string> = {
  carton: 'كرتون', bale: 'بالة', bundle: 'بندل', dozen: 'درزن', bag: 'كيس / شوال',
  roll: 'رول', piece: 'قطعة', kg: 'كجم', ton: 'طن',
};

// ─── Translation Types ────────────────────────────────────────────────────────
type SupportedLang = 'ar' | 'en' | 'zh';

interface TranslationCache {
  [msgId: string]: {
    translated: string;
    targetLang: SupportedLang;
  };
}

const LANG_OPTIONS: {value: SupportedLang;label: string;flag: string;}[] = [
{ value: 'ar', label: 'العربية', flag: '🇸🇦' },
{ value: 'en', label: 'English', flag: '🇬🇧' },
{ value: 'zh', label: '中文', flag: '🇨🇳' }];


const supplierMap: Record<string, {name: string;nameAr: string;country: string;flag: string;product: string;avatar: string;online: boolean;}> = {
  p1: { name: 'Zhongshan Heavy Equipment Co.', nameAr: 'شركة تشونغشان للمعدات الثقيلة', country: 'China', flag: '🇨🇳', product: 'Industrial Hydraulic Pump', avatar: "https://img.rocket.new/generatedImages/rocket_gen_img_17e7186a1-1788189546912.png", online: true },
  p2: { name: 'Antalya Textile Mills', nameAr: 'مصانع أنطاليا للنسيج', country: 'Turkey', flag: '🇹🇷', product: 'Premium Cotton Fabric Roll', avatar: "https://img.rocket.new/generatedImages/rocket_gen_img_156beebea-1768074383435.png", online: true },
  p3: { name: 'Shenzhen Solar Tech Ltd.', nameAr: 'شركة شنتشن للطاقة الشمسية', country: 'China', flag: '🇨🇳', product: 'Monocrystalline Solar Panel 400W', avatar: "https://img.rocket.new/generatedImages/rocket_gen_img_1c4c2811d-1785853988457.png", online: false },
  p4: { name: 'Arabian Cement Industries', nameAr: 'الصناعات العربية للإسمنت', country: 'Saudi Arabia', flag: '🇸🇦', product: 'Portland Cement 50kg Bag', avatar: "https://images.unsplash.com/photo-1707125906422-2450317d6b68", online: true },
  p5: { name: 'Jinan Packing Solutions', nameAr: 'حلول التعبئة جينان', country: 'China', flag: '🇨🇳', product: 'Automatic Packaging Machine', avatar: "https://img.rocket.new/generatedImages/rocket_gen_img_1bdaa0712-1766818385102.png", online: false },
  p6: { name: 'Mumbai Steel Exports Pvt.', nameAr: 'شركة مومباي لتصدير الصلب', country: 'India', flag: '🇮🇳', product: 'Stainless Steel Pipe (304 Grade)', avatar: "https://img.rocket.new/generatedImages/rocket_gen_img_140db1042-1769438715946.png", online: true }
};

const defaultSupplier = { name: 'DirectHub Supplier', nameAr: 'مورد دايركت هب', country: 'Global', flag: '🌍', product: 'Product Inquiry', avatar: 'https://img.rocket.new/generatedImages/rocket_gen_img_169fbb1d1-1774273435523.png', online: true };

const quickReplies = [
'What is the MOQ?',
'Can I get a sample?',
'What are the payment terms?',
'Do you offer customization?',
'What is the lead time?'];


const autoReplies = [
'Thank you for your inquiry! I will get back to you with detailed information shortly.',
'Great question! Our team will prepare a detailed quotation for you.',
'We can definitely accommodate your requirements. Let me check with our production team.',
'شكراً على استفسارك! سأعود إليك بمعلومات تفصيلية قريباً.'];


// ── Allowed attachment types (images, videos, PDFs, engineering docs) ─────────
const ALLOWED_ATTACHMENT_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif',
  'video/mp4', 'video/quicktime', 'video/webm',
  'application/pdf',
  // Engineering / technical documents
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
  'application/vnd.ms-excel', // xls
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
  'application/msword', // doc
  'application/octet-stream', // dwg/dxf (CAD files)
  'image/vnd.dxf',
  'image/x-dwg',
];

const ACCEPT_ATTR = [
  'image/jpeg,image/jpg,image/png,image/webp,image/gif,image/heic,image/heif',
  'video/mp4,video/quicktime,video/webm',
  'application/pdf',
  '.xlsx,.xls,.docx,.doc,.dwg,.dxf',
].join(',');

const MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024; // 25MB

function getAttachmentIcon(type?: string, name?: string) {
  if (!type && !name) return 'PaperClipIcon';
  const ext = name?.split('.').pop()?.toLowerCase();
  if (type?.startsWith('image/')) return 'PhotoIcon';
  if (type?.startsWith('video/')) return 'VideoCameraIcon';
  if (type === 'application/pdf') return 'DocumentTextIcon';
  if (ext === 'xlsx' || ext === 'xls' || type?.includes('spreadsheet') || type?.includes('excel')) return 'TableCellsIcon';
  if (ext === 'docx' || ext === 'doc' || type?.includes('word')) return 'DocumentIcon';
  if (ext === 'dwg' || ext === 'dxf') return 'WrenchScrewdriverIcon';
  return 'PaperClipIcon';
}

function getAttachmentLabel(type?: string, name?: string) {
  if (!type && !name) return 'File';
  const ext = name?.split('.').pop()?.toLowerCase();
  if (type?.startsWith('image/')) return 'Image';
  if (type?.startsWith('video/')) return 'Video';
  if (type === 'application/pdf') return 'PDF';
  if (ext === 'xlsx' || ext === 'xls' || type?.includes('spreadsheet') || type?.includes('excel')) return 'Excel';
  if (ext === 'docx' || ext === 'doc' || type?.includes('word')) return 'Word';
  if (ext === 'dwg') return 'CAD Drawing';
  if (ext === 'dxf') return 'DXF Drawing';
  return 'File';
}

// ─── Translation helper ───────────────────────────────────────────────────────
async function translateText(text: string, targetLanguage: SupportedLang): Promise<string> {
  try {
    const res = await fetch('/api/ai/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, targetLanguage })
    });
    const data = await res.json();
    return data.translated || text;
  } catch {
    return text;
  }
}

export default function ChatPage() {
  const { t, dir, isRTL, language } = useLanguage();
  const M = t.messaging;
  const params = useParams();
  const router = useRouter();
  const { user, loading, requireAuth } = useAuth();
  const productId = typeof params?.productId === 'string' ? params.productId : '';
  const supplier = supplierMap[productId] || defaultSupplier;

  const [messages, setMessages] = useState<Message[]>([]);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [inputText, setInputText] = useState('');
  const [loadingChat, setLoadingChat] = useState(true);
  const [sending, setSending] = useState(false);
  const [privacyWarning, setPrivacyWarning] = useState<string | null>(null);
  const [pendingAttachment, setPendingAttachment] = useState<{file: File;previewUrl?: string;} | null>(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connecting');
  /** Counterpart seller_category / factory_type for translation gating */
  const [counterpartSellerCategory, setCounterpartSellerCategory] = useState<string | null>(null);
  const [counterpartFactoryType, setCounterpartFactoryType] = useState<string | null>(null);
  const [counterpartCountry, setCounterpartCountry] = useState<string | null>(supplier.country);
  const [inquiryProduct, setInquiryProduct] = useState<SupplierInquiryProduct | null>(null);

  const needsTranslation = needsChatTranslation({
    sellerCategory: counterpartSellerCategory,
    factoryType: counterpartFactoryType,
    country: counterpartCountry || supplier.country,
  });

  // ── Translation state ───────────────────────────────────────────────────────
  const [myLang, setMyLang] = useState<SupportedLang>('ar');
  const [translationCache, setTranslationCache] = useState<TranslationCache>({});
  const [translatingIds, setTranslatingIds] = useState<Set<string>>(new Set());
  const [showBothIds, setShowBothIds] = useState<Set<string>>(new Set());
  const [autoTranslate, setAutoTranslate] = useState(true);
  const [showLangDropdown, setShowLangDropdown] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const langDropdownRef = useRef<HTMLDivElement>(null);
  const langBtnRef = useRef<HTMLButtonElement>(null);
  const langMenuRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();
  const realtimeChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  // Auto-scroll whenever messages change
  useEffect(() => {
    scrollToBottom('smooth');
  }, [messages, scrollToBottom]);

  // Auth guard — login-on-demand
  useEffect(() => {
    if (!loading && !user) {
      requireAuth(undefined, M.signInReasonSupplier);
    }
  }, [user, loading]);

  // Initialize or fetch conversation
  useEffect(() => {
    if (!user || loading) return;

    const initConversation = async () => {
      setLoadingChat(true);
      try {
        // Resolve product manufacturer + seller_category for translation gating
        let manufacturerId: string | null = null;
        let resolvedCountry = supplier.country;
        let resolvedProductName = supplier.product;
        let resolvedSupplierName = supplier.name;
        let conversationProductId = productId;
        let supplierListing: SupplierInquiryProduct | null = null;
        try {
          const { data: spData } = await supabase.rpc('get_supplier_product_for_inquiry', { p_ref: productId });
          const spRow = (Array.isArray(spData) ? spData[0] : spData) as SupplierInquiryProduct | undefined;
          if (spRow?.id) {
            supplierListing = spRow;
            manufacturerId = spRow.supplier_id;
            conversationProductId = spRow.id;
            resolvedProductName = spRow.name_ar || spRow.name || resolvedProductName;
            resolvedSupplierName = spRow.supplier_name || resolvedSupplierName;
            resolvedCountry = 'اليمن';
          }
        } catch {
          // Not a supplier-listed product — continue with default resolution
        }
        setInquiryProduct(supplierListing);
        try {
          const { data: productData } = supplierListing ? { data: null } : await supabase
            .from('products')
            .select('id, name, manufacturer_id, manufacturer_name, country_of_origin, origin_country')
            .eq('id', productId)
            .maybeSingle();
          if (productData) {
            manufacturerId = productData.manufacturer_id || null;
            resolvedProductName = productData.name || resolvedProductName;
            resolvedSupplierName = productData.manufacturer_name || resolvedSupplierName;
            resolvedCountry =
              productData.country_of_origin ||
              productData.origin_country ||
              resolvedCountry;
          }
        } catch {
          // Demo product ids may not exist in DB
        }

        let sellerCategory: string | null = null;
        let factoryType: string | null = null;
        if (manufacturerId) {
          try {
            const [{ data: mfrProfile }, { data: registrationData }] = await Promise.all([
              supabase
                .from('user_profiles')
                .select('seller_category, country')
                .eq('id', manufacturerId)
                .maybeSingle(),
              supabase
                .from('factory_registrations')
                .select('factory_type, seller_category')
                .eq('user_id', manufacturerId)
                .maybeSingle(),
            ]);
            sellerCategory =
              mfrProfile?.seller_category ||
              (registrationData as { seller_category?: string } | null)?.seller_category ||
              null;
            factoryType =
              (registrationData as { factory_type?: string } | null)?.factory_type || null;
            if (mfrProfile?.country) resolvedCountry = mfrProfile.country;
          } catch {
            // Country-only fallback still works
          }
        }
        setCounterpartSellerCategory(sellerCategory);
        setCounterpartFactoryType(factoryType);
        setCounterpartCountry(resolvedCountry);

        let { data: existing } = await supabase.
        from('chat_conversations').
        select('*').
        eq('buyer_id', user.id).
        eq('product_id', conversationProductId).
        maybeSingle();

        if (!existing) {
          const { data: created, error } = await supabase.
          from('chat_conversations').
          insert({
            buyer_id: user.id,
            manufacturer_id: manufacturerId,
            product_id: conversationProductId,
            product_name: resolvedProductName,
            supplier_name: resolvedSupplierName,
            supplier_country: resolvedCountry,
            supplier_flag: supplierListing ? '🏪' : supplier.flag,
            supplier_avatar: supplier.avatar,
            last_message: ''
          }).
          select().
          single();

          if (error) throw error;
          existing = created;

          if (created && supplierListing) {
            const inquiryText = `استفسار عن المنتج: ${resolvedProductName}${supplierListing.sku ? ` (SKU: ${supplierListing.sku})` : ''}`;
            await supabase.from('chat_messages').insert({
              conversation_id: created.id,
              sender_id: user.id,
              sender_role: 'buyer',
              message: inquiryText,
              is_read: false
            });
            await supabase.rpc('notify_supplier_product_inquiry', { p_conversation_id: created.id });
          } else if (created) {
            await supabase.from('chat_messages').insert({
              conversation_id: created.id,
              sender_id: user.id,
              sender_role: 'manufacturer',
              message: `Hello! Thank you for your interest in ${resolvedProductName}. How can I assist you today? مرحباً! كيف يمكنني مساعدتك؟`,
              is_read: false
            });
          }
        } else if (existing.manufacturer_id && !sellerCategory) {
          // Existing conv: still try seller_category if we missed it above
          try {
            const { data: mfrProfile } = await supabase
              .from('user_profiles')
              .select('seller_category, country')
              .eq('id', existing.manufacturer_id)
              .maybeSingle();
            if (mfrProfile?.seller_category) {
              setCounterpartSellerCategory(mfrProfile.seller_category);
            }
            if (mfrProfile?.country) {
              setCounterpartCountry(mfrProfile.country);
            }
          } catch { /* ignore */ }
        } else if (existing.supplier_country) {
          setCounterpartCountry(existing.supplier_country);
        }

        setConversation(existing);

        if (existing) {
          const { data: msgs } = await supabase.
          from('chat_messages').
          select('*').
          eq('conversation_id', existing.id).
          order('created_at', { ascending: true });

          setMessages(msgs || []);

          // Count unread messages from others
          const { count } = await supabase
            .from('chat_messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', existing.id)
            .eq('is_read', false)
            .neq('sender_id', user.id);
          setUnreadCount(count || 0);

          // Mark all as read
          await supabase
            .from('chat_messages')
            .update({ is_read: true })
            .eq('conversation_id', existing.id)
            .neq('sender_id', user.id)
            .eq('is_read', false);
          setUnreadCount(0);
        }
      } catch (err) {
        console.error('Chat init error:', err);
        setMessages([{
          id: 'm0',
          sender_id: 'manufacturer',
          sender_role: 'manufacturer',
          message: `Hello! Thank you for your interest in ${supplier.product}. How can I assist you today?`,
          created_at: new Date().toISOString(),
          is_read: true
        }]);
      } finally {
        setLoadingChat(false);
      }
    };

    initConversation();
  }, [user, loading, productId]);

  // ── Stable Realtime subscription with reconnect logic ──────────────────────
  const subscribeToMessages = useCallback((convId: string) => {
    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current);
      realtimeChannelRef.current = null;
    }

    const channel = supabase
      .channel(`chat-product:${convId}`, {
        config: { broadcast: { ack: true } },
      })
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `conversation_id=eq.${convId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          // Auto-scroll to new message
          setTimeout(() => scrollToBottom('smooth'), 50);
          // Mark as read if from other party
          if (newMsg.sender_id !== user?.id) {
            supabase
              .from('chat_messages')
              .update({ is_read: true })
              .eq('id', newMsg.id)
              .then(() => {});
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnectionStatus('connected');
          if (reconnectTimerRef.current) {
            clearTimeout(reconnectTimerRef.current);
            reconnectTimerRef.current = null;
          }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setConnectionStatus('disconnected');
          // Auto-reconnect after 3 seconds
          reconnectTimerRef.current = setTimeout(() => {
            subscribeToMessages(convId);
          }, 3000);
        } else {
          setConnectionStatus('connecting');
        }
      });

    realtimeChannelRef.current = channel;
  }, [user?.id, scrollToBottom]);

  // Real-time subscription
  useEffect(() => {
    if (!conversation?.id) return;
    subscribeToMessages(conversation.id);
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
        realtimeChannelRef.current = null;
      }
    };
  }, [conversation?.id, subscribeToMessages]);

  // ── Auto-translate incoming messages (international counterparts only) ──────
  useEffect(() => {
    if (!needsTranslation || !autoTranslate || messages.length === 0 || !user) return;
    const untranslated = messages.filter(
      (msg) => msg.sender_role === 'manufacturer' && msg.message && !translationCache[msg.id]
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
    setTranslationCache({});
  }, [myLang]);

  // ── Close lang dropdown on outside click ─────────────────────────────────────
  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      const target = e.target as Node;
      const clickedBtn = langBtnRef.current?.contains(target);
      const clickedMenu = langMenuRef.current?.contains(target);
      if (!clickedBtn && !clickedMenu) {
        setShowLangDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const formatTime = (isoString: string) => {
    try {
      return new Date(isoString).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } catch {return '';}
  };

  // ── Attachment handler ──────────────────────────────────────────────────────
  const handleAttachmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Accept by MIME type or by file extension for CAD files
    const ext = file.name.split('.').pop()?.toLowerCase();
    const isAllowedType = ALLOWED_ATTACHMENT_TYPES.includes(file.type) || file.type === 'application/octet-stream';
    const isAllowedExt = ['dwg', 'dxf', 'xlsx', 'xls', 'docx', 'doc'].includes(ext || '');

    if (!isAllowedType && !isAllowedExt) {
      setPrivacyWarning('Unsupported file type. Allowed: Images, Videos, PDF, Excel, Word, CAD drawings (DWG/DXF).');
      setTimeout(() => setPrivacyWarning(null), 5000);
      return;
    }

    if (file.size > MAX_ATTACHMENT_SIZE) {
      setPrivacyWarning('File too large. Maximum size is 25MB.');
      setTimeout(() => setPrivacyWarning(null), 5000);
      return;
    }

    const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined;
    setPendingAttachment({ file, previewUrl });
  };

  const clearAttachment = () => {
    if (pendingAttachment?.previewUrl) URL.revokeObjectURL(pendingAttachment.previewUrl);
    setPendingAttachment(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Toggle show both (original + translated) ─────────────────────────────────
  const toggleShowBoth = (msgId: string) => {
    setShowBothIds((prev) => {
      const next = new Set(prev);
      if (next.has(msgId)) next.delete(msgId);else
      next.add(msgId);
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

  // ── Send message (with optional attachment) ─────────────────────────────────
  const sendMessage = async (text: string, attachment?: {file: File;previewUrl?: string;}) => {
    if (!text.trim() && !attachment) return;
    if (sending || !user) return;

    // Privacy Shield — only check text content
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

    const optimisticId = `opt-${Date.now()}`;
    const optimisticMsg: Message = {
      id: optimisticId,
      sender_id: user.id,
      sender_role: 'buyer',
      message: text.trim() || (attachment ? `[${getAttachmentLabel(attachment.file.type, attachment.file.name)} attached]` : ''),
      attachment_url: attachment?.previewUrl,
      attachment_type: attachment?.file.type,
      attachment_name: attachment?.file.name,
      created_at: new Date().toISOString(),
      is_read: false
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setInputText('');
    clearAttachment();

    try {
      let attachmentUrl: string | undefined;
      let attachmentType: string | undefined;
      let attachmentName: string | undefined;

      // Upload attachment to Supabase storage if present
      if (attachment) {
        const ext = attachment.file.name.split('.').pop() || 'bin';
        const filePath = `chat-attachments/${user.id}/${Date.now()}.${ext}`;
        const { data: uploadData, error: uploadError } = await supabase.storage.
        from('chat-media').
        upload(filePath, attachment.file, { contentType: attachment.file.type || 'application/octet-stream', upsert: false });

        if (!uploadError && uploadData) {
          // Private bucket: store a "bucket/path" reference; it is signed at render time
          attachmentUrl = `chat-media/${filePath}`;
          attachmentType = attachment.file.type;
          attachmentName = attachment.file.name;
        }
        // If upload fails, still send the text message
      }

      setUploadingAttachment(false);

      if (conversation?.id && user) {
        const { data: inserted, error } = await supabase.
        from('chat_messages').
        insert({
          conversation_id: conversation.id,
          sender_id: user.id,
          sender_role: user.user_metadata?.role || 'buyer',
          message: text.trim() || (attachmentName ? `[${getAttachmentLabel(attachmentType, attachmentName)} attached]` : ''),
          attachment_url: attachmentUrl,
          attachment_type: attachmentType,
          attachment_name: attachmentName,
          is_read: false
        }).
        select().
        single();

        if (!error && inserted) {
          setMessages((prev) => prev.map((m) => m.id === optimisticId ? inserted : m));

          // Auto-reply (demo only — never for real supplier inquiries)
          if (!inquiryProduct) setTimeout(async () => {
            const reply = autoReplies[Math.floor(Math.random() * autoReplies.length)];
            await supabase.from('chat_messages').insert({
              conversation_id: conversation.id,
              sender_id: user.id,
              sender_role: 'manufacturer',
              message: reply,
              is_read: false
            });
          }, 1500);
        }
      } else {
        setTimeout(() => {
          const reply = autoReplies[Math.floor(Math.random() * autoReplies.length)];
          setMessages((prev) => [...prev, {
            id: `auto-${Date.now()}`,
            sender_id: 'manufacturer',
            sender_role: 'manufacturer',
            message: reply,
            created_at: new Date().toISOString(),
            is_read: true
          }]);
        }, 1200);
      }
    } catch (err) {
      console.error('Send message error:', err);
    } finally {
      setSending(false);
      setUploadingAttachment(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(inputText, pendingAttachment || undefined);
  };

  if (loading || loadingChat) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>);

  }

  const isUserMessage = (msg: Message) => {
    if (user && msg.sender_id === user.id && msg.sender_role !== 'manufacturer') return true;
    if (!user && msg.sender_role === 'buyer') return true;
    return false;
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      {/* Chat Header */}
      <div className="bg-card border-b border-border sticky top-[120px] z-30">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link
            href={`/product/${productId}`}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
            aria-label="Back to product">
            
            <Icon name="ArrowLeftIcon" size={20} />
          </Link>

          <div className="relative shrink-0">
            <div className="w-10 h-10 rounded-full overflow-hidden border border-border bg-muted">
              <AppImage src={supplier.avatar} alt={supplier.name} width={40} height={40} className="object-cover w-full h-full" />
            </div>
            {supplier.online &&
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-accent rounded-full border-2 border-card" />
            }
            {/* Unread count badge */}
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 shadow ring-2 ring-white">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground truncate">{supplier.name}</p>
            <div className="flex items-center gap-1.5">
              <p className="text-xs text-muted-foreground truncate">
                {supplier.flag} {supplier.country} · Re: {supplier.product}
              </p>
              {/* Connection status indicator */}
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                connectionStatus === 'connected' ? 'bg-emerald-500' :
                connectionStatus === 'connecting'? 'bg-amber-400 animate-pulse' : 'bg-red-400'
              }`} title={connectionStatus === 'connected' ? 'Live' : connectionStatus === 'connecting' ? 'Connecting...' : 'Reconnecting...'} />
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Language Toggle + Auto-translate in header — international only */}
            {needsTranslation && (
            <div className="flex items-center gap-1.5">
              <div className="flex items-center border border-border rounded-lg overflow-hidden bg-muted">
                {(['en', 'ar', 'zh'] as SupportedLang[]).map((lang, idx) =>
                <button
                  key={lang}
                  onClick={() => setMyLang(lang)}
                  className={`px-2.5 py-1.5 text-[11px] font-bold transition-colors ${
                  myLang === lang ?
                  'bg-primary text-primary-foreground' :
                  'text-muted-foreground hover:text-foreground'} ${
                  idx > 0 ? 'border-l border-border' : ''}`}>

                    {lang.toUpperCase()}
                  </button>
                )}
              </div>
              <button
                onClick={() => setAutoTranslate((v) => !v)}
                title={autoTranslate ? M.disableAutoTranslate : M.enableAutoTranslate}
                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors border ${
                autoTranslate ?
                'bg-blue-500 border-blue-500 text-white' : 'bg-muted border-border text-muted-foreground'}`
                }>

                <span className="text-sm leading-none">🌐</span>
              </button>
            </div>
            )}
            <div className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${supplier.online ? 'bg-accent' : 'bg-muted-foreground'}`} />
              <span className="text-xs font-semibold text-muted-foreground hidden sm:inline">{supplier.online ? 'Online' : 'Offline'}</span>
            </div>
            <Link
              href={`/rfq/${productId}`}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 border border-primary/20 rounded-lg text-xs font-bold text-primary">
              
              <Icon name="DocumentTextIcon" size={13} />
              RFQ
            </Link>
          </div>
        </div>

        {/* Product reference banner */}
        <div className="max-w-3xl mx-auto px-4 pb-2">
          <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 rounded-xl border border-primary/20">
            <Icon name="TagIcon" size={13} className="text-primary shrink-0" />
            <span className="text-xs font-semibold text-primary truncate">Inquiry about: {supplier.product}</span>
            <Link href={`/product/${productId}`} className="ml-auto text-xs font-bold text-primary underline shrink-0">View Product</Link>
          </div>
        </div>
      </div>

      {/* Messages */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-4 pb-48 md:pb-36 overflow-y-auto">
        {inquiryProduct && (
          <div className="mb-3 rounded-2xl border border-cyan-500/40 bg-cyan-500/5 p-3 flex items-center gap-3" dir="rtl">
            <div className="w-16 h-16 rounded-xl overflow-hidden bg-muted border border-border shrink-0">
              <AppImage
                src={inquiryProduct.image_url || '/assets/images/no_image.png'}
                alt={inquiryProduct.name_ar || inquiryProduct.name}
                width={64}
                height={64}
                className="object-cover w-full h-full" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-cyan-600">📌 استفسار عن منتج</p>
              <p className="text-sm font-extrabold text-foreground truncate">{inquiryProduct.name_ar || inquiryProduct.name}</p>
              <p className="text-xs text-muted-foreground" dir="ltr" style={{ textAlign: 'right' }}>
                SKU: {inquiryProduct.sku || '—'}
              </p>
              <p className="text-xs font-bold text-foreground">
                {Number(inquiryProduct.wholesale_price).toLocaleString('en-US')} {inquiryProduct.currency} / {SUPPLIER_UNIT_AR[inquiryProduct.unit] || inquiryProduct.unit}
              </p>
            </div>
          </div>
        )}

        {/* Security Banner — Direct Hub Protection */}
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-3">
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

        <div className="space-y-4">
          {messages.map((msg) => {
            const isUser = isUserMessage(msg);
            const isManufacturer = msg.sender_role === 'manufacturer';
            const cached = translationCache[msg.id];
            const isTranslating = translatingIds.has(msg.id);
            const showBoth = showBothIds.has(msg.id);
            const hasTranslation = !!cached?.translated && cached.translated !== msg.message;

            return (
              <div key={msg.id} className={`flex gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                {!isUser &&
                <div className="w-8 h-8 rounded-full overflow-hidden border border-border bg-muted shrink-0 mt-1">
                    <AppImage src={supplier.avatar} alt={supplier.name} width={32} height={32} className="object-cover w-full h-full" />
                  </div>
                }
                {isUser &&
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0 mt-1">
                    <Icon name="UserCircleIcon" size={18} className="text-primary-foreground" />
                  </div>
                }
                <div className={`max-w-[75%] space-y-1 ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
                  {/* Attachment preview */}
                  {msg.attachment_url && msg.attachment_type?.startsWith('image/') &&
                  <div className="rounded-xl overflow-hidden border border-border max-w-[240px]">
                      <SignedChatImage
                      src={msg.attachment_url}
                      alt={msg.attachment_name || 'Attachment'}
                      className="w-full h-auto object-cover max-h-48" />
                    </div>
                  }
                  {msg.attachment_url && msg.attachment_type?.startsWith('video/') &&
                  <div className="rounded-xl overflow-hidden border border-border max-w-[240px]">
                      <SignedChatVideo src={msg.attachment_url} className="w-full max-h-48" />
                    </div>
                  }
                  {msg.attachment_url && (
                    msg.attachment_type === 'application/pdf' || msg.attachment_type?.includes('spreadsheet') ||
                    msg.attachment_type?.includes('excel') ||
                    msg.attachment_type?.includes('word') ||
                    msg.attachment_type === 'application/octet-stream' ||
                    ['xlsx','xls','docx','doc','dwg','dxf'].includes(msg.attachment_name?.split('.').pop()?.toLowerCase() || '')
                  ) &&
                  <SignedChatLink
                    href={msg.attachment_url}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition-colors ${
                    isUser ?
                    'bg-primary/20 border-primary/30 text-primary-foreground' :
                    'bg-muted border-border text-foreground hover:bg-muted/70'}`
                    }>
                      <Icon name={getAttachmentIcon(msg.attachment_type, msg.attachment_name) as any} size={16} className="shrink-0" />
                      <span className="truncate max-w-[160px]">{msg.attachment_name || 'Document'}</span>
                      <Icon name="ArrowTopRightOnSquareIcon" size={12} className="shrink-0 ml-auto" />
                    </SignedChatLink>
                  }
                  {/* Non-preview attachment (no URL yet / other types) */}
                  {msg.attachment_name && !msg.attachment_url &&
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold ${
                  isUser ? 'bg-primary/20 border-primary/30 text-primary-foreground' : 'bg-muted border-border text-foreground'}`
                  }>
                      <Icon name={getAttachmentIcon(msg.attachment_type, msg.attachment_name) as any} size={14} className="shrink-0" />
                      <span className="truncate max-w-[160px]">{msg.attachment_name}</span>
                    </div>
                  }
                  {/* Text message */}
                  {msg.message &&
                  <div className="space-y-1 w-full">
                      {/* Original message bubble */}
                      <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    isUser ?
                    'bg-primary text-primary-foreground rounded-tr-sm' :
                    'bg-card border border-border text-foreground rounded-tl-sm'}`
                    }>
                        {msg.message}
                      </div>

                      {/* Translation controls (only for manufacturer/received messages, international only) */}
                      {needsTranslation && isManufacturer &&
                    <div className="flex items-center gap-1.5 justify-start">
                          {isTranslating ?
                      <span className="flex items-center gap-1 text-[10px] text-blue-500 font-medium">
                              <div className="w-2.5 h-2.5 border border-blue-400 border-t-transparent rounded-full animate-spin" />
                              {M.translating}
                            </span> :

                      <>
                              {!cached &&
                        <button
                          onClick={() => translateMessage(msg)}
                          className="flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-800 font-semibold transition-colors">
                          
                                  <span>🌐</span>
                                  <span>{M.translate}</span>
                                </button>
                        }
                              {hasTranslation &&
                        <button
                          onClick={() => toggleShowBoth(msg.id)}
                          className="flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-800 font-semibold transition-colors">
                          
                                  <span>{showBoth ? '▲' : '▼'}</span>
                                  <span>{showBoth ? M.hideOriginal : M.showOriginal}</span>
                                </button>
                        }
                            </>
                      }
                        </div>
                    }

                      {/* Translated bubble */}
                      {needsTranslation && isManufacturer && hasTranslation &&
                    <div className="space-y-1">
                          <div className="px-4 py-2.5 rounded-2xl text-sm leading-relaxed bg-blue-50 border border-blue-200 text-blue-900 rounded-tl-sm">
                            <div className="flex items-center gap-1 mb-1">
                              <span className="text-[9px] font-bold text-blue-500 uppercase tracking-wide">
                                {LANG_OPTIONS.find((l) => l.value === myLang)?.flag} {M.translated}
                              </span>
                            </div>
                            {cached.translated}
                          </div>
                          {showBoth &&
                      <div className="px-4 py-2.5 rounded-2xl text-sm leading-relaxed bg-muted/60 border border-border text-muted-foreground rounded-tl-sm">
                              <div className="flex items-center gap-1 mb-1">
                                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide">
                                  📝 {M.original}
                                </span>
                              </div>
                              {msg.message}
                            </div>
                      }
                        </div>
                    }
                    </div>
                  }
                  <span className="text-[10px] text-muted-foreground px-1">{formatTime(msg.created_at)}</span>
                </div>
              </div>);

          })}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Quick Replies + Input */}
      <div className="fixed bottom-16 md:bottom-0 left-0 right-0 z-40 bg-card border-t border-border">
        <div className="max-w-3xl mx-auto px-4 pt-2 pb-2">
          {/* Privacy Warning */}
          {privacyWarning &&
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-2">
              <span className="text-red-500 text-sm shrink-0">🚫</span>
              <p className="text-xs text-red-700 leading-relaxed font-medium">{privacyWarning}</p>
              <button
              onClick={() => setPrivacyWarning(null)}
              className="ml-auto text-red-400 hover:text-red-600 shrink-0"
              aria-label="Dismiss warning">
              
                <Icon name="XMarkIcon" size={14} />
              </button>
            </div>
          }

          {/* Pending attachment preview */}
          {pendingAttachment &&
          <div className="flex items-center gap-2 px-3 py-2 bg-primary/5 border border-primary/20 rounded-xl mb-2">
              {pendingAttachment.previewUrl ?
            <img src={pendingAttachment.previewUrl} alt="Preview" className="w-10 h-10 rounded-lg object-cover shrink-0" /> :

            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon name={getAttachmentIcon(pendingAttachment.file.type, pendingAttachment.file.name) as any} size={18} className="text-primary" />
                </div>
            }
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">{pendingAttachment.file.name}</p>
                <p className="text-[10px] text-muted-foreground">{getAttachmentLabel(pendingAttachment.file.type, pendingAttachment.file.name)} · {(pendingAttachment.file.size / 1024 / 1024).toFixed(1)}MB</p>
              </div>
              <button onClick={clearAttachment} className="text-muted-foreground hover:text-foreground shrink-0">
                <Icon name="XMarkIcon" size={16} />
              </button>
            </div>
          }

          {/* Quick Reply Chips */}
          <div className="flex gap-1.5 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {quickReplies.map((qr) =>
            <button
              key={qr}
              onClick={() => sendMessage(qr)}
              className="shrink-0 px-3 py-1 bg-muted border border-border rounded-full text-xs font-medium text-muted-foreground hover:text-foreground hover:border-primary/40 active:bg-muted/70 transition-colors whitespace-nowrap">
              
                {qr}
              </button>
            )}
          </div>

          {/* Language selector row — above input (international only) */}
          {needsTranslation && (
          <div className="flex items-center justify-between mb-2">
            {/* Language dropdown button with flag */}
            <div className="relative" ref={langDropdownRef}>
              <button
                ref={langBtnRef}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowLangDropdown((v) => !v);
                }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-50 border border-blue-200 rounded-xl text-xs font-bold text-blue-700 hover:bg-blue-100 transition-colors"
              >
                <span className="text-sm">{LANG_OPTIONS.find(l => l.value === myLang)?.flag}</span>
                <span>{myLang.toUpperCase()}</span>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={`w-3 h-3 text-blue-500 transition-transform ${showLangDropdown ? 'rotate-180' : ''}`}>
                  <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                </svg>
              </button>
              {showLangDropdown && (
                <div
                  ref={langMenuRef}
                  className="absolute bottom-full mb-2 left-0 bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden min-w-[160px]"
                  style={{ zIndex: 9999 }}
                >
                  <div className="px-3 py-2 border-b border-gray-100 bg-gray-50">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">{M.translateTo}</p>
                  </div>
                  {LANG_OPTIONS.map((lang) => (
                    <button
                      key={lang.value}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMyLang(lang.value);
                        setTranslationCache({});
                        setShowLangDropdown(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-colors hover:bg-gray-50 ${myLang === lang.value ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-800'}`}
                    >
                      <span className="text-base">{lang.flag}</span>
                      <div className="text-left">
                        <p className="text-xs font-semibold leading-none">{lang.label}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{lang.value.toUpperCase()}</p>
                      </div>
                      {myLang === lang.value && (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 ml-auto text-blue-600">
                          <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* Auto-translate toggle */}
            <button
              type="button"
              onClick={() => setAutoTranslate((v) => !v)}
              className={`flex items-center gap-1.5 text-xs font-semibold transition-colors ${autoTranslate ? 'text-blue-600' : 'text-muted-foreground'}`}
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

          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            {/* Hidden file input — supports images, PDFs, engineering docs */}
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT_ATTR}
              onChange={handleAttachmentChange}
              className="hidden" />
            
            {/* Attachment button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={sending || uploadingAttachment}
              className="w-10 h-10 border border-border rounded-2xl flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary transition-colors disabled:opacity-40 shrink-0"
              aria-label="Attach file"
              title="Attach image, video, PDF, Excel, Word, or CAD drawing (DWG/DXF)">
              
              <Icon name="PaperClipIcon" size={18} />
            </button>

            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={M.typeYourMessage}
              className="flex-1 px-4 py-2.5 bg-background border border-border rounded-2xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
              aria-label="Chat message input"
              dir="auto" />
            

            <button
              type="submit"
              disabled={(!inputText.trim() && !pendingAttachment) || sending}
              className="w-10 h-10 bg-primary text-primary-foreground rounded-2xl flex items-center justify-center active:opacity-80 transition-opacity disabled:opacity-40 shrink-0"
              aria-label="Send message">
              
              {sending || uploadingAttachment ?
              <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" /> :

              <Icon name="PaperAirplaneIcon" size={18} />
              }
            </button>
          </form>
        </div>
      </div>

      <BottomNav />
    </div>);

}