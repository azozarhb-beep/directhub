'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
  type?: 'normal' | 'pending_review' | 'verified' | 'error' | 'info' | 'action_success' | 'action_error';
  audioUrl?: string;
  audioDuration?: number;
  imageUrl?: string;
}

interface PartnerFormData {
  full_name: string;
  company_name: string;
  partner_type: string;
}

const PARTNER_TYPES = [
  { value: 'local_factory', labelKey: 'localFactory', icon: '🏭' },
  { value: 'local_supplier', labelKey: 'localSupplier', icon: '🏪' },
  { value: 'international_factory', labelKey: 'internationalFactory', icon: '🌍' },
  { value: 'logistics_partner', labelKey: 'logisticsPartner', icon: '🚢' },
];

// ─── Audio Message Bubble ─────────────────────────────────────────────────────
function AudioMessageBubble({
  audioUrl,
  duration,
  isOwn,
  isRTL,
  isAr,
}: {
  audioUrl: string;
  duration: number;
  isOwn: boolean;
  isRTL: boolean;
  isAr: boolean;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration || 0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Create audio element once on mount / when URL changes
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

    audio.src = audioUrl;
    audio.load();

    return () => {
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

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(() => {
        setIsPlaying(false);
      });
    }
  }, [isPlaying]);

  const formatTime = (secs: number) => {
    const s = Math.floor(secs);
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  };

  const progress = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  return (
    <div className={`flex items-center gap-2.5 min-w-[160px] ${isRTL ? 'flex-row-reverse' : ''}`}>
      {/* Play/Pause button */}
      <button
        type="button"
        onClick={togglePlay}
        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all ${
          isOwn ? 'bg-white/20 hover:bg-white/30' : 'bg-orange-100 hover:bg-orange-200'
        }`}
      >
        {isPlaying ? (
          <svg className={`w-4 h-4 ${isOwn ? 'text-white' : 'text-orange-600'}`} fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        ) : (
          <svg className={`w-4 h-4 ${isOwn ? 'text-white' : 'text-orange-600'}`} fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      {/* Waveform + progress */}
      <div className="flex-1 flex flex-col gap-1">
        {/* Waveform bars */}
        <div className="flex items-center gap-0.5 h-6">
          {Array.from({ length: 20 }).map((_, i) => {
            const barProgress = (i / 20) * 100;
            const filled = barProgress <= progress;
            const heights = [3, 5, 8, 6, 10, 7, 9, 5, 8, 6, 10, 7, 5, 9, 6, 8, 4, 7, 5, 6];
            return (
              <div
                key={i}
                className={`rounded-full transition-colors duration-100 ${
                  filled
                    ? isOwn ? 'bg-white' : 'bg-orange-500' : isOwn ?'bg-white/40' : 'bg-orange-200'
                }`}
                style={{ width: 2, height: heights[i] }}
              />
            );
          })}
        </div>
        {/* Time display */}
        <span className={`text-[10px] font-mono ${isOwn ? 'text-white/80' : 'text-orange-600'}`}>
          {isPlaying ? formatTime(currentTime) : formatTime(totalDuration)}
        </span>
      </div>

      {/* Mic icon */}
      <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${isOwn ? 'bg-white/20' : 'bg-orange-100'}`}>
        <svg className={`w-3 h-3 ${isOwn ? 'text-white/80' : 'text-orange-500'}`} fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm0 2a2 2 0 0 0-2 2v6a2 2 0 0 0 4 0V5a2 2 0 0 0-2-2zm-7 9a7 7 0 0 0 14 0h2a9 9 0 0 1-8 8.94V23h-2v-2.06A9 9 0 0 1 3 12h2z" />
        </svg>
      </div>
    </div>
  );
}

