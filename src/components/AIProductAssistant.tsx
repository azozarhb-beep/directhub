'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Icon from '@/components/ui/AppIcon';
import toast from 'react-hot-toast';

// ─── Types ────────────────────────────────────────────────────────────────────
interface SpecField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select';
  options?: string[];
  required?: boolean;
}

interface CategoryConfig {
  slug: string;
  name: string;
  specFields: SpecField[];
  systemHint: string;
}

interface AttachedFile {
  name: string;
  type: string;
  dataUri: string;
  size: number;
}

// ─── Category-specific AI configurations ─────────────────────────────────────
const CATEGORY_CONFIGS: Record<string, CategoryConfig> = {
  electronics: {
    slug: 'electronics', name: 'Electronics & Technology',
    specFields: [
      { key: 'voltage', label: 'Voltage (V)', type: 'text', required: true },
      { key: 'wattage', label: 'Wattage (W)', type: 'text', required: true },
      { key: 'certifications', label: 'Certifications (CE, FCC, RoHS)', type: 'text' },
      { key: 'operating_temp', label: 'Operating Temperature Range', type: 'text' },
      { key: 'warranty', label: 'Warranty Period', type: 'text', required: true },
    ],
    systemHint: 'You are an expert electronics product specialist for a B2B marketplace. Ask about voltage, wattage, certifications (CE/FCC/RoHS), operating temperature, and warranty. Emphasize safety standards and compliance.',
  },
  machinery: {
    slug: 'machinery', name: 'Industrial Machinery',
    specFields: [
      { key: 'power_output', label: 'Power Output (kW/HP)', type: 'text', required: true },
      { key: 'dimensions', label: 'Machine Dimensions (L×W×H)', type: 'text', required: true },
      { key: 'production_capacity', label: 'Production Capacity/Hour', type: 'text', required: true },
      { key: 'voltage_phase', label: 'Voltage & Phase', type: 'text', required: true },
      { key: 'warranty', label: 'Warranty & After-Sales', type: 'text' },
    ],
    systemHint: 'You are an industrial machinery expert for a B2B marketplace. Focus on power output, production capacity, dimensions, voltage requirements, and after-sales support.',
  },
  textiles: {
    slug: 'textiles', name: 'Textiles & Apparel',
    specFields: [
      { key: 'fabric_composition', label: 'Fabric Composition (e.g. 100% Cotton)', type: 'text', required: true },
      { key: 'gsm', label: 'GSM (grams per square meter)', type: 'number', required: true },
      { key: 'width', label: 'Fabric Width (cm)', type: 'number' },
      { key: 'color_fastness', label: 'Color Fastness Grade', type: 'text' },
      { key: 'certifications', label: 'Certifications (OEKO-TEX, GOTS)', type: 'text' },
    ],
    systemHint: 'You are a textiles and apparel specialist for a B2B marketplace. Always ask about fabric composition percentage, GSM weight, width, color fastness, and relevant certifications like OEKO-TEX or GOTS.',
  },
  building: {
    slug: 'building', name: 'Building Materials',
    specFields: [
      { key: 'grade_standard', label: 'Grade/Standard (e.g. ASTM, BS)', type: 'text', required: true },
      { key: 'compressive_strength', label: 'Compressive Strength (MPa)', type: 'text' },
      { key: 'dimensions', label: 'Dimensions/Size', type: 'text', required: true },
      { key: 'fire_rating', label: 'Fire Rating', type: 'text' },
      { key: 'load_capacity', label: 'Load Capacity', type: 'text' },
    ],
    systemHint: 'You are a building materials expert for a B2B marketplace. Ask about grade standards (ASTM/BS/EN), compressive strength, dimensions, fire rating, and load capacity.',
  },
  food: {
    slug: 'food', name: 'Food & Agriculture',
    specFields: [
      { key: 'shelf_life', label: 'Shelf Life', type: 'text', required: true },
      { key: 'storage_conditions', label: 'Storage Conditions', type: 'text', required: true },
      { key: 'certifications', label: 'Certifications (Halal, Organic, ISO 22000)', type: 'text', required: true },
      { key: 'packaging_type', label: 'Packaging Type & Size', type: 'text' },
      { key: 'origin', label: 'Country/Region of Origin', type: 'text', required: true },
    ],
    systemHint: 'You are a food & agriculture product specialist for a B2B marketplace. Always ask about shelf life, storage conditions, Halal/Organic certifications, packaging, and country of origin.',
  },
  chemicals: {
    slug: 'chemicals', name: 'Chemicals & Plastics',
    specFields: [
      { key: 'cas_number', label: 'CAS Number', type: 'text', required: true },
      { key: 'purity', label: 'Purity %', type: 'number', required: true },
      { key: 'flash_point', label: 'Flash Point (°C)', type: 'text' },
      { key: 'hazard_class', label: 'Hazard Classification (GHS)', type: 'text', required: true },
      { key: 'packaging', label: 'Packaging (drums/IBC/bags)', type: 'text' },
    ],
    systemHint: 'You are a chemicals and plastics specialist for a B2B marketplace. Always ask for CAS number, purity percentage, GHS hazard classification, flash point, and SDS availability.',
  },
  auto: {
    slug: 'auto', name: 'Auto Parts & Accessories',
    specFields: [
      { key: 'oem_number', label: 'OEM Part Number', type: 'text', required: true },
      { key: 'compatibility', label: 'Vehicle Compatibility (Make/Model/Year)', type: 'text', required: true },
      { key: 'material', label: 'Material', type: 'text' },
      { key: 'warranty', label: 'Warranty', type: 'text', required: true },
      { key: 'certifications', label: 'Certifications (IATF, ISO/TS)', type: 'text' },
    ],
    systemHint: 'You are an automotive parts specialist for a B2B marketplace. Always ask for OEM part number, vehicle compatibility details (make/model/year), material specification, warranty terms, and IATF/ISO certifications.',
  },
  packaging: {
    slug: 'packaging', name: 'Packaging Solutions',
    specFields: [
      { key: 'material', label: 'Material (cardboard/plastic/glass)', type: 'text', required: true },
      { key: 'dimensions', label: 'Dimensions (L×W×H mm)', type: 'text', required: true },
      { key: 'load_capacity', label: 'Load/Weight Capacity', type: 'text' },
      { key: 'print_options', label: 'Printing Options', type: 'text' },
      { key: 'food_grade', label: 'Food Grade Compliant?', type: 'select', options: ['Yes', 'No'], required: true },
    ],
    systemHint: 'You are a packaging solutions expert for a B2B marketplace. Ask about material type, dimensions, load capacity, printing options, and food-grade compliance.',
  },
  energy: {
    slug: 'energy', name: 'Energy & Power',
    specFields: [
      { key: 'power_output', label: 'Power Output (W/kW)', type: 'text', required: true },
      { key: 'efficiency', label: 'Efficiency %', type: 'number', required: true },
      { key: 'voltage', label: 'Voltage (V)', type: 'text', required: true },
      { key: 'certifications', label: 'Certifications (IEC, UL, TÜV)', type: 'text', required: true },
      { key: 'warranty', label: 'Warranty (years)', type: 'number' },
    ],
    systemHint: 'You are an energy and power systems expert for a B2B marketplace. Focus on power output, efficiency rating, voltage specifications, IEC/UL/TÜV certifications, and warranty period.',
  },
  medical: {
    slug: 'medical', name: 'Medical & Healthcare',
    specFields: [
      { key: 'device_class', label: 'Device Classification (Class I/II/III)', type: 'select', options: ['Class I', 'Class II', 'Class III'], required: true },
      { key: 'sterility', label: 'Sterility', type: 'select', options: ['Sterile', 'Non-sterile'], required: true },
      { key: 'shelf_life', label: 'Shelf Life', type: 'text', required: true },
      { key: 'regulatory_approval', label: 'Regulatory Approval (FDA/CE/ISO 13485)', type: 'text', required: true },
      { key: 'material', label: 'Material & Biocompatibility', type: 'text' },
    ],
    systemHint: 'You are a medical device and healthcare product specialist for a B2B marketplace. Device classification, sterility, regulatory approvals (FDA/CE/ISO 13485), and biocompatibility are mandatory.',
  },
  furniture: {
    slug: 'furniture', name: 'Furniture & Interiors',
    specFields: [
      { key: 'material', label: 'Primary Material', type: 'text', required: true },
      { key: 'dimensions', label: 'Dimensions (L×W×H cm)', type: 'text', required: true },
      { key: 'weight_capacity', label: 'Weight Capacity (kg)', type: 'number' },
      { key: 'finish', label: 'Surface Finish/Color Options', type: 'text' },
      { key: 'assembly', label: 'Assembly Required?', type: 'select', options: ['Yes', 'No'] },
    ],
    systemHint: 'You are a furniture and interiors specialist for a B2B marketplace. Ask about primary material, dimensions, weight capacity, finish options, assembly requirements, and CARB/FSC certifications for wood products.',
  },
  raw_materials: {
    slug: 'raw_materials', name: 'Raw Materials',
    specFields: [
      { key: 'grade', label: 'Grade/Quality Standard', type: 'text', required: true },
      { key: 'purity', label: 'Purity/Composition %', type: 'text', required: true },
      { key: 'form', label: 'Form', type: 'select', options: ['Powder', 'Granules', 'Liquid', 'Solid', 'Other'], required: true },
      { key: 'moisture', label: 'Moisture Content %', type: 'number' },
      { key: 'origin', label: 'Country of Origin', type: 'text', required: true },
    ],
    systemHint: 'You are a raw materials procurement specialist for a B2B marketplace. Always ask about grade/quality standard, purity percentage, physical form, moisture content, packaging options, and country of origin.',
  },
};

