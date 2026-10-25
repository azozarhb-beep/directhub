export type SupplierModuleKey =
  | 'inventory' |'products' |'distribution' |'rfq' |'deal-links' |'orders' |'logistics' |'escrow' |'finance' |'bank-accounts' |'analytics' |'settings' |'disputes' |'archive' |'messages';

export type SupplierSectionKey = 'catalog' | 'operations' | 'financials' | 'account';

export interface SupplierModuleDef {
  key: SupplierModuleKey;
  section: SupplierSectionKey;
  icon: string;
  title: string;
  hint: string;
  accent: string;
  staticBadges: string[];
}

export interface SupplierSectionDef {
  key: SupplierSectionKey;
  title: string;
  subtitle: string;
}

export const SUPPLIER_SECTIONS: SupplierSectionDef[] = [
  { key: 'catalog', title: 'المنتجات والتوريدات', subtitle: 'Products & Supply' },
  { key: 'operations', title: 'الطلبات والعمليات', subtitle: 'Orders & Operations' },
  { key: 'financials', title: 'المالية والضمان والحسابات', subtitle: 'Financials & Escrow' },
  { key: 'account', title: 'التحليلات والتوثيق والمراسلات', subtitle: 'Analytics & Compliance' },
];

export const SUPPLIER_MODULES: SupplierModuleDef[] = [
  {
    key: 'inventory',
    section: 'catalog',
    icon: '📦',
    title: 'المخزون والمستودع',
    hint: 'أصناف المستودع بالكرتون والبالة والبندل والدرزن والكيس والرول',
    accent: 'from-cyan-600/30 to-cyan-900/20 border-cyan-500/30',
    staticBadges: ['مستودع'],
  },
  {
    key: 'products',
    section: 'catalog',
    icon: '🛍️',
    title: 'المنتجات للبيع',
    hint: 'منتجات الجملة والتجزئة والتوريدات التجارية',
    accent: 'from-teal-600/30 to-teal-900/20 border-teal-500/30',
    staticBadges: ['جملة', 'تجزئة'],
  },
  {
    key: 'distribution',
    section: 'catalog',
    icon: '🚚',
    title: 'القدرة التوريدية وقنوات التوزيع',
    hint: 'القدرة التوريدية الشهرية وقنوات التوزيع وسلاسل التوريد',
    accent: 'from-amber-600/30 to-amber-900/20 border-amber-500/30',
    staticBadges: ['توريد'],
  },
  {
    key: 'rfq',
    section: 'catalog',
    icon: '📋',
    title: 'عروض الأسعار والتوريد',
    hint: 'الاستفسارات الواردة وتقديم عروض الأسعار',
    accent: 'from-purple-600/30 to-purple-900/20 border-purple-500/30',
    staticBadges: ['RFQ'],
  },
  {
    key: 'deal-links',
    section: 'catalog',
    icon: '🔗',
    title: 'رابط صفقة مخصص للعملاء',
    hint: 'أنشئ رابط صفقة بشروط مقفلة وأرسله للعميل',
    accent: 'from-pink-600/30 to-pink-900/20 border-pink-500/30',
    staticBadges: ['Deal Link'],
  },
  {
    key: 'orders',
    section: 'operations',
    icon: '🧾',
    title: 'إدارة الطلبات',
    hint: 'طلبات الجملة والتجزئة وحالاتها',
    accent: 'from-orange-600/30 to-orange-900/20 border-orange-500/30',
    staticBadges: [],
  },
  {
    key: 'logistics',
    section: 'operations',
    icon: '🚛',
    title: 'الشحن وتوصيل البضائع',
    hint: 'بيانات الناقل ورقم التتبع وتتبع التوصيل',
    accent: 'from-indigo-600/30 to-indigo-900/20 border-indigo-500/30',
    staticBadges: ['تتبع'],
  },
  {
    key: 'escrow',
    section: 'financials',
    icon: '🔒',
    title: 'الضمان المالي',
    hint: 'حالة الضمان المالي ورمز التسليم لكل طلب',
    accent: 'from-blue-600/30 to-blue-900/20 border-blue-500/30',
    staticBadges: ['Escrow'],
  },
  {
    key: 'finance',
    section: 'financials',
    icon: '💵',
    title: 'المالية والأرباح',
    hint: 'الأرباح وإعدادات الدفع بالريال اليمني',
    accent: 'from-lime-600/30 to-lime-900/20 border-lime-500/30',
    staticBadges: ['YER'],
  },
  {
    key: 'bank-accounts',
    section: 'financials',
    icon: '🏦',
    title: 'حسابات البنوك اليمنية',
    hint: 'حسابات استلام المدفوعات بالريال اليمني',
    accent: 'from-emerald-600/30 to-emerald-900/20 border-emerald-500/30',
    staticBadges: ['YER'],
  },
  {
    key: 'analytics',
    section: 'account',
    icon: '📊',
    title: 'المؤشرات التجارية وحركة المخزون',
    hint: 'حركة المبيعات والطلبات وأداء روابط الصفقات وحركة المخزون والتدفق المالي',
    accent: 'from-violet-600/30 to-violet-900/20 border-violet-500/30',
    staticBadges: ['KPIs'],
  },
  {
    key: 'settings',
    section: 'account',
    icon: '🛡️',
    title: 'إعدادات وتوثيق المورد',
    hint: 'السجل التجاري والوكالة والاسم التجاري والرقم الضريبي',
    accent: 'from-sky-600/30 to-sky-900/20 border-sky-500/30',
    staticBadges: [],
  },
  {
    key: 'disputes',
    section: 'account',
    icon: '⚖️',
    title: 'فض النزاعات التجارية',
    hint: 'متابعة النزاعات المفتوحة على الطلبات والوساطة',
    accent: 'from-red-600/30 to-red-900/20 border-red-500/30',
    staticBadges: [],
  },
  {
    key: 'archive',
    section: 'account',
    icon: '🗂️',
    title: 'الأرشيف',
    hint: 'السجلات والعمليات المؤرشفة',
    accent: 'from-slate-600/30 to-slate-900/20 border-slate-500/30',
    staticBadges: [],
  },
  {
    key: 'messages',
    section: 'account',
    icon: '💬',
    title: 'التواصل مع الإدارة',
    hint: 'محادثة مباشرة مع إدارة المنصة',
    accent: 'from-rose-600/30 to-rose-900/20 border-rose-500/30',
    staticBadges: ['Admin'],
  },
];

export function getSupplierModule(key: string | null | undefined): SupplierModuleDef | null {
  return SUPPLIER_MODULES.find((m) => m.key === key) ?? null;
}
