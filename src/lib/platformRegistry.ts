/**
 * DirectHub Platform Registry
 * ─────────────────────────────────────────────────────────────────────────────
 * Single source of truth for ALL platform routes, API endpoints, and features.
 * The Simulation Hub and Diagnostics Panel derive their data from this registry.
 *
 * HOW TO ADD A NEW FEATURE:
 *   1. Add a new entry to PLATFORM_ROUTES, API_ROUTES, or SIMULATION_MODULES.
 *   2. That's it — simulation steps and diagnostic checks update automatically.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─── Route Categories ─────────────────────────────────────────────────────────

export type RouteCategory = 'core' | 'auth' | 'factory' | 'buyer' | 'agent' | 'admin' | 'legal' | 'feature';

export interface PlatformRoute {
  id: string;
  path: string;
  nameAr: string;
  nameEn: string;
  category: RouteCategory;
  description: string;
  roles?: ('buyer' | 'factory' | 'admin' | 'agent' | 'consumer' | 'public')[];
  icon?: string;
}

export interface ApiEndpoint {
  id: string;
  path: string;
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  nameAr: string;
  nameEn: string;
  description: string;
  module?: string;
}

// ─── All Platform Routes ──────────────────────────────────────────────────────
// Add new routes here — they auto-appear in diagnostics and simulation.

export const PLATFORM_ROUTES: PlatformRoute[] = [
  // ── Core Public Pages ──
  { id: 'home',               path: '/',                        nameAr: 'الصفحة الرئيسية',          nameEn: 'Homepage',              category: 'core',    roles: ['public'], icon: 'HomeIcon',              description: 'الصفحة الرئيسية للمنصة' },
  { id: 'categories',         path: '/categories',              nameAr: 'الفئات',                   nameEn: 'Categories',            category: 'core',    roles: ['public'], icon: 'Squares2X2Icon',        description: 'صفحة تصفح الفئات' },
  { id: 'suppliers',          path: '/suppliers',               nameAr: 'الموردون',                 nameEn: 'Suppliers',             category: 'core',    roles: ['public'], icon: 'BuildingStorefrontIcon', description: 'دليل الموردين والمصانع' },
  { id: 'search',             path: '/search',                  nameAr: 'البحث',                    nameEn: 'Search',                category: 'core',    roles: ['public'], icon: 'MagnifyingGlassIcon',   description: 'محرك البحث الذكي' },
  { id: 'about',              path: '/about',                   nameAr: 'عن المنصة',                nameEn: 'About',                 category: 'core',    roles: ['public'], icon: 'InformationCircleIcon', description: 'صفحة التعريف بالمنصة' },
  { id: 'rfq-board',          path: '/rfq-board',               nameAr: 'لوحة طلبات الأسعار',       nameEn: 'RFQ Board',             category: 'core',    roles: ['public'], icon: 'ClipboardDocumentListIcon', description: 'لوحة طلبات عروض الأسعار' },
  { id: 'logistics',          path: '/logistics',               nameAr: 'اللوجستيات',               nameEn: 'Logistics',             category: 'core',    roles: ['public'], icon: 'TruckIcon',             description: 'منصة شركاء الشحن' },
  { id: 'ai-features',        path: '/ai-features',             nameAr: 'ميزات الذكاء الاصطناعي',   nameEn: 'AI Features',           category: 'core',    roles: ['public'], icon: 'SparklesIcon',          description: 'مركز ميزات الذكاء الاصطناعي' },
  { id: 'simulation',         path: '/simulation',              nameAr: 'مركز المحاكاة',             nameEn: 'Simulation Hub',        category: 'core',    roles: ['public'], icon: 'BeakerIcon',            description: 'مركز المحاكاة الشاملة' },
  { id: 'analytics',          path: '/analytics',               nameAr: 'التحليلات',                nameEn: 'Analytics',             category: 'core',    roles: ['admin'],  icon: 'ChartBarIcon',          description: 'لوحة التحليلات والإحصاءات' },
  // ── Buyer / Consumer ──
  { id: 'cart',               path: '/cart',                    nameAr: 'سلة التسوق',               nameEn: 'Cart',                  category: 'buyer',   roles: ['buyer', 'consumer'], icon: 'ShoppingCartIcon',      description: 'سلة التسوق' },
  { id: 'checkout',           path: '/checkout',                nameAr: 'إتمام الشراء',             nameEn: 'Checkout',              category: 'buyer',   roles: ['buyer', 'consumer'], icon: 'CreditCardIcon',        description: 'صفحة إتمام الشراء' },
  { id: 'orders',             path: '/orders',                  nameAr: 'الطلبات',                  nameEn: 'Orders',                category: 'buyer',   roles: ['buyer', 'consumer'], icon: 'ArchiveBoxIcon',        description: 'قائمة الطلبات' },
  { id: 'order-tracking',     path: '/order-tracking',          nameAr: 'تتبع الطلبات',             nameEn: 'Order Tracking',        category: 'buyer',   roles: ['buyer', 'consumer'], icon: 'MapPinIcon',            description: 'نظام تتبع الطلبات' },
  { id: 'wishlist',           path: '/wishlist',                nameAr: 'قائمة الأمنيات',           nameEn: 'Wishlist',              category: 'buyer',   roles: ['buyer', 'consumer'], icon: 'HeartIcon',             description: 'قائمة المنتجات المفضلة' },
  { id: 'buyer-dashboard',    path: '/buyer-dashboard',         nameAr: 'لوحة المشتري',             nameEn: 'Buyer Dashboard',       category: 'buyer',   roles: ['buyer'],  icon: 'RectangleGroupIcon',    description: 'لوحة تحكم المشتري' },
  { id: 'rfq-management',     path: '/rfq-management',          nameAr: 'إدارة طلبات الأسعار',      nameEn: 'RFQ Management',        category: 'buyer',   roles: ['buyer'],  icon: 'DocumentTextIcon',      description: 'إدارة طلبات عروض الأسعار' },
  { id: 'messaging',          path: '/messaging',               nameAr: 'المراسلات',                nameEn: 'Messaging',             category: 'buyer',   roles: ['buyer', 'factory', 'manufacturer', 'admin', 'agent'], icon: 'ChatBubbleLeftRightIcon', description: 'نظام المراسلة والترجمة' },
  { id: 'invoices',           path: '/invoices',                nameAr: 'الفواتير',                 nameEn: 'Invoices',              category: 'buyer',   roles: ['buyer', 'factory'], icon: 'DocumentDuplicateIcon', description: 'مركز الفواتير' },
  { id: 'disputes',           path: '/disputes',                nameAr: 'النزاعات',                 nameEn: 'Disputes',              category: 'buyer',   roles: ['buyer', 'factory'], icon: 'ScaleIcon',             description: 'نظام إدارة النزاعات' },
  { id: 'notifications',      path: '/notifications',           nameAr: 'الإشعارات',                nameEn: 'Notifications',         category: 'buyer',   roles: ['buyer', 'factory', 'admin'], icon: 'BellIcon', description: 'مركز الإشعارات' },
  { id: 'my-account',         path: '/my-account',              nameAr: 'حسابي',                    nameEn: 'My Account',            category: 'buyer',   roles: ['buyer', 'consumer'], icon: 'UserCircleIcon',        description: 'صفحة الحساب الشخصي' },
  { id: 'financial-accounts', path: '/financial-accounts',      nameAr: 'الحسابات المالية',         nameEn: 'Financial Accounts',    category: 'buyer',   roles: ['buyer', 'factory'], icon: 'BanknotesIcon',         description: 'إدارة الحسابات المالية' },
  { id: 'kyc',                path: '/kyc',                     nameAr: 'التحقق من الهوية',         nameEn: 'KYC Verification',      category: 'buyer',   roles: ['buyer', 'factory'], icon: 'IdentificationIcon',    description: 'نظام التحقق من الهوية' },
  // ── Factory / Manufacturer ──
  { id: 'factory-register',   path: '/factory/register',        nameAr: 'تسجيل المصنع',             nameEn: 'Factory Register',      category: 'factory', roles: ['factory'], icon: 'BuildingOffice2Icon',   description: 'نموذج تسجيل المصنع' },
  { id: 'factory-products',   path: '/factory/products',        nameAr: 'منتجات المصنع',            nameEn: 'Factory Products',      category: 'factory', roles: ['factory'], icon: 'CubeIcon',              description: 'إدارة منتجات المصنع' },
  { id: 'manufacturer-login', path: '/manufacturer/login',      nameAr: 'دخول المصنّع',             nameEn: 'Manufacturer Login',    category: 'factory', roles: ['factory'], icon: 'ArrowRightOnRectangleIcon', description: 'صفحة دخول المصنّع' },
  { id: 'manufacturer-dash',  path: '/manufacturer/dashboard',  nameAr: 'لوحة المصنّع',             nameEn: 'Manufacturer Dashboard',category: 'factory', roles: ['factory'], icon: 'RectangleGroupIcon',    description: 'لوحة تحكم المصنّع' },
  { id: 'manufacturer-erp',   path: '/manufacturer/erp',        nameAr: 'نظام ERP',                 nameEn: 'Manufacturer ERP',      category: 'factory', roles: ['factory'], icon: 'CircleStackIcon',       description: 'نظام تخطيط موارد المصنع المحلي' },
  { id: 'seller-products',    path: '/seller/products',         nameAr: 'منتجات البائع',            nameEn: 'Seller Products',       category: 'factory', roles: ['factory'], icon: 'TagIcon',               description: 'إدارة منتجات البائع' },
  { id: 'order-fulfillment',  path: '/order-fulfillment',       nameAr: 'تنفيذ الطلبات',            nameEn: 'Order Fulfillment',     category: 'factory', roles: ['factory'], icon: 'CheckBadgeIcon',        description: 'مركز تنفيذ الطلبات' },
  { id: 'management',         path: '/management',              nameAr: 'الإدارة',                  nameEn: 'Management',            category: 'factory', roles: ['factory', 'admin'], icon: 'Cog6ToothIcon', description: 'لوحة الإدارة' },
  { id: 'operations',         path: '/operations',              nameAr: 'العمليات',                 nameEn: 'Operations',            category: 'factory', roles: ['factory', 'admin'], icon: 'WrenchScrewdriverIcon', description: 'مركز العمليات' },
  // ── Agent ──
  { id: 'agent-login',        path: '/agent/login',             nameAr: 'دخول الوكيل',              nameEn: 'Agent Login',           category: 'agent',   roles: ['agent'],  icon: 'ArrowRightOnRectangleIcon', description: 'صفحة دخول الوكيل الميداني' },
  { id: 'agent-dashboard',    path: '/agent/dashboard',         nameAr: 'لوحة الوكيل',              nameEn: 'Agent Dashboard',       category: 'agent',   roles: ['agent'],  icon: 'RectangleGroupIcon',    description: 'لوحة تحكم الوكيل الميداني' },
  { id: 'agent-register',     path: '/agent/register-factory',  nameAr: 'تسجيل مصنع (وكيل)',        nameEn: 'Agent Register Factory',category: 'agent',   roles: ['agent'],  icon: 'PlusCircleIcon',        description: 'تسجيل مصنع عبر الوكيل' },
  // ── Logistics room ──
  { id: 'logistics-dashboard', path: '/logistics/dashboard',    nameAr: 'لوحة اللوجستيات',          nameEn: 'Logistics Dashboard',   category: 'feature', roles: ['public'], icon: 'TruckIcon',             description: 'لوحة تحكم الشريك اللوجستي (حصرية للدور اللوجستي)' },
  // ── Auth ──
  { id: 'login',              path: '/login',                   nameAr: 'تسجيل الدخول',             nameEn: 'Login',                 category: 'auth',    roles: ['public'], icon: 'LockClosedIcon',        description: 'صفحة تسجيل الدخول' },
  { id: 'auth-role',          path: '/auth/role-selection',     nameAr: 'اختيار الدور / التسجيل',   nameEn: 'Unified Registration',  category: 'auth',    roles: ['public'], icon: 'UserGroupIcon',         description: 'صفحة التسجيل الموحدة (مشتري / B2S / B2B)' },
  { id: 'auth-reset',         path: '/auth/reset-password',     nameAr: 'إعادة تعيين كلمة المرور',  nameEn: 'Reset Password',        category: 'auth',    roles: ['public'], icon: 'KeyIcon',               description: 'صفحة إعادة تعيين كلمة المرور' },
  { id: 'auth-social',        path: '/auth/social-login',       nameAr: 'الدخول الاجتماعي',         nameEn: 'Social Login',          category: 'auth',    roles: ['public'], icon: 'ShareIcon',             description: 'صفحة الدخول عبر الشبكات الاجتماعية' },
  // ── Admin ──
  { id: 'control-room',       path: '/admin/control-room',      nameAr: 'غرفة التحكم',              nameEn: 'Control Room',          category: 'admin',   roles: ['admin'],  icon: 'CpuChipIcon',           description: 'غرفة التحكم الإدارية' },
  // ── Legal ──
  { id: 'legal-shipping',     path: '/legal/shipping-terms',    nameAr: 'شروط الشحن',               nameEn: 'Shipping Terms',        category: 'legal',   roles: ['public'], icon: 'DocumentTextIcon',      description: 'شروط وأحكام الشحن' },
  { id: 'legal-buyer',        path: '/legal/buyer-protection',  nameAr: 'حماية المشتري',            nameEn: 'Buyer Protection',      category: 'legal',   roles: ['public'], icon: 'ShieldCheckIcon',       description: 'سياسة حماية المشتري' },
  // ── Feature Pages ──
  { id: 'order-status',       path: '/order-status',            nameAr: 'حالة الطلب',               nameEn: 'Order Status',          category: 'feature', roles: ['buyer', 'factory'], icon: 'ClockIcon', description: 'صفحة حالة الطلب' },
  { id: 'order-confirmation', path: '/order-confirmation',      nameAr: 'تأكيد الطلب',              nameEn: 'Order Confirmation',    category: 'feature', roles: ['buyer'],  icon: 'CheckCircleIcon',       description: 'صفحة تأكيد الطلب' },
  { id: 'account-upgrade',    path: '/account/upgrade',         nameAr: 'ترقية الحساب',             nameEn: 'Account Upgrade',       category: 'feature', roles: ['buyer', 'factory'], icon: 'ArrowUpCircleIcon', description: 'صفحة ترقية الحساب' },
  { id: 'logistics-register', path: '/logistics/register',      nameAr: 'تسجيل شريك لوجستي',        nameEn: 'Logistics Register',    category: 'feature', roles: ['public'], icon: 'TruckIcon',             description: 'تسجيل شريك لوجستي جديد' },
  // ── NEW: Notification & Sales Hub ──
  { id: 'notification-engine', path: '/notifications',          nameAr: 'محرك الإشعارات التكتيكية', nameEn: 'Tactical Notification Engine', category: 'feature', roles: ['buyer', 'factory', 'admin'], icon: 'BellAlertIcon', description: 'نظام الإشعارات التكتيكية الفورية' },
];

// ─── All API Endpoints ────────────────────────────────────────────────────────
// Add new API routes here — they auto-appear in diagnostics.

export const API_ROUTES: ApiEndpoint[] = [
  { id: 'api-manifest',          path: '/api/manifest',                    method: 'GET',  nameAr: 'ملف التطبيق',             nameEn: 'App Manifest',          description: 'ملف manifest التطبيق',           module: 'core' },
  { id: 'api-track-visit',       path: '/api/track-visit',                 method: 'POST', nameAr: 'تتبع الزيارات',           nameEn: 'Visit Tracker',         description: 'API تتبع الزيارات',              module: 'analytics' },
  { id: 'api-icons',             path: '/api/icons/192',                   method: 'GET',  nameAr: 'أيقونات التطبيق',         nameEn: 'App Icons',             description: 'API توليد الأيقونات',            module: 'core' },
  { id: 'api-translate',         path: '/api/ai/translate',                method: 'POST', nameAr: 'الترجمة الفورية',         nameEn: 'Translation AI',        description: 'API الترجمة الفورية بالذكاء الاصطناعي', module: 'messaging' },
  { id: 'api-chat-completion',   path: '/api/ai/chat-completion',          method: 'POST', nameAr: 'محادثة الذكاء الاصطناعي', nameEn: 'AI Chat Completion',    description: 'API محادثة الذكاء الاصطناعي',    module: 'ai' },
  { id: 'api-rfq-routing',       path: '/api/ai/rfq-routing',              method: 'POST', nameAr: 'توجيه طلبات الأسعار',     nameEn: 'RFQ Smart Routing',     description: 'API التوجيه الذكي لطلبات الأسعار', module: 'rfq' },
  { id: 'api-factory-assistant', path: '/api/ai/factory-assistant',        method: 'POST', nameAr: 'مساعد المصنع',            nameEn: 'Factory AI Assistant',  description: 'API مساعد المصنع الذكي',          module: 'ai' },
  { id: 'api-partner-verify',    path: '/api/ai/partner-verify',           method: 'POST', nameAr: 'التحقق من الشريك',        nameEn: 'Partner Verification',  description: 'API التحقق من الشركاء',           module: 'kyc' },
  { id: 'api-quotes-send',       path: '/api/quotes/send',                 method: 'POST', nameAr: 'إرسال عرض سعر',           nameEn: 'Send Quote',            description: 'API إرسال عرض سعر من المصنع',    module: 'b2b' },
  { id: 'api-quotes-accept',     path: '/api/quotes/accept',               method: 'POST', nameAr: 'قبول عرض سعر',            nameEn: 'Accept Quote',          description: 'API قبول عرض السعر',              module: 'b2b' },
  { id: 'api-payment-submit',    path: '/api/payment/submit',              method: 'POST', nameAr: 'رفع إيصال الدفع',         nameEn: 'Submit Payment',        description: 'API رفع إيصال الدفع',             module: 'escrow' },
  { id: 'api-escrow-greenlight', path: '/api/escrow/green-light',          method: 'POST', nameAr: 'الإشارة الخضراء',         nameEn: 'Escrow Green Light',    description: 'API تأكيد الدفع من الأدمن',       module: 'escrow' },
  { id: 'api-escrow-mark-ready', path: '/api/escrow/mark-ready',           method: 'POST', nameAr: 'إعلان الجاهزية',          nameEn: 'Mark Ready',            description: 'API إعلان جاهزية المصنع',         module: 'escrow' },
  { id: 'api-escrow-release',    path: '/api/escrow/release-by-code',      method: 'POST', nameAr: 'تحرير الأموال',           nameEn: 'Release by Code',       description: 'API تحرير الأموال برمز الإطلاق',  module: 'escrow' },
  { id: 'api-escrow-dispute',    path: '/api/escrow/dispute',              method: 'POST', nameAr: 'رفع نزاع',                nameEn: 'Escrow Dispute',        description: 'API رفع نزاع على الضمان المالي',  module: 'escrow' },
  { id: 'api-escrow-otp',        path: '/api/escrow/otp',                  method: 'POST', nameAr: 'رمز OTP',                 nameEn: 'Escrow OTP',            description: 'API توليد رمز OTP للضمان',        module: 'escrow' },
  { id: 'api-whatsapp-send',     path: '/api/whatsapp/send',               method: 'POST', nameAr: 'إرسال واتساب',            nameEn: 'WhatsApp Send',         description: 'API إرسال رسائل واتساب',          module: 'notifications' },
  { id: 'api-invoice-generate',  path: '/api/invoices/generate-from-order',method: 'POST', nameAr: 'توليد فاتورة',            nameEn: 'Generate Invoice',      description: 'API توليد فاتورة من طلب',         module: 'invoices' },
  // ── NEW: Notification Engine ──
  { id: 'api-notifications',     path: '/notifications',                   method: 'GET',  nameAr: 'مركز الإشعارات',          nameEn: 'Notifications Center',  description: 'مركز الإشعارات التكتيكية',        module: 'notifications' },
];

// ─── Simulation Modules ───────────────────────────────────────────────────────
// Each module defines a workflow. Steps are derived from real platform routes/APIs.
// Add new modules here to auto-register them in the Simulation Hub.

export type SimRole = 'buyer' | 'factory' | 'admin' | 'system' | 'consumer' | 'supplier' | 'agent';

export interface SimStep {
  id: number;
  titleAr: string;
  role: SimRole;
  roleLabel: string;
  roleColor: string;
  action: string;
  /** Optional: links this step to a real API endpoint id from API_ROUTES */
  apiRef?: string;
  /** Optional: links this step to a real platform route id from PLATFORM_ROUTES */
  routeRef?: string;
}

