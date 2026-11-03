'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import AppLogo from '@/components/ui/AppLogo';
import { useLanguage } from '@/contexts/LanguageContext';
import { MODULE_ROUTES } from './dashboardConfig';
import type { DashboardTab, SalesRep } from './dashboardTypes';

interface DashboardChromeProps {
  isModuleMode: boolean;
  isRTL: boolean;
  moduleTab?: DashboardTab;
  activeTab: DashboardTab;
  setActiveTab: (tab: DashboardTab) => void;
  isSalesRep: boolean;
  salesRepRecord: SalesRep | null;
  isSupplierSettings: boolean;
  impersonatedFactoryId: string | null;
  impersonatedFactoryName: string | null;
  onEndImpersonation: () => void;
  userName: string;
  companyName: string;
  userMenuOpen: boolean;
  setUserMenuOpen: (open: boolean) => void;
  userMenuRef: React.RefObject<HTMLDivElement | null>;
  onSignOut: () => void;
  onRefreshFactoryOrders: () => void;
  onOpenAddProduct: () => void;
  t: any;
  md: any;
}

const LANGUAGES = [
  { code: 'ar', label: 'العربية' },
  { code: 'zh', label: '中文' },
  { code: 'tr', label: 'Türkçe' },
  { code: 'en', label: 'English' },
];