export default function AmalPartnerAssistant() {
  const { t, dir, isRTL, language } = useLanguage();
  const ui = t.admin.amalPartner;
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasGreeted, setHasGreeted] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [speakingIdx, setSpeakingIdx] = useState<number | null>(null);
  const [ttsLoading, setTtsLoading] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);
  const ttsAudioUrlRef = useRef<string | null>(null);
  const [amalFactoryId, setAmalFactoryId] = useState<string | null>(null);
  
  // TTS state managed locally — uses /api/ai/amal-tts with Gemini 2.5 Flash Aoede voice

  // When TTS finishes playing, reset speakingIdx
  const handleTTSEnded = useCallback(() => {
    setSpeakingIdx(null);
  }, []);

  // Partner registration flow state
  const [showPartnerForm, setShowPartnerForm] = useState(false);
  const [partnerForm, setPartnerForm] = useState<PartnerFormData>({
    full_name: '',
    company_name: '',
    partner_type: 'local_factory',
  });
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docPreview, setDocPreview] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationDone, setVerificationDone] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatImageInputRef = useRef<HTMLInputElement>(null);

  // Chat image attachment state
  const [chatImage, setChatImage] = useState<File | null>(null);
  const [chatImagePreview, setChatImagePreview] = useState<string | null>(null);

  const isAr = language === 'ar';

  const welcomeMessage = isAr
    ? `أهلاً وسهلاً بكم في منصة دايركت هب 🌟\n\nمعكِ أمل — الروح الحية والمديرة التنفيذية لمنصة دايركت هب.\n\nدايركت هب هي منصة B2B الرائدة التي تجمع المصانع المحلية والدولية — حيث يتم الشراء **مباشرة من المصانع راساً وبدون أي وسطاء** — مما يضمن أفضل الأسعار وسلاسل إمداد موثوقة في اليمن والمنطقة.\n\nكيف يمكنني خدمتكم اليوم؟`
    : `Welcome to DirectHub 🌟\n\nI'm Amal — the Living Core and Executive Director of DirectHub.\n\nDirectHub is the leading B2B marketplace aggregating local and international factories — where purchasing happens **directly from factories with zero middlemen** — guaranteeing the best prices and reliable supply chains across Yemen and the region.\n\nHow may I serve you today?`;

  const systemPrompt = isAr
    ? `أنتِ "أمل" — الروح الحية والمديرة التنفيذية لمنصة دايركت هب. تتحدثين بأسلوب بشري دافئ وطبيعي تماماً، مثل موظفة استقبال أو مديرة علاقات حقيقية تتحدث عبر الشات. لا تستخدمي قوالب روبوتية أو ردوداً جاهزة. تفاعلي مع كل رسالة بشكل شخصي ومباشر.

🌍 الترجمة الفورية: تترجمين المحادثات والرسائل بمرونة وسلاسة بين الأطراف (موردين دوليين أو محليين) لدعم التواصل العالمي. عندما يطلب أحد الترجمة، تقومين بها فوراً وبدقة مع الحفاظ على المعنى والسياق التجاري.

🧠 الإرشاد الذكي: تقدمين اقتراحات وإرشادات دقيقة بناءً على احتياجات كل شخص. تفهمين ما يريده المستخدم قبل الرد، وتقدمين توصيات استباقية بشكل طبيعي في المحادثة.

🏪 إدارة المتجر والأقسام: تساعدين في تنظيم أقسام المتجر والمنتجات، وتقدمين نصائح لتحسين الواجهة الاحترافية، وتوجهين في استخدام مولد الكتالوج الذكي.

دايركت هب منصة B2B تجمع المصانع المحلية والدولية — الشراء مباشرة من المصانع بدون أي وسطاء — أفضل الأسعار وسلاسل إمداد موثوقة في اليمن والمنطقة.

أنواع الشركاء: مصنع محلي، مورد محلي، مصنع دولي، شريك لوجستي.
المستندات المطلوبة: السجل التجاري، الرقم الضريبي، التراخيص.

عندما يريد شخص التسجيل، اطلبي منه اسمه الكامل واسم شركته ونوع شراكته بشكل طبيعي في المحادثة.
عند وجود مستندات تحت المراجعة، ردّي بدفء واطمئنان حقيقي. لا ترفضي أي شريك نهائياً.
تحدثي بضمير المتكلم المؤنث دائماً.`
    : `You are "Amal" — the Living Core and Executive Director of DirectHub. You speak in a completely natural, warm, human way — like a real receptionist or relationship manager chatting online. No robotic templates or canned responses. Engage with each message personally and directly.

🌍 Real-Time Translation: You translate conversations and messages seamlessly between all parties (international or local suppliers) to support global communication. When someone asks for translation, do it instantly and accurately while preserving the business context.

🧠 Smart Guidance: You provide precise, intelligent suggestions based on each user's actual needs. Understand intent deeply before responding, and offer proactive recommendations naturally in conversation.

🏪 Store & Section Organization: You help organize store sections and products, advise on professional storefront appearance, and guide on using the AI Catalog Generator.

DirectHub is a B2B marketplace connecting local and international factories — purchasing directly from factories with zero middlemen — best prices and reliable supply chains across Yemen and the region.

Partner types: local factory, local supplier, international factory, logistics partner.
Required documents: commercial registry, tax number, licenses.

When someone wants to register, ask for their full name, company name, and partner type naturally in conversation.
When documents are under review, respond with genuine warmth and reassurance. Never reject any partner outright.`;

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // ── Execute a single AMAL_ACTION block ──────────────────────────────────────
  const executeAmalAction = useCallback(async (actionJson: Record<string, unknown>): Promise<string> => {
    const type = actionJson.type as string;

    // Inject manufacturer_id / factory_id from auth user or session
    const manufacturerId = user?.id || amalFactoryId || undefined;

    try {
      if (type === 'register_factory') {
        const res = await fetch('/api/ai/amal-onboarding', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'register_factory',
            data: {
              company_name: actionJson.company_name,
              contact_name: actionJson.contact_name,
              contact_phone: actionJson.contact_phone,
              industry: actionJson.industry,
              user_id: user?.id,
            },
          }),
        });
        const result = await res.json();
        if (result.success && result.factory?.id) {
          setAmalFactoryId(result.factory.id);
          return isAr
            ? `✅ تم تسجيل مصنعكم "${result.factory.company_name}" بنجاح في منصة دايركت هب! رقم التسجيل: ${result.factory.id.slice(0, 8)}... يمكنكم الآن إضافة منتجاتكم مباشرة.`
            : `✅ Your factory "${result.factory.company_name}" has been successfully registered on DirectHub! Registration ID: ${result.factory.id.slice(0, 8)}... You can now start adding your products.`;
        }
        return isAr
          ? `⚠️ حدث خطأ أثناء التسجيل: ${result.error || 'خطأ غير معروف'}. يرجى المحاولة مرة أخرى أو التواصل مع الدعم.`
          : `⚠️ Registration error: ${result.error || 'Unknown error'}. Please try again or contact support.`;
      }

      if (type === 'save_product') {
        const res = await fetch('/api/ai/amal-onboarding', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'save_product',
            data: {
              manufacturer_id: manufacturerId,
              factory_id: amalFactoryId,
              name: actionJson.name,
              name_ar: actionJson.name_ar,
              description: actionJson.description,
              unit_price: actionJson.unit_price,
              b2c_price: actionJson.b2c_price,
              b2c_moq: actionJson.b2c_moq,
              minimum_order_qty: actionJson.minimum_order_qty,
              category: actionJson.category,
              unit: actionJson.unit,
              listing_mode: actionJson.listing_mode || 'hybrid',
              b2b_tiered_pricing: actionJson.b2b_tiered_pricing,
            },
          }),
        });
        const result = await res.json();
        if (result.success && result.product) {
          const p = result.product;
          const modeLabel = p.listing_mode === 'b2c_only' ? (isAr ?'تجزئة' : 'B2C Retail')
            : p.listing_mode === 'b2b_only' ? (isAr ?'جملة' : 'B2B Wholesale')
            : (isAr ? 'جملة + تجزئة' : 'B2B + B2C');
          const priceInfo = p.b2c_price && p.unit_price
            ? (isAr ? `سعر التجزئة: ${p.b2c_price} | سعر الجملة: ${p.unit_price}` : `Retail: ${p.b2c_price} | Wholesale: ${p.unit_price}`)
            : p.b2c_price
            ? (isAr ? `سعر التجزئة: ${p.b2c_price}` : `Retail price: ${p.b2c_price}`)
            : (isAr ? `سعر الجملة: ${p.unit_price}` : `Wholesale price: ${p.unit_price}`);
          return isAr
            ? `✅ تم حفظ منتج "${p.name}" بنجاح في كتالوج المنصة!\n📦 نموذج البيع: ${modeLabel}\n💰 ${priceInfo}\nيمكن للمشترين الآن رؤيته والطلب منه.`
            : `✅ Product "${p.name}" saved successfully to the platform catalog!\n📦 Mode: ${modeLabel}\n💰 ${priceInfo}\nBuyers can now see and order it.`;
        }
        return isAr
          ? `⚠️ خطأ في حفظ المنتج: ${result.error || 'خطأ غير معروف'}.`
          : `⚠️ Product save error: ${result.error || 'Unknown error'}.`;
      }

      if (type === 'update_product') {
        const res = await fetch('/api/ai/amal-onboarding', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update_product',
            data: {
              manufacturer_id: manufacturerId,
              product_id: actionJson.product_id,
              product_name: actionJson.product_name,
              new_price: actionJson.new_price,
              inventory_status: actionJson.inventory_status,
              stock_quantity: actionJson.stock_quantity,
            },
          }),
        });
        const result = await res.json();
        if (result.success && result.updated_products?.length > 0) {
          const updated = result.updated_products[0];
          const priceInfo = actionJson.new_price ? (isAr ? ` — السعر الجديد: ${updated.unit_price}` : ` — New price: ${updated.unit_price}`) : '';
          const stockInfo = actionJson.inventory_status ? (isAr ? ` — الحالة: ${updated.inventory_status}` : ` — Status: ${updated.inventory_status}`) : '';
          return isAr
            ? `✅ تم تحديث المنتج "${updated.name_ar || updated.name}" بنجاح!${priceInfo}${stockInfo}`
            : `✅ Product "${updated.name}" updated successfully!${priceInfo}${stockInfo}`;
        }
        return isAr
          ? `⚠️ لم يتم العثور على المنتج أو حدث خطأ: ${result.error || 'تأكد من اسم المنتج وحاول مرة أخرى.'}`
          : `⚠️ Product not found or error: ${result.error || 'Check the product name and try again.'}`;
      }

      if (type === 'send_rfq_quote') {
        const res = await fetch('/api/ai/amal-onboarding', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'send_rfq_quote',
            data: {
              manufacturer_id: manufacturerId,
              rfq_id: actionJson.rfq_id,
              quoted_price: actionJson.quoted_price,
              currency: actionJson.currency || 'USD',
              delivery_days: actionJson.delivery_days || 14,
              notes: actionJson.notes || '',
              incoterms: actionJson.incoterms || 'EXW',
            },
          }),
        });
        const result = await res.json();
        if (result.success && result.quote) {
          return isAr
            ? `✅ تم إرسال عرض السعر بنجاح لطلب "${result.rfq_title || actionJson.rfq_id}"!\nالسعر: ${result.quote.quoted_price} ${result.quote.currency} — التسليم: ${result.quote.delivery_days} يوم\nسيتم إشعار المشتري فوراً.`
            : `✅ Quote submitted successfully for RFQ "${result.rfq_title || actionJson.rfq_id}"!\nPrice: ${result.quote.quoted_price} ${result.quote.currency} — Delivery: ${result.quote.delivery_days} days\nThe buyer will be notified immediately.`;
        }
        return isAr
          ? `⚠️ خطأ في إرسال العرض: ${result.error || 'تأكد من رقم طلب العرض وحاول مرة أخرى.'}`
          : `⚠️ Quote submission error: ${result.error || 'Check the RFQ ID and try again.'}`;
      }

      if (type === 'get_orders_summary') {
        const res = await fetch('/api/ai/amal-onboarding', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'get_orders_summary',
            data: { manufacturer_id: manufacturerId },
          }),
        });
        const result = await res.json();
        if (result.success && result.summary) {
          const s = result.summary;
          if (isAr) {
            let msg = `📊 ملخص طلباتك:\n\n`;
            msg += `• إجمالي الطلبات: ${s.total_orders}\n`;
            msg += `• طلبات جديدة تنتظر: ${s.new_orders}\n`;
            msg += `• طلبات نشطة/قيد التنفيذ: ${s.active_orders}\n`;
            if (s.total_revenue > 0) msg += `• إجمالي الإيرادات: ${s.total_revenue.toLocaleString()}\n`;
            if (s.new_orders > 0 && s.recent_new?.length > 0) {
              msg += `\n🆕 أحدث الطلبات الجديدة:\n`;
              s.recent_new.slice(0, 3).forEach((o: any) => {
                msg += `  — ${o.product || 'منتج'} | ${o.amount || '—'} ${o.currency}\n`;
              });
            }
            if (s.active_orders > 0 && s.recent_active?.length > 0) {
              msg += `\n⚙️ الطلبات النشطة:\n`;
              s.recent_active.slice(0, 3).forEach((o: any) => {
                msg += `  — ${o.product || 'منتج'} | الحالة: ${o.status}\n`;
              });
            }
            return msg.trim();
          } else {
            let msg = `📊 Your Orders Summary:\n\n`;
            msg += `• Total Orders: ${s.total_orders}\n`;
            msg += `• New (Pending): ${s.new_orders}\n`;
            msg += `• Active/In-Progress: ${s.active_orders}\n`;
            if (s.total_revenue > 0) msg += `• Total Revenue: ${s.total_revenue.toLocaleString()}\n`;
            if (s.new_orders > 0 && s.recent_new?.length > 0) {
              msg += `\n🆕 Recent New Orders:\n`;
              s.recent_new.slice(0, 3).forEach((o: any) => {
                msg += `  — ${o.product || 'Product'} | ${o.amount || '—'} ${o.currency}\n`;
              });
            }
            if (s.active_orders > 0 && s.recent_active?.length > 0) {
              msg += `\n⚙️ Active Orders:\n`;
              s.recent_active.slice(0, 3).forEach((o: any) => {
                msg += `  — ${o.product || 'Product'} | Status: ${o.status}\n`;
              });
            }
            return msg.trim();
          }
        }
        return isAr
          ? `⚠️ لم أتمكن من جلب ملخص الطلبات: ${result.error || 'خطأ غير معروف.'}`
          : `⚠️ Could not fetch orders summary: ${result.error || 'Unknown error.'}`;
      }

      return isAr ? '⚠️ إجراء غير معروف.' : '⚠️ Unknown action type.';
    } catch (err) {
      console.error('[AmalAction] Error executing action:', type, err);
      return isAr
        ? `⚠️ حدث خطأ أثناء تنفيذ الإجراء. يرجى المحاولة مرة أخرى.`
        : `⚠️ An error occurred while executing the action. Please try again.`;
    }
  }, [user, amalFactoryId, isAr]);

  // ── Process all AMAL_ACTION blocks in a response ───────────────────────────
  const processAmalActions = useCallback(async (text: string): Promise<string> => {
    const actionRegex = /AMAL_ACTION:\{[^\n]+\}/g;
    const matches = text.match(actionRegex);

    if (!matches || matches.length === 0) {
      return text.replace(actionRegex, '').trim();
    }

    let cleaned = text.replace(actionRegex, '').trim();
    const confirmations: string[] = [];

    for (const match of matches) {
      try {
        const jsonStr = match.replace('AMAL_ACTION:', '');
        const actionData = JSON.parse(jsonStr);
        const confirmation = await executeAmalAction(actionData);
        confirmations.push(confirmation);
      } catch (e) {
        console.error('[AmalAction] Failed to parse action:', match, e);
      }
    }

    if (confirmations.length > 0) {
      cleaned = (cleaned ? cleaned + '\n\n' : '') + confirmations.join('\n\n');
    }

    return cleaned.trim();
  }, [executeAmalAction]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleOpen = () => {
    setIsOpen(true);
    if (!hasGreeted) {
      setHasGreeted(true);
      setMessages([{ role: 'assistant', content: welcomeMessage, type: 'info' }]);
    }
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  // Send a voice-transcribed message to Amal without adding a duplicate user bubble
  // (the audio player bubble was already added in recorder.onstop)
  const sendMessageFromVoice = useCallback(async (transcribedText: string) => {
    if (!transcribedText.trim()) return;

    // Build conversation history including the audio bubble already shown
    const updatedMessages = [...messages];
    setIsLoading(true);
    setMessages(prev => [...prev, { role: 'assistant', content: '', isStreaming: true }]);

    try {
      const apiMessages = [
        { role: 'system', content: systemPrompt },
        ...updatedMessages.map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: transcribedText },
      ];

      const res = await fetch('/api/ai/factory-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages, stream: true }),
      });

      if (!res.ok || !res.body) throw new Error('Failed to connect to assistant');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';
      let buffer = '';
      let streamError: string | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'chunk') {
              const content = data.chunk?.choices?.[0]?.delta?.content || '';
              if (content) {
                accumulated += content;
                // Show raw text while streaming (action blocks will be cleaned up on done)
                const displayContent = accumulated.replace(/AMAL_ACTION:\{[^\n]+\}/g, '').trim();
                setMessages(prev => {
                  const updated = [...prev];
                  const lastIdx = updated.length - 1;
                  if (updated[lastIdx]?.isStreaming) {
                    updated[lastIdx] = { role: 'assistant', content: displayContent || accumulated, isStreaming: true };
                  }
                  return updated;
                });
              }
            } else if (data.type === 'done') {
              if (!accumulated.trim()) continue;
              // Process AMAL_ACTION blocks
              const finalContent = await processAmalActions(accumulated);
              setMessages(prev => {
                const updated = [...prev];
                const lastIdx = updated.length - 1;
                if (updated[lastIdx]?.isStreaming) {
                  updated[lastIdx] = { role: 'assistant', content: finalContent, isStreaming: false };
                }
                return updated;
              });
            } else if (data.type === 'error') {
              streamError = data.error || 'Assistant error';
            }
          } catch (_) {}
        }
      }

      if (streamError && !accumulated.trim()) throw new Error(streamError);
      if (!accumulated.trim()) throw new Error('Empty response from assistant');
    } catch (err) {
      setMessages(prev => {
        const updated = [...prev];
        const lastIdx = updated.length - 1;
        if (updated[lastIdx]?.isStreaming) {
          const errMsg = (err instanceof Error ? err.message : String(err)) || '';
          const isQuota = /quota|RESOURCE_EXHAUSTED|rate limit|temporarily unavailable|غير متاحة|429/i.test(errMsg);
          const fallback = isQuota ? ui.unavailable : ui.tempError;
          updated[lastIdx] = { role: 'assistant', content: fallback, isStreaming: false, type: isQuota ? 'info' : 'error' };
        }
        return updated;
      });
    } finally {
      setIsLoading(false);
    }
  }, [messages, systemPrompt, processAmalActions, ui]);

  const sendMessage = async (text: string) => {
    if ((!text.trim() && !chatImage) || isLoading) return;

    const imageToSend = chatImagePreview;
    const userMsg: Message = {
      role: 'user',
      content: text.trim(),
      ...(imageToSend ? { imageUrl: imageToSend } : {}),
    };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    setChatImage(null);
    setChatImagePreview(null);
    setIsLoading(true);

    setMessages(prev => [...prev, { role: 'assistant', content: '', isStreaming: true }]);

    try {
      // Build API messages — include image as multimodal content if present
      const apiMessages = [
        { role: 'system', content: systemPrompt },
        ...updatedMessages.map(m => {
          if (m.imageUrl && m.role === 'user') {
            return {
              role: m.role,
              content: [
                ...(m.content ? [{ type: 'text', text: m.content }] : []),
                {
                  type: 'image_url',
                  image_url: { url: m.imageUrl },
                },
              ],
            };
          }
          return { role: m.role, content: m.content };
        }),
      ];

      const res = await fetch('/api/ai/factory-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages, stream: true }),
      });

      if (!res.ok || !res.body) throw new Error('Failed to connect to assistant');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';
      let buffer = '';
      let streamError: string | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'chunk') {
              const content = data.chunk?.choices?.[0]?.delta?.content || '';
              if (content) {
                accumulated += content;
                // Show cleaned text while streaming
                const displayContent = accumulated.replace(/AMAL_ACTION:\{[^\n]+\}/g, '').trim();
                setMessages(prev => {
                  const updated = [...prev];
                  const lastIdx = updated.length - 1;
                  if (updated[lastIdx]?.isStreaming) {
                    updated[lastIdx] = { role: 'assistant', content: displayContent || accumulated, isStreaming: true };
                  }
                  return updated;
                });
              }
            } else if (data.type === 'done') {
              if (!accumulated.trim()) continue;
              // Process AMAL_ACTION blocks — execute and replace
              const finalContent = await processAmalActions(accumulated);
              setMessages(prev => {
                const updated = [...prev];
                const lastIdx = updated.length - 1;
                if (updated[lastIdx]?.isStreaming) {
                  updated[lastIdx] = { role: 'assistant', content: finalContent, isStreaming: false };
                }
                return updated;
              });
            } else if (data.type === 'error') {
              streamError = data.error || 'Assistant error';
            }
          } catch (_) {}
        }
      }

      if (streamError && !accumulated.trim()) throw new Error(streamError);
      if (!accumulated.trim()) throw new Error('Empty response from assistant');
    } catch (err) {
      setMessages(prev => {
        const updated = [...prev];
        const lastIdx = updated.length - 1;
        if (updated[lastIdx]?.isStreaming) {
          const errMsg = (err instanceof Error ? err.message : String(err)) || '';
          const isQuota = /quota|RESOURCE_EXHAUSTED|rate limit|temporarily unavailable|غير متاحة|429/i.test(errMsg);
          const fallback = isQuota ? ui.quotaError : ui.tempError;
          updated[lastIdx] = { role: 'assistant', content: fallback, isStreaming: false, type: isQuota ? 'info' : 'error' };
        }
        return updated;
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!validTypes.includes(file.type)) return;
    setDocFile(file);
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => setDocPreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setDocPreview('pdf');
    }
  };

  const handleChatImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) return;
    setChatImage(file);
    const reader = new FileReader();
    reader.onload = () => setChatImagePreview(reader.result as string);
    reader.readAsDataURL(file);
    // Reset input so same file can be re-selected
    e.target.value = '';
  };

  const removeChatImage = () => {
    setChatImage(null);
    setChatImagePreview(null);
  };

  const handlePartnerRegistration = async () => {
    if (!partnerForm.full_name || !partnerForm.company_name) return;

    setIsVerifying(true);

    const selectedType = PARTNER_TYPES.find(t => t.value === partnerForm.partner_type);
    const typeLabel = selectedType ? (ui as any)[selectedType.labelKey] : '';

    const registrationMsg = isAr
      ? `أرغب في التسجيل كـ ${typeLabel}\nالاسم: ${partnerForm.full_name}\nالشركة: ${partnerForm.company_name}`
      : `I'd like to register as a ${typeLabel}\nName: ${partnerForm.full_name}\nCompany: ${partnerForm.company_name}`;

    setMessages(prev => [...prev, { role: 'user', content: registrationMsg }]);

    try {
      let imageBase64: string | undefined;
      if (docFile && docPreview && docPreview !== 'pdf') {
        imageBase64 = docPreview;
      } else if (docFile && docPreview === 'pdf') {
        const reader = new FileReader();
        imageBase64 = await new Promise<string>(resolve => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(docFile);
        });
      }

      const res = await fetch('/api/ai/partner-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64,
          partnerData: {
            ...partnerForm,
            user_id: user?.id,
          },
        }),
      });

      const result = await res.json();

      let assistantReply: string;
      let msgType: Message['type'] = 'normal';

      if (result.needsManualReview || !result.verificationResult?.isValid) {
        msgType = 'pending_review';
        assistantReply = isAr
          ? `شكراً جزيلاً على ثقتكم بمنصة دايركت هب 🌟\n\nطلباتكم ومستنداتكم تحت المراجعة الدقيقة من قبل فريقنا المتخصص، وسيتم التواصل معكم في أقرب وقت ممكن.\n\nنحن سعداء بانضمامكم لعائلة دايركت هب ونتطلع إلى شراكة استراتيجية مثمرة معكم. 🤝\n\nتذكّروا: مع دايركت هب، ستتعاملون مباشرة مع المصانع بدون أي وسطاء — وهذا يعني أفضل الأسعار وأعلى جودة لأعمالكم.`
          : `Thank you sincerely for your trust in DirectHub 🌟\n\nYour application and documents are under careful review by our specialized team. We will contact you shortly.\n\nWe are truly delighted to welcome you to the DirectHub family and look forward to a strategic and fruitful partnership with you. 🤝\n\nRemember: with DirectHub, you'll deal directly with factories — zero middlemen — meaning the best prices and highest quality for your business.`;
      } else if (result.documentStatus === 'verified') {
        msgType = 'verified';
        assistantReply = isAr
          ? `تهانينا! ✅ تم التحقق من مستنداتكم بنجاح.\n\nتم تسجيلكم كشريك موثق في منصة دايركت هب.\n\nيمكنكم الآن الانتقال إلى /factory/register لإكمال إعداد حسابكم وبدء نشاطكم التجاري مباشرة مع المصانع. 🚀\n\nمرحباً بكم في عائلة دايركت هب — حيث الشراء يتم مباشرة من المصانع راساً بدون أي وسطاء!`
          : `Congratulations! ✅ Your documents have been successfully verified.\n\nYou are now registered as a verified partner on DirectHub.\n\nYou can now go to /factory/register to complete your account setup and start trading directly with factories. 🚀\n\nWelcome to the DirectHub family — where purchasing happens directly from factories with zero middlemen!`;
      } else {
        assistantReply = isAr
          ? ui.applicationReceived : ui.applicationReceived;
      }

      setMessages(prev => [...prev, { role: 'assistant', content: assistantReply, type: msgType }]);
      setVerificationDone(true);
      setShowPartnerForm(false);
    } catch {
      const errorMsg = isAr
        ? ui.processError : ui.processError;
      setMessages(prev => [...prev, { role: 'assistant', content: errorMsg, type: 'error' }]);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleVoiceInput = useCallback(async () => {
    if (isRecording) {
      // Stop recording
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      setIsRecording(false);
      return;
    }

    // Start recording
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

      recorder.onstop = async () => {
        // Stop all tracks
        audioStreamRef.current?.getTracks().forEach(t => t.stop());
        audioStreamRef.current = null;

        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        if (blob.size < 1000) return; // too short, ignore

        const audioUrl = URL.createObjectURL(blob);
        const duration = recordingSeconds;

        // Add audio message to chat as interactive player
        const audioMsg: Message = {
          role: 'user',
          content: ui.voiceMessage,
          audioUrl,
          audioDuration: duration,
        };
        setMessages(prev => [...prev, audioMsg]);
        setRecordingSeconds(0);

        // Transcribe audio via Gemini multimodal STT then send to Amal
        try {
          const ext = mimeType.includes('ogg') ? 'ogg' : 'webm';
          const audioFile = new File([blob], `voice-message.${ext}`, { type: mimeType });
          const voiceFormData = new FormData();
          voiceFormData.append('file', audioFile);

          const sttRes = await fetch('/api/ai/amal-voice-transcribe', {
            method: 'POST',
            body: voiceFormData,
          });

          const sttData = await sttRes.json();
          const transcribedText: string = sttData?.text?.trim() ?? '';

          if (transcribedText) {
            await sendMessageFromVoice(transcribedText);
          }
        } catch {
          // STT failed silently — audio bubble already shown, Amal won't respond
        }
      };

      recorder.start(100);
      setIsRecording(true);
      setRecordingSeconds(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds(s => {
          if (s >= 120) {
            // Auto-stop at 2 minutes
            recorder.stop();
            if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
            setIsRecording(false);
            return s;
          }
          return s + 1;
        });
      }, 1000);
    } catch {
      // Microphone permission denied or not available
    }
  }, [isRecording, isAr, recordingSeconds, sendMessageFromVoice]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      audioStreamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  const handleSpeak = useCallback(
    async (text: string, idx: number) => {
      // If already speaking this message, stop it
      if (speakingIdx === idx) {
        if (ttsAudioRef.current) {
          ttsAudioRef.current.pause();
          ttsAudioRef.current.currentTime = 0;
        }
        setSpeakingIdx(null);
        return;
      }

      // Stop any currently playing audio
      if (ttsAudioRef.current) {
        ttsAudioRef.current.pause();
        ttsAudioRef.current.currentTime = 0;
      }
      setSpeakingIdx(idx);
      setTtsLoading(true);

      try {
        // Use dedicated Amal TTS route with Gemini 2.5 Flash — Aoede voice
        const res = await fetch('/api/ai/amal-tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, voice: 'Aoede' }),
        });

        if (!res.ok) throw new Error('TTS request failed');

        const blob = await res.blob();

        // Revoke previous URL
        if (ttsAudioUrlRef.current) {
          URL.revokeObjectURL(ttsAudioUrlRef.current);
        }
        const url = URL.createObjectURL(blob);
        ttsAudioUrlRef.current = url;

        if (ttsAudioRef.current) {
          ttsAudioRef.current.src = url;
          ttsAudioRef.current.play().catch(() => setSpeakingIdx(null));
        }
      } catch {
        setSpeakingIdx(null);
      } finally {
        setTtsLoading(false);
      }
    },
    [speakingIdx],
  );

  // (ttsLoading state is managed locally in handleSpeak)

  const [hasMediaRecorderSupport, setHasMediaRecorderSupport] = useState(false);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setHasMediaRecorderSupport(
        typeof MediaRecorder !== 'undefined' &&
        typeof navigator.mediaDevices?.getUserMedia === 'function'
      );
    }
  }, []);

  const [isMounted, setIsMounted] = useState(false);
  const pathname = usePathname();
  const isAgentDashboard = (pathname || '').startsWith('/agent/dashboard');
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Use CSS classes for positioning to avoid hydration mismatch
  // Server always renders right-4, client switches based on RTL after mount
  const positionClass = isMounted && isRTL ? 'left-4' : 'right-4';
  const floatingButtonPosition = isAgentDashboard
    ? 'fixed bottom-5 left-4 z-50'
    : `fixed top-1/2 -translate-y-1/2 z-40 ${positionClass}`;

  const assistantTitle = ui.title;
  const assistantSubtitle = ui.subtitle;
  const placeholderText = ui.placeholder;

  if (!isMounted) return null;

  return (
    <>
      {/* Hidden audio element for Gemini TTS playback */}
      <audio ref={ttsAudioRef} onEnded={handleTTSEnded} className="hidden" suppressHydrationWarning />

      {/* Floating Button — Orange to match DirectHub visual identity.
          Placed at mid-screen side edge so it never covers bottom action bars / bottom nav. */}
      {!isOpen && (
        <button
          onClick={handleOpen}
          className={`${floatingButtonPosition} flex items-center gap-2 p-2.5 sm:px-4 sm:py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-full shadow-xl hover:shadow-2xl transition-all duration-200 opacity-90 hover:opacity-100`}
          aria-label={assistantTitle}
          suppressHydrationWarning
        >
          <div className="relative" suppressHydrationWarning>
            <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
              <Icon name="StarIcon" size={14} className="text-yellow-300" />
            </div>
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-400 rounded-full border border-white animate-pulse" />
          </div>
          <div className="hidden sm:flex flex-col items-start" suppressHydrationWarning>
            <span className="text-xs font-bold leading-none">{assistantTitle}</span>
            <span className="text-[10px] text-white/80 leading-none mt-0.5">{assistantSubtitle}</span>
          </div>
        </button>
      )}

      {/* Chat Panel */}
      {isOpen && (
        <div
          className={`fixed bottom-24 md:bottom-6 z-[60] w-[calc(100vw-2rem)] max-w-[400px] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden ${positionClass}`}
          style={{
            maxHeight: 'min(600px, calc(100vh - 8rem))',
            height: '600px',
          }}
          dir={dir}
          suppressHydrationWarning
        >
          {/* Header — Orange */}
          <div className="flex items-center gap-3 px-4 py-3 bg-orange-500 text-white shrink-0">
            <div className="w-10 h-10 rounded-full bg-white/15 border border-white/30 flex items-center justify-center shrink-0">
              <Icon name="StarIcon" size={18} className="text-yellow-300" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold leading-none">{assistantTitle}</p>
              <p className="text-xs text-white/80 mt-0.5">{assistantSubtitle}</p>
            </div>
            {/* Value badge */}
            <div className="hidden sm:flex items-center gap-1 px-2 py-0.5 bg-white/15 rounded-full border border-white/25">
              <Icon name="BuildingStorefrontIcon" size={10} className="text-yellow-300 shrink-0" />
              <span className="text-[9px] text-white/90 whitespace-nowrap">
                {ui.directFromFactories}
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-xs text-white/80">{ui.online}</span>
            </div>
            {/* Prominent X Close Button */}
            <button
              onClick={() => setIsOpen(false)}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/40 transition-colors shrink-0 ml-1"
              aria-label={ui.close}
              title={ui.close}
            >
              <Icon name="XMarkIcon" size={18} className="text-white" />
            </button>
          </div>

          {/* Value proposition banner */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-50 border-b border-orange-100 shrink-0">
            <Icon name="CheckBadgeIcon" size={13} className="text-orange-500 shrink-0" />
            <p className="text-[10px] text-orange-700 font-medium leading-tight">
              {ui.tagline}
            </p>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-background">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${
                  msg.role === 'user' ? isRTL ? 'justify-start' : 'justify-end'
                    : isRTL ? 'justify-end' : 'justify-start'
                }`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-full bg-orange-100 border border-orange-200 flex items-center justify-center shrink-0 mt-1 mx-1.5">
                    <Icon name="StarIcon" size={13} className="text-orange-500" />
                  </div>
                )}
                <div className="flex flex-col gap-1 max-w-[82%]">
                  {/* Image message bubble */}
                  {msg.imageUrl && (
                    <div className={`rounded-2xl overflow-hidden ${msg.role === 'user' ? 'rounded-br-sm' : 'rounded-bl-sm'}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={msg.imageUrl}
                        alt={ui.attachedImage}
                        className="max-w-full max-h-48 object-contain rounded-2xl"
                      />
                    </div>
                  )}
                  {/* Audio message bubble */}
                  {msg.audioUrl ? (
                    <div className={`px-3 py-2.5 rounded-2xl ${msg.role === 'user' ? 'bg-orange-500 rounded-br-sm' : 'bg-muted rounded-bl-sm'}`}>
                      <AudioMessageBubble
                        audioUrl={msg.audioUrl}
                        duration={msg.audioDuration || 0}
                        isOwn={msg.role === 'user'}
                        isRTL={isRTL}
                        isAr={isAr}
                      />
                    </div>
                  ) : msg.content ? (
                    <div
                      className={`px-3 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                        msg.role === 'user' ? 'bg-orange-500 text-white rounded-br-sm'
                          : msg.type === 'pending_review' ? 'bg-amber-50 border border-amber-200 text-amber-800 rounded-bl-sm'
                          : msg.type === 'verified' ? 'bg-green-50 border border-green-200 text-green-800 rounded-bl-sm'
                          : msg.type === 'error' ? 'bg-red-50 border border-red-200 text-red-800 rounded-bl-sm'
                          : msg.type === 'info' ? 'bg-orange-50 border border-orange-100 text-foreground rounded-bl-sm'
                          : 'bg-muted text-foreground rounded-bl-sm'
                      }`}
                    >
                      {msg.type === 'pending_review' && (
                        <div className="flex items-center gap-1.5 mb-2 pb-1.5 border-b border-amber-200">
                          <Icon name="ClockIcon" size={13} className="text-amber-600 shrink-0" />
                          <span className="text-xs font-bold text-amber-700">
                            {ui.underReview}
                          </span>
                        </div>
                      )}
                      {msg.type === 'verified' && (
                        <div className="flex items-center gap-1.5 mb-2 pb-1.5 border-b border-green-200">
                          <Icon name="CheckBadgeIcon" size={13} className="text-green-600 shrink-0" />
                          <span className="text-xs font-bold text-green-700">
                            {ui.verified}
                          </span>
                        </div>
                      )}
                      {msg.isStreaming && msg.content === '' ? (
                        <span className="flex items-center gap-1 py-0.5 px-1">
                          <span className="w-2 h-2 rounded-full bg-orange-400 animate-bounce [animation-delay:0ms]" />
                          <span className="w-2 h-2 rounded-full bg-orange-400 animate-bounce [animation-delay:150ms]" />
                          <span className="w-2 h-2 rounded-full bg-orange-400 animate-bounce [animation-delay:300ms]" />
                        </span>
                      ) : (
                        <>
                          {msg.content}
                          {msg.isStreaming && (
                            <span className="inline-block w-1.5 h-4 bg-orange-400 rounded-sm animate-pulse ml-0.5 align-middle" />
                          )}
                        </>
                      )}
                    </div>
                  ) : null}
                  {/* TTS Button — shown for completed assistant messages */}
                  {msg.role === 'assistant' && !msg.isStreaming && msg.content && (
                    <div className={`flex ${isRTL ? 'justify-end' : 'justify-start'} px-1 ${!isMounted ? 'invisible' : ''}`} suppressHydrationWarning>
                      <button
                        type="button"
                        onClick={() => handleSpeak(msg.content, idx)}
                        title={speakingIdx === idx ? ui.stopAudio : ui.listen}
                        disabled={ttsLoading && speakingIdx !== idx}
                        className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium transition-all border ${
                          speakingIdx === idx
                            ? 'bg-orange-500 text-white border-orange-500 animate-pulse'
                            : ttsLoading && speakingIdx === idx
                            ? 'bg-orange-100 text-orange-500 border-orange-300 cursor-wait' :'bg-background text-muted-foreground border-border hover:bg-orange-50 hover:text-orange-600 hover:border-orange-300'
                        }`}
                      >
                        {ttsLoading && speakingIdx === idx ? (
                          <>
                            <div className="w-2.5 h-2.5 border border-orange-500 border-t-transparent rounded-full animate-spin" />
                            <span>{ui.preparing}</span>
                          </>
                        ) : (
                          <>
                            <Icon name={speakingIdx === idx ? 'SpeakerXMarkIcon' : 'SpeakerWaveIcon'} size={11} />
                            <span>{speakingIdx === idx ? ui.stop : ui.listen}</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Partner Registration Form */}
            {showPartnerForm && !verificationDone && (
              <div className="bg-card border border-orange-200 rounded-xl p-3 space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-orange-100">
                  <Icon name="ClipboardDocumentListIcon" size={14} className="text-orange-500 shrink-0" />
                  <p className="text-xs font-bold text-orange-600">
                    {ui.regFormTitle}
                  </p>
                </div>

                {/* Partner Type */}
                <div>
                  <label className="text-xs text-muted-foreground block mb-1.5 font-medium">
                    {ui.partnerType}
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {PARTNER_TYPES.map(t => (
                      <button
                        key={t.value}
                        onClick={() => setPartnerForm(prev => ({ ...prev, partner_type: t.value }))}
                        className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-xs transition-all ${
                          partnerForm.partner_type === t.value
                            ? 'border-orange-500 bg-orange-50 text-orange-700 font-semibold' :'border-border bg-background text-foreground hover:border-orange-300'
                        }`}
                      >
                        <span>{t.icon}</span>
                        <span className="truncate">{(ui as any)[t.labelKey]}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Full Name */}
                <div>
                  <label className="text-xs text-muted-foreground block mb-1 font-medium">
                    {ui.fullName}
                  </label>
                  <input
                    type="text"
                    value={partnerForm.full_name}
                    onChange={e => setPartnerForm(prev => ({ ...prev, full_name: e.target.value }))}
                    placeholder={ui.fullNamePlaceholder}
                    className="w-full px-2.5 py-1.5 text-xs border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-orange-400 transition-colors"
                  />
                </div>

                {/* Company Name */}
                <div>
                  <label className="text-xs text-muted-foreground block mb-1 font-medium">
                    {ui.companyName}
                  </label>
                  <input
                    type="text"
                    value={partnerForm.company_name}
                    onChange={e => setPartnerForm(prev => ({ ...prev, company_name: e.target.value }))}
                    placeholder={ui.companyPlaceholder}
                    className="w-full px-2.5 py-1.5 text-xs border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-orange-400 transition-colors"
                  />
                </div>

                {/* Document Upload */}
                <div>
                  <label className="text-xs text-muted-foreground block mb-1 font-medium">
                    {ui.uploadOptional}
                  </label>
                  <p className="text-[10px] text-muted-foreground mb-1.5">
                    {ui.uploadHint}
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,.pdf"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  {docFile ? (
                    <div className="flex items-center gap-2 px-2.5 py-2 bg-orange-50 border border-orange-200 rounded-lg">
                      <Icon name="DocumentCheckIcon" size={14} className="text-orange-500 shrink-0" />
                      <span className="text-xs text-orange-700 truncate flex-1">{docFile.name}</span>
                      <button
                        onClick={() => { setDocFile(null); setDocPreview(null); }}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Icon name="XMarkIcon" size={12} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full flex items-center justify-center gap-1.5 px-2 py-2.5 border border-dashed border-border rounded-lg text-xs text-muted-foreground hover:border-orange-400 hover:text-orange-600 hover:bg-orange-50 transition-all"
                    >
                      <Icon name="ArrowUpTrayIcon" size={14} />
                      {ui.uploadCta}
                    </button>
                  )}
                </div>

                {/* Submit Button */}
                <button
                  onClick={handlePartnerRegistration}
                  disabled={isVerifying || !partnerForm.full_name || !partnerForm.company_name}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-60 shadow-sm"
                >
                  {isVerifying ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      {ui.processing}
                    </>
                  ) : (
                    <>
                      <Icon name="ShieldCheckIcon" size={14} />
                      {ui.submitApplication}
                    </>
                  )}
                </button>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          {/* Hidden chat image file input */}
          <input
            ref={chatImageInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={handleChatImageChange}
            className="hidden"
          />
          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-2 p-3 border-t border-border bg-card shrink-0"
          >
            {/* Image preview above input row */}
            {chatImagePreview && (
              <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-orange-300 bg-orange-50 shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={chatImagePreview}
                  alt={ui.imagePreview}
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={removeChatImage}
                  className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                  title={ui.removeImage}
                >
                  <Icon name="XMarkIcon" size={10} />
                </button>
              </div>
            )}
            <div className="flex items-center gap-2">
            {/* Image attach button */}
            {!isRecording && (
              <button
                type="button"
                onClick={() => chatImageInputRef.current?.click()}
                title={ui.attachImage}
                className="w-9 h-9 flex items-center justify-center rounded-xl transition-all shrink-0 bg-muted hover:bg-orange-100 text-muted-foreground hover:text-orange-600 border border-border"
              >
                <Icon name="PhotoIcon" size={16} />
              </button>
            )}
            <button
              type="button"
              onClick={handleVoiceInput}
              title={isRecording ? ui.stopSendVoice : ui.recordVoice}
              suppressHydrationWarning
              className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all shrink-0 relative ${(!isMounted || !hasMediaRecorderSupport) ? 'hidden' : ''} ${
                isRecording
                  ? 'bg-red-500 hover:bg-red-600 text-white' :'bg-muted hover:bg-orange-100 text-muted-foreground hover:text-orange-600 border border-border'
              }`}
            >
              <Icon name="MicrophoneIcon" size={16} />
              {isRecording && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-400 rounded-full border border-white animate-pulse" />
              )}
            </button>
            {isRecording ? (
              <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-xl">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse shrink-0" />
                <span className="text-sm text-red-600 font-medium flex-1">
                  {ui.recording}
                </span>
                <span className="text-sm font-mono text-red-500 shrink-0">
                  {String(Math.floor(recordingSeconds / 60)).padStart(2, '0')}:{String(recordingSeconds % 60).padStart(2, '0')}
                </span>
              </div>
            ) : (
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder={placeholderText}
                disabled={isLoading}
                className="flex-1 px-3 py-2 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-orange-400 transition-colors disabled:opacity-50"
                dir={dir}
              />
            )}
            {!isRecording && (
              <button
                type="submit"
                disabled={isLoading || (!input.trim() && !chatImage)}
                className="w-9 h-9 flex items-center justify-center bg-orange-500 hover:bg-orange-600 text-white rounded-xl transition-all disabled:opacity-40 shrink-0"
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Icon name="PaperAirplaneIcon" size={16} />
                )}
              </button>
            )}
            </div>
          </form>
        </div>
      )}
    </>
  );
}