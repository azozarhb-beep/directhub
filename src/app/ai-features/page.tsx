'use client';

import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import { useLanguage } from '@/contexts/LanguageContext';
import AIRFQMatchmaker from '@/components/AIRFQMatchmaker';
import AICatalogGenerator from '@/components/AICatalogGenerator';
import AIDocumentVerifier from '@/components/AIDocumentVerifier';
import AIContractAssistant from '@/components/AIContractAssistant';

type FeatureTab = 'rfq' | 'catalog' | 'document' | 'contract';

export default function AIFeaturesPage() {
  const { isRTL, language } = useLanguage();
  const [activeTab, setActiveTab] = useState<FeatureTab>('rfq');

  const labels = {
    ar: {
      pageTitle: 'مركز الذكاء الاصطناعي',
      pageSubtitle: 'أدوات ذكية متقدمة مدعومة بـ Gemini AI لتسريع أعمالك في دايركت هب',
      features: [
        { key: 'rfq' as FeatureTab, label: 'مطابقة الطلبات الذكية', icon: 'MagnifyingGlassIcon', desc: 'AI RFQ Matchmaker' },
        { key: 'catalog' as FeatureTab, label: 'مولّد الكتالوج الذكي', icon: 'DocumentTextIcon', desc: 'AI Catalog Generator' },
        { key: 'document' as FeatureTab, label: 'فحص المستندات الذكي', icon: 'IdentificationIcon', desc: 'AI Document OCR' },
        { key: 'contract' as FeatureTab, label: 'مساعد العقود القانوني', icon: 'DocumentCheckIcon', desc: 'B2B Contract Assistant' },
      ],
    },
    en: {
      pageTitle: 'AI Features Hub',
      pageSubtitle: 'Advanced AI tools powered by Gemini AI to accelerate your business on DirectHub',
      features: [
        { key: 'rfq' as FeatureTab, label: 'RFQ Matchmaker', icon: 'MagnifyingGlassIcon', desc: 'AI RFQ Matchmaker' },
        { key: 'catalog' as FeatureTab, label: 'Catalog Generator', icon: 'DocumentTextIcon', desc: 'AI Catalog Generator' },
        { key: 'document' as FeatureTab, label: 'Document Verifier', icon: 'IdentificationIcon', desc: 'AI Document OCR' },
        { key: 'contract' as FeatureTab, label: 'Contract Assistant', icon: 'DocumentCheckIcon', desc: 'B2B Contract Assistant' },
      ],
    },
  };

  const t = language === 'ar' ? labels.ar : labels.en;

  const tabColors: Record<FeatureTab, string> = {
    rfq: 'from-blue-600 to-indigo-600',
    catalog: 'from-purple-600 to-pink-600',
    document: 'from-emerald-600 to-teal-600',
    contract: 'from-amber-600 to-orange-600',
  };

  const activeTabColors: Record<FeatureTab, string> = {
    rfq: 'border-blue-500 bg-blue-50 text-blue-700',
    catalog: 'border-purple-500 bg-purple-50 text-purple-700',
    document: 'border-emerald-500 bg-emerald-50 text-emerald-700',
    contract: 'border-amber-500 bg-amber-50 text-amber-700',
  };

  return (
    <div className="min-h-screen bg-background" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Hero Banner */}
      <div className={`bg-gradient-to-r ${tabColors[activeTab]} text-white px-4 py-10`}>
        <div className="max-w-4xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Icon name="SparklesIcon" size={28} className="text-white" />
            <h1 className="text-2xl sm:text-3xl font-bold">{t.pageTitle}</h1>
          </div>
          <p className="text-white/80 text-sm sm:text-base max-w-2xl mx-auto">{t.pageSubtitle}</p>
          <div className="flex items-center justify-center gap-2 mt-4">
            <span className="px-3 py-1 bg-white/20 rounded-full text-xs font-medium">Gemini AI</span>
            <span className="px-3 py-1 bg-white/20 rounded-full text-xs font-medium">DirectHub</span>
          </div>
        </div>
      </div>

      {/* Feature Tabs */}
      <div className="sticky top-0 z-10 bg-card border-b border-border shadow-sm">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex overflow-x-auto gap-1 py-2 scrollbar-hide">
            {t.features.map(feature => (
              <button
                key={feature.key}
                onClick={() => setActiveTab(feature.key)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap border transition-all shrink-0 ${
                  activeTab === feature.key
                    ? activeTabColors[feature.key]
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                <Icon name={feature.icon as any} size={16} />
                {feature.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Feature Content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {activeTab === 'rfq' && <AIRFQMatchmaker />}
        {activeTab === 'catalog' && <AICatalogGenerator />}
        {activeTab === 'document' && <AIDocumentVerifier />}
        {activeTab === 'contract' && <AIContractAssistant />}
      </div>
    </div>
  );
}
