'use client';

import React, { useState, useRef, useEffect } from 'react';
import Icon from '@/components/ui/AppIcon';

export interface ChatLanguage {
  code: string;
  label: string;
  nativeLabel: string;
  dir: 'ltr' | 'rtl';
  flag: string;
  script: string;
  placeholder: string;
  quickReplies: string[];
}

export const CHAT_LANGUAGES: ChatLanguage[] = [
  {
    code: 'ar',
    label: 'Arabic',
    nativeLabel: 'العربية',
    dir: 'rtl',
    flag: '🇸🇦',
    script: 'Arabic',
    placeholder: 'اكتب رسالتك هنا...',
    quickReplies: [
      'تم الاستلام، شكراً',
      'سيتم المتابعة قريباً',
      'يرجى إرسال المزيد من التفاصيل',
      'تم الاعتماد بنجاح',
      'نحتاج مراجعة إضافية',
    ],
  },
  {
    code: 'en',
    label: 'English',
    nativeLabel: 'English',
    dir: 'ltr',
    flag: '🇬🇧',
    script: 'Latin',
    placeholder: 'Type your message here...',
    quickReplies: [
      'Received, thank you',
      'Will follow up shortly',
      'Please send more details',
      'Approved successfully',
      'Needs further review',
    ],
  },
  {
    code: 'zh',
    label: 'Chinese (Mandarin)',
    nativeLabel: '中文',
    dir: 'ltr',
    flag: '🇨🇳',
    script: 'CJK',
    placeholder: '在此输入您的消息...',
    quickReplies: [
      '已收到，谢谢',
      '稍后跟进',
      '请发送更多详情',
      '审批成功',
      '需要进一步审查',
    ],
  },
  {
    code: 'tr',
    label: 'Turkish',
    nativeLabel: 'Türkçe',
    dir: 'ltr',
    flag: '🇹🇷',
    script: 'Latin',
    placeholder: 'Mesajınızı buraya yazın...',
    quickReplies: [
      'Alındı, teşekkürler',
      'Kısa süre içinde takip edilecek',
      'Lütfen daha fazla ayrıntı gönderin',
      'Başarıyla onaylandı',
      'Daha fazla inceleme gerekiyor',
    ],
  },
  {
    code: 'hi',
    label: 'Hindi',
    nativeLabel: 'हिन्दी',
    dir: 'ltr',
    flag: '🇮🇳',
    script: 'Devanagari',
    placeholder: 'यहाँ अपना संदेश लिखें...',
    quickReplies: [
      'प्राप्त हुआ, धन्यवाद',
      'जल्द ही अनुसरण करेंगे',
      'कृपया अधिक विवरण भेजें',
      'सफलतापूर्वक अनुमोदित',
      'आगे की समीक्षा आवश्यक है',
    ],
  },
  {
    code: 'fr',
    label: 'French',
    nativeLabel: 'Français',
    dir: 'ltr',
    flag: '🇫🇷',
    script: 'Latin',
    placeholder: 'Écrivez votre message ici...',
    quickReplies: [
      'Reçu, merci',
      'Suivi sous peu',
      'Veuillez envoyer plus de détails',
      'Approuvé avec succès',
      'Nécessite un examen supplémentaire',
    ],
  },
  {
    code: 'de',
    label: 'German',
    nativeLabel: 'Deutsch',
    dir: 'ltr',
    flag: '🇩🇪',
    script: 'Latin',
    placeholder: 'Schreiben Sie Ihre Nachricht hier...',
    quickReplies: [
      'Erhalten, danke',
      'Wird bald nachverfolgt',
      'Bitte senden Sie mehr Details',
      'Erfolgreich genehmigt',
      'Weitere Überprüfung erforderlich',
    ],
  },
  {
    code: 'ru',
    label: 'Russian',
    nativeLabel: 'Русский',
    dir: 'ltr',
    flag: '🇷🇺',
    script: 'Cyrillic',
    placeholder: 'Введите ваше сообщение здесь...',
    quickReplies: [
      'Получено, спасибо',
      'Скоро свяжемся',
      'Пожалуйста, пришлите подробности',
      'Успешно одобрено',
      'Требует дополнительной проверки',
    ],
  },
  {
    code: 'es',
    label: 'Spanish',
    nativeLabel: 'Español',
    dir: 'ltr',
    flag: '🇪🇸',
    script: 'Latin',
    placeholder: 'Escribe tu mensaje aquí...',
    quickReplies: [
      'Recibido, gracias',
      'Se hará seguimiento pronto',
      'Por favor envíe más detalles',
      'Aprobado exitosamente',
      'Necesita revisión adicional',
    ],
  },
  {
    code: 'ur',
    label: 'Urdu',
    nativeLabel: 'اردو',
    dir: 'rtl',
    flag: '🇵🇰',
    script: 'Arabic',
    placeholder: 'یہاں اپنا پیغام لکھیں...',
    quickReplies: [
      'موصول ہوا، شکریہ',
      'جلد فالو اپ کریں گے',
      'براہ کرم مزید تفصیلات بھیجیں',
      'کامیابی سے منظور',
      'مزید جائزہ درکار ہے',
    ],
  },
];

