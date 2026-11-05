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
import { needsChatTranslation } from '@/lib/chatTranslationGate';
import { resolveFileType, extensionForType, fileWithResolvedType } from '@/lib/attachmentTypes';
import { createNotification } from '@/lib/notificationEngine';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Conversation {
  id: string;
  source: 'chat' | 'logistics';
  category: 'factory' | 'logistics' | 'admin';
  buyer_id: string;
  manufacturer_id: string | null;
  partner_id?: string | null;
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
  thread_type?: 'negotiation' | 'rfq' | 'order' | 'logistics';
  deal_status?: 'open' | 'in_progress' | 'agreed' | 'closed';
  deal_value?: number;
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
  msg_type?: 'text' | 'proposal' | 'counter' | 'system';
  proposal_data?: ProposalData;
  local_audio_url?: string;
  audio_duration?: number;
  bilingual_original?: string;
  bilingual_translated?: string;
  bilingual_translated_lang?: SupportedLang;
}

interface ProposalData {
  price: number;
  quantity: number;
  currency: string;
  delivery_days: number;
  payment_terms: string;
  notes?: string;
  shipping_type?: 'door_to_door' | 'port_warehouse';
  factory_tax_ref?: string;
  incoterm?: 'EXW' | 'FOB';
  port_of_loading?: string;
}

type SupportedLang = 'ar' | 'en' | 'zh' | 'tr';

interface InquiryCardData {
  productId: string;
  convId?: string;
  name: string;
  image: string | null;
  priceText: string;
  moqText: string;
}

function formatInquiryPrice(price: number | null | undefined, currency: string | null | undefined, isAr: boolean): string {
  const n = Number(price || 0);
  if (!n || n <= 0) return isAr ? 'تواصل لمعرفة السعر' : 'Contact for price';
  const cur = String(currency || 'USD').toUpperCase();
  const num = n.toFixed(2).replace(/\.00$/, '');
  return cur === 'USD' ? `$${num}` : `${num} ${isAr ? 'ر.ي' : 'YER'}`;
}

function firstProductImage(row: any): string | null {
  const arr = Array.isArray(row?.images) && row.images.length > 0
    ? row.images
    : Array.isArray(row?.product_images) && row.product_images.length > 0
      ? row.product_images
      : [];
  const first = arr[0];
  const src = typeof first === 'string' ? first : first?.src || first?.url;
  return src || row?.image_url || null;
}