const DEFAULT_CONFIG: CategoryConfig = {
  slug: 'general', name: 'General Industrial Product',
  specFields: [
    { key: 'material', label: 'Primary Material', type: 'text' },
    { key: 'dimensions', label: 'Dimensions/Size', type: 'text' },
    { key: 'certifications', label: 'Certifications', type: 'text' },
    { key: 'warranty', label: 'Warranty', type: 'text' },
  ],
  systemHint: `أنت "مساعد إدراج المنتجات الذكي" لمنصة دايركت هب (DirectHub) — المنصة الرائدة للربط الصناعي والتجاري B2B.

مهمتك مساعدة الموردين والمصانع في إنشاء قوائم منتجات احترافية وجذابة للمشترين العالميين.

CRITICAL LANGUAGE RULE: Detect the user's language from their FIRST message and respond ENTIRELY in that language.
- Arabic (العربية): الرد بالعربية الفصحى
- English: Respond in fluent professional English
- Chinese (中文): 用流利的普通话回复
- Turkish (Türkçe): Akıcı Türkçe ile yanıt ver
- Any other language: Respond in that same language

You are a comprehensive industrial product expert for DirectHub B2B marketplace. You can handle ANY industrial category, raw material, or manufactured product. Adapt your expertise dynamically based on the product type provided. Ask about the most relevant specifications, certifications, and quality standards for that specific product category.

Always guide suppliers to:
1. Provide complete and accurate product specifications
2. Highlight certifications and quality standards
3. Set competitive pricing and clear MOQ
4. Upload high-quality product images and documents
5. Write compelling product descriptions that attract B2B buyers`,
};

