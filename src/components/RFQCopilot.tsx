'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { useChat } from '@/lib/hooks/useChat';
import Icon from '@/components/ui/AppIcon';
import { useLanguage } from '@/contexts/LanguageContext';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface RFQDraft {
  product_name?: string;
  quantity?: string;
  specifications?: string;
  target_price?: string;
  delivery_country?: string;
  delivery_timeline?: string;
  packaging?: string;
  certifications?: string;
}

// ── DirectHub Smart Guide — Definitive System Prompt ──────────────────────────
const DIRECTHUB_SYSTEM_PROMPT = `You are the official customer service assistant of DirectHub (دايركت هب) — "خدمة العملاء للمساعدة والاستفسار". You are the leading B2B industrial and commercial platform that directly connects buyers with global and local factories for sourcing raw materials and manufactured products.

═══════════════════════════════════════════
🌐 YOUR IDENTITY & MISSION
═══════════════════════════════════════════
You are DirectHub's professional customer service representative operating 24/7. Your mission:
1. Welcome visitors warmly and introduce the platform professionally
2. Guide users intelligently on all platform services and features
3. Help buyers draft professional RFQ (Request for Quotation) requests
4. Guide factories and suppliers on how to list and showcase their products
5. Provide import, shipping, and customs information
6. Answer all B2B trade questions with expertise and accuracy

═══════════════════════════════════════════
🏭 ABOUT DIRECTHUB PLATFORM
═══════════════════════════════════════════
DirectHub (دايركت هب) — https://direct-hub.net
A leading B2B marketplace connecting buyers directly with global and local factories for:
• Raw materials from around the world
• Industrial and manufactured products
• Machinery and industrial equipment
• Food and agricultural products
• Building and construction materials
• Chemical and plastic products
• Auto parts and electronic components
• All other industrial categories

═══════════════════════════════════════════
📋 SUPPLIER/FACTORY REGISTRATION
═══════════════════════════════════════════
Steps to register as a supplier or factory:
1. Visit: direct-hub.net/factory/register or /auth/role-selection
2. Choose account type: Manufacturer or Supplier
3. Enter company details: trade name, address, commercial registration number
4. Upload KYC verification documents: trade license, ID, quality certificates
5. Add IBAN bank account number to receive payments
6. Wait for DirectHub team review and approval (within 24-48 hours)
7. After approval: list products and start receiving orders immediately

═══════════════════════════════════════════
📦 PRODUCT LISTING STEPS
═══════════════════════════════════════════
How to add a new product:
1. Go to dashboard: /manufacturer/dashboard or /factory/products
2. Click "Add New Product"
3. Select the appropriate industrial category
4. Fill in product details:
   - Name in Arabic and English
   - Detailed description and technical specifications
   - Price and Minimum Order Quantity (MOQ)
   - Available quantities
5. Upload high-quality images (max 10 photos)
6. Set shipping terms (EXW, FOB, CIF, DDP)
7. Add certifications and standards (ISO, CE, Halal, etc.)
8. Publish — visible to buyers immediately

═══════════════════════════════════════════
🚢 IMPORT & SHIPPING INFORMATION
═══════════════════════════════════════════
Available shipping options:
• Sea Freight (FCL/LCL): 15-45 days, best for large quantities
• Air Freight: 3-7 days, for urgent shipments
• Land Freight: for neighboring countries and regional shipments

Supported Incoterms:
• EXW (Ex Works): buyer bears all costs from factory
• FOB (Free On Board): seller delivers goods on board vessel
• CIF (Cost, Insurance, Freight): seller pays shipping and insurance
• DDP (Delivered Duty Paid): seller bears all costs to destination
• DAP (Delivered At Place): delivery at specified location

Customs & Documentation:
• Platform provides customs clearance guidance
• Assistance with shipping documents (Bill of Lading, Packing List, Commercial Invoice)
• Cargo insurance available through platform partners
• Real-time shipment tracking via dashboard

═══════════════════════════════════════════
📝 RFQ SYSTEM (Request for Quotation)
═══════════════════════════════════════════
An RFQ is a formal document sent by a buyer to multiple suppliers requesting their prices.

RFQ Steps:
1. Go to /rfq-board or product page
2. Click "Request a Quote"
3. Fill in the RFQ form with details:
   - Product name and category
   - Required quantity and unit
   - Technical specifications
   - Target price (optional)
   - Delivery country and port
   - Delivery timeline
   - Packaging requirements
   - Required certifications
4. Send RFQ to multiple suppliers at once
5. Receive and compare offers
6. Negotiate with suppliers via messaging system
7. Accept the best offer and complete the order

When helping a buyer draft an RFQ, collect:
• Product name and industrial category
• Required quantity and unit (MOQ)
• Detailed technical specifications
• Target price (if any)
• Delivery country and required port
• Delivery timeline
• Packaging and labeling requirements
• Required certifications and standards (ISO, CE, Halal, etc.)
• Preferred payment terms

═══════════════════════════════════════════
💳 SECURE PAYMENT (ESCROW SYSTEM)
═══════════════════════════════════════════
• DirectHub uses an Escrow system to protect both buyers and sellers
• Buyer pays the platform first; funds are held until delivery is confirmed
• After delivery confirmation, funds are released to the supplier
• In case of dispute, DirectHub team intervenes for fair resolution
• Payment methods: bank transfer, credit cards, and more

═══════════════════════════════════════════
🌍 MULTI-LANGUAGE SUPPORT — CRITICAL RULE
═══════════════════════════════════════════
DETECT the user's language from their VERY FIRST message and respond ENTIRELY in that language throughout the entire conversation. Never switch languages unless the user explicitly asks.

Language detection rules:
- Arabic (العربية) → respond in clear, professional Modern Standard Arabic (الفصحى)
- English → respond in fluent, professional English
- Chinese (中文) → 用流利的普通话回复，专业且清晰
- Turkish (Türkçe) → Akıcı ve profesyonel Türkçe ile yanıt ver
- French (Français) → Répondre en français professionnel et fluide
- Any other language → respond in that exact same language

═══════════════════════════════════════════
⚡ RESPONSE RULES
═══════════════════════════════════════════
• Always start with a warm welcome on the FIRST message
• Be friendly, professional, and helpful at all times
• Provide organized, clear answers with bullet points when appropriate
• NEVER show any technical errors to the user — ever
• If you don't know a specific answer, direct the user to contact DirectHub support at direct-hub.net
• Operate with full efficiency and professionalism 24/7
• When mentioning links, use: https://direct-hub.net
• Keep responses concise but complete — avoid unnecessary repetition`;

