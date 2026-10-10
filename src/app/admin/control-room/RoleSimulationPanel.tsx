'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';

interface RoleCard {
  id: string;
  label: string;
  labelAr: string;
  description: string;
  descriptionAr: string;
  icon: string;
  gradient: string;
  badgeColor: string;
  email: string;
  password: string;
  dashboardPath: string;
  category: 'seller' | 'buyer' | 'logistics' | 'agent' | 'admin';
  sandboxKey: string;
  dbVerified?: boolean;
}

const ROLES: RoleCard[] = [
  {
    id: 'local_factory',
    label: 'Yemen Local Factory',
    labelAr: 'المصنع المحلي اليمني',
    description: 'Local manufacturer — B2B & B2C hybrid orders, escrow, product catalog',
    descriptionAr: 'مصنع محلي — طلبات B2B وB2C، ضمان مالي، كتالوج منتجات',
    icon: 'BuildingOffice2Icon',
    gradient: 'from-blue-700 to-blue-900',
    badgeColor: 'bg-blue-600',
    email: 'sandbox.factory@directhub.net',
    password: 'SandboxFactory2026!',
    dashboardPath: '/manufacturer/dashboard',
    category: 'seller',
    sandboxKey: 'factory',
  },
  {
    id: 'intl_factory',
    label: 'International Factory',
    labelAr: 'المصنع الدولي',
    description: 'International manufacturer — RFQ, tiered pricing, direct checkout & escrow',
    descriptionAr: 'مصنع دولي — طلبات عروض أسعار، تسعير متدرج، دفع مباشر وضمان',
    icon: 'GlobeAltIcon',
    gradient: 'from-violet-700 to-purple-900',
    badgeColor: 'bg-violet-600',
    email: 'sandbox.intlfactory@directhub.net',
    password: 'SandboxIntlFactory2026!',
    dashboardPath: '/manufacturer/international-dashboard',
    category: 'seller',
    sandboxKey: 'international_factory',
  },
  {
    id: 'local_supplier',
    label: 'Local Supplier',
    labelAr: 'المورد المحلي',
    description: 'Local supplier — B2C retail, storefront, product management',
    descriptionAr: 'مورد محلي — بيع مفرد، واجهة متجر، إدارة المنتجات',
    icon: 'BuildingStorefrontIcon',
    gradient: 'from-emerald-700 to-teal-900',
    badgeColor: 'bg-emerald-600',
    email: 'sandbox.supplier@directhub.net',
    password: 'SandboxSupplier2026!',
    dashboardPath: '/supplier/local-dashboard',
    category: 'seller',
    sandboxKey: 'supplier',
  },
  {
    id: 'field_agent',
    label: 'Field Agent',
    labelAr: 'المندوب الميداني',
    description: 'Field representative — factory onboarding, commission tracking, document upload',
    descriptionAr: 'مندوب ميداني — تسجيل مصانع، تتبع العمولات، رفع الوثائق',
    icon: 'UserGroupIcon',
    gradient: 'from-amber-600 to-orange-800',
    badgeColor: 'bg-amber-600',
    email: 'sandbox.agent@directhub.net',
    password: 'SandboxAgent2026!',
    dashboardPath: '/agent/dashboard',
    category: 'agent',
    sandboxKey: 'agent',
  },
  {
    id: 'logistics',
    label: 'Logistics Partner',
    labelAr: 'شريك اللوجستيات',
    description: 'Shipping & logistics partner — shipment tracking, delivery confirmation, customs',
    descriptionAr: 'شريك شحن ولوجستيات — تتبع الشحنات، تأكيد التسليم، الجمارك',
    icon: 'TruckIcon',
    gradient: 'from-cyan-700 to-sky-900',
    badgeColor: 'bg-cyan-600',
    email: 'sandbox.logistics@directhub.net',
    password: 'SandboxLogistics2026!',
    dashboardPath: '/logistics/dashboard',
    category: 'logistics',
    sandboxKey: 'logistics',
  },
  {
    id: 'b2b_buyer',
    label: 'B2B Buyer',
    labelAr: 'مشتري الجملة B2B',
    description: 'Business buyer — RFQ, bulk orders, escrow, invoicing, CFO approval',
    descriptionAr: 'مشتري تجاري — طلبات عروض أسعار، طلبات جملة، ضمان مالي، فواتير',
    icon: 'BriefcaseIcon',
    gradient: 'from-indigo-700 to-blue-900',
    badgeColor: 'bg-indigo-600',
    email: 'sandbox.buyer@directhub.net',
    password: 'SandboxBuyer2026!',
    dashboardPath: '/buyer-dashboard',
    category: 'buyer',
    sandboxKey: 'buyer',
  },
  {
    id: 'b2c_buyer',
    label: 'B2C Buyer',
    labelAr: 'مشتري المفرد B2C',
    description: 'Retail buyer — cart, checkout, order tracking, reviews',
    descriptionAr: 'مشتري مفرد — سلة تسوق، دفع، تتبع الطلبات، تقييمات',
    icon: 'ShoppingBagIcon',
    gradient: 'from-rose-600 to-pink-900',
    badgeColor: 'bg-rose-600',
    email: 'sandbox.buyer@directhub.net',
    password: 'SandboxBuyer2026!',
    dashboardPath: '/buyer-dashboard',
    category: 'buyer',
    sandboxKey: 'buyer',
  },
  {
    id: 'logistics_office',
    label: 'Logistics Office',
    labelAr: 'مكتب لوجستي',
    description: 'International shipping office — shipment management, customs clearance, delivery',
    descriptionAr: 'مكتب شحن دولي — إدارة الشحنات، التخليص الجمركي، التسليم',
    icon: 'BuildingOffice2Icon',
    gradient: 'from-cyan-600 to-sky-800',
    badgeColor: 'bg-cyan-600',
    email: 'sandbox.logisticsoffice@directhub.net',
    password: 'SandboxLogisticsOffice2026!',
    dashboardPath: '/logistics/dashboard',
    category: 'logistics',
    sandboxKey: 'logistics_office',
  },
  {
    id: 'commercial_supplier',
    label: 'Commercial Supplier',
    labelAr: 'مورد تجاري',
    description: 'Commercial supplier — wholesale selling, product management, invoicing',
    descriptionAr: 'مورد تجاري — بيع بالجملة، إدارة المنتجات، الفواتير',
    icon: 'BuildingStorefrontIcon',
    gradient: 'from-emerald-600 to-green-800',
    badgeColor: 'bg-emerald-600',
    email: 'sandbox.commercialsupplier@directhub.net',
    password: 'SandboxCommercialSupplier2026!',
    dashboardPath: '/supplier/local-dashboard',
    category: 'seller',
    sandboxKey: 'commercial_supplier',
  },
];