interface Props {
  selectedLang: ChatLanguage;
  onSelect: (lang: ChatLanguage) => void;
  compact?: boolean;
}

export default function AgentLanguageSelector({ selectedLang, onSelect, compact = false }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = CHAT_LANGUAGES.filter(
    l =>
      l.label.toLowerCase().includes(search.toLowerCase()) ||
      l.nativeLabel.toLowerCase().includes(search.toLowerCase()) ||
      l.script.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 rounded-lg border transition-all ${
          compact
            ? 'px-2 py-1 text-xs border-[#D4AF37]/30 bg-[#1E1E1E] hover:border-[#D4AF37]/60'
            : 'px-3 py-1.5 text-sm border-[#D4AF37]/30 bg-[#1E1E1E] hover:border-[#D4AF37]/60'
        }`}
        title="Select chat language"
        type="button"
      >
        <span className="text-base leading-none">{selectedLang.flag}</span>
        <span className="font-semibold text-[#D4AF37]">{selectedLang.nativeLabel}</span>
        {!compact && (
          <span className="text-[10px] text-gray-400 hidden sm:inline">{selectedLang.script}</span>
        )}
        <Icon name="ChevronDownIcon" size={12} className={`text-[#D4AF37]/70 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          className="absolute z-50 mt-1 w-64 rounded-xl border border-[#D4AF37]/20 bg-[#1E1E1E] shadow-2xl overflow-hidden"
          style={{ top: '100%', right: 0 }}
        >
          {/* Search */}
          <div className="p-2 border-b border-[#D4AF37]/10">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search language..."
              className="w-full bg-[#0A192F]/60 border border-[#D4AF37]/20 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-gray-500 focus:outline-none focus:border-[#D4AF37]/50"
              autoFocus
            />
          </div>

          {/* Language list */}
          <div className="max-h-56 overflow-y-auto">
            {filtered.map(lang => (
              <button
                key={lang.code}
                type="button"
                onClick={() => {
                  onSelect(lang);
                  setOpen(false);
                  setSearch('');
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[#D4AF37]/10 transition-colors text-left ${
                  selectedLang.code === lang.code ? 'bg-[#D4AF37]/15' : ''
                }`}
              >
                <span className="text-xl leading-none">{lang.flag}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{lang.nativeLabel}</p>
                  <p className="text-[10px] text-gray-400">{lang.label} · {lang.script}</p>
                </div>
                {selectedLang.code === lang.code && (
                  <Icon name="CheckIcon" size={14} className="text-[#D4AF37] shrink-0" />
                )}
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="text-xs text-gray-500 text-center py-4">No languages found</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
