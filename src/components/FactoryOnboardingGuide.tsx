'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Icon from '@/components/ui/AppIcon';
import { useLanguage } from '@/contexts/LanguageContext';

interface FactoryOnboardingGuideProps {
  hasDocuments: boolean;
  canListProducts: boolean;
  factoryRegistration: any;
  onUploadDocs: () => void;
  onAddProduct: () => void;
}

interface Message {
  role: 'assistant' | 'user';
  content: string;
  isStreaming?: boolean;
}

const ONBOARDING_SYSTEM_PROMPT = `أنت مساعد الإعداد الذكي لمنصة دايركت هب (DirectHub) — المنصة الرائدة للربط الصناعي B2B.

مهمتك: إرشاد المصانع والموردين الجدد خطوة بخطوة لتفعيل حساباتهم وإدراج منتجاتهم.

خطوات التفعيل:
1. رفع التراخيص والوثائق (رخصة تجارية + رخصة تصنيع/استيراد)
2. انتظار مراجعة الإدارة (24-48 ساعة)
3. إدراج المنتجات بعد الموافقة
4. تفعيل إعدادات الدفع (IBAN / محفظة رقمية)
5. البدء في استقبال الطلبات والردود على طلبات الأسعار (RFQ)

قواعد اللغة: اكتشف لغة المستخدم من رسالته الأولى وأجب بنفس اللغة دائماً.
- العربية: أجب بالعربية الفصحى
- الإنجليزية: Respond in professional English
- الصينية: 用流利的普通话回复
- التركية: Akıcı Türkçe ile yanıt ver

كن ودوداً، مشجعاً، ومختصراً. استخدم الأرقام والنقاط لتوضيح الخطوات.`;

