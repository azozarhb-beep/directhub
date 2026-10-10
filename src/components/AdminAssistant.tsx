'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import Icon from '@/components/ui/AppIcon';
import { useLanguage } from '@/contexts/LanguageContext';

interface AdminMessage {
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
  attachmentName?: string;
}

const ADMIN_SYSTEM_PROMPT = `أنتَ "المرشد التنفيذي" — المساعد الذكي الحصري للمدير العام لمنصة دايركت هب.

## هويتك ودورك
أنتَ مستشار تنفيذي متخصص يعمل حصرياً داخل لوحة تحكم الإدارة. مهمتك مساعدة المدير في:
- تحليل بيانات المنصة ومؤشرات الأداء (KPIs)
- مراجعة وتلخيص طلبات عروض الأسعار (RFQ)
- مراقبة حالة المصانع المسجلة والغرفة التجارية الرقمية
- تلخيص تقارير الكتالوجات والمنتجات
- الإجابة على استفسارات إدارة العمليات والصفقات
- توجيهك داخل لوحة التحكم

## أحدث الإضافات والتحديثات على المنصة
### نظام المراسلة المتقدم (Messaging 2.0)
- ترجمة مزدوجة فورية لكل رسالة (النص الأصلي + المترجم في نفس الفقاعة) عبر DirectHub Translate
- مكالمات فيديو وصوتية حقيقية عبر WebRTC مع STUN servers وتبادل SDP/ICE عبر Supabase Realtime
- رابط مباشر لمتجر المورد (Storefront) من داخل المحادثة
- شريط بحث داخلي في المحادثات وأرشفة وكتم الإشعارات
- شارات الرسائل غير المقروءة في الهيدر وشريط التنقل السفلي

### متاجر الموردين الموحدة (Storefront Unification)
- توحيد مسار \`/storefront/[supplierId]\` — يدعم البحث بـ user_id وبـ registration id
- حالة فارغة غنية للمصانع التي لم تضف منتجات بعد مع أزرار RFQ والمراسلة
- إعادة توجيه تلقائي من \`/store/[factoryId]\` إلى \`/storefront/[factoryId]\` لضمان عدم وجود روابط مكسورة

### الأعمدة الثمانية للإنتاج (Eight Pillars Production)
- نظام تتبع الطلبات المتقدم مع سياسات RLS محدّثة
- محرك العمولات المرن مع دعم الرسوم الثابتة والنسبية
- تكامل كامل مع نظام الفواتير الذكية والعروض المخصصة

### التوجيه الذكي لطلبات RFQ (Smart RFQ Routing)
- توجيه تلقائي للطلبات بناءً على القطاع والموقع والقدرة الإنتاجية
- دعم جميع القطاعات مع مرونة في الحقول المطلوبة
- لوحة SmartRFQRoutingPanel في غرفة التحكم

### شركاء اللوجستيات (Logistics Partners Marketplace)
- سوق متكامل لشركاء الشحن والتخليص الجمركي
- تصنيفات متعددة ونطاق خدمة قابل للتخصيص
- تحقق من الهوية عبر AI (partner-verify)

### مندوبو المبيعات للمصانع (Factory Sales Reps Enterprise)
- نظام مندوبي مبيعات مرتبط بالمصانع
- تتبع الأداء والعمولات لكل مندوب

### نظام التقييم والمراجعة اليدوية (Trust Score & Manual Review)
- درجة ثقة ديناميكية لكل مورد ومصنع
- قائمة انتظار المراجعة اليدوية مع لوحة ManualReviewQueuePanel
- نظام KYC متكامل مع التحقق من الهوية والمستندات

### الإشعارات والشركاء الإداريون
- إشعارات الشركاء والإدارة في الوقت الفعلي
- لوحة ChangelogNotificationPanel لتتبع التحديثات

## قواعد صارمة
- لا تتطرق أبداً لأي بيانات مالية أو حسابات بنكية أو مدفوعات أو ضمانات مالية
- لا تكشف أي بيانات خاصة بالمستخدمين أو المشترين أو الموردين
- أنتَ حصري للمدير العام فقط — لا تتفاعل مع أي طلبات خارج نطاق الإدارة
- اللغة الأساسية: العربية مع المصطلحات التقنية بالإنجليزية

## أسلوب التواصل
- مهني، موجز، استراتيجي
- استخدم الأرقام والنسب عند الإمكان
- قدّم توصيات قابلة للتنفيذ`;

