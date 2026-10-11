'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';

interface PageEntry {
  path: string;
  label: string;
  labelAr: string;
  category: string;
  icon: string;
  access: 'public' | 'auth' | 'admin' | 'role';
  role?: string;
}

const ALL_PAGES: PageEntry[] = [
  // عام
  { path: '/', label: 'Home', labelAr: 'الرئيسية', category: 'عام', icon: 'HomeIcon', access: 'public' },
  { path: '/categories', label: 'Categories', labelAr: 'الفئات', category: 'عام', icon: 'Squares2X2Icon', access: 'public' },
  { path: '/search', label: 'Search', labelAr: 'البحث', category: 'عام', icon: 'MagnifyingGlassIcon', access: 'public' },
  { path: '/suppliers', label: 'Suppliers', labelAr: 'الموردون', category: 'عام', icon: 'BuildingStorefrontIcon', access: 'public' },
  { path: '/rfq-board', label: 'RFQ Board', labelAr: 'لوحة طلبات الأسعار', category: 'عام', icon: 'ClipboardDocumentListIcon', access: 'public' },
  { path: '/about', label: 'About', labelAr: 'عن المنصة', category: 'عام', icon: 'InformationCircleIcon', access: 'public' },
  { path: '/ai-features', label: 'AI Features', labelAr: 'ميزات الذكاء الاصطناعي', category: 'عام', icon: 'SparklesIcon', access: 'public' },
  { path: '/logistics', label: 'Logistics', labelAr: 'اللوجستيات', category: 'عام', icon: 'TruckIcon', access: 'public' },
  // المصادقة
  { path: '/login', label: 'Login', labelAr: 'تسجيل الدخول', category: 'المصادقة', icon: 'ArrowRightOnRectangleIcon', access: 'public' },
  { path: '/auth/role-selection', label: 'Role Selection', labelAr: 'اختيار الدور', category: 'المصادقة', icon: 'UserGroupIcon', access: 'public' },
  { path: '/auth/reset-password', label: 'Reset Password', labelAr: 'إعادة تعيين كلمة المرور', category: 'المصادقة', icon: 'KeyIcon', access: 'public' },
  { path: '/auth/social-login', label: 'Social Login', labelAr: 'تسجيل الدخول الاجتماعي', category: 'المصادقة', icon: 'GlobeAltIcon', access: 'public' },
  // المشتري
  { path: '/cart', label: 'Cart', labelAr: 'سلة التسوق', category: 'المشتري', icon: 'ShoppingCartIcon', access: 'auth' },
  { path: '/checkout', label: 'Checkout', labelAr: 'الدفع', category: 'المشتري', icon: 'CreditCardIcon', access: 'auth' },
  { path: '/orders', label: 'Orders', labelAr: 'الطلبات', category: 'المشتري', icon: 'TruckIcon', access: 'auth' },
  { path: '/wishlist', label: 'Wishlist', labelAr: 'قائمة الرغبات', category: 'المشتري', icon: 'HeartIcon', access: 'auth' },
  { path: '/buyer-dashboard', label: 'Buyer Dashboard', labelAr: 'لوحة المشتري', category: 'المشتري', icon: 'HomeModernIcon', access: 'auth' },
  { path: '/order-tracking', label: 'Order Tracking', labelAr: 'تتبع الطلبات', category: 'المشتري', icon: 'MapPinIcon', access: 'auth' },
  { path: '/order-status', label: 'Order Status', labelAr: 'حالة الطلب', category: 'المشتري', icon: 'CheckCircleIcon', access: 'auth' },
  { path: '/invoices', label: 'Invoices', labelAr: 'الفواتير', category: 'المشتري', icon: 'DocumentTextIcon', access: 'auth' },
  { path: '/rfq/create', label: 'Create RFQ', labelAr: 'إنشاء طلب سعر', category: 'المشتري', icon: 'PlusCircleIcon', access: 'auth' },
  { path: '/rfq-management', label: 'RFQ Management', labelAr: 'إدارة طلبات الأسعار', category: 'المشتري', icon: 'ClipboardDocumentListIcon', access: 'auth' },
  // البائع
  { path: '/my-account', label: 'My Account', labelAr: 'حسابي', category: 'البائع', icon: 'UserCircleIcon', access: 'auth' },
  { path: '/my-account/edit-profile', label: 'Edit Profile', labelAr: 'تعديل الملف الشخصي', category: 'البائع', icon: 'PencilSquareIcon', access: 'auth' },
  { path: '/my-account/add-product', label: 'Add Product', labelAr: 'إضافة منتج', category: 'البائع', icon: 'PlusCircleIcon', access: 'auth' },
  { path: '/seller/products', label: 'Seller Products', labelAr: 'منتجات البائع', category: 'البائع', icon: 'CubeIcon', access: 'auth' },
  { path: '/analytics', label: 'Analytics', labelAr: 'التحليلات', category: 'البائع', icon: 'ChartBarIcon', access: 'auth' },
  { path: '/financial-accounts', label: 'Financial Accounts', labelAr: 'الحسابات المالية', category: 'البائع', icon: 'BanknotesIcon', access: 'auth' },
  // المصنع
  { path: '/factory/register', label: 'Factory Register', labelAr: 'تسجيل المصنع', category: 'المصنع', icon: 'BuildingOffice2Icon', access: 'public' },
  { path: '/factory/products', label: 'Factory Products', labelAr: 'منتجات المصنع', category: 'المصنع', icon: 'CubeIcon', access: 'auth' },
  { path: '/factory/upload', label: 'Factory Upload', labelAr: 'رفع ملفات المصنع', category: 'المصنع', icon: 'ArrowUpTrayIcon', access: 'auth' },
  { path: '/manufacturer/login', label: 'Manufacturer Login', labelAr: 'دخول المصنّع', category: 'المصنع', icon: 'ArrowRightOnRectangleIcon', access: 'public' },
  { path: '/manufacturer/dashboard', label: 'Manufacturer Dashboard', labelAr: 'لوحة المصنّع', category: 'المصنع', icon: 'HomeModernIcon', access: 'auth' },
  { path: '/manufacturer/erp', label: 'Manufacturer ERP', labelAr: 'نظام ERP', category: 'المصنع', icon: 'CpuChipIcon', access: 'auth' },
  // الوكيل
  { path: '/agent/login', label: 'Agent Login', labelAr: 'دخول الوكيل', category: 'الوكيل', icon: 'ArrowRightOnRectangleIcon', access: 'public' },
  { path: '/agent/dashboard', label: 'Agent Dashboard', labelAr: 'لوحة الوكيل', category: 'الوكيل', icon: 'UserGroupIcon', access: 'auth' },
  { path: '/agent/register-factory', label: 'Register Factory', labelAr: 'تسجيل مصنع', category: 'الوكيل', icon: 'BuildingOffice2Icon', access: 'auth' },
  { path: '/agent/upload-license', label: 'Upload License', labelAr: 'رفع الرخصة', category: 'الوكيل', icon: 'DocumentArrowUpIcon', access: 'auth' },
  { path: '/agent/add-product', label: 'Add Product', labelAr: 'إضافة منتج', category: 'الوكيل', icon: 'PlusCircleIcon', access: 'auth' },
  // اللوجستيات
  { path: '/logistics/register', label: 'Logistics Register', labelAr: 'تسجيل شريك لوجستي', category: 'اللوجستيات', icon: 'TruckIcon', access: 'public' },
  { path: '/logistics/dashboard', label: 'Logistics Dashboard', labelAr: 'لوحة اللوجستيات', category: 'اللوجستيات', icon: 'ChartBarIcon', access: 'auth' },
  // التواصل
  { path: '/messaging', label: 'Messaging', labelAr: 'المراسلة', category: 'التواصل', icon: 'ChatBubbleLeftRightIcon', access: 'auth' },
  { path: '/chat', label: 'Chat', labelAr: 'المحادثة', category: 'التواصل', icon: 'ChatBubbleOvalLeftIcon', access: 'auth' },
  { path: '/notifications', label: 'Notifications', labelAr: 'الإشعارات', category: 'التواصل', icon: 'BellIcon', access: 'auth' },
  // الإدارة
  { path: '/admin/control-room', label: 'Admin Control Room', labelAr: 'غرفة التحكم', category: 'الإدارة', icon: 'ShieldCheckIcon', access: 'admin' },
  { path: '/simulation', label: 'Simulation', labelAr: 'المحاكاة', category: 'الإدارة', icon: 'BeakerIcon', access: 'admin' },
  // أخرى
  { path: '/disputes', label: 'Disputes', labelAr: 'النزاعات', category: 'أخرى', icon: 'ScaleIcon', access: 'auth' },
  { path: '/kyc', label: 'KYC', labelAr: 'التحقق من الهوية', category: 'أخرى', icon: 'ShieldCheckIcon', access: 'auth' },
  { path: '/order-fulfillment', label: 'Order Fulfillment', labelAr: 'تنفيذ الطلبات', category: 'أخرى', icon: 'ClipboardDocumentListIcon', access: 'auth' },
  { path: '/account/upgrade', label: 'Account Upgrade', labelAr: 'ترقية الحساب', category: 'أخرى', icon: 'ArrowUpCircleIcon', access: 'auth' },
];

