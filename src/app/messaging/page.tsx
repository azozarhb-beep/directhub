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
  deal_status?: 'open' | 'in_progress' | 'agreed' | 'closed';
  deal_value?: number;
  /** From manufacturer user_profiles — used to gate translation UI */
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
  local_audio_url?: string; // for optimistic voice notes
  audio_duration?: number;
  // bilingual data parsed from JSON message (in-memory only)
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
  const cur = String(currency || 'YER').toUpperCase();
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
    <div className="mx-3 sm:mx-4 mt-3 mb-1 rounded-2xl border border-primary/30 bg-white shadow-sm overflow-hidden" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="px-3 py-1.5 bg-primary/10 text-[11px] font-bold text-primary flex items-center gap-1.5">
        <Icon name="TagIcon" size={12} />
        {isAr ? 'استفسار عن منتج' : 'Product Inquiry'}
      </div>
      <Link href={`/product/${encodeURIComponent(data.productId)}`} className="flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors">
        <div className="w-16 h-16 rounded-xl bg-gray-100 overflow-hidden shrink-0 flex items-center justify-center">
          {data.image ? (
            <AppImage src={data.image} alt={data.name} width={64} height={64} className="w-16 h-16 object-cover" />
          ) : (
            <Icon name="CubeIcon" size={24} className="text-gray-400" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900 truncate">{data.name}</p>
          <p className="text-xs text-gray-600 mt-0.5">
            <span className="font-semibold">{isAr ? 'سعر الوحدة: ' : 'Unit price: '}</span>
            <span className="font-extrabold text-primary">{data.priceText}</span>
          </p>
          <p className="text-xs text-gray-600">
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

const THREAD_LABELS: Record<string, { color: string; icon: string; key: 'negotiation' | 'rfq' | 'order' }> = {
  negotiation: { color: 'bg-blue-100 text-blue-700 border-blue-200', icon: 'ChatBubbleLeftRightIcon', key: 'negotiation' },
  rfq: { color: 'bg-amber-100 text-amber-700 border-amber-200', icon: 'DocumentTextIcon', key: 'rfq' },
  order: { color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: 'ShoppingBagIcon', key: 'order' },
};

const DEAL_STATUS_CONFIG: Record<string, { color: string; bg: string; key: 'open' | 'inProgress' | 'agreed' | 'closed' }> = {
  open: { color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', key: 'open' },
  in_progress: { color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', key: 'inProgress' },
  agreed: { color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', key: 'agreed' },
  closed: { color: 'text-gray-600', bg: 'bg-gray-50 border-gray-200', key: 'closed' },
};

// iOS sends image/heic and some Android browsers send image/jpg, so both must
// be accepted here and in the chat-media bucket's allowed_mime_types.
const ALLOWED_TYPES = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
  'image/heic', 'image/heif',
  'application/pdf',
  // Engineering / technical documents
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
  'application/vnd.ms-excel', // xls
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
  'application/msword', // doc
  'application/octet-stream', // dwg/dxf (CAD files — browser reports as octet-stream)
];
const ACCEPT_ATTR = [
  'image/jpeg,image/jpg,image/png,image/webp,image/gif,image/heic,image/heif',
  'application/pdf',
  '.xlsx,.xls,.docx,.doc,.dwg,.dxf',
].join(',');
const MAX_SIZE = 25 * 1024 * 1024;

// ─── Emoji Picker Component ───────────────────────────────────────────────────
const EMOJI_CATEGORIES = [
  {
    labelKey: 'emojiExpressions' as const, labelEn: 'Expressions', icon: '😀',
    emojis: ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩','😘','😗','😚','😙','🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🤧','🥵','🥶','🥴','😵','🤯','🤠','🥳','🥸','😎','🤓','🧐','😕','😟','🙁','☹️','😮','😯','😲','😳','🥺','😦','😧','😨','😰','😥','😢','😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀','☠️','💩','🤡','👹','👺','👻','👽','👾','🤖'],
  },
  {
    labelKey: 'emojiHands' as const, labelEn: 'Hands', icon: '👋',
    emojis: ['👋','🤚','🖐️','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏','✍️','💅','🤳','💪','🦾','🦿','🦵','🦶','👂','🦻','👃','🫀','🫁','🧠','🦷','🦴','👀','👁️','👅','👄'],
  },
  {
    labelKey: 'emojiHearts' as const, labelEn: 'Hearts', icon: '❤️',
    emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','☮️','✝️','☪️','🕉️','☸️','✡️','🔯','🕎','☯️','☦️','🛐','⚛️','🉑','☢️','☣️','📴','📳','🈶','🈚','🈸','🈺','🈷️','✴️','🆚','💮','🉐','㊙️','㊗️','🈴','🈵','🈹','🈲','🅰️','🅱️','🆎','🆑','🅾️','🆘','❌','⭕','🛑','⛔','📛','🚫','💯','💢','♨️','🚷','🚯','🚳','🚱','🔞','📵','🚭'],
  },
  {
    labelKey: 'emojiBusiness' as const, labelEn: 'Business', icon: '💼',
    emojis: ['💼','📊','📈','📉','📋','📌','📍','📎','🖇️','📏','📐','✂️','🗃️','🗄️','🗑️','🔒','🔓','🔏','🔐','🔑','🗝️','🔨','🪓','⛏️','⚒️','🛠️','🗡️','⚔️','🔫','🪃','🏹','🛡️','🪚','🔧','🪛','🔩','⚙️','🗜️','⚖️','🦯','🔗','⛓️','🪝','🧲','🪜','⚗️','🧪','🧫','🧬','🔭','🔬','🩺','📡','💉','🩸','💊','🩹','🩼','🩻','🚪','🪞','🪟','🛋️','🪑','🚽','🪠','🚿','🛁','🪤','🪒','🧴','🧷','🧹','🧺','🧻','🪣','🫧','🪥','🧽','🧯','🛒'],
  },
  {
    labelKey: 'emojiFood' as const, labelEn: 'Food', icon: '🍕',
    emojis: ['🍕','🍔','🍟','🌭','🍿','🧂','🥓','🥚','🍳','🧇','🥞','🧈','🍞','🥐','🥖','🫓','🥨','🥯','🧀','🥗','🥙','🥪','🌮','🌯','🫔','🥫','🍱','🍘','🍙','🍚','🍛','🍜','🍝','🍠','🍢','🍣','🍤','🍥','🥮','🍡','🥟','🥠','🥡','🦀','🦞','🦐','🦑','🦪','🍦','🍧','🍨','🍩','🍪','🎂','🍰','🧁','🥧','🍫','🍬','🍭','🍮','🍯','🍼','🥛','☕','🫖','🍵','🧃','🥤','🧋','🍶','🍺','🍻','🥂','🍷','🥃','🍸','🍹','🧉','🍾','🧊','🥄','🍴','🍽️','🥢','🧆'],
  },
  {
    labelKey: 'emojiSymbols' as const, labelEn: 'Symbols', icon: '🔥',
    emojis: ['🔥','⭐','🌟','💫','✨','🎉','🎊','🎈','🎁','🏆','🥇','🥈','🥉','🎖️','🏅','🎗️','🎀','🎫','🎟️','🎪','🤹','🎭','🎨','🎬','🎤','🎧','🎼','🎵','🎶','🎹','🥁','🪘','🎷','🎺','🎸','🪕','🎻','🎲','♟️','🎯','🎳','🎮','🎰','🧩','🪀','🪁','🎭','🎪','🎠','🎡','🎢','🎪','🚀','🛸','🌈','⚡','🌊','🌺','🌸','🌼','🌻','🌹','🌷','🌱','🌿','🍀','🍁','🍂','🍃','🌾','🌵','🎋','🎍','🍄','🌰','🦋','🐝','🐛','🦗','🕷️','🦂','🐢','🐍','🦎','🦖','🦕','🐙','🦑','🦐','🦞','🦀','🐡','🐠','🐟','🐬','🐳','🐋','🦈','🐊','🐅','🐆','🦓','🦍','🦧','🦣','🐘','🦛','🦏','🐪','🐫','🦒','🦘','🦬','🐃','🐂','🐄','🐎','🐖','🐏','🐑','🦙','🐐','🦌','🐕','🐩','🦮','🐕‍🦺','🐈','🐈‍⬛','🪶','🐓','🦃','🦤','🦚','🦜','🦢','🦩','🕊️','🐇','🦝','🦨','🦡','🦫','🦦','🦥','🐁','🐀','🐿️','🦔'],
  },
];

function EmojiPickerPanel({
  onSelect,
  onClose,
}: {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}) {
  const { language, t } = useLanguage();
  const m = t.messaging;
  const [activeCategory, setActiveCategory] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const categoryLabel = (cat: typeof EMOJI_CATEGORIES[number]) =>
    language === 'ar' ? (m as any)[cat.labelKey] || cat.labelEn : cat.labelEn;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute bottom-full mb-2 left-0 z-[200] bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden"
      style={{ width: 320, maxHeight: 360 }}
    >
      {/* Category tabs */}
      <div className="flex items-center gap-0.5 px-2 py-2 border-b border-gray-100 bg-gray-50 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {EMOJI_CATEGORIES.map((cat, i) => (
          <button
            key={cat.labelKey}
            onClick={() => setActiveCategory(i)}
            title={categoryLabel(cat)}
            className={`w-8 h-8 rounded-lg flex items-center justify-center text-base transition-colors shrink-0 ${activeCategory === i ? 'bg-primary/10 ring-1 ring-primary/30' : 'hover:bg-gray-200'}`}
          >
            {cat.icon}
          </button>
        ))}
      </div>
      {/* Category label */}
      <div className="px-3 py-1.5 bg-white border-b border-gray-100">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{categoryLabel(EMOJI_CATEGORIES[activeCategory])}</span>
      </div>
      {/* Emoji grid */}
      <div className="overflow-y-auto p-2" style={{ maxHeight: 260 }}>
        <div className="grid grid-cols-8 gap-0.5">
          {EMOJI_CATEGORIES[activeCategory].emojis.map((emoji) => (
            <button
              key={emoji}
              onClick={() => onSelect(emoji)}
              className="w-9 h-9 flex items-center justify-center text-xl rounded-lg hover:bg-gray-100 transition-colors"
            >
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
    'هل يمكن الحصول على عينة؟',
    'ما هي شروط الدفع؟',
    'ما هو وقت التسليم؟',
    'هل تقدمون تخصيص المنتج؟',
    'ما هو أفضل سعر للكميات الكبيرة؟',
  ],
  en: [
    'What is the MOQ?',
    'Can I get a sample?',
    'What are the payment terms?',
    'What is the lead time?',
    'Do you offer product customization?',
    'What is the best price for bulk orders?',
  ],
  zh: [
    '最小起订量是多少？',
    '可以提供样品吗？',
    '付款条件是什么？',
    '交货期是多少天？',
    '是否提供产品定制？',
    '大批量订单的最优价格是多少？',
  ],
  tr: [
    'Minimum sipariş miktarı nedir?',
    'Numune alabilir miyim?',
    'Ödeme koşulları nelerdir?',
    'Teslimat süresi nedir?',
    'Ürün özelleştirmesi sunuyor musunuz?',
    'Toplu siparişler için en iyi fiyat nedir?',
  ],
};

function formatTime(iso: string, lang: string, yesterdayLabel = 'Yesterday') {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
    const locale = lang === 'ar' ? 'ar-SA' : lang === 'zh' ? 'zh-CN' : lang === 'tr' ? 'tr-TR' : 'en-US';
    if (diffDays === 0) return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
    if (diffDays === 1) return yesterdayLabel;
    if (diffDays < 7) return d.toLocaleDateString(locale, { weekday: 'short' });
    return d.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
  } catch { return ''; }
}

function inferThreadType(conv: Conversation): 'negotiation' | 'rfq' | 'order' {
  const name = (conv.product_name || '').toLowerCase();
  if (name.includes('rfq') || name.includes('quote')) return 'rfq';
  if (name.includes('order') || name.includes('ord-')) return 'order';
  return 'negotiation';
}

async function translateText(text: string, targetLanguage: SupportedLang): Promise<string> {
  if (!text?.trim()) return text;
  try {
    // Client sends full text; API chunks long payloads (MyMemory/LibreTranslate).
    // No client-side length cutoff — long multi-paragraph messages must translate.
    const res = await fetch('/api/ai/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, targetLanguage }),
    });
    if (!res.ok) {
      // Soft-fail: never blank the chat UI
      console.warn('[Messaging] translate HTTP', res.status);
      return text;
    }
    const data = await res.json();
    return data.translated || text;
  } catch {
    return text;
  }
}

/** Returns true if the text appears to be primarily Arabic */
function isArabicText(text: string): boolean {
  const arabicChars = (text.match(/[\u0600-\u06FF]/g) || []).length;
  return arabicChars / text.length > 0.3;
}

// ─── Audio Message Bubble ─────────────────────────────────────────────────────
function AudioMessageBubble({
  audioUrl,
  duration,
  isOwn,
}: {
  audioUrl: string;
  duration: number;
  isOwn: boolean;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration || 0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'metadata';
    audioRef.current = audio;

    const onLoadedMetadata = () => {
      if (isFinite(audio.duration) && audio.duration > 0) {
        setTotalDuration(Math.round(audio.duration));
      }
    };
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
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('play', onPlay);
      audio.pause();
      audio.src = '';
      audioRef.current = null;
    };
  }, [audioUrl]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(() => setIsPlaying(false));
    }
  };

  const formatTime = (secs: number) => {
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
          <svg className={`w-4 h-4 ${isOwn ? 'text-white' : 'text-primary'}`} fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        ) : (
          <svg className={`w-4 h-4 ${isOwn ? 'text-white' : 'text-primary'}`} fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
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
                  filled
                    ? isOwn ? 'bg-white' : 'bg-primary' : isOwn ?'bg-white/40' : 'bg-primary/25'
                }`}
                style={{ width: 2, height: h }}
              />
            );
          })}
        </div>
        <span className={`text-[10px] font-mono ${isOwn ? 'text-white/80' : 'text-primary/70'}`}>
          {isPlaying ? formatTime(currentTime) : formatTime(totalDuration)}
        </span>
      </div>
      <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${isOwn ? 'bg-white/20' : 'bg-primary/10'}`}>
        <svg className={`w-3 h-3 ${isOwn ? 'text-white/80' : 'text-primary/60'}`} fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm-1 17.93V21h2v-2.07A8.001 8.001 0 0 0 20 11h-2a6 6 0 0 1-12 0H4a8.001 8.001 0 0 0 7 7.93z" />
        </svg>
      </div>
    </div>
  );
}