export interface SimModule {
  id: string;
  title: string;
  titleEn: string;
  icon: string;
  color: string;
  bgGradient: string;
  description: string;
  /** Route IDs from PLATFORM_ROUTES that this module exercises */
  relatedRoutes: string[];
  /** API IDs from API_ROUTES that this module exercises */
  relatedApis: string[];
  steps: SimStep[];
}

export const SIMULATION_MODULES: SimModule[] = [
  {
    id: 'b2b',
    title: 'علاقات المصانع والمشترين',
    titleEn: 'B2B Factory–Buyer',
    icon: 'BuildingOffice2Icon',
    color: 'text-blue-400',
    bgGradient: 'from-blue-600 to-blue-800',
    description: 'محاكاة دورة طلب عروض الأسعار RFQ من المشتري إلى المصنع وقبول العرض',
    relatedRoutes: ['rfq-board', 'rfq-management', 'buyer-dashboard', 'manufacturer-dash', 'orders'],
    relatedApis: ['api-quotes-send', 'api-quotes-accept', 'api-rfq-routing'],
    steps: [
      { id: 1, titleAr: 'المشتري ينشر طلب عرض سعر (RFQ)', role: 'buyer',   roleLabel: 'مشتري', roleColor: 'bg-blue-500',    action: 'create_rfq',    routeRef: 'rfq-board' },
      { id: 2, titleAr: 'المصنع يستلم الطلب ويرسل عرضاً', role: 'factory', roleLabel: 'مصنع',  roleColor: 'bg-orange-500', action: 'send_quote',    apiRef: 'api-quotes-send' },
      { id: 3, titleAr: 'المشتري يراجع العرض ويقبله',      role: 'buyer',   roleLabel: 'مشتري', roleColor: 'bg-blue-500',    action: 'accept_quote',  apiRef: 'api-quotes-accept' },
      { id: 4, titleAr: 'النظام يحوّل العرض إلى طلب رسمي', role: 'system',  roleLabel: 'النظام',roleColor: 'bg-slate-500',   action: 'convert_order', routeRef: 'orders' },
      { id: 5, titleAr: 'إشعار تكتيكي للطرفين بتأكيد الصفقة', role: 'system', roleLabel: 'الإشعارات', roleColor: 'bg-emerald-600', action: 'notify_both', routeRef: 'notifications' },
    ],
  },
  {
    id: 'b2c',
    title: 'المستهلكون والمتاجر',
    titleEn: 'B2C Consumer–Store',
    icon: 'ShoppingBagIcon',
    color: 'text-pink-400',
    bgGradient: 'from-pink-600 to-rose-700',
    description: 'محاكاة رحلة المستهلك من تصفح المتجر إلى إتمام الشراء وتقييم المنتج',
    relatedRoutes: ['cart', 'checkout', 'orders', 'order-tracking', 'order-confirmation'],
    relatedApis: ['api-payment-submit', 'api-invoice-generate'],
    steps: [
      { id: 1, titleAr: 'المستهلك يتصفح المتجر ويضيف للسلة', role: 'consumer', roleLabel: 'مستهلك', roleColor: 'bg-pink-500',    action: 'add_to_cart',    routeRef: 'cart' },
      { id: 2, titleAr: 'المستهلك يكمل بيانات الشحن والدفع', role: 'consumer', roleLabel: 'مستهلك', roleColor: 'bg-pink-500',    action: 'checkout',       routeRef: 'checkout' },
      { id: 3, titleAr: 'المورد يستلم الطلب ويؤكده',          role: 'supplier', roleLabel: 'مورد',   roleColor: 'bg-orange-500', action: 'confirm_order',  routeRef: 'order-fulfillment' },
      { id: 4, titleAr: 'تحديث حالة الشحن والتتبع',           role: 'system',   roleLabel: 'النظام', roleColor: 'bg-slate-500',   action: 'update_shipping',routeRef: 'order-tracking' },
      { id: 5, titleAr: 'المستهلك يستلم ويقيّم المنتج',       role: 'consumer', roleLabel: 'مستهلك', roleColor: 'bg-emerald-600', action: 'review_product', routeRef: 'order-confirmation' },
    ],
  },
  {
    id: 'messaging',
    title: 'نظام المراسلة والترجمة',
    titleEn: 'Messaging & Translation',
    icon: 'ChatBubbleLeftRightIcon',
    color: 'text-violet-400',
    bgGradient: 'from-violet-600 to-purple-800',
    description: 'محاكاة المراسلة الثنائية اللغة بين المشتري العربي والمورد الأجنبي مع الترجمة الفورية',
    relatedRoutes: ['messaging'],
    relatedApis: ['api-translate', 'api-chat-completion'],
    steps: [
      { id: 1, titleAr: 'المشتري يفتح محادثة مع المورد',              role: 'buyer',   roleLabel: 'مشتري',   roleColor: 'bg-blue-500',    action: 'open_chat',       routeRef: 'messaging' },
      { id: 2, titleAr: 'المشتري يكتب رسالة بالعربية',                role: 'buyer',   roleLabel: 'مشتري',   roleColor: 'bg-blue-500',    action: 'write_arabic',    routeRef: 'messaging' },
      { id: 3, titleAr: 'النظام يترجم الرسالة للإنجليزية فورياً',     role: 'system',  roleLabel: 'الترجمة', roleColor: 'bg-violet-500',  action: 'translate_msg',   apiRef: 'api-translate' },
      { id: 4, titleAr: 'المورد يستلم الرسالة بالإنجليزية',           role: 'supplier',roleLabel: 'مورد',    roleColor: 'bg-orange-500', action: 'receive_msg',     routeRef: 'messaging' },
      { id: 5, titleAr: 'المورد يرد بالإنجليزية — يُترجم للعربية',    role: 'supplier',roleLabel: 'مورد',    roleColor: 'bg-emerald-600', action: 'reply_translated',apiRef: 'api-translate' },
    ],
  },
  {
    id: 'light_orders',
    title: 'الطلبات الخفيفة والمتاجر (B2S)',
    titleEn: 'B2S Light Orders & Stores',
    icon: 'BuildingStorefrontIcon',
    color: 'text-teal-400',
    bgGradient: 'from-teal-500 to-teal-800',
    description: 'محاكاة طلبات المتاجر المحلية والبقالات (3-4 كراتين) من الاستعراض إلى التسليم السريع',
    relatedRoutes: ['cart', 'checkout', 'orders', 'order-tracking', 'order-status', 'order-fulfillment'],
    relatedApis: ['api-payment-submit', 'api-whatsapp-send'],
    steps: [
      { id: 1, titleAr: 'المتجر المحلي يختار منتجاً ويحدد الكمية (3-4 كراتين)', role: 'buyer',   roleLabel: 'متجر B2S', roleColor: 'bg-teal-500',   action: 'select_product',   routeRef: 'cart' },
      { id: 2, titleAr: 'إرسال طلب خفيف مباشر للمورد',                          role: 'buyer',   roleLabel: 'متجر B2S', roleColor: 'bg-teal-500',   action: 'place_light_order',routeRef: 'checkout' },
      { id: 3, titleAr: 'المورد يؤكد ويجهّز الطلب الصغير',                      role: 'supplier',roleLabel: 'مورد',     roleColor: 'bg-orange-500', action: 'prepare_order',    routeRef: 'order-fulfillment' },
      { id: 4, titleAr: 'الشحن والتسليم السريع للمتجر',                          role: 'system',  roleLabel: 'الشحن',    roleColor: 'bg-slate-500',  action: 'fast_delivery',    routeRef: 'order-tracking' },
      { id: 5, titleAr: 'تأكيد الاستلام وإشعار واتساب للمتجر',                  role: 'buyer',   roleLabel: 'متجر B2S', roleColor: 'bg-emerald-600', action: 'confirm_receipt', apiRef: 'api-whatsapp-send' },
    ],
  },
  {
    id: 'escrow',
    title: 'دورة الضمان المالي',
    titleEn: 'Escrow Cycle',
    icon: 'ShieldCheckIcon',
    color: 'text-emerald-400',
    bgGradient: 'from-emerald-600 to-teal-800',
    description: 'المحاكاة الكاملة لدورة الضمان المالي من الدفع إلى تحرير الأموال برمز الإطلاق',
    relatedRoutes: ['financial-accounts', 'orders', 'disputes'],
    relatedApis: ['api-payment-submit', 'api-escrow-greenlight', 'api-escrow-mark-ready', 'api-escrow-release', 'api-escrow-otp'],
    steps: [
      { id: 1, titleAr: 'المشتري ينشئ الطلب ويرفع إيصال الدفع', role: 'buyer',   roleLabel: 'مشتري', roleColor: 'bg-blue-500',    action: 'create_order',   apiRef: 'api-payment-submit' },
      { id: 2, titleAr: 'الأدمن يؤكد الدفع — Escrow Funded',     role: 'admin',   roleLabel: 'أدمن',  roleColor: 'bg-purple-600', action: 'admin_confirm',  apiRef: 'api-escrow-greenlight' },
      { id: 3, titleAr: 'المصنع يجهّز البضاعة ويُعلن الجاهزية',  role: 'factory', roleLabel: 'مصنع',  roleColor: 'bg-orange-500', action: 'factory_ready',  apiRef: 'api-escrow-mark-ready' },
      { id: 4, titleAr: 'المشتري يفحص ويدخل رمز الإطلاق',        role: 'buyer',   roleLabel: 'مشتري', roleColor: 'bg-blue-500',    action: 'enter_code',     apiRef: 'api-escrow-release' },
      { id: 5, titleAr: 'تحرير الأموال — الإشارة الخضراء 🟢',    role: 'system',  roleLabel: 'النظام',roleColor: 'bg-emerald-600', action: 'release_funds',  apiRef: 'api-escrow-release' },
    ],
  },
  // ── NEW: Unified Registration Module ──
  {
    id: 'registration',
    title: 'التسجيل الموحد للمستخدمين',
    titleEn: 'Unified User Registration',
    icon: 'UserGroupIcon',
    color: 'text-indigo-400',
    bgGradient: 'from-indigo-600 to-indigo-900',
    description: 'محاكاة مسارات التسجيل الثلاثة: مشتري، متجر محلي B2S، ومصنع B2B',
    relatedRoutes: ['login', 'auth-role', 'my-account', 'factory-register', 'manufacturer-dash'],
    relatedApis: ['api-notifications'],
    steps: [
      { id: 1, titleAr: 'المستخدم يصل لصفحة التسجيل الموحدة',   role: 'buyer',   roleLabel: 'مستخدم', roleColor: 'bg-indigo-500', action: 'open_registration', routeRef: 'auth-role' },
      { id: 2, titleAr: 'اختيار نوع الحساب (مشتري/B2S/B2B)',    role: 'buyer',   roleLabel: 'مستخدم', roleColor: 'bg-indigo-500', action: 'select_flow',       routeRef: 'auth-role' },
      { id: 3, titleAr: 'حفظ نوع الحساب وتوجيه للوحة المناسبة', role: 'system',  roleLabel: 'النظام', roleColor: 'bg-slate-500',  action: 'save_role',         routeRef: 'my-account' },
      { id: 4, titleAr: 'إشعار ترحيب تلقائي للمستخدم الجديد',   role: 'system',  roleLabel: 'الإشعارات', roleColor: 'bg-emerald-600', action: 'welcome_notify', routeRef: 'notifications' },
      { id: 5, titleAr: 'المصنع/المتجر يكمل بيانات التسجيل',    role: 'factory', roleLabel: 'مصنع/متجر', roleColor: 'bg-orange-500', action: 'complete_reg',   routeRef: 'factory-register' },
    ],
  },
  // ── NEW: Tactical Notifications Module ──
  {
    id: 'notifications',
    title: 'الإشعارات التكتيكية الذكية',
    titleEn: 'Tactical Smart Notifications',
    icon: 'BellAlertIcon',
    color: 'text-amber-400',
    bgGradient: 'from-amber-500 to-orange-700',
    description: 'محاكاة نظام الإشعارات التكتيكية الفورية الذي يغطي كل تفاعل في المنصة',
    relatedRoutes: ['notifications', 'messaging', 'orders', 'financial-accounts'],
    relatedApis: ['api-whatsapp-send', 'api-translate'],
    steps: [
      { id: 1, titleAr: 'حدث جديد في المنصة (طلب/رسالة/دفع)',   role: 'system',  roleLabel: 'النظام',    roleColor: 'bg-slate-500',   action: 'event_trigger',    routeRef: 'orders' },
      { id: 2, titleAr: 'محرك الإشعارات يكتشف الحدث تلقائياً',  role: 'system',  roleLabel: 'الإشعارات', roleColor: 'bg-amber-500',   action: 'detect_event',     routeRef: 'notifications' },
      { id: 3, titleAr: 'توليد إشعار تكتيكي مخصص للمستخدم',     role: 'system',  roleLabel: 'الإشعارات', roleColor: 'bg-amber-500',   action: 'generate_notif',   routeRef: 'notifications' },
      { id: 4, titleAr: 'إرسال إشعار واتساب للأحداث الحرجة',    role: 'system',  roleLabel: 'واتساب',    roleColor: 'bg-green-600',   action: 'send_whatsapp',    apiRef: 'api-whatsapp-send' },
      { id: 5, titleAr: 'المستخدم يستلم الإشعار ويتخذ إجراءً',  role: 'buyer',   roleLabel: 'مستخدم',    roleColor: 'bg-blue-500',    action: 'user_action',      routeRef: 'notifications' },
    ],
  },
];