export default function FactoryOnboardingGuide({
  hasDocuments,
  canListProducts,
  factoryRegistration,
  onUploadDocs,
  onAddProduct,
}: FactoryOnboardingGuideProps) {
  const { isRTL, language } = useLanguage();
  const [isExpanded, setIsExpanded] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const getWelcomeMessage = useCallback(() => {
    if (!hasDocuments && !canListProducts) {
      return language === 'ar'
        ? `مرحباً بك في غرفتك التجارية على دايركت هب! 🎉\n\nأنا مساعدك الذكي لمساعدتك في تفعيل حسابك وبدء البيع.\n\n**الخطوة الأولى:** رفع التراخيص والوثائق\n\nلتتمكن من إدراج منتجاتك وبدء استقبال الطلبات، يجب أولاً رفع:\n• رخصة تجارية سارية\n• رخصة تصنيع أو استيراد\n\nبعد مراجعة الإدارة (24-48 ساعة)، ستتمكن من إدراج منتجاتك فوراً.\n\nهل تريد البدء برفع الوثائق الآن؟`
        : `Welcome to your Business Room on DirectHub! 🎉\n\nI'm your smart onboarding guide to help you activate your account and start selling.\n\n**Step 1:** Upload your licenses and documents\n\nTo list your products and start receiving orders, you need to upload:\n• Valid Trade License\n• Manufacturing or Import License\n\nAfter admin review (24-48 hours), you can list products immediately.\n\nWould you like to start uploading your documents now?`;
    }

    if (hasDocuments && !canListProducts) {
      return language === 'ar'
        ? `أحسنت! ✅ تم استلام وثائقك بنجاح.\n\nحسابك قيد المراجعة من قِبل فريق دايركت هب.\n\n⏳ **المدة المتوقعة:** 24-48 ساعة\n\nبمجرد الموافقة، ستتلقى إشعاراً وستتمكن من:\n• إدراج منتجاتك مباشرة\n• استقبال طلبات الأسعار (RFQ)\n• تفعيل إعدادات الدفع\n\nهل لديك أي سؤال في انتظار الموافقة؟`
        : `Well done! ✅ Your documents have been received.\n\nYour account is under review by the DirectHub team.\n\n⏳ **Expected time:** 24-48 hours\n\nOnce approved, you'll receive a notification and can:\n• List your products immediately\n• Receive RFQ (Request for Quotation) requests\n• Activate payment settings\n\nDo you have any questions while waiting for approval?`;
    }

    if (canListProducts) {
      return language === 'ar'
        ? `مبروك! 🎊 حسابك مفعّل بالكامل!\n\nأنت الآن جاهز للبيع على دايركت هب.\n\n**الخطوات التالية:**\n1. 📦 أضف منتجاتك الأولى\n2. 💳 فعّل إعدادات الدفع (IBAN)\n3. 💬 ابدأ الرد على طلبات الأسعار\n\nكيف يمكنني مساعدتك اليوم؟`
        : `Congratulations! 🎊 Your account is fully activated!\n\nYou are now ready to sell on DirectHub.\n\n**Next steps:**\n1. 📦 Add your first products\n2. 💳 Activate payment settings (IBAN)\n3. 💬 Start responding to RFQ requests\n\nHow can I help you today?`;
    }

    return language === 'ar' ?'مرحباً بك في غرفتك التجارية! كيف يمكنني مساعدتك؟' :'Welcome to your Business Room! How can I help you?';
  }, [hasDocuments, canListProducts, language]);

  useEffect(() => {
    if (!initialized) {
      setMessages([{ role: 'assistant', content: getWelcomeMessage() }]);
      setInitialized(true);
    }
  }, [initialized, getWelcomeMessage]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: Message = { role: 'user', content: text.trim() };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    setIsLoading(true);

    setMessages(prev => [...prev, { role: 'assistant', content: '', isStreaming: true }]);

    try {
      const contextInfo = `
Current factory status:
- Has uploaded documents: ${hasDocuments}
- Account approved/can list products: ${canListProducts}
- Registration status: ${factoryRegistration?.registration_status || 'not started'}
- KYC status: ${factoryRegistration?.kyc_status || 'not started'}
`;

      const apiMessages = [
        { role: 'system', content: ONBOARDING_SYSTEM_PROMPT + '\n\n' + contextInfo },
        ...updatedMessages.map(m => ({ role: m.role, content: m.content })),
      ];

      const res = await fetch('/api/ai/factory-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages, stream: true }),
      });

      if (!res.ok || !res.body) throw new Error('Failed');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'chunk') {
              const content = data.chunk?.choices?.[0]?.delta?.content || '';
              accumulated += content;
              setMessages(prev => {
                const updated = [...prev];
                const lastIdx = updated.length - 1;
                if (updated[lastIdx]?.isStreaming) {
                  updated[lastIdx] = { role: 'assistant', content: accumulated, isStreaming: true };
                }
                return updated;
              });
            } else if (data.type === 'done') {
              setMessages(prev => {
                const updated = [...prev];
                const lastIdx = updated.length - 1;
                if (updated[lastIdx]?.isStreaming) {
                  updated[lastIdx] = { role: 'assistant', content: accumulated, isStreaming: false };
                }
                return updated;
              });
            }
          } catch (_) {}
        }
      }
    } catch {
      setMessages(prev => {
        const updated = [...prev];
        const lastIdx = updated.length - 1;
        if (updated[lastIdx]?.isStreaming) {
          const fallback = language === 'ar' ? 'عذراً، حدث خطأ. يرجى المحاولة مرة أخرى.' : 'Sorry, an error occurred. Please try again.';
          updated[lastIdx] = { role: 'assistant', content: fallback, isStreaming: false };
        }
        return updated;
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const isAgentManaged = !!(
    factoryRegistration?.agent_id ||
    factoryRegistration?.referred_by_agent_id ||
    factoryRegistration?.referred_by_agent_code ||
    factoryRegistration?.registration_type === 'agent'
  );

  const quickActions = !hasDocuments
    ? [
        ...(isAgentManaged
          ? []
          : [
              {
                label: language === 'ar' ? '📄 رفع الوثائق الآن' : '📄 Upload Documents Now',
                action: onUploadDocs,
                primary: true,
              },
            ]),
        {
          label: language === 'ar' ? 'ما المستندات المطلوبة؟' : 'What documents are needed?',
          action: () => sendMessage(language === 'ar' ? 'ما المستندات المطلوبة للتسجيل؟' : 'What documents are required for registration?'),
          primary: false,
        },
      ]
    : canListProducts
    ? [
        {
          label: language === 'ar' ? '📦 إضافة منتج جديد' : '📦 Add New Product',
          action: onAddProduct,
          primary: true,
        },
        {
          label: language === 'ar' ? 'كيف أدرج منتجاتي؟' : 'How do I list my products?',
          action: () => sendMessage(language === 'ar' ? 'كيف أدرج منتجاتي على المنصة؟' : 'How do I list my products on the platform?'),
          primary: false,
        },
      ]
    : [
        {
          label: language === 'ar' ? 'متى تنتهي المراجعة؟' : 'When will review finish?',
          action: () => sendMessage(language === 'ar' ? 'متى ستنتهي مراجعة حسابي؟' : 'When will my account review be completed?'),
          primary: false,
        },
        {
          label: language === 'ar' ? 'ماذا أفعل بعد الموافقة؟' : 'What to do after approval?',
          action: () => sendMessage(language === 'ar' ? 'ماذا أفعل بعد الموافقة على حسابي؟' : 'What should I do after my account is approved?'),
          primary: false,
        },
      ];

  const titleText = language === 'ar' ? 'مساعد الإعداد الذكي' : language === 'zh' ? '智能入驻助手' : language === 'tr' ? 'Akıllı Kurulum Asistanı' : 'Smart Onboarding Guide';
  const subtitleText = language === 'ar' ? 'دليلك لتفعيل حسابك وبدء البيع' : language === 'zh' ? '激活账户并开始销售的指南' : language === 'tr' ? 'Hesabınızı etkinleştirme rehberi' : 'Your guide to activating your account';
  const placeholderText = language === 'ar' ? 'اسأل عن خطوات التفعيل...' : language === 'zh' ? '询问激活步骤...' : language === 'tr' ? 'Aktivasyon adımlarını sorun...' : 'Ask about activation steps...';

  // Progress steps
  const steps = [
    {
      label: language === 'ar' ? 'رفع الوثائق' : 'Upload Documents',
      done: hasDocuments,
      icon: 'DocumentArrowUpIcon',
    },
    {
      label: language === 'ar' ? 'مراجعة الإدارة' : 'Admin Review',
      done: canListProducts,
      icon: 'ShieldCheckIcon',
    },
    {
      label: language === 'ar' ? 'إدراج المنتجات' : 'List Products',
      done: false,
      icon: 'CubeIcon',
    },
  ];

  return (
    <div
      className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm mb-6"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Header */}
      <button
        onClick={() => setIsExpanded(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-primary/10 to-primary/5 hover:from-primary/15 hover:to-primary/8 transition-colors"
      >
        <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
          <Icon name="SparklesIcon" size={18} className="text-primary" />
        </div>
        <div className="flex-1 text-start min-w-0">
          <p className="text-sm font-bold text-foreground">{titleText}</p>
          <p className="text-xs text-muted-foreground">{subtitleText}</p>
        </div>
        {/* Progress indicator */}
        <div className="flex items-center gap-1.5 shrink-0">
          {steps.map((step, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-colors ${step.done ? 'bg-green-500' : i === steps.findIndex(s => !s.done) ? 'bg-primary animate-pulse' : 'bg-border'}`}
              title={step.label}
            />
          ))}
        </div>
        <Icon
          name={isExpanded ? 'ChevronUpIcon' : 'ChevronDownIcon'}
          size={16}
          className="text-muted-foreground shrink-0"
        />
      </button>

      {isExpanded && (
        <>
          {/* Progress Steps */}
          <div className="px-4 py-3 border-b border-border bg-background/50">
            <div className="flex items-center gap-2">
              {steps.map((step, i) => (
                <React.Fragment key={i}>
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${step.done ? 'bg-green-100 text-green-600' : i === steps.findIndex(s => !s.done) ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                      {step.done
                        ? <Icon name="CheckIcon" size={12} />
                        : <Icon name={step.icon as any} size={12} />
                      }
                    </div>
                    <span className={`text-xs truncate ${step.done ? 'text-green-600 font-medium' : i === steps.findIndex(s => !s.done) ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
                      {step.label}
                    </span>
                  </div>
                  {i < steps.length - 1 && (
                    <div className={`w-4 h-px shrink-0 ${step.done ? 'bg-green-400' : 'bg-border'}`} />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Messages */}
          <div className="h-52 overflow-y-auto p-3 space-y-2 bg-background">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === 'user' ? (isRTL ? 'justify-start' : 'justify-end') : (isRTL ? 'justify-end' : 'justify-start')}`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1 mx-1">
                    <Icon name="SparklesIcon" size={12} className="text-primary" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] px-3 py-2 rounded-xl text-xs leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user' ?'bg-primary text-primary-foreground' :'bg-muted text-foreground'
                  }`}
                >
                  {msg.content}
                  {msg.isStreaming && (
                    <span className="inline-block w-1 h-3 bg-primary/60 rounded-sm animate-pulse ml-0.5" />
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Actions */}
          {messages.length <= 2 && (
            <div className="px-3 pb-2 flex flex-wrap gap-1.5">
              {quickActions.map((qa, i) => (
                <button
                  key={i}
                  onClick={qa.action}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    qa.primary
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                      : 'bg-muted text-foreground hover:bg-muted/80 border border-border'
                  }`}
                >
                  {qa.label}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <form onSubmit={handleSubmit} className="flex items-center gap-2 px-3 pb-3">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={placeholderText}
              disabled={isLoading}
              className="flex-1 px-3 py-2 bg-background border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors disabled:opacity-50"
              dir={isRTL ? 'rtl' : 'ltr'}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="w-8 h-8 flex items-center justify-center bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-40 shrink-0"
            >
              {isLoading
                ? <div className="w-3 h-3 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                : <Icon name="PaperAirplaneIcon" size={14} />
              }
            </button>
          </form>
        </>
      )}
    </div>
  );
}
