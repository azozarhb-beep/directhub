'use client';

import React, { useState, useEffect } from 'react';
import Icon from '@/components/ui/AppIcon';
import RFQCopilot from '@/components/RFQCopilot';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePathname } from 'next/navigation';

// Pages where the RFQ Copilot widget should NOT appear (already embedded or irrelevant)
const EXCLUDED_PATHS = ['/admin', '/login', '/manufacturer/login', '/agent/login', '/auth/'];

export default function RFQCopilotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { isRTL, language } = useLanguage();
  const pathname = usePathname();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Hide on excluded paths
  const shouldHide = EXCLUDED_PATHS?.some(p => pathname?.startsWith(p));
  if (!mounted || shouldHide) return null;

  const label = language === 'ar' ? 'مساعد RFQ' : 'RFQ Copilot';
  const tooltip = language === 'ar' ? 'مساعد طلبات الأسعار الذكي' : 'Smart RFQ Assistant';

  return (
    <>
      {/* Floating Toggle Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          title={tooltip}
          className={`fixed bottom-20 z-40 flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2.5 rounded-full shadow-lg transition-all duration-200 hover:scale-105 ${
            isRTL ? 'left-20' : 'right-20'
          }`}
          aria-label={tooltip}
        >
          <div className="relative">
            <Icon name="DocumentTextIcon" size={18} className="text-white" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse border border-white" />
          </div>
          <span className="text-sm font-semibold">{label}</span>
        </button>
      )}

      {/* Chat Panel */}
      {isOpen && (
        <div
          className={`fixed bottom-20 z-50 w-[340px] sm:w-[380px] shadow-2xl rounded-2xl overflow-hidden ${
            isRTL ? 'left-4' : 'right-4'
          }`}
          style={{ maxHeight: '540px', height: '540px' }}
        >
          {/* Close bar */}
          <div className="flex items-center justify-between px-3 py-2 bg-teal-600 text-white">
            <div className="flex items-center gap-2">
              <Icon name="DocumentTextIcon" size={16} className="text-white" />
              <span className="text-sm font-bold">{tooltip}</span>
              <span className="flex items-center gap-1 text-xs text-white/80">
                <span className="w-1.5 h-1.5 bg-emerald-300 rounded-full animate-pulse" />
                {language === 'ar' ? 'متاح 24/7' : 'Available 24/7'}
              </span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="w-7 h-7 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/40 transition-colors"
              aria-label={language === 'ar' ? 'إغلاق' : 'Close'}
            >
              <Icon name="XMarkIcon" size={16} className="text-white" />
            </button>
          </div>

          {/* RFQCopilot panel */}
          <div className="h-[calc(100%-44px)]">
            <RFQCopilot onClose={() => setIsOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
