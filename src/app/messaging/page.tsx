'use client';

import React, { useState, useRef, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import AppImage from '@/components/ui/AppImage';

import ChatAttachmentView from '@/components/ChatAttachmentView';
import { getChatMediaSignedUrl } from '@/lib/chatMedia';
import Icon from '@/components/ui/AppIcon';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { sanitizeChatMessage } from '@/lib/privacyShield';
import { useLanguage } from '@/contexts/LanguageContext';
import { resolveFileType, extensionForType, fileWithResolvedType } from '@/lib/attachmentTypes';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Conversation {
  id: string;
  source: 'chat' | 'logistics';
  category: 'factory' | 'logistics' | 'admin' | 'agent';
  buyer_id: string;
  manufacturer_id: string | null;
  partner_id?: string | null;
  product_id?: string | null;
  product_name?: string | null;
  supplier_name?: string | null;
  supplier_country?: string | null;
  supplier_flag?: string | null;
  supplier_avatar?: string | null;
  last_message?: string | null;
  last_message_at?: string | null;
  unread_count?: number;
  thread_type?: 'negotiation' | 'rfq' | 'order' | 'logistics' | 'admin' | 'agent';
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
  local_audio_url?: string;
  audio_duration?: number;
}

type SupportedLang = 'ar' | 'en' | 'zh' | 'tr';

const LANG_OPTIONS: { value: SupportedLang; label: string; flag: string; nativeName: string }[] = [
  { value: 'en', label: 'English', flag: '🇬🇧', nativeName: 'English' },
  { value: 'zh', label: 'Chinese', flag: '🇨🇳', nativeName: '中文' },
  { value: 'tr', label: 'Turkish', flag: '🇹🇷', nativeName: 'Türkçe' },
  { value: 'ar', label: 'Arabic', flag: '🇸🇦', nativeName: 'العربية' },
];

const THREAD_LABELS: Record<string, { color: string; labelAr: string; labelEn: string }> = {
  negotiation: { color: 'bg-blue-500/10 text-blue-600 border-blue-500/20', labelAr: 'تفاوض مصنع', labelEn: 'Factory Negotiation' },
  rfq: { color: 'bg-amber-500/10 text-amber-600 border-amber-500/20', labelAr: 'طلب تسعير RFQ', labelEn: 'RFQ Quote' },
  order: { color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20', labelAr: 'طلب شراء', labelEn: 'Purchase Order' },
  logistics: { color: 'bg-purple-500/10 text-purple-600 border-purple-500/20', labelAr: 'شحن وتخليص', labelEn: 'Logistics' },
  admin: { color: 'bg-red-500/10 text-red-600 border-red-500/20', labelAr: 'إدارة المنصة', labelEn: 'Platform Admin' },
  agent: { color: 'bg-teal-500/10 text-teal-600 border-teal-500/20', labelAr: 'إشراف ميداني', labelEn: 'Field Supervision' },
};

const ALLOWED_TYPES = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
  'image/heic', 'image/heif', 'application/pdf',
];
const ACCEPT_ATTR = 'image/*,application/pdf';
const MAX_SIZE = 25 * 1024 * 1024;

const FACTORY_QUICK_REPLIES = [
  'ما هو الحد الأدنى للطلب (MOQ)؟',
  'هل يمكن توفير عينة فحص قبل الاعتماد؟',
  'ما هي شروط الدفع والضمان المالي؟',
  'ما هو وقت التجهيز والشحن المتوقع؟',
  'هل تقدمون أسعاراً خاصة للكميات الكبيرة؟',
];

const ADMIN_QUICK_REPLIES = [
  'طلب مراجعة واعتماد رخصة المتجر/المستودع',
  'استفسار بخصوص الضمان المالي والحساب البنكي',
  'طلب ربط أو استبدال المندوب الميداني المشرف',
  'الإبلاغ عن نزاع تجاري أو مشكلة في استلام طلبية',
  'استفسار عن اشتراكات وباقات الموردين المعتمدين',
];

const AGENT_QUICK_REPLIES = [
  'مرحباً، متى موعد الزيارة الميدانية لمطابقة المخزون؟',
  'أرغب في فحص وتوثيق شحنة جديدة وصلت المستودع',
  'تم رفع المستندات الرسمية، يرجى فحصها واعتمادها',
  'استفسار بخصوص تقرير الجودة وتوثيق المنتجات',
];

function formatTime(iso: string, isAr: boolean) {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
    const locale = isAr ? 'ar-SA' : 'en-US';
    if (diffDays === 0) return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
    if (diffDays === 1) return isAr ? 'أمس' : 'Yesterday';
    return d.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
  } catch { return ''; }
}

