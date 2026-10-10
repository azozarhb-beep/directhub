'use client';

import React, { useState, useEffect } from 'react';
import { Language, SUPPORTED_LANGUAGES, detectSupplierLanguage } from '@/lib/i18n';
import { useLanguage } from '@/contexts/LanguageContext';

interface MultilingualProductData {
  name: string;
  name_ar?: string;
  name_zh?: string;
  name_tr?: string;
  description?: string;
  description_ar?: string;
  description_zh?: string;
  description_tr?: string;
  origin_country?: string;
}

interface LocalizedProductDisplayProps {
  product: MultilingualProductData;
  showLanguageSwitcher?: boolean;
  className?: string;
}

/**
 * Displays product name and description in the buyer's preferred language,
 * with fallback to English. Shows the original language badge for international products.
 */
export function LocalizedProductDisplay({ product, showLanguageSwitcher = false, className = '' }: LocalizedProductDisplayProps) {
  const { language } = useLanguage();

  const getLocalizedName = (lang: Language): string => {
    switch (lang) {
      case 'ar': return product.name_ar || product.name;
      case 'zh': return product.name_zh || product.name;
      case 'tr': return product.name_tr || product.name;
      default: return product.name;
    }
  };

  const getLocalizedDescription = (lang: Language): string => {
    switch (lang) {
      case 'ar': return product.description_ar || product.description || '';
      case 'zh': return product.description_zh || product.description || '';
      case 'tr': return product.description_tr || product.description || '';
      default: return product.description || '';
    }
  };

  const supplierLang = product.origin_country ? detectSupplierLanguage(product.origin_country) : 'en';
  const supplierLangConfig = SUPPORTED_LANGUAGES.find(l => l.code === supplierLang);
  const isInternational = supplierLang !== 'en' && supplierLang !== language;

  return (
    <div className={className}>
      <div className="flex items-start gap-2">
        <span className="font-semibold text-foreground">{getLocalizedName(language)}</span>
        {isInternational && supplierLangConfig && (
          <span className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-600 border border-blue-100">
            {supplierLangConfig.flag} {supplierLangConfig.label}
          </span>
        )}
      </div>
      {getLocalizedDescription(language) && (
        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{getLocalizedDescription(language)}</p>
      )}
    </div>
  );
}

interface MultilingualFieldsProps {
  originCountry: string;
  fields: {
    name: string;
    name_ar: string;
    name_zh?: string;
    name_tr?: string;
    description: string;
    description_ar: string;
    description_zh?: string;
    description_tr?: string;
  };
  onChange: (field: string, value: string) => void;
  disabled?: boolean;
}

/**
 * Multilingual product form fields — shows relevant language fields
 * based on the supplier's origin country, always including EN + AR + detected language.
 */