export default function DashboardChrome({
  isModuleMode,
  isRTL,
  moduleTab,
  activeTab,
  setActiveTab,
  isSalesRep,
  salesRepRecord,
  isSupplierSettings,
  impersonatedFactoryId,
  impersonatedFactoryName,
  onEndImpersonation,
  userName,
  companyName,
  userMenuOpen,
  setUserMenuOpen,
  userMenuRef,
  onSignOut,
  onRefreshFactoryOrders,
  onOpenAddProduct,
  t,
  md,
}: DashboardChromeProps) {
  const moduleMeta = moduleTab ? MODULE_ROUTES[moduleTab] : undefined;
  const { language, setLanguage } = useLanguage();
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const langMenuRef = useRef<HTMLDivElement>(null);

  // Close language dropdown on outside click
  useEffect(() => {
    if (!langMenuOpen) return;
    const handleClick = (e: MouseEvent | TouchEvent) => {
      if (langMenuRef.current && !langMenuRef.current.contains(e.target as Node)) {
        setLangMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('touchstart', handleClick);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('touchstart', handleClick);
    };
  }, [langMenuOpen]);

  return (
    <>
      {/* ── Admin Impersonation Sticky Banner ── */}
      {impersonatedFactoryId && (
        <div className="sticky top-0 z-[60] w-full bg-amber-400 border-b-2 border-amber-500 shadow-md">
          <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5">
              <span className="text-xl">🔍</span>
              <div>
                <p className="text-sm font-bold text-amber-900">
                  وضع المحاكاة الإدارية نشط
                </p>
                <p className="text-xs text-amber-800">
                  أنت تشاهد لوحة تحكم المصنع: <strong>{impersonatedFactoryName || impersonatedFactoryId}</strong> — Admin Simulation Mode Active
                </p>
              </div>
            </div>
            <button
              onClick={onEndImpersonation}
              className="flex items-center gap-2 px-4 py-2 bg-amber-900 text-amber-100 rounded-xl text-xs font-bold hover:bg-amber-800 transition-colors whitespace-nowrap shrink-0"
            >
              <Icon name="XMarkIcon" size={14} />
              إنهاء المحاكاة والعودة لغرفة التحكم
            </button>
          </div>
        </div>
      )}

      {/* Top Nav */}
      <header className={`sticky top-0 z-50 backdrop-blur-md border-b shadow-sm ${isModuleMode ? 'bg-card/95 border-border/60' : 'bg-slate-900/95 border-slate-800'}`}>
        <div className="max-w-7xl mx-auto px-3 sm:px-6 flex items-center gap-2 sm:gap-3 h-14">
          
          {/* Logo & Platform Name */}
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <AppLogo size={28} />
            <div className="flex flex-col leading-none">
              <span className={`font-bold text-sm tracking-tight ${isModuleMode ? 'text-foreground' : 'text-white'}`} translate="no">Direct Hub</span>
              <span className={`text-[9px] font-medium hidden sm:block ${isModuleMode ? 'text-muted-foreground' : 'text-cyan-300'}`}>{t.manufacturerDashboard.title}</span>
            </div>
          </Link>

          <div className="flex-1" />

          {/* Sales rep badge */}
          {isSalesRep && salesRepRecord && (
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-xs font-semibold text-blue-700">
              <Icon name="UserGroupIcon" size={13} />
              {md.salesRep}
            </div>
          )}

          {/* Action Icons & Navigation Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2">

            {/* 1. زر العودة للمتجر */}
            <Link
              href="/"
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white text-xs font-bold transition-all shadow-sm active:scale-95"
              title="العودة للمتجر الرئيسي"
            >
              <Icon name="BuildingStorefrontIcon" size={16} />
              <span className="hidden sm:inline">العودة للمتجر</span>
            </Link>

            {/* 2. أيقونة الدردشة */}
            <Link
              href="/chat"
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                isModuleMode 
                  ? 'text-muted-foreground hover:text-foreground hover:bg-muted' 
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
              title="الدردشة والمحادثات"
            >
              <Icon name="ChatBubbleLeftRightIcon" size={18} />
            </Link>

            {/* 3. أيقونة الجرس (الإشعارات) */}
            <Link
              href="/notifications"
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors relative ${
                isModuleMode 
                  ? 'text-muted-foreground hover:text-foreground hover:bg-muted' 
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
              title="الإشعارات"
            >
              <Icon name="BellIcon" size={18} />
            </Link>

            {/* 4. أيقونة الكرة الأرضية (محدد اللغات) */}
            <div className="relative" ref={langMenuRef}>
              <button
                type="button"
                onClick={() => setLangMenuOpen(!langMenuOpen)}
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                  isModuleMode 
                    ? 'text-muted-foreground hover:text-foreground hover:bg-muted' 
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                } ${langMenuOpen ? 'ring-2 ring-primary/40' : ''}`}
                title="تغيير اللغة"
                aria-label="Language Selector"
              >
                <Icon name="GlobeAltIcon" size={19} />
              </button>

              {langMenuOpen && (
                <div className="absolute end-0 top-full mt-2 w-36 bg-card border border-border rounded-xl shadow-xl py-1.5 z-50">
                  {LANGUAGES.map((lang) => (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => {
                        setLanguage(lang.code as any);
                        setLangMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold transition-colors ${
                        language === lang.code
                          ? 'bg-primary/10 text-primary font-bold'
                          : 'text-foreground hover:bg-muted'
                      }`}
                    >
                      <span>{lang.label}</span>
                      {language === lang.code && <Icon name="CheckIcon" size={14} className="text-primary" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 5. زر تسجيل الخروج */}
            <button
              type="button"
              onClick={onSignOut}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
              title="تسجيل الخروج"
              aria-label="تسجيل الخروج"
            >
              <Icon name="ArrowRightOnRectangleIcon" size={18} />
            </button>

          </div>
        </div>
      </header>

      {/* ── Module (full-screen) sticky header ── */}
      {isModuleMode && (
        <div className="sticky top-14 z-40 bg-card/95 backdrop-blur-md border-b border-border/60 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 md:px-6 py-2 sm:py-0 sm:h-14 flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-3">
            <Link
              href="/manufacturer/dashboard"
              className={`order-1 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary/10 text-primary text-xs sm:text-sm font-bold hover:bg-primary/20 active:scale-95 transition-all whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${moduleTab === 'seller_fulfillment' ? 'w-full sm:w-auto justify-start' : ''}`}
            >
              <span aria-hidden="true">{isRTL ? '→' : '←'}</span>
              <span>رجوع إلى لوحة التحكم</span>
            </Link>
            <h1 className={`order-2 flex-1 min-w-0 text-sm sm:text-lg font-black text-foreground truncate ${moduleTab === 'seller_fulfillment' ? 'hidden sm:block' : ''}`}>
              {moduleTab === 'factory_settings' && isSupplierSettings ? 'إعدادات وتوثيق المورد' : moduleMeta?.title}
            </h1>
            <div className={`order-3 flex items-center gap-2 ${moduleTab === 'seller_fulfillment' ? 'w-full sm:w-auto sm:shrink-0' : 'shrink-0'}`}>
              {moduleTab === 'financial_hub' && !isSalesRep && (
                <div className="flex sm:inline-flex rounded-lg border border-border overflow-hidden text-xs sm:text-sm font-semibold">
                  <button
                    type="button"
                    onClick={() => setActiveTab('finance')}
                    className={`px-3 py-2 transition-colors ${activeTab === 'finance' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
                  >
                    المحفظة والأرباح
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('financial_hub')}
                    className={`px-3 py-2 transition-colors ${activeTab === 'financial_hub' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
                  >
                    الحسابات البنكية والأمان
                  </button>
                </div>
              )}
              {moduleTab === 'factory_orders' && (
                <button
                  type="button"
                  onClick={onRefreshFactoryOrders}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-xs sm:text-sm font-semibold text-foreground hover:bg-muted transition-colors"
                >
                  <Icon name="ArrowPathIcon" size={14} />
                  <span className="hidden sm:inline">تحديث</span>
                </button>
              )}
              {moduleTab === 'seller_fulfillment' && (
                <div className="flex w-full sm:w-auto sm:inline-flex rounded-lg border border-border overflow-hidden text-xs sm:text-sm font-semibold">
                  <button
                    type="button"
                    onClick={() => setActiveTab('seller_fulfillment')}
                    className={`flex-1 sm:flex-none px-3 py-2 transition-colors ${activeTab === 'seller_fulfillment' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
                  >
                    الشحن الذاتي
                  </button>
                  {!isSalesRep && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('freight_bids')}
                      className={`flex-1 sm:flex-none px-3 py-2 transition-colors ${activeTab === 'freight_bids' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
                    >
                      عروض الشحن
                    </button>
                  )}
                </div>
              )}
              {moduleTab === 'products' && !isSalesRep && (
                <button
                  type="button"
                  onClick={onOpenAddProduct}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs sm:text-sm font-semibold hover:opacity-90 transition-opacity"
                >
                  <Icon name="PlusIcon" size={14} />
                  <span className="hidden sm:inline">إضافة منتج</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
