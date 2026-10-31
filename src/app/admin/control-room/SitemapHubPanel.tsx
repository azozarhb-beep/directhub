'use client';

import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';

interface PageEntry {
  path: string;
  label: string;
  labelAr: string;
  category: string;
  priority: number;
  changeFreq: string;
  access: 'public' | 'auth' | 'admin' | 'role';
  role?: string;
}

const BASE_URL = 'https://direct-hub.net';

const pages: PageEntry[] = [
  // Public Pages
  { path: '/', label: 'Home', labelAr: 'الرئيسية', category: 'عام', priority: 1.0, changeFreq: 'daily', access: 'public' },
  { path: '/categories', label: 'Categories', labelAr: 'الفئات', category: 'عام', priority: 0.9, changeFreq: 'weekly', access: 'public' },
  { path: '/search', label: 'Search', labelAr: 'البحث', category: 'عام', priority: 0.9, changeFreq: 'daily', access: 'public' },
  { path: '/suppliers', label: 'Suppliers', labelAr: 'الموردون', category: 'عام', priority: 0.8, changeFreq: 'weekly', access: 'public' },
  { path: '/rfq-board', label: 'RFQ Board', labelAr: 'لوحة طلبات الأسعار', category: 'عام', priority: 0.7, changeFreq: 'daily', access: 'public' },
  { path: '/about', label: 'About', labelAr: 'عن المنصة', category: 'عام', priority: 0.5, changeFreq: 'monthly', access: 'public' },
  // Auth Pages
  { path: '/login', label: 'Login', labelAr: 'تسجيل الدخول', category: 'المصادقة', priority: 0.4, changeFreq: 'monthly', access: 'public' },
  { path: '/auth/role-selection', label: 'Role Selection', labelAr: 'اختيار الدور', category: 'المصادقة', priority: 0.3, changeFreq: 'monthly', access: 'public' },
  { path: '/auth/reset-password', label: 'Reset Password', labelAr: 'إعادة تعيين كلمة المرور', category: 'المصادقة', priority: 0.2, changeFreq: 'monthly', access: 'public' },
  { path: '/auth/social-login', label: 'Social Login', labelAr: 'تسجيل الدخول الاجتماعي', category: 'المصادقة', priority: 0.2, changeFreq: 'monthly', access: 'public' },
  // Buyer Pages
  { path: '/cart', label: 'Cart', labelAr: 'سلة التسوق', category: 'المشتري', priority: 0.6, changeFreq: 'daily', access: 'auth', role: 'buyer' },
  { path: '/checkout', label: 'Checkout', labelAr: 'الدفع', category: 'المشتري', priority: 0.6, changeFreq: 'daily', access: 'auth', role: 'buyer' },
  { path: '/orders', label: 'Orders', labelAr: 'الطلبات', category: 'المشتري', priority: 0.7, changeFreq: 'daily', access: 'auth', role: 'buyer' },
  { path: '/wishlist', label: 'Wishlist', labelAr: 'قائمة الرغبات', category: 'المشتري', priority: 0.5, changeFreq: 'daily', access: 'auth', role: 'buyer' },
  { path: '/buyer-dashboard', label: 'Buyer Dashboard', labelAr: 'لوحة المشتري', category: 'المشتري', priority: 0.7, changeFreq: 'daily', access: 'auth', role: 'buyer' },
  { path: '/order-tracking', label: 'Order Tracking', labelAr: 'تتبع الطلبات', category: 'المشتري', priority: 0.6, changeFreq: 'daily', access: 'auth', role: 'buyer' },
  { path: '/order-status', label: 'Order Status', labelAr: 'حالة الطلب', category: 'المشتري', priority: 0.5, changeFreq: 'daily', access: 'auth', role: 'buyer' },
  { path: '/order-confirmation', label: 'Order Confirmation', labelAr: 'تأكيد الطلب', category: 'المشتري', priority: 0.4, changeFreq: 'daily', access: 'auth', role: 'buyer' },
  { path: '/invoices', label: 'Invoices', labelAr: 'الفواتير', category: 'المشتري', priority: 0.5, changeFreq: 'weekly', access: 'auth', role: 'buyer' },
  { path: '/rfq/create', label: 'Create RFQ', labelAr: 'إنشاء طلب سعر', category: 'المشتري', priority: 0.6, changeFreq: 'daily', access: 'auth', role: 'buyer' },
  { path: '/rfq-management', label: 'RFQ Management', labelAr: 'إدارة طلبات الأسعار', category: 'المشتري', priority: 0.6, changeFreq: 'daily', access: 'auth', role: 'buyer' },
  // Seller / My Account Pages
  { path: '/my-account', label: 'My Account', labelAr: 'حسابي', category: 'البائع', priority: 0.7, changeFreq: 'weekly', access: 'auth' },
  { path: '/my-account/edit-profile', label: 'Edit Profile', labelAr: 'تعديل الملف الشخصي', category: 'البائع', priority: 0.4, changeFreq: 'monthly', access: 'auth' },
  { path: '/my-account/add-product', label: 'Add Product', labelAr: 'إضافة منتج', category: 'البائع', priority: 0.5, changeFreq: 'monthly', access: 'auth' },
  { path: '/my-account/supplier-profile', label: 'Supplier Profile', labelAr: 'ملف المورد', category: 'البائع', priority: 0.5, changeFreq: 'monthly', access: 'auth' },
  { path: '/seller/products', label: 'Seller Products', labelAr: 'منتجات البائع', category: 'البائع', priority: 0.6, changeFreq: 'daily', access: 'auth', role: 'seller' },
  { path: '/analytics', label: 'Analytics', labelAr: 'التحليلات', category: 'البائع', priority: 0.5, changeFreq: 'daily', access: 'auth', role: 'seller' },
  { path: '/financial-accounts', label: 'Financial Accounts', labelAr: 'الحسابات المالية', category: 'البائع', priority: 0.5, changeFreq: 'weekly', access: 'auth', role: 'seller' },
  // Factory Pages
  { path: '/factory/register', label: 'Factory Register', labelAr: 'تسجيل المصنع', category: 'المصنع', priority: 0.5, changeFreq: 'monthly', access: 'public' },
  { path: '/factory/products', label: 'Factory Products', labelAr: 'منتجات المصنع', category: 'المصنع', priority: 0.6, changeFreq: 'daily', access: 'auth', role: 'factory' },
  { path: '/factory/upload', label: 'Factory Upload', labelAr: 'رفع ملفات المصنع', category: 'المصنع', priority: 0.4, changeFreq: 'monthly', access: 'auth', role: 'factory' },
  { path: '/manufacturer/login', label: 'Manufacturer Login', labelAr: 'دخول المصنّع', category: 'المصنع', priority: 0.3, changeFreq: 'monthly', access: 'public' },
  { path: '/manufacturer/dashboard', label: 'Manufacturer Dashboard', labelAr: 'لوحة المصنّع', category: 'المصنع', priority: 0.7, changeFreq: 'daily', access: 'auth', role: 'manufacturer' },
  { path: '/manufacturer/erp', label: 'Manufacturer ERP', labelAr: 'نظام ERP للمصنّع', category: 'المصنع', priority: 0.5, changeFreq: 'weekly', access: 'auth', role: 'manufacturer' },
  // Agent Pages
  { path: '/agent/login', label: 'Agent Login', labelAr: 'دخول الوكيل', category: 'الوكيل', priority: 0.3, changeFreq: 'monthly', access: 'public' },
  { path: '/agent/dashboard', label: 'Agent Dashboard', labelAr: 'لوحة الوكيل', category: 'الوكيل', priority: 0.7, changeFreq: 'daily', access: 'auth', role: 'agent' },
  { path: '/agent/register-factory', label: 'Agent Register Factory', labelAr: 'تسجيل مصنع بواسطة الوكيل', category: 'الوكيل', priority: 0.4, changeFreq: 'monthly', access: 'auth', role: 'agent' },
  { path: '/agent/upload-license', label: 'Agent Upload License', labelAr: 'رفع رخصة الوكيل', category: 'الوكيل', priority: 0.3, changeFreq: 'monthly', access: 'auth', role: 'agent' },
  { path: '/agent/add-product', label: 'Agent Add Product', labelAr: 'إضافة منتج بواسطة الوكيل', category: 'الوكيل', priority: 0.4, changeFreq: 'monthly', access: 'auth', role: 'agent' },
  // Logistics Pages
  { path: '/logistics', label: 'Logistics', labelAr: 'اللوجستيات', category: 'اللوجستيات', priority: 0.6, changeFreq: 'weekly', access: 'public' },
  { path: '/logistics/register', label: 'Logistics Register', labelAr: 'تسجيل شريك لوجستي', category: 'اللوجستيات', priority: 0.4, changeFreq: 'monthly', access: 'public' },
  { path: '/logistics/dashboard', label: 'Logistics Dashboard', labelAr: 'لوحة اللوجستيات', category: 'اللوجستيات', priority: 0.6, changeFreq: 'daily', access: 'auth', role: 'logistics' },
  // Admin Pages
  { path: '/admin/control-room', label: 'Admin Control Room', labelAr: 'غرفة التحكم الإدارية', category: 'الإدارة', priority: 0.1, changeFreq: 'monthly', access: 'admin' },
  { path: '/management', label: 'Management', labelAr: 'الإدارة', category: 'الإدارة', priority: 0.3, changeFreq: 'weekly', access: 'admin' },
  { path: '/operations', label: 'Operations', labelAr: 'العمليات', category: 'الإدارة', priority: 0.3, changeFreq: 'weekly', access: 'admin' },
  // Messaging & Communication
  { path: '/messaging', label: 'Messaging', labelAr: 'المراسلة', category: 'التواصل', priority: 0.6, changeFreq: 'daily', access: 'auth' },
  { path: '/chat', label: 'Chat', labelAr: 'المحادثة', category: 'التواصل', priority: 0.6, changeFreq: 'daily', access: 'auth' },
  { path: '/notifications', label: 'Notifications', labelAr: 'الإشعارات', category: 'التواصل', priority: 0.5, changeFreq: 'daily', access: 'auth' },
  // Other
  { path: '/disputes', label: 'Disputes', labelAr: 'النزاعات', category: 'أخرى', priority: 0.5, changeFreq: 'weekly', access: 'auth' },
  { path: '/kyc', label: 'KYC', labelAr: 'التحقق من الهوية', category: 'أخرى', priority: 0.4, changeFreq: 'monthly', access: 'auth' },
  { path: '/ai-features', label: 'AI Features', labelAr: 'ميزات الذكاء الاصطناعي', category: 'أخرى', priority: 0.5, changeFreq: 'weekly', access: 'public' },
  { path: '/account/upgrade', label: 'Account Upgrade', labelAr: 'ترقية الحساب', category: 'أخرى', priority: 0.4, changeFreq: 'monthly', access: 'auth' },
  { path: '/order-fulfillment', label: 'Order Fulfillment', labelAr: 'تنفيذ الطلبات', category: 'أخرى', priority: 0.5, changeFreq: 'daily', access: 'auth' },
  { path: '/legal/shipping-terms', label: 'Shipping Terms', labelAr: 'شروط الشحن', category: 'قانوني', priority: 0.3, changeFreq: 'monthly', access: 'public' },
  { path: '/legal/buyer-protection', label: 'Buyer Protection', labelAr: 'حماية المشتري', category: 'قانوني', priority: 0.3, changeFreq: 'monthly', access: 'public' },
];