// ─── Props ────────────────────────────────────────────────────────────────────
interface AIProductAssistantProps {
  categorySlug: string;
  categoryName?: string;
  productName?: string;
  onSuggestionApply?: (field: string, value: string) => void;
  dbSpecFields?: SpecField[];
  dbSystemHint?: string;
}

// ─── Streaming helper ─────────────────────────────────────────────────────────
async function streamFactoryAssistant(
  messages: any[],
  productContext: object | null,
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (err: Error) => void
) {
  try {
    const res = await fetch('/api/ai/factory-assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, productContext, stream: true, parameters: { max_tokens: 600 } }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || `HTTP ${res.status}`);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error('Response not readable');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'chunk') {
              const content = data.chunk?.choices?.[0]?.delta?.content;
              if (content) onChunk(content);
            } else if (data.type === 'done') {
              onDone();
            } else if (data.type === 'error') {
              onError(new Error(data.error));
            }
          } catch { /* skip */ }
        }
      }
    }
  } catch (err) {
    onError(err instanceof Error ? err : new Error('Streaming error'));
  }
}

function fileToBase64DataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
  });
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function AIProductAssistant({
  categorySlug,
  categoryName,
  productName,
  onSuggestionApply,
  dbSpecFields,
  dbSystemHint,
}: AIProductAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Array<{ role: string; content: any; displayContent?: string; attachmentName?: string }>>([]);
  const [input, setInput] = useState('');
  const [initialized, setInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [attachedFile, setAttachedFile] = useState<AttachedFile | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Get category config (DB overrides static, with dynamic fallback)
  const config = useMemo(() => {
    const base = CATEGORY_CONFIGS[categorySlug] || DEFAULT_CONFIG;
    return {
      ...base,
      name: categoryName || base.name,
      specFields: dbSpecFields && dbSpecFields.length > 0 ? dbSpecFields : base.specFields,
      systemHint: dbSystemHint || base.systemHint,
    };
  }, [categorySlug, categoryName, dbSpecFields, dbSystemHint]);

  const buildSystemPrompt = useCallback(() => {
    const requiredFields = config.specFields.filter((f) => f.required).map((f) => f.label).join(', ');
    const allFields = config.specFields.map((f) => f.label).join(', ');
    return `${config.systemHint}

Platform: دايركت هب (DirectHub) — B2B Industrial & Commercial Marketplace
Category: ${config.name}
${productName ? `Product being listed: ${productName}` : ''}

Required specification fields for this category: ${requiredFields || 'Determine based on product type'}
All specification fields: ${allFields}

CRITICAL LANGUAGE RULE: Detect the user's language from their FIRST message and respond ENTIRELY in that language throughout the conversation. Support: Arabic (العربية), English, Chinese (中文), Turkish (Türkçe), and any other language.

Your role:
1. Guide the manufacturer/supplier to fill in all required specifications
2. Suggest optimal values based on industry standards
3. Warn about missing critical information that buyers need
4. Provide tips to make the listing more attractive to B2B buyers globally
5. Keep responses concise and actionable (max 3-4 sentences per response)
6. When suggesting a value for a field, format it as: **[Field Name]**: suggested value
7. If an image or document is shared, analyze it and extract relevant product specifications
8. Always maintain a professional, welcoming tone representing DirectHub's brand

Be professional, specific to the ${config.name} category, and help maximize the product's visibility and buyer trust on DirectHub.`;
  }, [config, productName]);

  const initializeChat = useCallback(() => {
    if (initialized) return;
    setInitialized(true);

    const welcomeMsg = `أهلاً بك في دايركت هب (DirectHub) 🌟

أنا مساعدك الذكي لإدراج منتجات **${config.name}** على منصتنا الرائدة للتجارة الصناعية B2B.

سأساعدك في إنشاء قائمة منتج احترافية وجذابة للمشترين العالميين.

**المواصفات المطلوبة لهذه الفئة:**

${config.specFields.filter((f) => f.required).map((f) => `• **${f.label}** *(إلزامي)*`).join('\n')}
${config.specFields.filter((f) => !f.required).map((f) => `• ${f.label}`).join('\n')}

💡 يمكنك أيضاً **إرفاق صور المنتج أو ملفات المواصفات** (PDF, JPG, PNG) وسأحللها لك فوراً!

ما هو المنتج الذي تود إدراجه؟`;

    setMessages([{ role: 'assistant', content: welcomeMsg, displayContent: welcomeMsg }]);
  }, [config, initialized]);

  const handleOpen = () => {
    setIsOpen(true);
    if (!initialized) initializeChat();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      toast.error('Supported: JPEG, PNG, WebP, PDF');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File too large. Max 10MB.');
      return;
    }

    try {
      const dataUri = await fileToBase64DataUri(file);
      setAttachedFile({ name: file.name, type: file.type, dataUri, size: file.size });
    } catch {
      toast.error('Failed to process file');
    }
  };

  const handleSend = async () => {
    const text = input.trim();
    if ((!text && !attachedFile) || isLoading) return;
    setInput('');

    // Build user message content (multimodal if file attached)
    let userContent: any;
    let displayContent = text || '';
    const currentFile = attachedFile;
    setAttachedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';

    if (currentFile) {
      const contentParts: any[] = [];
      if (text) contentParts.push({ type: 'text', text });
      if (currentFile.type.startsWith('image/')) {
        contentParts.push({ type: 'image_url', image_url: { url: currentFile.dataUri } });
      } else {
        contentParts.push({ type: 'file', file: { file_data: currentFile.dataUri } });
      }
      userContent = contentParts;
      displayContent = text || `[Attached: ${currentFile.name}]`;
    } else {
      userContent = text;
    }

    const userMsg = { role: 'user', content: userContent, displayContent, attachmentName: currentFile?.name };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);

    // Add streaming placeholder
    setMessages((prev) => [...prev, { role: 'assistant', content: '', displayContent: '' }]);
    setIsLoading(true);

    // Build API messages (system + history)
    const apiMessages = [
      { role: 'system', content: buildSystemPrompt() },
      ...newMessages.map((m) => ({ role: m.role, content: m.content })),
    ];

    const productContext = { category: config.name, categorySlug, productName };

    let accumulated = '';
    await streamFactoryAssistant(
      apiMessages,
      productContext,
      (chunk) => {
        accumulated += chunk;
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: accumulated, displayContent: accumulated };
          return updated;
        });
      },
      () => {
        setIsLoading(false);
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.role === 'assistant') {
            updated[updated.length - 1] = { ...last, content: accumulated, displayContent: accumulated };
          }
          return updated;
        });
      },
      (err) => {
        setIsLoading(false);
        toast.error('AI assistant error. Please try again.');
        setMessages((prev) => prev.filter((_, i) => i !== prev.length - 1));
      }
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const quickPrompts = [
    `What certifications are required for ${config.name}?`,
    `What are the most important specs buyers look for?`,
    `How should I price my ${config.name} product?`,
    `What documentation do I need to upload?`,
  ];

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={handleOpen}
        className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground text-sm font-bold rounded-xl shadow-sm hover:shadow-md transition-all active:scale-95"
        type="button"
      >
        <Icon name="SparklesIcon" size={16} />
        AI Listing Assistant
        <span className="px-1.5 py-0.5 bg-primary-foreground/20 text-[10px] font-bold rounded-md uppercase tracking-wide">
          Gemini Pro
        </span>
      </button>

      {/* Panel */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-foreground/40 backdrop-blur-sm" onClick={() => setIsOpen(false)} />
          <div className="relative w-full sm:max-w-lg bg-card border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[85vh] sm:max-h-[600px]">
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border shrink-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
                <Icon name="SparklesIcon" size={18} className="text-primary-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground">AI Listing Assistant</p>
                <p className="text-xs text-muted-foreground truncate">{config.name} · Gemini Pro · Multimodal</p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground transition-colors"
              >
                <Icon name="XMarkIcon" size={16} />
              </button>
            </div>

            {/* Spec fields reference */}
            <div className="px-4 py-2.5 bg-muted/40 border-b border-border shrink-0">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1.5">
                Required for {config.name}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {config.specFields.map((f) => (
                  <span
                    key={f.key}
                    className={`px-2 py-0.5 text-[10px] font-semibold rounded-md ${
                      f.required
                        ? 'bg-primary/10 text-primary border border-primary/20' :'bg-muted text-muted-foreground'
                    }`}
                  >
                    {f.label}{f.required && ' *'}
                  </span>
                ))}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'assistant' && (
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5 mr-2">
                      <Icon name="SparklesIcon" size={12} className="text-primary" />
                    </div>
                  )}
                  <div
                    className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                      msg.role === 'user' ?'bg-primary text-primary-foreground rounded-br-sm' :'bg-muted text-foreground rounded-bl-sm'
                    }`}
                  >
                    {msg.attachmentName && (
                      <div className="flex items-center gap-1.5 mb-1.5 px-2 py-1 bg-primary-foreground/10 rounded-lg text-[11px] font-semibold">
                        <Icon name="PaperClipIcon" size={11} />
                        {msg.attachmentName}
                      </div>
                    )}
                    {(msg.displayContent || msg.content) ? (
                      <span className="whitespace-pre-wrap">
                        {(msg.displayContent || msg.content).toString().split(/(\*\*[^*]+\*\*)/).map((part: string, j: number) =>
                          part.startsWith('**') && part.endsWith('**') ? (
                            <strong key={j}>{part.slice(2, -2)}</strong>
                          ) : (
                            part
                          )
                        )}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </span>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick prompts */}
            {messages.length <= 1 && (
              <div className="px-4 pb-2 flex flex-wrap gap-1.5 shrink-0">
                {quickPrompts.map((prompt, i) => (
                  <button
                    key={i}
                    onClick={() => setInput(prompt)}
                    className="px-2.5 py-1.5 bg-muted hover:bg-muted/80 text-muted-foreground text-[11px] font-medium rounded-lg transition-colors text-left"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            )}

            {/* Attachment preview */}
            {attachedFile && (
              <div className="px-4 pb-1 shrink-0">
                <div className="flex items-center gap-2 px-3 py-2 bg-primary/5 border border-primary/20 rounded-xl">
                  <Icon name="PaperClipIcon" size={14} className="text-primary shrink-0" />
                  <span className="text-xs font-semibold text-primary truncate flex-1">{attachedFile.name}</span>
                  <button
                    onClick={() => { setAttachedFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Icon name="XMarkIcon" size={14} />
                  </button>
                </div>
              </div>
            )}

            {/* Input */}
            <div className="px-4 pb-4 pt-2 shrink-0 border-t border-border">
              <div className="flex items-end gap-2">
                {/* File attach button */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,.pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading}
                  className="w-10 h-10 border border-border rounded-xl flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary transition-colors disabled:opacity-40 shrink-0"
                  title="Attach image or PDF"
                >
                  <Icon name="PaperClipIcon" size={16} />
                </button>
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`Ask about ${config.name} specifications...`}
                  rows={1}
                  className="flex-1 px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none transition-colors"
                  style={{ maxHeight: '100px' }}
                  disabled={isLoading}
                />
                <button
                  onClick={handleSend}
                  disabled={(!input.trim() && !attachedFile) || isLoading}
                  className="w-10 h-10 bg-primary text-primary-foreground rounded-xl flex items-center justify-center disabled:opacity-40 transition-opacity active:scale-95 shrink-0"
                >
                  {isLoading ? (
                    <Icon name="ArrowPathIcon" size={16} className="animate-spin" />
                  ) : (
                    <Icon name="PaperAirplaneIcon" size={16} />
                  )}
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
                Powered by Gemini Pro · Supports images & PDFs
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Re-export config for use in other components
export { CATEGORY_CONFIGS, DEFAULT_CONFIG };
export type { CategoryConfig, SpecField };
