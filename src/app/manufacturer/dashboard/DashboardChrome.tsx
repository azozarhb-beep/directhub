'use client';

import React from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import AppLogo from '@/components/ui/AppLogo';
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
        <div className="max-w-7xl mx-auto px-4 md:px-6 flex items-center gap-3 h-14">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <AppLogo size={28} />
            <div className="flex flex-col leading-none">
              <span className={`font-bold text-sm tracking-tight ${isModuleMode ? 'text-foreground' : 'text-white'}`} translate="no">Direct Hub</span>
              <span className={`text-[9px] font-medium hidden sm:block ${isModuleMode ? 'text-muted-foreground' : 'text-cyan-300'}`}>{t.manufacturerDashboard.title}</span>
            </div>
          </Link>

          <div className="flex-1" />

          {isSalesRep && salesRepRecord && (
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-xs font-semibold text-blue-700">
              <Icon name="UserGroupIcon" size={13} />
              {md.salesRep}
            </div>
          )}

          <div className="flex items-center gap-2">
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                aria-haspopup="menu"
                aria-expanded={userMenuOpen}
                aria-label={userName}
                className={`flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${isModuleMode ? 'text-muted-foreground hover:text-foreground hover:bg-muted' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
              >
                <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                  {userName.charAt(0).toUpperCase()}
                </div>
                <span className="hidden sm:block max-w-[120px] truncate">{userName}</span>
                <Icon name="ChevronDownIcon" size={14} />
              </button>
              {userMenuOpen && (
                <div role="menu" className="absolute end-0 top-full mt-1 w-52 bg-card border border-border rounded-xl shadow-lg py-1 z-50">
                  <div className="px-4 py-2 border-b border-border">
                    <p className="text-xs font-semibold text-foreground truncate">{userName}</p>
                    {companyName && <p className="text-xs text-muted-foreground truncate">{companyName}</p>}
                    <p className="text-xs text-primary font-medium mt-0.5">
                      {isSalesRep ? md.salesRep : t.manufacturerDashboard.manufacturer}
                    </p>
                  </div>
                  <Link href="/" role="menuitem" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors">
                    <Icon name="HomeIcon" size={16} /> {t.manufacturerDashboard.backToMarketplace}
                  </Link>
                  <button type="button" role="menuitem" onClick={onSignOut} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors text-start">
                    <Icon name="ArrowRightOnRectangleIcon" size={16} /> {t.manufacturerDashboard.signOut}
                  </button>
                </div>
              )}
            </div>
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