// ─── Derived Helpers ──────────────────────────────────────────────────────────

/** Returns all routes as diagnostic check points (used by PlatformDiagnosticsPanel) */
export function getDiagnosticChecks() {
  const routeChecks = PLATFORM_ROUTES.map(r => ({
    id: r.id,
    name: r.nameEn,
    nameAr: r.nameAr,
    category: mapCategoryToDiag(r.category),
    url: r.path,
    description: r.description,
  }));

  const apiChecks = API_ROUTES.map(a => ({
    id: a.id,
    name: a.nameEn,
    nameAr: a.nameAr,
    category: 'api' as const,
    url: a.path,
    description: a.description,
  }));

  return [...routeChecks, ...apiChecks];
}

function mapCategoryToDiag(cat: RouteCategory): 'route' | 'api' | 'auth' | 'feature' {
  if (cat === 'auth') return 'auth';
  if (cat === 'core' || cat === 'buyer' || cat === 'factory' || cat === 'agent' || cat === 'admin' || cat === 'legal') return 'route';
  return 'feature';
}

/** Returns the API endpoints related to a given simulation module */
export function getModuleApis(moduleId: string): ApiEndpoint[] {
  const mod = SIMULATION_MODULES.find(m => m.id === moduleId);
  if (!mod) return [];
  return mod.relatedApis
    .map(apiId => API_ROUTES.find(a => a.id === apiId))
    .filter(Boolean) as ApiEndpoint[];
}

