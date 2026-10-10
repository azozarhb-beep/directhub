'use client';

import React from 'react';

const PLATFORM_URL =
  process.env.NEXT_PUBLIC_SITE_URL || 'https://direct-hub.net';

const TICKER_TEXT = `مرحباً بك في منصة دايركت هب (Direct Hub Global) 🌐. بوابتك الكبرى للوصول إلى أكبر الأسواق العالمية ومصانع العالم عبر أنظمة (B2B & B2C). نوفر لك كافة القطاعات، المنتجات المتنوعة، رولات التغليف، والمواد الخام وصولاً للمنتجات النهائية بأعلى معايير الجودة والتنافسية. تفضل بزيارة منصتنا وتصفح عالم التجارة معنا مباشرة: ${PLATFORM_URL}.`;

export default function WelcomeTicker() {
  return (
    <div
      className="w-full bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700 overflow-hidden"
      style={{ height: '38px' }}
      aria-label="شريط الترحيب بمنصة دايركت هب"
    >
      <div className="flex items-center h-full" dir="ltr">
        {/* Static label */}
        <div className="flex items-center gap-2 px-3 flex-shrink-0 border-r border-slate-600 h-full bg-slate-900/80 z-10">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
          <span className="text-emerald-400 text-xs font-bold whitespace-nowrap tracking-wide">
            مباشر
          </span>
        </div>

        {/* Scrolling ticker area */}
        <div className="flex-1 overflow-hidden relative h-full flex items-center">
          {/* Fade edges */}
          <div className="absolute left-0 top-0 h-full w-8 bg-gradient-to-r from-slate-900 to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 h-full w-8 bg-gradient-to-l from-slate-900 to-transparent z-10 pointer-events-none" />

          <div className="welcome-ticker-track">
            <span className="text-slate-100 text-xs font-medium leading-none px-10" dir="rtl">
              {TICKER_TEXT}
            </span>
            <span className="text-emerald-500 text-xs px-6 leading-none select-none" aria-hidden="true">
              ✦
            </span>
            <span className="text-slate-100 text-xs font-medium leading-none px-10" dir="rtl">
              {TICKER_TEXT}
            </span>
            <span className="text-emerald-500 text-xs px-6 leading-none select-none" aria-hidden="true">
              ✦
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
