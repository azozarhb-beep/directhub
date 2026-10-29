import React, { Suspense } from 'react';
import dynamic from 'next/dynamic';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import HeroSection from '@/app/components/HeroSection';
import ShelfSlider from '@/app/components/ShelfSlider';
import HorizontalCategoryBar from '@/app/components/HorizontalCategoryBar';
import WelcomeTicker from '@/app/components/WelcomeTicker';
import Link from 'next/link';
import { Metadata } from 'next';
import { OrdersSection, PaymentsSection, SmartServicesSection, ManufacturerBanner } from '@/app/components/DashboardSections';









// Dashboard sections are loaded via dynamic() below


// Dashboard sections (Orders, Payments, SmartServices, ManufacturerBanner) are loaded via dynamic() below

// Below-the-fold sections are code-split into their own chunks so the initial
// app/page chunk stays small and compiles/loads quickly.
const FeaturedProducts = dynamic(() => import('@/app/components/FeaturedProducts'));
const CategoriesSection = dynamic(() => import('@/app/components/CategoriesSection'));
const MasterCategoriesGrid = dynamic(() => import('@/app/components/MasterCategoriesGrid'));
const WhyDirectHub = dynamic(() => import('@/app/components/WhyDirectHub'));
const TestimonialsSection = dynamic(() => import('@/app/components/TestimonialsSection'));
const RecommendationsSection = dynamic(() => import('@/app/components/RecommendationsSection'));
const OrdersSection = dynamic(() =>
  import('@/app/components/DashboardSections').then((m) => m.OrdersSection)
);
const PaymentsSection = dynamic(() =>
  import('@/app/components/DashboardSections').then((m) => m.PaymentsSection)
);
const SmartServicesSection = dynamic(() =>
  import('@/app/components/DashboardSections').then((m) => m.SmartServicesSection)
);
const ManufacturerBanner = dynamic(() =>
  import('@/app/components/DashboardSections').then((m) => m.ManufacturerBanner)
);

export const metadata: Metadata = {
  title: 'DirectHub — B2B Marketplace for Manufacturers & Buyers',
  description: 'Connect directly with verified manufacturers worldwide. Source products across all categories with transparent MOQ pricing and factory-direct rates. 50,000+ verified suppliers.',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'DirectHub — B2B Marketplace for Manufacturers & Buyers',
    description: 'Factory-direct sourcing across all product categories. 50,000+ verified suppliers. Transparent MOQ pricing.',
    images: [{ url: '/assets/images/app_logo.png', width: 1200, height: 630, alt: 'DirectHub B2B Marketplace — Connect with verified manufacturers worldwide' }],
    type: 'website',
    url: '/',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DirectHub — B2B Marketplace for Manufacturers & Buyers',
    description: 'Factory-direct sourcing across all product categories. 50,000+ verified suppliers.',
    images: ['/assets/images/app_logo.png'],
  },
};

const marketplaceJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'ShoppingCenter',
  name: 'DirectHub B2B Marketplace',
  description: 'B2B marketplace connecting buyers with verified manufacturers and suppliers worldwide.',
  url: process.env.NEXT_PUBLIC_SITE_URL || 'https://direct-hub.net',
  logo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://direct-hub.net'}/assets/images/app_logo.png`,
};

// ── Loading Skeletons ─────────────────────────────────────────────────────────

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

// ── B2B / B2C Service Mode Tabs ───────────────────────────────────────────────