export function MultilingualProductFields({ originCountry, fields, onChange, disabled = false }: MultilingualFieldsProps) {
  const supplierLang = originCountry ? detectSupplierLanguage(originCountry) : 'en';

  // Always show EN + AR. Add supplier's native language if different.
  const activeLanguages: Language[] = ['en', 'ar'];
  if (supplierLang !== 'en' && supplierLang !== 'ar') {
    activeLanguages.push(supplierLang);
  }

  const [activeTab, setActiveTab] = useState<Language>('en');

  // Reset to 'en' tab when origin country changes
  useEffect(() => {
    setActiveTab('en');
  }, [originCountry]);

  const inputClass = "w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors disabled:opacity-50";
  const textareaClass = `${inputClass} resize-none`;

  const getNameField = (lang: Language) => {
    switch (lang) {
      case 'ar': return 'name_ar';
      case 'zh': return 'name_zh';
      case 'tr': return 'name_tr';
      default: return 'name';
    }
  };

  const getDescField = (lang: Language) => {
    switch (lang) {
      case 'ar': return 'description_ar';
      case 'zh': return 'description_zh';
      case 'tr': return 'description_tr';
      default: return 'description';
    }
  };

  const getNameValue = (lang: Language): string => {
    switch (lang) {
      case 'ar': return fields.name_ar || '';
      case 'zh': return fields.name_zh || '';
      case 'tr': return fields.name_tr || '';
      default: return fields.name || '';
    }
  };

  const getDescValue = (lang: Language): string => {
    switch (lang) {
      case 'ar': return fields.description_ar || '';
      case 'zh': return fields.description_zh || '';
      case 'tr': return fields.description_tr || '';
      default: return fields.description || '';
    }
  };

  const getLangLabel = (lang: Language) => {
    const config = SUPPORTED_LANGUAGES.find(l => l.code === lang);
    return config ? `${config.flag} ${config.label}` : lang.toUpperCase();
  };

  const isRTL = (lang: Language) => lang === 'ar';

  return (
    <div className="space-y-3">
      {/* Language tabs */}
      <div className="flex items-center gap-1 border-b border-border pb-2">
        <span className="text-xs font-semibold text-muted-foreground mr-2">Language:</span>
        {activeLanguages.map((lang) => (
          <button
            key={lang}
            type="button"
            onClick={() => setActiveTab(lang)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
              activeTab === lang
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            {getLangLabel(lang)}
            {lang === 'en' && <span className="text-[9px] opacity-70">*</span>}
          </button>
        ))}
        {supplierLang !== 'en' && supplierLang !== 'ar' && (
          <span className="ml-auto text-[10px] text-muted-foreground bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full border border-blue-100">
            Auto-detected from {originCountry}
          </span>
        )}
      </div>

      {/* Name field */}
      <div>
        <label className="block text-xs font-semibold text-foreground mb-1.5">
          Product Name ({SUPPORTED_LANGUAGES.find(l => l.code === activeTab)?.label})
          {activeTab === 'en' && <span className="text-red-500 ml-1">*</span>}
        </label>
        <input
          type="text"
          value={getNameValue(activeTab)}
          onChange={(e) => onChange(getNameField(activeTab), e.target.value)}
          dir={isRTL(activeTab) ? 'rtl' : 'ltr'}
          disabled={disabled}
          className={inputClass}
          placeholder={activeTab === 'ar' ? 'اسم المنتج بالعربية' : activeTab === 'zh' ? '产品名称（中文）' : activeTab === 'tr' ? 'Ürün adı (Türkçe)' : 'Product name in English'}
        />
      </div>

      {/* Description field */}
      <div>
        <label className="block text-xs font-semibold text-foreground mb-1.5">
          Description ({SUPPORTED_LANGUAGES.find(l => l.code === activeTab)?.label})
        </label>
        <textarea
          rows={3}
          value={getDescValue(activeTab)}
          onChange={(e) => onChange(getDescField(activeTab), e.target.value)}
          dir={isRTL(activeTab) ? 'rtl' : 'ltr'}
          disabled={disabled}
          className={textareaClass}
          placeholder={activeTab === 'ar' ? 'وصف المنتج بالعربية' : activeTab === 'zh' ? '产品描述（中文）' : activeTab === 'tr' ? 'Ürün açıklaması (Türkçe)' : 'Product description in English'}
        />
      </div>

      {activeTab === 'en' && (
        <p className="text-[11px] text-muted-foreground">
          * English is required. Other languages help international buyers find your product.
        </p>
      )}
    </div>
  );
}

interface SupplierLanguageBadgeProps {
  originCountry: string;
  size?: 'sm' | 'md';
}

/**
 * Shows a flag badge indicating the supplier's country and language.
 */
export function SupplierLanguageBadge({ originCountry, size = 'sm' }: SupplierLanguageBadgeProps) {
  if (!originCountry) return null;
  const lang = detectSupplierLanguage(originCountry);
  const config = SUPPORTED_LANGUAGES.find(l => l.code === lang);
  if (!config || lang === 'en') return null;

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border font-medium ${
      size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-xs'
    } bg-blue-50 text-blue-700 border-blue-100`}>
      {config.flag} {originCountry}
    </span>
  );
}
