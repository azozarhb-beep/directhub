'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';

// ─── Types ────────────────────────────────────────────────────────────────────
interface OnboardingStep {
  id: string;
  titleKey: string;
  descKey: string;
  icon: string;
  href: string;
  completed: boolean;
  required: boolean;
  points: number;
}

interface SellerProfile {
  full_name: string | null;
  company_name: string | null;
  country: string | null;
  city: string | null;
  phone: string | null;
  avatar_url: string | null;
  role: string;
  trust_score: number | null;
  kyc_status: string | null;
  created_at: string | null;
}

// ─── Stable date formatter ────────────────────────────────────────────────────
function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ─── Tip Card ─────────────────────────────────────────────────────────────────
function TipCard({ icon, title, desc, color }: { icon: string; title: string; desc: string; color: string }) {
  return (
    <div className={`rounded-xl p-4 border ${color} flex gap-3 items-start`}>
      <div className="mt-0.5 shrink-0">
        <Icon name={icon as any} size={18} />
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function SellerOnboardingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { t, isRTL, language } = useLanguage();
  const supabase = createClient();

  const [profile, setProfile] = useState<SellerProfile | null>(null);
  const [productCount, setProductCount] = useState(0);
  const [orderCount, setOrderCount] = useState(0);
  const [rfqCount, setRfqCount] = useState(0);
  const [loadingData, setLoadingData] = useState(true);
  const [activeSection, setActiveSection] = useState<'checklist' | 'tips' | 'resources'>('checklist');

  // ── Auth guard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  // ── Fetch seller data ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      setLoadingData(true);
      try {
        const [profileRes, productsRes, ordersRes, rfqRes] = await Promise.all([
          supabase
            .from('user_profiles')
            .select('full_name, company_name, country, city, phone, avatar_url, role, trust_score, kyc_status, created_at')
            .eq('id', user.id)
            .single(),
          supabase
            .from('manufacturer_products')
            .select('id', { count: 'exact', head: true })
            .eq('supplier_id', user.id),
          supabase
            .from('orders')
            .select('id', { count: 'exact', head: true })
            .eq('supplier_id', user.id),
          supabase
            .from('rfq_requests')
            .select('id', { count: 'exact', head: true })
            .eq('supplier_id', user.id),
        ]);

        if (profileRes.data) setProfile(profileRes.data as SellerProfile);
        setProductCount(productsRes.count ?? 0);
        setOrderCount(ordersRes.count ?? 0);
        setRfqCount(rfqRes.count ?? 0);
      } catch {
        // silently fail
      } finally {
        setLoadingData(false);
      }
    };

    fetchData();
  }, [user]);

  // ── Compute onboarding steps ────────────────────────────────────────────────
  const steps: OnboardingStep[] = [
    {
      id: 'profile',
      titleKey: 'Complete Your Profile',
      descKey: 'Add your full name, company name, country, and contact details.',
      icon: 'UserCircleIcon',
      href: '/my-account/edit-profile',
      completed: !!(profile?.full_name && profile?.company_name && profile?.country),
      required: true,
      points: 20,
    },
    {
      id: 'kyc',
      titleKey: 'KYC Verification',
      descKey: 'Submit your identity and business documents for verification.',
      icon: 'ShieldCheckIcon',
      href: '/kyc',
      completed: profile?.kyc_status === 'approved',
      required: true,
      points: 30,
    },
    {
      id: 'product',
      titleKey: 'List Your First Product',
      descKey: 'Add at least one product to start receiving orders and RFQs.',
      icon: 'CubeIcon',
      href: '/product-management',
      completed: productCount > 0,
      required: true,
      points: 25,
    },
    {
      id: 'storefront',
      titleKey: 'Set Up Your Storefront',
      descKey: 'Customize your public supplier profile and storefront page.',
      icon: 'BuildingStorefrontIcon',
      href: '/my-account/supplier-profile',
      completed: !!(profile?.company_name && profile?.avatar_url),
      required: false,
      points: 15,
    },
    {
      id: 'rfq',
      titleKey: 'Respond to an RFQ',
      descKey: 'Browse the RFQ board and submit your first quote to a buyer.',
      icon: 'ClipboardDocumentListIcon',
      href: '/rfq-board',
      completed: rfqCount > 0,
      required: false,
      points: 10,
    },
  ];

  const completedSteps = steps.filter(s => s.completed).length;
  const totalPoints = steps.reduce((acc, s) => acc + (s.completed ? s.points : 0), 0);
  const maxPoints = steps.reduce((acc, s) => acc + s.points, 0);
  const progressPct = Math.round((completedSteps / steps.length) * 100);

  // ── Seller level ────────────────────────────────────────────────────────────
  const getSellerLevel = () => {
    if (progressPct >= 100) return { label: 'Verified Seller', color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200', icon: 'CheckBadgeIcon' };
    if (progressPct >= 60) return { label: 'Active Seller', color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200', icon: 'StarIcon' };
    if (progressPct >= 30) return { label: 'Getting Started', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200', icon: 'RocketLaunchIcon' };
    return { label: 'New Seller', color: 'text-muted-foreground', bg: 'bg-muted border-border', icon: 'UserIcon' };
  };

  const level = getSellerLevel();

  if (loading || loadingData) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">Loading your onboarding dashboard…</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" dir={isRTL ? 'rtl' : 'ltr'}>
      <Header />

      {/* ── Hero Banner ─────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-primary/5 to-background border-b border-border">
        <div className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: 'radial-gradient(circle at 20% 50%, hsl(var(--primary)/0.15) 0%, transparent 60%), radial-gradient(circle at 80% 20%, hsl(var(--primary)/0.1) 0%, transparent 50%)',
          }}
        />
        <div className="relative max-w-6xl mx-auto px-4 md:px-6 py-8 md:py-12">
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            {/* Left: Welcome text */}
            <div className="flex-1">
              <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border mb-3 ${level.bg} ${level.color}`}>
                <Icon name={level.icon as any} size={13} />
                {level.label}
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
                {language === 'ar' ? 'لوحة انضمام البائعين' : 'Seller Onboarding Dashboard'}
              </h1>
              <p className="text-muted-foreground text-sm md:text-base max-w-lg">
                {language === 'ar' ?'أكمل خطوات الإعداد لتفعيل حسابك كبائع والبدء في استقبال الطلبات.' :'Complete your setup steps to activate your seller account and start receiving orders from buyers worldwide.'}
              </p>
              {profile?.created_at && (
                <p className="text-xs text-muted-foreground mt-2">
                  {language === 'ar' ? 'عضو منذ' : 'Member since'} {formatDate(profile.created_at)}
                </p>
              )}
            </div>

            {/* Right: Progress ring */}
            <div className="flex items-center gap-6 shrink-0">
              {/* Circular progress */}
              <div className="relative w-24 h-24">
                <svg className="w-24 h-24 -rotate-90" viewBox="0 0 96 96">
                  <circle cx="48" cy="48" r="40" fill="none" stroke="hsl(var(--border))" strokeWidth="8" />
                  <circle
                    cx="48" cy="48" r="40" fill="none"
                    stroke="hsl(var(--primary))" strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 40}`}
                    strokeDashoffset={`${2 * Math.PI * 40 * (1 - progressPct / 100)}`}
                    style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1)' }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xl font-bold text-foreground">{progressPct}%</span>
                  <span className="text-[10px] text-muted-foreground">Done</span>
                </div>
              </div>

              {/* Stats */}
              <div className="flex flex-col gap-2">
                <div className="text-center">
                  <p className="text-2xl font-bold text-foreground">{completedSteps}/{steps.length}</p>
                  <p className="text-xs text-muted-foreground">{language === 'ar' ? 'خطوات مكتملة' : 'Steps done'}</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">{totalPoints}</p>
                  <p className="text-xs text-muted-foreground">{language === 'ar' ? 'نقطة من' : 'pts of'} {maxPoints}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-6">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                {language === 'ar' ? 'تقدم الإعداد' : 'Setup Progress'}
              </span>
              <span className="text-xs font-semibold text-primary">{progressPct}%</span>
            </div>
            <div className="h-2 bg-border rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-700"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Content ────────────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── Left: Checklist + Tabs ─────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-6">

            {/* Tab bar */}
            <div className="flex gap-1 bg-muted rounded-xl p-1">
              {(['checklist', 'tips', 'resources'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveSection(tab)}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                    activeSection === tab
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab === 'checklist'
                    ? (language === 'ar' ? 'قائمة المهام' : 'Checklist')
                    : tab === 'tips'
                    ? (language === 'ar' ? 'نصائح' : 'Tips')
                    : (language === 'ar' ? 'موارد' : 'Resources')}
                </button>
              ))}
            </div>

            {/* ── Checklist Tab ──────────────────────────────────────────── */}
            {activeSection === 'checklist' && (
              <div className="space-y-3">
                {steps.map((step, idx) => (
                  <div
                    key={step.id}
                    className={`group relative rounded-xl border p-4 transition-all duration-200 ${
                      step.completed
                        ? 'bg-emerald-50/50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800' :'bg-card border-border hover:border-primary/40 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      {/* Step number / check */}
                      <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-colors ${
                        step.completed
                          ? 'bg-emerald-500 text-white' :'bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary'
                      }`}>
                        {step.completed
                          ? <Icon name="CheckIcon" size={18} />
                          : <span>{idx + 1}</span>
                        }
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className={`text-sm font-semibold ${step.completed ? 'text-emerald-700 dark:text-emerald-400 line-through opacity-70' : 'text-foreground'}`}>
                            {step.titleKey}
                          </h3>
                          {step.required && !step.completed && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 border border-red-200">
                              {language === 'ar' ? 'مطلوب' : 'Required'}
                            </span>
                          )}
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary ml-auto">
                            +{step.points} pts
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{step.descKey}</p>
                      </div>

                      {/* Action */}
                      <div className="shrink-0">
                        {step.completed ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                            <Icon name="CheckCircleIcon" size={16} />
                            {language === 'ar' ? 'مكتمل' : 'Done'}
                          </span>
                        ) : (
                          <Link
                            href={step.href}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:opacity-90 transition-opacity"
                          >
                            <Icon name={step.icon as any} size={13} />
                            {language === 'ar' ? 'ابدأ' : 'Start'}
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Completion banner */}
                {progressPct === 100 && (
                  <div className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 p-5 text-white text-center">
                    <Icon name="TrophyIcon" size={32} className="mx-auto mb-2" />
                    <h3 className="font-bold text-lg">
                      {language === 'ar' ? '🎉 تهانينا! حسابك مكتمل' : '🎉 Congratulations! Your account is fully set up'}
                    </h3>
                    <p className="text-sm opacity-90 mt-1">
                      {language === 'ar' ?'أنت الآن بائع موثق على DirectHub. ابدأ في استقبال الطلبات!' : "You're now a verified seller on DirectHub. Start receiving orders!"}
                    </p>
                    <Link
                      href="/supplier-dashboard"
                      className="inline-flex items-center gap-2 mt-3 px-4 py-2 bg-white text-emerald-700 text-sm font-bold rounded-lg hover:bg-emerald-50 transition-colors"
                    >
                      <Icon name="ChartBarIcon" size={15} />
                      {language === 'ar' ? 'لوحة البائع' : 'Go to Seller Dashboard'}
                    </Link>
                  </div>
                )}
              </div>
            )}

            {/* ── Tips Tab ───────────────────────────────────────────────── */}
            {activeSection === 'tips' && (
              <div className="space-y-3">
                <TipCard
                  icon="PhotoIcon"
                  title={language === 'ar' ? 'أضف صور عالية الجودة' : 'Add High-Quality Photos'}
                  desc={language === 'ar' ?'المنتجات التي تحتوي على 3+ صور تحصل على 4x مشاهدات أكثر من المنتجات بدون صور.' :'Products with 3+ photos get 4x more views. Use clear, well-lit images on a neutral background.'}
                  color="bg-blue-50 border-blue-200 text-blue-700"
                />
                <TipCard
                  icon="LanguageIcon"
                  title={language === 'ar' ? 'أضف أسماء بلغات متعددة' : 'Use Multilingual Product Names'}
                  desc={language === 'ar' ?'أضف اسم المنتج بالعربية والإنجليزية والصينية للوصول إلى أكبر عدد من المشترين.' :'Add product names in Arabic, English, and Chinese to reach the widest buyer audience on DirectHub.'}
                  color="bg-purple-50 border-purple-200 text-purple-700"
                />
                <TipCard
                  icon="CurrencyDollarIcon"
                  title={language === 'ar' ? 'حدد نطاق سعري واضح' : 'Set Clear Pricing Ranges'}
                  desc={language === 'ar' ?'المنتجات ذات الأسعار الواضحة تحصل على ردود أسرع من المشترين وتقليل الاستفسارات غير الجادة.' :'Products with transparent pricing ranges get faster buyer responses and fewer low-quality inquiries.'}
                  color="bg-amber-50 border-amber-200 text-amber-700"
                />
                <TipCard
                  icon="ClipboardDocumentCheckIcon"
                  title={language === 'ar' ? 'رد على طلبات العروض بسرعة' : 'Respond to RFQs Quickly'}
                  desc={language === 'ar' ?'البائعون الذين يردون خلال ساعة يحصلون على معدل إغلاق أعلى بنسبة 60%.' :'Sellers who respond within 1 hour have a 60% higher close rate. Enable notifications to never miss an RFQ.'}
                  color="bg-emerald-50 border-emerald-200 text-emerald-700"
                />
                <TipCard
                  icon="StarIcon"
                  title={language === 'ar' ? 'اطلب تقييمات من المشترين' : 'Request Buyer Reviews'}
                  desc={language === 'ar' ?'التقييمات الإيجابية ترفع ترتيبك في نتائج البحث وتزيد ثقة المشترين الجدد.' :'Positive reviews boost your search ranking and increase trust with new buyers. Ask satisfied buyers to leave a review.'}
                  color="bg-rose-50 border-rose-200 text-rose-700"
                />
              </div>
            )}

            {/* ── Resources Tab ──────────────────────────────────────────── */}
            {activeSection === 'resources' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { icon: 'BuildingStorefrontIcon', title: language === 'ar' ? 'لوحة البائع' : 'Seller Dashboard', desc: language === 'ar' ? 'إدارة المنتجات والطلبات' : 'Manage products & orders', href: '/supplier-dashboard', color: 'text-blue-600' },
                  { icon: 'CubeIcon', title: language === 'ar' ? 'إدارة المنتجات' : 'Product Management', desc: language === 'ar' ? 'إضافة وتعديل المنتجات' : 'Add & edit your listings', href: '/product-management', color: 'text-purple-600' },
                  { icon: 'ClipboardDocumentListIcon', title: language === 'ar' ? 'لوحة طلبات العروض' : 'RFQ Board', desc: language === 'ar' ? 'تصفح طلبات المشترين' : 'Browse buyer requests', href: '/rfq-board', color: 'text-amber-600' },
                  { icon: 'ShieldCheckIcon', title: language === 'ar' ? 'التحقق من الهوية' : 'KYC Verification', desc: language === 'ar' ? 'رفع وثائق التحقق' : 'Submit verification docs', href: '/kyc', color: 'text-emerald-600' },
                  { icon: 'ChatBubbleLeftRightIcon', title: language === 'ar' ? 'المراسلات' : 'Messaging', desc: language === 'ar' ? 'تواصل مع المشترين' : 'Chat with buyers', href: '/messaging', color: 'text-rose-600' },
                  { icon: 'ChartBarIcon', title: language === 'ar' ? 'التحليلات' : 'Analytics', desc: language === 'ar' ? 'تتبع أداء متجرك' : 'Track your store performance', href: '/analytics', color: 'text-indigo-600' },
                  { icon: 'DocumentTextIcon', title: language === 'ar' ? 'الفواتير' : 'Invoices', desc: language === 'ar' ? 'إدارة الفواتير والمدفوعات' : 'Manage invoices & payments', href: '/invoices', color: 'text-teal-600' },
                  { icon: 'ScaleIcon', title: language === 'ar' ? 'النزاعات' : 'Disputes', desc: language === 'ar' ? 'حل النزاعات مع المشترين' : 'Resolve buyer disputes', href: '/disputes', color: 'text-orange-600' },
                ].map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-start gap-3 p-4 rounded-xl border border-border bg-card hover:border-primary/40 hover:shadow-sm transition-all group"
                  >
                    <div className={`w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors ${item.color}`}>
                      <Icon name={item.icon as any} size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{item.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                    </div>
                    <Icon name="ChevronRightIcon" size={14} className="ml-auto mt-1 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* ── Right: Sidebar ─────────────────────────────────────────────── */}
          <div className="space-y-4">

            {/* Seller Profile Card */}
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg shrink-0">
                  {(profile?.full_name || user?.email || 'S').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-foreground truncate">
                    {profile?.full_name || user?.email?.split('@')[0] || '—'}
                  </p>
                  <p className="text-xs text-muted-foreground capitalize">{profile?.role || 'seller'}</p>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                {[
                  { label: language === 'ar' ? 'الشركة' : 'Company', value: profile?.company_name },
                  { label: language === 'ar' ? 'الدولة' : 'Country', value: profile?.country },
                  { label: language === 'ar' ? 'المدينة' : 'City', value: profile?.city },
                  { label: language === 'ar' ? 'الهاتف' : 'Phone', value: profile?.phone },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">{label}</span>
                    <span className={`font-medium truncate max-w-[120px] ${value ? 'text-foreground' : 'text-muted-foreground italic'}`}>
                      {value || (language === 'ar' ? 'غير محدد' : 'Not set')}
                    </span>
                  </div>
                ))}
              </div>

              <Link
                href="/my-account/edit-profile"
                className="mt-4 w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                <Icon name="PencilSquareIcon" size={14} />
                {language === 'ar' ? 'تعديل الملف الشخصي' : 'Edit Profile'}
              </Link>
            </div>

            {/* Stats Bento */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: language === 'ar' ? 'المنتجات' : 'Products', value: productCount, icon: 'CubeIcon', color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/30' },
                { label: language === 'ar' ? 'الطلبات' : 'Orders', value: orderCount, icon: 'TruckIcon', color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
                { label: language === 'ar' ? 'طلبات العروض' : 'RFQs', value: rfqCount, icon: 'ClipboardDocumentListIcon', color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/30' },
                { label: language === 'ar' ? 'نقاط الثقة' : 'Trust Score', value: profile?.trust_score ?? 0, icon: 'ShieldCheckIcon', color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-950/30' },
              ].map(({ label, value, icon, color, bg }) => (
                <div key={label} className={`rounded-xl border border-border p-3 ${bg}`}>
                  <div className={`w-8 h-8 rounded-lg bg-white/70 dark:bg-black/20 flex items-center justify-center mb-2 ${color}`}>
                    <Icon name={icon as any} size={16} />
                  </div>
                  <p className="text-xl font-bold text-foreground">{value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>

            {/* KYC Status */}
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Icon name="ShieldCheckIcon" size={15} className="text-primary" />
                {language === 'ar' ? 'حالة التحقق' : 'Verification Status'}
              </h3>
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${
                profile?.kyc_status === 'approved' ?'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : profile?.kyc_status === 'pending' ?'bg-amber-50 text-amber-700 border border-amber-200' :'bg-muted text-muted-foreground border border-border'
              }`}>
                <Icon
                  name={profile?.kyc_status === 'approved' ? 'CheckCircleIcon' : profile?.kyc_status === 'pending' ? 'ClockIcon' : 'ExclamationCircleIcon'}
                  size={15}
                />
                {profile?.kyc_status === 'approved'
                  ? (language === 'ar' ? 'موثق ✓' : 'Verified ✓')
                  : profile?.kyc_status === 'pending'
                  ? (language === 'ar' ? 'قيد المراجعة' : 'Under Review')
                  : (language === 'ar' ? 'غير موثق' : 'Not Verified')}
              </div>
              {profile?.kyc_status !== 'approved' && (
                <Link
                  href="/kyc"
                  className="mt-3 w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
                >
                  <Icon name="ArrowUpTrayIcon" size={14} />
                  {language === 'ar' ? 'رفع الوثائق' : 'Submit Documents'}
                </Link>
              )}
            </div>

            {/* Quick actions */}
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">
                {language === 'ar' ? 'إجراءات سريعة' : 'Quick Actions'}
              </h3>
              <div className="space-y-2">
                {[
                  { href: '/product-management', icon: 'PlusCircleIcon', label: language === 'ar' ? 'إضافة منتج' : 'Add Product' },
                  { href: '/rfq-board', icon: 'ClipboardDocumentListIcon', label: language === 'ar' ? 'تصفح طلبات العروض' : 'Browse RFQs' },
                  { href: '/supplier-dashboard', icon: 'ChartBarIcon', label: language === 'ar' ? 'لوحة البائع' : 'Seller Dashboard' },
                  { href: '/messaging', icon: 'ChatBubbleLeftRightIcon', label: language === 'ar' ? 'المراسلات' : 'Messages' },
                ].map(({ href, icon, label }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-foreground hover:bg-muted transition-colors"
                  >
                    <Icon name={icon as any} size={15} className="text-primary shrink-0" />
                    {label}
                    <Icon name="ChevronRightIcon" size={12} className="ml-auto text-muted-foreground" />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
