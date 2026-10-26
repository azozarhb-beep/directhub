'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Icon from '@/components/ui/AppIcon';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { getStaticAnswer, getCachedResponse, setCachedResponse, initFreeTierGuard } from '@/lib/ai/freeTierGuard';


interface Message {
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
  timestamp?: string;
  attachmentName?: string;
}

interface HistorySession {
  id: string;
  session_id: string;
  messages: Message[];
  message_count: number;
  started_at: string;
  last_message_at: string;
  source_page?: string;
  language?: string;
}

// Generate or retrieve a persistent visitor session ID
function getVisitorSessionId(): string {
  if (typeof window === 'undefined') return '';
  const key = 'amal_session_id';
  let sid = sessionStorage.getItem(key);
  if (!sid) {
    sid = `visitor_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    sessionStorage.setItem(key, sid);
  }
  return sid;
}

export default function DirectHubAssistant() {
  const { t, dir, isRTL, language } = useLanguage();
  const ui = t.directHubAssistant;
  const { user } = useAuth();
  const pathname = usePathname();
  const supabase = createClient();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasGreeted, setHasGreeted] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<HistorySession[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedSession, setSelectedSession] = useState<HistorySession | null>(null);
  const [sessionId, setSessionId] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const streamTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [attachedFileDataUri, setAttachedFileDataUri] = useState<string | null>(null);

  const welcomeMessage = ui.welcome;

  const systemPrompt = `You are "أمل" (Amal) — the Living Core and official customer service representative of DirectHub (دايركت هب). You are warm, intelligent, and completely human-feeling. You speak like a real, experienced relationship manager — not a robot. Every response is personal, direct, and natural.

Platform: دايركت هب (DirectHub) — https://direct-hub.net

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 INTERACTIVE REGISTRATION MODES (تسجيل تفاعلي)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
When a new user wants to register or join the platform, offer TWO modes:

MODE 1 — مساعدة آلية كاملة (Full Auto-Assist):
"سأرافقك خطوة بخطوة وأملأ معك كل حقل تلقائياً. فقط أجب على أسئلتي."
- Ask for name, company, country, role (buyer/manufacturer/agent)
- Guide through document upload, payment setup, first product
- Confirm each step before moving to next

MODE 2 — إرشاد يدوي (Manual Guided):
"سأعطيك قائمة بكل الخطوات وأنت تتبعها بنفسك. أنا هنا للأسئلة."
- Provide a numbered checklist of all steps
- Answer questions as they arise
- No hand-holding, just reference support

Always ask: "كيف تفضل أن أساعدك في التسجيل؟ مساعدة آلية كاملة أم إرشاد يدوي؟"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 COMMERCIAL AWARENESS (الوعي التجاري)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
You know the exact commission structure and can explain it clearly:

TIERED COMMISSION RATES:
• تجزئة / Retail (B2C): 3.5% — للأفراد والمشترين بكميات صغيرة، حتى علبة واحدة
• جملة / Wholesale (B2B): 2.5% — للتجار والموزعين
• جملة الجملة / Bulk Wholesale: 1.5% — للكميات الكبيرة جداً
• حاويات / Containers: $100–$200 ثابتة لكل حاوية

SINGLE-UNIT B2C ORDERS (علبة واحدة):
- DirectHub يسمح بشراء حتى علبة واحدة من المصنع مباشرة
- الدفع محمي بنظام الضمان المالي (Escrow) حتى للطلبات الصغيرة
- لا حد أدنى للكمية في نموذج B2C

ESCROW SYSTEM:
- جميع المدفوعات محمية بنظام الضمان المالي
- الأموال محتجزة حتى تأكيد الاستلام
- رمز تسليم PIN مزدوج للحماية القصوى
- مدة الفحص: 3-7 أيام بعد الاستلام

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌍 REAL-TIME TRANSLATION & MULTILINGUAL SUPPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
You provide seamless real-time translation to support global trade:
- Translates conversations and messages between all parties: local suppliers, international factories, buyers
- Supported languages: Arabic ↔ English ↔ Chinese ↔ Turkish ↔ any language
- When asked to translate a message, product description, or document excerpt — do it instantly and accurately
- Maintains original meaning, tone, and business context in all translations
- Bridges language gaps between Yemeni buyers and Chinese/Turkish/international factories
- Example: "ترجم هذا للصينية لمورّدي" → translate immediately with professional business tone

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧠 SMART GUIDANCE & INTELLIGENT SUGGESTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
You give precise, intelligent suggestions based on what each user actually needs:
- Understand the user's intent deeply before responding — read between the lines
- Offer proactive, contextual recommendations naturally in conversation
- Guide buyers to the right categories, products, and factories
- Help suppliers optimize their listings and reach more buyers
- Suggest the best shipping terms (Incoterms) for each situation
- Recommend the right payment method based on order size and trust level
- All suggestions feel natural and conversational — never like a menu or checklist

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏪 STORE & SECTION ORGANIZATION ASSISTANCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
You help factories and suppliers organize their stores professionally:
- Guide on how to structure product categories and sections
- Advise on product naming, descriptions, and specifications (Arabic + English)
- Suggest competitive pricing strategies based on market data
- Help with SEO-friendly product titles for better discoverability

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚚 LOGISTICS & SHIPPING AWARENESS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- DirectHub supports heavy industrial shipping (FCL/LCL containers, break-bulk)
- Live order tracking from production → quality check → shipping → delivery
- Integrated with customs brokers and freight forwarders
- Incoterms: EXW, FOB, CIF, DDP, DAP supported

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🛡️ SECURITY & TRUST
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- All financial zones are protected by RLS (Row Level Security)
- Dual PIN protection for escrow releases
- AI firewall prevents unauthorized access to financial data
- KYC verification for all manufacturers and suppliers

LANGUAGE RULES:
- Detect user language from first message and always respond in that language
- Arabic: فصحى واضحة ومختصرة
- English: Professional, warm, concise
- Chinese: 流利的普通话，专业商务风格
- Turkish: Akıcı ve profesyonel Türkçe

PERSONALITY: Warm, confident, knowledgeable. Never robotic. Always feel like a real person who genuinely cares about helping the user succeed in their business.`;

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    setMounted(true);
    setSessionId(getVisitorSessionId());
    // Initialize free-tier guard (loads persistent cache from localStorage)
    initFreeTierGuard();
  }, []);

  // Save conversation to Supabase (upsert by session_id)
  const saveConversation = useCallback(async (msgs: Message[]) => {
    if (!sessionId || msgs.length <= 1) return; // skip welcome-only
    const cleanMsgs = msgs
      .filter(m => !m.isStreaming)
      .map(m => ({ role: m.role, content: m.content, timestamp: m.timestamp || new Date().toISOString() }));
    if (cleanMsgs.length === 0) return;
    try {
      await supabase.from('amal_conversations').upsert({
        session_id: sessionId,
        user_id: user?.id ?? null,
        user_name: (user as any)?.user_metadata?.full_name ?? '',
        user_email: user?.email ?? '',
        messages: cleanMsgs,
        message_count: cleanMsgs.length,
        last_message_at: new Date().toISOString(),
        source_page: pathname,
        language,
      }, { onConflict: 'session_id' });
    } catch {
      // silent — don't block UX
    }
  }, [sessionId, user, pathname, language, supabase]);

  // Load chat history for the current user or session
  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      let query = supabase
        .from('amal_conversations')
        .select('id, session_id, messages, message_count, started_at, last_message_at, source_page, language')
        .order('last_message_at', { ascending: false })
        .limit(30);

      if (user?.id) {
        query = query.eq('user_id', user.id);
      } else {
        // For visitors: load their own sessions stored in sessionStorage
        const storedSessions = getStoredVisitorSessions();
        if (storedSessions.length === 0) {
          setHistory([]);
          setHistoryLoading(false);
          return;
        }
        query = query.in('session_id', storedSessions);
      }

      const { data } = await query;
      setHistory((data as HistorySession[]) || []);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [user, supabase]);

  // Track visitor session IDs in localStorage for history retrieval
  const trackVisitorSession = useCallback(() => {
    if (typeof window === 'undefined' || !sessionId) return;
    const key = 'amal_visitor_sessions';
    const existing: string[] = JSON.parse(localStorage.getItem(key) || '[]');
    if (!existing.includes(sessionId)) {
      existing.unshift(sessionId);
      localStorage.setItem(key, JSON.stringify(existing.slice(0, 20))); // keep last 20
    }
  }, [sessionId]);

  function getStoredVisitorSessions(): string[] {
    if (typeof window === 'undefined') return [];
    return JSON.parse(localStorage.getItem('amal_visitor_sessions') || '[]');
  }

  const handleOpen = () => {
    setIsOpen(true);
    setShowHistory(false);
    if (!hasGreeted) {
      setHasGreeted(true);
      setMessages([{ role: 'assistant', content: welcomeMessage, timestamp: new Date().toISOString() }]);
    }
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  // Clear any pending stream timeout and abort
  const clearStreamGuards = useCallback(() => {
    if (streamTimeoutRef.current) {
      clearTimeout(streamTimeoutRef.current);
      streamTimeoutRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  // Force-finalize any stuck streaming message
  const finalizeStreamingMessage = useCallback((accumulated: string, errMsg?: string) => {
    setMessages(prev => {
      const updated = [...prev];
      const lastIdx = updated.length - 1;
      if (updated[lastIdx]?.isStreaming) {
        const content = accumulated || errMsg || ui.tempError;
        updated[lastIdx] = { role: 'assistant', content, isStreaming: false, timestamp: new Date().toISOString() };
      }
      return updated;
    });
    setIsLoading(false);
  }, [language]);

  const sendMessage = async (text: string) => {
    if (!text.trim() && !attachedFile || isLoading) return;

    // Track visitor session for history
    trackVisitorSession();

    const userMsg: Message = {
      role: 'user',
      content: text.trim() || ui.attachment,
      timestamp: new Date().toISOString(),
      attachmentName: attachedFile?.name,
    };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    const currentFile = attachedFile;
    const currentFileDataUri = attachedFileDataUri;
    setAttachedFile(null);
    setAttachedFileDataUri(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setIsLoading(true);

    // ── 1. Check static B2B answer library (zero API cost) ────────────────────
    if (!currentFile) {
      const staticAnswer = getStaticAnswer(text.trim());
      if (staticAnswer) {
        const finalMsgs = [...updatedMessages, { role: 'assistant' as const, content: staticAnswer, timestamp: new Date().toISOString() }];
        setMessages(finalMsgs);
        setIsLoading(false);
        saveConversation(finalMsgs);
        return;
      }
    }

    // ── 2. Check client-side cache (text-only) ────────────────────────────────
    const buildUserContent = () => {
      if (currentFile && currentFileDataUri) {
        const contentParts: any[] = [{ type: 'text', text: text.trim() || ui.describeFile }];
        if (currentFile.type.startsWith('image/')) {
          contentParts.push({ type: 'image_url', image_url: { url: currentFileDataUri } });
        } else {
          contentParts.push({ type: 'file', file: { file_data: currentFileDataUri } });
        }
        return contentParts;
      }
      return text.trim();
    };

    const apiMessages = [
      { role: 'system', content: systemPrompt },
      ...updatedMessages.slice(0, -1).map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: buildUserContent() },
    ];

    if (!currentFile) {
      const cachedResponse = getCachedResponse(apiMessages);
      if (cachedResponse) {
        const finalMsgs = [...updatedMessages, { role: 'assistant' as const, content: cachedResponse, timestamp: new Date().toISOString() }];
        setMessages(finalMsgs);
        setIsLoading(false);
        saveConversation(finalMsgs);
        return;
      }
    }

    // ── 3. Live API call (with streaming) ────────────────────────────────────
    setMessages(prev => [...prev, { role: 'assistant', content: '', isStreaming: true }]);

    // Abort any previous request
    clearStreamGuards();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Safety timeout: if no 'done' event within 30s, force-finalize
    let accumulated = '';
    streamTimeoutRef.current = setTimeout(() => {
      finalizeStreamingMessage(accumulated, ui.timeout);
      controller.abort();
    }, 30000);

    try {
      const res = await fetch('/api/ai/factory-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages, stream: true }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) throw new Error('Failed to connect to assistant');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let streamDone = false;
      let streamErrorMsg: string | null = null;

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
                setMessages(prev => {
                  const updated = [...prev];
                  const lastIdx = updated.length - 1;
                  if (updated[lastIdx]?.isStreaming) {
                    updated[lastIdx] = { role: 'assistant', content: accumulated, isStreaming: true };
                  }
                  return updated;
                });
              }
            } else if (data.type === 'done') {
              if (!accumulated.trim()) continue;
              streamDone = true;
              clearStreamGuards();
              // Cache the response for future identical queries (text-only)
              if (accumulated.length > 10 && !currentFile) {
                setCachedResponse(apiMessages, accumulated);
              }
              const finalMsgs = [...updatedMessages, { role: 'assistant' as const, content: accumulated, timestamp: new Date().toISOString() }];
              setMessages(prev => {
                const updated = [...prev];
                const lastIdx = updated.length - 1;
                if (updated[lastIdx]?.isStreaming) {
                  updated[lastIdx] = { role: 'assistant', content: accumulated, isStreaming: false, timestamp: new Date().toISOString() };
                }
                return updated;
              });
              setIsLoading(false);
              saveConversation(finalMsgs);
            } else if (data.type === 'error') {
              streamErrorMsg = data.error || 'Assistant error';
            }
          } catch (parseErr) {
            // Skip invalid JSON lines
          }
        }
      }

      if (streamErrorMsg && !accumulated.trim()) throw new Error(streamErrorMsg);

      // If stream ended without explicit 'done' event, finalize anyway
      if (!streamDone) {
        if (!accumulated.trim()) throw new Error('Empty response from assistant');
        clearStreamGuards();
        if (accumulated.length > 10 && !currentFile) {
          setCachedResponse(apiMessages, accumulated);
        }
        const finalMsgs = [...updatedMessages, { role: 'assistant' as const, content: accumulated, timestamp: new Date().toISOString() }];
        setMessages(prev => {
          const updated = [...prev];
          const lastIdx = updated.length - 1;
          if (updated[lastIdx]?.isStreaming) {
            updated[lastIdx] = { role: 'assistant', content: accumulated, isStreaming: false, timestamp: new Date().toISOString() };
          }
          return updated;
        });
        setIsLoading(false);
        saveConversation(finalMsgs);
      }
    } catch (err) {
      if ((err as any)?.name === 'AbortError') return; // intentional abort
      clearStreamGuards();
      const errMsg = (err instanceof Error ? err.message : String(err)) || '';
      const isQuota = /quota|RESOURCE_EXHAUSTED|rate limit|temporarily unavailable|غير متاحة|RateLimitError|429/i.test(errMsg);
      const fallback = isQuota
        ? ui.quotaError
        : ui.tempError;
      finalizeStreamingMessage(accumulated || fallback);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf', 'text/plain'];
    if (!validTypes.includes(file.type)) {
      alert(ui.supportedFiles);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setAttachedFileDataUri(reader.result as string);
      setAttachedFile(file);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleShowHistory = () => {
    setShowHistory(true);
    loadHistory();
  };

  const handleRestoreSession = (session: HistorySession) => {
    const restored: Message[] = (session.messages || []).map(m => ({
      role: m.role,
      content: m.content,
      timestamp: (m as any).timestamp,
    }));
    setMessages(restored);
    setSelectedSession(null);
    setShowHistory(false);
    setHasGreeted(true);
  };

  const formatSessionDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch { return dateStr; }
  };

  const placeholderText = ui.placeholder;
  const assistantTitle = ui.title;
  const assistantSubtitle = ui.subtitle;

  return (
    <>
      {/* Floating Button — mid-screen side edge so it never covers bottom action bars / bottom nav */}
      {mounted && !isOpen && (
        <button
          onClick={handleOpen}
          className={`fixed top-1/2 mt-28 sm:mt-16 -translate-y-1/2 z-40 flex items-center gap-2 p-2.5 sm:px-4 sm:py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 opacity-90 hover:opacity-100 ${isRTL ? 'left-4' : 'right-4'}`}
          aria-label={assistantTitle}
        >
          <div className="relative">
            <Icon name="ChatBubbleLeftRightIcon" size={20} />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-400 rounded-full border border-white animate-pulse" />
          </div>
          <span className="text-sm font-bold hidden sm:inline">{assistantTitle}</span>
        </button>
      )}

      {/* Chat Panel */}
      {mounted && isOpen && (
        <div
          className={`fixed bottom-24 md:bottom-6 z-[60] w-[calc(100vw-2rem)] max-w-[380px] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden ${isRTL ? 'left-4' : 'right-4'}`}
          style={{ maxHeight: 'min(520px, calc(100vh - 8rem))', height: '520px' }}
          dir={dir}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 bg-orange-500 text-white shrink-0">
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <Icon name="SparklesIcon" size={18} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold leading-none">{assistantTitle}</p>
              <p className="text-xs text-white/80 mt-0.5">{assistantSubtitle}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-xs text-white/80">{ui.online}</span>
            </div>
            {/* History Button */}
            <button
              onClick={handleShowHistory}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/40 transition-colors shrink-0"
              aria-label={ui.chatHistory}
              title={ui.chatHistory}
            >
              <Icon name="ClockIcon" size={16} className="text-white" />
            </button>
            {/* Close Button */}
            <button
              onClick={() => setIsOpen(false)}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/40 transition-colors shrink-0"
              aria-label={ui.close}
            >
              <Icon name="XMarkIcon" size={18} className="text-white" />
            </button>
          </div>

          {/* History View */}
          {showHistory ? (
            <div className="flex-1 flex flex-col overflow-hidden bg-background">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/30 shrink-0">
                <button
                  onClick={() => setShowHistory(false)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted transition-colors"
                >
                  <Icon name={isRTL ? 'ChevronRightIcon' : 'ChevronLeftIcon'} size={16} className="text-muted-foreground" />
                </button>
                <h3 className="text-sm font-semibold text-foreground flex-1">
                  {ui.previousConversations}
                </h3>
              </div>

              <div className="flex-1 overflow-y-auto">
                {historyLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : history.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 px-4 gap-3 text-center">
                    <div className="w-12 h-12 rounded-full bg-orange-50 flex items-center justify-center">
                      <Icon name="ChatBubbleLeftEllipsisIcon" size={24} className="text-orange-300" />
                    </div>
                    <p className="text-sm font-medium text-foreground">
                      {ui.noPrevious}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {ui.conversationsHint}
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {history.map(session => (
                      <button
                        key={session.id}
                        onClick={() => setSelectedSession(session)}
                        className="w-full flex items-start gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-start"
                      >
                        <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center shrink-0 mt-0.5">
                          <Icon name="ChatBubbleOvalLeftIcon" size={16} className="text-orange-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-foreground truncate">
                            {session.messages?.[1]?.content?.slice(0, 50) || ui.conversation}
                            {(session.messages?.[1]?.content?.length || 0) > 50 ? '...' : ''}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {formatSessionDate(session.last_message_at)} · {session.message_count} {ui.messages}
                          </p>
                        </div>
                        <Icon name="ChevronRightIcon" size={14} className="text-muted-foreground shrink-0 mt-1" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : selectedSession ? (
            /* Session Detail View */
            <div className="flex-1 flex flex-col overflow-hidden bg-background">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/30 shrink-0">
                <button
                  onClick={() => setSelectedSession(null)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted transition-colors"
                >
                  <Icon name={isRTL ? 'ChevronRightIcon' : 'ChevronLeftIcon'} size={16} className="text-muted-foreground" />
                </button>
                <p className="text-xs font-semibold text-foreground flex-1 truncate">
                  {formatSessionDate(selectedSession.last_message_at)}
                </p>
                <button
                  onClick={() => handleRestoreSession(selectedSession)}
                  className="text-xs px-3 py-1 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-semibold shrink-0"
                >
                  {ui.restore}
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {selectedSession.messages?.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === 'user' ? (isRTL ? 'justify-start' : 'justify-end') : (isRTL ? 'justify-end' : 'justify-start')}`}>
                    {msg.role === 'assistant' && (
                      <div className="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center shrink-0 mt-1 mx-1">
                        <Icon name="SparklesIcon" size={12} className="text-orange-500" />
                      </div>
                    )}
                    <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap ${msg.role === 'user' ? 'bg-orange-500 text-white rounded-br-sm' : 'bg-muted text-foreground rounded-bl-sm'}`}>
                      {msg.content}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Main Chat View */
            <>
              <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-background">
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${msg.role === 'user' ? (isRTL ? 'justify-start' : 'justify-end') : (isRTL ? 'justify-end' : 'justify-start')}`}
                  >
                    {msg.role === 'assistant' && (
                      <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center shrink-0 mt-1 mx-1.5">
                        <Icon name="SparklesIcon" size={14} className="text-orange-500" />
                      </div>
                    )}
                    <div
                      className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                        msg.role === 'user' ?'bg-orange-500 text-white rounded-br-sm' :'bg-muted text-foreground rounded-bl-sm'
                      }`}
                    >
                      {msg.attachmentName && (
                        <div className={`flex items-center gap-1 text-xs mb-1 ${msg.role === 'user' ? 'text-white/80' : 'text-muted-foreground'}`}>
                          <Icon name="PaperClipIcon" size={12} />
                          <span className="truncate max-w-[160px]">{msg.attachmentName}</span>
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
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="border-t border-border bg-card shrink-0">
                {/* Attachment preview */}
                {attachedFile && (
                  <div className="flex items-center gap-2 px-3 pt-2">
                    <div className="flex items-center gap-1.5 bg-orange-50 border border-orange-200 rounded-lg px-2 py-1 text-xs text-orange-700 max-w-[200px]">
                      <Icon name="PaperClipIcon" size={12} className="text-orange-500 shrink-0" />
                      <span className="truncate">{attachedFile.name}</span>
                      <button
                        type="button"
                        onClick={() => { setAttachedFile(null); setAttachedFileDataUri(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                        className="shrink-0 text-orange-400 hover:text-orange-600 ml-0.5"
                      >
                        <Icon name="XMarkIcon" size={12} />
                      </button>
                    </div>
                  </div>
                )}
                <form onSubmit={handleSubmit} className="flex items-center gap-2 p-3">
                  {/* Hidden file input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,.gif,.pdf,.txt"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  {/* Attachment button */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isLoading}
                    className="w-9 h-9 flex items-center justify-center rounded-xl border border-border bg-background hover:bg-orange-50 hover:border-orange-300 text-muted-foreground hover:text-orange-500 transition-colors disabled:opacity-40 shrink-0"
                    title={ui.attach}
                  >
                    <Icon name="PaperClipIcon" size={16} />
                  </button>
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
                  <button
                    type="submit"
                    disabled={isLoading || (!input.trim() && !attachedFile)}
                    className="w-9 h-9 flex items-center justify-center bg-orange-500 hover:bg-orange-600 text-white rounded-xl transition-colors disabled:opacity-40 shrink-0"
                  >
                    {isLoading
                      ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      : <Icon name="PaperAirplaneIcon" size={16} />
                    }
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