const CATEGORY_LABELS: Record<string, { label: string; labelAr: string; color: string }> = {
  seller: { label: 'Sellers & Manufacturers', labelAr: 'البائعون والمصنّعون', color: 'text-blue-700 bg-blue-50 border-blue-200' },
  buyer: { label: 'Buyers', labelAr: 'المشترون', color: 'text-indigo-700 bg-indigo-50 border-indigo-200' },
  agent: { label: 'Field Agents', labelAr: 'المندوبون الميدانيون', color: 'text-amber-700 bg-amber-50 border-amber-200' },
  logistics: { label: 'Logistics', labelAr: 'اللوجستيات', color: 'text-cyan-700 bg-cyan-50 border-cyan-200' },
};

export default function RoleSimulationPanel() {
  const router = useRouter();
  const supabase = createClient();
  const [loginLoading, setLoginLoading] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginSuccess, setLoginSuccess] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [dbRoles, setDbRoles] = useState<typeof ROLES | null>(null);

  useEffect(() => {
    const fetchSandboxAccounts = async () => {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, email, full_name, role, account_type, dashboard_path')
        .ilike('email', 'sandbox.%@directhub.net')
        .order('role');

      if (error || !data || data.length === 0) {
        setDbRoles(ROLES);
        return;
      }

      const dbDerivedRoles = data.map((profile: any) => {
        const staticMatch = ROLES.find((r) => r.email === profile.email);
        return {
          ...(staticMatch ?? {}),
          key: profile.role ?? profile.email,
          email: profile.email,
          dashboardPath: profile.dashboard_path ?? staticMatch?.dashboardPath ?? '/',
          dbVerified: true,
        };
      });

      setDbRoles(dbDerivedRoles as typeof ROLES);
    };

    fetchSandboxAccounts();
  }, []);

  const handleSandboxLogin = async (role: RoleCard) => {
    setLoginLoading(role.id);
    setLoginError(null);
    setLoginSuccess(null);
    try {
      const sandboxKeyMap: Record<string, string> = {
        local_factory: 'factory',
        intl_factory: 'international_factory',
        local_supplier: 'supplier',
        field_agent: 'agent',
        logistics: 'logistics',
        b2b_buyer: 'buyer',
        b2c_buyer: 'buyer',
        logistics_office: 'logistics_office',
        commercial_supplier: 'commercial_supplier',
      };
      const res = await fetch('/api/sandbox-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: sandboxKeyMap[role.id] || role.sandboxKey }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setLoginError(data.error || 'فشل تسجيل الدخول');
      } else {
        setLoginSuccess(role.id);
        setTimeout(() => {
          router.push(data.redirect ?? role.dashboardPath);
        }, 800);
      }
    } catch {
      setLoginError('خطأ في الاتصال بالخادم');
    } finally {
      setLoginLoading(null);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const activeRoles = dbRoles ?? ROLES;
  const categories = ['all', 'seller', 'buyer', 'agent', 'logistics'];
  const filteredRoles = selectedCategory === 'all' ? activeRoles : activeRoles.filter(r => r.category === selectedCategory);

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl border border-indigo-300/40 shadow-lg"
        style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' }}>
        <div className="absolute top-0 left-0 right-0 h-0.5"
          style={{ background: 'linear-gradient(90deg, transparent, #6366F1, #8B5CF6, #6366F1, transparent)' }} />
        <div className="px-6 py-5 flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-md shrink-0"
            style={{ background: 'linear-gradient(135deg, #6366F1, #4F46E5)' }}>
            <Icon name="UserGroupIcon" size={28} className="text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-white">محاكاة الأدوار — Role Simulation Hub</h2>
            <p className="text-sm text-white/60 mt-1">اختبر تجربة كل دور من أدوار المنصة التسعة بشكل مباشر</p>
          </div>
          <div className="shrink-0 text-right">
            <div className="flex items-center gap-1.5 justify-end mb-1">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-semibold text-white/80">9 أدوار نشطة</span>
            </div>
            <p className="text-[10px] text-white/40">بيئة اختبار آمنة</p>
          </div>
        </div>
      </div>

      {/* Error / Success Banner */}
      {loginError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3 text-red-700 text-sm">
          <Icon name="ExclamationCircleIcon" size={18} />
          <span>{loginError}</span>
          <button onClick={() => setLoginError(null)} className="mr-auto">
            <Icon name="XMarkIcon" size={16} />
          </button>
        </div>
      )}

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
        {categories.map(cat => {
          const info = cat === 'all' ? { label: 'الكل', labelAr: 'الكل', color: 'text-gray-700 bg-gray-100 border-gray-200' } : CATEGORY_LABELS[cat];
          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                selectedCategory === cat
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : `${info?.color || 'text-gray-600 bg-gray-50 border-gray-200'} hover:opacity-80`
              }`}
            >
              {cat === 'all' ? `الكل (${activeRoles.length})` : info?.labelAr || cat}
            </button>
          );
        })}
      </div>

      {/* Role Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredRoles.map(role => {
          const isLoading = loginLoading === role.id;
          const isSuccess = loginSuccess === role.id;
          const catInfo = CATEGORY_LABELS[role.category];

          return (
            <div
              key={role.id}
              className="relative overflow-hidden rounded-2xl border border-white/10 shadow-md"
              style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' }}
            >
              {/* Top gradient bar */}
              <div className={`h-1 w-full bg-gradient-to-r ${role.gradient}`} />

              <div className="p-5 space-y-4">
                {/* Role Header */}
                <div className="flex items-start gap-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-br ${role.gradient}`}>
                    <Icon name={role.icon as any} size={22} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-bold text-white">{role.labelAr}</h3>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full text-white ${role.badgeColor}`}>
                        {role.label}
                      </span>
                      {role.dbVerified && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          ✓ DB
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-white/50 mt-1 leading-relaxed">{role.descriptionAr}</p>
                  </div>
                  <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${catInfo?.color || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                    {catInfo?.labelAr || role.category}
                  </span>
                </div>

                {/* Credentials */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
                    <Icon name="EnvelopeIcon" size={13} className="text-white/40 shrink-0" />
                    <span className="text-xs text-white/70 flex-1 font-mono truncate">{role.email}</span>
                    <button
                      onClick={() => handleCopy(role.email, `${role.id}-email`)}
                      className="text-white/30 hover:text-white/70 transition-colors shrink-0"
                      title="نسخ"
                    >
                      <Icon name={copiedId === `${role.id}-email` ? 'CheckIcon' : 'ClipboardDocumentIcon'} size={13} />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
                    <Icon name="LockClosedIcon" size={13} className="text-white/40 shrink-0" />
                    <span className="text-xs text-white/70 flex-1 font-mono">{role.password}</span>
                    <button
                      onClick={() => handleCopy(role.password, `${role.id}-pass`)}
                      className="text-white/30 hover:text-white/70 transition-colors shrink-0"
                      title="نسخ"
                    >
                      <Icon name={copiedId === `${role.id}-pass` ? 'CheckIcon' : 'ClipboardDocumentIcon'} size={13} />
                    </button>
                  </div>
                </div>

                {/* Login Button */}
                <button
                  onClick={() => handleSandboxLogin(role)}
                  disabled={isLoading || !!loginLoading}
                  className={`w-full h-10 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                    isSuccess
                      ? 'bg-emerald-500 text-white'
                      : `bg-gradient-to-r ${role.gradient} text-white hover:opacity-90 disabled:opacity-50`
                  }`}
                >
                  {isLoading ? (
                    <>
                      <Icon name="ArrowPathIcon" size={15} className="animate-spin" />
                      جارٍ تسجيل الدخول...
                    </>
                  ) : isSuccess ? (
                    <>
                      <Icon name="CheckCircleIcon" size={15} />
                      تم — جارٍ التوجيه...
                    </>
                  ) : (
                    <>
                      <Icon name="ArrowRightOnRectangleIcon" size={15} />
                      تسجيل الدخول كـ {role.labelAr}
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Info Footer */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
        <Icon name="InformationCircleIcon" size={18} className="text-amber-600 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-800 space-y-1">
          <p className="font-semibold">ملاحظة حول بيئة المحاكاة</p>
          <p>جميع الحسابات المذكورة هي حسابات اختبار sandbox. أي طلبات أو معاملات تُجرى عبر هذه الحسابات هي لأغراض الاختبار فقط ولا تؤثر على البيانات الحقيقية.</p>
        </div>
      </div>
    </div>
  );
}
