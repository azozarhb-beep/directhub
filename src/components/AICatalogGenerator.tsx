'use client';

import React, { useState, useRef } from 'react';
import Icon from '@/components/ui/AppIcon';
import { useLanguage } from '@/contexts/LanguageContext';
import { getChatCompletion } from '@/lib/ai/chatCompletion';
import toast from 'react-hot-toast';

interface GeneratedCatalog {
  nameAr: string;
  nameEn: string;
  nameZh: string;
  nameTr: string;
  descriptionAr: string;
  descriptionEn: string;
  descriptionZh: string;
  descriptionTr: string;
  technicalSpecs: { key: string; value: string }[];
  keywords: string[];
  category: string;
  targetMarkets: string[];
}

interface AICatalogGeneratorProps {
  onGenerated?: (catalog: GeneratedCatalog) => void;
}

export default function AICatalogGenerator({ onGenerated }: AICatalogGeneratorProps) {
  const { isRTL, language } = useLanguage();
  const [productName, setProductName] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [catalog, setCatalog] = useState<GeneratedCatalog | null>(null);
  const [activeTab, setActiveTab] = useState<'ar' | 'en' | 'zh' | 'tr'>('ar');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const labels = {
    ar: {
      title: 'مولّد الكتالوج الذكي',
      subtitle: 'اكتب اسم المنتج أو ارفع صورته ليقوم Gemini بتوليد وصف تسويقي احترافي',
      namePlaceholder: 'اكتب اسم المنتج (مثال: صمام صناعي من الفولاذ المقاوم للصدأ)',
      uploadImage: 'رفع صورة المنتج',
      generate: 'توليد الكتالوج بالذكاء الاصطناعي',
      generating: 'جارٍ التوليد...',
      productName: 'اسم المنتج',
      description: 'الوصف التسويقي',
      technicalSpecs: 'المواصفات الفنية',
      keywords: 'الكلمات المفتاحية',
      category: 'الفئة',
      targetMarkets: 'الأسواق المستهدفة',
      copyAll: 'نسخ الكتالوج',
      copied: 'تم النسخ ✓',
      poweredBy: 'مدعوم بـ Gemini AI',
      or: 'أو',
      imageUploaded: 'تم رفع الصورة',
    },
    en: {
      title: 'AI Catalog Generator',
      subtitle: 'Type product name or upload image — Gemini generates multilingual marketing descriptions',
      namePlaceholder: 'Enter product name (e.g. Industrial Stainless Steel Valve)',
      uploadImage: 'Upload Product Image',
      generate: 'Generate Catalog with AI',
      generating: 'Generating...',
      productName: 'Product Name',
      description: 'Marketing Description',
      technicalSpecs: 'Technical Specifications',
      keywords: 'Keywords',
      category: 'Category',
      targetMarkets: 'Target Markets',
      copyAll: 'Copy Catalog',
      copied: 'Copied ✓',
      poweredBy: 'Powered by Gemini AI',
      or: 'or',
      imageUploaded: 'Image uploaded',
    },
  };

  const t = language === 'ar' ? labels.ar : labels.en;

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error(language === 'ar' ? 'يرجى رفع صورة صالحة' : 'Please upload a valid image');
      return;
    }
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const generateCatalog = async () => {
    if (!productName.trim() && !imageFile) {
      toast.error(language === 'ar' ? 'يرجى إدخال اسم المنتج أو رفع صورة' : 'Please enter product name or upload image');
      return;
    }

    setIsGenerating(true);
    setCatalog(null);

    try {
      const systemPrompt = `You are an expert B2B product catalog writer for DirectHub marketplace.
Generate a comprehensive multilingual product catalog entry.
Return ONLY valid JSON with this exact structure:
{
  "nameAr": "Arabic product name",
  "nameEn": "English product name",
  "nameZh": "Chinese product name",
  "nameTr": "Turkish product name",
  "descriptionAr": "Professional Arabic marketing description (3-4 sentences)",
  "descriptionEn": "Professional English marketing description (3-4 sentences)",
  "descriptionZh": "Professional Chinese marketing description (3-4 sentences)",
  "descriptionTr": "Professional Turkish marketing description (3-4 sentences)",
  "technicalSpecs": [{"key": "spec name", "value": "spec value"}, ...],
  "keywords": ["keyword1", "keyword2", ...],
  "category": "Industrial category",
  "targetMarkets": ["Market 1", "Market 2", ...]
}
Generate at least 6 technical specifications. Return ONLY JSON, no markdown.`;

      const userContent: any[] = [
        { type: 'text', text: `Generate a professional B2B catalog for this product: ${productName || 'product shown in image'}` },
      ];

      if (imagePreview) {
        userContent.push({
          type: 'image_url',
          image_url: { url: imagePreview },
        });
      }

      const response = await getChatCompletion(
        'GEMINI',
        'gemini/gemini-3.6-flash',
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        { temperature: 0.7, max_tokens: 3000 }
      );

      const content = response?.choices?.[0]?.message?.content || '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed: GeneratedCatalog = JSON.parse(jsonMatch[0]);
        setCatalog(parsed);
        onGenerated?.(parsed);
        toast.success(language === 'ar' ? 'تم توليد الكتالوج بنجاح!' : 'Catalog generated successfully!');
      } else {
        toast.error(language === 'ar' ? 'حدث خطأ في التوليد' : 'Generation error');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : (language === 'ar' ? 'حدث خطأ' : 'An error occurred');
      toast.error(msg, { duration: 6000 });
      console.error('Catalog generation error:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    if (!catalog) return;
    const text = `${catalog.nameAr} / ${catalog.nameEn}\n\n${catalog.descriptionAr}\n\n${catalog.descriptionEn}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const langTabs = [
    { key: 'ar' as const, label: 'العربية' },
    { key: 'en' as const, label: 'English' },
    { key: 'zh' as const, label: '中文' },
    { key: 'tr' as const, label: 'Türkçe' },
  ];

  const getDescription = () => {
    if (!catalog) return '';
    const map = { ar: catalog.descriptionAr, en: catalog.descriptionEn, zh: catalog.descriptionZh, tr: catalog.descriptionTr };
    return map[activeTab];
  };

  const getName = () => {
    if (!catalog) return '';
    const map = { ar: catalog.nameAr, en: catalog.nameEn, zh: catalog.nameZh, tr: catalog.nameTr };
    return map[activeTab];
  };

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white">
        <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
          <Icon name="DocumentTextIcon" size={20} className="text-white" />
        </div>
        <div>
          <h3 className="font-bold text-base">{t.title}</h3>
          <p className="text-xs text-white/80">{t.subtitle}</p>
        </div>
        <span className="ms-auto text-xs bg-white/20 px-2 py-1 rounded-full">{t.poweredBy}</span>
      </div>

      <div className="p-5 space-y-4">
        {/* Product Name Input */}
        <input
          type="text"
          value={productName}
          onChange={e => setProductName(e.target.value)}
          placeholder={t.namePlaceholder}
          className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
          dir={isRTL ? 'rtl' : 'ltr'}
        />

        {/* OR divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground">{t.or}</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Image Upload */}
        <div>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
          {imagePreview ? (
            <div className="relative rounded-xl overflow-hidden border border-border">
              <img src={imagePreview} alt="Product" className="w-full h-40 object-cover" />
              <button
                onClick={() => { setImageFile(null); setImagePreview(null); }}
                className="absolute top-2 end-2 w-7 h-7 bg-black/60 text-white rounded-full flex items-center justify-center hover:bg-black/80 transition-colors"
              >
                <Icon name="XMarkIcon" size={14} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 px-4 py-4 border-2 border-dashed border-border rounded-xl text-sm text-muted-foreground hover:border-purple-400 hover:text-purple-600 transition-colors"
            >
              <Icon name="PhotoIcon" size={18} />
              {t.uploadImage}
            </button>
          )}
        </div>

        {/* Generate Button */}
        <button
          onClick={generateCatalog}
          disabled={isGenerating}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-semibold text-sm transition-colors disabled:opacity-60"
        >
          {isGenerating ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              {t.generating}
            </>
          ) : (
            <>
              <Icon name="SparklesIcon" size={16} />
              {t.generate}
            </>
          )}
        </button>

        {/* Generated Catalog */}
        {catalog && (
          <div className="space-y-4 border border-purple-200 rounded-xl p-4 bg-purple-50/30">
            {/* Language Tabs */}
            <div className="flex gap-1 bg-muted rounded-lg p-1">
              {langTabs.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${activeTab === tab.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Product Name */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">{t.productName}</p>
              <p className="text-sm font-bold text-foreground">{getName()}</p>
            </div>

            {/* Description */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">{t.description}</p>
              <p className="text-sm text-foreground leading-relaxed">{getDescription()}</p>
            </div>

            {/* Technical Specs */}
            {catalog.technicalSpecs?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">{t.technicalSpecs}</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {catalog.technicalSpecs.map((spec, i) => (
                    <div key={i} className="flex justify-between gap-2 bg-card border border-border rounded-lg px-3 py-2 text-xs">
                      <span className="text-muted-foreground">{spec.key}</span>
                      <span className="font-medium text-foreground">{spec.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Keywords */}
            {catalog.keywords?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">{t.keywords}</p>
                <div className="flex flex-wrap gap-1">
                  {catalog.keywords.map((kw, i) => (
                    <span key={i} className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs">{kw}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Copy Button */}
            <button
              onClick={handleCopy}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-card border border-border hover:border-purple-400 text-foreground rounded-xl text-sm font-medium transition-colors"
            >
              <Icon name={copied ? 'CheckIcon' : 'ClipboardDocumentIcon'} size={15} />
              {copied ? t.copied : t.copyAll}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