/** Returns the platform routes related to a given simulation module */
export function getModuleRoutes(moduleId: string): PlatformRoute[] {
  const mod = SIMULATION_MODULES.find(m => m.id === moduleId);
  if (!mod) return [];
  return mod.relatedRoutes
    .map(routeId => PLATFORM_ROUTES.find(r => r.id === routeId))
    .filter(Boolean) as PlatformRoute[];
}

/** Total step count across all simulation modules */
export function getTotalSimSteps(): number {
  return SIMULATION_MODULES.reduce((acc, m) => acc + m.steps.length, 0);
}

/**
 * Auto-discovery: Returns all unique route IDs referenced by any simulation module.
 * Used to verify that new routes are covered by at least one simulation module.
 */
export function getSimulationCoveredRoutes(): string[] {
  const covered = new Set<string>();
  SIMULATION_MODULES.forEach(m => m.relatedRoutes.forEach(r => covered.add(r)));
  return Array.from(covered);
}

/**
 * Auto-discovery: Returns all unique API IDs referenced by any simulation module.
 */
export function getSimulationCoveredApis(): string[] {
  const covered = new Set<string>();
  SIMULATION_MODULES.forEach(m => m.relatedApis.forEach(a => covered.add(a)));
  return Array.from(covered);
}

/**
 * Returns routes NOT yet covered by any simulation module.
 * Useful for diagnostics to flag gaps in simulation coverage.
 */
export function getUncoveredRoutes(): PlatformRoute[] {
  const covered = new Set(getSimulationCoveredRoutes());
  return PLATFORM_ROUTES.filter(r => !covered.has(r.id));
}

/**
 * Returns a full platform health summary for the diagnostics panel.
 */
export function getPlatformHealthSummary() {
  return {
    totalRoutes: PLATFORM_ROUTES.length,
    totalApis: API_ROUTES.length,
    totalSimModules: SIMULATION_MODULES.length,
    totalSimSteps: getTotalSimSteps(),
    coveredRoutes: getSimulationCoveredRoutes().length,
    coveredApis: getSimulationCoveredApis().length,
    uncoveredRoutes: getUncoveredRoutes().length,
    routeCoverage: Math.round((getSimulationCoveredRoutes().length / PLATFORM_ROUTES.length) * 100),
  };
}
