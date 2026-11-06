'use client';

import React, { useState, Suspense } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import HeroSection from '@/app/components/HeroSection';
import ShelfSlider from '@/app/components/ShelfSlider';
import HorizontalCategoryBar from '@/app/components/HorizontalCategoryBar';
import WelcomeTicker from '@/app/components/WelcomeTicker';
import Icon from '@/components/ui/AppIcon';
import { useLanguage } from '@/contexts/LanguageContext';

// Dynamic imports for optimal page load speed
const FeaturedProducts = dynamic(() => import('@/app/components/FeaturedProducts'));
const CategoriesSection = dynamic(() => import('@/app/components/CategoriesSection'));
const MasterCategoriesGrid = dynamic(() => import('@/app/components/MasterCategoriesGrid'));
const RecommendationsSection = dynamic(() => import('@/app/components/RecommendationsSection'));

// ── Skeletons ─────────────────────────────────────────────────────────────────

function ProductGridSkeleton() {
  return (
    <section className="py-12 px-4 md:px-6 max-w-7xl mx-auto">
      <div className="h-7 w-48 bg-muted animate-pulse rounded-lg mb-6" />
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
        {[...Array(10)].map((_, i) => (
          <div key={i} className="bg-card rounded-2xl overflow-hidden border border-border">
            <div className="aspect-square bg-muted animate-pulse" />
            <div className="p-3 space-y-2">
              <div className="h-3.5 bg-muted animate-pulse rounded-full w-3/4" />
              <div className="h-3 bg-muted animate-pulse rounded-full w-1/2" />
              <div className="h-8 bg-muted animate-pulse rounded-xl mt-2" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function CategoryGridSkeleton() {
  return (
    <section className="bg-muted/30 py-16 border-b border-border">
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        <div className="h-7 w-40 bg-muted animate-pulse rounded-lg mb-10" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-muted animate-pulse rounded-xl" style={{ aspectRatio: '3/4' }} />
          ))}
        </div>
      </div>
    </section>
  );
}

function MasterCategoriesSkeleton() {
  return (
    <section className="py-10 px-4 md:px-6 max-w-7xl mx-auto">
      <div className="h-7 w-52 bg-muted animate-pulse rounded-lg mb-6" />
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
        {[...Array(12)].map((_, i) => (
          <div key={i} className="bg-muted animate-pulse rounded-xl aspect-square" />
        ))}
      </div>
    </section>
  );
}

function RecommendationsSkeleton() {
  return (
    <section className="py-12 px-4 md:px-6 max-w-7xl mx-auto">
      <div className="h-7 w-44 bg-muted animate-pulse rounded-lg mb-6" />
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 md:gap-4">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="bg-card rounded-2xl overflow-hidden border border-border">
            <div className="aspect-square bg-muted animate-pulse" />
            <div className="p-3 space-y-2">
              <div className="h-3.5 bg-muted animate-pulse rounded-full w-3/4" />
              <div className="h-3 bg-muted animate-pulse rounded-full w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Multilingual Service Mode Tabs ────────────────────────────────────────────

const SERVICE_TEXTS = {
  ar: {
    sectionTitle: 'اختر نوع الخدمة — Choose Your Service Mode',
    b2bBadge: 'B2B',
    b2bTitle: 'طلبات المصانع',
    b2bSubtitle: 'B2B & RFQ — Industrial Orders',
    b2bDesc: 'أرسل طلب عرض سعر مباشرة للمصانع، طلبات الجملة والكميات الكبيرة',
    b2bAction: 'إنشاء طلب RFQ',
    b2cBadge: 'B2C / Wholesale',
    b2cTitle: 'المنتجات الجاهزة للشحن',
    b2cSubtitle: 'B2C / Wholesale — Ready to Ship',
    b2cDesc: 'تصفح المنتجات المتاحة فوراً، شحن سريع للأفراد والموزعين',
    b2cAction: 'تصفح المنتجات',
  },
  zh: {
    sectionTitle: '选择服务模式 — Choose Your Service Mode',
    b2bBadge: 'B2B',
    b2bTitle: '工厂直订 / 询价单',
    b2bSubtitle: 'B2B & RFQ — Industrial Orders',
    b2bDesc: '直接向源头工厂发起询价，支持大宗批发与工业级批量采购',
    b2bAction: '创建 RFQ 询价单',
    b2cBadge: '现货 / 批发',
    b2cTitle: '现货直发专区',
    b2cSubtitle: 'B2C / Wholesale — Ready to Ship',
    b2cDesc: '浏览仓库现货产品，支持零售买家与经销商极速直发',
    b2cAction: '浏览现货产品',
  },
  tr: {
    sectionTitle: 'Hizmet Modunu Seçin — Choose Your Service Mode',
    b2bBadge: 'B2B',
    b2bTitle: 'Fabrika Siparişleri',
    b2bSubtitle: 'B2B & RFQ — Industrial Orders',
    b2bDesc: 'Fabrikalardan doğrudan teklif alın, toptan ve yüksek hacimli siparişler',
    b2bAction: 'RFQ Talebi Oluştur',
    b2cBadge: 'B2C / Toptan',
    b2cTitle: 'Sevkiyata Hazır Ürünler',
    b2cSubtitle: 'B2C / Wholesale — Ready to Ship',
    b2cDesc: 'Hemen temin edilebilen ürünleri keşfedin, bireysel ve dağıtıcılar için hızlı sevkiyat',
    b2cAction: 'Ürünleri İncele',
  },
  en: {
    sectionTitle: 'Choose Your Service Mode',
    b2bBadge: 'B2B',
    b2bTitle: 'Factory Direct Orders',
    b2bSubtitle: 'B2B & RFQ — Industrial Orders',
    b2bDesc: 'Request direct factory quotes for wholesale orders and bulk quantities',
    b2bAction: 'Create RFQ',
    b2cBadge: 'B2C / Wholesale',
    b2cTitle: 'Ready to Ship Products',
    b2cSubtitle: 'B2C / Wholesale — Ready to Ship',
    b2cDesc: 'Browse in-stock items with fast shipping for individuals and distributors',
    b2cAction: 'Browse Products',
  },
};

function ServiceModeTabs() {
  const { language, dir, isRTL } = useLanguage();
  const langKey = (['ar', 'zh', 'tr', 'en'].includes(language) ? language : 'en') as 'ar' | 'zh' | 'tr' | 'en';
  const t = SERVICE_TEXTS[langKey];

  return (
    <section className="max-w-7xl mx-auto px-4 md:px-6 pt-6 pb-2" dir={dir}>
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3 text-center">
        {t.sectionTitle}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* B2B Tab */}
        <Link
          href="/rfq/create"
          className="group relative flex flex-col gap-3 rounded-2xl border-2 border-[#D4AF37] bg-gradient-to-br from-[#0B1F4B] via-[#14336B] to-[#2B4A7A] hover:from-[#0E2A66] hover:via-[#1B4287] hover:to-[#365C94] transition-all duration-200 p-4 sm:p-5 shadow-[0_0_22px_rgba(212,175,55,0.35)] hover:shadow-[0_0_34px_rgba(212,175,55,0.6)] hover:-translate-y-0.5 text-start"
        >
          <span className="absolute top-3 end-3 text-[10px] font-bold uppercase tracking-wider bg-[#D4AF37] text-[#0B1F4B] border border-[#F3D675] rounded-full px-2.5 py-0.5 shadow-sm">
            {t.b2bBadge}
          </span>

          <div className="w-10 h-10 rounded-xl bg-[#D4AF37] flex items-center justify-center text-[#0B1F4B] shadow-md group-hover:scale-105 transition-transform">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
            </svg>
          </div>

          <div>
            <h3 className="text-base sm:text-lg font-extrabold text-white leading-tight">
              {t.b2bTitle}
            </h3>
            <p className="text-xs sm:text-sm font-medium text-white/90 mt-0.5">
              {t.b2bSubtitle}
            </p>
            <p className="text-xs text-white/85 mt-1 leading-relaxed">
              {t.b2bDesc}
            </p>
          </div>

          <div className="mt-auto inline-flex items-center gap-1.5 self-start rounded-full bg-[#D4AF37] group-hover:bg-[#F3D675] text-[#0B1F4B] text-xs font-bold px-3.5 py-1.5 shadow-md transition-colors">
            {t.b2bAction}
            <svg xmlns="http://www.w3.org/2000/svg" className={`w-3.5 h-3.5 transition-transform ${isRTL ? 'rotate-180 group-hover:-translate-x-0.5' : 'group-hover:translate-x-0.5'}`} fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
            </svg>
          </div>
        </Link>

        {/* B2C Tab */}
        <Link
          href="/search"
          className="group relative flex flex-col gap-3 rounded-2xl border-2 border-[#6EE7B7] bg-gradient-to-br from-[#064E3B] via-[#047857] to-[#10B981] hover:from-[#065F46] hover:via-[#059669] hover:to-[#34D399] transition-all duration-200 p-4 sm:p-5 shadow-[0_0_22px_rgba(16,185,129,0.4)] hover:shadow-[0_0_34px_rgba(16,185,129,0.65)] hover:-translate-y-0.5 text-start"
        >
          <span className="absolute top-3 end-3 text-[10px] font-bold uppercase tracking-wider bg-white text-[#047857] border border-[#6EE7B7] rounded-full px-2.5 py-0.5 shadow-sm">
            {t.b2cBadge}
          </span>

          <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-[#047857] shadow-md group-hover:scale-105 transition-transform">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
            </svg>
          </div>

          <div>
            <h3 className="text-base sm:text-lg font-extrabold text-white leading-tight">
              {t.b2cTitle}
            </h3>
            <p className="text-xs sm:text-sm font-medium text-white/90 mt-0.5">
              {t.b2cSubtitle}
            </p>
            <p className="text-xs text-white/85 mt-1 leading-relaxed">
              {t.b2cDesc}
            </p>
          </div>

          <div className="mt-auto inline-flex items-center gap-1.5 self-start rounded-full bg-white group-hover:bg-[#ECFDF5] text-[#047857] text-xs font-bold px-3.5 py-1.5 shadow-md transition-colors">
            {t.b2cAction}
            <svg xmlns="http://www.w3.org/2000/svg" className={`w-3.5 h-3.5 transition-transform ${isRTL ? 'rotate-180 group-hover:-translate-x-0.5' : 'group-hover:translate-x-0.5'}`} fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
            </svg>
          </div>
        </Link>
      </div>
    </section>
  );
}

// ── شريط الضمان التجاري الأنيق والمدمج (Compact Trust Bar) ─────────────────────

interface PolicyDetails {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  icon: string;
  badgeColor: string;
  shortLabel: string;
  shortTag: string;
  points: { title: string; text: string }[];
}

function TrustAndPolicySection() {
  const { language, dir, isRTL } = useLanguage();
  const isAr = language === 'ar';
  const [activeModal, setActiveModal] = useState<PolicyDetails | null>(null);

  const policies: PolicyDetails[] = [
    {
      id: 'buyer',
      title: isAr ? 'منظومة حماية المشتري المعتمدة' : 'Verified Buyer Protection',
      subtitle: isAr ? 'أموالك مجمدة في حساب ضمان حتى استلام وفحص البضاعة' : 'Escrow protection until delivery & verification',
      badge: isAr ? 'ضمان مالي 100%' : '100% Escrow',
      shortLabel: isAr ? 'حماية المشتري' : 'Buyer Protection',
      shortTag: isAr ? 'حساب ضمان 100%' : '100% Escrow',
      icon: 'ShieldCheckIcon',
      badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
      points: [
        {
          title: isAr ? 'حساب مصرفي وسيط مشروط (Escrow)' : 'Escrow Payment Protection',
          text: isAr
            ? 'لا يتم تحويل قيمة الصفقة للمصنع إلا بعد إبحار الشحنة أو فحصها والتأكد من مطابقة المواصفات الفنية.'
            : 'Funds remain securely locked until shipment inspection and compliance confirmation.',
        },
        {
          title: isAr ? 'ضمان مطابقة المواصفات الفنية' : 'Quality & Spec Guarantee',
          text: isAr
            ? 'يحق للمشتري فحص عينات الإنتاج ومراجعة شهادات المنشأ والمختبر قبل الشحن النهائي.'
            : 'Buyers have the right to audit technical lab certificates and pre-shipment inspection.',
        },
        {
          title: isAr ? 'حماية مواعيد الشحن والتسليم' : 'On-Time Dispatch Guarantee',
          text: isAr
            ? 'التزام المصنع بجدول التوريد الزمني المعتمد بالعقد مع بند تعويض فوري عند أي تأخير غير مبرر.'
            : 'Strict contractual delivery timelines with compensation clauses for unexcused delays.',
        },
      ],
    },
    {
      id: 'factory',
      title: isAr ? 'سياسة حماية المصانع والموردين' : 'Manufacturer & Supplier Protection',
      subtitle: isAr ? 'ضمان مستحقات الإنتاج وتوثيق التعاقد المالي' : 'Secured production payout & verified contracts',
      badge: isAr ? 'عقود موثقة' : 'Verified Contracts',
      shortLabel: isAr ? 'ضمان المصانع' : 'Factory Security',
      shortTag: isAr ? 'عقود موثقة' : 'Verified Contracts',
      icon: 'BuildingOffice2Icon',
      badgeColor: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
      points: [
        {
          title: isAr ? 'ضمان جدية المشتري وتوفر السيولة' : 'Verified Buyer Liquidity',
          text: isAr
            ? 'لا يبدأ المصنع خط الإنتاج إلا بعد تأكيد إيداع الدفعة المتفق عليها في حساب الضمان المشروط.'
            : 'Production lines commence only after buyer funds are secured and confirmed in escrow.',
        },
        {
          title: isAr ? 'سرعة الإفراج عن المستحقات' : 'Guaranteed Fast Payouts',
          text: isAr
            ? 'تحويل فوري لمستحقات المصنع المالية بمجرد إصدار بوليصة الشحن الرسمية (Bill of Lading) واعتماد الفحص.'
            : 'Automated release of funds upon valid Bill of Lading generation and audit clearance.',
        },
        {
          title: isAr ? 'حماية الملكية الصناعية والتعاقد' : 'Industrial Rights Protection',
          text: isAr
            ? 'عقود B2B معتمدة دولياً تحمي براءات الاختراع والطلبيات الخاصة والتصميمات المخصصة للمصانع.'
            : 'Legally certified bilateral contracts protecting OEM patents and custom manufacturing specs.',
        },
      ],
    },
    {
      id: 'disputes',
      title: isAr ? 'مركز فض النزاعات والتحكيم التجاري' : 'Trade Dispute Resolution Center',
      subtitle: isAr ? 'لجنة تحكيم مستقلة وقرارات ملزمة خلال 48 ساعة' : 'Independent arbitration & binding decisions in 48h',
      badge: isAr ? 'تحكيم إلزامي' : 'Binding Mediation',
      shortLabel: isAr ? 'فض النزاعات' : 'Dispute Center',
      shortTag: isAr ? 'تحكيم ملزم 48h' : 'Binding in 48h',
      icon: 'ScaleIcon',
      badgeColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
      points: [
        {
          title: isAr ? 'المرحلة 1: التفاوض المباشر الموثق' : 'Stage 1: Verified Direct Negotiation',
          text: isAr
            ? 'مساحة تواصل رسمي وموثق بين الطرفين لحل التعديلات أو الملاحظات ودياً خلال 24 ساعة.'
            : 'Formal documented channel for the parties to amicably align on notes within 24 hours.',
        },
        {
          title: isAr ? 'المرحلة 2: تدخل لجنة التحكيم الفني واللوجستي' : 'Stage 2: Technical Platform Arbitration',
          text: isAr
            ? 'فريق من الخبراء الفنيين واللوجستيين يفحص الوثائق وبوالص الشحن والعينات للفصل الفوري.'
            : 'Neutral engineering and logistics inspectors evaluate lab reports and BOLs.',
        },
        {
          title: isAr ? 'المرحلة 3: القرار الإلزامي وحفظ الحقوق' : 'Stage 3: Binding Resolution',
          text: isAr
            ? 'إصدار قرار ملزم بإعادة التصنيع، خصم تعويضي، أو رد كامل المبلغ من حساب الضمان إلى المشتري.'
            : 'Binding settlement resulting in re-production, discounted compensation, or 100% refund.',
        },
      ],
    },
  ];

  return (
    <section className="max-w-7xl mx-auto px-4 md:px-6 py-2.5" dir={dir}>
      {/* الشريط الأفقي المدمج والأنيق بارتفاع صغير جداً */}
      <div className="bg-card/90 border border-border/80 rounded-2xl p-1.5 sm:p-2 shadow-2xs flex items-center justify-between gap-1.5 sm:gap-3">
        <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-orange-500/10 text-orange-600 dark:text-orange-400 rounded-xl border border-orange-500/20 shrink-0">
          <Icon name="ShieldCheckIcon" size={16} />
          <span className="text-xs font-black tracking-tight">Trade Assurance</span>
        </div>

        <div className="grid grid-cols-3 gap-1 sm:gap-2 flex-1">
          {policies.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveModal(item)}
              className="group flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2.5 px-2 py-1.5 sm:py-2 rounded-xl bg-muted/40 hover:bg-orange-500/10 hover:border-orange-500/30 border border-transparent transition-all cursor-pointer text-start"
              title="اضغط لعرض بنود الحماية"
            >
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Icon name={item.icon as any} size={15} />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <p className="text-[11px] sm:text-xs font-black text-foreground truncate group-hover:text-orange-600 transition-colors">
                    {item.shortLabel}
                  </p>
                  <Icon name="InformationCircleIcon" size={11} className="text-muted-foreground opacity-60 hidden sm:inline shrink-0" />
                </div>
                <p className="text-[9px] sm:text-[10px] text-muted-foreground truncate font-medium">
                  {item.shortTag}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* نافذة السياسة المنبثقة الذكية (تفتح عند الضغط على أي بند من الشريط) */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-card border border-border rounded-3xl p-6 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col text-start" dir={dir}>
            {/* رأس النافذة */}
            <div className="flex items-start justify-between pb-4 border-b border-border/70">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center font-bold">
                  <Icon name={activeModal.icon as any} size={22} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base sm:text-lg font-black text-foreground">
                      {activeModal.title}
                    </h3>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${activeModal.badgeColor}`}>
                      {activeModal.badge}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {activeModal.subtitle}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="w-8 h-8 rounded-full bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {/* بنود السياسة */}
            <div className="overflow-y-auto py-4 space-y-4 my-2">
              {activeModal.points.map((pt, idx) => (
                <div key={idx} className="p-3.5 rounded-2xl bg-muted/30 border border-border/50">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="w-5 h-5 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 text-xs font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <h4 className="text-xs sm:text-sm font-bold text-foreground">
                      {pt.title}
                    </h4>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed pr-7">
                    {pt.text}
                  </p>
                </div>
              ))}
            </div>

            {/* أزرار الإجراء في أسفل النافذة */}
            <div className="pt-3 border-t border-border/70 flex items-center justify-between gap-3">
              {activeModal.id === 'disputes' ? (
                <Link
                  href="/disputes"
                  className="text-xs font-bold px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl transition-colors shadow-sm"
                >
                  {isAr ? 'الدخول لنظام تقديم الشكاوى' : 'Open Dispute System'}
                </Link>
              ) : (
                <Link
                  href="/rfq/create"
                  className="text-xs font-bold px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl transition-colors shadow-sm"
                >
                  {isAr ? 'بدء طلب معتمد الآن' : 'Start Verified Order'}
                </Link>
              )}
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="text-xs font-semibold px-4 py-2 bg-muted hover:bg-muted/80 text-foreground rounded-xl transition-colors"
              >
                {isAr ? 'إغلاق' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// ── Main Page Component ───────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background pb-16 md:pb-0">
      <Header />
      <WelcomeTicker />
      <main>
        <HeroSection />
        <ShelfSlider />
        <HorizontalCategoryBar />

        {/* بوابات الخدمة B2B / B2C */}
        <ServiceModeTabs />

        {/* شريط الضمان التجاري الأنيق والمدمج بدلاً من الكروت الضخمة */}
        <TrustAndPolicySection />

        {/* شبكة التصنيفات الرئيسية للمصانع */}
        <Suspense fallback={<MasterCategoriesSkeleton />}>
          <MasterCategoriesGrid />
        </Suspense>

        {/* المنتجات المميزة */}
        <Suspense fallback={<ProductGridSkeleton />}>
          <FeaturedProducts />
        </Suspense>

        {/* قطاعات البضائع */}
        <Suspense fallback={<CategoryGridSkeleton />}>
          <CategoriesSection />
        </Suspense>

        {/* توصيات السلع المخصصة */}
        <Suspense fallback={<RecommendationsSkeleton />}>
          <RecommendationsSection />
        </Suspense>
      </main>

      {/* شريط الفوتر الموحد */}
      <footer className="bg-slate-950 text-slate-400 border-t border-slate-800/80 py-8 font-sans">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 pb-6 border-b border-slate-800/60">
            <div className="flex items-center space-x-3 space-x-reverse">
              <span className="text-xl font-black text-white tracking-wider">
                Direct<span className="text-emerald-500">Hub</span>
              </span>
              <span className="text-[11px] bg-emerald-950 text-emerald-400 border border-emerald-800/50 px-2 py-0.5 rounded">
                B2B Global Industrial
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-6 text-xs">
              <Link href="/rfq/create" className="hover:text-white transition-colors">سوق طلبات الأسعار (RFQ)</Link>
              <Link href="/suppliers" className="hover:text-white transition-colors">دليل المصانع</Link>
              <Link href="/logistics" className="hover:text-white transition-colors">الخدمات اللوجستية</Link>
              <Link href="/register" className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors">تسجيل مصنع / مورد</Link>
              <Link href="/chat" className="hover:text-white transition-colors">المحادثات الموثقة</Link>
            </div>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-3">
            <p>© 2026 DirectHub Technologies Inc. جميع الحقوق محفوظة.</p>
            <div className="flex space-x-6 space-x-reverse">
              <Link href="/privacy" className="hover:text-slate-400 transition-colors">سياسة الخصوصية</Link>
              <Link href="/terms" className="hover:text-slate-400 transition-colors">شروط الاستخدام</Link>
              <Link href="/disputes" className="hover:text-slate-400 transition-colors">فض النزاعات</Link>
            </div>
          </div>
        </div>
      </footer>

      {/* شريط التنقل السفلي للهواتف الذكية */}
      <BottomNav />
    </div>
  );
}
