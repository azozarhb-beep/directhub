'use client';

export const dynamic = 'force-dynamic';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import AppLogo from '@/components/ui/AppLogo';
import FactoryControlHub from '@/components/manufacturer/FactoryControlHub';
import { useSalesRepAccess } from '@/components/manufacturer/useSalesRepAccess';
import { useLiveExportData } from '@/components/manufacturer/useLiveExportData';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Globe,
  TrendingUp,
  Ship,
  AlertTriangle,
  Store,
  MessageSquare,
  Bell,
  Check,
  Building2,
} from 'lucide-react';

const LANGUAGES = [
  { code: 'ar', label: 'العربية' },
  { code: 'zh', label: '中文' },
  { code: 'tr', label: 'Türkçe' },
  { code: 'en', label: 'English' },
];

const formatCompactUSD = (amount: number): string => {
  if (!Number.isFinite(amount) || amount <= 0) return '$0';
  if (amount >= 1_000_000) return `$${+(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${Math.round(amount / 1_000)}K`;
  return `$${Math.round(amount)}`;
};

export default function ManufacturerHubPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { language, setLanguage, dir } = useLanguage();
  const { loading: roleLoading, isSalesRep } = useSalesRepAccess();
  const { kpis } = useLiveExportData(user?.id);

  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const langMenuRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!loading && !user) router?.push('/manufacturer/login');
  }, [user, loading, router]);

  // Multi-language text dictionary
  const roomTitle =
    language === 'zh' ? '国际工厂控制室' :
    language === 'tr' ? 'Uluslararası Fabrika Odası' :
    language === 'en' ? 'International Factory Room' :
    'غرفة تحكم المصنع الدولي';

  const backToStoreText =
    language === 'zh' ? '返回商城' :
    language === 'tr' ? 'Mağazaya Dön' :
    language === 'en' ? 'Back to Store' :
    'العودة للمتجر';

  const bannerDesc =
    language === 'zh' ? '生产线管理 · 出口大宗订单履约与全球货运中心' :
    language === 'tr' ? 'Üretim Hatları Yönetimi · Küresel İhracat ve Nakliye Merkezi' :
    language === 'en' ? 'Production Lines · Global Export Deals & International Freight Hub' :
    'إدارة خطوط الإنتاج والتصنيع · الصفقات التصديرية والشحن العالمي';

  const roleBadge =
    language === 'zh' ? '🏭 认证国际制造商' :
    language === 'tr' ? '🏭 Onaylı Küresel Fabrika' :
    language === 'en' ? '🏭 Verified Manufacturer' :
    '🏭 مصنع دولي معتمد';

  const dividerText =
    language === 'zh' ? '🏭 工厂运营与生产线管理套件' :
    language === 'tr' ? '🏭 Fabrika Yönetimi ve Üretim Hatları' :
    language === 'en' ? '🏭 Factory Operations & Production Line Tools' :
    '🏭 أدوات إدارة المصنع وخطوط الإنتاج';

  const STAT_CARDS = [
    {
      key: 'exports',
      href: '/manufacturer/analytics',
      label:
        language === 'zh' ? '累计出口额' :
        language === 'tr' ? 'İhracat Hacmi' :
        language === 'en' ? 'Export Volume' :
        'حجم الصادرات',
      value: formatCompactUSD(kpis.exportVolume),
      sub:
        kpis.exportVolume > 0
          ? language === 'zh' ? '累计出口订单总值' : language === 'tr' ? 'Toplam ihracat siparişleri' : language === 'en' ? 'Total export orders' : 'إجمالي طلبات التصدير'
          : language === 'zh' ? '暂无生效订单' : language === 'tr' ? 'Henüz sipariş yok' : language === 'en' ? 'No orders yet' : 'لا توجد طلبات بعد',
      icon: TrendingUp,
      color: 'from-cyan-600 to-cyan-800',
    },
    {
      key: 'in_transit',
      href: '/manufacturer/logistics',
      label:
        language === 'zh' ? '在途货运批次' :
        language === 'tr' ? 'Yoldaki Sevkiyatlar' :
        language === 'en' ? 'Shipments in Transit' :
        'الشحنات في الطريق',
      value: String(kpis.inTransit),
      sub:
        kpis.inTransit > 0
          ? `${kpis.inTransit} ${language === 'zh' ? '批次正常在运' : language === 'tr' ? 'aktif sevkiyat' : language === 'en' ? 'active shipments' : 'شحنة نشطة'}`
          : language === 'zh' ? '0 批次' : '0 نشطة',
      icon: Ship,
      color: 'from-indigo-600 to-indigo-800',
    },
    {
      key: 'held',
      href: '/manufacturer/logistics',
      label:
        language === 'zh' ? '待验/受限批次' :
        language === 'tr' ? 'Bekleyen / Askıdaki' :
        language === 'en' ? 'Held / Under Review' :
        'شحنات محتجزة',
      value: String(kpis.held),
      sub:
        kpis.held > 0
          ? language === 'zh' ? '需即刻处理审核' : language === 'tr' ? 'İnceleme gerekiyor' : language === 'en' ? 'Requires review' : 'تحتاج مراجعة فورية'
          : language === 'zh' ? '无异常滞留' : language === 'tr' ? 'Askıda sevkiyat yok' : language === 'en' ? 'No held shipments' : 'لا توجد شحنات محتجزة',
      icon: AlertTriangle,
      color: 'from-red-600 to-red-800',
    },
  ];

  if (loading || !user || roleLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const visibleStatCards = isSalesRep ? STAT_CARDS?.filter((c) => c?.key !== 'exports') : STAT_CARDS;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100" dir={dir}>
      {/* ── Top Navigation Bar ── */}
      <header className="sticky top-0 z-50 backdrop-blur-md border-b shadow-sm bg-slate-900/95 border-slate-800">
        <div className="max-w-screen-2xl mx-auto px-4 py-3 flex items-center gap-2 sm:gap-3 h-14">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <AppLogo size={28} />
            <div className="flex flex-col leading-none">
              <span className="font-bold text-sm tracking-tight text-white" translate="no">Direct Hub</span>
              <span className="text-[9px] font-medium hidden sm:block text-cyan-300">{roomTitle}</span>
            </div>
          </Link>

          <div className="flex-1" />

          <div className="flex items-center gap-1.5 sm:gap-2">
            <Link
              href="/"
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white text-xs font-bold transition-all shadow-sm active:scale-95"
              title={backToStoreText}
            >
              <Store size={15} />
              <span className="hidden sm:inline">{backToStoreText}</span>
            </Link>

            {/* أيقونة المراسلات الموحدة */}
            <Link
              href="/messaging"
              className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
              title={language === 'zh' ? '直接沟通' : language === 'tr' ? 'Sohbet' : language === 'en' ? 'Chat' : 'المراسلات'}
            >
              <MessageSquare size={17} />
            </Link>

            <Link
              href="/notifications"
              className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800 transition-colors relative"
              title={language === 'zh' ? '通知' : language === 'tr' ? 'Bildirimler' : language === 'en' ? 'Notifications' : 'الإشعارات'}
            >
              <Bell size={17} />
            </Link>

            {/* Language Selector Dropdown */}
            <div className="relative" ref={langMenuRef}>
              <button
                type="button"
                onClick={() => setLangMenuOpen(!langMenuOpen)}
                className={`w-9 h-9 rounded-xl flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800 transition-colors ${langMenuOpen ? 'ring-2 ring-primary/40' : ''}`}
                title="Language / اللغة"
                aria-label="Language Selector"
              >
                <Globe size={18} />
              </button>

              {langMenuOpen && (
                <div className="absolute end-0 top-full mt-2 w-36 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl py-1.5 z-50">
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
                          ? 'bg-cyan-500/15 text-cyan-400 font-bold'
                          : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <span>{lang.label}</span>
                      {language === lang.code && <Check size={14} className="text-cyan-400" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ── Room Identity Banner ── */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white px-4 py-3 border-b border-indigo-950">
        <div className="max-w-screen-2xl mx-auto flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center border border-white/20">
              <Building2 size={18} className="text-cyan-300" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white leading-tight">{roomTitle}</h2>
              <p className="text-indigo-200 text-xs">{bannerDesc}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="bg-white/15 text-cyan-200 text-xs px-3 py-1 rounded-full border border-white/20 font-medium">
              {roleBadge}
            </span>
            <span className="bg-white/10 text-slate-300 text-xs px-3 py-1 rounded-full border border-white/10 font-mono">
              ID: manufacturer-hub
            </span>
          </div>
        </div>
      </div>

      {/* ── Main Content ── */}
      <main className="max-w-screen-2xl mx-auto px-4 py-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {visibleStatCards?.map((card) => (
            <button
              type="button"
              key={card?.key}
              onClick={() => router?.push(card?.href)}
              className={`bg-gradient-to-br ${card?.color} rounded-2xl p-4 border border-white/10 text-start w-full cursor-pointer transition-all duration-150 hover:scale-[1.02] hover:border-white/30 active:scale-95 shadow-md`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-white/80 text-xs mb-1 font-medium">{card?.label}</p>
                  <p className="text-2xl font-bold text-white tracking-tight">{card?.value}</p>
                  <p className="text-white/60 text-xs mt-1">{card?.sub}</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                  <card.icon size={20} className="text-white" />
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 pt-2">
          <div className="flex-1 h-px bg-slate-800" />
          <span className="text-xs text-slate-400 font-semibold px-4 py-1.5 bg-slate-900 rounded-full border border-slate-800 whitespace-nowrap shadow-sm">
            {dividerText}
          </span>
          <div className="flex-1 h-px bg-slate-800" />
        </div>

        {/* Core Modular Control Hub */}
        <FactoryControlHub userId={user?.id} />
      </main>
    </div>
  );
}