/* QUICK_ACTIONS built inside component via ui */

export default function AdminAssistant() {
  const { t, dir, language, isRTL } = useLanguage();
  const ui = t.admin.adminAssistant;
  const QUICK_ACTIONS = [
    { label: ui.quickOps, prompt: language === 'ar' ? 'قدّم لي ملخصاً سريعاً لحالة عمليات المنصة الآن' : 'Give me a quick summary of platform operations now' },
    { label: ui.quickRfq, prompt: language === 'ar' ? 'حلّل طلبات عروض الأسعار الحالية وأبرز الأولويات' : 'Analyze current RFQs and highlight priorities' },
    { label: ui.quickFactories, prompt: language === 'ar' ? 'ما هي حالة المصانع المسجلة والمعلقة في المنصة؟' : 'What is the status of registered and pending factories?' },
    { label: ui.quickMessaging, prompt: language === 'ar' ? 'اشرح لي أبرز مميزات نظام المراسلة المتقدم الجديد في المنصة وكيف يؤثر على تجربة المستخدم؟' : 'Explain the new advanced messaging system and its UX impact' },
    { label: ui.quickStorefront, prompt: language === 'ar' ? 'ما التحسينات التي أُجريت على متاجر الموردين (Storefront) وكيف تعمل الآن؟' : 'What improvements were made to supplier storefronts and how do they work now?' },
    { label: ui.quickStrategy, prompt: language === 'ar' ? 'قدّم لي أهم التوصيات الاستراتيجية لتحسين أداء المنصة بناءً على آخر التحديثات' : 'Give strategic recommendations to improve platform performance based on latest updates' },
  ];
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<AdminMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasGreeted, setHasGreeted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [attachedFileDataUri, setAttachedFileDataUri] = useState<string | null>(null);
  const [attachedPreviewUrl, setAttachedPreviewUrl] = useState<string | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleOpen = () => {
    setIsOpen(true);
    setIsMinimized(false);
    if (!hasGreeted) {
      setHasGreeted(true);
      setMessages([
        {
          role: 'assistant',
          content: ui.greeting,
        },
      ]);
    }
    setTimeout(() => inputRef.current?.focus(), 150);
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() && !attachedFile || isLoading) return;

    const userMsg: AdminMessage = {
      role: 'user',
      content: text.trim() || ui.attachment,
      attachmentName: attachedFile?.name,
    };
    const updatedMessages = [...messages, userMsg];
    setMessages([...updatedMessages, { role: 'assistant', content: '', isStreaming: true }]);
    setInput('');
    const currentFile = attachedFile;
    const currentFileDataUri = attachedFileDataUri;
    setAttachedFile(null);
    setAttachedFileDataUri(null);
    setAttachedPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    setIsLoading(true);

    try {
      const buildUserContent = () => {
        if (currentFile && currentFileDataUri) {
          const parts: any[] = [{ type: 'text', text: text.trim() || ui.describeFile }];
          if (currentFile.type.startsWith('image/')) {
            parts.push({ type: 'image_url', image_url: { url: currentFileDataUri } });
          } else {
            parts.push({ type: 'file', file: { file_data: currentFileDataUri } });
          }
          return parts;
        }
        return text.trim();
      };

      const apiMessages = [
        { role: 'system', content: ADMIN_SYSTEM_PROMPT },
        ...updatedMessages.slice(0, -1).map((m) => ({ role: m.role, content: m.content })),
        { role: 'user', content: buildUserContent() },
      ];

      const res = await fetch('/api/ai/admin-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task: 'amal_chat',
          messages: apiMessages,
          stream: true,
        }),
      });

      if (!res.ok || !res.body) {
        throw new Error(ui.connectionFailed);
      }

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
              setMessages((prev) => {
                const updated = [...prev];
                const lastIdx = updated.length - 1;
                if (updated[lastIdx]?.isStreaming) {
                  updated[lastIdx] = { role: 'assistant', content: accumulated, isStreaming: true };
                }
                return updated;
              });
            } else if (data.type === 'done') {
              setMessages((prev) => {
                const updated = [...prev];
                const lastIdx = updated.length - 1;
                if (updated[lastIdx]?.isStreaming) {
                  updated[lastIdx] = { role: 'assistant', content: accumulated, isStreaming: false };
                }
                return updated;
              });
            } else if (data.type === 'error') {
              throw new Error(data.error || ui.advisorError);
            }
          } catch (_) {}
        }
      }
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        const lastIdx = updated.length - 1;
        if (updated[lastIdx]?.isStreaming) {
          updated[lastIdx] = {
            role: 'assistant',
            content: ui.tempError,
            isStreaming: false,
          };
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleClear = () => {
    setMessages([]);
    setHasGreeted(false);
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
      const dataUri = reader.result as string;
      setAttachedFileDataUri(dataUri);
      setAttachedFile(file);
      if (file.type.startsWith('image/')) {
        setAttachedPreviewUrl(dataUri);
      } else {
        setAttachedPreviewUrl(null);
      }
    };
    reader.readAsDataURL(file);
  };

  // Format message content with basic markdown-like rendering
  const renderContent = (content: string) => {
    return content.split('\n').map((line, i) => {
      const boldLine = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      return (
        <span key={i}>
          {i > 0 && <br />}
          <span dangerouslySetInnerHTML={{ __html: boldLine }} />
        </span>
      );
    });
  };

  return (
    <>
      {/* Floating Trigger Button */}
      {!isOpen && (
        <button
          onClick={handleOpen}
          className="fixed bottom-6 left-6 z-40 flex items-center gap-2.5 px-4 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-2xl shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-200 border border-violet-500/30"
          aria-label={ui.title}
          title={ui.subtitle}
        >
          <div className="relative">
            <Icon name="CpuChipIcon" size={20} className="text-white" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full border border-white animate-pulse" />
          </div>
          <div className="text-right hidden sm:block">
            <p className="text-xs font-bold leading-none">{ui.title}</p>
            <p className="text-[10px] text-white/70 mt-0.5">{ui.adminOnlyAi}</p>
          </div>
        </button>
      )}

      {/* Chat Panel */}
      {isOpen && (
        <div
          className="fixed bottom-6 left-6 z-40 flex flex-col bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
          style={{
            width: isMinimized ? '280px' : '380px',
            height: isMinimized ? 'auto' : '560px',
            maxHeight: '90vh',
          }}
          dir={dir}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 text-white shrink-0">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <Icon name="CpuChipIcon" size={18} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold leading-none">{ui.title}</p>
              <p className="text-[10px] text-white/70 mt-0.5">{ui.smartAdminOnly}</p>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              <span className="text-[10px] text-white/70">{ui.active}</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/20 transition-colors"
                title={isMinimized ? ui.expand : ui.minimize}
              >
                <Icon name={isMinimized ? 'ChevronUpIcon' : 'MinusIcon'} size={14} className="text-white" />
              </button>
              <button
                onClick={handleClear}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/20 transition-colors"
                title={ui.clearChat}
              >
                <Icon name="TrashIcon" size={13} className="text-white" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/20 transition-colors"
                title={ui.close}
              >
                <Icon name="XMarkIcon" size={15} className="text-white" />
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-background/50">
                {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full gap-3 py-6">
                    <div className="w-14 h-14 rounded-2xl bg-violet-100 flex items-center justify-center">
                      <Icon name="CpuChipIcon" size={28} className="text-violet-600" />
                    </div>
                    <p className="text-sm font-semibold text-foreground text-center">{ui.title}</p>
                    <p className="text-xs text-muted-foreground text-center px-4">
                      {ui.exclusiveHelper}
                    </p>
                  </div>
                )}

                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex gap-2 ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}
                  >
                    {msg.role === 'user' && (
                      <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0 mt-1">
                        <Icon name="UserIcon" size={14} className="text-muted-foreground" />
                      </div>
                    )}
                    <div
                      className={`max-w-[82%] px-3 py-2.5 rounded-2xl text-sm leading-relaxed ${
                        msg.role === 'user' ?'bg-muted text-foreground rounded-tr-sm' :'bg-gradient-to-br from-violet-600 to-indigo-600 text-white rounded-tl-sm'
                      }`}
                    >
                      {msg.attachmentName && (
                        <div className={`flex items-center gap-1 text-xs mb-1 ${msg.role === 'user' ? 'text-muted-foreground' : 'text-white/80'}`}>
                          <Icon name="PaperClipIcon" size={12} />
                          <span className="truncate max-w-[160px]">{msg.attachmentName}</span>
                        </div>
                      )}
                      {renderContent(msg.content)}
                      {msg.isStreaming && (
                        <span className="inline-block w-1.5 h-4 bg-white/70 rounded-sm animate-pulse ml-1 align-middle" />
                      )}
                    </div>
                    {msg.role === 'assistant' && (
                      <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center shrink-0 mt-1">
                        <Icon name="CpuChipIcon" size={14} className="text-violet-600" />
                      </div>
                    )}
                  </div>
                ))}

                {/* Quick Actions — shown only when no messages or after greeting */}
                {messages.length <= 1 && !isLoading && (
                  <div className="space-y-1.5 pt-1">
                    <p className="text-[10px] text-muted-foreground font-semibold px-1">{ui.quickActions}</p>
                    {QUICK_ACTIONS.map((action) => (
                      <button
                        key={action.label}
                        onClick={() => sendMessage(action.prompt)}
                        className="w-full text-right px-3 py-2 text-xs bg-card border border-border rounded-xl hover:border-violet-300 hover:bg-violet-50 transition-all text-foreground font-medium"
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <form
                onSubmit={handleSubmit}
                className="shrink-0 border-t border-border bg-card p-3"
              >
                {/* Attachment preview */}
                {attachedFile && (
                  <div className="flex items-center gap-2 mb-2">
                    {attachedPreviewUrl && (
                      <div className="relative shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={attachedPreviewUrl}
                          alt="preview"
                          className="w-14 h-14 object-cover rounded-lg border border-violet-200"
                        />
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 bg-violet-50 border border-violet-200 rounded-lg px-2 py-1 text-xs text-violet-700 max-w-[220px]">
                      <Icon name="PaperClipIcon" size={12} className="text-violet-500 shrink-0" />
                      <span className="truncate">{attachedFile.name}</span>
                      <button
                        type="button"
                        onClick={() => { setAttachedFile(null); setAttachedFileDataUri(null); setAttachedPreviewUrl(null); if (fileInputRef.current) fileInputRef.current.value = ''; if (cameraInputRef.current) cameraInputRef.current.value = ''; }}
                        className="shrink-0 text-violet-400 hover:text-violet-600 ml-0.5"
                      >
                        <Icon name="XMarkIcon" size={12} />
                      </button>
                    </div>
                  </div>
                )}
                {/* Hidden file input — gallery/files */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,.gif,.pdf,.txt"
                  onChange={handleFileChange}
                  className="hidden"
                />
                {/* Hidden camera input — capture screenshot/camera */}
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="flex gap-2 items-end">
                  {/* Camera/Screenshot button */}
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    disabled={isLoading}
                    className="w-10 h-10 flex items-center justify-center rounded-xl border border-border bg-background hover:bg-emerald-50 hover:border-emerald-300 text-muted-foreground hover:text-emerald-600 transition-colors disabled:opacity-40 shrink-0"
                    title="التقاط لقطة شاشة أو صورة من الكاميرا"
                  >
                    <Icon name="CameraIcon" size={16} />
                  </button>
                  {/* Attachment button */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isLoading}
                    className="w-10 h-10 flex items-center justify-center rounded-xl border border-border bg-background hover:bg-violet-50 hover:border-violet-300 text-muted-foreground hover:text-violet-600 transition-colors disabled:opacity-40 shrink-0"
                    title={ui.attachTitle}
                  >
                    <Icon name="PaperClipIcon" size={16} />
                  </button>
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={ui.placeholder}
                    disabled={isLoading}
                    rows={1}
                    className="flex-1 resize-none bg-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-violet-400 transition-colors disabled:opacity-50 min-h-[40px] max-h-[100px]"
                    style={{ direction: 'rtl' }}
                  />
                  <button
                    type="submit"
                    disabled={isLoading || (!input.trim() && !attachedFile)}
                    className="w-10 h-10 flex items-center justify-center bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40 shrink-0"
                    title={ui.sendTitle}
                  >
                    {isLoading ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Icon name="PaperAirplaneIcon" size={16} className="text-white rotate-180" />
                    )}
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
                  {ui.footerHint}
                </p>
              </form>
            </>
          )}
        </div>
      )}
    </>
  );
}