function ServiceModeTabs() {
  return (
    <section className="max-w-7xl mx-auto px-4 md:px-6 pt-8 pb-2">
      {/* Section label */}
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3 text-center">
        اختر نوع الخدمة — Choose Your Service Mode
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* B2B Tab */}
        <Link
          href="/rfq/create"
          className="group relative flex flex-col gap-3 rounded-2xl border-2 border-[#D4AF37] bg-gradient-to-br from-[#0B1F4B] via-[#14336B] to-[#2B4A7A] hover:from-[#0E2A66] hover:via-[#1B4287] hover:to-[#365C94] transition-all duration-200 p-5 shadow-[0_0_22px_rgba(212,175,55,0.35)] hover:shadow-[0_0_34px_rgba(212,175,55,0.6)] hover:-translate-y-0.5"
        >
          {/* Badge */}
          <span className="absolute top-3 right-3 text-[10px] font-bold uppercase tracking-wider bg-[#D4AF37] text-[#0B1F4B] border border-[#F3D675] rounded-full px-2.5 py-0.5 shadow-sm">
            B2B
          </span>

          {/* Icon */}
          <div className="w-11 h-11 rounded-xl bg-[#D4AF37] flex items-center justify-center text-[#0B1F4B] shadow-md group-hover:scale-105 transition-transform">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
            </svg>
          </div>

          {/* Text */}
          <div>
            <h3 className="text-lg font-extrabold text-white leading-tight">
              طلبات المصانع
            </h3>
            <p className="text-sm font-medium text-white mt-0.5">
              B2B &amp; RFQ — Industrial Orders
            </p>
            <p className="text-xs text-white/95 mt-1.5 leading-relaxed">
              أرسل طلب عرض سعر مباشرة للمصانع، طلبات الجملة والكميات الكبيرة
            </p>
          </div>

          {/* Action pill */}
          <div className="mt-auto inline-flex items-center gap-1.5 self-start rounded-full bg-[#D4AF37] group-hover:bg-[#F3D675] text-[#0B1F4B] text-xs font-bold px-4 py-2 shadow-md transition-colors">
            إنشاء طلب RFQ
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
            </svg>
          </div>
        </Link>

        {/* B2C Tab */}
        <Link
          href="/search"
          className="group relative flex flex-col gap-3 rounded-2xl border-2 border-[#6EE7B7] bg-gradient-to-br from-[#064E3B] via-[#047857] to-[#10B981] hover:from-[#065F46] hover:via-[#059669] hover:to-[#34D399] transition-all duration-200 p-5 shadow-[0_0_22px_rgba(16,185,129,0.4)] hover:shadow-[0_0_34px_rgba(16,185,129,0.65)] hover:-translate-y-0.5"
        >
          {/* Badge */}
          <span className="absolute top-3 right-3 text-[10px] font-bold uppercase tracking-wider bg-white text-[#047857] border border-[#6EE7B7] rounded-full px-2.5 py-0.5 shadow-sm">
            B2C / Wholesale
          </span>

          {/* Icon */}
          <div className="w-11 h-11 rounded-xl bg-white flex items-center justify-center text-[#047857] shadow-md group-hover:scale-105 transition-transform">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
            </svg>
          </div>

          {/* Text */}
          <div>
            <h3 className="text-lg font-extrabold text-white leading-tight">
              المنتجات الجاهزة للشحن
            </h3>
            <p className="text-sm font-medium text-white mt-0.5">
              B2C / Wholesale — Ready to Ship
            </p>
            <p className="text-xs text-white/95 mt-1.5 leading-relaxed">
              تصفح المنتجات المتاحة فوراً، شحن سريع للأفراد والموزعين
            </p>
          </div>

          {/* Action pill */}
          <div className="mt-auto inline-flex items-center gap-1.5 self-start rounded-full bg-white group-hover:bg-[#ECFDF5] text-[#047857] text-xs font-bold px-4 py-2 shadow-md transition-colors">
            تصفح المنتجات
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
            </svg>
          </div>
        </Link>
      </div>
    </section>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(marketplaceJsonLd) }}
      />
      <Header />
      <WelcomeTicker />
      <main>
        {/* Hero — no data fetching, render immediately */}
        <HeroSection />

        {/* 1. Horizontal auto-scrolling shelf slider */}
        <ShelfSlider />

        {/* 2. Quick category filter pills */}
        <HorizontalCategoryBar />

        {/* ── B2B / B2C Service Mode Tabs ── */}
        <ServiceModeTabs />

        {/* 3. Master Industrial Taxonomy Grid — data-fetching section */}
        <Suspense fallback={<MasterCategoriesSkeleton />}>
          <MasterCategoriesGrid />
        </Suspense>

        {/* 4. Dashboard sections — vertical scroll */}
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-5 space-y-4">
          <OrdersSection />
          <PaymentsSection />
          <SmartServicesSection />
          <ManufacturerBanner />
        </div>

        {/* 5. Featured Products — data-fetching section */}
        <Suspense fallback={<ProductGridSkeleton />}>
          <FeaturedProducts />
        </Suspense>

        {/* 6. All Categories grid — data-fetching section */}
        <Suspense fallback={<CategoryGridSkeleton />}>
          <CategoriesSection />
        </Suspense>

        {/* 7. Why DirectHub */}
        <WhyDirectHub />

        {/* 8. Testimonials */}
        <TestimonialsSection />

        {/* 9. Recommendations & Favorites — data-fetching section */}
        <Suspense fallback={<RecommendationsSkeleton />}>
          <RecommendationsSection />
        </Suspense>
      </main>
      <footer className="bg-slate-950 text-slate-400 border-t border-slate-800/80 pt-16 pb-12 font-sans">
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 pb-12 border-b border-slate-800/60">
      <div className="lg:col-span-2 space-y-4">
        <div className="flex items-center space-x-3 space-x-reverse">
          <span className="text-2xl font-black text-white tracking-wider">Direct<span className="text-emerald-500">Hub</span></span>
          <span className="text-xs bg-emerald-950 text-emerald-400 border border-emerald-800/50 px-2 py-0.5 rounded">B2B Global Industrial</span>
        </div>
        <p className="text-sm text-slate-400 leading-relaxed max-w-sm">
          المنصة العالمية الرائدة لربط المصانع الكبرى بالمشترين التجاريين. نمكّن سلاسل الإمداد عبر التوجيه الذكي ونظام الضمان المالي.
        </p>
      </div>
      <div className="space-y-3">
        <h4 className="text-xs font-bold text-white uppercase tracking-wider">حلول الأعمال</h4>
        <ul className="space-y-2 text-sm">
          <li><a href="/rfq/create" className="hover:text-white transition-colors">سوق طلبات الأسعار (RFQ)</a></li>
          <li><a href="/suppliers" className="hover:text-white transition-colors">دليل المصانع</a></li>
          <li><a href="/logistics" className="hover:text-white transition-colors">الخدمات اللوجستية</a></li>
        </ul>
      </div>
      <div className="space-y-3">
        <h4 className="text-xs font-bold text-white uppercase tracking-wider">الثقة والامتثال</h4>
        <ul className="space-y-2 text-sm">
          <li><span className="text-slate-400">نظام الضمان المالي (Escrow)</span></li>
          <li><span className="text-slate-400">التحقق والاعتماد (KYC)</span></li>
          <li><a href="/disputes" className="hover:text-white transition-colors">تسوية النزاعات</a></li>
        </ul>
      </div>
      <div className="space-y-3">
        <h4 className="text-xs font-bold text-white uppercase tracking-wider">انضم إلينا</h4>
        <ul className="space-y-2 text-sm">
          <li><a href="/factory/register" className="text-emerald-400 font-medium hover:text-emerald-300">سجل مصنعك الآن</a></li>
          <li><a href="https://wa.me/" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">دعم العملاء (واتساب)</a></li>
        </ul>
      </div>
    </div>
    <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 space-y-4 sm:space-y-0">
      <p>© 2026 DirectHub Technologies Inc. جميع الحقوق محفوظة.</p>
      <div className="flex space-x-6 space-x-reverse">
        <a href="/privacy" className="hover:text-slate-400">سياسة الخصوصية</a>
        <a href="/terms" className="hover:text-slate-400">شروط الاستخدام</a>
      </div>
    </div>
  </div>
</footer>
      <BottomNav />
    </div>
  );
}