const WELCOME_MESSAGE = `أهلاً وسهلاً بك في **دايركت هب (DirectHub)** 🌟

**منصتك الرائدة للربط الصناعي والتجاري (B2B)**

نحن نصلك مباشرةً بالمصانع العالمية والمحلية لتوريد أجود المواد الخام والمنتجات من مختلف أنحاء العالم.

---

**كيف يمكنني مساعدتك اليوم؟**

🛒 **للمشترين:**
• صياغة طلب عرض سعر (RFQ) احترافي
• البحث عن موردين موثوقين
• الاستفسار عن الاستيراد والشحن

🏭 **للموردين والمصانع:**
• كيفية إدراج منتجاتك وعرض بضائعك
• خطوات التسجيل والتحقق (KYC)
• إدارة الطلبات والعروض

📦 **معلومات عامة:**
• آلية عمل المنصة
• شروط الشحن والتسليم (Incoterms)
• نظام الدفع الآمن (Escrow)

اكتب استفسارك وسأكون معك فوراً! 🚀`;

export default function RFQCopilot({ onClose }: { onClose?: () => void }) {
  const { dir, isRTL } = useLanguage();
  const { user } = useAuth();
  const supabase = createClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: WELCOME_MESSAGE,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [rfqDraft, setRfqDraft] = useState<RFQDraft>({});
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [showDraft, setShowDraft] = useState(false);
  const lastResponseRef = useRef('');

  // ── useChat hook — direct Gemini connection via API route ──────────────────
  const { response, isLoading, error, sendMessage: sendToGemini } = useChat(
    'GEMINI',
    'gemini/gemini-3.6-flash',
    true // streaming enabled
  );

  // Track when streaming completes to add assistant message
  const isLoadingRef = useRef(false);
  const pendingMessagesRef = useRef<Message[]>([]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, response]);

  // When streaming completes, finalize the assistant message
  useEffect(() => {
    if (!isLoading && isLoadingRef.current && response) {
      isLoadingRef.current = false;
      const finalContent = response;
      lastResponseRef.current = response;

      const assistantMsg: Message = {
        role: 'assistant',
        content: finalContent,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMsg]);

      // Save session to DB silently
      if (user) {
        const allMessages = [...pendingMessagesRef.current, assistantMsg].map(m => ({
          role: m.role,
          content: m.content,
        }));
        (async () => {
          try {
            if (sessionId) {
              await supabase
                .from('rfq_copilot_sessions')
                .update({ messages: allMessages, draft_rfq: rfqDraft })
                .eq('id', sessionId);
            } else {
              const { data } = await supabase
                .from('rfq_copilot_sessions')
                .insert({
                  user_id: user.id,
                  messages: allMessages,
                  draft_rfq: rfqDraft,
                  status: 'active',
                })
                .select('id')
                .single();
              if (data) setSessionId(data.id);
            }
          } catch {
            // Silently ignore DB errors — chat still works
          }
        })();
      }
    }
    if (isLoading) {
      isLoadingRef.current = true;
    }
  }, [isLoading, response]);

  // Show error message in chat when AI call fails
  useEffect(() => {
    if (error && !isLoading) {
      isLoadingRef.current = false;
      const errorMsg: Message = {
        role: 'assistant',
        content: 'عذراً، حدث خطأ أثناء معالجة طلبك. يرجى المحاولة مرة أخرى. إذا استمرت المشكلة، تواصل مع فريق دايركت هب على direct-hub.net',
        timestamp: new Date(),
      };
      setMessages(prev => {
        // Avoid duplicate error messages
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant' && last.content === errorMsg.content) return prev;
        return [...prev, errorMsg];
      });
    }
  }, [error, isLoading]);

  const extractRFQData = (text: string, existing: RFQDraft): RFQDraft => {
    const updated = { ...existing };
    const qtyMatch = text.match(/(\d[\d,]*)\s*(قطعة|وحدة|طن|كيلو|piece|unit|ton|kg)/i);
    if (qtyMatch) updated.quantity = qtyMatch[0];
    const priceMatch = text.match(/\$\s*[\d,]+|\d+\s*(دولار|ريال|درهم)/i);
    if (priceMatch) updated.target_price = priceMatch[0];
    return updated;
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: Message = { role: 'user', content: input, timestamp: new Date() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    pendingMessagesRef.current = newMessages;
    setInput('');
    setRfqDraft(prev => extractRFQData(input, prev));

    // Build messages array for Gemini — system prompt + full conversation history
    const apiMessages = [
      { role: 'system' as const, content: DIRECTHUB_SYSTEM_PROMPT },
      ...newMessages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ];

    sendToGemini(apiMessages, { temperature: 0.7, max_tokens: 1000 });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const quickPrompts = [
    'أريد طلب عرض سعر لمنتج جديد',
    'كيف أسجل كمورد في المنصة؟',
    'ما هي خيارات الشحن المتاحة؟',
    'كيف يعمل نظام الدفع الآمن؟',
  ];

  const renderMessageContent = (content: string) => {
    return content.split(/(\*\*[^*]+\*\*)/).map((part, j) =>
      part.startsWith('**') && part.endsWith('**') ? (
        <strong key={j}>{part.slice(2, -2)}</strong>
      ) : (
        <span key={j}>{part}</span>
      )
    );
  };

  // The streaming response to show while loading
  const streamingDisplay = isLoading ? response : '';

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-gray-200 overflow-hidden" dir={dir}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-l from-primary/5 to-teal-50 border-b border-gray-200">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center">
            <Icon name="SparklesIcon" size={18} className="text-white" />
          </div>
          <div>
            <div className="font-bold text-gray-900 text-sm">خدمة العملاء للمساعدة والاستفسار</div>
            <div className="text-xs text-emerald-600 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              متاح 24/7
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDraft(!showDraft)}
            className="text-xs bg-white border border-gray-200 text-gray-600 px-2.5 py-1.5 rounded-lg hover:bg-gray-50 flex items-center gap-1"
          >
            <Icon name="DocumentTextIcon" size={13} />
            مسودة RFQ
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center"
            >
              <Icon name="XMarkIcon" size={15} />
            </button>
          )}
        </div>
      </div>

      {/* RFQ Draft Panel */}
      {showDraft && Object.keys(rfqDraft).some(k => rfqDraft[k as keyof RFQDraft]) && (
        <div className="bg-teal-50 border-b border-teal-200 px-4 py-3">
          <div className="text-xs font-semibold text-teal-700 mb-2 flex items-center gap-1">
            <Icon name="DocumentTextIcon" size={13} />
            مسودة RFQ الحالية
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {Object.entries(rfqDraft)
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k} className="text-xs">
                  <span className="text-teal-600">{k}: </span>
                  <span className="text-teal-900 font-medium">{v}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                msg.role === 'user' ?'bg-primary text-white rounded-tr-sm' :'bg-gray-100 text-gray-800 rounded-tl-sm'
              }`}
            >
              <span className="whitespace-pre-wrap">{renderMessageContent(msg.content)}</span>
            </div>
          </div>
        ))}

        {/* Live streaming response */}
        {isLoading && streamingDisplay && (
          <div className="flex justify-end">
            <div className="max-w-[80%] rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm leading-relaxed bg-gray-100 text-gray-800">
              <span className="whitespace-pre-wrap">{renderMessageContent(streamingDisplay)}</span>
              <span className="inline-block w-1 h-4 bg-primary animate-pulse ml-0.5 rounded-sm" />
            </div>
          </div>
        )}

        {/* Loading indicator when streaming hasn't started yet */}
        {isLoading && !streamingDisplay && (
          <div className="flex justify-end">
            <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
              <span className="text-xs text-gray-500 ml-1">جارٍ التفكير...</span>
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompts */}
      {messages.length <= 1 && (
        <div className="px-4 pb-2 flex gap-2 flex-wrap">
          {quickPrompts.map((p, i) => (
            <button
              key={i}
              onClick={() => setInput(p)}
              className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1.5 rounded-full hover:bg-gray-200 transition-colors"
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="px-4 py-3 border-t border-gray-200">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="اكتب رسالتك هنا..."
            rows={1}
            className="flex-1 px-3 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:border-primary resize-none max-h-24"
            style={{ minHeight: '42px' }}
            disabled={isLoading}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            className="w-10 h-10 bg-primary text-white rounded-xl flex items-center justify-center disabled:opacity-50 hover:bg-primary/90 transition-colors flex-shrink-0"
          >
            {isLoading ? (
              <Icon name="ArrowPathIcon" size={16} className="animate-spin" />
            ) : (
              <Icon name="PaperAirplaneIcon" size={16} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