function ProductInquiryCard({ data, isAr }: { data: InquiryCardData; isAr: boolean }) {
  return (
    <div className="w-full max-w-[85%] sm:max-w-[320px] rounded-2xl border border-primary/30 bg-card shadow-sm overflow-hidden" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="px-3 py-1.5 bg-primary/10 text-[11px] font-bold text-primary flex items-center gap-1.5">
        <Icon name="TagIcon" size={12} />
        {isAr ? 'استفسار عن منتج' : 'Product Inquiry'}
      </div>
      <Link href={`/product/${encodeURIComponent(data.productId)}`} className="flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors">
        <div className="w-16 h-16 rounded-xl bg-muted overflow-hidden shrink-0 flex items-center justify-center">
          {data.image ? (
            <AppImage src={data.image} alt={data.name} width={64} height={64} className="w-16 h-16 object-cover" />
          ) : (
            <Icon name="CubeIcon" size={24} className="text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground truncate">{data.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            <span className="font-semibold">{isAr ? 'سعر الوحدة: ' : 'Unit price: '}</span>
            <span className="font-extrabold text-primary">{data.priceText}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold">{isAr ? 'الحد الأدنى للطلب: ' : 'MOQ: '}</span>
            {data.moqText}
          </p>
        </div>
      </Link>
    </div>
  );
}

const LANG_OPTIONS: { value: SupportedLang; label: string; flag: string; nativeName: string }[] = [
  { value: 'ar', label: 'Arabic', flag: '🇸🇦', nativeName: 'العربية' },
  { value: 'en', label: 'English', flag: '🇬🇧', nativeName: 'English' },
  { value: 'zh', label: 'Chinese', flag: '🇨🇳', nativeName: '中文' },
  { value: 'tr', label: 'Turkish', flag: '🇹🇷', nativeName: 'Türkçe' },
];

const THREAD_LABELS: Record<string, { color: string; icon: string; labelAr: string; labelEn: string }> = {
  negotiation: { color: 'bg-blue-500/10 text-blue-600 border-blue-500/20', icon: 'ChatBubbleLeftRightIcon', labelAr: 'تفاوض مصنع', labelEn: 'Factory Negotiation' },
  rfq: { color: 'bg-amber-500/10 text-amber-600 border-amber-500/20', icon: 'DocumentTextIcon', labelAr: 'طلب تسعير RFQ', labelEn: 'RFQ Quote' },
  order: { color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20', icon: 'ShoppingBagIcon', labelAr: 'طلب شراء', labelEn: 'Purchase Order' },
  logistics: { color: 'bg-purple-500/10 text-purple-600 border-purple-500/20', icon: 'TruckIcon', labelAr: 'شحن وتخليص', labelEn: 'Logistics & Freight' },
};

const DEAL_STATUS_CONFIG: Record<string, { color: string; bg: string; key: 'open' | 'inProgress' | 'agreed' | 'closed' }> = {
  open: { color: 'text-blue-600', bg: 'bg-blue-500/10 border-blue-500/20', key: 'open' },
  in_progress: { color: 'text-amber-600', bg: 'bg-amber-500/10 border-amber-500/20', key: 'inProgress' },
  agreed: { color: 'text-emerald-600', bg: 'bg-emerald-500/10 border-emerald-500/20', key: 'agreed' },
  closed: { color: 'text-muted-foreground', bg: 'bg-muted border-border', key: 'closed' },
};

const ALLOWED_TYPES = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
  'image/heic', 'image/heif',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/octet-stream',
];
const ACCEPT_ATTR = [
  'image/jpeg,image/jpg,image/png,image/webp,image/gif,image/heic,image/heif',
  'application/pdf',
  '.xlsx,.xls,.docx,.doc,.dwg,.dxf',
].join(',');
const MAX_SIZE = 25 * 1024 * 1024;

const EMOJI_CATEGORIES = [
  {
    labelKey: 'emojiExpressions' as const, labelEn: 'Expressions', icon: '😀',
    emojis: ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','😉','😊','😇','🥰','😍','🤩','😘','😋','😛','😜','🤪','🤑','🤗','🤔','🤐','🤨','😐','😏','😒','🙄','😬','😌','😔','😴','😷','🤯','😎','🤓','🧐','😕','😟','😮','😲','😳','🥺','😨','😰','😢','😭','😱','😖','😩','😤','😡','🤬','💀','💩','🤡','👻','🤖'],
  },
  {
    labelKey: 'emojiHands' as const, labelEn: 'Hands', icon: '👋',
    emojis: ['👋','🤚','✋','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏','✍️','💪'],
  },
  {
    labelKey: 'emojiBusiness' as const, labelEn: 'Business', icon: '💼',
    emojis: ['💼','📊','📈','📉','📋','📌','📍','📎','📏','📐','🔒','🔓','🔑','🔨','🛠️','🛡️','⚙️','⚖️','🔗','🚚','🚢','✈️','🏢','🏭','📦','🏷️','💵','💰','💳','🧾'],
  },
  {
    labelKey: 'emojiSymbols' as const, labelEn: 'Symbols', icon: '🔥',
    emojis: ['🔥','⭐','🌟','✨','🎉','🎊','🎈','🎁','🏆','🥇','🥈','🥉','🎖️','🎯','🚀','⚡','🌐','✅','❌','⚠️','ℹ️','🔒','🔔'],
  },
];

function EmojiPickerPanel({ onSelect, onClose }: { onSelect: (emoji: string) => void; onClose: () => void }) {
  const [activeCategory, setActiveCategory] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div ref={ref} className="absolute bottom-full mb-2 left-0 z-[200] bg-card border border-border rounded-2xl shadow-2xl overflow-hidden" style={{ width: 320, maxHeight: 360 }}>
      <div className="flex items-center gap-0.5 px-2 py-2 border-b border-border bg-muted/40 overflow-x-auto">
        {EMOJI_CATEGORIES.map((cat, i) => (
          <button key={cat.labelKey} onClick={() => setActiveCategory(i)} className={`w-8 h-8 rounded-lg flex items-center justify-center text-base transition-colors shrink-0 ${activeCategory === i ? 'bg-primary/10 ring-1 ring-primary/30' : 'hover:bg-muted'}`}>
            {cat.icon}
          </button>
        ))}
      </div>
      <div className="overflow-y-auto p-2" style={{ maxHeight: 260 }}>
        <div className="grid grid-cols-8 gap-0.5">
          {EMOJI_CATEGORIES[activeCategory].emojis.map((emoji) => (
            <button key={emoji} onClick={() => onSelect(emoji)} className="w-9 h-9 flex items-center justify-center text-xl rounded-lg hover:bg-muted transition-colors">
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const QUICK_REPLIES_BY_LANG: Record<string, string[]> = {
  ar: [
    'ما هو الحد الأدنى للطلب (MOQ)؟',
    'هل يمكن توفير عينة قبل الاعتماد؟',
    'ما هي شروط الدفع والضمان المالي؟',
    'ما هي المدة المتوقعة للتسليم والتجهيز؟',
    'هل يمكن تخصيص المواصفات والشعار؟',
    'ما هو أفضل سعر تسليم لميناء أو مستودع؟',
  ],
  en: [
    'What is the MOQ?',
    'Can I get a sample?',
    'What are the payment and escrow terms?',
    'What is the lead time?',
    'Do you offer product customization?',
    'What is the best price for bulk orders?',
  ],
};

function formatTime(iso: string, lang: string, yesterdayLabel = 'أمس') {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
    const locale = lang === 'ar' ? 'ar-SA' : 'en-US';
    if (diffDays === 0) return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
    if (diffDays === 1) return yesterdayLabel;
    if (diffDays < 7) return d.toLocaleDateString(locale, { weekday: 'short' });
    return d.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
  } catch { return ''; }
}

function inferThreadType(conv: any): 'negotiation' | 'rfq' | 'order' | 'logistics' {
  if (conv.source === 'logistics' || conv.category === 'logistics') return 'logistics';
  const name = (conv.product_name || '').toLowerCase();
  if (name.includes('rfq') || name.includes('quote')) return 'rfq';
  if (name.includes('order') || name.includes('ord-')) return 'order';
  return 'negotiation';
}

async function translateText(text: string, targetLanguage: SupportedLang): Promise<string> {
  if (!text?.trim()) return text;
  try {
    const res = await fetch('/api/ai/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, targetLanguage }),
    });
    if (!res.ok) return text;
    const data = await res.json();
    return data.translated || text;
  } catch {
    return text;
  }
}

function isArabicText(text: string): boolean {
  const arabicChars = (text.match(/[\u0600-\u06FF]/g) || []).length;
  return arabicChars / text.length > 0.3;
}

// ─── Audio Message Bubble ─────────────────────────────────────────────────────
function AudioMessageBubble({ audioUrl, duration, isOwn }: { audioUrl: string; duration: number; isOwn: boolean }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration || 0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'metadata';
    audioRef.current = audio;

    const onLoadedMetadata = () => { if (isFinite(audio.duration) && audio.duration > 0) setTotalDuration(Math.round(audio.duration)); };
    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onEnded = () => { setIsPlaying(false); setCurrentTime(0); };
    const onPause = () => setIsPlaying(false);
    const onPlay = () => setIsPlaying(true);

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('play', onPlay);

    let cancelled = false;
    if (audioUrl.startsWith('blob:') || audioUrl.startsWith('data:')) {
      audio.src = audioUrl;
      audio.load();
    } else {
      getChatMediaSignedUrl(audioUrl).then((signed) => {
        if (cancelled || !signed) return;
        audio.src = signed;
        audio.load();
      });
    }

    return () => {
      cancelled = true;
      audio.pause();
      audio.src = '';
      audioRef.current = null;
    };
  }, [audioUrl]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) audio.pause();
    else audio.play().catch(() => setIsPlaying(false));
  };

  const formatSeconds = (secs: number) => {
    const s = Math.floor(secs);
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  };

  const progress = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;
  const heights = [3, 5, 8, 6, 10, 7, 9, 5, 8, 6, 10, 7, 5, 9, 6, 8, 4, 7, 5, 6];

  return (
    <div className="flex items-center gap-2.5 min-w-[180px]">
      <button
        type="button"
        onClick={togglePlay}
        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all ${
          isOwn ? 'bg-white/20 hover:bg-white/30' : 'bg-primary/10 hover:bg-primary/20'
        }`}
      >
        {isPlaying ? (
          <span className={`w-3 h-3 ${isOwn ? 'bg-white' : 'bg-primary'} rounded-xs`} />
        ) : (
          <Icon name="PlayIcon" size={16} className={isOwn ? 'text-white' : 'text-primary'} />
        )}
      </button>
      <div className="flex-1 flex flex-col gap-1">
        <div className="flex items-center gap-0.5 h-6">
          {heights.map((h, i) => {
            const filled = (i / heights.length) * 100 <= progress;
            return (
              <div
                key={i}
                className={`rounded-full transition-colors duration-100 ${
                  filled ? (isOwn ? 'bg-white' : 'bg-primary') : (isOwn ? 'bg-white/40' : 'bg-primary/25')
                }`}
                style={{ width: 2, height: h }}
              />
            );
          })}
        </div>
        <span className={`text-[10px] font-mono ${isOwn ? 'text-white/80' : 'text-primary/70'}`}>
          {isPlaying ? formatSeconds(currentTime) : formatSeconds(totalDuration)}
        </span>
      </div>
    </div>
  );
}

// ─── Avatar Component ─────────────────────────────────────────────────────────
function SupplierAvatar({ src, name, size = 48, online = false, unread = 0, isLogistics = false }: {
  src?: string | null; name?: string | null; size?: number; online?: boolean; unread?: number; isLogistics?: boolean;
}) {
  const displayName = name || 'DH';
  const initials = displayName.slice(0, 2).toUpperCase();
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div
        className={`w-full h-full rounded-full overflow-hidden flex items-center justify-center border-2 border-white shadow-sm ${
          isLogistics ? 'bg-gradient-to-br from-purple-600 to-indigo-700' : 'bg-gradient-to-br from-blue-600 to-amber-600'
        }`}
      >
        {src ? (
          <AppImage src={src} alt={displayName} width={size} height={size} className="w-full h-full object-cover" />
        ) : isLogistics ? (
          <Icon name="TruckIcon" size={size * 0.45} className="text-white" />
        ) : (
          <span className="text-white font-bold" style={{ fontSize: size * 0.32 }}>{initials}</span>
        )}
      </div>
      <span className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white ${online ? 'bg-emerald-500' : 'bg-gray-300'}`} />
      {unread > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 shadow ring-2 ring-white">
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </div>
  );
}

// ─── Main Content Component ───────────────────────────────────────────────────
function LiveMessagingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const supabase = createClient();
  const { language, dir, t, isRTL } = useLanguage();
  const m = t.messaging;

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

  // الفلترة الموحدة
  type UnifiedFilterType = 'all' | 'factory' | 'logistics' | 'rfq' | 'order';
  const [filterType, setFilterType] = useState<UnifiedFilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [inquiryCard, setInquiryCard] = useState<InquiryCardData | null>(null);
  const [onlineUsers] = useState<Set<string>>(new Set());
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // الترجمة الحية
  const [myLang] = useState<SupportedLang>('ar');
  const [liveTranslation, setLiveTranslation] = useState('');
  const [liveTranslationLang, setLiveTranslationLang] = useState<SupportedLang>('en');
  const [showLangPicker, setShowLangPicker] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const activeConv = conversations.find(c => c.id === activeConvId) || null;
  const isAr = language === 'ar';

  useEffect(() => {
    if (authLoading) return;
    if (!user) router.push('/login');
  }, [user, authLoading, router]);

  // ── جلب المحادثات الموحدة (مصانع + شحن) ───────────────────────────────────
  const fetchAllConversations = useCallback(async () => {
    if (!user) return;
    setLoadingConvs(true);
    try {
      // 1. محادثات المصانع والتجارة
      const { data: chatData } = await supabase
        .from('chat_conversations')
        .select('*')
        .or(`buyer_id.eq.${user.id},manufacturer_id.eq.${user.id}`)
        .order('last_message_at', { ascending: false });

      // 2. محادثات مكاتب الشحن والتخليص
      let logisticsData: any[] = [];
      try {
        const { data: logData } = await supabase
          .from('logistics_conversations')
          .select('*, logistics_partners(id, company_name, country, city, partner_type)')
          .eq('buyer_id', user.id)
          .order('last_message_at', { ascending: false });
        if (logData) logisticsData = logData;
      } catch (err) {
        console.warn('Logistics fetch error:', err);
      }

      // توحيد محادثات المصانع
      const normalizedChats: Conversation[] = (chatData || []).map(c => ({
        ...c,
        source: 'chat' as const,
        category: 'factory' as const,
        thread_type: inferThreadType(c),
        unread_count: 0,
      }));

      // توحيد محادثات مكاتب الشحن
      const normalizedLogistics: Conversation[] = logisticsData.map(lc => {
        const partner = lc.logistics_partners;
        return {
          id: lc.id,
          source: 'logistics' as const,
          category: 'logistics' as const,
          buyer_id: lc.buyer_id,
          manufacturer_id: null,
          partner_id: lc.partner_id,
          product_id: '',
          product_name: partner ? `شحن وتخليص — ${partner.city || ''} ${partner.country || ''}` : 'شريك لوجستي',
          supplier_name: partner?.company_name || 'مكتب شحن معتمد',
          supplier_country: partner?.country || '',
          supplier_flag: '🚢',
          supplier_avatar: null,
          last_message: lc.last_message || 'محادثة استفسار عن الشحن والتخليص',
          last_message_at: lc.last_message_at || lc.created_at,
          is_active: true,
          created_at: lc.created_at,
          unread_count: lc.buyer_unread || 0,
          thread_type: 'logistics' as const,
          deal_status: 'open' as const,
        };
      });

      // دمج وترتيب الكل حسب التاريخ
      const combined = [...normalizedChats, ...normalizedLogistics].sort(
        (a, b) => new Date(b.last_message_at || 0).getTime() - new Date(a.last_message_at || 0).getTime()
      );

      setConversations(combined);

      // تحديد المحادثة المستهدفة من الرابط
      const targetId = searchParams?.get('id') || searchParams?.get('conv');
      if (targetId && combined.some(c => c.id === targetId)) {
        setActiveConvId(targetId);
        if (typeof window !== 'undefined' && window.innerWidth < 768) setSidebarOpen(false);
      } else if (combined.length > 0 && !activeConvId) {
        setActiveConvId(combined[0].id);
      }
    } catch (err) {
      console.error('Fetch all conversations error:', err);
    } finally {
      setLoadingConvs(false);
    }
  }, [user, supabase, searchParams, activeConvId]);

  useEffect(() => {
    if (user && !authLoading) fetchAllConversations();
  }, [user, authLoading, fetchAllConversations]);

  // ── جلب رسائل المحادثة النشطة (بناءً على المصدر) ──────────────────────────
  useEffect(() => {
    if (!activeConvId || !user || !activeConv) return;
    const fetchMessages = async () => {
      setLoadingMsgs(true);
      try {
        if (activeConv.source === 'logistics') {
          // جلب من جدول الشحن
          const { data } = await supabase
            .from('logistics_messages')
            .select('*')
            .eq('conversation_id', activeConvId)
            .order('created_at', { ascending: true });

          const normalized: Message[] = (data || []).map((m: any) => ({
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
            msg_type: 'text',
          }));
          setMessages(normalized);
        } else {
          // جلب من جدول المصانع والتجارة
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
        console.error('Fetch messages error:', err);
      } finally {
        setLoadingMsgs(false);
      }
    };
    fetchMessages();
  }, [activeConvId, activeConv, user, supabase]);

  // التحديث الفوري (Realtime)
  useEffect(() => {
    if (!activeConvId || !user || !activeConv) return;
    const tableName = activeConv.source === 'logistics' ? 'logistics_messages' : 'chat_messages';

    const channel = supabase
      .channel(`realtime-msgs:${activeConvId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: tableName, filter: `conversation_id=eq.${activeConvId}` }, (payload) => {
        const row: any = payload.new;
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
          msg_type: 'text',
        };
        setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeConvId, activeConv, user, supabase]);

  // التمرير لأسفل المحادثة
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── إرسال رسالة ذكية حسب المصدر ──────────────────────────────────────────
  const handleSendMessage = async (text: string) => {
    if (!text.trim() && !pendingAttachment) return;
    if (sending || !activeConvId || !user || !activeConv) return;

    if (text.trim()) {
      const shield = sanitizeChatMessage(text.trim());
      if (shield.blocked) {
        setPrivacyWarning(shield.reason || 'تم حجب الرسالة للحفاظ على الأمان');
        setTimeout(() => setPrivacyWarning(null), 5000);
        return;
      }
    }

    setSending(true);
    const content = text.trim();
    const optimisticId = `opt-${Date.now()}`;

    const optMsg: Message = {
      id: optimisticId,
      conversation_id: activeConvId,
      sender_id: user.id,
      sender_role: 'buyer',
      message: content,
      created_at: new Date().toISOString(),
      is_read: false,
      msg_type: 'text',
      attachment_url: pendingAttachment?.previewUrl,
      attachment_name: pendingAttachment?.file.name,
      attachment_type: pendingAttachment?.type,
    };
    setMessages(prev => [...prev, optMsg]);
    setInputText('');
    setPendingAttachment(null);

    try {
      if (activeConv.source === 'logistics') {
        // إرسال لمكتب الشحن
        await supabase.from('logistics_messages').insert({
          conversation_id: activeConvId,
          sender_id: user.id,
          sender_role: 'buyer',
          content,
        });
        await supabase.from('logistics_conversations').update({
          last_message: content,
          last_message_at: new Date().toISOString(),
          partner_unread: 1,
        }).eq('id', activeConvId);
      } else {
        // إرسال للمصنع
        await supabase.from('chat_messages').insert({
          conversation_id: activeConvId,
          sender_id: user.id,
          sender_role: user.user_metadata?.role || 'buyer',
          message: content,
          is_read: false,
        });
        await supabase.from('chat_conversations').update({
          last_message: content,
          last_message_at: new Date().toISOString(),
        }).eq('id', activeConvId);
      }
    } catch (err) {
      console.error('Failed to send:', err);
    } finally {
      setSending(false);
    }
  };

  // تصفية المحادثات حسب الفلتر الموحد
  const filteredConvs = conversations.filter(c => {
    if (filterType === 'factory' && c.category !== 'factory') return false;
    if (filterType === 'logistics' && c.category !== 'logistics') return false;
    if (filterType === 'rfq' && c.thread_type !== 'rfq') return false;
    if (filterType === 'order' && c.thread_type !== 'order') return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = (c.supplier_name || '').toLowerCase().includes(q);
      const matchProd = (c.product_name || '').toLowerCase().includes(q);
      return matchName || matchProd;
    }
    return true;
  });

  return (
    <div className="bg-background flex flex-col overflow-hidden min-w-0" dir={dir} style={{ height: '100dvh', maxHeight: '100dvh' }}>
      <Header />

      <div className="flex-1 flex overflow-hidden min-w-0">
        {/* ══ القائمة الجانبية الموحدة ═══════════════════════════════════════ */}
        <div className={`${sidebarOpen ? 'flex' : 'hidden'} md:flex flex-col w-full md:w-[350px] lg:w-[390px] md:shrink-0 bg-card border-l border-border overflow-hidden`}>
          {/* شريط البحث والفلترة */}
          <div className="p-3 border-b border-border bg-card space-y-2">
            <div className="flex items-center justify-between">
              <h1 className="text-base font-bold text-foreground flex items-center gap-2">
                <Icon name="ChatBubbleLeftRightIcon" size={18} className="text-primary" />
                {isAr ? 'الدردشة الموحدة' : 'Unified Inbox'}
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
                placeholder={isAr ? 'بحث عن مصنع، مكتب شحن، أو منتج...' : 'Search supplier or logistics...'}
                className="w-full h-9 pr-9 pl-3 rounded-xl border border-border bg-background text-foreground text-xs focus:outline-none focus:border-primary"
              />
            </div>

            {/* أزرار الفلترة الموحدة */}
            <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
              {[
                { id: 'all', label: isAr ? 'الكل' : 'All' },
                { id: 'factory', label: isAr ? '🏭 مصانع' : '🏭 Factories' },
                { id: 'logistics', label: isAr ? '🚢 شحن' : '🚢 Shipping' },
                { id: 'rfq', label: isAr ? '📑 RFQ' : '📑 RFQ' },
                { id: 'order', label: isAr ? '📦 طلبيات' : '📦 Orders' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setFilterType(tab.id as UnifiedFilterType)}
                  className={`shrink-0 py-1 px-2.5 text-xs font-semibold rounded-lg transition-all ${
                    filterType === tab.id
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* قائمة المحادثات */}
          <div className="flex-1 overflow-y-auto">
            {loadingConvs ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filteredConvs.length === 0 ? (
              <div className="text-center py-16 px-4">
                <Icon name="ChatBubbleLeftRightIcon" size={32} className="text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">{isAr ? 'لا توجد محادثات في هذا القسم' : 'No conversations found'}</p>
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
                    <SupplierAvatar
                      src={conv.supplier_avatar}
                      name={conv.supplier_name}
                      size={44}
                      isLogistics={conv.category === 'logistics'}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <p className="text-xs font-bold text-foreground truncate flex-1">
                          {conv.supplier_name}
                        </p>
                        <span className="text-[10px] text-muted-foreground shrink-0 ms-1">
                          {formatTime(conv.last_message_at || '', language)}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate mb-1">
                        {conv.product_name}
                      </p>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full border ${threadInfo?.color}`}>
                          {isAr ? threadInfo?.labelAr : threadInfo?.labelEn}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ══ منطقة الشات الموحدة ═══════════════════════════════════════════ */}
        <div className={`${sidebarOpen ? 'hidden md:flex' : 'flex'} flex-1 flex-col bg-background min-w-0 border-r border-border overflow-hidden`}>
          {!activeConv ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-muted/20">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
                <Icon name="ChatBubbleLeftRightIcon" size={30} className="text-primary" />
              </div>
              <h2 className="text-base font-bold text-foreground mb-1">{isAr ? 'اختر محادثة للبدء' : 'Select a conversation'}</h2>
              <p className="text-xs text-muted-foreground max-w-xs">{isAr ? 'تواصل مباشرة مع المصانع ومكاتب الشحن وإدارة المنصة في مكان واحد موحد.' : 'Negotiate directly with factories and freight forwarders.'}</p>
            </div>
          ) : (
            <>
              {/* ترويسة الشات */}
              <div className="px-4 py-3 border-b border-border bg-card flex items-center gap-3 shrink-0">
                <button onClick={() => setSidebarOpen(true)} className="md:hidden w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center">
                  <Icon name="ArrowRightIcon" size={17} className={isRTL ? '' : 'rotate-180'} />
                </button>

                <SupplierAvatar src={activeConv.supplier_avatar} name={activeConv.supplier_name} size={38} isLogistics={activeConv.category === 'logistics'} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-foreground truncate">{activeConv.supplier_name}</p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${THREAD_LABELS[activeConv.thread_type || 'negotiation']?.color}`}>
                      {isAr ? THREAD_LABELS[activeConv.thread_type || 'negotiation']?.labelAr : THREAD_LABELS[activeConv.thread_type || 'negotiation']?.labelEn}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{activeConv.product_name}</p>
                </div>
              </div>

              {/* الرسائل */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-muted/10">
                {messages.map(msg => {
                  const isOwn = msg.sender_id === user?.id;
                  return (
                    <div key={msg.id} className={`flex ${isOwn ? 'justify-start' : 'justify-end'} gap-2`}>
                      <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-xs ${
                        isOwn ? 'bg-primary text-primary-foreground rounded-tr-xs' : 'bg-card border border-border text-foreground rounded-tl-xs'
                      }`}>
                        <p className="whitespace-pre-wrap">{msg.message}</p>
                        <span className={`text-[10px] block mt-1 ${isOwn ? 'text-primary-foreground/70 text-start' : 'text-muted-foreground text-end'}`}>
                          {formatTime(msg.created_at, language)}
                        </span>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* صندوق الإدخال */}
              <div className="p-3 border-t border-border bg-card shrink-0">
                <form onSubmit={e => { e.preventDefault(); handleSendMessage(inputText); }} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={inputText}
                    onChange={e => setInputText(e.target.value)}
                    placeholder={isAr ? 'اكتب رسالتك هنا للتفاوض أو الاستفسار...' : 'Type your message...'}
                    className="flex-1 h-11 px-4 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={!inputText.trim() || sending}
                    className="h-11 px-5 bg-primary text-primary-foreground rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 disabled:opacity-50 transition-opacity active:opacity-80"
                  >
                    <Icon name="PaperAirplaneIcon" size={16} className={isRTL ? 'rotate-180' : ''} />
                    <span>{isAr ? 'إرسال' : 'Send'}</span>
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      </div>

      <BottomNav />
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