const categories = Array.from(new Set(pages.map(p => p.category)));

const accessColors: Record<string, string> = {
  public: 'bg-emerald-900/40 text-emerald-300 border border-emerald-700/50',
  auth: 'bg-blue-900/40 text-blue-300 border border-blue-700/50',
  admin: 'bg-red-900/40 text-red-300 border border-red-700/50',
  role: 'bg-amber-900/40 text-amber-300 border border-amber-700/50',
};

const accessLabels: Record<string, string> = {
  public: 'عام',
  auth: 'مسجّل',
  admin: 'مشرف',
  role: 'دور محدد',
};

function priorityBar(priority: number) {
  const pct = Math.round(priority * 100);
  const color = priority >= 0.8 ? '#10B981' : priority >= 0.5 ? '#F59E0B' : '#6B7280';
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 rounded-full bg-[#30363d] overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs text-[#8b949e]">{priority.toFixed(1)}</span>
    </div>
  );
}

export default function SitemapHubPanel() {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('الكل');
  const [accessFilter, setAccessFilter] = useState<string>('الكل');
  const [copied, setCopied] = useState<string | null>(null);

  const allCategories = ['الكل', ...categories];
  const allAccess = ['الكل', 'public', 'auth', 'admin', 'role'];

  const filtered = pages.filter(p => {
    const matchSearch =
      search === '' ||
      p.path.toLowerCase().includes(search.toLowerCase()) ||
      p.labelAr.includes(search) ||
      p.label.toLowerCase().includes(search.toLowerCase());
    const matchCat = activeCategory === 'الكل' || p.category === activeCategory;
    const matchAccess = accessFilter === 'الكل' || p.access === accessFilter;
    return matchSearch && matchCat && matchAccess;
  });

  function copyUrl(path: string) {
    const url = `${BASE_URL}${path}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(path);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#E11D48,#BE123C)' }}>
            <Icon name="MapIcon" size={20} className="text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">دليل الصفحات</h2>
            <p className="text-xs text-[#8b949e]">Sitemap Hub — {pages.length} صفحة مسجّلة</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-[#8b949e]">
          <Icon name="GlobeAltIcon" size={14} />
          <span>{BASE_URL}</span>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'إجمالي الصفحات', value: pages.length, icon: 'DocumentTextIcon', color: '#3B82F6' },
          { label: 'صفحات عامة', value: pages.filter(p => p.access === 'public').length, icon: 'GlobeAltIcon', color: '#10B981' },
          { label: 'صفحات مصادقة', value: pages.filter(p => p.access === 'auth').length, icon: 'LockClosedIcon', color: '#F59E0B' },
          { label: 'صفحات إدارية', value: pages.filter(p => p.access === 'admin').length, icon: 'ShieldCheckIcon', color: '#EF4444' },
        ].map(stat => (
          <div key={stat.label} className="bg-[#161b22] border border-[#30363d] rounded-xl p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${stat.color}22` }}>
              <Icon name={stat.icon as any} size={18} style={{ color: stat.color }} />
            </div>
            <div>
              <div className="text-xl font-bold text-white">{stat.value}</div>
              <div className="text-xs text-[#8b949e]">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Icon name="MagnifyingGlassIcon" size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8b949e]" />
          <input
            type="text"
            placeholder="ابحث عن صفحة..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-[#161b22] border border-[#30363d] rounded-xl pr-9 pl-4 py-2.5 text-sm text-white placeholder-[#8b949e] focus:outline-none focus:border-[#58a6ff]"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {allCategories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                activeCategory === cat
                  ? 'bg-[#58a6ff] text-white'
                  : 'bg-[#161b22] border border-[#30363d] text-[#8b949e] hover:border-[#58a6ff]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {allAccess.map(acc => (
            <button
              key={acc}
              onClick={() => setAccessFilter(acc)}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                accessFilter === acc
                  ? 'bg-[#58a6ff] text-white'
                  : 'bg-[#161b22] border border-[#30363d] text-[#8b949e] hover:border-[#58a6ff]'
              }`}
            >
              {acc === 'الكل' ? 'الكل' : accessLabels[acc]}
            </button>
          ))}
        </div>
      </div>

      {/* Results count */}
      <div className="text-xs text-[#8b949e]">
        عرض <span className="text-white font-bold">{filtered.length}</span> من {pages.length} صفحة
      </div>

      {/* Pages Table */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto -mx-6 px-6 sm:mx-0 sm:px-0">
          <table className="w-full text-sm min-w-[500px]">
            <thead>
              <tr className="border-b border-[#30363d] bg-[#0d1117]">
                <th className="text-right px-4 py-3 text-xs font-semibold text-[#8b949e]">الصفحة</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-[#8b949e]">المسار</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-[#8b949e]">الفئة</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-[#8b949e]">الوصول</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-[#8b949e]">الأولوية</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-[#8b949e]">التحديث</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((page, idx) => (
                <tr
                  key={page.path}
                  className={`border-b border-[#21262d] hover:bg-[#1c2330] transition-colors ${idx % 2 === 0 ? '' : 'bg-[#0d1117]/30'}`}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-white">{page.labelAr}</div>
                    <div className="text-xs text-[#8b949e]">{page.label}</div>
                  </td>
                  <td className="px-4 py-3">
                    <code className="text-xs text-[#58a6ff] bg-[#0d1117] px-2 py-0.5 rounded">{page.path}</code>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-[#8b949e] bg-[#21262d] px-2 py-0.5 rounded-full">{page.category}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${accessColors[page.access]}`}>
                      {accessLabels[page.access]}
                      {page.role && <span className="opacity-70"> ({page.role})</span>}
                    </span>
                  </td>
                  <td className="px-4 py-3">{priorityBar(page.priority)}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-[#8b949e]">{page.changeFreq}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => copyUrl(page.path)}
                        title="نسخ الرابط"
                        className="p-1.5 rounded-lg bg-[#21262d] hover:bg-[#30363d] transition-colors"
                      >
                        <Icon
                          name={copied === page.path ? 'CheckIcon' : 'ClipboardDocumentIcon'}
                          size={14}
                          className={copied === page.path ? 'text-emerald-400' : 'text-[#8b949e]'}
                        />
                      </button>
                      <a
                        href={`${BASE_URL}${page.path}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="فتح الصفحة"
                        className="p-1.5 rounded-lg bg-[#21262d] hover:bg-[#30363d] transition-colors"
                      >
                        <Icon name="ArrowTopRightOnSquareIcon" size={14} className="text-[#8b949e]" />
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-[#8b949e]">
                    <Icon name="MagnifyingGlassIcon" size={32} className="mx-auto mb-2 opacity-40" />
                    <p>لا توجد نتائج مطابقة</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-[#8b949e]">
        <span className="font-semibold text-white">مفتاح الوصول:</span>
        {Object.entries(accessLabels).map(([key, label]) => (
          <span key={key} className={`px-2 py-0.5 rounded-full ${accessColors[key]}`}>{label}</span>
        ))}
      </div>
    </div>
  );
}