const CATEGORIES = ['الكل', 'عام', 'المصادقة', 'المشتري', 'البائع', 'المصنع', 'الوكيل', 'اللوجستيات', 'التواصل', 'الإدارة', 'أخرى'];

const ACCESS_COLORS: Record<string, string> = {
  public: 'bg-emerald-100 text-emerald-700',
  auth: 'bg-blue-100 text-blue-700',
  admin: 'bg-red-100 text-red-700',
  role: 'bg-amber-100 text-amber-700',
};

const ACCESS_LABELS: Record<string, string> = {
  public: 'عام',
  auth: 'مسجّل',
  admin: 'مشرف',
  role: 'دور محدد',
};

interface UnifiedPageDirectoryProps {
  isRTL?: boolean;
}

const UnifiedPageDirectory: React.FC<UnifiedPageDirectoryProps> = ({ isRTL = true }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('الكل');
  const modalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = ALL_PAGES.filter((p) => {
    const matchCat = activeCategory === 'الكل' || p.category === activeCategory;
    const q = query.toLowerCase();
    const matchQ =
      !q ||
      p.labelAr.includes(q) ||
      p.label.toLowerCase().includes(q) ||
      p.path.toLowerCase().includes(q) ||
      p.category.includes(q);
    return matchCat && matchQ;
  });

  const handleOpen = useCallback(() => {
    setOpen(true);
    setQuery('');
    setActiveCategory('الكل');
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
    setQuery('');
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        handleClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, handleClose]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, handleClose]);

  // Focus input when modal opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [open]);

  return (
    <>
      {/* ── Trigger Button ── */}
      <button
        type="button"
        onClick={handleOpen}
        className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-border bg-muted/60 hover:bg-primary/10 hover:border-primary/40 hover:text-primary text-muted-foreground transition-all duration-150 shrink-0"
        title="دليل الصفحات الموحد"
        aria-label="دليل الصفحات الموحد"
      >
        <Icon name="MapIcon" size={14} />
        <span>دليل الصفحات</span>
      </button>

      {/* ── Modal Overlay ── */}
      {open && (
        <div
          className="fixed inset-0 z-[9999] flex items-start justify-center pt-16 px-4"
          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
          aria-modal="true"
          role="dialog"
          aria-label="دليل الصفحات الموحد"
        >
          <div
            ref={modalRef}
            className="w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            style={{ maxHeight: '80vh' }}
            dir={isRTL ? 'rtl' : 'ltr'}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-gradient-to-r from-primary/10 to-transparent">
              <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                <Icon name="MapIcon" size={18} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-sm font-bold text-foreground">دليل الصفحات الموحد</h2>
                <p className="text-xs text-muted-foreground">{ALL_PAGES.length} صفحة متاحة على المنصة</p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                aria-label="إغلاق"
              >
                <Icon name="XMarkIcon" size={18} />
              </button>
            </div>

            {/* Search */}
            <div className="px-5 py-3 border-b border-border">
              <div className="flex items-center gap-2 h-9 px-3 rounded-lg border border-border bg-muted/40 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/30 transition-colors">
                <Icon name="MagnifyingGlassIcon" size={15} className="text-muted-foreground shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="ابحث عن صفحة بالاسم أو المسار..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                  autoComplete="off"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="مسح البحث"
                  >
                    <Icon name="XMarkIcon" size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Category Tabs */}
            <div className="px-5 py-2 border-b border-border overflow-x-auto hide-scrollbar">
              <div className="flex items-center gap-1.5 min-w-max">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setActiveCategory(cat)}
                    className={`px-3 py-1 rounded-md text-xs font-semibold whitespace-nowrap transition-colors ${
                      activeCategory === cat
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto py-2">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Icon name="MagnifyingGlassIcon" size={32} className="mb-3 opacity-30" />
                  <p className="text-sm">لا توجد نتائج مطابقة</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 px-3">
                  {filtered.map((page) => (
                    <Link
                      key={page.path}
                      href={page.path}
                      onClick={handleClose}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted transition-colors group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                        <Icon name={page.icon as any} size={15} className="text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{page.labelAr}</p>
                        <p className="text-xs text-muted-foreground font-mono truncate">{page.path}</p>
                      </div>
                      <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${ACCESS_COLORS[page.access]}`}>
                        {ACCESS_LABELS[page.access]}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-border bg-muted/20 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {filtered.length} من {ALL_PAGES.length} صفحة
              </span>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                  عام
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                  مسجّل
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                  مشرف
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default UnifiedPageDirectory;