function parseBilingualMessage(raw: string) {
  try {
    const data = JSON.parse(raw);
    if (data.type === 'bilingual') {
      return { isBilingual: true, original: data.original, translated: data.translated, lang: data.translatedLang };
    }
  } catch { /* plain text */ }
  return { isBilingual: false, original: raw, translated: '', lang: '' };
}

// ─── Main Component ───────────────────────────────────────────────────────────
function LiveMessagingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const supabase = createClient();
  const { language, dir, isRTL } = useLanguage();
  const isAr = language === 'ar';

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [sending, setSending] = useState(false);
  const [privacyWarning, setPrivacyWarning] = useState<string | null>(null);
  const [pendingAttachment, setPendingAttachment] = useState<{ file: File; previewUrl?: string; type: string } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  type FilterType = 'all' | 'admin' | 'agent' | 'factory' | 'logistics' | 'rfq' | 'order';
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // أدوات الترجمة الفورية
  const [liveTranslation, setLiveTranslation] = useState('');
  const [liveTranslationLang, setLiveTranslationLang] = useState<SupportedLang>('en');
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);

  // التسجيل الصوتي
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const activeConv = conversations.find(c => c.id === activeConvId) || null;

  useEffect(() => {
    if (authLoading) return;
    if (!user) router.push('/login');
  }, [user, authLoading, router]);

  // ── جلب المحادثات الموحدة والربط المباشر بطلب الإدارة أو المندوب ─────────────
  const fetchConversations = useCallback(async () => {
    if (!user) return;
    setLoadingConvs(true);
    try {
      const channelParam = searchParams?.get('channel');
      const typeParam = searchParams?.get('type');
      const partnerIdParam = searchParams?.get('partnerId');

      // 1. محادثات جدول chat_conversations
      const { data: chatData } = await supabase
        .from('chat_conversations')
        .select('*')
        .or(`buyer_id.eq.${user.id},manufacturer_id.eq.${user.id}`)
        .order('last_message_at', { ascending: false });

      // 2. محادثات مكاتب الشحن
      let logisticsData: any[] = [];
      try {
        const { data: logData } = await supabase
          .from('logistics_conversations')
          .select('*, logistics_partners(company_name, country, city)')
          .eq('buyer_id', user.id)
          .order('last_message_at', { ascending: false });
        if (logData) logisticsData = logData;
      } catch (e) {
        console.warn('Logistics fetch:', e);
      }

      // تصنيف المحادثات بذكاء (إدارة / مندوب / مصنع)
      const mappedChatConvs: Conversation[] = (chatData || []).map(c => {
        const isAdm =
          c.product_name?.includes('الإدارة') ||
          c.supplier_flag === '🛡️' ||
          c.supplier_name?.includes('إدارة');

        const isAgnt =
          c.product_name?.includes('ميداني') ||
          c.supplier_flag === '👷' ||
          c.supplier_name?.includes('مندوب');

        let category: Conversation['category'] = 'factory';
        let thread_type: Conversation['thread_type'] = 'negotiation';

        if (isAdm) {
          category = 'admin';
          thread_type = 'admin';
        } else if (isAgnt) {
          category = 'agent';
          thread_type = 'agent';
        } else if ((c.product_name || '').toLowerCase().includes('rfq')) {
          thread_type = 'rfq';
        }

        return {
          ...c,
          source: 'chat',
          category,
          unread_count: 0,
          thread_type,
        };
      });

      const shippingConvs: Conversation[] = logisticsData.map(lc => ({
        id: lc.id,
        source: 'logistics',
        category: 'logistics',
        buyer_id: lc.buyer_id,
        manufacturer_id: null,
        partner_id: lc.partner_id,
        product_id: '',
        product_name: lc.logistics_partners ? `مكتب شحن وتخليص — ${lc.logistics_partners.city || ''}` : 'شريك لوجستي',
        supplier_name: lc.logistics_partners?.company_name || 'مكتب شحن معتمد',
        supplier_country: lc.logistics_partners?.country || '',
        supplier_flag: '🚢',
        supplier_avatar: null,
        last_message: lc.last_message || 'استفسار عن الشحن والتخليص',
        last_message_at: lc.last_message_at || lc.created_at,
        unread_count: lc.buyer_unread || 0,
        thread_type: 'logistics',
      }));

      let merged = [...mappedChatConvs, ...shippingConvs].sort(
        (a, b) => new Date(b.last_message_at || 0).getTime() - new Date(a.last_message_at || 0).getTime()
      );

      // ── معالجة الربط الفوري مع الإدارة عند النقر على الزر ──
      if (channelParam === 'admin_direct') {
        let adminConv = merged.find(c => c.category === 'admin');

        if (!adminConv) {
          // جلب حساب الإدارة أو أول مشرف
          const { data: adminProf } = await supabase
            .from('user_profiles')
            .select('id, full_name, avatar_url')
            .eq('role', 'admin')
            .limit(1)
            .maybeSingle();

          const targetAdminId = adminProf?.id;

          if (targetAdminId) {
            const insertPayload: Record<string, any> = {
              buyer_id: user.id,
              manufacturer_id: targetAdminId,
              product_name: 'الدعم الفني والإدارة العامة',
              supplier_name: 'إدارة منصة دايركت هب',
              supplier_flag: '🛡️',
              supplier_avatar: adminProf?.avatar_url || null,
              last_message: 'مرحباً بك! تواصل مباشرة مع الإدارة العامة هنا.',
              last_message_at: new Date().toISOString(),
            };

            const { data: created, error: createErr } = await supabase
              .from('chat_conversations')
              .insert(insertPayload)
              .select()
              .single();

            if (!createErr && created) {
              adminConv = {
                ...created,
                source: 'chat',
                category: 'admin',
                thread_type: 'admin',
              };
              merged = [adminConv!, ...merged];
            }
          }
        }

        if (adminConv) {
          setActiveConvId(adminConv.id);
          if (typeof window !== 'undefined' && window.innerWidth < 768) setSidebarOpen(false);
        }
      }

      // ── معالجة الربط الفوري مع المندوب الميداني ──
      else if (typeParam === 'agent_coordination' && partnerIdParam) {
        let agentConv = merged.find(c => c.manufacturer_id === partnerIdParam || c.buyer_id === partnerIdParam);

        if (!agentConv) {
          const { data: agentProf } = await supabase
            .from('user_profiles')
            .select('id, full_name, avatar_url')
            .eq('id', partnerIdParam)
            .maybeSingle();

          const insertPayload: Record<string, any> = {
            buyer_id: user.id,
            manufacturer_id: partnerIdParam,
            product_name: 'التنسيق والإشراف الميداني',
            supplier_name: agentProf?.full_name || decodeURIComponent(searchParams?.get('partnerName') || 'المندوب الميداني المشرف'),
            supplier_flag: '👷',
            supplier_avatar: agentProf?.avatar_url || null,
            last_message: 'بدء التنسيق الميداني وفحص المستودع والمنتجات.',
            last_message_at: new Date().toISOString(),
          };

          const { data: created } = await supabase
            .from('chat_conversations')
            .insert(insertPayload)
            .select()
            .single();

          if (created) {
            agentConv = {
              ...created,
              source: 'chat',
              category: 'agent',
              thread_type: 'agent',
            };
            merged = [agentConv, ...merged];
          }
        }

        if (agentConv) {
          setActiveConvId(agentConv.id);
          if (typeof window !== 'undefined' && window.innerWidth < 768) setSidebarOpen(false);
        }
      }

      // اختيار المحادثة المستهدفة بالمعرف
      const explicitId = searchParams?.get('conversationId') || searchParams?.get('id') || searchParams?.get('conv');
      if (explicitId && merged.some(c => c.id === explicitId)) {
        setActiveConvId(explicitId);
        if (typeof window !== 'undefined' && window.innerWidth < 768) setSidebarOpen(false);
      } else if (merged.length > 0 && !activeConvId && !channelParam && !typeParam) {
        setActiveConvId(merged[0].id);
      }

      setConversations(merged);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingConvs(false);
    }
  }, [user, supabase, searchParams, activeConvId]);

  useEffect(() => {
    if (user && !authLoading) fetchConversations();
  }, [user, authLoading, fetchConversations]);

  // ── جلب رسائل المحادثة النشطة ──────────────────────────────────────────────
  useEffect(() => {
    if (!activeConvId || !user || !activeConv) return;
    const fetchMsgs = async () => {
      setLoadingMsgs(true);
      try {
        if (activeConv.source === 'logistics') {
          const { data } = await supabase
            .from('logistics_messages')
            .select('*')
            .eq('conversation_id', activeConvId)
            .order('created_at', { ascending: true });

          setMessages((data || []).map((m: any) => ({
            id: m.id,
            conversation_id: m.conversation_id,
            sender_id: m.sender_id,
            sender_role: m.sender_role || 'buyer',
            message: m.content || m.message || '',
            attachment_url: m.attachment_url,
            attachment_type: m.attachment_type,
            attachment_name: m.attachment_name,
            is_read: true,
            created_at: m.created_at,
          })));
        } else {
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
            .neq('sender_id', user.id);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingMsgs(false);
      }
    };
    fetchMsgs();
  }, [activeConvId, activeConv, user, supabase]);

  // اشتراك Realtime
  useEffect(() => {
    if (!activeConvId || !user || !activeConv) return;
    const table = activeConv.source === 'logistics' ? 'logistics_messages' : 'chat_messages';

    const ch = supabase
      .channel(`chat-feed-${activeConvId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table, filter: `conversation_id=eq.${activeConvId}` }, (p) => {
        const row: any = p.new;
        const msg: Message = {
          id: row.id,
          conversation_id: row.conversation_id,
          sender_id: row.sender_id,
          sender_role: row.sender_role || 'buyer',
          message: row.content || row.message || '',
          attachment_url: row.attachment_url,
          attachment_type: row.attachment_type,
          attachment_name: row.attachment_name,
          is_read: true,
          created_at: row.created_at,
        };
        setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
      })
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [activeConvId, activeConv, user, supabase]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // الترجمة الحية أثناء الكتابة
  useEffect(() => {
    const text = inputText.trim();
    if (!text || text.length < 2) {
      setLiveTranslation('');
      setIsTranslating(false);
      return;
    }
    const timer = setTimeout(async () => {
      setIsTranslating(true);
      try {
        const res = await fetch('/api/ai/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, targetLanguage: liveTranslationLang }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.translated && data.translated !== text) {
            setLiveTranslation(data.translated);
          }
        }
      } catch (e) {
        console.warn(e);
      } finally {
        setIsTranslating(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [inputText, liveTranslationLang]);

  // معالجة المرفقات
  const handleAttachment = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const resolvedType = resolveFileType(file, ALLOWED_TYPES);
    if (!resolvedType) {
      setPrivacyWarning('الملف غير مدعوم، يرجى رفع صور أو PDF.');
      setTimeout(() => setPrivacyWarning(null), 4000);
      return;
    }
    if (file.size > MAX_SIZE) {
      setPrivacyWarning('حجم الملف كبير جداً (الحد الأقصى 25MB).');
      setTimeout(() => setPrivacyWarning(null), 4000);
      return;
    }
    setPendingAttachment({
      file,
      type: resolvedType,
      previewUrl: resolvedType.startsWith('image/') ? URL.createObjectURL(file) : undefined,
    });
  };

  // التسجيل الصوتي
  const handleToggleRecord = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const file = new File([blob], `voice-${Date.now()}.webm`, { type: 'audio/webm' });
        handleSendVoice(file);
      };
      mr.start();
      setIsRecording(true);
    } catch {
      setPrivacyWarning('يرجى السماح بالوصول للمايكروفون.');
      setTimeout(() => setPrivacyWarning(null), 4000);
    }
  };

  const handleSendVoice = async (file: File) => {
    if (!activeConvId || !user) return;
    try {
      const path = `chat-media/${user.id}/${Date.now()}.webm`;
      await supabase.storage.from('chat-media').upload(path, file);
      const audioUrl = `chat-media/${path}`;
      const payload = {
        conversation_id: activeConvId,
        sender_id: user.id,
        sender_role: 'user',
        message: '🎙️ رسالة صوتية',
        attachment_url: audioUrl,
        attachment_type: 'audio/webm',
        is_read: false,
      };
      if (activeConv?.source === 'logistics') {
        await supabase.from('logistics_messages').insert({ ...payload, content: '🎙️ رسالة صوتية' });
      } else {
        await supabase.from('chat_messages').insert(payload);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // إرسال الرسالة
  const handleSend = async () => {
    if (!inputText.trim() && !pendingAttachment) return;
    if (sending || !activeConvId || !user || !activeConv) return;

    const shield = sanitizeChatMessage(inputText.trim());
    if (shield.blocked) {
      setPrivacyWarning(shield.reason || 'تم حجب الرسالة لحماية البيانات.');
      setTimeout(() => setPrivacyWarning(null), 5000);
      return;
    }

    setSending(true);
    const textToSend = inputText.trim();
    const hasLiveTrans = !!liveTranslation && liveTranslation.trim() !== textToSend;

    const messageBody = hasLiveTrans
      ? JSON.stringify({
          type: 'bilingual',
          original: textToSend,
          translated: liveTranslation.trim(),
          translatedLang: liveTranslationLang,
        })
      : textToSend;

    let attachmentUrl = undefined;
    if (pendingAttachment) {
      const ext = extensionForType(pendingAttachment.type);
      const filePath = `chat-attachments/${user.id}/${Date.now()}.${ext}`;
      await supabase.storage.from('chat-media').upload(
        filePath,
        fileWithResolvedType(pendingAttachment.file, pendingAttachment.type)
      );
      attachmentUrl = `chat-media/${filePath}`;
    }

    const optimisticId = `opt-${Date.now()}`;
    const optMsg: Message = {
      id: optimisticId,
      conversation_id: activeConvId,
      sender_id: user.id,
      sender_role: 'user',
      message: messageBody,
      created_at: new Date().toISOString(),
      is_read: false,
      attachment_url: pendingAttachment?.previewUrl || attachmentUrl,
      attachment_type: pendingAttachment?.type,
      attachment_name: pendingAttachment?.file.name,
    };
    setMessages(prev => [...prev, optMsg]);
    setInputText('');
    setLiveTranslation('');
    setPendingAttachment(null);

    try {
      if (activeConv.source === 'logistics') {
        await supabase.from('logistics_messages').insert({
          conversation_id: activeConvId,
          sender_id: user.id,
          sender_role: 'user',
          content: messageBody,
          attachment_url: attachmentUrl,
        });
        await supabase.from('logistics_conversations').update({
          last_message: textToSend || 'مرفق جديد',
          last_message_at: new Date().toISOString(),
          partner_unread: 1,
        }).eq('id', activeConvId);
      } else {
        await supabase.from('chat_messages').insert({
          conversation_id: activeConvId,
          sender_id: user.id,
          sender_role: 'user',
          message: messageBody,
          is_read: false,
          attachment_url: attachmentUrl,
          attachment_type: pendingAttachment?.type,
          attachment_name: pendingAttachment?.file.name,
        });
        await supabase.from('chat_conversations').update({
          last_message: textToSend || 'مرفق جديد',
          last_message_at: new Date().toISOString(),
        }).eq('id', activeConvId);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSending(false);
    }
  };

  const filteredConvs = conversations.filter(c => {
    if (filterType === 'admin' && c.category !== 'admin') return false;
    if (filterType === 'agent' && c.category !== 'agent') return false;
    if (filterType === 'factory' && c.category !== 'factory') return false;
    if (filterType === 'logistics' && c.category !== 'logistics') return false;
    if (filterType === 'rfq' && c.thread_type !== 'rfq') return false;
    if (filterType === 'order' && c.thread_type !== 'order') return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (c.supplier_name || '').toLowerCase().includes(q) || (c.product_name || '').toLowerCase().includes(q);
    }
    return true;
  });

  const currentQuickReplies =
    activeConv?.category === 'admin'
      ? ADMIN_QUICK_REPLIES
      : activeConv?.category === 'agent'
      ? AGENT_QUICK_REPLIES
      : FACTORY_QUICK_REPLIES;

  return (
    <div className="bg-background flex flex-col overflow-hidden min-w-0" dir={dir} style={{ height: '100dvh', maxHeight: '100dvh' }}>
      <Header />

      <div className="flex-1 flex overflow-hidden min-w-0">
        {/* ══ القائمة الجانبية الموحدة ═══════════════════════════════════════ */}
        <div className={`${sidebarOpen ? 'flex' : 'hidden'} md:flex flex-col w-full md:w-[350px] lg:w-[390px] md:shrink-0 bg-card border-l border-border overflow-hidden`}>
          <div className="p-3 border-b border-border bg-card space-y-2">
            <div className="flex items-center justify-between">
              <h1 className="text-base font-bold text-foreground flex items-center gap-2">
                <Icon name="ChatBubbleLeftRightIcon" size={18} className="text-primary" />
                {isAr ? 'صندوق المحادثات الموحد' : 'Unified Inbox'}
              </h1>
              <span className="text-xs bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-full">
                {conversations.length} {isAr ? 'محادثة' : 'threads'}
              </span>
            </div>

            <div className="relative">
              <Icon name="MagnifyingGlassIcon" size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={isAr ? 'بحث عن مصنع، إدارة، مندوب، شركة شحن...' : 'Search inbox...'}
                className="w-full h-9 pr-9 pl-3 rounded-xl border border-border bg-background text-foreground text-xs focus:outline-none focus:border-primary"
              />
            </div>

            <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
              {[
                { id: 'all', label: isAr ? 'الكل' : 'All' },
                { id: 'admin', label: isAr ? '🛡️ الإدارة' : '🛡️ Admin' },
                { id: 'agent', label: isAr ? '👷 مندوبين' : '👷 Agents' },
                { id: 'factory', label: isAr ? '🏭 مصانع' : '🏭 Factories' },
                { id: 'logistics', label: isAr ? '🚢 شحن' : '🚢 Shipping' },
                { id: 'rfq', label: isAr ? '📑 RFQ' : '📑 RFQ' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setFilterType(tab.id as FilterType)}
                  className={`shrink-0 py-1 px-2.5 text-xs font-semibold rounded-lg transition-all ${
                    filterType === tab.id ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loadingConvs ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filteredConvs.length === 0 ? (
              <div className="text-center py-16 px-4">
                <Icon name="ChatBubbleLeftRightIcon" size={32} className="text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">{isAr ? 'لا توجد محادثات هنا' : 'No conversations found'}</p>
              </div>
            ) : (
              filteredConvs.map(conv => {
                const isActive = conv.id === activeConvId;
                const threadInfo = THREAD_LABELS[conv.thread_type || 'negotiation'];
                return (
                  <button
                    key={conv.id}
                    onClick={() => {
                      setActiveConvId(conv.id);
                      if (typeof window !== 'undefined' && window.innerWidth < 768) setSidebarOpen(false);
                    }}
                    className={`w-full text-right px-3 py-3 border-b border-border/60 transition-colors flex items-start gap-2.5 relative ${
                      isActive ? 'bg-primary/5 border-r-[3px] border-r-primary' : 'hover:bg-muted/40'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold bg-gradient-to-br from-slate-700 to-slate-900 border border-border shrink-0">
                      {conv.supplier_flag || '🏢'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <p className="text-xs font-bold text-foreground truncate flex-1">{conv.supplier_name}</p>
                        <span className="text-[10px] text-muted-foreground shrink-0 ms-1">{formatTime(conv.last_message_at || '', isAr)}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate mb-1">{conv.product_name}</p>
                      <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full border ${threadInfo?.color}`}>
                        {isAr ? threadInfo?.labelAr : threadInfo?.labelEn}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ══ شاشة الشات الموحدة الكاملة ════════════════════════════════════ */}
        <div className={`${sidebarOpen ? 'hidden md:flex' : 'flex'} flex-1 flex-col bg-background min-w-0 border-r border-border overflow-hidden`}>
          {!activeConv ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-muted/20">
              <Icon name="ChatBubbleLeftRightIcon" size={36} className="text-primary mb-2" />
              <h2 className="text-base font-bold text-foreground">{isAr ? 'اختر محادثة لبدء المراسلة والتفاوض' : 'Select a conversation'}</h2>
            </div>
          ) : (
            <>
              {/* ── ترويسة الشات التفاعلية ── */}
              <div className="px-4 py-3 border-b border-border bg-card flex items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => setSidebarOpen(true)}
                    className="md:hidden w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center shrink-0"
                    aria-label="العودة لقائمة المحادثات"
                  >
                    <Icon name="ArrowRightIcon" size={17} className={isRTL ? '' : 'rotate-180'} />
                  </button>

                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold shrink-0">
                      {activeConv.supplier_flag || '🏢'}
                    </div>

                    <div className="flex-1 min-w-0 text-start">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-foreground truncate">
                          {activeConv.supplier_name}
                        </p>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${THREAD_LABELS[activeConv.thread_type || 'negotiation']?.color}`}>
                          {isAr ? THREAD_LABELS[activeConv.thread_type || 'negotiation']?.labelAr : THREAD_LABELS[activeConv.thread_type || 'negotiation']?.labelEn}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {activeConv.product_name}
                      </p>
                    </div>
                  </div>
                </div>

                {/* زر متجر المصنع يظهر فقط لمحادثات المصانع */}
                {activeConv.category === 'factory' && (
                  <Link
                    href={`/storefront/${activeConv.manufacturer_id || activeConv.buyer_id}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-muted hover:bg-primary/10 hover:text-primary border border-border rounded-xl text-xs font-semibold text-foreground transition-all shrink-0"
                  >
                    <Icon name="BuildingStorefrontIcon" size={15} className="text-primary" />
                    <span className="hidden sm:inline">{isAr ? 'متجر المصنع' : 'Store'}</span>
                  </Link>
                )}
              </div>

              {/* فقاعات الرسائل */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-muted/10">
                {messages.map(msg => {
                  const isOwn = msg.sender_id === user?.id;
                  const parsed = parseBilingualMessage(msg.message);

                  return (
                    <div key={msg.id} className={`flex ${isOwn ? 'justify-start' : 'justify-end'} gap-2`}>
                      <div className={`max-w-[80%] rounded-2xl p-3 shadow-xs ${
                        isOwn ? 'bg-primary text-primary-foreground rounded-tr-xs' : 'bg-card border border-border text-foreground rounded-tl-xs'
                      }`}>
                        {msg.attachment_url && (
                          <div className="mb-2">
                            <ChatAttachmentView url={msg.attachment_url} name={msg.attachment_name || 'ملف مرفق'} type={msg.attachment_type} />
                          </div>
                        )}

                        {parsed.isBilingual ? (
                          <div className="space-y-1.5">
                            <p className="text-sm leading-relaxed">{parsed.original}</p>
                            <div className="pt-1.5 border-t border-white/20 text-xs opacity-90 flex items-center gap-1.5">
                              <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded font-bold">مترجم تلقائياً</span>
                              <span>{parsed.translated}</span>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                        )}

                        <span className={`text-[10px] block mt-1 ${isOwn ? 'text-primary-foreground/70 text-start' : 'text-muted-foreground text-end'}`}>
                          {formatTime(msg.created_at, isAr)}
                        </span>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* شريط الردود السريعة المتغير حسب نوع المحادثة */}
              <div className="px-3 py-1.5 border-t border-border bg-card flex gap-1.5 overflow-x-auto shrink-0" style={{ scrollbarWidth: 'none' }}>
                {currentQuickReplies.map(qr => (
                  <button key={qr} onClick={() => setInputText(qr)} className="shrink-0 px-2.5 py-1 bg-muted hover:bg-muted/80 text-[11px] font-medium rounded-full text-foreground whitespace-nowrap transition-colors">
                    {qr}
                  </button>
                ))}
              </div>

              {/* صندوق الإدخال */}
              <div className="p-3 border-t border-border bg-card shrink-0 space-y-2">
                {liveTranslation && (
                  <div className="px-3.5 py-2 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs text-blue-700 dark:text-blue-300 flex items-center justify-between transition-all">
                    <div className="flex items-center gap-2 truncate">
                      <span className="font-bold flex items-center gap-1 shrink-0">
                        <span>🌐</span>
                        <span>الترجمة الفورية ({liveTranslationLang.toUpperCase()}):</span>
                      </span>
                      <span className="italic truncate font-medium">{liveTranslation}</span>
                    </div>
                    {isTranslating && (
                      <span className="w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin shrink-0 ms-2" />
                    )}
                  </div>
                )}

                {pendingAttachment && (
                  <div className="px-3.5 py-1.5 bg-muted/70 rounded-xl border border-border flex items-center justify-between text-xs">
                    <span className="font-medium truncate flex-1">{pendingAttachment.file.name}</span>
                    <button type="button" onClick={() => setPendingAttachment(null)} className="text-red-500 hover:text-red-700 font-bold ms-2">إلغاء</button>
                  </div>
                )}

                {privacyWarning && (
                  <div className="px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300 rounded-lg flex items-center gap-2">
                    <Icon name="ExclamationTriangleIcon" size={14} className="shrink-0" />
                    <span>{privacyWarning}</span>
                  </div>
                )}

                <div className="w-full">
                  <textarea
                    ref={inputRef}
                    value={inputText}
                    onChange={e => setInputText(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    placeholder={
                      activeConv.category === 'admin'
                        ? 'اكتب رسالتك للإدارة العامة لدايركت هب...'
                        : activeConv.category === 'agent'
                        ? 'اكتب رسالتك وتنسيقك للمندوب الميداني المشرف...'
                        : 'اكتب رسالتك وتفاصيل طلبك هنا... (تتم الترجمة فورياً)'
                    }
                    rows={2}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 resize-none transition-all leading-relaxed"
                    style={{ minHeight: '60px', maxHeight: '130px' }}
                  />
                </div>

                <div className="flex items-center justify-between gap-2 pt-0.5">
                  <div className="flex items-center gap-1.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                    <input ref={fileInputRef} type="file" accept={ACCEPT_ATTR} onChange={handleAttachment} className="hidden" />
                    <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleAttachment} className="hidden" />

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="h-9 px-2.5 rounded-xl border border-border bg-muted/40 hover:bg-muted text-muted-foreground hover:text-primary flex items-center gap-1.5 text-xs font-semibold transition-colors shrink-0"
                      title="إرفاق صورة أو مستند"
                    >
                      <Icon name="PaperClipIcon" size={16} />
                      <span className="hidden sm:inline">مرفق</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="h-9 px-2.5 rounded-xl border border-border bg-muted/40 hover:bg-muted text-muted-foreground hover:text-primary flex items-center gap-1.5 text-xs font-semibold transition-colors shrink-0"
                      title="التقاط صورة بالكاميرا"
                    >
                      <Icon name="CameraIcon" size={16} />
                      <span className="hidden sm:inline">كاميرا</span>
                    </button>

                    <div className="relative shrink-0">
                      <button
                        type="button"
                        onClick={() => setShowLangPicker(!showLangPicker)}
                        className="h-9 px-2.5 rounded-xl border border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300 text-xs font-bold flex items-center gap-1.5 hover:bg-blue-500/20 transition-colors"
                        title="تغيير لغة الترجمة الفورية"
                      >
                        <span className="text-sm">🌐</span>
                        <span>{liveTranslationLang.toUpperCase()}</span>
                        <Icon name="ChevronDownIcon" size={12} className="opacity-70" />
                      </button>

                      {showLangPicker && (
                        <div className="absolute bottom-full mb-2 right-0 bg-card border border-border rounded-2xl shadow-2xl py-1.5 z-50 min-w-[145px]">
                          <div className="px-3 py-1 text-[10px] font-bold text-muted-foreground uppercase border-b border-border">
                            اختر لغة الترجمة
                          </div>
                          {LANG_OPTIONS.map(opt => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => {
                                setLiveTranslationLang(opt.value);
                                setShowLangPicker(false);
                                setLiveTranslation('');
                              }}
                              className={`w-full text-start px-3 py-2 text-xs hover:bg-muted flex items-center justify-between transition-colors ${
                                liveTranslationLang === opt.value ? 'bg-primary/10 text-primary font-bold' : 'text-foreground'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-base">{opt.flag}</span>
                                <span>{opt.nativeName}</span>
                              </div>
                              {liveTranslationLang === opt.value && <Icon name="CheckIcon" size={14} className="text-primary" />}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={handleToggleRecord}
                      className={`h-9 px-2.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0 ${
                        isRecording
                          ? 'bg-red-500 text-white border-red-600 animate-pulse'
                          : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                      title={isRecording ? 'إيقاف التسجيل وإرسال' : 'تسجيل رسالة صوتية'}
                    >
                      <Icon name="MicrophoneIcon" size={16} />
                      <span className="hidden sm:inline">{isRecording ? 'تسجيل...' : 'صوتي'}</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={(!inputText.trim() && !pendingAttachment) || sending}
                    className="h-9 px-5 bg-primary text-primary-foreground rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-sm hover:opacity-90 active:scale-95 disabled:opacity-40 transition-all shrink-0"
                  >
                    <span>{isAr ? 'إرسال' : 'Send'}</span>
                    <Icon name="PaperAirplaneIcon" size={15} className={isRTL ? 'rotate-180' : ''} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {(!activeConvId || sidebarOpen) && <BottomNav />}
    </div>
  );
}

export default function LiveMessagingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <LiveMessagingContent />
    </Suspense>
  );
}
