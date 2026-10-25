export type SupplierModuleKey =
  | 'products' |'rfq' |'orders' |'escrow' |'finance' |'bank-accounts' |'settings' |'disputes' |'archive' |'messages';

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
  { key: 'account', title: 'الحساب والتوثيق والمراسلات', subtitle: 'Account & Compliance' },
];

export const SUPPLIER_MODULES: SupplierModuleDef[] = [
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
    key: 'rfq',
    section: 'catalog',
    icon: '📋',
    title: 'طلبات عروض الأسعار',
    hint: 'الاستفسارات الواردة وتقديم عروض الأسعار',
    accent: 'from-purple-600/30 to-purple-900/20 border-purple-500/30',
    staticBadges: ['RFQ'],
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
    key: 'escrow',
    section: 'financials',
    icon: '🔒',
    title: 'طلبات الضمان',
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
    title: 'الحسابات البنكية',
    hint: 'حسابات استلام المدفوعات',
    accent: 'from-emerald-600/30 to-emerald-900/20 border-emerald-500/30',
    staticBadges: [],
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
    title: 'النزاعات',
    hint: 'متابعة النزاعات المفتوحة على الطلبات',
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