// ─── Supplier Avatar ──────────────────────────────────────────────────────────
function SupplierAvatar({ src, name, size = 48, online = false, unread = 0 }: {
  src?: string | null; name?: string | null; size?: number; online?: boolean; unread?: number;
}) {
  const displayName = name || 'DH';
  const initials = displayName.slice(0, 2).toUpperCase();
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div
        className="w-full h-full rounded-full overflow-hidden bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center border-2 border-white shadow-sm"
        style={{ width: size, height: size }}
      >
        {src ? (
          <AppImage src={src} alt={displayName} width={size} height={size} className="w-full h-full object-cover" />
        ) : (
          <span className="text-white font-bold" style={{ fontSize: size * 0.3 }}>{initials}</span>
        )}
      </div>
      {/* Online dot */}
      <span className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white ${online ? 'bg-emerald-500' : 'bg-gray-300'}`} />
      {/* Unread badge */}
      {unread > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 shadow ring-2 ring-white">
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </div>
  );
}

// ─── Proposal Card Component ──────────────────────────────────────────────────
function ProposalCard({
  proposal, isOwn, onAccept, onCounter, canAct, isCustomQuote, isAccepting,
}: {
  proposal: ProposalData; isOwn: boolean; onAccept?: () => void; onCounter?: () => void;
  canAct: boolean; isCustomQuote?: boolean; isAccepting?: boolean;
}) {
  const { t } = useLanguage();
  const m = t.messaging;
  return (
    <div className={`rounded-2xl border-2 overflow-hidden ${isOwn ? 'border-primary/30 bg-primary/5' : isCustomQuote ? 'border-blue-300 bg-blue-50' : 'border-emerald-300 bg-emerald-50'}`}>
      <div className={`px-4 py-2.5 flex items-center gap-2 ${isOwn ? 'bg-primary/10' : isCustomQuote ? 'bg-blue-100' : 'bg-emerald-100'}`}>
        <Icon name="DocumentTextIcon" size={15} className={isOwn ? 'text-primary' : isCustomQuote ? 'text-blue-700' : 'text-emerald-700'} />
        <span className={`text-xs font-bold ${isOwn ? 'text-primary' : isCustomQuote ? 'text-blue-700' : 'text-emerald-700'}`}>
          {isOwn ? (isCustomQuote ? m.yourCustomQuoteSent : m.yourProposalSubmitted) : (isCustomQuote ? m.officialCustomQuote : m.quoteReceived)}
        </span>
        {isCustomQuote && !isOwn && (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-200 text-blue-800 border border-blue-300">{m.custom}</span>
        )}
        <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${isOwn ? 'bg-primary/20 text-primary' : isCustomQuote ? 'bg-blue-200 text-blue-800' : 'bg-emerald-200 text-emerald-800'}`}>
          {proposal.currency} {proposal.price.toLocaleString()}
        </span>
      </div>
      <div className="px-4 py-3 grid grid-cols-2 gap-2">
        <div>
          <p className="text-[10px] text-muted-foreground">{m.quantity}</p>
          <p className="text-sm font-bold text-foreground">{proposal.quantity.toLocaleString()} {m.units}</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground">{m.deliveryTime}</p>
          <p className="text-sm font-bold text-foreground">{proposal.delivery_days} {m.days}</p>
        </div>
        <div className="col-span-2">
          <p className="text-[10px] text-muted-foreground">{m.paymentTerms}</p>
          <p className="text-sm font-semibold text-foreground">{proposal.payment_terms}</p>
        </div>
        {proposal.shipping_type && (
          <div className={`col-span-2 flex items-center gap-2 px-2.5 py-2 rounded-lg border ${proposal.shipping_type === 'door_to_door' ? 'bg-emerald-50 border-emerald-200' : 'bg-blue-50 border-blue-200'}`}>
            <Icon name="TruckIcon" size={13} className={proposal.shipping_type === 'door_to_door' ? 'text-emerald-600 shrink-0' : 'text-blue-600 shrink-0'} />
            <div>
              <span className={`text-xs font-bold ${proposal.shipping_type === 'door_to_door' ? 'text-emerald-800' : 'text-blue-800'}`}>
                {proposal.shipping_type === 'door_to_door' ? m.doorToDoor : m.portWarehouse}
              </span>
              <p className={`text-[10px] ${proposal.shipping_type === 'door_to_door' ? 'text-emerald-600' : 'text-blue-600'}`}>
                {proposal.shipping_type === 'door_to_door' ? m.doorToDoorDesc : m.portWarehouseDesc}
              </p>
            </div>
          </div>
        )}
        {!proposal.shipping_type && proposal.incoterm && (
          <div className={`col-span-2 flex items-center gap-2 px-2.5 py-2 rounded-lg border ${proposal.incoterm === 'FOB' ? 'bg-blue-50 border-blue-200' : 'bg-amber-50 border-amber-200'}`}>
            <Icon name="TruckIcon" size={13} className={proposal.incoterm === 'FOB' ? 'text-blue-600 shrink-0' : 'text-amber-600 shrink-0'} />
            <div>
              <span className={`text-xs font-bold ${proposal.incoterm === 'FOB' ? 'text-blue-800' : 'text-amber-800'}`}>
                {proposal.incoterm}{proposal.incoterm === 'FOB' && proposal.port_of_loading ? ` — ${proposal.port_of_loading}` : ''}
              </span>
            </div>
          </div>
        )}
        {proposal.notes && (
          <div className="col-span-2">
            <p className="text-[10px] text-muted-foreground">{m.notes}</p>
            <p className="text-xs text-foreground">{proposal.notes}</p>
          </div>
        )}
        {isCustomQuote && !isOwn && (
          <div className="col-span-2 flex items-start gap-1.5 px-2 py-1.5 bg-blue-100 rounded-lg">
            <Icon name="InformationCircleIcon" size={12} className="text-blue-600 shrink-0 mt-0.5" />
            <p className="text-[10px] text-blue-700">{m.acceptInvoiceNote}</p>
          </div>
        )}
      </div>
      {!isOwn && canAct && (
        <div className="px-4 pb-3 flex gap-2">
          <button
            onClick={onAccept}
            disabled={isAccepting}
            className={`flex-1 h-8 text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60 ${isCustomQuote ? 'bg-blue-600 hover:bg-blue-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
          >
            {isAccepting ? (
              <><Icon name="ArrowPathIcon" size={13} className="animate-spin" /> {m.accepting}</>
            ) : (
              <><Icon name="CheckIcon" size={13} />{isCustomQuote ? m.acceptAndInvoice : m.acceptProposal}</>
            )}
          </button>
          <button
            onClick={onCounter}
            className="flex-1 h-8 bg-amber-50 text-amber-700 border border-amber-300 text-xs font-bold rounded-xl hover:bg-amber-100 transition-colors flex items-center justify-center gap-1.5"
          >
            <Icon name="ArrowPathIcon" size={13} />
            {m.counterProposal}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── New Proposal Modal ───────────────────────────────────────────────────────
function ProposalModal({ onClose, onSubmit, isCounter, prevProposal }: {
  onClose: () => void; onSubmit: (data: ProposalData) => void;
  isCounter?: boolean; prevProposal?: ProposalData;
}) {
  const { t } = useLanguage();
  const m = t.messaging;
  const paymentOptions = [m.payment30_70, m.payment50_50, m.payment100, m.paymentLC, m.payment30days];
  const [form, setForm] = useState<ProposalData>({
    price: prevProposal?.price || 0,
    quantity: prevProposal?.quantity || 100,
    currency: prevProposal?.currency || 'USD',
    delivery_days: prevProposal?.delivery_days || 30,
    payment_terms: prevProposal?.payment_terms || m.payment30_70,
    notes: '',
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Icon name="DocumentTextIcon" size={18} className="text-primary" />
            <h3 className="font-bold text-foreground">{isCounter ? m.counterProposal : m.submitQuote}</h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center">
            <Icon name="XMarkIcon" size={16} className="text-muted-foreground" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">{m.totalPrice}</label>
              <input type="number" value={form.price} onChange={e => setForm({ ...form, price: Number(e.target.value) })}
                className="w-full h-9 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary" placeholder="0" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">{m.currency}</label>
              <select value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })}
                className="w-full h-9 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary">
                <option value="USD">USD</option><option value="EUR">EUR</option>
                <option value="SAR">SAR</option><option value="AED">AED</option><option value="CNY">CNY</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">{m.quantityWithUnits}</label>
              <input type="number" value={form.quantity} onChange={e => setForm({ ...form, quantity: Number(e.target.value) })}
                className="w-full h-9 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">{m.deliveryTimeDays}</label>
              <input type="number" value={form.delivery_days} onChange={e => setForm({ ...form, delivery_days: Number(e.target.value) })}
                className="w-full h-9 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">{m.paymentTerms}</label>
            <select value={form.payment_terms} onChange={e => setForm({ ...form, payment_terms: e.target.value })}
              className="w-full h-9 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary">
              {paymentOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">{m.additionalNotes}</label>
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2}
              placeholder={m.notesPlaceholder}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary resize-none" />
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 h-10 border border-border rounded-xl text-sm font-semibold text-muted-foreground hover:bg-muted transition-colors">{m.cancel}</button>
            <button onClick={() => { if (form.price > 0) { onSubmit(form); onClose(); } }} disabled={form.price <= 0}
              className="flex-1 h-10 bg-primary text-primary-foreground rounded-xl text-sm font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
              <Icon name="PaperAirplaneIcon" size={15} />
              {m.sendProposal}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Custom Quote Modal (Factory Only) ───────────────────────────────────────
function CustomQuoteModal({ onClose, onSubmit, conversationId, buyerUserId, orderId }: {
  onClose: () => void; onSubmit: (quoteId: string, data: ProposalData) => void;
  conversationId: string; buyerUserId: string; orderId?: string;
}) {
  const { t } = useLanguage();
  const m = t.messaging;
  const paymentOptions = [m.payment30_70, m.payment50_50, m.payment100, m.paymentLC, m.payment30days];
  const [form, setForm] = useState<ProposalData>({
    price: 0, quantity: 100, currency: 'USD', delivery_days: 30,
    payment_terms: m.payment30_70, notes: '', shipping_type: undefined, factory_tax_ref: '',
  });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const handleSend = async () => {
    if (form.price <= 0 || form.quantity <= 0 || form.delivery_days <= 0) { setError(m.fillRequiredFields); return; }
    if (!form.shipping_type) { setError(m.selectShipping); return; }
    setSending(true); setError('');
    try {
      const res = await fetch('/api/quotes/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation_id: conversationId, order_id: orderId || null, buyer_user_id: buyerUserId, quoted_price: form.price, currency: form.currency, quantity: form.quantity, delivery_days: form.delivery_days, payment_terms: form.payment_terms, notes: form.notes, shipping_type: form.shipping_type, factory_tax_ref: form.factory_tax_ref || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || m.failedSendQuote);
      onSubmit(data.quote_id, form); onClose();
    } catch (err: any) { setError(err.message); } finally { setSending(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-gradient-to-r from-blue-50 to-indigo-50 sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <Icon name="DocumentTextIcon" size={16} className="text-white" />
            </div>
            <div>
              <h3 className="font-bold text-foreground text-sm">{m.sendCustomQuote}</h3>
              <p className="text-[10px] text-muted-foreground">{m.customQuoteSubtitle}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center">
            <Icon name="XMarkIcon" size={16} className="text-muted-foreground" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
              <Icon name="ExclamationCircleIcon" size={14} className="shrink-0" />{error}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">{m.totalPrice} <span className="text-red-500">*</span></label>
              <input type="number" value={form.price || ''} onChange={e => setForm({ ...form, price: Number(e.target.value) })}
                className="w-full h-9 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary" placeholder="0" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">{m.currency}</label>
              <select value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })}
                className="w-full h-9 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary">
                <option value="USD">USD</option><option value="EUR">EUR</option>
                <option value="SAR">SAR</option><option value="AED">AED</option><option value="CNY">CNY</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">{m.quantityWithUnits} <span className="text-red-500">*</span></label>
              <input type="number" value={form.quantity} onChange={e => setForm({ ...form, quantity: Number(e.target.value) })}
                className="w-full h-9 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">{m.deliveryDays} <span className="text-red-500">*</span></label>
              <input type="number" value={form.delivery_days} onChange={e => setForm({ ...form, delivery_days: Number(e.target.value) })}
                className="w-full h-9 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">{m.paymentTerms}</label>
            <select value={form.payment_terms} onChange={e => setForm({ ...form, payment_terms: e.target.value })}
              className="w-full h-9 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary">
              {paymentOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>
          <div className="space-y-3 p-3.5 bg-blue-50 border border-blue-200 rounded-xl">
            <div className="flex items-center gap-2 mb-1">
              <Icon name="TruckIcon" size={14} className="text-blue-700" />
              <span className="text-xs font-bold text-blue-800 uppercase tracking-wide">{m.shippingOption} <span className="text-red-500">*</span></span>
            </div>
            <div className="grid grid-cols-1 gap-2">
              <button type="button" onClick={() => setForm({ ...form, shipping_type: 'door_to_door' })}
                className={`flex items-start gap-3 p-3 rounded-xl border-2 text-start transition-all ${form.shipping_type === 'door_to_door' ? 'border-emerald-500 bg-emerald-50' : 'border-border bg-background hover:border-emerald-300'}`}>
                <span className="text-xl shrink-0">🏠</span>
                <div className="flex-1 text-start">
                  <span className="text-sm font-bold text-foreground block">{m.doorToDoorShort}</span>
                  <span className="text-[10px] text-muted-foreground leading-tight">{m.doorToDoorFormDesc}</span>
                </div>
                {form.shipping_type === 'door_to_door' && <Icon name="CheckCircleIcon" size={16} className="text-emerald-600 shrink-0 mt-0.5" />}
              </button>
              <button type="button" onClick={() => setForm({ ...form, shipping_type: 'port_warehouse' })}
                className={`flex items-start gap-3 p-3 rounded-xl border-2 text-start transition-all ${form.shipping_type === 'port_warehouse' ? 'border-blue-500 bg-blue-100' : 'border-border bg-background hover:border-blue-300'}`}>
                <span className="text-xl shrink-0">🚢</span>
                <div className="flex-1 text-start">
                  <span className="text-sm font-bold text-foreground block">{m.portWarehouseShort}</span>
                  <span className="text-[10px] text-muted-foreground leading-tight">{m.portWarehouseFormDesc}</span>
                </div>
                {form.shipping_type === 'port_warehouse' && <Icon name="CheckCircleIcon" size={16} className="text-blue-600 shrink-0 mt-0.5" />}
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">{m.additionalNotes}</label>
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2}
              placeholder={m.notesPlaceholder}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary resize-none" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">{m.taxRef} <span className="text-[10px] font-normal">{m.optional}</span></label>
            <input type="text" value={form.factory_tax_ref || ''} onChange={e => setForm({ ...form, factory_tax_ref: e.target.value })}
              placeholder={m.taxRefPlaceholder}
              className="w-full h-9 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary font-mono" />
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 h-10 border border-border rounded-xl text-sm font-semibold text-muted-foreground hover:bg-muted transition-colors">{m.cancel}</button>
            <button onClick={handleSend} disabled={sending || form.price <= 0}
              className="flex-1 h-10 bg-blue-600 text-white rounded-xl text-sm font-bold disabled:opacity-50 hover:bg-blue-700 transition-colors flex items-center justify-center gap-2">
              {sending ? <><Icon name="ArrowPathIcon" size={15} className="animate-spin" /> {m.sending}</> : <><Icon name="PaperAirplaneIcon" size={15} /> {m.sendCustomQuoteBtn}</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Three-dot Menu ───────────────────────────────────────────────────────────
function ThreeDotMenu({ onArchive, onDeleteAll, onNewGroup }: {
  onArchive: () => void; onDeleteAll: () => void; onNewGroup: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const { t } = useLanguage();
  const m = t.messaging;
  const items = [
    { icon: 'ArchiveBoxIcon', label: m.archiveConversations, action: onArchive, color: 'text-blue-600' },
    { icon: 'TrashIcon', label: m.deleteAll, action: onDeleteAll, color: 'text-red-600' },
    { icon: 'UserGroupIcon', label: m.newGroupChat, action: onNewGroup, color: 'text-emerald-600' },
  ];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors"
        aria-label={m.options}
      >
        <Icon name="EllipsisVerticalIcon" size={20} className="text-gray-600" />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-2xl shadow-xl z-50 overflow-hidden min-w-[200px] py-1">
          {items.map(item => (
            <button
              key={item.label}
              onClick={() => { item.action(); setOpen(false); }}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors text-right"
            >
              <Icon name={item.icon as any} size={16} className={item.color} />
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Chat Settings Dropdown (Avatar click) ────────────────────────────────────
function ChatSettingsDropdown({ conv, onClose, onMute, onArchive, onSearch, isMuted }: {
  conv: Conversation;
  onClose: () => void;
  onMute: () => void;
  onArchive: () => void;
  onSearch: () => void;
  isMuted: boolean;
}) {
  const { t, dir } = useLanguage();
  const m = t.messaging;
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute top-full right-0 mt-2 bg-white border border-gray-200 rounded-2xl shadow-2xl z-50 overflow-hidden min-w-[220px] py-1"
      style={{ direction: dir }}
    >
      {/* Supplier info header */}
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
        <p className="text-sm font-bold text-gray-900 truncate">{conv.supplier_name}</p>
        <p className="text-[11px] text-gray-400 truncate">{conv.product_name}</p>
      </div>
      {/* Actions */}
      <button
        onClick={() => { onSearch(); onClose(); }}
        className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors text-right"
      >
        <Icon name="MagnifyingGlassIcon" size={16} className="text-blue-500 shrink-0" />
        <span>{m.searchInChat}</span>
      </button>
      <button
        onClick={() => { onMute(); onClose(); }}
        className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors text-right"
      >
        {isMuted ? (
          <>
            <Icon name="BellIcon" size={16} className="text-emerald-500 shrink-0" />
            <span>{m.unmute}</span>
          </>
        ) : (
          <>
            <Icon name="BellSlashIcon" size={16} className="text-amber-500 shrink-0" />
            <span>{m.mute}</span>
          </>
        )}
      </button>
      <button
        onClick={() => { onArchive(); onClose(); }}
        className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors text-right"
      >
        <Icon name="ArchiveBoxIcon" size={16} className="text-purple-500 shrink-0" />
        <span>{m.archive}</span>
      </button>
    </div>
  );
}

// ─── Call Modal ───────────────────────────────────────────────────────────────
function CallModal({ type, supplierName, conversationId, userId, onClose }: {
  type: 'voice' | 'video';
  supplierName: string;
  conversationId: string;
  userId: string;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const m = t.messaging;
  const supabase = createClient();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const signalingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const [callStatus, setCallStatus] = useState<'connecting' | 'ringing' | 'active' | 'ended'>('connecting');
  const [isMuted, setIsMuted] = useState(false);
  const [isCamOff, setIsCamOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const callTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];

  const startCallTimer = useCallback(() => {
    callTimerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);
  }, []);

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const cleanup = useCallback(() => {
    if (callTimerRef.current) clearInterval(callTimerRef.current);
    if (localStreamRef.current) localStreamRef.current.getTracks().forEach(t => t.stop());
    if (pcRef.current) { pcRef.current.close(); pcRef.current = null; }
    if (signalingChannelRef.current) { supabase.removeChannel(signalingChannelRef.current); signalingChannelRef.current = null; }
  }, [supabase]);

  const handleEndCall = useCallback(() => {
    if (signalingChannelRef.current) {
      signalingChannelRef.current.send({ type: 'broadcast', event: 'call-signal', payload: { type: 'hangup', from: userId } });
    }
    cleanup();
    setCallStatus('ended');
    setTimeout(onClose, 1000);
  }, [cleanup, onClose, userId]);

  useEffect(() => {
    let mounted = true;

    const initCall = async () => {
      try {
        // Get local media
        const constraints = { audio: true, video: type === 'video' ? { width: 640, height: 480 } : false };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (!mounted) { stream.getTracks().forEach(t => t.stop()); return; }
        localStreamRef.current = stream;
        if (localVideoRef.current && type === 'video') {
          localVideoRef.current.srcObject = stream;
        }

        // Create peer connection
        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        pcRef.current = pc;
        stream.getTracks().forEach(track => pc.addTrack(track, stream));

        // Remote stream
        pc.ontrack = (event) => {
          if (remoteVideoRef.current && event.streams[0]) {
            remoteVideoRef.current.srcObject = event.streams[0];
            if (mounted) { setCallStatus('active'); startCallTimer(); }
          }
        };

        // Setup signaling via Supabase Realtime
        const channelName = `webrtc:${conversationId}`;
        const sigChannel = supabase.channel(channelName);
        signalingChannelRef.current = sigChannel;

        sigChannel.on('broadcast', { event: 'call-signal' }, async ({ payload }: any) => {
          if (!mounted || !pcRef.current || payload.from === userId) return;
          const pc = pcRef.current;

          if (payload.type === 'offer') {
            await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            sigChannel.send({ type: 'broadcast', event: 'call-signal', payload: { type: 'answer', sdp: answer, from: userId } });
            if (mounted) { setCallStatus('active'); startCallTimer(); }
          } else if (payload.type === 'answer') {
            await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          } else if (payload.type === 'ice-candidate' && payload.candidate) {
            try { await pc.addIceCandidate(new RTCIceCandidate(payload.candidate)); } catch {}
          } else if (payload.type === 'hangup') {
            cleanup();
            if (mounted) setCallStatus('ended');
            setTimeout(onClose, 1000);
          }
        });

        pc.onicecandidate = (event) => {
          if (event.candidate && signalingChannelRef.current) {
            signalingChannelRef.current.send({ type: 'broadcast', event: 'call-signal', payload: { type: 'ice-candidate', candidate: event.candidate, from: userId } });
          }
        };

        pc.onconnectionstatechange = () => {
          if (!mounted) return;
          if (pc.connectionState === 'connected') { setCallStatus('active'); startCallTimer(); }
          else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') { setCallStatus('ended'); setTimeout(onClose, 1500); }
        };

        await sigChannel.subscribe(async (status) => {
          if (status === 'SUBSCRIBED' && mounted) {
            // Caller creates offer
            setCallStatus('ringing');
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            sigChannel.send({ type: 'broadcast', event: 'call-signal', payload: { type: 'offer', sdp: offer, from: userId, callType: type } });
          }
        });

      } catch (err: any) {
        console.error('WebRTC init error:', err);
        if (mounted) { setCallStatus('ended'); setTimeout(onClose, 2000); }
      }
    };

    initCall();
    return () => { mounted = false; cleanup(); };
  }, []);

  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = isMuted; });
      setIsMuted(!isMuted);
    }
  };

  const toggleCamera = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach(t => { t.enabled = isCamOff; });
      setIsCamOff(!isCamOff);
    }
  };

  const statusLabel = callStatus === 'connecting' ? m.connecting : callStatus === 'ringing' ? m.ringing : callStatus === 'active' ? formatDuration(callDuration) : m.callEnded;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col" onClick={e => e.stopPropagation()}>
      {/* Remote video (full screen) */}
      {type === 'video' && (
        <video ref={remoteVideoRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover" />
      )}

      {/* Voice call background */}
      {type === 'voice' && (
        <div className="absolute inset-0 bg-gradient-to-b from-gray-900 to-black" />
      )}

      {/* Overlay */}
      <div className="relative z-10 flex flex-col h-full">
        {/* Top info */}
        <div className="flex flex-col items-center pt-16 pb-6">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mb-4 border-4 border-white/20 shadow-2xl">
            <span className="text-white text-3xl font-bold">{(supplierName || 'DH').slice(0, 2).toUpperCase()}</span>
          </div>
          <p className="text-white text-xl font-bold mb-1">{supplierName || 'DirectHub Supplier'}</p>
          <div className="flex items-center gap-2">
            {callStatus === 'active' && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />}
            <p className={`text-sm font-semibold ${callStatus === 'active' ? 'text-emerald-400' : 'text-white/60'}`}>{statusLabel}</p>
          </div>
          <p className="text-white/40 text-xs mt-1">{type === 'video' ? m.videoCallLabel : m.voiceCallLabel} · WebRTC</p>
        </div>

        {/* Local video (PiP) */}
        {type === 'video' && (
          <div className="absolute top-4 left-4 w-28 h-36 rounded-2xl overflow-hidden border-2 border-white/30 shadow-xl bg-gray-800">
            <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            {isCamOff && (
              <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
                <Icon name="VideoCameraSlashIcon" size={24} className="text-white/50" />
              </div>
            )}
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Controls */}
        <div className="pb-16 px-8">
          <div className="flex items-center justify-center gap-6">
            {/* Mute */}
            <button onClick={toggleMute}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${isMuted ? 'bg-red-500' : 'bg-white/20 hover:bg-white/30'}`}>
              <Icon name={isMuted ? 'MicrophoneIcon' : 'MicrophoneIcon'} size={22} className="text-white" />
              {isMuted && <span className="absolute w-0.5 h-8 bg-red-300 rotate-45 rounded-full" />}
            </button>

            {/* End Call */}
            <button onClick={handleEndCall}
              className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-xl transition-colors">
              <Icon name="PhoneXMarkIcon" size={26} className="text-white" />
            </button>

            {/* Camera toggle (video only) */}
            {type === 'video' ? (
              <button onClick={toggleCamera}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${isCamOff ? 'bg-red-500' : 'bg-white/20 hover:bg-white/30'}`}>
                <Icon name="VideoCameraIcon" size={22} className="text-white" />
              </button>
            ) : (
              <button className="w-14 h-14 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
                <Icon name="SpeakerWaveIcon" size={22} className="text-white" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Inner Component (uses useSearchParams) ───────────────────────────────────
function LiveMessagingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const supabase = createClient();
  const { language, dir, t, isRTL } = useLanguage();
  const m = t.messaging;
  const dealStatusLabel = (status?: string) => {
    const conf = DEAL_STATUS_CONFIG[status || 'open'];
    return conf ? m[conf.key] : m.open;
  };
  const threadLabel = (type?: string) => {
    const info = THREAD_LABELS[type || 'negotiation'];
    return info ? m[info.key] : m.negotiation;
  };

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
  const [filterType, setFilterType] = useState<'all' | 'negotiation' | 'rfq' | 'order'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showProposalModal, setShowProposalModal] = useState(false);
  const [isCounterProposal, setIsCounterProposal] = useState(false);
  const [counterProposalData, setCounterProposalData] = useState<ProposalData | undefined>();
  const [showCustomQuoteModal, setShowCustomQuoteModal] = useState(false);
  const [acceptingQuoteId, setAcceptingQuoteId] = useState<string | null>(null);
  const [quoteAcceptMsg, setQuoteAcceptMsg] = useState<{ success: boolean; text: string } | null>(null);
  const [dealStatusUpdating, setDealStatusUpdating] = useState(false);
  const [dealToken, setDealToken] = useState<string | null>(null);
  const [newMessageAlert, setNewMessageAlert] = useState<{ convId: string; senderName: string } | null>(null);
  const [inquiryCard, setInquiryCard] = useState<InquiryCardData | null>(null);

  // ── Chat header extra state ────────────────────────────────────────────────
  const [showAvatarSettings, setShowAvatarSettings] = useState(false);
  const [mutedConvIds, setMutedConvIds] = useState<Set<string>>(new Set());
  const [callModal, setCallModal] = useState<{ type: 'voice' | 'video'; supplierName: string; conversationId: string; userId: string } | null>(null);
  const [inChatSearch, setInChatSearch] = useState('');
  const [showInChatSearch, setShowInChatSearch] = useState(false);

  // ── Voice recording state ─────────────────────────────────────────────────
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingSecondsRef = useRef(0);
  const [hasMicSupport, setHasMicSupport] = useState(false);

  // ── Collapsible header state ───────────────────────────────────────────────
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const sidebarScrollRef = useRef<HTMLDivElement>(null);
  const lastScrollY = useRef(0);

  // ── Delete All Confirmation State ─────────────────────────────────────────
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);

  // ── Realtime Advanced State ─────────────────────────────────────────────────
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connecting');
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const presenceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const isTypingRef = useRef(false);

  // ── Translation State ────────────────────────────────────────────────────
  const [myLang, setMyLang] = useState<SupportedLang>('ar');
  const [translationCache, setTranslationCache] = useState<Record<string, { translated: string; targetLang: SupportedLang }>>({});
  const [translatingIds, setTranslatingIds] = useState<Set<string>>(new Set());
  const [showOriginalIds, setShowOriginalIds] = useState<Set<string>>(new Set());
  const [autoTranslate, setAutoTranslate] = useState(true);

  // ── Live Input Translation State (Alibaba-style floating preview) ─────────
  const [liveTranslation, setLiveTranslation] = useState('');
  const [isLiveTranslating, setIsLiveTranslating] = useState(false);
  const [liveTranslationLang, setLiveTranslationLang] = useState<SupportedLang>('en');
  const [showLangPicker, setShowLangPicker] = useState(false);
  const liveTranslationAbortRef = useRef<AbortController | null>(null);
  const liveTranslationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const liveTranslationCacheRef = useRef<Map<string, string>>(new Map());

  // ── Emoji Picker State ────────────────────────────────────────────────────
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // ── Mobile keyboard / visualViewport height ───────────────────────────────
  // We use a ref to the container and update a CSS custom property so that
  // the server-rendered HTML and the first client render are identical (both
  // use '100dvh'), avoiding the React hydration mismatch.
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      if (chatContainerRef.current) {
        chatContainerRef.current.style.height = `${vv.height}px`;
        chatContainerRef.current.style.maxHeight = `${vv.height}px`;
      }
    };
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const activeConv = conversations.find(c => c.id === activeConvId) || null;
  const { requireAuth } = useAuth();
  // Keep translation chrome from throwing if gate helper is present but unbound.
  // Default: show when counterpart looks international (see chatTranslationGate).
  const needsTranslation = needsChatTranslation({
    sellerCategory: activeConv?.seller_category,
    country: activeConv?.supplier_country,
  });

  // ── Collapsible header on sidebar scroll ──────────────────────────────────
  const handleSidebarScroll = useCallback(() => {
    const el = sidebarScrollRef.current;
    if (!el) return;
    const currentY = el.scrollTop;
    if (currentY > lastScrollY.current && currentY > 60) {
      setHeaderCollapsed(true);
    } else if (currentY < lastScrollY.current - 10) {
      setHeaderCollapsed(false);
    }
    lastScrollY.current = currentY;
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) router.push('/login');
  }, [user, authLoading, router]);

  // ── Presence & Typing Channel ─────────────────────────────────────────────
  useEffect(() => {
    if (!user || !activeConvId) return;
    if (presenceChannelRef.current) { supabase.removeChannel(presenceChannelRef.current); presenceChannelRef.current = null; }
    setOnlineUsers(new Set()); setTypingUsers(new Set());
    const presenceChannel = supabase.channel(`presence:conv:${activeConvId}`, { config: { presence: { key: user.id } } });
    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const online = new Set<string>();
        Object.values(state).forEach((presences: any[]) => { presences.forEach((p: any) => { if (p.user_id) online.add(p.user_id); }); });
        setOnlineUsers(online);
      })
      .on('presence', { event: 'join' }, ({ newPresences }: any) => {
        setOnlineUsers(prev => { const next = new Set(prev); newPresences?.forEach((p: any) => { if (p.user_id) next.add(p.user_id); }); return next; });
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }: any) => {
        setOnlineUsers(prev => { const next = new Set(prev); leftPresences?.forEach((p: any) => { if (p.user_id) next.delete(p.user_id); }); return next; });
        setTypingUsers(prev => { const next = new Set(prev); leftPresences?.forEach((p: any) => { if (p.user_id) next.delete(p.user_id); }); return next; });
      })
      .on('broadcast', { event: 'typing' }, ({ payload }: any) => {
        if (!payload?.user_id || payload.user_id === user.id) return;
        if (payload.is_typing) { setTypingUsers(prev => new Set(prev).add(payload.user_id)); }
        else { setTypingUsers(prev => { const next = new Set(prev); next.delete(payload.user_id); return next; }); }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') { setConnectionStatus('connected'); await presenceChannel.track({ user_id: user.id, online_at: new Date().toISOString() }); }
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') { setConnectionStatus('disconnected'); }
        else { setConnectionStatus('connecting'); }
      });
    presenceChannelRef.current = presenceChannel;
    return () => { if (presenceChannelRef.current) { supabase.removeChannel(presenceChannelRef.current); presenceChannelRef.current = null; } setOnlineUsers(new Set()); setTypingUsers(new Set()); };
  }, [user, activeConvId]);

  const broadcastTyping = useCallback((isTyping: boolean) => {
    if (!presenceChannelRef.current || !user) return;
    presenceChannelRef.current.send({ type: 'broadcast', event: 'typing', payload: { user_id: user.id, is_typing: isTyping } });
  }, [user]);

  const handleTypingInput = useCallback((value: string) => {
    setInputText(value);
    if (!isTypingRef.current && value.trim()) { isTypingRef.current = true; broadcastTyping(true); }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => { isTypingRef.current = false; broadcastTyping(false); }, 2000);
    if (!value.trim() && isTypingRef.current) { isTypingRef.current = false; broadcastTyping(false); if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current); }
    // Clear translation state only when input is fully cleared — do NOT touch it on every keystroke
    if (!value.trim()) {
      setIsLiveTranslating(false);
      setLiveTranslation('');
    }
  }, [broadcastTyping]);

  const stopTyping = useCallback(() => {
    if (isTypingRef.current) { isTypingRef.current = false; broadcastTyping(false); }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
  }, [broadcastTyping]);

  useEffect(() => { return () => { if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current); }; }, []);

  // ── Mic support detection ─────────────────────────────────────────────────
  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      typeof MediaRecorder !== 'undefined' &&
      typeof navigator.mediaDevices?.getUserMedia === 'function'
    ) {
      setHasMicSupport(true);
    }
  }, []);

  // ── Voice recording handler ───────────────────────────────────────────────
  const handleVoiceRecord = async () => {
    if (isRecording) {
      // Stop recording
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      setIsRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      audioChunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus' : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm' :'audio/ogg';

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        audioStreamRef.current?.getTracks().forEach(t => t.stop());
        audioStreamRef.current = null;
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        if (blob.size < 500) { setRecordingSeconds(0); return; }
        const duration = recordingSecondsRef.current;
        const localUrl = URL.createObjectURL(blob);
        const ext = mimeType.includes('ogg') ? 'ogg' : 'webm';
        const file = new File([blob], `voice-note-${Date.now()}.${ext}`, { type: mimeType });
        // Add optimistic audio message
        const optimisticId = `opt-voice-${Date.now()}`;
        const optimisticMsg: Message = {
          id: optimisticId,
          conversation_id: activeConvId || '',
          sender_id: user?.id || '',
          sender_role: user?.user_metadata?.role || 'buyer',
          message: m.voiceMessage,
          created_at: new Date().toISOString(),
          is_read: false,
          msg_type: 'text',
          attachment_type: mimeType,
          local_audio_url: localUrl,
          audio_duration: duration,
        };
        setMessages(prev => [...prev, optimisticMsg]);
        setRecordingSeconds(0);
        recordingSecondsRef.current = 0;
        // Upload and send via dedicated voice note sender
        sendVoiceNote(file, optimisticId, localUrl, duration);
      };

      recorder.start(100);
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingSecondsRef.current = 0;
      recordingTimerRef.current = setInterval(() => {
        recordingSecondsRef.current += 1;
        setRecordingSeconds(prev => prev + 1);
      }, 1000);
    } catch {
      // mic permission denied or not available
    }
  };

  // cleanup recording on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      audioStreamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  // ── Live Input Translation Effect (debounced, 200ms) ─────────────────────
  useEffect(() => {
    if (liveTranslationTimerRef.current) clearTimeout(liveTranslationTimerRef.current);
    if (!needsTranslation) {
      setLiveTranslation('');
      setIsLiveTranslating(false);
      liveTranslationAbortRef.current?.abort();
      return;
    }
    const trimmed = inputText.trim();
    if (!trimmed) {
      setLiveTranslation('');
      setIsLiveTranslating(false);
      return;
    }
    // Use the user-selected target language; auto-detect only when not manually set
    const targetLang: SupportedLang = liveTranslationLang;

    // Check client-side cache first for instant (100%) response
    const cacheKey = `${trimmed}__${targetLang}`;
    if (liveTranslationCacheRef.current.has(cacheKey)) {
      setLiveTranslation(liveTranslationCacheRef.current.get(cacheKey)!);
      return;
    }

    // Abort any in-flight request immediately on new keystroke
    liveTranslationAbortRef.current?.abort();
    // Do NOT set isLiveTranslating(true) here — keep previous translation visible while debouncing
    liveTranslationTimerRef.current = setTimeout(async () => {
      setIsLiveTranslating(true);
      try {
        liveTranslationAbortRef.current = new AbortController();
        const res = await fetch('/api/ai/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: trimmed, targetLanguage: targetLang }),
          signal: liveTranslationAbortRef.current.signal,
        });
        if (!res.ok) {
          setIsLiveTranslating(false);
          return;
        }
        const data = await res.json();
        const result = data.translated || '';
        if (result && result !== trimmed) {
          // Save to client-side cache to prevent duplicate requests
          liveTranslationCacheRef.current.set(cacheKey, result);
          setLiveTranslation(result);
        } else {
          setLiveTranslation('');
        }
      } catch {
        // keep previous translation on error — don't clear it
      } finally {
        setIsLiveTranslating(false);
      }
    }, 200);
    return () => {
      if (liveTranslationTimerRef.current) clearTimeout(liveTranslationTimerRef.current);
    };
  }, [inputText, liveTranslationLang, needsTranslation]);

  // Fetch conversations
  useEffect(() => {
    if (!user || authLoading) return;
    const fetchConvs = async () => {
      setLoadingConvs(true);
      try {
        const { data } = await supabase.from('chat_conversations').select('*').or(`buyer_id.eq.${user.id},manufacturer_id.eq.${user.id}`).order('last_message_at', { ascending: false });
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
          const withMeta = await Promise.all(data.map(async conv => {
            const { count } = await supabase.from('chat_messages').select('*', { count: 'exact', head: true }).eq('conversation_id', conv.id).eq('is_read', false).neq('sender_id', user.id);
            return {
              ...conv,
              unread_count: count || 0,
              thread_type: inferThreadType(conv),
              deal_status: conv.deal_status || 'open',
              seller_category: conv.manufacturer_id
                ? (categoryByManufacturer[conv.manufacturer_id] ?? null)
                : null,
            };
          }));
          setConversations(withMeta);
          const targetConvId = searchParams?.get('id') || searchParams?.get('conv');
          const targetProductId = searchParams?.get('productId');
          const targetSupplierId = searchParams?.get('supplierId');
          const isAr = language === 'ar';
          if (targetConvId) {
            setActiveConvId(targetConvId);
            if (typeof window !== 'undefined' && window.innerWidth < 768) setSidebarOpen(false);
          } else if (targetProductId) {
            // Resolve product: supplier_products → manufacturer_products → products
            let resolvedProductId = targetProductId;
            let productName = 'Product Inquiry';
            let supplierName = 'DirectHub Supplier';
            let supplierCountry = 'Global';
            let supplierFlag = '🏭';
            let manufacturerId: string | null = targetSupplierId || null;
            let supplierListing: { id: string; supplier_id: string; name: string; name_ar: string | null; sku: string | null; supplier_name: string; wholesale_price?: number; currency?: string; image_url?: string | null; unit?: string; moq?: number; min_order_qty?: number } | null = null;
            let card: InquiryCardData | null = null;
            try {
              const { data: spData } = await supabase.rpc('get_supplier_product_for_inquiry', { p_ref: targetProductId });
              const spRow = (Array.isArray(spData) ? spData[0] : spData) as typeof supplierListing | undefined;
              if (spRow?.id) {
                supplierListing = spRow;
                resolvedProductId = spRow.id;
                manufacturerId = spRow.supplier_id;
                productName = spRow.name_ar || spRow.name || productName;
                supplierName = spRow.supplier_name || supplierName;
                supplierCountry = 'اليمن';
                supplierFlag = '🏪';
                const moqVal = spRow.moq ?? spRow.min_order_qty;
                card = {
                  productId: targetProductId,
                  name: productName,
                  image: spRow.image_url || null,
                  priceText: formatInquiryPrice(spRow.wholesale_price, spRow.currency, isAr),
                  moqText: moqVal ? `${moqVal} ${spRow.unit || ''}`.trim() : (isAr ? 'حسب الاتفاق' : 'Negotiable'),
                };
              }
            } catch { /* not a supplier-listed product */ }

            // Factory catalogue (manufacturer_products): resolves factory + card data
            if (!supplierListing) {
              try {
                const safeRef = targetProductId.replace(/[^A-Za-z0-9_-]/g, '');
                const isUuidRef = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetProductId);
                const mpQuery = supabase.from('manufacturer_products').select('*');
                const { data: mp } = isUuidRef
                  ? await mpQuery.or(`id.eq.${targetProductId},agent_product_id.eq.${targetProductId}`).limit(1).maybeSingle()
                  : await mpQuery.or(`short_id.eq.${safeRef},slug.ilike.${safeRef.toLowerCase()},sku.ilike.${safeRef}`).limit(1).maybeSingle();
                if (mp?.id) {
                  resolvedProductId = mp.id;
                  const sellerRef: string | null = mp.registered_factory_id || mp.facility_id || mp.manufacturer_id || null;
                  manufacturerId = targetSupplierId || sellerRef;
                  productName = (isAr ? mp.name_ar : null) || mp.name || mp.name_ar || productName;
                  if (sellerRef) {
                    try {
                      const { data: fp } = await supabase.rpc('get_public_factory_profile', { p_ref: sellerRef });
                      const f = Array.isArray(fp) ? fp[0] : fp;
                      if (f?.company_name) supplierName = f.company_name;
                      if (f?.country_code === 'YE') { supplierCountry = 'اليمن'; }
                    } catch { /* optional */ }
                  }
                  const tiers = Array.isArray(mp.tiered_pricing) ? mp.tiered_pricing : [];
                  const tierMin = tiers.length > 0 ? Number(tiers[0]?.min_qty ?? tiers[0]?.minQty ?? 0) : 0;
                  const moqNum = tierMin || parseInt(String(mp.minimum_order_qty || mp.min_order_quantity || mp.moq || 1)) || 1;
                  const tierPrice = tiers.length > 0 ? Number(tiers[0]?.unit_price ?? tiers[0]?.unitPrice ?? tiers[0]?.price ?? 0) : 0;
                  const unitPrice = tierPrice || parseFloat(String(mp.unit_price || mp.price || 0)) || 0;
                  const origin = String(mp.origin_type || '').toLowerCase();
                  const cur = origin === 'international' ? 'USD' : origin === 'local' ? 'YER' : String(mp.currency || 'YER');
                  card = {
                    productId: targetProductId,
                    name: productName,
                    image: firstProductImage(mp),
                    priceText: formatInquiryPrice(unitPrice, cur, isAr),
                    moqText: `${moqNum} ${mp.unit || (isAr ? 'وحدة' : 'units')}`,
                  };
                }
              } catch { /* fall through to products table */ }
            }

            // Find existing conversation for this buyer + product (+ supplier when provided)
            const sameProduct = (c: Conversation) => c.product_id === resolvedProductId || c.product_id === targetProductId;
            const sameSupplier = (c: Conversation) => !manufacturerId || !c.manufacturer_id || c.manufacturer_id === manufacturerId;
            const existing = withMeta.find(c => sameProduct(c) && sameSupplier(c) && c.buyer_id === user.id)
              || withMeta.find(c => sameProduct(c) && sameSupplier(c));
            if (existing) {
              if (card) setInquiryCard({ ...card, convId: existing.id });
              setActiveConvId(existing.id);
              if (typeof window !== 'undefined' && window.innerWidth < 768) setSidebarOpen(false);
            } else {
              // Create a new negotiation thread (deal_status = open) for this product and open it
              try {
                if (!supplierListing && !card) {
                  const { data: productData } = await supabase
                    .from('products')
                    .select('*')
                    .eq('id', targetProductId)
                    .maybeSingle();
                  productName = productData?.name || productName;
                  supplierName = productData?.manufacturer_name || supplierName;
                  supplierCountry = productData?.country_of_origin || productData?.origin_country || supplierCountry;
                  manufacturerId = targetSupplierId || productData?.manufacturer_id || null;
                  if (productData?.id) {
                    card = {
                      productId: targetProductId,
                      name: productName,
                      image: firstProductImage(productData),
                      priceText: formatInquiryPrice(parseFloat(String(productData.unit_price || productData.price || 0)) || 0, productData.currency || 'USD', isAr),
                      moqText: String(productData.moq || productData.minimum_order_qty || productData.min_order_quantity || (isAr ? 'حسب الاتفاق' : 'Negotiable')),
                    };
                  }
                }

                let newSellerCategory: string | null = null;
                if (manufacturerId) {
                  try {
                    const { data: mfrProfile } = await supabase
                      .from('user_profiles')
                      .select('seller_category, country')
                      .eq('id', manufacturerId)
                      .maybeSingle();
                    newSellerCategory = mfrProfile?.seller_category ?? null;
                    if (mfrProfile?.country) supplierCountry = mfrProfile.country;
                  } catch { /* ignore */ }
                }

                const { data: created, error: createErr } = await supabase
                  .from('chat_conversations')
                  .insert({
                    buyer_id: user.id,
                    manufacturer_id: manufacturerId,
                    product_id: resolvedProductId,
                    product_name: productName,
                    supplier_name: supplierName,
                    supplier_country: supplierCountry,
                    supplier_flag: supplierFlag,
                    supplier_avatar: '',
                    last_message: '',
                    deal_status: 'open',
                  })
                  .select()
                  .single();

                if (!createErr && created) {
                  const inquiryText = isAr
                    ? `مرحباً، أرغب في الاستفسار عن المنتج: ${productName}${card ? ` — سعر الوحدة: ${card.priceText} — الحد الأدنى للطلب: ${card.moqText}` : ''}${supplierListing?.sku ? ` (SKU: ${supplierListing.sku})` : ''}. هل يمكنكم تزويدي بالتفاصيل وأفضل عرض سعر؟`
                    : `Hello, I'm interested in: ${productName}${card ? ` — Unit price: ${card.priceText} — MOQ: ${card.moqText}` : ''}${supplierListing?.sku ? ` (SKU: ${supplierListing.sku})` : ''}. Could you share details and your best quote?`;
                  await supabase.from('chat_messages').insert({
                    conversation_id: created.id,
                    sender_id: user.id,
                    sender_role: 'buyer',
                    message: inquiryText,
                    is_read: false,
                  });
                  await supabase.from('chat_conversations').update({ last_message: inquiryText, last_message_at: new Date().toISOString() }).eq('id', created.id);
                  if (supplierListing) {
                    try { await supabase.rpc('notify_supplier_product_inquiry', { p_conversation_id: created.id }); } catch { /* non-blocking */ }
                  }
                  if (card) setInquiryCard({ ...card, convId: created.id });
                  const newConv = {
                    ...created,
                    last_message: inquiryText,
                    unread_count: 0,
                    thread_type: inferThreadType(created),
                    deal_status: 'open' as const,
                    seller_category: newSellerCategory,
                  };
                  setConversations(prev => prev.some(c => c.id === created.id) ? prev : [newConv, ...prev]);
                  setActiveConvId(created.id);
                  if (typeof window !== 'undefined' && window.innerWidth < 768) setSidebarOpen(false);
                }
              } catch (convErr) {
                console.error('Error creating product conversation:', convErr);
              }
            }
          } else if (withMeta.length > 0 && !activeConvId) {
            setActiveConvId(withMeta[0].id);
          }
        }
      } catch (err) { console.error('Fetch conversations error:', err); } finally { setLoadingConvs(false); }
    };
    fetchConvs();
  }, [user, authLoading]);

  // Real-time conversations
  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel(`messaging-convs-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_conversations' }, async payload => {
        if (payload.eventType === 'INSERT') {
          const conv = payload.new as Conversation;
          if (conv.buyer_id === user.id || conv.manufacturer_id === user.id) {
            setConversations(prev => prev.some(c => c.id === conv.id) ? prev : [{ ...conv, unread_count: 0, thread_type: inferThreadType(conv), deal_status: 'open' }, ...prev]);
          }
        } else if (payload.eventType === 'UPDATE') {
          const updated = payload.new as Conversation;
          // Re-fetch unread count for this conversation on update
          const { count } = await supabase
            .from('chat_messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', updated.id)
            .eq('is_read', false)
            .neq('sender_id', user.id);
          setConversations(prev => prev.map(c =>
            c.id === updated.id
              ? { ...c, ...updated, unread_count: count || 0, thread_type: c.thread_type }
              : c
          ));
        }
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // Global unread tracking
  useEffect(() => {
    if (!user) return;
    const globalMsgsChannel = supabase.channel('messaging-global-msgs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (payload) => {
        const msg = payload.new as Message;
        if (msg.sender_id === user.id) return;
        if (msg.conversation_id === activeConvId) return;
        setConversations(prev => prev.map(c => {
          if (c.id === msg.conversation_id) {
            const newUnread = (c.unread_count || 0) + 1;
            setNewMessageAlert({ convId: c.id, senderName: c.supplier_name || m.newMessage });
            setTimeout(() => setNewMessageAlert(null), 4000);
            return { ...c, unread_count: newUnread, last_message: msg.message, last_message_at: msg.created_at };
          }
          return c;
        }));
      }).subscribe();
    return () => { supabase.removeChannel(globalMsgsChannel); };
  }, [user, activeConvId]);

  // Fetch messages
  useEffect(() => {
    if (!activeConvId || !user) return;
    const fetchMsgs = async () => {
      setLoadingMsgs(true);
      try {
        const { data } = await supabase.from('chat_messages').select('*').eq('conversation_id', activeConvId).order('created_at', { ascending: true });
        setMessages(data || []);
        await supabase.from('chat_messages').update({ is_read: true }).eq('conversation_id', activeConvId).neq('sender_id', user.id).eq('is_read', false);
        setConversations(prev => prev.map(c => c.id === activeConvId ? { ...c, unread_count: 0 } : c));
      } catch (err) { console.error('Fetch messages error:', err); } finally { setLoadingMsgs(false); }
    };
    fetchMsgs();
  }, [activeConvId, user]);

  // ── Pinned product inquiry card for a conversation opened by id ───────────
  useEffect(() => {
    if (!activeConvId || !user) return;
    const conv = conversations.find(c => c.id === activeConvId);
    if (!conv || !conv.product_id) return;
    if (inquiryCard && inquiryCard.convId === activeConvId) return;
    let cancelled = false;
    const isAr = language === 'ar';
    const pid = conv.product_id;
    const urlRef = searchParams?.get('productId') || pid;
    (async () => {
      let card: InquiryCardData | null = null;
      try {
        const { data: spData } = await supabase.rpc('get_supplier_product_for_inquiry', { p_ref: pid });
        const sp: any = Array.isArray(spData) ? spData[0] : spData;
        if (sp?.id) {
          const moqVal = sp.moq ?? sp.min_order_qty;
          card = {
            productId: urlRef,
            convId: activeConvId,
            name: sp.name_ar || sp.name || conv.product_name || '',
            image: sp.image_url || null,
            priceText: formatInquiryPrice(sp.wholesale_price, sp.currency, isAr),
            moqText: moqVal ? `${moqVal} ${sp.unit || ''}`.trim() : (isAr ? 'حسب الاتفاق' : 'Negotiable'),
          };
        }
      } catch { /* not a supplier listing */ }
      if (!card) {
        try {
          const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pid);
          if (isUuid) {
            const { data: mp } = await supabase.from('manufacturer_products').select('*').or(`id.eq.${pid},agent_product_id.eq.${pid}`).limit(1).maybeSingle();
            if (mp?.id) {
              const tiers = Array.isArray(mp.tiered_pricing) ? mp.tiered_pricing : [];
              const tierMin = tiers.length > 0 ? Number(tiers[0]?.min_qty ?? tiers[0]?.minQty ?? 0) : 0;
              const moqNum = tierMin || parseInt(String(mp.minimum_order_qty || mp.min_order_quantity || mp.moq || 1)) || 1;
              const tierPrice = tiers.length > 0 ? Number(tiers[0]?.unit_price ?? tiers[0]?.unitPrice ?? tiers[0]?.price ?? 0) : 0;
              const unitPrice = tierPrice || parseFloat(String(mp.unit_price || mp.price || 0)) || 0;
              const origin = String(mp.origin_type || '').toLowerCase();
              const cur = origin === 'international' ? 'USD' : origin === 'local' ? 'YER' : String(mp.currency || 'YER');
              card = {
                productId: urlRef,
                convId: activeConvId,
                name: (isAr ? mp.name_ar : null) || mp.name || mp.name_ar || conv.product_name || '',
                image: firstProductImage(mp),
                priceText: formatInquiryPrice(unitPrice, cur, isAr),
                moqText: `${moqNum} ${mp.unit || (isAr ? 'وحدة' : 'units')}`,
              };
            }
          }
        } catch { /* fall through */ }
      }
      if (!card) {
        try {
          const { data: pd } = await supabase.from('products').select('*').eq('id', pid).maybeSingle();
          if (pd?.id) {
            card = {
              productId: urlRef,
              convId: activeConvId,
              name: pd.name || conv.product_name || '',
              image: firstProductImage(pd),
              priceText: formatInquiryPrice(parseFloat(String(pd.unit_price || pd.price || 0)) || 0, pd.currency || 'USD', isAr),
              moqText: String(pd.moq || pd.minimum_order_qty || pd.min_order_quantity || (isAr ? 'حسب الاتفاق' : 'Negotiable')),
            };
          }
        } catch { /* ignore */ }
      }
      if (!card && conv.product_name) {
        card = {
          productId: urlRef,
          convId: activeConvId,
          name: conv.product_name,
          image: null,
          priceText: isAr ? 'تواصل لمعرفة السعر' : 'Contact for price',
          moqText: isAr ? 'حسب الاتفاق' : 'Negotiable',
        };
      }
      if (card && !cancelled) setInquiryCard(card);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConvId, user, conversations.length]);

  // On mobile, a conversation id in the URL opens that chat full-screen
  useEffect(() => {
    const target = searchParams?.get('id') || searchParams?.get('conv');
    if (target && activeConvId === target && typeof window !== 'undefined' && window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  }, [activeConvId, searchParams]);

  // Focus the message input once the targeted conversation has loaded
  useEffect(() => {
    const target = searchParams?.get('id') || searchParams?.get('conv');
    if (!target || activeConvId !== target || loadingMsgs) return;
    const timer = setTimeout(() => inputRef.current?.focus(), 150);
    return () => clearTimeout(timer);
  }, [activeConvId, loadingMsgs, searchParams]);

  // ── Stable Realtime messages subscription with auto-reconnect ────────────
  const msgReconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const msgChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const subscribeMsgChannel = useCallback((convId: string, userId: string) => {
    if (msgChannelRef.current) {
      supabase.removeChannel(msgChannelRef.current);
      msgChannelRef.current = null;
    }
    const channel = supabase
      .channel(`messaging-msgs:${convId}`, { config: { broadcast: { ack: true } } })
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `conversation_id=eq.${convId}` },
        async (payload) => {
          const msg = payload.new as Message;
          setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
          // Auto-scroll to bottom on new message
          setTimeout(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, 50);
          if (msg.sender_id !== userId) {
            await supabase.from('chat_messages').update({ is_read: true }).eq('id', msg.id);
            setConversations(prev => prev.map(c => c.id === convId ? { ...c, unread_count: 0 } : c));
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnectionStatus('connected');
          if (msgReconnectTimerRef.current) { clearTimeout(msgReconnectTimerRef.current); msgReconnectTimerRef.current = null; }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setConnectionStatus('disconnected');
          // Auto-reconnect after 3 seconds
          msgReconnectTimerRef.current = setTimeout(() => { subscribeMsgChannel(convId, userId); }, 3000);
        } else {
          setConnectionStatus('connecting');
        }
      });
    msgChannelRef.current = channel;
  }, []);

  useEffect(() => {
    if (!activeConvId || !user) return;
    subscribeMsgChannel(activeConvId, user.id);
    return () => {
      if (msgReconnectTimerRef.current) clearTimeout(msgReconnectTimerRef.current);
      if (msgChannelRef.current) { supabase.removeChannel(msgChannelRef.current); msgChannelRef.current = null; }
    };
  }, [activeConvId, user, subscribeMsgChannel]);

  // Auto-scroll on new messages
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Scroll to bottom when keyboard opens/closes (viewport height changes)
  useEffect(() => {
    if (chatContainerRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'instant' });
    }
  }, []);

  // Auto-translate ALL messages (both sent and received) — international chats only
  useEffect(() => {
    if (!needsTranslation || !autoTranslate || !user || messages.length === 0) return;
    // Translate ALL text messages that haven't been translated yet
    const untranslated = messages.filter(m => {
      if (!m.message) return false;
      if (translationCache[m.id]) return false;
      if (translatingIds.has(m.id)) return false;
      // Skip proposal/system/bilingual messages
      try {
        const parsed = JSON.parse(m.message);
        if (parsed.type === 'proposal' || parsed.type === 'custom_quote') return false;
        if (parsed.type === 'bilingual') return false; // already has both languages
      } catch { /* not JSON, is plain text */ }
      if (m.message.startsWith('[عرض سعر:')) return false;
      // For incoming messages: skip if already in Arabic (no need to translate)
      const isOwn = m.sender_id === user.id;
      if (!isOwn && myLang === 'ar' && isArabicText(m.message)) return false;
      return true;
    });
    untranslated.forEach(async msg => {
      setTranslatingIds(prev => new Set(prev).add(msg.id));
      // For sent messages: translate to opposite language
      // For received messages: translate to myLang (Arabic)
      const isOwn = msg.sender_id === user.id;
      const targetLang: SupportedLang = isOwn
        ? (myLang === 'ar' ? 'en' : myLang === 'en' ? 'ar' : myLang === 'zh' ? 'en' : 'en')
        : myLang;
      const translated = await translateText(msg.message, targetLang);
      setTranslationCache(prev => ({ ...prev, [msg.id]: { translated, targetLang } }));
      setTranslatingIds(prev => { const next = new Set(prev); next.delete(msg.id); return next; });
    });
  }, [messages, autoTranslate, myLang, user, needsTranslation]);

  useEffect(() => { setTranslationCache({}); setShowOriginalIds(new Set()); }, [myLang]);

  const handleAttachmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Accept by MIME type or by file extension for CAD/Office files
    const ext = file.name.split('.').pop()?.toLowerCase();
    const isAllowedExt = ['dwg', 'dxf', 'xlsx', 'xls', 'docx', 'doc'].includes(ext || '');
    const resolvedType = resolveFileType(file, ALLOWED_TYPES) || (isAllowedExt ? (file.type || 'application/octet-stream') : null);
    if (!resolvedType) { setPrivacyWarning(m.unsupportedFile); setTimeout(() => setPrivacyWarning(null), 4000); return; }
    if (file.size > MAX_SIZE) { setPrivacyWarning(m.fileTooLarge); setTimeout(() => setPrivacyWarning(null), 4000); return; }
    const previewUrl = resolvedType.startsWith('image/') ? URL.createObjectURL(file) : undefined;
    setPendingAttachment({ file, previewUrl, type: resolvedType });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const clearAttachment = useCallback(() => {
    if (pendingAttachment?.previewUrl) URL.revokeObjectURL(pendingAttachment.previewUrl);
    setPendingAttachment(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [pendingAttachment]);

  const translateMessage = async (msg: Message) => {
    if (translationCache[msg.id] || translatingIds.has(msg.id)) return;
    setTranslatingIds(prev => new Set(prev).add(msg.id));
    const isOwn = msg.sender_id === user?.id;
    const targetLang: SupportedLang = isOwn
      ? (myLang === 'ar' ? 'en' : myLang === 'en' ? 'ar' : myLang === 'zh' ? 'en' : 'en')
      : myLang;
    const translated = await translateText(msg.message, targetLang);
    setTranslationCache(prev => ({ ...prev, [msg.id]: { translated, targetLang } }));
    setTranslatingIds(prev => { const next = new Set(prev); next.delete(msg.id); return next; });
  };

  const toggleShowOriginal = (msgId: string) => {
    setShowOriginalIds(prev => { const next = new Set(prev); if (next.has(msgId)) next.delete(msgId); else next.add(msgId); return next; });
  };

  const sendMessage = async (text: string, attachment?: { file: File; previewUrl?: string; type: string }, proposalData?: ProposalData, preTranslated?: string, preTranslatedLang?: SupportedLang) => {
    if (!text.trim() && !attachment && !proposalData) return;
    if (sending || !activeConvId || !user) return;
    if (text.trim()) {
      const shield = sanitizeChatMessage(text.trim());
      if (shield.blocked) { setPrivacyWarning(shield.reason || m.privacyBlocked); setTimeout(() => setPrivacyWarning(null), 6000); return; }
    }
    stopTyping(); setSending(true);
    const optimisticId = `opt-${Date.now()}`;

    // Build bilingual payload if we have a pre-translated text (international chats only)
    const hasBilingual = needsTranslation && !proposalData && !!text.trim() && !!preTranslated && !!preTranslated.trim() && preTranslated.trim() !== text.trim();
    const bilingualJson = hasBilingual
      ? JSON.stringify({ type: 'bilingual', original: text.trim(), translated: preTranslated.trim(), translatedLang: preTranslatedLang || (myLang === 'ar' ? 'en' : 'ar') })
      : null;

    // Capture blob URL before clearing state so we can revoke it only AFTER
    // the optimistic message has been updated with the real public URL.
    const blobPreviewUrl = attachment?.previewUrl;

    const optimisticMsg: Message = {
      id: optimisticId, conversation_id: activeConvId, sender_id: user.id,
      sender_role: user.user_metadata?.role || 'buyer',
      message: proposalData
        ? m.priceLabel.replace('{currency}', proposalData.currency).replace('{price}', proposalData.price.toLocaleString())
        : (bilingualJson || text.trim()),
      created_at: new Date().toISOString(), is_read: false,
      msg_type: proposalData ? 'proposal' : 'text', proposal_data: proposalData,
      // Include attachment fields so the image preview renders immediately in the optimistic message
      attachment_url: attachment?.previewUrl,
      attachment_type: attachment?.type,
      attachment_name: attachment?.file.name,
    };
    setMessages(prev => [...prev, optimisticMsg]);
    setInputText('');
    // Clear attachment state WITHOUT revoking blob URL — revocation happens after real URL is saved
    setPendingAttachment(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    // Clear live translation bar immediately
    setLiveTranslation('');
    setIsLiveTranslating(false);

    // ── Dual-language: only translate if no pre-translation available (international only)
    if (needsTranslation && text.trim() && !proposalData && !hasBilingual) {
      const targetLang: SupportedLang = myLang === 'ar' ? 'en' : myLang === 'en' ? 'ar' : myLang === 'zh' ? 'en' : 'en';
      translateText(text.trim(), targetLang).then(translated => {
        if (translated && translated !== text.trim()) {
          setTranslationCache(prev => ({ ...prev, [optimisticId]: { translated, targetLang } }));
        }
      });
    }

    try {
      let attachmentUrl: string | undefined, attachmentType: string | undefined, attachmentName: string | undefined;
      if (attachment) {
        const ext = extensionForType(attachment.type);
        const filePath = `chat-attachments/${user.id}/${Date.now()}.${ext}`;
        const { data: uploadData, error: uploadError } = await supabase.storage.from('chat-media').upload(filePath, fileWithResolvedType(attachment.file, attachment.type), { contentType: attachment.type, upsert: false });
        if (!uploadError && uploadData) {
          // Private bucket: store a "bucket/path" reference; it is signed at render time
          attachmentUrl = `chat-media/${filePath}`; attachmentType = attachment.type; attachmentName = attachment.file.name;
          // Update optimistic message with real public URL before revoking blob URL
          setMessages(prev => prev.map(msg => msg.id === optimisticId
            ? { ...msg, attachment_url: attachmentUrl, attachment_type: attachmentType, attachment_name: attachmentName }
            : msg
          ));
        } else {
          // Upload failed — remove optimistic message and notify user
          setMessages(prev => prev.filter(msg => msg.id !== optimisticId));
          if (blobPreviewUrl) URL.revokeObjectURL(blobPreviewUrl);
          setPrivacyWarning(uploadError?.message || m.fileTooLarge || 'Failed to upload attachment. Please try again.');
          setTimeout(() => setPrivacyWarning(null), 5000);
          setSending(false);
          return;
        }
      }
      // Safe to revoke blob URL now — optimistic message has been updated with real URL
      if (blobPreviewUrl) URL.revokeObjectURL(blobPreviewUrl);

      const msgPayload: any = {
        conversation_id: activeConvId, sender_id: user.id, sender_role: user.user_metadata?.role || 'buyer',
        message: proposalData
          ? JSON.stringify({ type: 'proposal', data: proposalData })
          : (bilingualJson || text.trim()),
        is_read: false, attachment_url: attachmentUrl, attachment_type: attachmentType, attachment_name: attachmentName,
      };
      const { data: inserted, error } = await supabase.from('chat_messages').insert(msgPayload).select().single();
      if (!error && inserted) {
        // Update translationCache key from optimistic to real id (only for non-bilingual)
        if (!hasBilingual) {
          setTranslationCache(prev => {
            const optimisticTranslation = prev[optimisticId];
            if (!optimisticTranslation) return prev;
            const next = { ...prev };
            delete next[optimisticId];
            next[inserted.id] = optimisticTranslation;
            return next;
          });
        }
        setMessages(prev => prev.map(msg => msg.id === optimisticId ? { ...inserted, msg_type: proposalData ? 'proposal' : 'text', proposal_data: proposalData } : msg));
        await supabase.from('chat_conversations').update({
          last_message: proposalData ? m.lastMessageProposal.replace('{currency}', proposalData.currency).replace('{price}', proposalData.price.toLocaleString()) : text.trim().slice(0, 100),
          last_message_at: new Date().toISOString(),
        }).eq('id', activeConvId);

        // ── Notify recipient: new message ──────────────────────────────────
        if (activeConv) {
          const recipientId = user.id === activeConv.buyer_id
            ? activeConv.manufacturer_id
            : activeConv.buyer_id;
          if (recipientId) {
            const notifResult = await createNotification(supabase, 'new_message', recipientId, 'ar', {
              conversationId: activeConvId,
            });
            if (!notifResult.success) console.error('[Notification] Failed:', notifResult.error);
          }
        }
      } else if (error) {
        console.error('Insert message error:', error);
        setMessages(prev => prev.filter(msg => msg.id !== optimisticId));
      }
    } catch (err) { console.error('Send message error:', err); setMessages(prev => prev.filter(msg => msg.id !== optimisticId)); }
    finally { setSending(false); }
  };

  // ── Send voice note (skips optimistic add, uses existing optimistic msg) ──
  const sendVoiceNote = async (file: File, optimisticId: string, localUrl: string, duration: number) => {
    if (!activeConvId || !user) return;
    setSending(true);
    try {
      const ext = file.name.split('.').pop();
      const filePath = `chat-attachments/${user.id}/${Date.now()}.${ext}`;
      const { data: uploadData, error: uploadError } = await supabase.storage.from('chat-media').upload(filePath, file, { contentType: file.type, upsert: false });
      let attachmentUrl: string | undefined;
      if (!uploadError && uploadData) {
        attachmentUrl = `chat-media/${filePath}`;
      }
      const msgPayload: any = {
        conversation_id: activeConvId, sender_id: user.id, sender_role: user.user_metadata?.role || 'buyer',
        message: m.voiceMessage,
        is_read: false, attachment_url: attachmentUrl, attachment_type: file.type, attachment_name: file.name,
      };
      const { data: inserted, error } = await supabase.from('chat_messages').insert(msgPayload).select().single();
      if (!error && inserted) {
        setMessages(prev => prev.map(m =>
          m.id === optimisticId
            ? { ...inserted, local_audio_url: localUrl, audio_duration: duration }
            : m
        ));
        await supabase.from('chat_conversations').update({
          last_message: m.voiceMessage,
          last_message_at: new Date().toISOString(),
        }).eq('id', activeConvId);
      }
    } catch (err) { console.error('Voice note send error:', err); setMessages(prev => prev.filter(m => m.id !== optimisticId)); }
    finally { setSending(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() && !pendingAttachment) return;

    let translatedText = needsTranslation ? liveTranslation.trim() : '';
    const translatedLang = liveTranslationLang;

    // If translation is still loading or not yet available, fetch it now before sending
    if (needsTranslation && inputText.trim() && !translatedText) {
      const targetLang: SupportedLang = myLang === 'ar' ? 'en' : myLang === 'en' ? 'ar' : myLang === 'zh' ? 'en' : 'en';
      try {
        const res = await fetch('/api/ai/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: inputText.trim(), targetLanguage: targetLang }),
        });
        if (res.ok) {
          const data = await res.json();
          const result = (data.translated || '').trim();
          if (result && result !== inputText.trim()) {
            translatedText = result;
          }
        }
      } catch {
        // proceed without translation if fetch fails
      }
    }

    sendMessage(inputText, pendingAttachment || undefined, undefined, translatedText || undefined, translatedLang);
  };

  const handleProposalSubmit = (data: ProposalData) => {
    sendMessage('', undefined, data);
    if (activeConvId) {
      supabase.from('chat_conversations').update({ deal_status: 'in_progress', deal_value: data.price }).eq('id', activeConvId);
      setConversations(prev => prev.map(c => c.id === activeConvId ? { ...c, deal_status: 'in_progress', deal_value: data.price } : c));
    }
  };

  const handleAcceptProposal = async (proposal: ProposalData) => {
    if (!activeConvId || !user) return;
    await sendMessage(m.proposalAccepted.replace('{currency}', proposal.currency).replace('{price}', proposal.price.toLocaleString()).replace('{quantity}', proposal.quantity.toLocaleString()).replace('{units}', m.units).replace('{days}', String(proposal.delivery_days)).replace('{daysLabel}', m.days));
    await supabase.from('chat_conversations').update({ deal_status: 'agreed', deal_value: proposal.price }).eq('id', activeConvId);
    setConversations(prev => prev.map(c => c.id === activeConvId ? { ...c, deal_status: 'agreed', deal_value: proposal.price } : c));
  };

  const handleAcceptCustomQuote = async (quoteId: string, proposal: ProposalData) => {
    if (!user) return;
    setAcceptingQuoteId(quoteId); setQuoteAcceptMsg(null);
    try {
      const res = await fetch('/api/quotes/accept', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quote_id: quoteId }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || m.failedAccept);
      setQuoteAcceptMsg({ success: true, text: m.quoteAcceptedInvoice.replace('{invoice}', data.invoice_number ? m.invoiceNumber.replace('{number}', data.invoice_number) : '') });
      if (activeConvId) { setConversations(prev => prev.map(c => c.id === activeConvId ? { ...c, deal_status: 'agreed', deal_value: proposal.price } : c)); }
    } catch (err: any) { setQuoteAcceptMsg({ success: false, text: err.message }); }
    finally { setAcceptingQuoteId(null); }
  };

  const handleUpdateDealStatus = async (status: string) => {
    if (!activeConvId) return;
    setDealStatusUpdating(true);
    try { await supabase.from('chat_conversations').update({ deal_status: status }).eq('id', activeConvId); setConversations(prev => prev.map(c => c.id === activeConvId ? { ...c, deal_status: status as any } : c)); }
    finally { setDealStatusUpdating(false); }
  };

  const parseMessageContent = (msg: Message): { isProposal: boolean; proposal?: ProposalData; text: string; quoteId?: string; isBilingual?: boolean; bilingualOriginal?: string; bilingualTranslated?: string; bilingualTranslatedLang?: SupportedLang } => {
    if (msg.msg_type === 'proposal' && msg.proposal_data) return { isProposal: true, proposal: msg.proposal_data, text: '', quoteId: undefined };
    try {
      const parsed = JSON.parse(msg.message);
      if (parsed.type === 'custom_quote' && parsed.data) return { isProposal: true, proposal: parsed.data, text: '', quoteId: parsed.quote_id };
      if (parsed.type === 'proposal' && parsed.data) return { isProposal: true, proposal: parsed.data, text: '' };
      if (parsed.type === 'bilingual' && parsed.original) {
        return {
          isProposal: false,
          text: parsed.original,
          isBilingual: true,
          bilingualOriginal: parsed.original,
          bilingualTranslated: parsed.translated || '',
          bilingualTranslatedLang: parsed.translatedLang as SupportedLang,
        };
      }
    } catch { /* not JSON */ }
    return { isProposal: false, text: msg.message };
  };

  const filteredConvs = conversations.filter(c => {
    const matchesType = filterType === 'all' || c.thread_type === filterType;
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q
      || (c.supplier_name || '').toLowerCase().includes(q)
      || (c.product_name || '').toLowerCase().includes(q);
    return matchesType && matchesSearch;
  });

  const totalUnread = conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);
  const userRole = user?.user_metadata?.role || 'buyer';

  const handleDeleteAll = async () => {
    if (!user) return;
    setDeletingAll(true);
    try {
      const convIds = conversations.map(c => c.id);
      if (convIds.length > 0) {
        // Delete only messages sent by the current user — preserves the other party's view
        await supabase
          .from('chat_messages')
          .delete()
          .eq('sender_id', user.id)
          .in('conversation_id', convIds);

        // Delete only conversations where this user is the buyer (they initiated them)
        // Manufacturer-side conversations are owned by the buyer and must not be deleted
        await supabase
          .from('chat_conversations')
          .delete()
          .eq('buyer_id', user.id)
          .in('id', convIds);
      }
      setConversations([]);
      setActiveConvId(null);
      setMessages([]);
    } catch (err) {
      console.error('Failed to delete all conversations:', err);
    } finally {
      setDeletingAll(false);
      setShowDeleteAllConfirm(false);
    }
  };

  if (authLoading || loadingConvs) {
    return (
      <div className="bg-gray-50 flex flex-col overflow-hidden" dir={dir} style={{ height: '100dvh', maxHeight: '100dvh' }}>
        <Header />
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar skeleton */}
          <div className="flex flex-col w-full md:w-[340px] lg:w-[380px] shrink-0 bg-white border-l border-gray-200">
            {/* Header skeleton */}
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <div className="h-6 w-20 bg-gray-200 rounded-lg animate-pulse" />
              <div className="h-5 w-5 bg-gray-200 rounded-full animate-pulse" />
            </div>
            {/* Search skeleton */}
            <div className="px-4 pt-3 pb-3 space-y-2.5 border-b border-gray-100">
              <div className="h-9 w-full bg-gray-100 rounded-xl animate-pulse" />
              <div className="flex gap-1.5">
                {[1,2,3,4].map(i => (
                  <div key={i} className="flex-1 h-7 bg-gray-100 rounded-lg animate-pulse" />
                ))}
              </div>
            </div>
            {/* Conversation items skeleton */}
            <div className="flex-1 overflow-hidden">
              {[1,2,3,4,5].map(i => (
                <div key={i} className="px-4 py-3.5 border-b border-gray-100 flex items-start gap-3">
                  <div className="w-12 h-12 rounded-full bg-gray-200 animate-pulse shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="flex justify-between">
                      <div className="h-4 w-28 bg-gray-200 rounded animate-pulse" />
                      <div className="h-3 w-10 bg-gray-100 rounded animate-pulse" />
                    </div>
                    <div className="h-3 w-36 bg-gray-100 rounded animate-pulse" />
                    <div className="h-3 w-24 bg-gray-100 rounded animate-pulse" />
                    <div className="flex gap-1.5">
                      <div className="h-4 w-14 bg-gray-100 rounded-full animate-pulse" />
                      <div className="h-4 w-16 bg-gray-100 rounded-full animate-pulse" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {/* Bottom button skeleton */}
            <div className="p-3 border-t border-gray-100">
              <div className="h-10 w-full bg-gray-200 rounded-xl animate-pulse" />
            </div>
          </div>

          {/* Chat area skeleton */}
          <div className="flex-1 flex flex-col bg-white min-w-0 border-r border-gray-200">
            {/* Chat header skeleton */}
            <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gray-200 animate-pulse shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
                <div className="h-3 w-20 bg-gray-100 rounded animate-pulse" />
              </div>
              <div className="flex gap-1.5">
                {[1,2,3].map(i => (
                  <div key={i} className="w-8 h-8 rounded-full bg-gray-100 animate-pulse" />
                ))}
              </div>
            </div>
            {/* Messages area skeleton */}
            <div className="flex-1 bg-gray-50 px-4 py-4 space-y-3 overflow-hidden">
              {[
                { own: false, w: 'w-48' },
                { own: true, w: 'w-56' },
                { own: false, w: 'w-40' },
                { own: true, w: 'w-64' },
                { own: false, w: 'w-52' },
              ].map((item, i) => (
                <div key={i} className={`flex ${item.own ? 'justify-start' : 'justify-end'}`}>
                  <div className={`${item.w} h-10 rounded-2xl bg-gray-200 animate-pulse`} />
                </div>
              ))}
            </div>
            {/* Input area skeleton */}
            <div className="px-4 py-3 border-t border-gray-200 bg-white">
              <div className="h-12 w-full bg-gray-100 rounded-2xl animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Auth finished but session missing — avoid null user.id crashes while redirect settles
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

  const otherUserId = activeConv ? (activeConv.buyer_id === user.id ? activeConv.manufacturer_id : activeConv.buyer_id) : null;
  const isOtherOnline = otherUserId ? onlineUsers.has(otherUserId) : false;
  const isOtherTyping = otherUserId ? typingUsers.has(otherUserId) : false;

  return (
    <div
      ref={chatContainerRef}
      className="bg-gray-50 flex flex-col overflow-hidden min-w-0"
      dir={dir}
      style={{
        height: '100dvh',
        maxHeight: '100dvh',
      }}
    >
      <Header />

      {/* ─── Connection Status Banner ─────────────────────────────────────── */}
      {connectionStatus === 'disconnected' && activeConvId && (
        <div className="fixed top-0 left-0 right-0 z-[60] flex items-center justify-center gap-2 py-1 bg-red-600">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-white" />
            <span className="w-1.5 h-1.5 rounded-full bg-white/70" />
            <span className="w-1.5 h-1.5 rounded-full bg-white/40" />
          </div>
          <span className="text-white text-[11px] font-semibold">{m.connectionLost}</span>
        </div>
      )}

      {/* ─── New Message Alert Toast ─────────────────────────────────────── */}
      {newMessageAlert && (
        <div
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-gray-900 text-white px-4 py-3 rounded-2xl shadow-xl text-sm font-semibold cursor-pointer"
          onClick={() => { setActiveConvId(newMessageAlert.convId); setNewMessageAlert(null); }}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          {m.newMessageFrom.replace('{name}', newMessageAlert.senderName)}
          <Icon name="ChevronRightIcon" size={14} className="opacity-70" />
        </div>
      )}

      {/* ─── Full-screen messaging layout ─────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden min-w-0">

        {/* ══ SIDEBAR ════════════════════════════════════════════════════════ */}
        <div className={`${sidebarOpen ? 'flex' : 'hidden'} md:flex flex-col w-full md:w-[340px] lg:w-[380px] md:shrink-0 bg-white border-l border-gray-200 overflow-hidden`} style={{ minWidth: 0, maxWidth: '100%' }}>

          {/* ── Collapsible Header ─────────────────────────────────────────── */}
          <div
            className="overflow-hidden shrink-0"
            style={{ maxHeight: headerCollapsed ? '52px' : '160px' }}
          >
            {/* Title row — always visible */}
            <div className="flex items-center justify-between px-3 sm:px-4 py-3 border-b border-gray-100 bg-white">
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold text-gray-900">{m.messages}</h1>
                {totalUnread > 0 && (
                  <span className="min-w-[22px] h-5 bg-red-600 text-white text-[11px] font-bold rounded-full flex items-center justify-center px-1.5 shadow-sm ring-2 ring-red-100 animate-pulse">
                    {totalUnread}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {/* Connection dot */}
                <span className={`w-2 h-2 rounded-full ${connectionStatus === 'connected' ? 'bg-emerald-500' : connectionStatus === 'connecting' ? 'bg-amber-400 animate-pulse' : 'bg-red-500'}`} />
                <ThreeDotMenu
                  onArchive={() => {/* archive action */}}
                  onDeleteAll={() => setShowDeleteAllConfirm(true)}
                  onNewGroup={() => {/* new group action */}}
                />
              </div>
            </div>

            {/* Search + Filters — collapse on scroll */}
            <div className="px-3 sm:px-4 pt-2.5 pb-2.5 space-y-2 bg-white border-b border-gray-100">
              {/* Search */}
              <div className="relative">
                <Icon name="MagnifyingGlassIcon" size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder={m.searchPlaceholder}
                  className="w-full h-9 pr-9 pl-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 text-sm focus:outline-none focus:border-primary focus:bg-white transition-colors"
                />
              </div>
              {/* Filter tabs — scrollable on mobile */}
              <div className="flex gap-1.5 overflow-x-auto -mx-0.5 px-0.5" style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
                {(['all', 'negotiation', 'rfq', 'order'] as const).map(type => (
                  <button
                    key={type}
                    onClick={() => setFilterType(type)}
                    className={`shrink-0 py-1.5 px-2.5 sm:px-3 text-[10px] sm:text-[11px] font-semibold rounded-lg transition-all whitespace-nowrap ${filterType === type ? 'bg-primary text-white shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                  >
                    {type === 'all' ? m.all : threadLabel(type)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── Conversations List ─────────────────────────────────────────── */}
          <div
            ref={sidebarScrollRef}
            onScroll={handleSidebarScroll}
            className="flex-1 overflow-y-auto overflow-x-hidden pb-16 md:pb-0"
          >
            {filteredConvs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-16 px-6 text-center">
                <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                  <Icon name="ChatBubbleLeftRightIcon" size={28} className="text-gray-400" />
                </div>
                <p className="text-sm font-semibold text-gray-700 mb-1">{m.noConversations}</p>
                <p className="text-xs text-gray-400">{m.noConversationsSubtitle}</p>
              </div>
            ) : filteredConvs.map(conv => {
              const threadInfo = THREAD_LABELS[conv.thread_type || 'negotiation'];
              const dealConf = DEAL_STATUS_CONFIG[conv.deal_status || 'open'];
              const isActive = conv.id === activeConvId;
              const convOtherId = conv.buyer_id === user?.id ? conv.manufacturer_id : conv.buyer_id;
              const convOtherOnline = convOtherId ? onlineUsers.has(convOtherId) : false;

              return (
                <button
                  key={conv.id}
                  onClick={() => { setActiveConvId(conv.id); if (typeof window !== 'undefined' && window.innerWidth < 768) setSidebarOpen(false); }}
                  className={`w-full text-right px-3 sm:px-4 py-3 border-b border-gray-100 transition-colors relative ${isActive ? 'bg-blue-50 border-r-[3px] border-r-primary' : 'hover:bg-gray-50'}`}
                >
                  {/* Unread indicator line */}
                  {(conv.unread_count || 0) > 0 && !isActive && (
                    <span className="absolute right-0 top-0 bottom-0 w-1.5 bg-red-600 rounded-l-full" />
                  )}
                  <div className="flex items-start gap-2.5 min-w-0">
                    <SupplierAvatar
                      src={conv.supplier_avatar}
                      name={conv.supplier_name}
                      size={44}
                      online={convOtherOnline}
                      unread={conv.unread_count || 0}
                    />
                    <div className="flex-1 min-w-0 overflow-hidden">
                      {/* Row 1: name + time */}
                      <div className="flex items-center justify-between mb-0.5 gap-1">
                        <p className={`text-sm truncate flex-1 ${(conv.unread_count || 0) > 0 ? 'font-bold text-gray-900' : 'font-semibold text-gray-800'}`}>
                          {conv.supplier_name}
                          {conv.supplier_flag && <span className="mr-1 text-xs">{conv.supplier_flag}</span>}
                        </p>
                        <div className="flex items-center gap-1 shrink-0">
                          {(conv.unread_count || 0) > 0 && (
                            <span className="min-w-[18px] h-[18px] bg-red-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 shadow-sm ring-2 ring-red-100">
                              {(conv.unread_count || 0) > 99 ? '99+' : conv.unread_count}
                            </span>
                          )}
                          <span className="text-[10px] text-gray-400">{formatTime(conv.last_message_at || '', language, m.yesterday)}</span>
                        </div>
                      </div>
                      {/* Row 2: product name */}
                      <p className="text-[11px] text-gray-500 truncate mb-0.5">{conv.product_name}</p>
                      {/* Row 3: last message */}
                      <p className={`text-[11px] truncate mb-1 ${(conv.unread_count || 0) > 0 ? 'font-semibold text-gray-700' : 'text-gray-400'}`}>
                        {conv.last_message || m.startConversation}
                      </p>
                      {/* Row 4: badges */}
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className={`text-[9px] sm:text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${threadInfo?.color}`}>
                          {threadLabel(conv.thread_type)}
                        </span>
                        <span className={`text-[9px] sm:text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${dealConf?.bg} ${dealConf?.color}`}>
                          {dealStatusLabel(conv.deal_status)}
                        </span>
                        {conv.deal_value && conv.deal_value > 0 && (
                          <span className="text-[9px] sm:text-[10px] font-bold text-primary mr-auto">${conv.deal_value.toLocaleString()}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ══ CHAT AREA ════════════════════════════════════════════════════════ */}
        <div className={`${sidebarOpen ? 'hidden md:flex' : 'flex'} flex-1 flex-col bg-white min-w-0 border-r border-gray-200 overflow-hidden`}>
          {!activeConv ? (
            /* Empty state */
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-gray-50 pb-20 md:pb-8">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-white shadow-md flex items-center justify-center mb-4">
                <Icon name="ChatBubbleLeftRightIcon" size={36} className="text-primary" />
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">{m.hubTitle}</h2>
              <p className="text-xs sm:text-sm text-gray-500 max-w-sm mb-6">{m.hubSubtitle}</p>
              <div className="grid grid-cols-2 gap-2.5 max-w-xs w-full">
                {[
                  { icon: 'DocumentTextIcon', label: m.featureQuotes, color: 'text-blue-600 bg-blue-50 border-blue-100' },
                  { icon: 'ArrowPathIcon', label: m.featureCounters, color: 'text-amber-600 bg-amber-50 border-amber-100' },
                  { icon: 'CheckCircleIcon', label: m.featureDeals, color: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
                  { icon: 'ShieldCheckIcon', label: m.featureEscrow, color: 'text-purple-600 bg-purple-50 border-purple-100' },
                ].map(f => (
                  <div key={f.label} className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border ${f.color}`}>
                    <Icon name={f.icon as any} size={16} />
                    <span className="text-xs font-semibold">{f.label}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* ── Chat Header ─────────────────────────────────────────────── */}
              <div className="px-3 sm:px-4 py-2.5 border-b border-gray-200 bg-white shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  {/* Back button (mobile) */}
                  <button onClick={() => setSidebarOpen(true)} className="md:hidden w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center shrink-0" title={m.back}>
                    <Icon name={isRTL ? 'ArrowRightIcon' : 'ArrowLeftIcon'} size={17} className="text-gray-600" />
                  </button>

                  {/* Clickable Avatar — opens settings dropdown */}
                  <div className="relative shrink-0">
                    <button
                      onClick={() => setShowAvatarSettings(v => !v)}
                      className="rounded-full focus:outline-none focus:ring-2 focus:ring-primary/40 active:scale-95"
                      title={m.chatSettings}
                    >
                      <SupplierAvatar src={activeConv.supplier_avatar} name={activeConv.supplier_name} size={38} online={isOtherOnline} />
                    </button>
                    {showAvatarSettings && (
                      <ChatSettingsDropdown
                        conv={activeConv}
                        onClose={() => setShowAvatarSettings(false)}
                        isMuted={mutedConvIds.has(activeConv.id)}
                        onMute={() => setMutedConvIds(prev => {
                          const next = new Set(prev);
                          if (next.has(activeConv.id)) next.delete(activeConv.id);
                          else next.add(activeConv.id);
                          return next;
                        })}
                        onArchive={() => {/* archive action */}}
                        onSearch={() => { setShowInChatSearch(true); setInChatSearch(''); }}
                      />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <div className="flex items-center gap-1">
                      <p className="text-sm font-bold text-gray-900 truncate">{activeConv.supplier_name || 'DirectHub Supplier'}</p>
                      {activeConv.supplier_flag && <span className="text-sm shrink-0">{activeConv.supplier_flag}</span>}
                      {mutedConvIds.has(activeConv.id) && (
                        <Icon name="BellSlashIcon" size={12} className="text-gray-400 shrink-0" title={m.notificationsMuted} />
                      )}
                    </div>
                    {isOtherTyping ? (
                      <div className="flex items-center gap-1">
                        <span className="flex gap-0.5 items-end h-3">
                          <span className="w-1 h-1 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-1 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-1 h-1 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </span>
                        <span className="text-xs text-emerald-600 font-semibold">{m.typing}</span>
                      </div>
                    ) : isOtherOnline ? (
                      <p className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />{m.onlineNow}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-400 truncate">{activeConv.product_name || ''}</p>
                    )}
                  </div>

                  {/* Actions — compact on mobile */}
                  <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
                    {/* Voice Call */}
                    <button
                      onClick={() => setCallModal({ type: 'voice', supplierName: activeConv.supplier_name || 'DirectHub Supplier', conversationId: activeConv.id, userId: user.id })}
                      className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-emerald-50 border border-transparent hover:border-emerald-200 transition-colors"
                      title={m.voiceCall}
                    >
                      <Icon name="PhoneIcon" size={15} className="text-emerald-600" />
                    </button>

                    {/* Video Call */}
                    <button
                      onClick={() => setCallModal({ type: 'video', supplierName: activeConv.supplier_name || 'DirectHub Supplier', conversationId: activeConv.id, userId: user.id })}
                      className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-blue-50 border border-transparent hover:border-blue-200 transition-colors"
                      title={m.videoCall}
                    >
                      <Icon name="VideoCameraIcon" size={15} className="text-blue-600" />
                    </button>

                    {/* Store / Minisite Link */}
                    <Link
                      href={`/storefront/${activeConv.manufacturer_id || activeConv.buyer_id}`}
                      className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-orange-50 border border-transparent hover:border-orange-200 transition-colors"
                      title={m.visitStore}
                    >
                      <Icon name="BuildingStorefrontIcon" size={15} className="text-orange-500" />
                    </Link>

                    {/* Deal Status — icon only with dropdown */}
                    <div className="relative group">
                      <button
                        className={`w-8 h-8 rounded-full flex items-center justify-center border transition-colors ${DEAL_STATUS_CONFIG[activeConv.deal_status || 'open']?.bg} ${DEAL_STATUS_CONFIG[activeConv.deal_status || 'open']?.color} hover:opacity-80`}
                        title={dealStatusLabel(activeConv.deal_status)}
                      >
                        <Icon name="TagIcon" size={14} />
                      </button>
                      <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-10 hidden group-hover:block min-w-[140px]">
                        {Object.entries(DEAL_STATUS_CONFIG).map(([key, conf]) => (
                          <button key={key} onClick={() => handleUpdateDealStatus(key)} disabled={dealStatusUpdating}
                            className="w-full text-start px-3 py-1.5 text-xs hover:bg-gray-50 transition-colors text-gray-700">
                            {m[conf.key]}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Place Order */}
                    {activeConv.deal_status === 'agreed' && (
                      <Link href={dealToken ? `/pay/deal/${dealToken}` : '/checkout'} className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 transition-colors">
                        <Icon name="ShoppingBagIcon" size={12} />
                        {m.placeOrder}
                      </Link>
                    )}
                  </div>
                </div>
              </div>

              {/* ── In-Chat Search Bar ───────────────────────────────────────── */}
              {showInChatSearch && (
                <div className="px-3 sm:px-4 py-2 border-b border-gray-200 bg-blue-50 flex items-center gap-2 shrink-0">
                  <Icon name="MagnifyingGlassIcon" size={15} className="text-blue-500 shrink-0" />
                  <input
                    type="text"
                    value={inChatSearch}
                    onChange={e => setInChatSearch(e.target.value)}
                    placeholder={m.searchInMessages}
                    autoFocus
                    className="flex-1 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none min-w-0"
                  />
                  <button
                    onClick={() => { setShowInChatSearch(false); setInChatSearch(''); }}
                    className="w-6 h-6 rounded-full hover:bg-blue-200 flex items-center justify-center transition-colors shrink-0"
                  >
                    <Icon name="XMarkIcon" size={13} className="text-gray-500" />
                  </button>
                </div>
              )}

              {/* ── Pinned Product Inquiry Card ───────────────────────────────── */}
              {inquiryCard && inquiryCard.convId === activeConv.id && (
                <ProductInquiryCard data={inquiryCard} isAr={language === 'ar'} />
              )}

              {/* ── Messages Area ────────────────────────────────────────────── */}
              <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 sm:px-4 py-3 space-y-3 bg-gray-50">
                {loadingMsgs ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 rounded-full bg-white shadow flex items-center justify-center mx-auto mb-3">
                      <Icon name="ChatBubbleLeftRightIcon" size={28} className="text-gray-400" />
                    </div>
                    <p className="text-sm font-semibold text-gray-700 mb-1">{m.startNegotiation}</p>
                    <p className="text-xs text-gray-400">{m.startNegotiationHint}</p>
                  </div>
                ) : messages.filter(m => !inChatSearch || m.message.toLowerCase().includes(inChatSearch.toLowerCase())).map(msg => {
                  const isOwn = msg.sender_id === user?.id;
                  const { isProposal, proposal, text, quoteId, isBilingual, bilingualOriginal, bilingualTranslated, bilingualTranslatedLang } = parseMessageContent(msg);
                  const cached = translationCache[msg.id];
                  const isTranslating = translatingIds.has(msg.id);
                  const showOriginal = showOriginalIds.has(msg.id);
                  // For incoming messages: show bilingual bubble whenever translation exists (even if similar)
                  // For sent messages: only show if translation is meaningfully different
                  const hasTranslation = isOwn
                    ? (!!cached?.translated && cached.translated !== text && cached.translated !== msg.message)
                    : (!!cached?.translated && cached.translated !== msg.message);
                  const currentLangOption = LANG_OPTIONS.find(l => l.value === myLang);
                  // For sent messages, the target lang is the opposite of myLang
                  const sentTargetLang: SupportedLang = cached?.targetLang || (myLang === 'ar' ? 'en' : myLang === 'en' ? 'ar' : myLang === 'zh' ? 'en' : 'en');
                  const sentTargetLangOption = LANG_OPTIONS.find(l => l.value === sentTargetLang);
                  // For bilingual messages
                  const bilingualTargetLangOption = LANG_OPTIONS.find(l => l.value === bilingualTranslatedLang);

                  return (
                    <div key={msg.id} className={`flex ${isOwn ? 'justify-start' : 'justify-end'} gap-2`}>
                      {!isOwn && (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0 mt-1">
                          <span className="text-white text-[11px] font-bold">{(activeConv?.supplier_name || '?').slice(0, 2)}</span>
                        </div>
                      )}
                      <div className={`max-w-[72%] ${isProposal ? 'w-72' : ''}`}>
                        {isProposal && proposal ? (
                          <ProposalCard
                            proposal={proposal} isOwn={isOwn} canAct={!isOwn}
                            onAccept={() => { if (quoteId) { handleAcceptCustomQuote(quoteId, proposal); } else { handleAcceptProposal(proposal); } }}
                            onCounter={() => { setIsCounterProposal(true); setCounterProposalData(proposal); setShowProposalModal(true); }}
                            isCustomQuote={!!quoteId} isAccepting={acceptingQuoteId === quoteId}
                          />
                        ) : (
                          <div className="space-y-1">
                            {/* ── Audio / Voice Note Player ── */}
                            {(() => {
                              const isVoiceNote = !!(
                                msg.local_audio_url ||
                                (msg.attachment_url && msg.attachment_type?.startsWith('audio/')) ||
                                (msg.attachment_url && (msg.message?.includes('🎙️') || msg.message?.includes('رسالة صوتية')))
                              );
                              const audioSrc = msg.local_audio_url || msg.attachment_url;
                              return isVoiceNote && audioSrc ? (
                                <div className={`px-3 py-2.5 rounded-2xl ${isOwn ? 'bg-primary rounded-tr-sm' : 'bg-white border border-gray-200 rounded-tl-sm'} shadow-sm`}>
                                  <AudioMessageBubble
                                    audioUrl={audioSrc}
                                    duration={msg.audio_duration || 0}
                                    isOwn={isOwn}
                                  />
                                </div>
                              ) : null;
                            })()}
                            {msg.attachment_url && !msg.attachment_type?.startsWith('audio/') && !(msg.message?.includes('🎙️') || msg.message?.includes('رسالة صوتية')) && (
                              <div className="mb-1">
                                <ChatAttachmentView
                                  url={msg.attachment_url}
                                  name={msg.attachment_name || m.attachment}
                                  type={msg.attachment_type}
                                  tone="dark"
                                />
                              </div>
                            )}
                            {text && !(msg.local_audio_url || (msg.attachment_url && msg.attachment_type?.startsWith('audio/')) || (msg.attachment_url && (msg.message?.includes('🎙️') || msg.message?.includes('رسالة صوتية')))) && !(msg.message?.includes('🎙️') && msg.message?.includes('رسالة صوتية')) && (
                              <>
                                {/* ── Bilingual bubble (embedded translation from send) ── */}
                                {needsTranslation && isBilingual && bilingualOriginal && bilingualTranslated ? (
                                  isOwn ? (
                                    /* Sent bilingual: original on top, translation below */
                                    <div className="rounded-2xl rounded-tr-sm bg-primary overflow-hidden shadow-sm">
                                      <div className="px-4 pt-3 pb-2">
                                        <p className="text-sm leading-relaxed text-white whitespace-pre-wrap">{bilingualOriginal}</p>
                                      </div>
                                      <div className="flex items-center gap-2 px-4 py-1.5 bg-white/10 border-t border-white/20">
                                        <span className="text-[9px] font-bold text-white/80 bg-white/20 border border-white/30 px-1.5 py-0.5 rounded-full tracking-wide">DirectHub Translate</span>
                                        <span className="text-[10px] text-white/60">{bilingualTargetLangOption?.flag} {bilingualTargetLangOption?.nativeName}</span>
                                      </div>
                                      <div className="px-4 pt-2 pb-3 bg-white/10">
                                        <p className="text-sm leading-relaxed text-white/90 whitespace-pre-wrap">{bilingualTranslated}</p>
                                      </div>
                                    </div>
                                  ) : (
                                    /* Received bilingual: Arabic translation on top (prominent), original below */
                                    <div className="rounded-2xl rounded-tl-sm bg-white border border-gray-200 shadow-sm overflow-hidden">
                                      <div className="px-4 pt-3 pb-2">
                                        <p className="text-sm leading-relaxed text-gray-800 whitespace-pre-wrap" dir={isArabicText(bilingualTranslated) ? 'rtl' : undefined}>{bilingualTranslated}</p>
                                      </div>
                                      <div className="flex items-center gap-2 px-4 py-1.5 bg-blue-50 border-t border-blue-100">
                                        <span className="text-[9px] font-bold text-blue-600 bg-blue-100 border border-blue-200 px-1.5 py-0.5 rounded-full tracking-wide">DirectHub Translate</span>
                                        <span className="text-[10px] text-blue-400">{bilingualTargetLangOption?.flag} {bilingualTargetLangOption?.nativeName}</span>
                                        <span className="mr-auto text-[10px] text-gray-400 italic">{bilingualOriginal}</span>
                                      </div>
                                    </div>
                                  )
                                ) : (
                                  <>
                                    {/* ── Dual-language bubble (Alibaba style, from translationCache) ── */}
                                    {needsTranslation && isOwn && hasTranslation ? (
                                      /* Sent message: original on top, translation below */
                                      <div className="rounded-2xl rounded-tr-sm bg-primary overflow-hidden shadow-sm">
                                        {/* Original text */}
                                        <div className="px-4 pt-3 pb-2">
                                          <p className="text-sm leading-relaxed text-white whitespace-pre-wrap">{text}</p>
                                        </div>
                                        {/* Divider with DirectHub Translate tag */}
                                        <div className="flex items-center gap-2 px-4 py-1.5 bg-white/10 border-t border-white/20">
                                          <span className="text-[9px] font-bold text-white/80 bg-white/20 border border-white/30 px-1.5 py-0.5 rounded-full tracking-wide">DirectHub Translate</span>
                                          <span className="text-[10px] text-white/60">{sentTargetLangOption?.flag} {sentTargetLangOption?.nativeName}</span>
                                        </div>
                                        {/* Translated text */}
                                        <div className="px-4 pt-2 pb-3 bg-white/10">
                                          <p className="text-sm leading-relaxed text-white/90 whitespace-pre-wrap">{cached.translated}</p>
                                        </div>
                                      </div>
                                    ) : needsTranslation && !isOwn && hasTranslation ? (
                                      /* Received message: Arabic translation on top (prominent), original below */
                                      <div className="rounded-2xl rounded-tl-sm bg-white border border-gray-200 shadow-sm overflow-hidden">
                                        {/* Arabic translation — shown first and prominently */}
                                        <div className="px-4 pt-3 pb-2">
                                          <p className="text-sm leading-relaxed text-gray-800 whitespace-pre-wrap" dir={isArabicText(cached.translated) ? 'rtl' : undefined}>{cached.translated}</p>
                                        </div>
                                        {/* Divider with DirectHub Translate tag + original text */}
                                        <div className="flex items-center gap-2 px-4 py-1.5 bg-blue-50 border-t border-blue-100 flex-wrap">
                                          <div className="flex items-center gap-1.5">
                                            <span className="text-[9px] font-bold text-blue-600 bg-blue-100 border border-blue-200 px-1.5 py-0.5 rounded-full tracking-wide">DirectHub Translate</span>
                                            <span className="text-[10px] text-blue-400">{currentLangOption?.flag} {currentLangOption?.nativeName}</span>
                                          </div>
                                          <button
                                            onClick={() => toggleShowOriginal(msg.id)}
                                            className="mr-auto text-[10px] text-blue-400 hover:text-blue-600 transition-colors"
                                          >
                                            {showOriginal ? m.hideOriginal : m.showOriginal}
                                          </button>
                                        </div>
                                        {/* Original text (collapsible) */}
                                        {showOriginal && (
                                          <div className="px-4 pt-2 pb-3 bg-gray-50 border-t border-gray-100">
                                            <p className="text-xs leading-relaxed text-gray-500 whitespace-pre-wrap italic">{text}</p>
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm ${
                                        isOwn
                                          ? 'bg-primary text-white rounded-tr-sm' : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm'
                                      }`}>
                                        <p className="whitespace-pre-wrap">{text}</p>
                                      </div>
                                    )}
                                    {!isOwn && needsTranslation && (
                                      <div className="flex items-center gap-2 mt-0.5">
                                        {isTranslating ? (
                                          <span className="flex items-center gap-1.5 text-[10px] text-blue-500 font-medium">
                                            <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                                            <span>{m.translatingLive}</span>
                                          </span>
                                        ) : !hasTranslation ? (
                                          <button onClick={() => translateMessage(msg)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl text-[11px] font-bold text-blue-700 hover:from-blue-100 hover:to-indigo-100 hover:border-blue-300 transition-all shadow-sm active:scale-95">
                                            <span className="text-sm">🌐</span>
                                            <span>{m.showTranslation}</span>
                                            <span className="text-blue-400 font-normal">/ Translate</span>
                                          </button>
                                        ) : null}
                                      </div>
                                    )}
                                    {isOwn && needsTranslation && isTranslating && (
                                      <div className="flex items-center gap-1.5 mt-0.5">
                                        <span className="flex items-center gap-1.5 text-[10px] text-blue-400 font-medium">
                                          <div className="w-3 h-3 border-2 border-blue-300 border-t-transparent rounded-full animate-spin" />
                                          <span>{m.translating}</span>
                                        </span>
                                      </div>
                                    )}
                                  </>
                                )}
                              </>
                            )}
                          </div>
                        )}
                        <p className={`text-[10px] text-gray-400 mt-1 ${isOwn ? 'text-left' : 'text-right'}`}>
                          {formatTime(msg.created_at, language, m.yesterday)}
                          {isOwn && msg.is_read && <span className="mr-1 text-primary">✓✓</span>}
                        </p>
                      </div>
                    </div>
                  );
                })}

                {/* Typing Indicator */}
                {isOtherTyping && (
                  <div className="flex justify-end gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0 mt-1">
                      <span className="text-white text-[11px] font-bold">{(activeConv?.supplier_name || '?').slice(0, 2)}</span>
                    </div>
                    <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-white border border-gray-200 shadow-sm flex items-center gap-1.5">
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* ── Quick Replies ────────────────────────────────────────────── */}
              <div className="px-3 sm:px-4 py-2 border-t border-gray-100 bg-white flex gap-1.5 overflow-x-auto shrink-0" style={{ scrollbarWidth: 'none' }}>
                {(QUICK_REPLIES_BY_LANG[language] || QUICK_REPLIES_BY_LANG.en).map(reply => (
                  <button key={reply} onClick={() => setInputText(reply)}
                    className="shrink-0 px-2.5 py-1.5 bg-gray-100 text-gray-600 text-[10px] sm:text-[11px] font-medium rounded-full hover:bg-primary/10 hover:text-primary transition-colors whitespace-nowrap">
                    {reply}
                  </button>
                ))}
              </div>

              {/* ── Privacy Warning ──────────────────────────────────────────── */}
              {privacyWarning && (
                <div className="mx-3 sm:mx-4 mb-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700 flex items-center gap-2 shrink-0">
                  <Icon name="ShieldExclamationIcon" size={14} className="text-amber-500 shrink-0" />{privacyWarning}
                </div>
              )}

              {/* ── Live Translation Floating Preview (Alibaba-style, 4 languages) ── */}
              {needsTranslation && liveTranslation && (
                <div className="mb-2 px-3 py-1.5 mx-3 sm:mx-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-md text-xs text-blue-800 flex items-center gap-2 transition-all duration-200 shrink-0 min-w-0">
                  <span className="text-base leading-none shrink-0">
                    {liveTranslationLang === 'ar' ? '🇸🇦' : liveTranslationLang === 'en' ? '🇬🇧' : liveTranslationLang === 'zh' ? '🇨🇳' : '🇹🇷'}
                  </span>
                  <span className="text-blue-500 font-semibold select-none shrink-0">{m.liveTranslation}</span>
                  <span className="italic truncate min-w-0">{liveTranslation}</span>
                  {isLiveTranslating && <span className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin shrink-0 ml-auto" />}
                </div>
              )}

              {/* ── Attachment Preview ───────────────────────────────────────── */}
              {pendingAttachment && (
                <div className="mx-3 sm:mx-4 mb-2 flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-xl shrink-0 min-w-0">
                  {pendingAttachment.previewUrl ? (
                    <img src={pendingAttachment.previewUrl} alt={m.preview} className="w-10 h-10 rounded-lg object-cover shrink-0" />
                  ) : (
                    <Icon name="PaperClipIcon" size={16} className="text-gray-400 shrink-0" />
                  )}
                  <span className="text-xs text-gray-700 flex-1 truncate min-w-0">{pendingAttachment.file.name}</span>
                  <button onClick={clearAttachment} className="w-6 h-6 rounded-full hover:bg-gray-200 flex items-center justify-center shrink-0">
                    <Icon name="XMarkIcon" size={12} className="text-gray-500" />
                  </button>
                </div>
              )}

              {/* ── Input Area ───────────────────────────────────────────────── */}
              <div className="relative px-2.5 sm:px-3 pt-2 border-t border-gray-200 bg-white shrink-0 pb-2 md:pb-3" style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
                {/* Emoji Picker — rendered outside form to avoid flex overlap */}
                {showEmojiPicker && (
                  <div className="absolute bottom-full left-2 sm:left-4 mb-1 z-[200]">
                    <EmojiPickerPanel
                      onSelect={(emoji) => {
                        setInputText(prev => prev + emoji);
                        inputRef.current?.focus();
                      }}
                      onClose={() => setShowEmojiPicker(false)}
                    />
                  </div>
                )}

                {/* Language Picker — rendered outside form/overflow container to avoid clipping */}
                {needsTranslation && showLangPicker && (
                  <div className="absolute bottom-full mb-1 left-16 sm:left-20 z-[300] bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden min-w-[140px]">
                    <div className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100">{m.translateTo}</div>
                    {LANG_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          setLiveTranslationLang(opt.value);
                          setShowLangPicker(false);
                          setLiveTranslation('');
                          liveTranslationCacheRef.current.clear();
                        }}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-blue-50 transition-colors ${liveTranslationLang === opt.value ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-700'}`}
                      >
                        <span className="text-base">{opt.flag}</span>
                        <span>{opt.nativeName}</span>
                        {liveTranslationLang === opt.value && <Icon name="CheckIcon" size={12} className="ml-auto text-blue-600" />}
                      </button>
                    ))}
                  </div>
                )}

                {/* ── Alibaba-style layout: textarea full width, actions row below ── */}
                <form onSubmit={handleSubmit} className="flex flex-col gap-1.5">
                  {/* Textarea — full width, multi-line */}
                  <textarea
                    ref={inputRef}
                    value={inputText}
                    onChange={e => handleTypingInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e as any); } }}
                    placeholder={m.typeMessageHere}
                    rows={2}
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary focus:bg-white resize-none transition-colors leading-relaxed"
                    style={{ minHeight: '56px', maxHeight: '120px' }}
                    disabled={sending}
                  />

                  {/* Actions row: left icons + right send button */}
                  <div className="flex items-center justify-between gap-1 min-w-0">
                    {/* Left: action buttons — scrollable on very small screens */}
                    <div className="flex items-center gap-1 overflow-x-auto min-w-0" style={{ scrollbarWidth: 'none' }}>
                      {/* Attachment */}
                      <label className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gray-100 flex items-center justify-center cursor-pointer hover:bg-gray-200 transition-colors shrink-0" title={m.attachFile}>
                        <Icon name="PaperClipIcon" size={15} className="text-gray-500" />
                        <input ref={fileInputRef} type="file" accept={ACCEPT_ATTR} onChange={handleAttachmentChange} className="hidden" />
                      </label>

                      {/* Emoji */}
                      <button
                        type="button"
                        onClick={() => setShowEmojiPicker(v => !v)}
                        title={m.emoji}
                        className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center transition-colors shrink-0 ${showEmojiPicker ? 'bg-amber-100 border border-amber-300' : 'bg-gray-100 hover:bg-amber-50 border border-transparent hover:border-amber-200'}`}
                      >
                        <span className="text-base leading-none">😊</span>
                      </button>

                      {/* 4-Language Live Translation Selector (Alibaba-style) */}
                      {needsTranslation && (
                      <div className="relative shrink-0">
                        <button
                          type="button"
                          onClick={() => setShowLangPicker(v => !v)}
                          title={m.chooseLiveTranslateLang}
                          className="h-8 sm:h-9 px-2 rounded-xl bg-blue-50 border border-blue-200 flex items-center gap-1 hover:bg-blue-100 transition-colors"
                        >
                          <span className="text-sm leading-none">
                            {liveTranslationLang === 'ar' ? '🇸🇦' : liveTranslationLang === 'en' ? '🇬🇧' : liveTranslationLang === 'zh' ? '🇨🇳' : '🇹🇷'}
                          </span>
                          <span className="text-[10px] font-bold text-blue-700 uppercase">{liveTranslationLang}</span>
                          <Icon name="ChevronDownIcon" size={9} className="text-blue-400" />
                        </button>
                      </div>
                      )}

                      {/* Video Call */}
                      {activeConv && user && (
                        <button
                          type="button"
                          onClick={() => setCallModal({ type: 'video', supplierName: activeConv.supplier_name || 'DirectHub Supplier', conversationId: activeConv.id, userId: user.id })}
                          title={m.videoCall}
                          className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gray-100 hover:bg-blue-50 hover:border-blue-200 border border-transparent flex items-center justify-center transition-colors shrink-0"
                        >
                          <Icon name="VideoCameraIcon" size={15} className="text-blue-500" />
                        </button>
                      )}

                      {/* Proposal Button */}
                      <button type="button" onClick={() => { setIsCounterProposal(false); setCounterProposalData(undefined); setShowProposalModal(true); }}
                        className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center hover:bg-amber-100 transition-colors shrink-0"
                        title={m.submitQuote}>
                        <Icon name="DocumentTextIcon" size={15} className="text-amber-600" />
                      </button>

                      {/* Custom Quote — Factory Only */}
                      {(userRole === 'manufacturer' || userRole === 'factory' || userRole === 'seller') && (
                        <button type="button" onClick={() => setShowCustomQuoteModal(true)}
                          className="flex items-center gap-1 px-2 sm:px-3 h-8 sm:h-9 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors shrink-0"
                          title={m.sendCustomQuote}>
                          <Icon name="DocumentTextIcon" size={13} />
                          <span className="hidden sm:inline">{m.customQuote}</span>
                        </button>
                      )}
                    </div>

                    {/* Right: Send button */}
                    <button
                      type="submit"
                      disabled={(!inputText.trim() && !pendingAttachment) || sending}
                      className="flex items-center gap-1.5 px-4 h-8 sm:h-9 bg-primary text-white rounded-xl font-semibold text-sm disabled:opacity-40 transition-all active:scale-95 shrink-0 shadow-sm hover:bg-primary/90"
                    >
                      {sending
                        ? <Icon name="ArrowPathIcon" size={14} className="animate-spin" />
                        : <><Icon name="PaperAirplaneIcon" size={14} /><span>{m.send}</span></>
                      }
                    </button>
                  </div>
                </form>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Proposal Modal */}
      {showProposalModal && (
        <ProposalModal onClose={() => setShowProposalModal(false)} onSubmit={handleProposalSubmit}
          isCounter={isCounterProposal} prevProposal={counterProposalData} />
      )}

      {/* Custom Quote Modal */}
      {showCustomQuoteModal && activeConv && (
        <CustomQuoteModal onClose={() => setShowCustomQuoteModal(false)} onSubmit={() => setQuoteAcceptMsg(null)}
          conversationId={activeConv.id} buyerUserId={activeConv.buyer_id} orderId={undefined} />
      )}

      {/* Quote Accept Toast */}
      {quoteAcceptMsg && (
        <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex items-start gap-3 px-4 py-3 rounded-2xl shadow-xl text-sm font-semibold max-w-sm text-center ${quoteAcceptMsg.success ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
          <Icon name={quoteAcceptMsg.success ? 'CheckBadgeIcon' : 'ExclamationCircleIcon'} size={18} className="shrink-0 mt-0.5" />
          <span>{quoteAcceptMsg.text}</span>
          <button onClick={() => setQuoteAcceptMsg(null)} className="mr-auto shrink-0"><Icon name="XMarkIcon" size={14} /></button>
        </div>
      )}

      {/* Call Modal */}
      {callModal && (
        <CallModal
          type={callModal.type}
          supplierName={callModal.supplierName}
          conversationId={callModal.conversationId}
          userId={callModal.userId}
          onClose={() => setCallModal(null)}
        />
      )}

      {/* ── Delete All Confirmation Dialog ─────────────────────────────────── */}
      {showDeleteAllConfirm && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <Icon name="TrashIcon" size={20} className="text-red-600" />
              </div>
              <h2 className="text-base font-bold text-gray-900">{m.deleteAll}</h2>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">
              {m.deleteAllConfirmBody}
            </p>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setShowDeleteAllConfirm(false)}
                disabled={deletingAll}
                className="flex-1 h-10 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {m.cancel}
              </button>
              <button
                onClick={handleDeleteAll}
                disabled={deletingAll}
                className="flex-1 h-10 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {deletingAll ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    {m.deleting}
                  </>
                ) : (
                  m.deleteAll
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hide bottom nav while an active chat is open on mobile so the composer is never covered */}
      {(!activeConvId || sidebarOpen) && <BottomNav />}
    </div>
  );
}

// ─── Main Export with Suspense ────────────────────────────────────────────────
export default function LiveMessagingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex flex-col">
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    }>
      <LiveMessagingContent />
    </Suspense>
  );
}